import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { loadCheckpoint, getGun, MODS, type Checkpoint } from '../src/rules.ts';
import {
  RECOIL_TRIALS,
  RECOIL_TRIALS_KEY,
  planRecoilTrial,
  recoilTrialCheckpoint,
  recoilTrialFromUrl,
  loadRecoilProfile,
  recordRecoilTrial,
  validRecoilProfile,
  recoilRecordKey,
  type RecoilTrialKind,
} from '../src/recoil-trial-rules.ts';
import { recoilTrialLevel } from '../src/recoil-trial-layouts.ts';
import { trialTick, pilotRecoilTrial } from './helpers/recoil-trial-pilot.ts';
import { dailyForDate } from '../src/daily.ts';
import { COMMENDATIONS } from '../src/commendations.ts';
import { commendationRewards, REWARD_CATALOG } from '../src/run-rewards.ts';
import { loadCosmetics } from '../src/cosmetics.ts';
import { logbookCatalog } from '../src/logbook-catalog.ts';
import { loadLogbook } from '../src/logbook.ts';
import { encounterArchive } from '../src/archive.ts';
import { archiveCheckpoint } from '../src/archive-images.ts';
import {
  ProgressStore,
  validateProgress,
  parseProgressBackup,
  progressSummary,
} from '../src/progress.ts';
import { snapshotRun, loadRunHistory } from '../src/run-history.ts';
import { STARTING_GUN_IDS, type StartingGun } from '../src/starting-guns.ts';
const { Body, Composite } = Matter;
const kinds = Object.keys(RECOIL_TRIALS) as RecoilTrialKind[];
function course(kind: RecoilTrialKind, gun: StartingGun = 'pistol', isolated = true) {
  const s = recoilTrialCheckpoint(kind, gun);
  assert(loadCheckpoint(s));
  const g = new Game();
  g.start(s.seed, s, null, isolated ? s : null);
  return g;
}
function save(g: Game) {
  let checkpoint: Checkpoint | null = null;
  g.onCheckpoint = (s) => {
    checkpoint = s;
  };
  g.save();
  assert(checkpoint);
  assert(loadCheckpoint(checkpoint));
  return checkpoint as Checkpoint;
}
test('trial plans stay outside the first zone, avoid maintenance doors, and use an independent seed stream', () => {
  const courses = new Set(),
    stages = new Set();
  for (let i = 0; i < 120; i++)
    for (const maintenance of [undefined, 2, 6, 18]) {
      const s = planRecoilTrial('trial-plan-' + i, maintenance)!;
      assert.deepEqual(s, planRecoilTrial('trial-plan-' + i, maintenance));
      assert(s.stage >= 6 && [6, 18].includes(s.stage));
      assert.notEqual(s.stage, maintenance);
      courses.add(s.kind);
      stages.add(s.stage);
    }
  assert.equal(courses.size, 3);
  assert.equal(stages.size, 2);
  assert.equal(planRecoilTrial(dailyForDate('2026-10-04')!.seed), null);
  const g = new Game();
  g.start('fresh-trial-plan');
  assert(g.recoil.state);
  assert(!g.recoil.active && !g.recoil.scheduled);
  assert(!g.level.recoilTrial);
  const old = {
    version: 6 as const,
    seed: 'old-no-trial',
    stage: 0,
    mods: [],
    hp: 100,
    kills: 0,
    elapsed: 0,
  };
  g.start(old.seed, old);
  assert.equal(g.recoil.state, null);
  g.start('old-replay', undefined, null, null, false, 0, true, [], null, 'pistol', 1, false);
  assert.equal(g.recoil.state, null);
});
for (const kind of kinds)
  for (const gun of STARTING_GUN_IDS) {
    test(kind + ' can be completed with ordinary controls and the unmodified ' + gun, () => {
      const g = course(kind, gun);
      let writes = 0,
        clears = 0;
      g.onCheckpoint = () => writes++;
      g.recoil.onComplete = () => clears++;
      const r = pilotRecoilTrial(g);
      assert.equal(r.mode, 'upgrade', JSON.stringify(r));
      assert(r.hp > 0);
      assert(g.recoil.done && g.recoil.result);
      assert(g.recoil.result.timeMs > 2000 && g.shotCount > 0);
      assert.equal(g.kills, 0);
      assert.equal(writes, 0);
      assert.equal(clears, 0);
      assert(g.shots.every((s) => s.friendly));
      assert(!g.waves.pending);
    });
  }
test('three course layouts have distinct geometry, ordered landing goals, and no combat roster or loose props', () => {
  const layouts = kinds.map(recoilTrialLevel);
  assert.equal(new Set(layouts.map((l) => JSON.stringify(l.solids))).size, 3);
  for (const l of layouts) {
    assert.equal(l.spawns.length, 0);
    assert.equal(l.setpiece!.props.length, 0);
    assert(l.detour);
  }
  const g = course('launch');
  const door = g.recoil.exit;
  Body.setPosition(g.player, { x: door.x, y: door.floor - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 60; i++) trialTick(g);
  assert.equal(g.mode, 'playing');
  assert(!g.clear && !g.recoil.done);
  assert.equal(g.recoil.waypoint, 0);
});
test('scheduled courses use the existing upper door and regular reward; the ground exit skips them', () => {
  for (const stage of [6, 18] as const) {
    const checkpoint = recoilTrialCheckpoint('cargo');
    checkpoint.stage = stage;
    checkpoint.recoilTrial!.stage = stage;
    delete checkpoint.detour;
    checkpoint.mods = stage === 18 ? MODS.slice(0, 7).map((m) => m.id) : [];
    checkpoint.missedUpgrades = stage - checkpoint.mods.length;
    assert(loadCheckpoint(checkpoint));
    const g = new Game();
    g.start(checkpoint.seed, checkpoint);
    assert(g.recoil.scheduled && g.canDetour && !g.recoil.active);
    // Resolve this main-room combat fixture. New-course traversal is covered
    // above with ordinary controls and all three starting guns.
    for (let i = 0; i < 600 && !g.clear; i++) {
      for (const e of [...g.enemies]) {
        e.spawn = 0;
        g.hitEnemy(e, 999999);
      }
      g.hitStop = 0;
      trialTick(g);
    }
    assert(g.clear && !g.waves.pending);
    const cleared = save(g);
    Body.setPosition(g.player, { x: g.branchDoor.x, y: g.branchDoor.floor - 18 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    for (let i = 0; i < 90 && g.mode === 'playing'; i++) trialTick(g);
    assert.equal(g.mode, 'upgrade');
    assert(g.enteringDetour);
    g.chooseMod(g.offers[0].id);
    assert.equal(g.stage, stage);
    assert(g.recoil.active && g.detour);
    assert.equal(g.level.recoilTrial, 'cargo');
    assert.equal(g.mods.length, checkpoint.mods.length + 1);
    assert(loadCheckpoint(save(g)));

    const skip = new Game();
    skip.start(cleared.seed, cleared);
    for (let i = 0; i < 600 && !skip.clear; i++) {
      for (const e of [...skip.enemies]) {
        e.spawn = 0;
        skip.hitEnemy(e, 999999);
      }
      skip.hitStop = 0;
      trialTick(skip);
    }
    assert(skip.clear && !skip.waves.pending);
    Body.setPosition(skip.player, { x: 1930, y: 722 });
    Body.setVelocity(skip.player, { x: 0, y: 0 });
    for (let i = 0; i < 90 && skip.mode === 'playing'; i++) trialTick(skip);
    assert.equal(skip.mode, 'upgrade');
    assert(!skip.enteringDetour);
    skip.chooseMod(skip.offers[0].id);
    assert.equal(skip.stage, stage + 1);
    assert(!skip.detour && !skip.recoil.active);
    assert.equal(skip.mods.length, checkpoint.mods.length + 1);
    assert(loadCheckpoint(save(skip)));
  }
});

test('cargo floor returns the player safely, clears flight shots, and invalidates mastery without stopping the timer', () => {
  const g = course('cargo');
  for (let i = 0; i < 90; i++) trialTick(g);
  const before = g.recoil.timeMs,
    hp = g.hp;
  g.recoil.waypoint = 3;
  Body.setPosition(g.player, { x: 720, y: 721 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  trialTick(g);
  assert.equal(g.recoil.waypoint, 0);
  assert.equal(g.recoil.state!.clean, false);
  assert.equal(g.recoil.attempts, 1);
  assert.equal(g.hp, hp);
  assert(g.player.position.x < 320);
  assert(g.recoil.timeMs > before);
  assert.equal(g.shots.length, 0);
});
test('air targets ignore ground fire and cleanup, reset after landing, and grant no enemy kills, healing or discoveries', () => {
  const g = course('airborne', 'pistol', false);
  let discoveries = 0;
  g.onEnemyDefeated = () => discoveries++;
  g.onEnemyEncountered = () => discoveries++;
  g.mods = ['leech'];
  g.gun = getGun(g.mods);
  g.hp = 73;
  const e = g.recoil.targets[0];
  g.grounded = true;
  assert(g.hitEnemy(e, 100));
  assert.equal(e.hp, 1);
  g.recoil.flying = true;
  g.grounded = false;
  assert(g.hitEnemy(e, 100, undefined, true, true, true, 'cleanup'));
  assert.equal(e.hp, 1);
  g.hitEnemy(e, 100);
  assert.equal(g.kills, 0);
  assert.equal(g.hp, 73);
  assert.equal(discoveries, 0);
  g.grounded = true;
  g.recoil.afterStep();
  assert.equal(g.recoil.targets.length, 3);
  assert(g.recoil.targets.every((t) => t.hp === 1));
  assert.equal(g.recoil.state!.clean, false);
  assert.equal(g.recoil.attempts, 1);
});
test('campaign completion pays one bonus without healing, then resumes the next main room exactly once', () => {
  const g = course('cargo', 'pistol', false);
  g.hp = 61;
  let completes = 0;
  g.recoil.onComplete = () => completes++;
  assert.equal(pilotRecoilTrial(g).mode, 'upgrade');
  assert.equal(completes, 1);
  assert.equal(g.hp, 61);
  const pending = save(g),
    elapsed = g.recoil.result!.timeMs;
  const resumed = new Game();
  resumed.start(pending.seed, pending);
  assert.equal(resumed.mode, 'upgrade');
  assert.equal(resumed.recoil.result!.timeMs, elapsed);
  assert(resumed.recoil.done);
  resumed.chooseMod(resumed.offers[0].id);
  assert.equal(resumed.stage, 7);
  assert(!resumed.detour && !resumed.recoil.active);
  assert.equal(resumed.mods.length, 1);
  assert.equal(resumed.hp, 61);
  assert.deepEqual(resumed.detours, [1]);
  const after = save(resumed);
  resumed.chooseMod(pending.reward!.offers[0]);
  assert.deepEqual(save(resumed), after);
  assert.equal(completes, 1);
});
test('leaving a trial skips only its bonus, preserves the gun and health, and produces a valid next-room save', () => {
  const g = course('launch', 'shotgun', false);
  g.hp = 52;
  g.setMode('paused');
  assert(g.recoil.abandon());
  assert.equal(g.stage, 7);
  assert.equal(g.mode, 'playing');
  assert(!g.detour);
  assert.equal(g.mods.length, 0);
  assert.equal(g.startingGun, 'shotgun');
  assert.equal(g.hp, 52);
  assert.equal(g.missedUpgrades, 8);
  assert(!g.recoil.abandon());
  assert(loadCheckpoint(save(g)));
});
test('Continue retains accepted damage, accumulated time and shots; pause freezes course machinery and score', () => {
  const g = course('launch', 'pistol', false);
  for (let i = 0; i < 90; i++) trialTick(g, { jump: i === 2, fire: true });
  g.damagePlayer(5);
  g.setMode('paused');
  const state = save(g);
  const ms = g.recoil.timeMs,
    positions = g.hazards.items.map((h) => ({ ...h.body.position }));
  for (let i = 0; i < 120; i++) trialTick(g, { fire: true, jump: true });
  assert.equal(g.recoil.timeMs, ms);
  assert.deepEqual(
    g.hazards.items.map((h) => h.body.position),
    positions,
  );
  const next = new Game();
  next.start(state.seed, state);
  assert.equal(next.recoil.state!.clean, false);
  assert.equal(next.recoil.timeMs, ms);
  assert.equal(next.recoil.shots, g.recoil.shots);
  assert.equal(next.hp, g.hp);
  assert.equal(next.recoil.waypoint, 0);
});
test('practice requires a campaign clear and records actual completion without writing campaign checkpoints', () => {
  const g = new Game();
  let writes = 0,
    completed = 0;
  g.onCheckpoint = () => writes++;
  g.recoil.onComplete = () => completed++;
  assert.equal(g.recoil.startPractice('cargo', 'pistol', null), false);
  assert(
    g.recoil.startPractice('cargo', 'pistol', { clears: ['cargo'], mastered: [], records: [] }),
  );
  assert.equal(pilotRecoilTrial(g).mode, 'won');
  assert.equal(writes, 0);
  assert.equal(completed, 1);
  assert(g.testRun && g.recoil.practice);
  assert.equal(g.stage, 6);
  assert.equal(g.mods.length, 0);
  assert.equal(g.canOvertime, false);
});
test('records compare matching guns and builds, retain faster times, award mastery once, and reject malformed data', () => {
  const r = {
    kind: 'cargo' as const,
    gun: 'pistol' as const,
    mods: [],
    timeMs: 10000,
    shots: 12,
    clean: true,
  };
  const first = recordRecoilTrial(null, r);
  assert(first.best && first.newMastery);
  assert(validRecoilProfile(first.profile));
  const repeated = recordRecoilTrial(first.profile, { ...r, timeMs: 11000 });
  assert(!repeated.best && !repeated.newMastery);
  assert.equal(repeated.profile.records[0].timeMs, 10000);
  const other = recordRecoilTrial(first.profile, { ...r, mods: ['kick'], timeMs: 8000 });
  assert.equal(other.profile.records.length, 2);
  assert.notEqual(recoilRecordKey(r), recoilRecordKey({ ...r, gun: 'nailgun' }));
  assert.equal(
    recoilRecordKey({ ...r, mods: ['kick', 'rapid'] }),
    recoilRecordKey({ ...r, mods: ['rapid', 'kick'] }),
  );
  assert.equal(recordRecoilTrial(null, { ...r, clean: false }).newMastery, false);
  assert.equal(recordRecoilTrial(null, { ...r, timeMs: 31000 }).newMastery, false);
  assert.equal(validRecoilProfile({ ...first.profile, records: [{ ...r, timeMs: NaN }] }), false);
  assert.equal(validRecoilProfile({ ...first.profile, clears: ['cargo', 'cargo'] }), false);
  assert.throws(() => recordRecoilTrial(null, { ...r, mods: ['unknown'] }));
  assert.deepEqual(loadRecoilProfile(null), { clears: [], mastered: [], records: [] });
});
test('all three mastery rewards use real appearance catalog entries, remain locked initially, and appear in the Logbook', () => {
  for (const kind of kinds) {
    const id = RECOIL_TRIALS[kind].commendation;
    assert(COMMENDATIONS.some((c) => c.id === id));
    const rewards = commendationRewards(id);
    assert.equal(rewards.length, 1);
    assert(REWARD_CATALOG.some((r) => r.id === rewards[0]));
    const [, slot, style] = rewards[0].split(':');
    assert.notEqual(loadCosmetics({ [slot]: style }, [])[slot as 'gun' | 'outfit'], style);
    assert.equal(loadCosmetics({ [slot]: style }, [id])[slot as 'gun' | 'outfit'], style);
    const profile = recordRecoilTrial(null, {
      kind,
      gun: 'pistol',
      mods: [],
      timeMs: 10000,
      shots: 20,
      clean: true,
    }).profile;
    const entries = logbookCatalog(
      [],
      loadLogbook(null),
      [id],
      encounterArchive(null, ['trial:' + kind]),
      [],
      null,
      undefined,
      profile,
    );
    const entry = entries.find((e) => e.id === 'trial:' + kind)!;
    assert.equal(entry.state, 'known');
    assert.match(entry.lore[2], /Service pistol/);
    assert.match(entry.lore[2], /no upgrades/);
    const photo = new Game();
    const checkpoint = archiveCheckpoint(entry.id);
    photo.startTest(checkpoint);
    assert.equal(photo.level.recoilTrial, kind);
    assert.equal(photo.level.id, recoilTrialLevel(kind).id);
  }
});
test('profile backups preserve trial records and older backups without the new key remain compatible', async () => {
  const items = new Map<string, string>();
  const storage = {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => {
      items.set(k, v);
    },
    removeItem: (k: string) => {
      items.delete(k);
    },
  };
  const store = new ProgressStore(() => storage);
  const profile = recordRecoilTrial(null, {
    kind: 'cargo',
    gun: 'pistol',
    mods: [],
    timeMs: 10000,
    shots: 10,
    clean: true,
  }).profile;
  await store.write(RECOIL_TRIALS_KEY, profile);
  const backup = store.backup('4.6.0');
  const parsed = parseProgressBackup(backup);
  assert.deepEqual(parsed.values[RECOIL_TRIALS_KEY], profile);
  assert.equal(progressSummary(parsed.values).recoilTrials, 1);
  assert.equal(progressSummary(parsed.values).recoilRecords, 1);
  const old = { ...parsed.values };
  delete (old as Partial<typeof old>)[RECOIL_TRIALS_KEY];
  assert(validateProgress(old));
  assert.equal(
    validateProgress({
      ...parsed.values,
      [RECOIL_TRIALS_KEY]: { ...profile, mastered: ['launch'] },
    }),
    null,
  );
});
test('strict isolated links reject mixed or duplicated parameters and checkpoint validation rejects unsupported trial state', () => {
  for (const kind of kinds)
    for (const gun of ['pistol', 'shotgun', 'nailgun'])
      assert(
        loadCheckpoint(
          recoilTrialFromUrl(
            new URL('https://test/?test=recoil-trial&course=' + kind + '&gun=' + gun + '&v=1'),
          ),
        ),
      );
  for (const q of [
    'course=unknown',
    'course=cargo&gun=unknown',
    'course=cargo&course=launch',
    'course=cargo&seed=other',
    'course=cargo&daily=1',
    'course=cargo&v=2',
  ])
    assert.equal(recoilTrialFromUrl(new URL('https://test/?test=recoil-trial&' + q)), null);
  const s = recoilTrialCheckpoint('cargo');
  for (const recoilTrial of [
    { ...s.recoilTrial, stage: 2 },
    { ...s.recoilTrial, rules: 2 },
    { ...s.recoilTrial, spent: -1 },
    { ...s.recoilTrial, clean: 'yes' },
  ])
    assert.equal(loadCheckpoint({ ...s, recoilTrial }), null);
});
test('Recent runs preserve trial eligibility for seed replay without opting older runs into new courses', () => {
  const g = new Game();
  g.start('trial-history');
  g.setMode('dead');
  const r = snapshotRun(g, 'trial-history', 1)!;
  assert(r.recoilTrials);
  const old = { ...r };
  delete old.recoilTrials;
  assert.equal(loadRunHistory([old])[0].recoilTrials, undefined);
  assert.equal(
    loadRunHistory([{ ...r, mode: 'daily', seed: dailyForDate('2026-10-04')!.seed }]).length,
    0,
  );
  g.setMode('title');
  assert.equal(
    Composite.allBodies(g.engine.world).filter((b) => b.label === 'enemy').length,
    g.enemies.length,
  );
});
