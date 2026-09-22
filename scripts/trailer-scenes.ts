import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { BRANCH_TEST_BUILDS, withParents } from '../src/branch-builds.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { seeded, validBuild, type Checkpoint, type Vec } from '../src/rules.ts';

// Capture direction uses only ordinary inputs. It never changes combat state.
export interface Take {
  name: string;
  stage: number;
  mods: string[];
  seed: string;
  start: number;
  length: number;
  style: number;
  event?: boolean;
  score?: number;
  quality?: TakeQuality;
}
const legal = (ids: readonly string[]) => {
  const mods = withParents([], ids);
  if (!mods || !validBuild(mods)) throw new Error(`Invalid build: ${ids}`);
  return mods;
};
export const templates = [
  { name: 'recoil', stage: 2, mods: legal(['kick', 'light']) },
  {
    name: 'scatter',
    stage: 6,
    mods: legal(['magnum', 'kick', 'rapid', 'scatter', 'ricochet', 'airshot']),
  },
  { name: 'pinwheel', stage: 10, mods: legal(BRANCH_TEST_BUILDS.pinwheel.mods) },
  { name: 'prism', stage: 10, mods: legal(BRANCH_TEST_BUILDS.prism.mods) },
  { name: 'cluster', stage: 10, mods: legal(BRANCH_TEST_BUILDS.cluster.mods) },
  { name: 'storm', stage: 10, mods: legal(BRANCH_TEST_BUILDS.storm.mods) },
  {
    name: 'saw',
    stage: 6,
    mods: legal(['grindshot', 'crosscut', 'split', 'shatter', 'pierce', 'light']),
  },
  { name: 'turf', stage: 4, mods: legal(['magnum', 'ricochet', 'airshot', 'light']), event: true },
  { name: 'loader', stage: 3, mods: legal(['magnum', 'rapid', 'kick']) },
];

export function startTake(take: Take) {
  if (take.mods.length > take.stage) throw new Error('Build exceeds its room reward budget');
  Math.random = seeded(take.seed + ':trailer-fx');
  const save: Checkpoint = {
    version: 6,
    seed: take.seed,
    stage: take.stage,
    hp: 100,
    mods: [...take.mods],
    kills: 0,
    elapsed: 0,
    ...(take.event
      ? { areaEvent: eventTestFromUrl(new URL('https://test/?test=events&event=turf'))!.areaEvent }
      : {}),
  };
  const game = new Game();
  game.startTest(save);
  return game;
}

interface DriverState {
  heading: number;
  sampledAt: number;
  sampledPosition: Vec;
  escapeUntil: number;
  jumpUntil: number;
  lastJump: number;
  targetId?: number;
}
const drivers = new WeakMap<Game, DriverState>();

export function clearAim(g: Game, aim: Vec) {
  // Include crates and moving cover, and reserve clearance for the gun/projectile.
  return !Matter.Query.ray(
    g.solidBodies,
    { x: g.player.position.x, y: g.player.position.y - 3 },
    aim,
    8,
  ).length;
}

export function actionInput(g: Game, tick: number, style: number): Input {
  const p = g.player.position;
  let state = drivers.get(g);
  if (!state) {
    state = {
      heading: 1,
      sampledAt: tick,
      sampledPosition: { ...p },
      escapeUntil: -1,
      jumpUntil: -1,
      lastJump: -100,
    };
    drivers.set(g, state);
  }
  const targets = g.enemies
    .filter((e) => e.hp > 0 && e.spawn <= 0 && !e.allied)
    .map((e) => {
      const q = e.body.position;
      const distance = Math.hypot(q.x - p.x, q.y - p.y);
      const clear = clearAim(g, q);
      return { e, clear, distance, cost: distance - (e.id === state.targetId ? 90 : 0) };
    })
    .sort((a, b) => a.cost - b.cost);
  // A hidden nearby enemy must never outrank a visible one.
  const sighted = targets.find((t) => t.clear && t.distance < 580);
  const choice = sighted ?? targets[0];
  const target = choice?.e;
  state.targetId = target?.id;
  const aim = target ? { ...target.body.position } : { x: p.x + 550, y: p.y };
  const dx = aim.x - p.x;
  if (tick >= state.escapeUntil) {
    if (!sighted || Math.abs(dx) > 280) state.heading = Math.sign(dx) || state.heading;
    else if (Math.abs(dx) < 125) state.heading = -Math.sign(dx) || state.heading;
    if (p.x < 85) state.heading = 1;
    if (p.x > g.worldWidth - 85) state.heading = -1;
  }
  if (tick - state.sampledAt >= 30) {
    if (Math.hypot(p.x - state.sampledPosition.x, p.y - state.sampledPosition.y) < 35) {
      state.heading *= -1;
      state.escapeUntil = tick + 38;
    }
    state.sampledAt = tick;
    state.sampledPosition = { ...p };
  }
  const obstacle =
    Matter.Query.ray(
      g.solidBodies,
      { x: p.x, y: p.y + 8 },
      { x: p.x + state.heading * 85, y: p.y + 8 },
      22,
    ).length > 0;
  const jump =
    g.grounded &&
    tick - state.lastJump > 32 &&
    (obstacle || !sighted || tick - state.lastJump > (style ? 90 : 125));
  if (jump) {
    state.lastJump = tick;
    state.jumpUntil = tick + 22;
  }
  let fire = !!sighted && tick % 108 < 88;
  if (g.mods.includes('charge-lens')) fire = !!sighted && tick % 90 < 62;
  // Let go while escaping, or when recoil would pin us against a wall/ceiling.
  const behind =
    Matter.Query.ray(
      g.solidBodies,
      p,
      {
        x: p.x - Math.sign(dx) * 60,
        y: p.y,
      },
      16,
    ).length > 0;
  if (
    tick < state.escapeUntil ||
    (behind && !g.grounded) ||
    (aim.y - p.y > 120 && p.y < 260 && g.player.velocity.y < 1)
  )
    fire = false;
  return {
    left: state.heading < 0,
    right: state.heading > 0,
    jump,
    jumpHeld: tick < state.jumpUntil,
    fire,
    aim,
  };
}

export interface ActionFrame {
  x: number;
  y: number;
  visible: boolean;
  blockedFire: boolean;
  damage: number;
  score: number;
}
export interface TakeQuality {
  visibleFraction: number;
  blockedFireFrames: number;
  longestQuietFrames: number;
  longestStallFrames: number;
  travel: number;
  span: number;
  damage: number;
}
export function recordAction(g: Game, input: Input) {
  const p = g.player.position;
  const visible = g.enemies.filter(
    (e) =>
      e.hp > 0 &&
      e.spawn <= 0 &&
      !e.allied &&
      Math.abs(e.body.position.x - p.x) < 420 &&
      Math.abs(e.body.position.y - p.y) < 230 &&
      clearAim(g, e.body.position),
  ).length;
  const blockedFire = input.fire && !clearAim(g, input.aim);
  const health = new Map(g.enemies.filter((e) => !e.allied).map((e) => [e, e.hp]));
  const kills = g.kills;
  g.tick(1 / 60, input);
  const damage = [...health].reduce(
    (sum, [enemy, hp]) => sum + Math.max(0, hp - Math.max(0, enemy.hp)),
    0,
  );
  return {
    x: g.player.position.x,
    y: g.player.position.y,
    visible: visible > 0,
    blockedFire,
    damage,
    score:
      Math.min(60, g.particles.length) * 0.05 +
      Math.min(40, g.shots.length) * 0.12 +
      Math.min(10, Math.hypot(g.player.velocity.x, g.player.velocity.y)) * 0.6 +
      Math.min(5, visible) * 2 +
      (g.kills - kills) * 40 +
      damage * 0.25,
  } satisfies ActionFrame;
}
export function takeQuality(frames: ActionFrame[]): TakeQuality {
  let quiet = 0,
    stall = 0,
    longestQuietFrames = 0,
    longestStallFrames = 0,
    travel = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i],
      old = frames[Math.max(0, i - 18)];
    quiet = f.visible ? 0 : quiet + 1;
    stall = i >= 18 && Math.hypot(f.x - old.x, f.y - old.y) < 22 ? stall + 1 : 0;
    longestQuietFrames = Math.max(longestQuietFrames, quiet);
    longestStallFrames = Math.max(longestStallFrames, stall);
    if (i) travel += Math.min(20, Math.hypot(f.x - frames[i - 1].x, f.y - frames[i - 1].y));
  }
  const xs = frames.map((f) => f.x),
    ys = frames.map((f) => f.y);
  return {
    visibleFraction: frames.filter((f) => f.visible).length / frames.length,
    blockedFireFrames: frames.filter((f) => f.blockedFire).length,
    longestQuietFrames,
    longestStallFrames,
    travel: Math.round(travel),
    span: Math.round(
      Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
    ),
    damage: Math.round(frames.reduce((sum, f) => sum + f.damage, 0)),
  };
}
export function usableAction(q: TakeQuality, frames: number) {
  return (
    q.blockedFireFrames === 0 &&
    q.visibleFraction >= 0.65 &&
    q.longestQuietFrames <= 27 &&
    q.longestStallFrames <= 15 &&
    q.travel >= frames * 1.6 &&
    q.span >= 105 &&
    q.damage > 0
  );
}

export function surveyTakes(names?: string[]) {
  const selected: Record<string, Take[]> = {};
  const length = 144;
  for (const template of templates) {
    if (names && !names.includes(template.name)) continue;
    const candidates: Take[] = [];
    for (let n = 0; n < 24; n++) {
      const seed =
        template.name === 'loader' && n < 2
          ? n
            ? 'LOADER-SHIFT-0'
            : 'LOADER-SHIFT-5'
          : template.name === 'turf' && n < 3
            ? ['TURF-80-1', 'TURF-80-0', 'TURF-80-10'][n]
            : `ACTION-${template.name.toUpperCase()}-${n}`;
      const take: Take = { ...template, seed, style: n % 2, start: 0, length };
      const g = startTake(take);
      const metrics: ActionFrame[] = [];
      for (let tick = 0; tick < 1050; tick++) {
        metrics.push(recordAction(g, actionInput(g, tick, take.style)));
        if (g.mode !== 'playing' || g.hp < 15 || g.clear) break;
        if (tick >= 120 + length && tick % 12 === 0) {
          const start = tick - length + 1;
          const frames = metrics.slice(start, tick + 1);
          const quality = takeQuality(frames);
          // Also gate each half: a short edit must not inherit an idle opening.
          if (
            usableAction(quality, length) &&
            [frames.slice(0, 72), frames.slice(72)].every((half) =>
              usableAction(takeQuality(half), half.length),
            )
          ) {
            const score = frames.reduce((a, b) => a + b.score, 0) / length;
            candidates.push({ ...take, start, quality, score: Number(score.toFixed(3)) });
          }
        }
      }
    }
    candidates.sort((a, b) => b.score! - a.score!);
    const choices: Take[] = [];
    for (const take of candidates) {
      if (choices.some((x) => x.seed === take.seed && Math.abs(x.start - take.start) < 210))
        continue;
      choices.push(take);
      if (choices.length === 3) break;
    }
    const required =
      template.name === 'loader' || template.name === 'storm'
        ? 1
        : template.name === 'cluster' || template.name === 'pinwheel'
          ? 3
          : 2;
    if (choices.length < required)
      throw new Error(
        `Only ${choices.length} usable action takes for ${template.name}; need ${required}`,
      );
    selected[template.name] = choices;
    console.log(template.name, JSON.stringify(choices));
  }
  return selected;
}
