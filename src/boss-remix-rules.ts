import { seeded } from './rules.ts';
import type { Encounter } from './practice.ts';
import type { Game } from './game.ts';

export const BOSS_REMIXES_KEY = 'rf-boss-remixes-v1';
export const BOSS_REMIXES = {
  'loader-crossdock': {
    boss: 'loader',
    stage: 3,
    name: 'Crossdock',
    hint: 'Three cargo braces. A ram, then a warned fan. Break a brace to drop its load.',
  },
  'loader-switchyard': {
    boss: 'loader',
    stage: 3,
    name: 'Switchyard',
    hint: 'Ride the transfer lift. Two rams lead into a warned fan; crashed rams expose the engine.',
  },
  'press-split-die': {
    boss: 'press',
    stage: 7,
    name: 'Split Die',
    hint: 'Slams alternate with warned fans. Shoot a ready steam valve to expose the press.',
  },
  'press-stamping-line': {
    boss: 'press',
    stage: 7,
    name: 'Stamping Line',
    hint: 'Two slams, then a warned fan. Low decks and a steam lane reward changing height.',
  },
  'condenser-cold-circuit': {
    boss: 'condenser',
    stage: 11,
    name: 'Cold Circuit',
    hint: 'Two aimed cycles, then one purge with four gaps. Shoot the central valve to open its shutters.',
  },
  'condenser-purge-chamber': {
    boss: 'condenser',
    stage: 11,
    name: 'Purge Chamber',
    hint: 'Two purges have wide, shifting gaps. Side valves open its shutters; dry decks cross the coolant.',
  },
} as const;
export type BossRemixId = keyof typeof BOSS_REMIXES;
export type RemixBoss = (typeof BOSS_REMIXES)[BossRemixId]['boss'];
export const REMIX_IDS = Object.keys(BOSS_REMIXES) as BossRemixId[];
export const isBossRemix = (id: unknown): id is BossRemixId =>
  typeof id === 'string' && Object.hasOwn(BOSS_REMIXES, id);
export function bossRemixFor(seed: string, boss: string): BossRemixId | undefined {
  const choices = REMIX_IDS.filter((id) => BOSS_REMIXES[id].boss === boss);
  return choices[Math.floor(seeded(seed + ':boss-remix-v1:' + boss)() * choices.length)];
}
export function remixEncounter(id: BossRemixId): Encounter {
  return { kind: BOSS_REMIXES[id].boss, seed: 'REMIX-' + id, remix: id };
}
export interface BossRemixProfile {
  version: 1;
  seen: BossRemixId[];
}
export function loadBossRemixes(raw: unknown): BossRemixProfile {
  const p = raw as Partial<BossRemixProfile> | null;
  return {
    version: 1,
    seen:
      p?.version === 1 && Array.isArray(p.seen)
        ? [...new Set(p.seen.filter(isBossRemix))].slice(0, REMIX_IDS.length)
        : [],
  };
}
export function validBossRemixes(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const p = raw as BossRemixProfile,
    clean = loadBossRemixes(raw);
  return (
    p.version === 1 &&
    Object.keys(p).every((k) => ['version', 'seen'].includes(k)) &&
    Array.isArray(p.seen) &&
    JSON.stringify(p.seen) === JSON.stringify(clean.seen)
  );
}
export function recordBossRemix(raw: unknown, game: Game, cleared: boolean): BossRemixProfile {
  const p = loadBossRemixes(raw),
    id = game.level.bossRemix;
  if (
    cleared &&
    game.bossRemixes &&
    !game.practice &&
    !game.testRun &&
    !game.workshop.active &&
    !game.overtime &&
    !game.escape &&
    !game.detour &&
    game.mode === 'playing' &&
    game.hp > 0 &&
    id &&
    game.enemies.some((e) => e.kind === BOSS_REMIXES[id].boss && e.spawn <= 0 && e.hp > 0) &&
    !p.seen.includes(id)
  )
    p.seen.push(id);
  return p;
}
export function remixEncounters(raw: unknown, cleared: boolean): Encounter[] {
  return cleared ? loadBossRemixes(raw).seen.map(remixEncounter) : [];
}
