import type { Checkpoint } from './rules.ts';
import type { Game } from './game.ts';

export const SECURITY_KEY = 'rf-security-v1';
export const SECURITY_RULES = 1;
export type SecurityLevel = 0 | 1 | 2 | 3;
export const SECURITY_LEVELS = [
  { name: 'Standard', description: 'The original twenty-room shift.' },
  {
    name: 'Security I · Reinforced',
    description: 'Coordinated elite squads guard selected rooms.',
  },
  {
    name: 'Security II · Adapted',
    description: 'Reinforced squads. Bosses chain warned counterattacks.',
  },
  {
    name: 'Security III · Redline',
    description: 'Adapted bosses. Machinery checkpoints across the factory.',
  },
] as const;
export interface SecurityRun {
  level: 1 | 2 | 3;
  rules: 1;
}
export interface SecurityScore {
  level: SecurityLevel;
  timeMs: number;
  seed: string;
}
export interface SecurityProfile {
  version: 1;
  unlocked: SecurityLevel;
  bests: SecurityScore[];
}
export function isSecurityLevel(value: unknown): value is SecurityLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}
export function validSecurityRun(save: Checkpoint) {
  const s = save.security;
  return (
    s === undefined ||
    (save.version === 6 &&
      !!s &&
      typeof s === 'object' &&
      s.rules === SECURITY_RULES &&
      isSecurityLevel(s.level) &&
      s.level > 0 &&
      !/^RF-D\d+-/.test(save.seed) &&
      Object.keys(s).every((k) => ['level', 'rules'].includes(k)))
  );
}
export function loadSecurityProfile(raw: unknown, completed = false): SecurityProfile {
  const p = raw as Partial<SecurityProfile> | null;
  const valid = p?.version === 1 && isSecurityLevel(p.unlocked);
  const unlocked = Math.max(valid ? p.unlocked! : 0, completed ? 1 : 0) as SecurityLevel;
  const bests: SecurityScore[] = [];
  if (valid && Array.isArray(p.bests))
    for (const r of p.bests.slice(0, 4)) {
      if (
        !r ||
        !isSecurityLevel(r.level) ||
        r.level > unlocked ||
        (r.level > 0 && r.level < 3 && unlocked <= r.level) ||
        !Number.isSafeInteger(r.timeMs) ||
        r.timeMs < 1 ||
        r.timeMs > 1e11 ||
        typeof r.seed !== 'string' ||
        !r.seed.length ||
        r.seed.length > 40 ||
        /^RF-D\d+-/.test(r.seed) ||
        bests.some((b) => b.level === r.level)
      )
        continue;
      bests.push({ level: r.level, timeMs: r.timeMs, seed: r.seed });
    }
  return { version: 1, unlocked, bests: bests.sort((a, b) => a.level - b.level) };
}
export function validSecurityProfile(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const p = raw as SecurityProfile,
    clean = loadSecurityProfile(raw);
  return (
    p.version === 1 &&
    p.unlocked === clean.unlocked &&
    Object.keys(p).every((k) => ['version', 'unlocked', 'bests'].includes(k)) &&
    Array.isArray(p.bests) &&
    p.bests.length === clean.bests.length &&
    p.bests.every(
      (r) =>
        !!r &&
        Object.keys(r).every((k) => ['level', 'timeMs', 'seed'].includes(k)) &&
        clean.bests.some((b) => b.level === r.level && b.timeMs === r.timeMs && b.seed === r.seed),
    )
  );
}
export function recordSecurityClear(raw: unknown, score: SecurityScore, completed = false) {
  const p = loadSecurityProfile(raw, completed);
  if (
    !isSecurityLevel(score.level) ||
    score.level > p.unlocked ||
    !Number.isSafeInteger(score.timeMs) ||
    score.timeMs < 1 ||
    score.timeMs > 1e11 ||
    typeof score.seed !== 'string' ||
    !score.seed.length ||
    score.seed.length > 40 ||
    /^RF-D\d+-/.test(score.seed)
  )
    return p;
  const old = p.bests.find((b) => b.level === score.level);
  return loadSecurityProfile({
    version: 1,
    unlocked: Math.max(p.unlocked, Math.min(3, score.level + 1)),
    bests: [
      ...p.bests.filter((b) => b.level !== score.level),
      old && old.timeMs <= score.timeMs ? old : score,
    ].sort((a, b) => a.level - b.level),
  });
}
export function campaignClearScore(g: Game): SecurityScore | null {
  if (
    g.practice ||
    g.testRun ||
    g.workshop.active ||
    g.overtime ||
    g.detour ||
    g.stage !== 19 ||
    !g.clear ||
    g.hp <= 0 ||
    /^RF-D\d+-/.test(g.seed) ||
    g.enemies.length ||
    g.waves.pending ||
    !(
      g.mode === 'won' ||
      g.shutdown.complete ||
      (g.escape?.phase === 'extracting' && g.escape.depart >= 2.6)
    )
  )
    return null;
  return {
    level: g.security?.level ?? 0,
    timeMs: Math.max(1, Math.round(g.elapsed * 1000)),
    seed: g.seed,
  };
}
export function securityLabel(level: SecurityLevel) {
  return SECURITY_LEVELS[level].name;
}
export function securityTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function securityMenu(p: SecurityProfile, selected: SecurityLevel) {
  return (
    '<h2 id="dialog-title">Security.</h2><p class="recap-note">Twenty rooms. Each clearance unlocks the next level. Overtime remains available.</p>' +
    '<div class="security-levels">' +
    SECURITY_LEVELS.map((level, i) => {
      const best = p.bests.find((b) => b.level === i);
      return (
        `<button class="security-choice" data-security="${i}" aria-pressed="${selected === i}" ${i > p.unlocked ? 'disabled' : ''}>` +
        `<strong>${level.name}</strong><span>${level.description}</span><small>${i > p.unlocked ? 'Clear Security ' + (i === 2 ? 'I' : 'II') + ' to unlock' : best ? 'Best clearance · ' + securityTime(best.timeMs) : 'No clearance recorded'}${i === 3 ? ' · Reward: Redline outfit' : ''}</small></button>`
      );
    }).join('') +
    '</div><div class="actions"><button id="back" class="quiet">Back</button></div>'
  );
}
