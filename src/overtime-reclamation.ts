import type { Level, Solid, Spawn } from './levels.ts';
import type { CargoPlacement } from './cargo-layout.ts';
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
const load = (x: number, toX: number, y: number, delay: number): CargoPlacement => ({
  x,
  y,
  anchorY: y - 160,
  transport: { toX, delay },
});
type Plan = Pick<Level, 'id' | 'name' | 'solids' | 'spawns'> & { cargo: CargoPlacement[] };

const SORTING: Plan = {
  id: 'ot-scrap-sorting',
  name: 'Scrap sorting floor',
  solids: [
    box(380, 650, 140, 90),
    box(980, 630, 140, 110),
    box(1500, 650, 140, 90),
    box(380, 460, 150, 22),
    box(1480, 430, 180, 22),
  ],
  cargo: [load(650, 880, 470, 2.5), load(1320, 1130, 390, 7)],
  spawns: [
    ground('charger', 1180),
    ground('shooter', 450, 650),
    air('skimmer', 950, 240),
    ground('borer', 1380),
    ground('shooter', 1560, 430, 'twin'),
    air('sifter', 1490, 250),
    air('flyer', 700, 250, 'volatile'),
    ...pair(ground('runner', 900, 740, 'shielded'), ground('sniper', 450, 460)),
  ],
};
const TRANSFER: Plan = {
  id: 'ot-scrap-transfer',
  name: 'Transfer gantries',
  solids: [
    box(400, 650, 140, 90),
    box(950, 610, 160, 130),
    box(1500, 650, 140, 90),
    box(640, 440, 180, 22),
    box(1190, 450, 200, 22),
  ],
  cargo: [load(590, 830, 330, 3.5), load(1430, 1160, 570, 7.5)],
  spawns: [
    ground('charger', 1160),
    ground('shooter', 470, 650),
    air('skimmer', 970, 260),
    ground('borer', 1410),
    ground('shooter', 1290, 450, 'twin'),
    air('sifter', 1530, 260),
    air('flyer', 1080, 300, 'volatile'),
    ...pair(ground('runner', 870, 740, 'shielded'), ground('sniper', 740, 440)),
  ],
};
const SERVICE: Plan = {
  id: 'ot-scrap-service',
  name: 'Scrap service tunnels',
  solids: [
    box(400, 650, 100, 90),
    box(960, 650, 100, 90),
    box(1500, 650, 100, 90),
    box(390, 440, 400, 24),
    box(1000, 440, 280, 24),
    box(1480, 440, 180, 24),
  ],
  cargo: [load(580, 840, 560, 3), load(1390, 1130, 565, 7)],
  spawns: [
    ground('charger', 1180),
    ground('shooter', 450, 650),
    air('skimmer', 950, 250),
    ground('borer', 1350),
    ground('shooter', 1540, 440, 'twin'),
    air('sifter', 1390, 270),
    air('flyer', 840, 230, 'volatile'),
    ...pair(ground('runner', 900, 740, 'shielded'), ground('sniper', 650, 440)),
  ],
};
const GANTRY: Plan = {
  id: 'ot-scrap-highline',
  name: 'Scrap highline',
  solids: [
    box(410, 650, 110, 90),
    box(970, 650, 110, 90),
    box(1500, 650, 110, 90),
    box(400, 390, 170, 22),
    box(980, 320, 180, 22),
    box(1490, 400, 180, 22),
  ],
  cargo: [load(680, 880, 410, 3), load(1340, 1150, 430, 6), load(1630, 1380, 535, 10)],
  spawns: [
    ground('charger', 1190),
    ground('shooter', 480, 390),
    air('skimmer', 950, 220),
    ground('borer', 1360),
    ground('shooter', 1060, 320, 'twin'),
    air('sifter', 1520, 280),
    air('flyer', 680, 240, 'volatile'),
    ...pair(ground('runner', 900, 740, 'shielded'), ground('sniper', 1570, 400)),
  ],
};
const SORTER: Plan = {
  id: 'separation-chamber',
  name: 'Overtime separation line',
  solids: [
    box(390, 650, 130, 90),
    box(970, 640, 120, 100),
    box(1500, 650, 130, 90),
    box(420, 430, 180, 22),
    box(1450, 430, 180, 22),
  ],
  cargo: [load(700, 890, 440, 4), load(1290, 1150, 440, 9)],
  spawns: [
    air('sorter', 1490, 240),
    air('sifter', 990, 220),
    air('skimmer', 1110, 260),
    air('flyer', 450, 240),
  ],
};
const RECLAIMER: Plan = {
  id: 'core',
  name: 'Overtime salvage vault',
  solids: [
    box(400, 650, 120, 90),
    box(860, 630, 280, 110),
    box(1500, 650, 120, 90),
    box(420, 410, 230, 22),
    box(1380, 410, 230, 22),
  ],
  cargo: [load(710, 850, 495, 4), load(1280, 1160, 490, 8), load(1160, 930, 320, 12)],
  spawns: [
    air('boss', 1490, 240),
    air('sifter', 940, 220),
    air('skimmer', 1090, 230),
    air('flyer', 460, 240),
  ],
};

export function remixReclamation(base: Level, stage: number, route?: RouteChoice | null): Level {
  const plan = structuredClone(
    stage === 12
      ? SORTING
      : stage === 13
        ? TRANSFER
        : stage === 14
          ? route === 'high'
            ? GANTRY
            : SERVICE
          : base.spawns[0].kind === 'sorter'
            ? SORTER
            : RECLAIMER,
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
    id: stage === 15 ? base.id : plan.id,
    name: plan.name,
    area: 'reclamation',
    boss: stage === 15,
    mirrored,
    overtimeReclamation: true,
    ...(route ? { routeChoice: route } : {}),
    solids,
    route: path,
    hazards: [],
    magnets: [],
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      weak: [],
      props: [{ kind: 'crate', x: x(350), y: 717 }],
      cargo: plan.cargo.map((p) => ({
        ...p,
        x: x(p.x),
        transport: { ...p.transport!, toX: x(p.transport!.toX) },
      })),
    },
  };
}
