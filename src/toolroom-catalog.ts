import type { Gun } from './rules.ts';
import type { Lore } from './lore-upgrades.ts';

export const TOOLROOM_RULESET = 89;
export const TOOLROOM_MODS = [
  {
    id: 'spring-step',
    name: 'Spring Step',
    family: 'mobility',
    mark: 'spring-step',
    description:
      'Your extra airborne jump rises 20% faster. It still recharges only when you land.',
  },
  {
    id: 'glide-rig',
    name: 'Glide Rig',
    family: 'mobility',
    mark: 'glide-rig',
    description: 'Wing Harness carries 2 seconds of glide per landing, up from 1.2 seconds.',
  },
  {
    id: 'impulse-reserve',
    name: 'Impulse Reserve',
    family: 'mobility',
    mark: 'impulse-reserve',
    description:
      'Your first airborne discharge after each landing has 25% more recoil. All firing lanes share the boost.',
  },
  {
    id: 'ground-anchor',
    name: 'Ground Anchor',
    family: 'mobility',
    mark: 'ground-anchor',
    description: 'Grounded fire pushes you 40% less. Airborne recoil keeps its full strength.',
  },
  {
    id: 'surveyor',
    name: 'Surveyor',
    family: 'precision',
    mark: 'surveyor',
    description:
      'Direct fire marks an enemy for 1.5s. Later discharges hit that marked target 20% harder. Pellets and rays share one mark.',
  },
  {
    id: 'far-sight',
    name: 'Far Sight',
    family: 'precision',
    mark: 'far-sight',
    description:
      'Direct fire deals 15% more damage at least 350 units from the discharge origin. Cover still blocks it.',
  },
  {
    id: 'follow-mark',
    name: 'Follow the Mark',
    family: 'precision',
    mark: 'follow-mark',
    description:
      'Finish a previously marked enemy to prime 20% bonus damage for your next whole discharge within 2s.',
  },
  {
    id: 'stagger-coil',
    name: 'Stagger Coil',
    family: 'precision',
    mark: 'stagger-coil',
    description:
      'Charged direct hits delay an ordinary idle machine’s next attack by 0.25s. One delay per enemy every 2s; committed warnings continue.',
  },
  {
    id: 'heat-exchanger',
    name: 'Heat Exchanger',
    family: 'thermal',
    mark: 'heat-exchanger',
    description:
      'Heat Relay carries 75% of the defeated target’s heat instead of half. One destination per kill.',
  },
  {
    id: 'insulated-line',
    name: 'Insulated Line',
    family: 'thermal',
    mark: 'insulated-line',
    description: 'Heat Relay keeps its stored heat for 1.8s, giving you longer to change targets.',
  },
  {
    id: 'thermal-budget',
    name: 'Thermal Budget',
    family: 'thermal',
    mark: 'thermal-budget',
    description:
      'Tracking an exposed target builds Thermal Runaway heat 25% faster. Its maximum bonus stays the same.',
  },
  {
    id: 'hot-start',
    name: 'Hot Start',
    family: 'thermal',
    mark: 'hot-start',
    description:
      'The first exposed beam target in each room starts with 25% heat. An existing Heat Relay transfer takes priority.',
  },
  {
    id: 'bank-capacitor',
    name: 'Bank Capacitor',
    family: 'banking',
    mark: 'bank-capacitor',
    description:
      'Overkill Bank can pay up to 75% bonus damage across a discharge, up from 50%. Boosted hits cannot refill it.',
  },
  {
    id: 'bank-memory',
    name: 'Bank Memory',
    family: 'banking',
    mark: 'bank-memory',
    description:
      'After an Overkill payout, retain 25% of the reserve for another discharge. Each payment shrinks it; boosted hits cannot refill it.',
  },
  {
    id: 'kinetic-liner',
    name: 'Kinetic Liner',
    family: 'banking',
    mark: 'kinetic-liner',
    description: 'One extra surface bank for every round or beam. Direct damage is 10% lighter.',
  },
  {
    id: 'guide-vane',
    name: 'Guide Vane',
    family: 'banking',
    mark: 'guide-vane',
    description:
      'Rounds travel 20% faster; beams reach 20% farther. Returning and converted ammunition keep their mechanisms.',
  },
  {
    id: 'reinforced-plate',
    name: 'Reinforced Plate',
    family: 'defense',
    mark: 'reinforced-plate',
    description:
      'Scrap Armor can absorb an enemy round up to 28 damage and radius 6. Blades and explosive shells still pass through.',
  },
  {
    id: 'plate-retainer',
    name: 'Plate Retainer',
    family: 'defense',
    mark: 'plate-retainer',
    description:
      'An unused Scrap Armor plate lasts 6 seconds instead of 4. One plate and the 6-second recharge remain.',
  },
  {
    id: 'reclamation',
    name: 'Reclamation',
    family: 'defense',
    mark: 'reclamation',
    description:
      'Break a crate or cracked cover with direct fire to recover 2 health. 4s recharge and at most 10 health per room.',
  },
  {
    id: 'field-patch',
    name: 'Field Patch',
    family: 'defense',
    mark: 'field-patch',
    description:
      'After 6 seconds without injury during combat, recover 1 health per second, up to 10 per room. Healing stops when the patrol is clear.',
  },
  {
    id: 'opening-shot',
    name: 'Opening Shot',
    family: 'cadence',
    mark: 'opening-shot',
    description:
      'Wait 0.9 seconds between discharges for a 20% stronger opening volley or beam pulse.',
  },
  {
    id: 'recoil-runner',
    name: 'Recoil Runner',
    family: 'cadence',
    mark: 'recoil-runner',
    description:
      'Discharge while moving at least 8 units per frame for 15% more damage across the whole pattern.',
  },
  {
    id: 'clean-cycle',
    name: 'Clean Cycle',
    family: 'cadence',
    mark: 'clean-cycle',
    description:
      'Two direct kills within 2 seconds prime 20% bonus damage for the next discharge. Opening, movement and kill reserves together cap at 40%.',
  },
  {
    id: 'regulator',
    name: 'Regulator',
    family: 'cadence',
    mark: 'regulator',
    description:
      '20% gentler recoil with 10% lighter direct damage. Keep every pellet, pulse and firing lane.',
  },
] as const;
export type ToolroomId = (typeof TOOLROOM_MODS)[number]['id'];
export type ToolroomFamily = (typeof TOOLROOM_MODS)[number]['family'];
export const TOOLROOM_IDS: readonly ToolroomId[] = TOOLROOM_MODS.map((m) => m.id);
export const TOOLROOM_PARENTS: Readonly<Partial<Record<ToolroomId, string>>> = {
  'spring-step': 'double-jump',
  'glide-rig': 'wing-harness',
  'impulse-reserve': 'kick',
  surveyor: 'deadeye',
  'far-sight': 'deadeye',
  'follow-mark': 'surveyor',
  'stagger-coil': 'capacitor',
  'heat-exchanger': 'heat-relay',
  'insulated-line': 'heat-relay',
  'thermal-budget': 'thermal-runaway',
  'hot-start': 'thermal-runaway',
  'bank-capacitor': 'overkill-bank',
  'bank-memory': 'overkill-bank',
  'kinetic-liner': 'ricochet',
  'reinforced-plate': 'scrap-armor',
  'plate-retainer': 'scrap-armor',
  'recoil-runner': 'airshot',
};
export function toolroomRevision(seed: string) {
  const revision = /^RF-[CD](\d+)-/.exec(seed);
  return !!revision && Number(revision[1]) >= TOOLROOM_RULESET;
}
export function toolroomDraftAllowed(id: string, seed = '') {
  return !TOOLROOM_IDS.includes(id as ToolroomId) || toolroomRevision(seed);
}
export function toolroomStageAllowed(id: string, stage: number, overtime = false) {
  return !TOOLROOM_IDS.includes(id as ToolroomId) || overtime || stage >= 4;
}
export function applyToolroomGun(g: Gun, mods: readonly string[]) {
  if (mods.includes('kinetic-liner')) {
    g.bounces += 1;
    g.damage *= 0.9;
  }
  if (mods.includes('guide-vane')) g.projectileSpeed *= 1.2;
  if (mods.includes('regulator')) {
    g.recoil *= 0.8;
    g.damage *= 0.9;
  }
  return g;
}
const records: Record<ToolroomFamily, readonly [string, string]> = {
  mobility: ['Roof crew · movement fittings', 'E. Holt · safety'],
  precision: ['Toolroom · inspection optics', 'Dr. S. Anik · development'],
  thermal: ['Cooling return · heat recovery', 'M. Vale · maintenance'],
  banking: ['Power store · discharge accounts', 'Dr. S. Anik · development'],
  defense: ['Reclamation · field repair kit', 'E. Holt · safety'],
  cadence: ['Dispatch · operator certification', 'T. Orr · dispatch'],
};
export const TOOLROOM_LORE = Object.fromEntries(
  TOOLROOM_MODS.map((m) => [
    m.id,
    [
      ...records[m.family],
      `${m.name} has passed the toolroom inspection. ${m.description}\n\nThe fitting uses the same receiver mount. Keep the tool that earned the clearance; this part was made to work with it.`,
    ],
  ]),
) as unknown as Record<ToolroomId, Lore>;
