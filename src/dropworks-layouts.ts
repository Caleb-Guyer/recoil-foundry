import type { Layout, Solid, Spawn } from './levels.ts';
import { seeded } from './rules.ts';

// The two permanent stairways meet above open shafts. Only the two short
// crate shelves can break; neither is needed to climb or reach the exit.
const stairs = (): Solid[] => [
  { x: 260, y: 640, w: 140, h: 100 },
  { x: 430, y: 525, w: 145, h: 22 },
  { x: 610, y: 410, w: 145, h: 22 },
  { x: 780, y: 295, w: 140, h: 22 },
  { x: 950, y: 215, w: 100, h: 22 },
  { x: 1110, y: 295, w: 140, h: 22 },
  { x: 1290, y: 410, w: 145, h: 22 },
  { x: 1470, y: 525, w: 145, h: 22 },
  { x: 1650, y: 640, w: 130, h: 100 },
  { x: 790, y: 540, w: 150, h: 22 },
  { x: 1110, y: 540, w: 140, h: 22 },
];
const anchors = (): Spawn[] => [
  { kind: 'shooter', x: 1000, y: 199 },
  { kind: 'shooter', x: 685, y: 394 },
  { kind: 'shooter', x: 1180, y: 279 },
  { kind: 'runner', x: 865, y: 723 },
  { kind: 'runner', x: 1180, y: 723 },
  { kind: 'flyer', x: 1065, y: 400 },
  { kind: 'flyer', x: 1430, y: 300 },
  { kind: 'wallcrawler', x: 850, y: 334 },
  { kind: 'runner', x: 510, y: 723 },
  { kind: 'flyer', x: 560, y: 340 },
  { kind: 'shooter', x: 850, y: 279 },
  { kind: 'runner', x: 1450, y: 723 },
  { kind: 'wallcrawler', x: 1180, y: 334 },
  { kind: 'flyer', x: 520, y: 270 },
  { kind: 'runner', x: 1050, y: 723 },
];
const climb = () =>
  [
    [220, 720],
    [330, 620],
    [500, 505],
    [680, 390],
    [850, 275],
    [1000, 195],
    [1180, 275],
    [1360, 390],
    [1540, 505],
    [1715, 620],
    [1840, 720],
  ].map(([x, y]) => ({ x, y }));
const loads = () => [
  { kind: 'crate' as const, x: 865, y: 517 },
  { kind: 'crate' as const, x: 1180, y: 517 },
];
export const DROPWORKS_LAYOUTS: Layout[] = [
  {
    id: 'dropworks',
    name: 'The Dropworks',
    area: 'cooling',
    solids: stairs(),
    spawns: anchors(),
    route: climb(),
    hazards: [],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 8],
        [0, 1, 2, 3, 4, 5, 9, 7, 11],
        [0, 10, 2, 3, 4, 9, 6, 7, 8],
      ],
      props: loads(),
      weak: [9, 10],
    },
  },
  {
    id: 'dropworks-roof',
    name: 'Dropworks Roof',
    area: 'rooftops',
    solids: stairs(),
    spawns: anchors(),
    route: climb(),
    // Each lift travels in an open slot. Fixed stairs remain reachable at
    // every phase, including after all optional cover has been destroyed.
    hazards: [
      { kind: 'lift', x: 990, y: 645, w: 100, h: 22, travel: 265 },
      { kind: 'lift', x: 1375, y: 645, w: 110, h: 22, travel: 145 },
    ],
    setpiece: {
      rosters: [
        [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12],
        [0, 1, 2, 3, 4, 5, 6, 7, 13, 10, 14, 12],
        [0, 1, 2, 3, 4, 9, 6, 7, 13, 10, 11, 12],
      ],
      props: loads(),
      weak: [9, 10],
    },
  },
];
export function dropworksLayout(seed: string, stage: number) {
  if (![9, 17].includes(stage) || seeded(seed + ':dropworks-room:' + stage)() >= 0.6) return;
  return DROPWORKS_LAYOUTS[stage === 9 ? 0 : 1];
}
