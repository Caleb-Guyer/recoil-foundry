import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { testCheckpoint } from '../src/practice.ts';
import { finaleTestFromUrl } from '../src/final-arsenal.ts';
import { RoomRematch, rematchEntry, roomRematchSnapshot } from '../src/room-rematch.ts';
import { loadCheckpoint } from '../src/rules.ts';
import {
  finalePracticeFor,
  finalePracticeGuidance,
  finalePracticePreviewFromUrl,
  prepareFinalePracticePreview,
  startFinalePracticePhase,
  type FinalePracticePhase,
} from '../src/finale-practice.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 500 },
};
function tick(g: Game, frames = 1, input = idle) {
  for (let i = 0; i < frames; i++) g.tick(1 / 60, input);
}
function attempted(reached: FinalePracticePhase, overtime = false) {
  const cp = finaleTestFromUrl(
    new URL('https://test/?test=finale&v=3&fight=' + (overtime ? 'overtime' : 'campaign')),
  )!;
  const g = new Game();
  g.startTest(cp);
  const entry = rematchEntry(g)!;
  assert(entry);
  const cinema = g.finale.cinema!;
  cinema.enterForm(0);
  for (let phase = 0; phase < reached; phase++) {
    g.hitEnemy(g.finale.enemy!, 1e9);
    tick(g, 482);
    assert.equal(g.finale.phase, phase + 1);
  }
  assert.equal(g.reachedFinalePhase, reached);
  g.damagePlayer(100, undefined, {
    type: reached === 2 ? 'induction' : reached === 1 ? 'blast' : 'shot',
    enemy: 'interceptor',
  });
  assert.equal(g.mode, 'dead');
  const snapshot = roomRematchSnapshot(g, entry);
  assert(snapshot?.finalePractice);
  return { g, snapshot };
}

for (const reached of [0, 1, 2] as const)
  test(`reaching form ${reached + 1} makes exactly those reached forms available after death`, () => {
    const { g, snapshot } = attempted(reached);
    assert.equal(snapshot.finalePractice!.reached, reached);
    assert.equal(snapshot.finalePractice!.deathPhase, reached);
    const session = new RoomRematch(snapshot);
    assert.equal(session.finalePhase, reached);
    for (const phase of [0, 1, 2]) {
      assert.equal(session.selectFinalePhase(phase), phase <= reached);
      if (phase <= reached) {
        assert.equal(session.finalePhase, phase);
        assert.equal(session.game.finale.phase, phase);
        assert.equal(session.game.finale.cinema!.state, ['duel', 'siege', 'rupture'][phase]);
        assert.equal(session.game.hp, 100);
        assert.equal(session.game.finale.enemy!.hp, session.game.finale.enemy!.maxHp);
        assert.equal(session.game.mode, 'paused');
      }
    }
    for (const invalid of [-1, 3, NaN, Infinity]) assert(!session.selectFinalePhase(invalid));
    session.dispose();
  });

test('destroying a chassis alone never reveals the next form before it actually enters', () => {
  const g = new Game(),
    cp = finaleTestFromUrl(new URL('https://test/?test=finale&v=3'))!;
  g.startTest(cp);
  const entry = rematchEntry(g)!;
  g.finale.cinema!.enterForm(0);
  g.hitEnemy(g.finale.enemy!, 1e9);
  assert.equal(g.finale.cinema!.state, 'airlift');
  assert.equal(g.reachedFinalePhase, 0);
  g.die({ type: 'fall' });
  const snapshot = roomRematchSnapshot(g, entry)!;
  const session = new RoomRematch(snapshot);
  assert(!session.selectFinalePhase(1));
  assert(!session.selectFinalePhase(2));
  session.dispose();
});

test('each chosen form ends at zero without movies, following phases, boss kills, or progress writes', () => {
  const { g: original, snapshot } = attempted(2);
  const before = {
    checkpoint: original.checkpointSnapshot(),
    cause: original.deathCause,
    position: { ...original.player.position },
    results: original.combatReport.snapshot(),
  };
  const bodies = Matter.Composite.allBodies(original.engine.world);
  const session = new RoomRematch(snapshot),
    g = session.game;
  let writes = 0,
    awards = 0;
  g.onCheckpoint = () => writes++;
  g.onCampaignClear = () => awards++;
  g.onBossDefeated = () => awards++;
  g.onEnemyDefeated = () => awards++;
  g.onCommendation = () => awards++;
  for (const phase of [0, 1, 2]) {
    assert(session.selectFinalePhase(phase));
    assert(!g.commendations.eligible);
    assert.deepEqual(g.mods, original.mods);
    assert.deepEqual(g.gun, original.gun);
    g.setMode('playing');
    g.hitEnemy(g.finale.enemy!, 1e9);
    assert.equal(g.mode, 'won');
    assert.equal(g.finale.cinema!.state, 'complete');
    assert.equal(g.kills, 0);
    assert.equal(g.stage, 19);
    g.save();
    g.openReward();
    g.startEscape();
    tick(g, 600);
    assert.equal(g.mode, 'won');
    assert(!g.escape);
    assert.equal(g.offers.length, 0);
    assert.equal(writes, 0);
    assert.equal(awards, 0);
  }
  assert.equal(original.mode, 'dead');
  assert.deepEqual(
    {
      checkpoint: original.checkpointSnapshot(),
      cause: original.deathCause,
      position: { ...original.player.position },
      results: original.combatReport.snapshot(),
    },
    before,
  );
  assert.deepEqual(Matter.Composite.allBodies(original.engine.world), bodies);
  session.dispose();
});

test('phase retries restore the finished gun, appearance, full health and correct Overtime form', () => {
  const { g: original, snapshot } = attempted(2, true);
  const session = new RoomRematch(snapshot),
    g = session.game;
  assert(g.overtime);
  for (const phase of [0, 1, 2]) {
    assert(session.selectFinalePhase(phase));
    const max = g.finale.enemy!.maxHp;
    for (let retry = 0; retry < 3; retry++) {
      assert.deepEqual(g.cosmetics, original.cosmetics);
      assert.deepEqual(g.mods, original.mods);
      assert.deepEqual(g.gun, original.gun);
      assert.equal(g.hp, 100);
      assert.equal(g.finale.enemy!.hp, max);
      g.setMode('playing');
      g.hp = 13;
      g.finale.enemy!.hp = 10;
      g.mods = [];
      session.reset();
      assert.equal(session.finalePhase, phase);
      assert.equal(g.finale.phase, phase);
      assert.equal(g.mode, 'paused');
    }
  }
  session.dispose();
  session.dispose();
  assert.equal(Matter.Composite.allBodies(g.engine.world).length, 0);
});

test('ordinary movement, aiming and fire work in phase practice and pause freezes the private simulation', () => {
  const { snapshot } = attempted(0),
    session = new RoomRematch(snapshot),
    g = session.game;
  const position = { ...g.player.position },
    clock = g.time;
  tick(g, 60, { ...idle, right: true, fire: true });
  assert.equal(g.time, clock);
  assert.deepEqual(g.player.position, position);
  g.setMode('playing');
  for (let n = 0; n < 20; n++)
    session.tick(1 / 60, {
      ...idle,
      right: true,
      fire: true,
      aim: { ...g.finale.enemy!.body.position },
    });
  assert(Math.abs(g.player.position.x - position.x) > 10);
  assert(g.shotCount > 0);
  g.setMode('paused');
  const time = g.time,
    enemyTimer = g.finale.enemy!.timer;
  tick(g, 120, { ...idle, left: true, fire: true });
  assert.equal(g.time, time);
  assert.equal(g.finale.enemy!.timer, enemyTimer);
  session.reset();
  assert.equal(g.shotCount, 0);
  session.dispose();
});

test('earlier finales, ordinary rooms and existing boss Practice never gain reached-form selection', () => {
  for (const revision of [95, 96]) {
    const seed = `RF-C${revision}-OLD-PRACTICE`,
      g = new Game();
    g.start(seed, testCheckpoint(seed, 19));
    const entry = rematchEntry(g)!;
    g.die({ type: 'shot', enemy: 'interceptor' });
    assert.equal(finalePracticeFor(g), null);
    const saved = roomRematchSnapshot(g, entry)!;
    assert(!saved.finalePractice);
    const session = new RoomRematch(saved);
    assert.equal(session.finalePhase, null);
    assert(!session.selectFinalePhase(1));
    session.dispose();
  }
  const ordinary = new Game();
  ordinary.start('normal');
  assert.equal(finalePracticeFor(ordinary), null);
  assert(!startFinalePracticePhase(ordinary, 0));
});

test('phase guidance uses the recorded lethal category and never invents an unseen attack', () => {
  assert.match(
    finalePracticeGuidance(0, { type: 'shot', enemy: 'interceptor' }).label,
    /Chassis.*Gunfire/,
  );
  assert.match(
    finalePracticeGuidance(1, { type: 'induction', enemy: 'interceptor' }).tip,
    /marked floor/,
  );
  assert.match(
    finalePracticeGuidance(2, { type: 'induction', enemy: 'interceptor' }).tip,
    /marked arena/,
  );
  assert.doesNotMatch(
    finalePracticeGuidance(2, { type: 'induction' }).tip,
    /column|crosscut|you missed|you failed/,
  );
  assert.match(finalePracticeGuidance(2, { type: 'fall' }).tip, /landing/);
  assert.match(finalePracticeGuidance(1, null).label, /Siege practice/);
});

test('strict isolated preview URLs produce legal Campaign and Overtime deaths without granting forms to the profile', () => {
  for (const fight of ['campaign', 'overtime'])
    for (const phase of [1, 2, 3]) {
      const preview = finalePracticePreviewFromUrl(
        new URL(`https://test/?test=final-practice&phase=${phase}&fight=${fight}&v=1`),
      )!;
      assert(preview && loadCheckpoint(preview.checkpoint));
      const g = new Game();
      let saves = 0,
        awards = 0;
      g.onCheckpoint = () => saves++;
      g.onCommendation = () => awards++;
      g.onCampaignClear = () => awards++;
      g.startTest(preview.checkpoint);
      assert(prepareFinalePracticePreview(g, preview));
      const entry = rematchEntry(g)!;
      assert(entry);
      g.damagePlayer(100, undefined, { type: 'shot', enemy: 'interceptor' });
      const snapshot = roomRematchSnapshot(g, entry)!;
      assert.equal(snapshot.finalePractice?.reached, phase - 1);
      assert.equal(g.mode, 'dead');
      assert.equal(saves, 0);
      assert.equal(awards, 0);
    }
  for (const query of [
    '?test=final-practice',
    '?test=final-practice&v=2',
    '?test=final-practice&phase=4&v=1',
    '?test=final-practice&phase=2&phase=3&v=1',
    '?test=final-practice&fight=daily&v=1',
    '?test=final-practice&v=1&seed=custom',
    '?test=final-practice&v=1&v=1',
  ])
    assert.equal(finalePracticePreviewFromUrl(new URL(query, 'https://test/')), null, query);
});

test('a finished converted shotgun keeps its beam fan and can clear each chosen practice form with ordinary fire', () => {
  const cp = finaleTestFromUrl(new URL('https://test/?test=finale&phase=3&v=3'))!;
  cp.startingGun = 'shotgun';
  cp.mods = [
    'cutting-torch',
    'scatter',
    'magnum',
    'rapid',
    'burst',
    'pulse-chamber',
    'kick',
    'light',
  ];
  cp.missedUpgrades = 11;
  assert(loadCheckpoint(cp));
  const original = new Game();
  original.startTest(cp);
  const entry = rematchEntry(original)!;
  original.finale.cinema!.enterForm(2);
  original.damagePlayer(100, undefined, { type: 'induction', enemy: 'interceptor' });
  const saved = roomRematchSnapshot(original, entry)!;
  const session = new RoomRematch(saved),
    g = session.game;
  for (const phase of [0, 1, 2]) {
    assert(session.selectFinalePhase(phase));
    assert.equal(g.startingGun, 'shotgun');
    assert.deepEqual(g.gun, original.gun);
    assert.deepEqual(g.mods, original.mods);
    g.setMode('playing');
    Matter.Body.setPosition(g.player, { x: 1000, y: 680 });
    Matter.Body.setPosition(g.finale.enemy!.body, { x: 1450, y: 680 });
    g.finale.enemy!.hp = 0.000001;
    assert.doesNotThrow(() => tick(g, 10, { ...idle, fire: true, aim: { x: 1450, y: 680 } }));
    assert.equal(g.mode, 'won');
    assert.equal(g.kills, 0);
    assert.equal(g.finale.phase, phase);
  }
  session.dispose();
});
