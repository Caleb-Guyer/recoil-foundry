import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { overtimeFurnaceTestFromUrl, overtimeDocksTestFromUrl } from '../src/practice.ts';
import { PRESSURE, PRESSURE_SHIFT } from '../src/pressure.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { traceTorch } from '../src/torch.ts';
const { Body, Bodies, Composite } = Matter;
const rooms = ['boilers', 'gallery', 'tunnel', 'flue', 'press', 'kiln'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1300, y: 500 },
};
const fixture = (room: string, mirror = false) =>
  overtimeFurnaceTestFromUrl(
    new URL(`https://test/?test=overtime-furnace&room=${room}&mirror=${Number(mirror)}`),
  )!;
function game(room = 'boilers', mirror = false) {
  const g = new Game();
  g.startTest(fixture(room, mirror));
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.waves.held = true;
  g.waves.phase = 'opening';
}
const overlap = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.5 && a.x < b.x + b.w - 0.5 && a.y + a.h > b.y + 0.5 && a.y < b.y + b.h - 0.5;
function rig(hot = true) {
  const g = game();
  quiet(g);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  for (const p of [...g.props.items]) g.props.remove(p);
  g.pressure.clear();
  const v = g.pressure.spawn({
    x: 600,
    y: 738,
    dir: { x: 0, y: -1 },
    valve: { x: 540, y: 710 },
    width: 120,
    length: 500,
    offset: 0,
    ...(hot ? { overpressure: true as const } : {}),
  });
  v.phase = 'ready';
  v.timer = PRESSURE_SHIFT.ready;
  return { g, v };
}
function shootValve(g: Game, friendly = true) {
  g.addShot({
    pos: { x: 450, y: 710 },
    vel: { x: 180, y: 0 },
    damage: 25,
    life: 3,
    friendly,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
}

test('revision 2 remixes only Furnace and preserves every earlier generation', () => {
  const seen = new Set();
  for (let n = 0; n < 24; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'OT-FURNACE-' + n,
        normal = getLevel(seed, stage),
        prior = getOvertimeLevel(seed, stage, 1);
      const next = getOvertimeLevel(seed, stage, 2);
      assert.deepEqual(next, getOvertimeLevel(seed, stage, 2));
      assert.deepEqual(normal, getLevel(seed, stage));
      assert.deepEqual(prior, getOvertimeLevel(seed, stage, 1));
      if (stage < 4 || stage >= 8) assert.deepEqual(next, prior);
      else {
        assert(next.overtimeFurnace);
        assert.notDeepEqual(next.solids, prior.solids);
        assert(next.vents!.every((v) => v.overpressure));
        seen.add(next.id + next.mirrored);
      }
    }
  assert.equal(seen.size, 10);
  const mutated = getOvertimeLevel('OT-FURNACE-2', 4, 2);
  mutated.vents![0].valve.x = -999;
  mutated.solids.length = 0;
  assert(getOvertimeLevel('OT-FURNACE-2', 4, 2).vents![0].valve.x > 0);
  assert(getOvertimeLevel('OT-FURNACE-2', 4, 2).solids.length > 0);
});

test('all rooms and mirrors reserve valve access, full steam lanes and enemy entrances', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        l = g.level;
      assert.equal(l.mirrored, mirror, room);
      assert(l.overtimeFurnace);
      assert.equal(g.breaches.placement, null);
      assert.equal(g.conveyors.items.length, 0);
      assert.equal(g.hazards.items.length, 0);
      assert.equal(g.cargo.items.length, 0);
      assert.equal(g.counterweights.items.length, 0);
      for (const v of l.vents!) {
        const lane = { x: v.x - v.width / 2, y: v.y - v.length, w: v.width, h: v.length };
        const wheel = { x: v.valve.x - 20, y: v.valve.y - 20, w: 40, h: 40 };
        assert.equal(v.y, 738);
        assert(v.x > 300 && v.x < 1700);
        assert(!l.solids.some((s) => overlap(s, lane)), room + ' steam clips terrain');
        assert(!l.solids.some((s) => overlap(s, wheel)), room + ' valve blocked');
        assert(Math.abs(g.pressure.reach(v) - v.length) < 0.1, room + ' jet prematurely blocked');
        for (const s of l.spawns) {
          const { w, h } = ENEMY_STATS[s.kind],
            hull = { x: s.x - w / 2, y: s.y - h / 2, w, h };
          assert(!overlap(hull, lane), room + ' ' + s.kind + ' spawns in steam');
          assert(!overlap(hull, wheel), room + ' ' + s.kind + ' covers valve');
        }
      }
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !l.solids.some((b) => overlap(b, { x: s.x - w / 2, y: s.y - h / 2, w, h })),
          room + ' ' + s.kind + ' terrain',
        );
        assert(s.x >= 360 && s.x <= 1640, room + ' safe entrance');
      }
    }
});

test('new saves round-trip while revision-1 Furnace saves keep their old geometry', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const cp = fixture(room, mirror),
        parsed = loadCheckpoint(cp);
      assert(parsed);
      assert.equal(parsed.overtime!.remix, 2);
      const g = game(room, mirror),
        resumed = new Game();
      resumed.start(parsed.seed, parsed);
      assert.deepEqual(resumed.level, g.level);
      const previous = loadCheckpoint({ ...cp, overtime: { ...cp.overtime, remix: 1 } })!;
      resumed.start(previous.seed, previous);
      assert(!resumed.level.overtimeFurnace);
      if (cp.stage !== 6) assert.deepEqual(resumed.level, getOvertimeLevel(cp.seed, cp.stage, 1));
      else assert.equal(resumed.level.routeChoice, cp.route);
    }
  for (const remix of [0, 3, -1, '2', null, true])
    assert.equal(
      loadCheckpoint({
        ...fixture('boilers'),
        overtime: { ...fixture('boilers').overtime, remix },
      }),
      null,
    );
});

test('Furnace presets reject mixed parameters, restart exactly and never write progress', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        initial = structuredClone(g.level);
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onBossDefeated = () => writes++;
      g.save();
      g.die();
      g.startTest(fixture(room, mirror));
      assert.equal(writes, 0);
      assert.deepEqual(g.level, initial);
      assert.equal(g.hp, 100);
    }
  for (const suffix of [
    '&seed=x',
    '&room=bad',
    '&room=press&room=press',
    '&test=overtime-furnace',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-25',
    '&build=beam',
    '&v=1&v=2',
  ])
    assert.equal(
      overtimeFurnaceTestFromUrl(new URL('https://test/?test=overtime-furnace' + suffix)),
      null,
    );
});

test('actual Docks and Furnace exits preserve revision 2 through both routes into Cooling', () => {
  for (const route of ['low', 'high'] as const) {
    const cp = overtimeDocksTestFromUrl(new URL('https://test/?test=overtime-docks&room=loader'))!;
    cp.overtime!.remix = 2;
    const g = new Game();
    g.startTest(cp);
    g.testRun = null;
    let saved: unknown;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    for (let stage = 3; stage <= 7; stage++) {
      for (let f = 0; f < 360 && !g.clear; f++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, idle);
      }
      assert(g.clear, 'finite waves ' + stage);
      g.openReward(false, stage === 5 ? route : undefined);
      assert.equal(g.mode, 'upgrade');
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, stage + 1);
      assert(loadCheckpoint(saved));
      assert.equal(g.overtime!.remix, 2);
      if (stage < 7) assert(g.level.overtimeFurnace);
      if (stage === 5)
        assert.equal(g.level.id, route === 'high' ? 'ot-flue-walk' : 'ot-service-tunnel');
      if (stage === 7) assert.deepEqual(g.level, getOvertimeLevel(g.seed, 8, 1));
    }
  }
});

test('coordinated Furnace pairs enter together with a full warning', () => {
  for (const room of rooms.slice(0, 4)) {
    const g = game(room),
      [opening, final] = splitWaves(g.level, g.roomSeed, 8);
    assert(!opening.some((s) => s.squad));
    assert.equal(final.filter((s) => s.squad).length, 2);
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e6);
    g.waves.update(0.01);
    assert.equal(g.waves.phase, 'warning');
    assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
    assert(!g.clear);
    g.waves.update(REINFORCEMENT_TELL + 0.01);
    assert.equal(g.enemies.filter((e) => e.squad).length, 2);
  }
});

test('shots and beams reach valves; early release keeps its full warning and cooldown', () => {
  const { g, v } = rig();
  shootValve(g, false);
  assert.equal(v.phase, 'ready');
  shootValve(g);
  assert.equal(v.phase, 'warn');
  assert(v.manual);
  for (let f = 0; f < 68; f++) {
    shootValve(g);
    g.pressure.beforeStep(1 / 60);
    assert.equal(v.phase, 'warn');
  }
  g.pressure.beforeStep(0.02);
  assert.equal(v.phase, 'burst');
  g.pressure.beforeStep(PRESSURE_SHIFT.burst);
  assert.equal(v.phase, 'recharge');
  assert(!g.pressure.trigger(v));
  assert.equal(v.timer, PRESSURE_SHIFT.recharge);
  g.pressure.beforeStep(PRESSURE_SHIFT.recharge);
  assert.equal(v.phase, 'ready');
  Body.setPosition(g.player, { x: 450, y: 713 });
  g.aim = { x: 540, y: 710 };
  assert.equal(traceTorch(g)[0].valve, v);
  g.pressure.beforeStep(PRESSURE_SHIFT.ready);
  assert.equal(v.phase, 'warn');
  assert(!v.manual);
  const blocked = Bodies.rectangle(500, 710, 20, 70, { isStatic: true });
  g.terrain.push(blocked);
  Composite.add(g.engine.world, blocked);
  v.phase = 'ready';
  shootValve(g);
  assert.equal(v.phase, 'ready');
  assert(!traceTorch(g)[0].valve);
});

test('hot jets damage each body once, respect cover, and leave legacy steam harmless', () => {
  for (const hot of [false, true]) {
    const { g, v } = rig(hot);
    Body.setPosition(g.player, { x: 600, y: 640 });
    const e = g.spawnEnemy('shooter', 610, 410);
    e.spawn = 0;
    const hp = e.hp;
    const shield = Bodies.rectangle(600, 550, 160, 20, { isStatic: true });
    g.terrain.push(shield);
    Composite.add(g.engine.world, shield);
    v.phase = 'burst';
    v.timer = 0.5;
    g.pressure.beforeStep(1 / 60);
    assert.equal(g.hp, hot ? 86 : 100);
    assert.equal(e.hp, hp, 'cover shields enemy');
    g.pressure.beforeStep(1 / 60);
    assert.equal(g.hp, hot ? 86 : 100);
    Composite.remove(g.engine.world, shield);
    g.terrain = g.terrain.filter((b) => b !== shield);
    g.pressure.beforeStep(1 / 60);
    assert.equal(e.hp, hot ? hp - PRESSURE_SHIFT.enemyDamage : hp);
    const after = e.hp;
    g.pressure.beforeStep(1 / 60);
    assert.equal(e.hp, after);
  }
  const { g, v } = rig();
  const pinned = g.spawnEnemy('flyer', 600, 500);
  pinned.spawn = 0;
  pinned.elite = 'volatile';
  pinned.state = 'windup';
  pinned.hp = pinned.maxHp = 1000;
  v.phase = 'burst';
  v.timer = 0.5;
  for (let i = 0; i < 8; i++) g.pressure.beforeStep(1 / 60);
  assert.equal(pinned.hp, 820, 'unlaunchable enemies still take only one hit');
});

test('manual jets open both bosses without cancelling attacks or stacking openings', () => {
  for (const kind of ['press', 'kiln'] as const) {
    const { g, v } = rig(),
      e = g.spawnEnemy(kind, 600, 600);
    e.spawn = 0;
    e.state = 'windup';
    e.timer = 0.8;
    const initial = e.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert.equal(initial - e.hp, 40);
    v.phase = 'burst';
    v.timer = 0.5;
    g.pressure.beforeStep(1 / 60);
    assert(!g.pressure.opening(e), 'automatic steam cannot open boss armor');
    v.launched.clear();
    v.manual = true;
    g.pressure.beforeStep(1 / 60);
    assert(g.pressure.opening(e));
    assert.equal(e.state, 'windup');
    assert.equal(e.timer, 0.8);
    const hp = e.hp;
    g.hitEnemy(e, 100, undefined, false);
    assert.equal(hp - e.hp, kind === 'press' ? 125 : 135);
    const until = g.pressure.openings.get(e)!.until;
    const other = g.pressure.spawn({ ...v, offset: 1 });
    other.phase = 'burst';
    other.timer = 0.5;
    other.manual = true;
    g.time += 0.5;
    v.launched.clear();
    g.pressure.beforeStep(1 / 60);
    assert.equal(g.pressure.openings.get(e)!.until, until);
    g.time = until + 0.01;
    assert(!g.pressure.opening(e));
    v.launched.clear();
    g.pressure.beforeStep(1 / 60);
    assert(!g.pressure.opening(e));
    g.time = PRESSURE_SHIFT.bossCooldown + 0.1;
    v.launched.clear();
    g.pressure.beforeStep(1 / 60);
    assert(g.pressure.opening(e));
    g.loadRoom();
    assert.equal(g.pressure.openings.size, 0);
  }
});

test('pause, clear and death stop dangerous pressure without advancing lethal physics', () => {
  const { g, v } = rig();
  g.pressure.trigger(v);
  const timer = v.timer;
  g.setMode('paused');
  for (let i = 0; i < 80; i++) g.tick(1 / 60, idle);
  assert.equal(v.timer, timer);
  g.setMode('playing');
  g.clear = true;
  g.pressure.beforeStep(0.1);
  assert.equal(v.phase, 'recharge');
  assert(!g.pressure.trigger(v));
  g.clear = false;
  g.hp = 1;
  Body.setPosition(g.player, { x: 600, y: 640 });
  v.phase = 'burst';
  v.timer = 0.5;
  const stamp = g.engine.timing.timestamp;
  g.tick(1 / 60, idle);
  assert.equal(g.mode, 'dead');
  assert.equal(g.deathCause!.type, 'steam');
  assert.equal(g.engine.timing.timestamp, stamp);
});

test('all twelve layouts remain traversable in both directions without recoil or valves', () => {
  for (const room of rooms)
    for (const mirror of [false, true])
      for (const reverse of [false, true]) {
        const g = game(room, mirror);
        quiet(g);
        g.pressure.clear();
        g.mods = [];
        g.gun = getGun([]);
        if (reverse) Body.setPosition(g.player, { x: 1840, y: 720 });
        for (
          let f = 0;
          f < 2400 && (reverse ? g.player.position.x > 180 : g.player.position.x < 1820);
          f++
        ) {
          const p = g.player.position;
          const obstacle = g.solidBodies.some(
            (b) =>
              b.bounds.min.x < p.x + (reverse ? -10 : 95) &&
              b.bounds.max.x > p.x + (reverse ? -95 : 10) &&
              b.bounds.min.y < p.y + 20 &&
              b.bounds.max.y > p.y - 30,
          );
          g.tick(1 / 60, { ...idle, left: reverse, right: !reverse, jump: obstacle && g.grounded });
          assert(Number.isFinite(g.player.position.x));
        }
        assert(
          reverse ? g.player.position.x <= 180 : g.player.position.x >= 1820,
          room + ':' + mirror + ':' + reverse + ' ' + JSON.stringify(g.player.position),
        );
      }
});
