import type { Game } from './game.ts';
import type { Level, Solid, Spawn, EnemyKind } from './levels.ts';
import { seeded, segmentBox } from './rules.ts';
import { PROP_STATS } from './props.ts';
import { toolroomRevision } from './toolroom-catalog.ts';
import {
  MACHINE_VARIANT_IDS,
  MACHINE_VARIANTS,
  isMachineVariant,
  isPatrolMachine,
  type PatrolKind,
} from './patrol-machines.ts';

const shelf = (x: number, y: number, w: number): Solid => ({ x, y, w, h: 22 });
const spawn = (kind: EnemyKind, x: number, floor = 740): Spawn => ({
  kind,
  x,
  y:
    floor -
    (kind === 'shutter'
      ? 20
      : kind === 'strider' || kind === 'mortar'
        ? 18
        : kind === 'shooter'
          ? 16
          : 17),
});
const airborne = (x: number, y: number): Spawn => ({ kind: 'flyer', x, y });
const cover = (x: number) => ({ kind: 'cover' as const, x, y: 698 });
const crate = (x: number, floor = 740) => ({ kind: 'crate' as const, x, y: floor - 23 });
export const TOOLROOM_ROOMS = {
  'relay-aisle': {
    name: 'Relay aisle',
    focus: 'heat',
    guide:
      'An open sequence of patrols gives you time to carry heat between targets. Use the raised shelf to clear the later firing lane.',
    solids: [shelf(1040, 570, 260)],
    spawns: [
      spawn('runner', 510),
      airborne(740, 445),
      spawn('runner', 980),
      spawn('shooter', 1190, 570),
      spawn('runner', 1460),
      spawn('shutter', 1700),
    ],
    props: [crate(365), cover(1390)],
  },
  'warm-exchange': {
    name: 'Warm exchange',
    focus: 'heat',
    guide:
      'Short steps alternate floor and elevated targets. Clear one shelf before climbing into the next firing lane.',
    solids: [shelf(600, 595, 220), shelf(1120, 500, 240)],
    spawns: [
      spawn('shutter', 505),
      spawn('runner', 720, 595),
      airborne(940, 405),
      spawn('shooter', 1240, 500),
      spawn('strider', 1510),
      spawn('runner', 1750),
    ],
    props: [crate(385), cover(1040)],
  },
  'upper-return': {
    name: 'Upper return',
    focus: 'heat',
    guide:
      'A broad overhead walkway connects two patrol groups. Keep a clear line across the center or drop down to change your angle.',
    solids: [shelf(490, 575, 310), shelf(910, 455, 310), shelf(1350, 575, 310)],
    spawns: [
      spawn('shutter', 535),
      spawn('shooter', 665, 575),
      airborne(920, 320),
      spawn('runner', 1090, 455),
      spawn('strider', 1495, 575),
      spawn('runner', 1740),
    ],
    props: [crate(370), cover(1270)],
  },
  'inspection-lane': {
    name: 'Inspection lane',
    focus: 'bank',
    guide:
      'Light patrols precede armored guards. Line up a killing hit, bank its excess and spend it on an exposed core.',
    solids: [shelf(1140, 550, 250)],
    spawns: [
      spawn('runner', 515),
      spawn('shutter', 790),
      spawn('runner', 1040),
      spawn('shooter', 1265, 550),
      spawn('strider', 1510),
      spawn('runner', 1730),
    ],
    props: [crate(370), cover(920), crate(1425)],
  },
  'die-store': {
    name: 'Die store',
    focus: 'bank',
    guide:
      'Two ground lanes and an open shelf let you choose the order of the fight. Weak patrols can feed a reserve before the protected guard.',
    solids: [shelf(630, 575, 280), shelf(1260, 575, 280)],
    spawns: [
      spawn('runner', 520),
      spawn('shutter', 795, 575),
      spawn('runner', 1040),
      spawn('strider', 1410, 575),
      spawn('mortar', 1640),
      spawn('runner', 1780),
    ],
    props: [crate(360), cover(1160)],
  },
  'return-chute': {
    name: 'Return chute',
    focus: 'bank',
    guide:
      'Separate patrol pairs sit above an open return floor. Fire through a pair or recoil around the guard to reach its unprotected side.',
    solids: [shelf(530, 620, 270), shelf(970, 525, 270), shelf(1410, 620, 270)],
    spawns: [
      spawn('runner', 470),
      spawn('shutter', 675, 620),
      spawn('runner', 1010, 525),
      spawn('strider', 1190, 525),
      spawn('mortar', 1535, 620),
      spawn('runner', 1770),
    ],
    props: [crate(355), cover(1320)],
  },
  'cover-line': {
    name: 'Cover line',
    focus: 'armor',
    guide:
      'Three breakable barricades separate firing lanes. Break one for a plate or repair, then cross to the next position while attacks recover.',
    solids: [shelf(1000, 535, 280)],
    spawns: [
      spawn('shutter', 590),
      spawn('runner', 950),
      spawn('shooter', 1145, 535),
      spawn('strider', 1420),
      spawn('mortar', 1700),
    ],
    props: [cover(370), cover(780), cover(1260), crate(1560)],
  },
  'scrap-bridge': {
    name: 'Scrap bridge',
    focus: 'armor',
    guide:
      'A low central bridge offers two routes through the firing lanes. Salvage the ground barricades before pushing or climb onto the bridge.',
    solids: [shelf(820, 570, 380), shelf(1330, 470, 200)],
    spawns: [
      spawn('shutter', 600),
      spawn('runner', 925, 570),
      spawn('strider', 1100, 570),
      spawn('shooter', 1455, 470),
      spawn('mortar', 1700),
    ],
    props: [cover(370), cover(735), cover(1280), crate(1580)],
  },
  'roof-braces': {
    name: 'Roof braces',
    focus: 'armor',
    guide:
      'Wide landing decks leave room for recoil. Break a brace for protection, then use a different height to escape the locked firing lanes.',
    solids: [shelf(540, 595, 280), shelf(1020, 490, 290), shelf(1460, 595, 270)],
    spawns: [
      spawn('shutter', 450),
      spawn('shooter', 675, 595),
      spawn('runner', 1130, 490),
      spawn('strider', 1600, 595),
      spawn('mortar', 1780),
    ],
    props: [cover(345), cover(920), cover(1370), crate(1675, 595)],
  },
} as const;
export type ToolroomRoom = keyof typeof TOOLROOM_ROOMS;
export const TOOLROOM_ROOM_IDS = Object.keys(TOOLROOM_ROOMS) as ToolroomRoom[];
export const isToolroomRoom = (id: string): id is ToolroomRoom => Object.hasOwn(TOOLROOM_ROOMS, id);
export function toolroomRoomLevel(
  id: ToolroomRoom,
  area: Level['area'],
  stage: number,
  seed: string,
  teamwork = false,
): Level {
  const source = TOOLROOM_ROOMS[id],
    rng = seeded(seed + ':toolroom-machines:' + stage);
  const spawns: Spawn[] = source.spawns.map((s) => ({ ...s }));
  for (const s of spawns) {
    if (s.kind === 'strider' && stage < 10) {
      s.kind = 'shooter';
      s.y += 2;
    }
    if (s.kind === 'mortar' && stage < 14) {
      s.kind = 'runner';
      s.y += 1;
    }
    const from = s.kind === 'shutter' ? 10 : s.kind === 'strider' ? 14 : 18;
    if (stage >= from && ['shutter', 'strider', 'mortar'].includes(s.kind) && rng() < 0.7) {
      const variants = MACHINE_VARIANT_IDS.filter((v) => MACHINE_VARIANTS[v].kind === s.kind);
      s.machineVariant = variants[Math.floor(rng() * variants.length)];
    }
  }
  const intro: PatrolKind | undefined =
    stage === 6 ? 'shutter' : stage === 10 ? 'strider' : stage === 14 ? 'mortar' : undefined;
  if (intro && !spawns.some((s) => s.kind === intro)) {
    const s = spawns.at(-1)!;
    s.kind = intro;
    s.y = 740 - (intro === 'shutter' ? 20 : 18);
    s.x = 1710;
    delete s.machineVariant;
  }
  if (intro) delete spawns.find((s) => s.kind === intro)!.machineVariant;
  // Keep the existing teamwork introductions as a later, paired arrival.
  if (teamwork && (stage === 6 || stage === 10)) {
    if (stage === 10 && !spawns.some((s) => ['shooter', 'flyer'].includes(s.kind))) {
      const receiver =
        spawns.find((s) => s.kind === 'runner' && s.x >= 900) ??
        spawns.find((s) => s.kind === 'runner');
      if (receiver) {
        receiver.kind = 'shooter';
        receiver.y += 1;
      }
    }
    const obstacles = [
      ...source.solids,
      ...source.props.map((p) => {
        const size = PROP_STATS[p.kind];
        return { x: p.x - size.w / 2, y: p.y - size.h / 2, w: size.w, h: size.h };
      }),
    ];
    const candidates = spawns.filter((s) =>
      (stage === 10 ? ['shooter', 'flyer'] : ['runner', 'shooter']).includes(s.kind),
    );
    const pairs = candidates.flatMap((partner) =>
      [-90, 90].map((offset) => ({ partner, point: { x: partner.x + offset, y: partner.y - 95 } })),
    );
    const pair = pairs.find(
      ({ partner, point }) =>
        point.x >= 320 &&
        point.x <= 1800 &&
        !obstacles.some(
          (b) =>
            (point.x + 18 > b.x &&
              point.x - 18 < b.x + b.w &&
              point.y + 18 > b.y &&
              point.y - 18 < b.y + b.h) ||
            segmentBox(
              point,
              partner,
              { x: b.x - 2, y: b.y - 2 },
              { x: b.x + b.w + 2, y: b.y + b.h + 2 },
            ),
        ),
    );
    if (pair) {
      pair.partner.teamwork = true;
      spawns.push({ kind: stage === 6 ? 'repairer' : 'relay', ...pair.point, teamwork: true });
    }
  }
  const solids = source.solids.map((s) => ({ ...s }));
  return {
    id: 'toolroom-' + id,
    name: source.name,
    area,
    solids,
    spawns,
    route: [
      { x: 120, y: 716 },
      ...solids.map((s) => ({ x: s.x + s.w / 2, y: s.y - 24 })),
      { x: 1880, y: 716 },
    ],
    mirrored: false,
    boss: false,
    toolroom: id,
    ...(intro ? { machineIntro: intro } : {}),
    setpiece: {
      rosters: [spawns.map((_, i) => i)],
      weak: [],
      props: source.props.map((p) => ({ ...p })),
    },
  };
}
export function toolroomLevel(g: Game, level: Level): Level {
  const machine = g.testRun && /^RF-C89-EXP-MACH-([a-z-]+)$/.exec(g.testRun.seed)?.[1];
  if (machine && (isMachineVariant(machine) || isPatrolMachine(machine))) {
    const kind = isMachineVariant(machine) ? MACHINE_VARIANTS[machine].kind : machine;
    const room = toolroomRoomLevel('inspection-lane', level.area, g.stage, g.seed);
    return {
      ...room,
      name: 'Machine inspection',
      solids: [],
      route: [{ x: 1880, y: 716 }],
      spawns: [
        { ...spawn(kind, 1050), ...(isMachineVariant(machine) ? { machineVariant: machine } : {}) },
      ],
      setpiece: { rosters: [[0]], weak: [], props: [crate(400)] },
    };
  }
  const forced = g.testRun && /^RF-C89-EXP-ROOM-([a-z-]+)$/.exec(g.testRun.seed)?.[1];
  if (forced && isToolroomRoom(forced))
    return toolroomRoomLevel(forced, level.area, g.stage, g.seed);
  if (
    !toolroomRevision(g.seed) ||
    ![6, 10, 14, 18].includes(g.stage) ||
    g.overtime ||
    g.practice ||
    g.testRun ||
    g.workshop.active ||
    g.escape ||
    g.detour ||
    level.boss ||
    level.detour ||
    level.routeChoice ||
    level.freight ||
    level.crossing ||
    level.annex ||
    level.story ||
    level.shutdown ||
    level.courier ||
    level.floodgate ||
    level.sortingPit ||
    level.uprising ||
    level.fabricatorIntro ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro ||
    g.areaEvents.encounter
  )
    return level;
  const rng = seeded(g.seed + ':toolroom-layout:' + g.stage);
  return toolroomRoomLevel(
    TOOLROOM_ROOM_IDS[Math.floor(rng() * TOOLROOM_ROOM_IDS.length)],
    level.area,
    g.stage,
    g.seed,
    g.teamwork.enabled,
  );
}
