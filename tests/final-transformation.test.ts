import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { finaleTestFromUrl, finaleRecovery } from '../src/final-arsenal.ts';
import {
  transformedFinale,
  FINAL_THRESHOLDS,
  FINAL_WARNING,
  formSolids,
} from '../src/final-transformation.ts';
import { newCampaignSeed } from '../src/run-seed.ts';
import { overtimeSeed } from '../src/overtime.ts';
import { musicScene, musicNotes } from '../src/music-score.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { currentRemixEncounter, validRemixIdentity } from '../src/boss-remix-rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { beginInterceptorAttack } from '../src/interceptor.ts';
import { fireWeapon } from '../src/interceptor-weapons.ts';
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 300 },
};
function start(q = '') {
  const cp = finaleTestFromUrl(new URL('https://test/?test=finale&v=2' + q))!;
  assert(cp && loadCheckpoint(cp));
  const g = new Game();
  g.startTest(cp);
  return g;
}
function step(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function begin(g: Game) {
  step(g, 140);
  assert.equal(g.finale.state, 'combat');
}
function transition(g: Game) {
  const e = g.enemies[0];
  g.hitEnemy(e, 1e9);
  step(g);
  assert.equal(g.finale.state, 'transform');
  step(g, 160);
  assert.equal(g.finale.state, 'combat');
}

test('new Campaigns and Overtime use revision 96; old 95 finales retain their behavior', () => {
  const seed = newCampaignSeed(undefined, () => 100);
  assert(transformedFinale(seed));
  assert(transformedFinale(overtimeSeed(seed)));
  assert(!transformedFinale('RF-C95-SAVED'));
  assert.equal(overtimeSeed('RF-C95-SAVED').slice(0, 10), 'RF-C95-OT-');
  const cp = finaleTestFromUrl(new URL('https://test/?test=finale&v=1'))!,
    g = new Game();
  g.startTest(cp);
  assert(!g.finale.active);
  assert.equal(g.enemies[0].phase, 0);
});
test('the entrance freezes combat, can be skipped, and obeys pause without altering Continue', () => {
  const g = start(),
    e = g.enemies[0],
    before = { p: { ...g.player.position }, hp: g.hp, time: g.time, elapsed: g.elapsed };
  let writes = 0;
  g.onCheckpoint = () => writes++;
  step(g, 20);
  assert.deepEqual(g.player.position, before.p);
  assert.equal(g.time, before.time);
  assert.equal(g.elapsed, before.elapsed);
  assert.equal(g.hp, before.hp);
  g.damagePlayer(100);
  g.hitEnemy(e, 100000);
  assert.equal(g.hp, 100);
  assert.equal(e.hp, e.maxHp);
  const clock = g.finale.clock;
  g.setMode('paused');
  step(g, 120);
  assert.equal(g.finale.clock, clock);
  g.setMode('playing');
  g.tick(1 / 60, { ...idle, jump: true });
  assert.equal(g.finale.state, 'combat');
  g.save();
  assert.equal(writes, 0);
});
test('burst damage cannot skip forms; each transition changes real terrain and clears owned attacks', () => {
  const g = start();
  begin(g);
  const e = g.enemies[0],
    world = g.engine.world;
  const original = [...g.terrain.slice(4)];
  for (const phase of [0, 1]) {
    g.hitEnemy(e, 1e9);
    assert.equal(e.hp, e.maxHp * FINAL_THRESHOLDS[phase]);
    g.hitEnemy(e, 1e9);
    assert.equal(e.hp, e.maxHp * FINAL_THRESHOLDS[phase]);
    fireWeapon(g, e, 'aimed', e.body.position, [0]);
    assert(g.shots.length);
    step(g);
    assert.equal(g.finale.state, 'transform');
    assert.equal(g.shots.length, 0);
    assert.equal(e.phase, phase + 1);
    const time = g.time;
    step(g, 70);
    assert.equal(g.time, time);
    assert.deepEqual(
      g.level.solids,
      formSolids(phase + 1, g.level.mirrored, g.level.bossRemix === 'boss-skybridge'),
    );
    const bodies = Matter.Composite.allBodies(world);
    if (phase === 0) assert(original.every((b) => !bodies.includes(b)));
    assert.equal(g.terrain.length, 4 + g.level.solids.length);
    for (const body of [g.player, e.body])
      assert(!g.terrain.slice(4).some((b) => Matter.Collision.collides(body, b)));
    step(g, 95);
    assert.equal(g.finale.state, 'combat');
  }
  assert.equal(e.phase, 2);
});
test('phase previews construct all three forms and honest mirrored geometry without rewards', () => {
  for (const fight of ['campaign', 'overtime'])
    for (const phase of [1, 2, 3])
      for (const mirror of [0, 1]) {
        const g = start(`&fight=${fight}&phase=${phase}&mirror=${mirror}`),
          e = g.enemies[0];
        assert.equal(g.finale.phase, phase - 1);
        assert.equal(e.phase, phase - 1);
        assert.equal(g.level.mirrored, !!mirror);
        assert.equal(e.hp, e.maxHp * [1, 0.68, 0.34][phase - 1]);
        assert.equal(g.hp, 100);
        if (phase > 1)
          assert.deepEqual(
            g.level.solids,
            formSolids(phase - 1, !!mirror, g.level.bossRemix === 'boss-skybridge'),
          );
      }
  for (const q of [
    '&v=3',
    '&phase=0',
    '&phase=3&phase=2',
    '&arena=bad',
    '&mirror=2',
    '&damage=10',
    '&fight=overtime&arena=crossfire',
  ])
    assert.equal(finaleTestFromUrl(new URL('https://test/?test=finale&v=2' + q)), null, q);
});
test('floor batteries warn, freeze their geometry and resolve only inside the marked area', () => {
  const g = start('&phase=2');
  begin(g);
  const f = g.finale;
  f.strike = f.planStrike();
  const strike = f.strike;
  assert.equal(strike.kind, 'floor');
  const rect = strike.rects[0];
  Matter.Body.setPosition(g.player, { x: rect.x + rect.w / 2, y: 715 });
  g.time = 10;
  g.hurtAt = -100;
  const marks = structuredClone(strike.rects);
  f.update(FINAL_WARNING - 0.01);
  assert.equal(g.hp, 100);
  assert(!strike.fired);
  assert.deepEqual(strike.rects, marks);
  f.update(0.02);
  assert(strike.fired);
  assert.equal(g.hp, 80);
  f.update(0.1);
  assert.equal(g.hp, 80, 'A strike damages once, not once per rendered frame');
  const h = start('&phase=2');
  begin(h);
  h.finale.strike = h.finale.planStrike();
  Matter.Body.setPosition(h.player, { x: 1100, y: 350 });
  h.finale.update(FINAL_WARNING + 0.1);
  assert.equal(h.hp, 100);
});
test('reactor columns and crosscuts always leave broad safe gaps; New Game+ increases coverage', () => {
  const g = start('&phase=3'),
    plus = start('&phase=3&fight=overtime');
  for (const scene of [g, plus]) {
    begin(scene);
    const f = scene.finale;
    for (let i = 0; i < 12; i++) {
      const strike = f.planStrike();
      assert.equal(strike.left, 1.65);
      assert(
        strike.rects.every((s) => s.x >= 0 && s.x + s.w <= 2000 && s.y >= 0 && s.y + s.h <= 740),
      );
      assert(strike.rects.reduce((sum, s) => sum + s.w, 0) < 1700);
      if (strike.kind === 'crosscut') {
        const sorted = [...strike.rects].sort((a, b) => a.x - b.x);
        assert(sorted[1].x - (sorted[0].x + sorted[0].w) >= 320);
      }
    }
  }
  g.finale.cycle = plus.finale.cycle = 0;
  assert(plus.finale.planStrike().rects[0].w > g.finale.planStrike().rects[0].w);
});
test('a delayed frame cannot skip a warning; pause and hitstop freeze arena strikes', () => {
  const g = start('&phase=2');
  begin(g);
  const f = g.finale;
  f.nextStrike = 0;
  f.update(10);
  assert(f.strike && !f.strike.fired);
  assert.equal(f.strike.left, FINAL_WARNING);
  const before = structuredClone(f.strike);
  g.setMode('paused');
  step(g, 120);
  assert.deepEqual(f.strike, before);
  g.setMode('playing');
  g.hitStop = 0.5;
  step(g, 10);
  assert.deepEqual(f.strike, before);
});
test('phase two links pairs, phase three links triples, and ordinary attack warnings remain unchanged', () => {
  const g = start();
  begin(g);
  const e = g.enemies[0];
  e.interceptor!.move = 'heavy';
  e.phase = 1;
  e.interceptor!.finale!.chain = 0;
  assert(finaleRecovery(g, e, 1.5) < 1);
  assert(finaleRecovery(g, e, 1.5) >= 1.4);
  e.phase = 2;
  e.interceptor!.finale!.chain = 0;
  assert(finaleRecovery(g, e, 1.5) < 1);
  assert(finaleRecovery(g, e, 1.5) < 1);
  assert(finaleRecovery(g, e, 1.5) >= 1.4);
  beginInterceptorAttack(g, e, 'lockdown');
  assert(e.timer >= 1.4);
});
test('shutdown cancels hazards, delays room clear, then exits cleanly without rewarding an isolated test', () => {
  const g = start('&phase=3');
  begin(g);
  const e = g.enemies[0];
  g.hitEnemy(e, 1e9);
  assert.equal(g.finale.state, 'defeat');
  assert.equal(g.enemies.length, 0);
  assert(!g.clear);
  assert.equal(g.shots.length, 0);
  assert.equal(g.finale.strike, null);
  step(g, 150);
  assert(!g.clear);
  assert.equal(g.mode, 'playing');
  assert.equal(g.hp, 100);
  step(g, 50);
  assert(g.clear);
  assert.equal(g.mode, 'won');
  assert(g.finale.cleared);
  g.startTest(finaleTestFromUrl(new URL('https://test/?test=finale&v=1'))!);
  assert(!g.finale.active);
});
test('the original finale score gains layers per phase and switches to an aftermath resolution', () => {
  const scores = [0, 1, 2].map((p) =>
    Array.from({ length: 128 }, (_, n) => musicNotes('reclaimer', n, 0.9, true, false, p)).flat(),
  );
  assert(scores[1].length > scores[0].length);
  assert(scores[2].length > scores[1].length);
  assert(!scores[0].some((n) => n.part === 'drive'));
  assert(scores[1].some((n) => n.part === 'drive'));
  assert(scores[2].some((n) => n.part === 'lead'));
  for (const score of scores)
    for (const note of score) {
      assert(note.velocity > 0 && note.velocity < 0.5);
      assert(note.duration > 0 && note.duration <= 4);
    }
  const g = start('&phase=3&fight=overtime');
  const scene = musicScene(g);
  assert.equal(scene.theme, 'reclaimer-overtime');
  assert.equal(scene.bossPhase, 2);
  g.finale.state = 'defeat';
  assert(musicScene(g).clear);
  assert(
    !Array.from({ length: 128 }, (_, n) => musicNotes('reclaimer', n, 0, true, true, 2))
      .flat()
      .some((n) => ['kick', 'snare', 'lead'].includes(n.part)),
  );
});
test('current Practice adopts new identity while 5.12 and classic challenge identities remain readable', () => {
  for (const id of ['boss-skybridge', 'boss-crossfire'] as const) {
    const encounter = currentRemixEncounter(id);
    assert(transformedFinale(encounter.seed));
    assert(validRemixIdentity(id, 'interceptor', encounter.seed));
    assert(validRemixIdentity(id, 'interceptor', 'RF-C95-REMIX-' + id));
    assert(!validRemixIdentity(id, 'boss', encounter.seed));
    const g = new Game();
    assert(g.startPractice(encounter));
    assert(g.finale.active);
  }
});
test('Continue reconstructs the new opening fight and existing older checkpoints keep their arenas', () => {
  for (const revision of [95, 96]) {
    const cp = testCheckpoint(`RF-C${revision}-CONTINUE`, 19),
      g = new Game();
    g.start(cp.seed, cp);
    assert.equal(g.finale.active, revision === 96);
    let saved: Checkpoint | null = null;
    g.onCheckpoint = (s) => (saved = s);
    g.save();
    assert(saved && loadCheckpoint(saved));
    const resumed = new Game();
    resumed.start(cp.seed, saved);
    assert.equal(resumed.finale.active, revision === 96);
    assert.deepEqual(resumed.level, g.level);
  }
});

test('a late-form death rematches the initial arena and retains the finished gun', async () => {
  const { rematchEntry, roomRematchSnapshot, RoomRematch } = await import('../src/room-rematch.ts');
  const g = start(),
    entry = rematchEntry(g);
  assert(entry);
  const original = structuredClone(g.level.solids);
  begin(g);
  transition(g);
  transition(g);
  assert.notDeepEqual(g.level.solids, original);
  g.die({ type: 'induction', enemy: 'interceptor' });
  const snapshot = roomRematchSnapshot(g, entry);
  assert(snapshot);
  const rematch = new RoomRematch(snapshot);
  assert.equal(rematch.game.finale.phase, 0);
  assert.deepEqual(rematch.game.level.solids, original);
  assert.deepEqual(rematch.game.mods, g.mods);
  assert.equal(rematch.game.hp, 100);
  rematch.dispose();
  assert.equal(Matter.Composite.allBodies(rematch.game.engine.world).length, 0);
});
for (const outcome of ['isolated', 'mutiny', 'overloaded', 'pursuit'] as const)
  test(
    outcome + ' preserves its mission benefit and can finish the transformed finale',
    async () => {
      const { uprisingTestFromUrl } = await import('../src/uprising-test.ts');
      const { UPRISING_FINALES } = await import('../src/uprising-model.ts');
      // Use the canonical route names so a new mission cannot silently change this fixture.
      const route =
        outcome === 'pursuit'
          ? UPRISING_FINALES.find((x) => !['isolated', 'mutiny', 'overloaded'].includes(x))!
          : outcome;
      const cp = uprisingTestFromUrl(
        new URL('https://test/?test=uprising&route=' + route + '&v=2'),
      )!;
      assert(cp);
      cp.seed = 'RF-C96-JOB-' + route;
      const g = new Game();
      g.start(cp.seed, cp, null, cp);
      assert(g.finale.active);
      begin(g);
      transition(g);
      if (outcome === 'mutiny')
        assert.equal(g.props.items.filter((p) => p.kind === 'cover' && p.maxHp === 150).length, 2);
      if (outcome === 'isolated') {
        g.finale.nextStrike = 0;
        g.finale.update(1);
        assert.equal(g.finale.strike, null);
      }
      const { playRoom } = await import('./room-pilot.ts');
      const result = playRoom(g, 180);
      assert(result.clear && result.hp > 0, JSON.stringify({ route, ...result }));
    },
  );

test('reactor columns mark one real player position in either mirror, then remain locked', () => {
  for (const mirror of [0, 1]) {
    const g = start('&phase=3&mirror=' + mirror);
    begin(g);
    Matter.Body.setPosition(g.player, { x: 140, y: 710 });
    const strike = g.finale.planStrike();
    assert.equal(strike.kind, 'column');
    assert(strike.rects.some((s) => s.x <= 140 && s.x + s.w >= 140));
    const marked = structuredClone(strike.rects);
    g.finale.strike = strike;
    Matter.Body.setPosition(g.player, { x: 700, y: 710 });
    g.finale.update(1);
    assert.deepEqual(strike.rects, marked);
    g.finale.update(0.66);
    assert.equal(g.hp, 100);
  }
  assert(!validRemixIdentity('sorter-beltline', 'sorter', 'RF-C95-REMIX-sorter-beltline'));
});
