export const SHIFT_MODS = [
  {
    id: 'polarity-rounds',
    name: 'Polarity Rounds',
    mark: 'polarity-rounds',
    description:
      'Alternate positive and negative charges. Nearby charged machines attract opposites and repel matching poles. Heavy machines resist movement.',
  },
  {
    id: 'ricochet-harness',
    name: 'Ricochet Harness',
    mark: 'ricochet-harness',
    description:
      'A fast recoil collision rebounds you from terrain. One rebound per discharge; ordinary walking and landings stay steady.',
  },
  {
    id: 'spring-rivets',
    name: 'Spring Rivets',
    mark: 'spring-rivets',
    description:
      'Your first airborne surface hit fits a temporary launch pad. Jump from it to launch outward. Keep two pads.',
  },
  {
    id: 'slip-gauge',
    name: 'Slip Gauge',
    mark: 'slip-gauge',
    description:
      'Narrowly dodge a small hostile round to charge one directional air burst. Your next airborne jump spends it; no invulnerability.',
  },
  {
    id: 'wake-wire',
    name: 'Wake Wire',
    mark: 'wake-wire',
    description:
      'Recoil flight draws a short energized ribbon. Release fire to arm your path briefly. Terrain blocks it; each enemy is struck once.',
  },
  {
    id: 'false-silhouette',
    name: 'False Silhouette',
    mark: 'false-silhouette',
    description:
      'Reverse recoil flight to leave a brief decoy that draws a patrol’s next shot. Existing warnings keep their aim.',
  },
  {
    id: 'gimbal-mount',
    name: 'Gimbal Mount',
    mark: 'gimbal-mount',
    description:
      'Hold a movement direction to steer recoil along it while the gun keeps aiming. Neutral input keeps normal recoil.',
  },
  {
    id: 'momentum-exchange',
    name: 'Momentum Exchange',
    mark: 'momentum-exchange',
    description:
      'One direct airborne hit transfers some velocity between you and a machine. Heavy machines receive a small push without losing their attack.',
  },
  {
    id: 'offset-nozzle',
    name: 'Offset Nozzle',
    mark: 'offset-nozzle',
    description:
      'A scenery hit anchors a short-lived remote muzzle. Your next complete discharge fires there while your body keeps its recoil.',
  },
  {
    id: 'momentum-battery',
    name: 'Momentum Battery',
    mark: 'momentum-battery',
    description:
      'Grounded firing banks a bounded part of recoil. Your next grounded jump releases the reserve into its launch.',
  },
  {
    id: 'piston-lance',
    name: 'Piston Lance',
    mark: 'piston-lance',
    description:
      'Short piston strokes carry 25% stronger round, shell or ball payloads and one extra penetration. Beams gain 35% energy. Your pattern stays; reach is short.',
  },
  {
    id: 'cable-saw',
    name: 'Cable Saw',
    mark: 'cable-saw',
    description:
      'Cast short-range blades with one extra penetration and one 50%-power return strike. Recall keeps its native return; beams gain 35% energy. Cover blocks the cable.',
  },
  {
    id: 'seeker-rack',
    name: 'Seeker Rack',
    mark: 'seeker-rack',
    description:
      'Hold fire to paint exposed targets, then release your native salvo toward the locks. Locking takes time; missiles still strike cover.',
  },
  {
    id: 'foamcaster',
    name: 'Foamcaster',
    mark: 'foamcaster',
    description:
      'Your impacts fit brief foam cover and small supported platforms. Keep three; entrances and occupied space remain clear.',
  },
  {
    id: 'catch-chamber',
    name: 'Catch Chamber',
    mark: 'catch-chamber',
    description:
      'Catch a safely intercepted enemy round beside your parked ammunition. Release the captured payload with your next volley. Capture is bounded.',
  },
  {
    id: 'gate-snare',
    name: 'Gate Snare',
    mark: 'gate-snare',
    description:
      'Route one explosive tripwire through your portal pair. Two visible segments share one trap; moving the pair breaks it, ready to be rebuilt.',
  },
  {
    id: 'hot-wire',
    name: 'Hot Wire',
    mark: 'hot-wire',
    description:
      'Cut your live enemy cable to heat it into a brief damaging line. Part of that beam’s energy powers the moving cable.',
  },
  {
    id: 'ghost-shift',
    name: 'Ghost Shift',
    mark: 'ghost-shift',
    description:
      'Your rebooted ally repeats a bounded delayed version of your actual volley from its position, replacing its ordinary gun.',
  },
  {
    id: 'windmill',
    name: 'Windmill',
    mark: 'windmill',
    description:
      'A spent saw caught in your gust becomes a short-lived airborne cutting trap. Only a few windmills can remain active.',
  },
  {
    id: 'scrap-comet',
    name: 'Scrap Comet',
    mark: 'scrap-comet',
    description:
      'Charged steel balls gather nearby loose debris. The heavy cluster loses speed and banks, then sheds debris on impact.',
  },
] as const;
export type ShiftModId = (typeof SHIFT_MODS)[number]['id'];
export const SHIFT_MORPHS = ['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'] as const;
export type ShiftMorphId = (typeof SHIFT_MORPHS)[number];
export const SHIFT_FUSIONS: Readonly<Record<string, readonly string[]>> = {
  'catch-chamber': ['suspension', 'countershot'],
  'gate-snare': ['fold', 'tripwire'],
  'hot-wire': ['cutting-torch', 'tether'],
  'ghost-shift': ['spoof', 'afterimage'],
  windmill: ['crosswind', 'grindshot'],
  'scrap-comet': ['mass-driver', 'arc-coil'],
};
export const isShiftMod = (id: string) => SHIFT_MODS.some((m) => m.id === id);
export const isShiftMorph = (id: string): id is ShiftMorphId =>
  (SHIFT_MORPHS as readonly string[]).includes(id);
export const SHIFT_RULESET = 107;
export const SHIFT_DAILY_RULESET = 91;
export function shiftCampaign(seed: string) {
  if (typeof seed !== 'string') return false;
  const match = /^RF-([CD])(\d+)-/.exec(seed);
  return (
    seed.startsWith('SHIFT-') ||
    (!!match && Number(match[2]) >= (match[1] === 'C' ? SHIFT_RULESET : SHIFT_DAILY_RULESET))
  );
}
export function shiftOfferAllowed(id: string, seed?: string, stage = 20) {
  return (
    !isShiftMod(id) ||
    ((!seed || shiftCampaign(seed)) &&
      stage >= (isShiftMorph(id) ? 5 : Object.hasOwn(SHIFT_FUSIONS, id) ? 7 : 4))
  );
}
export function compatibleShift(mods: readonly string[], id: string) {
  return !isShiftMorph(id) || !mods.some((m) => m !== id && isShiftMorph(m));
}
