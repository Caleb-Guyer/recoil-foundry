import { transformedFinale, cinematicFinale, reclaimerPressureSeed } from './boss-progression.ts';
import type { FinaleScene } from './finale-director.ts';
import type { Game, Enemy } from './game.ts';
import type { Level } from './levels.ts';
import type { InterceptorMove } from './interceptor-weapons.ts';
import { seeded, sample, availableMods, type Checkpoint } from './rules.ts';
import { testCheckpoint } from './practice.ts';
import { finalArsenalSeed } from './boss-progression.ts';

export const FINAL_MOVES: readonly InterceptorMove[] = [
  'aimed',
  'heavy',
  'ricochet',
  'burst',
  'crossfire',
  'precision',
  'scatter',
  'fuse',
  'recall',
  'afterimage',
  'countershot',
  'capacitor',
  'shatter',
  'fold',
  'shockwave',
  'grindshot',
  'sweep',
  'ringburst',
  'lockdown',
];
const OPENING: readonly InterceptorMove[] = [
  'aimed',
  'heavy',
  'ricochet',
  'burst',
  'scatter',
  'crossfire',
  'grindshot',
  'sweep',
];
const SECOND = FINAL_MOVES.filter((m) => !['fold', 'capacitor', 'shockwave'].includes(m));
export interface FinalArsenalRig {
  completed: number;
  used: InterceptorMove[];
  last?: InterceptorMove;
  chain: number;
}
export const createFinalArsenal = (overtime: boolean): FinalArsenalRig => ({
  completed: overtime ? 2 : 0,
  used: [],
  chain: 0,
});
export function finaleMove(g: Game, e: Enemy): InterceptorMove {
  const rig = e.interceptor!.finale!;
  const preview = g.testRun && finalePreview(g.testRun.seed);
  if (preview?.attack) return preview.attack;
  if (!g.overtime && rig.completed < 2) return rig.completed === 0 ? 'aimed' : 'heavy';
  const phase = Math.min(2, e.phase + (g.uprising.finale === 'overloaded' ? 1 : 0));
  const pool = (
    g.overtime || phase >= 2 || cinematicFinale(g.seed)
      ? FINAL_MOVES
      : phase === 1
        ? SECOND
        : OPENING
  ).filter(
    (move) =>
      (!cinematicFinale(g.seed) || e.phase === 0 || !['fold', 'shockwave'].includes(move)) &&
      (g.uprising.finale !== 'isolated' ||
        (reclaimerPressureSeed(g.seed)
          ? !['ringburst', 'afterimage'].includes(move)
          : !['ringburst', 'lockdown', 'shockwave', 'afterimage'].includes(move))),
  );
  let choices = pool.filter((m) => !rig.used.includes(m) && m !== rig.last);
  if (!choices.length) {
    rig.used = [];
    choices = pool.filter((m) => m !== rig.last);
  }
  return sample(
    choices,
    1,
    seeded(g.seed + ':final-arsenal:' + g.level.bossRemix + ':' + rig.completed),
  )[0];
}
export function finaleFollowups(g: Game, e: Enemy) {
  if (g.uprising.finale === 'mutiny') return 0;
  const move = e.interceptor!.move;
  if (reclaimerPressureSeed(g.seed)) {
    if (move === 'sweep') return g.overtime ? 3 : 2;
    if (move === 'ringburst') return g.overtime || e.phase === 2 ? 2 : 1;
    if (move === 'aimed') return g.overtime || e.phase > 0 ? 3 : 2;
    if (move === 'heavy' || move === 'scatter') return g.overtime || e.phase > 0 ? 2 : 1;
    if (move === 'crossfire') return g.overtime || e.phase === 2 ? 2 : 1;
  }
  if (move === 'sweep') return g.overtime ? 3 : 2;
  if (move === 'ringburst') return g.overtime ? 2 : 1;
  if (move === 'aimed') return g.overtime || e.phase > 0 ? 2 : 1;
  if (move === 'crossfire') return cinematicFinale(g.seed) && (g.overtime || e.phase === 2) ? 2 : 1;
  if (cinematicFinale(g.seed) && move === 'heavy' && (e.phase > 0 || g.overtime)) return 1;
  if (move === 'scatter' && g.overtime) return 1;
  return 0;
}
export function finaleRecovery(g: Game, e: Enemy, ordinary: number) {
  const rig = e.interceptor!.finale!;
  rig.completed++;
  rig.used.push(e.interceptor!.move);
  rig.used = [...new Set(rig.used)];
  rig.last = e.interceptor!.move;
  const revised = transformedFinale(g.seed);
  const pressure = reclaimerPressureSeed(g.seed);
  const chain =
    (pressure || g.overtime || e.phase >= (revised ? 1 : 2)) && g.uprising.finale !== 'mutiny';
  rig.chain = chain ? (rig.chain + 1) % (revised && e.phase === 2 ? 3 : 2) : 0;
  // A short break separates linked attacks; every second attack exposes a
  // proper punish window. Attack warnings themselves never run faster.
  return chain && rig.chain !== 0
    ? g.overtime
      ? 0.65
      : revised
        ? 0.68
        : 0.8
    : pressure
      ? Math.max(g.overtime ? 1.05 : 1.2, ordinary * 0.84)
      : Math.max(g.overtime ? 1.15 : 1.4, ordinary);
}
export function finalePending(e: Enemy) {
  const rig = e.interceptor!;
  return rig.queue.length + rig.echoes.length + rig.charges.length + rig.saws.length > 0;
}
export function planLockdown(g: Game, e: Enemy) {
  const rig = e.interceptor!;
  const offsets = g.overtime ? [-315, -105, 105, 315] : [-210, 0, 210];
  const extent = g.overtime ? 315 : 210;
  const center = Math.max(100 + extent, Math.min(1900 - extent, g.player.position.x));
  const points = offsets.map((dx) => ({
    x: center + dx,
    y: 0,
  }));
  rig.zones = points
    .filter((p, i) => points.findIndex((q) => q.x === p.x) === i)
    .map((p) => ({
      x: p.x,
      y:
        Math.min(
          740,
          ...g.terrainBodies
            .filter(
              (b) =>
                b.bounds.min.x <= p.x &&
                b.bounds.max.x >= p.x &&
                b.bounds.min.y >= g.player.bounds.max.y - 1,
            )
            .map((b) => b.bounds.min.y),
        ) - 8,
    }));
}

const ATTACKS = {
  arsenal: undefined,
  sweep: 'sweep',
  ring: 'ringburst',
  lockdown: 'lockdown',
} as const;
type Preview = {
  overtime: boolean;
  phase: number;
  attack?: InterceptorMove;
  arena: number;
  mirror: boolean;
  scene?: FinaleScene;
};
export function finalePreview(seed: string): Preview | null {
  const match =
    /^RF-C(?:9[567]|107)-F-([CO])-([123])-([ASRL])-([012])-([01])(?:-([ABICEX]))?$/.exec(seed);
  if (!match || (match[6] && !cinematicFinale(seed))) return null;
  return {
    overtime: match[1] === 'O',
    phase: Number(match[2]) - 1,
    attack: ({ A: undefined, S: 'sweep', R: 'ringburst', L: 'lockdown' } as const)[
      match[3] as 'A' | 'S' | 'R' | 'L'
    ],
    arena: Number(match[4]),
    mirror: match[5] === '1',
    ...(match[6]
      ? {
          scene: (
            {
              A: 'approach',
              B: 'boarding',
              I: 'airlift',
              C: 'core-opening',
              E: 'destruction',
              X: 'escape',
            } as const
          )[match[6] as 'A' | 'B' | 'I' | 'C' | 'E' | 'X'],
        }
      : {}),
  };
}
export function finaleTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'finale') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      ![
        'test',
        'fight',
        'phase',
        'attack',
        'arena',
        'mirror',
        'v',
        ...(p.get('v') === '3' ? ['scene', 'first'] : []),
      ].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const fight = p.get('fight') ?? 'campaign',
    phase = p.get('phase') ?? '1',
    attack = p.get('attack') ?? 'arsenal',
    arena = p.get('arena') ?? 'relay',
    mirror = p.get('mirror') ?? '0';
  if (
    invalid ||
    !['campaign', 'overtime'].includes(fight) ||
    !['1', '2', '3'].includes(phase) ||
    !Object.hasOwn(ATTACKS, attack) ||
    !['relay', 'skybridge', 'crossfire'].includes(arena) ||
    !['0', '1'].includes(mirror) ||
    (p.has('v') && !['1', '2', '3'].includes(p.get('v')!)) ||
    (fight === 'overtime' &&
      ((phase === '1' && p.has('phase') && !['2', '3'].includes(p.get('v')!)) || arena !== 'relay'))
  )
    return null;
  if (p.has('first') && !['0', '1'].includes(p.get('first')!)) return null;
  if (
    p.has('scene') &&
    !['approach', 'boarding', 'airlift', 'core', 'destruction', 'escape'].includes(p.get('scene')!)
  )
    return null;
  if (p.get('scene') === 'escape' && (fight === 'overtime' || p.get('first') !== '0')) return null;
  const overtime = fight === 'overtime';
  const seed =
    (p.get('v') === '3' ? 'RF-C97-F-' : p.get('v') === '2' ? 'RF-C96-F-' : 'RF-C95-F-') +
    (overtime ? 'O' : 'C') +
    '-' +
    (overtime && !p.has('phase') && !['2', '3'].includes(p.get('v')!) ? '2' : phase) +
    '-' +
    { arsenal: 'A', sweep: 'S', ring: 'R', lockdown: 'L' }[attack]! +
    '-' +
    ['relay', 'skybridge', 'crossfire'].indexOf(arena) +
    '-' +
    mirror +
    (p.get('v') === '3' && p.has('scene')
      ? '-' +
        (
          {
            approach: 'A',
            boarding: 'B',
            airlift: 'I',
            core: 'C',
            destruction: 'E',
            escape: 'X',
          } as const
        )[p.get('scene') as 'approach' | 'boarding' | 'airlift' | 'core' | 'destruction' | 'escape']
      : '');
  const cp: Checkpoint = { ...testCheckpoint(seed, 19), version: 6 };
  if (p.get('v') === '3') cp.finaleFirstClear = overtime || p.get('first') === '0' ? 0 : 1;
  if (arena !== 'relay') cp.bossRemix = arena === 'skybridge' ? 'boss-skybridge' : 'boss-crossfire';
  if (overtime) {
    cp.overtime = { baseMods: cp.mods.length, repairs: 0, remix: 5 };
    for (let stage = 0; stage < 19; stage++) {
      const mod = availableMods(cp.mods)[0];
      if (mod) cp.mods.push(mod.id);
      else cp.overtime.repairs++;
    }
  }
  return cp;
}
export function configureFinalePreview(g: Game, e: Enemy) {
  const p = g.testRun && finalePreview(g.testRun.seed);
  if (!p || !e.interceptor?.finale) return;
  e.hp =
    e.maxHp *
    (cinematicFinale(g.seed)
      ? [1, 1, 1]
      : transformedFinale(g.seed)
        ? [1, 0.68, 0.34]
        : [1, 0.65, 0.31])[p.phase];
  if (p.overtime && !transformedFinale(g.seed)) e.hp = e.maxHp * (p.phase === 1 ? 1 : 0.49);
  e.phase = p.phase;
  if (p.phase > 0 || p.attack) e.interceptor.finale.completed = 2;
}
export function finalePreviewLevel(g: Game, base: Level): Level {
  const p = g.testRun && finalePreview(g.testRun.seed);
  if (!p || g.escape || g.stage !== 19 || p.mirror === base.mirrored) return base;
  const level = structuredClone(base);
  level.mirrored = p.mirror;
  level.solids = level.solids.map((s) => ({ ...s, x: 2000 - s.x - s.w }));
  level.spawns = level.spawns.map((s) => ({ ...s, x: 2000 - s.x }));
  level.route = level.route.map((v) => ({ ...v, x: 2000 - v.x })).reverse();
  if (level.hazards) level.hazards = level.hazards.map((h) => ({ ...h, x: 2000 - h.x }));
  if (level.conductors) level.conductors = level.conductors.map((c) => ({ ...c, x: 2000 - c.x }));
  if (level.setpiece)
    level.setpiece.props = level.setpiece.props.map((v) => ({ ...v, x: 2000 - v.x }));
  return level;
}
export { finalArsenalSeed };
