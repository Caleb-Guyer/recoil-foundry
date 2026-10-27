import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { BUILD_ACTIVATION_IDS, loadCombatResults } from '../src/combat-report.ts';
import { fixture, target, round, wall, Body, Composite, Engine, beam } from './branches-fixture.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { testCheckpoint } from '../src/practice.ts';

const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
const clean = (g: Game) => {
  Composite.clear(g.engine.world, false);
  Engine.clear(g.engine);
};
const count = (g: Game, id: (typeof BUILD_ACTIVATION_IDS)[number]) =>
  g.combatReport.snapshot().activations?.[id] ?? 0;

test('activation reports distinguish fresh zero, unavailable old data and a partial continued recording', () => {
  const fresh = fixture(['piston-lance']);
  assert.deepEqual(fresh.combatReport.snapshot().activations, {});
  assert.equal(fresh.combatReport.snapshot().activationFromStage, 0);
  const old = {
    version: 1 as const,
    heatTransfers: 2,
    bankCharges: 1,
    armorBlocks: 0,
    bloodworkHealing: 0,
    fromStage: 0,
  };
  const loaded = loadCombatResults(old)!;
  assert.equal(loaded.activations, undefined);
  fresh.combatReport.reset(old);
  fresh.stage = 7;
  fresh.fireRound();
  const partial = fresh.combatReport.snapshot();
  assert.equal(partial.activations?.['piston-lance'], 1);
  assert.equal(partial.activationPartial, true);
  assert.equal(partial.activationFromStage, 7);
  assert.equal(partial.heatTransfers, 2);
  clean(fresh);
});

test('malformed optional activation data never discards valid established counters or accepts unknown fields', () => {
  const raw = {
    version: 1 as const,
    heatTransfers: 2,
    bankCharges: 1,
    armorBlocks: 0,
    bloodworkHealing: 0,
    fromStage: 0,
    activationFromStage: 3,
  };
  for (const activations of [
    null,
    [],
    { unknown: 1 },
    { 'piston-lance': -1 },
    { 'piston-lance': 0.5 },
    { 'piston-lance': Infinity },
    { 'piston-lance': 1e7 + 1 },
  ]) {
    const read = loadCombatResults({ ...raw, activations })!;
    assert.equal(read.heatTransfers, 2);
    assert.equal(read.activations, undefined);
  }
  for (const activationFromStage of [-1, 20, 0.5, NaN])
    assert.equal(
      loadCombatResults({ ...raw, activationFromStage, activations: {} })!.activations,
      undefined,
    );
  const supplied = { ...raw, activations: { 'piston-lance': 3 } };
  const read = loadCombatResults(supplied)!;
  supplied.activations['piston-lance'] = 99;
  assert.equal(read.activations?.['piston-lance'], 3);
});

test('activation tokens deduplicate complete triggers, cap valid counts, and reject idle, dead or unowned events', () => {
  const g = fixture(['piston-lance']);
  g.combatReport.activation('piston-lance', 1);
  g.combatReport.activation('piston-lance', 1);
  assert.equal(count(g, 'piston-lance'), 1);
  for (const invalid of [NaN, -1, 0.5, Infinity, '', 'x'.repeat(81), {}])
    g.combatReport.activation('piston-lance', invalid as number);
  g.combatReport.activation('cable-saw', 1);
  g.setMode('paused');
  g.combatReport.activation('piston-lance', 2);
  g.setMode('playing');
  g.hitStop = 1;
  g.combatReport.activation('piston-lance', 2);
  g.hitStop = 0;
  g.hp = 0;
  g.combatReport.activation('piston-lance', 2);
  assert.equal(count(g, 'piston-lance'), 1);
  const snap = g.combatReport.snapshot();
  snap.activations!['piston-lance'] = 1e7;
  assert.equal(count(g, 'piston-lance'), 1, 'snapshot dictionaries are detached');
  g.hp = 100;
  g.combatReport.reset(snap);
  g.combatReport.activation('piston-lance', 2);
  assert.equal(count(g, 'piston-lance'), 1e7);
  clean(g);
});

test('actual pellet patterns, rear fire and repeated beam frames count one native morph discharge', () => {
  for (const id of ['piston-lance', 'cable-saw'] as const) {
    const g = fixture([id, 'scatter', 'crossfire', 'backblast', 'backfire']);
    g.fireRound();
    assert(g.shots.length > 5);
    assert.equal(count(g, id), 1);
    for (const s of g.shots) g.shiftMorphs.prepare(s);
    assert.equal(count(g, id), 1);
    g.fireRound();
    assert.equal(count(g, id), 2);
    clean(g);
    const torch = fixture([id, 'cutting-torch', 'scatter', 'prism-array']);
    beam(torch, DT * 3);
    assert.equal(count(torch, id), 1);
    beam(torch, DT);
    assert.equal(count(torch, id), 1);
    clean(torch);
  }
});

test('native nozzle use and battery jumps report consumption, not placement, previews, empty hops or repeated origins', () => {
  const g = fixture(['piston-lance', 'offset-nozzle', 'momentum-battery']);
  g.time = 1;
  const surface = wall(g, 500, 300, 20, 200);
  g.fireRound();
  const s = g.shots[0];
  s.pos = { x: 487.5, y: 300 };
  g.shiftUpgrades.terrainHit(s, surface, { x: -1, y: 0 });
  assert(g.shiftUpgrades.nozzle);
  assert.equal(count(g, 'offset-nozzle'), 0);
  g.shotCount++;
  const base = { x: 200, y: 297 },
    dir = { x: 1, y: 0 };
  assert.deepEqual(g.shiftUpgrades.origin(base, dir, false), base);
  const remote = g.shiftUpgrades.origin(base, dir);
  assert(remote.x > 400);
  g.shiftUpgrades.origin(base, dir);
  assert.equal(count(g, 'offset-nozzle'), 1);
  g.grounded = true;
  g.fireRound();
  assert(g.shiftUpgrades.battery > 0);
  assert.equal(count(g, 'momentum-battery'), 0);
  g.grounded = false;
  g.shiftUpgrades.afterGround({ ...idle, jump: true }, true);
  g.shiftUpgrades.afterGround({ ...idle, jump: true }, false);
  assert.equal(count(g, 'momentum-battery'), 1);
  clean(g);
});

test('native polarity contacts and redirected recoil are counted by discharge, not each target or beam frame', () => {
  const g = fixture(['polarity-rounds', 'gimbal-mount']);
  g.time = 1;
  const a = target(g, 550),
    b = target(g, 650);
  g.shiftUpgrades.beforeStep(DT, { ...idle, right: true, fire: true });
  g.fireRound();
  for (const e of [a, b]) g.shiftUpgrades.primaryHit(e, g.shots[0]);
  g.shiftUpgrades.primaryHit(a, g.shots[0]);
  g.shiftUpgrades.recoilDelta({ x: 0, y: 1 }, 1);
  assert.equal(count(g, 'polarity-rounds'), 1);
  assert.equal(count(g, 'gimbal-mount'), 1);
  clean(g);
});

test('checkpoint, Continue and completed history preserve detached native activation counts', () => {
  const g = new Game();
  const initial = testCheckpoint('activation-save', 6);
  initial.seed = 'RF-C108-activation-save';
  initial.mods = ['piston-lance'];
  g.start(initial.seed, initial);
  g.combatReport.activation('piston-lance', 1);
  let raw: unknown;
  g.onCheckpoint = (value) => {
    raw = value;
  };
  g.save();
  const save = loadCheckpoint(JSON.parse(JSON.stringify(raw)))!;
  assert.equal(save.combatResults?.activations?.['piston-lance'], 1);
  const resumed = new Game();
  resumed.start(save.seed, save);
  resumed.combatReport.activation('piston-lance', 1);
  assert.equal(count(resumed, 'piston-lance'), 2);
  assert.equal(save.combatResults?.activations?.['piston-lance'], 1);
  resumed.setMode('won');
  const run = snapshotRun(resumed, 'native-activation')!;
  const restored = loadRunHistory(JSON.parse(JSON.stringify([run])))[0];
  assert.equal(restored.combatResults?.activations?.['piston-lance'], 2);
  resumed.combatReport.reset();
  assert.equal(restored.combatResults?.activations?.['piston-lance'], 2);
  const original = g.combatReport.snapshot();
  const privateRange = new Game();
  privateRange.startWorkshop(['piston-lance'], ['piston-lance']);
  privateRange.fireRound();
  assert.equal(count(privateRange, 'piston-lance'), 1);
  assert.deepEqual(g.combatReport.snapshot(), original);
  assert.equal(snapshotRun(privateRange, 'private'), null);
  clean(g);
  clean(resumed);
  clean(privateRange);
});

test('native Hot Wire counts energized pulses once across frames and requires a live beam/cable intersection', () => {
  const g = fixture(['cutting-torch', 'tether', 'hot-wire']);
  const a = target(g, 600),
    b = target(g, 800);
  g.tethers.link = { a, b, length: 200, until: 10, tension: 0 };
  const path = [
    { a: { x: 200, y: 300 }, b: { x: 800, y: 300 }, dir: { x: 1, y: 0 }, gain: 1, muzzle: true },
  ];
  for (let i = 0; i < 5; i++) g.shiftFusions.beamSample(path, 2, 101);
  assert.equal(count(g, 'hot-wire'), 1);
  g.shiftFusions.beamSample(path, 2, 102);
  assert.equal(count(g, 'hot-wire'), 2);
  g.tethers.link = null;
  g.shiftFusions.beamSample(path, 2, 103);
  assert.equal(count(g, 'hot-wire'), 2);
  clean(g);
});

test('Suspension retains the paid morph discharge identity while parked rounds later leave storage', () => {
  const g = fixture(['piston-lance', 'suspension', 'scatter']);
  g.fireRound();
  const first = [...g.shots];
  g.fireRound();
  const second = g.shots.filter((s) => !first.includes(s));
  assert.equal(count(g, 'piston-lance'), 2);
  assert(first.every((s) => s.stasis));
  g.shotCount += 10;
  for (const s of [...first, ...second]) {
    s.stasis!.phase = 'released';
    g.shiftMorphs.prepare(s);
    g.shiftMorphs.prepare(s);
  }
  assert.equal(count(g, 'piston-lance'), 2, 'released pellets cannot mint another morph discharge');
  clean(g);
});
