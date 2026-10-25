import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { PressRemaster, KilnRemaster, FIRST_SHIFT_FURNACE } from '../src/first-shift-furnace.ts';
import { seeded } from '../src/rules.ts';
import { firstShiftTestFromUrl } from '../src/first-shift-test.ts';

const DT = 1 / 60;
type Rig = PressRemaster | KilnRemaster;
function fixture(kind: 'press' | 'kiln', phase = 0, mirror = false, overtime = false) {
  const g = new Game();
  let started = false;
  for (let i = 0; i < 256 && !started; i++)
    started = g.startPractice({ kind, seed: 'FURNACE-UNIT-' + i });
  assert(started);
  const e = g.enemies.find((enemy) => enemy.kind === kind)!;
  assert(e);
  e.spawn = 0;
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Matter.Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.waves.clear();
  g.hazards.clear();
  g.level.mirrored = mirror;
  g.level.magnets = [];
  g.magnets.items = [];
  g.overtime = overtime ? { baseMods: 8, repairs: 0, remix: 2 } : null;
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  Matter.Body.setPosition(e.body, {
    x: kind === 'press' ? 1000 : 1450,
    y: kind === 'press' ? 260 : 698,
  });
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  e.hp = e.maxHp * (phase === 0 ? 1 : phase === 1 ? 0.55 : 0.25);
  const rig = kind === 'press' ? new PressRemaster(g, e) : new KilnRemaster(g, e);
  return { g, e, rig };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function step(g: Game, rig: Rig, frames = 1, physics = true, projectiles = false) {
  for (let i = 0; i < frames; i++) {
    if (g.hitStop > 0) {
      g.hitStop = Math.max(0, g.hitStop - DT);
      continue;
    }
    g.time += DT;
    g.elapsed += DT;
    rig.update(DT);
    if (physics) Matter.Engine.update(g.engine, 1000 * DT);
    if (projectiles) g.updateShots(DT);
  }
}
function until(g: Game, rig: Rig, done: () => boolean, frames = 2400, physics = true) {
  for (let i = 0; i < frames && !done(); i++) step(g, rig, 1, physics);
  assert(done(), `${rig.enemy.kind}/${rig.phase}/${rig.move}/${rig.state}/${rig.remaining}`);
}
function wall(g: Game, x: number, y: number, w: number, h: number) {
  const body = Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, label: 'terrain' });
  g.terrain.push(body);
  Matter.Composite.add(g.engine.world, body);
  return body;
}

test('Press stamps have a complete tell, a committed lane and strict native player hull edges', () => {
  for (const inside of [false, true]) {
    const { g, rig } = fixture('press');
    assert(rig instanceof PressRemaster);
    until(g, rig, () => rig.state === 'windup');
    assert.equal(rig.duration, FIRST_SHIFT_FURNACE.stampTell);
    const began = g.time;
    until(g, rig, () => rig.remaining <= FIRST_SHIFT_FURNACE.lock);
    const lane = rig.cues[0];
    assert(lane.kind === 'lane' && lane.locked);
    assert.equal(lane.width, 120);
    Matter.Body.setPosition(g.player, { x: lane.x + 73 + (inside ? -0.1 : 0.1), y: 722 });
    until(g, rig, () => rig.state === 'active');
    assert(g.time - began >= 1.25 - DT);
    assert.equal(g.hp, 100);
    assert.equal((rig.cues[0] as typeof lane).x, lane.x);
    until(g, rig, () => rig.state === 'recover');
    assert.equal(g.hp, inside ? 70 : 100);
    assert(rig.duration >= 1.5);
    if (inside) assert.deepEqual(g.damageControl.lastHit?.cause, { type: 'slam', enemy: 'press' });
    dispose(g);
  }
});

test('Press collision is stopped by the actual shelf and never damages the player beneath it', () => {
  const { g, e, rig } = fixture('press');
  wall(g, 1000, 510, 220, 20);
  until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
  const lane = rig.cues[0];
  assert(lane.kind === 'lane');
  assert.equal(lane.bottom, 500);
  until(g, rig, () => rig.state === 'recover');
  assert.equal(g.hp, 100);
  assert(e.body.position.y + 31 <= 500.1);
  assert.equal(Matter.Query.collides(e.body, [g.terrain.at(-1)!]).length, 0);
  dispose(g);
});

test('a removed locked support cannot extend a Press stamp below the warned column', () => {
  const { g, e, rig } = fixture('press');
  const shelf = wall(g, 1000, 510, 220, 20);
  until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
  const lane = rig.cues[0];
  assert(lane.kind === 'lane');
  g.terrain = g.terrain.filter((body) => body !== shelf);
  Matter.Composite.remove(g.engine.world, shelf);
  until(g, rig, () => rig.state === 'recover');
  assert.equal(g.hp, 100);
  assert(e.body.position.y + 31 <= lane.bottom + 0.1);
  dispose(g);
});

test('Press later phases link fresh tells and retain a physically available floor escape on both mirrors', () => {
  for (const mirror of [false, true]) {
    const { g, rig } = fixture('press', 2, mirror);
    assert(rig instanceof PressRemaster);
    const seen: string[] = [];
    let previous = '';
    for (let i = 0; i < 1100 && g.mode === 'playing'; i++) {
      const state = `${rig.state}/${rig.move}`;
      if (rig.state === 'windup' && state !== previous) {
        seen.push(rig.move);
        assert(rig.duration >= 1.15);
      }
      if (rig.state === 'windup' && rig.move === 'stamp' && rig.remaining <= 0.6) {
        const cue = rig.cues[0];
        assert(cue.kind === 'lane');
        // Isolate retargeted follow-ups. Ordinary-input clear tests cover real traversal separately.
        Matter.Body.setPosition(g.player, { x: cue.x < 1000 ? 1500 : 500, y: 722 });
      }
      previous = state;
      step(g, rig);
    }
    assert.deepEqual(seen.slice(0, 3), ['stamp', 'flak', 'stamp']);
    assert(g.hp > 0);
    dispose(g);
  }
});

test('Kiln marks one supported patch at first, then spaced ground grates with an upper escape', () => {
  for (const phase of [0, 1, 2]) {
    const { g, rig } = fixture('kiln', phase);
    assert(rig instanceof KilnRemaster);
    until(g, rig, () => rig.state === 'windup');
    assert.equal(rig.move, phase === 1 ? 'grate' : 'ember');
    assert.equal(rig.duration, 1.3);
    assert.equal(rig.cues.length, phase === 1 ? 2 : 1);
    assert(
      rig.cues.every(
        (cue) => cue.kind === 'lane' && cue.top === 730 && cue.bottom === 742 && cue.width === 112,
      ),
    );
    const first = rig.cues.map((cue) => (cue.kind === 'lane' ? cue.x : 0));
    until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
    Matter.Body.setPosition(g.player, { x: 400, y: 600 });
    assert.deepEqual(
      rig.cues.map((cue) => (cue.kind === 'lane' ? cue.x : 0)),
      first,
    );
    until(g, rig, () => rig.state === 'recover');
    assert.equal(g.hp, 100, 'elevated hull never enters the floor heat');
    dispose(g);
  }
});

test('Kiln heat checks exact accepted edges and retains its cue on the last damaging frame', () => {
  for (const inside of [false, true]) {
    const { g, rig } = fixture('kiln');
    until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
    const lane = rig.cues[0];
    assert(lane.kind === 'lane');
    Matter.Body.setPosition(g.player, {
      x: lane.x + lane.width / 2 + 13 + (inside ? -0.1 : 0.1),
      y: 722,
    });
    until(g, rig, () => rig.state === 'active');
    assert.equal(g.hp, inside ? 82 : 100);
    until(g, rig, () => rig.remaining <= 0);
    assert.equal(rig.state, 'active');
    assert(rig.cues.every((cue) => cue.active));
    if (inside) assert.deepEqual(g.damageControl.lastHit?.cause, { type: 'heat', enemy: 'kiln' });
    dispose(g);
  }
});

test('heat belongs to the real supported surface and disappears when that support is removed', () => {
  const { g, rig } = fixture('kiln');
  const shelf = wall(g, 1000, 620, 240, 20);
  Matter.Body.setPosition(g.player, { x: 1000, y: 592 });
  until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
  assert.equal(rig.cues.length, 1);
  const lane = rig.cues[0];
  assert(lane.kind === 'lane');
  assert.equal(lane.top, 600);
  g.terrain = g.terrain.filter((body) => body !== shelf);
  Matter.Composite.remove(g.engine.world, shelf);
  until(g, rig, () => rig.state === 'active');
  assert.deepEqual(rig.cues, []);
  assert.equal(g.hp, 100);
  dispose(g);
});

test('both boilers use real native flak and cover stops their exact warned projectile paths', () => {
  for (const kind of ['press', 'kiln'] as const) {
    const { g, e, rig } = fixture(kind);
    Matter.Body.setPosition(g.player, { x: 500, y: 722 });
    until(g, rig, () => rig.state === 'windup' && rig.move === 'flak');
    Matter.Body.setPosition(g.player, { x: kind === 'press' ? 1500 : 500, y: 722 });
    const barrier = wall(g, 950, 400, 60, 650);
    until(g, rig, () => rig.remaining <= 0.6);
    assert(rig.cues.every((cue) => cue.kind === 'segment' && cue.width === 10));
    assert(
      rig.cues.every(
        (cue) =>
          cue.kind === 'segment' && (e.body.position.x < 950 ? cue.to.x <= 925 : cue.to.x >= 975),
      ),
    );
    const hp = g.hp;
    until(g, rig, () => rig.state === 'active');
    assert(g.shots.length > 0);
    assert(g.shots.every((shot) => shot.damageCause?.enemy === kind && shot.damage === 18));
    for (let n = 0; n < 180; n++) {
      g.time += DT;
      g.updateShots(DT);
    }
    assert.equal(g.hp, hp);
    Matter.Composite.remove(g.engine.world, barrier);
    dispose(g);
  }
});

test('phase changes cancel active mechanics, preserve native health and expose fresh late-game patterns', () => {
  for (const kind of ['press', 'kiln'] as const) {
    const { g, e, rig } = fixture(kind);
    until(g, rig, () => rig.state === 'windup' && rig.remaining <= 0.6);
    const maxHp = e.maxHp;
    e.hp = e.maxHp * 0.25;
    rig.update(DT);
    assert.equal(rig.phase, 2);
    assert.equal(rig.state, 'transition');
    assert.deepEqual(rig.cues, []);
    assert.equal(rig.duration, 1.2);
    assert.equal(e.maxHp, maxHp);
    assert.deepEqual(e.body.velocity, { x: 0, y: 0 });
    assert.equal(g.shots.length, 0);
    until(g, rig, () => rig.state === 'windup');
    assert(rig.duration >= 1.15);
    e.hp = 0;
    rig.update(DT);
    assert(rig.cancelled);
    assert.deepEqual(rig.cues, []);
    dispose(g);
  }
});

test('pause and hitstop freeze both rigs; NG+ advances patterns without shortening tells or consuming RNG', () => {
  for (const kind of ['press', 'kiln'] as const) {
    const { g, rig } = fixture(kind, 0, false, true);
    assert.equal(rig.phase, 1);
    until(g, rig, () => rig.state === 'windup');
    const snapshot = JSON.stringify({ state: rig.state, remaining: rig.remaining, cues: rig.cues });
    g.mode = 'paused';
    rig.update(0.1);
    assert.equal(
      JSON.stringify({ state: rig.state, remaining: rig.remaining, cues: rig.cues }),
      snapshot,
    );
    g.mode = 'playing';
    g.hitStop = 1;
    rig.update(0.1);
    assert.equal(
      JSON.stringify({ state: rig.state, remaining: rig.remaining, cues: rig.cues }),
      snapshot,
    );
    g.hitStop = 0;
    assert(rig.duration >= 1.15);
    g.rng = seeded('furnace-no-combat-draws');
    const expected = seeded('furnace-no-combat-draws');
    for (let i = 0; i < 90; i++) {
      rig.update(DT);
      void rig.cues;
    }
    assert.equal(g.rng(), expected());
    rig.cancel();
    assert.deepEqual(rig.cues, []);
    dispose(g);
  }
});

test('an externally displaced Press cannot create damaging crush space outside its committed lane', () => {
  const { g, e, rig } = fixture('press');
  until(g, rig, () => rig.state === 'active');
  const lane = rig.cues[0];
  assert(lane.kind === 'lane');
  Matter.Body.setPosition(e.body, { x: lane.x + 200, y: e.body.position.y });
  Matter.Body.setPosition(g.player, { x: lane.x + 200, y: 722 });
  until(g, rig, () => rig.state === 'recover');
  assert.equal(g.hp, 100);
  assert.equal(g.damageControl.lastHit, null);
  dispose(g);
});

test('native enemy update cannot turn a displaced owned Press into unmarked generic contact damage', () => {
  const spec = firstShiftTestFromUrl(new URL('https://test/?test=first-shift&boss=press&v=1'))!;
  assert(spec);
  const g = new Game();
  g.startTest(spec.checkpoint);
  const e = g.bossRemaster.enemy!;
  const rig = g.bossRemaster.rig;
  assert(rig instanceof PressRemaster);
  const idle = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: true,
    fire: false,
    aim: { x: 1000, y: 300 },
  };
  for (let frame = 0; frame < 600 && rig.state !== 'active'; frame++) g.tick(DT, idle);
  assert.equal(rig.state, 'active');
  const cue = rig.cues[0];
  assert(cue.kind === 'lane');
  Matter.Body.setPosition(e.body, { x: cue.x + 220, y: e.body.position.y });
  Matter.Body.setPosition(g.player, { ...e.body.position });
  assert(Matter.Query.collides(g.player, [e.body]).length > 0);
  const hp = g.hp;
  g.updateEnemy(e, DT);
  assert.equal(g.hp, hp);
  assert.equal(g.damageControl.lastHit, null);
  assert.equal((rig.cues[0] as typeof cue).x, cue.x);
  dispose(g);
});
