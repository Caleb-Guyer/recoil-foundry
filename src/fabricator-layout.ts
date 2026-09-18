import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { seeded, sample, type Checkpoint } from './rules.ts';
import { squadSpawns } from './squads.ts';

export function fabricatorLevel(g: Game, level: Level): Level {
  if (
    !g.fabricators.enabled ||
    g.stage < 13 ||
    level.boss ||
    level.detour ||
    level.freight ||
    level.crossing ||
    level.setpiece ||
    level.courier ||
    level.floodgate ||
    g.practice ||
    g.workshop.active ||
    g.escape ||
    g.overtime ||
    g.areaEvents.encounter ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro ||
    (g.testRun && !g.seed.startsWith('FABRICATOR-85-'))
  )
    return level;
  const rng = seeded(g.roomSeed + ':fabricator-v1:' + g.stage);
  if (g.stage !== 13 && rng() >= (g.stage >= 16 ? 0.55 : 0.35)) return level;
  const paired = squadSpawns(level.spawns, level, g.roomSeed, g.stage).filter((s) => s.squad);
  const candidates = level.spawns.filter(
    (s) =>
      !s.elite &&
      !s.squad &&
      ['runner', 'shooter', 'charger', 'hopper', 'borer'].includes(s.kind) &&
      !paired.some((p) => p.x === s.x && p.y === s.y) &&
      s.x >= 380 &&
      s.x <= 1740,
  );
  // Preserve the authored footprint and support, and put the introduction near the entrance.
  const chosen =
    g.stage === 13 ? candidates.sort((a, b) => a.x - b.x)[0] : sample(candidates, 1, rng)[0];
  if (!chosen) return level;
  return {
    ...level,
    fabricatorIntro: g.stage === 13,
    spawns: level.spawns.map((s) =>
      s === chosen ? { kind: 'fabricator', x: s.x, y: s.y } : { ...s },
    ),
  };
}

export function fabricatorTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  if (p.get('test') !== 'fabricator' || p.getAll('test').length !== 1) return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'build', 'mirror', 'v'].includes(key)) invalid = true;
  });
  if (invalid) return null;
  if (
    (p.has('build') &&
      (p.getAll('build').length !== 1 ||
        !['standard', 'beam', 'portal', 'starter'].includes(p.get('build')!))) ||
    (p.has('mirror') && (p.getAll('mirror').length !== 1 || p.get('mirror') !== '1'))
  )
    return null;
  const mods =
    p.get('build') === 'starter'
      ? []
      : ['magnum', 'light', 'airshot', 'rapid', 'kick', 'landing', 'pierce'];
  if (p.get('build') === 'beam') mods.splice(3, 1, 'cutting-torch');
  if (p.get('build') === 'portal') mods.splice(3, 1, 'fold');
  return {
    version: 6,
    fabricators: true,
    seed: 'FABRICATOR-85-' + (p.has('mirror') ? '0' : '4'),
    stage: 13,
    hp: 100,
    mods,
    kills: 0,
    elapsed: 0,
  };
}
