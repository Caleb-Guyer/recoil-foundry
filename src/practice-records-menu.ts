import { MODS } from './rules.ts';
import { PRACTICE_BOSSES, type Encounter, type PracticeBoss } from './practice.ts';
import type { MenuBack } from './blueprint-menu.ts';
import {
  PRACTICE_RULESET,
  CHALLENGE_CODE_LIMIT,
  challengeAccess,
  challengeCode,
  challengeFromRecord,
  parseChallengeCode,
  practiceTime,
  type PracticeChallenge,
  type PracticeRecord,
} from './practice-records.ts';
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function challengePreviewHtml(
  challenge: PracticeChallenge,
  victories: readonly Encounter[],
  known: readonly string[],
): string {
  const access = challengeAccess(challenge, victories, known);
  if (!access.earned) return '<p>Defeat this boss in a run to unlock its challenge.</p>';
  if (!access.current)
    return '<p>This challenge uses a different balance version. Its target stays separate and cannot be raced in this version.</p>';
  const names = challenge.mods.map((id) =>
    known.includes(id)
      ? (MODS.find((m) => m.id === id)?.name ?? 'Undiscovered upgrade')
      : 'Undiscovered upgrade',
  );
  return (
    '<p class="result-line">' +
    practiceTime(challenge.timeMs) +
    ' <span>·</span> ' +
    challenge.hits +
    ' hits</p>' +
    '<p class="practice-record-note">Shared target · Same arena and gun</p>' +
    '<ul class="recap-build">' +
    (names.length
      ? names.map((name) => '<li>' + escape(name) + '</li>').join('')
      : '<li>Starting gun</li>') +
    '</ul>' +
    (access.missing
      ? '<p class="practice-record-note">Collect ' +
        access.missing +
        ' more upgrade' +
        (access.missing === 1 ? '' : 's') +
        ' to race this build.</p>'
      : '')
  );
}
interface Options {
  records: readonly PracticeRecord[];
  known: readonly string[];
  victories: readonly Encounter[];
  boss?: PracticeBoss;
  share?: PracticeChallenge;
  start(challenge: PracticeChallenge): void;
  exit(): void;
}
export function practiceRecordsMenu(root: HTMLElement, options: Options): MenuBack {
  let backAction = options.exit,
    input = '';
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  function screen(title: string, body: string, actions: string, back: () => void) {
    backAction = back;
    root.innerHTML =
      '<h2 id="dialog-title">' +
      escape(title) +
      '</h2><div class="blueprint-scroll">' +
      body +
      '</div><p id="challenge-status" class="blueprint-status" role="status"></p><div class="workshop-actions">' +
      actions +
      '<button id="challenge-back" class="quiet">Back</button></div>';
    get('challenge-back').onclick = back;
    root
      .querySelector<HTMLElement>('textarea, button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }
  function share(challenge: PracticeChallenge, back: () => void) {
    screen(
      'Challenge a friend.',
      '<label for="challenge-code">Challenge code</label><textarea id="challenge-code" class="workshop-search blueprint-code" readonly></textarea><p class="practice-record-note">Your friend needs this boss and every upgrade unlocked. The code includes the arena, gun and target; it does not include your name or save.</p>',
      '<button id="challenge-copy" class="primary">Copy code</button>',
      back,
    );
    const field = get<HTMLTextAreaElement>('challenge-code');
    field.value = challengeCode(challenge);
    get('challenge-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(field.value);
        if (field.isConnected) get('challenge-status').textContent = 'Code copied.';
      } catch {
        if (!field.isConnected) return;
        field.focus();
        field.select();
        get('challenge-status').textContent = 'Press Ctrl+C to copy the selected code.';
      }
    };
  }
  function preview(challenge: PracticeChallenge) {
    const access = challengeAccess(challenge, options.victories, options.known);
    screen(
      access.earned && access.current ? PRACTICE_BOSSES[challenge.kind].name : 'Challenge.',
      challengePreviewHtml(challenge, options.victories, options.known),
      '<button id="challenge-start" class="primary"' +
        (access.allowed ? '' : ' disabled') +
        '>Start challenge ↗</button>',
      importCode,
    );
    get('challenge-start').onclick = () => {
      if (challengeAccess(challenge, options.victories, options.known).allowed)
        options.start(structuredClone(challenge));
    };
  }
  function importCode() {
    screen(
      'Import challenge.',
      '<label for="challenge-code">Challenge code</label><textarea id="challenge-code" class="workshop-search blueprint-code" maxlength="' +
        CHALLENGE_CODE_LIMIT +
        '" placeholder="RFC1.…" spellcheck="false"></textarea>',
      '<button id="challenge-preview" class="primary">Preview challenge</button>',
      options.exit,
    );
    const field = get<HTMLTextAreaElement>('challenge-code');
    field.value = input;
    field.oninput = () => {
      input = field.value;
    };
    get('challenge-preview').onclick = () => {
      try {
        preview(parseChallengeCode(field.value));
      } catch (error) {
        get('challenge-status').textContent = (error as Error).message;
      }
    };
  }
  function details(record: PracticeRecord) {
    const challenge = challengeFromRecord(record),
      access = challengeAccess(challenge, options.victories, options.known);
    const names = record.mods.map((id) =>
      options.known.includes(id)
        ? (MODS.find((m) => m.id === id)?.name ?? 'Undiscovered upgrade')
        : 'Undiscovered upgrade',
    );
    screen(
      'Saved winning build.',
      '<dl class="practice-record-stats"><div><dt>Fastest</dt><dd>' +
        practiceTime(record.fastest.timeMs) +
        ' · ' +
        record.fastest.hits +
        ' hits</dd></div><div><dt>Fewest hits</dt><dd>' +
        record.cleanest.hits +
        ' · ' +
        practiceTime(record.cleanest.timeMs) +
        '</dd></div></dl>' +
        '<p class="practice-record-note">Arena: ' +
        escape(record.seed) +
        '</p>' +
        '<ul class="recap-build">' +
        (names.length
          ? names.map((n) => '<li>' + escape(n) + '</li>').join('')
          : '<li>Starting gun</li>') +
        '</ul>' +
        (!access.current
          ? '<p class="practice-record-note">Earlier balance version · Archived</p>'
          : access.missing
            ? '<p class="practice-record-note">Collect every upgrade in this build to race its record.</p>'
            : ''),
      '<button id="challenge-race" class="primary"' +
        (access.allowed ? '' : ' disabled') +
        '>Race this build ↗</button>' +
        (access.current
          ? '<button id="challenge-share" class="quiet">Share challenge</button>'
          : ''),
      list,
    );
    get('challenge-race').onclick = () => {
      if (access.allowed) options.start(challenge);
    };
    const button = root.querySelector<HTMLButtonElement>('#challenge-share');
    if (button) button.onclick = () => share(challenge, () => details(record));
  }
  function list() {
    const records = options.records.filter(
      (r) => r.kind === options.boss && options.victories.some((e) => e.kind === r.kind),
    );
    const current = records.filter((r) => r.rules === PRACTICE_RULESET),
      archive = records.filter((r) => r.rules !== PRACTICE_RULESET);
    const rows = (items: PracticeRecord[]) =>
      items
        .map(
          (r) =>
            '<button class="practice-fight" data-practice-record="' +
            records.indexOf(r) +
            '"><span>' +
            practiceTime(r.fastest.timeMs) +
            ' · ' +
            r.fastest.hits +
            ' hits</span><span>' +
            (r.mods.length ? r.mods.length + ' upgrades' : 'Starting gun') +
            '</span></button>',
        )
        .join('');
    screen(
      'Practice records.',
      '<p class="practice-record-note">' +
        (options.boss ? PRACTICE_BOSSES[options.boss].name : '') +
        ' · Separate records for each arena and gun</p>' +
        (current.length
          ? '<div class="practice-list">' + rows(current) + '</div>'
          : '<p>Win a Practice fight to save its time and build here.</p>') +
        (archive.length
          ? '<details class="run-recap"><summary>Earlier balance versions</summary>' +
            rows(archive) +
            '</details>'
          : ''),
      '',
      options.exit,
    );
    root.querySelectorAll<HTMLButtonElement>('[data-practice-record]').forEach((button) => {
      button.onclick = () => details(records[Number(button.dataset.practiceRecord)]);
    });
  }
  if (options.share) share(options.share, options.exit);
  else if (options.boss) list();
  else importCode();
  return {
    back() {
      backAction();
      return true;
    },
  };
}
