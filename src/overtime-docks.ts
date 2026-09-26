import type { Level, Solid, Spawn } from './levels.ts';
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
const pair = (kind: 'shield' | 'flank' | 'ambush', lead: Spawn, support: Spawn): Spawn[] => [
  { ...lead, squad: { kind, role: 'lead' } },
  { ...support, squad: { kind, role: 'support' } },
];
type Plan = Pick<Level, 'id' | 'name' | 'solids' | 'spawns' | 'hazards' | 'counterweights'> & {
  cargo?: { x: number; y: number; anchorY: number }[];
  weak?: number[];
};
// Every doorway, prop and full machinery sweep is reserved together. All rooms
// retain a floor route; elevated shortcuts never require a particular gun.
const TRANSFER: Plan = {
  id: 'ot-transfer-lock',
  name: 'Transfer lock',
  solids: [
    box(350, 480, 220, 22),
    box(590, 650, 120, 90),
    box(1330, 430, 220, 22),
    box(1550, 660, 130, 80),
  ],
  hazards: [{ kind: 'lift', x: 980, y: 650, w: 200, h: 22, travel: 180 }],
  spawns: [
    ground('charger', 780),
    air('skimmer', 840, 300),
    ground('sniper', 450, 480),
    air('sifter', 1190, 285),
    ground('shooter', 1440, 430, 'twin'),
    ground('hopper', 1610, 660),
    air('flyer', 1510, 260),
    ...pair('shield', ground('runner', 1110, 740, 'shielded'), ground('shooter', 1270)),
  ],
};
const STAMPING: Plan = {
  id: 'ot-stamping-aisle',
  name: 'Stamping aisle',
  solids: [
    box(460, 650, 120, 90),
    box(650, 470, 190, 22),
    box(1150, 450, 170, 22),
    box(1340, 650, 120, 90),
  ],
  hazards: [{ kind: 'crusher', x: 980, y: 400, w: 126, h: 32, travel: 308 }],
  spawns: [
    ground('charger', 760),
    air('skimmer', 730, 300),
    ground('shooter', 520, 650),
    ground('runner', 620, 740, 'shielded'),
    ground('shooter', 1400, 650, 'twin'),
    ground('hopper', 1580),
    air('sifter', 1550, 320),
    ...pair('flank', ground('sniper', 1230, 450), air('flyer', 1320, 260)),
  ],
};
const DISPATCH: Plan = {
  id: 'ot-broken-dispatch',
  name: 'Broken dispatch',
  solids: [
    box(410, 440, 230, 22),
    box(580, 660, 100, 80),
    box(1400, 400, 230, 22),
    box(1470, 660, 100, 80),
  ],
  cargo: [
    { x: 820, y: 390, anchorY: 110 },
    { x: 1190, y: 390, anchorY: 110 },
  ],
  spawns: [
    ground('charger', 970),
    ground('shooter', 520, 440, 'twin'),
    air('skimmer', 660, 295),
    ground('runner', 730, 740, 'shielded'),
    ground('shooter', 1100),
    air('sifter', 1450, 270),
    ground('borer', 1600),
    ...pair('ambush', ground('sniper', 1520, 400), ground('hopper', 1300)),
  ],
};
const GANTRY: Plan = {
  id: 'ot-counterweight-gantry',
  name: 'Counterweight gantry',
  solids: [
    box(430, 650, 120, 90),
    box(620, 430, 190, 22),
    box(1410, 430, 190, 22),
    box(1440, 650, 120, 90),
  ],
  counterweights: [{ x: 1040, y: 540, w: 340 }],
  spawns: [
    ground('charger', 730),
    air('skimmer', 870, 270),
    ground('shooter', 490, 650, 'twin'),
    ground('runner', 1180, 740, 'shielded'),
    ground('borer', 1330),
    air('sifter', 1520, 300),
    ground('sniper', 1520, 430),
    ...pair('flank', ground('shooter', 720, 430), air('flyer', 1170, 310)),
  ],
};
const LOADER: Plan = {
  // Retain the arena identity so the finite support-collapse system is reused.
  id: 'loader-bay',
  name: 'Overtime loading bay',
  solids: [
    box(590, 650, 100, 90),
    box(1240, 650, 100, 90),
    box(340, 390, 200, 22),
    box(960, 460, 200, 22),
    box(1480, 380, 180, 22),
  ],
  cargo: [
    { x: 800, y: 390, anchorY: 110 },
    { x: 1410, y: 390, anchorY: 110 },
  ],
  weak: [0, 1],
  spawns: [
    ground('loader', 1550),
    air('sifter', 950, 260),
    air('skimmer', 1150, 285),
    air('flyer', 610, 260),
  ],
};
const CRANE: Plan = {
  id: 'crane-bay',
  name: 'Overtime crane gantry',
  solids: [
    box(440, 650, 140, 90),
    box(1400, 650, 150, 90),
    box(700, 450, 160, 22),
    box(1160, 390, 180, 22),
  ],
  counterweights: [{ x: 1000, y: 605, w: 260 }],
  spawns: [
    air('crane', 1450, 150),
    air('sifter', 950, 260),
    air('skimmer', 1220, 285),
    air('flyer', 610, 260),
  ],
};

export function remixDocks(base: Level, stage: number, route?: RouteChoice | null): Level {
  const source =
    stage === 0
      ? TRANSFER
      : stage === 1
        ? STAMPING
        : stage === 2
          ? route === 'high'
            ? GANTRY
            : DISPATCH
          : base.spawns[0].kind === 'loader'
            ? LOADER
            : CRANE;
  const plan = structuredClone(source),
    mirror = base.mirrored;
  const x = (n: number) => (mirror ? 2000 - n : n);
  const solids = plan.solids.map((s) => ({ ...s, x: mirror ? 2000 - s.x - s.w : s.x }));
  // Low obstacles have jumpable tops. A permanent floor runs beneath all gaps.
  const waypoints = solids.filter((s) => s.y + s.h === 740).sort((a, b) => a.x - b.x);
  const path = [{ x: 280, y: 720 }];
  for (const s of waypoints)
    path.push(
      { x: s.x - 55, y: 720 },
      { x: s.x + s.w / 2, y: s.y - 20 },
      { x: s.x + s.w + 55, y: 720 },
    );
  path.push({ x: 1810, y: 720 });
  return {
    id: plan.id,
    name: plan.name,
    area: 'docks',
    boss: stage === 3,
    mirrored: mirror,
    overtimeDocks: true,
    ...(route ? { routeChoice: route } : {}),
    solids,
    route: path,
    spawns: plan.spawns.map((s) => ({ ...s, x: x(s.x) })),
    hazards: (plan.hazards ?? []).map((h) => ({ ...h, x: x(h.x) })),
    counterweights: (plan.counterweights ?? []).map((c) => ({ ...c, x: x(c.x) })),
    setpiece: {
      rosters: [plan.spawns.map((_, i) => i)],
      weak: plan.weak ?? [],
      props: [{ kind: 'crate', x: x(350), y: 717 }],
      cargo: (plan.cargo ?? []).map((c) => ({ ...c, x: x(c.x) })),
    },
  };
}
