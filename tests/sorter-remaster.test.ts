import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { SorterRemaster, SORTER_REMASTER } from '../src/sorter-remaster.ts';
import { seeded } from '../src/rules.ts';

const DT = 1 / 60;
function fixture(phase = 0, mirror = false) {
  const g = new Game();
  assert(g.startPractice({ kind: 'sorter', seed: 'SORTER-522-UNIT' }));
  const e = g.enemies.find((enemy) => enemy.kind === 'sorter')!;
  assert(e);
  e.spawn = 0;
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.waves.clear();
  g.level.mirrored = mirror;
  g.level.magnets = [];
  g.magnets.items = [];
  g.hazards.clear();
  Matter.Body.setPosition(e.body, { x: 600, y: 300 });
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  e.hp = e.maxHp * (phase === 0 ? 1 : phase === 1 ? 0.55 : 0.25);
  const rig = new SorterRemaster(g, e);
  return { g, e, rig };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function step(g: Game, rig: SorterRemaster, count = 1, projectiles = false) {
  for (let i = 0; i < count; i++) {
    if (g.hitStop > 0) {
      g.hitStop = Math.max(0, g.hitStop - DT);
      continue;
    }
    g.time += DT;
    g.elapsed += DT;
    rig.update(DT);
    if (projectiles) g.updateShots(DT);
  }
}
function until(g: Game, rig: SorterRemaster, condition: () => boolean, frames = 1800) {
  for (let i = 0; i < frames && !condition(); i++) step(g, rig);
  assert(condition(), `${rig.phase}/${rig.move}/${rig.state}/${rig.remaining}`);
}

test('Sorter phases introduce floor sweeps and linked attacks rather than only larger fans', () => {
  const seen: Set<string>[] = [];
  for (let phase = 0; phase < 3; phase++) {
    const { g, rig } = fixture(phase);
    // This state-machine check keeps the player above damage fields; it is not a gameplay clear.
    Matter.Body.setPosition(g.player, { x: 1000, y: 10 });
    const moves = new Set<string>();
    for (let i = 0; i < 1800; i++) {
      step(g, rig);
      if (rig.state === 'windup') {
        moves.add(rig.move);
        assert(rig.duration >= 1.1);
        assert(rig.cues.length);
      }
      if (rig.state === 'recover') assert(rig.duration >= 1.65);
    }
    seen.push(moves);
    dispose(g);
  }
  assert.deepEqual([...seen[0]].sort(), ['induction', 'scrap']);
  assert(seen[1].has('magnet'));
  assert(seen[1].has('scrap'));
  assert(seen[2].has('cascade'));
  assert(seen[2].has('magnet'));
});

test('induction warns fully, locks the target and never follows an escape after the lock', () => {
  const { g, rig } = fixture();
  until(g, rig, () => rig.state === 'windup');
  assert.equal(rig.move, 'induction');
  assert.equal(rig.duration, SORTER_REMASTER.tell);
  const first = rig.cues[0];
  assert(first.kind === 'lane');
  assert.equal(first.x, 1000);
  assert.equal(first.width, 84);
  until(g, rig, () => rig.remaining <= SORTER_REMASTER.lock);
  assert.equal(g.hp, 100);
  const locked = rig.cues[0];
  assert(locked.kind === 'lane' && locked.locked);
  Matter.Body.setPosition(g.player, { x: 1500, y: 722 });
  step(g, rig, 3);
  assert.equal((rig.cues[0] as typeof first).x, 1000);
  until(g, rig, () => rig.state === 'attack');
  assert.equal(g.hp, 100, 'the committed old lane misses the real moved hull');
  dispose(g);
});

test('induction damage uses the same strict lane edges shown by its cue', () => {
  for (const inside of [true, false]) {
    const { g, rig } = fixture();
    until(g, rig, () => rig.state === 'windup' && rig.remaining <= SORTER_REMASTER.lock);
    Matter.Body.setPosition(g.player, { x: 1000 + 42 + 13 + (inside ? -0.1 : 0.1), y: 722 });
    until(g, rig, () => rig.state === 'attack');
    assert.equal(g.hp, inside ? 76 : 100);
    if (inside) assert.equal(g.damageControl.lastHit?.cause?.enemy, 'sorter');
    dispose(g);
  }
});

test('magnetic sweep has a complete floor-band warning and a real jump-safe upper region in both mirrors', () => {
  for (const mirror of [false, true])
    for (const elevated of [false, true]) {
      const { g, rig } = fixture(1, mirror);
      Matter.Body.setPosition(g.player, { x: 1000, y: elevated ? 610 : 722 });
      until(g, rig, () => rig.state === 'windup');
      assert.equal(rig.move, 'magnet');
      const warning = rig.cues[0];
      assert(warning.kind === 'segment');
      assert.deepEqual(warning.from, { x: 64, y: 690 });
      assert.deepEqual(warning.to, { x: 1936, y: 690 });
      assert.equal(warning.width, 100);
      assert.equal(rig.duration, 1.25);
      until(g, rig, () => rig.state === 'attack');
      assert.equal(g.hp, 100, 'no hit before the complete warning');
      let damageCue = false;
      while (rig.state === 'attack') {
        const before = g.hp;
        step(g, rig);
        if (g.hp < before) {
          const cue = rig.cues[0];
          assert(cue?.kind === 'lane' && cue.active);
          assert(g.player.position.x + 13 > cue.x - cue.width / 2);
          assert(g.player.position.x - 13 < cue.x + cue.width / 2);
          assert.equal(cue.top, 640);
          assert.equal(cue.bottom, 740);
          damageCue = true;
        }
      }
      assert.equal(g.hp, elevated ? 100 : 76);
      assert.equal(damageCue, !elevated);
      assert.equal(rig.state, 'windup', 'the next scrap strike has its own full warning');
      assert.equal(rig.move, 'scrap');
      assert(rig.remaining >= 1.1 - DT);
      dispose(g);
    }
});

test('scrap fan uses native projectiles and real terrain blocks all three firing lanes', () => {
  for (const cover of [false, true]) {
    const { g, e, rig } = fixture();
    Matter.Body.setPosition(g.player, { x: 1400, y: 300 });
    until(g, rig, () => rig.state === 'windup' && rig.move === 'scrap');
    let barrier: Matter.Body | undefined;
    if (cover) {
      barrier = Matter.Bodies.rectangle(1000, 360, 60, 620, { isStatic: true, label: 'terrain' });
      g.terrain.push(barrier);
      Matter.Composite.add(g.engine.world, barrier);
      const signals = rig.cues;
      assert.equal(signals.length, 3);
      assert(signals.every((cue) => cue.kind === 'segment' && cue.to.x <= 966));
    }
    const before = g.hp;
    until(g, rig, () => rig.state === 'attack');
    assert.equal(g.shots.length, 3);
    assert(g.shots.every((shot) => !shot.friendly && shot.damageCause?.enemy === 'sorter'));
    // Advance the actual swept projectile system without queuing the next boss cycle.
    for (let i = 0; i < 140; i++) {
      if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - DT);
      else {
        g.time += DT;
        g.updateShots(DT);
      }
    }
    assert.equal(g.hp, cover ? before : before - 22);
    assert.equal(g.shots.length, 0);
    assert.equal(e.hp, e.maxHp);
    dispose(g);
  }
});

test('later scrap uses the real heavy-blade collision diameter and retains a central final-phase gap', () => {
  const { g, rig } = fixture(2);
  Matter.Body.setPosition(g.player, { x: 1000, y: 10 });
  until(g, rig, () => rig.state === 'windup' && rig.move === 'scrap');
  assert.equal(rig.cues.length, 4);
  assert(rig.cues.every((cue) => cue.kind === 'segment' && cue.width === 22));
  until(g, rig, () => rig.state === 'attack');
  assert.equal(g.shots.length, 4);
  assert(g.shots.every((shot) => shot.blade && shot.radius === 11 && shot.damage === 22));
  dispose(g);
});

test('phase breaks cancel active warnings and pause/hitstop cannot advance an attack', () => {
  const { g, e, rig } = fixture();
  until(g, rig, () => rig.state === 'windup');
  const snapshot = JSON.stringify({
    state: rig.state,
    move: rig.move,
    remaining: rig.remaining,
    cues: rig.cues,
  });
  g.mode = 'paused';
  rig.update(0.1);
  assert.equal(
    JSON.stringify({ state: rig.state, move: rig.move, remaining: rig.remaining, cues: rig.cues }),
    snapshot,
  );
  g.mode = 'playing';
  g.hitStop = 1;
  rig.update(0.1);
  assert.equal(rig.remaining, JSON.parse(snapshot).remaining);
  g.hitStop = 0;
  e.hp = e.maxHp * 0.55;
  rig.update(DT);
  assert.equal(rig.state, 'transition');
  assert.equal(e.phase, 1);
  assert.deepEqual(rig.cues, []);
  assert.equal(rig.duration, 1.15);
  assert.equal(g.shots.length, 0);
  until(g, rig, () => rig.state === 'windup');
  assert.equal(rig.move, 'magnet');
  assert.equal(rig.remaining, 1.25);
  dispose(g);
});

test('Sorter patterns consume no live combat randomness or progress callbacks', () => {
  const { g, rig } = fixture(2);
  Matter.Body.setPosition(g.player, { x: 1000, y: 10 });
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.onCommendation = () => writes++;
  g.rng = seeded('sorter-live-stream');
  const expected = seeded('sorter-live-stream');
  for (let i = 0; i < 900; i++) {
    step(g, rig);
    void rig.cues;
  }
  assert.equal(g.rng(), expected());
  assert.equal(writes, 0);
  assert(g.enemies.length === 1);
  dispose(g);
});

test('the last swept collision frame retains its exact visible cue at both terminal edges', () => {
  for (const mirror of [false, true]) {
    const { g, rig } = fixture(1, mirror);
    Matter.Body.setPosition(g.player, { x: mirror ? 52 : 1948, y: 722 });
    until(g, rig, () => rig.state === 'attack');
    until(g, rig, () => rig.remaining <= 0);
    assert.equal(rig.state, 'attack');
    assert.equal(g.hp, 76);
    const cue = rig.cues[0];
    assert(cue?.kind === 'lane' && cue.active);
    assert(g.player.position.x + 13 > cue.x - cue.width / 2);
    assert(g.player.position.x - 13 < cue.x + cue.width / 2);
    dispose(g);
  }
});
