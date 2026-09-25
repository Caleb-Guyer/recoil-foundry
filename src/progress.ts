import { loadCheckpoint } from './rules.ts';
import {
  DISCOVERIES_KEY,
  WORKSHOP_BUILD_KEY,
  discoverBuild,
  loadDiscoveries,
  workshopBuild,
} from './workshop-build.ts';
import { LOGBOOK_KEY, loadLogbook, migrateLogbook } from './logbook.ts';
import { COMMENDATIONS_KEY, loadCommendations } from './commendations.ts';
import { COSMETICS_KEY, loadCosmetics } from './cosmetics.ts';
import { VICTORIES_KEY, loadEncounters } from './practice.ts';
import { RUN_HISTORY_KEY, loadRunHistory } from './run-history.ts';
import { DAILY_BESTS_KEY, dailyForDate, dailyFromSeed } from './daily.ts';
import { BLUEPRINTS_KEY, loadBlueprints, validBlueprintSlots } from './blueprints.ts';
import {
  PRACTICE_RECORDS_KEY,
  loadPracticeRecords,
  validPracticeRecords,
} from './practice-records.ts';

export const PROGRESS_KEY = 'rf-progress-v1';
export const CHECKPOINT_KEY = 'rf-checkpoint-v5';
export const BACKUP_LIMIT = 1024 * 1024;
export const PROGRESS_KEYS = [
  CHECKPOINT_KEY,
  DISCOVERIES_KEY,
  LOGBOOK_KEY,
  COMMENDATIONS_KEY,
  COSMETICS_KEY,
  VICTORIES_KEY,
  RUN_HISTORY_KEY,
  DAILY_BESTS_KEY,
  WORKSHOP_BUILD_KEY,
  BLUEPRINTS_KEY,
  PRACTICE_RECORDS_KEY,
] as const;
export type ProgressValues = Record<(typeof PROGRESS_KEYS)[number], unknown>;
export type SaveState = 'saved' | 'saving' | 'unavailable' | 'conflict' | 'unreadable';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ProgressLock = <T>(action: () => T) => Promise<T>;
interface StoredProgress {
  version: 1;
  revision: string;
  values: ProgressValues;
  previous?: ProgressValues;
  previousRaw?: string | null;
}
export interface ProgressBackup {
  format: 'recoil-foundry-progress';
  version: 1;
  createdAt: string;
  gameVersion: string;
  values: ProgressValues;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const copy = <T>(v: T): T => structuredClone(v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keysOnly = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).every((k) => keys.includes(k));
function safeTree(v: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (v && typeof v === 'object')
    return Object.entries(v).every(
      ([k, x]) => !['__proto__', 'prototype', 'constructor'].includes(k) && safeTree(x, depth + 1),
    );
  return typeof v !== 'number' || Number.isFinite(v);
}
function dailyRecords(raw: unknown): Record<string, number> {
  if (!object(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([seed, time]) => {
      const date = /^RF-D[1-9]\d*-(\d{4}-\d{2}-\d{2})$/.exec(seed)?.[1];
      return date && dailyForDate(date) && Number.isSafeInteger(time) && (time as number) > 0;
    }),
  ) as Record<string, number>;
}
export function mergeDailyRecords(raw: unknown, current: Record<string, number>) {
  const archived = Object.entries(dailyRecords(raw))
    .filter(([seed]) => !dailyFromSeed(seed))
    .sort(([a], [b]) => b.slice(-10).localeCompare(a.slice(-10)))
    .slice(0, Math.max(0, 2000 - Object.keys(current).length));
  return Object.fromEntries([...archived, ...Object.entries(current)]);
}
function normalize(read: (key: string) => unknown): ProgressValues {
  const checkpoint = loadCheckpoint(
    read(CHECKPOINT_KEY) ?? read('rf-checkpoint-v4') ?? read('rf-checkpoint-v3'),
  );
  const discovered = discoverBuild(
    loadDiscoveries(read(DISCOVERIES_KEY)),
    checkpoint?.mods ?? [],
    checkpoint?.legacyMods,
  );
  const earned = loadCommendations(read(COMMENDATIONS_KEY));
  const victories = loadEncounters(read(VICTORIES_KEY));
  const history = loadRunHistory(read(RUN_HISTORY_KEY));
  return {
    [CHECKPOINT_KEY]: checkpoint,
    [DISCOVERIES_KEY]: discovered,
    [LOGBOOK_KEY]: migrateLogbook(read(LOGBOOK_KEY), checkpoint, history, victories),
    [COMMENDATIONS_KEY]: earned,
    [COSMETICS_KEY]: loadCosmetics(read(COSMETICS_KEY), earned),
    [VICTORIES_KEY]: victories,
    [RUN_HISTORY_KEY]: history,
    [DAILY_BESTS_KEY]: dailyRecords(read(DAILY_BESTS_KEY)),
    [WORKSHOP_BUILD_KEY]: workshopBuild(read(WORKSHOP_BUILD_KEY), discovered),
    [BLUEPRINTS_KEY]: loadBlueprints(read(BLUEPRINTS_KEY)),
    [PRACTICE_RECORDS_KEY]: loadPracticeRecords(read(PRACTICE_RECORDS_KEY)),
  };
}
export function validateProgress(raw: unknown): ProgressValues | null {
  try {
    if (
      !object(raw) ||
      !safeTree(raw) ||
      !keysOnly(raw, PROGRESS_KEYS) ||
      !PROGRESS_KEYS.every(
        (k) => k === BLUEPRINTS_KEY || k === PRACTICE_RECORDS_KEY || Object.hasOwn(raw, k),
      )
    )
      return null;
    const checkpoint = raw[CHECKPOINT_KEY];
    // Pre-blueprint profiles and backups migrate to six empty slots.
    if (Object.hasOwn(raw, BLUEPRINTS_KEY) && !validBlueprintSlots(raw[BLUEPRINTS_KEY]))
      return null;
    if (
      Object.hasOwn(raw, PRACTICE_RECORDS_KEY) &&
      !validPracticeRecords(raw[PRACTICE_RECORDS_KEY])
    )
      return null;
    if (checkpoint !== null && !loadCheckpoint(checkpoint)) return null;
    const arrays = [
      [DISCOVERIES_KEY, loadDiscoveries(raw[DISCOVERIES_KEY])],
      [COMMENDATIONS_KEY, loadCommendations(raw[COMMENDATIONS_KEY])],
      [VICTORIES_KEY, loadEncounters(raw[VICTORIES_KEY])],
      [RUN_HISTORY_KEY, loadRunHistory(raw[RUN_HISTORY_KEY])],
    ] as const;
    if (
      arrays.some(
        ([key, clean]) =>
          !Array.isArray(raw[key]) || (raw[key] as unknown[]).length !== clean.length,
      )
    )
      return null;
    const book = raw[LOGBOOK_KEY],
      cleanBook = loadLogbook(book);
    if (
      !object(book) ||
      !keysOnly(book, [
        'version',
        'enemies',
        'areas',
        'escaped',
        'stories',
        'disconnects',
        'shutdown',
        'annex',
      ]) ||
      book.version !== 1 ||
      typeof book.escaped !== 'boolean'
    )
      return null;
    for (const key of ['enemies', 'areas', 'stories', 'disconnects'] as const) {
      if (book[key] === undefined && ['stories', 'disconnects'].includes(key)) continue;
      if (!Array.isArray(book[key]) || book[key].length !== (cleanBook[key]?.length ?? 0))
        return null;
    }
    if (book.shutdown !== undefined && book.shutdown !== true) return null;
    if (book.annex !== undefined && book.annex !== true) return null;
    const cosmetics = raw[COSMETICS_KEY],
      cleanCosmetics = loadCosmetics(cosmetics, loadCommendations(raw[COMMENDATIONS_KEY]));
    if (
      !object(cosmetics) ||
      !keysOnly(cosmetics, ['gun', 'outfit']) ||
      cosmetics.gun !== cleanCosmetics.gun ||
      cosmetics.outfit !== cleanCosmetics.outfit
    )
      return null;
    if (
      !object(raw[DAILY_BESTS_KEY]) ||
      Object.keys(raw[DAILY_BESTS_KEY]).length > 2000 ||
      !same(raw[DAILY_BESTS_KEY], dailyRecords(raw[DAILY_BESTS_KEY]))
    )
      return null;
    const workshop = raw[WORKSHOP_BUILD_KEY];
    if (
      !Array.isArray(workshop) ||
      !same(workshop, workshopBuild(workshop, loadDiscoveries(raw[DISCOVERIES_KEY])))
    )
      return null;
    return normalize((k) => raw[k]);
  } catch {
    return null;
  }
}
export function parseProgressBackup(text: string): ProgressBackup {
  if (text.length > BACKUP_LIMIT) throw new Error('This backup is too large (maximum 1 MB).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid JSON backup.');
  }
  if (
    !object(raw) ||
    raw.format !== 'recoil-foundry-progress' ||
    raw.version !== 1 ||
    !keysOnly(raw, ['format', 'version', 'createdAt', 'gameVersion', 'values']) ||
    typeof raw.gameVersion !== 'string' ||
    raw.gameVersion.length > 40 ||
    typeof raw.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(raw.createdAt))
  )
    throw new Error('This is not a supported Recoil Foundry backup.');
  const values = validateProgress(raw.values);
  if (!values) throw new Error('The backup contains invalid progress. Nothing was changed.');
  return {
    format: 'recoil-foundry-progress',
    version: 1,
    createdAt: raw.createdAt,
    gameVersion: raw.gameVersion,
    values,
  };
}
export function progressSummary(values: ProgressValues) {
  const save = loadCheckpoint(values[CHECKPOINT_KEY]);
  return {
    run: save
      ? `Room ${save.stage + 1}${save.overtime ? ' · Overtime' : ''}${save.reward ? ' · upgrade waiting' : ''}`
      : 'No saved run',
    upgrades: loadDiscoveries(values[DISCOVERIES_KEY]).length,
    victories: loadEncounters(values[VICTORIES_KEY]).length,
    commendations: loadCommendations(values[COMMENDATIONS_KEY]).length,
    runs: loadRunHistory(values[RUN_HISTORY_KEY]).length,
    blueprints: loadBlueprints(values[BLUEPRINTS_KEY]).filter(Boolean).length,
    practiceRecords: loadPracticeRecords(values[PRACTICE_RECORDS_KEY]).length,
  };
}

// All progress lives in one atomic localStorage value. Import never writes a
// subset of the profile. Browser Web Locks serialize competing tab commits.
export class ProgressStore {
  state: SaveState = 'saved';
  dirty = false;
  onChange: () => void = () => {};
  private storage: () => StorageLike;
  private lock: ProgressLock;
  private values: ProgressValues;
  private previous?: ProgressValues;
  private previousRaw?: string | null;
  private unreadable = false;
  private expected: string | null | undefined;
  private queue: Promise<boolean> = Promise.resolve(true);
  private pending = 0;
  restoring = false;
  private serial = 0;
  private revision: () => string;
  constructor(
    storage: () => StorageLike,
    lock: ProgressLock = async (action) => action(),
    revision: () => string = () => crypto.randomUUID(),
  ) {
    this.storage = storage;
    this.revision = revision;
    this.lock = lock;
    this.values = normalize(() => null);
    const readStored = (key: string) => {
      try {
        return storage().getItem(key);
      } catch {
        this.expected = undefined;
        throw new Error('Storage unavailable');
      }
    };
    try {
      this.expected = readStored(PROGRESS_KEY);
      if (this.expected !== null) {
        const raw = JSON.parse(this.expected);
        const values =
          raw?.version === 1 && typeof raw.revision === 'string'
            ? validateProgress(raw.values)
            : null;
        if (!values) {
          this.unreadable = true;
          this.state = 'unreadable';
          return;
        }
        this.values = values;
        this.previous = raw.previous ? (validateProgress(raw.previous) ?? undefined) : undefined;
        this.previousRaw =
          typeof raw.previousRaw === 'string' || raw.previousRaw === null
            ? raw.previousRaw
            : undefined;
      } else {
        const legacy = new Map<string, unknown>();
        let unreadable = false;
        for (const key of [...PROGRESS_KEYS, 'rf-checkpoint-v4', 'rf-checkpoint-v3']) {
          const raw = readStored(key);
          if (raw !== null) {
            try {
              legacy.set(key, JSON.parse(raw));
            } catch {
              unreadable = true;
            }
          }
        }
        this.values = normalize((k) => legacy.get(k));
        if (unreadable) {
          this.state = 'unreadable';
          this.unreadable = true;
        }
      }
    } catch {
      this.state =
        this.expected !== undefined && this.expected !== null ? 'unreadable' : 'unavailable';
      this.unreadable = this.state === 'unreadable';
    }
  }
  owns(key: string) {
    return (PROGRESS_KEYS as readonly string[]).includes(key);
  }
  read(key: string): unknown {
    return this.owns(key) ? copy(this.values[key as keyof ProgressValues]) : null;
  }
  snapshot() {
    return copy(this.values);
  }
  get canUndo() {
    return !!this.previous || this.previousRaw !== undefined;
  }
  get canRestore() {
    return this.expected !== undefined && this.state !== 'conflict';
  }
  get blocked() {
    return this.state === 'conflict' || this.unreadable || this.expected === undefined;
  }
  private notify(state: SaveState) {
    this.state = state;
    this.onChange();
  }
  checkExternal() {
    if (this.pending || this.state === 'unreadable') return;
    try {
      if (this.storage().getItem(PROGRESS_KEY) !== this.expected) this.notify('conflict');
    } catch {
      this.notify('unavailable');
    }
  }
  write(key: string, value: unknown): Promise<boolean> {
    if (!this.owns(key) || this.restoring) return Promise.resolve(false);
    this.values[key as keyof ProgressValues] = copy(value);
    this.dirty = true;
    return this.enqueue(copy(this.values));
  }
  retry() {
    return this.enqueue(copy(this.values));
  }
  settled() {
    return this.queue;
  }
  backup(gameVersion: string) {
    const values = validateProgress(this.values);
    if (!values)
      throw new Error(
        'This tab’s progress could not be validated for export. Reload to read the saved copy.',
      );
    return JSON.stringify(
      {
        format: 'recoil-foundry-progress',
        version: 1,
        createdAt: new Date().toISOString(),
        gameVersion,
        values,
      } satisfies ProgressBackup,
      null,
      2,
    );
  }
  restore(backup: ProgressBackup) {
    const valid = validateProgress(backup.values);
    if (!valid || backup.format !== 'recoil-foundry-progress' || backup.version !== 1)
      return Promise.resolve(false);
    return this.enqueue(valid, true);
  }
  undo() {
    return this.canUndo
      ? this.enqueue(copy(this.previous ?? this.values), true, true)
      : Promise.resolve(false);
  }
  private enqueue(values: ProgressValues, restore = false, undo = false) {
    if (this.restoring || (restore ? !this.canRestore : this.blocked)) {
      this.onChange();
      return Promise.resolve(false);
    }
    const serial = ++this.serial;
    if (restore) this.restoring = true;
    const unreadable = this.unreadable;
    let restoredUnreadable = false;
    this.pending++;
    this.notify('saving');
    this.queue = this.queue
      .then(() =>
        this.lock(() => {
          if (this.state === 'conflict') return false;
          if (this.storage().getItem(PROGRESS_KEY) !== this.expected) {
            this.notify('conflict');
            return false;
          }
          if (undo && this.previousRaw !== undefined) {
            if (this.previousRaw === null) this.storage().removeItem(PROGRESS_KEY);
            else this.storage().setItem(PROGRESS_KEY, this.previousRaw);
            this.expected = this.previousRaw;
            this.previousRaw = undefined;
            this.previous = undefined;
            this.values = normalize(() => null);
            this.unreadable = restoredUnreadable = true;
            this.dirty = false;
            return true;
          }
          const previous = restore
            ? undo || unreadable
              ? undefined
              : copy(this.values)
            : this.previous;
          const previousRaw = restore ? (unreadable ? this.expected : undefined) : this.previousRaw;
          const record: StoredProgress = {
            version: 1,
            revision: this.revision(),
            values,
            ...(previous ? { previous } : {}),
            ...(previousRaw !== undefined ? { previousRaw } : {}),
          };
          const raw = JSON.stringify(record);
          this.storage().setItem(PROGRESS_KEY, raw);
          this.expected = raw;
          this.previous = previous;
          this.previousRaw = previousRaw;
          if (restore) {
            this.values = copy(values);
            this.unreadable = false;
          }
          if (serial === this.serial) this.dirty = false;
          return true;
        }),
      )
      .catch(() => {
        this.notify('unavailable');
        return false;
      })
      .then((ok) => {
        this.pending--;
        if (restore) this.restoring = false;
        if (ok && !this.pending) this.notify(restoredUnreadable ? 'unreadable' : 'saved');
        return ok;
      });
    return this.queue;
  }
}
