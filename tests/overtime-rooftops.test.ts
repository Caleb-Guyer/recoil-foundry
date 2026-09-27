import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { overtimeRooftopsTestFromUrl, overtimeReclamationTestFromUrl } from '../src/practice.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { ENEMY_STATS, isBoss } from '../src/enemies.ts';
import { STORM } from '../src/stormfront.ts';
import { damageCauseText } from '../src/damage-cause.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
const { Body, Bodies, Composite } = Matter;
const rooms = ['antenna', 'masts', 'service', 'skyline', 'interceptor'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1400, y: 400 },
};
const fixture = (room = 'antenna', mirror = false) =>
  overtimeRooftopsTestFromUrl(
    new URL('https://test/?test=overtime-rooftops&room=' + room + '&mirror=' + Number(mirror)),
  )!;
function game(room = 'antenna', mirror = false) {
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
function rig() {
  const g = game();
  quiet(g);
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.level.conductors = [
    { x: 700, width: 180 },
    { x: 1300, width: 180 },
  ];
  g.stormfront.reset();
  g.time = 10;
  g.hurtAt = -100;
  return g;
}
function warning(g: Game) {
  g.stormfront.beforeStep(g.stormfront.timer + 0.001);
  assert.equal(g.stormfront.phase, 'warn');
}
function strike(g: Game) {
  g.stormfront.beforeStep(STORM.warn);
  assert.equal(g.stormfront.phase, 'strike');
}
const overlap = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.5 && a.x < b.x + b.w - 0.5 && a.y + a.h > b.y + 0.5 && a.y < b.y + b.h - 0.5;

test('revision 5 changes only Rooftops, is deterministic and never mutates previous generations', () => {
  const seen = new Set();
  for (let n = 0; n < 24; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'OT-STORM-' + n,
        ordinary = getLevel(seed, stage),
        before = getOvertimeLevel(seed, stage, 4),
        after = getOvertimeLevel(seed, stage, 5);
      assert.deepEqual(after, getOvertimeLevel(seed, stage, 5));
      assert.deepEqual(ordinary, getLevel(seed, stage));
      assert.deepEqual(before, getOvertimeLevel(seed, stage, 4));
      if (stage < 16) assert.deepEqual(after, before);
      else {
        assert(after.overtimeRooftops);
        assert.notDeepEqual(after.solids, before.solids);
        seen.add(after.name + after.mirrored);
      }
    }
  assert.equal(seen.size, 8);
  const l = getOvertimeLevel('OT-STORM-0', 16, 5);
  l.conductors![0].x = 1;
  l.solids[0].x = 1;
  assert.notEqual(getOvertimeLevel('OT-STORM-0', 16, 5).conductors![0].x, 1);
  assert.notEqual(getOvertimeLevel('OT-STORM-0', 16, 5).solids[0].x, 1);
});

test('five authored layouts and mirrors keep entrances, spawns, ground exits and warning lanes clear', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        l = g.level;
      assert.equal(l.mirrored, mirror);
      assert(l.overtimeRooftops);
      assert.equal(g.breaches.placement, null);
      for (const items of [
        g.crosswind.items,
        g.pressure.items,
        g.magnets.items,
        g.hazards.items,
        g.conveyors.items,
        g.cargo.items,
        g.counterweights.items,
      ])
        assert.equal(items.length, 0);
      assert(g.stormfront.items.length >= 2 && g.stormfront.items.length <= 3);
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !l.solids.some((b) => overlap(b, { x: s.x - w / 2, y: s.y - h / 2, w, h })),
          room + ' ' + s.kind,
        );
        assert(s.x >= 310 && s.x <= 1690);
      }
      for (const p of l.conductors!) {
        assert(p.x - p.width / 2 > 280 && p.x + p.width / 2 < 1740);
        assert(p.width >= 160 && p.width <= 180);
      }
      for (const s of l.solids.filter((s) => s.y + s.h === 740)) assert(s.h <= 120);
      assert.equal(l.spawns.filter((s) => isBoss(s.kind)).length, room === 'interceptor' ? 1 : 0);
      if (room === 'interceptor') assert.equal(l.id, 'relay-roof');
    }
});

test('new saves round-trip, revisions 0 through 4 retain old Rooftops, presets isolate progression', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const cp = fixture(room, mirror),
        parsed = loadCheckpoint(cp)!;
      assert(parsed);
      const g = game(room, mirror),
        resume = new Game();
      resume.start(parsed.seed, parsed);
      assert.deepEqual(resume.level, g.level);
      for (const revision of [undefined, 1, 2, 3, 4] as const) {
        const old = loadCheckpoint({ ...cp, overtime: { ...cp.overtime, remix: revision } })!;
        assert(old);
        resume.start(old.seed, old);
        assert(!resume.level.overtimeRooftops);
        assert.equal(resume.stormfront.items.length, 0);
      }
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onBossDefeated = () => writes++;
      g.save();
      g.die();
      g.startTest(cp);
      assert.equal(writes, 0);
      assert.equal(g.hp, 100);
      assert.equal(g.stormfront.phase, 'rest');
      assert.equal(g.stormfront.timer, STORM.ready);
    }
  for (const remix of [0, 6, -1, '5', null, true])
    assert.equal(
      loadCheckpoint({ ...fixture(), overtime: { ...fixture().overtime, remix } }),
      null,
    );
  for (const suffix of [
    '&seed=x',
    '&room=bad',
    '&room=antenna&room=antenna',
    '&test=overtime-rooftops',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-26',
    '&build=beam',
    '&v=1&v=2',
  ])
    assert.equal(
      overtimeRooftopsTestFromUrl(new URL('https://test/?test=overtime-rooftops' + suffix)),
      null,
    );
});

test('warnings stay fixed, last the full tell after slow frames and alternate without overlap', () => {
  const g = rig(),
    sounds: string[] = [];
  g.onSound = (s) => sounds.push(s);
  warning(g);
  assert.equal(g.stormfront.timer, STORM.warn);
  const x = g.stormfront.items[0].x;
  Body.setPosition(g.player, { x: 1000, y: 200 });
  g.stormfront.beforeStep(STORM.warn - 0.01);
  assert.equal(g.stormfront.phase, 'warn');
  assert.equal(g.stormfront.items[0].x, x);
  g.stormfront.beforeStep(10);
  assert.equal(g.stormfront.phase, 'strike');
  assert.equal(g.stormfront.timer, STORM.afterglow);
  g.stormfront.beforeStep(10);
  assert.equal(g.stormfront.phase, 'rest');
  assert.equal(g.stormfront.index, 1);
  assert.equal(g.stormfront.timer, STORM.rest);
  warning(g);
  strike(g);
  g.stormfront.beforeStep(1);
  assert.equal(g.stormfront.index, 0);
  assert.deepEqual(sounds, ['storm-warn', 'storm-strike', 'storm-warn', 'storm-strike']);
});

test('one strike hurts exposed actors once, spares spawn grace and does not count as gun damage', () => {
  const g = rig();
  Body.setPosition(g.player, { x: 700, y: 600 });
  const a = g.spawnEnemy('shooter', 650, 500),
    b = g.spawnEnemy('shooter', 760, 550),
    safe = g.spawnEnemy('shooter', 900, 550),
    spawning = g.spawnEnemy('shooter', 700, 300);
  a.spawn = b.spawn = safe.spawn = 0;
  spawning.spawn = 1;
  const health = [a, b, safe, spawning].map((e) => e.hp);
  warning(g);
  strike(g);
  assert.equal(g.hp, 78);
  assert.equal(a.hp, health[0] - STORM.enemy);
  assert.equal(b.hp, health[1] - STORM.enemy);
  assert.equal(safe.hp, health[2]);
  assert.equal(spawning.hp, health[3]);
  assert.equal(g.kills, 0);
  g.time += 1;
  g.stormfront.beforeStep(0.1);
  assert.equal(g.hp, 78);
  assert.equal(a.hp, health[0] - STORM.enemy);
});

test('platform cover shields below, leaves its top exposed and cannot expand midway through a tell', () => {
  const g = rig(),
    roof = Bodies.rectangle(700, 400, 200, 24, { isStatic: true });
  g.terrain.push(roof);
  Composite.add(g.engine.world, roof);
  const below = g.spawnEnemy('shooter', 700, 600),
    above = g.spawnEnemy('shooter', 700, 360);
  below.spawn = above.spawn = 0;
  const hp = below.hp,
    top = above.hp;
  Body.setPosition(g.player, { x: 700, y: 650 });
  warning(g);
  assert(g.stormfront.items[0].depths.every((d) => Math.abs(d - 388) < 0.01));
  g.terrain = g.terrain.filter((b) => b !== roof);
  Composite.remove(g.engine.world, roof);
  strike(g);
  assert.equal(g.hp, 100);
  assert.equal(below.hp, hp);
  assert.equal(above.hp, top - STORM.enemy);
  g.stormfront.beforeStep(1);
  warning(g);
  strike(g);
  g.stormfront.beforeStep(1);
  warning(g);
  strike(g);
  assert.equal(g.hp, 78);
  assert.equal(below.hp, hp - STORM.enemy);
});

test('moving and rotated physical cover shortens columns, then stays protective until the next tell', () => {
  const g = rig(),
    p = g.props.spawn('cover', 700, 400);
  Body.setAngle(p.body, Math.PI / 6);
  Body.setPosition(g.player, { x: 700, y: 600 });
  warning(g);
  const depths = [...g.stormfront.items[0].depths];
  assert(depths.some((d) => d < 450));
  assert(new Set(depths.map((d) => Math.round(d))).size > 2);
  Body.setPosition(p.body, { x: 1200, y: 400 });
  strike(g);
  assert.equal(g.hp, 100);
  const h = rig();
  Body.setPosition(h.player, { x: 700, y: 600 });
  warning(h);
  const roof = Bodies.rectangle(700, 400, 220, 20, { isStatic: true });
  h.terrain.push(roof);
  Composite.add(h.engine.world, roof);
  strike(h);
  assert.equal(h.hp, 100);
});

test('boss armor, recovery windows and movement survive lightning without cancelled attacks', () => {
  for (const kind of Object.keys(ENEMY_STATS).filter((k) =>
    isBoss(k as keyof typeof ENEMY_STATS),
  ) as (keyof typeof ENEMY_STATS)[])
    for (const state of ['windup', 'recover'] as const) {
      const g = rig(),
        boss = g.spawnEnemy(kind, 700, 270);
      boss.spawn = 0;
      boss.state = state;
      boss.timer = 2;
      Body.setVelocity(boss.body, { x: 3, y: -2 });
      const velocity = { ...boss.body.velocity },
        hp = boss.hp;
      warning(g);
      strike(g);
      assert(boss.hp < hp, kind);
      assert(boss.hp >= hp - STORM.boss * 1.55, kind);
      assert.equal(boss.state, state, kind);
      assert.equal(boss.timer, 2, kind);
      assert.deepEqual(boss.body.velocity, velocity, kind);
      if (kind === 'interceptor')
        assert(Math.abs(hp - boss.hp - STORM.boss * (state === 'recover' ? 1.3 : 0.35)) < 0.001);
    }
});

test('pause, hitstop, clearance, death and room resets cannot leave live lightning behind', () => {
  const g = rig();
  warning(g);
  const timer = g.stormfront.timer;
  g.setMode('paused');
  g.tick(1, idle);
  g.stormfront.beforeStep(1);
  assert.equal(g.stormfront.timer, timer);
  g.setMode('playing');
  g.hitStop = 0.5;
  g.tick(0.01, idle);
  assert.equal(g.stormfront.timer, timer);
  g.clear = true;
  g.stormfront.beforeStep(2);
  assert.equal(g.stormfront.phase, 'rest');
  assert.equal(g.hp, 100);
  g.clear = false;
  g.die();
  g.stormfront.beforeStep(100);
  assert.equal(g.stormfront.phase, 'rest');
  g.start('ORDINARY');
  assert.equal(g.stormfront.items.length, 0);
});

test('lightning respects player immunity and records a precise death cause', () => {
  const g = rig();
  Body.setPosition(g.player, { x: 700, y: 600 });
  g.hurtAt = g.time;
  warning(g);
  strike(g);
  assert.equal(g.hp, 100);
  const h = rig();
  Body.setPosition(h.player, { x: 700, y: 600 });
  h.hp = 10;
  warning(h);
  strike(h);
  assert.equal(h.mode, 'dead');
  assert.equal(damageCauseText(h.deathCause), 'Lightning strike');
});

test('finite squads and real reward exits carry both routes from Reclamation through the final departure', () => {
  for (const room of rooms.slice(0, 4)) {
    const g = game(room),
      [opening, final] = splitWaves(g.level, g.roomSeed, g.stage);
    assert(!opening.some((s) => s.squad));
    assert.equal(final.filter((s) => s.squad).length, 2);
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e6);
    g.waves.update(0.01);
    assert.equal(g.waves.phase, 'warning');
    g.waves.update(REINFORCEMENT_TELL + 0.01);
    assert.equal(g.enemies.filter((e) => e.squad).length, 2);
  }
  for (const route of ['low', 'high'] as const) {
    const cp = overtimeReclamationTestFromUrl(
      new URL('https://test/?test=overtime-reclamation&room=sorter'),
    )!;
    cp.overtime!.remix = 5;
    const g = new Game();
    g.startTest(cp);
    g.testRun = null;
    let saved: unknown;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    for (let stage = 15; stage <= 19; stage++) {
      for (let f = 0; f < 360 && !g.clear; f++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, idle);
      }
      assert(g.clear, 'finite waves ' + stage);
      if (stage === 19) {
        g.startEscape();
        assert(g.escape);
        assert.equal(g.stormfront.items.length, 0);
        assert.equal(g.canOvertime, false);
        assert(loadCheckpoint(saved));
        break;
      }
      g.openReward(false, stage === 17 ? route : undefined);
      assert.equal(g.mode, 'upgrade');
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, stage + 1);
      assert(loadCheckpoint(saved));
      assert.equal(g.overtime!.remix, 5);
      assert(g.level.overtimeRooftops);
      if (stage === 17)
        assert.equal(g.level.id, route === 'high' ? 'ot-storm-skyline' : 'ot-storm-service');
    }
  }
});

test('all mirrored layouts remain traversable both ways with base jumps and no loose cover', () => {
  for (const room of rooms)
    for (const mirror of [false, true])
      for (const reverse of [false, true])
        for (const broken of [false, true]) {
          const g = game(room, mirror);
          quiet(g);
          g.clear = true;
          g.mods = [];
          g.gun = getGun([]);
          if (broken) for (const p of [...g.props.items]) g.props.break(p);
          for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
          if (reverse) Body.setPosition(g.player, { x: 1840, y: 720 });
          for (
            let n = 0;
            n < 2400 && (reverse ? g.player.position.x > 180 : g.player.position.x < 1820);
            n++
          ) {
            const p = g.player.position,
              obstacle = g.solidBodies.some(
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
              broken +
              ' ' +
              JSON.stringify(g.player.position),
          );
        }
});
