import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getGun, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { loadCosmetics } from '../src/cosmetics.ts';
import { SHAFT_NAMES } from '../src/maintenance.ts';
import {
  ProgressStore,
  CHECKPOINT_KEY,
  parseProgressBackup,
  validateProgress,
} from '../src/progress.ts';
import {
  SHAFT_PROFILE_KEY,
  TRIAL_RULES,
  TRIAL_LIMIT,
  trialKey,
  loadShaftProfile,
  validShaftProfile,
  recordShaftClear,
  maintenanceCertified,
  trialAccess,
  trialCheckpoint,
  snapshotTrial,
  recordTrial,
  trialChallenge,
  trialLink,
  parseTrialChallenge,
  trialFromUrl,
  type TrialRoute,
  type TrialScore,
} from '../src/maintenance-trials.ts';
import { trialPreviewHtml, trialResultHtml } from '../src/maintenance-trials-menu.ts';
import { climb, tick } from './helpers/maintenance-pilot.ts';
const route: TrialRoute = {
  kind: 'piston',
  seed: 'MAINTENANCE-piston-3',
  revision: 2,
  rules: TRIAL_RULES,
};
const unlock = { kind: route.kind, seed: route.seed, revision: route.revision, clean: false };
const profile = recordShaftClear(null, unlock);
const result: TrialScore = { timeMs: 63000, shots: 24, hits: 2, finishedAt: 1000 };
function goal(g: Game) {
  const { x, floor } = g.maintenance.exit;
  Matter.Body.setPosition(g.player, { x, y: floor - 18 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 50 && g.mode === 'playing'; i++) tick(g);
}
function store() {
  const disk = new Map<string, string>();
  return new ProgressStore(() => ({
    getItem: (k) => disk.get(k) ?? null,
    setItem: (k, v) => {
      disk.set(k, v);
    },
    removeItem: (k) => {
      disk.delete(k);
    },
  }));
}
test('earned types gate trials and preserve the first route independently of clean certification', () => {
  assert(!trialAccess(route, null));
  assert(trialAccess(route, profile));
  assert(!trialAccess({ ...route, kind: 'lift' }, profile));
  assert(!trialAccess({ ...route, rules: TRIAL_RULES + 1 }, profile));
  const again = recordShaftClear(profile, { ...unlock, seed: 'second', clean: true });
  assert.equal(again.unlocks[0].seed, route.seed);
  assert(again.unlocks[0].clean);
  assert(!profile.unlocks[0].clean);
  assert(!maintenanceCertified(again));
  assert(maintenanceCertified(recordShaftClear(again, { ...unlock, kind: 'lift', clean: true })));
  assert.equal(loadCosmetics({ outfit: 'servicewear', gun: 'standard' }, []).outfit, 'standard');
  assert.equal(
    loadCosmetics({ outfit: 'servicewear', gun: 'standard' }, ['maintenance-certified']).outfit,
    'servicewear',
  );
});
test('profiles reject duplicate, unearned, oversized and malformed records', () => {
  const good = recordTrial(profile, route, result).profile;
  assert(validShaftProfile(good));
  for (const bad of [
    null,
    [],
    { ...good, extra: 1 },
    { ...good, unlocks: [...good.unlocks, ...good.unlocks] },
    { ...good, unlocks: [] },
    { ...good, records: [...good.records, ...good.records] },
    { ...good, records: Array(TRIAL_LIMIT + 1).fill(good.records[0]) },
    { ...good, records: [{ ...good.records[0], fastest: { ...result, shots: -1 } }] },
    { ...good, records: [{ ...good.records[0], fastest: { ...result, timeMs: NaN } }] },
    { ...good, unlocks: [{ ...unlock, clean: 'true' }] },
  ])
    assert(!validShaftProfile(bad));
  const copy = loadShaftProfile(good);
  copy.records[0].fastest.shots = 999;
  assert.equal(good.records[0].fastest.shots, 24);
});
test('time and shot records keep real paired scores; ties improve the secondary metric', () => {
  let p = recordTrial(profile, route, result).profile;
  p = recordTrial(p, route, { ...result, timeMs: 60000, shots: 30, finishedAt: 2000 }).profile;
  let outcome = recordTrial(p, route, {
    ...result,
    timeMs: 70000,
    shots: 10,
    hits: 0,
    finishedAt: 3000,
  });
  assert.equal(outcome.record.fastest.shots, 30);
  assert.equal(outcome.record.efficient.timeMs, 70000);
  assert(!outcome.faster && outcome.efficient);
  assert(outcome.profile.unlocks[0].clean);
  outcome = recordTrial(outcome.profile, route, { ...result, timeMs: 60000, shots: 25 });
  assert(outcome.faster && !outcome.efficient);
  assert.equal(outcome.record.fastest.shots, 25);
  assert.throws(() => recordTrial(null, route, result));
  assert.throws(() => recordTrial(profile, route, { ...result, shots: Infinity }));
});
test('records distinguish shaft, layout revision and rules; history is bounded', () => {
  const keys = new Set(
    [
      route,
      { ...route, kind: 'lift' as const },
      { ...route, revision: 1 as const },
      { ...route, rules: 2 },
    ].map(trialKey),
  );
  assert.equal(keys.size, 4);
  let p = profile;
  for (let i = 0; i < TRIAL_LIMIT + 5; i++)
    p = recordTrial(p, { ...route, seed: 'record-' + i }, { ...result, finishedAt: i }).profile;
  assert.equal(p.records.length, TRIAL_LIMIT);
  assert.equal(p.records[0].seed, 'record-104');
  assert(validShaftProfile(p));
});
test('share links round-trip unicode and reject mixed, duplicate and corrupted payloads', () => {
  const ch = trialChallenge({ ...route, seed: 'Climb 雨 & <test>' }, result);
  const link = trialLink(ch);
  assert.deepEqual(parseTrialChallenge(link), ch);
  assert.deepEqual(trialFromUrl(new URL(link))?.route, { ...route, seed: ch.seed });
  assert.equal(
    new URL(trialLink(ch, 'https://html-classic.itch.zone/html/123/index.html')).hostname,
    'caleb-guyer.github.io',
  );
  for (const bad of [
    link + '&test=maintenance-trial',
    link + '&shaft=foo',
    link + '#fragment',
    'MTC1.bad',
    'x'.repeat(2049),
    trialLink(ch) + '&daily=2026-09-27',
  ])
    assert.throws(() => parseTrialChallenge(bad));
  assert.equal(trialFromUrl(new URL(link + '&build=recoil')), null);
  const archived = parseTrialChallenge(trialLink({ ...ch, rules: 2 }));
  assert(!trialAccess({ ...route, rules: archived.rules }, profile));
});
test('preview links are isolated, bounded and cannot import upgraded or campaign starts', () => {
  for (const kind of ['piston', 'lift']) {
    const parsed = trialFromUrl(
      new URL('https://test/?test=maintenance-trial&layout=' + kind + '&variant=3'),
    )!;
    assert(parsed.preview);
    assert(loadCheckpoint(trialCheckpoint(parsed.route)));
  }
  for (const q of [
    '&build=recoil',
    '&seed=changed',
    '&variant=0',
    '&variant=1000',
    '&layout=unknown',
    '&test=maintenance',
    '#x',
  ])
    assert.equal(trialFromUrl(new URL('https://test/?test=maintenance-trial' + q)), null);
});
test('normal shaft clears unlock exactly once; damage persists through Continue and old saves are conservative', () => {
  const g = new Game(),
    save = trialCheckpoint(route)!;
  save.maintenance!.clean = true;
  const clears: unknown[] = [];
  g.maintenance.onClear = (c) => clears.push(c);
  g.start(save.seed, save);
  assert(g.maintenance.state!.clean);
  tick(g);
  g.damagePlayer(1);
  let checkpoint: Checkpoint | undefined;
  g.onCheckpoint = (s) => {
    checkpoint = s;
  };
  g.save();
  assert(checkpoint);
  assert.equal(checkpoint.maintenance!.clean, false);
  g.start(checkpoint.seed, checkpoint);
  assert.equal(g.maintenance.state!.clean, false);
  goal(g);
  assert.equal(g.mode, 'upgrade');
  assert.equal(clears.length, 1);
  assert.equal((clears[0] as any).clean, false);
  g.maintenance.completed();
  assert.equal(clears.length, 1);
  g.save();
  assert(checkpoint?.reward);
  g.start(checkpoint.seed, checkpoint);
  assert.equal(clears.length, 1);
  g.chooseMod(g.offers[0].id);
  assert.equal(clears.length, 2, 'pending reward can recover an unlock after reload');
  delete save.maintenance!.clean;
  g.start(save.seed, save);
  assert.equal(g.maintenance.state!.clean, false);
});
test('trial retries reset health, timing, hits and gun without writing campaign progress', () => {
  const g = new Game();
  let writes = 0,
    clears = 0;
  g.onCheckpoint = () => writes++;
  g.maintenance.onClear = () => clears++;
  assert(!g.maintenance.startTrial(route, null));
  assert(g.maintenance.startTrial(route, profile));
  assert.deepEqual(g.gun, getGun([]));
  assert.deepEqual(g.mods, []);
  tick(g, { fire: true });
  g.damagePlayer(10);
  assert.equal(g.maintenance.trial!.hits, 1);
  g.damagePlayer(10);
  assert.equal(g.maintenance.trial!.hits, 1, 'invulnerability does not add hits');
  g.setMode('paused');
  const elapsed = g.elapsed;
  tick(g);
  assert.equal(g.elapsed, elapsed);
  assert.equal(snapshotTrial(g, profile), null);
  assert(g.maintenance.startTrial(route, profile));
  assert.equal(g.hp, 100);
  assert.equal(g.elapsed, 0);
  assert.equal(g.shotCount, 0);
  assert.equal(g.maintenance.trial!.hits, 0);
  goal(g);
  assert.equal(g.mode, 'won');
  assert.equal(g.offers.length, 0);
  assert(snapshotTrial(g, profile));
  assert.equal(snapshotTrial(g, null), null);
  assert.equal(writes, 0);
  assert.equal(clears, 0);
  g.maintenance.startTrial(route, null, true);
  goal(g);
  assert.equal(g.mode, 'won');
  assert.equal(snapshotTrial(g, profile), null);
  assert.equal(writes, 0);
  assert.equal(clears, 0);
});
test('both fixed-gun trials finish through ordinary input with no campaign awards', () => {
  for (const kind of ['piston', 'lift'] as const) {
    const r = { ...route, kind, seed: 'MAINTENANCE-' + kind + '-3' };
    const p = recordShaftClear(null, { ...unlock, kind });
    const g = new Game();
    let writes = 0;
    g.onCheckpoint = () => writes++;
    g.maintenance.startTrial(r, p);
    const outcome = climb(g);
    assert.equal(outcome.mode, 'won', JSON.stringify(outcome));
    assert(outcome.hp > 0);
    assert(outcome.shots > 0);
    const win = snapshotTrial(g, p)!;
    assert(win);
    assert.equal(win.score.shots, g.shotCount);
    assert.equal(writes, 0);
    assert.deepEqual(g.mods, []);
  }
});
test('trial profiles and cosmetic rewards survive backup, restore, undo and legacy migration', async () => {
  const a = store(),
    b = store();
  const p = recordTrial(profile, route, result).profile;
  await a.write(SHAFT_PROFILE_KEY, p);
  await a.write(CHECKPOINT_KEY, trialCheckpoint(route));
  const backup = parseProgressBackup(a.backup('3.12.0'));
  assert(await b.restore(backup));
  assert.deepEqual(b.read(SHAFT_PROFILE_KEY), p);
  assert.deepEqual(b.read(CHECKPOINT_KEY), trialCheckpoint(route));
  assert(await b.undo());
  assert.deepEqual(b.read(SHAFT_PROFILE_KEY), { unlocks: [], records: [] });
  const old = structuredClone(backup) as any;
  delete old.values[SHAFT_PROFILE_KEY];
  assert.deepEqual(parseProgressBackup(JSON.stringify(old)).values[SHAFT_PROFILE_KEY], {
    unlocks: [],
    records: [],
  });
  assert.equal(
    validateProgress({ ...backup.values, [SHAFT_PROFILE_KEY]: { ...p, records: [null] } }),
    null,
  );
});
test('locked challenges hide shaft names and result text escapes shared or status text', () => {
  const ch = trialChallenge(route, result);
  const locked = trialPreviewHtml(ch, loadShaftProfile(null));
  assert(!locked.includes(SHAFT_NAMES.piston));
  assert(!locked.includes('63'));
  assert(trialPreviewHtml(ch, profile).includes('1:03'));
  const html = trialResultHtml({
    won: true,
    preview: false,
    timeMs: result.timeMs,
    shots: 24,
    hits: 0,
    note: '<script>bad</script>',
    challenge: { ...ch, timeMs: 64000 },
  });
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('Target beaten'));
  assert(html.includes('Clean climb'));
});
