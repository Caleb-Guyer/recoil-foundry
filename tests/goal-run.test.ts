import test from 'node:test';
import assert from 'node:assert/strict';
import { nextGoal, goalById } from '../src/next-goal.ts';
import { goalPreviewProgress } from '../src/next-goal-preview.ts';
import {
  beginGoalRun,
  loadGoalRun,
  validGoalRun,
  goalMeasure,
  goalRunSummary,
  goalAction,
  goalOfferLabel,
  goalHuntLabel,
  GoalOpportunity,
  GOAL_RUN_KEY,
} from '../src/goal-run.ts';
import { ProgressStore, parseProgressBackup, validateProgress } from '../src/progress.ts';
import { MODS, loadCheckpoint } from '../src/rules.ts';
import { loadWeaponUnlocks } from '../src/weapon-unlocks.ts';
import { Game } from '../src/game.ts';
import {
  GOAL_RUN_SCENES,
  goalRunPreviewFromUrl,
  goalRunTestFromUrl,
  goalRunTestProgress,
  prepareGoalRunTest,
} from '../src/goal-run-test.ts';

const attempt = { stage: 8, overtime: false, security: 0 as const };

test('an attempt keeps its goal and baseline across Continue after earning it', () => {
  const p = goalPreviewProgress('tools');
  const run = beginGoalRun('same-run', p)!;
  p.weapons = loadWeaponUnlocks({ version: 1, cleared: true, licenses: ['twinbore', 'carbine'] });
  p.earned = ['cable-cut', 'plate-breaker'];
  assert.equal(nextGoal(p).id, 'weapon:repeater');
  assert.equal(goalById(p, run.id)?.title, 'Unlock the Coil carbine');
  assert.deepEqual(beginGoalRun('same-run', p, run, true), run);
  const result = goalRunSummary(run, p, attempt, true)!;
  assert.equal(result.complete, true);
  assert.equal(result.advanced, true);
  assert.match(result.status, /^Goal complete.*1 → 2 \/ 2/);
});

test('Retry starts a new baseline even with the same seed; foreign Continue data cannot follow it', () => {
  const p = goalPreviewProgress('tools');
  const run = beginGoalRun('old', p)!;
  p.earned = [];
  assert.equal(beginGoalRun('old', p, run)!.before, 0);
  assert.equal(beginGoalRun('other', p, run, true)!.resumed, true);
  assert.equal(beginGoalRun('other', p, run, true)!.before, 0);
  assert.equal(beginGoalRun('other', goalPreviewProgress('complete')), null);
});

test('saved hunt totals use distinct awards and real ownership', () => {
  const p = goalPreviewProgress('tools');
  p.earned = ['cable-cut', 'cable-cut'];
  p.victories = ['bulwark', 'demolisher'];
  assert.equal(goalMeasure('weapon:carbine', p).current, 1);
  p.earned = ['cable-cut', 'plate-breaker', 'fuse-pulled'];
  assert.equal(goalMeasure('weapon:carbine', p).current, 2);
  p.earned = [];
  p.weapons.licenses.push('carbine');
  assert.equal(goalMeasure('weapon:carbine', p).complete, true);
});

test('Security III access is not completion, and a mismatched run explains the needed difficulty', () => {
  const p = goalPreviewProgress('security');
  const run = beginGoalRun('security-run', p)!;
  assert.equal(goalMeasure(run.id, p).complete, false);
  assert.match(goalRunSummary(run, p, attempt)!.status, /Needs Security III.*Standard/);
  p.security.bests = [{ level: 3, seed: 'security-run', timeMs: 100000 }];
  assert.equal(goalRunSummary(run, p, { ...attempt, security: 3 }, true)!.complete, true);
});

test('losses report retained discoveries without awarding a Campaign victory', () => {
  const p = goalPreviewProgress('fresh');
  const run = beginGoalRun('first-attempt', p)!;
  p.discovered = ['scatter', 'fold', 'arc-coil'];
  const before = JSON.stringify(p);
  const report = goalRunSummary(run, p, attempt, true)!;
  assert.equal(report.discoveries, 3);
  assert.equal(report.complete, false);
  assert.match(report.status, /Reached Campaign.*9 \/ 20/);
  assert.equal(JSON.stringify(p), before);
});

test('a collected goal is recorded after a loss; offered fittings do not count', () => {
  const p = goalPreviewProgress('discoveries');
  const run = beginGoalRun('discovery-run', p)!;
  assert.equal(goalRunSummary(run, p, attempt, true)!.complete, false);
  p.discovered = [...p.discovered, 'heat-relay'];
  assert.equal(goalRunSummary(run, p, attempt, true)!.complete, true);
  assert.equal(goalRunSummary(run, p, attempt, true)!.discoveries, 1);
});

test('Gauntlet and Overtime show their own attempt progress without inventing unlocks', () => {
  const p = goalPreviewProgress('complete');
  p.weapons.licenses = ['twinbore', 'carbine'];
  const gauntlet = beginGoalRun('gauntlet', p)!;
  assert.match(goalRunSummary(gauntlet, p, { ...attempt, gauntlet: 3 })!.status, /3 \/ 5 bosses/);
  assert.match(goalRunSummary(gauntlet, p, attempt)!.status, /Needs Boss Gauntlet/);
  p.weapons.licenses.push('repeater');
  p.weapons.overtime = false;
  const overtime = beginGoalRun('overtime', p)!;
  assert.equal(overtime.id, 'weapon:nailgun');
  assert.match(goalRunSummary(overtime, p, attempt)!.status, /Overtime follows victory/);
  assert.match(goalRunSummary(overtime, p, { ...attempt, overtime: true })!.status, /^Overtime/);
  assert.equal(goalRunSummary(overtime, p, { ...attempt, overtime: true })!.complete, false);
});

test('completed licenses, upgrades and visible achievements remain resolvable by their original ID', () => {
  const p = goalPreviewProgress('complete');
  for (const id of ['license:double-jump', 'discover:heat-relay', 'commendation:bank-job']) {
    assert.equal(goalById(p, id)?.id, id);
    assert.equal(goalMeasure(id, p).complete, true);
  }
  assert.equal(goalById(p, 'unknown'), null);
  assert.equal(goalById(goalPreviewProgress('fresh'), 'commendation:unsafe-load'), null);
});

test('upgrade cues mark the target and prerequisite chain without changing the draft', () => {
  assert.equal(goalOfferLabel('discover:heat-relay', 'heat-relay', []), 'Goal fitting');
  assert.equal(goalOfferLabel('discover:heat-relay', 'thermal-runaway', []), 'Goal prerequisite');
  assert.equal(goalOfferLabel('discover:heat-relay', 'cutting-torch', []), 'Goal prerequisite');
  assert.equal(goalOfferLabel('discover:heat-relay', 'cutting-torch', ['cutting-torch']), '');
  assert.equal(goalOfferLabel('discover:heat-relay', 'magnum', []), '');
  assert.equal(goalOfferLabel('commendation:bank-job', 'ricochet', []), 'Helps your goal');
});

test('repeated hunts are never labelled as new carbine progress', () => {
  const p = goalPreviewProgress('tools');
  assert.equal(goalHuntLabel('weapon:carbine', 'cableweaver', p), '');
  assert.equal(goalHuntLabel('weapon:carbine', 'bulwark', p), 'Counts toward Coil carbine');
  assert.equal(goalHuntLabel('commendation:plate-breaker', 'bulwark', p), 'Your goal hunt');
  assert.equal(goalHuntLabel('discover:heat-relay', 'bulwark', p), '');
  p.weapons.licenses.push('carbine');
  assert.equal(goalHuntLabel('weapon:carbine', 'bulwark', p), '');
});

test('nearby opportunity cues expire once, pause with simulation time, and reset for another room', () => {
  const cue = new GoalOpportunity();
  const door = { x: 1800, y: 740 };
  assert.equal(cue.cue('room-a', 10, { x: 100, y: 700 }, door, 'Goal'), null);
  assert.ok(cue.cue('room-a', 20, door, door, 'Goal'));
  assert.ok(cue.cue('room-a', 20, door, door, 'Goal'));
  assert.equal(cue.cue('room-a', 25, door, door, 'Goal'), null);
  assert.equal(cue.cue('room-a', 40, door, door, 'Goal'), null);
  assert.ok(cue.cue('room-b', 40, door, door, 'Goal'));
  assert.equal(cue.cue('room-b', 40, door, door, ''), null);
});

test('shortcuts respect existing access and require the player to choose a start', () => {
  const fresh = goalPreviewProgress('fresh');
  assert.equal(goalAction(nextGoal(fresh), fresh)?.kind, 'campaign');
  const p = goalPreviewProgress('security');
  assert.deepEqual(goalAction(nextGoal(p), p), {
    kind: 'campaign',
    security: 3,
    label: 'Set up Security III ↗',
  });
  const trial = goalById(goalPreviewProgress('complete'), 'commendation:launch-certified')!;
  assert.equal(goalAction(trial, p)?.kind, 'campaign');
  assert.equal(goalAction(trial, p, ['launch'])?.kind, 'recoil');
  const gauntlet = goalById(p, 'weapon:repeater')!;
  assert.equal(goalAction(gauntlet, p)?.kind, 'gauntlet');
  assert.equal(goalAction(gauntlet, fresh)?.kind, 'campaign');
  assert.equal(goalAction(nextGoal(goalPreviewProgress('complete')), p), null);
});

test('tracked metadata rejects corrupt IDs, counts, duplicate discoveries and extra fields', () => {
  const run = beginGoalRun('valid-seed', goalPreviewProgress('tools'))!;
  assert.deepEqual(loadGoalRun(run), run);
  assert.equal(validGoalRun(null), true);
  for (const edit of [
    { id: 'discover:unknown' },
    { before: -1 },
    { before: 4 },
    { before: 1.2 },
    { seed: 'x'.repeat(41) },
    { seed: 'bad\nseed' },
    { resumed: 'yes' },
    { discoveries: ['scatter', 'scatter'] },
    { discoveries: ['unknown'] },
    { unlocked: true },
  ])
    assert.equal(loadGoalRun({ ...run, ...edit }), null, JSON.stringify(edit));
});

test('backup round-trips the baseline, migrates old backups and rejects corrupt tracking data', async () => {
  const items = new Map<string, string>();
  const disk = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: (k: string) => {
      items.delete(k);
    },
  };
  const store = new ProgressStore(() => disk);
  const run = beginGoalRun('backup-goal', goalPreviewProgress('tools'))!;
  await store.write(GOAL_RUN_KEY, run);
  const backup = parseProgressBackup(store.backup('5.3.0'));
  assert.deepEqual(backup.values[GOAL_RUN_KEY], run);
  const old = structuredClone(backup.values);
  delete (old as Partial<typeof old>)[GOAL_RUN_KEY];
  assert.equal(validateProgress(old)?.[GOAL_RUN_KEY], null);
  assert.equal(validateProgress({ ...old, [GOAL_RUN_KEY]: { ...run, before: -1 } }), null);
});

test('all isolated previews use real test modes and cannot award progress', () => {
  for (const scene of GOAL_RUN_SCENES) {
    const url = new URL(`https://test.invalid/?test=goal-run&scene=${scene}&v=1`);
    const save = goalRunTestFromUrl(url)!;
    assert.ok(loadCheckpoint(save), scene);
    const g = new Game();
    const awards: string[] = [];
    g.onCommendation = (id) => awards.push(id);
    g.startTest(save);
    prepareGoalRunTest(g, scene);
    assert.equal(g.commendations.eligible, false);
    assert.deepEqual(awards, []);
    if (scene === 'hunt') {
      assert.equal(g.clear, true);
      assert.ok(g.hunts.door);
    }
    if (scene === 'upgrade') {
      assert.ok(g.mods.includes('thermal-runaway'));
      assert.ok(g.offers.some((m) => m.id === 'heat-relay'));
      g.chooseMod('heat-relay');
      assert.ok(goalRunTestProgress(scene, g).discovered.includes('heat-relay'));
    }
    if (scene === 'loss') assert.equal(g.mode, 'dead');
    assert.ok(MODS.length > 100);
  }
});

test('preview links reject mixed modes, duplicated fields, wrong revisions and unknown scenes', () => {
  for (const query of [
    'test=goal-run&scene=hunt&v=2',
    'test=goal-run&scene=hunt&v=1&daily=x',
    'test=goal-run&scene=hunt&scene=loss&v=1',
    'test=goal-run&scene=unknown&v=1',
    'test=goal-run&scene=hunt',
  ])
    assert.equal(goalRunPreviewFromUrl(new URL('https://test.invalid/?' + query)), null);
});
