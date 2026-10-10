import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { BOSS_REMIXES, REMIX_IDS, isBossRemix, type BossRemixId } from '../src/boss-remix-rules.ts';
import {
  GAUNTLET_KEY,
  GAUNTLET_ROUNDS,
  REMIX_GAUNTLET_BASE,
  remixGauntletChoices,
  validGauntletRecord,
  recordGauntlet,
  gauntletBossHp,
  gauntletCommendations,
  remixGauntletPreviewFromUrl,
  type GauntletTier,
  type GauntletRecord,
} from '../src/gauntlet-rules.ts';
import {
  gauntletChallengeAccess,
  gauntletChallengeCode,
  gauntletChallengeFromRecord,
  gauntletChallengeFromUrl,
  gauntletChallengeUrl,
  parseGauntletChallenge,
  validGauntletChallenge,
} from '../src/gauntlet-challenge.ts';
import { SECURITY_TELL, SECURITY_LOCK } from '../src/security-combat.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
import { playRoom } from './room-pilot.ts';
import { GUN_FINISHES, OUTFITS, loadCosmetics } from '../src/cosmetics.ts';
import { commendationVisible } from '../src/commendations.ts';
import { commendationRewards, REWARD_CATALOG } from '../src/run-rewards.ts';
import { REMIX_GAUNTLET_MASTERIES } from '../src/gauntlet-mastery.ts';
import { goalPreviewProgress } from '../src/next-goal-preview.ts';
import { goalById } from '../src/next-goal.ts';
import { beginGoalRun, goalAction, goalRunSummary } from '../src/goal-run.ts';
import { trackedGoal } from '../src/tracked-goal.ts';
import {
  ProgressStore,
  parseProgressBackup,
  validateProgress,
  CHECKPOINT_KEY,
} from '../src/progress.ts';
import { recoilTrialCheckpoint } from '../src/recoil-trial-rules.ts';

const access = {
  version: 1,
  started: true,
  cleared: true,
  overtime: true,
  licenses: ['twinbore', 'carbine', 'repeater'],
};
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 300 },
};
const routeFor = (mask: number) =>
  Array.from({ length: 5 }, (_, i) => remixGauntletChoices(i, REMIX_IDS)[(mask >> i) & 1]);
function begin(
  tier: GauntletTier = 'standard',
  gun: StartingGun = 'pistol',
  seen: readonly BossRemixId[] = REMIX_IDS,
  preview = false,
) {
  const g = new Game();
  assert(g.gauntlet.begin(gun, access, preview, { mode: 'remix', tier, seen }));
  return g;
}
// Transition fixtures use actual enemy defeat handling. The ordinary-input
// simulations below separately verify full combat without changing health or AI.
function resolve(g: Game, hp = g.hp, cleanup = false) {
  g.hp = hp;
  for (const e of [...g.enemies]) {
    e.spawn = 0;
    g.hitEnemy(e, 100000, undefined, true, true, true, cleanup ? 'cleanup' : undefined);
  }
  for (let i = 0; i < 12; i++) g.tick(1 / 60, idle);
}
function finish(mask = 0, tier: GauntletTier = 'standard', repair = false, preview = false) {
  const g = begin(tier, 'pistol', REMIX_IDS, preview);
  for (const [i, id] of routeFor(mask).entries()) {
    assert(g.gauntlet.chooseBoss(id));
    resolve(g, 80);
    assert.equal(g.mode, 'won');
    if (i < 4) assert(g.gauntlet.service(repair ? 'repair' : g.gauntlet.state!.offers[0]));
  }
  return g;
}

test('Remix access requires Campaign victory, a discovered arena and an earned gun; choices expand without leaking undiscovered rooms', () => {
  const g = new Game();
  assert(!g.gauntlet.begin('pistol', null, false, { mode: 'remix', seen: REMIX_IDS }));
  assert(!g.gauntlet.begin('pistol', access, false, { mode: 'remix' }));
  assert(
    !g.gauntlet.begin('nailgun', { version: 1, cleared: true }, false, {
      mode: 'remix',
      seen: REMIX_IDS,
    }),
  );
  assert(!g.gauntlet.begin('pistol', access, false, { mode: 'classic', tier: 'overclocked' }));
  assert(!g.gauntlet.begin('pistol', access, false, { mode: 'remix', seen: REMIX_IDS, path: 1 }));
  const seen: BossRemixId[] = ['loader-crossdock'];
  assert(g.gauntlet.begin('pistol', access, false, { mode: 'remix', seen }));
  seen.push('loader-switchyard');
  assert.deepEqual(g.gauntlet.choices, ['loader-crossdock']);
  assert(!g.gauntlet.chooseBoss('loader-switchyard'));
  assert(!g.gauntlet.chooseBoss('boss-skybridge'));
  for (let i = 1; i < 5; i++)
    assert.deepEqual(remixGauntletChoices(i, ['loader-crossdock']), [REMIX_GAUNTLET_BASE[i]]);
  assert.deepEqual(remixGauntletChoices(-1, REMIX_IDS), []);
  assert.deepEqual(remixGauntletChoices(5, REMIX_IDS), []);
  assert.equal(remixGauntletChoices(0, REMIX_IDS).length, 2);
});

test('a partial collection completes a mixed circuit with honest fallback arenas and rewards', () => {
  const g = begin('standard', 'pistol', ['sorter-beltline']);
  for (let i = 0; i < 5; i++) {
    const id = g.gauntlet.choices[0];
    assert.equal(id, i === 3 ? 'sorter-beltline' : REMIX_GAUNTLET_BASE[i]);
    assert(g.gauntlet.chooseBoss(id));
    assert.equal(g.level.bossRemix, isBossRemix(id) ? id : undefined);
    resolve(g, 70);
    if (i < 4) assert(g.gauntlet.service(g.gauntlet.state!.offers[0]));
  }
  assert(validGauntletRecord(g.gauntlet.result));
  assert.deepEqual(gauntletCommendations(g.gauntlet.result!), [
    'gauntlet-cleared',
    'remix-gauntlet-cleared',
    'remix-gauntlet-unserviced',
  ]);
});

for (const tier of ['standard', 'overclocked'] as const)
  for (let mask = 0; mask < 32; mask++)
    test(`${tier} circuit ${mask} loads five real arenas, carries resources and requires five genuine wins`, () => {
      const g = finish(mask, tier);
      const r = g.gauntlet.result!;
      assert(validGauntletRecord(r));
      assert.equal(r.mode, 'remix');
      assert.equal(r.tier, tier);
      assert.deepEqual(r.route, routeFor(mask));
      assert.equal(r.mods.length + r.repairs, 4);
      assert.equal(g.stage, 19);
      assert.equal(g.level.bossRemix, routeFor(mask)[4]);
      assert.equal(g.gauntlet.state!.cleared, 5);
      assert(!g.gauntlet.completeFight());
      assert(!g.gauntlet.service('repair'));
      assert.deepEqual(g.gauntlet.choices, []);
    });

for (const tier of ['standard', 'overclocked'] as const)
  for (const gun of STARTING_GUN_IDS)
    for (const path of [0, 1] as const)
      test(`${gun} plays ${tier} path ${path + 1} through ordinary inputs with carried health`, () => {
        const g = begin(tier, gun);
        let writes = 0,
          campaign = 0,
          victories = 0,
          awards = 0;
        g.onCheckpoint = () => writes++;
        g.onCampaignClear = () => campaign++;
        g.onBossDefeated = () => victories++;
        g.onCommendation = () => awards++;
        for (let i = 0; i < 5; i++) {
          const before = g.gauntlet.state!.hp,
            id = remixGauntletChoices(i, REMIX_IDS)[path];
          assert(g.gauntlet.chooseBoss(id));
          assert.equal(g.hp, before);
          const boss = g.enemies.find((e) => e.kind === BOSS_REMIXES[id as BossRemixId].boss)!;
          assert.equal(boss.hp, gauntletBossHp(i, tier, 'remix'));
          const result = playRoom(g, 180);
          assert(result.clear && g.hp > 0, JSON.stringify({ tier, gun, id, result }));
          if (i < 4) {
            const s = g.gauntlet.state!;
            const fitting =
              s.hp < 75
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
            assert(g.gauntlet.service(fitting));
          }
        }
        assert(validGauntletRecord(g.gauntlet.result));
        assert.deepEqual([writes, campaign, victories, awards], [0, 0, 0, 0]);
        assert(g.gauntlet.result!.shots > 0);
      });

for (let round = 0; round < 5; round++)
  test(`Overclocked department ${round + 1} warns, locks and fires the same counter-rays, then keeps an open recovery`, () => {
    for (const tier of ['standard', 'overclocked'] as const) {
      const g = begin(tier);
      for (let i = 0; i < round; i++) {
        g.gauntlet.chooseBoss(remixGauntletChoices(i, REMIX_IDS)[0]);
        resolve(g);
        g.gauntlet.service(g.gauntlet.state!.offers[0]);
      }
      g.gauntlet.chooseBoss(remixGauntletChoices(round, REMIX_IDS)[0]);
      const e = g.enemies[0],
        sc = g.securityCombat;
      e.spawn = 0;
      e.state = 'windup';
      sc.update(e, 1 / 60);
      e.state = 'recover';
      e.timer = 1.2;
      const rays: number[] = [];
      g.enemyShot = (_e, a) => {
        rays.push(a);
      };
      for (let i = 0; i < 38; i++) sc.update(e, 1 / 60);
      if (tier === 'standard') {
        assert.equal(sc.counters.size, 0);
        assert.deepEqual(rays, []);
        continue;
      }
      assert.equal(sc.counters.size, 1);
      assert.deepEqual(rays, []);
      const warning = sc.counters.get(e)!;
      const angles = warning.offsets.map(
        (offset) => Math.atan2(warning.aim.y, warning.aim.x) + offset,
      );
      assert(warning.age >= SECURITY_TELL - SECURITY_LOCK);
      Matter.Body.setPosition(g.player, { x: 1800, y: 300 });
      for (let i = 0; i < 36; i++) sc.update(e, 1 / 60);
      assert.deepEqual(rays, angles);
      assert(e.timer >= 0.55);
      e.state = 'windup';
      sc.update(e, 1 / 60);
      e.state = 'recover';
      sc.update(e, 1 / 60);
      assert.equal(sc.counters.size, 0);
      assert.equal(g.security, null);
    }
  });

test('death, cleanup, a forged victory and previews never issue a completion record or reward', () => {
  const g = begin();
  g.gauntlet.chooseBoss('loader-crossdock');
  g.setMode('won');
  assert.equal(g.gauntlet.result, null);
  assert(!g.gauntlet.completeFight());
  g.setMode('playing');
  resolve(g, 80, true);
  assert.equal(g.gauntlet.state!.cleared, 0);
  assert.equal(g.gauntlet.result, null);
  const dead = begin();
  dead.gauntlet.chooseBoss('loader-crossdock');
  dead.damagePlayer(1000, { x: 100, y: 100 });
  assert.equal(dead.gauntlet.state!.phase, 'dead');
  assert.equal(dead.gauntlet.result, null);
  dead.setMode('title');
  assert.equal(dead.gauntlet.state, null);
  const preview = finish(0, 'overclocked', false, true);
  assert.equal(preview.gauntlet.state!.phase, 'complete');
  assert.equal(preview.gauntlet.result, null);
  assert.deepEqual(gauntletCommendations({} as GauntletRecord), []);
});

test('repair eligibility is carried and spending one service choice removes only the no-repair reward', () => {
  const g = begin();
  g.gauntlet.chooseBoss('loader-crossdock');
  resolve(g);
  assert(!g.gauntlet.service('repair'));
  assert(g.gauntlet.service(g.gauntlet.state!.offers[0]));
  assert(!g.gauntlet.service('repair'));
  const repaired = finish(0, 'standard', true).gauntlet.result!;
  assert.equal(repaired.repairs, 4);
  assert.equal(repaired.mods.length, 0);
  assert.deepEqual(gauntletCommendations(repaired), ['gauntlet-cleared', 'remix-gauntlet-cleared']);
  assert.deepEqual(gauntletCommendations(finish().gauntlet.result!), [
    'gauntlet-cleared',
    'remix-gauntlet-cleared',
    'remix-gauntlet-unserviced',
  ]);
});

test('Classic, Remix tiers, guns and exact arena routes have separate best records; legacy records remain readable', () => {
  const one = finish().gauntlet.result!,
    hard = finish(0, 'overclocked').gauntlet.result!,
    other = finish(1).gauntlet.result!;
  const legacy: GauntletRecord = {
    rules: 1,
    gun: 'pistol',
    route: GAUNTLET_ROUNDS.map((r) => r[0]),
    mods: one.mods,
    repairs: 0,
    timeMs: 1000,
    hits: 0,
    shots: 10,
  };
  let saved = recordGauntlet(null, legacy).records;
  for (const r of [one, hard, other, { ...one, gun: 'shotgun' as const }])
    saved = recordGauntlet(saved, r).records;
  assert.equal(saved.length, 5);
  assert(saved.some((r) => !r.mode));
  assert(!recordGauntlet(saved, { ...one, timeMs: one.timeMs + 1 }).best);
  assert(recordGauntlet(saved, { ...one, timeMs: Math.max(1, one.timeMs - 1) }).best);
  for (const bad of [
    { ...one, tier: 'impossible' },
    { ...one, route: [...one.route].reverse() },
    { ...one, route: [...REMIX_GAUNTLET_BASE] },
    { ...one, mode: undefined },
    { ...one, tier: undefined },
    { ...one, repairs: 4 },
    { ...one, unknown: true },
  ])
    assert(!validGauntletRecord(bad));
});

test('challenge codes and links round-trip strictly, gate discovery and gun access, and lock all five fights without granting ownership', () => {
  const record = finish(5, 'overclocked').gauntlet.result!,
    c = gauntletChallengeFromRecord(record),
    code = gauntletChallengeCode(c);
  assert.deepEqual(parseGauntletChallenge(code), c);
  const url = new URL(gauntletChallengeUrl('https://game.test/?seed=old#fragment', c));
  assert.deepEqual(gauntletChallengeFromUrl(url), c);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.has('seed'), false);
  assert(gauntletChallengeAccess(c, access, REMIX_IDS).allowed);
  assert(!gauntletChallengeAccess(c, null, REMIX_IDS).allowed);
  assert.equal(gauntletChallengeAccess(c, access, []).missing, 5);
  assert(
    !gauntletChallengeAccess({ ...c, gun: 'nailgun' }, { version: 1, cleared: true }, REMIX_IDS)
      .allowed,
  );
  const g = new Game();
  assert(
    !g.gauntlet.begin(c.gun, access, false, {
      mode: 'remix',
      tier: c.tier,
      challenge: c,
      seen: [],
    }),
  );
  assert(
    g.gauntlet.begin(c.gun, access, false, {
      mode: 'remix',
      tier: c.tier,
      challenge: c,
      seen: REMIX_IDS,
    }),
  );
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(g.gauntlet.choices, [c.route[i]]);
    assert(g.gauntlet.chooseBoss(c.route[i]));
    resolve(g, 70);
    if (i < 4) assert(g.gauntlet.service(g.gauntlet.state!.offers[0]));
  }
  assert.deepEqual(g.gauntlet.result!.route, c.route);
  assert.equal(g.gauntlet.result!.tier, c.tier);
  for (const text of [
    'RFC1.fake',
    code + '=',
    'RFG1.' + 'a'.repeat(3000),
    'RFG1._',
    'RFG1.' + btoa(JSON.stringify([1, 'pistol', ['loader'], 'standard', 1, 0])),
  ])
    assert.throws(() => parseGauntletChallenge(text));
  for (const query of [
    url.search + '&seed=x',
    url.search + '&test=gauntlet',
    url.search + '&gauntlet=x',
    url.search + '&v=2',
  ])
    assert.equal(gauntletChallengeFromUrl(new URL('https://game.test/' + query)), null);
  assert(!validGauntletChallenge({ ...c, rules: 2 }));
  assert(!validGauntletChallenge({ ...c, timeMs: 0 }));
  assert(!validGauntletChallenge({ ...c, route: c.route.slice(1) }));
});

test('mastery rewards have native appearance images, discovery-gated Logbook goals and correct Gauntlet progress', () => {
  assert.equal(OUTFITS.circuitrunner.unlock, 'remix-gauntlet-cleared');
  assert.equal(GUN_FINISHES.coldsteel.unlock, 'remix-gauntlet-unserviced');
  assert.equal(loadCosmetics({ outfit: 'circuitrunner', gun: 'coldsteel' }, []).outfit, 'standard');
  const p = goalPreviewProgress('complete');
  p.earned = p.earned.filter((id) => !id.startsWith('remix-gauntlet-'));
  p.revealed = ['remix:loader-crossdock'];
  for (const m of REMIX_GAUNTLET_MASTERIES) {
    assert(!commendationVisible(m.id, [], []));
    assert(commendationVisible(m.id, [], [], [], p.revealed));
    assert(
      commendationRewards(m.id).every((id) =>
        REWARD_CATALOG.some((c) => c.id === id && c.image === id),
      ),
    );
    const id = 'commendation:' + m.id,
      goal = goalById(p, id)!;
    assert(goal);
    assert.equal(goal.requirement, m.objective);
    assert(goal.hint.includes('Practice'));
    assert(trackedGoal(p, { version: 1, id }));
    assert.equal(goalAction(goal, p)?.kind, 'gauntlet');
    assert.equal((goalAction(goal, p) as { mode: string }).mode, 'remix');
    const run = beginGoalRun('GOAL-gauntlet', p, null, false, { version: 1, id })!;
    const attempt = {
      stage: 3,
      overtime: false,
      security: 0 as const,
      gauntlet: 2,
      gauntletMode: 'remix' as const,
      gauntletRepairs: 0,
    };
    assert.match(goalRunSummary(run, p, attempt)!.status, /2 \/ 5/);
    if (m.id === 'remix-gauntlet-unserviced')
      assert.match(
        goalRunSummary(run, p, { ...attempt, gauntletRepairs: 1 })!.status,
        /Repair chosen/,
      );
    assert.match(
      goalRunSummary(run, p, { ...attempt, gauntletMode: 'classic' })!.status,
      /Needs the Remix/,
    );
    p.earned = [...p.earned, m.id];
    assert(goalRunSummary(run, p, attempt, true)!.complete);
  }
});

test('both tiers and legacy records survive backup, restore and Undo without replacing Continue', async () => {
  const diskData = new Map<string, string>();
  const disk = new ProgressStore(() => ({
    getItem: (k) => diskData.get(k) ?? null,
    setItem: (k, v) => {
      diskData.set(k, v);
    },
    removeItem: (k) => {
      diskData.delete(k);
    },
  }));
  const campaign = recoilTrialCheckpoint('cargo');
  await disk.write(CHECKPOINT_KEY, campaign);
  const before = parseProgressBackup(disk.backup('5.6.0'));
  const records = [finish().gauntlet.result!, finish(1, 'overclocked').gauntlet.result!];
  const values = { ...before.values, [GAUNTLET_KEY]: records };
  assert.deepEqual(validateProgress(values)![GAUNTLET_KEY], records);
  assert(await disk.restore({ ...before, values }));
  assert.deepEqual(parseProgressBackup(disk.backup('5.6.0')).values[GAUNTLET_KEY], records);
  assert.deepEqual(disk.read(CHECKPOINT_KEY), campaign);
  await disk.undo();
  assert.deepEqual(disk.read(GAUNTLET_KEY), []);
  assert.deepEqual(disk.read(CHECKPOINT_KEY), campaign);
});

test('isolated previews accept known tiers and paths, reject mixed parameters, and never create records', () => {
  for (const tier of ['standard', 'overclocked'] as const)
    for (const path of [1, 2] as const) {
      const link = remixGauntletPreviewFromUrl(
        new URL(`https://game.test/?test=remix-gauntlet&tier=${tier}&path=${path}&gun=carbine&v=1`),
      )!;
      assert(link);
      const g = new Game();
      assert(g.gauntlet.begin(link.gun, null, true, link));
      assert.equal(g.gauntlet.choices.length, 1);
      assert.equal(g.gauntlet.choices[0], routeFor(path === 1 ? 0 : 31)[0]);
    }
  for (const query of [
    'test=remix-gauntlet&tier=unknown',
    'test=remix-gauntlet&tier=standard&tier=overclocked',
    'test=remix-gauntlet&gun=unknown',
    'test=remix-gauntlet&path=3',
    'test=remix-gauntlet&daily=x',
    'test=remix-gauntlet&gauntlet=x',
    'test=remix-gauntlet&v=2',
    'test=remix-gauntlet&setup=0',
    'test=remix-gauntlet&setup=1&setup=1',
    'test=remix-gauntlet&setup=1&path=1',
  ])
    assert.equal(remixGauntletPreviewFromUrl(new URL('https://game.test/?' + query)), null);
  assert.deepEqual(
    remixGauntletPreviewFromUrl(
      new URL('https://game.test/?test=remix-gauntlet&setup=1&tier=overclocked&gun=nailgun&v=1'),
    ),
    {
      mode: 'remix',
      tier: 'overclocked',
      gun: 'nailgun',
      setup: true,
    },
  );
});
