import type { Checkpoint } from './rules.ts';
import {
  UPRISING_ROUTES,
  UPRISING_FORKS,
  UPRISING_FINALES,
  UPRISING_CONTRACTS,
  newUprising,
  uprisingRoute,
  type UprisingRouteId,
} from './uprising-model.ts';

// Isolated previews use the real systems but never write profile progress.
export function uprisingTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'route', 'v'].includes(key) || p.getAll(key).length !== 1) invalid = true;
  });
  if (p.get('test') !== 'uprising' || invalid || p.get('v') !== '1') return null;
  const route = p.get('route');
  const defaults: UprisingRouteId[] = ['rail-escape', 'core-defense', 'crew-relief', 'roof-escape'];
  const choose = [
    'choose',
    'choose-core',
    'choose-reclamation',
    'choose-rooftops',
    'choose-unlocked',
  ].indexOf(route ?? '');
  if (choose !== -1) {
    const index = choose === 4 ? 0 : choose;
    const uprising = newUprising();
    uprising.choices = defaults.slice(0, index);
    uprising.outcomes = uprising.choices.map((route) => ({ route, result: 'success' }));
    if (choose === 4) uprising.unlocks = UPRISING_CONTRACTS.map((c) => c.id);
    return {
      version: 6,
      seed: 'UPRISING-' + route,
      stage: UPRISING_FORKS[index],
      hp: 100,
      mods: index ? ['magnum', 'light', 'airshot'] : [],
      kills: 0,
      elapsed: 0,
      uprising,
      reward: {
        offers: index ? ['rapid', 'ricochet', 'pierce'] : ['magnum', 'ricochet', 'light'],
        rerolled: false,
      },
    };
  }
  const job = UPRISING_ROUTES.find((r) => r.id === route),
    finale = UPRISING_FINALES.find((f) => f === route);
  if (!job && !finale) return null;
  if (finale === 'isolated') defaults[1] = 'core-sabotage';
  if (finale === 'hunted') defaults[0] = 'rail-heist';
  const index = job ? defaults.findIndex((id) => uprisingRoute(id).fork === job.fork) : 3;
  if (job) defaults[index] = job.id;
  const choices = defaults.slice(0, index + 1),
    uprising = newUprising(null, choices);
  uprising.choices = choices;
  uprising.outcomes = choices
    .slice(0, job ? -1 : undefined)
    .map((id) => ({ route: id, result: finale === 'overloaded' ? 'failed' : 'success' }));
  return {
    version: 6,
    seed: 'UPRISING-' + route,
    stage: job ? job.fork + 1 : 19,
    hp: 100,
    mods:
      job && job.district === 'railworks'
        ? ['magnum', 'light', 'airshot']
        : ['magnum', 'light', 'airshot', 'rapid', 'scatter', 'ricochet', 'pierce', 'leech'],
    kills: 0,
    elapsed: 0,
    uprising,
  };
}
