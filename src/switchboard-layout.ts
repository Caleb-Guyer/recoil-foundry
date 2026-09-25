import type { Level } from './levels.ts';
import { annexPoint } from './annex-layout.ts';
import { seeded, type Checkpoint } from './rules.ts';

export const SIGNAL_PORTS = [
  { port: { x: 80, y: 695 }, junction: { x: 420, y: 608 }, mount: 650 },
  { port: { x: 1000, y: 120 }, junction: { x: 1000, y: 418 }, mount: 460 },
  { port: { x: 1920, y: 695 }, junction: { x: 1560, y: 608 }, mount: 650 },
];
export function switchboardLevel(seed: string, mirror?: boolean): Level {
  const mirrored = mirror ?? seeded(seed + ':annex-room:11')() < 0.5;
  const solids = [
    { x: 340, y: 650, w: 160, h: 22 },
    { x: 620, y: 550, w: 150, h: 22 },
    { x: 850, y: 460, w: 300, h: 22 },
    { x: 1230, y: 550, w: 150, h: 22 },
    { x: 1480, y: 650, w: 160, h: 22 },
  ];
  return {
    id: 'annex-switchboard',
    name: 'The Switchboard',
    area: 'cooling',
    annex: true,
    mirrored,
    boss: true,
    hazards: [],
    solids: solids.map((s) => ({ ...s, x: mirrored ? 2000 - s.x - s.w : s.x })),
    spawns: [{ kind: 'switchboard', ...annexPoint(mirrored, { x: 1380, y: 340 }) }],
    route: [
      [260, 722],
      [420, 632],
      [695, 532],
      [1000, 442],
      [1305, 532],
      [1560, 632],
      [1800, 722],
    ]
      .map(([x, y]) => annexPoint(mirrored, { x, y }))
      .sort((a, b) => a.x - b.x),
    setpiece: {
      rosters: [],
      weak: [],
      props: [
        { kind: 'crate', ...annexPoint(mirrored, { x: 760, y: 717 }) },
        { kind: 'crate', ...annexPoint(mirrored, { x: 1240, y: 717 }) },
      ],
    },
  };
}
export const SWITCHBOARD_BUILDS = {
  gun: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'pierce',
    'ricochet',
    'spoof',
    'standing-orders',
  ],
  beam: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'cutting-torch',
    'ricochet',
    'spoof',
    'standing-orders',
  ],
  shell: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'shellshock',
    'ricochet',
    'spoof',
    'standing-orders',
  ],
  counter: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'countershot',
    'pierce',
    'ricochet',
    'scatter',
  ],
  portal: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'fold',
    'rewire',
    'pierce',
    'ricochet',
  ],
  subversion: [
    'magnum',
    'rapid',
    'kick',
    'airshot',
    'light',
    'leech',
    'landing',
    'spoof',
    'cross-talk',
    'dead-switch',
    'pierce',
  ],
} as const;
export function switchboardTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let valid = p.get('test') === 'switchboard';
  p.forEach((_, k) => {
    if (!['test', 'build', 'mirror'].includes(k) || p.getAll(k).length !== 1) valid = false;
  });
  const build = p.get('build') ?? 'gun';
  if (
    !valid ||
    !Object.hasOwn(SWITCHBOARD_BUILDS, build) ||
    (p.has('mirror') && !['0', '1'].includes(p.get('mirror')!))
  )
    return null;
  return {
    version: 6,
    seed: 'SWITCHBOARD-82',
    stage: 11,
    hp: 100,
    elapsed: 0,
    kills: 0,
    region: 'annex',
    annexVersion: 3,
    mods: [...SWITCHBOARD_BUILDS[build as keyof typeof SWITCHBOARD_BUILDS]],
    switchboardTest: { mirror: p.get('mirror') === '1' },
  };
}
