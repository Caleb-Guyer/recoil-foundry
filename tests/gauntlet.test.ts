import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { getGun, loadCheckpoint, MODS, validBuild } from '../src/rules.ts';
import {
  GAUNTLET_KEY,
  GAUNTLET_ROUNDS,
  GAUNTLET_BOSS_HP,
  GAUNTLET_REPAIR,
  gauntletEncounter,
  gauntletPreviewFromUrl,
  gauntletOffers,
  loadGauntletRecords,
  validGauntletRecord,
  validGauntletRecords,
  recordGauntlet,
  type GauntletRecord,
} from '../src/gauntlet-rules.ts';
import { PRACTICE_BOSSES, type PracticeBoss } from '../src/practice.ts';
import {
  ProgressStore,
  validateProgress,
  parseProgressBackup,
  CHECKPOINT_KEY,
} from '../src/progress.ts';
import { RECOIL_GHOSTS_KEY } from '../src/recoil-race-rules.ts';
import { recoilTrialCheckpoint } from '../src/recoil-trial-rules.ts';
import { OUTFITS, loadCosmetics } from '../src/cosmetics.ts';
import { COMMENDATIONS, loadCommendations } from '../src/commendations.ts';
import { REWARD_CATALOG, commendationRewards } from '../src/run-rewards.ts';
import { playRoom } from './room-pilot.ts';
import type { StartingGun } from '../src/starting-guns.ts';

const access = { version: 1, started: true, cleared: true, overtime: true };
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 300 },
};
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function begin(gun: StartingGun = 'pistol', preview = false) {
  const g = new Game();
  assert(g.gauntlet.begin(gun, access, preview));
  return g;
}
// Transition fixtures resolve combat through actual damage/defeat handling.
// Ordinary-input traversal and combat are checked independently below.
function resolve(g: Game, hp = g.hp) {
  g.hp = hp;
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 100000);
  }
  tick(g, 12);
  assert.equal(g.mode, 'won');
}
function finish(mask = 0, gun: StartingGun = 'pistol', preview = false) {
  const g = begin(gun, preview);
  for (let i = 0; i < 5; i++) {
    const kind = GAUNTLET_ROUNDS[i][(mask >> i) & 1];
    assert(g.gauntlet.chooseBoss(kind));
    resolve(g, 70);
    if (i < 4) assert(g.gauntlet.service(g.gauntlet.state!.offers[0]));
  }
  return g;
}

test('Campaign clearance gates the Gauntlet, each gun respects earned access, and preview grants nothing', () => {
  const g = new Game();
  assert(!g.gauntlet.begin('pistol', null));
  assert(
    !g.gauntlet.begin('shotgun', { version: 1, started: true, cleared: false, overtime: false }),
  );
  assert(
    !g.gauntlet.begin('nailgun', { version: 1, started: true, cleared: true, overtime: false }),
  );
  assert(g.gauntlet.begin('pistol', access));
  assert.equal(g.gauntlet.state!.hp, 100);
  assert.deepEqual(g.gauntlet.state!.mods, []);
  assert.equal(g.gauntlet.result, null);
  const preview = finish(0, 'nailgun', true);
  assert.equal(preview.gauntlet.state!.phase, 'complete');
  assert.equal(preview.gauntlet.result, null);
});

for (const pair of GAUNTLET_ROUNDS)
  for (const kind of pair)
    test(
      kind + ' reconstructs its real arena and keeps boss machinery, warnings and bounds',
      () => {
        const g = begin();
        const round = GAUNTLET_ROUNDS.findIndex((p) => (p as readonly string[]).includes(kind));
        for (let i = 0; i < round; i++) {
          assert(g.gauntlet.chooseBoss(GAUNTLET_ROUNDS[i][0]));
          resolve(g, 80);
          assert(g.gauntlet.service(g.gauntlet.state!.offers[0]));
        }
        assert(g.gauntlet.chooseBoss(kind));
        const e = g.enemies.find((e) => e.kind === kind)!;
        assert(e);
        assert.equal(e.hp, GAUNTLET_BOSS_HP[round]);
        assert.equal(e.maxHp, e.hp);
        assert.equal(g.stage, PRACTICE_BOSSES[kind].stage);
        assert.equal(g.seed, gauntletEncounter(kind).seed);
        assert(g.level.solids.length > 0);
        assert(g.level.boss);
        assert(g.player.position.x >= 13 && g.player.position.y <= 722);
        assert(loadCheckpoint(g.testRun));
        const actual = new Game();
        assert(actual.startPractice(gauntletEncounter(kind), g.mods, g.mods));
        assert.deepEqual(g.level.solids, actual.level.solids);
        assert.deepEqual(g.level.hazards, actual.level.hazards);
        assert.equal(g.level.id, actual.level.id);
        assert.equal(e.body.mass, actual.enemies.find((v) => v.kind === kind)!.body.mass);
      },
    );

for (let mask = 0; mask < 32; mask++)
  test('route ' + mask + ' requires five genuine clears and exactly four service choices', () => {
    const g = finish(mask);
    assert.equal(g.gauntlet.state!.cleared, 5);
    assert.equal(g.gauntlet.state!.phase, 'complete');
    assert(validGauntletRecord(g.gauntlet.result));
    assert.deepEqual(
      g.gauntlet.result!.route,
      GAUNTLET_ROUNDS.map((p, i) => p[(mask >> i) & 1]),
    );
    assert.equal(g.gauntlet.result!.mods.length, 4);
    assert.equal(g.gauntlet.result!.repairs, 0);
    assert.equal(g.gauntlet.choices.length, 0);
    assert(!g.gauntlet.completeFight());
    assert(!g.gauntlet.service('repair'));
  });

for (const gun of ['pistol', 'shotgun', 'nailgun'] as const)
  for (const choice of [0, 1] as const)
    test(
      gun +
        ' completes the ' +
        choice +
        ' path through ordinary movement and firing with carried health',
      () => {
        const g = begin(gun);
        let writes = 0,
          campaign = 0,
          victories = 0,
          awards = 0;
        g.onCheckpoint = () => writes++;
        g.onCampaignClear = () => campaign++;
        g.onBossDefeated = () => victories++;
        g.onCommendation = () => awards++;
        let previousTime = 0;
        for (let i = 0; i < 5; i++) {
          const before = g.gauntlet.state!.hp;
          assert(g.gauntlet.chooseBoss(GAUNTLET_ROUNDS[i][choice]));
          assert.equal(g.hp, before);
          assert.equal(g.startingGun, gun);
          const result = playRoom(g, 180);
          assert(result.clear && g.hp > 0);
          assert.equal(g.gauntlet.state!.phase, i === 4 ? 'complete' : 'service');
          assert(g.gauntlet.state!.timeMs > previousTime);
          previousTime = g.gauntlet.state!.timeMs;
          if (i < 4) {
            const s = g.gauntlet.state!;
            const id =
              s.hp < 45
                ? 'repair'
                : (s.offers.find((id) =>
                    [
                      'magnum',
                      'rapid',
                      'scatter',
                      'deadeye',
                      'pierce',
                      'leech',
                      'execute',
                      'airshot',
                    ].includes(id),
                  ) ?? s.offers[0]);
            assert(g.gauntlet.service(id));
          }
        }
        assert(validGauntletRecord(g.gauntlet.result));
        assert.equal(writes, 0);
        assert.equal(campaign, 0);
        assert.equal(victories, 0);
        assert.equal(awards, 0);
        assert(g.gauntlet.result!.shots > 0);
        assert(g.gauntlet.result!.timeMs < 300000);
      },
    );

test('service carries health, repair competes with an upgrade, caps at full health and cannot be spent twice', () => {
  const g = begin();
  assert(!g.gauntlet.chooseBoss('kiln'));
  assert(g.gauntlet.chooseBoss('loader'));
  assert(!g.gauntlet.chooseBoss('crane'));
  assert(!g.gauntlet.service('repair'));
  resolve(g, 85);
  const offers = [...g.gauntlet.state!.offers];
  assert.equal(g.gauntlet.state!.hp, 85);
  assert(!g.gauntlet.service('unknown'));
  assert(g.gauntlet.service('repair'));
  assert.equal(g.hp, 100);
  assert.equal(g.gauntlet.state!.repairs, 1);
  assert.equal(g.mods.length, 0);
  assert(!g.gauntlet.service(offers[0]));
  assert(g.gauntlet.chooseBoss('kiln'));
  assert.equal(g.hp, 100);
  resolve(g);
  assert(!g.gauntlet.service('repair'));
  const id = g.gauntlet.state!.offers[0];
  assert(g.gauntlet.service(id));
  assert.deepEqual(g.mods, [id]);
  assert.deepEqual(g.gun, getGun([id], 'pistol'));
  assert.equal(g.hp, 100);
  assert.equal(GAUNTLET_REPAIR, 30);
});

test('pause freezes combat time; stops freeze the total and starting another fight removes all old transient physics', () => {
  const g = begin();
  g.gauntlet.chooseBoss('loader');
  tick(g, 60);
  const time = g.elapsed;
  g.setMode('paused');
  tick(g, 120);
  assert.equal(g.elapsed, time);
  g.setMode('playing');
  resolve(g, 90);
  const total = g.gauntlet.state!.timeMs;
  tick(g, 240);
  assert.equal(g.gauntlet.state!.timeMs, total);
  const old = Matter.Composite.allBodies(g.engine.world);
  g.gauntlet.service('repair');
  tick(g, 240);
  assert.equal(g.gauntlet.state!.timeMs, total);
  g.gauntlet.chooseBoss('press');
  assert(Math.abs(g.elapsed * 1000 - total) < 0.01);
  assert.equal(g.shots.length, 0);
  assert.equal(g.practiceHits, 0);
  assert(!Matter.Composite.allBodies(g.engine.world).some((b) => old.includes(b)));
});

test('death, menu, ordinary starts and forged or cleanup-only clears cannot finish or pay the Gauntlet', () => {
  const g = begin();
  g.gauntlet.chooseBoss('loader');
  g.setMode('won');
  assert.equal(g.gauntlet.state!.phase, 'fight');
  assert.equal(g.gauntlet.result, null);
  assert(!g.gauntlet.completeFight());
  g.setMode('playing');
  const e = g.enemies[0];
  e.spawn = 0;
  g.hitEnemy(e, 100000, undefined, true, true, true, 'cleanup');
  tick(g, 10);
  assert.equal(g.gauntlet.state!.cleared, 0);
  assert.equal(g.gauntlet.result, null);
  const dead = begin();
  dead.gauntlet.chooseBoss('loader');
  tick(dead, 15);
  dead.damagePlayer(1000, { x: 100, y: 100 });
  assert.equal(dead.mode, 'dead');
  assert.equal(dead.gauntlet.state!.phase, 'dead');
  assert(!dead.gauntlet.service('repair'));
  assert.equal(dead.gauntlet.result, null);
  dead.setMode('title');
  assert.equal(dead.gauntlet.state, null);
  assert(dead.gauntlet.begin('shotgun', access));
  assert.equal(dead.gauntlet.state!.hp, 100);
  assert.deepEqual(dead.gauntlet.state!.route, []);
  dead.start('ORDINARY');
  assert.equal(dead.gauntlet.state, null);
});

test('drafts are deterministic, legal, distinct and do not grant Campaign-only fittings', () => {
  const g = begin();
  for (let i = 0; i < 4; i++) {
    g.gauntlet.chooseBoss(GAUNTLET_ROUNDS[i][0]);
    resolve(g, 90);
    const s = g.gauntlet.state!;
    assert.equal(s.offers.length, 3);
    assert.equal(new Set(s.offers).size, 3);
    assert.deepEqual(s.offers, gauntletOffers(s.mods, i + 1));
    assert(s.offers.every((id) => validBuild([...s.mods, id]) && MODS.some((m) => m.id === id)));
    assert(!s.offers.includes('cinder'));
    assert(g.gauntlet.service(s.offers[0]));
  }
});

test('matching route/gun records keep the fastest completion and break ties by hits then shots', () => {
  const r = finish().gauntlet.result!;
  assert(validGauntletRecord(r));
  const one = recordGauntlet(null, r);
  assert(one.best);
  assert(!recordGauntlet(one.records, r).best);
  assert(!recordGauntlet(one.records, { ...r, timeMs: r.timeMs + 1 }).best);
  const faster = { ...r, timeMs: Math.max(1, r.timeMs - 1) };
  assert(recordGauntlet(one.records, faster).best);
  const hit = { ...r, hits: r.hits + 1 };
  assert(recordGauntlet(recordGauntlet(null, hit).records, r).best);
  const shot = { ...r, shots: r.shots + 1 };
  assert(recordGauntlet(recordGauntlet(null, shot).records, r).best);
  const alternate = { ...r, route: [...r.route] };
  alternate.route[0] = 'crane';
  assert.equal(recordGauntlet(one.records, alternate).records.length, 2);
  assert.equal(recordGauntlet(one.records, { ...r, gun: 'shotgun' }).records.length, 2);
  const copy = loadGauntletRecords(one.records);
  copy[0].route[0] = 'crane';
  assert.equal(one.records[0].route[0], 'loader');
  for (const bad of [
    null,
    {},
    { ...r, rules: 2 },
    { ...r, gun: 'unknown' },
    { ...r, timeMs: 0 },
    { ...r, hits: -1 },
    { ...r, route: r.route.slice(1) },
    { ...r, mods: ['unknown'] },
    { ...r, mods: [{}] },
    { ...r, repairs: 4 },
    { ...r, extra: 1 },
  ])
    assert(!validGauntletRecord(bad));
  assert(!validGauntletRecords([r, r]));
  assert(!validGauntletRecords(Array(97).fill(r)));
});

test('Gauntlet records migrate, round-trip and undo through Progress without replacing a Campaign checkpoint', async () => {
  const data = new Map<string, string>();
  const disk = new ProgressStore(() => ({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  }));
  const campaign = recoilTrialCheckpoint('cargo');
  await disk.write(CHECKPOINT_KEY, campaign);
  const before = parseProgressBackup(disk.backup('4.8.0'));
  const r = finish().gauntlet.result!;
  const next = { ...before.values, [GAUNTLET_KEY]: [r] };
  assert.deepEqual(validateProgress(next)![GAUNTLET_KEY], [r]);
  const old = { ...next };
  delete (old as Partial<typeof old>)[GAUNTLET_KEY];
  assert.deepEqual(validateProgress(old)![GAUNTLET_KEY], []);
  assert.equal(validateProgress({ ...next, [GAUNTLET_KEY]: [r, r] }), null);
  assert(await disk.restore({ ...before, values: next }));
  assert.deepEqual(parseProgressBackup(disk.backup('4.8.0')).values[GAUNTLET_KEY], [r]);
  assert.deepEqual(disk.read(CHECKPOINT_KEY), campaign);
  assert.deepEqual(disk.read(RECOIL_GHOSTS_KEY), []);
  await disk.undo();
  assert.deepEqual(disk.read(GAUNTLET_KEY), []);
  assert.deepEqual(disk.read(CHECKPOINT_KEY), campaign);
});

test('Victor is a real initially locked appearance with a completion commendation and native reward card', () => {
  assert.equal(OUTFITS.victor.unlock, 'gauntlet-cleared');
  assert(COMMENDATIONS.some((c) => c.id === 'gauntlet-cleared'));
  assert.equal(loadCosmetics({ outfit: 'victor' }, []).outfit, 'standard');
  assert.equal(
    loadCosmetics({ outfit: 'victor' }, loadCommendations(['gauntlet-cleared'])).outfit,
    'victor',
  );
  assert.deepEqual(commendationRewards('gauntlet-cleared'), ['appearance:outfit:victor']);
  assert(
    REWARD_CATALOG.some(
      (r) => r.id === 'appearance:outfit:victor' && r.image === 'appearance:outfit:victor',
    ),
  );
});

test('isolated Gauntlet links accept only a known gun and reject mixed or repeated parameters', () => {
  assert.equal(gauntletPreviewFromUrl(new URL('https://game.test/?test=gauntlet')), 'pistol');
  assert.equal(
    gauntletPreviewFromUrl(new URL('https://game.test/?test=gauntlet&gun=shotgun')),
    'shotgun',
  );
  for (const q of [
    'test=gauntlet&gun=unknown',
    'test=gauntlet&gun=pistol&gun=shotgun',
    'test=gauntlet&seed=x',
    'test=gauntlet&daily=x',
    'test=gauntlet&test=loader',
    'test=gauntlet&recoil=x',
  ])
    assert.equal(gauntletPreviewFromUrl(new URL('https://game.test/?' + q)), null);
});
