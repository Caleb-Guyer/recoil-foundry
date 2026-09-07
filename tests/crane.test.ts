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
import { musicScene } from '../src/music-score.ts';
import { CRANE_LOCK, CRANE_SWEEP_TELL, CRANE_SLAM_TELL } from '../src/crane-ai.ts';
import { FLAK_LOCK, FLAK_TELL } from '../src/enemies.ts';
import type { CraneRig } from '../src/crane-ai.ts';

const { Body, Composite, Query } = Matter;
const rigSnapshot = (rig: CraneRig) => ({
  head: { ...rig.head },
  prev: { ...rig.prev },
  from: { ...rig.from },
  to: { ...rig.to },
  hit: rig.hit,
  route: rig.route.map((point) => ({ ...point })),
  planAt: rig.planAt,
});
function step(g: Game, count = 1, override: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1100, y: 150 },
      ...override,
    });
}
function until(g: Game, predicate: () => boolean, limit = 300) {
  for (let i = 0; i < limit && !predicate(); i++) step(g);
  assert(predicate(), 'The Crane did not complete its warned action');
}
function seedFor(kind: 'loader' | 'crane', mirrored = false) {
  for (let i = 0; i < 100; i++) {
    const seed = `crane-${i}`,
      level = getLevel(seed, 2);
    if (level.spawns[0].kind === kind && level.mirrored === mirrored) return seed;
  }
  assert.fail(`No ${kind} room with mirror=${mirrored}`);
}
function room(kind: 'loader' | 'crane' = 'crane', mirrored = false) {
  const g = new Game(),
    seed = seedFor(kind, mirrored);
  g.start(seed, {
    version: 3,
    seed,
    stage: 2,
    hp: 100,
    mods: ['magnum', 'rapid'],
    kills: 7,
    elapsed: 20,
  });
  assert.equal(g.enemies[0].kind, kind);
  return { g, e: g.enemies[0] };
}
function fixture() {
  const { g } = room();
  for (const enemy of g.enemies) {
    Composite.remove(g.engine.world, enemy.body);
    if (enemy.crane) Composite.remove(g.engine.world, enemy.crane.body);
  }
  g.enemies = [];
  g.waves.clear();
  for (const prop of [...g.props.items]) g.props.remove(prop);
  for (const body of g.terrain.slice(4)) Composite.remove(g.engine.world, body);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  g.breaches.clear();
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.spawnEnemy('crane', 600, 150);
  const e = g.enemies[0];
  e.spawn = 0;
  e.timer = 0;
  return { g, e };
}
test('the docks choose Loader or Crane deterministically with both mirrored arenas represented', () => {
  const variants = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const seed = `crane-${i}`,
      original = getLevel(seed, 2);
    assert(['loader', 'crane'].includes(original.spawns[0].kind));
    assert.equal(original.boss, true);
    assert.equal(original.spawns.length, 1);
    variants.add(`${original.spawns[0].kind}:${original.mirrored}`);
    for (const stage of [8, 0, 4, 1, 7, 3, 6, 5]) getLevel(seed, stage);
    assert.deepEqual(getLevel(seed, 2), original);
    const changed = getLevel(seed, 2);
    changed.spawns[0].x = -1000;
    assert.deepEqual(getLevel(seed, 2), original);
  }
  assert.deepEqual([...variants].sort(), [
    'crane:false',
    'crane:true',
    'loader:false',
    'loader:true',
  ]);
  assert(isBoss('crane'));
});

test('the independent docks boss draw preserves regular rooms and the rooftop encounter', () => {
  const expected = {
    A: [
      'loading-bays:false',
      'overpass:false',
      'fortress:false',
      'pillars:true',
      'split-deck:false',
      'gantry:false',
      'twin-towers:false',
    ],
    E: [
      'staggered:false',
      'overpass:true',
      'chimney:false',
      'fortress:false',
      'split-deck:true',
      'broken-bridge:true',
      'last-crossing:false',
    ],
  };
  for (const [seed, rooms] of Object.entries(expected)) {
    assert.deepEqual(
      [0, 1, 3, 4, 9, 10, 11].map((stage) => {
        const level = getLevel(seed, stage);
        return `${level.id}:${level.mirrored}`;
      }),
      rooms,
    );
  }
});

test('Crane checkpoints and daily retries rebuild the same fresh rig without transient attack state', () => {
  const daily = Array.from(
    { length: 28 },
    (_, i) => dailyForDate(`2026-09-${String(i + 1).padStart(2, '0')}`)!.seed,
  ).find((seed) => getLevel(seed, 2).spawns[0].kind === 'crane');
  assert(daily);
  for (const seed of [seedFor('crane'), seedFor('crane', true), daily]) {
    const g = new Game(),
      save: Checkpoint = {
        version: 3,
        seed,
        stage: 2,
        hp: 73,
        mods: ['magnum', 'rapid'],
        kills: 7,
        elapsed: 21.5,
      };
    g.start(seed, loadCheckpoint(save)!);
    const first = g.enemies[0],
      entrance = rigSnapshot(first.crane!);
    assert(first.crane);
    assert.equal(g.waves.pending, false);
    assert.equal(g.waves.doors.length, 0);
    assert.equal(musicScene(g).boss, true);
    step(g, 95);
    let written: Checkpoint | null = null;
    g.onCheckpoint = (value) => {
      written = value;
    };
    g.save();
    assert(written && !('crane' in written));
    const restored = new Game();
    restored.start(seed, loadCheckpoint(written)!);
    assert.equal(restored.enemies[0].kind, 'crane');
    assert.equal(restored.enemies[0].state, 'idle');
    assert.deepEqual(rigSnapshot(restored.enemies[0].crane!), entrance);
    assert.notStrictEqual(restored.enemies[0].crane, first.crane);
    assert.equal(restored.hp, g.hp);
    assert.equal(restored.elapsed, g.elapsed);
    assert.deepEqual(restored.mods, g.mods);
  }
});

test('destroying the motor cancels its rig and opens exactly one ordinary docks reward', () => {
  for (const mirrored of [false, true]) {
    const { g, e } = room('crane', mirrored),
      sounds: string[] = [];
    let saves = 0;
    g.onSound = (sound) => sounds.push(sound);
    g.onCheckpoint = (save) => {
      if (save) saves++;
    };
    Body.setPosition(g.player, { x: 1910, y: 722 });
    step(g);
    assert.equal(g.mode, 'playing');
    assert(!g.clear);
    g.hitEnemy(e, 99999);
    const hp = g.hp,
      oldRig = rigSnapshot(e.crane!);
    until(g, () => g.mode === 'upgrade');
    assert.equal(g.hp, hp);
    assert(!Composite.allBodies(g.engine.world).includes(e.body));
    assert(!Composite.allBodies(g.engine.world).includes(e.crane!.body));
    assert.deepEqual(rigSnapshot(e.crane!), oldRig);
    g.updateEnemy(e, 1);
    assert.deepEqual(rigSnapshot(e.crane!), oldRig);
    assert.equal(g.kills, 8);
    assert.equal(g.waves.pending, false);
    assert.equal(g.waves.doors.length, 0);
    assert.equal(g.offers.length, 3);
    assert.equal(sounds.filter((sound) => sound === 'clear').length, 1);
    const mod = g.offers[0].id;
    g.chooseMod(mod);
    g.chooseMod(mod);
    assert.equal(g.stage, 3);
    assert.equal(g.mods.length, 3);
    assert.equal(saves, 1);
  }
});

test('both primary paths track early, lock, and preserve their complete visible warning', () => {
  for (const attack of ['sweep', 'slam'] as const) {
    const { g, e } = fixture();
    e.attacks = attack === 'slam' ? 1 : 0;
    Body.setStatic(g.player, true);
    until(g, () => e.state === 'windup');
    assert.equal(e.attack, attack);
    const tell = attack === 'sweep' ? CRANE_SWEEP_TELL : CRANE_SLAM_TELL,
      started = g.time,
      original = { ...e.crane!.to };
    assert.equal(e.timer, tell);
    Body.setPosition(g.player, { x: 1040, y: 722 });
    step(g, 8);
    assert.notDeepEqual(e.crane!.to, original);
    until(g, () => e.timer <= CRANE_LOCK);
    const locked = { from: { ...e.crane!.from }, to: { ...e.crane!.to } };
    Body.setPosition(g.player, { x: 1300, y: 500 });
    while (e.state === 'windup') {
      step(g);
      assert.deepEqual({ from: e.crane!.from, to: e.crane!.to }, locked);
      assert.equal(g.hp, 100, 'Positioning the resting head caused unwarned damage');
    }
    assert.equal(e.state, 'rush');
    assert(g.time - started >= tell - 1e-8);
    assert(g.time - started < tell + 2 / 60);
  }
});

test('a stationary player takes one head strike, while a jump or side step after lock dodges', () => {
  for (const attack of ['sweep', 'slam'] as const) {
    for (const dodge of [false, true]) {
      const { g, e } = fixture();
      e.attacks = attack === 'slam' ? 1 : 0;
      until(g, () => e.state === 'windup');
      until(g, () => e.timer <= CRANE_LOCK);
      let frames = 0;
      while (e.state !== 'recover' && frames < 180) {
        step(g, 1, {
          jump: dodge && attack === 'sweep' && frames === 0,
          right: dodge && attack === 'slam',
        });
        frames++;
      }
      assert.equal(e.state, 'recover');
      assert.equal(g.hp, dodge ? 100 : 76, `${attack} dodge=${dodge}`);
      assert.equal(e.crane!.hit, !dodge);
      assert(Math.abs(e.timer - (dodge ? 1.25 : 0.55)) < 1e-8);
      const hp = e.hp;
      g.hitEnemy(e, 20);
      assert.equal(hp - e.hp, dodge ? 28 : 7);
      step(g, dodge ? 50 : 20);
      assert.equal(g.hp, dodge ? 100 : 76, 'A resting head dealt repeated contact damage');
    }
  }
});

test('new cover intercepts the swept head and protects its player even when the impact breaks it', () => {
  const { g, e } = fixture();
  until(g, () => e.state === 'windup');
  until(g, () => e.timer <= CRANE_LOCK);
  const cover = g.props.spawn('cover', 850, 698);
  until(g, () => e.state === 'recover');
  assert.equal(g.hp, 100);
  assert.equal(e.crane!.hit, false);
  assert(!g.props.items.includes(cover));
  assert(e.crane!.head.x < 840);
  assert.equal(e.timer, 1.25);
  step(g, 45);
  assert.equal(g.hp, 100);
});

test('the warned endpoint strikes destructible cover without extending damage behind that endpoint', () => {
  const { g, e } = fixture(),
    cover = g.props.spawn('cover', 1200, 698);
  until(g, () => e.state === 'windup');
  assert(e.crane!.to.x < 1190);
  until(g, () => e.timer <= CRANE_LOCK);
  Body.setPosition(g.player, { x: 1260, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => e.state === 'recover');
  assert(!g.props.items.includes(cover));
  assert.equal(g.hp, 100);
  assert.equal(e.crane!.hit, false);
  assert(e.crane!.head.x < 1190);
});

test('the hammer blocks piercing bullets while the separate motor remains the damage target', () => {
  const { g, e } = fixture(),
    rig = e.crane!;
  const shot = (x: number, y: number, vx: number, vy: number) =>
    g.addShot({
      pos: { x, y },
      vel: { x: vx, y: vy },
      damage: 20,
      life: 2,
      friendly: true,
      radius: 2,
      bounces: 0,
      pierce: 3,
      fragment: false,
      split: false,
    });
  shot(rig.head.x, 450, 0, -400);
  g.updateShots(1 / 60);
  assert.equal(g.shots.length, 0);
  assert.equal(e.hp, e.maxHp);
  shot(400, e.body.position.y, 350, 0);
  g.updateShots(1 / 60);
  assert.equal(e.hp, e.maxHp - 7);
  assert.deepEqual(e.body.position, { x: 600, y: 150 });
  assert(e.body.isStatic && !rig.body.isSensor);
});

test('an overhead volley tracks then locks and never adds unwarned bolts across half health', () => {
  const { g, e } = fixture();
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 900, y: 100 });
  step(g);
  assert.equal(e.attack, 'flak');
  assert.equal(e.timer, FLAK_TELL);
  const started = g.time,
    original = { ...e.aim },
    shots: { angle: number; time: number; speed: number; damage: number }[] = [],
    fire = g.enemyShot.bind(g);
  g.enemyShot = (...args) => {
    shots.push({ angle: args[1], speed: args[2]!, damage: args[3]!, time: g.time });
    fire(...args);
  };
  Body.setPosition(g.player, { x: 1050, y: 180 });
  step(g, 8);
  assert.notDeepEqual(e.aim, original);
  until(g, () => e.timer <= FLAK_LOCK);
  const locked = { ...e.aim };
  g.hitEnemy(e, e.maxHp * 1.6);
  assert(e.hp > 0 && e.hp < e.maxHp / 2);
  Body.setPosition(g.player, { x: 300, y: 180 });
  while (e.state === 'windup') {
    step(g);
    assert.deepEqual(e.aim, locked);
  }
  assert.equal(shots.length, 3);
  assert(
    shots.every((s) => s.speed === 10 && s.damage === 18 && s.time - started >= FLAK_TELL - 1e-8),
  );
  assert(Math.abs(shots[1].angle - Math.atan2(locked.y, locked.x)) < 1e-8);
  until(g, () => e.state === 'windup');
  assert.equal(e.phase, 1);
  until(g, () => e.state !== 'windup');
  assert.equal(shots.length, 8);
});

test('pause, impact freeze, and player death stop the hammer without a later hidden strike', () => {
  const { g, e } = fixture();
  until(g, () => e.state === 'windup');
  const rig = rigSnapshot(e.crane!),
    timer = e.timer,
    time = g.time;
  g.setMode('paused');
  step(g, 180, { right: true, fire: true });
  assert.deepEqual(rigSnapshot(e.crane!), rig);
  assert.equal(e.timer, timer);
  assert.equal(g.time, time);
  g.setMode('playing');
  g.hitStop = 0.05;
  step(g, 3);
  assert.deepEqual(rigSnapshot(e.crane!), rig);
  assert.equal(e.timer, timer);
  g.hp = 20;
  until(g, () => g.mode === 'dead');
  const stopped = rigSnapshot(e.crane!),
    attacks = e.attacks;
  step(g, 300, { jump: true, right: true, fire: true });
  assert.deepEqual(rigSnapshot(e.crane!), stopped);
  assert.equal(e.attacks, attacks);
  assert.equal(g.hp, 0);
  g.start(g.seed);
  assert(!Composite.allBodies(g.engine.world).includes(e.crane!.body));
});

test('both Crane arenas threaten floor corners and platforms without moving the head through scenery', () => {
  const places = [
    { x: 45, y: 722 },
    { x: 1000, y: 722 },
    { x: 1955, y: 722 },
    { x: 850, y: 482 },
    { x: 440, y: 392 },
    { x: 1310, y: 642 },
  ];
  for (const mirrored of [false, true])
    for (const place of places) {
      const { g, e } = room('crane', mirrored),
        position = { x: mirrored ? 2000 - place.x : place.x, y: place.y };
      Body.setPosition(g.player, position);
      Body.setVelocity(g.player, { x: 0, y: 0 });
      let warnedAt = -1;
      for (let i = 0; i < 900 && g.hp === 100; i++) {
        step(g);
        if (e.state === 'windup' && warnedAt < 0) warnedAt = g.time;
        const head = e.crane!.head;
        for (const body of g.terrain) {
          assert(
            !(
              head.x + 24.9 > body.bounds.min.x &&
              head.x - 24.9 < body.bounds.max.x &&
              head.y + 22.9 > body.bounds.min.y &&
              head.y - 22.9 < body.bounds.max.y
            ),
            `The head passed through terrain at ${JSON.stringify(head)}`,
          );
        }
      }
      assert(
        g.hp < 100,
        `A harmless camp remained at ${JSON.stringify(position)}, mirror=${mirrored}`,
      );
      assert(warnedAt >= 0 && g.time - warnedAt >= FLAK_TELL - 1e-8);
      assert(g.hp >= 76);
    }
});

test('both docks bosses can be beaten in either mirror using two upgrades and normal movement', () => {
  for (const kind of ['loader', 'crane'] as const)
    for (const mirrored of [false, true]) {
      const { g, e } = room(kind, mirrored);
      Body.setPosition(g.player, { x: 1000, y: 722 });
      Body.setVelocity(g.player, { x: 0, y: 0 });
      let dodgeUntil = 0,
        dodgeDirection = 1;
      for (let i = 0; i < 3600 && g.mode === 'playing' && g.enemies.length; i++) {
        const p = g.player.position,
          dx = e.body.position.x - p.x;
        let move = dx > 320 ? 1 : dx < -320 ? -1 : 0,
          jump =
            g.grounded &&
            Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
        const evading = e.state === 'rush' || (e.state === 'windup' && e.timer <= CRANE_LOCK);
        if (e.state === 'windup' && e.timer <= CRANE_LOCK) {
          if (e.attack === 'sweep') jump ||= g.grounded;
          else {
            dodgeUntil = g.time + 0.65;
            dodgeDirection = p.x < 1000 ? 1 : -1;
          }
        }
        if (g.time < dodgeUntil) move = dodgeDirection;
        if (e.state === 'rush' && e.kind === 'loader') jump ||= g.grounded;
        // Releasing fire prevents downward recoil from cancelling the evasive jump.
        step(g, 1, {
          left: move < 0,
          right: move > 0,
          jump,
          fire: !evading,
          aim: { ...e.body.position },
        });
      }
      assert(e.hp <= 0, `${kind}, mirror=${mirrored}: ${e.hp} boss HP, ${g.hp} player HP`);
      assert(g.hp > 0 && g.mode === 'playing');
      assert(g.shotCount > 0);
      assert.equal(g.mods.length, 2);
      assert.equal(g.kills, 8);
      assert(!g.waves.pending);
    }
});

test('a falling crate contacting the resting hammer cannot permanently stall retraction', () => {
  const g = new Game(),
    seed = 'crane-layout-5';
  g.start(seed, { version: 3, seed, stage: 2, hp: 100, mods: [], kills: 0, elapsed: 0 });
  const e = g.enemies[0];
  assert.equal(e.kind, 'crane');
  for (const prop of [...g.props.items]) g.props.remove(prop);
  Body.setPosition(g.player, { x: 1000, y: 722 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  until(g, () => e.state === 'recover');
  const origin = { ...e.crane!.head },
    attacks = e.attacks;
  g.props.spawn('crate', origin.x, origin.y - 60);
  step(g, 180);
  assert(Math.hypot(e.crane!.head.x - origin.x, e.crane!.head.y - origin.y) > 80);
  assert(
    e.attacks > attacks,
    'The next warned attack never began after a prop covered the resting head',
  );
  assert.equal(g.mode, 'playing');
});
