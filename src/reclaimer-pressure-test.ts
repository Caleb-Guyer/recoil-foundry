import Matter from 'matter-js';
import type { Game } from './game.ts';
import { availableMods, validBuild, type Checkpoint } from './rules.ts';
import { testCheckpoint } from './practice.ts';
import { loadUnlocks } from './longevity.ts';
import { UPRISING_CONTRACTS, type UprisingRouteId } from './uprising-model.ts';

export const RECLAIMER_PRESSURE_FORMS = ['Chassis', 'Siege', 'Rupture'] as const;
export const RECLAIMER_PRESSURE_ROUTES = [
  'standard',
  'isolated',
  'hunted',
  'mutiny',
  'overloaded',
] as const;
export const RECLAIMER_PRESSURE_SPOTS = ['entry', 'right', 'cover', 'upper'] as const;
export const RECLAIMER_REPORTED_MODS = [
  'airshot',
  'cutting-torch',
  'thermal-runaway',
  'deadeye',
  'rivet',
  'leech',
  'recoil-runner',
  'execute',
  'heat-relay',
  'cinder',
  'spoof',
  'heat-exchanger',
  'fracture',
  'insulated-line',
  'capacitor',
  'far-sight',
  'flashpoint',
  'deadlock',
  'reserve-cell',
  'field-patch',
  'light',
  'scrap-armor',
] as const;
type PressureRoute = (typeof RECLAIMER_PRESSURE_ROUTES)[number];
type PressureSpot = (typeof RECLAIMER_PRESSURE_SPOTS)[number];
export interface ReclaimerPressureFixture {
  checkpoint: Checkpoint;
  phase: 0 | 1 | 2;
  overtime: boolean;
  mirror: boolean;
  route: PressureRoute;
  build: 'standard' | 'reported';
  spot: PressureSpot;
  title: string;
  hint: string;
}
const routeChoices: Record<Exclude<PressureRoute, 'standard'>, UprisingRouteId[]> = {
  isolated: ['rail-heist', 'core-sabotage', 'crew-relief', 'signal-cut'],
  hunted: ['rail-heist', 'core-defense', 'scrap-raid', 'roof-escape'],
  mutiny: ['rail-guard', 'core-defense', 'crew-relief', 'roof-relief'],
  overloaded: ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'],
};
/** Explicit previews retain the native gun, route effects, collision and attack timings. */
export function reclaimerPressureTestFromUrl(url: URL): ReclaimerPressureFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'reclaimer' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (
      !['test', 'phase', 'fight', 'route', 'build', 'spot', 'mirror', 'v'].includes(key) ||
      p.getAll(key).length !== 1
    )
      invalid = true;
  });
  const rawPhase = p.get('phase') ?? '1',
    fight = p.get('fight') ?? 'campaign',
    route = (p.get('route') ?? 'standard') as PressureRoute,
    build = (p.get('build') ?? 'standard') as ReclaimerPressureFixture['build'],
    spot = (p.get('spot') ?? 'entry') as PressureSpot,
    mirror = p.get('mirror') ?? '0';
  if (
    invalid ||
    !['1', '2', '3'].includes(rawPhase) ||
    !['campaign', 'overtime'].includes(fight) ||
    !RECLAIMER_PRESSURE_ROUTES.includes(route) ||
    !['standard', 'reported'].includes(build) ||
    !RECLAIMER_PRESSURE_SPOTS.includes(spot) ||
    !['0', '1'].includes(mirror) ||
    (fight === 'overtime' && route !== 'standard')
  )
    return null;
  const phase = (Number(rawPhase) - 1) as 0 | 1 | 2,
    overtime = fight === 'overtime',
    seed = `RF-C107-F-${overtime ? 'O' : 'C'}-${rawPhase}-A-0-${mirror}`;
  const cp: Checkpoint = {
    ...testCheckpoint(seed, 19),
    version: 6,
    startingGun: 'pistol',
    finaleFirstClear: overtime ? 0 : 1,
  };
  if (build === 'reported') {
    cp.startingGun = 'twinbore';
    cp.mods = [...RECLAIMER_REPORTED_MODS];
    // The report has three extra fittings. A fixture can carry those legal
    // detour rewards without inventing earned records on the player's profile.
    cp.detours = [0, 1, 2];
  }
  if (route !== 'standard') {
    const choices = [...routeChoices[route]];
    cp.uprising = {
      version: 3,
      choices,
      outcomes: choices.map((id) => ({
        route: id,
        result: route === 'overloaded' ? 'failed' : 'success',
      })),
      unlocks: UPRISING_CONTRACTS.map((contract) => contract.id),
    };
  }
  if (overtime) {
    cp.overtime = { baseMods: cp.mods.length, repairs: 0, remix: 5 };
    for (let room = 0; room < 19; room++) {
      const next = availableMods(cp.mods)[0];
      if (!next) throw new Error('No legal Overtime fitting for Reclaimer preview');
      cp.mods.push(next.id);
    }
  }
  cp.unlocks = loadUnlocks(cp.mods);
  if (!validBuild(cp.mods)) return null;
  const title = 'The Reclaimer / ' + RECLAIMER_PRESSURE_FORMS[phase],
    hint =
      (overtime ? 'New Game+' : 'Campaign') +
      ' / ' +
      (route === 'standard' ? 'ordinary defense' : route + ' defense') +
      ' / ' +
      (build === 'reported'
        ? 'reported Twinbore beam' + (overtime ? ' plus Overtime fittings' : '')
        : 'Service pistol build') +
      '. Test the firing lanes and keep moving after warnings lock. This isolated test leaves Continue, unlocks and records untouched.';
  return {
    checkpoint: cp,
    phase,
    overtime,
    mirror: mirror === '1',
    route,
    build,
    spot,
    title,
    hint,
  };
}
/** Called on every explicit test start/retry, never on a normal Campaign or Continue. */
export function prepareReclaimerPressureTest(g: Game, fixture: ReclaimerPressureFixture | null) {
  if (
    !fixture ||
    !g.testRun ||
    g.testRun.seed !== fixture.checkpoint.seed ||
    g.stage !== 19 ||
    g.escape ||
    !g.finale.cinema
  )
    return false;
  const cinema = g.finale.cinema;
  cinema.enterForm(fixture.phase);
  const canonical =
    fixture.spot === 'entry'
      ? { x: 600, y: 718 }
      : fixture.spot === 'right'
        ? { x: 1530, y: 718 }
        : fixture.spot === 'cover'
          ? { x: fixture.phase === 0 ? 1270 : 1700, y: 718 }
          : fixture.phase === 0
            ? { x: 1230, y: 452 }
            : fixture.phase === 1
              ? { x: 1110, y: 439 }
              : { x: 1350, y: 447 };
  Matter.Body.setPosition(g.player, { x: cinema.x(canonical.x), y: canonical.y });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = true;
  g.level.name = fixture.title;
  return true;
}
