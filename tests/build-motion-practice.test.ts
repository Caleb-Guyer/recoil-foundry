import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { MODS, getGun } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { BuildMotionPractice, buildMotionPracticeConfig } from '../src/build-motion-practice.ts';
import { buildMotionMarkup, buildMotionRowsMarkup } from '../src/build-motion-menu.ts';
import { destroyUpgradeDemo } from '../src/upgrade-demo.ts';
const all = MODS.map((m) => m.id);
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 560, y: 723 },
};
const source = (mods = ['piston-lance', 'scatter', 'momentum-battery']) => {
  const g = new Game();
  g.startWorkshop(all, mods);
  g.setMode('paused');
  return g;
};

test('only actually equipped or actively leased fitting details can create a practice shortcut', () => {
  const g = source();
  assert(buildMotionPracticeConfig(g, 'piston-lance'));
  assert.equal(buildMotionPracticeConfig(g, 'seeker-rack'), null);
  assert.equal(buildMotionPracticeConfig(g, '<script>'), null);
  assert.equal(buildMotionPracticeConfig(g, 'unknown-fitting'), null);
  const html = buildMotionMarkup(g);
  assert(html.includes('id="motion-build"'));
  assert(html.includes('data-motion-practice="piston-lance"'));
  assert(!html.includes('data-motion-practice="seeker-rack"'));
  assert(!html.includes('Your tool fires directly'));
  destroyUpgradeDemo(g);
});

for (const gun of STARTING_GUN_IDS)
  test(`private ${gun} practice preserves the complete paid gun and leaves the parent paused`, () => {
    const g = source();
    g.startingGun = gun;
    g.gun = getGun(g.mods, gun);
    g.seed = 'RF-C108-BUILD-MOTION-OWNED';
    g.hp = 57;
    g.elapsed = 123.5;
    g.kills = 11;
    const parent = structuredClone(g.checkpointSnapshot()),
      pos = { ...g.player.position };
    const writes: unknown[] = [];
    g.onCheckpoint = (s) => writes.push(s);
    g.onBossDefeated = (b) => writes.push(b);
    g.onCommendation = (c) => writes.push(c);
    const config = buildMotionPracticeConfig(g, 'piston-lance')!;
    const practice = new BuildMotionPractice(config),
      p = practice.game;
    const parentBodies = new Set(Matter.Composite.allBodies(g.engine.world));
    assert(Matter.Composite.allBodies(p.engine.world).every((b) => !parentBodies.has(b)));
    assert.notEqual(p.player, g.player);
    assert.deepEqual(p.mods, g.mods);
    assert.deepEqual(p.gun, g.gun);
    assert.equal(p.seed, g.seed);
    assert.equal(p.workshop.scenario, 'groups');
    assert.equal(p.hp, 100);
    for (let i = 0; i < 130; i++) practice.tick(1 / 60, { ...idle, fire: i > 30 });
    assert(p.shotCount > 0);
    assert((p.combatReport.snapshot().activations?.['piston-lance'] ?? 0) > 0);
    assert.equal(g.mode, 'paused');
    assert.deepEqual(g.player.position, pos);
    assert.deepEqual(g.checkpointSnapshot(), parent);
    assert.deepEqual(writes, []);
    assert.deepEqual(config, buildMotionPracticeConfig(g, 'piston-lance'));
    practice.dispose();
    assert.equal(p.engine.world.bodies.length, 0);
    assert(g.engine.world.bodies.length > 0);
    destroyUpgradeDemo(g);
  });

test('range resets retain exact legacy equipment while rebuilding the private physics world', () => {
  const g = source(['cutting-torch', 'scatter', 'offset-nozzle']);
  // An older run can hold a legacy combination that normal Workshop acquisition would trim.
  g.mods.push('recall');
  g.gun = getGun(g.mods, g.startingGun);
  g.seed = 'RF-C73-LEGACY';
  const config = buildMotionPracticeConfig(g, 'offset-nozzle')!,
    p = new BuildMotionPractice(config);
  const old = p.game,
    before = structuredClone(g.checkpointSnapshot());
  old.hp = 12;
  old.shots.push({} as never);
  p.reset();
  assert.notEqual(p.game, old);
  assert.equal(old.engine.world.bodies.length, 0);
  assert.deepEqual(p.game.mods, config.mods);
  assert.deepEqual(p.game.gun, g.gun);
  assert.equal(p.game.seed, g.seed);
  assert.equal(p.game.workshop.scenario, 'cover');
  assert.equal(p.game.hp, 100);
  assert.equal(p.game.shots.length, 0);
  assert.deepEqual(g.checkpointSnapshot(), before);
  p.dispose();
  p.dispose();
  destroyUpgradeDemo(g);
});

test('borrowed morphs and completed field evolutions are copied without sharing campaign state', () => {
  const g = source(['ricochet-harness']);
  g.shiftRun.state = {
    version: 1,
    routes: [6],
    powers: [],
    leases: [6],
    paid: [],
    grants: [],
    freeRerolls: 0,
    repairs: [],
    lease: { morph: 'seeker-rack', stage: 6, cleared: [], status: 'active' },
    experiment: {
      id: 'ricochet-harness',
      progress: 3,
      status: 'complete',
      evolution: 'double-return',
    },
  };
  const config = buildMotionPracticeConfig(g, 'seeker-rack')!;
  assert(config);
  const p = new BuildMotionPractice(config);
  assert.equal(p.game.shiftMorphs.equipped, 'seeker-rack');
  assert(p.game.shiftRun.hasEvolution('double-return'));
  assert.equal(p.game.shiftRun.enabled, false, 'practice cannot progress factory junctions');
  assert.notEqual(p.game.shiftRun.state, g.shiftRun.state);
  p.game.shiftRun.state!.lease!.cleared.push(7);
  assert.deepEqual(g.shiftRun.state.lease!.cleared, []);
  p.reset();
  assert.equal(p.game.shiftMorphs.equipped, 'seeker-rack');
  assert(p.game.shiftRun.hasEvolution('double-return'));
  p.dispose();
  destroyUpgradeDemo(g);
});

test('pause, invalid clocks and disposed sessions cannot advance or spend private practice input', () => {
  const g = source();
  const p = new BuildMotionPractice(buildMotionPracticeConfig(g, 'piston-lance')!);
  p.game.setMode('paused');
  const time = p.game.time;
  for (const dt of [1 / 60, 0, -1, NaN, Infinity]) p.tick(dt, { ...idle, fire: true });
  assert.equal(p.game.time, time);
  assert.equal(p.game.shotCount, 0);
  p.game.setMode('playing');
  p.dispose();
  p.tick(1 / 60, { ...idle, fire: true });
  assert.equal(p.game.shotCount, 0);
  assert.equal(p.game.engine.world.bodies.length, 0);
  destroyUpgradeDemo(g);
});

test('legacy beam builds keep their actual complete-pattern explanation in the compact Pause card', () => {
  const g = source(['cutting-torch', 'scatter']);
  const html = buildMotionMarkup(g, true);
  assert(html.includes('5 beams'));
  assert(!html.includes('Your tool fires directly'));
  assert(html.includes(' open'));
  const escaped = buildMotionRowsMarkup([
    {
      id: 'id',
      name: '<script>',
      trigger: 'A & B',
      detail: '<img>',
      state: 'ready',
      progress: 4,
      scenario: 'groups',
    },
  ]);
  assert(!escaped.includes('<script>'));
  assert(escaped.includes('&lt;script&gt;'));
  assert(escaped.includes('value="1"'));
  assert(escaped.includes('A &amp; B'));
  destroyUpgradeDemo(g);
});
