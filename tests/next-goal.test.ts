import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGoal, goalById, goalMeasure, type GoalProgress } from '../src/next-goal.ts';
import {
  GOAL_PREVIEWS,
  goalPreviewFromUrl,
  goalPreviewProgress,
} from '../src/next-goal-preview.ts';
import { COMMENDATIONS, commendationVisible } from '../src/commendations.ts';
import { MODS, MOD_REQUIRES, FUSION_REQUIRES } from '../src/rules.ts';
import { BRANCH_PARENTS } from '../src/upgrade-branches.ts';
import { loadSecurityProfile } from '../src/security.ts';
import { loadWeaponUnlocks, recordWeaponChallenge, TOOL_LICENSES } from '../src/weapon-unlocks.ts';
import { EXPERIMENTAL_GUN_IDS } from '../src/starting-guns.ts';
import { unlockGoals, draftUnlocked } from '../src/longevity.ts';
import { newCampaignSeed } from '../src/run-seed.ts';

const finished = () => goalPreviewProgress('complete');
const fresh = () => goalPreviewProgress('fresh');

test('the first goal is one Campaign clear, even when discoveries or early licenses exist', () => {
  const p = fresh();
  assert.equal(nextGoal(p).id, 'campaign');
  p.weapons = loadWeaponUnlocks({ version: 1, started: true, licenses: ['twinbore'] });
  p.discovered = ['magnum', 'rapid'];
  assert.equal(nextGoal(p).id, 'campaign');
  p.weapons = loadWeaponUnlocks({ version: 1, cleared: true });
  assert.equal(nextGoal(p).id, 'weapon:twinbore');
});

test('weapon suggestions follow real ownership and skip anything already unlocked', () => {
  const p = finished();
  const cases = [
    [{ version: 1, cleared: true }, 'weapon:twinbore'],
    [{ version: 1, cleared: true, licenses: ['twinbore'] }, 'weapon:carbine'],
    [{ version: 1, cleared: true, licenses: ['twinbore', 'carbine'] }, 'weapon:repeater'],
    [
      { version: 1, cleared: true, licenses: ['twinbore', 'carbine', 'repeater'] },
      'weapon:nailgun',
    ],
  ] as const;
  for (const [raw, id] of cases)
    assert.equal(nextGoal({ ...p, weapons: loadWeaponUnlocks(raw) }).id, id);
  assert.equal(nextGoal(p).id, 'complete');
});

test('unique weapon challenges follow the original tool priorities and keep exact best attempts', () => {
  const p = finished();
  p.weapons = loadWeaponUnlocks({
    version: 2,
    cleared: true,
    overtime: true,
    licenses: ['twinbore', 'carbine', 'repeater'],
  });
  for (const gun of EXPERIMENTAL_GUN_IDS) {
    const partial = gun === 'switchjack' ? 350 : 2;
    p.weapons = recordWeaponChallenge(p.weapons, gun, partial, false);
    const goal = nextGoal(p);
    assert.equal(goal.id, 'weapon:' + gun);
    assert.equal(goal.kind, 'weapon');
    assert.equal(goal.progress?.current, partial);
    assert.match(goal.hint, /separate attempts never add together/);
    assert.equal(goalMeasure(goal.id, p).complete, false);
    const target = gun === 'switchjack' ? 500 : 3;
    p.weapons = recordWeaponChallenge(p.weapons, gun, target, true);
    assert.equal(goalById(p, goal.id)?.id, goal.id);
    assert.equal(goalMeasure(goal.id, p).complete, true);
  }
  assert.equal(nextGoal(p).id, 'complete');
  assert.match(nextGoal(p).requirement, /All nine weapons/);
});

test('a full flight best stays incomplete until its safe landing, while grandfathered licenses are complete', () => {
  const p = goalPreviewProgress('switchjack');
  assert.deepEqual(goalMeasure('weapon:switchjack', p), {
    current: 500,
    target: 500,
    unit: 'horizontal flight units',
    complete: false,
  });
  assert.equal(nextGoal(p).id, 'weapon:switchjack');
  assert.match(nextGoal(p).summary, /best saved.*land safely to finish/);
  p.weapons = recordWeaponChallenge(p.weapons, 'switchjack', 499, true);
  assert.equal(goalMeasure('weapon:switchjack', p).complete, false);
  p.weapons = recordWeaponChallenge(p.weapons, 'switchjack', 500, true);
  assert.equal(goalMeasure('weapon:switchjack', p).complete, true);
  assert.equal(nextGoal(p).id, 'complete');

  p.weapons = loadWeaponUnlocks({
    version: 1,
    cleared: true,
    overtime: true,
    licenses: TOOL_LICENSES,
  });
  for (const gun of EXPERIMENTAL_GUN_IDS)
    assert.equal(goalMeasure('weapon:' + gun, p).complete, true);
  assert.equal(nextGoal(p).id, 'complete');
});

test('hunt progress counts distinct earned victories, not repeat kills or encounters', () => {
  const p = goalPreviewProgress('tools');
  assert.deepEqual(nextGoal(p).progress, { current: 1, target: 2, unit: 'different hunts won' });
  assert.deepEqual(
    nextGoal({ ...p, earned: ['cable-cut', 'cable-cut'] }).progress,
    nextGoal(p).progress,
  );
  assert.equal(
    nextGoal({ ...p, earned: [], victories: ['cableweaver', 'bulwark'] }).progress?.current,
    0,
  );
});

test('Overtime suggestion persists until completion, without treating entered Overtime as a nailgun license', () => {
  const p = finished();
  p.weapons.overtime = false;
  assert.equal(nextGoal(p).id, 'weapon:nailgun');
  p.weapons.overtime = true;
  assert.equal(nextGoal(p).kind, 'complete');
});

test('Security access is not a clear: III needs a best or a legacy Redline commendation', () => {
  const p = finished();
  p.earned = p.earned.filter((id) => id !== 'redline');
  for (const [unlocked, expected] of [
    [1, 1],
    [2, 2],
    [3, 3],
  ]) {
    p.security = loadSecurityProfile({ version: 1, unlocked, bests: [] });
    assert.equal(nextGoal(p).id, 'security:' + expected);
  }
  p.security = finished().security;
  assert.equal(nextGoal(p).id, 'commendation:redline');
  p.security = loadSecurityProfile({ version: 1, unlocked: 3, bests: [] });
  p.earned = finished().earned;
  assert.equal(nextGoal(p).id, 'complete');
});

test('missing fitting licenses precede commendation and discovery cleanup', () => {
  const p = finished();
  p.milestones = null;
  p.discovered = [];
  assert.equal(nextGoal(p).id, 'license:ground-fault');
  p.milestones = { version: 1, arcBoss: true };
  assert.equal(nextGoal(p).id, 'license:conductive-tether');
  p.milestones = { version: 1, arcBoss: true, circuit: true };
  assert.equal(nextGoal(p).kind, 'discovery');
});

test('revealed achievements use their actual objective and cosmetic reward', () => {
  for (const c of COMMENDATIONS) {
    const p = finished();
    p.earned = p.earned.filter((id) => id !== c.id);
    if ('remix' in c) p.revealed = [...(p.revealed ?? []), 'remix:' + c.remix];
    if ('gauntlet' in c) p.revealed = [...(p.revealed ?? []), 'remix:loader-crossdock'];
    // Air Traffic also owns the Static Reservoir license.
    if (c.id === 'air-traffic') {
      assert.equal(nextGoal(p).id, 'license:static-reservoir');
      continue;
    }
    assert.equal(nextGoal(p).id, 'commendation:' + c.id);
    assert.equal(nextGoal(p).requirement, c.objective);
    assert.equal(nextGoal(p).reward, c.reward + ' · ' + c.slot);
  }
});

test('concealed upgrade challenges do not leak before their discovery', () => {
  const p = finished();
  p.earned = p.earned.filter((id) => id !== 'bank-job');
  p.discovered = p.discovered.filter((id) => id !== 'ricochet');
  assert.equal(commendationVisible('bank-job', p.victories, p.earned, p.discovered), false);
  assert.equal(nextGoal(p).id, 'discover:ricochet');
  p.discovered = [...p.discovered, 'ricochet'];
  assert.equal(nextGoal(p).id, 'commendation:bank-job');
});

test('every individual missing upgrade gets a collectible goal, with correct parent and license eligibility', () => {
  for (const mod of MODS) {
    const p = finished();
    p.discovered = p.discovered.filter((id) => id !== mod.id);
    const goal = nextGoal(p);
    assert.equal(goal.id, 'discover:' + mod.id, mod.id);
    assert.equal(goal.kind, 'discovery');
    assert.match(goal.requirement, /as a run reward/);
    assert(!p.discovered.includes(mod.id));
  }
});

test('discovery cleanup can collect the entire dependency graph without suggesting an owned or locked part', () => {
  const p: GoalProgress = { ...finished(), discovered: [] };
  const collected = new Set<string>();
  for (let i = 0; i < MODS.length; i++) {
    const goal = nextGoal(p);
    assert.equal(goal.kind, 'discovery', 'step ' + i);
    const id = goal.id.replace('discover:', '');
    assert(MODS.some((m) => m.id === id));
    assert(!collected.has(id));
    const unlocks = unlockGoals(p.book, p.earned, p.victories, p.milestones)
      .filter((g) => g.unlocked)
      .map((g) => g.id);
    assert(
      draftUnlocked(
        id,
        unlocks,
        newCampaignSeed(undefined, () => 0),
      ),
    );
    for (const parent of [
      MOD_REQUIRES[id],
      ...(FUSION_REQUIRES[id] ?? []),
      ...(BRANCH_PARENTS[id] ?? []),
    ])
      if (parent) assert(collected.has(parent), `${id} needs ${parent}`);
    collected.add(id);
    p.discovered = [...collected];
  }
  assert.equal(collected.size, MODS.length);
  assert.equal(nextGoal(p).id, 'complete');
});

test('salvage instructions point at actual source bosses, including the Welder', () => {
  for (const [id, boss] of [
    ['melt-through', 'Welder'],
    ['cinder', 'Press'],
    ['crosswind', 'Condenser'],
    ['ramjet', 'Loader'],
  ]) {
    const p = finished();
    p.discovered = p.discovered.filter((mod) => mod !== id);
    assert(nextGoal(p).hint.includes(boss));
  }
});

test('undefeated bosses keep a concealed challenge goal rather than a false completion message', () => {
  const p = finished();
  p.earned = p.earned.filter((id) => id !== 'clearance');
  p.victories = p.victories.filter((id) => id !== 'crane');
  const goal = nextGoal(p);
  assert.equal(goal.id, 'encounter:crane');
  assert(!goal.title.includes('Clearance'));
  assert(!goal.requirement.includes('Crane'));
  p.victories = [...p.victories, 'crane'];
  assert.equal(nextGoal(p).id, 'commendation:clearance');
});

test('recommendations are stable, side-effect free and derived fresh after restoring older progress', () => {
  for (const profile of GOAL_PREVIEWS) {
    const p = goalPreviewProgress(profile);
    const before = structuredClone(p);
    assert.deepEqual(nextGoal(p), nextGoal(p));
    assert.deepEqual(p, before);
  }
  assert.equal(nextGoal(finished()).kind, 'complete');
  assert.equal(nextGoal(fresh()).kind, 'campaign');
});

test('isolated title fixtures cover every milestone stage without touching the input profile', () => {
  const expected = [
    'campaign',
    'weapon:carbine',
    'weapon:bellows',
    'weapon:debt-collector',
    'weapon:switchjack',
    'security:3',
    'commendation:bank-job',
    'discover:heat-relay',
    'complete',
  ];
  GOAL_PREVIEWS.forEach((profile, i) => {
    const url = new URL(`https://example.com/?test=next-goal&profile=${profile}&v=1`);
    assert.equal(goalPreviewFromUrl(url), profile);
    assert.equal(nextGoal(goalPreviewProgress(profile)).id, expected[i]);
  });
});

test('preview links reject unknown versions, extra or repeated parameters and missing profiles', () => {
  for (const query of [
    'test=next-goal',
    'test=next-goal&profile=fresh',
    'test=next-goal&profile=fresh&v=2',
    'test=next-goal&profile=other&v=1',
    'test=next-goal&profile=fresh&v=1&profile=complete',
    'test=next-goal&profile=fresh&v=1&seed=FAKE',
    'test=next-goal&profile=fresh&v=1&test=next-goal',
    'test=next-goal&profile=fresh&v=1&v=1',
    'test=other&profile=fresh&v=1',
  ])
    assert.equal(goalPreviewFromUrl(new URL('https://example.com/?' + query)), null, query);
});
