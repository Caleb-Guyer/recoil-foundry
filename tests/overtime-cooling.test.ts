import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { overtimeCoolingTestFromUrl, overtimeFurnaceTestFromUrl } from '../src/practice.ts';
import { CROSSWIND, type CrosswindFan } from '../src/crosswind.ts';
import { airflowExposed } from '../src/airflow.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
const { Body, Bodies, Composite } = Matter;
const rooms = ['intake', 'towers', 'bypass', 'skyway', 'condenser', 'turbine'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1300, y: 500 },
};
const fixture = (room = 'intake', mirror = false) =>
  overtimeCoolingTestFromUrl(
    new URL(`https://test/?test=overtime-cooling&room=${room}&mirror=${Number(mirror)}`),
  )!;
function game(room = 'intake', mirror = false) {
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
function rig(horizontal = false) {
  const g = game();
  quiet(g);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  for (const p of [...g.props.items]) g.props.remove(p);
  const f: CrosswindFan = {
    x: horizontal ? 2 : 600,
    y: horizontal ? 500 : 738,
    dir: horizontal ? { x: 1, y: 0 } : { x: 0, y: -1 },
    width: 180,
    length: 600,
    offset: 0,
    phase: 'gust',
    timer: 2,
    rotation: 0,
  };
  g.crosswind.items = [f];
  Body.setPosition(g.player, { x: 600, y: 640 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  return { g, f };
}

test('revision 3 changes only Cooling; old seeds, earlier regions and ordinary rules stay stable', () => {
  const seen = new Set();
  for (let n = 0; n < 24; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'OT-COOLING-' + n,
        original = getLevel(seed, stage),
        previous = getOvertimeLevel(seed, stage, 2),
        next = getOvertimeLevel(seed, stage, 3);
      assert.deepEqual(next, getOvertimeLevel(seed, stage, 3));
      assert.deepEqual(original, getLevel(seed, stage));
      assert.deepEqual(previous, getOvertimeLevel(seed, stage, 2));
      if (stage < 8 || stage >= 12) assert.deepEqual(next, previous);
      else {
        assert(next.overtimeCooling);
        assert.notDeepEqual(next.solids, previous.solids);
        seen.add(next.id + next.mirrored);
      }
    }
  assert.equal(seen.size, 10);
  const mutated = getOvertimeLevel('OT-COOLING-1', 8, 3);
  mutated.fans![0].dir.y = 99;
  mutated.solids.length = 0;
  assert.equal(getOvertimeLevel('OT-COOLING-1', 8, 3).fans![0].dir.y, -1);
  assert(getOvertimeLevel('OT-COOLING-1', 8, 3).solids.length);
});

test('all six rooms and mirrors have mounted fans, clear updrafts and reserved enemy entrances', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        l = g.level;
      assert.equal(l.mirrored, mirror, room);
      assert(l.overtimeCooling);
      assert.equal(g.breaches.placement, null);
      for (const items of [
        g.pressure.items,
        g.conveyors.items,
        g.hazards.items,
        g.cargo.items,
        g.counterweights.items,
      ])
        assert.equal(items.length, 0);
      for (const f of l.fans!) {
        assert(f.y === 738 || f.x === 2 || f.x === 1998, 'fixture mounts to floor/wall');
        assert.equal(f.dir.x * f.dir.x + f.dir.y * f.dir.y, 1);
        if (f.dir.y < 0) {
          const lane = { x: f.x - f.width / 2, y: f.y - f.length, w: f.width, h: f.length };
          assert(!l.solids.some((s) => overlap(s, lane)), room + ' blocked updraft');
          assert(Math.abs(g.crosswind.reach(f) - f.length) < 0.1);
        }
      }
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !l.solids.some((b) => overlap(b, { x: s.x - w / 2, y: s.y - h / 2, w, h })),
          room + ' ' + s.kind,
        );
        assert(s.x >= 310 && s.x <= 1690, 'entrance clearance');
      }
      if (room === 'condenser' || room === 'turbine') assert.equal(l.spawns[0].kind, room);
    }
});

test('saved revisions and both route choices round-trip without migrating existing runs', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const cp = fixture(room, mirror),
        parsed = loadCheckpoint(cp)!;
      assert(parsed);
      const g = game(room, mirror),
        resumed = new Game();
      resumed.start(parsed.seed, parsed);
      assert.deepEqual(resumed.level, g.level);
      for (const revision of [undefined, 1, 2] as const) {
        const old = loadCheckpoint({ ...cp, overtime: { ...cp.overtime, remix: revision } })!;
        assert(old);
        resumed.start(old.seed, old);
        assert(!resumed.level.overtimeCooling);
        if (cp.stage !== 10)
          assert.deepEqual(resumed.level, getOvertimeLevel(cp.seed, cp.stage, revision));
      }
    }
  for (const remix of [0, 4, -1, '3', null, true])
    assert.equal(
      loadCheckpoint({ ...fixture(), overtime: { ...fixture().overtime, remix } }),
      null,
    );
});

test('Cooling presets reject mixed inputs, retry exactly and never write progress', () => {
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
      assert(g.crosswind.items.every((f) => f.phase === 'rest' && f.timer === 2.5 + f.offset));
    }
  for (const suffix of [
    '&seed=x',
    '&room=bad',
    '&room=intake&room=intake',
    '&test=overtime-cooling',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-25',
    '&build=beam',
    '&v=1&v=2',
  ])
    assert.equal(
      overtimeCoolingTestFromUrl(new URL('https://test/?test=overtime-cooling' + suffix)),
      null,
    );
});

test('actual exits carry revision 3 through Furnace, both Cooling routes and Reclamation', () => {
  for (const route of ['low', 'high'] as const) {
    const cp = overtimeFurnaceTestFromUrl(
      new URL('https://test/?test=overtime-furnace&room=press'),
    )!;
    cp.overtime!.remix = 3;
    const g = new Game();
    g.startTest(cp);
    g.testRun = null;
    let saved: unknown;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    for (let stage = 7; stage <= 11; stage++) {
      for (let f = 0; f < 360 && !g.clear; f++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, idle);
      }
      assert(g.clear, 'finite waves ' + stage);
      g.openReward(false, stage === 9 ? route : undefined);
      assert.equal(g.mode, 'upgrade');
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, stage + 1);
      assert(loadCheckpoint(saved));
      assert.equal(g.overtime!.remix, 3);
      if (stage < 11) assert(g.level.overtimeCooling);
      if (stage === 9)
        assert.equal(g.level.id, route === 'high' ? 'ot-exhaust-skyway' : 'ot-cooling-service');
      if (stage === 11) {
        assert.deepEqual(g.level, getOvertimeLevel(g.seed, 12, 2));
        assert.equal(g.crosswind.items.length, 0);
      }
    }
  }
});

test('fan cycles give a full warning, ramp gently, freeze on pause/hitstop and stop after clear', () => {
  const { g, f } = rig();
  const sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  f.phase = 'rest';
  f.timer = 0.01;
  g.crosswind.beforeStep(10);
  assert.equal(f.phase, 'warn');
  assert.equal(f.timer, CROSSWIND.warn);
  assert.deepEqual(sounds, ['fan-warn']);
  g.setMode('paused');
  const before = structuredClone(f);
  for (let n = 0; n < 80; n++) g.tick(1 / 60, idle);
  assert.deepEqual(f, before);
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.deepEqual(f, before);
  g.hitStop = 0;
  g.crosswind.beforeStep(CROSSWIND.warn);
  assert.equal(f.phase, 'gust');
  assert.equal(g.crosswind.strength(f), 0);
  g.crosswind.beforeStep(0.2);
  assert(Math.abs(g.crosswind.strength(f) - 0.5) < 1e-6);
  f.timer = 0.2;
  assert(Math.abs(g.crosswind.strength(f) - 0.5) < 1e-6);
  assert.deepEqual(sounds, ['fan-warn', 'fan-gust']);
  g.clear = true;
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.crosswind.beforeStep(0.1);
  assert.equal(f.phase, 'rest');
  assert.equal(g.player.velocity.y, 0);
  g.clear = false;
  g.die();
  const stopped = structuredClone(f);
  g.crosswind.beforeStep(1);
  assert.deepEqual(f, stopped);
});

test('airflow preserves grounded input, aiming, projectiles and stronger recoil momentum', () => {
  const { g, f } = rig(true);
  Body.setPosition(g.player, { x: 400, y: 500 });
  const aim = { ...g.aim };
  g.grounded = true;
  g.crosswind.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, 0);
  g.grounded = false;
  g.crosswind.beforeStep(1 / 60);
  assert(g.player.velocity.x > 0 && g.player.velocity.x < 0.42, 'steering beats crosswind');
  Body.setVelocity(g.player, { x: 18, y: -15 });
  g.crosswind.beforeStep(1 / 60);
  assert.equal(g.player.velocity.x, 18);
  assert.equal(g.player.velocity.y, -15);
  assert.deepEqual(g.aim, aim);
  g.addShot({
    pos: { x: 300, y: 500 },
    vel: { x: 4, y: 2 },
    friendly: true,
    damage: 20,
    life: 2,
    radius: 2,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  const shot = structuredClone(g.shots[0]);
  g.crosswind.beforeStep(1 / 60);
  assert.deepEqual(g.shots[0], shot);
  g.crosswind.items.push({ ...f }, { ...f });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.crosswind.beforeStep(1 / 60);
  assert(g.player.velocity.x <= CROSSWIND.drift + 1e-8);
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.crosswind.beforeStep(0);
  assert.equal(g.player.velocity.x, 0);
});

test('an ordinary jump rides the intake updraft and steering can leave it', () => {
  const minYs: number[] = [];
  for (const enabled of [false, true]) {
    const g = game();
    quiet(g);
    g.mods = [];
    g.gun = getGun([]);
    Body.setPosition(g.player, { x: 760, y: 720 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    for (let n = 0; n < 12; n++) g.tick(1 / 60, idle);
    if (!enabled) g.crosswind.clear();
    else {
      g.crosswind.items[0].phase = 'gust';
      g.crosswind.items[0].timer = CROSSWIND.gust;
    }
    let minY = 740;
    for (let n = 0; n < 150; n++) {
      g.tick(1 / 60, { ...idle, jump: n === 0 });
      minY = Math.min(minY, g.player.position.y);
    }
    minYs.push(minY);
    if (enabled) {
      for (let n = 0; n < 65; n++) g.tick(1 / 60, { ...idle, right: true });
      assert(g.player.position.x > 900, 'steering exits shaft');
    }
  }
  assert(minYs[1] < minYs[0] - 180, JSON.stringify(minYs));
  assert(minYs[1] > 40, 'finite shaft leaves room for the jump to coast below the ceiling');
});

test('convex terrain and loose cover shield airflow, and a blocking crate can itself be lifted', () => {
  const { g, f } = rig();
  Body.setPosition(g.player, { x: 600, y: 450 });
  const shield = Bodies.rectangle(600, 570, 230, 22, { isStatic: true });
  g.terrain.push(shield);
  Composite.add(g.engine.world, shield);
  assert(!airflowExposed(g, f, g.player));
  g.crosswind.beforeStep(1 / 60);
  assert.equal(g.player.velocity.y, 0);
  Body.setAngle(shield, 0.2);
  assert(!airflowExposed(g, f, g.player));
  Composite.remove(g.engine.world, shield);
  g.terrain = g.terrain.filter((b) => b !== shield);
  const crate = g.props.spawn('crate', 600, 620);
  assert(!airflowExposed(g, f, g.player));
  assert(airflowExposed(g, f, crate.body));
  g.crosswind.beforeStep(1 / 60);
  assert(crate.body.velocity.y < 0);
  assert.equal(g.player.velocity.y, 0);
  g.props.remove(crate);
  g.crosswind.beforeStep(1 / 60);
  assert(g.player.velocity.y < 0);
});

test('gusts move light airborne enemies without cancelling attacks and leave bosses or anchors alone', () => {
  for (const kind of [
    'flyer',
    'skimmer',
    'sifter',
    'hopper',
    'runner',
    'charger',
    'shooter',
    'sniper',
    'condenser',
    'turbine',
  ] as const) {
    const { g } = rig(),
      e = g.spawnEnemy(kind, 600, 400);
    e.spawn = 0;
    e.state = 'windup';
    e.timer = 0.8;
    const velocity = { ...e.body.velocity },
      hp = e.hp,
      fixed = e.body.isStatic;
    g.crosswind.beforeStep(1 / 60);
    if (['flyer', 'skimmer', 'sifter', 'hopper', 'runner'].includes(kind))
      assert(e.body.velocity.y < 0, kind);
    else assert.deepEqual(e.body.velocity, velocity, kind);
    assert.equal(e.state, 'windup');
    assert.equal(e.timer, 0.8);
    assert.equal(e.hp, hp);
    assert.equal(e.body.isStatic, fixed);
  }
  const { g } = rig();
  const e = g.spawnEnemy('flyer', 600, 400);
  e.spawn = 0;
  e.elite = 'volatile';
  e.state = 'windup';
  g.crosswind.beforeStep(1 / 60);
  assert.equal(e.body.velocity.y, 0);
});

test('authored pairs arrive together after their complete warning', () => {
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

test('all twelve layouts are traversable both ways with base jumps, with fans running or off', () => {
  for (const room of rooms)
    for (const mirror of [false, true])
      for (const reverse of [false, true])
        for (const enabled of [false, true]) {
          const g = game(room, mirror);
          quiet(g);
          if (!enabled) g.crosswind.clear();
          g.mods = [];
          g.gun = getGun([]);
          if (reverse) Body.setPosition(g.player, { x: 1840, y: 720 });
          for (
            let n = 0;
            n < 2400 && (reverse ? g.player.position.x > 180 : g.player.position.x < 1820);
            n++
          ) {
            const p = g.player.position;
            const obstacle = g.solidBodies.some(
              (b) =>
                b.bounds.min.x < p.x + (reverse ? -10 : 95) &&
                b.bounds.max.x > p.x + (reverse ? -95 : 10) &&
                b.bounds.min.y < p.y + 20 &&
                b.bounds.max.y > p.y - 30,
            );
            g.tick(1 / 60, {
              ...idle,
              left: reverse,
              right: !reverse,
              jump: obstacle && g.grounded,
            });
            assert(Number.isFinite(g.player.position.x));
          }
          assert(
            reverse ? g.player.position.x <= 180 : g.player.position.x >= 1820,
            room +
              ':' +
              mirror +
              ':' +
              reverse +
              ':' +
              enabled +
              ' ' +
              JSON.stringify(g.player.position),
          );
        }
});
