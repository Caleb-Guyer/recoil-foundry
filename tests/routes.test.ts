import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getRouteLevel, reinforceRoute } from '../src/route-layouts.ts';
import { getLevel } from '../src/levels.ts';
import type { Solid } from '../src/levels.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { loadCheckpoint, dailyRoute, getGun } from '../src/rules.ts';
import type { Checkpoint, RouteChoice, Vec } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { routesTestFromUrl, testCheckpoint } from '../src/practice.ts';
import { hazardBounds } from '../src/hazard-layouts.ts';
import { propPlacements } from '../src/props.ts';
import { FREIGHT } from '../src/freight-layout.ts';
const { Body, Composite, Query } = Matter;
const stages = [2, 6, 10, 14, 18];
const choices: RouteChoice[] = ['low', 'high'];
const overlap = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.1 && a.x < b.x + b.w - 0.1 && a.y + a.h > b.y + 0.1 && a.y < b.y + b.h - 0.1;
function tick(g: Game, extra = {}) {
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: 1000, y: 400 },
    ...extra,
  });
}
function clear(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.clearAt = g.time - 1;
  g.hitStop = 0;
}
function saveOf(g: Game): Checkpoint {
  let save: Checkpoint | null = null;
  g.onCheckpoint = (s) => (save = s);
  g.save();
  assert(save);
  return save;
}
function walk(g: Game, path: Vec[], land = false) {
  let index = 0,
    previous = g.player.position.x,
    stuck = 0;
  for (let i = 0; i < 3600 && g.mode === 'playing' && index < path.length; i++) {
    const p = g.player.position,
      t = path[index],
      dx = t.x - p.x,
      dy = p.y - t.y;
    if (Math.abs(dx) < 22 && Math.abs(dy) < (land ? 8 : 40) && (!land || g.grounded)) {
      index++;
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
  assert(
    index === path.length || g.mode === 'upgrade',
    g.level.id +
      ' ' +
      g.seed +
      ' waypoint ' +
      index +
      ' target ' +
      JSON.stringify(path[index]) +
      ' at ' +
      JSON.stringify(g.player.position) +
      ' grounded ' +
      g.grounded,
  );
}

test('ten route rooms repeat independently, keep safe anchors and distinguish ground and air pressure', () => {
  const ids = new Set<string>(),
    mirrors = new Set<boolean>();
  for (const stage of stages)
    for (const choice of choices)
      for (let n = 0; n < 12; n++) {
        const seed = 'routes-' + n;
        const l = getRouteLevel(seed, stage, choice);
        ids.add(l.id);
        mirrors.add(l.mirrored);
        assert.deepEqual(getRouteLevel(seed, stage, choice), l);
        assert(!l.boss && !l.detour && !l.freight);
        assert.equal(l.routeChoice, choice);
        assert(l.route[0].x < l.route.at(-1)!.x);
        assert(l.solids.every((s) => s.x >= 240 && s.x + s.w <= 1760));
        for (const level of [l, reinforceRoute(l, seed, stage)]) {
          for (const spawn of level.spawns) {
            const { w, h } = ENEMY_STATS[spawn.kind];
            const hull = { x: spawn.x - w / 2, y: spawn.y - h / 2, w, h };
            assert(spawn.x >= 380 && spawn.x <= 1720);
            assert(
              !level.solids.some((s) => overlap(s, hull)),
              level.id + ' spawn ' + JSON.stringify(spawn),
            );
            if (!['flyer', 'skimmer', 'sifter'].includes(spawn.kind))
              assert(
                Math.abs(spawn.y + h / 2 - 740) < 2 ||
                  level.solids.some(
                    (s) =>
                      Math.abs(s.y - spawn.y - h / 2) < 2 &&
                      s.x < spawn.x - w / 2 &&
                      s.x + s.w > spawn.x + w / 2,
                  ),
              );
          }
          assert(level.spawns.filter((s) => s.kind === 'harpooner').length <= 1);
        }
        const air = l.spawns.filter((s) => ['flyer', 'skimmer', 'sifter'].includes(s.kind)).length;
        assert(choice === 'high' ? air >= l.spawns.length - 4 : air <= 2);
        if (choice === 'low')
          assert(
            propPlacements(l, seed).filter((p) => p.kind !== 'canister').length >= 2,
            l.id + ' needs breakable cover',
          );
      }
  assert.equal(ids.size, 10);
  assert.equal(mirrors.size, 2);
  assert.throws(() => getRouteLevel('x', 3, 'high'), RangeError);
});

test('both roads can be crossed in either direction with the base gun and ordinary jumps', () => {
  for (const stage of stages)
    for (const choice of choices)
      for (const seed of ['routes-0', 'routes-1'])
        for (const reverse of [false, true]) {
          const g = new Game();
          g.start(seed, { ...testCheckpoint(seed, stage), route: choice });
          clear(g);
          g.mods = [];
          g.gun = getGun([]);
          for (const p of [...g.props.items]) g.props.remove(p);
          g.hazards.clear();
          g.breaches.clear();
          g.conveyors.clear();
          Body.setPosition(g.player, { x: reverse ? 1820 : 140, y: 680 });
          walk(g, [
            ...(reverse ? [...g.level.route].reverse() : g.level.route),
            { x: reverse ? 120 : 1930, y: 720 },
          ]);
          assert.equal(g.hp, 100);
        }
});

test('route exits require a cleared room; both pay one identical reward and rejoin the same boss', () => {
  for (const stage of stages) {
    const offers: string[][] = [];
    for (const choice of choices) {
      const g = new Game(),
        seed = 'route-rewards';
      g.start(seed, testCheckpoint(seed, stage - 1));
      assert(g.canChooseRoute);
      assert(!g.canDetour);
      assert(!g.canOvertime);
      g.openReward(false, choice);
      assert.equal(g.mode, 'playing');
      clear(g);
      g.hp = 60;
      g.openReward(false, choice);
      offers.push(g.offers.map((m) => m.id));
      assert.equal(g.enteringRoute, choice);
      const id = g.offers[0].id;
      g.chooseMod(id);
      g.chooseMod(id);
      assert.equal(g.stage, stage);
      assert.equal(g.hp, 72);
      assert.equal(g.mods.length, stage);
      assert.equal(g.level.routeChoice, choice);
      assert.equal(g.enteringRoute, null);
      const save = saveOf(g);
      assert(loadCheckpoint(save));
      const continued = new Game();
      continued.start(seed, loadCheckpoint(save)!);
      assert.deepEqual(continued.level, g.level);
      assert.deepEqual(continued.gun, g.gun);
      clear(g);
      g.openReward();
      g.chooseMod(g.offers[0].id);
      assert(g.level.boss);
      assert.equal(g.stage, stage + 1);
      assert.equal(g.route, null);
      assert(loadCheckpoint(saveOf(g)));
    }
    assert.deepEqual(offers[0], offers[1]);
  }
});

test('the actual lower exit and upper steps select different routes, including the freight dock', () => {
  for (const seed of ['route-doors', 'FREIGHT-RIDE-2'])
    for (const choice of choices) {
      const g = new Game();
      const stage = seed.startsWith('FREIGHT') ? 5 : 1;
      g.start(seed, testCheckpoint(seed, stage));
      clear(g);
      for (const p of [...g.props.items]) g.props.remove(p);
      const floor = g.level.freight ? FREIGHT.dock : 740;
      Body.setPosition(g.player, { x: 1725, y: floor - 18 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      g.extendDetourSteps();
      assert(g.detourStepsReady);
      walk(
        g,
        choice === 'high'
          ? [
              { x: 1828, y: g.branchSteps[0].y - 18 },
              { x: 1930, y: g.branchDoor.floor - 18 },
            ]
          : [{ x: 1930, y: floor - 18 }],
        choice === 'high',
      );
      for (let i = 0; i < 60 && g.mode === 'playing'; i++) tick(g);
      assert.equal(g.mode, 'upgrade');
      assert.equal(g.enteringRoute, choice);
    }
});

test('Daily fixes a single route per fork, rejects the other route, and preserves one reward', () => {
  const seen = new Set<RouteChoice>();
  for (let day = 10; day < 15; day++)
    for (const stage of stages) {
      const seed = dailyForDate('2026-09-' + day)!.seed,
        g = new Game();
      g.start(seed, testCheckpoint(seed, stage - 1));
      const route = dailyRoute(seed, stage);
      seen.add(route);
      assert.deepEqual(g.routeChoices, [route]);
      assert(!g.canBranch);
      clear(g);
      g.extendDetourSteps();
      assert(!g.detourStepsReady);
      g.openReward(false, route === 'low' ? 'high' : 'low');
      assert.equal(g.mode, 'playing');
      g.openReward();
      assert.equal(g.offers.length, 1);
      g.chooseMod(g.offers[0].id);
      assert.equal(g.route, route);
      assert(loadCheckpoint(saveOf(g)));
      assert.equal(loadCheckpoint({ ...saveOf(g), route: route === 'low' ? 'high' : 'low' }), null);
    }
  assert.equal(seen.size, 2);
});

test('route saves validate, old ordinary saves keep their layouts, and detours clear route state', () => {
  const seed = 'route-save',
    original = testCheckpoint(seed, 6),
    g = new Game();
  g.start(seed, original);
  assert.deepEqual(g.level, getLevel(seed, 6));
  for (const patch of [
    { route: 'bad' },
    { route: null },
    { route: 'high', stage: 3 },
    { route: 'low', detour: true },
    { route: 'low', version: 4 },
  ])
    assert.equal(loadCheckpoint({ ...original, ...patch }), null);
  g.start(seed, { ...original, route: 'high' });
  clear(g);
  g.openReward(true);
  g.chooseMod(g.offers[0].id);
  assert(g.detour);
  assert.equal(g.route, null);
  assert(loadCheckpoint(saveOf(g)));
  clear(g);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 7);
  assert.deepEqual(g.detours, [1]);
  assert(loadCheckpoint(saveOf(g)));
  g.start('fresh');
  assert.equal(g.route, null);
  assert.equal(g.enteringRoute, null);
});

test('route test links isolate saves and retries, support all areas and Overtime, and reject conflicts', () => {
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'])
    for (const route of ['', 'low', 'high'])
      for (const mode of ['normal', 'overtime']) {
        const save = routesTestFromUrl(
          new URL(
            'https://example.com/?test=routes&area=' +
              area +
              '&mode=' +
              mode +
              (route ? '&route=' + route : ''),
          ),
        )!;
        assert(save);
        assert(loadCheckpoint(save), JSON.stringify(save));
        const g = new Game();
        let writes = 0,
          unlocks = 0;
        g.onCheckpoint = () => writes++;
        g.onBossDefeated = () => unlocks++;
        g.startTest(save);
        const first = structuredClone(g.level);
        if (route) assert.equal(g.level.routeChoice, route);
        else assert(g.canChooseRoute);
        clear(g);
        g.openReward();
        g.chooseMod(g.offers[0].id);
        g.startTest(g.testRun!);
        assert.deepEqual(g.level, first);
        assert.equal(writes, 0);
        assert.equal(unlocks, 0);
        assert.equal(g.hp, 100);
      }
  for (const query of [
    'test=routes&route=x',
    'test=routes&area=x',
    'test=routes&route=low&route=high',
    'test=routes&daily=2026-09-11',
    'test=routes&seed=x',
    'test=routes&mode=x',
    'test=routes&test=routes',
  ])
    assert.equal(routesTestFromUrl(new URL('https://example.com/?' + query)), null);
});

test('route room machinery and props reserve all wave entrances after complete world assembly', () => {
  for (const stage of stages)
    for (const route of choices)
      for (let n = 0; n < 8; n++) {
        const seed = 'routes-world-' + n,
          g = new Game();
        g.start(seed, { ...testCheckpoint(seed, stage), route });
        if (route === 'low') assert(g.props.items.filter((p) => p.kind !== 'canister').length >= 2);
        for (const s of g.level.spawns) {
          const { w, h } = ENEMY_STATS[s.kind],
            hull = { x: s.x - w / 2, y: s.y - h / 2, w, h };
          for (const hazard of g.hazards.items)
            assert(!overlap(hazardBounds(hazard.placement), hull), g.level.id + ' hazard spawn');
          for (const prop of g.props.items)
            assert(
              !overlap(
                {
                  x: prop.body.bounds.min.x,
                  y: prop.body.bounds.min.y,
                  w: prop.body.bounds.max.x - prop.body.bounds.min.x,
                  h: prop.body.bounds.max.y - prop.body.bounds.min.y,
                },
                hull,
              ),
              g.level.id + ' prop spawn',
            );
        }
      }
});
