import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import { seeded, distance, segmentBox } from './rules.ts';
import { squadSpawns } from './squads.ts';
import { isSupport, type SupportKind } from './teamwork.ts';

export function teamworkLevel(g: Game, level: Level): Level {
  if (
    !g.teamwork.enabled ||
    g.stage < 6 ||
    g.stage % 4 === 0 ||
    level.boss ||
    level.detour ||
    level.freight ||
    level.crossing ||
    level.annex ||
    level.story ||
    level.shutdown ||
    level.courier ||
    level.floodgate ||
    level.sortingPit ||
    level.uprising ||
    level.fabricatorIntro ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.harpoonIntro ||
    level.sapperIntro ||
    g.practice ||
    g.workshop.active ||
    g.escape ||
    g.overtime ||
    g.areaEvents.encounter ||
    (g.testRun && g.testRun.teamwork !== 1) ||
    level.spawns.some((s) => isSupport(s.kind))
  )
    return level;
  const random = seeded(g.roomSeed + ':teamwork-v1:' + g.stage);
  const intro = g.stage === 6 || g.stage === 10;
  if (!intro && random() >= 0.45) return level;
  const kind: SupportKind =
    g.stage < 10 ? 'repairer' : g.stage === 10 ? 'relay' : random() < 0.5 ? 'repairer' : 'relay';
  const squads = squadSpawns(level.spawns, level, g.roomSeed, g.stage).filter((s) => s.squad);
  const ordinary = (s: Spawn) =>
    !s.elite && !s.squad && !squads.some((p) => p.x === s.x && p.y === s.y);
  const candidates = level.spawns.filter(
    (s) =>
      ordinary(s) &&
      ['flyer', 'runner', 'shooter', 'hopper', 'borer', 'sifter', 'skimmer'].includes(s.kind) &&
      s.x >= 380 &&
      s.x <= 1720 &&
      !level.solids.some(
        (b) => s.x + 15 > b.x && s.x - 15 < b.x + b.w && s.y + 15 > b.y && s.y - 15 < b.y + b.h,
      ),
  );
  const pairs = candidates.flatMap((support) =>
    level.spawns
      .filter(
        (s) =>
          s !== support &&
          ordinary(s) &&
          (kind === 'relay'
            ? ['shooter', 'sniper', 'flyer', 'sifter', 'skimmer']
            : ['runner', 'shooter', 'charger', 'hopper', 'borer', 'sifter', 'skimmer']
          ).includes(s.kind) &&
          distance(support, s) >= 75 &&
          distance(support, s) <= 360 &&
          !level.solids.some((b) =>
            segmentBox(
              support,
              s,
              { x: b.x - 2, y: b.y - 2 },
              { x: b.x + b.w + 2, y: b.y + b.h + 2 },
            ),
          ),
      )
      .map((partner) => ({ support, partner })),
  );
  const chosen = intro
    ? pairs.sort((a, b) => a.support.x - b.support.x)[0]
    : pairs[Math.floor(random() * pairs.length)];
  if (!chosen) return level;
  return {
    ...level,
    ...(intro ? { teamworkIntro: kind } : {}),
    spawns: level.spawns.map((s) =>
      s === chosen.support
        ? { kind, x: s.x, y: s.y, teamwork: true }
        : { ...s, ...(s === chosen.partner ? { teamwork: true } : {}) },
    ),
  };
}
