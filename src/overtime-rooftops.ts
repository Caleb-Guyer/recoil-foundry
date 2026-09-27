import type { Level, Solid, Spawn } from './levels.ts';
import type { ConductorPlacement } from './stormfront.ts';
import type { RouteChoice } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';
const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const ground = (kind: Spawn['kind'], x: number, top = 740, elite?: Spawn['elite']): Spawn => ({
  kind,
  x,
  y: top - ENEMY_STATS[kind].h / 2,
  ...(elite ? { elite } : {}),
});
const air = (kind: Spawn['kind'], x: number, y: number, elite?: Spawn['elite']): Spawn => ({
  kind,
  x,
  y,
  ...(elite ? { elite } : {}),
});
const pair = (lead: Spawn, support: Spawn): Spawn[] => [
  { ...lead, squad: { kind: 'shield', role: 'lead' } },
  { ...support, squad: { kind: 'shield', role: 'support' } },
];
type Plan = Pick<Level, 'id' | 'name' | 'solids' | 'spawns'> & { conductors: ConductorPlacement[] };
const lane = (x: number, width = 160): ConductorPlacement => ({ x, width });
const ANTENNA: Plan = {
  id: 'ot-storm-antenna',
  name: 'Antenna approach',
  solids: [
    box(400, 650, 140, 90),
    box(980, 640, 120, 100),
    box(1500, 650, 140, 90),
    box(380, 450, 350, 22),
    box(1140, 430, 300, 22),
  ],
  conductors: [lane(760), lane(1280)],
  spawns: [
    ground('charger', 1180),
    ground('shooter', 470, 650),
    air('skimmer', 960, 240),
    ground('borer', 1380),
    ground('shooter', 1300, 430, 'twin'),
    air('sifter', 1550, 250),
    air('flyer', 740, 250, 'volatile'),
    ...pair(ground('runner', 890, 740, 'shielded'), ground('sniper', 560, 450)),
  ],
};
const MASTS: Plan = {
  id: 'ot-storm-masts',
  name: 'Lightning masts',
  solids: [
    box(400, 650, 120, 90),
    box(950, 620, 180, 120),
    box(1500, 650, 120, 90),
    box(580, 450, 240, 22),
    box(1240, 360, 200, 22),
  ],
  conductors: [lane(810), lane(1410)],
  spawns: [
    ground('charger', 1180),
    ground('shooter', 460, 650),
    air('skimmer', 970, 260),
    ground('borer', 1390),
    ground('shooter', 1340, 360, 'twin'),
    air('sifter', 1560, 270),
    air('flyer', 1090, 280, 'volatile'),
    ...pair(ground('runner', 880, 740, 'shielded'), ground('sniper', 700, 450)),
  ],
};
const SERVICE: Plan = {
  id: 'ot-storm-service',
  name: 'Sheltered maintenance',
  solids: [
    box(400, 650, 100, 90),
    box(960, 650, 100, 90),
    box(1500, 650, 100, 90),
    box(400, 450, 450, 24),
    box(1100, 450, 400, 24),
  ],
  conductors: [lane(650), lane(1320)],
  spawns: [
    ground('charger', 1180),
    ground('shooter', 450, 650),
    air('skimmer', 960, 250),
    ground('borer', 1380),
    ground('shooter', 1320, 450, 'twin'),
    air('sifter', 1550, 270),
    air('flyer', 870, 250, 'volatile'),
    ...pair(ground('runner', 900, 740, 'shielded'), ground('sniper', 630, 450)),
  ],
};
const SKYLINE: Plan = {
  id: 'ot-storm-skyline',
  name: 'Exposed skyline',
  solids: [
    box(410, 650, 110, 90),
    box(970, 650, 110, 90),
    box(1500, 650, 110, 90),
    box(460, 400, 190, 22),
    box(980, 330, 170, 22),
    box(1430, 390, 250, 22),
  ],
  conductors: [lane(630), lane(1110), lane(1620)],
  spawns: [
    ground('charger', 1190),
    ground('shooter', 540, 400),
    air('skimmer', 950, 220),
    ground('borer', 1360),
    ground('shooter', 1060, 330, 'twin'),
    air('sifter', 1520, 260),
    air('flyer', 700, 240, 'volatile'),
    ...pair(ground('runner', 900, 740, 'shielded'), ground('sniper', 1580, 390)),
  ],
};
const INTERCEPTOR: Plan = {
  id: 'relay-roof',
  name: 'Storm relay',
  solids: [
    box(430, 650, 120, 90),
    box(980, 650, 100, 90),
    box(1480, 650, 120, 90),
    box(590, 460, 170, 22),
    box(1240, 460, 170, 22),
  ],
  conductors: [lane(820, 180), lane(1180, 180)],
  spawns: [
    air('interceptor', 1490, 260),
    air('sifter', 940, 220),
    air('skimmer', 1110, 250),
    air('flyer', 450, 250),
  ],
};
export function remixRooftops(base: Level, stage: number, route?: RouteChoice | null): Level {
  const plan = structuredClone(
    stage === 16
      ? ANTENNA
      : stage === 17
        ? MASTS
        : stage === 18
          ? route === 'high'
            ? SKYLINE
            : SERVICE
          : INTERCEPTOR,
  );
  const mirrored = base.mirrored,
    x = (n: number) => (mirrored ? 2000 - n : n);
  const solids = plan.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x }));
  const path = [{ x: 280, y: 720 }];
  for (const s of solids.filter((s) => s.y + s.h === 740).sort((a, b) => a.x - b.x))
    path.push(
      { x: s.x - 55, y: 720 },
      { x: s.x + s.w / 2, y: s.y - 20 },
      { x: s.x + s.w + 55, y: 720 },
    );
  path.push({ x: 1810, y: 720 });
  return {
    id: plan.id,
    name: plan.name,
    area: 'rooftops',
    boss: stage === 19,
    mirrored,
    overtimeRooftops: true,
    ...(route ? { routeChoice: route } : {}),
    solids,
    route: path,
    hazards: [],
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    conductors: plan.conductors.map((p) => ({ ...p, x: x(p.x) })),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      weak: [],
      props: [{ kind: 'crate', x: x(350), y: 717 }],
      cargo: [],
    },
  };
}
