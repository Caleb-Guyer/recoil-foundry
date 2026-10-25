import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { CondenserRemaster, CONDENSER_REMASTER as C } from '../src/condenser-remaster.ts';

const { Body, Bodies, Composite, Engine } = Matter;
const FRAME = 1 / 60;
function fixture(phase = 0) {
  const g = new Game();
  // Intentionally use an older room identity: this fixture exercises the opt-in
  // AI directly without giving the legacy dispatcher a second update.
  g.start('condenser-remaster-unit');
  g.stage = 11;
  g.loadRoom();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const enemy of g.enemies) Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  g.waves.clear();
  g.breaches.clear();
  g.hazards.clear();
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  g.spawnEnemy('condenser', 600, 300);
  const e = g.enemies[0];
  e.spawn = 0;
  e.hp = e.maxHp * [1, 0.6, 0.25][phase];
  g.level.coolant = [
    { x: 600, y: 731, w: 360, h: 9 },
    { x: 1230, y: 731, w: 260, h: 9 },
  ];
  const ai = new CondenserRemaster(g, e);
  return { g, e, ai };
}
function step(g: Game, ai: CondenserRemaster, frames = 1) {
  for (let i = 0; i < frames; i++) {
    g.time += FRAME;
    if (g.hitStop > 0) g.hitStop = Math.max(0, g.hitStop - FRAME);
    ai.update(FRAME);
  }
}
function until(g: Game, ai: CondenserRemaster, done: () => boolean, maxFrames = 1000) {
  for (let i = 0; i < maxFrames; i++) {
    if (done()) return;
    step(g, ai);
  }
  assert.fail(`Condenser did not reach expected state: ${JSON.stringify(ai.snapshot)}`);
}
function windup(g: Game, ai: CondenserRemaster) {
  until(g, ai, () => ai.state === 'windup');
}

test('remastered pressure tracks early, visibly locks, warns fully and preserves recovery armor', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  assert.equal(ai.attack, 'pressure');
  assert.equal(ai.duration, C.pressureTell);
  assert.equal(ai.cues.length, 3);
  assert(ai.cues.every((cue) => !cue.active && !cue.locked && cue.progress === 0));
  const at = g.time,
    first = { ...e.aim };
  Body.setPosition(g.player, { x: 1100, y: 500 });
  step(g, ai, 8);
  assert.notDeepEqual(e.aim, first);
  until(g, ai, () => ai.remaining <= C.lock);
  const locked = { ...e.aim };
  assert(ai.cues.every((cue) => cue.locked));
  Body.setPosition(g.player, { x: 900, y: 100 });
  until(g, ai, () => ai.state !== 'windup');
  assert.deepEqual(e.aim, locked);
  assert(g.time - at >= C.pressureTell - 1e-8);
  assert.equal(g.shots.length, 3);
  assert(g.shots.every((s) => !s.friendly && s.damage === C.damage && s.radius === 5));
  assert(g.shots.every((s) => Math.abs(Math.hypot(s.vel.x, s.vel.y) - 10.2) < 1e-8));
  assert.equal(e.state, 'recover');
  assert.equal(ai.remaining, C.recover);
  const before = e.hp;
  g.hitEnemy(e, 100);
  assert.equal(before - e.hp, 130);
});

test('purge warns twelve native round paths, leaves four real gaps and stays committed', () => {
  const { g, ai } = fixture();
  windup(g, ai);
  until(g, ai, () => ai.state === 'recover');
  g.shots = [];
  until(g, ai, () => ai.state === 'windup' && ai.attack === 'purge');
  const at = g.time;
  const vectors = ai.cues.map((cue) => {
    assert.equal(cue.kind, 'segment');
    if (cue.kind !== 'segment') throw new Error('expected segment');
    return Math.atan2(cue.to.y - cue.from.y, cue.to.x - cue.from.x);
  });
  assert.equal(vectors.length, 12);
  const circle = vectors.map((a) => (a + Math.PI * 4) % (Math.PI * 2)).sort((a, b) => a - b);
  const gaps = circle.map(
    (a, i) => (circle[(i + 1) % circle.length] - a + Math.PI * 2) % (Math.PI * 2),
  );
  assert.equal(gaps.filter((a) => a > 0.6).length, 4);
  Body.setPosition(g.player, { x: 1200, y: 650 });
  step(g, ai, 35);
  assert.deepEqual(
    ai.cues.map((cue) => {
      if (cue.kind !== 'segment') throw new Error('expected segment');
      return Math.atan2(cue.to.y - cue.from.y, cue.to.x - cue.from.x);
    }),
    vectors,
  );
  until(g, ai, () => ai.state !== 'windup');
  assert(g.time - at >= C.purgeTell - 1e-8);
  assert.equal(g.shots.length, 12);
  assert(g.shots.every((s) => Math.abs(Math.hypot(s.vel.x, s.vel.y) - 7.8) < 1e-8));
  assert.equal(ai.state, 'recover');
});

test('cover clips warning rays and stops the actual ordinary pressure bullets', () => {
  const { g, ai } = fixture();
  windup(g, ai);
  const wall = Bodies.rectangle(800, 400, 40, 700, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  assert(ai.cues.every((cue) => cue.kind === 'segment' && cue.to.x <= 775.001));
  until(g, ai, () => ai.state !== 'windup');
  const hp = g.hp;
  assert.equal(g.shots.length, 3);
  for (let frame = 0; frame < 100; frame++) {
    g.time += FRAME;
    g.updateShots(FRAME);
  }
  assert.equal(g.hp, hp);
  assert.equal(g.shots.length, 0);
});

test('phase-one cooling front is fixed, fully warned and deals only one accepted pulse hit', () => {
  const { g, ai } = fixture(1);
  Body.setPosition(g.player, { x: 750, y: 720 });
  windup(g, ai);
  assert.equal(ai.attack, 'front');
  const at = g.time,
    hp = g.hp;
  const initial = ai.cues;
  assert.equal(initial.length, 1);
  const lane = initial[0];
  assert.equal(lane.kind, 'lane');
  if (lane.kind !== 'lane') throw new Error('expected lane');
  assert.deepEqual(
    { x: lane.x, width: lane.width, top: lane.top, bottom: lane.bottom },
    { x: 780, width: 360, top: C.frontTop, bottom: C.floor },
  );
  Body.setPosition(g.player, { x: 1300, y: 720 });
  step(g, ai, 30);
  assert.equal(g.hp, hp);
  assert(ai.cues.every((cue) => cue.kind === 'lane' && cue.x - cue.width / 2 === 600));
  Body.setPosition(g.player, { x: 750, y: 720 });
  until(g, ai, () => ai.state === 'active');
  assert(g.time - at >= C.frontTell - 1e-8);
  assert.equal(g.hp, hp - C.damage);
  assert(ai.cues.every((cue) => cue.active && cue.progress === 1));
  until(g, ai, () => ai.state === 'recover');
  assert.equal(g.hp, hp - C.damage);
  assert.equal(ai.remaining, C.recover);
});

test('a real player body above the cooling-front rectangle takes no pulse damage', () => {
  const { g, ai } = fixture(1);
  Body.setStatic(g.player, false);
  const shelf = Bodies.rectangle(780, 640, 200, 20, { isStatic: true });
  Composite.add(g.engine.world, shelf);
  g.terrain.push(shelf);
  Body.setPosition(g.player, { x: 780, y: 600 });
  const hp = g.hp;
  windup(g, ai);
  // Native Matter gravity/solid collision settles the player on the safe shelf.
  for (let frame = 0; frame < 120; frame++) {
    step(g, ai);
    Engine.update(g.engine, 1000 / 60);
    if (ai.state === 'recover') break;
  }
  assert.equal(ai.state, 'recover');
  assert(g.player.bounds.max.y < C.frontTop);
  assert.equal(g.hp, hp);
});

test('phase-two cascade has separate full purge and locked-pressure warnings', () => {
  const { g, ai } = fixture(2);
  windup(g, ai);
  assert.equal(ai.attack, 'cascade');
  assert.equal(ai.duration, C.purgeTell);
  assert.equal(ai.cues.length, 12);
  until(g, ai, () => ai.state === 'recover');
  assert.equal(ai.remaining, C.linkedOpening);
  assert.equal(g.shots.length, 12);
  const openingAt = g.time;
  windup(g, ai);
  assert(g.time - openingAt >= C.linkedOpening - 1e-8);
  assert.equal(ai.duration, C.pressureTell);
  assert.equal(ai.cues.length, 5);
  assert(ai.cues.every((cue) => cue.progress === 0 && !cue.active));
  const pressureAt = g.time;
  until(g, ai, () => ai.state === 'recover');
  assert(g.time - pressureAt >= C.pressureTell - 1e-8);
  assert.equal(g.shots.length, 17);
  assert.equal(ai.remaining, C.recover);
  g.shots = [];
  windup(g, ai);
  assert.equal(ai.attack, 'front');
  assert.equal(ai.cues.length, 2);
});

test('phase changes cancel pending attacks and leave a recovery before another full tell', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  e.hp = e.maxHp * 0.6;
  step(g, ai);
  assert.equal(ai.phase, 1);
  assert.equal(ai.state, 'transition');
  assert.equal(ai.remaining, C.transition);
  assert.equal(ai.cues.length, 0);
  assert.equal(g.shots.length, 0);
  const at = g.time;
  until(g, ai, () => ai.state === 'recover');
  assert(g.time - at >= C.transition - 1e-8);
  assert.equal(g.shots.length, 0);
  windup(g, ai);
  assert.equal(ai.attack, 'front');
  assert.equal(ai.remaining, C.frontTell);
  e.hp = e.maxHp * 0.25;
  step(g, ai);
  assert.equal(ai.phase, 2);
  assert.equal(ai.state, 'transition');
  assert.equal(ai.cues.length, 0);
  assert.equal(g.shots.length, 0);
});

test('pause and hitstop freeze warning progress, while death/removal cancel it permanently', () => {
  const { g, e, ai } = fixture();
  windup(g, ai);
  const before = ai.snapshot;
  g.setMode('paused');
  ai.update(1);
  assert.deepEqual(ai.snapshot, before);
  g.setMode('playing');
  g.hitStop = 1;
  ai.update(FRAME);
  assert.deepEqual(ai.snapshot, before);
  g.hitStop = 0;
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) ai.update(value);
  assert.deepEqual(ai.snapshot, before);
  e.hp = 0;
  ai.update(FRAME);
  assert(ai.cancelled);
  assert.equal(ai.cues.length, 0);
  e.hp = e.maxHp;
  ai.update(10);
  assert.equal(g.shots.length, 0);
  const second = fixture();
  windup(second.g, second.ai);
  second.g.enemies = [];
  second.ai.update(FRAME);
  assert(second.ai.cancelled);
  assert.equal(second.ai.cues.length, 0);
});

test('remastered hull finds an actual firing lane around cover using native Matter collision', () => {
  const { g, e, ai } = fixture();
  Body.setPosition(g.player, { x: 1000, y: 722 });
  const wall = Bodies.rectangle(850, 520, 160, 440, { isStatic: true });
  Composite.add(g.engine.world, wall);
  g.terrain.push(wall);
  const initial = { ...e.body.position };
  let fired = 0;
  const shoot = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    fired++;
    shoot(...args);
  };
  for (let frame = 0; frame < 1200 && fired === 0; frame++) {
    step(g, ai);
    Engine.update(g.engine, 1000 / 60);
  }
  assert(fired > 0, 'Condenser never acquired a real firing lane');
  assert(Math.hypot(initial.x - e.body.position.x, initial.y - e.body.position.y) > 100);
  assert.equal(Matter.Query.collides(e.body, [wall]).length, 0);
  assert(
    g.shots.every(
      (s) =>
        Math.hypot(
          g.lineEnd(e.body.position, s.pos).x - s.pos.x,
          g.lineEnd(e.body.position, s.pos).y - s.pos.y,
        ) < 1,
    ),
  );
});

test('New Game+ starts in its native threshold phase without health or armor inflation', () => {
  const { g, e } = fixture();
  g.overtime = 1;
  const hp = e.hp,
    maxHp = e.maxHp;
  const ai = new CondenserRemaster(g, e);
  assert.equal(ai.phase, 1);
  windup(g, ai);
  assert.equal(ai.attack, 'front');
  assert.equal(e.hp, hp);
  assert.equal(e.maxHp, maxHp);
  e.hp = e.maxHp * 0.49;
  step(g, ai);
  assert.equal(ai.phase, 2);
  assert.equal(ai.state, 'transition');
});

test('cooling-front rendered rectangle matches exact accepted damage bounds at both edges', () => {
  for (const edge of ['left', 'right'] as const) {
    for (const inside of [false, true]) {
      const { g, ai } = fixture(1);
      Body.setPosition(g.player, { x: 750, y: 720 });
      windup(g, ai);
      const cue = ai.cues[0];
      assert.equal(cue.kind, 'lane');
      if (cue.kind !== 'lane') throw new Error('expected lane');
      const renderedLeft = cue.x - cue.width / 2;
      const renderedRight = cue.x + cue.width / 2;
      assert.equal(renderedLeft, 600);
      assert.equal(renderedRight, 960);
      const half = (g.player.bounds.max.x - g.player.bounds.min.x) / 2;
      const x =
        edge === 'left'
          ? renderedLeft - half + (inside ? 0.1 : -0.1)
          : renderedRight + half + (inside ? -0.1 : 0.1);
      Body.setPosition(g.player, { x, y: 720 });
      const hp = g.hp;
      until(g, ai, () => ai.state === 'active');
      assert.equal(g.hp < hp, inside, `${edge} edge inside=${inside}`);
    }
  }
});

test('velocity-padded Matter broadphase cannot extend cooling-front damage beyond the drawn rectangle', () => {
  for (const spot of [
    { x: 586.5, y: 720, velocity: { x: 20, y: 0 } },
    { x: 973.5, y: 720, velocity: { x: -20, y: 0 } },
    { x: 750, y: 665.5, velocity: { x: 0, y: 20 } },
  ]) {
    const { g, ai } = fixture(1);
    Body.setPosition(g.player, { x: 750, y: 720 });
    windup(g, ai);
    Body.setPosition(g.player, spot);
    Matter.Bounds.update(g.player.bounds, g.player.vertices, spot.velocity);
    const hp = g.hp;
    until(g, ai, () => ai.state === 'active');
    assert.equal(g.hp, hp);
  }
});

test('the final damaging cooling-front frame retains its exact visible rectangle until the next update', () => {
  const { g, ai } = fixture(1);
  Body.setPosition(g.player, { x: 750, y: 650 });
  windup(g, ai);
  until(g, ai, () => ai.state === 'active');
  const cue = ai.cues[0];
  assert.equal(cue.kind, 'lane');
  until(g, ai, () => ai.remaining <= FRAME);
  const hp = g.hp;
  Body.setPosition(g.player, { x: 750, y: 720 });
  step(g, ai);
  assert.equal(g.hp, hp - C.damage);
  assert.equal(ai.state, 'active');
  assert.equal(ai.remaining, 0);
  assert.deepEqual(ai.cues, [cue]);
  until(g, ai, () => ai.state === 'recover');
  assert.equal(ai.cues.length, 0);
  assert.equal(g.hp, hp - C.damage);
});
