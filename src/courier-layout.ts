import { getLevel, type Level, type Solid, type Spawn } from './levels.ts';
import type { AreaEventSave } from './area-events.ts';
import { rewardMods, seeded, type Checkpoint } from './rules.ts';

export const COURIER_STAGES = [4, 5, 8, 9, 12, 13, 16, 17];
export interface CourierSave {
  stage: number;
  status: 'pending' | 'lost' | 'collected' | 'claimed';
}
export const courierEligible = (level: Level) =>
  !(
    level.boss ||
    level.freight ||
    level.crossing ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro
  );

export function planCourier(seed: string, event?: AreaEventSave | null): CourierSave | null {
  const rng = seeded(seed + ':courier-v1');
  if (rng() >= 0.35) return null;
  const stages = COURIER_STAGES.filter(
    (s) => (!event || Math.floor(s / 4) !== event.area) && courierEligible(getLevel(seed, s)),
  );
  if (!stages.length) return null;
  return { stage: stages[Math.floor(rng() * stages.length)], status: 'pending' };
}

// Low walls create alternating sight lines. Every ascent is reachable with an
// ordinary jump; higher shelves are optional recoil shortcuts for the player.
export function courierLevel(source: Level, seed: string): Level {
  const mirrored = seeded(seed + ':courier-layout')() < 0.5;
  const solids: Solid[] = [
    { x: 520, y: 640, w: 150, h: 100 },
    { x: 980, y: 610, w: 170, h: 130 },
    { x: 1430, y: 650, w: 130, h: 90 },
    { x: 680, y: 420, w: 200, h: 22 },
    { x: 1220, y: 380, w: 170, h: 22 },
  ].map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x }));
  const low = solids.filter((s) => s.h > 28).sort((a, b) => a.x - b.x);
  const area = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'].indexOf(source.area);
  const spawns: Spawn[] = [
    { kind: 'shooter', x: low[0].x + low[0].w / 2, y: low[0].y - 16 },
    { kind: area >= 2 ? 'sniper' : 'shooter', x: low[1].x + 85, y: low[1].y - 16 },
    { kind: 'shooter', x: low[2].x + low[2].w / 2, y: low[2].y - 16 },
    { kind: 'runner', x: low[0].x + low[0].w + 70, y: 723 },
    { kind: area >= 2 ? 'hopper' : 'runner', x: low[1].x + low[1].w + 65, y: 723 },
    { kind: 'flyer', x: 800, y: 290 },
    { kind: area >= 2 ? 'skimmer' : 'flyer', x: 1380, y: 250 },
    { kind: 'runner', x: 1650, y: 723 },
  ];
  if (area >= 2) spawns.push({ kind: 'flyer', x: 1030, y: 330 });
  if (area >= 3) spawns.push({ kind: area === 3 ? 'sifter' : 'skimmer', x: 1590, y: 400 });
  if (area >= 4) {
    spawns.push({ kind: 'hopper', x: (low[0].x + low[0].w + low[1].x) / 2, y: 723 });
    spawns.push({ kind: 'sniper', x: 1250, y: 364 });
    // The sniper uses the actual upper shelf in either arrangement.
    const upper = solids.find((s) => s.y === 380)!;
    spawns.at(-1)!.x = upper.x + upper.w / 2;
  }
  return {
    id: 'dispatch-lane',
    name: 'Dispatch lane',
    area: source.area,
    boss: false,
    mirrored,
    courier: true,
    solids,
    spawns,
    hazards: [],
    setpiece: { rosters: [], props: [], weak: [] },
    route: [
      { x: 320, y: 720 },
      ...low.flatMap((s) => [
        { x: s.x + s.w / 2, y: s.y - 20 },
        { x: s.x + s.w + 90, y: 720 },
      ]),
      { x: 1800, y: 720 },
    ],
  };
}

export function courierTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'mirror', 'phase', 'v'].includes(key)) invalid = true;
  });
  if (
    invalid ||
    p.get('test') !== 'courier' ||
    p.getAll('test').length !== 1 ||
    (p.has('build') &&
      (p.getAll('build').length !== 1 ||
        !['standard', 'starter', 'portal', 'beam'].includes(p.get('build')!))) ||
    (p.has('mirror') && (p.getAll('mirror').length !== 1 || p.get('mirror') !== '1')) ||
    (p.has('phase') && (p.getAll('phase').length !== 1 || p.get('phase') !== 'reward'))
  )
    return null;
  const mods =
    p.get('build') === 'starter'
      ? []
      : p.get('build') === 'portal'
        ? ['magnum', 'fold', 'airshot', 'light']
        : p.get('build') === 'beam'
          ? ['magnum', 'cutting-torch', 'airshot', 'light']
          : ['magnum', 'ricochet', 'airshot', 'light'];
  const seed = p.has('mirror') ? 'COURIER-82-1' : 'COURIER-82-0';
  const recovered = p.get('phase') === 'reward';
  return {
    version: 6,
    seed,
    stage: 4,
    hp: recovered ? 64 : 100,
    mods,
    kills: 0,
    elapsed: 0,
    courier: { stage: 4, status: recovered ? 'collected' : 'pending' },
    ...(recovered
      ? {
          reward: {
            courier: true as const,
            rerolled: false,
            offers: rewardMods(mods, 3, seeded(seed + ':courier-rewards:4'), { stage: 4 }).map(
              (m) => m.id,
            ),
          },
        }
      : {}),
  };
}
