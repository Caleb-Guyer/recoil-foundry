export const WORKSHOP_MODS = [
  {
    id: 'grapnel',
    name: 'Grapnel',
    mark: 'grapnel',
    description:
      'Your first airborne wall hit anchors a swing cable instead of linking enemies. Jump to detach. One anchor per airtime.',
  },
  {
    id: 'convoy',
    name: 'Convoy',
    mark: 'convoy',
    description:
      'Stored rounds trail your movement. Release to converge from their positions. Holds 15 rounds.',
  },
  {
    id: 'thermal-shock',
    name: 'Thermal Shock',
    mark: 'thermal-shock',
    description:
      'Your flames consume cold for a steam blast. More cold, more damage. Pushes debris and ordinary enemies.',
  },
  {
    id: 'corner-pocket',
    name: 'Corner Pocket',
    mark: 'corner-pocket',
    description:
      'The first wall bounce aims at a nearby exposed enemy. Hits before that bounce deal 20% less damage.',
  },
  {
    id: 'scrap-feed',
    name: 'Scrap Feed',
    mark: 'scrap-feed',
    description:
      'Break crates or cover with your shots to load a short shrapnel blast into your next discharge. Stores one charge; its shrapnel cannot reload it.',
  },
] as const;
export const WORKSHOP_PARENTS: Record<string, string> = {
  grapnel: 'tether',
  convoy: 'crosshatch',
  'corner-pocket': 'banker',
  'scrap-feed': 'split',
};
