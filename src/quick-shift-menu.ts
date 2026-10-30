import {
  STARTING_GUNS,
  STARTING_GUN_IDS,
  isStartingGun,
  type StartingGun,
} from './starting-guns.ts';
import { MODS } from './rules.ts';
import { escapeLogbook as escape } from './html.ts';
import { practiceTime } from './practice-records.ts';
import type { MenuBack } from './blueprint-menu.ts';
import { quickShiftInput, quickShiftBest, type QuickShiftRecord } from './quick-shift-rules.ts';

export interface QuickShiftPlayOptions {
  campaign(): void;
  quickShift(): void;
  back(): void;
}
export function quickShiftPlayMenu(root: HTMLElement, options: QuickShiftPlayOptions): MenuBack {
  root.innerHTML =
    '<p class="eyebrow">PLAY</p><h2 id="dialog-title">Choose your shift.</h2>' +
    '<div class="quick-shift-mode-choices" role="group" aria-label="Run length">' +
    '<button class="quick-shift-mode" data-play-campaign><strong>Campaign</strong><span>Twenty rooms through the factory. Discover routes, earn unlocks and reach New Game+.</span></button>' +
    '<button class="quick-shift-mode" data-play-quick><strong>Quick Shift</strong><span>Build a gun through five rooms, a route choice, an optional job and a final fight.</span></button></div>' +
    '<p class="quick-shift-note">Each mode keeps its own Continue slot.</p>' +
    '<div class="actions"><button class="quiet" data-play-back>Back</button></div>';
  root.querySelector<HTMLButtonElement>('[data-play-campaign]')!.onclick = options.campaign;
  root.querySelector<HTMLButtonElement>('[data-play-quick]')!.onclick = options.quickShift;
  root.querySelector<HTMLButtonElement>('[data-play-back]')!.onclick = options.back;
  return {
    back() {
      options.back();
      return true;
    },
  };
}

export interface QuickShiftSetupOptions {
  seed: string;
  selectedGun?: StartingGun;
  unlockedGuns?: readonly StartingGun[];
  showWeapons?: boolean;
  records?: unknown;
  preview?: boolean;
  continue?(): void;
  newSeed?(): string;
  start(seed: string, gun: StartingGun): void;
  back(): void;
}
/** The same validation is used for initial fields, typed codes and the final Start action. */
export function quickShiftSetupSelection(
  value: string,
  requested: unknown,
  unlocked: readonly StartingGun[],
  showWeapons: boolean,
) {
  const challenge = quickShiftInput(value);
  const gun =
    showWeapons && isStartingGun(requested) && unlocked.includes(requested) ? requested : 'pistol';
  return { challenge, gun };
}
export function quickShiftSetup(root: HTMLElement, options: QuickShiftSetupOptions): MenuBack {
  const guns = STARTING_GUN_IDS.filter(
    (id) => id === 'pistol' || options.unlockedGuns?.includes(id),
  );
  const showWeapons = options.showWeapons === true;
  let gun = quickShiftSetupSelection(options.seed, options.selectedGun, guns, showWeapons).gun;
  const initialChallenge = quickShiftInput(options.seed);
  root.innerHTML =
    '<p class="eyebrow">' +
    (options.preview ? 'ISOLATED TEST · ' : '') +
    'QUICK SHIFT</p><h2 id="dialog-title">Five rooms. Build your gun.</h2>' +
    '<p class="quick-shift-intro">Start with an unmodified tool, draft your opening fittings, then earn more upgrades between rooms. Choose a route and an optional job before the final fight.</p>' +
    '<p class="quick-shift-standard">Standard upgrade pool' +
    (showWeapons
      ? options.preview
        ? ' · All tools in this isolated test'
        : ' · Earned starting weapons'
      : '') +
    '</p>' +
    (showWeapons
      ? '<label class="quick-shift-label" for="quick-shift-gun">Starting tool<select id="quick-shift-gun">' +
        guns
          .map(
            (id) =>
              '<option value="' +
              id +
              '"' +
              (id === gun ? ' selected' : '') +
              '>' +
              escape(STARTING_GUNS[id].name) +
              '</option>',
          )
          .join('') +
        '</select></label><p id="quick-shift-tool-detail" class="quick-shift-note">' +
        escape(STARTING_GUNS[gun].description) +
        '</p>'
      : '') +
    '<details class="quick-shift-seed-details"><summary>Replay a seed</summary><label class="quick-shift-label" for="quick-shift-seed">Seed or Quick Shift code<input id="quick-shift-seed" type="text" maxlength="40" spellcheck="false" autocapitalize="characters" autocomplete="off" aria-describedby="quick-shift-seed-note quick-shift-status"></label>' +
    '<p id="quick-shift-seed-note" class="quick-shift-note">Use the same full seed and starting tool to repeat the layout and upgrade offers. Full seeds keep their original challenge rules; short codes start the current rules. Your choices still shape the build.</p>' +
    (options.newSeed ? '<button class="quiet" id="quick-shift-new-seed">New seed</button>' : '') +
    '<div id="quick-shift-bests"></div></details>' +
    '<p class="quick-shift-scope">' +
    (options.preview
      ? 'Test only. Continue, unlocks and records stay untouched.'
      : options.continue
        ? 'Continue restarts the current room from its entry, keeping spent time and job-hit penalties. Starting another Quick Shift replaces that attempt; your Campaign stays saved.'
        : 'Quick Shift keeps its own Continue and records. Your Campaign stays saved.') +
    '</p>' +
    '<p id="quick-shift-status" class="quick-shift-status" role="status" aria-live="polite"></p>' +
    '<div class="actions">' +
    (options.continue
      ? '<button id="quick-shift-continue" class="primary">Continue Quick Shift</button>'
      : '') +
    '<button id="quick-shift-start" class="' +
    (options.continue ? 'quiet' : 'primary') +
    '">Start Quick Shift</button><button id="quick-shift-back" class="quiet">Back</button></div>';
  const input = root.querySelector<HTMLInputElement>('#quick-shift-seed')!;
  const status = root.querySelector<HTMLElement>('#quick-shift-status')!;
  input.value = initialChallenge?.seed ?? options.seed;
  const bests = () => {
    const selection = quickShiftSetupSelection(input.value, gun, guns, showWeapons);
    const rows = selection.challenge
      ? (['low', 'high'] as const).flatMap((route) =>
          (['skip', 'accept'] as const).flatMap((job) => {
            const record = quickShiftBest(
              options.records,
              selection.challenge!.seed,
              selection.gun,
              route,
              job,
            );
            return record
              ? [
                  '<li><strong>' +
                    practiceTime(record.timeMs) +
                    '</strong> ' +
                    (route === 'high' ? 'High' : 'Low') +
                    ' route · Job ' +
                    (job === 'accept' ? 'accepted' : 'skipped') +
                    '</li>',
                ]
              : [];
          }),
        )
      : [];
    root.querySelector<HTMLElement>('#quick-shift-bests')!.innerHTML = rows.length
      ? '<p class="quick-shift-note">Your best clears on this seed with this tool. Routes and job choices have separate records.</p><ul class="quick-shift-best-list">' +
        rows.join('') +
        '</ul>'
      : '<p class="quick-shift-note">No recorded clears on this seed with this tool yet.</p>';
  };
  const select = root.querySelector<HTMLSelectElement>('#quick-shift-gun');
  if (select)
    select.onchange = () => {
      gun = quickShiftSetupSelection(input.value, select.value, guns, showWeapons).gun;
      select.value = gun;
      root.querySelector<HTMLElement>('#quick-shift-tool-detail')!.textContent =
        STARTING_GUNS[gun].description;
      bests();
    };
  input.oninput = () => {
    status.textContent = '';
    input.removeAttribute('aria-invalid');
    bests();
  };
  input.onblur = () => {
    const challenge = quickShiftInput(input.value);
    if (challenge) input.value = challenge.seed;
  };
  const newSeed = root.querySelector<HTMLButtonElement>('#quick-shift-new-seed');
  if (newSeed)
    newSeed.onclick = () => {
      const challenge = quickShiftInput(options.newSeed!());
      if (!challenge) {
        status.textContent = 'A new seed could not be prepared. Try again.';
        return;
      }
      input.value = challenge.seed;
      status.textContent = '';
      input.removeAttribute('aria-invalid');
      bests();
    };
  root.querySelector<HTMLButtonElement>('#quick-shift-start')!.onclick = () => {
    const selected = quickShiftSetupSelection(input.value, gun, guns, showWeapons);
    if (!selected.challenge) {
      input.setAttribute('aria-invalid', 'true');
      input.closest('details')!.open = true;
      status.textContent = 'Use up to 12 letters or numbers, or a full RF-Q1 / RF-Q2 seed.';
      input.focus();
      return;
    }
    options.start(selected.challenge.seed, selected.gun);
  };
  const resume = root.querySelector<HTMLButtonElement>('#quick-shift-continue');
  if (resume) resume.onclick = () => options.continue?.();
  root.querySelector<HTMLButtonElement>('#quick-shift-back')!.onclick = options.back;
  bests();
  return {
    back() {
      options.back();
      return true;
    },
  };
}

export interface QuickShiftChoice {
  id: string;
  name: string;
  detail: string;
  consequence?: string;
  disabled?: boolean;
}
export interface QuickShiftChoiceOptions {
  kind: 'route' | 'job';
  title: string;
  hint: string;
  room?: number;
  choices: readonly QuickShiftChoice[];
  choose(id: string): void;
  back?(): void;
}
export function quickShiftChoice(root: HTMLElement, options: QuickShiftChoiceOptions): MenuBack {
  root.innerHTML =
    '<p class="eyebrow">QUICK SHIFT · ' +
    (options.kind === 'route' ? 'CHOOSE A ROUTE' : 'OPTIONAL JOB') +
    (options.room ? ' · ROOM ' + Math.max(1, Math.min(5, Math.trunc(options.room))) + ' / 5' : '') +
    '</p>' +
    '<h2 id="dialog-title">' +
    escape(options.title) +
    '</h2><p class="quick-shift-intro">' +
    escape(options.hint) +
    '</p>' +
    '<div class="quick-shift-choice-list" role="group" aria-label="' +
    (options.kind === 'route' ? 'Route choices' : 'Job choices') +
    '">' +
    options.choices
      .map(
        (choice, index) =>
          '<button type="button" class="quick-shift-choice" data-quick-shift-choice="' +
          index +
          '"' +
          (choice.disabled ? ' disabled' : '') +
          '><strong>' +
          escape(choice.name) +
          '</strong><span>' +
          escape(choice.detail) +
          '</span>' +
          (choice.consequence ? '<small>' + escape(choice.consequence) + '</small>' : '') +
          '</button>',
      )
      .join('') +
    '</div>' +
    (options.back
      ? '<div class="actions"><button class="quiet" id="quick-shift-choice-back">Back</button></div>'
      : '');
  root.querySelectorAll<HTMLButtonElement>('[data-quick-shift-choice]').forEach(
    (button) =>
      (button.onclick = () => {
        const choice = options.choices[Number(button.dataset.quickShiftChoice)];
        if (choice && !choice.disabled) options.choose(choice.id);
      }),
  );
  const back = root.querySelector<HTMLButtonElement>('#quick-shift-choice-back');
  if (back) back.onclick = () => options.back?.();
  return {
    back() {
      if (!options.back) return false;
      options.back();
      return true;
    },
  };
}

export interface QuickShiftResultOptions {
  record: QuickShiftRecord;
  best?: QuickShiftRecord | null;
  newBest?: boolean;
  preview?: boolean;
  shareLink?: string;
  reportHtml?: string;
  replay(): void;
  newShift(): void;
  back(): void;
}
export function quickShiftResultMarkup(options: QuickShiftResultOptions) {
  const r = options.record;
  const comparable =
    options.best?.outcome === 'won' &&
    options.best.seed === r.seed &&
    options.best.gun === r.gun &&
    options.best.route === r.route &&
    options.best.job === r.job
      ? options.best
      : null;
  const code = r.seed;
  return (
    '<p class="eyebrow">' +
    (options.preview ? 'ISOLATED TEST · ' : '') +
    'QUICK SHIFT</p><h2 id="dialog-title">' +
    (r.outcome === 'won' ? 'Shift complete.' : 'Shift ended.') +
    '</h2>' +
    '<p class="quick-shift-result-line"><strong>' +
    practiceTime(r.timeMs) +
    '</strong><span>' +
    r.rooms +
    ' / 5 rooms cleared</span></p>' +
    (!options.preview &&
    options.newBest &&
    r.outcome === 'won' &&
    comparable &&
    comparable.timeMs === r.timeMs
      ? '<p class="quick-shift-best-notice">New best for this seed, tool, route and job choice.</p>'
      : comparable
        ? '<p class="quick-shift-note">Best matching clear · ' +
          practiceTime(comparable.timeMs) +
          '</p>'
        : '') +
    '<p class="quick-shift-scope">' +
    (options.preview
      ? 'Test only. No saved records or Campaign progress.'
      : 'Quick Shift results and records stay separate from Campaign.') +
    '</p>' +
    '<details class="quick-shift-result-details"><summary>Run details</summary><dl><dt>Starting tool</dt><dd>' +
    escape(STARTING_GUNS[r.gun].name) +
    '</dd><dt>Seed</dt><dd class="quick-shift-code">' +
    escape(code) +
    '</dd><dt>Route</dt><dd>' +
    (r.route === 'high' ? 'High' : 'Low') +
    '</dd><dt>Optional job</dt><dd>' +
    (r.job === 'skip' ? 'Skipped' : r.jobWon ? 'Completed' : 'Not completed') +
    '</dd><dt>Hits taken</dt><dd>' +
    r.hits +
    '</dd><dt>Shots fired</dt><dd>' +
    r.shots +
    '</dd></dl>' +
    '<p class="quick-shift-note"><strong>Final fittings:</strong> ' +
    (r.mods.length
      ? r.mods.map((id) => escape(MODS.find((m) => m.id === id)?.name ?? id)).join(' · ')
      : 'Unmodified tool') +
    '</p></details>' +
    (options.reportHtml ?? '') +
    '<div class="actions"><button id="quick-shift-replay" class="primary">Replay seed</button><button id="quick-shift-another" class="quiet">New Quick Shift</button><button id="quick-shift-copy-seed" class="quiet">Copy seed</button>' +
    (options.shareLink
      ? '<button id="quick-shift-copy-link" class="quiet">Copy challenge link</button>'
      : '') +
    '<button id="quick-shift-result-back" class="quiet">Back to Play</button></div>' +
    '<p class="quick-shift-note">Replay starts fresh with this starting tool. Your upgrade and route choices can change.</p><p id="quick-shift-copy-status" class="quick-shift-status" role="status" aria-live="polite"></p><div id="quick-shift-copy-fallback" hidden><label class="quick-shift-label" for="quick-shift-copy-text">Copy this text<input id="quick-shift-copy-text" class="quick-shift-code" type="text" readonly></label></div>'
  );
}
export function quickShiftResult(root: HTMLElement, options: QuickShiftResultOptions): MenuBack {
  root.innerHTML = quickShiftResultMarkup(options);
  root.querySelector<HTMLButtonElement>('#quick-shift-replay')!.onclick = options.replay;
  root.querySelector<HTMLButtonElement>('#quick-shift-another')!.onclick = options.newShift;
  root.querySelector<HTMLButtonElement>('#quick-shift-result-back')!.onclick = options.back;
  const copy = async (text: string, label: string) => {
    const status = root.querySelector<HTMLElement>('#quick-shift-copy-status')!;
    try {
      await navigator.clipboard.writeText(text);
      if (status.isConnected) status.textContent = label + ' copied.';
    } catch {
      if (!status.isConnected) return;
      const wrap = root.querySelector<HTMLElement>('#quick-shift-copy-fallback')!;
      const input = root.querySelector<HTMLInputElement>('#quick-shift-copy-text')!;
      wrap.hidden = false;
      input.value = text;
      input.focus();
      input.select();
      status.textContent = 'Press Ctrl+C to copy the selected text.';
    }
  };
  root.querySelector<HTMLButtonElement>('#quick-shift-copy-seed')!.onclick = () => {
    void copy(options.record.seed, 'Seed');
  };
  const link = root.querySelector<HTMLButtonElement>('#quick-shift-copy-link');
  if (link && options.shareLink)
    link.onclick = () => {
      void copy(options.shareLink!, 'Challenge link');
    };
  return {
    back() {
      options.back();
      return true;
    },
  };
}
