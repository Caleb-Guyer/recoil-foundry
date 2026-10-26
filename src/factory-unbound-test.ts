import { SHIFT_MODS, SHIFT_FUSIONS, type ShiftModId } from './shift-catalog.ts';
import { SHIFT_ROUTE_IDS, SHIFT_ROUTE_NAMES, type ShiftRouteId } from './shift-route-layouts.ts';
import { STARTING_GUN_IDS, isStartingGun, type StartingGun } from './starting-guns.ts';
import { withParents } from './branch-builds.ts';
import { availableMods, validBuild, type Checkpoint } from './rules.ts';

export const FACTORY_UNBOUND_FORMS = ['rounds', 'beam', 'shell', 'ball'] as const;
export type FactoryUnboundForm = (typeof FACTORY_UNBOUND_FORMS)[number];
const SYSTEMS = ['lease', 'power', 'experiment'] as const;
const CIRCUITS = ['transport', 'security', 'reclamation'] as const;
export const FACTORY_UNBOUND_EVOLUTIONS = {
  'double-return': 'ricochet-harness',
  'impact-echo': 'ricochet-harness',
  'twin-mounts': 'spring-rivets',
  'loaded-spring': 'spring-rivets',
  'deep-reserve': 'slip-gauge',
  counterstep: 'slip-gauge',
} as const;
type Evolution = keyof typeof FACTORY_UNBOUND_EVOLUTIONS;
export type FactoryUnboundScene =
  | ShiftModId
  | ShiftRouteId
  | (typeof SYSTEMS)[number]
  | (typeof CIRCUITS)[number]
  | Evolution;
export const FACTORY_UNBOUND_CONCEPTS: readonly FactoryUnboundScene[] = Object.freeze([
  ...SHIFT_MODS.map((m) => m.id),
  ...SHIFT_ROUTE_IDS,
  ...SYSTEMS,
]);
export const FACTORY_UNBOUND_SCENES: readonly FactoryUnboundScene[] = Object.freeze([
  ...FACTORY_UNBOUND_CONCEPTS,
  ...CIRCUITS,
  ...(Object.keys(FACTORY_UNBOUND_EVOLUTIONS) as Evolution[]),
]);
export interface FactoryUnboundIdentity {
  scene: FactoryUnboundScene;
  gun: StartingGun;
  form: FactoryUnboundForm;
}
export interface FactoryUnboundFixture {
  checkpoint: Checkpoint;
  title: string;
  hint: string;
}
const EXTRA_NAMES: Record<string, string> = {
  lease: 'Prototype Lease',
  power: 'Power Routing',
  experiment: 'Experimental Fittings',
  transport: 'Transport Circuit',
  security: 'Security Circuit',
  reclamation: 'Reclamation Circuit',
  'double-return': 'Double Return',
  'impact-echo': 'Impact Echo',
  'twin-mounts': 'Twin Mounts',
  'loaded-spring': 'Loaded Spring',
  'deep-reserve': 'Deep Reserve',
  counterstep: 'Counterstep',
};
const HINTS: Record<string, string> = {
  'polarity-rounds':
    'Hit two nearby machines with alternating poles; compare attraction with matching-pole repulsion.',
  'ricochet-harness':
    'Jump and fire away from a wall to recoil into it. A paid discharge can earn one real terrain rebound.',
  'spring-rivets':
    'Hit a surface while airborne to fit a temporary spring pad, then jump from the pad. Extra pellets do not multiply pads.',
  'slip-gauge':
    'Let a small hostile round pass close without touching you, then jump while airborne to spend the earned directional burst.',
  'wake-wire':
    'Fire while flying across open space; release fire to arm the path behind you. Cover blocks the energized ribbon.',
  'false-silhouette':
    'Reverse your recoil flight to leave a brief decoy. New patrol shots can choose it; existing warnings keep their locked aim.',
  'gimbal-mount':
    'Hold a movement direction while firing elsewhere. Your recoil follows the movement input while the gun keeps its aim.',
  'momentum-exchange':
    'Build airborne speed, then directly hit a machine. Compare the real velocity transfer; heavy hulls resist the push.',
  'offset-nozzle':
    'Shoot scenery to anchor a remote muzzle. Your next whole discharge leaves that anchor while your body still takes its recoil.',
  'momentum-battery':
    'Fire on the ground to bank recoil, then make a grounded jump to release the reserve. Repeated pellets share one discharge.',
  'piston-lance':
    'Get within piston reach and fire. Watch the extension and committed return; your starting tool and spread remain active.',
  'cable-saw':
    'Cast the saws, then sweep your aim during their outward travel. They cut again on their actual return and stop at cover.',
  'seeker-rack':
    'Hold fire over exposed targets until their locks fill, then release the trigger to launch the real selected-tool salvo.',
  foamcaster:
    'Shoot a clear supported surface to fit temporary foam. Use the small platform or cover before it expires; occupied space is protected.',
  'catch-chamber':
    'Park ammunition with Suspension. Let a small enemy round reach its interception area, then release the captured payload with your next volley.',
  'gate-snare':
    'Place a portal pair and route one Tripwire trap through it. Its two visible segments share one trigger and explosion.',
  'hot-wire':
    'Latch a live enemy tether, then cut that actual cable with your beam. The heated line uses part of the beam energy and respects cover.',
  'ghost-shift':
    'Reboot a machine with Spoof, then fire a real volley. Your ally repeats a bounded delayed volley from its own position.',
  windmill:
    'Make a Crosswind gust and spend a Grindshot saw inside it. A caught saw becomes a brief airborne cutting trap.',
  'scrap-comet':
    'Charge and fire a steel ball near loose crates or debris. The cluster gathers real loose props, slows, then sheds them on impact.',
  'vacuum-docks':
    'Low gravity and weaker air drag change real recoil flight. Use the permanent floor to recover; shoot upward to push yourself down.',
  'turntable-works':
    'Jump beside a nearby ROTATE console to index its real platform by ninety degrees. Occupied sweeps wait rather than crushing actors.',
  'prism-glassworks':
    'Jump beside TURN consoles to rotate real mirrors. Ordinary rounds and beams reflect at their actual faces; earlier cover still blocks them.',
  'express-airlocks':
    'Jump beside OPEN controls to advance early. Surviving patrols remain alive and follow through; all chambers must eventually be cleared.',
  'rework-loop':
    'Return through an actual damaged earlier room from the opposite side. Its surviving terrain and prop damage remain; a fresh patrol must be defeated.',
  lease:
    'At the service junction, borrow a morph for two real room clears. Return it for service, or keep it in place of your next ordinary fitting.',
  power:
    'At the service junction, choose Transport, Security or Reclamation. The useful machinery and its associated threat persist across three ordinary rooms.',
  experiment:
    'Choose an experimental fitting, perform its three real movement triggers, then select one of its two physical evolutions.',
  transport:
    'The Transport circuit adds real lift and vent machinery. Use it to move while accounting for the same machinery during combat.',
  security:
    'The Security circuit adds an operable physical shutter and a warned security lamp. Use the shutter as cover or destroy the lamp.',
  reclamation:
    'The Reclamation circuit adds a real press and a limited repair station. Choose when to use the machinery and when to withdraw.',
  'double-return':
    'Earn three Ricochet Harness rebounds, then choose Double Return. Each later paid discharge can earn two separate terrain rebounds.',
  'impact-echo':
    'Earn three Ricochet Harness rebounds, then choose Impact Echo. A rebound creates a short cover-blocked impact nearby.',
  'twin-mounts':
    'Launch from three real Spring Rivets pads, then choose Twin Mounts to keep four physical pads instead of two.',
  'loaded-spring':
    'Launch from three real Spring Rivets pads, then choose Loaded Spring for stronger supported launches.',
  'deep-reserve':
    'Earn and spend three Slip Gauge dodge charges, then choose Deep Reserve to retain two separately earned short-lived charges.',
  counterstep:
    'Earn and spend three Slip Gauge dodge charges, then choose Counterstep for one short aimed counter-round per dodge burst.',
};
const requiredForm = (scene: FactoryUnboundScene): FactoryUnboundForm | undefined =>
  scene === 'hot-wire' ? 'beam' : scene === 'scrap-comet' ? 'ball' : undefined;
const formMod: Partial<Record<FactoryUnboundForm, string>> = {
  beam: 'cutting-torch',
  shell: 'shellshock',
  ball: 'mass-driver',
};
const isRoute = (scene: string): scene is ShiftRouteId =>
  (SHIFT_ROUTE_IDS as readonly string[]).includes(scene);
const isJunction = (scene: string) =>
  [...SYSTEMS, ...CIRCUITS, ...Object.keys(FACTORY_UNBOUND_EVOLUTIONS)].includes(scene);
function seedFor({ scene, gun, form }: FactoryUnboundIdentity) {
  return (
    'SHIFT-107-' +
    FACTORY_UNBOUND_SCENES.indexOf(scene).toString(36).toUpperCase().padStart(2, '0') +
    '-' +
    STARTING_GUN_IDS.indexOf(gun) +
    '-' +
    FACTORY_UNBOUND_FORMS.indexOf(form)
  );
}
export function factoryUnboundIdentity(seed: string): FactoryUnboundIdentity | null {
  const m = /^SHIFT-107-([0-9A-Z]{2})-([0-5])-([0-3])$/.exec(seed);
  if (!m) return null;
  const scene = FACTORY_UNBOUND_SCENES[parseInt(m[1], 36)],
    gun = STARTING_GUN_IDS[Number(m[2])],
    form = FACTORY_UNBOUND_FORMS[Number(m[3])];
  if (!scene || !gun || !form) return null;
  const identity = { scene, gun, form };
  return seedFor(identity) === seed ? identity : null;
}
/** Strict, isolated fixtures. No URL can grant a license, record or Campaign progress. */
export function factoryUnboundTestFromUrl(url: URL): FactoryUnboundFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'factory-unbound' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'scene', 'gun', 'form', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const scene = (p.get('scene') ?? 'polarity-rounds') as FactoryUnboundScene,
    gun = p.get('gun') ?? 'pistol',
    form = (p.get('form') ?? requiredForm(scene) ?? 'rounds') as FactoryUnboundForm;
  if (
    invalid ||
    !FACTORY_UNBOUND_SCENES.includes(scene) ||
    !isStartingGun(gun) ||
    !(FACTORY_UNBOUND_FORMS as readonly string[]).includes(form) ||
    (requiredForm(scene) && requiredForm(scene) !== form)
  )
    return null;
  const evolution = FACTORY_UNBOUND_EVOLUTIONS[scene as Evolution];
  const wanted: string[] = [];
  if (SHIFT_MODS.some((m) => m.id === scene)) wanted.push(scene);
  if (evolution) wanted.push(evolution);
  if (formMod[form]) wanted.push(formMod[form]!);
  const initial = withParents([], wanted);
  if (!initial) return null;
  const mods = [...initial],
    small = isRoute(scene) || isJunction(scene),
    limit = small ? 6 : 18;
  for (const id of ['scatter', 'magnum', 'rapid', 'kick', 'airshot', 'crossfire'])
    if (mods.length < limit && availableMods(mods, true).some((m) => m.id === id)) mods.push(id);
  if (!validBuild(mods) || mods.filter((id) => Object.hasOwn(SHIFT_FUSIONS, id)).length > 1)
    return null;
  const identity = { scene, gun, form },
    seed = seedFor(identity),
    stage = small ? 6 : Math.max(10, mods.length);
  const checkpoint: Checkpoint = {
    version: 6,
    seed,
    stage,
    startingGun: gun,
    mods,
    hp: 100,
    kills: 0,
    elapsed: 0,
    ...(stage > mods.length ? { missedUpgrades: stage - mods.length } : {}),
    factoryUnbound: { scene, form },
    ...(isRoute(scene) && scene !== 'rework-loop'
      ? {
          shiftRoute: {
            version: 1 as const,
            kind: scene,
            stage,
            ...(scene === 'turntable-works' ? { turns: [0, 0] } : {}),
            ...(scene === 'prism-glassworks' ? { mirrors: [0, 0, 0] } : {}),
            ...(scene === 'express-airlocks' ? { gates: 0, rush: 0 } : {}),
          },
        }
      : {}),
  };
  const title =
    SHIFT_MODS.find((m) => m.id === scene)?.name ??
    SHIFT_ROUTE_NAMES[scene as ShiftRouteId] ??
    EXTRA_NAMES[scene];
  return {
    checkpoint,
    title,
    hint: HINTS[scene] + ' This isolated test leaves Continue, unlocks and records untouched.',
  };
}
