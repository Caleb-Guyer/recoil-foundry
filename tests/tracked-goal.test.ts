import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRACKED_GOAL_KEY,
  loadTrackedGoal,
  validTrackedGoal,
  trackedGoal,
  selectedGoal,
  logbookGoal,
} from '../src/tracked-goal.ts';
import { nextGoal, goalById } from '../src/next-goal.ts';
import { beginGoalRun, goalRunSummary, goalOfferLabel, GOAL_RUN_KEY } from '../src/goal-run.ts';
import {
  trackingPreviewFromUrl,
  trackingPreviewProgress,
  TRACKING_PREVIEWS,
} from '../src/tracked-goal-preview.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { logbookArticle, logbookTrackMarkup } from '../src/logbook-menu.ts';
import { loadLogbook, LOGBOOK_KEY } from '../src/logbook.ts';
import { unlockGoals } from '../src/longevity.ts';
import { loadWeaponUnlocks, WEAPON_UNLOCKS_KEY } from '../src/weapon-unlocks.ts';
import { ProgressStore, parseProgressBackup, validateProgress } from '../src/progress.ts';
import { ARCHIVE_KEY } from '../src/archive.ts';
import { DISCOVERIES_KEY } from '../src/workshop-build.ts';
import { MODS } from '../src/rules.ts';

const pin = (id: string) => ({ version: 1 as const, id });
const catalog = (p: ReturnType<typeof trackingPreviewProgress>) =>
  logbookCatalog(
    p.discovered,
    p.book,
    p.earned,
    { version: 1, encountered: p.revealed, read: [] },
    unlockGoals(p.book, p.earned, p.victories, p.milestones),
    null,
    p.weapons,
  );

test('manual choices cannot replace Beat the Campaign before the first clear', () => {
  const p = trackingPreviewProgress('fresh');
  p.weapons = loadWeaponUnlocks({ version: 1, started: true, licenses: ['twinbore'] });
  p.revealed = MODS.map((m) => 'mod:' + m.id);
  const before = JSON.stringify(p);
  for (const id of [
    'weapon:repeater',
    'commendation:bank-job',
    'discover:heat-relay',
    'license:wing-harness',
  ]) {
    assert.equal(trackedGoal(p, pin(id)), null);
    assert.equal(selectedGoal(p, pin(id)).id, 'campaign');
  }
  for (const entry of catalog(p)) assert.equal(logbookGoal(entry, p), null);
  assert.equal(JSON.stringify(p), before);
});

test('a selected weapon overrides the automatic order and untracking restores it', () => {
  const p = trackingPreviewProgress('tools');
  const before = JSON.stringify(p);
  assert.equal(nextGoal(p).id, 'weapon:carbine');
  assert.equal(selectedGoal(p, pin('weapon:repeater')).id, 'weapon:repeater');
  assert.equal(selectedGoal(p, pin('weapon:nailgun')).id, 'weapon:nailgun');
  assert.equal(selectedGoal(p, null).id, 'weapon:carbine');
  assert.equal(JSON.stringify(p), before);
});

test('only incomplete Logbook weapons get a tracking action', () => {
  const p = trackingPreviewProgress('tools'),
    entries = catalog(p);
  assert.equal(
    logbookGoal(entries.find((e) => e.id === 'gun:repeater')!, p)?.id,
    'weapon:repeater',
  );
  assert.equal(logbookGoal(entries.find((e) => e.id === 'gun:twinbore')!, p), null);
  assert.equal(logbookGoal(entries.find((e) => e.id === 'gun:shotgun')!, p), null);
  assert.equal(logbookGoal(entries.find((e) => e.id === 'tool')!, p), null);
});

test('offered fitting records reveal their achievement without granting discovery or a concealed boss challenge', () => {
  const p = trackingPreviewProgress('achievements');
  p.discovered = p.discovered.filter((id) => id !== 'ricochet');
  assert.equal(trackedGoal(p, pin('commendation:bank-job'))?.id, 'commendation:bank-job');
  assert.equal(p.discovered.includes('ricochet'), false);
  p.revealed = [];
  assert.equal(trackedGoal(p, pin('commendation:bank-job')), null);
  p.earned = p.earned.filter((id) => id !== 'unsafe-load');
  p.victories = [];
  assert.equal(trackedGoal(p, pin('commendation:unsafe-load')), null);
});

test('upgrade tracking requires its actual reveal and collection completes it', () => {
  const p = trackingPreviewProgress('upgrades');
  const entry = catalog(p).find((e) => e.id === 'mod:heat-relay')!;
  assert.equal(logbookGoal(entry, p)?.id, 'discover:heat-relay');
  assert.equal(selectedGoal(p, pin('discover:heat-relay')).id, 'discover:heat-relay');
  assert.equal(goalOfferLabel('discover:heat-relay', 'cutting-torch', []), 'Goal prerequisite');
  p.revealed = [];
  assert.equal(trackedGoal(p, pin('discover:heat-relay')), null);
  assert.equal(logbookGoal({ ...entry, state: 'known' }, p), null);
  p.revealed = ['mod:heat-relay'];
  p.discovered = [...p.discovered, 'heat-relay'];
  assert.equal(trackedGoal(p, pin('discover:heat-relay')), null);
  assert.equal(selectedGoal(p, pin('discover:heat-relay')).id, 'discover:magnum');
});

test('named fitting licenses track their unlock first and permit discovery after earning the license', () => {
  const p = trackingPreviewProgress('upgrades');
  p.discovered = p.discovered.filter((id) => id !== 'wing-harness');
  p.book = loadLogbook({ version: 1, areas: ['docks'], escaped: true });
  p.revealed = [];
  let entry = catalog(p).find((e) => e.id === 'mod:wing-harness')!;
  assert.equal(entry.state, 'locked');
  assert.equal(logbookGoal(entry, p)?.id, 'license:wing-harness');
  assert.equal(trackedGoal(p, pin('discover:wing-harness')), null);
  p.book.areas = ['docks', 'furnace', 'cooling'];
  assert.equal(trackedGoal(p, pin('license:wing-harness')), null);
  entry = catalog(p).find((e) => e.id === 'mod:wing-harness')!;
  assert.equal(entry.state, 'unseen');
  assert.equal(logbookGoal(entry, p)?.id, 'discover:wing-harness');
});

test('completed selected weapons and achievements return to actual automatic suggestions', () => {
  const p = trackingPreviewProgress('tools');
  p.weapons.licenses!.push('repeater');
  assert.equal(trackedGoal(p, pin('weapon:repeater')), null);
  assert.equal(selectedGoal(p, pin('weapon:repeater')).id, 'weapon:carbine');
  const a = trackingPreviewProgress('achievements');
  a.earned = [...a.earned, 'air-traffic'];
  assert.equal(trackedGoal(a, pin('commendation:air-traffic')), null);
  assert.equal(selectedGoal(a, pin('commendation:air-traffic')).id, 'commendation:bank-job');
});

test('changing the preference never replaces an existing attempt; Continue keeps it and Retry captures the next choice', () => {
  const p = trackingPreviewProgress('tools');
  const original = beginGoalRun('campaign', p, undefined, false, pin('weapon:repeater'))!;
  assert.equal(original.id, 'weapon:repeater');
  assert.deepEqual(beginGoalRun('campaign', p, original, true, pin('weapon:carbine')), original);
  assert.equal(
    beginGoalRun('campaign', p, original, false, pin('weapon:carbine'))!.id,
    'weapon:carbine',
  );
  p.weapons.licenses!.push('repeater');
  assert.equal(
    goalRunSummary(original, p, { stage: 0, security: 0, overtime: false, gauntlet: 5 }, true)!
      .complete,
    true,
  );
  assert.equal(goalById(p, original.id)?.id, original.id);
});

test('tracking metadata rejects unknown, concealed-kind and malformed IDs without storing profile data', () => {
  assert.deepEqual(loadTrackedGoal(pin('weapon:repeater')), pin('weapon:repeater'));
  assert.equal(validTrackedGoal(null), true);
  for (const raw of [
    [],
    {},
    'weapon:repeater',
    { version: 2, id: 'weapon:repeater' },
    pin('campaign'),
    pin('weapon:shotgun'),
    pin('encounter:loader'),
    pin('discover:missing'),
    { ...pin('weapon:repeater'), unlocked: true },
  ])
    assert.equal(validTrackedGoal(raw), false);
});

test('backup, reload, restore and undo preserve a choice while old backups migrate to automatic goals', async () => {
  const data = new Map<string, string>();
  const disk = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const store = new ProgressStore(() => disk);
  await store.write(WEAPON_UNLOCKS_KEY, trackingPreviewProgress('tools').weapons);
  await store.write(TRACKED_GOAL_KEY, pin('weapon:repeater'));
  const a = parseProgressBackup(store.backup('5.4.0'));
  assert.deepEqual(a.values[TRACKED_GOAL_KEY], pin('weapon:repeater'));
  const reloaded = new ProgressStore(() => disk);
  assert.deepEqual(reloaded.read(TRACKED_GOAL_KEY), pin('weapon:repeater'));
  await reloaded.write(TRACKED_GOAL_KEY, pin('weapon:carbine'));
  assert.equal(await reloaded.restore(a), true);
  assert.deepEqual(reloaded.read(TRACKED_GOAL_KEY), pin('weapon:repeater'));
  assert.equal(await reloaded.undo(), true);
  assert.deepEqual(reloaded.read(TRACKED_GOAL_KEY), pin('weapon:carbine'));
  const old = structuredClone(a.values);
  delete (old as Partial<typeof old>)[TRACKED_GOAL_KEY];
  assert.equal(validateProgress(old)?.[TRACKED_GOAL_KEY], null);
  assert.equal(validateProgress({ ...old, [TRACKED_GOAL_KEY]: pin('unknown') }), null);
});

test('save normalization removes completed and unrevealed preferences without touching the original run tracker', async () => {
  const data = new Map<string, string>();
  const store = new ProgressStore(() => ({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  }));
  await store.write(WEAPON_UNLOCKS_KEY, trackingPreviewProgress('tools').weapons);
  await store.write(TRACKED_GOAL_KEY, pin('weapon:repeater'));
  const attempt = beginGoalRun(
    'original-attempt',
    trackingPreviewProgress('tools'),
    undefined,
    false,
    pin('weapon:repeater'),
  )!;
  await store.write(GOAL_RUN_KEY, attempt);
  await store.write(
    WEAPON_UNLOCKS_KEY,
    loadWeaponUnlocks({ version: 1, cleared: true, licenses: ['twinbore', 'repeater'] }),
  );
  assert.equal(parseProgressBackup(store.backup('5.4.0')).values[TRACKED_GOAL_KEY], null);
  assert.deepEqual(parseProgressBackup(store.backup('5.4.0')).values[GOAL_RUN_KEY], attempt);
  const values = store.snapshot();
  values[TRACKED_GOAL_KEY] = pin('discover:heat-relay');
  values[ARCHIVE_KEY] = { version: 1, encountered: [], read: [] };
  values[DISCOVERIES_KEY] = [];
  values[LOGBOOK_KEY] = loadLogbook(null);
  assert.equal(validateProgress(values)?.[TRACKED_GOAL_KEY], null);
});

test('tracking markup escapes titles and tells paused players the change applies to their next attempt', () => {
  const html = logbookTrackMarkup({
    title: '<script>bad</script>',
    tracked: true,
    nextAttempt: true,
  });
  assert.ok(!html.includes('<script>'));
  assert.match(html, /Stop tracking/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /This attempt keeps its original goal/);
  assert.equal(logbookTrackMarkup(null), '');
});

test('isolated interactive previews have real catalog entries and reject mixed or repeated URLs', () => {
  for (const profile of TRACKING_PREVIEWS) {
    const url = new URL(`https://test.invalid/?test=track-goal&profile=${profile}&v=1`);
    assert.equal(trackingPreviewFromUrl(url), profile);
    const p = trackingPreviewProgress(profile);
    const before = JSON.stringify(p);
    for (const e of catalog(p)) {
      const goal = logbookGoal(e, p);
      if (goal)
        assert.match(
          logbookArticle(e, () => '', { title: goal.title, tracked: false, nextAttempt: false }),
          /Track this/,
        );
    }
    selectedGoal(p, pin('weapon:repeater'));
    assert.equal(JSON.stringify(p), before);
  }
  for (const query of [
    'test=track-goal&profile=tools&v=2',
    'test=track-goal&profile=tools&v=1&daily=x',
    'test=track-goal&profile=tools&profile=fresh&v=1',
    'test=track-goal&profile=missing&v=1',
    'test=track-goal&profile=tools',
  ])
    assert.equal(trackingPreviewFromUrl(new URL('https://test.invalid/?' + query)), null);
});
