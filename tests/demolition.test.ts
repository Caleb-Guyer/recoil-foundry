import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import type { Input } from '../src/game.ts';
import { EXTRACTION } from '../src/escape-layout.ts';
import {
  MODS,
  availableMods,
  getGun,
  validBuild,
  modPathLabel,
  loadCheckpoint,
  rewardMods,
  seeded,
} from '../src/rules.ts';
import {
  SHELL_DIRECT,
  SHELL_BLAST,
  SHELL_RADIUS,
  AFTERSHOCK_DELAY,
  CHAIN_DELAY,
  DEMOLITION_EFFECT_LIMIT,
  DEMOLITION_PENDING_LIMIT,
} from '../src/demolition.ts';
const { Body, Bodies, Composite } = Matter;
const near = (a: number, b: number, tolerance = 1e-6) =>
  assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const ids = ['shellshock', 'blast-surf', 'aftershock', 'chain-reaction'];
function fixture(mods = ['shellshock']) {
  const g = new Game();
  g.start('demolition-test');
  g.hazards.clear();
  g.breaches.clear();
  g.waves.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const e of g.enemies) {
    Composite.remove(g.engine.world, e.body);
    if (e.crane) Composite.remove(g.engine.world, e.crane.body);
  }
  g.enemies = [];
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.mods = mods;
  g.gun = getGun(mods);
  Body.setPosition(g.player, { x: 600, y: 300 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = false;
  g.engine.gravity.y = 0;
  return g;
}
function target(g: Game, x = 800, y = 300, elite?: 'shielded') {
  g.spawnEnemy(elite ? 'runner' : 'shooter', x, y, elite);
  const e = g.enemies.at(-1)!;
  e.spawn = 0;
  e.timer = 100;
  Body.setStatic(e.body, true);
  return e;
}
function wall(g: Game, x = 800, y = 300, w = 10, h = 180) {
  const b = Bodies.rectangle(x, y, w, h, { isStatic: true });
  Composite.add(g.engine.world, b);
  g.terrain.push(b);
  return b;
}
function shot(g: Game, extra = {}) {
  g.addShot({
    pos: { x: 750, y: 300 },
    vel: { x: 40, y: 0 },
    damage: 24,
    life: 2,
    radius: 3,
    friendly: true,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
    ...extra,
  });
  return g.shots.at(-1)!;
}
function step(g: Game, count = 1, input: Partial<Input> = {}) {
  for (let i = 0; i < count; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 800, y: 300 },
      ...input,
    });
}
function blast(g: Game, pos = { x: 600, y: 340 }, damage = 24 * SHELL_BLAST) {
  g.demolition.detonate({
    pos,
    damage,
    radius: SHELL_RADIUS,
    launch: g.demolition.payload(24)?.launch ?? 0,
    kind: 'shell',
  });
}

test('Demolition commits through Shellshock, unlocks three follow-ups, and excludes both other paths', () => {
  const initial = availableMods([]).map((m) => m.id);
  assert(initial.includes('shellshock'));
  for (const id of ids.slice(1)) assert(!initial.includes(id));
  for (const root of ['crossfire', 'deadeye', 'shellshock']) {
    const pool = availableMods([root]).map((m) => m.id);
    assert(pool.includes('fold') && pool.includes('scatter'));
    for (const id of ids)
      assert.equal(pool.includes(id), root === 'shellshock' && id !== 'shellshock');
  }
  for (const id of ids) assert.equal(modPathLabel(id), 'Demolition');
  assert(!validBuild(['shellshock', 'deadeye']));
  assert(!validBuild(['crossfire', 'shellshock']));
  assert(!validBuild(['aftershock']));
  assert(validBuild(['shellshock', 'chain-reaction', 'aftershock', 'blast-surf']));
});
test('Demolition saves and resumes legally, and follow-ups receive the chosen-path chance boost', () => {
  const g = fixture(ids);
  let save: unknown;
  g.onCheckpoint = (s) => {
    save = s;
  };
  g.save();
  const restored = loadCheckpoint(save)!;
  assert(restored);
  g.start(restored.seed, restored);
  assert.deepEqual(g.gun, getGun(ids));
  assert.equal(g.demolition.pending.length, 0);
  assert.equal(loadCheckpoint({ ...restored, mods: ['shellshock', 'bloom'] }), null);
  const rng = seeded('demolition-odds');
  let follow = 0,
    shared = 0;
  for (let i = 0; i < 20000; i++) {
    const offers = rewardMods(['shellshock'], 3, rng);
    assert.equal(new Set(offers).size, 3);
    if (offers.some((m) => m.id === 'aftershock')) follow++;
    if (offers.some((m) => m.id === 'fold')) shared++;
  }
  assert(follow > shared * 1.25 && follow < shared * 1.65);
});
test('Shellshock splits damage between a lighter hit and one terminal blast, with falloff on nearby enemies', () => {
  const g = fixture(),
    direct = target(g),
    nearby = target(g, 800, 360);
  const s = shot(g);
  near(s.damage, 24 * SHELL_DIRECT);
  near(s.shell!.damage, 24 * SHELL_BLAST);
  near(g.gun.interval, getGun([]).interval * 1.35);
  g.updateShots(1 / 60);
  near(
    direct.maxHp - direct.hp,
    24 * SHELL_DIRECT + 24 * SHELL_BLAST * (1 - (0.65 * 3) / SHELL_RADIUS),
    0.02,
  );
  assert(nearby.hp < nearby.maxHp && nearby.maxHp - nearby.hp < 24 * SHELL_BLAST);
  assert.equal(g.demolition.effects.length, 1);
  assert.equal(g.shots.length, 0);
  g.demolition.impact(s);
  assert.equal(g.demolition.effects.length, 1);
});
test('ricochets retain their explosive payload until the final impact and Banker scales both portions', () => {
  const g = fixture(['shellshock', 'banker']);
  wall(g);
  wall(g, 600);
  const s = shot(g, {
    pos: { x: 760, y: 300 },
    vel: { x: 50, y: 0 },
    bounces: 1,
    bankGrowth: 0.35,
  });
  g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 0);
  near(s.damage, 24 * SHELL_DIRECT * 1.35);
  near(s.shell!.damage, 24 * SHELL_BLAST * 1.35);
  assert.equal(s.bounces, 0);
  assert.equal(s.banks, 1);
  for (let i = 0; i < 5; i++) g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 1);
  near(g.demolition.effects[0].damage, 24 * SHELL_BLAST * 1.35);
});
test('piercing attenuates the payload and only the final pierced enemy triggers an explosion', () => {
  const g = fixture();
  target(g, 700);
  target(g, 840);
  target(g, 980);
  const s = shot(g, { pos: { x: 650, y: 300 }, pierce: 2 });
  g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 0);
  near(s.shell!.damage, 24 * SHELL_BLAST * 0.8);
  for (let i = 0; i < 8; i++) g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 1);
  near(g.demolition.effects[0].damage, 24 * SHELL_BLAST * 0.8 ** 2);
});
test('front shields and each boss armor state still reduce explosive damage and boss knockback', () => {
  const g = fixture(),
    shield = target(g, 800, 300, 'shielded');
  shield.facing = -1;
  shot(g);
  g.updateShots(1 / 30);
  assert(shield.maxHp - shield.hp < 4);
  assert.equal(g.demolition.effects.length, 1);
  for (const [kind, factor] of [
    ['loader', 0.4],
    ['crane', 0.35],
    ['press', 0.4],
    ['kiln', 0.4],
    ['boss', 0.45],
  ] as const) {
    const game = fixture();
    game.spawnEnemy(kind, 900, 400);
    const e = game.enemies.at(-1)!;
    e.spawn = 0;
    e.state = 'windup';
    Body.setVelocity(e.body, { x: 0, y: 0 });
    const x = Math.min(...e.body.vertices.map((v) => v.x)) - 3;
    blast(game, { x, y: e.body.position.y }, 40);
    near(e.maxHp - e.hp, 40 * (1 - (0.65 * 3) / SHELL_RADIUS) * factor, 0.02);
    assert(Math.hypot(e.body.velocity.x, e.body.velocity.y) < 0.6);
  }
});
test('Blast surfing launches away from your blast without damage, and divides impulse across scatter and rear volleys', () => {
  const speeds: number[] = [];
  for (const extra of [[], ['scatter'], ['scatter', 'backblast']]) {
    const g = fixture(['shellshock', 'blast-surf', ...extra]);
    const count = g.gun.pellets * (g.gun.backblast ? 2 : 1);
    for (let i = 0; i < count; i++) blast(g);
    assert.equal(g.hp, 100);
    assert.equal(g.hurtAt, -100);
    assert(g.player.velocity.y < -8);
    speeds.push(g.player.velocity.y);
  }
  near(speeds[0], speeds[1]);
  near(speeds[0], speeds[2]);
  const plain = fixture();
  blast(plain);
  near(plain.player.velocity.y, 0);
  assert.equal(plain.hp, 100);
});
test('air damage, landing charge, scatter, burst, and Backblast apply to both parts of each shell', () => {
  const g = fixture([
    'shellshock',
    'blast-surf',
    'scatter',
    'burst',
    'backblast',
    'airshot',
    'landing',
    'magnum',
  ]);
  g.aim = { x: 1200, y: 300 };
  g.landingReady = true;
  g.fire();
  assert.equal(g.shots.length, 10);
  const full = g.gun.damage * g.gun.airDamage * 2;
  for (const s of g.shots) {
    near(s.damage, full * SHELL_DIRECT);
    near(s.shell!.damage, full * SHELL_BLAST);
    near(s.shell!.launch, 1);
  }
  assert.equal(g.landingReady, false);
  assert(g.player.velocity.x < 0);
  g.burstRemaining--;
  g.fireRound();
  for (const s of g.shots.slice(10)) near(s.shell!.damage, (full / 2) * SHELL_BLAST);
});
test('Aftershock gives one timed repeat, freezes during pause and hit stop, and cannot repeat itself', () => {
  const g = fixture(['shellshock', 'aftershock']);
  blast(g);
  assert.equal(g.demolition.pending.length, 1);
  near(g.demolition.pending[0].damage, 24 * SHELL_BLAST * 0.4);
  near(g.demolition.pending[0].at, AFTERSHOCK_DELAY);
  g.setMode('paused');
  step(g, 60);
  near(g.time, 0);
  assert.equal(g.demolition.pending.length, 1);
  g.setMode('playing');
  g.hitStop = 0.1;
  step(g, 5);
  near(g.time, 0);
  g.hitStop = 0;
  step(g, 22);
  assert.equal(g.demolition.pending.length, 1);
  step(g, 2);
  assert.equal(g.demolition.pending.length, 0);
  assert(g.demolition.effects.some((e) => e.kind === 'echo'));
  step(g, 90);
  assert.equal(g.demolition.effects.length, 0);
  assert.equal(g.demolition.pending.length, 0);
});
test('an enemy can leave the warning ring before the aftershock instead of taking unavoidable delayed damage', () => {
  const g = fixture(['shellshock', 'aftershock']),
    e = target(g, 800);
  blast(g, { x: 770, y: 300 });
  const hp = e.hp;
  Body.setPosition(e.body, { x: 1200, y: 300 });
  g.time = AFTERSHOCK_DELAY;
  g.demolition.update();
  assert.equal(e.hp, hp);
  assert.equal(g.demolition.pending.length, 0);
});
test('Chain reaction consumes each destroyed prop once and cascades on separate ticks without recursion', () => {
  const g = fixture(['shellshock', 'chain-reaction', 'aftershock']);
  const props = [800, 870, 940].map((x) => g.props.spawn('crate', x, 300));
  for (const p of props) p.hp = 5;
  g.props.hit(props[0], 6, { x: 1, y: 0 });
  g.props.break(props[0]);
  assert.equal(g.demolition.pending.length, 1);
  assert.equal(g.props.items.length, 2);
  g.time = CHAIN_DELAY;
  g.demolition.update();
  assert.equal(g.props.items.length, 1);
  g.time += CHAIN_DELAY;
  g.demolition.update();
  assert.equal(g.props.items.length, 0);
  g.time += CHAIN_DELAY;
  g.demolition.update();
  assert.equal(g.demolition.pending.filter((e) => e.kind === 'chain').length, 0);
  assert.equal(g.demolition.pending.filter((e) => e.kind === 'echo').length, 3);
  g.time += 1;
  g.demolition.update();
  assert.equal(g.demolition.pending.length, 0);
});
test('a blast respects cover before destroying it, while its later chain can reach the newly exposed enemy', () => {
  const g = fixture(['shellshock', 'chain-reaction']),
    e = target(g, 690);
  const cover = g.props.spawn('cover', 640, 300);
  cover.hp = 1;
  blast(g, { x: 600, y: 300 }, 50);
  assert(!g.props.items.includes(cover));
  assert.equal(e.hp, e.maxHp);
  g.time = CHAIN_DELAY;
  g.demolition.update();
  assert(e.hp < e.maxHp);
});
test('cracked passage panels also trigger one chain, while reset and non-Demolition destruction never do', () => {
  const g = fixture(['shellshock', 'chain-reaction']);
  const panel = g.breaches.spawnPanel({ x: 800, y: 270, w: 20, h: 60 });
  g.breaches.hit(panel, 100, { x: 1, y: 0 });
  g.breaches.hit(panel, 100, { x: 1, y: 0 });
  assert.equal(g.demolition.pending.length, 1);
  g.loadRoom();
  assert.equal(g.demolition.pending.length, 0);
  g.mods = [];
  g.gun = getGun([]);
  const crate = g.props.spawn('crate', 800, 300);
  g.props.hit(crate, 200, { x: 1, y: 0 });
  assert.equal(g.demolition.pending.length, 0);
});
test('solid terrain blocks damage and blast surfing, and effects stop at the blocking face', () => {
  const g = fixture(['shellshock', 'blast-surf']);
  wall(g, 650, 300, 20, 200);
  Body.setPosition(g.player, { x: 700, y: 300 });
  const e = target(g, 700, 340);
  blast(g, { x: 600, y: 300 }, 100);
  assert.equal(e.hp, e.maxHp);
  near(g.player.velocity.x, 0);
  near(g.player.velocity.y, 0);
  near(g.demolition.effects[0].outline[0].x, 640);
});
test('shell blasts move rotated props and arm fuel, without granting immunity to fuel explosions', () => {
  const g = fixture(['shellshock', 'blast-surf']);
  const crate = g.props.spawn('crate', 680, 300);
  Body.setAngle(crate.body, Math.PI / 4);
  const fuel = g.props.spawn('canister', 600, 350);
  blast(g, { x: 620, y: 320 });
  assert(crate.hp < crate.maxHp);
  assert(crate.body.speed > 0);
  assert(Number.isFinite(fuel.armedAt));
  assert.equal(g.hp, 100);
  g.props.explode(fuel);
  assert(g.hp < 100);
});
test('explosive rounds retain their payload through Fold and detonate only on a later real impact', () => {
  const g = fixture(['shellshock', 'fold']);
  wall(g, 800, 500, 40, 480);
  wall(g, 650, 400, 20, 180);
  assert(g.portals.place({ x: 600, y: 740 }));
  assert(g.portals.place({ x: 780, y: 400 }));
  const s = shot(g, { pos: { x: 600, y: 710 }, vel: { x: 0, y: 45 } });
  g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 0);
  assert(s.pos.x > 700);
  near(s.pos.y, 400);
  near(s.shell!.damage, 24 * SHELL_BLAST);
  for (let i = 0; i < 4; i++) g.updateShots(1 / 60);
  assert.equal(g.demolition.effects.length, 1);
  near(g.demolition.effects[0].pos.x, 663);
});
test('hostile rounds and Splinter fragments do not acquire payloads, and expiry never creates an airburst', () => {
  const g = fixture(['shellshock', 'split', 'aftershock']);
  target(g);
  shot(g);
  g.updateShots(1 / 60);
  assert.equal(g.shots.length, 3);
  assert(g.shots.every((s) => s.fragment && !s.shell));
  const hostile = shot(g, { friendly: false });
  assert.equal(hostile.shell, undefined);
  const expired = shot(g, { life: 0.001, pos: { x: 400, y: 200 } });
  const before = g.demolition.effects.length;
  g.updateShots(1 / 60);
  assert(!g.shots.includes(expired));
  assert.equal(g.demolition.effects.length, before);
});
test('death, room changes, retries, and extraction clear delayed blasts without spending them', () => {
  for (const end of ['dead', 'room', 'retry', 'extract']) {
    const g = fixture(ids);
    blast(g);
    assert.equal(g.demolition.pending.length, 1);
    if (end === 'dead') {
      g.hp = 0;
      g.die();
    } else if (end === 'room') g.loadRoom();
    else if (end === 'retry') g.start(g.seed);
    else {
      g.stage = 8;
      g.clear = true;
      g.startEscape();
    }
    assert.equal(g.demolition.pending.length, 0);
    assert.equal(g.demolition.effects.length, 0);
  }
});
test('sustained scatter bursts keep projectiles, aftershocks, particles, and blast effects bounded', () => {
  const g = fixture([...ids, 'scatter', 'burst', 'rapid', 'backblast']);
  g.engine.gravity.y = 1;
  for (let i = 0; i < 600; i++) {
    step(g, 1, { fire: true, aim: { x: 600, y: 740 } });
    assert(g.shots.length <= 180);
    assert(g.particles.length <= 220);
    assert(g.demolition.pending.length <= DEMOLITION_PENDING_LIMIT);
    assert(g.demolition.effects.length <= DEMOLITION_EFFECT_LIMIT);
    assert(Number.isFinite(g.player.position.x) && Number.isFinite(g.player.position.y));
    assert.equal(g.hp, 100);
  }
  assert(g.shotCount > 20);
});

test('shooting the floor launches a grounded player through a real shell collision', () => {
  const heights: number[] = [];
  for (const mods of [['shellshock'], ['shellshock', 'blast-surf']]) {
    const g = fixture(mods);
    g.engine.gravity.y = 1;
    Body.setPosition(g.player, { x: 600, y: 722 });
    step(g, 30);
    assert(g.grounded);
    const start = g.player.position.y;
    step(g, 1, { fire: true, aim: { x: 600, y: 900 } });
    assert.equal(g.shotCount, 1);
    let high = g.player.position.y;
    for (let i = 0; i < 180; i++) {
      step(g);
      high = Math.min(high, g.player.position.y);
    }
    heights.push(start - high);
    assert.equal(g.hp, 100);
    assert(g.grounded, 'One blast leaves the player able to land again');
  }
  assert(heights[1] > heights[0] + 45, `Blast surfing did not add lift: ${heights}`);
});

test('boarding extraction discards a pending aftershock and its warning', () => {
  const g = fixture(ids);
  g.stage = 8;
  g.clear = true;
  g.startEscape();
  blast(g, { x: EXTRACTION.x, y: EXTRACTION.y - 5 });
  assert.equal(g.demolition.pending.length, 1);
  Body.setPosition(g.player, { x: EXTRACTION.x, y: EXTRACTION.y - 18 });
  Body.setVelocity(g.player, { x: 0, y: 0 });
  g.boardExtraction();
  assert.equal(g.escape?.phase, 'extracting');
  assert.equal(g.demolition.pending.length, 0);
  assert.equal(g.demolition.effects.length, 0);
  step(g, 160, { fire: true });
  assert.equal(g.mode, 'won');
  assert.equal(g.hp, 100);
});
