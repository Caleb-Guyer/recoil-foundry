import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Game } from '../src/game.ts';
import { annexArrangement, annexRouteLevel, annexRouteTestFromUrl } from '../src/annex-route.ts';
import { ANNEX_ALTERNATES } from '../src/annex-alternates.ts';
import { annexRevision, dailyRegion } from '../src/regions.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { PROP_STATS } from '../src/props.ts';
import { playCampaign } from './campaign-pilot.ts';

function saveOf(g: Game) {
  let save: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  assert(save && loadCheckpoint(save), JSON.stringify(save));
  return save;
}
function checkpoint(
  seed: string,
  stage: number,
  revision: Checkpoint['annexVersion'] = 4,
): Checkpoint {
  return { ...testCheckpoint(seed, stage), version: 6, region: 'annex', annexVersion: revision };
}

test('independent seeded choices produce all eight room combinations without using the mirror as variety', () => {
  const combos = new Set<string>();
  for (let i = 0; i < 128; i++) {
    const seed = 'annex-variety-' + i;
    combos.add([8, 9, 10].map((stage) => annexArrangement(seed, stage)).join('/'));
    for (const stage of [8, 9, 10]) {
      const a = annexRouteLevel(seed, stage, false),
        b = annexRouteLevel(seed, stage, true);
      assert.equal(a.id, b.id);
      assert.equal(
        a.id === ANNEX_ALTERNATES[stage].id,
        annexArrangement(seed, stage) === 'alternate',
      );
      assert.deepEqual(a, annexRouteLevel(seed, stage, false));
      assert.deepEqual(
        a.spawns.map((s) => ({ ...s, x: 2000 - s.x })),
        b.spawns,
      );
      assert.equal(a.spawns.length, stage);
    }
  }
  assert.equal(combos.size, 8);
  for (const stage of [7, 8.5, 11, NaN])
    assert.throws(() => annexRouteLevel('bad-stage', stage), RangeError);
});

test('returned alternate rooms own their mutable geometry, fixtures and prop collections', () => {
  const before = annexRouteLevel('copy', 10, false, 4, 'alternate');
  const changed = annexRouteLevel('copy', 10, false, 4, 'alternate');
  changed.solids[0].x = 1;
  changed.spawns[0].x = 2;
  changed.route[0].x = 3;
  changed.annexStation!.patrol[0] = 4;
  changed.annexStation!.junction.x = 5;
  changed.setpiece!.props[0].x = 6;
  changed.setpiece!.weak.push(0);
  assert.deepEqual(annexRouteLevel('copy', 10, false, 4, 'alternate'), before);
});

for (const stage of [8, 9, 10])
  for (const mirror of [false, true])
    test(`alternate ${stage} mirror=${mirror}: fixture access, props, and enemy roles`, () => {
      const s = checkpoint('arrangement-check', stage);
      s.annexRouteTest = { mirror, fork: false, layout: 'alternate' };
      const g = new Game();
      g.startTest(s);
      const l = g.level;
      assert.equal(l.spawns.filter((e) => e.kind === 'caller').length, stage >= 9 ? 1 : 0);
      assert.equal(l.spawns.filter((e) => e.kind === 'switchman').length, stage === 9 ? 0 : 1);
      const j = l.annexStation!.junction;
      assert(
        l.route.some(
          (from) => Math.hypot(g.lineEnd(from, j, 3).x - j.x, g.lineEnd(from, j, 3).y - j.y) < 1,
        ),
      );
      for (const p of l.setpiece!.props) {
        const { w, h } = PROP_STATS[p.kind];
        assert(
          l.solids.every(
            (b) =>
              p.x + w / 2 <= b.x ||
              p.x - w / 2 >= b.x + b.w ||
              p.y + h / 2 <= b.y ||
              p.y - h / 2 >= b.y + b.h,
          ),
        );
        assert(
          l.spawns.every(
            (e) =>
              Math.abs(e.x - p.x) >= (w + ENEMY_STATS[e.kind].w) / 2 ||
              Math.abs(e.y - p.y) >= (h + ENEMY_STATS[e.kind].h) / 2,
          ),
        );
      }
      if (stage === 10) {
        const caller = l.spawns.find((e) => e.kind === 'caller')!;
        const switchman = l.spawns.find((e) => e.kind === 'switchman')!;
        assert(Math.abs(caller.x - switchman.x) > 500 && Math.abs(caller.y - switchman.y) > 300);
      }
    });

test('Continue and pending rewards retain the seeded arrangement, mirror and exact offers', () => {
  for (let i = 0; i < 12; i++)
    for (const stage of [8, 9, 10]) {
      const s = checkpoint('annex-variety-' + i, stage),
        g = new Game();
      g.start(s.seed, s);
      const entered = saveOf(g),
        resumed = new Game();
      resumed.start(entered.seed, entered);
      assert.equal(entered.annexVersion, 4);
      assert.deepEqual(resumed.level, g.level);
      g.openReward();
      const reward = saveOf(g);
      resumed.start(reward.seed, reward);
      assert.deepEqual(resumed.level, g.level);
      assert.deepEqual(resumed.offers, g.offers);
      resumed.chooseMod(resumed.offers[0].id);
      assert.equal(resumed.stage, stage + 1);
      if (stage < 10) assert.deepEqual(resumed.level, annexRouteLevel(s.seed, stage + 1));
      else assert.equal(resumed.level.id, 'annex-switchboard');
    }
});

test('old normal revisions stay original, and malformed or mixed Daily revisions are rejected', () => {
  const fresh = new Game();
  fresh.start('new-annex');
  assert.equal(fresh.annexVersion, 4);
  for (const revision of [undefined, 1, 2, 3] as const)
    for (const stage of [8, 9, 10]) {
      const s = checkpoint('annex-variety-3', stage);
      s.annexVersion = revision;
      const g = new Game();
      g.start(s.seed, s);
      assert.equal(g.annexVersion, revision ?? 1);
      assert.deepEqual(
        g.level,
        annexRouteLevel(s.seed, stage, undefined, revision ?? 1, 'alternate'),
      );
      assert.notEqual(g.level.id, ANNEX_ALTERNATES[stage].id);
    }
  for (const bad of [0, 5, '4', null])
    assert.equal(loadCheckpoint({ ...checkpoint('bad', 8), annexVersion: bad }), null);
  for (const ruleset of [80, 81, 82, 83])
    for (const wrong of [1, 2, 3, 4].filter((v) => v !== ruleset - 79)) {
      const seed = `RF-D${ruleset}-2026-09-01`;
      assert.equal(
        loadCheckpoint({ ...checkpoint(seed, 8), region: dailyRegion(seed)!, annexVersion: wrong }),
        null,
      );
    }
});

test('layout preview links are strict, preserve old link layouts and isolate progression', () => {
  for (const room of ['fork', 'broadcast', 'well', 'gallery'])
    for (const layout of ['original', 'alternate'])
      for (const mirror of [0, 1]) {
        const s = annexRouteTestFromUrl(
          new URL(`https://test/?test=annex-route&room=${room}&layout=${layout}&mirror=${mirror}`),
        )!;
        assert(s && loadCheckpoint(s));
        const g = new Game();
        let writes = 0;
        g.onCheckpoint = () => writes++;
        g.startTest(s);
        g.save();
        assert.equal(writes, 0);
        if (room !== 'fork')
          assert.equal(g.level.id === ANNEX_ALTERNATES[s.stage].id, layout === 'alternate');
      }
  assert.equal(
    annexRouteTestFromUrl(new URL('https://test/?test=annex-route&room=broadcast'))!.annexRouteTest!
      .layout,
    'original',
  );
  for (const extra of [
    '&layout=unknown',
    '&layout=alternate&layout=original',
    '&layout=alternate&mirror=3',
    '&layout=alternate&seed=x',
    '&layout=alternate&daily=2026-09-25',
  ])
    assert.equal(annexRouteTestFromUrl(new URL('https://test/?test=annex-route' + extra)), null);
});

// Frozen from a254767 before adding layouts, including all rooms and forced rewards.
const oldDaily: { seed: string; region: string; rooms: string[]; rewards: string[] }[] = JSON.parse(
  readFileSync(new URL('./fixtures/daily82.json', import.meta.url), 'utf8'),
);
for (const old of oldDaily)
  test(old.seed + ': preserves exact Daily 82 layouts and nineteen rewards', () => {
    const g = new Game();
    g.start(old.seed);
    g.areaEvents.state = null;
    g.auditor.state = null;
    assert.equal(g.region, old.region);
    for (let stage = 0; stage < 20; stage++) {
      assert.equal(
        g.level.id + ':' + createHash('sha256').update(JSON.stringify(g.level)).digest('hex'),
        old.rooms[stage],
      );
      if (stage === 19) break;
      g.openReward();
      assert.deepEqual(
        g.offers.map((m) => m.id),
        [old.rewards[stage]],
      );
      g.chooseMod(g.offers[0].id);
    }
  });

test('Daily 83 selects reproducible layouts, saves them, and awards exactly one upgrade', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 20; day++) {
    const seed = `RF-D83-2026-09-${String(day).padStart(2, '0')}`;
    if (dailyRegion(seed) !== 'annex') continue;
    const g = new Game();
    g.start(seed);
    g.areaEvents.state = null;
    g.auditor.state = null;
    assert.equal(annexRevision(seed), 4);
    for (let stage = 0; stage < 12; stage++) {
      if (stage >= 8 && stage <= 10) {
        seen.add(stage + ':' + annexArrangement(seed, stage));
        const save = saveOf(g),
          r = new Game();
        r.start(seed, save);
        assert.deepEqual(r.level, g.level);
      }
      g.openReward();
      assert.equal(g.offers.length, 1);
      g.chooseMod(g.offers[0].id);
    }
    assert.equal(g.stage, 12);
    assert(!g.inAnnex);
  }
  assert.equal(seen.size, 6);
});

for (const core of ['pierce', 'cutting-torch', 'shellshock'])
  for (const mirror of [false, true])
    test(`${core} mirror=${mirror}: alternate route clears through Switchboard and the real exit`, (t) => {
      const s = annexRouteTestFromUrl(
        new URL(`https://test/?test=annex-route&room=broadcast&layout=alternate&mirror=${+mirror}`),
      )!;
      s.mods = ['magnum', 'light', 'kick', 'rapid', 'airshot', 'leech', 'landing', core];
      const g = new Game();
      g.startTest(s);
      const visited = new Set<string>();
      playCampaign(g, {
        pathMods: [core, 'spoof', 'standing-orders', 'priority-target'],
        seconds: 240,
        stop: (g) => g.stage === 12,
        beforeInput: (g) => {
          if (g.inAnnex) visited.add(g.level.id);
          return undefined;
        },
      });
      const result = {
        core,
        mirror,
        hp: g.hp,
        stage: g.stage,
        mode: g.mode,
        seconds: g.time,
        visited: [...visited],
      };
      assert.equal(g.stage, 12, JSON.stringify(result));
      assert(g.hp > 0);
      assert.equal(visited.size, 4);
      assert(
        [...visited].every(
          (id) =>
            id === 'annex-switchboard' || Object.values(ANNEX_ALTERNATES).some((a) => a.id === id),
        ),
      );
      t.diagnostic(JSON.stringify(result));
    });
