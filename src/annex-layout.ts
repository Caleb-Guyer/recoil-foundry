import type { Level } from './levels.ts';
import type { Checkpoint, Vec } from './rules.ts';

export interface AnnexPreview {
  mirror: boolean;
  spoof: boolean;
}
export const ANNEX_BUILDS = {
  gun: ['magnum', 'light', 'kick'],
  beam: ['cutting-torch', 'light', 'kick'],
  shell: ['shellshock', 'light', 'kick'],
} as const;
export function annexTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let valid = p.get('test') === 'annex';
  p.forEach((_, k) => {
    if (!['test', 'build', 'mirror', 'spoof'].includes(k) || p.getAll(k).length !== 1)
      valid = false;
  });
  if (!valid) return null;
  const build = p.get('build') ?? 'gun';
  if (
    !Object.hasOwn(ANNEX_BUILDS, build) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!)) ||
    (p.has('spoof') && !['0', '1'].includes(p.get('spoof')!))
  )
    return null;
  return {
    version: 6,
    seed: 'ANNEX-PROTOTYPE-' + build.toUpperCase(),
    stage: 8,
    hp: 100,
    kills: 0,
    elapsed: 0,
    mods: [...ANNEX_BUILDS[build as keyof typeof ANNEX_BUILDS]],
    annex: { mirror: p.get('mirror') === '1', spoof: p.get('spoof') !== '0' },
  };
}
export const annexPoint = (mirrored: boolean, p: Vec): Vec => ({
  x: mirrored ? 2000 - p.x : p.x,
  y: p.y,
});
export const ANNEX_JUNCTION = { x: 920, y: 460 };
export const ANNEX_PORT = { x: 1320, y: 285 };
export function annexLevel(preview: AnnexPreview): Level {
  const mirrored = preview.mirror;
  const solids = [
    { x: 380, y: 660, w: 155, h: 80 },
    { x: 550, y: 553, w: 165, h: 22 },
    { x: 810, y: 502, w: 225, h: 22 },
    { x: 1195, y: 600, w: 190, h: 22 },
    { x: 1515, y: 650, w: 145, h: 90 },
    { x: 1660, y: 455, w: 160, h: 22 },
  ];
  return {
    id: 'annex-broadcast-floor',
    name: 'Transmission Annex',
    area: 'cooling',
    annex: true,
    mirrored,
    boss: false,
    hazards: [],
    solids: solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns: [
      { kind: 'shooter' as const, x: 615, y: 536 },
      { kind: 'runner' as const, x: 790, y: 723 },
      { kind: 'switchman' as const, x: 1250, y: 722 },
      { kind: 'runner' as const, x: 1460, y: 723 },
      { kind: 'shooter' as const, x: 1280, y: 583 },
      { kind: 'flyer' as const, x: 1510, y: 365 },
    ].map((s) => ({ ...s, ...annexPoint(mirrored, s) })),
    route: [
      [285, 720],
      [455, 640],
      [630, 535],
      [915, 484],
      [1120, 720],
      [1285, 580],
      [1470, 720],
      [1585, 630],
      [1810, 720],
    ].map(([x, y]) => annexPoint(mirrored, { x, y })),
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'crate', ...annexPoint(mirrored, { x: 1125, y: 717 }) },
        { kind: 'cover', ...annexPoint(mirrored, { x: 1450, y: 696 }) },
      ],
    },
  };
}
