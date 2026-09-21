import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { BRANCH_TEST_BUILDS, withParents } from '../src/branch-builds.ts';
import { eventTestFromUrl } from '../src/area-events.ts';
import { seeded, validBuild, type Checkpoint } from '../src/rules.ts';

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
}
const legal = (ids: readonly string[]) => {
  const mods = withParents([], ids);
  if (!mods || !validBuild(mods)) throw new Error(`Invalid build: ${ids}`);
  return mods;
};
export const templates = [
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

export function actionInput(g: Game, tick: number, style: number): Input {
  const p = g.player.position;
  const targets = g.enemies
    .filter((e) => e.hp > 0 && !e.allied)
    .map((e) => {
      const q = e.body.position;
      const distance = Math.hypot(q.x - p.x, q.y - p.y);
      const blocked = Matter.Query.ray(g.solidBodies, p, q).length > 0;
      return { e, cost: distance + (blocked ? 380 : 0) };
    })
    .sort((a, b) => a.cost - b.cost);
  const target = targets[0]?.e;
  const aim = target ? { ...target.body.position } : { x: p.x + 550, y: p.y };
  const dx = aim.x - p.x;
  const phase = tick % (style ? 135 : 170);
  const advance = Math.abs(dx) > (style ? 110 : 210);
  const stuck = Math.abs(g.player.velocity.x) < 1.2 && advance;
  const jump = g.grounded && ((phase >= 10 && phase < 15) || (stuck && tick % 35 === 0));
  let fire = tick % 96 < 88;
  if (g.mods.includes('charge-lens')) fire = tick % 90 < 62;
  // Let go before downward fire strands the player near the ceiling.
  if (aim.y - p.y > 120 && p.y < 430 && g.player.velocity.y < 1) fire = false;
  return {
    left: advance && dx < 0,
    right: advance && dx > 0,
    jump,
    jumpHeld: phase < (style ? 35 : 20),
    fire,
    aim,
  };
}

export function surveyTakes() {
  const selected: Record<string, Take[]> = {};
  const length = 180;
  for (const template of templates) {
    const candidates: Take[] = [];
    for (let n = 0; n < 12; n++) {
      const seed =
        template.name === 'loader'
          ? n % 2
            ? 'LOADER-SHIFT-0'
            : 'LOADER-SHIFT-5'
          : template.name === 'turf'
            ? ['TURF-80-1', 'TURF-80-0', 'TURF-80-10'][n % 3]
            : `ACTION-${template.name.toUpperCase()}-${n}`;
      const take: Take = { ...template, seed, style: n % 2, start: 0, length };
      const g = startTake(take);
      const metrics: number[] = [];
      let previousKills = 0,
        previousHp = 100,
        previousEnemyHp = g.enemies.reduce((a, e) => a + e.hp, 0);
      const shotsAt: number[] = [];
      for (let tick = 0; tick < 1050; tick++) {
        g.tick(1 / 60, actionInput(g, tick, take.style));
        if (g.mode !== 'playing' || g.hp < 15 || g.clear) break;
        const p = g.player.position;
        const nearby = g.enemies.filter(
          (e) =>
            !e.allied &&
            Math.abs(e.body.position.x - p.x) < 650 &&
            Math.abs(e.body.position.y - p.y) < 450,
        ).length;
        const enemyHp = g.enemies.reduce((a, e) => a + e.hp, 0);
        const hit = Math.max(0, previousEnemyHp - enemyHp);
        const moving = Math.min(15, Math.hypot(g.player.velocity.x, g.player.velocity.y));
        const threats = g.shots.filter((s) => !s.friendly).length;
        const score = nearby
          ? Math.min(80, g.particles.length) * 0.15 +
            Math.min(60, g.shots.length) * 0.24 +
            moving * 0.35 +
            Math.min(8, nearby) +
            threats * 0.2 +
            (g.kills - previousKills) * 60 +
            hit * 0.1
          : -8;
        metrics.push(score - Math.max(0, previousHp - g.hp) * 0.2);
        shotsAt.push(g.shotCount);
        previousKills = g.kills;
        previousHp = g.hp;
        previousEnemyHp = enemyHp;
        if (tick >= 180 + length && tick % 30 === 0) {
          const start = tick - length + 1;
          const fired = shotsAt[tick] - shotsAt[start];
          if (fired >= 2 || g.torch.equipped) {
            const score = metrics.slice(start, tick + 1).reduce((a, b) => a + b, 0) / length;
            candidates.push({ ...take, start, score: Number(score.toFixed(3)) });
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
    if (!choices.length) throw new Error(`No usable action takes for ${template.name}`);
    selected[template.name] = choices;
    console.log(template.name, JSON.stringify(choices));
  }
  return selected;
}
