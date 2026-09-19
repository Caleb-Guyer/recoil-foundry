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
  if (id === 'rigger') {
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
export function drawFinishMark(c: CanvasRenderingContext2D, id: Cosmetics['gun']) {
  if (id === 'standard') return;
  const p = GUN_FINISHES[id];
  c.fillStyle = p.trim;
  if (id === 'inspector') {
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
