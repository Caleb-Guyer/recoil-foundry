import type { Layout } from './levels.ts';

export const LOADER_ARENA: Layout = {
  id: 'loader-bay',
  area: 'docks',
  name: 'Loader bay',
  solids: [
    { x: 520, y: 660, w: 140, h: 80 },
    { x: 1250, y: 660, w: 140, h: 80 },
    { x: 820, y: 495, w: 200, h: 22 },
    { x: 350, y: 405, w: 200, h: 22 },
    { x: 1430, y: 405, w: 200, h: 22 },
  ],
  spawns: [{ kind: 'loader', x: 1470, y: 705 }],
  route: [
    { x: 300, y: 720 },
    { x: 590, y: 640 },
    { x: 900, y: 720 },
    { x: 1320, y: 640 },
    { x: 1600, y: 720 },
    { x: 1800, y: 720 },
  ],
  setpiece: {
    rosters: [[0], [0], [0]],
    weak: [0, 1],
    props: [
      { kind: 'crate', x: 420, y: 717 },
      { kind: 'canister', x: 1690, y: 720 },
    ],
    // Both fall shafts miss permanent shelves, barriers, exits and spawn hulls.
    cargo: [
      { x: 730, y: 450, anchorY: 110 },
      { x: 1180, y: 450, anchorY: 110 },
    ],
  },
};
