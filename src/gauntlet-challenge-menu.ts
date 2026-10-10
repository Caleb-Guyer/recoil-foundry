import {
  GAUNTLET_CODE_LIMIT,
  gauntletChallengeAccess,
  gauntletChallengeCode,
  gauntletChallengeUrl,
  parseGauntletChallenge,
  type GauntletChallenge,
} from './gauntlet-challenge.ts';
import { gauntletChoiceName } from './gauntlet-rules.ts';
import { isBossRemix, type BossRemixId } from './boss-remix-rules.ts';
import { STARTING_GUNS } from './starting-guns.ts';
import { practiceTime } from './practice-records.ts';
import { escapeLogbook } from './logbook-menu.ts';
import type { MenuBack } from './blueprint-menu.ts';

export function gauntletChallengeMenu(
  root: HTMLElement,
  options: {
    profile: unknown;
    seen: readonly BossRemixId[];
    challenge?: GauntletChallenge;
    share?: GauntletChallenge;
    invalid?: boolean;
    base: string;
    start(challenge: GauntletChallenge): void;
    exit(): void;
  },
): MenuBack {
  let input = '';
  const get = <T extends HTMLElement = HTMLButtonElement>(id: string) =>
    root.querySelector<T>('#' + id)!;
  function preview(c: GauntletChallenge, sharing = false) {
    const access = gauntletChallengeAccess(c, options.profile, options.seen);
    root.innerHTML =
      '<p class="eyebrow">REMIX GAUNTLET · SHARED CHALLENGE</p><h2 id="dialog-title">Five fights to beat.</h2>' +
      '<p class="practice-note">' +
      STARTING_GUNS[c.gun].name +
      ' · ' +
      (c.tier === 'overclocked' ? 'Overclocked' : 'Standard') +
      '</p>' +
      '<p class="result-line">Target · ' +
      practiceTime(c.timeMs) +
      ' · ' +
      c.hits +
      ' hits</p>' +
      '<ol class="recap-build">' +
      c.route
        .map(
          (choice) =>
            '<li>' +
            escapeLogbook(
              isBossRemix(choice) && !options.seen.includes(choice)
                ? 'Undiscovered arena'
                : gauntletChoiceName(choice),
            ) +
            '</li>',
        )
        .join('') +
      '</ol>' +
      '<p class="practice-note">Start with an unmodified gun and full health. This challenge fixes all five arenas and the tier. Choose your own upgrades or repairs between fights.</p>' +
      (!access.cleared
        ? '<p class="practice-record-note">Beat the Campaign to open the Boss Gauntlet.</p>'
        : !access.gun
          ? '<p class="practice-record-note">Unlock this starting gun first.</p>'
          : access.missing
            ? '<p class="practice-record-note">Discover ' +
              access.missing +
              ' more of these arenas in Campaign to enter.</p>'
            : '') +
      (sharing
        ? '<label for="gauntlet-code">Challenge code</label><textarea id="gauntlet-code" class="workshop-search blueprint-code" readonly spellcheck="false"></textarea>'
        : '') +
      '<p id="gauntlet-challenge-status" class="practice-record-note" aria-live="polite"></p><div class="actions">' +
      (sharing
        ? '<button id="gauntlet-copy-link" class="primary">Copy challenge link</button><button id="gauntlet-copy-code" class="quiet">Copy code</button>'
        : '<button id="gauntlet-challenge-start" class="primary"' +
          (access.allowed ? '' : ' disabled') +
          '>Start challenge ↗</button><button id="gauntlet-enter-code" class="quiet">Enter another code</button>') +
      '<button id="gauntlet-challenge-back" class="quiet">Back</button></div>';
    get('gauntlet-challenge-back').onclick = options.exit;
    if (sharing) {
      const field = get<HTMLTextAreaElement>('gauntlet-code');
      const status = get('gauntlet-challenge-status');
      field.value = gauntletChallengeCode(c);
      const copy = async (text: string, label: string) => {
        try {
          await navigator.clipboard.writeText(text);
          if (status.isConnected) status.textContent = label + ' copied.';
        } catch {
          if (!field.isConnected) return;
          field.value = text;
          field.focus();
          field.select();
          status.textContent = 'Press Ctrl+C to copy the selected text.';
        }
      };
      get('gauntlet-copy-link').onclick = () =>
        void copy(gauntletChallengeUrl(options.base, c), 'Link');
      get('gauntlet-copy-code').onclick = () => void copy(gauntletChallengeCode(c), 'Code');
    } else {
      get('gauntlet-challenge-start').onclick = () => {
        if (gauntletChallengeAccess(c, options.profile, options.seen).allowed)
          options.start(structuredClone(c));
      };
      get('gauntlet-enter-code').onclick = importCode;
    }
  }
  function importCode() {
    root.innerHTML =
      '<p class="eyebrow">REMIX GAUNTLET</p><h2 id="dialog-title">Import Gauntlet challenge.</h2><label for="gauntlet-code">Challenge code</label><textarea id="gauntlet-code" class="workshop-search blueprint-code" maxlength="' +
      GAUNTLET_CODE_LIMIT +
      '" placeholder="RFG1.…" spellcheck="false"></textarea><p id="gauntlet-challenge-status" class="practice-record-note" aria-live="polite"></p><div class="actions"><button id="gauntlet-code-preview" class="primary">Preview challenge</button><button id="gauntlet-challenge-back" class="quiet">Back</button></div>';
    const field = get<HTMLTextAreaElement>('gauntlet-code');
    field.value = input;
    field.oninput = () => {
      input = field.value;
    };
    get('gauntlet-code-preview').onclick = () => {
      try {
        preview(parseGauntletChallenge(field.value));
      } catch (error) {
        get('gauntlet-challenge-status').textContent = (error as Error).message;
      }
    };
    get('gauntlet-challenge-back').onclick = options.exit;
    if (options.invalid)
      get('gauntlet-challenge-status').textContent =
        'This challenge link is damaged or unsupported. You can enter another code.';
  }
  if (options.share) preview(options.share, true);
  else if (options.challenge) preview(options.challenge);
  else importCode();
  return {
    back() {
      options.exit();
      return true;
    },
  };
}
