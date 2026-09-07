import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import {
  COOLING_LOCK,
  SKIMMER_TELL,
  CONDENSER_FOLLOWUP,
  CONDENSER_RECOVER,
  coolingAngles,
  onCoolant,
} from '../src/cooling.ts';
import { getLevel } from '../src/levels.ts';
import { hazardPlacement, hazardBounds } from '../src/hazard-layouts.ts';
import { loadCheckpoint, STAGES, distance } from '../src/rules.ts';

const { Body, Composite } = Matter;
function step(g: Game, frames = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < frames; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1400, y: 400 },
      ...input,
    });
}
function fixture(kind: 'skimmer' | 'condenser' = 'condenser') {
  const g = new Game();
  g.start('cooling-test');
  g.stage = 8;
  g.loadRoom();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.breaches.clear();
  g.hazards.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  g.spawnEnemy(kind, 600, 300);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}

test('Skimmer jets track early, lock, and fire three ordinary colliding projectiles after the full warning', () => {
  const { g, e } = fixture('skimmer');
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.timer, SKIMMER_TELL);
  const first = { ...e.aim },
    started = g.time;
  Body.setPosition(g.player, { x: 1080, y: 520 });
  step(g, 8);
  assert.notDeepEqual(e.aim, first);
  while (e.timer > COOLING_LOCK) step(g);
  const locked = { ...e.aim },
    at = g.time;
  Body.setPosition(g.player, { x: 900, y: 180 });
  while (e.state === 'windup') {
    step(g);
    assert.deepEqual(e.aim, locked);
  }
  assert(g.time - started >= SKIMMER_TELL - 1e-8);
  assert(g.time - at >= COOLING_LOCK - 1 / 60);
  assert.equal(g.shots.length, 3);
  assert(g.shots.every((s) => !s.friendly && s.damage === 18));
  assert(g.shots.every((s) => Math.abs(Math.hypot(s.vel.x, s.vel.y) - 10.2) < 1e-8));
  const center = g.shots[1];
  assert(Math.abs(Math.atan2(center.vel.y, center.vel.x) - Math.atan2(locked.y, locked.x)) < 1e-8);
});

test('Condenser follow-up retargets with a separate full warning, then exposes its rotor', () => {
  const { g, e } = fixture();
  step(g);
  while (e.state === 'windup') step(g);
  assert.equal(e.state, 'followup');
  assert.equal(e.timer, CONDENSER_FOLLOWUP);
  assert.equal(g.shots.length, 3);
  const started = g.time,
    old = { ...e.aim };
  Body.setPosition(g.player, { x: 1000, y: 200 });
  step(g, 8);
  assert.notDeepEqual(e.aim, old);
  while (e.timer > COOLING_LOCK) step(g);
  const locked = { ...e.aim };
  Body.setPosition(g.player, { x: 1000, y: 600 });
  while (e.state === 'followup') {
    step(g);
    assert.deepEqual(e.aim, locked);
  }
  assert(g.time - started >= CONDENSER_FOLLOWUP - 1e-8);
  assert.equal(e.state, 'recover');
  assert.equal(e.timer, CONDENSER_RECOVER);
  assert.equal(e.attacks, 1);
  const before = e.hp;
  g.hitEnemy(e, 100);
  assert(Math.abs(before - e.hp - 130) < 1e-8);
  e.state = 'windup';
  const closed = e.hp;
  g.hitEnemy(e, 100);
  assert(Math.abs(closed - e.hp - 25) < 1e-8);
});

test('purge has four real gaps, rotates between attacks, and never follows the player after appearing', () => {
  const { g, e } = fixture();
  e.attacks = 1;
  step(g);
  assert.equal(e.attack, 'ring');
  const first = coolingAngles(e);
  assert.equal(first.length, 12);
  const circle = first.map((a) => (a + Math.PI * 4) % (Math.PI * 2)).sort((a, b) => a - b);
  const gaps = circle.map(
    (a, i) => (circle[(i + 1) % circle.length] - a + Math.PI * 2) % (Math.PI * 2),
  );
  assert.equal(gaps.filter((a) => a > 0.6).length, 4);
  Body.setPosition(g.player, { x: 1000, y: 650 });
  step(g, 25);
  assert.deepEqual(coolingAngles(e), first);
  while (e.state === 'windup') step(g);
  assert.equal(g.shots.length, 12);
  assert.equal(e.state, 'recover');
  g.shots = [];
  e.state = 'idle';
  e.attacks = 3;
  e.timer = 0;
  step(g);
  assert.equal(e.attack, 'ring');
  assert.notDeepEqual(coolingAngles(e), first);
});

test('cooling warnings freeze on pause and hitstop; phase changes and death cancel unfinished volleys', () => {
  const { g, e } = fixture();
  step(g);
  const aim = { ...e.aim },
    timer = e.timer;
  g.setMode('paused');
  step(g, 120);
  assert.equal(e.timer, timer);
  assert.deepEqual(e.aim, aim);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  assert.equal(e.timer, timer);
  g.hitStop = 0;
  e.hp = e.maxHp * 0.6;
  step(g);
  assert.equal(e.state, 'transition');
  assert.equal(e.phase, 1);
  assert.equal(g.shots.length, 0);
  e.hp = e.maxHp * 0.25;
  step(g);
  assert.equal(e.phase, 2);
  while (e.state === 'transition') step(g);
  e.timer = 0;
  step(g);
  assert.equal(coolingAngles(e).length, 5);
  g.hitEnemy(e, 99999);
  step(g, 120);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.shots.length, 0);
  assert(!Composite.allBodies(g.engine.world).includes(e.body));
});

test('later purges warn again before filling the first ring gaps', () => {
  const { g, e } = fixture();
  e.phase = 1;
  e.hp = e.maxHp * 0.6;
  e.attacks = 1;
  step(g);
  const first = coolingAngles(e);
  while (e.state === 'windup') step(g);
  assert.equal(e.state, 'followup');
  assert.equal(e.timer, 0.95);
  const second = coolingAngles(e);
  assert.notDeepEqual(first, second);
  assert(Math.abs(second[0] - first[0] - Math.PI / 4) < 1e-8);
  const started = g.time;
  while (e.state === 'followup') step(g);
  assert(g.time - started >= 0.95 - 1e-8);
  assert.equal(e.state, 'recover');
});

test('cover cannot nullify Condenser damage even with a strong shared gun build', () => {
  const seed = 'boss-cheese-0',
    g = new Game();
  g.start(seed, {
    version: 3,
    seed,
    stage: 8,
    hp: 100,
    mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'split'],
    kills: 0,
    elapsed: 0,
  });
  const boss = g.enemies[0];
  Body.setPosition(g.player, { x: 355, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  for (let i = 0; i < 3600 && g.mode === 'playing' && boss.hp > 0; i++) {
    const correction = 355 - g.player.position.x - g.player.velocity.x * 5;
    step(g, 1, {
      left: correction < -8,
      right: correction > 8,
      fire: true,
      aim: { ...boss.body.position },
    });
  }
  assert(g.hp <= 20, 'Trading repeated hits should be costly even with a strong build');
  assert(g.shotCount > 20);
});

test('both cooling hulls reposition around solid cover without shooting through it', () => {
  for (const kind of ['skimmer', 'condenser'] as const) {
    const { g, e } = fixture(kind);
    Body.setPosition(g.player, { x: 1000, y: 722 });
    const cover = Matter.Bodies.rectangle(850, 520, 160, 440, { isStatic: true });
    g.terrain.push(cover);
    Composite.add(g.engine.world, cover);
    const initial = { ...e.body.position };
    let fired = 0;
    const shoot = g.enemyShot.bind(g);
    g.enemyShot = (...args) => {
      fired++;
      shoot(...args);
    };
    for (let i = 0; i < 600 && fired === 0; i++) step(g);
    assert(fired > 0, kind + ' never found a lane');
    assert(distance(initial, e.body.position) > 100);
    assert.equal(Matter.Query.collides(e.body, [cover]).length, 0);
    assert(g.shots.every((s) => distance(s.pos, g.lineEnd(e.body.position, s.pos)) < 1));
  }
});

test('coolant carries ground momentum without damage and releases immediately on jumping', () => {
  const speeds = [];
  for (const wet of [false, true]) {
    const g = new Game();
    g.start('COOLING-0');
    g.stage = 6;
    g.loadRoom();
    for (const e of [...g.enemies]) g.hitEnemy(e, 99999);
    g.waves.clear();
    g.hitStop = 0;
    const pool = g.level.coolant![0];
    Body.setPosition(g.player, { x: pool.x + 24, y: 722 });
    if (!wet) g.level.coolant = [];
    Body.setVelocity(g.player, { x: 7, y: 0 });
    g.grounded = true;
    assert.equal(onCoolant(g), wet);
    const hp = g.hp;
    step(g, 12);
    speeds.push(g.player.velocity.x);
    assert.equal(g.hp, hp);
    step(g, 1, { jump: true });
    assert(!onCoolant(g));
    assert(g.player.velocity.y < -10);
  }
  assert(speeds[1] > speeds[0] * 3, 'Coolant should visibly preserve the glide');
});

test('the fourth area supplies twelve rooms, three Cooling Works layouts and a harder final roster', () => {
  const layouts = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const seed = 'cooling-sequence-' + i;
    assert.deepEqual(
      Array.from({ length: STAGES }, (_, s) => getLevel(seed, s).area),
      [
        'docks',
        'docks',
        'docks',
        'furnace',
        'furnace',
        'furnace',
        'cooling',
        'cooling',
        'cooling',
        'rooftops',
        'rooftops',
        'rooftops',
      ],
    );
    for (const stage of [6, 7]) {
      const level = getLevel(seed, stage);
      layouts.add(level.id);
      assert(level.coolant!.length >= 2);
      assert(level.spawns.some((e) => e.kind === 'skimmer'));
    }
    for (const stage of [9, 10]) {
      const level = getLevel(seed, stage);
      assert(level.spawns.filter((e) => e.kind === 'sniper').length >= 2);
      assert.equal(level.spawns.filter((e) => e.elite).length, 1);
    }
    assert.equal(getLevel(seed, 8).spawns[0].kind, 'condenser');
  }
  assert.equal(layouts.size, 3);
});

test('rooftop collapsing platforms leave room to launch over adjacent steps', () => {
  const seed = 'path-run-93',
    level = getLevel(seed, 10),
    h = hazardPlacement(level, seed, 10)!;
  assert(h);
  const b = hazardBounds(h);
  if (h.kind === 'crumble')
    for (const solid of level.solids) {
      if (solid.y >= b.y + b.h)
        assert(solid.x >= b.x + b.w + 64 || solid.x + solid.w <= b.x - 64 || solid.y >= 740);
    }
});

test('ordinary saves retain progress, old completed escapes migrate, and new escapes retain all eleven upgrades', () => {
  const mods = ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'split'];
  const old = {
    version: 3 as const,
    seed: 'legacy-roof',
    stage: 8,
    hp: 65,
    mods,
    kills: 40,
    elapsed: 123,
  };
  assert.equal(loadCheckpoint(old), old);
  const legacy = loadCheckpoint({ ...old, escape: true })!;
  assert.equal(legacy.stage, 11);
  assert.equal(legacy.mods.length, 8);
  const g = new Game();
  g.start(legacy.seed, legacy);
  assert.equal(g.escape?.phase, 'route');
  assert.equal(g.mods.length, 8);
  const current = loadCheckpoint({ ...legacy, mods: [...mods, 'deadeye', 'execute', 'burst'] })!;
  g.start(current.seed, current);
  assert.equal(g.mods.length, 11);
  assert.equal(g.hp, 65);
  assert.equal(loadCheckpoint({ ...current, stage: 7 }), null);
});
