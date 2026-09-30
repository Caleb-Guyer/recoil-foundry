import type { Level, Spawn, Solid } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import { distance, seeded } from './rules.ts';
import type { SecurityLevel } from './security.ts';

const box = (x: number, y: number, w: number, h = 22): Solid => ({ x, y, w, h });
const at = (kind: Spawn['kind'], x: number, top = 740): Spawn => ({
  kind,
  x,
  y: top - ENEMY_STATS[kind].h / 2,
});
type Plan = Pick<
  Level,
  'name' | 'solids' | 'spawns' | 'hazards' | 'vents' | 'coolant' | 'magnets' | 'fans'
>;
// Entrance/exit bays remain empty in both orientations. Machinery has reserved
// sweep columns and an alternative route; no upgrade is required to cross.
export const SECURITY_LAYOUTS: readonly Plan[] = [
  {
    name: 'Inspection aisle',
    solids: [
      box(390, 630, 160, 110),
      box(580, 495, 170),
      box(1220, 495, 190),
      box(1460, 630, 150, 110),
    ],
    hazards: [{ kind: 'crusher', x: 980, y: 410, w: 112, h: 30, travel: 300 }],
    spawns: [
      at('runner', 680),
      at('shooter', 1160),
      at('shooter', 490, 630),
      at('shooter', 1510, 630),
      { kind: 'flyer', x: 1290, y: 330 },
    ],
  },
  {
    name: 'Thermal inspection',
    solids: [box(380, 635, 140, 105), box(850, 580, 260), box(1500, 635, 130, 105)],
    hazards: [],
    vents: [
      {
        x: 670,
        y: 738,
        dir: { x: 0, y: -1 },
        valve: { x: 595, y: 714 },
        width: 88,
        length: 300,
        offset: 0,
      },
      {
        x: 1320,
        y: 738,
        dir: { x: 0, y: -1 },
        valve: { x: 1395, y: 714 },
        width: 88,
        length: 300,
        offset: 2.1,
      },
    ],
    spawns: [
      at('runner', 800),
      at('shooter', 1160),
      at('shooter', 440, 635),
      at('sniper', 1000, 580),
      at('hopper', 1700),
      { kind: 'flyer', x: 1520, y: 320 },
    ],
  },
  {
    name: 'Cooling checkpoint',
    solids: [
      box(390, 630, 150, 110),
      box(760, 555, 170),
      box(1290, 525, 190),
      box(1540, 635, 100, 105),
    ],
    coolant: [box(970, 718, 230, 22)],
    hazards: [{ kind: 'lift', x: 1080, y: 645, w: 170, h: 22, travel: 175 }],
    spawns: [
      at('runner', 610),
      at('shooter', 690),
      at('sniper', 850, 555),
      { kind: 'skimmer', x: 1190, y: 290 },
      { kind: 'flyer', x: 1480, y: 330 },
      at('shooter', 1600, 635),
      at('hopper', 1710),
    ],
  },
  {
    name: 'Recovery inspection',
    solids: [box(390, 640, 145, 100), box(830, 520, 310), box(1460, 625, 160, 115)],
    hazards: [],
    magnets: [
      { x: 680, y: 330, floor: 740, offset: 0 },
      { x: 1300, y: 330, floor: 740, offset: 3.2 },
    ],
    spawns: [
      at('runner', 790),
      at('shooter', 1170),
      at('borer', 570),
      at('sniper', 1000, 520),
      { kind: 'sifter', x: 1520, y: 300 },
      at('shooter', 1530, 625),
      at('hopper', 1690),
    ],
  },
  {
    name: 'Roof inspection',
    solids: [box(400, 630, 140, 110), box(820, 510, 240), box(1430, 630, 170, 110)],
    hazards: [],
    fans: [
      { x: 660, y: 738, dir: { x: 0, y: -1 }, width: 170, length: 500, offset: 0 },
      { x: 1230, y: 738, dir: { x: 0, y: -1 }, width: 170, length: 500, offset: 2 },
    ],
    spawns: [
      at('runner', 780),
      at('shooter', 1130),
      at('shooter', 460, 630),
      at('sniper', 970, 510),
      at('shooter', 1500, 630),
      { kind: 'skimmer', x: 1320, y: 270 },
      { kind: 'flyer', x: 1550, y: 345 },
      at('hopper', 1740),
    ],
  },
];
export function redlineLayout(base: Level, stage: number): Level {
  const plan = structuredClone(SECURITY_LAYOUTS[Math.floor(stage / 4)]);
  const mirror = base.mirrored,
    x = (v: number) => (mirror ? 2000 - v : v);
  const solids = plan.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x }));
  return {
    id: 'security-' + base.area,
    name: plan.name,
    area: base.area,
    boss: false,
    mirrored: mirror,
    security: true,
    solids,
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    hazards: (plan.hazards ?? []).map((h) => ({ ...h, x: x(h.x) })),
    ...(plan.coolant
      ? { coolant: plan.coolant.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x })) }
      : {}),
    ...(plan.vents
      ? {
          vents: plan.vents.map((v) => ({
            ...v,
            x: x(v.x),
            dir: { x: mirror ? -v.dir.x : v.dir.x, y: v.dir.y },
            valve: { x: x(v.valve.x), y: v.valve.y },
          })),
        }
      : {}),
    ...(plan.fans
      ? {
          fans: plan.fans.map((v) => ({
            ...v,
            x: x(v.x),
            dir: { x: mirror ? -v.dir.x : v.dir.x, y: v.dir.y },
          })),
        }
      : {}),
    ...(plan.magnets ? { magnets: plan.magnets.map((m) => ({ ...m, x: x(m.x) })) } : {}),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      props: [
        { kind: 'crate', x: x(300), y: 716 },
        { kind: 'canister', x: x(1700), y: 715 },
      ],
      weak: [],
    },
    route: [
      { x: 280, y: 720 },
      ...solids
        .filter((s) => s.h > 22)
        .sort((a, b) => a.x - b.x)
        .map((s) => ({ x: s.x + s.w / 2, y: s.y - 20 })),
      { x: 1760, y: 720 },
    ],
  };
}
// Reuse real spawn anchors and keep the room's enemy count. Squad members enter
// together through the existing warned, occupancy-checked reinforcement doors.
export function reinforceSecurity(
  base: Level,
  seed: string,
  stage: number,
  level: SecurityLevel,
): Level {
  if (
    !level ||
    base.boss ||
    base.detour ||
    base.freight ||
    base.annex ||
    base.story ||
    base.shutdown ||
    base.courier ||
    base.floodgate ||
    base.sortingPit ||
    (!base.security && stage % 4 !== 1)
  )
    return base;
  const result = structuredClone(base);
  const ground = result.spawns.filter((s) => ['runner', 'hopper', 'charger'].includes(s.kind));
  const shooters = result.spawns.filter((s) => s.kind === 'shooter' && !s.elite);
  const candidates = (support: Spawn[]) =>
    ground.flatMap((a) =>
      support
        .filter((b) => a !== b && !b.elite && distance(a, b) < 900 && Math.abs(a.y - b.y) < 145)
        .map((b) => ({ a, b })),
    );
  const preferred = candidates(shooters);
  const pairs = preferred.length ? preferred : candidates(ground);
  const rng = seeded(seed + ':security-squad:' + stage);
  const pair = pairs[Math.floor(rng() * pairs.length)];
  if (pair) {
    // All three source hulls are runner-sized; preserve their supporting surface.
    const floor = pair.a.y + ENEMY_STATS[pair.a.kind].h / 2;
    pair.a.kind = 'runner';
    pair.a.y = floor - ENEMY_STATS.runner.h / 2;
    pair.a.elite = 'shielded';
    const supportFloor = pair.b.y + ENEMY_STATS[pair.b.kind].h / 2;
    pair.b.kind = 'shooter';
    pair.b.y = supportFloor - ENEMY_STATS.shooter.h / 2;
    pair.a.squad = { kind: 'shield', role: 'lead' };
    pair.b.squad = { kind: 'shield', role: 'support' };
    result.security = true;
  }
  return result;
}
