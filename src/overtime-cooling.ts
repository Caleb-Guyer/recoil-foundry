import type { Level, Solid, Spawn } from './levels.ts';
import type { FanPlacement } from './crosswind.ts';
import type { RouteChoice } from './rules.ts';
import { ENEMY_STATS } from './enemies.ts';

const box = (x: number, y: number, w: number, h: number): Solid => ({ x, y, w, h });
const ground = (kind: Spawn['kind'], x: number, top = 740, elite?: Spawn['elite']): Spawn => ({
  kind,
  x,
  y: top - ENEMY_STATS[kind].h / 2,
  ...(elite ? { elite } : {}),
});
const air = (kind: Spawn['kind'], x: number, y: number): Spawn => ({ kind, x, y });
const pair = (kind: 'shield' | 'flank' | 'ambush', lead: Spawn, support: Spawn): Spawn[] => [
  { ...lead, squad: { kind, role: 'lead' } },
  { ...support, squad: { kind, role: 'support' } },
];
const up = (x: number, offset: number, length = 530, width = 170): FanPlacement => ({
  x,
  y: 738,
  dir: { x: 0, y: -1 },
  width,
  length,
  offset,
});
const across = (y: number, offset: number): FanPlacement => ({
  x: 2,
  y,
  dir: { x: 1, y: 0 },
  width: 90,
  length: 1740,
  offset,
});
type Plan = Pick<Level, 'id' | 'name' | 'solids' | 'spawns'> & { fans: FanPlacement[] };

const INTAKE: Plan = {
  id: 'ot-intake-shafts',
  name: 'Intake shafts',
  solids: [
    box(420, 650, 120, 90),
    box(950, 640, 120, 100),
    box(1480, 650, 130, 90),
    box(450, 460, 160, 22),
    box(990, 400, 180, 22),
    box(1470, 460, 190, 22),
  ],
  fans: [up(760, 0), up(1310, 3.1, 500)],
  spawns: [
    ground('charger', 1140),
    ground('shooter', 480, 650),
    air('skimmer', 920, 280),
    ground('hopper', 1600, 650),
    ground('shooter', 1080, 400, 'twin'),
    air('sifter', 1530, 280),
    ground('sniper', 530, 460),
    ...pair('shield', ground('runner', 900, 740, 'shielded'), ground('shooter', 1430)),
  ],
};
const TOWERS: Plan = {
  id: 'ot-cooling-towers',
  name: 'Cooling towers',
  solids: [
    box(400, 650, 150, 90),
    box(940, 600, 150, 140),
    box(1510, 630, 120, 110),
    box(330, 420, 220, 22),
    box(960, 360, 180, 22),
    box(1490, 500, 240, 22),
  ],
  fans: [up(790, 0, 560, 180), up(1330, 3.1, 520, 190)],
  spawns: [
    ground('charger', 1160),
    ground('shooter', 480, 650),
    air('skimmer', 940, 260),
    ground('runner', 1440, 740, 'shielded'),
    ground('hopper', 1570, 630),
    air('sifter', 1510, 300),
    ground('shooter', 1050, 360, 'twin'),
    ...pair('flank', ground('sniper', 440, 420), air('flyer', 1150, 240)),
  ],
};
const SERVICE: Plan = {
  id: 'ot-cooling-service',
  name: 'Bypass duct',
  solids: [
    box(450, 650, 100, 90),
    box(920, 650, 110, 90),
    box(1470, 650, 110, 90),
    box(320, 470, 500, 24),
    box(890, 450, 400, 24),
    box(1420, 470, 300, 24),
  ],
  fans: [up(760, 0, 235, 160), across(570, 3.1)],
  spawns: [
    ground('charger', 1130),
    ground('shooter', 500, 650),
    ground('hopper', 1270),
    air('skimmer', 830, 280),
    ground('shooter', 1550, 470, 'twin'),
    air('sifter', 1270, 300),
    ground('runner', 1630, 740, 'shielded'),
    ...pair('ambush', ground('sniper', 1010, 450), ground('hopper', 1400)),
  ],
};
const SKYWAY: Plan = {
  id: 'ot-exhaust-skyway',
  name: 'Exhaust skyway',
  solids: [
    box(440, 650, 110, 90),
    box(940, 650, 110, 90),
    box(1490, 650, 110, 90),
    box(400, 380, 170, 22),
    box(980, 300, 180, 22),
    box(1490, 360, 180, 22),
  ],
  fans: [up(760, 0, 590, 170), up(1310, 3.1, 580, 170), across(220, 5.5)],
  spawns: [
    ground('charger', 1160),
    ground('shooter', 475, 380),
    air('skimmer', 950, 200),
    ground('runner', 900, 740, 'shielded'),
    ground('hopper', 1540, 650),
    air('sifter', 1510, 290),
    ground('shooter', 1080, 300, 'twin'),
    ...pair('flank', ground('sniper', 1570, 360), air('flyer', 1130, 200)),
  ],
};
const CONDENSER: Plan = {
  id: 'condenser-hall',
  name: 'Overtime intake manifold',
  solids: [
    box(410, 650, 120, 90),
    box(960, 650, 110, 90),
    box(1500, 650, 120, 90),
    box(410, 455, 180, 22),
    box(980, 430, 170, 22),
    box(1500, 460, 170, 22),
  ],
  fans: [up(750, 0, 550, 200), up(1320, 3.1, 550, 200)],
  spawns: [
    air('condenser', 1490, 260),
    air('sifter', 950, 260),
    air('skimmer', 1120, 280),
    air('flyer', 450, 280),
  ],
};
const TURBINE: Plan = {
  id: 'turbine-gallery',
  name: 'Overtime crossflow chamber',
  solids: [
    box(430, 650, 120, 90),
    box(840, 630, 320, 110),
    box(1510, 650, 120, 90),
    box(480, 400, 200, 22),
    box(1340, 410, 200, 22),
  ],
  fans: [up(760, 0, 540, 140), up(1250, 3.1, 540, 140), across(510, 5.5)],
  spawns: [
    air('turbine', 1500, 260),
    air('sifter', 940, 270),
    air('skimmer', 1110, 270),
    air('flyer', 450, 270),
  ],
};

export function remixCooling(base: Level, stage: number, route?: RouteChoice | null): Level {
  const plan = structuredClone(
    stage === 8
      ? INTAKE
      : stage === 9
        ? TOWERS
        : stage === 10
          ? route === 'high'
            ? SKYWAY
            : SERVICE
          : base.spawns[0].kind === 'condenser'
            ? CONDENSER
            : TURBINE,
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
    area: 'cooling',
    boss: stage === 11,
    mirrored,
    overtimeCooling: true,
    ...(route ? { routeChoice: route } : {}),
    solids,
    route: path,
    hazards: [],
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    fans: plan.fans.map((f) => ({
      ...f,
      x: x(f.x),
      dir: { x: mirrored ? -f.dir.x : f.dir.x, y: f.dir.y },
    })),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      weak: [],
      props: [{ kind: 'crate', x: x(350), y: 717 }],
      cargo: [],
    },
  };
}
