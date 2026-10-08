import { validBuild, type Checkpoint } from './rules.ts';
import { isStartingGun } from './starting-guns.ts';
import { LONGEVITY_IDS } from './longevity.ts';
import { isToolroomRoom, TOOLROOM_ROOMS, type ToolroomRoom } from './toolroom-layouts.ts';
import {
  isMachineVariant,
  isPatrolMachine,
  MACHINE_VARIANTS,
  PATROL_MACHINES,
} from './patrol-machines.ts';

export const TOOLROOM_BUILDS = {
  native: {
    name: 'New tools',
    room: 'inspection-lane',
    mods: [],
    hint: 'An unmodified tool against a zone-two patrol. Try its recoil and native firing pattern.',
  },
  mobility: {
    name: 'Flight kit',
    room: 'roof-braces',
    mods: [
      'kick',
      'double-jump',
      'spring-step',
      'wing-harness',
      'glide-rig',
      'impulse-reserve',
      'ground-anchor',
      'light',
    ],
    hint: 'Jump, then shoot downward for the first-airborne impulse. Your extra jump and longer glide recharge on landing.',
  },
  precision: {
    name: 'Marked volleys',
    room: 'inspection-lane',
    mods: [
      'deadeye',
      'scatter',
      'surveyor',
      'far-sight',
      'follow-mark',
      'capacitor',
      'stagger-coil',
      'kick',
    ],
    hint: 'The first volley marks; the next hits harder. Finish a marked target to prime your following volley. Charge while idle.',
  },
  thermal: {
    name: 'Heat circuit',
    room: 'relay-aisle',
    mods: [
      'cutting-torch',
      'scatter',
      'prism-array',
      'collimator',
      'thermal-runaway',
      'heat-relay',
      'heat-exchanger',
      'insulated-line',
      'thermal-budget',
      'hot-start',
      'kick',
      'light',
    ],
    hint: 'Hold steady to heat and focus all beams. Finish a target, then carry 75% heat to another within 1.8 seconds.',
  },
  blast: {
    name: 'Chain blast kit',
    room: 'scrap-bridge',
    mods: [
      'shellshock',
      'magnum',
      'rapid',
      'aftershock',
      'shockfront',
      'fuse',
      'linked-fuse',
      'chain-reaction',
      'blast-surf',
      'airshot',
      'leech',
      'light',
      'scatter',
      'burst',
    ],
    hint: 'Fire shell volleys into cover and patrols. Linked fuses spread blasts through clear space; warned mortar shells can be shot down.',
  },
  banking: {
    name: 'Reserve circuit',
    room: 'return-chute',
    mods: [
      'magnum',
      'capacitor',
      'overkill-bank',
      'bank-capacitor',
      'bank-memory',
      'ricochet',
      'kinetic-liner',
      'guide-vane',
      'kick',
      'light',
    ],
    hint: 'Charge a killing hit to store its excess. One whole discharge shares the payout; a quarter of the reserve remains.',
  },
  defense: {
    name: 'Field repair kit',
    room: 'cover-line',
    mods: [
      'scrap-armor',
      'reinforced-plate',
      'plate-retainer',
      'reclamation',
      'field-patch',
      'rapid',
      'deadeye',
      'kick',
      'light',
    ],
    hint: 'Break cover for a six-second plate and two health. Avoid injury for six seconds during combat to begin limited field repairs.',
  },
  cadence: {
    name: 'Moving openings',
    room: 'scrap-bridge',
    mods: [
      'airshot',
      'recoil-runner',
      'opening-shot',
      'clean-cycle',
      'regulator',
      'scatter',
      'rapid',
      'kick',
      'light',
    ],
    hint: 'Pause between volleys, fire while moving, or earn two quick direct kills to strengthen your next discharge. Shared bonuses cap at 40%.',
  },
} as const;
export type ToolroomBuild = keyof typeof TOOLROOM_BUILDS;
export function toolroomTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'build', 'gun', 'room', 'machine', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const build = p.get('build') ?? 'native',
    gun = p.get('gun') ?? 'twinbore',
    machine = p.get('machine');
  if (
    invalid ||
    p.get('test') !== 'toolroom' ||
    !Object.hasOwn(TOOLROOM_BUILDS, build) ||
    !isStartingGun(gun) ||
    (p.has('v') && p.get('v') !== '1') ||
    (machine && (p.has('room') || (!isMachineVariant(machine) && !isPatrolMachine(machine))))
  )
    return null;
  const preset = TOOLROOM_BUILDS[build as ToolroomBuild],
    room = p.get('room') ?? preset.room;
  if (!isToolroomRoom(room) || !validBuild([...preset.mods])) return null;
  const stage = build === 'native' ? 6 : 18;
  return {
    version: 6,
    seed: 'RF-C89-EXP-' + (machine ? 'MACH-' + machine : 'ROOM-' + room),
    stage,
    hp: 100,
    mods: [...preset.mods],
    startingGun: gun,
    unlocks: [...LONGEVITY_IDS],
    missedUpgrades: stage - preset.mods.length,
    kills: 0,
    elapsed: 0,
  };
}
export function toolroomTestTitle(url: URL) {
  const machine = url.searchParams.get('machine');
  if (machine && isMachineVariant(machine)) return MACHINE_VARIANTS[machine].name;
  if (machine && isPatrolMachine(machine)) return PATROL_MACHINES[machine].name;
  const build = url.searchParams.get('build') ?? 'native';
  return (
    TOOLROOM_BUILDS[build as ToolroomBuild]?.name ??
    TOOLROOM_ROOMS[url.searchParams.get('room') as ToolroomRoom]?.name ??
    'Toolroom'
  );
}
