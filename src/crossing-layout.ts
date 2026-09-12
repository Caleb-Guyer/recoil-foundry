import type { Layout, Level, Spawn } from './levels.ts';
import { seeded } from './rules.ts';

export const CROSSING = {
  width: 260,
  height: 104,
  top: 636,
  gap: 150,
  speed: 240,
  tell: 2.4,
  rest: 4,
};
const spawns: Spawn[] = [
  { kind: 'charger', x: 660, y: 723 },
  { kind: 'shooter', x: 780, y: 448 },
  { kind: 'flyer', x: 1040, y: 280 },
  { kind: 'runner', x: 1440, y: 723 },
  { kind: 'shooter', x: 1320, y: 448 },
  { kind: 'flyer', x: 580, y: 300 },
  { kind: 'runner', x: 1000, y: 723 },
  { kind: 'shooter', x: 510, y: 448 },
  { kind: 'flyer', x: 1470, y: 310 },
];
export const CROSSING_LAYOUT: Layout = {
  id: 'freight-crossing',
  name: 'Freight crossing',
  area: 'docks',
  crossing: true,
  // The floor stays open. These permanent steps can be reached with an ordinary jump.
  solids: [
    { x: 240, y: 574, w: 150, h: 22 },
    { x: 460, y: 464, w: 470, h: 22 },
    { x: 1000, y: 464, w: 540, h: 22 },
    { x: 1610, y: 574, w: 150, h: 22 },
  ],
  setpiece: {
    rosters: [
      [0, 1, 2, 3],
      [0, 4, 5, 6],
      [2, 3, 6, 7],
    ],
    props: [
      { kind: 'crate', x: 810, y: 718 },
      { kind: 'crate', x: 1170, y: 718 },
      { kind: 'canister', x: 1290, y: 721 },
    ],
    weak: [],
  },
  spawns,
  route: [
    { x: 310, y: 556 },
    { x: 530, y: 446 },
    { x: 820, y: 446 },
    { x: 1170, y: 446 },
    { x: 1470, y: 446 },
    { x: 1690, y: 556 },
    { x: 1850, y: 722 },
  ],
};
export function crossingLevel(seed: string, stage: number): Level | undefined {
  if (![1, 13].includes(stage) || seeded(seed + ':crossing:' + stage)() >= 0.3) return;
  if (stage === 13 && seeded(seed + ':crossing:1')() < 0.3) return;
  const mirrored = seeded(seed + ':crossing-mirror:' + stage)() > 0.5;
  const flip = (x: number) => (mirrored ? 2000 - x : x);
  const variant = Math.floor(seeded(seed + ':crossing-roster:' + stage)() * 3);
  const roster =
    stage === 1
      ? CROSSING_LAYOUT.setpiece!.rosters[variant]
      : [
          [0, 1, 2, 3, 4, 5, 6, 8],
          [0, 1, 2, 3, 5, 6, 7, 8],
          [0, 2, 3, 4, 5, 6, 7, 8],
        ][variant];
  const lateKinds: Spawn['kind'][] = [
    'borer',
    'sniper',
    'sifter',
    'charger',
    'shooter',
    'skimmer',
    'hopper',
    'sniper',
    'flyer',
  ];
  return {
    ...CROSSING_LAYOUT,
    area: stage === 13 ? 'reclamation' : 'docks',
    boss: false,
    mirrored,
    solids: CROSSING_LAYOUT.solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns: roster.map((i) => ({
      ...spawns[i],
      x: flip(spawns[i].x),
      kind: stage === 13 ? lateKinds[i] : spawns[i].kind,
    })),
    setpiece: {
      rosters: [roster.slice()],
      weak: [],
      props: CROSSING_LAYOUT.setpiece!.props.map((p) => ({ ...p, x: flip(p.x) })),
    },
    route: CROSSING_LAYOUT.route.map((p) => ({ ...p, x: flip(p.x) })).sort((a, b) => a.x - b.x),
  };
}
