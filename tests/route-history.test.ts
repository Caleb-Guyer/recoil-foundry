import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { uprisingMap } from '../src/uprising-menu.ts';
import { CHECKPOINT_KEY, ProgressStore, parseProgressBackup } from '../src/progress.ts';
import {
  chooseRouteCampaign,
  loadRouteHistory,
  recordRouteDecision,
  routeHistoryMarkup,
  ROUTE_DECISION_STAGES,
  type RouteDecision,
} from '../src/route-history.ts';
const seed = 'RF-C101-ROUTE-HISTORY';
const history: RouteDecision[] = [
  { stage: 2, route: 'low' },
  { stage: 6, route: 'high' },
];
const checkpoint = (stage = 6): Checkpoint => ({
  ...testCheckpoint(seed, stage),
  version: 6,
  route: stage % 4 === 2 ? 'high' : undefined,
  routeHistory: history.filter((entry) => entry.stage <= stage).map((entry) => ({ ...entry })),
});
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function clear(g: Game) {
  for (const enemy of g.enemies) Matter.Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
}

test('route history belongs only to new Campaigns and never infers missing decisions', () => {
  assert(chooseRouteCampaign(seed));
  assert(chooseRouteCampaign('RF-C102-FUTURE'));
  for (const old of [
    'RF-C100-X',
    'RF-C99-X',
    'RF-D101-2026-10-25',
    'custom',
    null,
    101,
    {},
    { toString: 3 },
  ]) {
    assert(!chooseRouteCampaign(old));
    assert.equal(loadRouteHistory(history, old, 19), null);
    assert.deepEqual(loadRouteHistory(undefined, old, 19), []);
  }
  assert.deepEqual(loadRouteHistory([], seed, 19), []);
  assert.deepEqual(loadRouteHistory([{ stage: 14, route: 'high' }], seed, 15), [
    { stage: 14, route: 'high' },
  ]);
});

test('commits remain bounded, ordered, immutable and cannot be overwritten by duplicate callbacks', () => {
  let entries: RouteDecision[] = [];
  for (const stage of ROUTE_DECISION_STAGES) entries = recordRouteDecision(entries, stage, 'high');
  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map((entry) => entry.stage),
    ROUTE_DECISION_STAGES,
  );
  const copy = recordRouteDecision(entries, 18, 'low');
  assert.deepEqual(copy, entries);
  assert.notEqual(copy, entries);
  assert.notEqual(copy[0], entries[0]);
  assert.deepEqual(recordRouteDecision(history, 6, 'low'), history);
  assert.deepEqual(recordRouteDecision(history, 4, 'high'), history);
  assert.deepEqual(recordRouteDecision(history, 2, 'low'), history);
});

test('imports reject malformed, unordered, duplicate and future route entries', () => {
  for (const value of [
    null,
    {},
    'low',
    [null],
    [[]],
    [{ stage: '2', route: 'low' }],
    [{ stage: 2.5, route: 'low' }],
    [{ stage: 3, route: 'low' }],
    [{ stage: 2, route: true }],
    [{ stage: 2, route: 'middle' }],
    [{ stage: 2, route: 'low', unexpected: 1 }],
    [
      { stage: 2, route: 'low' },
      { stage: 2, route: 'high' },
    ],
    [
      { stage: 6, route: 'high' },
      { stage: 2, route: 'low' },
    ],
    [...history, ...history, ...history],
  ])
    assert.equal(loadRouteHistory(value, seed, 19), null, JSON.stringify(value));
  assert.equal(loadRouteHistory(history, seed, 5), null);
  assert.equal(loadRouteHistory(history, seed, NaN), null);
  assert.equal(loadRouteHistory(history, seed, '6'), null);
  assert.equal(loadRouteHistory(history, seed, 20), null);
  const loaded = loadRouteHistory(history, seed, 6)!;
  assert.deepEqual(loaded, history);
  loaded[0].route = 'high';
  assert.equal(history[0].route, 'low');
});

test('the original Campaign history survives Overtime without recording a new lap', () => {
  const full = ROUTE_DECISION_STAGES.map((stage) => ({ stage, route: 'low' as const }));
  assert.deepEqual(loadRouteHistory(full, seed, 0, true), full);
  assert.equal(loadRouteHistory(full, seed, 0, false), null);
  assert.deepEqual(recordRouteDecision(full, 2, 'high'), full);
});

test('checkpoint validation accepts honest optional history and rejects unsupported/future imports', () => {
  const valid = checkpoint();
  assert(loadCheckpoint(valid));
  assert.deepEqual(loadCheckpoint(valid)!.routeHistory, history);
  for (const change of [
    { version: 5 },
    { seed: 'RF-C100-HISTORY' },
    { seed: 'RF-D101-2026-10-25' },
    { seed: { toString: 3 } },
    { routeHistory: [{ stage: 10, route: 'high' }] },
    { routeHistory: null },
    { route: 'low' },
  ])
    assert.equal(loadCheckpoint({ ...valid, ...change }), null);
  const absent = { ...valid };
  delete absent.routeHistory;
  assert(loadCheckpoint(absent));
  assert.equal(loadCheckpoint(absent)!.routeHistory, undefined);
});

test('only an accepted real route reward records a choice and Continue preserves that choice', () => {
  for (const destination of [2, 6, 10, 14, 18])
    for (const route of ['low', 'high'] as const) {
      const g = new Game();
      const cp = { ...testCheckpoint(seed, destination - 1), version: 6 as const };
      g.start(seed, cp);
      clear(g);
      g.openReward(false, route);
      assert.equal(g.mode, 'upgrade');
      assert.deepEqual(g.routeHistory, [], 'opening a draft is not a committed route');
      g.chooseMod('not-an-offer');
      assert.deepEqual(g.routeHistory, []);
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, destination);
      assert.deepEqual(g.routeHistory, [{ stage: destination, route }]);
      const saved = loadCheckpoint(JSON.parse(JSON.stringify(g.checkpointSnapshot())));
      assert(saved);
      const continued = new Game();
      continued.start(saved.seed, saved);
      assert.deepEqual(continued.routeHistory, g.routeHistory);
      assert.equal(continued.route, route);
      assert.deepEqual(continued.level, g.level);
      clean(g);
      clean(continued);
    }
});

test('atomic progress export/import preserves route history without reconstructing absent past', async () => {
  class Disk {
    values = new Map<string, string>();
    getItem(key: string) {
      return this.values.get(key) ?? null;
    }
    setItem(key: string, value: string) {
      this.values.set(key, value);
    }
    removeItem(key: string) {
      this.values.delete(key);
    }
  }
  const disk = new Disk();
  const store = new ProgressStore(() => disk);
  assert(await store.write(CHECKPOINT_KEY, checkpoint()));
  const backup = parseProgressBackup(store.backup('5.21.0'));
  const otherDisk = new Disk();
  const other = new ProgressStore(() => otherDisk);
  assert(await other.restore(backup));
  assert.deepEqual(loadCheckpoint(other.read(CHECKPOINT_KEY))!.routeHistory, history);
  const unknown = checkpoint();
  delete unknown.routeHistory;
  assert(await store.write(CHECKPOINT_KEY, unknown));
  const noHistory = parseProgressBackup(store.backup('5.21.0'));
  assert.equal(loadCheckpoint(noHistory.values[CHECKPOINT_KEY])!.routeHistory, undefined);
});

test('Campaign progress renders only recorded decisions behind the existing collapsed map', () => {
  assert.equal(routeHistoryMarkup([]), '');
  const markup = routeHistoryMarkup(history);
  assert(markup.includes('<details class="route-history">'));
  assert(markup.includes('Room 3 · Docks'));
  assert(markup.includes('Room 7 · Furnace'));
  assert(markup.includes('Low route'));
  assert(markup.includes('High route'));
  assert(!markup.includes('Room 11'));
  const game = { stage: 6, uprising: { run: null }, routeHistory: history } as unknown as Game;
  assert.equal(uprisingMap(game), markup);
  assert.equal(uprisingMap({ ...game, routeHistory: [] } as Game), '');
});

test('Overtime explicitly scopes retained routes to the first Campaign inside the collapsed history', () => {
  const original = routeHistoryMarkup(history);
  assert(!original.includes('this lap'));
  const overtime = routeHistoryMarkup(history, true);
  assert(overtime.includes('Routes from your first Campaign; this lap is not recorded.'));
  assert(overtime.indexOf('<details') < overtime.indexOf('Routes from your first Campaign'));
  const game = {
    stage: 0,
    uprising: { run: null },
    routeHistory: history,
    overtime: { baseMods: 19, repairs: 0 },
  } as unknown as Game;
  assert.equal(uprisingMap(game), overtime);
  assert.equal(routeHistoryMarkup([], true), '');
});
