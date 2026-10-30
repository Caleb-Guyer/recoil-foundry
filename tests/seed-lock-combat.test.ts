import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Matter from 'matter-js';
import { Game, type Input, type Particle } from '../src/game.ts';
import type { Level } from '../src/levels.ts';
import { Renderer } from '../src/render.ts';
import { loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { dailyStartingGun } from '../src/starting-guns.ts';
import { seedLockedCombat } from '../src/seed-lock.ts';

const DT = 1 / 60;
const level: Level = {
  id: 'seed-lock-combat-regression',
  name: 'Seed Lock combat regression',
  area: 'docks',
  solids: [],
  spawns: [{ kind: 'shooter', x: 600, y: 722 }],
  route: [],
  mirrored: false,
  boss: false,
};
const input: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 600, y: 722 },
};
function checkpoint(seed: string): Checkpoint {
  const cp: Checkpoint = {
    version: 6,
    seed,
    stage: 4,
    startingGun: dailyStartingGun(seed) ?? 'pistol',
    mods: ['split', 'rapid'],
    hp: 100,
    kills: 0,
    elapsed: 0,
    missedUpgrades: 2,
  };
  assert(loadCheckpoint(cp), 'the test must use a legal saved build');
  return cp;
}
function fixture(seed: string) {
  const g = new Game();
  let writes = 0;
  g.onCheckpoint = () => writes++;
  g.startTest(checkpoint(seed), level);
  g.waves.clear();
  const e = g.enemies[0];
  assert(e && e.kind === 'shooter');
  e.spawn = 0;
  e.hp = e.maxHp = 10000;
  Matter.Body.setPosition(g.player, { x: 200, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.aim = { ...input.aim };
  return { g, writes: () => writes };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function fill(g: Game) {
  g.particles = Array.from(
    { length: 220 },
    (_, n): Particle => ({
      pos: { x: 400 + n, y: 450 },
      vel: { x: 0, y: 0 },
      life: 5,
      max: 5,
      size: 2,
      color: '#abcdef',
      kind: 'spark',
    }),
  );
}
function gameplay(g: Game) {
  return {
    time: g.time,
    elapsed: g.elapsed,
    mode: g.mode,
    clear: g.clear,
    hp: g.hp,
    kills: g.kills,
    shots: g.shotCount,
    shootAt: g.shootAt,
    player: {
      position: { ...g.player.position },
      velocity: { ...g.player.velocity },
      angle: g.player.angle,
      angularVelocity: g.player.angularVelocity,
    },
    enemies: g.enemies.map((e) => ({
      kind: e.kind,
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      spawn: e.spawn,
      facing: e.facing,
      position: { ...e.body.position },
      velocity: { ...e.body.velocity },
      angle: e.body.angle,
      angularVelocity: e.body.angularVelocity,
    })),
    rounds: g.shots.map((s) => ({
      pos: { ...s.pos },
      vel: { ...s.vel },
      damage: s.damage,
      life: s.life,
      radius: s.radius,
      friendly: s.friendly,
      split: s.split,
      fragment: s.fragment,
      bounces: s.bounces,
      pierce: s.pierce,
    })),
  };
}
function hash(g: Game) {
  return createHash('sha256')
    .update(JSON.stringify(gameplay(g)))
    .digest('hex');
}
function renderer(g: Game, reduced: boolean) {
  const values: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1 };
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key in values) return values[String(key)];
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'measureText') return () => ({ width: 100 });
      if (key === 'getLineDash') return () => [];
      return () => {};
    },
    set(_target, key, value) {
      values[String(key)] = value;
      return true;
    },
  });
  const canvas = {
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 960, height: 600 }),
  } as unknown as HTMLCanvasElement;
  const r = new Renderer(canvas, g);
  r.reduced = reduced;
  return r;
}

test('Seed Lock belongs only to new Campaign and supported Daily identities', () => {
  for (const seed of ['RF-C111-SAME', 'RF-C112-SAME', 'RF-D92-2026-10-30'])
    assert(seedLockedCombat(seed), seed);
  for (const seed of [
    'RF-C110-SAME',
    'RF-C108-SAME',
    'RF-D91-2026-10-30',
    'RF-D78-2026-10-30',
    'RF-D92-2026-02-30',
    'RF-D999-2026-10-30',
    'RF-Q1-SAME',
    'RF-C111SAME',
    'SAME',
  ])
    assert.equal(seedLockedCombat(seed), false, seed);
});

for (const seed of ['RF-C111-COSMETIC', 'RF-D92-2026-10-30'])
  test(`${seed}: capped casings and spark noise cannot consume fragment or enemy-delay randomness`, () => {
    const a = fixture(seed),
      b = fixture(seed),
      original = Math.random;
    try {
      fill(b.g);
      Math.random = () => {
        throw new Error('A Seed Lock spark or casing used global randomness');
      };
      for (let shot = 0; shot < 12; shot++) {
        a.g.particles = [];
        b.g.burst({ x: 500, y: 450 }, 400, '#ffffff', 4);
        a.g.fireRound();
        b.g.fireRound();
        const first = a.g.shots.findLast((s) => !s.fragment),
          second = b.g.shots.findLast((s) => !s.fragment);
        assert(first && second);
        a.g.splitShot(first);
        b.g.splitShot(second);
        assert.deepEqual(
          a.g.shots.filter((s) => s.fragment).map((s) => [s.vel, s.damage, s.life]),
          b.g.shots.filter((s) => s.fragment).map((s) => [s.vel, s.damage, s.life]),
        );
        a.g.shots = [];
        b.g.shots = [];
      }
      a.g.spawnEnemy('runner', 1200, 722);
      b.g.spawnEnemy('runner', 1200, 722);
      assert.equal(a.g.enemies.at(-1)!.timer, b.g.enemies.at(-1)!.timer);
      assert.equal(a.g.rng(), b.g.rng(), 'the next actual combat draw remains equal');
      assert.equal(a.writes() + b.writes(), 0);
    } finally {
      Math.random = original;
      dispose(a.g);
      dispose(b.g);
    }
  });

type Condition = 'baseline' | 'full' | 'noise' | 'render' | 'reduced' | 'pause';
function trace(seed: string, condition: Condition) {
  const { g, writes } = fixture(seed),
    r = renderer(g, condition === 'reduced'),
    frames: string[] = [];
  let fragments = 0,
    nativeEnemyShots = 0;
  try {
    for (let frame = 0; frame < 240; frame++) {
      if (condition === 'full') fill(g);
      if (condition === 'noise') {
        g.particles = [];
        g.burst({ x: 440, y: 550 }, 219, '#ffffff', 2);
        for (let i = 0; i < 9; i++) g.cosmeticRandom();
      }
      if (condition === 'pause' && frame === 120) {
        g.setMode('paused');
        const before = gameplay(g);
        const particles = structuredClone(g.particles);
        for (let i = 0; i < 180; i++) {
          g.tick(DT, input);
          if (i % 30 === 0) r.draw(1000 + i * DT * 1000);
        }
        assert.deepEqual(gameplay(g), before, 'paused ticks freeze native combat and active time');
        assert.deepEqual(g.particles, particles, 'paused ticks freeze cosmetic simulation');
        g.setMode('playing');
      }
      // A released input boundary surrounds the Pause transition. Native Pause
      // deliberately cancels held actions, so this does not claim to preserve a queued burst.
      g.tick(DT, { ...input, fire: frame < 114 || frame > 125 });
      assert.equal(g.mode, 'playing');
      if ((condition === 'render' || condition === 'reduced') && frame % 8 === 0) {
        const before = gameplay(g);
        for (let i = 0; i < 3; i++) r.draw(1000 + (frame * 3 + i) * DT * 1000);
        assert.deepEqual(gameplay(g), before, 'production rendering is gameplay-pure');
      }
      fragments = Math.max(fragments, g.shots.filter((s) => s.fragment).length);
      nativeEnemyShots = Math.max(nativeEnemyShots, g.shots.filter((s) => !s.friendly).length);
      frames.push(hash(g));
    }
    const enemyHealth = g.enemies[0].hp;
    assert(enemyHealth < 10000, 'actual projectiles must contact the live native target');
    assert(fragments > 0, 'actual impact processing must emit Splinter fragments');
    assert(nativeEnemyShots > 0, 'the native shooter must issue actual hostile rounds');
    assert.equal(writes(), 0);
    return { frames, nextCombatDraw: g.rng(), enemyHealth, fragments, nativeEnemyShots };
  } finally {
    dispose(g);
  }
}
for (const seed of ['RF-C111-TRACE', 'RF-D92-2026-10-30'])
  test(`${seed}: actual fixed-input combat is unchanged by heavy effects, rendering, Reduced Effects and safe Pause`, () => {
    const baseline = trace(seed, 'baseline');
    for (const condition of ['full', 'noise', 'render', 'reduced', 'pause'] as const) {
      const comparison = trace(seed, condition);
      assert.deepEqual(comparison, baseline, condition);
    }
  });

for (const seed of ['RF-C108-LEGACY', 'RF-C110-LEGACY', 'RF-D91-2026-10-30'])
  test(`${seed}: legacy fire keeps its established one combat draw for an admitted casing`, () => {
    const admitted = fixture(seed),
      capped = fixture(seed);
    try {
      admitted.g.particles = [];
      fill(capped.g);
      admitted.g.fire();
      capped.g.fire();
      capped.g.rng(); // This is the legacy casing draw skipped by the full cosmetic pool.
      assert.equal(admitted.g.rng(), capped.g.rng());
      assert.equal(admitted.g.particles.filter((p) => p.kind === 'shell').length, 1);
      assert.equal(capped.g.particles.filter((p) => p.kind === 'shell').length, 0);
      assert.equal(admitted.g.testRun?.version, 6);
      assert.equal(admitted.g.seed, seed);
    } finally {
      dispose(admitted.g);
      dispose(capped.g);
    }
  });

test('new room entries and private restarts reset both stream identities without serializing cosmetic history', () => {
  const { g } = fixture('RF-C111-RESET');
  try {
    const sample = () => {
      Matter.Body.setPosition(g.player, { x: 200, y: 722 });
      Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
      g.aim = { ...input.aim };
      g.fire();
      const primary = g.shots.find((s) => !s.fragment)!;
      g.splitShot(primary);
      return {
        shell: g.particles.find((p) => p.kind === 'shell')!.vel,
        fragments: g.shots.filter((s) => s.fragment).map((s) => s.vel),
        nextCombatDraw: g.rng(),
      };
    };
    const first = structuredClone(sample());
    for (let i = 0; i < 800; i++) g.cosmeticRandom();
    g.loadRoom();
    const second = structuredClone(sample());
    assert.deepEqual(second, first);
    g.startTest(checkpoint('RF-C111-RESET'), level);
    assert.deepEqual(sample(), first);
    const saved = g.checkpointSnapshot();
    assert.equal(saved.version, 6);
    assert(!('cosmeticRng' in saved));
    assert(!('cosmeticRandom' in saved));
  } finally {
    dispose(g);
  }
});

test('a new Campaign Overtime checkpoint keeps Seed Lock through its older arena-layout identity', () => {
  const cp: Checkpoint = {
    version: 6,
    seed: 'RF-C111-OVERTIME',
    stage: 0,
    mods: ['split', 'rapid', 'scatter', 'pierce', 'kick', 'magnum', 'airshot', 'ricochet'],
    hp: 100,
    kills: 12,
    elapsed: 120,
    missedUpgrades: 11,
    overtime: { baseMods: 8, repairs: 0, remix: 5 },
  };
  assert(loadCheckpoint(cp));
  const a = new Game(),
    b = new Game();
  try {
    a.start(cp.seed, cp);
    b.start(cp.seed, cp);
    assert(a.overtime && b.overtime);
    assert(a.layoutSeed.startsWith('RF-C105-OT-'));
    assert.equal(a.layoutSeed, b.layoutSeed);
    assert(seedLockedCombat(a.seed));
    assert.equal(seedLockedCombat(a.layoutSeed), false, 'arena revision must not own combat RNG');
    a.particles = [];
    fill(b);
    a.fire();
    b.fire();
    const primaryA = a.shots.find((s) => !s.fragment),
      primaryB = b.shots.find((s) => !s.fragment);
    assert(primaryA && primaryB);
    a.splitShot(primaryA);
    b.splitShot(primaryB);
    assert.deepEqual(
      a.shots.filter((s) => s.fragment).map((s) => s.vel),
      b.shots.filter((s) => s.fragment).map((s) => s.vel),
    );
    assert.equal(a.rng(), b.rng());
  } finally {
    dispose(a);
    dispose(b);
  }
});

test('archived cosmetic sparks retain the exact global random call pattern and values', () => {
  const { g } = fixture('RF-C110-OLD-SPARK'),
    original = Math.random;
  let calls = 0;
  try {
    g.particles = [];
    Math.random = () => {
      calls++;
      return 0.25;
    };
    g.burst({ x: 500, y: 400 }, 2, '#ffffff', 2);
    assert.equal(calls, 8);
    assert.equal(g.particles.length, 2);
    for (const particle of g.particles) {
      assert.deepEqual(particle.pos, { x: 500, y: 400 });
      assert(Math.abs(particle.vel.x) < 1e-15);
      assert.equal(particle.vel.y, 1.3);
      assert.equal(particle.life, 0.175);
      assert.equal(particle.max, 0.175);
      assert.equal(particle.size, 1.5);
    }
  } finally {
    Math.random = original;
    dispose(g);
  }
});
