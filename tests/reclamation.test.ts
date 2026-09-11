import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { loadCheckpoint, STAGES, validBuild, isDetourStage } from '../src/rules.ts';
import { testCheckpoint, reclamationTestFromUrl, loadEncounters } from '../src/practice.ts';
import { RECLAMATION_LAYOUTS } from '../src/reclamation-layouts.ts';
import { SORTER_LOCK, SORTER_TELL } from '../src/reclamation.ts';
import { dodgePilot } from './combat-pilot.ts';

const { Body, Composite, Engine, Query, Bodies } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 500 },
};
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, { ...idle, ...input });
}
function room(stage = 12, seed = 'RECLAMATION-20') {
  const g = new Game();
  g.startTest(testCheckpoint(seed, stage));
  return g;
}
function sorterRoom(seed = 'RECLAMATION-20') {
  const g = new Game();
  assert(g.startPractice({ kind: 'sorter', seed }));
  return g;
}
function empty(g: Game) {
  for (const e of [...g.enemies]) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
}

test('Reclamation occupies three distinct rooms and a boss before the retuned rooftops', () => {
  assert.equal(STAGES, 20);
  const orientations = new Set<boolean>();
  for (let i = 0; i < 60; i++) {
    const seed = 'reclaim-layout-' + i;
    for (let stage = 12; stage < 16; stage++) {
      const level = getLevel(seed, stage);
      orientations.add(level.mirrored);
      assert.equal(level.area, 'reclamation');
      assert.deepEqual(level, getLevel(seed, stage));
      assert.equal(level.boss, stage === 15);
      if (level.spawns[0].kind !== 'boss')
        assert(level.magnets!.length >= 2 && level.magnets!.length <= 3);
      if (stage < 15) {
        assert.equal(level.id, RECLAMATION_LAYOUTS[stage - 12].id);
        assert(level.spawns.some((s) => s.kind === 'borer'));
        assert(level.spawns.some((s) => s.kind === 'sifter'));
      }
      for (const m of level.magnets!)
        for (const s of level.solids)
          assert(
            !(m.x + 26 > s.x && m.x - 26 < s.x + s.w && m.y + 30 < s.y + s.h && m.floor > s.y),
            'magnet shaft obstructed',
          );
    }
    assert.equal(getLevel(seed, 16).area, 'rooftops');
  }
  assert.equal(orientations.size, 2);
  assert(!isDetourStage(14));
  assert(isDetourStage(18));
});

test('all new layouts and mirrors remain walkable with ordinary jumps and loose cover', () => {
  const cases = new Map<string, { seed: string; stage: number }>();
  for (let i = 0; i < 100; i++)
    for (let stage = 12; stage < 16; stage++) {
      const seed = 'reclaim-walk-' + i,
        level = getLevel(seed, stage);
      cases.set(level.id + ':' + level.mirrored, { seed, stage });
    }
  assert.equal(cases.size, 12);
  for (const [label, { seed, stage }] of cases) {
    const g = room(stage, seed);
    empty(g);
    g.mods = [];
    const path = [...g.level.route, { x: 1900, y: 720 }];
    let index = 0,
      stuck = 0,
      last = 140;
    for (let i = 0; i < 3600 && index < path.length; i++) {
      const p = g.player.position,
        target = path[index],
        dx = target.x - p.x,
        dy = p.y - target.y;
      if (Math.abs(dx) < 40 && Math.abs(dy) < 65) {
        index++;
        continue;
      }
      stuck = Math.abs(p.x - last) < 0.4 ? stuck + 1 : 0;
      last = p.x;
      const move = dx > 12 ? 1 : dx < -12 ? -1 : 0;
      const blocked = Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 24).length > 0;
      g.clear = false;
      step(g, 1, {
        left: move < 0,
        right: move > 0,
        jump: g.grounded && (dy > 50 || blocked || stuck > 12),
      });
      if (g.mode === 'upgrade') break;
    }
    assert(g.hp > 0, label + ' killed a walker');
    assert(
      index === path.length || g.mode === 'upgrade',
      label + ' blocked waypoint ' + index + ' ' + JSON.stringify(g.player.position),
    );
  }
});

test('magnets warn, lift real crates, hold, then release damaging physical debris', () => {
  const g = room();
  empty(g);
  const m = g.magnets.items[0];
  m.offset = 0;
  g.magnets.items = [m];
  const crate = g.props.items.find((p) => Math.abs(p.body.position.x - m.x) < 1)!;
  const physics = () => {
    g.time += 1 / 60;
    g.magnets.update();
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
  };
  for (let i = 0; i < 45; i++) physics();
  assert.equal(m.phase, 'warn');
  assert.equal(m.held, null);
  assert(crate.body.position.y > 710);
  for (let i = 0; i < 165; i++) physics();
  assert(m.held === crate);
  assert(crate.body.position.y < 470);
  Body.setPosition(g.player, { x: m.x, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 145; i++) physics();
  assert.equal(m.held, null);
  assert(g.hp < 100, 'falling crate never struck the player');
  assert(crate.body.position.y < 740, 'crate passed through floor');
  assert(g.hp >= 82, 'one release dealt repeated contact damage');
});

test('magnet pickups respect cover and shooting, destroyed or displaced crates release immediately', () => {
  for (const action of ['cover', 'shoot', 'remove', 'displace']) {
    const g = room();
    empty(g);
    const m = g.magnets.items[0];
    m.offset = 0;
    g.magnets.items = [m];
    const crate = g.props.items.find((p) => Math.abs(p.body.position.x - m.x) < 1)!;
    if (action === 'cover') {
      const shelf = Bodies.rectangle(m.x, 600, 180, 22, { isStatic: true });
      g.terrain.push(shelf);
      Composite.add(g.engine.world, shelf);
    }
    g.time = 1.1;
    g.magnets.update();
    if (action === 'cover') {
      assert.equal(m.held, null);
      continue;
    }
    assert.equal(m.held, crate);
    if (action === 'shoot') g.props.hit(crate, 1, { x: 1, y: 0 });
    if (action === 'remove') g.props.remove(crate);
    if (action === 'displace') {
      Body.setPosition(crate.body, { x: m.x + 300, y: 500 });
      g.magnets.update();
    }
    assert.equal(m.held, null, action);
  }
});

test('pause and hitstop freeze magnet cycles; room entrance and retry reconstruct them', () => {
  const g = room();
  g.time = 1.2;
  g.magnets.items[0].offset = 0;
  g.magnets.update();
  const snapshot = g.magnets.items.map((m) => [m.phase, m.held?.body.position.y]);
  g.mode = 'paused';
  step(g, 120);
  assert.deepEqual(
    g.magnets.items.map((m) => [m.phase, m.held?.body.position.y]),
    snapshot,
  );
  g.mode = 'playing';
  g.hitStop = 1;
  step(g, 30);
  assert.deepEqual(
    g.magnets.items.map((m) => [m.phase, m.held?.body.position.y]),
    snapshot,
  );
  g.time = 100;
  g.loadRoom();
  g.magnets.update();
  assert.equal(g.magnets.startedAt, 100);
  assert.equal(g.magnets.items[0].held, null);
  g.stage = 16;
  g.loadRoom();
  assert.deepEqual(g.magnets.items, []);
});

test('v4 entrances and escapes preserve gun, clock and rooftop detours through the inserted area', () => {
  for (let stage = 0; stage < 16; stage++) {
    const old = {
      ...testCheckpoint('saved-four-areas', stage),
      version: 4,
      hp: 63,
      elapsed: 125,
      kills: 77,
    };
    const migrated = loadCheckpoint(old)!;
    assert(migrated);
    assert.equal(migrated.version, 5);
    assert.equal(migrated.stage, stage + (stage >= 12 ? 4 : 0));
    assert.equal(migrated.missedUpgrades, stage >= 12 ? 4 : 0);
    assert.deepEqual(migrated.mods, old.mods);
    assert.equal(migrated.hp, 63);
    assert.equal(migrated.elapsed, 125);
    assert.equal(migrated.kills, 77);
    assert.deepEqual(loadCheckpoint(migrated), migrated);
  }
  const old = {
    ...testCheckpoint('saved-escape', 19),
    version: 4,
    stage: 15,
    escape: true,
    detours: [0, 1, 2, 3],
  };
  const migrated = loadCheckpoint(old)!;
  assert(migrated);
  assert.deepEqual(migrated.detours, [0, 1, 2, 4]);
  assert.equal(migrated.stage, 19);
  assert.deepEqual(loadCheckpoint(migrated), migrated);
  const g = new Game();
  g.start(migrated.seed, migrated);
  assert(g.escape);
  assert.equal(g.mods.length, 19);
});

test('the isolated area test has twelve legal upgrades and preserves saves and earned victories', () => {
  const base = 'https://caleb-guyer.github.io/recoil-foundry/';
  const save = reclamationTestFromUrl(new URL('?test=reclamation', base))!;
  assert.equal(save.stage, 12);
  assert.equal(save.mods.length, 12);
  assert(validBuild(save.mods));
  for (const query of [
    '?test=reclamation&test=reclamation',
    '?test=reclamation&daily=2026-09-10',
    '?test=reclamation&seed=x',
    '?test=reclamation&dv=31',
    '?test=reclamation&area=rooftops',
  ])
    assert.equal(reclamationTestFromUrl(new URL(query, base)), null);
  const g = new Game();
  let writes = 0,
    wins = 0;
  g.start('ordinary');
  g.onCheckpoint = () => writes++;
  g.onBossDefeated = () => wins++;
  g.startTest(save);
  g.save();
  g.stage = 15;
  g.loadRoom();
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  g.damagePlayer(999999);
  g.startTest(g.testRun!);
  assert.equal(writes, 0);
  assert.equal(wins, 0);
  assert.equal(g.stage, 12);
  assert.deepEqual(loadEncounters([]), []);
});

test('the new boss locks every induction lane before release and a walking dodge avoids it', () => {
  for (const dodge of [false, true]) {
    const g = sorterRoom(),
      e = g.enemies[0];
    e.spawn = 0;
    e.timer = 0;
    Body.setStatic(e.body, true);
    Body.setPosition(g.player, { x: 1000, y: 722 });
    e.attacks = 0;
    step(g);
    assert.equal(e.state, 'windup');
    assert.equal(e.timer, SORTER_TELL);
    step(g, Math.ceil((SORTER_TELL - SORTER_LOCK) * 60));
    const locked = [...e.sorter!.lanes];
    const hp = g.hp;
    for (let i = 0; i < 48; i++) {
      step(g, 1, { right: dodge });
      if (e.state === 'windup') assert.deepEqual(e.sorter!.lanes, locked);
    }
    assert.equal(g.hp, dodge ? hp : hp - 24);
  }
});

for (const seed of ['RECLAMATION-20', 'reclaim-boss-2'])
  test('new boss can be defeated with normal health and earned-stage gun: ' + seed, () => {
    const g = sorterRoom(seed),
      e = g.enemies[0];
    for (let i = 0; i < 10800 && e.hp > 0 && g.mode === 'playing'; i++)
      step(g, 1, dodgePilot(g, e));
    assert(e.hp <= 0, `player ${g.hp}, boss ${Math.round(e.hp)}, ${e.attacks} attacks`);
    assert(g.hp > 0);
  });

test('new boss pressures corner and overhead camps and clears warnings on phase changes', () => {
  for (const spot of [
    { x: 13, y: 722 },
    { x: 1987, y: 722 },
    { x: 1000, y: 80 },
  ]) {
    const g = sorterRoom(),
      e = g.enemies[0];
    Body.setPosition(g.player, spot);
    Body.setStatic(g.player, true);
    step(g, 1800);
    assert.equal(g.mode, 'dead');
  }
  const g = sorterRoom(),
    e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  step(g);
  assert(e.sorter!.lanes.length);
  e.hp = e.maxHp * 0.6;
  step(g);
  assert.equal(e.state, 'transition');
  assert.deepEqual(e.sorter!.lanes, []);
});

for (const kind of ['borer', 'sifter'] as const)
  test(kind + ' locks a warned volley and its rounds collide with cover', () => {
    const g = room();
    empty(g);
    for (const p of [...g.props.items]) g.props.remove(p);
    for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
    g.terrain = g.terrain.slice(0, 4);
    g.magnets.items = [];
    Body.setPosition(g.player, { x: 1000, y: 400 });
    Body.setStatic(g.player, true);
    g.spawnEnemy(kind, 600, 400);
    const e = g.enemies[0];
    e.spawn = 0;
    e.timer = 0;
    Body.setStatic(e.body, true);
    const rounds: number[] = [];
    const shoot = g.enemyShot.bind(g);
    g.enemyShot = (enemy, a, ...rest) => {
      rounds.push(a);
      shoot(enemy, a, ...rest);
    };
    step(g);
    assert.equal(e.state, 'windup');
    step(g, 26);
    const aim = { ...e.aim };
    Body.setPosition(g.player, { x: 1000, y: 500 });
    step(g, 20);
    assert.deepEqual(e.aim, aim);
    const crate = g.props.spawn('crate', 700, 400);
    Body.setStatic(crate.body, true);
    step(g, 14);
    assert.equal(rounds.length, 3);
    assert.equal(e.state, 'recover');
    assert(crate.hp < crate.maxHp, 'rounds passed through the physical crate');
    assert.equal(g.hp, 100);
    assert(e.body.isStatic, 'test fixture moved');
  });
