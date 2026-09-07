import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { isBoss } from '../src/enemies.ts';
import { dailyForDate } from '../src/daily.ts';
import { loadCheckpoint } from '../src/rules.ts';
import type { Checkpoint } from '../src/rules.ts';
import {
  KILN_TELL,
  KILN_LOCK,
  KILN_HEAT_WARN,
  KILN_HEAT_LIFE,
  KILN_RADIUS,
  kilnPoint,
} from '../src/kiln-ai.ts';
import { FLAK_TELL, FLAK_LOCK } from '../src/enemies.ts';

const { Body, Bodies, Composite, Query } = Matter;
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1200, y: 500 },
      ...input,
    });
}
function until(g: Game, predicate: () => boolean, limit = 600) {
  for (let i = 0; i < limit && !predicate(); i++) step(g);
  assert(predicate(), 'The Kiln did not complete its warned action');
}
function seedFor(kind: 'kiln' | 'press', mirrored = false) {
  for (let i = 0; i < 100; i++) {
    const seed = `kiln-${i}`,
      level = getLevel(seed, 5);
    if (level.spawns[0].kind === kind && level.mirrored === mirrored) return seed;
  }
  assert.fail(`Missing ${kind} mirror=${mirrored}`);
}
function room(mirrored = false) {
  const g = new Game(),
    seed = seedFor('kiln', mirrored);
  g.start(seed, {
    version: 3,
    seed,
    stage: 5,
    hp: 100,
    mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter'],
    kills: 20,
    elapsed: 80,
  });
  assert.equal(g.enemies[0].kind, 'kiln');
  return { g, e: g.enemies[0] };
}
function fixture() {
  const { g, e } = room();
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  g.breaches.clear();
  const height = e.body.bounds.max.y - e.body.bounds.min.y;
  Body.setPosition(e.body, { x: 600, y: 740 - height / 2 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}

test('the furnace selects Press or Kiln deterministically and supports both mirrored arenas', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const seed = `kiln-${i}`,
      level = getLevel(seed, 5);
    assert(level.boss && level.spawns.length === 1);
    assert(['press', 'kiln'].includes(level.spawns[0].kind));
    variants.add(`${level.spawns[0].kind}:${level.mirrored}`);
    for (const stage of [8, 1, 7, 0, 2, 6, 3, 4]) getLevel(seed, stage);
    assert.deepEqual(getLevel(seed, 5), level);
    const edited = getLevel(seed, 5);
    edited.spawns[0].x = -1000;
    assert.deepEqual(getLevel(seed, 5), level);
  }
  assert.deepEqual([...variants].sort(), ['kiln:false', 'kiln:true', 'press:false', 'press:true']);
  assert(isBoss('kiln'));
});

test('the independent furnace boss draw preserves established rooms everywhere outside stage five', () => {
  const expected = {
    A: [
      'loading-bays:false',
      'overpass:false',
      'loader-bay:false',
      'fortress:false',
      'pillars:true',
      'split-deck:false',
      'gantry:false',
      'twin-towers:false',
    ],
    E: [
      'staggered:false',
      'overpass:true',
      'crane-bay:true',
      'chimney:false',
      'fortress:false',
      'split-deck:true',
      'broken-bridge:true',
      'last-crossing:false',
    ],
  };
  for (const [seed, rooms] of Object.entries(expected))
    assert.deepEqual(
      [0, 1, 2, 3, 4, 6, 7, 8].map((stage) => {
        const level = getLevel(seed, stage);
        return `${level.id}:${level.mirrored}`;
      }),
      rooms,
    );
});

test('ordinary and daily checkpoints rebuild the selected Kiln without retaining any attack state', () => {
  const daily = Array.from(
    { length: 28 },
    (_, i) => dailyForDate(`2026-09-${String(i + 1).padStart(2, '0')}`)!.seed,
  ).find((seed) => getLevel(seed, 5).spawns[0].kind === 'kiln');
  assert(daily);
  for (const seed of [seedFor('kiln'), seedFor('kiln', true), daily]) {
    const g = new Game(),
      save: Checkpoint = {
        version: 3,
        seed,
        stage: 5,
        hp: 83,
        mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter'],
        kills: 20,
        elapsed: 91.5,
      };
    g.start(seed, loadCheckpoint(save)!);
    const first = g.enemies[0],
      rig = first.kiln!;
    assert.equal(first.kind, 'kiln');
    assert.deepEqual(rig, { plans: [], shells: [], patches: [], next: 0 });
    assert(!g.waves.pending && g.waves.doors.length === 0);
    step(g, 150);
    let written: Checkpoint | null = null;
    g.onCheckpoint = (value) => {
      written = value;
    };
    g.save();
    assert(written);
    assert(!('kiln' in written));
    const restored = new Game();
    restored.start(seed, loadCheckpoint(written)!);
    assert.equal(restored.enemies[0].kind, 'kiln');
    assert.equal(restored.enemies[0].state, 'idle');
    assert.deepEqual(restored.enemies[0].kiln, { plans: [], shells: [], patches: [], next: 0 });
    assert.notStrictEqual(restored.enemies[0].kiln, rig);
    assert.deepEqual(restored.level, g.level);
    assert.deepEqual(restored.mods, g.mods);
    assert.equal(restored.hp, g.hp);
    assert.equal(restored.elapsed, g.elapsed);
  }
});

test('mortar paths track early, lock for half a second, and release only the fully warned volley', () => {
  const { g, e } = fixture();
  Body.setStatic(g.player, true);
  until(g, () => e.state === 'windup');
  assert.equal(e.attack, 'mortar');
  assert.equal(e.timer, KILN_TELL);
  const begun = g.time,
    initial = structuredClone(e.kiln!.plans);
  assert.equal(initial.length, 3);
  Body.setPosition(g.player, { x: 1100, y: 722 });
  step(g, 8);
  assert.notDeepEqual(e.kiln!.plans, initial);
  until(g, () => e.timer <= KILN_LOCK);
  const locked = structuredClone(e.kiln!.plans),
    lockTime = g.time;
  Body.setPosition(g.player, { x: 1500, y: 722 });
  g.hitEnemy(e, e.maxHp * 1.4);
  assert(e.hp > 0 && e.hp < e.maxHp / 2);
  while (e.state === 'windup') {
    step(g);
    assert.deepEqual(e.kiln!.plans, locked);
    assert.equal(e.kiln!.shells.length, 0);
  }
  assert(g.time - begun >= KILN_TELL - 1e-8);
  assert(g.time - lockTime >= KILN_LOCK - 1 / 60);
  const launches: number[] = [];
  g.onSound = (sound) => {
    if (sound === 'kiln-fire') launches.push(g.time);
  };
  until(g, () => e.state === 'recover');
  assert.equal(launches.length, 3, 'Crossing half health added an unmarked fourth shell');
  assert(launches[1] - launches[0] >= 0.18 - 1e-8);
  assert(launches[2] - launches[1] >= 0.18 - 1e-8);
  assert.deepEqual(
    e.kiln!.shells.map((shell) => shell.arc),
    locked,
  );
  assert.equal(e.timer, 1.5);
  until(g, () => e.state === 'windup');
  assert.equal(
    e.kiln!.plans.length,
    4,
    'The next complete warning did not announce its enraged volley',
  );
});

test('a live shell follows its curved preview and a newly raised thin wall intercepts it', () => {
  const { g, e } = fixture();
  until(g, () => e.kiln!.shells.length > 0);
  const shell = e.kiln!.shells[0],
    arc = structuredClone(shell.arc),
    midpoint = kilnPoint(arc, 0.5);
  e.state = 'recover';
  e.timer = 100;
  e.kiln!.plans = [];
  e.kiln!.shells = [shell];
  Body.setPosition(g.player, { x: 1500, y: 722 });
  const cover = Bodies.rectangle(midpoint.x, midpoint.y, 4, 70, { isStatic: true });
  g.terrain.push(cover);
  Composite.add(g.engine.world, cover);
  assert(midpoint.y < (arc.from.y + arc.to.y) / 2 - 200);
  let impacts = 0;
  g.onSound = (sound) => {
    if (sound === 'kiln-impact') impacts++;
  };
  for (let i = 0; i < 180 && e.kiln!.shells.length; i++) {
    step(g);
    if (e.kiln!.shells.includes(shell)) {
      const expected = kilnPoint(arc, shell.t);
      assert(Math.hypot(shell.pos.x - expected.x, shell.pos.y - expected.y) < 1e-8);
    }
  }
  assert.equal(e.kiln!.shells.length, 0);
  assert.equal(impacts, 1);
  assert(Math.abs(shell.pos.x - (cover.bounds.min.x - KILN_RADIUS)) < 0.1);
  assert.equal(e.kiln!.patches.length, 0, 'A vertical wall grew a floating floor hazard');
  assert.equal(g.hp, 100);
});

test('a shell consumes its hit once, and a destructible prop blocks the player on its breaking impact', () => {
  for (const covered of [false, true]) {
    const { g, e } = fixture();
    until(g, () => e.kiln!.shells.length > 0);
    const shell = e.kiln!.shells[0];
    e.state = 'recover';
    e.timer = 100;
    e.kiln!.plans = [];
    e.kiln!.shells = [shell];
    const point = kilnPoint(shell.arc, 0.65);
    Body.setStatic(g.player, true);
    Body.setPosition(g.player, point);
    const prop = covered ? g.props.spawn('cover', point.x - 34, point.y - 3) : undefined;
    if (prop) Body.setStatic(prop.body, true);
    until(g, () => !e.kiln!.shells.length);
    assert.equal(g.hp, covered ? 100 : 74);
    if (prop) assert(!g.props.items.includes(prop));
    assert.equal(e.kiln!.patches.length, 0);
    step(g, 90);
    assert.equal(g.hp, covered ? 100 : 74);
  }
});

function landedHeat() {
  const { g, e } = fixture();
  until(g, () => e.kiln!.shells.length > 0);
  const shell = e.kiln!.shells[0];
  e.state = 'recover';
  e.timer = 100;
  e.kiln!.plans = [];
  e.kiln!.shells = [shell];
  Body.setPosition(g.player, { x: 1500, y: 722 });
  until(g, () => e.kiln!.patches.length > 0);
  return { g, e, patch: e.kiln!.patches[0] };
}

test('landed heat announces itself before becoming harmful and expires after a bounded active lifetime', () => {
  const { g, e, patch } = landedHeat(),
    created = g.time;
  assert.equal(patch.warn, KILN_HEAT_WARN);
  assert.equal(patch.life, KILN_HEAT_LIFE);
  assert.equal(patch.y, 740);
  assert(patch.w > 16 && patch.w <= 112);
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: patch.x, y: patch.y - 18 });
  while (patch.warn > 0) {
    step(g);
    assert.equal(g.hp, 100);
  }
  assert(g.time - created >= KILN_HEAT_WARN - 1e-8);
  step(g);
  assert.equal(g.hp, 82);
  const active = g.time;
  until(g, () => !e.kiln!.patches.includes(patch));
  assert(g.time - active >= KILN_HEAT_LIFE - 2 / 60);
  assert(g.time - active <= KILN_HEAT_LIFE + 2 / 60);
  const hp = g.hp;
  step(g, 90);
  assert.equal(g.hp, hp);
});

test('solid footing shields a player just above heat and removed support discards the patch', () => {
  const { g, e, patch } = landedHeat();
  const footing = Bodies.rectangle(patch.x, patch.y - 4.5, 120, 9, { isStatic: true });
  g.terrain.push(footing);
  Composite.add(g.engine.world, footing);
  Body.setPosition(g.player, { x: patch.x, y: patch.y - 27 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  step(g, 60);
  assert.equal(g.hp, 100);
  assert(e.kiln!.patches.includes(patch));
  assert(g.grounded);
  g.terrain = g.terrain.filter((body) => body !== patch.support);
  Composite.remove(g.engine.world, patch.support);
  step(g);
  assert(!e.kiln!.patches.includes(patch));
});

test('cooling exposes a real damage window while overhead counters preserve armor and their aim lock', () => {
  const { g, e } = fixture();
  const hp = e.hp;
  g.hitEnemy(e, 20);
  assert.equal(hp - e.hp, 8);
  until(g, () => e.state === 'recover');
  const cooling = e.hp;
  g.hitEnemy(e, 20);
  assert.equal(cooling - e.hp, 27);
  e.kiln!.shells = [];
  e.kiln!.patches = [];
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: e.body.position.x + 160, y: 100 });
  until(g, () => e.state === 'windup');
  assert.equal(e.attack, 'flak');
  assert.equal(e.timer, FLAK_TELL);
  while (e.timer > FLAK_LOCK) step(g);
  const locked = { ...e.aim },
    fired: number[] = [],
    fire = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    fired.push(args[1]);
    fire(...args);
  };
  Body.setPosition(g.player, { x: 1400, y: 100 });
  while (e.state === 'windup') {
    step(g);
    assert.deepEqual(e.aim, locked);
  }
  assert.equal(fired.length, 3);
  assert(Math.abs(fired[1] - Math.atan2(locked.y, locked.x)) < 1e-8);
  assert.notEqual(e.state, 'recover');
  const closed = e.hp;
  g.hitEnemy(e, 20);
  assert.equal(closed - e.hp, 8);
});

test('pause and death freeze all Kiln hazards, while killing the boiler cancels them and grants one reward', () => {
  const { g, e, patch } = landedHeat();
  const snapshot = () => ({
    shells: structuredClone(e.kiln!.shells),
    patches: e.kiln!.patches.map(({ support, ...rest }) => ({ ...rest })),
    timer: e.timer,
  });
  const saved = snapshot();
  g.setMode('paused');
  step(g, 90);
  assert.deepEqual(snapshot(), saved);
  g.setMode('playing');
  g.hitStop = 0.05;
  step(g, 3);
  assert.deepEqual(snapshot(), saved);
  g.time += 1;
  g.damagePlayer(999);
  step(g, 90);
  assert.deepEqual(snapshot(), saved);
  assert.equal(g.mode, 'dead');
  g.start(g.seed);
  assert.deepEqual(e.kiln, { plans: [], shells: [], patches: [], next: 0 });
  assert(!g.enemies.some((enemy) => enemy.kiln?.patches.includes(patch)));
  const fresh = room(),
    boiler = fresh.e;
  until(fresh.g, () => boiler.kiln!.shells.length > 0);
  fresh.g.hitEnemy(boiler, 99999);
  assert.deepEqual(boiler.kiln, { plans: [], shells: [], patches: [], next: 0 });
  assert(!Composite.allBodies(fresh.g.engine.world).includes(boiler.body));
  Body.setPosition(fresh.g.player, { x: 1910, y: 722 });
  until(fresh.g, () => fresh.g.mode === 'upgrade');
  assert.equal(fresh.g.kills, 21);
  assert(!fresh.g.waves.pending);
  const mod = fresh.g.offers[0].id;
  fresh.g.chooseMod(mod);
  fresh.g.chooseMod(mod);
  assert.equal(fresh.g.stage, 6);
  assert.equal(fresh.g.mods.length, 6);
});

test('both Kiln layouts punish passive corner firing while a reactive five-upgrade run can win', () => {
  for (const seed of ['kiln-layout-1', 'kiln-layout-2']) {
    for (const reactive of [false, true]) {
      const g = new Game();
      g.start(seed, {
        version: 3,
        seed,
        stage: 5,
        hp: 100,
        mods: ['magnum', 'rapid', 'kick', 'airshot', 'scatter'],
        kills: 20,
        elapsed: 80,
      });
      const e = g.enemies[0];
      assert.equal(e.kind, 'kiln');
      if (!reactive) {
        Body.setPosition(g.player, { x: 13, y: 722 });
        Body.setVelocity(g.player, { x: 0, y: 0 });
      }
      let move = 1,
        lastJump = -10,
        fireAfter = 0,
        lastWarning = '',
        warnings = 0;
      for (let i = 0; i < 7200 && g.mode === 'playing' && e.hp > 0; i++) {
        const p = g.player.position,
          target = e.body.position,
          dx = target.x - p.x;
        let jump = false,
          fire = true;
        if (reactive) {
          if (p.x < 160) move = 1;
          if (p.x > 1840) move = -1;
          if (Math.abs(dx) > 500) move = Math.sign(dx);
          if (Math.abs(dx) < 150 && Math.abs(target.y - p.y) < 125) move = -Math.sign(dx) || move;
          const locked =
            e.state === 'windup' && e.timer <= (e.attack === 'flak' ? FLAK_LOCK : KILN_LOCK);
          if (locked && lastWarning !== `${e.attacks}:${e.attack}`) {
            lastWarning = `${e.attacks}:${e.attack}`;
            warnings++;
            fireAfter = g.time + 0.5;
          }
          const blocked =
              Query.ray(g.solidBodies, p, { x: p.x + move * 70, y: p.y }, 22).length > 0,
            hot = e.kiln!.patches.some(
              (patch) =>
                Math.abs(p.x - patch.x) < patch.w / 2 + 60 &&
                p.y + 18 > patch.y - 60 &&
                patch.warn < 0.25,
            );
          jump =
            g.grounded &&
            g.burstRemaining === 0 &&
            g.time - lastJump > 0.3 &&
            (blocked || hot || (locked && e.attack === 'flak'));
          if (jump) {
            lastJump = g.time;
            fireAfter = Math.max(fireAfter, g.time + 0.35);
          }
          const end = g.lineEnd(p, target);
          fire = g.time >= fireAfter && Math.hypot(end.x - target.x, end.y - target.y) < 1e-8;
        } else {
          const correction = 13 - p.x - g.player.velocity.x * 5;
          move = correction < -8 ? -1 : correction > 8 ? 1 : 0;
        }
        step(g, 1, { left: move < 0, right: move > 0, jump, fire, aim: { ...target } });
        assert(e.kiln!.shells.length <= 8 && e.kiln!.patches.length <= 8);
      }
      if (reactive) {
        assert(
          e.hp <= 0 && g.hp > 0,
          `${seed}: reactive run ended with player ${g.hp}, boiler ${e.hp}`,
        );
        assert(warnings >= 2);
        assert.equal(g.kills, 21);
      } else {
        assert.equal(g.mode, 'dead', `${seed}: passive corner survived with ${g.hp} HP`);
        assert(e.hp > 0);
      }
      assert.equal(g.mods.length, 5);
      assert(g.shotCount > 5);
    }
  }
});

test('losing its footing during the locked warning cancels the stale mortar launch', () => {
  const { g, e } = fixture();
  until(g, () => e.state === 'windup');
  until(g, () => e.timer <= KILN_LOCK);
  Body.setPosition(e.body, { x: e.body.position.x, y: e.body.position.y - 120 });
  Body.setVelocity(e.body, { x: 0, y: -5 });
  let launches = 0;
  g.onSound = (sound) => {
    if (sound === 'kiln-fire') launches++;
  };
  until(g, () => e.state !== 'windup');
  assert.equal(launches, 0);
  assert.equal(e.kiln!.shells.length, 0);
  assert.equal(e.kiln!.plans.length, 0);
  assert.equal(e.state, 'idle');
});

test('displacement after the first shell cancels the rest of that volley and starts a fresh warning', () => {
  const { g, e } = fixture();
  let launches = 0;
  g.onSound = (sound) => {
    if (sound === 'kiln-fire') launches++;
  };
  until(g, () => e.kiln!.shells.length > 0);
  assert.equal(launches, 1);
  const first = e.kiln!.shells[0];
  Body.setPosition(e.body, { x: e.body.position.x, y: e.body.position.y - 120 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  until(g, () => e.state === 'idle');
  assert.equal(launches, 1, 'A later shell launched from the previous remote muzzle');
  assert.equal(e.kiln!.plans.length, 0);
  assert.deepEqual(e.kiln!.shells, [first]);
  until(g, () => e.state === 'windup');
  assert.equal(e.attack, 'mortar');
  assert.equal(e.timer, KILN_TELL);
  const warned = g.time;
  until(g, () => launches > 1);
  assert(g.time - warned >= KILN_TELL - 1e-8);
});
