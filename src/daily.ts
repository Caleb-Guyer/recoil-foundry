// Bump when layouts, upgrade pools, or gameplay balance change. Old links must
// not silently become a different challenge under the same identity.
export const DAILY_RULESET = 2;
export const DAILY_BESTS_KEY = 'rf-daily-bests-v1';
export interface DailyChallenge {
  date: string;
  seed: string;
}

export function dailyForDate(date: string): DailyChallenge | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return { date, seed: `RF-D${DAILY_RULESET}-${date}` };
}

export function todayDaily(now = new Date()): DailyChallenge {
  return dailyForDate(now.toISOString().slice(0, 10))!;
}

export function dailyFromSeed(seed: string): DailyChallenge | null {
  const prefix = `RF-D${DAILY_RULESET}-`;
  return seed.startsWith(prefix) ? dailyForDate(seed.slice(prefix.length)) : null;
}

export function isUnsupportedDailySeed(seed: string): boolean {
  const match = /^RF-D([1-9]\d*)-(\d{4}-\d{2}-\d{2})$/.exec(seed);
  return !!match && match[1] !== String(DAILY_RULESET) && !!dailyForDate(match[2]);
}

export function dailyFromUrl(url: URL): DailyChallenge | null {
  const dates = url.searchParams.getAll('daily');
  const versions = url.searchParams.getAll('dv');
  return dates.length === 1 && versions.length === 1 && versions[0] === String(DAILY_RULESET)
    ? dailyForDate(dates[0])
    : null;
}

export function dailyLink(challenge: DailyChallenge, base: string): string {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('daily', challenge.date);
  url.searchParams.set('dv', String(DAILY_RULESET));
  return url.href;
}

// Integer hundredths match the precision shown on the result screen.
export function loadDailyBests(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(
      ([seed, time]) => dailyFromSeed(seed) && Number.isSafeInteger(time) && time > 0,
    ),
  );
}

export function recordDailyWin(raw: unknown, challenge: DailyChallenge, elapsed: number) {
  const time = Math.round(elapsed * 100);
  if (!dailyFromSeed(challenge.seed) || !Number.isSafeInteger(time) || time <= 0) return null;
  const bests = loadDailyBests(raw);
  const previous = bests[challenge.seed];
  const newBest = previous === undefined || time < previous;
  const best = newBest ? time : previous;
  bests[challenge.seed] = best;
  // Keep a year of records, including the challenge just played even if it is old.
  const recent = Object.entries(bests)
    .filter(([seed]) => seed !== challenge.seed)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 364);
  return { bests: Object.fromEntries([...recent, [challenge.seed, best]]), best, newBest };
}

export function formatDailyTime(time: number): string {
  const total = Math.max(0, Math.round(time));
  return `${Math.floor(total / 6000)}:${String(Math.floor(total / 100) % 60).padStart(2, '0')}.${String(total % 100).padStart(2, '0')}`;
}
