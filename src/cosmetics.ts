import type { CommendationId } from './commendations.ts';

export const COSMETICS_KEY = 'rf-cosmetics-v1';
export const GUN_FINISHES = {
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
} as const;
export const OUTFITS = {
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
  if (id === 'forgehand') {
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
  if (id === 'kiln') {
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
