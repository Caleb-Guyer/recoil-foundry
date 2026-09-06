import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { LIFT_PERIOD, CRUSHER_TELL, CRUMBLE_TELL, CRUMBLE_RESET } from '../src/hazards.ts';

const { Body, Bodies, Composite, Query } = Matter;
const DT = 1 / 60;

function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(DT, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1600, y: 500 },
      ...input,
    });
}

function until(g: Game, condition: () => boolean, limit = 300) {
  for (let i = 0; i < limit && !condition(); i++) step(g);
  assert(condition(), 'Timed out waiting for the hazard state');
}

function fixture() {
  const g = new Game();
  g.start('hazard-combat');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  Body.setPosition(g.player, { x: 600, y: 721 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  return g;
}

function lift(g: Game) {
  return g.hazards.spawn({ kind: 'lift', x: 600, y: 620, w: 180, h: 18, travel: 180 });
}

function crusher(g: Game) {
  return g.hazards.spawn({ kind: 'crusher', x: 600, y: 180, w: 130, h: 40, travel: 520 });
}

function crumble(g: Game) {
  return g.hazards.spawn({ kind: 'crumble', x: 600, y: 580, w: 180, h: 18, travel: 0 });
}

function bullet(g: Game, x: number, y: number, vx: number) {
  g.addShot({
    pos: { x, y },
    vel: { x: vx, y: 0 },
    damage: 24,
    life: 2,
    friendly: true,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
}

test('a lift carries the standing player through its ascent and descent without falling or damage', () => {
  const g = fixture(),
    h = lift(g);
  Body.setPosition(g.player, { x: 600, y: 602 });
  let highest = g.player.position.y;
  for (let i = 0; i < LIFT_PERIOD * 60; i++) {
    step(g);
    highest = Math.min(highest, g.player.position.y);
    const gap = h.body.bounds.min.y - g.player.bounds.max.y;
    assert(Math.abs(gap) < 4, `Lost the lift at frame ${i}: gap ${gap}`);
    assert.equal(g.hp, 100);
  }
  assert(highest < 425);
  assert(Math.abs(g.player.position.y - 602) < 3);
  assert(g.grounded);
});

test('jumping and a downward recoil shot escape a rising lift without being recaptured', () => {
  for (const recoil of [false, true]) {
    const g = fixture(),
      h = lift(g);
    Body.setPosition(g.player, { x: 600, y: 602 });
    step(g, 90);
    assert(g.grounded);
    const before = g.player.position.y;
    step(g, 1, {
      jump: true,
      fire: recoil,
      aim: { x: g.player.position.x, y: g.player.position.y + 300 },
    });
    assert(g.player.velocity.y < (recoil ? -15 : -10));
    step(g, 8);
    assert(g.player.position.y < before - 65);
    assert(h.body.bounds.min.y - g.player.bounds.max.y > 60);
    assert(!g.grounded);
  }
});

test('a lift stops before squeezing a rider through a ceiling and resumes when the obstruction clears', () => {
  const g = fixture(),
    h = lift(g);
  const ceiling = Bodies.rectangle(600, 460, 300, 40, { isStatic: true });
  g.terrain.push(ceiling);
  Composite.add(g.engine.world, ceiling);
  Body.setPosition(g.player, { x: 600, y: 602 });
  for (let i = 0; i < 300; i++) {
    step(g);
    assert(g.player.bounds.min.y >= 479, 'The lift carried its rider through a ceiling');
  }
  assert(h.body.bounds.min.y > 510);
  assert(g.grounded);
  const phase = h.phase,
    top = h.body.bounds.min.y;
  Composite.remove(g.engine.world, ceiling);
  g.terrain = g.terrain.filter((body) => body !== ceiling);
  step(g, 60);
  assert(h.phase > phase);
  assert(h.body.bounds.min.y < top - 20);
  assert.equal(g.hp, 100);
});

test('walking off a lift releases support, and a resting crate rides with it', () => {
  const g = fixture(),
    h = lift(g),
    crate = g.props.spawn('crate', 550, 598);
  Body.setPosition(g.player, { x: 625, y: 602 });
  step(g, 120);
  assert(crate.body.position.y < 525);
  assert(Math.abs(h.body.bounds.min.y - crate.body.bounds.max.y) < 4);
  step(g, 40, { right: true });
  assert(g.player.position.x > h.body.bounds.max.x + 25);
  step(g, 30);
  assert(g.player.position.y > h.body.bounds.max.y + 40);
  assert.equal(g.hp, 100);
});

test('a lift carries stacked crates and their standing player through a complete cycle without stalling', () => {
  const g = fixture(),
    h = lift(g),
    lower = g.props.spawn('crate', 600, 598),
    upper = g.props.spawn('crate', 600, 554);
  Body.setPosition(g.player, { x: 600, y: 514 });
  let highest = g.player.position.y;
  for (let i = 0; i < LIFT_PERIOD * 60; i++) {
    step(g);
    highest = Math.min(highest, g.player.position.y);
    assert(Math.abs(h.body.bounds.min.y - lower.body.bounds.max.y) < 4);
    assert(Math.abs(lower.body.bounds.min.y - upper.body.bounds.max.y) < 4);
    assert(Math.abs(upper.body.bounds.min.y - g.player.bounds.max.y) < 4);
  }
  assert(highest < 340, 'The stack obstructed the lift before it reached its top');
  assert(h.phase > LIFT_PERIOD - 0.1 || h.phase < 0.1);
  assert(Math.abs(g.player.position.y - 514) < 4);
  assert(g.grounded);
  assert.equal(g.hp, 100);
});

test('a moving lift blocks actual bullets and sight lines only at its current solid position', () => {
  const g = fixture(),
    h = lift(g);
  Body.setPosition(g.player, { x: 300, y: 721 });
  const lane = h.body.position.y;
  assert(g.solidBodies.includes(h.body));
  assert(g.lineEnd({ x: 400, y: lane }, { x: 800, y: lane }).x < 520);
  bullet(g, 400, lane, 30);
  g.updateShots(0.25);
  assert.equal(g.shots.length, 0);
  step(g, 120);
  assert.deepEqual(g.lineEnd({ x: 400, y: lane }, { x: 800, y: lane }), { x: 800, y: lane });
  bullet(g, 400, lane, 30);
  g.updateShots(0.25);
  assert.equal(g.shots.length, 1);
  assert(g.shots[0].pos.x > 800);
});

test('a crusher gives its complete warning and leaves enough time to leave the marked lane', () => {
  const g = fixture(),
    h = crusher(g);
  until(g, () => h.state === 'warning', 30);
  const started = g.time,
    top = h.body.bounds.min.y;
  step(g, Math.floor(CRUSHER_TELL * 60) - 2);
  assert.equal(h.state, 'warning');
  assert.equal(h.body.bounds.min.y, top);
  Body.setPosition(g.player, { x: 850, y: 721 });
  until(g, () => h.state === 'falling', 5);
  assert(g.time - started >= CRUSHER_TELL - 1e-6);
  until(g, () => h.state === 'rest', 60);
  assert.equal(g.hp, 100);
  assert.equal(h.body.bounds.max.y, 740);
});

test('a crusher sweep damages the player once per drop and the resting body does not deal contact damage', () => {
  const g = fixture(),
    h = crusher(g);
  until(g, () => h.state === 'rest');
  assert.equal(g.hp, 76);
  const hp = g.hp;
  step(g, 60);
  assert.equal(g.hp, hp);
  assert.equal(g.mode, 'playing');
  assert(Number.isFinite(g.player.position.y));
});

test('crusher ejection chooses the free side instead of passing through a blocking prop', () => {
  for (const blockedSide of [-1, 1]) {
    const g = fixture(),
      h = g.hazards.spawn({ kind: 'crusher', x: 600, y: 660, w: 130, h: 40, travel: 40 });
    const cover = g.props.spawn('cover', 600 + blockedSide * 82, 700);
    Body.setPosition(g.player, { x: 600 + blockedSide, y: 721 });
    h.state = 'falling';
    step(g);
    assert.equal(g.hp, 76);
    assert((g.player.position.x - 600) * blockedSide < -70);
    assert.equal(Query.collides(g.player, [cover.body]).length, 0);
    assert.equal(cover.hp, cover.maxHp);
  }
});

test('a crusher stops above a player with both escape sides blocked instead of squeezing or teleporting them', () => {
  const g = fixture(),
    h = g.hazards.spawn({ kind: 'crusher', x: 600, y: 660, w: 130, h: 40, travel: 40 });
  const covers = [-1, 1].map((side) => g.props.spawn('cover', 600 + side * 82, 700));
  h.state = 'falling';
  step(g);
  assert.equal(g.hp, 76);
  for (let i = 0; i < 90; i++) {
    step(g);
    assert(Math.abs(g.player.position.x - 600) < 10);
    const playerTop = Math.min(...g.player.vertices.map((vertex) => vertex.y));
    assert(h.body.bounds.max.y <= playerTop + 0.6, 'The slab crossed the trapped player');
    assert.equal(
      Query.collides(
        g.player,
        covers.map((cover) => cover.body),
      ).length,
      0,
    );
    assert.equal(g.hp, 76);
  }
});

test('a crusher damages enemies and props in its swept path while its top is safe to stand on', () => {
  const g = fixture(),
    h = crusher(g);
  g.spawnEnemy('shooter', 600, 530);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  e.hp = 60;
  const prop = g.props.spawn('cover', 600, 650);
  const enemyHp = e.hp;
  until(g, () => h.state === 'warning', 30);
  Body.setPosition(g.player, { x: 600, y: h.body.bounds.min.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => h.state === 'rest');
  assert.equal(enemyHp - e.hp, 60);
  assert(prop.hp < prop.maxHp || !g.props.items.includes(prop));
  assert.equal(g.hp, 100);
  assert(g.player.position.y < h.body.bounds.min.y);
});

test('crusher bodies stop both player and enemy rounds instead of allowing muzzle or fast-shot tunneling', () => {
  const g = fixture();
  g.hazards.spawn({ kind: 'crusher', x: 600, y: 300, w: 130, h: 40, travel: 400 });
  Body.setPosition(g.player, { x: 400, y: 320 });
  Body.setStatic(g.player, true);
  g.spawnEnemy('sniper', 800, 320);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  bullet(g, 400, 320, 30);
  g.enemyShot(e, Math.PI, 18, 20);
  g.updateShots(0.4);
  assert.equal(g.shots.length, 0);
  assert.equal(e.hp, e.maxHp);
  assert.equal(g.hp, 100);
});

test('a collapsing platform warns only after being stood on, disappears, and drops the player to safe floor', () => {
  const g = fixture(),
    h = crumble(g);
  Body.setPosition(g.player, { x: 800, y: 721 });
  step(g, 90);
  assert.equal(h.state, 'idle');
  Body.setPosition(g.player, { x: 600, y: 562 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => h.state === 'warning', 5);
  const started = g.time;
  step(g, Math.floor(CRUMBLE_TELL * 60) - 2);
  assert.equal(h.state, 'warning');
  assert(g.hazards.bodies.includes(h.body));
  until(g, () => h.state === 'gone', 5);
  assert(g.time - started >= CRUMBLE_TELL - 1e-6);
  assert(!h.visible);
  assert(!g.hazards.bodies.includes(h.body));
  assert(!Composite.allBodies(g.engine.world).includes(h.body));
  step(g, 60);
  assert(g.player.position.y > 710);
  assert.equal(g.hp, 100);
  assert(g.grounded);
});

test('a collapsed platform waits for overlapping players or props to leave before restoring', () => {
  for (const useProp of [false, true]) {
    const g = fixture(),
      h = crumble(g);
    Body.setPosition(g.player, { x: 600, y: 562 });
    until(g, () => h.state === 'gone');
    Body.setPosition(g.player, { x: useProp ? 900 : 600, y: useProp ? 721 : 589 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    Body.setStatic(g.player, true);
    const blocker = useProp ? g.props.spawn('crate', 600, 589).body : g.player;
    Body.setStatic(blocker, true);
    step(g, Math.ceil(CRUMBLE_RESET * 60) + 20);
    assert.equal(h.state, 'gone');
    assert(!g.hazards.bodies.includes(h.body));
    Body.setPosition(blocker, { x: 1000, y: 500 });
    until(g, () => h.state === 'idle', 10);
    assert(h.visible);
    assert(g.hazards.bodies.includes(h.body));
    assert(Composite.allBodies(g.engine.world).includes(h.body));
  }
});

test('pause, hitstop, and death freeze lift motion and hazard warnings', () => {
  for (const spawn of [lift, crusher, crumble]) {
    const g = fixture(),
      h = spawn(g);
    if (h.kind === 'crumble') Body.setPosition(g.player, { x: 600, y: 562 });
    step(g, 5);
    const snapshot = () => ({
      state: h.state,
      phase: h.phase,
      timer: h.timer,
      pos: { ...h.body.position },
      visible: h.visible,
    });
    const before = snapshot();
    g.setMode('paused');
    step(g, 90);
    assert.deepEqual(snapshot(), before);
    g.setMode('playing');
    g.hitStop = 0.1;
    step(g, 5);
    assert.deepEqual(snapshot(), before);
    g.damagePlayer(9999);
    assert.equal(g.mode, 'dead');
    step(g, 120);
    assert.deepEqual(snapshot(), before);
  }
});

test('a lethal crusher sweep stops later hazards and room reload replaces all transient hazard state', () => {
  const g = fixture(),
    h = g.hazards.spawn({ kind: 'crusher', x: 600, y: 680, w: 130, h: 40, travel: 20 }),
    later = lift(g);
  h.state = 'falling';
  g.hp = 1;
  const phase = later.phase;
  step(g);
  assert.equal(g.mode, 'dead');
  assert.equal(g.hp, 0);
  assert.equal(later.phase, phase);
  step(g, 90);
  assert.equal(later.phase, phase);
  const oldBodies = g.hazards.items.map((item) => item.body);
  const save = {
    version: 3 as const,
    seed: 'hazard-continue',
    stage: 4,
    hp: 80,
    mods: ['kick'],
    kills: 12,
    elapsed: 45,
  };
  const fresh = new Game();
  fresh.start(save.seed, save);
  g.start(save.seed, save);
  assert.equal(g.mode, 'playing');
  assert.equal(g.hp, 80);
  assert.equal(g.elapsed, 45);
  assert.deepEqual(
    g.hazards.items.map((item) => ({
      placement: item.placement,
      state: item.state,
      timer: item.timer,
      phase: item.phase,
    })),
    fresh.hazards.items.map((item) => ({
      placement: item.placement,
      state: item.state,
      timer: item.timer,
      phase: item.phase,
    })),
  );
  for (const body of oldBodies) assert(!Composite.allBodies(g.engine.world).includes(body));
});
