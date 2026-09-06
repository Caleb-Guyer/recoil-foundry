import type { Level, Solid } from './levels.ts';
import type { HazardPlacement } from './hazard-layouts.ts';

export const ESCAPE_WIDTH = 7400;
export const EXTRACTION = { x: ESCAPE_WIDTH - 150, y: 700, w: 150, h: 20 };

const block = (x: number, w: number, h: number): Solid => ({ x, y: 740 - h, w, h });
const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 18 });

// Three groups of rooftop machinery, separated by open ground. The upper route
// is a recoil shortcut; every collapsing section has permanent safe floor below.
export const ESCAPE_LAYOUT: Level = {
  id: 'last-flight',
  name: 'Extraction route',
  area: 'rooftops',
  mirrored: false,
  boss: false,
  spawns: [],
  solids: [
    block(660, 180, 80),
    block(1200, 200, 120),
    block(1760, 180, 90),
    shelf(890, 460, 220),
    shelf(1740, 405, 230),

    block(2920, 180, 85),
    block(3460, 220, 130),
    block(4020, 180, 95),
    shelf(3060, 420, 220),
    shelf(3780, 365, 240),

    block(5160, 180, 90),
    block(5700, 220, 120),
    block(6280, 180, 75),
    shelf(5350, 425, 220),
    shelf(6000, 355, 260),
  ],
  route: [
    { x: 400, y: 720 },
    { x: 750, y: 640 },
    { x: 1030, y: 720 },
    { x: 1300, y: 600 },
    { x: 1560, y: 720 },
    { x: 1850, y: 630 },
    { x: 2440, y: 720 },
    { x: 3010, y: 635 },
    { x: 3260, y: 720 },
    { x: 3570, y: 590 },
    { x: 3840, y: 720 },
    { x: 4110, y: 625 },
    { x: 4670, y: 720 },
    { x: 5250, y: 630 },
    { x: 5520, y: 720 },
    { x: 5810, y: 600 },
    { x: 6110, y: 720 },
    { x: 6370, y: 645 },
    { x: 6860, y: 720 },
    { x: EXTRACTION.x, y: EXTRACTION.y - 18 },
  ],
};

export const ESCAPE_PLATFORMS: HazardPlacement[] = [
  { kind: 'crumble', x: 1050, y: 590, w: 160, h: 18, travel: 0 },
  { kind: 'crumble', x: 1490, y: 495, w: 150, h: 18, travel: 0 },
  { kind: 'crumble', x: 3240, y: 560, w: 170, h: 18, travel: 0 },
  { kind: 'crumble', x: 3790, y: 515, w: 160, h: 18, travel: 0 },
  { kind: 'crumble', x: 5500, y: 560, w: 170, h: 18, travel: 0 },
  { kind: 'crumble', x: 6110, y: 495, w: 170, h: 18, travel: 0 },
];
