import { OVERTIME_BUILDS, overtimeBuild } from './overtime-balance.ts';
import { planWelder } from './welder-layout.ts';
import type { Checkpoint } from './rules.ts';

export function welderTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'welder') return null;
  let invalid = false;
  p.forEach((_, k) => {
    if (!['test', 'build', 'area', 'v'].includes(k) || p.getAll(k).length !== 1) invalid = true;
  });
  const build = p.get('build') ?? 'precision';
  const areas = ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'];
  const area = areas.indexOf(p.get('area') ?? 'docks');
  if (invalid || area < 0 || !Object.hasOwn(OVERTIME_BUILDS, build)) return null;
  for (let n = 0; n < 1000; n++) {
    const seed = 'WELDER-' + n;
    const welder = planWelder(seed);
    if (!welder || Math.floor(welder.stage / 4) !== area) continue;
    return { ...overtimeBuild(build, welder.stage, seed), version: 6, welder };
  }
  return null;
}
