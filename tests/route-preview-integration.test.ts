import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { planFactory } from '../src/factory.ts';
import { newUprising } from '../src/uprising-model.ts';
import { dailyForDate } from '../src/daily.ts';
import { DETOUR_DOOR } from '../src/detours.ts';
import { FREIGHT } from '../src/freight-layout.ts';
import { loadCheckpoint, type Checkpoint, type RouteChoice } from '../src/rules.ts';
import { routePreviewTraits } from '../src/route-preview.ts';

function release(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function clear(g: Game) {
  for (const e of g.enemies) Matter.Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.areaEvents.clear();
  g.clear = true;
  g.clearAt = g.time - 1;
  g.hitStop = 0;
}
function source(seed: string, stage: number, extra: Partial<Checkpoint> = {}) {
  return {
    ...testCheckpoint(seed, stage),
    version: 6 as const,
    encounters: 1 as const,
    teamwork: 1 as const,
    ...extra,
  };
}
function door(g: Game, route: RouteChoice) {
  const floor = route === 'high' ? g.branchDoor.floor : g.level.freight ? FREIGHT.dock : 740;
  return { x: DETOUR_DOOR.x, y: floor - 32 };
}

test('resolved route previews match the actual accepted-upgrade destination in both mirrors', () => {
  for (const from of [5, 9])
    for (const route of ['low', 'high'] as const) {
      const mirrors = new Set<boolean>();
      for (let i = 0; i < 30 && mirrors.size < 2; i++) {
        const seed = 'RF-C101-PREVIEW-MATCH-' + i;
        const g = new Game();
        try {
          g.start(seed, source(seed, from));
          clear(g);
          const preview = g.createRoutePreview(route);
          assert(preview);
          mirrors.add(preview.level.mirrored);
          assert.equal(preview.stage, from + 1);
          assert.equal(preview.level.routeChoice, route);
          assert(preview.level.id.startsWith('route-'));
          g.openReward(false, route);
          assert.equal(g.mode, 'upgrade');
          g.chooseMod(g.offers[0].id);
          assert.equal(g.stage, from + 1);
          assert.equal(g.mode, 'playing');
          assert.deepEqual(preview.level, g.level);
          assert.deepEqual(preview.level.solids, g.level.solids);
          assert.deepEqual(preview.level.setpiece?.props, g.level.setpiece?.props);
        } finally {
          release(g);
        }
      }
      assert.equal(mirrors.size, 2);
    }
});

test('preview resolution preserves native security, factory and completed Uprising route rules', () => {
  for (const from of [5, 9])
    for (const variant of ['security', 'factory', 'uprising'] as const)
      for (const route of ['low', 'high'] as const) {
        const seed = 'RF-C101-PREVIEW-' + variant.toUpperCase();
        const cp = source(seed, from);
        if (variant === 'security') cp.security = { level: 3, rules: 1 };
        if (variant === 'factory') cp.factory = planFactory(seed, 4);
        if (variant === 'uprising') {
          const run = newUprising();
          run.choices = from === 5 ? ['rail-escape'] : ['rail-escape', 'core-sabotage'];
          run.outcomes = run.choices.map((id) => ({ route: id, result: 'success' as const }));
          cp.uprising = run;
        }
        const g = new Game();
        try {
          g.start(seed, cp);
          clear(g);
          const preview = g.createRoutePreview(route);
          assert(preview);
          g.openReward(false, route);
          assert.equal(g.mode, 'upgrade', variant + ' reward must remain enterable');
          g.chooseMod(g.offers[0].id);
          assert.equal(g.stage, from + 1);
          assert.deepEqual(preview.level, g.level, variant + ' ' + from + ' ' + route);
        } finally {
          release(g);
        }
      }
});

test('completed Core sabotage previews the actual shutdown Cooling machinery', () => {
  for (const from of [9])
    for (const route of ['low', 'high'] as const) {
      const seed = 'RF-C101-PREVIEW-SABOTAGE';
      const run = newUprising();
      run.choices = ['rail-escape', 'core-sabotage'];
      run.outcomes = run.choices.map((id) => ({ route: id, result: 'success' as const }));
      const cp = source(seed, from, { uprising: run });
      assert(loadCheckpoint(cp), 'the completed Core job must be a real valid Campaign checkpoint');
      const g = new Game();
      try {
        g.start(seed, cp);
        clear(g);
        const preview = g.createRoutePreview(route);
        assert(preview);
        assert.equal(preview.level.vents?.length ?? 0, 0);
        assert.equal(preview.level.coolant?.length ?? 0, 0);
        assert.equal(preview.level.fans?.length ?? 0, 0);
        const traits = routePreviewTraits(preview.level);
        assert(
          !traits.some((trait) => /vent|valve|coolant|fan|airflow/i.test(trait)),
          traits.join(' / '),
        );
        g.openReward(false, route);
        g.chooseMod(g.offers[0].id);
        assert.deepEqual(g.level, preview.level);
        assert.deepEqual(routePreviewTraits(g.level), traits);
      } finally {
        release(g);
      }
    }
});

test('only a cleared, active, nearby legal exit supplies one route preview', () => {
  const seed = 'RF-C101-PREVIEW-NEAR';
  const g = new Game();
  try {
    g.start(seed, source(seed, 5));
    Matter.Body.setPosition(g.player, door(g, 'low'));
    assert.equal(g.nearbyRoutePreview, null, 'live combat hides previews');
    clear(g);
    Matter.Body.setPosition(g.player, { x: 900, y: 700 });
    assert.equal(g.nearbyRoutePreview, null, 'a cleared room has no persistent route HUD');
    for (const route of ['low', 'high'] as const) {
      Matter.Body.setPosition(g.player, door(g, route));
      const preview = g.nearbyRoutePreview;
      assert(preview);
      assert.equal(preview.route, route);
      assert.equal(g.nearbyRoutePreview, preview, 'repeated frames use the same detached result');
    }
    const center = door(g, 'low');
    Matter.Body.setPosition(g.player, { x: center.x - 206, y: center.y });
    assert.equal(g.nearbyRoutePreview, null);
    Matter.Body.setPosition(g.player, center);
    for (const mode of ['paused', 'upgrade', 'dead', 'won', 'title'] as const) {
      g.mode = mode;
      assert.equal(g.nearbyRoutePreview, null, mode);
    }
    g.mode = 'playing';
    g.waves.reset(g.level);
    assert(g.waves.pending, 'the actual current room must have a reserve group');
    assert.equal(g.nearbyRoutePreview, null, 'pending reserve groups suppress the invitation');
    g.waves.clear();
    g.spawnEnemy('runner', 500, 723);
    assert.equal(g.nearbyRoutePreview, null, 'a late enemy suppresses the invitation');
  } finally {
    release(g);
  }
});

test('Daily, earlier Campaign, Overtime, Practice, Workshop, escape and Annex never acquire previews', () => {
  const daily = dailyForDate('2026-10-25')!;
  const cases: Checkpoint[] = [
    source('RF-C100-OLD', 5),
    source(daily.seed, 5),
    source('RF-C101-OT-TEST', 5, { overtime: { baseMods: 19, repairs: 0 } }),
    source('RF-C101-ANNEX', 9, { region: 'annex', annexVersion: 6 }),
  ];
  for (const cp of cases) {
    const g = new Game();
    try {
      g.start(cp.seed, cp);
      clear(g);
      Matter.Body.setPosition(g.player, door(g, 'low'));
      assert.equal(g.nearbyRoutePreview, null);
      assert.equal(g.createRoutePreview('low'), null);
    } finally {
      release(g);
    }
  }
  const seed = 'RF-C101-PREVIEW-GUARDS';
  for (const state of ['practice', 'workshop', 'escape', 'detour'] as const) {
    const g = new Game();
    try {
      g.start(seed, source(seed, 5));
      clear(g);
      Matter.Body.setPosition(g.player, door(g, 'low'));
      if (state === 'practice') g.practice = { kind: 'loader', seed };
      if (state === 'workshop') g.workshop.active = true;
      if (state === 'escape') g.escape = { phase: 'route', time: 0, depart: 0 };
      if (state === 'detour') g.detour = true;
      assert.equal(g.nearbyRoutePreview, null, state);
      assert.equal(g.createRoutePreview('low'), null, state);
    } finally {
      release(g);
    }
  }
});

test('native previews cannot consume live RNG, write callbacks or keep an old room cache after restart', () => {
  const seed = 'RF-C101-PREVIEW-CACHE';
  const cp = source(seed, 5);
  const g = new Game();
  const control = new Game();
  try {
    g.start(seed, cp);
    control.start(seed, cp);
    clear(g);
    clear(control);
    let callbacks = 0;
    g.onCheckpoint = () => callbacks++;
    g.onEnemyEncountered = () => callbacks++;
    g.onCommendation = () => callbacks++;
    g.onCampaignClear = () => callbacks++;
    const before = g.checkpointSnapshot();
    const bodies = Matter.Composite.allBodies(g.engine.world).length;
    const low = g.createRoutePreview('low');
    const high = g.createRoutePreview('high');
    assert(low && high);
    assert.equal(g.createRoutePreview('low'), low);
    assert.equal(g.createRoutePreview('high'), high);
    assert.equal(callbacks, 0);
    assert.deepEqual(g.checkpointSnapshot(), before);
    assert.equal(Matter.Composite.allBodies(g.engine.world).length, bodies);
    for (let i = 0; i < 8; i++) assert.equal(g.rng(), control.rng());
    g.start(seed, cp);
    clear(g);
    const restarted = g.createRoutePreview('low');
    assert(restarted);
    assert.notEqual(restarted, low);
    assert.deepEqual(restarted.level, low.level);
  } finally {
    release(g);
    release(control);
  }
});
