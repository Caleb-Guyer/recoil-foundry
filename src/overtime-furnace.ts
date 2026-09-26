import type { Level, Solid, Spawn } from './levels.ts';
import type { PressurePlacement } from './pressure-layouts.ts';
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
const jet = (x: number, offset: number, length = 480, width = 100): PressurePlacement => ({
  x,
  y: 738,
  dir: { x: 0, y: -1 },
  valve: { x: x - 74, y: 710 },
  width,
  length,
  offset,
  overpressure: true,
});
type Plan = Pick<Level, 'id' | 'name' | 'solids' | 'spawns'> & { vents: PressurePlacement[] };

const CHAMBERS: Plan = {
  id: 'ot-split-boilers',
  name: 'Split boilers',
  solids: [
    box(450, 650, 120, 90),
    box(850, 630, 120, 110),
    box(1460, 650, 120, 90),
    box(380, 440, 210, 22),
    box(1070, 400, 220, 22),
  ],
  vents: [jet(710, 0), jet(1350, 3.4)],
  spawns: [
    ground('charger', 1080),
    ground('shooter', 510, 650),
    air('skimmer', 870, 280),
    ground('hopper', 1640),
    ground('shooter', 1170, 400, 'twin'),
    air('sifter', 1530, 310),
    ground('sniper', 480, 440),
    ...pair('shield', ground('runner', 820, 740, 'shielded'), ground('shooter', 1150)),
  ],
};
const GALLERY: Plan = {
  id: 'ot-relief-gallery',
  name: 'Relief gallery',
  solids: [
    box(470, 650, 130, 90),
    box(1390, 650, 130, 90),
    box(740, 470, 180, 22),
    box(1080, 390, 190, 22),
    box(1510, 450, 170, 22),
  ],
  vents: [
    { ...jet(660, 0, 450, 80), valve: { x: 734, y: 710 } },
    jet(1000, 2.8, 520),
    jet(1330, 5.6, 450, 80),
  ],
  spawns: [
    ground('charger', 790),
    ground('shooter', 530, 650),
    air('skimmer', 860, 300),
    ground('runner', 1220, 740, 'shielded'),
    ground('hopper', 1590),
    air('sifter', 1490, 280),
    ground('shooter', 1180, 390, 'twin'),
    ...pair('flank', ground('sniper', 820, 470), air('flyer', 1170, 240)),
  ],
};
const TUNNEL: Plan = {
  id: 'ot-service-tunnel',
  name: 'Service tunnel',
  solids: [
    box(440, 650, 110, 90),
    box(840, 660, 110, 80),
    box(1320, 650, 110, 90),
    box(360, 490, 260, 24),
    box(800, 470, 190, 24),
    box(1300, 460, 330, 24),
  ],
  vents: [jet(680, 0, 400), jet(1130, 3.4, 460)],
  spawns: [
    ground('charger', 1010),
    ground('shooter', 490, 650),
    ground('hopper', 1230),
    air('skimmer', 740, 265),
    ground('shooter', 1390, 460, 'twin'),
    air('sifter', 1520, 290),
    ground('runner', 1510, 740, 'shielded'),
    ...pair('ambush', ground('sniper', 910, 470), ground('hopper', 1610)),
  ],
};
const FLUE: Plan = {
  id: 'ot-flue-walk',
  name: 'Flue walk',
  solids: [
    box(450, 650, 120, 90),
    box(1530, 650, 120, 90),
    box(420, 480, 180, 22),
    box(800, 410, 180, 22),
    box(1210, 360, 170, 22),
    box(1510, 480, 170, 22),
  ],
  vents: [jet(690, 0, 540), jet(1090, 2.8, 550), jet(1440, 5.6, 420, 70)],
  spawns: [
    ground('charger', 840),
    ground('shooter', 510, 480),
    air('skimmer', 770, 270),
    ground('runner', 1190, 740, 'shielded'),
    ground('hopper', 1590, 650),
    air('sifter', 1550, 290),
    ground('shooter', 1290, 360, 'twin'),
    ...pair('flank', ground('sniper', 890, 410), air('flyer', 1250, 215)),
  ],
};
const PRESS: Plan = {
  id: 'press-hall',
  name: 'Overtime pressure press',
  solids: [
    box(410, 650, 120, 90),
    box(1480, 650, 120, 90),
    box(780, 460, 130, 22),
    box(1110, 440, 130, 22),
  ],
  vents: [jet(650, 0, 590, 140), jet(1010, 3, 590, 140), jet(1370, 6, 590, 140)],
  spawns: [
    air('press', 1550, 250),
    air('sifter', 830, 270),
    air('skimmer', 1170, 270),
    air('flyer', 450, 280),
  ],
};
const KILN: Plan = {
  id: 'kiln-hall',
  name: 'Overtime boiler floor',
  solids: [
    box(420, 650, 110, 90),
    box(1500, 650, 110, 90),
    box(810, 400, 160, 22),
    box(1170, 420, 150, 22),
  ],
  vents: [jet(660, 0, 480, 140), jet(1060, 3, 490, 140), jet(1400, 6, 490, 140)],
  spawns: [
    ground('kiln', 1220),
    air('sifter', 880, 260),
    air('skimmer', 1230, 280),
    air('flyer', 470, 280),
  ],
};

export function remixFurnace(base: Level, stage: number, route?: RouteChoice | null): Level {
  const plan = structuredClone(
    stage === 4
      ? CHAMBERS
      : stage === 5
        ? GALLERY
        : stage === 6
          ? route === 'high'
            ? FLUE
            : TUNNEL
          : base.spawns[0].kind === 'press'
            ? PRESS
            : KILN,
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
    area: 'furnace',
    boss: stage === 7,
    mirrored,
    overtimeFurnace: true,
    ...(route ? { routeChoice: route } : {}),
    solids,
    route: path,
    hazards: [],
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    vents: plan.vents.map((v) => ({
      ...v,
      x: x(v.x),
      dir: { x: mirrored ? -v.dir.x : v.dir.x, y: v.dir.y },
      valve: { x: x(v.valve.x), y: v.valve.y },
    })),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      weak: [],
      props: [{ kind: 'crate', x: x(350), y: 717 }],
      cargo: [],
    },
  };
}
