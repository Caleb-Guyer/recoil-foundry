import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { SHIFT_MODS, isShiftMod } from '../src/shift-catalog.ts';
import { withParents } from '../src/branch-builds.ts';
import { loadUnlocks } from '../src/longevity.ts';
import { MODS, loadCheckpoint, rewardMods, seeded, type Checkpoint } from '../src/rules.ts';
import { factoryUnboundTestFromUrl } from '../src/factory-unbound-test.ts';

function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}

test('every new fitting can be picked from its legal native pool and resumed as an ordinary Campaign', () => {
  for (const { id } of SHIFT_MODS) {
    const parents = withParents([], [id]);
    assert(parents);
    const mods = parents.filter((m) => m !== id);
    const cp: Checkpoint = {
      version: 6,
      seed: 'RF-C107-REVIEW-' + id.slice(0, 18),
      stage: 10,
      mods,
      hp: 100,
      kills: 0,
      elapsed: 0,
      detours: [],
      missedUpgrades: 10 - mods.length,
      unlocks: loadUnlocks([...mods, id]),
    };
    assert(loadCheckpoint(cp), id + ': legal prerequisite checkpoint');
    const g = new Game();
    g.start(cp.seed, cp);
    g.setMode('upgrade');
    // Exercise fitting and Continue boundaries, not a simulated room victory.
    g.clear = true;
    const pool = rewardMods(g.mods, MODS.length, seeded('native-review'), {
      stage: g.stage,
      seed: g.seed,
      unlocks: g.unlocks,
    });
    const offered = pool.find((m) => m.id === id);
    assert(offered, id + ': normal current ruleset pool');
    g.offers = [offered];
    g.chooseMod(id);
    assert(g.mods.includes(id), id + ': native fitting selection');
    assert.equal(g.stage, 11);
    const saved = loadCheckpoint(JSON.parse(JSON.stringify(g.checkpointSnapshot())));
    assert(saved, id + ': valid Continue after the fitting');
    assert.equal(saved.factoryUnbound, undefined);
    const h = new Game();
    h.start(saved.seed, saved);
    assert.deepEqual(h.mods, g.mods);
    assert.equal(h.stage, g.stage);
    assert.equal(h.testRun, null);
    clean(g);
    clean(h);
  }
});

test('archived Campaign and Daily pools cannot receive the new fittings, and room one stays free of new service mechanics', () => {
  for (const seed of ['RF-C106-ARCHIVED-REVIEW', 'RF-D90-2026-10-25'])
    for (const { id } of SHIFT_MODS) {
      const parents = withParents([], [id])!.filter((m) => m !== id);
      const pool = rewardMods(parents, MODS.length, seeded('archive-review'), {
        stage: 18,
        seed,
        unlocks: loadUnlocks(parents),
      });
      assert(!pool.some((m) => isShiftMod(m.id)), seed + ': archived draft pool');
    }
  for (let n = 0; n < 12; n++) {
    const g = new Game();
    g.start('RF-C107-CALM-REVIEW-' + n);
    assert.equal(g.stage, 0);
    assert(!g.shiftRun.junction);
    assert.equal(g.shiftRun.circuit, null);
    assert.equal(g.shiftRun.leasedMorph, null);
    assert.equal(g.shiftRun.state?.experiment, undefined);
    assert.deepEqual(g.shiftRoutes.choices(), []);
    assert.equal(g.shiftRoutes.active, false);
    assert.equal(g.areaEvents.active, null);
    assert(!g.mods.some(isShiftMod));
    clean(g);
  }
});

test('Transport shafts stay clear of every saved rotor and mirror orientation throughout their real travel', () => {
  for (const scene of ['turntable-works', 'prism-glassworks'] as const)
    for (let turn = 0; turn < 4; turn++) {
      const fixture = factoryUnboundTestFromUrl(
        new URL('https://test/?test=factory-unbound&scene=' + scene + '&v=1'),
      );
      assert(fixture?.checkpoint.shiftRoute);
      const cp = fixture.checkpoint;
      if (scene === 'turntable-works') cp.shiftRoute!.turns = [turn, turn];
      else cp.shiftRoute!.mirrors = [turn, turn, turn];
      const g = new Game();
      g.startTest(cp);
      assert(g.shiftRun.chooseCircuit('transport'));
      for (let frame = 0; frame < 485; frame++) {
        g.hazards.beforeStep(1 / 60);
        for (const h of g.hazards.items.filter((h) => h.permanent))
          assert.equal(
            Matter.Query.collides(
              h.body,
              g.terrain.filter((b) => b !== h.body),
            ).length,
            0,
            scene +
              ' orientation ' +
              turn +
              ': powered device clips physical route terrain at step ' +
              frame,
          );
      }
      clean(g);
    }
});

function nativeJunction() {
  for (let n = 0; n < 24; n++) {
    const cp = testCheckpoint('RF-C107-SHIFT-RUN-' + n, 6);
    cp.version = 6;
    const g = new Game();
    g.start(cp.seed, cp);
    if (g.shiftRun.junction && g.shiftRun.leaseChoices().length) return g;
    clean(g);
  }
  throw new Error('No native service junction in the bounded review seeds');
}
function rewardBoundary(g: Game) {
  // Explicit lifecycle setup: this does not claim the patrol was played or beaten.
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hitStop = 0;
  g.clear = true;
  g.setMode('playing');
  g.shiftRun.roomCleared();
  g.openReward();
  assert.equal(g.mode, 'upgrade');
}

test('a ready experiment resolves before a due lease, and neither can be bypassed by fitting or reroll handlers', () => {
  const g = nativeJunction(),
    s = g.shiftRun;
  assert(s.openOffice());
  const morph = s.leaseChoices()[0];
  assert(s.borrow(morph));
  assert(s.beginExperiment('ricochet-harness'));
  s.closeOffice();
  rewardBoundary(g);
  assert.equal(s.state!.lease!.cleared.length, 1);
  g.chooseMod(
    g.offers.find(
      (m) => !['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'].includes(m.id),
    )!.id,
  );
  assert.equal(g.stage, 7);
  for (let n = 0; n < 3; n++) s.progress('rebound');
  rewardBoundary(g);
  assert(s.leaseDue && s.evolutionDue);
  const count = g.mods.length,
    stage = g.stage,
    offers = g.offers.map((m) => m.id);
  g.chooseMod(offers[0]);
  assert.equal(g.stage, stage);
  assert.equal(g.mods.length, count);
  assert(!g.canReroll && !g.rerollReward());
  assert.equal(s.keepLease(), false);
  assert(s.state!.lease, 'keep cannot destroy a pending loan while evolution is unresolved');
  assert(s.evolve('double-return'));
  assert(!s.evolutionDue && s.leaseDue);
  g.chooseMod(offers[0]);
  assert.equal(g.stage, stage);
  assert(s.keepLease());
  assert.equal(g.stage, stage + 1);
  assert.equal(g.mods.length, count + 1);
  assert(g.mods.includes(morph));
  assert.equal(s.leasedMorph, null);
  assert(s.hasEvolution('double-return'));
  const cp = loadCheckpoint(g.checkpointSnapshot());
  assert(cp);
  const h = new Game();
  h.start(cp.seed, cp);
  assert(h.shiftRun.hasEvolution('double-return'));
  assert.equal(h.shiftRun.leasedMorph, null);
  clean(g);
  clean(h);
});

test('a ready evolution leaves a real courier payment selectable before the compulsory normal reward choice', () => {
  const cp: Checkpoint = { ...testCheckpoint('RF-C107-SIDE-REVIEW', 8), version: 6, detours: [] };
  cp.mods.push('ricochet-harness');
  cp.shiftRun = {
    version: 1,
    routes: [],
    powers: [],
    leases: [],
    paid: [],
    grants: ['ricochet-harness'],
    freeRerolls: 0,
    repairs: [],
    experiment: { id: 'ricochet-harness', progress: 3, status: 'ready' },
  };
  assert(loadCheckpoint(cp));
  const g = new Game();
  g.start(cp.seed, cp);
  // Resume the native collected-cargo payment boundary, without a combat-win claim.
  g.courier.state = { stage: 8, status: 'collected' };
  rewardBoundary(g);
  assert(g.courierReward);
  assert(g.shiftRun.experimentReady && !g.shiftRun.evolutionDue);
  assert(loadCheckpoint(g.checkpointSnapshot()));
  const count = g.mods.length,
    pick = g.offers[0].id;
  g.chooseMod(pick);
  assert.equal(g.mods.length, count + 1);
  assert.equal(g.stage, 8);
  assert.equal(g.courier.state.status, 'claimed');
  assert(!g.courierReward && g.shiftRun.evolutionDue);
  assert(loadCheckpoint(g.checkpointSnapshot()));
  g.chooseMod(g.offers[0].id);
  assert.equal(
    g.mods.length,
    count + 1,
    'the subsequent normal reward must wait for its evolution',
  );
  assert(g.shiftRun.evolve('impact-echo'));
  g.chooseMod(g.offers[0].id);
  assert.equal(g.mods.length, count + 2);
  assert.equal(g.stage, 9);
  assert(loadCheckpoint(g.checkpointSnapshot()));
  clean(g);
});

test('the dedicated freight crossing keeps its train lane and does not consume an ordinary powered-room charge', () => {
  const cp: Checkpoint = { ...testCheckpoint('RF-C107-CROSS-REVIEW-30', 13), version: 6 };
  cp.shiftRun = {
    version: 1,
    routes: [],
    powers: [10],
    leases: [],
    paid: [],
    grants: [],
    freeRerolls: 0,
    repairs: [],
    circuit: { kind: 'transport', rooms: [10, 12] },
  };
  assert(loadCheckpoint(cp));
  const g = new Game();
  g.start(cp.seed, cp);
  assert(g.level.crossing && g.crossing.active);
  assert.equal(g.shiftRun.circuit, null);
  assert.deepEqual(g.shiftRun.state!.circuit!.rooms, [10, 12]);
  assert(!g.hazards.items.some((h) => h.permanent));
  assert(!g.pressure.items.some((p) => p.overpressure));
  assert.equal(g.shiftRun.shutter, null);
  assert.equal(g.shiftRun.lamp, null);
  assert(loadCheckpoint(g.checkpointSnapshot()));
  clean(g);
});

test('malformed route checkpoint seeds are rejected without crashing title-screen progress loading', () => {
  const fixture = factoryUnboundTestFromUrl(
    new URL('https://test/?test=factory-unbound&scene=vacuum-docks&v=1'),
  );
  assert(fixture);
  const cp = { ...fixture.checkpoint, seed: 'RF-C107-SAVE-REVIEW' };
  delete cp.factoryUnbound;
  assert(loadCheckpoint(cp));
  for (const seed of [null, undefined, 42, {}, [], true]) {
    let loaded: Checkpoint | null = cp;
    assert.doesNotThrow(() => {
      loaded = loadCheckpoint({ ...cp, seed });
    });
    assert.equal(loaded, null);
  }
});
