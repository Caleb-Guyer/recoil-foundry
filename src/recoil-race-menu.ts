import { RECOIL_TRIALS, loadRecoilProfile } from './recoil-trial-rules.ts';
import { STARTING_GUNS, type StartingGun } from './starting-guns.ts';
import { WEAPON_REQUIREMENTS } from './weapon-unlocks.ts';
import { practiceTime } from './practice-records.ts';
import {
  RECOIL_CODE_LIMIT,
  recoilChallengeAccess,
  recoilChallengeCode,
  recoilChallengeLink,
  parseRecoilChallenge,
  type RecoilChallenge,
} from './recoil-race-rules.ts';
import type { MenuBack } from './blueprint-menu.ts';

export function recoilChallengePreview(
  ch: RecoilChallenge,
  profile: unknown,
  guns: readonly StartingGun[],
) {
  return (
    '<p class="result-line">' +
    practiceTime(ch.timeMs) +
    ' <span>·</span> ' +
    ch.shots +
    ' shots</p>' +
    '<p class="practice-record-note">' +
    RECOIL_TRIALS[ch.kind].name +
    ' · ' +
    STARTING_GUNS[ch.gun].name +
    ' · Full health, no upgrades. Checkpoints compare against the shared time.</p>' +
    (!loadRecoilProfile(profile).clears.includes(ch.kind)
      ? '<p>Clear this course in Campaign to race it.</p>'
      : '') +
    (!guns.includes(ch.gun) ? '<p>' + WEAPON_REQUIREMENTS[ch.gun] + '</p>' : '') +
    '<p class="practice-record-note">A shared target is supplied by its sender. Your ghost, when enabled, is your own recorded clear.</p>'
  );
}
export function recoilRaceMenu(
  root: HTMLElement,
  options: {
    profile: unknown;
    guns: readonly StartingGun[];
    challenge?: RecoilChallenge;
    share?: RecoilChallenge;
    invalid?: boolean;
    start(ch: RecoilChallenge): void;
    exit(): void;
  },
): MenuBack {
  let backAction = options.exit,
    input = '';
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  function screen(title: string, body: string, actions: string, back: () => void) {
    backAction = back;
    root.innerHTML =
      '<p class="eyebrow">RECOIL TRIALS</p><h2 id="dialog-title">' +
      title +
      '</h2><div class="blueprint-scroll">' +
      body +
      '</div><p id="recoil-status" class="blueprint-status" role="status"></p>' +
      '<div class="workshop-actions">' +
      actions +
      '<button id="recoil-code-back" class="quiet">Back</button></div>';
    get('recoil-code-back').onclick = back;
    root
      .querySelector<HTMLElement>('textarea, button:not(:disabled)')
      ?.focus({ preventScroll: true });
  }
  function share(ch: RecoilChallenge) {
    screen(
      'Challenge a friend.',
      '<label for="recoil-code">Challenge code</label><textarea id="recoil-code" class="workshop-search blueprint-code" readonly></textarea>' +
        '<label for="recoil-link">Share link</label><textarea id="recoil-link" class="workshop-search blueprint-code" readonly></textarea>' +
        '<p class="practice-record-note">The code contains the course, starting gun, checkpoint times and final target. Your friend needs the course and gun unlocked. Import it in Practice → Recoil Trials on either site.</p>',
      '<button id="recoil-copy-code" class="primary">Copy code</button><button id="recoil-copy-link" class="quiet">Copy link</button>',
      options.exit,
    );
    get<HTMLTextAreaElement>('recoil-code').value = recoilChallengeCode(ch);
    get<HTMLTextAreaElement>('recoil-link').value = recoilChallengeLink(ch);
    for (const [button, field] of [
      ['recoil-copy-code', 'recoil-code'],
      ['recoil-copy-link', 'recoil-link'],
    ])
      get(button).onclick = async () => {
        const text = get<HTMLTextAreaElement>(field);
        try {
          await navigator.clipboard.writeText(text.value);
          if (text.isConnected) get('recoil-status').textContent = 'Copied.';
        } catch {
          if (text.isConnected) {
            text.focus();
            text.select();
            get('recoil-status').textContent = 'Press Ctrl+C to copy the selected text.';
          }
        }
      };
  }
  function preview(ch: RecoilChallenge) {
    screen(
      'Race the target.',
      recoilChallengePreview(ch, options.profile, options.guns),
      '<button id="recoil-code-start" class="primary"' +
        (recoilChallengeAccess(ch, options.profile, options.guns) ? '' : ' disabled') +
        '>Start challenge ↗</button>',
      options.exit,
    );
    get('recoil-code-start').onclick = () => {
      if (recoilChallengeAccess(ch, options.profile, options.guns))
        options.start(structuredClone(ch));
    };
  }
  function importCode() {
    screen(
      'Import trial challenge.',
      '<label for="recoil-code">Code or share link</label><textarea id="recoil-code" class="workshop-search blueprint-code" maxlength="' +
        RECOIL_CODE_LIMIT +
        '" placeholder="RFT1.…" spellcheck="false"></textarea>',
      '<button id="recoil-code-preview" class="primary">Preview challenge</button>',
      options.exit,
    );
    const field = get<HTMLTextAreaElement>('recoil-code');
    field.value = input;
    field.oninput = () => {
      input = field.value;
    };
    if (options.invalid)
      get('recoil-status').textContent =
        'This trial challenge link could not be read. Paste a valid code below.';
    get('recoil-code-preview').onclick = () => {
      try {
        preview(parseRecoilChallenge(field.value));
        backAction = importCode;
        get('recoil-code-back').onclick = importCode;
      } catch (error) {
        get('recoil-status').textContent = (error as Error).message;
      }
    };
  }
  if (options.share) share(options.share);
  else if (options.challenge) preview(options.challenge);
  else importCode();
  return {
    back() {
      backAction();
      return true;
    },
  };
}
