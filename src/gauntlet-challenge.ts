import {
  GAUNTLET_RULES,
  isGauntletTier,
  validRemixRoute,
  validGauntletRecord,
  type GauntletRecord,
  type GauntletChoice,
  type GauntletTier,
} from './gauntlet-rules.ts';
import { isBossRemix, type BossRemixId } from './boss-remix-rules.ts';
import { isStartingGun, type StartingGun } from './starting-guns.ts';
import { loadWeaponUnlocks, unlockedStartingGuns } from './weapon-unlocks.ts';

export const GAUNTLET_CODE_LIMIT = 2048;
export interface GauntletChallenge {
  rules: number;
  gun: StartingGun;
  route: GauntletChoice[];
  tier: GauntletTier;
  timeMs: number;
  hits: number;
}
export function validGauntletChallenge(raw: unknown): raw is GauntletChallenge {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const c = raw as GauntletChallenge;
  return (
    Object.keys(c).length === 6 &&
    ['rules', 'gun', 'route', 'tier', 'timeMs', 'hits'].every((key) => Object.hasOwn(c, key)) &&
    c.rules === GAUNTLET_RULES &&
    isStartingGun(c.gun) &&
    validRemixRoute(c.route) &&
    isGauntletTier(c.tier) &&
    Number.isSafeInteger(c.timeMs) &&
    c.timeMs > 0 &&
    c.timeMs <= 86400000 &&
    Number.isSafeInteger(c.hits) &&
    c.hits >= 0 &&
    c.hits <= 100000
  );
}
export function gauntletChallengeFromRecord(record: GauntletRecord): GauntletChallenge {
  if (!validGauntletRecord(record) || record.mode !== 'remix')
    throw new Error('Complete a Remix Gauntlet to share its challenge.');
  return {
    rules: record.rules,
    gun: record.gun,
    route: [...record.route],
    tier: record.tier!,
    timeMs: record.timeMs,
    hits: record.hits,
  };
}
export function gauntletChallengeCode(c: GauntletChallenge) {
  if (!validGauntletChallenge(c)) throw new Error('This Gauntlet challenge is not supported.');
  const bytes = new TextEncoder().encode(
    JSON.stringify([c.rules, c.gun, c.route, c.tier, c.timeMs, c.hits]),
  );
  return (
    'RFG1.' +
    btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  );
}
export function parseGauntletChallenge(text: string): GauntletChallenge {
  const code = text.trim();
  if (code.length > GAUNTLET_CODE_LIMIT || !/^RFG1\.[A-Za-z0-9_-]+$/.test(code))
    throw new Error('Enter a valid RFG1 Gauntlet challenge code.');
  try {
    const binary = atob(code.slice(5).replace(/-/g, '+').replace(/_/g, '/'));
    const data: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(binary, (c) => c.charCodeAt(0)),
      ),
    );
    if (!Array.isArray(data) || data.length !== 6) throw new Error();
    const challenge = {
      rules: data[0],
      gun: data[1],
      route: data[2],
      tier: data[3],
      timeMs: data[4],
      hits: data[5],
    };
    if (!validGauntletChallenge(challenge) || gauntletChallengeCode(challenge) !== code)
      throw new Error();
    return challenge;
  } catch {
    throw new Error('This Gauntlet challenge code is damaged or unsupported.');
  }
}
export function gauntletChallengeAccess(
  c: GauntletChallenge,
  profile: unknown,
  seen: readonly BossRemixId[],
) {
  const access = loadWeaponUnlocks(profile),
    gun = unlockedStartingGuns(access).includes(c.gun),
    missing = c.route.filter((id) => isBossRemix(id) && !seen.includes(id)).length;
  return {
    cleared: access.cleared,
    gun,
    missing,
    allowed: validGauntletChallenge(c) && access.cleared && gun && missing === 0,
  };
}
export function gauntletChallengeUrl(base: string, c: GauntletChallenge) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('gauntlet', gauntletChallengeCode(c));
  return url.href;
}
export function gauntletChallengeFromUrl(url: URL): GauntletChallenge | null {
  const p = url.searchParams;
  let valid = true;
  p.forEach((_, key) => {
    if (!['gauntlet', 'v'].includes(key) || p.getAll(key).length !== 1) valid = false;
  });
  if (!valid || !p.has('gauntlet') || (p.has('v') && p.get('v') !== '1')) return null;
  try {
    return parseGauntletChallenge(p.get('gauntlet')!);
  } catch {
    return null;
  }
}
