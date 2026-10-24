import { cinematicFinale } from './boss-progression.ts';
import type { Checkpoint } from './rules.ts';

export const FINALE_PROGRESS_KEY = 'rf-finale-progression-v1';
export interface FinaleProgress {
  version: 1;
  ngPlusNoticeSeen: boolean;
}

// This is a run-start decision. Earning the Shotgun during extraction must not
// change that run's ending or introduce an Overtime door on its first clear.
export function resolveFinaleFirstClear(
  seed: string,
  save: Checkpoint | undefined,
  requested = true,
): boolean {
  if (!cinematicFinale(seed) || save?.overtime) return false;
  // A new-revision checkpoint without the field takes the safe first-clear
  // route. Continue never guesses from a profile another tab could have changed.
  return save ? save.finaleFirstClear !== 0 : requested;
}

export function validFinaleClassification(save: Checkpoint): boolean {
  return (
    save.finaleFirstClear === undefined ||
    (save.version === 6 &&
      typeof save.seed === 'string' &&
      cinematicFinale(save.seed) &&
      (save.finaleFirstClear === 0 || save.finaleFirstClear === 1) &&
      !(save.finaleFirstClear === 1 && save.overtime))
  );
}

export function loadFinaleProgress(raw: unknown): FinaleProgress {
  const value = raw as Partial<FinaleProgress> | null;
  return { version: 1, ngPlusNoticeSeen: value?.version === 1 && value.ngPlusNoticeSeen === true };
}

export function validFinaleProgress(raw: unknown): boolean {
  return (
    !!raw &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    Object.keys(raw).every((key) => ['version', 'ngPlusNoticeSeen'].includes(key)) &&
    (raw as FinaleProgress).version === 1 &&
    typeof (raw as FinaleProgress).ngPlusNoticeSeen === 'boolean'
  );
}

export interface FinishedFinale {
  seed: string;
  firstClear: boolean;
  won: boolean;
  overtime: boolean;
  daily: boolean;
  shutdown: boolean;
  isolated: boolean;
}
export function shouldShowNgPlusNotice(run: FinishedFinale, receipt: unknown): boolean {
  return (
    cinematicFinale(run.seed) &&
    run.firstClear &&
    run.won &&
    !run.overtime &&
    !run.daily &&
    !run.shutdown &&
    !run.isolated &&
    !loadFinaleProgress(receipt).ngPlusNoticeSeen
  );
}

export function ngPlusNoticeMarkup(): string {
  return (
    '<h2 id="dialog-title">New Game+ unlocked.</h2>' +
    '<p>Your first shift is complete. On future Campaign runs, defeat the Reclaimer and take the Overtime door during the escape to enter New Game+.</p>' +
    '<p>Keep your upgrades, face a tougher second shift, and finish the Reclaimer for good.</p>' +
    '<div class="actions"><button id="ngplus-continue" class="primary">Continue</button></div>'
  );
}

export function ngPlusNoticePreviewFromUrl(url: URL): boolean {
  const params = url.searchParams;
  if (params.get('test') !== 'ngplus-unlocked') return false;
  let valid = true;
  params.forEach((_, key) => {
    if (!['test', 'v'].includes(key) || params.getAll(key).length !== 1) valid = false;
  });
  return valid;
}
