import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { playRoom } from './room-pilot.ts';
import { loadCheckpoint } from '../src/rules.ts';
import { quickShiftFromSeed, planQuickShift, quickShiftOffers } from '../src/quick-shift-rules.ts';
import {
  loadQuickShiftContinue,
  quickShiftLevel,
  validQuickShiftContinue,
} from '../src/quick-shift.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1300, y: 400 },
};
function ticks(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function begin(code = 'NATIVE') {
  const g = new Game();
  assert(g.quickShift.begin(quickShiftFromSeed('RF-Q1-' + code)!, 'pistol'));
  return g;
}
function draft(g: Game) {
  while (g.quickShift.state?.phase === 'draft')
    assert(g.quickShift.chooseMod(g.quickShift.state.offers[0]));
  if (g.quickShift.state?.phase === 'route') assert(g.quickShift.chooseRoute('high'));
  if (g.quickShift.state?.phase === 'job') assert(g.quickShift.chooseJob('accept'));
}
// Resolve native cohorts through normal damage/death handling, rather than deleting
// enemies or pending reinforcements. Gameplay/geometry checks remain separate.
function resolve(g: Game) {
  assert.equal(g.quickShift.state?.phase, 'fight');
  const round = g.quickShift.state!.round;
  for (let i = 0; i < 7000 && g.quickShift.state?.phase === 'fight'; i++) {
    g.hp = 100;
    if (round !== 4 && g.clear) Matter.Body.setPosition(g.player, { x: 1920, y: 722 });
    for (const e of [...g.enemies]) if (e.spawn <= 0) g.hitEnemy(e, 100000);
    ticks(g);
  }
  assert.notEqual(
    g.quickShift.state?.phase,
    'fight',
    'native cohorts, boss transition and exit must resolve',
  );
}

test('starts with three legal drafts and reconstructs all five native encounter types', () => {
  const g = begin();
  assert.equal(g.mode, 'upgrade');
  assert.equal(g.quickShift.state!.draftRemaining, 3);
  assert(!g.quickShift.chooseMod('citywide-explosion'));
  draft(g);
  assert.equal(g.quickShift.state!.mods.length, 3);
  assert.equal(g.mode, 'playing');
  assert(g.testRun?.rematchRoom);
  assert.equal(g.waves.plan?.flow, true);
  assert(g.waves.pending);
  assert.equal(g.encounters, 1);
  assert.equal(g.overtime, null);
  assert.equal(g.practice, null);
  assert.equal(g.shiftRun.state, null);
  assert.equal(g.shiftRun.junction, false);
  const plan = planQuickShift(g.quickShift.state!.challenge);
  const seen: string[] = [];
  for (let round = 0; round < 5; round++) {
    assert.equal(g.quickShift.state!.round, round);
    assert.equal(g.quickShift.state!.mods.length, 3 + round * 2);
    assert(g.level.solids.length > 0);
    assert(g.terrainBodies.length > 4);
    assert.deepEqual(g.level, quickShiftLevel(g.quickShift.state!));
    seen.push(g.level.id);
    if (round === 4) {
      assert.equal(g.level.bossRemaster, plan.boss);
      assert(g.bossRemaster.rig);
      assert(g.enemies.some((e) => e.kind === plan.boss));
    }
    resolve(g);
    if (round < 4) draft(g);
  }
  assert.equal(new Set(seen).size, 5);
  assert.equal(g.quickShift.state!.phase, 'complete');
  assert.equal(g.mode, 'won');
  assert.equal(g.quickShift.result!.outcome, 'won');
  assert.equal(g.quickShift.result!.rooms, 5);
  assert.equal(g.quickShift.result!.mods.length, 11);
  assert.equal(g.quickShift.result!.route, 'high');
  assert.equal(g.quickShift.result!.job, 'accept');
  assert(g.quickShift.result!.timeMs > 0);
  assert(g.quickShift.result!.kills >= 5);
  assert(!g.quickShift.update());
  assert(!g.quickShift.chooseMod('magnum'));
});

test('five-room victory emits no ordinary saves, Campaign clear, encounter, boss or unlock awards', () => {
  const g = new Game();
  let saves = 0,
    awards = 0;
  g.onCheckpoint = () => saves++;
  g.onCampaignClear = () => awards++;
  g.onBossDefeated = () => awards++;
  g.onEnemyDefeated = () => awards++;
  g.onEnemyEncountered = () => awards++;
  g.onCommendation = () => awards++;
  assert(g.quickShift.begin(quickShiftFromSeed('RF-Q1-ISOLATED')!, 'pistol'));
  draft(g);
  for (let i = 0; i < 5; i++) {
    resolve(g);
    if (i < 4) draft(g);
  }
  assert.equal(saves, 0);
  assert.equal(awards, 0);
  assert.equal(g.canOvertime, false);
  assert.equal(g.escape, null);
});

test('resume preserves every sequential draft and choice without advancing the room', () => {
  const g = begin('RESUME');
  for (let i = 0; i < 3; i++) {
    const saved = g.quickShift.snapshot();
    assert(saved);
    assert(validQuickShiftContinue(saved));
    assert(loadCheckpoint(saved.checkpoint));
    const restored = new Game();
    assert(restored.quickShift.resume(saved));
    assert.equal(restored.mode, 'upgrade');
    assert.deepEqual(restored.quickShift.state, g.quickShift.state);
    assert(g.quickShift.chooseMod(g.quickShift.state!.offers[0]));
  }
  resolve(g);
  draft(g);
  resolve(g);
  draft(g);
  resolve(g);
  // Third intermission: two picks then optional job.
  draft(g);
  assert.equal(g.quickShift.state!.round, 3);
  assert.equal(g.quickShift.state!.job, 'accepted');
  const paused = g.quickShift.snapshot();
  assert(paused);
  const again = new Game();
  assert(again.quickShift.resume(paused));
  assert.equal(again.level.id, g.level.id);
  assert.equal(again.quickShift.state!.job, 'accepted');
  assert.deepEqual(again.mods, g.mods);
});

test('paused combat Continue retries room entry, preserving spent time, hits and shots', () => {
  const g = begin('COMBAT');
  draft(g);
  ticks(g, 60);
  const entry = g.hp;
  g.hurtAt = -10;
  g.damagePlayer(9);
  g.fire();
  ticks(g, 10);
  g.setMode('paused');
  const before = g.quickShift.snapshot();
  assert(before);
  assert.equal(before.state.hp, entry);
  assert.equal(before.state.hits, 1);
  assert(before.state.timeMs >= 1000);
  assert(before.state.roomTimeMs >= 1000);
  const copy = new Game();
  assert(copy.quickShift.resume(before));
  assert.equal(copy.mode, 'playing');
  assert.equal(copy.hp, entry);
  assert.equal(copy.time, 0);
  assert.equal(copy.elapsed, before.state.timeMs / 1000);
  assert.equal(copy.quickShift.state!.hits, 1);
  assert.equal(copy.quickShift.state!.shots, before.state.shots);
  assert.equal(copy.level.id, g.level.id);
  assert(copy.enemies.length > 0);
  assert(copy.waves.pending);
  assert.deepEqual(g.quickShift.snapshot(), before, 'snapshots do not mutate the live run');
});

test('strict own Continue rejects injected worlds, awards, early mods, wrong seed and bad counters', () => {
  const g = begin('VALIDATE');
  draft(g);
  const saved = g.quickShift.snapshot();
  assert(saved);
  const alter = (mutate: (s: any) => void) => {
    const copy = structuredClone(saved);
    mutate(copy);
    assert.equal(loadQuickShiftContinue(copy), null);
  };
  alter((v) => (v.checkpoint.overtime = { baseMods: 19, repairs: 0 }));
  alter((v) => (v.checkpoint.rematchRoom = g.level));
  alter((v) => (v.checkpoint.seed = 'RF-C108-CAMPAIGN'));
  alter((v) => (v.state.challenge.code = 'DIFFERENT'));
  alter((v) => (v.state.hits = -1));
  alter((v) => (v.state.round = 4));
  alter((v) => (v.state.phase = 'complete'));
  alter((v) => {
    v.state.mods = ['rapid', 'magnum', 'fission'];
    v.checkpoint.mods = [...v.state.mods];
  });
  alter((v) => (v.state.offers = ['magnum']));
  alter((v) => (v.state.preview = true));
  assert(g.quickShift.resume(saved));
  assert.equal(g.mode, 'playing');
});

test('death records a local failure, preview remains private and Campaign start clears the mode', () => {
  const g = begin('DEATH');
  draft(g);
  g.hurtAt = -10;
  g.damagePlayer(1000);
  assert.equal(g.mode, 'dead');
  assert.equal(g.quickShift.state!.phase, 'dead');
  assert.equal(g.quickShift.result!.outcome, 'dead');
  assert.equal(g.quickShift.result!.rooms, 0);
  assert.equal(g.quickShift.snapshot(), null);
  g.start('RF-C108-NORMAL');
  assert.equal(g.quickShift.state, null);
  assert.equal(g.testRun, null);
  const p = new Game();
  assert(p.quickShift.begin(quickShiftFromSeed('RF-Q1-PREVIEW')!, 'pistol', true));
  draft(p);
  p.hurtAt = -10;
  p.damagePlayer(1000);
  assert.equal(p.quickShift.result!.outcome, 'dead');
  assert.equal(p.quickShift.state!.preview, true);
  assert.equal(p.quickShift.snapshot(), null);
});

test('clear requires remaining waves, correct build and actual final boss credit', () => {
  const g = begin('GUARDS');
  draft(g);
  g.clear = true;
  g.clearAt = -1;
  Matter.Body.setPosition(g.player, { x: 1920, y: 722 });
  assert(!g.quickShift.update());
  assert.equal(g.quickShift.state!.cleared, 0);
  g.clear = false;
  resolve(g);
  draft(g);
  resolve(g);
  draft(g);
  resolve(g);
  draft(g);
  resolve(g);
  draft(g);
  assert.equal(g.quickShift.state!.round, 4);
  const boss = g.enemies[0];
  Matter.Composite.remove(g.engine.world, boss.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.clearAt = -2;
  ticks(g, 110);
  assert.equal(g.quickShift.state!.phase, 'fight');
  assert.equal(g.quickShift.result, null);
});

for (const kind of ['loader', 'crane', 'press', 'kiln'] as const)
  test(kind + ' keeps all native phases and arena machinery in Quick Shift', () => {
    let challenge = quickShiftFromSeed('RF-Q1-B0')!;
    for (let i = 0; i < 100; i++) {
      const c = quickShiftFromSeed('RF-Q1-B' + i.toString(36).toUpperCase())!;
      if (planQuickShift(c).boss === kind) {
        challenge = c;
        break;
      }
    }
    assert.equal(planQuickShift(challenge).boss, kind);
    const g = new Game();
    assert(g.quickShift.begin(challenge, 'pistol'));
    draft(g);
    for (let i = 0; i < 4; i++) {
      resolve(g);
      draft(g);
    }
    const rig = g.bossRemaster.rig!;
    assert(rig);
    assert.equal(g.level.bossRemaster, kind);
    const enemy = g.enemies.find((e) => e.kind === kind)!;
    assert.equal(rig.phase, 0);
    enemy.hp = enemy.maxHp * 0.57;
    ticks(g, 150);
    assert(rig.phase >= 1);
    enemy.hp = enemy.maxHp * 0.2;
    ticks(g, 180);
    assert.equal(rig.phase, 2);
    assert(g.level.solids.length > 3);
    assert(g.props.items.length > 0);
    resolve(g);
    assert.equal(g.quickShift.result!.outcome, 'won');
  });

test('an opening patrol can be cleared with ordinary movement and firing on a legal draft', () => {
  const g = begin('INPUT');
  draft(g);
  const play = playRoom(g, 100);
  assert(play.clear, JSON.stringify(play));
  assert(g.hp > 0);
  assert(g.shotCount > 0);
  assert(g.kills > 0);
  assert.equal(g.quickShift.state!.cleared, 0, 'walking to exit remains the commitment');
  for (let i = 0; i < 1800 && g.quickShift.state!.phase === 'fight'; i++) {
    const p = g.player.position;
    g.tick(1 / 60, {
      ...idle,
      right: true,
      jump: g.grounded && p.x < 1850,
      jumpHeld: true,
      fire: p.x < 1850,
      aim: { x: p.x, y: p.y + 300 },
    });
  }
  assert.equal(g.quickShift.state!.cleared, 1, 'ordinary traversal reaches the native exit');
});

test('route and optional job screens resume as the same choice without Campaign offices', () => {
  const g = begin('CHOICES');
  draft(g);
  resolve(g);
  while (g.quickShift.state!.phase === 'draft')
    assert(g.quickShift.chooseMod(g.quickShift.state!.offers[0]));
  assert.equal(g.quickShift.state!.phase, 'route');
  const route = g.quickShift.snapshot();
  assert(route);
  const r = new Game();
  assert(r.quickShift.resume(route));
  assert.equal(r.quickShift.state!.phase, 'route');
  assert.equal(r.mode, 'upgrade');
  assert(r.quickShift.chooseRoute('low'));
  assert.equal(r.shiftRun.junction, false);
  resolve(r);
  draft(r);
  resolve(r);
  while (r.quickShift.state!.phase === 'draft')
    assert(r.quickShift.chooseMod(r.quickShift.state!.offers[0]));
  assert.equal(r.quickShift.state!.phase, 'job');
  const job = r.quickShift.snapshot();
  assert(job);
  const j = new Game();
  assert(j.quickShift.resume(job));
  assert.equal(j.quickShift.state!.phase, 'job');
  assert(j.quickShift.chooseJob('skip'));
  assert.equal(j.quickShift.state!.job, 'skipped');
  assert.equal(j.shiftRun.state, null);
  resolve(j);
  draft(j);
  resolve(j);
  assert.equal(j.quickShift.result!.job, 'skip');
});

for (const expected of ['clean', 'rush'] as const)
  test(expected + ' job succeeds or fails using accepted native damage/clear time', () => {
    let challenge = quickShiftFromSeed('RF-Q1-J0')!;
    for (let i = 0; i < 100; i++) {
      const c = quickShiftFromSeed('RF-Q1-J' + i.toString(36).toUpperCase())!;
      if (planQuickShift(c).job === expected) {
        challenge = c;
        break;
      }
    }
    for (const success of [true, false]) {
      const g = new Game();
      assert(g.quickShift.begin(challenge, 'pistol'));
      draft(g);
      for (let i = 0; i < 3; i++) {
        resolve(g);
        draft(g);
      }
      assert.equal(g.quickShift.state!.round, 3);
      assert.equal(g.quickShift.state!.job, 'accepted');
      if (expected === 'clean' && !success) {
        g.hurtAt = -10;
        g.damagePlayer(5);
      }
      if (expected === 'rush') g.quickShift.state!.roomTimeMs = success ? 0 : 45001;
      resolve(g);
      assert.equal(g.quickShift.state!.job, success ? 'complete' : 'failed');
    }
  });

test('clean job locks at combat clear while exit-walk damage still counts in the run result', () => {
  let challenge = quickShiftFromSeed('RF-Q1-CLEANEXIT0')!;
  for (let i = 0; i < 100; i++) {
    const c = quickShiftFromSeed('RF-Q1-CLEANEXIT' + i.toString(36).toUpperCase())!;
    if (planQuickShift(c).job === 'clean') {
      challenge = c;
      break;
    }
  }
  assert.equal(planQuickShift(challenge).job, 'clean');
  const g = new Game();
  assert(g.quickShift.begin(challenge, 'pistol'));
  draft(g);
  for (let i = 0; i < 3; i++) {
    resolve(g);
    draft(g);
  }
  assert.equal(g.quickShift.state!.round, 3);
  assert.equal(g.quickShift.state!.job, 'accepted');
  for (let i = 0; i < 7000 && !g.clear; i++) {
    g.hp = 100;
    for (const e of [...g.enemies]) if (e.spawn <= 0) g.hitEnemy(e, 100000);
    ticks(g);
  }
  assert(g.clear, 'actual combat clear is required before exit damage');
  assert.equal(g.quickShift.state!.phase, 'fight');
  assert.equal(g.quickShift.state!.roomHits, 0);
  const before = g.quickShift.state!.hits;
  g.hurtAt = -10;
  g.damagePlayer(5);
  assert.equal(g.hp, 95);
  assert.equal(g.quickShift.state!.hits, before + 1, 'accepted exit damage remains a real hit');
  assert.equal(
    g.quickShift.state!.roomHits,
    0,
    'the completed clean combat objective stays locked',
  );
  Matter.Body.setPosition(g.player, { x: 1920, y: 722 });
  ticks(g, 30);
  assert.equal(g.quickShift.state!.job, 'complete');
  assert.equal(g.quickShift.state!.hits, before + 1);
  draft(g);
  resolve(g);
  assert.equal(g.quickShift.result!.jobWon, true);
  assert(g.quickShift.result!.hits >= before + 1, 'the result retains the accepted exit hit');
});
