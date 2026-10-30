import Matter from 'matter-js';
import { Game, type Input } from './game.ts';
import type { Level } from './levels.ts';
import { loadCheckpoint, type Checkpoint } from './rules.ts';
import { dailyForDate } from './daily.ts';
import { seedLockedCombat } from './seed-lock.ts';

export const SEED_LOCK_SCENES = ['heavy', 'reduced', 'pause', 'legacy', 'daily'] as const;
export type SeedLockScene = (typeof SEED_LOCK_SCENES)[number];
export interface SeedLockTest {
  scene: SeedLockScene;
  title: string;
  hint: string;
}
export const SEED_LOCK_TEST_COPY: Record<SeedLockScene, { title: string; hint: string }> = {
  heavy: {
    title: 'Heavy effects, same combat',
    hint: 'Compare the same new Campaign seed and recorded firing inputs with ordinary effects and a saturated particle pool. Every native gameplay sample must match.',
  },
  reduced: {
    title: 'Reduced Effects, same combat',
    hint: 'Compare normal rendering with actual Reduced Effects rendering of the same recorded inputs. Repeated draws must not change native combat.',
  },
  pause: {
    title: 'Pause, then resume',
    hint: 'Pause freezes the simulation. Compare a continuous sample with an extra second of paused ticks, then resume from the same released-input boundary.',
  },
  legacy: {
    title: 'Older saves keep their rules',
    hint: 'Load older C108 and C110 checkpoint samples through the current save validator. Compare their native room-entry behavior before and after reconstruction under identical effects. Older rules retain their original random stream.',
  },
  daily: {
    title: 'Daily challenge identities',
    hint: 'Reconstruct an archived D91 Daily under its original rules, then compare the new D92 Daily under different particle loads. These private samples never submit a Daily score.',
  },
};
export function seedLockTestFromUrl(url: URL): SeedLockTest | null {
  const p = url.searchParams;
  let invalid = !!url.hash;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  const scene = p.get('scene') ?? 'heavy';
  if (
    invalid ||
    p.get('test') !== 'seed-lock' ||
    p.get('v') !== '1' ||
    !(SEED_LOCK_SCENES as readonly string[]).includes(scene)
  )
    return null;
  return { scene: scene as SeedLockScene, ...SEED_LOCK_TEST_COPY[scene as SeedLockScene] };
}

/** A private native physics range. Its wall causes actual Splinter impacts. */
export function seedLockRange(): Level {
  return {
    id: 'seed-lock-range',
    name: 'Seed Lock comparison range',
    area: 'docks',
    mirrored: false,
    boss: false,
    solids: [{ x: 640, y: 480, w: 36, h: 260 }],
    spawns: [{ kind: 'shooter', x: 1100, y: 722 }],
    route: [
      { x: 140, y: 722 },
      { x: 1400, y: 722 },
    ],
    setpiece: { rosters: [[0]], props: [], weak: [] },
  };
}
export function seedLockCheckpoint(seed: string): Checkpoint {
  const save: Checkpoint = {
    version: 6,
    seed,
    stage: 0,
    mods: ['split'],
    hp: 100,
    kills: 0,
    elapsed: 0,
  };
  const loaded = loadCheckpoint(save);
  if (!loaded) throw new Error('Seed Lock sample checkpoint is not valid.');
  return loaded;
}
export interface SeedLockFrame {
  side: 'baseline' | 'variant';
  pair: number;
  frame: number;
  reduced: boolean;
  paused: boolean;
}
export interface SeedLockHooks {
  /** Browser inspections use the actual Renderer; headless tests omit drawing. */
  render?: (game: Game, frame: SeedLockFrame) => void;
}
export interface SeedLockPairResult {
  label: string;
  seed: string;
  locked: boolean;
  checkpointVersion: number;
  samples: number;
  matched: boolean;
  firstMismatch: number | null;
  baselineFingerprint: string;
  variantFingerprint: string;
  baselineShots: number;
  variantShots: number;
  baselineFragments: number;
  variantFragments: number;
  baselineNextRandom: number;
  variantNextRandom: number;
  pausedTicks: number;
  pauseFrozen: boolean;
  checkpointWrites: number;
  renderedFrames: number;
  serializedCheckpointPreserved: boolean;
}
export interface SeedLockResult {
  scene: SeedLockScene;
  passed: boolean;
  pairs: SeedLockPairResult[];
  explanation: string;
}
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 722 },
};
/** Presentation deliberately omitted; these are native simulation values. */
export function seedLockGameplaySample(g: Game): string {
  const body = (b: Matter.Body) => [
    b.position.x,
    b.position.y,
    b.velocity.x,
    b.velocity.y,
    b.angle,
    b.angularVelocity,
  ];
  return JSON.stringify({
    mode: g.mode,
    seed: g.seed,
    stage: g.stage,
    time: g.time,
    elapsed: g.elapsed,
    hp: g.hp,
    kills: g.kills,
    shotsFired: g.shotCount,
    clear: g.clear,
    player: body(g.player),
    grounded: g.grounded,
    shootAt: g.shootAt,
    hitStop: g.hitStop,
    enemies: g.enemies.map((e) => [
      e.kind,
      e.hp,
      e.phase,
      e.state,
      e.timer,
      e.attack,
      e.attacks,
      e.aim,
      e.spawn,
      body(e.body),
    ]),
    projectiles: g.shots.map((s) => [
      s.pos.x,
      s.pos.y,
      s.vel.x,
      s.vel.y,
      s.life,
      s.damage,
      s.friendly,
      s.fragment,
      s.split,
      s.bounces,
      s.pierce,
      s.charged,
      [...s.hits].map((id) => g.enemies.findIndex((e) => e.id === id)),
    ]),
    terrain: g.terrain.map(body),
  });
}
function fingerprint(samples: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const sample of samples)
    for (let i = 0; i < sample.length; i++) {
      hash ^= sample.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function saturate(g: Game, frame: number, varied: boolean) {
  g.particles = [];
  if (varied && frame % 2 === 0) g.burst({ x: 400, y: 620 }, 80, '#f0bf78', 4);
  while (g.particles.length < 220) {
    const n = g.particles.length;
    g.particles.push({
      pos: { x: 180 + (n % 22) * 18, y: 500 + Math.floor(n / 22) * 19 },
      // Sparks are native velocity strokes; stationary fillers would be invisible.
      vel: { x: 2.8 + (n % 3) * 0.4, y: -1.2 },
      life: 5,
      max: 5,
      size: 2.4,
      color: '#f0bf78',
      kind: 'spark',
    });
  }
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
type PairSpec = {
  label: string;
  seed: string;
  condition: 'heavy' | 'reduced' | 'pause' | 'roundtrip';
  frames: number;
};
function specs(scene: SeedLockScene): PairSpec[] {
  if (scene === 'legacy')
    return [108, 110].map((revision) => ({
      label: `Campaign C${revision} save reconstruction`,
      seed: `RF-C${revision}-LOCK-SAVE`,
      condition: 'roundtrip',
      frames: 120,
    }));
  if (scene === 'daily')
    return [
      {
        label: 'Archived D91 Daily reconstruction',
        seed: dailyForDate('2026-10-29', 91)!.seed,
        condition: 'roundtrip',
        frames: 120,
      },
      {
        label: 'D92 Daily cosmetic independence',
        seed: dailyForDate('2026-10-29', 92)!.seed,
        condition: 'heavy',
        frames: 120,
      },
    ];
  return [
    {
      label: SEED_LOCK_TEST_COPY[scene].title,
      seed: 'RF-C111-LOCK-SAMPLE',
      condition: scene,
      frames: 180,
    },
  ];
}
/** Bounded native simulation comparison: no storage, profile reads or network. */
export function runSeedLockComparison(
  fixture: SeedLockTest,
  hooks: SeedLockHooks = {},
): SeedLockResult {
  const pairs = specs(fixture.scene).map((spec, pair) => {
    const checkpoint = seedLockCheckpoint(spec.seed);
    const reconstructed = loadCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
    if (!reconstructed) throw new Error('The sample save could not be reconstructed.');
    const preserved = JSON.stringify(checkpoint) === JSON.stringify(reconstructed);
    let renderedFrames = 0;
    const results = (['baseline', 'variant'] as const).map((side) => {
      const g = new Game();
      let checkpointWrites = 0,
        fragments = 0,
        pausedTicks = 0,
        pauseFrozen = true;
      const samples: string[] = [];
      const seenFragments = new Set<number>();
      g.onCheckpoint = () => checkpointWrites++;
      g.startTest(side === 'variant' ? reconstructed : checkpoint, seedLockRange());
      const draw = (frame: number, paused = false) => {
        if (!hooks.render) return;
        hooks.render(g, {
          side,
          pair,
          frame,
          reduced: side === 'variant' && spec.condition === 'reduced',
          paused,
        });
        renderedFrames++;
      };
      try {
        for (let frame = 0; frame < spec.frames; frame++) {
          if (spec.condition === 'roundtrip' || (side === 'variant' && spec.condition === 'heavy'))
            saturate(g, frame, spec.condition === 'heavy');
          if (side === 'variant' && spec.condition === 'pause' && frame === 78) {
            // Fire was released for thirty ticks: no held burst or secondary is being cancelled.
            g.setMode('paused');
            const before = seedLockGameplaySample(g);
            for (let tick = 0; tick < 60; tick++) {
              g.tick(1 / 60, idle);
              pausedTicks++;
              if (tick % 12 === 0) draw(frame, true);
              if (seedLockGameplaySample(g) !== before) pauseFrozen = false;
            }
            g.setMode('playing');
          }
          const fire = frame % 48 === 0;
          g.tick(1 / 60, { ...idle, fire, firePressed: fire });
          for (const shot of g.shots)
            if (shot.fragment && !seenFragments.has(shot.id)) {
              seenFragments.add(shot.id);
              fragments++;
            }
          samples.push(seedLockGameplaySample(g));
          if (frame % 12 === 0 || frame === spec.frames - 1) {
            draw(frame);
            if (side === 'variant' && ['heavy', 'reduced'].includes(spec.condition)) {
              draw(frame);
              draw(frame);
            }
          }
        }
        const nextRandom = g.rng();
        samples.push(JSON.stringify({ nextRandom }));
        return {
          samples,
          fragments,
          shots: g.shotCount,
          nextRandom,
          pausedTicks,
          pauseFrozen,
          checkpointWrites,
        };
      } finally {
        dispose(g);
      }
    });
    const [base, variant] = results;
    const mismatch = base.samples.findIndex((sample, index) => sample !== variant.samples[index]);
    const writes = base.checkpointWrites + variant.checkpointWrites;
    return {
      label: spec.label,
      seed: spec.seed,
      locked: seedLockedCombat(spec.seed),
      checkpointVersion: checkpoint.version,
      samples: spec.frames,
      matched:
        mismatch === -1 &&
        variant.pauseFrozen &&
        writes === 0 &&
        preserved &&
        base.fragments > 0 &&
        base.shots > 1,
      firstMismatch: mismatch === -1 ? null : mismatch + 1,
      baselineFingerprint: fingerprint(base.samples),
      variantFingerprint: fingerprint(variant.samples),
      baselineShots: base.shots,
      variantShots: variant.shots,
      baselineFragments: base.fragments,
      variantFragments: variant.fragments,
      baselineNextRandom: base.nextRandom,
      variantNextRandom: variant.nextRandom,
      pausedTicks: variant.pausedTicks,
      pauseFrozen: variant.pauseFrozen,
      checkpointWrites: writes,
      renderedFrames,
      serializedCheckpointPreserved: preserved,
    };
  });
  return {
    scene: fixture.scene,
    passed: pairs.every((pair) => pair.matched),
    pairs,
    explanation:
      'Actual fixed-step Game firing, Splinter wall impacts, enemy states, projectile trajectories and physics are compared sample by sample. Fingerprints summarize the full comparison; they are not the only equality check. These private measurements are not a human playtest, an earned result or a cross-browser floating-point guarantee.',
  };
}
