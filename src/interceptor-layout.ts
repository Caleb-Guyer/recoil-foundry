import type { Layout } from './levels.ts';

export const INTERCEPTOR_ARENA: Layout = {
  id: 'relay-roof',
  name: 'Relay roof',
  area: 'rooftops',
  solids: [
    { x: 440, y: 650, w: 160, h: 90 },
    { x: 620, y: 480, w: 220, h: 22 },
    { x: 1030, y: 660, w: 140, h: 80 },
    { x: 1220, y: 430, w: 250, h: 22 },
    { x: 1540, y: 640, w: 160, h: 100 },
  ],
  spawns: [{ kind: 'interceptor', x: 1450, y: 300 }],
  route: [
    { x: 300, y: 720 },
    { x: 520, y: 630 },
    { x: 850, y: 720 },
    { x: 1100, y: 640 },
    { x: 1340, y: 720 },
    { x: 1620, y: 620 },
    { x: 1820, y: 720 },
  ],
};
