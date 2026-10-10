import type { Lore } from './lore-upgrades.ts';

export const LATE_BOSS_MASTERIES = [
  {
    id: 'beltline-certified',
    remix: 'sorter-beltline',
    name: 'Between the Lines',
    objective: 'Defeat The Sorter in Beltline without taking damage in a Campaign fight.',
    reward: 'Beltline',
    slot: 'Gun finish',
    lore: [
      'Reclamation · belt inspection',
      'M. Vale · maintenance',
      'Two feed belts, one sorting head. You crossed its marked lanes without becoming part of the inventory.\n\nThe yellow receiver enamel came from a drive housing; the green sight marks the safe aisle.',
    ] as Lore,
  },
  {
    id: 'magnetic-certified',
    remix: 'sorter-magnetic-return',
    name: 'Unattracted',
    objective: 'Defeat The Sorter in Magnetic Return without taking damage in a Campaign fight.',
    reward: 'Lodestone',
    slot: 'Gun finish',
    lore: [
      'Reclamation · magnetic return',
      'E. Holt · safety',
      'The magnets returned their scrap. The sorting head did not return to service.\n\nI signed the inspection in violet ink, then found a tin of the same enamel for your receiver. Keep the sight lamp bright.',
    ] as Lore,
  },
  {
    id: 'skybridge-certified',
    remix: 'boss-skybridge',
    name: 'Above the Orders',
    objective: 'Defeat the final defense in Skybridge without taking damage in a Campaign fight.',
    reward: 'Highrise',
    slot: 'Outfit',
    lore: [
      'Rooftops · bridge reopened',
      'T. Orr · dispatch',
      'Command could track a position. It could not keep you at one height. The transfer decks are open again.\n\nMaintenance left a blue jacket at the upper station, with pale stitching you can see from the floor.',
    ] as Lore,
  },
  {
    id: 'crossfire-certified',
    remix: 'boss-crossfire',
    name: 'Read Both Signals',
    objective: 'Defeat the final defense in Crossfire without taking damage in a Campaign fight.',
    reward: 'Signalkeeper',
    slot: 'Outfit',
    lore: [
      'Rooftops · paired signal test',
      'Dr. S. Anik · development',
      'The second instruction always arrived after the first. You read them both and found the opening between them.\n\nThis jacket uses the signal crew’s dark red cloth and amber cuffs. Nobody has issued you another order.',
    ] as Lore,
  },
] as const;
