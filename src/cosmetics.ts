import type { CommendationId } from './commendations.ts';

export const COSMETICS_KEY = 'rf-cosmetics-v1';
export const GUN_FINISHES = {
  coldsteel: {
    name: 'Cold Steel',
    shell: '#b1c4c8',
    face: '#e4efde',
    trim: '#514963',
    light: '#a6e9d4',
    unlock: 'remix-gauntlet-unserviced',
  },
  beltline: {
    name: 'Beltline',
    shell: '#bd9955',
    face: '#e8ce83',
    trim: '#394f44',
    light: '#c0eed1',
    unlock: 'beltline-certified',
  },
  lodestone: {
    name: 'Lodestone',
    shell: '#72518e',
    face: '#cfb0dc',
    trim: '#314c55',
    light: '#b9edf1',
    unlock: 'magnetic-certified',
  },
  heatline: {
    name: 'Heatline',
    shell: '#8d443d',
    face: '#e6aa6e',
    trim: '#402d31',
    light: '#ffe2a4',
    unlock: 'relay-race',
  },
  reservoir: {
    name: 'Reservoir',
    shell: '#51446e',
    face: '#bda16b',
    trim: '#30283d',
    light: '#f4db96',
    unlock: 'stored-energy',
  },
  copperline: {
    name: 'Copperline',
    shell: '#735b42',
    face: '#9de4d8',
    trim: '#d4aa73',
    light: '#baf1e7',
    unlock: 'cable-cut',
  },
  fusekeeper: {
    name: 'Fusekeeper',
    shell: '#986f48',
    face: '#edbd86',
    trim: '#3f5156',
    light: '#f7d8a3',
    unlock: 'fuse-pulled',
  },
  aeronaut: {
    name: 'Aeronaut',
    shell: '#476e78',
    face: '#cde5df',
    trim: '#d9b975',
    light: '#dcf3e1',
    unlock: 'launch-certified',
  },
  transit: {
    name: 'Transit',
    shell: '#a88e56',
    face: '#ebd6a3',
    trim: '#394e52',
    light: '#f0e4be',
    unlock: 'cargo-certified',
  },
  standard: {
    name: 'Standard issue',
    shell: '#819b89',
    face: '#e1e5d0',
    trim: '#556e5c',
    light: '#adbea3',
    unlock: null,
  },
  inspector: {
    name: 'Inspector',
    shell: '#d9d9c9',
    face: '#fbf3de',
    trim: '#826b47',
    light: '#d8b678',
    unlock: 'clean-work',
  },
  mirror: {
    name: 'Mirror',
    shell: '#a1b9ca',
    face: '#dfedf3',
    trim: '#506981',
    light: '#ffffff',
    unlock: 'return-to-sender',
  },
  ledger: {
    name: 'Red Ledger',
    shell: '#424440',
    face: '#bb9176',
    trim: '#563b33',
    light: '#efd2a4',
    unlock: 'closed-account',
  },
  kiln: {
    name: 'Kiln',
    shell: '#454e4d',
    face: '#75817a',
    trim: '#303b3b',
    light: '#eeb16e',
    unlock: 'hot-work',
  },
  caution: {
    name: 'Caution',
    shell: '#c5a35f',
    face: '#efcf80',
    trim: '#303b39',
    light: '#f5e5ab',
    unlock: 'unsafe-load',
  },
  carom: {
    name: 'Carom',
    shell: '#466953',
    face: '#b5c5a5',
    trim: '#caab69',
    light: '#e6d5a2',
    unlock: 'bank-job',
  },
  airmail: {
    name: 'Airmail',
    shell: '#607e9b',
    face: '#d9e4df',
    trim: '#374c67',
    light: '#ebf3df',
    unlock: 'air-traffic',
  },
  waybill: {
    name: 'Waybill',
    shell: '#71677e',
    face: '#d8cab1',
    trim: '#423a50',
    light: '#ece1ce',
    unlock: 'special-delivery',
  },
} as const;
export const OUTFITS = {
  circuitrunner: {
    name: 'Circuit Runner',
    body: '#518e91',
    boots: '#344d66',
    trim: '#f1c88e',
    unlock: 'remix-gauntlet-cleared',
  },
  highrise: {
    name: 'Highrise',
    body: '#6089ba',
    boots: '#3b526f',
    trim: '#d7eee5',
    unlock: 'skybridge-certified',
  },
  signalkeeper: {
    name: 'Signalkeeper',
    body: '#945e68',
    boots: '#4d414e',
    trim: '#f4ce8e',
    unlock: 'crossfire-certified',
  },
  patchwork: {
    name: 'Patchwork',
    body: '#7d8b69',
    boots: '#4d6063',
    trim: '#c5e1bb',
    unlock: 'scrap-certified',
  },
  sentinel: {
    name: 'Sentinel',
    body: '#6a8875',
    boots: '#354d46',
    trim: '#dce5b9',
    unlock: 'plate-breaker',
  },
  victor: {
    name: 'Victor',
    body: '#597c72',
    boots: '#384a49',
    trim: '#efcb7a',
    unlock: 'gauntlet-cleared',
  },
  skyline: {
    name: 'Skyline',
    body: '#748e9b',
    boots: '#3b545d',
    trim: '#ead9a8',
    unlock: 'flight-certified',
  },
  redline: {
    name: 'Redline',
    body: '#68716f',
    boots: '#a5b4ad',
    trim: '#f4d6a4',
    unlock: 'redline',
  },
  standard: { name: 'Workwear', body: '#e7e8db', boots: '#a6b4ae', trim: '#9bcfc1', unlock: null },
  rigger: {
    name: 'Rigger',
    body: '#c8a968',
    boots: '#8e8777',
    trim: '#ffe4a1',
    unlock: 'heavy-equipment',
  },
  night: {
    name: 'Night Shift',
    body: '#828bad',
    boots: '#b4bdd3',
    trim: '#e8e6fc',
    unlock: 'after-hours',
  },
  forgehand: {
    name: 'Forgehand',
    body: '#b08d6f',
    boots: '#828f86',
    trim: '#e4a369',
    unlock: 'hot-work',
  },
  servicewear: {
    name: 'Servicewear',
    body: '#70968c',
    boots: '#3e5452',
    trim: '#e5dcae',
    unlock: 'maintenance-certified',
  },
  operator: {
    name: 'Operator',
    body: '#8aaeb9',
    boots: '#536e7a',
    trim: '#f0e3b9',
    unlock: 'clearance',
  },
} as const;
export interface Cosmetics {
  gun: keyof typeof GUN_FINISHES;
  outfit: keyof typeof OUTFITS;
}
export function loadCosmetics(raw: unknown, earned: readonly CommendationId[]): Cosmetics {
  const value = raw as Partial<Cosmetics> | null;
  const gun = Object.entries(GUN_FINISHES).find(
    ([id, f]) => id === value?.gun && (!f.unlock || earned.includes(f.unlock)),
  );
  const outfit = Object.entries(OUTFITS).find(
    ([id, f]) => id === value?.outfit && (!f.unlock || earned.includes(f.unlock)),
  );
  return {
    gun: (gun?.[0] ?? 'standard') as Cosmetics['gun'],
    outfit: (outfit?.[0] ?? 'standard') as Cosmetics['outfit'],
  };
}
// Identical body silhouette and bright visor in every outfit; cosmetic markings
// never cover weapon charge indicators or change hostile projectile colours.
export function drawOutfit(
  c: CanvasRenderingContext2D,
  id: Cosmetics['outfit'],
  facing: number,
  stride: number,
) {
  const p = OUTFITS[id];
  c.fillStyle = p.body;
  c.beginPath();
  c.roundRect(-13, -18, 26, 31, 4);
  c.fill();
  if (id === 'patchwork') {
    c.fillStyle = '#3f596b';
    c.fillRect(-11, -1, 10, 12);
    c.fillRect(5, 4, 7, 8);
    c.fillRect(-10, -16, 8, 4);
    c.fillStyle = p.trim;
    c.fillRect(2, -1, 9, 4);
    c.fillRect(-8, 5, 5, 4);
    c.fillStyle = '#283e40';
    for (const [x, y] of [
      [-10, 0],
      [-2, 0],
      [-10, 10],
      [6, 5],
      [10, 10],
      [3, 0],
    ])
      c.fillRect(x, y, 1.5, 1.5);
  } else if (id === 'victor') {
    c.fillStyle = '#304a47';
    c.fillRect(-10, -1, 20, 13);
    c.fillStyle = p.trim;
    c.fillRect(-11, 0, 3, 5);
    c.fillRect(8, 0, 3, 5);
    for (let i = 0; i < 5; i++) c.fillRect(-7 + i * 3, 7, 2, 3);
  } else if (id === 'skyline') {
    c.fillStyle = '#3b545d';
    c.fillRect(-10, 0, 20, 12);
    c.fillStyle = p.trim;
    c.fillRect(-12, -2, 24, 3);
    c.fillRect(-9, 4, 3, 8);
    c.fillRect(6, 4, 3, 8);
    c.fillStyle = '#dbe7e3';
    c.fillRect(facing > 0 ? 6 : -11, -15, 5, 2);
  } else if (id === 'redline') {
    c.fillStyle = '#293b3c';
    c.fillRect(-10, 0, 20, 13);
    c.fillStyle = '#c99972';
    c.fillRect(-7, 0, 2, 13);
    c.fillRect(5, 0, 2, 13);
    c.fillStyle = '#eff1df';
    c.fillRect(-12, -1, 7, 3);
    c.fillRect(5, -1, 7, 3);
    c.fillStyle = '#aa594a';
    c.fillRect(-7, -2, 14, 2);
  } else if (id === 'forgehand') {
    // Scorched leather, copper stitching and a raised welding shield all stay
    // inside the shared silhouette. The eye slit below remains readable.
    c.fillStyle = '#625748';
    c.fillRect(-12, 0, 6, 12);
    c.fillRect(7, 4, 5, 8);
    c.fillRect(-2, -1, 3, 14);
    c.fillStyle = p.trim;
    c.fillRect(-9, 1, 2, 7);
    c.fillRect(6, 0, 4, 2);
    c.fillStyle = '#364343';
    c.fillRect(-11, -17, 22, 6);
    c.fillStyle = '#81918a';
    c.fillRect(-8, -16, 16, 2);
    c.fillStyle = p.trim;
    c.fillRect(facing > 0 ? 9 : -11, -14, 2, 4);
  } else if (id === 'operator') {
    c.fillStyle = '#405c6a';
    c.fillRect(-10, 0, 20, 12);
    c.fillRect(-11, -16, 3, 10);
    c.fillRect(8, -16, 3, 10);
    c.fillStyle = p.trim;
    c.fillRect(-12, -1, 7, 3);
    c.fillRect(5, -1, 7, 3);
    c.fillRect(-1, 3, 2, 9);
    c.fillRect(facing > 0 ? 8 : -10, -7, 2, 6);
  } else if (id === 'servicewear') {
    c.fillStyle = '#405e57';
    c.fillRect(-10, -1, 20, 12);
    c.fillStyle = p.trim;
    c.fillRect(-12, 1, 24, 2);
    c.fillRect(-9, 6, 5, 3);
    c.fillRect(5, -16, 5, 3);
  } else if (id === 'rigger') {
    c.fillStyle = '#5a5141';
    c.fillRect(-10, -1, 4, 14);
    c.fillRect(6, -1, 4, 14);
    c.fillStyle = p.trim;
    c.fillRect(-12, 4, 24, 3);
  } else if (id === 'night') {
    c.strokeStyle = p.trim;
    c.lineWidth = 1.2;
    c.strokeRect(-12, -17, 24, 29);
    c.fillStyle = p.trim;
    c.fillRect(-10, 0, 3, 4);
    c.fillRect(-5, 0, 3, 4);
  }
  c.fillStyle = '#172125';
  c.fillRect(-8, -10, 16, 7);
  c.fillStyle = p.trim;
  c.fillRect(facing > 0 ? 3 : -6, -9, 3, 5);
  c.fillStyle = p.boots;
  c.fillRect(-10, 10, 7, 8 + stride);
  c.fillRect(3, 10, 7, 8 - stride);
}
export function drawFinishMark(c: CanvasRenderingContext2D, id: Cosmetics['gun'], heat = 0) {
  if (id === 'standard') return;
  const p = GUN_FINISHES[id];
  c.fillStyle = p.trim;
  if (id === 'heatline') {
    c.strokeStyle = p.light;
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(11, 2);
    c.lineTo(15, 2);
    c.lineTo(17, -2);
    c.lineTo(23, -2);
    c.stroke();
    c.fillStyle = p.light;
    c.fillRect(11, 1, 2, 2);
    c.fillRect(22, -3, 2, 2);
  } else if (id === 'reservoir') {
    c.fillStyle = p.trim;
    c.fillRect(11, -3, 13, 6);
    c.fillStyle = p.light;
    for (const x of [12, 16, 20]) c.fillRect(x, -2, 2.5, 4);
  } else if (id === 'carom') {
    c.fillRect(12, -3, 3, 6);
    c.fillRect(12, 1, 11, 2);
  } else if (id === 'airmail') {
    c.fillStyle = p.light;
    c.beginPath();
    c.moveTo(11, 2);
    c.lineTo(16, -3);
    c.lineTo(23, -3);
    c.lineTo(18, 2);
    c.closePath();
    c.fill();
    c.fillStyle = p.trim;
    c.fillRect(18, -2, 3, 1);
  } else if (id === 'waybill') {
    c.fillStyle = p.light;
    c.fillRect(11, -3, 13, 6);
    c.fillStyle = p.trim;
    c.fillRect(12, -1, 3, 2);
    c.fillRect(20, -1, 3, 2);
    c.fillRect(14, -2, 1, 4);
    c.fillRect(20, -2, 1, 4);
  } else if (id === 'caution') {
    // The narrow receiver panel leaves the sight and charge lamps unobscured.
    c.save();
    c.beginPath();
    c.rect(11, -3, 13, 6);
    c.clip();
    for (const x of [8, 14, 20, 26]) {
      c.beginPath();
      c.moveTo(x, -3);
      c.lineTo(x + 3, -3);
      c.lineTo(x - 1, 3);
      c.lineTo(x - 4, 3);
      c.closePath();
      c.fill();
    }
    c.restore();
  } else if (id === 'kiln') {
    c.fillRect(11, 1, 12, 3);
    c.fillStyle = '#a2937e';
    for (const x of [12, 16, 20]) c.fillRect(x, 2, 2, 1.5);
    if (heat > 0) {
      c.save();
      c.globalAlpha *= Math.min(1, heat);
      c.fillStyle = p.light;
      for (const x of [12, 16, 20]) c.fillRect(x, 2, 2, 1.5);
      c.restore();
    }
  } else if (id === 'ledger') {
    c.strokeStyle = p.light;
    c.lineWidth = 1;
    c.strokeRect(11, -3, 11, 5);
    c.fillRect(14, -2, 2, 3);
    c.fillRect(18, -2, 1, 3);
  } else if (id === 'inspector') {
    c.fillRect(17, -3, 1.5, 5);
    c.fillRect(21, -3, 1.5, 5);
  } else {
    c.fillStyle = p.light;
    c.beginPath();
    c.moveTo(17, -3);
    c.lineTo(22, -3);
    c.lineTo(18, 2);
    c.lineTo(13, 2);
    c.closePath();
    c.fill();
  }
}
