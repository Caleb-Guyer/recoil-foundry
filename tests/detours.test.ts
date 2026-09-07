import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import {
  getDetour,
  DETOUR_LAYOUTS,
  DETOUR_STEPS,
  DETOUR_DOOR,
  DETOUR_HEALTH,
} from '../src/detours.ts';
import { loadCheckpoint, getGun, validBuild, STAGES } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { ENEMY_STATS, enemyHealth, isBoss } from '../src/enemies.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
import { musicScene } from '../src/music-score.ts';
const { Body, Composite, Query } = Matter;
const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) =>
  a.x + a.w > b.x + 0.1 && a.x < b.x + b.w - 0.1 && a.y + a.h > b.y + 0.1 && a.y < b.y + b.h - 0.1;
function entrance(seed = 'detour-test', stage = 1) {
  const g = new Game();
  g.start(seed);
  while (g.stage < stage) {
    g.openReward();
    g.chooseMod(g.offers[0].id);
  }
  return g;
}
function cleared(g: Game) {
  for (const p of [...g.props.items]) g.props.remove(p);
  for (let i = 0; i < 400; i++) {
    for (const e of [...g.enemies]) {
      e.spawn = 0;
      g.hitEnemy(e, 999999);
    }
    g.hitStop = 0;
    g.time += 0.05;
    g.waves.update(0.05);
    if (!g.enemies.length && !g.waves.pending) {
      g.clear = true;
      g.clearAt = g.time - 1;
      return;
    }
  }
  assert.fail('Reinforcements failed to arrive');
}
function enter(g: Game) {
  cleared(g);
  g.openReward(true);
  assert(g.enteringDetour);
  g.chooseMod(g.offers[0].id);
  assert(g.detour);
}
function tick(g: Game, extra = {}) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: 1500, y: 300 },
    ...extra,
  });
}
function snapshot(g: Game) {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save);
  return save as Checkpoint;
}

test('each area has a deterministic mirrored challenge with more enemies and no future boss preview', () => {
  const mirrors = new Set<boolean>();
  for (let i = 0; i < 32; i++)
    for (const stage of [1, 4, 7, 10]) {
      const seed = 'detour-layout-' + i,
        level = getDetour(seed, stage);
      mirrors.add(level.mirrored);
      assert.deepEqual(level, getDetour(seed, stage));
      assert.equal(level.area, getLevel(seed, stage).area);
      assert(level.spawns.length > getLevel(seed, stage).spawns.length);
      assert(level.spawns.every((s) => !isBoss(s.kind)));
      assert(level.hazards!.length >= 2);
      assert(level.detour && !level.boss);
      level.solids[0].x = 0;
      assert.notEqual(getDetour(seed, stage).solids[0].x, 0);
    }
  assert.equal(mirrors.size, 2);
  assert.equal(new Set(DETOUR_LAYOUTS.map((l) => l.id)).size, 4);
  for (const stage of [-1, 0, 2, 3, 5, 6, 8, 9, 11, 12, 1.5])
    assert.throws(() => getDetour('no', stage));
});
test('challenge geometry leaves spawns, machinery sweeps, entry and ground exit clear in both orientations', () => {
  for (let i = 0; i < 16; i++)
    for (const stage of [1, 4, 7, 10]) {
      const level = getDetour('detour-geometry-' + i, stage);
      const actors = [
        { x: 127, y: 662, w: 26, h: 36 },
        ...level.spawns.map((s) => {
          const { w, h } = ENEMY_STATS[s.kind];
          return { x: s.x - w / 2, y: s.y - h / 2, w, h };
        }),
      ];
      for (const solid of level.solids) {
        for (const actor of actors)
          assert(!overlap(solid, actor), level.id + ' spawn ' + JSON.stringify(actor));
        assert(!overlap(solid, { x: 1840, y: 590, w: 160, h: 150 }));
      }
      for (const hazard of level.hazards!) {
        const sweep = hazardBounds(hazard);
        for (const solid of level.solids)
          assert(!overlap(sweep, solid), level.id + ' machinery hits cover');
        for (const actor of actors)
          assert(
            !overlap(sweep, actor),
            level.id + ' machinery crosses spawn ' + JSON.stringify(actor),
          );
      }
    }
});
test('normal rewards and direct exits skip every detour while preserving twelve stages and eleven picks', () => {
  const g = new Game();
  g.start('direct-route');
  for (let stage = 0; stage < 11; stage++) {
    assert.equal(g.canDetour, [1, 4, 7, 10].includes(stage));
    g.openReward();
    g.chooseMod(g.offers[0].id);
    assert(!g.detour);
  }
  assert.equal(g.stage, 11);
  assert.equal(g.mods.length, 11);
  assert.deepEqual(g.detours, []);
  assert.equal(g.canDetour, false);
});
test('entering pays only the regular room reward, bonus pays one upgrade without healing, then rejoins the boss', () => {
  const g = entrance();
  g.hp = 47;
  const baseMods = g.mods.length;
  enter(g);
  assert.equal(g.stage, 1);
  assert.equal(g.hp, 59);
  assert.equal(g.mods.length, baseMods + 1);
  assert(g.level.detour);
  assert(!g.canDetour);
  assert.equal(g.breaches.pickup, null);
  assert.equal(g.breaches.panels.length, 0);
  g.hp = 37;
  cleared(g);
  g.openReward();
  const choices = [...g.offers],
    choice = choices[0].id;
  g.openReward();
  assert.deepEqual(g.offers, choices);
  g.chooseMod(choice);
  assert.equal(g.hp, 37);
  assert.equal(g.mods.length, baseMods + 2);
  assert.equal(g.stage, 2);
  assert(!g.detour);
  assert(g.level.boss);
  assert.deepEqual(g.detours, [0]);
  const state = snapshot(g);
  g.chooseMod(choice);
  assert.deepEqual(snapshot(g), state);
  assert(loadCheckpoint(state));
});
test('each challenge can be taken once and all four detours preserve the complete escape checkpoint', () => {
  const g = new Game();
  g.start('all-detours');
  while (g.stage < 11) {
    if (g.canDetour) {
      enter(g);
      cleared(g);
      g.openReward();
    } else g.openReward();
    assert.equal(g.offers.length, 3);
    g.chooseMod(g.offers[0].id);
    assert(validBuild(g.mods));
  }
  assert.deepEqual(g.detours, [0, 1, 2, 3]);
  assert.equal(g.mods.length, 15);
  assert.equal(g.hp, 100);
  cleared(g);
  g.startEscape();
  assert(g.escape);
  const save = snapshot(g);
  assert(loadCheckpoint(save));
  const resumed = new Game();
  resumed.start(save.seed, loadCheckpoint(save)!);
  assert(resumed.escape);
  assert.equal(resumed.mods.length, 15);
  assert.deepEqual(resumed.detours, [0, 1, 2, 3]);
});
test('challenge combat cannot pay a reward or leave while enemies or reinforcements remain', () => {
  const g = entrance();
  g.openReward(true);
  assert.equal(g.mode, 'playing');
  assert(!g.enteringDetour);
  enter(g);
  const before = g.mods.length;
  g.openReward();
  assert.equal(g.mode, 'playing');
  assert.equal(g.mods.length, before);
  Body.setPosition(g.player, { x: 1930, y: 720 });
  for (let i = 0; i < 10; i++) tick(g);
  assert(g.detour);
  assert.equal(g.mode, 'playing');
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 999999);
  }
  g.clear = true;
  g.openReward();
  assert.equal(g.mode, 'playing', 'pending second wave was bypassed');
});
test('challenge entry saves the earned regular upgrade, health and route; continuing restarts the fight without repaying it', () => {
  const g = entrance('detour-continue', 4);
  g.hp = 50;
  enter(g);
  const save = snapshot(g);
  assert.equal(save.detour, true);
  assert.equal(save.hp, 62);
  assert(loadCheckpoint(save));
  const initial = g.level,
    health = g.hp,
    mods = [...g.mods];
  g.hp = 12;
  g.evolutions.slingReady = true;
  g.portals.place({ x: 1750, y: 740 });
  const resumed = new Game();
  resumed.start(save.seed, loadCheckpoint(JSON.parse(JSON.stringify(save)))!);
  assert.deepEqual(resumed.level, initial);
  assert.equal(resumed.hp, health);
  assert.deepEqual(resumed.mods, mods);
  assert(resumed.detour);
  assert(!resumed.clear);
  assert(resumed.waves.pending);
  assert(!resumed.evolutions.slingReady);
  assert.deepEqual(resumed.portals.pair, [null, null]);
  cleared(g);
  cleared(resumed);
  g.openReward();
  resumed.openReward();
  assert.deepEqual(g.offers, resumed.offers);
});
test('checkpoint validation rejects duplicate, future, unordered and inconsistent detour state', () => {
  const g = entrance();
  enter(g);
  const save = snapshot(g);
  for (const bad of [
    { ...save, detour: false },
    { ...save, detour: 'true' },
    { ...save, stage: 2 },
    { ...save, escape: true },
    { ...save, detours: [0] },
    { ...save, detours: null },
    { ...save, mods: save.mods.slice(1) },
  ])
    assert.equal(loadCheckpoint(bad), null);
  cleared(g);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  const boss = snapshot(g);
  assert(loadCheckpoint(boss));
  for (const detours of [[0, 0], [1], [2], [-1], [0.5], ['0'], {}, true])
    assert.equal(loadCheckpoint({ ...boss, detours }), null);
  const old = { ...boss };
  delete old.detours;
  assert(loadCheckpoint(old), 'ordinary existing saves must remain supported');
});
test('Daily routes have one forced legal offer per reward and replay identically with all detours', () => {
  const seed = dailyForDate('2026-09-07')!.seed,
    g = new Game(),
    other = new Game();
  g.start(seed);
  other.start(seed);
  while (g.stage < 11) {
    if (g.canDetour) {
      enter(g);
      enter(other);
      assert.deepEqual(g.level, other.level);
      assert.deepEqual(g.mods, other.mods);
      cleared(g);
      cleared(other);
    }
    g.openReward();
    for (let n = 0; n < 125; n++) other.rng();
    other.openReward();
    assert.equal(g.offers.length, 1);
    assert.deepEqual(g.offers, other.offers);
    g.chooseMod(g.offers[0].id);
    other.chooseMod(other.offers[0].id);
    assert.equal(g.stage, other.stage);
    assert.deepEqual(g.mods, other.mods);
  }
  assert.equal(g.mods.length, 15);
  assert(loadCheckpoint(snapshot(g)));
});
test('detour layouts, waves and bonus rewards use independent streams from normal rooms', () => {
  const a = entrance('detour-rng'),
    b = entrance('detour-rng');
  cleared(a);
  cleared(b);
  a.openReward(true);
  b.openReward();
  assert.deepEqual(a.offers, b.offers);
  a.chooseMod(a.offers[0].id);
  b.chooseMod(b.offers[0].id);
  assert(a.detour && !b.detour);
  assert.equal(b.stage, 2);
  assert.notEqual(musicScene(a).room, musicScene(b).room);
  const c = new Game();
  c.start(a.seed, snapshot(a));
  assert.deepEqual(a.waves.doors, c.waves.doors);
  cleared(a);
  cleared(c);
  for (let n = 0; n < 1000; n++) a.rng();
  a.openReward();
  c.openReward();
  assert.deepEqual(a.offers, c.offers);
});
test('challenge waves start larger and overlap with two survivors while keeping the full warning', () => {
  for (const stage of [1, 4, 7, 10]) {
    const g = entrance('detour-pressure', stage);
    enter(g);
    const [opening, final] = splitWaves(g.level, g.roomSeed, g.stage);
    assert.equal(opening.length, Math.ceil(g.level.spawns.length / 2));
    assert.equal(g.enemies.length, opening.length);
    for (const e of g.enemies)
      assert.equal(e.maxHp, Math.ceil(enemyHealth(e.kind, stage, e.elite) * DETOUR_HEALTH));
    for (const e of g.enemies.slice(2)) {
      e.spawn = 0;
      g.hitEnemy(e, 999999);
    }
    g.waves.update(1 / 60);
    assert.equal(g.waves.phase, 'warning');
    assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
    assert.equal(g.waves.doors.length, final.length);
  }
});
test('pause, death and a fresh run cannot preserve or cash in a detour reward', () => {
  const g = entrance();
  enter(g);
  g.setMode('paused');
  const time = g.time;
  tick(g);
  assert.equal(g.time, time);
  g.openReward();
  assert.equal(g.mode, 'paused');
  g.setMode('playing');
  g.damagePlayer(999999);
  assert.equal(g.mode, 'dead');
  const count = g.mods.length;
  g.openReward();
  g.chooseMod('magnum');
  assert.equal(g.mods.length, count);
  g.start(g.seed);
  assert(!g.detour);
  assert.deepEqual(g.detours, []);
  assert.equal(g.stage, 0);
  assert.equal(g.mods.length, 0);
});

function walk(g: Game, path: { x: number; y: number }[], limit = 2400, land = false) {
  let waypoint = 0,
    previous = g.player.position.x,
    stuck = 0;
  for (let i = 0; i < limit && g.mode === 'playing' && waypoint < path.length; i++) {
    const p = g.player.position,
      t = path[waypoint],
      dx = t.x - p.x,
      dy = p.y - t.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < (land ? 8 : 40) && (!land || g.grounded)) {
      waypoint++;
      continue;
    }
    stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
    previous = p.x;
    const move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
    const blocked =
      move && Query.ray(g.solidBodies, p, { x: p.x + move * 50, y: p.y }, 24).length > 0;
    tick(g, {
      left: move < 0,
      right: move > 0,
      jump: g.grounded && (dy > 45 || !!blocked || stuck > 12),
    });
  }
  return waypoint === path.length || g.mode === 'upgrade';
}
test('every detour layout is traversable both ways with ordinary jumps and no upgrades', () => {
  for (const stage of [1, 4, 7, 10])
    for (let index = 0; index < 4; index++)
      for (const reverse of [false, true]) {
        const g = entrance('detour-walk-' + index, stage);
        enter(g);
        g.mods = [];
        g.gun = getGun([]);
        for (const p of [...g.props.items]) g.props.remove(p);
        g.hazards.clear();
        g.breaches.clear();
        for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
        g.enemies = [];
        g.waves.clear();
        Body.setPosition(g.player, { x: reverse ? 1830 : 140, y: 680 });
        const route = reverse ? [...g.level.route].reverse() : g.level.route;
        assert(
          walk(g, [...route, { x: reverse ? 120 : 1930, y: 720 }]),
          g.level.id + ' ' + reverse + ' ' + JSON.stringify(g.player.position),
        );
        assert.equal(g.hp, 100);
      }
});
test('the upper challenge door is reachable by ordinary jumps while walking under the steps selects the normal exit', () => {
  for (const upper of [false, true]) {
    const g = entrance('door-route');
    cleared(g);
    Body.setPosition(g.player, { x: 1725, y: 722 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.extendDetourSteps();
    assert(g.detourStepsReady);
    const path = upper
      ? [
          { x: 1828, y: 572 },
          { x: 1930, y: DETOUR_DOOR.floor - 18 },
        ]
      : [{ x: 1930, y: 722 }];
    assert(
      walk(g, path, 1200, upper),
      'door route ' + upper + ' ' + JSON.stringify(g.player.position),
    );
    for (let i = 0; i < 60 && g.mode === 'playing'; i++) tick(g);
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.enteringDetour, upper);
  }
});
test('steps extend only after clearing and never materialize through the player', () => {
  const g = entrance();
  const terrain = g.terrain.length;
  g.extendDetourSteps();
  assert.equal(g.terrain.length, terrain);
  cleared(g);
  Body.setPosition(g.player, { x: 1828, y: 590 });
  g.extendDetourSteps();
  assert(!g.detourStepsReady);
  Body.setPosition(g.player, { x: 1785, y: 722 });
  g.extendDetourSteps();
  assert(g.detourStepsReady);
  assert.equal(g.terrain.length, terrain + 2);
  g.extendDetourSteps();
  assert.equal(g.terrain.length, terrain + 2);
});

test('live machinery and props leave every warned challenge reinforcement able to emerge', () => {
  for (let index = 0; index < 8; index++)
    for (const stage of [1, 4, 7, 10]) {
      const g = entrance('detour-entrance-' + index, stage);
      enter(g);
      const opening = g.enemies.length;
      for (const e of [...g.enemies]) {
        e.spawn = 0;
        g.hitEnemy(e, 999999);
      }
      g.hitStop = 0;
      for (let frame = 0; frame < 600 && g.waves.pending; frame++) tick(g);
      assert.equal(g.mode, 'playing');
      assert(!g.waves.pending, g.level.id + ' blocked reinforcement');
      assert.equal(g.enemies.length, g.level.spawns.length - opening);
      assert(g.waves.doors.every((d) => d.state === 'open' || d.state === 'spent'));
      assert.equal(g.breaches.placement, null);
    }
});

test('Fold gets a fresh pair on challenge entry, continuation and returning to the main route', () => {
  const g = entrance('detour-fold');
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  cleared(g);
  assert(g.portals.place({ x: 160, y: 740 }));
  assert(g.portals.place({ x: 1900, y: 740 }));
  assert(!g.portals.canPlace);
  g.openReward(true);
  g.chooseMod(g.offers.find((m) => m.id !== 'rewire')!.id);
  assert(g.detour && g.portals.canPlace);
  assert(g.portals.pair.every((p) => p === null));
  assert(g.portals.place({ x: 160, y: 740 }));
  assert(g.portals.place({ x: 1900, y: 740 }));
  assert(!g.portals.canPlace);
  const resumed = new Game();
  resumed.start(g.seed, snapshot(g));
  assert(resumed.detour && resumed.portals.canPlace);
  assert(resumed.portals.pair.every((p) => p === null));
  cleared(g);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert(!g.detour && g.portals.canPlace);
  assert(g.portals.pair.every((p) => p === null));
});

test('practice cannot expose challenge doors or retain a challenge from the previous run', () => {
  const g = entrance();
  enter(g);
  const level = getLevel('practice-detour', 2);
  const kind = level.spawns[0].kind;
  assert(kind === 'loader' || kind === 'crane');
  assert(g.startPractice({ kind, seed: 'practice-detour' }));
  assert(!g.detour && !g.canDetour);
  assert.deepEqual(g.detours, []);
  g.openReward(true);
  assert.equal(g.mode, 'playing');
  assert.equal(g.offers.length, 0);
});
