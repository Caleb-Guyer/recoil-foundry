import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  recoilTrialCheckpoint,
  recordRecoilTrial,
  RECOIL_TRIALS_KEY,
  type RecoilTrialKind,
} from '../src/recoil-trial-rules.ts';
import {
  RECOIL_GHOSTS_KEY,
  RECOIL_RACE_RULES,
  RECOIL_SPLITS,
  GHOST_FRAME_LIMIT,
  GHOST_DURATION,
  validRecoilGhost,
  validRecoilGhosts,
  loadRecoilGhosts,
  recordRecoilGhost,
  recoilChallenge,
  recoilChallengeCode,
  recoilChallengeLink,
  parseRecoilChallenge,
  recoilChallengeFromUrl,
  recoilChallengeAccess,
  ghostFrameAt,
  recoilDelta,
  type RecoilGhost,
  type RecoilChallenge,
} from '../src/recoil-race-rules.ts';
import { recoilChallengePreview } from '../src/recoil-race-menu.ts';
import {
  ProgressStore,
  validateProgress,
  parseProgressBackup,
  CHECKPOINT_KEY,
  BACKUP_LIMIT,
} from '../src/progress.ts';
import { pilotRecoilTrial, trialTick } from './helpers/recoil-trial-pilot.ts';
import type { StartingGun } from '../src/starting-guns.ts';

const kinds: RecoilTrialKind[] = ['launch', 'cargo', 'airborne'];
const guns: StartingGun[] = ['pistol', 'shotgun', 'nailgun'];
function practice(
  kind: RecoilTrialKind,
  gun: StartingGun = 'pistol',
  ghost: RecoilGhost | null = null,
  challenge: RecoilChallenge | null = null,
  showGhost = true,
) {
  const g = new Game();
  assert(g.recoil.startPractice(kind, gun, { clears: [kind] }, ghost, challenge, showGhost));
  return g;
}
function recorded(kind: RecoilTrialKind = 'cargo', gun: StartingGun = 'pistol') {
  const g = practice(kind, gun);
  assert.equal(pilotRecoilTrial(g).mode, 'won');
  const recording = g.recoil.race.recording;
  assert(recording && validRecoilGhost(recording));
  return { g, recording };
}
function store() {
  const data = new Map<string, string>();
  return new ProgressStore(() => ({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  }));
}

for (const kind of kinds)
  for (const gun of guns)
    test(
      kind + ' records actual unmodified ' + gun + ' movement and all ordered checkpoint times',
      () => {
        const { g, recording: r } = recorded(kind, gun);
        assert.equal(r.kind, kind);
        assert.equal(r.gun, gun);
        assert.equal(r.timeMs, g.recoil.result!.timeMs);
        assert.equal(r.shots, g.recoil.result!.shots);
        assert.equal(r.splits.length, RECOIL_SPLITS[kind]);
        assert(r.splits.every((ms, i) => ms > 0 && (!i || ms >= r.splits[i - 1])));
        assert(r.frames.length > 20 && r.frames.length < GHOST_FRAME_LIMIT);
        assert.equal(r.frames[0][0], 0);
        assert.equal(r.frames.at(-1)![0], r.timeMs);
        assert.equal(g.kills, 0);
        assert.equal(g.mods.length, 0);
        assert.deepEqual(g.recoil.race.score, recoilChallenge(r));
      },
    );

test('racing a saved ghost changes no physics, damage, firing, machinery or random stream', () => {
  const { recording } = recorded('launch', 'shotgun');
  const solo = practice('launch', 'shotgun'),
    race = practice('launch', 'shotgun', recording);
  let writes = 0;
  race.onCheckpoint = () => writes++;
  const before = Matter.Composite.allBodies(race.engine.world).length;
  assert.equal(pilotRecoilTrial(solo).mode, 'won');
  assert.equal(pilotRecoilTrial(race).mode, 'won');
  assert.deepEqual(race.recoil.result, solo.recoil.result);
  assert.deepEqual(race.recoil.race.recording, solo.recoil.race.recording);
  assert.deepEqual(race.player.position, solo.player.position);
  assert.equal(race.rng(), solo.rng());
  assert.equal(race.hp, solo.hp);
  assert.equal(writes, 0);
  assert.equal(Matter.Composite.allBodies(race.engine.world).length, before);
  assert.equal(race.shots.length, solo.shots.length);
});

test('pause and hitstop freeze the ghost, recording and split expiry on the same simulation clock', () => {
  const { recording } = recorded();
  const g = practice('cargo', 'pistol', recording);
  for (let i = 0; i < 30; i++) trialTick(g);
  const frame = g.recoil.race.frame,
    samples = structuredClone(g.recoil.race.frames),
    time = g.recoil.timeMs;
  g.recoil.race.feedback = { index: 0, deltaMs: -100, until: time + 1800 };
  g.setMode('paused');
  for (let i = 0; i < 180; i++) trialTick(g);
  assert.deepEqual(g.recoil.race.frame, frame);
  assert.deepEqual(g.recoil.race.frames, samples);
  assert(g.recoil.race.split);
  assert.equal(g.recoil.timeMs, time);
  g.setMode('playing');
  g.hitStop = 1;
  for (let i = 0; i < 30; i++) trialTick(g);
  assert.deepEqual(g.recoil.race.frame, frame);
  assert.deepEqual(g.recoil.race.frames, samples);
  assert.equal(g.recoil.timeMs, time);
});

test('ghost playback can be disabled, mismatched course/gun recordings are ignored, and menu/retry clean up', () => {
  const { recording } = recorded();
  const g = practice('cargo', 'pistol', recording, null, false);
  assert.equal(g.recoil.race.frame, null);
  g.recoil.race.feedback = { index: 0, deltaMs: 0, until: 1000 };
  assert.equal(g.recoil.race.split, null);
  assert.equal(pilotRecoilTrial(g).mode, 'won');
  assert(g.recoil.race.recording);
  g.setMode('title');
  assert.equal(g.recoil.race.ghost, null);
  assert.equal(g.recoil.race.recording, null);
  assert.equal(g.recoil.race.frames.length, 0);
  const other = practice('launch', 'pistol', recording);
  assert.equal(other.recoil.race.ghost, null);
  const otherGun = practice('cargo', 'shotgun', recording);
  assert.equal(otherGun.recoil.race.ghost, null);
  assert(g.recoil.startPractice('cargo', 'pistol', { clears: ['cargo'] }, recording));
  assert.equal(g.recoil.timeMs, 0);
  assert.equal(g.recoil.race.frames.length, 1);
});

test('cargo returns and early airborne landings discard prior attempt splits and mark playback discontinuities', () => {
  const g = practice('cargo');
  g.recoil.waypoint = 2;
  g.recoil.race.afterStep();
  assert.equal(g.recoil.race.splits.length, 2);
  Matter.Body.setPosition(g.player, { x: 720, y: 721 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  trialTick(g);
  assert.equal(g.recoil.attempts, 1);
  assert.deepEqual(g.recoil.race.splits, []);
  assert(g.recoil.race.frames.at(-1)![4] & 8);
  const air = practice('airborne');
  air.grounded = false;
  air.recoil.flying = true;
  air.hitEnemy(air.recoil.targets[0], 100);
  air.recoil.race.afterStep();
  assert.equal(air.recoil.race.splits.length, 1);
  air.grounded = true;
  air.recoil.afterStep();
  air.recoil.race.afterStep();
  assert.deepEqual(air.recoil.race.splits, []);
});

test('playback interpolates aim across the wrap, never slides across a return reset, and ends after a short finish hold', () => {
  const { recording } = recorded();
  const g = structuredClone(recording);
  g.frames = [
    [0, 170, 622, 179, 0],
    [100, 200, 612, -179, 0],
    [200, 170, 622, 0, 8],
    g.frames.at(-1)!,
  ];
  const middle = ghostFrameAt(g, 50)!;
  assert.equal(middle[1], 185);
  assert.equal(middle[2], 617);
  assert.equal(middle[3], 180);
  assert.equal(ghostFrameAt(g, 150)![1], 200);
  assert.equal(ghostFrameAt(g, 200)![1], 170);
  assert.equal(ghostFrameAt(g, g.timeMs + 801), null);
  assert.equal(ghostFrameAt(g, -1), null);
  assert.equal(ghostFrameAt(g, NaN), null);
});

test('only legitimate completed Practice runs record ghosts; Campaign, preview, death and forged wins do not', () => {
  const preset = recoilTrialCheckpoint('cargo');
  for (const isolated of [true, false]) {
    const g = new Game();
    g.start(preset.seed, preset, null, isolated ? preset : null);
    assert.equal(pilotRecoilTrial(g).mode, 'upgrade');
    assert.equal(g.recoil.race.recording, null);
    assert.equal(g.recoil.race.score, null);
  }
  const dead = practice('launch');
  dead.setMode('dead');
  assert.equal(dead.recoil.race.recording, null);
  const forged = practice('cargo');
  forged.setMode('won');
  assert.equal(forged.recoil.race.recording, null);
  assert.equal(forged.recoil.race.score, null);
});

test('recording limits release frames safely while long completed clears still produce a shareable timing target', () => {
  const g = practice('cargo');
  g.time = GHOST_DURATION / 1000 + 1;
  trialTick(g);
  assert.equal(g.recoil.race.frames.length, 0);
  assert.equal(pilotRecoilTrial(g).mode, 'won');
  assert.equal(g.recoil.race.recording, null);
  assert(g.recoil.race.score);
  assert.deepEqual(
    parseRecoilChallenge(recoilChallengeCode(g.recoil.race.score)),
    g.recoil.race.score,
  );
});

test('saved ghosts retain only the fastest matching gun/course, clone their data, and reject malformed or duplicate recordings', () => {
  const { recording: r } = recorded();
  const saved = recordRecoilGhost(null, r);
  assert(validRecoilGhosts(saved));
  assert.deepEqual(recordRecoilGhost(saved, r), saved);
  const worse = { ...r, shots: r.shots + 1 };
  assert.deepEqual(recordRecoilGhost(saved, worse), saved);
  const copy = loadRecoilGhosts(saved);
  copy[0].frames[0][1] = 999;
  assert.equal(loadRecoilGhosts(saved)[0].frames[0][1], 170);
  for (const bad of [
    { ...r, rules: 2 },
    { ...r, timeMs: -1 },
    { ...r, gun: 'unknown' },
    { ...r, kind: 'unknown' },
    { ...r, splits: [1] },
    { ...r, frames: [] },
    { ...r, frames: Array(GHOST_FRAME_LIMIT + 1).fill(r.frames[0]) },
    { ...r, frames: [[0, 0, 0, 0, 0], ...r.frames.slice(1)] },
    { ...r, frames: [...r.frames.slice(0, -1), [r.timeMs, 1000, 600, 0, 0]] },
    { ...r, extra: 1 },
  ])
    assert(!validRecoilGhost(bad));
  assert(!validRecoilGhosts([...saved, ...saved]));
  assert(!validRecoilGhosts(Array(10).fill(r)));
  for (const frames of ['{', 'null', '["bad"]', ' '.repeat(65537)]) {
    assert(!validRecoilGhosts([{ ...saved[0], frames }]));
    assert.deepEqual(loadRecoilGhosts([{ ...saved[0], frames }]), []);
  }
});

test('challenge codes and links round-trip real checkpoints, reject hostile data, and never grant course or weapon access', () => {
  const { recording } = recorded('airborne', 'nailgun'),
    ch = recoilChallenge(recording);
  assert.deepEqual(parseRecoilChallenge(recoilChallengeCode(ch)), ch);
  assert.deepEqual(parseRecoilChallenge(recoilChallengeLink(ch)), ch);
  assert.deepEqual(recoilChallengeFromUrl(new URL(recoilChallengeLink(ch))), ch);
  assert.deepEqual(recoilChallengeFromUrl(new URL(recoilChallengeLink(ch) + '&progress=1')), ch);
  assert(!recoilChallengeAccess(ch, null, guns));
  assert(!recoilChallengeAccess(ch, { clears: ['airborne'] }, ['pistol']));
  assert(recoilChallengeAccess(ch, { clears: ['airborne'] }, guns));
  assert.match(recoilChallengePreview(ch, null, ['pistol']), /Clear this course in Campaign/);
  assert.match(
    recoilChallengePreview(ch, { clears: ['airborne'] }, ['pistol']),
    /Complete Overtime/,
  );
  for (const bad of [
    'RFT1.invalid',
    'RFT2.foo',
    'RFT1.' + 'a'.repeat(513),
    recoilChallengeLink(ch) + '&seed=other',
    recoilChallengeLink(ch) + '&recoil=other',
    recoilChallengeCode(ch) + '=',
    'RFT1.' + btoa(JSON.stringify([2, ch.kind, ch.gun, ch.timeMs, ch.shots, ch.splits])),
    'RFT1.' + btoa(JSON.stringify([1, '<script>', ch.gun, ch.timeMs, ch.shots, ch.splits])),
    'RFT1.' + btoa(JSON.stringify([1, ch.kind, ch.gun, 1, ch.shots, [100, 200, 300]])),
  ])
    assert.throws(() => parseRecoilChallenge(bad));
  assert.equal(
    recoilChallengeFromUrl(new URL(recoilChallengeLink(ch) + '&test=recoil-trial')),
    null,
  );
});

test('a shared challenge preserves its starting gun and target across retries without paying campaign rewards', () => {
  const { recording } = recorded('cargo', 'shotgun'),
    ch = recoilChallenge(recording);
  const g = practice('cargo', 'shotgun', recording, ch);
  let checkpoints = 0;
  g.onCheckpoint = () => checkpoints++;
  assert.equal(pilotRecoilTrial(g).mode, 'won');
  assert.deepEqual(g.recoil.race.challenge, ch);
  assert.equal(g.recoil.race.target!.timeMs, ch.timeMs);
  assert.equal(checkpoints, 0);
  assert.equal(g.mods.length, 0);
  const target = g.recoil.race.challenge;
  assert(g.recoil.startPractice('cargo', 'shotgun', { clears: ['cargo'] }, recording, target));
  assert.deepEqual(g.recoil.race.challenge, ch);
  assert.equal(g.recoil.timeMs, 0);
  assert(!g.recoil.startPractice('launch', 'shotgun', { clears: ['launch'] }, null, ch));
  assert(!g.recoil.startPractice('cargo', 'pistol', { clears: ['cargo'] }, null, ch));
  assert.equal(recoilDelta(-1234), '1.23s ahead');
  assert.equal(recoilDelta(200), '0.20s behind');
  assert.equal(recoilDelta(0), 'Level with target');
});

test('ghost backups round-trip, old backups migrate, and all nine maximum recordings fit within the existing backup bound', async () => {
  const { g, recording } = recorded();
  const disk = store();
  await disk.write(RECOIL_GHOSTS_KEY, [recording]);
  await disk.write(RECOIL_TRIALS_KEY, recordRecoilTrial(null, g.recoil.result!).profile);
  const saved = parseProgressBackup(disk.backup('4.7.0'));
  assert.deepEqual(loadRecoilGhosts(saved.values[RECOIL_GHOSTS_KEY]), [recording]);
  const old = { ...saved.values };
  delete (old as Partial<typeof old>)[RECOIL_GHOSTS_KEY];
  assert.deepEqual(validateProgress(old)![RECOIL_GHOSTS_KEY], []);
  assert.equal(
    validateProgress({ ...saved.values, [RECOIL_GHOSTS_KEY]: [recording, recording] }),
    null,
  );
  const maximum = kinds.flatMap((kind) =>
    guns.map((gun) => {
      const { recording: r } = recorded(kind, gun);
      const last = r.frames.at(-1)!;
      return {
        ...r,
        timeMs: GHOST_DURATION,
        frames: [
          r.frames[0],
          ...Array.from(
            { length: GHOST_FRAME_LIMIT - 2 },
            (_, i) =>
              [(i + 1) * 87, 1987, -602, 180, 15] as [number, number, number, number, number],
          ),
          [GHOST_DURATION, last[1], last[2], last[3], last[4]] as [
            number,
            number,
            number,
            number,
            number,
          ],
        ],
      };
    }),
  );
  assert(validRecoilGhosts(maximum));
  await disk.write(RECOIL_GHOSTS_KEY, maximum);
  assert(disk.backup('4.7.0').length < BACKUP_LIMIT);
  assert.deepEqual(
    loadRecoilGhosts(parseProgressBackup(disk.backup('4.7.0')).values[RECOIL_GHOSTS_KEY]),
    maximum,
  );
  const campaign = recoilTrialCheckpoint('cargo');
  assert(loadCheckpoint(campaign));
  await disk.write(CHECKPOINT_KEY, campaign);
  assert.deepEqual(parseProgressBackup(disk.backup('4.7.0')).values[CHECKPOINT_KEY], campaign);
});
