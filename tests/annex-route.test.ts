import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { readFileSync } from 'node:fs';
import { Game, type Input } from '../src/game.ts';
import { annexRouteLevel, annexRouteTestFromUrl, ANNEX_ROUTE_ROOMS } from '../src/annex-route.ts';
import { dailyRegion, type RegionChoice } from '../src/regions.ts';
import { dailyForDate } from '../src/daily.ts';
import { getGun, loadCheckpoint, validBuild, type Checkpoint, type Vec } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { testCheckpoint } from '../src/practice.ts';
import { recordLogbook, loadLogbook, logbookEntries, migrateLogbook } from '../src/logbook.ts';
import { snapshotRun } from '../src/run-history.ts';
import { playCampaign } from './campaign-pilot.ts';
import { playRoom } from './room-pilot.ts';
import { drawDetourDoor } from '../src/detour-art.ts';
import { drawRegionExits } from '../src/route-art.ts';

const { Body, Composite, Query } = Matter;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function preset(room = 'fork', mirror = false) {
  return annexRouteTestFromUrl(
    new URL(`https://example.test/?test=annex-route&room=${room}&mirror=${mirror ? 1 : 0}`),
  )!;
}
function clear(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.clearAt = g.time - 1;
  g.hitStop = 0;
}
function saveOf(g: Game) {
  let save: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  return save;
}
function realGame(room = 'broadcast') {
  const s = preset(room);
  delete s.annexRouteTest;
  const g = new Game();
  g.start(s.seed, s);
  return g;
}
function walk(g: Game, path: Vec[]) {
  let index = 0,
    previous = g.player.position.x,
    stuck = 0;
  for (let i = 0; i < 3600 && g.mode === 'playing' && index < path.length; i++) {
    const p = g.player.position,
      t = path[index],
      dx = t.x - p.x,
      dy = p.y - t.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 12 && g.grounded) {
      index++;
      continue;
    }
    stuck = Math.abs(p.x - previous) < 0.4 ? stuck + 1 : 0;
    previous = p.x;
    const move = dx > 8 ? 1 : dx < -8 ? -1 : 0;
    const blocked =
      move && Query.ray(g.solidBodies, p, { x: p.x + move * 50, y: p.y }, 24).length > 0;
    g.tick(1 / 60, {
      ...idle,
      left: move < 0,
      right: move > 0,
      jump: g.grounded && (dy > 45 || !!blocked || stuck > 12),
    });
  }
  assert(
    index === path.length || g.mode === 'upgrade',
    `${g.level.id} waypoint ${index}: ${JSON.stringify(g.player.position)} -> ${JSON.stringify(path[index])}`,
  );
}
const overlap = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.1 && a.x < b.x + b.w - 0.1 && a.y + a.h > b.y + 0.1 && a.y < b.y + b.h - 0.1;

test('route presets are legal, isolated, strict, and start at the requested room', () => {
  for (const room of ANNEX_ROUTE_ROOMS)
    for (const mirror of [false, true]) {
      const p = preset(room, mirror);
      assert(loadCheckpoint(p), room + JSON.stringify(p));
      assert(validBuild(p.mods));
      const g = new Game();
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.startTest(p);
      assert.equal(g.stage, p.stage);
      assert.equal(g.annex.active, room !== 'fork');
      if (room !== 'fork') assert.equal(g.level.mirrored, mirror);
      else assert(g.clear && g.regionChoices.length === 2);
      g.save();
      assert.equal(writes, 0);
    }
  for (const suffix of [
    '&test=annex-route',
    '&room=nope',
    '&room=well&room=gallery',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-24',
    '&seed=foo',
    '&build=beam',
  ])
    assert.equal(
      annexRouteTestFromUrl(new URL('https://example.test/?test=annex-route' + suffix)),
      null,
    );
});

for (const stage of [8, 9, 10])
  for (const mirror of [false, true]) {
    test(`Annex ${stage} mirror=${mirror}: supported hulls, fixtures and safe approaches`, () => {
      const l = annexRouteLevel('layout', stage, mirror);
      assert.deepEqual(l, annexRouteLevel('layout', stage, mirror));
      assert.equal(l.spawns.length, stage);
      assert(l.solids.every((s) => s.x >= 180 && s.x + s.w <= 1820));
      assert(l.spawns.every((s) => s.x >= 340 && s.x <= 1660));
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !l.solids.some((b) => overlap(b, { x: s.x - w / 2, y: s.y - h / 2, w, h })),
          JSON.stringify(s),
        );
        if (s.kind !== 'flyer')
          assert(
            Math.abs(s.y + h / 2 - 740) < 2 ||
              l.solids.some(
                (b) =>
                  Math.abs(b.y - s.y - h / 2) < 2 && s.x - w / 2 > b.x && s.x + w / 2 < b.x + b.w,
              ),
          );
      }
      const j = l.annexStation!.junction;
      assert(l.solids.some((b) => b.y === l.annexStation!.mount && j.x > b.x && j.x < b.x + b.w));
      assert.equal(j.y + 42, l.annexStation!.mount);
      const port = l.annexStation!.port;
      assert(!l.solids.some((b) => overlap(b, { x: port.x - 22, y: port.y - 22, w: 44, h: 44 })));
    });
    test(`Annex ${stage} mirror=${mirror}: traversable in both directions with ordinary jumps`, () => {
      const g = new Game();
      g.startTest(preset(ANNEX_ROUTE_ROOMS[stage - 7], mirror));
      g.mods = [];
      g.gun = getGun([]);
      clear(g);
      // Traversal tests remove combat pressure, preserving crates, cover and all terrain.
      walk(g, g.level.route);
      walk(g, [...g.level.route].reverse());
      walk(g, [{ x: 140, y: 722 }]);
    });
  }

test('regional exits have one label each, without the unrelated Challenge door underneath', () => {
  const g = new Game();
  g.startTest(preset());
  const labels: string[] = [];
  const c = new Proxy(
    { fillText: (text: string) => labels.push(text) },
    {
      get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  drawDetourDoor(c, g);
  drawRegionExits(c, g);
  assert.deepEqual(labels, ['COOLING', 'ANNEX']);
});

test('both physical exits stay closed in combat; upper chooses Annex and lower Cooling', () => {
  for (const choice of ['cooling', 'annex'] as const) {
    const g = realGame('fork');
    assert(!g.clear && g.combatEnemyCount);
    g.openReward(false, undefined, choice);
    assert.equal(g.mode, 'playing');
    assert.equal(g.region, 'pending');
    clear(g);
    if (choice === 'annex') {
      g.extendDetourSteps();
      Body.setPosition(g.player, { x: 1690, y: 722 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      walk(g, [
        { x: 1828, y: 572 },
        { x: 1930, y: 442 },
      ]);
      for (let i = 0; i < 60 && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
    } else {
      Body.setPosition(g.player, { x: 1850, y: 722 });
      for (let i = 0; i < 120 && g.mode === 'playing'; i++)
        g.tick(1 / 60, { ...idle, right: true });
    }
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.region, choice);
    const s = saveOf(g);
    const resumed = new Game();
    resumed.start(s.seed, s);
    assert.equal(resumed.region, choice);
    assert.deepEqual(resumed.offers, g.offers);
    resumed.chooseMod(resumed.offers[0].id);
    assert.equal(resumed.stage, 8);
    assert.equal(resumed.annex.active, choice === 'annex');
  }
});

test('Annex preserves rewards, Continue, and room order, then rejoins the area boss', () => {
  let g = realGame();
  for (const stage of [8, 9, 10]) {
    assert.equal(g.stage, stage);
    assert(g.annex.active && !g.canChooseRoute && !g.canDetour);
    assert.equal(g.areaEvents.active, null);
    assert.equal(g.mutations.pending.length, 0);
    const room = g.level;
    const entered = saveOf(g);
    g = new Game();
    g.start(entered.seed, entered);
    assert.deepEqual(g.level, room);
    clear(g);
    g.openReward();
    assert.equal(g.mode, 'upgrade');
    assert.equal(g.offers.length, 3);
    if (stage === 8) assert(g.offers.some((m) => m.id === 'spoof'));
    const reward = saveOf(g);
    const offers = g.offers.map((m) => m.id);
    g = new Game();
    g.start(reward.seed, reward);
    assert.deepEqual(
      g.offers.map((m) => m.id),
      offers,
    );
    g.chooseMod(stage === 8 ? 'spoof' : g.offers[0].id);
    assert.equal(g.mods.length, stage + 1);
    assert.equal(g.factions.allies.length, 0);
    assert.equal(g.annex.transmission, null);
  }
  assert.equal(g.stage, 11);
  assert(g.level.boss && !g.annex.active);
  clear(g);
  g.openReward();
  g.chooseMod(g.offers[0].id);
  assert.equal(g.stage, 12);
  assert.equal(g.level.area, 'reclamation');
  assert(saveOf(g));
});

test('Spoof is optional, has no duplicate when owned, and rerolls remain legal', () => {
  for (const owned of [false, true]) {
    const g = realGame();
    if (owned) g.mods[g.mods.length - 1] = 'spoof';
    clear(g);
    g.openReward();
    assert.equal(g.offers.filter((m) => m.id === 'spoof').length, owned ? 0 : 1);
    const other = g.offers.find((m) => m.id !== 'spoof')!;
    g.chooseMod(other.id);
    assert.equal(g.stage, 9);
    assert.equal(g.mods.includes('spoof'), owned);
  }
  const g = realGame();
  clear(g);
  g.openReward();
  g.rerollReward();
  assert(saveOf(g));
});

test('Daily 80 fixes both regional choices, blocks the other, and forces one legal reward', () => {
  const seen = new Set<RegionChoice>();
  for (let day = 1; day <= 12; day++) {
    const seed = dailyForDate(`2026-09-${String(day).padStart(2, '0')}`)!.seed;
    const chosen = dailyRegion(seed)!;
    seen.add(chosen);
    const g = new Game();
    const s = { ...testCheckpoint(seed, 7), version: 6 as const, region: chosen };
    g.start(seed, s);
    assert.deepEqual(g.regionChoices, [chosen]);
    assert(!g.canBranch);
    clear(g);
    g.openReward(false, undefined, chosen === 'annex' ? 'cooling' : 'annex');
    assert.equal(g.mode, 'playing');
    g.openReward();
    assert.equal(g.offers.length, 1);
    g.chooseMod(g.offers[0].id);
    assert.equal(g.annex.active, chosen === 'annex');
    const save = saveOf(g),
      resumed = new Game();
    resumed.start(seed, save);
    assert.deepEqual(resumed.level, g.level);
    clear(g);
    g.openReward();
    assert.equal(g.offers.length, 1);
    if (chosen === 'annex' && !g.mods.includes('spoof')) assert.equal(g.offers[0].id, 'spoof');
    assert(saveOf(g));
  }
  assert.equal(seen.size, 2);
});

test('old saves keep their rooms, while malformed regional states are rejected', () => {
  for (const seed of ['legacy-normal', 'RF-D78-2026-09-24', 'RF-D79-2026-09-24']) {
    const s = testCheckpoint(seed, 8),
      g = new Game();
    g.start(seed, s);
    assert.equal(g.region, null);
    assert.equal(g.level.id, getLevel(seed, 8).id);
    assert.equal(saveOf(g).region, undefined);
  }
  const s = preset('well');
  delete s.annexRouteTest;
  for (const bad of [
    { region: 'pending' },
    { region: 'nope' },
    { route: 'high' },
    { detour: true },
    { seed: 'RF-D79-2026-09-24' },
    { region: 'annex', stage: 3 },
  ])
    assert.equal(loadCheckpoint({ ...s, ...bad }), null, JSON.stringify(bad));
});

for (const mirror of [false, true])
  test(`physical fork and all three Annex rooms form a continuous run, mirror=${mirror}`, (t) => {
    const g = new Game();
    g.startTest(preset('fork', mirror));
    const visited = new Set<string>();
    playCampaign(g, {
      region: 'annex',
      pathMods: ['spoof', 'standing-orders', 'priority-target'],
      seconds: 240,
      stop: (g) => g.stage === 11,
      beforeInput: (g) => {
        if (g.annex.active) visited.add(g.level.id);
        return undefined;
      },
    });
    assert.equal(g.region, 'annex');
    assert.equal(g.stage, 11);
    assert.equal(g.mode, 'playing');
    assert(g.hp > 0 && g.level.boss && !g.annex.active);
    assert.equal(visited.size, 3);
    assert(g.mods.includes('spoof'));
    assert.equal(g.mods.length, 11);
    t.diagnostic(
      JSON.stringify({ mirror, hp: g.hp, seconds: g.time, kills: g.kills, mods: g.mods }),
    );
  });

test('Annex discovery and death recaps name the visited region without revealing Cooling', () => {
  const g = realGame('well');
  const progress = recordLogbook(loadLogbook(null), g);
  assert(progress.annex);
  assert(!progress.areas.includes('cooling'));
  assert(
    logbookEntries([], progress).some((e) => e.id === 'region:annex' && e.lore[2].length > 100),
  );
  g.setMode('dead');
  const recap = snapshotRun(g, 'annex-death', 100)!;
  assert(recap.annex && recap.roomName === 'Cable Well');
  const migrated = migrateLogbook(null, null, [recap], []);
  assert(migrated.annex && !migrated.areas.includes('cooling'));
});

for (const core of ['pierce', 'cutting-torch', 'shellshock'])
  for (const room of ['broadcast', 'well', 'gallery'])
    for (const mirror of [false, true])
      test(`${room} mirror=${mirror}: ordinary-input ${core} combat`, (t) => {
        const s = preset(room, mirror);
        s.mods = ['magnum', 'light', 'kick', 'rapid', 'airshot', 'leech', 'landing', core];
        if (s.stage > 8) s.mods.push('spoof');
        if (s.stage > 9) s.mods.push('standing-orders');
        assert(validBuild(s.mods));
        const g = new Game();
        g.startTest(s);
        // Broadcast has crossing horizontal lanes; the later rooms use the
        // campaign pilot's platform navigation. Both send ordinary input only.
        if (room === 'broadcast') playRoom(g, 120);
        else playCampaign(g, { pathMods: s.mods, seconds: 120, stop: (g) => g.clear });
        const result = {
          clear: g.clear,
          hp: g.hp,
          kills: g.kills,
          time: g.time,
          shots: g.shotCount,
          enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: { ...e.body.position } })),
        };
        t.diagnostic(JSON.stringify(result));
        assert(result.clear && result.hp > 0, JSON.stringify(result));
      });

// Captured from 5572627 before route integration, not generated by the code under test.
const oldDaily: { seed: string; rooms: string[]; rewards: string[] }[] = JSON.parse(
  readFileSync(new URL('./fixtures/daily79.json', import.meta.url), 'utf8'),
);
for (const old of oldDaily)
  test(old.seed + ' preserves all twenty rooms and nineteen rewards', () => {
    const g = new Game();
    g.start(old.seed);
    g.areaEvents.state = null;
    for (let stage = 0; stage < 20; stage++) {
      assert.equal(g.level.id, old.rooms[stage]);
      assert(!g.region);
      if (stage === 19) break;
      g.openReward();
      assert.deepEqual(
        g.offers.map((m) => m.id),
        [old.rewards[stage]],
      );
      g.chooseMod(g.offers[0].id);
    }
  });
