import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { distance, loadCheckpoint, getGun } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadEncounters, testEncounterFromUrl } from '../src/practice.ts';
import { interceptorAngles, interceptorLock, INTERCEPTOR_HEAVY_TELL } from '../src/interceptor.ts';
import { dodgePilot } from './combat-pilot.ts';
const { Body, Bodies, Composite, Engine, Query } = Matter;
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function step(g: Game, n = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1400, y: 300 },
      ...input,
    });
}
const seedFor = (mirror = false) => (mirror ? 'interceptor-fight-4' : 'interceptor-fight-3');
function fixture() {
  const g = new Game(),
    seed = seedFor();
  assert(g.startPractice({ kind: 'interceptor', seed }));
  for (const prop of [...g.props.items]) g.props.remove(prop);
  g.hazards.clear();
  g.breaches.clear();
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  Body.setPosition(e.body, { x: 600, y: 400 });
  Body.setStatic(e.body, true);
  Body.setPosition(g.player, { x: 1000, y: 400 });
  Body.setStatic(g.player, true);
  return { g, e };
}
function until(g: Game, done: () => boolean, limit = 600) {
  for (let i = 0; i < limit && !done() && g.mode === 'playing'; i++) step(g);
  assert(done(), 'Expected transition never arrived');
}

test('the gunner is the only finale and alternate Reclamation bosses preserve every other room', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = 'interceptor-selection-' + i;
    const level = getLevel(seed, 19);
    seen.add(level.spawns[0].kind + ':' + level.mirrored);
    assert.deepEqual(level, getLevel(seed, 19));
    assert.equal(level.spawns[0].kind, 'interceptor');
    for (let stage = 0; stage < 20; stage++) {
      if (stage === 15) continue;
      assert.deepEqual(
        getLevel(seed, stage, undefined, 'boss'),
        getLevel(seed, stage, undefined, 'interceptor'),
      );
    }
  }
  assert.equal(seen.size, 2);
  const g = new Game(),
    day = dailyForDate('2026-09-07')!;
  const save: Checkpoint = {
    version: 5,
    seed: day.seed,
    stage: 19,
    hp: 63,
    mods: ['magnum'],
    kills: 45,
    elapsed: 500,
  };
  assert(loadCheckpoint(save));
  g.start(day.seed, save);
  assert.deepEqual(g.level, getLevel(day.seed, 19));
  assert.equal(g.hp, 63);
});

test('aimed volleys and heavy blasts track early, lock every lane and finish their full tell before firing', () => {
  for (const heavy of [false, true]) {
    const { g, e } = fixture();
    e.attacks = heavy ? 1 : 0;
    step(g);
    const started = g.time,
      tell = e.timer;
    assert.equal(e.attack, heavy ? 'heavy' : 'aimed');
    if (heavy) near(tell, INTERCEPTOR_HEAVY_TELL);
    Body.setPosition(g.player, { x: 1000, y: 240 });
    step(g, 10);
    assert(e.aim.y < -0.1);
    until(g, () => e.timer <= interceptorLock(e));
    const armored = e.hp;
    g.hitEnemy(e, 100);
    near(armored - e.hp, 35);
    const aim = { ...e.aim },
      origin = { ...e.interceptor!.origin },
      angles = interceptorAngles(e);
    Body.setPosition(g.player, { x: 350, y: 250 });
    const fired: number[] = [];
    g.enemyShot = (_e, a) => fired.push(a);
    while (e.state === 'windup') {
      step(g);
      if (e.state === 'windup') {
        assert.deepEqual(e.aim, aim);
        assert.deepEqual(e.interceptor!.origin, origin);
      }
      if (g.time - started < tell - 1e-8) assert.equal(fired.length, 0);
    }
    assert.deepEqual(fired, angles);
    assert.equal(e.state, heavy ? 'recover' : 'followup');
    if (!heavy) {
      const followupAt = g.time;
      until(g, () => e.state === 'recover');
      assert(g.time - followupAt >= 0.78 - 1 / 60);
      assert.equal(fired.length, angles.length * 2);
    }
    const before = e.hp;
    g.hitEnemy(e, 100);
    near(before - e.hp, 130);
  }
});

test('every phase has separately warned volleys with recovery after the whole combination', () => {
  for (const phase of [0, 1, 2]) {
    const { g, e } = fixture();
    e.phase = phase;
    e.hp = e.maxHp * [1, 0.6, 0.3][phase];
    const volleys: number[] = [];
    g.enemyShot = () => {
      if (volleys.at(-1) !== g.time) volleys.push(g.time);
    };
    step(g);
    let tells = 1,
      previous = e.state;
    for (let i = 0; i < 400 && e.state !== 'recover'; i++) {
      step(g);
      if (e.state === 'followup' && (previous !== 'followup' || e.timer > 0.65)) {
        // Count actual release boundaries, not frames in the same tell.
        tells = Math.max(tells, e.interceptor!.volley + 1);
      }
      previous = e.state;
    }
    assert.equal(volleys.length, Math.max(1, phase) + 1);
    assert.equal(tells, Math.max(1, phase) + 1);
    assert.equal(e.state, 'recover');
    for (let i = 1; i < volleys.length; i++) assert(volleys[i] - volleys[i - 1] >= 0.69);
  }
});

test('vault shots propel the physical hull opposite its gun, and heavy shots preserve a substantial recoil kick', () => {
  for (const heavy of [false, true]) {
    const { g, e } = fixture();
    Body.setStatic(e.body, false);
    if (heavy) e.attacks = 1;
    else e.interceptor!.relocate = true;
    step(g);
    assert.equal(e.attack, heavy ? 'heavy' : 'vault');
    until(g, () => e.timer <= interceptorLock(e));
    const origin = { ...e.body.position },
      aim = { ...e.aim };
    until(g, () => e.state === (heavy ? 'recover' : 'airborne'));
    assert(e.body.velocity.x * aim.x + e.body.velocity.y * aim.y < -2);
    step(g, 8);
    assert(distance(origin, e.body.position) > 20);
    assert(!e.body.isStatic);
  }
});

test('recoil travel collides with walls and props; all attack rounds are stopped by thin cover', () => {
  for (const obstacle of ['wall', 'crate', 'canister'] as const) {
    const { g, e } = fixture();
    Body.setStatic(e.body, false);
    const wall =
      obstacle === 'wall' ? Bodies.rectangle(672, 400, 12, 160, { isStatic: true }) : null;
    const prop = wall ? null : g.props.spawn(obstacle as 'crate' | 'canister', 672, 400);
    if (wall) {
      g.terrain.push(wall);
      Composite.add(g.engine.world, wall);
    }
    Body.setVelocity(e.body, { x: 12, y: 0 });
    for (let i = 0; i < 15; i++) {
      g.time += 1 / 60;
      g.props.beforeStep();
      Engine.update(g.engine, 1000 / 60);
      g.props.afterStep(1 / 60);
    }
    if (wall) {
      assert(e.body.position.x < 645);
      assert(Query.collides(e.body, [wall]).every((hit) => hit.depth < 0.5));
    } else
      assert(
        !g.props.items.includes(prop!) || prop!.hp < prop!.maxHp || Number.isFinite(prop!.armedAt),
      );
  }
  for (const muzzle of [false, true]) {
    const { g, e } = fixture();
    const wall = Bodies.rectangle(muzzle ? 630 : 750, 400, 6, 160, { isStatic: true });
    g.terrain.push(wall);
    Composite.add(g.engine.world, wall);
    g.enemyShot(e, 0, 16, 26);
    for (let i = 0; i < 40; i++) g.updateShots(1 / 60);
    assert.equal(g.hp, 100);
    assert.equal(g.shots.length, 0);
  }
});

test('pause, hit stop, phase transitions and death cannot release queued Interceptor attacks', () => {
  const { g, e } = fixture();
  step(g);
  const timer = e.timer,
    rig = structuredClone(e.interceptor);
  g.setMode('paused');
  step(g, 120);
  near(e.timer, timer);
  assert.deepEqual(e.interceptor, rig);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  near(e.timer, timer);
  assert.deepEqual(e.interceptor, rig);
  g.hitStop = 0;
  e.hp = e.maxHp * 0.6;
  step(g);
  assert.equal(e.state, 'transition');
  assert.equal(e.interceptor!.volley, 0);
  const shots = g.shots.length;
  g.hitEnemy(e, 999999);
  step(g, 120);
  assert(g.shots.length <= shots);
  assert(!Composite.allBodies(g.engine.world).includes(e.body));
});

test('Interceptor rounds and its hull use portals without retaining an attack at the entrance', () => {
  const { g, e } = fixture();
  g.mods = ['fold'];
  g.gun = getGun(g.mods);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 1400, y: 740 }));
  Body.setPosition(e.body, { x: 600, y: 670 });
  g.enemyShot(e, Math.PI / 2, 45, 26);
  g.updateShots(1 / 60);
  const s = g.shots[0];
  assert(s && !s.friendly);
  near(s.pos.x, 1400);
  assert(s.vel.y < 0);
  assert.equal(s.damage, 26);
  g.shots = [];
  Body.setStatic(e.body, false);
  Body.setPosition(e.body, { x: 600, y: 700 });
  Body.setVelocity(e.body, { x: 0, y: 14 });
  e.state = 'windup';
  e.attack = 'heavy';
  e.timer = 0.1;
  e.interceptor!.origin = { x: 600, y: 700 };
  for (let i = 0; i < 3; i++) {
    g.portals.beforeStep();
    Engine.update(g.engine, 1000 / 60);
  }
  assert(e.body.position.x > 1300);
  assert(e.body.velocity.y < 0);
  assert.equal(e.state, 'airborne');
  assert(e.interceptor!.origin.x > 1300);
  step(g, 10);
  assert.equal(g.shots.length, 0);
});

test('displacement during aim lock cancels stale lanes and requires a fresh tell', () => {
  const { g, e } = fixture();
  e.attacks = 1;
  step(g);
  until(g, () => e.timer <= interceptorLock(e));
  Body.setPosition(e.body, { x: 650, y: 400 });
  step(g);
  assert.equal(e.state, 'idle');
  assert.equal(g.shots.length, 0);
  until(g, () => e.state === 'windup');
  near(e.timer, INTERCEPTOR_HEAVY_TELL);
  near(e.interceptor!.origin.x, 650);
});

test('the direct test preserves saves and unlocks, while a real victory leads into the escape and preserves old rooftop practice', () => {
  const entry = testEncounterFromUrl(new URL('https://example.com/?test=interceptor'))!;
  assert(entry && entry.kind === 'interceptor');
  const g = new Game(),
    writes: (Checkpoint | null)[] = [],
    victories: string[] = [];
  g.onCheckpoint = (s) => writes.push(s);
  g.onBossDefeated = (kind) => victories.push(kind);
  g.start('normal-before-interceptor');
  const saved = structuredClone(writes[0]);
  assert(g.startPractice(entry));
  assert.equal(g.mods.length, 19);
  assert.equal(g.hp, 100);
  g.die();
  assert(g.startPractice(entry));
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  step(g, 20);
  assert.equal(g.mode, 'won');
  assert.equal(g.escape, null);
  assert.deepEqual(victories, []);
  assert.deepEqual(writes, [saved]);
  const legacy = loadEncounters([{ kind: 'boss', seed: entry.seed }])[0];
  assert(g.startPractice(legacy));
  assert.equal(g.enemies[0].kind, 'boss');
  assert.deepEqual(g.level, getLevel(entry.seed, 15, undefined, 'boss'));
  assert.equal(g.mods.length, 15);
  const seed = entry.seed;
  g.start(seed, { version: 5, seed, stage: 19, hp: 100, mods: [], kills: 0, elapsed: 0 });
  g.enemies[0].spawn = 0;
  g.hitEnemy(g.enemies[0], 999999);
  step(g, 20);
  assert.deepEqual(victories, ['interceptor']);
  assert(loadEncounters([{ kind: 'interceptor', seed }]).length);
  g.startEscape();
  assert.equal(g.escape?.phase, 'route');
});

for (const mirror of [false, true]) {
  test(`Interceptor is beatable with a nineteen-upgrade gun and normal health, mirror=${mirror}`, () => {
    const g = new Game();
    assert(g.startPractice({ kind: 'interceptor', seed: seedFor(mirror) }));
    const e = g.enemies[0];
    for (let i = 0; i < 60 * 180 && g.mode === 'playing'; i++) step(g, 1, dodgePilot(g, e));
    assert.equal(
      g.mode,
      'won',
      `${g.hp} player HP, ${Math.round(e.hp)} boss HP at ${JSON.stringify(e.body.position)}, ${e.state}, ${e.attacks} attacks`,
    );
    assert(g.hp > 0 && g.shotCount > 20);
    assert.equal(g.mods.length, 19);
  });
  test(`Interceptor pressures overhead, corner and cover camping, mirror=${mirror}`, () => {
    const outcomes: string[] = [];
    for (const spot of [
      { x: 45, y: 722 },
      { x: 1955, y: 722 },
      { x: 400, y: 722 },
      { x: 740, y: 722 },
      { x: 740, y: 160 },
      { x: 1450, y: 160 },
    ]) {
      const g = new Game(),
        seed = seedFor(mirror);
      g.start(seed, {
        version: 5,
        seed,
        stage: 19,
        hp: 100,
        kills: 0,
        elapsed: 0,
        mods: [
          'magnum',
          'rapid',
          'kick',
          'airshot',
          'scatter',
          'ricochet',
          'pierce',
          'light',
          'leech',
          'deadeye',
          'execute',
          'split',
          'landing',
          'redline',
          'backblast',
        ],
      });
      const e = g.enemies[0],
        x = mirror ? 2000 - spot.x : spot.x;
      Body.setPosition(g.player, { x, y: spot.y });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      for (let i = 0; i < 60 * 90 && g.mode === 'playing' && e.hp > 0; i++) {
        const correction = x - g.player.position.x - g.player.velocity.x * 5;
        step(g, 1, {
          left: correction < -8,
          right: correction > 8,
          fire: true,
          aim: { ...e.body.position },
        });
      }
      if (g.mode !== 'dead' || e.hp <= 0)
        outcomes.push(
          `${JSON.stringify(spot)}: ${g.mode}, ${g.hp} HP, boss ${Math.round(e.hp)} at ${JSON.stringify(e.body.position)} ${e.state}, ${e.attacks} attacks, ${JSON.stringify(e.hunt)}`,
        );
    }
    assert.deepEqual(outcomes, []);
  });
}
