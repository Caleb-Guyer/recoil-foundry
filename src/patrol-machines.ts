import type { Lore } from './lore-upgrades.ts';
export const PATROL_MACHINES = {
  shutter: {
    name: 'Shutter Guard',
    guide:
      'Front shutters reduce hits while closed. Flank it or fire during its open recovery after a warned shot.',
  },
  strider: {
    name: 'Strider',
    guide:
      'Patrols its own platform, then braces and locks a firing lane. Move after the amber aim lines stop tracking.',
  },
  mortar: {
    name: 'Mortar Cart',
    guide:
      'Marks a landing point before lobbing a shootable shell. Leave the blast circle, break the shell, or use solid cover.',
  },
} as const;
export type PatrolKind = keyof typeof PATROL_MACHINES;
export const isPatrolMachine = (id: string): id is PatrolKind => Object.hasOwn(PATROL_MACHINES, id);
export const MACHINE_VARIANTS = {
  'shutter-fan': {
    kind: 'shutter',
    name: 'Wide Shutter',
    guide:
      'Opens its shutters for a slow three-round fan. The full fan is shown before firing; its recovery exposes the core.',
  },
  'shutter-burst': {
    kind: 'shutter',
    name: 'Cycle Shutter',
    guide:
      'Fires two aimed shots. Each has its own complete warning and aim lock; both are followed by a longer exposed recovery.',
  },
  'strider-survey': {
    kind: 'strider',
    name: 'Survey Strider',
    guide:
      'Braces for one fast precision round with a longer warning. Its sight line locks before the shot.',
  },
  'strider-volley': {
    kind: 'strider',
    name: 'Volley Strider',
    guide:
      'A slower patrol with a wide three-round fan. Climb or cross behind it after the marked lanes lock.',
  },
  'mortar-twin': {
    kind: 'mortar',
    name: 'Twin Mortar',
    guide:
      'Lobs two small shells toward landing points separated by a safe gap. Both arcs and blast circles are warned; each shell can be shot apart.',
  },
  'mortar-slow': {
    kind: 'mortar',
    name: 'Heavy Mortar',
    guide:
      'One slower shell has a larger blast circle and a longer warning. Break it in flight or get beyond its marked landing area.',
  },
} as const;
export type MachineVariant = keyof typeof MACHINE_VARIANTS;
export const MACHINE_VARIANT_IDS = Object.keys(MACHINE_VARIANTS) as MachineVariant[];
export const isMachineVariant = (id: string): id is MachineVariant =>
  Object.hasOwn(MACHINE_VARIANTS, id);
export const MACHINE_LORE_RECORDS: Record<PatrolKind, Lore> = {
  shutter: [
    'Guard station · shutter inspection',
    'E. Holt · safety',
    'The shutter was meant to protect a lens from flying chips. Security fitted a gun behind it.\n\nIt still has to open after each cycle. The red faceplate is not a second piece of armour; it is the part the shutter was built to protect.',
  ],
  strider: [
    'Inspection trolley · patrol bounds',
    'M. Vale · maintenance',
    'The feet carry the inspection head from one end of its assigned shelf to the other. It checks the edge before stepping. That instruction survived the security conversion.\n\nThe receiver cannot fire while walking. Watch the braces fold out; that is when it has stopped choosing where to stand.',
  ],
  mortar: [
    'Kiln service · cleaning cartridges',
    'T. Orr · dispatch',
    'Those cartridges were intended to clear blocked return pipes. The little trolley has started sending them down the aisle instead.\n\nIt marks the landing first. The casing is thin enough to break before it reaches the mark. Someone left us at least two ways to cancel the delivery.',
  ],
};
export const MACHINE_VARIANT_RECORDS = MACHINE_VARIANT_IDS.map((id) => ({
  id: 'machine:' + id,
  name: MACHINE_VARIANTS[id].name,
  description: MACHINE_VARIANTS[id].guide,
  lore: [
    MACHINE_LORE_RECORDS[MACHINE_VARIANTS[id].kind][0] + ' · alternate head',
    'M. Vale · maintenance',
    {
      'shutter-fan':
        'Three receivers were fitted to cover the width of the loading aisle. Each receiver still has its own shutter, but they all open on one timing board.\n\nThe wide cycle empties the head slowly. Once the lamps stop sweeping, there is room between the cartridges. Afterward every shutter stays open for servicing. Nobody changed that last part of the cycle.',
      'shutter-burst':
        'The second receiver was advertised as a spare. Dispatch now asks for both readings on every inspection. The timing board restarts the entire alignment check between them.\n\nWait for the second lamp before crossing the aisle. Both receivers have to cool before the shutters close. That interval used to be when we checked the lens for chips.',
      'strider-survey':
        'The long receiver once held a distance probe. It takes a little longer to settle its braces than the ordinary head, then records one very fast measurement.\n\nThe old sight still draws the exact line it has chosen. Move after that line stops following you. The trolley cannot revise its measurement until the receiver has finished.',
      'strider-volley':
        'The wider head was too heavy for the standard patrol speed. We reduced the drive setting and spread three receivers across its bracket.\n\nIt walks slowly and braces before every sweep. All three lanes appear together on the alignment display. The space behind the trolley remains outside its inspection area; it was never given a second head.',
      'mortar-twin':
        'Two return pipes used to run beside this station. The cleaning cart still addresses them separately, even though somebody moved the address to the person standing in the aisle.\n\nThe two marks leave a gap between the cartridges. Both casings are thin. Breaking one does not cancel the other, so check the second delivery before returning to the marked floor.',
      'mortar-slow':
        'The heavy cartridge clears a larger blockage but needs more time in the receiver. Its longer arc was printed on the service drawing in amber.\n\nThe cart has kept that drawing and increased the charge. Leave the whole marked area or break the casing on its way down. Solid cover still catches the cartridge before it reaches the floor.',
    }[id],
  ] as Lore,
}));
