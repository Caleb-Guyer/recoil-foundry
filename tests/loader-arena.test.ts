import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { LOADER_ARENA } from '../src/loader-layout.ts';
import { LOADER_COLLAPSE_TELL, LOADER_COLLAPSE_GAP } from '../src/loader-arena.ts';
import { CARGO_SIZE } from '../src/cargo-layout.ts';
import { CABLE_HP } from '../src/cargo.ts';
import { LOADER_TELL } from '../src/enemies.ts';
import { testEncounterFromUrl, testCheckpoint } from '../src/practice.ts';
import { dailyForDate } from '../src/daily.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { dodgePilot } from './combat-pilot.ts';
import { updateLoader } from '../src/area-boss-ai.ts';

const { Body, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1400, y: 650 },
};
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let n = 0; n < count; n++) g.tick(1 / 60, { ...idle, ...input });
}
function room(mirror = false, quiet = false) {
  const g = new Game(),
    seed = mirror ? 'LOADER-SHIFT-0' : 'LOADER-SHIFT-5';
  g.start(seed, testCheckpoint(seed, 3));
  const e = g.enemies[0];
  e.spawn = 0;
  if (quiet) g.updateLoader = (enemy) => Body.setVelocity(enemy.body, { x: 0, y: 0 });
  return { g, e };
}

test('Loader supports are authored, mirrored, isolated to their boss, and leave clear fall shafts', () => {
  const original = JSON.stringify(LOADER_ARENA);
  for (const mirror of [false, true]) {
    const { g } = room(mirror);
    assert.equal(g.level.mirrored, mirror);
    assert.equal(g.loaderArena.supports.length, 2);
    assert.equal(g.destruction.pieces.length, 2);
    for (const support of g.loaderArena.supports) {
      const rig = support.cargo.cargo!,
        origin = rig.origin;
      assert.equal(rig.tell, LOADER_COLLAPSE_TELL);
      assert.equal(support.cargo.maxHp, 150);
      assert.equal(support.barrier.rect.y + support.barrier.rect.h, 740);
      const shaft = {
        min: { x: origin.x - CARGO_SIZE.w / 2, y: rig.anchor.y },
        max: { x: origin.x + CARGO_SIZE.w / 2, y: 739 },
      };
      assert.equal(
        Query.region([...g.terrain, ...g.enemies.map((e) => e.body), g.player], shaft).length,
        0,
      );
    }
    const restored = room(mirror).g;
    assert.deepEqual(restored.level, g.level);
    assert.deepEqual(
      restored.cargo.items.map((p) => p.cargo!.origin),
      g.cargo.items.map((p) => p.cargo!.origin),
    );
  }
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const daily = dailyForDate(new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10))!.seed;
    for (const [kind, level] of [
      ['normal', getLevel('loader-natural-' + i, 3)],
      ['daily', getLevel(daily, 3)],
      ['overtime', getOvertimeLevel('loader-natural-' + i, 3)],
    ] as const) {
      if (level.id === 'loader-bay') {
        assert.equal(level.setpiece!.cargo!.length, 2);
        seen.add(kind + ':' + level.mirrored);
      }
    }
  }
  assert.equal(seen.size, 6);
  const other = new Game();
  other.start('other-area', testCheckpoint('other-area', 7));
  assert.equal(other.loaderArena.active, false);
  assert.equal(other.loaderArena.supports.length, 0);
  assert.equal(JSON.stringify(LOADER_ARENA), original);
});

test('both health phases give a full warning before removing real cover and releasing real cargo', () => {
  for (const mirror of [false, true]) {
    const { g, e } = room(mirror, true);
    for (const [index, fraction] of [0.64, 0.29].entries()) {
      e.hp = e.maxHp * fraction;
      step(g);
      const support = g.loaderArena.supports[index],
        at = g.time;
      assert.equal(support.state, 'warning');
      assert.equal(support.releaseAt, at + LOADER_COLLAPSE_TELL);
      step(g, 78);
      assert(support.cargo.body.isStatic);
      assert(g.terrain.includes(support.barrier.body));
      while (support.state === 'warning') step(g);
      assert(g.time - at >= LOADER_COLLAPSE_TELL);
      assert(!support.cargo.body.isStatic);
      assert(!g.terrain.includes(support.barrier.body));
      assert(!Composite.allBodies(g.engine.world).includes(support.barrier.body));
      step(g, 130);
      assert(Math.abs(support.cargo.body.position.y - (740 - CARGO_SIZE.h / 2)) < 1);
    }
    assert.equal(g.loaderArena.phase, 2);
    assert.equal(g.destruction.pieces.length, 0);
    assert.equal(g.level.solids.length, 3);
    step(g, 240);
    assert.equal(g.cargo.items.length, 2, 'supports never respawn their loads');
    assert.equal(g.props.items.filter((p) => p.kind === 'rubble').length, 0);
  }
});

test('crossing both thresholds at once staggers failures instead of skipping warnings', () => {
  const { g, e } = room(false, true);
  e.hp = e.maxHp * 0.2;
  step(g);
  const [first, second] = g.loaderArena.supports,
    firstAt = first.releaseAt;
  while (g.time < firstAt + LOADER_COLLAPSE_GAP - 1 / 60) step(g);
  assert.equal(second.state, 'braced');
  while (second.state === 'braced') step(g);
  assert(second.releaseAt >= firstAt + LOADER_COLLAPSE_GAP + LOADER_COLLAPSE_TELL);
  assert(second.cargo.body.isStatic);
});

test('real Loader rams smash marked barriers in either direction and keep their exposed crash window', () => {
  for (const mirror of [false, true])
    for (const sign of [-1, 1]) {
      const { g, e } = room(mirror);
      for (const prop of [...g.props.items]) if (!prop.cargo) g.props.remove(prop);
      const support = g.loaderArena.supports[0],
        rect = support.barrier.rect;
      const edge = sign > 0 ? rect.x : rect.x + rect.w;
      Body.setPosition(e.body, { x: edge - sign * (56 + 9), y: 706 });
      Body.setVelocity(e.body, { x: sign * 15, y: 0 });
      Body.setPosition(g.player, { x: sign > 0 ? 1850 : 150, y: 722 });
      e.state = 'rush';
      e.timer = 1;
      e.aim = { x: sign, y: 0 };
      step(g);
      assert(!g.terrain.includes(support.barrier.body));
      assert.equal(e.state, 'recover');
      assert.equal(e.timer, 1.25);
      assert(sign > 0 ? e.body.bounds.max.x <= edge + 0.2 : e.body.bounds.min.x >= edge - 0.2);
      const hp = e.hp;
      g.hitEnemy(e, 20);
      assert.equal(hp - e.hp, 25);
      step(g);
      assert.equal(support.state, 'warning');
      assert(support.cargo.body.isStatic);
    }
});

test('a Loader facing a marked bumper warns and charges instead of endlessly hopping it', () => {
  const { g, e } = room();
  for (const prop of [...g.props.items]) if (!prop.cargo) g.props.remove(prop);
  Body.setPosition(e.body, { x: 450, y: 706 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  Body.setPosition(g.player, { x: 950, y: 722 });
  e.state = 'idle';
  e.timer = 0;
  step(g, 2);
  assert.equal(e.state, 'windup');
  assert(e.timer >= LOADER_TELL - 1 / 60 - 0.001);
  for (let i = 0; i < 120 && e.state !== 'recover'; i++) step(g);
  assert.equal(e.state, 'recover');
  assert(!g.terrain.includes(g.loaderArena.supports[0].barrier.body));
});

test('shooting a physical cable starts its full warning and cannot multiply or accelerate releases', () => {
  const { g } = room(false, true),
    support = g.loaderArena.supports[0];
  const x = support.cargo.cargo!.origin.x;
  const shoot = () => {
    g.addShot({
      pos: { x: x - 120, y: 300 },
      vel: { x: 200, y: 0 },
      damage: CABLE_HP,
      life: 1,
      friendly: true,
      radius: 2,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: false,
    });
    g.updateShots(1 / 60);
  };
  shoot();
  assert.equal(support.cargo.cargo!.state, 'warning');
  const releaseAt = support.cargo.cargo!.releaseAt;
  shoot();
  g.loaderArena.update();
  assert.equal(support.releaseAt, releaseAt);
  step(g, 30);
  assert(support.cargo.body.isStatic);
  while (g.time <= releaseAt + 0.03) step(g);
  assert.equal(support.state, 'spent');
  assert.equal(g.cargo.items.length, 2);
});

test('falling cargo hurts a player who stays under it, while walking out of its warning is safe', () => {
  for (const dodge of [false, true]) {
    const { g, e } = room(false, true);
    const x = g.loaderArena.supports[0].cargo.cargo!.origin.x;
    Body.setPosition(g.player, { x, y: 722 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    e.hp = e.maxHp * 0.64;
    step(g);
    step(g, 150, { right: dodge });
    assert.equal(g.hp, dodge ? 100 : 76);
  }
});

test('released cargo can hit the Loader and a subsequent real charge destroys that cover', () => {
  const { g, e } = room(false, true),
    support = g.loaderArena.supports[0];
  for (const prop of [...g.props.items]) if (!prop.cargo) g.props.remove(prop);
  Body.setPosition(e.body, { x: support.cargo.cargo!.origin.x, y: 706 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  e.hp = e.maxHp * 0.64;
  const hp = e.hp;
  for (let i = 0; i < 200 && e.hp === hp; i++) step(g);
  assert(e.hp < hp && hp - e.hp <= 90);
  assert(support.cargo.cargo!.hits.has(e.body.id));
  // Move the boss clear so its existing landed cover can settle on the floor.
  Body.setPosition(e.body, { x: 1500, y: 706 });
  step(g, 180); // Let the temporary barrier rubble expire before the next charge.
  const load = support.cargo,
    pos = load.body.position;
  g.updateLoader = (enemy) => updateLoader(g, enemy);
  Body.setPosition(e.body, { x: pos.x - 48 - 56 - 9, y: 706 });
  Body.setVelocity(e.body, { x: 15, y: 0 });
  e.state = 'rush';
  e.timer = 1;
  e.aim = { x: 1, y: 0 };
  step(g);
  assert(!g.props.items.includes(load));
  assert(!Composite.allBodies(g.engine.world).includes(load.body));
  assert.equal(e.state, 'recover');
});

test('pause and hitstop freeze collapses; death and boss victory cancel pending hazards', () => {
  for (const ending of ['player', 'boss'] as const) {
    const { g, e } = room(false, true);
    e.hp = e.maxHp * 0.64;
    step(g);
    const support = g.loaderArena.supports[0],
      time = g.time;
    g.setMode('paused');
    step(g, 120);
    assert.equal(g.time, time);
    assert(support.cargo.body.isStatic);
    g.setMode('playing');
    g.hitStop = 0.3;
    step(g, 10);
    assert.equal(g.time, time);
    if (ending === 'player') g.damagePlayer(1000);
    else g.hitEnemy(e, 10000);
    assert.equal(g.loaderArena.active, false);
    assert.equal(support.cargo.cargo!.state, 'hanging');
    assert.equal(support.cargo.cargo!.releaseAt, Infinity);
    step(g, 240);
    assert(support.cargo.body.isStatic);
    assert(g.terrain.includes(support.barrier.body));
    g.cargo.cut(support.cargo, 1000);
    assert.equal(support.cargo.cargo!.state, 'hanging');
    g.start(g.seed, testCheckpoint(g.seed, 3));
    assert(g.loaderArena.active);
    assert(g.loaderArena.supports.every((s) => s.state === 'braced' && !s.cargo.cargo!.disabled));
    assert.equal(g.destruction.pieces.length, 2);
  }
});

test('ordinary jumping crosses the arena in both directions with intact and collapsed supports', () => {
  for (const mirror of [false, true])
    for (const collapsed of [false, true])
      for (const reverse of [false, true]) {
        const { g, e } = room(mirror, true);
        // Keep the encounter active, but hold its boss outside the traversal lane.
        Body.setPosition(e.body, { x: 1000, y: 170 });
        Body.setStatic(e.body, true);
        g.mods = [];
        g.gun = getGun([]);
        if (collapsed) {
          e.hp = e.maxHp * 0.2;
          step(g, 450);
        }
        const from = reverse ? 1850 : 150,
          to = reverse ? 150 : 1850,
          sign = Math.sign(to - from);
        Body.setPosition(g.player, { x: from, y: 722 });
        Body.setVelocity(g.player, { x: 0, y: 0 });
        let previous = from,
          stuck = 0;
        for (
          let n = 0;
          n < 1500 && Math.abs(g.player.position.x - to) > 40 && g.mode === 'playing';
          n++
        ) {
          const p = g.player.position;
          stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
          previous = p.x;
          const blocked =
            Query.ray(g.solidBodies, p, { x: p.x + sign * 65, y: p.y }, 24).length > 0;
          step(g, 1, {
            left: sign < 0,
            right: sign > 0,
            jump: g.grounded && (blocked || stuck > 10),
          });
        }
        assert(
          Math.abs(g.player.position.x - to) <= 40,
          `${mirror}/${collapsed}/${reverse}: ${JSON.stringify(g.player.position)}`,
        );
        assert.equal(g.hp, 100);
      }
});

test('Loader links select both real orientations and preserve saves, records and earned Practice', () => {
  for (const mirror of [false, true]) {
    const entry = testEncounterFromUrl(
      new URL('https://test/?test=loader&mirror=' + Number(mirror)),
    )!;
    assert(entry);
    assert.equal(getLevel(entry.seed, 3).mirrored, mirror);
    const g = new Game(),
      writes: unknown[] = [],
      victories: string[] = [];
    g.onCheckpoint = (save) => writes.push(save);
    g.onBossDefeated = (kind) => victories.push(kind);
    g.start('keep-my-run');
    const saved = structuredClone(writes);
    assert(g.startPractice(entry));
    assert.equal(g.mods.length, 3);
    g.enemies[0].spawn = 0;
    g.hitEnemy(g.enemies[0], 10000);
    step(g, 15);
    assert.equal(g.mode, 'won');
    assert.deepEqual(writes, saved);
    assert.deepEqual(victories, []);
    assert(g.startPractice(entry));
    assert(g.loaderArena.supports.every((s) => s.state === 'braced'));
    g.start('restored', loadCheckpoint(saved[0])!);
    assert.equal(g.loaderArena.active, false);
  }
  for (const suffix of [
    '&test=loader',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-13',
    '&dv=59',
    '&seed=x',
    '&workshop=1',
    '&area=docks',
    '&build=anything',
  ])
    assert.equal(testEncounterFromUrl(new URL('https://test/?test=loader' + suffix)), null, suffix);
});

for (const mirror of [false, true])
  test(`Loader ${mirror}: changing arena clears with normal health and player inputs`, () => {
    const { g, e } = room(mirror);
    for (let n = 0; n < 12000 && g.enemies.length && g.mode === 'playing'; n++)
      step(g, 1, dodgePilot(g, e));
    assert(
      g.hp > 0 && g.enemies.length === 0,
      `hp=${g.hp}, boss=${e.hp}, player=${JSON.stringify(g.player.position)}`,
    );
    assert(g.loaderArena.supports.some((s) => !g.terrain.includes(s.barrier.body)));
  });
