import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { FLAK_LOCK, FLAK_TELL } from '../src/enemies.ts';
import { distance, getGun } from '../src/rules.ts';
import { getLevel } from '../src/levels.ts';

const { Body, Composite } = Matter;
const input = (override: Partial<Input> = {}): Input => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1000, y: 500 },
  ...override,
});
const step = (g: Game, count = 1, override: Partial<Input> = {}) => {
  for (let i = 0; i < count; i++) g.tick(1 / 60, input(override));
};

function fixture(kind: 'loader' | 'press' | 'boss') {
  const g = new Game();
  g.start('boss-pressure');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const enemy of g.enemies) Composite.remove(g.engine.world, enemy.body);
  g.enemies = [];
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  g.breaches.clear();
  Body.setPosition(g.player, { x: 1000, y: 722 });
  g.spawnEnemy(kind, 600, kind === 'loader' ? 706 : 260);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 100;
  step(g, 10);
  e.timer = 0;
  return { g, e };
}

function startOverheadTell(kind: 'loader' | 'press') {
  const { g, e } = fixture(kind);
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 600, y: 18 });
  step(g);
  assert.equal(e.state, 'windup');
  assert.equal(e.attack, 'flak');
  assert.equal(e.timer, FLAK_TELL);
  return { g, e };
}

function room(stage: 2 | 5 | 8, seed = 'boss-cheese-0') {
  const g = new Game();
  const mods =
    stage === 2
      ? ['rapid', 'kick']
      : stage === 5
        ? ['rapid', 'kick', 'light', 'ricochet', 'pierce']
        : ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'split'];
  g.start(seed, { version: 3, seed, stage, mods, hp: 100, kills: 0, elapsed: 0 });
  return { g, e: g.enemies[0] };
}

test('both overhead counters track early, lock their aim, and fire only after the complete warning', () => {
  for (const kind of ['loader', 'press'] as const) {
    const { g, e } = startOverheadTell(kind),
      started = g.time,
      firstAim = { ...e.aim };
    const fired: { angle: number; speed: number; damage: number; time: number }[] = [];
    const enemyShot = g.enemyShot.bind(g);
    g.enemyShot = (...args) => {
      const [, angle, speed, damage] = args;
      fired.push({ angle, speed: speed!, damage: damage!, time: g.time });
      enemyShot(...args);
    };
    Body.setPosition(g.player, { x: 740, y: 160 });
    step(g, 10);
    assert.notDeepEqual(e.aim, firstAim);
    while (e.timer > FLAK_LOCK) step(g);
    const locked = { ...e.aim },
      lockedAt = g.time;
    Body.setPosition(g.player, { x: 350, y: 160 });
    while (e.state === 'windup') {
      step(g);
      assert.deepEqual(e.aim, locked);
    }
    assert.equal(fired.length, 3);
    assert(fired.every((shot) => shot.time - started >= FLAK_TELL - 1e-8));
    assert(fired[0].time - lockedAt >= FLAK_LOCK - 1 / 60);
    assert(fired.every((shot) => shot.speed === 10 && shot.damage === 14));
    assert(Math.abs(fired[1].angle - Math.atan2(locked.y, locked.x)) < 1e-8);
    assert.notEqual(
      e.state,
      'recover',
      'An overhead counter exposed the primary crash/slam weak point',
    );
  }
});

test('an overhead player must react to the locked volley, and ordinary sideways movement can dodge it', () => {
  for (const stage of [2, 5] as const) {
    const results = [false, true].map((dodge) => {
      const { g, e } = room(stage),
        home = e.body.position.x;
      Body.setPosition(g.player, { x: home, y: stage === 2 ? 620 : 160 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      let firedAt = -1,
        sawTell = false,
        dodging = false;
      const enemyShot = g.enemyShot.bind(g);
      g.enemyShot = (...args) => {
        if (firedAt < 0) firedAt = g.time;
        enemyShot(...args);
      };
      for (let i = 0; i < 400 && g.mode === 'playing'; i++) {
        if (e.state === 'windup' && e.attack === 'flak') {
          sawTell = true;
          if (dodge && e.timer <= FLAK_LOCK) dodging = true;
        }
        const correction = home - g.player.position.x - g.player.velocity.x * 5;
        step(g, 1, {
          fire: true,
          aim: { ...e.body.position },
          left: !dodging && correction < -8,
          right: dodging || correction > 8,
        });
        if (firedAt >= 0 && g.time - firedAt > 0.9) break;
      }
      assert(sawTell && firedAt >= 0, `${e.kind} never countered its overhead blind spot`);
      return g.hp;
    });
    assert(results[0] < 100, `Stage ${stage} still allowed stationary overhead firing`);
    assert.equal(
      results[1],
      100,
      `Stage ${stage} did not leave enough room to dodge after aim lock`,
    );
  }
});

test('crossing half health during the aim lock never adds bolts that were absent from the warning', () => {
  for (const kind of ['loader', 'press'] as const) {
    const { g, e } = startOverheadTell(kind);
    let bolts = 0;
    const enemyShot = g.enemyShot.bind(g);
    g.enemyShot = (...args) => {
      bolts++;
      enemyShot(...args);
    };
    while (e.timer > FLAK_LOCK) step(g);
    g.hitEnemy(e, e.maxHp * 0.8);
    assert(e.hp > 0 && e.hp < e.maxHp / 2);
    while (e.state === 'windup') step(g);
    assert.equal(bolts, 3);
    for (let i = 0; i < 180 && e.state !== 'windup'; i++) step(g);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, 'flak');
    assert.equal(e.phase, 1);
    while (e.state === 'windup') step(g);
    assert.equal(bolts, 8, 'The next fully warned volley should use the five-bolt pattern');
  }
});

test('both rooftop arenas and their mirrors let the boss flank cover and threaten either floor corner', () => {
  const layouts = new Map<string, string>();
  for (let i = 0; i < 100 && layouts.size < 4; i++) {
    const seed = i === 0 ? 'boss-cheese-0' : `boss-flank-${i}`,
      level = getLevel(seed, 8);
    layouts.set(`${level.id}:${level.mirrored}`, seed);
  }
  assert.equal(layouts.size, 4);
  let coveredCases = 0;
  for (const [layout, seed] of layouts) {
    for (const spot of ['left-corner', 'right-corner', 'box-edge', 'under-shelf']) {
      const { g, e } = room(8, seed),
        boxes = g.level.solids.filter((s) => s.h >= 80).sort((a, b) => a.x - b.x),
        shelf = g.level.solids.filter((s) => s.h < 80).sort((a, b) => a.x - b.x)[0],
        home =
          spot === 'left-corner'
            ? 13
            : spot === 'right-corner'
              ? 1987
              : spot === 'box-edge'
                ? boxes[0].x - 35
                : shelf.x + 25,
        label = `${layout} ${seed} ${spot} x=${home}`;
      Body.setPosition(g.player, { x: home, y: 722 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      if (distance(g.lineEnd(e.body.position, g.player.position), g.player.position) > 1)
        coveredCases++;
      let visible = false,
        fired = 0;
      const enemyShot = g.enemyShot.bind(g);
      g.enemyShot = (...args) => {
        fired++;
        enemyShot(...args);
      };
      for (let i = 0; i < 1200 && g.hp === 100; i++) {
        const before = { ...e.body.position },
          correction = home - g.player.position.x - g.player.velocity.x * 5;
        step(g, 1, { left: correction < -8, right: correction > 8 });
        assert(distance(before, e.body.position) < 20, `${label}: boss teleported through cover`);
        visible ||=
          distance(g.lineEnd(e.body.position, g.player.position), g.player.position) < 0.1;
      }
      assert(visible, `${label}: no clear lane; boss at ${JSON.stringify(e.body.position)}`);
      assert(fired > 0, `${label}: no attack`);
      assert(g.hp < 100, `${label}: remained safe; boss at ${JSON.stringify(e.body.position)}`);
    }
  }
  assert(coveredCases >= 4, 'The geometry cases did not exercise obstructed firing lanes');
});

test('a strong shotgun build cannot pin the rooftop boss outside its attack range', () => {
  const { g, e } = fixture('boss');
  Body.setPosition(e.body, { x: 1200, y: 260 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  Body.setPosition(g.player, { x: 300, y: 722 });
  g.mods = ['magnum', 'rapid', 'kick', 'airshot', 'scatter', 'ricochet', 'pierce', 'split'];
  g.gun = getGun(g.mods);
  let hits = 0;
  const hitEnemy = g.hitEnemy.bind(g);
  g.hitEnemy = (enemy, damage, from) => {
    hits++;
    return hitEnemy(enemy, damage, from);
  };
  for (let i = 0; i < 360 && e.hp > 0 && g.mode === 'playing'; i++) {
    const correction = 300 - g.player.position.x - g.player.velocity.x * 5;
    step(g, 1, {
      fire: true,
      aim: { ...e.body.position },
      left: correction < -8,
      right: correction > 8,
    });
  }
  assert(hits >= 10);
  assert(e.body.position.x < 900, `The boss stayed pinned at x=${e.body.position.x}`);
});

test('phase transition armor prevents a burst from consuming the next phase and expires after its visible window', () => {
  const { g, e } = fixture('boss');
  e.hp = (e.maxHp * 2) / 3 - 1;
  step(g);
  assert.equal(e.phase, 1);
  assert.equal(e.state, 'transition');
  const hp = e.hp;
  for (let i = 0; i < 4; i++) {
    g.addShot({
      pos: { x: e.body.position.x - 70, y: e.body.position.y },
      vel: { x: 30, y: 0 },
      damage: 200,
      life: 1,
      friendly: true,
      radius: 2,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
    });
  }
  g.updateShots(1 / 60);
  assert(Math.abs(hp - e.hp - 800 * 0.35) < 1e-8);
  assert(e.hp > e.maxHp / 3);
  step(g, 40);
  assert.equal(e.state, 'transition');
  step(g, 6);
  assert.notEqual(e.state, 'transition');
  const after = e.hp;
  g.hitEnemy(e, 20);
  assert.equal(after - e.hp, 20);
});

test('overhead warnings freeze during pause and hit stop, and dead or unloaded attackers cannot release them', () => {
  for (const kind of ['loader', 'press'] as const) {
    const { g, e } = startOverheadTell(kind),
      saved = { timer: e.timer, aim: { ...e.aim }, pos: { ...e.body.position } };
    g.setMode('paused');
    step(g, 120);
    assert.deepEqual({ timer: e.timer, aim: e.aim, pos: e.body.position }, saved);
    g.setMode('playing');
    g.hitStop = 0.1;
    step(g, 4);
    assert.equal(e.timer, saved.timer);
    g.hitEnemy(e, 99999);
    step(g, 120);
    assert.equal(g.shots.filter((s) => !s.friendly).length, 0);
    assert(!g.enemies.includes(e));
    g.loadRoom();
    assert(g.enemies.every((enemy) => enemy.state === 'idle' && enemy.attack !== 'flak'));
  }
});
