import type { Layout, Solid } from './levels.ts';
import { seeded } from './rules.ts';

export const FREIGHT = {
  top: -1350,
  start: 700,
  dock: -920,
  x: 1000,
  w: 720,
  h: 26,
  speed: 42,
  tell: 1,
};
export const FREIGHT_STOPS = [520, -20, -560];
export const freightSelected = (seed: string, stage: number) =>
  stage === 5 && seeded(seed + ':freight')() < 0.22;
const ledges: Solid[] = [];
for (let y = 700; y >= -920; y -= 180) {
  ledges.push({ x: 300, y, w: y === 340 ? 160 : 280, h: 22 });
  if (y !== -920) ledges.push({ x: y === -200 ? 1540 : 1420, y, w: y === -200 ? 160 : 280, h: 22 });
}
export const FREIGHT_LAYOUT: Layout = {
  id: 'freight-shaft',
  name: 'Freight shaft',
  area: 'furnace',
  freight: true,
  solids: [...ledges, { x: 1360, y: FREIGHT.dock, w: 640, h: 80 }],
  spawns: [
    { kind: 'runner', x: 530, y: 503 },
    { kind: 'shooter', x: 1510, y: 504 },
    { kind: 'hopper', x: 1470, y: -37 },
    { kind: 'shooter', x: 490, y: -36 },
    { kind: 'flyer', x: 1170, y: -170 },
    { kind: 'runner', x: 510, y: -577 },
    { kind: 'shooter', x: 1510, y: -576 },
  ],
  route: [
    { x: 1000, y: 680 },
    { x: 1000, y: -940 },
    { x: 1900, y: -940 },
  ],
};
