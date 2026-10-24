import type { AreaId } from './areas.ts';

export const AUDIO_LAB_SCENES = {
  direction: {
    name: 'Directional threats',
    area: 'docks',
    description: 'Compare the same warning on your left, right, and both sides at once.',
    ambience: false,
  },
  impacts: {
    name: 'Material impacts',
    area: 'docks',
    description:
      'Compare the actual impact layers for armor, metal bodies, cover, power cabinets, and terrain.',
    ambience: false,
  },
  docks: {
    name: 'Loading docks',
    area: 'docks',
    description: 'A low loading-bay hum and distant cargo machinery.',
    ambience: true,
  },
  furnace: {
    name: 'Furnace halls',
    area: 'furnace',
    description: 'Pressure, hot air, and the machinery beneath the furnaces.',
    ambience: true,
  },
  cooling: {
    name: 'Cooling Works',
    area: 'cooling',
    description: 'Pumps and coolant moving through the factory.',
    ambience: true,
  },
  reclamation: {
    name: 'Reclamation Works',
    area: 'reclamation',
    description: 'Belts and heavy motors beneath the scrap lines.',
    ambience: true,
  },
  rooftops: {
    name: 'Rooftops',
    area: 'rooftops',
    description: 'Wind above the city and the last machinery still running.',
    ambience: true,
  },
} satisfies Record<string, { name: string; area: AreaId; description: string; ambience: boolean }>;
export type AudioLabScene = keyof typeof AUDIO_LAB_SCENES;
export function audioLabOptions(url: URL) {
  const params = url.searchParams;
  const scene = params.get('scene') ?? 'direction';
  let valid = Object.hasOwn(AUDIO_LAB_SCENES, scene);
  params.forEach((value, key) => {
    if (!['scene', 'mono', 'power'].includes(key) || params.getAll(key).length !== 1) valid = false;
    if (['mono', 'power'].includes(key) && !['0', '1'].includes(value)) valid = false;
  });
  return {
    scene: valid ? (scene as AudioLabScene) : ('direction' as const),
    mono: valid && params.get('mono') === '1',
    power: !valid || params.get('power') !== '0',
    valid,
  };
}
