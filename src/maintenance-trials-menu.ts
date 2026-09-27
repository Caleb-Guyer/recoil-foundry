import { SHAFT_NAMES, type MaintenanceKind } from './maintenance.ts';
import { newSeed } from './run-seed.ts';
import { practiceTime } from './practice-records.ts';
import type { MenuBack } from './blueprint-menu.ts';
import {
  TRIAL_RULES,
  trialAccess,
  trialKey,
  trialLink,
  parseTrialChallenge,
  trialChallenge,
  type TrialRoute,
  type TrialChallenge,
  type ShaftProfile,
} from './maintenance-trials.ts';
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function trialPreviewHtml(challenge: TrialChallenge, profile: ShaftProfile) {
  if (!profile.unlocks.some((u) => u.kind === challenge.kind))
    return '<p>Clear this shaft in a normal run to unlock its trial.</p>';
  if (challenge.rules !== TRIAL_RULES)
    return '<p>This challenge uses an older rules version and cannot be raced in this version.</p>';
  return (
    '<p class="result-line">' +
    practiceTime(challenge.timeMs) +
    ' <span>·</span> ' +
    challenge.shots +
    ' shots</p><p class="practice-record-note">Same layout. Starting gun.</p>'
  );
}
export function trialResultHtml(options: {
  won: boolean;
  preview: boolean;
  timeMs: number;
  shots: number;
  hits: number;
  note: string;
  challenge?: TrialChallenge;
}) {
  const { won, preview, timeMs, shots, hits, note, challenge } = options;
  const target =
    won && challenge
      ? timeMs === challenge.timeMs
        ? 'Target matched.'
        : timeMs < challenge.timeMs
          ? 'Target beaten by ' + practiceTime(challenge.timeMs - timeMs) + '.'
          : practiceTime(timeMs - challenge.timeMs) + ' behind the target.'
      : '';
  return (
    '<p class="eyebrow">' +
    (preview ? 'PREVIEW · ' : '') +
    'MAINTENANCE TRIAL</p>' +
    '<h2 id="dialog-title">' +
    (won ? 'Back in one piece.' : 'Try again.') +
    '</h2>' +
    '<p class="result-line">' +
    practiceTime(timeMs) +
    ' <span>·</span> ' +
    shots +
    ' shots' +
    (won && !hits ? ' <span>·</span> Clean climb' : '') +
    '</p>' +
    '<p class="practice-record-note">' +
    escape(
      [preview ? 'Preview only. No records or unlocks.' : note, target].filter(Boolean).join(' '),
    ) +
    '</p>'
  );
}
interface Options {
  profile: ShaftProfile;
  kind?: MaintenanceKind;
  challenge?: TrialChallenge;
  share?: TrialChallenge;
  invalid?: boolean;
  start(route: TrialRoute, challenge?: TrialChallenge): void;
  startRun(): void;
  exit(): void;
}
export function maintenanceTrialsMenu(root: HTMLElement, options: Options): MenuBack {
  let backAction = options.exit;
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  function screen(title: string, body: string, actions: string, back: () => void) {
    backAction = back;
    root.innerHTML =
      '<p class="eyebrow">MAINTENANCE TRIALS</p><h2 id="dialog-title">' +
      escape(title) +
      '</h2><div class="blueprint-scroll">' +
      body +
      '</div>' +
      '<p id="shaft-status" class="blueprint-status" role="status"></p>' +
      '<div class="workshop-actions">' +
      actions +
      '<button id="shaft-back" class="quiet">Back</button></div>';
    get('shaft-back').onclick = back;
    root
      .querySelector<HTMLElement>('textarea, button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }
  function share(challenge: TrialChallenge, back: () => void) {
    screen(
      'Challenge a friend.',
      '<label for="shaft-code">Challenge link</label>' +
        '<textarea id="shaft-code" class="workshop-code" rows="3" readonly></textarea>' +
        '<p class="practice-record-note">Your friend must have cleared this shaft. The link opens GitHub Pages; it can also be imported from Practice on itch.io.</p>',
      '<button id="shaft-copy" class="primary">Copy link</button>',
      back,
    );
    get<HTMLTextAreaElement>('shaft-code').value = trialLink(challenge);
    get('shaft-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(trialLink(challenge));
        get('shaft-status').textContent = 'Link copied.';
      } catch {
        get<HTMLTextAreaElement>('shaft-code').select();
        get('shaft-status').textContent = 'Press Ctrl+C to copy the selected link.';
      }
    };
  }
  function challenge(ch: TrialChallenge, back: () => void) {
    const route: TrialRoute = {
      kind: ch.kind,
      seed: ch.seed,
      revision: ch.revision,
      rules: ch.rules,
    };
    const earned = options.profile.unlocks.some((u) => u.kind === ch.kind);
    screen(
      earned ? SHAFT_NAMES[ch.kind] + '.' : 'Shared challenge.',
      trialPreviewHtml(ch, options.profile),
      trialAccess(route, options.profile)
        ? '<button id="shaft-start" class="primary">Climb ↗</button>'
        : '<button id="shaft-run" class="primary">Start a run ↗</button>',
      back,
    );
    if (trialAccess(route, options.profile))
      get('shaft-start').onclick = () => options.start(route, ch);
    else get('shaft-run').onclick = options.startRun;
  }
  function importLink() {
    screen(
      'Import a challenge.',
      '<label for="shaft-code">Link or MTC1 code</label><textarea id="shaft-code" class="workshop-code" rows="3" maxlength="2048"></textarea>',
      '<button id="shaft-import" class="primary">Preview challenge</button>',
      home,
    );
    if (options.invalid)
      get('shaft-status').textContent =
        'This trial link is invalid. Paste a complete challenge link.';
    get('shaft-import').onclick = () => {
      try {
        challenge(parseTrialChallenge(get<HTMLTextAreaElement>('shaft-code').value), importLink);
      } catch (error) {
        get('shaft-status').textContent = (error as Error).message;
      }
    };
  }
  function records(kind: MaintenanceKind) {
    const list = options.profile.records.filter((r) => r.kind === kind);
    screen(
      'Your records.',
      list.length
        ? '<div class="practice-list">' +
            list
              .map(
                (r, i) =>
                  '<button class="practice-fight" data-record="' +
                  i +
                  '"><span>' +
                  escape(r.seed) +
                  '</span><span>' +
                  practiceTime(r.fastest.timeMs) +
                  '</span></button>',
              )
              .join('') +
            '</div>'
        : '<p>Finish a trial to set your first record.</p>',
      '',
      () => setup(kind),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-record]').forEach((button) => {
      button.onclick = () => {
        const r = list[Number(button.dataset.record)];
        const route = { kind: r.kind, seed: r.seed, revision: r.revision, rules: r.rules };
        screen(
          'Personal bests.',
          '<p class="practice-record-note">' +
            escape(r.seed) +
            '</p>' +
            '<dl class="practice-record-stats"><div><dt>Fastest climb</dt><dd>' +
            practiceTime(r.fastest.timeMs) +
            ' · ' +
            r.fastest.shots +
            ' shots</dd></div>' +
            '<div><dt>Fewest shots</dt><dd>' +
            r.efficient.shots +
            ' · ' +
            practiceTime(r.efficient.timeMs) +
            '</dd></div></dl>',
          trialAccess(route, options.profile)
            ? '<button id="shaft-start" class="primary">Race best ↗</button><button id="shaft-share" class="quiet">Share</button>'
            : '',
          () => records(kind),
        );
        if (trialAccess(route, options.profile)) {
          get('shaft-start').onclick = () => options.start(route, trialChallenge(route, r.fastest));
          get('shaft-share').onclick = () =>
            share(trialChallenge(route, r.fastest), () => records(kind));
        }
      };
    });
  }
  function setup(kind: MaintenanceKind) {
    const unlocked = options.profile.unlocks.find((u) => u.kind === kind);
    if (!unlocked) {
      home();
      return;
    }
    const route: TrialRoute = {
      kind,
      seed: unlocked.seed,
      revision: unlocked.revision,
      rules: TRIAL_RULES,
    };
    const best = options.profile.records.find((r) => trialKey(r) === trialKey(route));
    screen(
      SHAFT_NAMES[kind] + '.',
      '<p class="practice-note">Reach the summit. Starting gun. Full health.</p>' +
        (best
          ? '<p class="practice-record-note">Best ' +
            practiceTime(best.fastest.timeMs) +
            ' · ' +
            best.efficient.shots +
            ' fewest shots</p>'
          : '') +
        '<p class="practice-record-note">Retry repeats your layout. Clean climbs in both shafts earn Servicewear.</p>',
      '<button id="shaft-start" class="primary">Original climb ↗</button><button id="shaft-new" class="quiet">New layout</button><button id="shaft-records" class="quiet">Records</button>',
      home,
    );
    get('shaft-start').onclick = () => options.start(route);
    get('shaft-new').onclick = () =>
      options.start({ kind, seed: newSeed(), revision: 2, rules: TRIAL_RULES });
    get('shaft-records').onclick = () => records(kind);
  }
  function home() {
    screen(
      'Choose a shaft.',
      options.profile.unlocks.length
        ? '<div class="practice-list">' +
            options.profile.unlocks
              .map(
                (u) =>
                  '<button class="practice-fight" data-shaft="' +
                  u.kind +
                  '"><span>' +
                  SHAFT_NAMES[u.kind] +
                  '</span><span aria-hidden="true">↗</span></button>',
              )
              .join('') +
            '</div>'
        : '<p>Clear a Maintenance Shaft in a normal run to unlock its trials.</p>',
      (!options.profile.unlocks.length
        ? '<button id="shaft-run" class="primary">Start a run ↗</button>'
        : '') + '<button id="shaft-import" class="quiet">Import challenge</button>',
      options.exit,
    );
    root.querySelectorAll<HTMLButtonElement>('[data-shaft]').forEach((b) => {
      b.onclick = () => setup(b.dataset.shaft as MaintenanceKind);
    });
    get('shaft-import').onclick = importLink;
    if (!options.profile.unlocks.length) get('shaft-run').onclick = options.startRun;
  }
  if (options.share) share(options.share, options.exit);
  else if (options.challenge) challenge(options.challenge, options.exit);
  else if (options.invalid) importLink();
  else if (options.kind) setup(options.kind);
  else home();
  return {
    back() {
      backAction();
      return true;
    },
  };
}
