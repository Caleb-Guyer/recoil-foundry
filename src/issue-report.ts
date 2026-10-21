import type { Game } from './game.ts';
import { GAME_VERSION } from './version.ts';
import { STARTING_GUNS } from './starting-guns.ts';
import { dailyFromSeed } from './daily.ts';
import { REGION_NAMES } from './regions.ts';
import { MODS } from './rules.ts';

export const PLAYTEST_THREAD_URL =
  'https://itch.io/t/7174290/recoil-foundry-free-browser-does-recoil-movement-make-sense-in-the-first-ten-minutes';
export const PLAYTEST_ANSWER_LIMIT = 900;
export const PLAYTEST_SUMMARY_LIMIT = 2700;

export const FEEDBACK_TYPES = {
  playtest: { label: 'Playtest', template: 'playtest.md' },
  bug: { label: 'Bug', template: 'bug_report.md' },
  difficulty: { label: 'Difficulty', template: 'difficulty_report.md' },
  suggestion: { label: 'Suggestion', template: 'suggestion.md' },
} as const;
export type FeedbackType = keyof typeof FEEDBACK_TYPES;
export interface PlaytestDraft {
  experience: string;
  bestMoment: string;
  friction: string;
  restart: string;
  summary: string;
}
export interface ReportDraft {
  type: FeedbackType;
  bodies: Record<FeedbackType, string>;
  playtest: PlaytestDraft;
}

function createPlaytestDraft(game: Game): PlaytestDraft {
  return {
    experience: '',
    bestMoment: '',
    friction: '',
    restart: '',
    summary: runSummary(game).slice(0, PLAYTEST_SUMMARY_LIMIT),
  };
}

// One in-memory draft per gameplay session; never stored or sent in the background.
export function createReportDraft(game: Game, type: FeedbackType = 'bug'): ReportDraft {
  const playtest = createPlaytestDraft(game);
  return {
    type,
    bodies: {
      playtest: playtestDetails(playtest),
      bug: issueDetails(game, 'bug'),
      difficulty: issueDetails(game, 'difficulty'),
      suggestion: issueDetails(game, 'suggestion'),
    },
    playtest,
  };
}

// Deliberate allowlist: never attach storage, URLs, browser fingerprints or save files.
export function runSummary(game: Game): string {
  const lines = [`Version: ${GAME_VERSION}`];
  if (game.mode === 'title') lines.push('Mode: Title');
  else {
    const mode = game.workshop.active
      ? 'Workshop'
      : game.practice
        ? 'Practice'
        : game.testRun
          ? 'Preset test'
          : dailyFromSeed(game.seed)
            ? 'Daily'
            : 'Campaign';
    lines.push(
      `Mode: ${mode}${game.overtime ? ' / Overtime' : ''}`,
      `State: ${game.mode}`,
      `Active run time: ${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')} (includes time before Continue; excludes pauses)`,
      ...(game.security ? [`Security: ${game.security.level} / rules ${game.security.rules}`] : []),
      `Seed: ${JSON.stringify(game.seed)}`,
      `Room: ${game.stage + 1} / ${game.level.area} / ${game.level.id}`,
      `Route: ${game.escape ? 'Extraction' : game.detour ? 'Detour' : 'Main'}`,
      `Gun: ${game.mods.join(', ') || 'Starting gun'}`,
      `Starting gun: ${STARTING_GUNS[game.startingGun].name}`,
      `Upgrades: ${game.mods.map((id) => MODS.find((mod) => mod.id === id)?.name ?? id).join(', ') || 'None'}`,
      ...(game.uprising.run
        ? [
            `Uprising route: ${game.uprising.run.choices.join(', ') || 'Not chosen'}`,
            `Objectives: ${game.uprising.run.outcomes.map((o) => o.route + '=' + o.result).join(', ') || 'None completed'}`,
          ]
        : []),
      ...(mode === 'Campaign'
        ? [`Achievement fitting pool: ${game.unlocks.join(', ') || 'Original fittings'}`]
        : []),
      ...(game.factory
        ? [`Factory: ${game.factory.condition} / rules ${game.factory.version}`]
        : []),
    );
    if (game.region)
      lines.push(
        `Regional route: ${game.region === 'pending' ? 'Not chosen' : REGION_NAMES[game.region]}`,
        `Route revision: ${game.annexVersion}`,
      );
  }
  return lines.join('\n');
}

export function playtestDetails(draft: PlaytestDraft): string {
  const answer = (value: string) => value.trim() || 'Not answered';
  return [
    `First time playing: ${answer(draft.experience.slice(0, 60))}`,
    '',
    'Best moment:',
    answer(draft.bestMoment.slice(0, PLAYTEST_ANSWER_LIMIT)),
    '',
    'First confusing, unfair or frustrating moment:',
    answer(draft.friction.slice(0, PLAYTEST_ANSWER_LIMIT)),
    '',
    'After dying, did you actually restart? Did you want another run, and why?',
    answer(draft.restart.slice(0, PLAYTEST_ANSWER_LIMIT)),
    '',
    'Run summary (edit or remove before posting):',
    draft.summary.slice(0, PLAYTEST_SUMMARY_LIMIT),
  ].join('\n');
}

export function issueDetails(game: Game, type: FeedbackType = 'bug'): string {
  if (type === 'playtest') return playtestDetails(createPlaytestDraft(game));
  const prompts =
    type === 'difficulty'
      ? [
          'Which encounter or upgrade?',
          '',
          'Too easy, too hard, or unclear? What happened?',
          '',
          'What did you try, and what would have helped?',
          '',
        ]
      : type === 'suggestion'
        ? ['What would you change?', '', 'Why would it improve the game?', '']
        : [
            'What happened?',
            '',
            'What did you expect?',
            '',
            'Steps to reproduce:',
            '',
            'Browser and device (optional):',
            '',
          ];
  return [
    ...prompts,
    'Game details (remove anything you do not want to share):',
    runSummary(game),
  ].join('\n');
}

export function issueDraftUrl(body: string, type: FeedbackType = 'bug'): string {
  const url = new URL('https://github.com/Caleb-Guyer/recoil-foundry/issues/new');
  url.searchParams.set('template', FEEDBACK_TYPES[type].template);
  url.searchParams.set('body', body.slice(0, 6000));
  return url.href;
}

export function issueReportMenu(
  root: HTMLElement,
  game: Game,
  back: () => void,
  draft = createReportDraft(game),
  feedback = false,
) {
  root.innerHTML = `<h2 id="dialog-title">${feedback ? 'Feedback.' : 'Report an issue.'}</h2>
    <p id="feedback-intro" class="progress-intro"></p>
    <div class="feedback-types" role="group" aria-label="Feedback type">${(
      Object.keys(FEEDBACK_TYPES) as FeedbackType[]
    )
      .map(
        (type) =>
          `<button type="button" class="quiet" data-feedback-type="${type}" aria-pressed="${draft.type === type}">${FEEDBACK_TYPES[type].label}</button>`,
      )
      .join('')}</div>
    <div id="feedback-editor"></div>
    <div id="issue-manual-copy" hidden><label class="issue-label" for="issue-copy-text">Select and copy your feedback</label><textarea id="issue-copy-text" class="issue-details" readonly></textarea></div>
    <div class="actions"><button id="back" class="primary">Back</button>
      <button id="issue-copy" class="quiet">Copy details</button>
      <a id="playtest-thread" class="quiet" href="${PLAYTEST_THREAD_URL}" target="_blank" rel="noopener noreferrer">Open itch.io discussion ↗</a>
      <a id="issue-draft" class="quiet" target="_blank" rel="noopener noreferrer">Open GitHub draft ↗</a></div>
    <p id="issue-status" class="progress-feedback" role="status"></p>`;
  const editor = root.querySelector<HTMLElement>('#feedback-editor')!;
  const link = root.querySelector<HTMLAnchorElement>('#issue-draft')!;
  const status = root.querySelector('#issue-status')!;
  const manualCopy = root.querySelector<HTMLElement>('#issue-manual-copy')!;
  const update = () => {
    link.href = issueDraftUrl(draft.bodies[draft.type], draft.type);
    status.textContent = '';
    manualCopy.hidden = true;
  };
  const renderEditor = () => {
    const playtest = draft.type === 'playtest';
    root.querySelector('#feedback-intro')!.textContent = playtest
      ? 'Answer what you can, review your run summary, then copy into the itch.io discussion. Short sessions are useful too. Nothing is posted automatically.'
      : 'Edit the details, then copy them or open a GitHub draft. Opening a draft shares this text with GitHub; review it before posting. A GitHub account is required.';
    root.querySelector<HTMLElement>('#playtest-thread')!.hidden = !playtest;
    root.querySelector('#issue-copy')!.textContent = playtest
      ? 'Copy playtest feedback'
      : 'Copy details';
    editor.innerHTML = playtest
      ? `<label class="issue-label" for="playtest-experience">First time playing?</label>
        <select id="playtest-experience" class="playtest-experience"><option value="">Choose if you like</option><option>First time</option><option>Returning player</option><option>Not sure</option></select>
        <label class="issue-label" for="playtest-bestMoment">What was your best moment?</label>
        <textarea id="playtest-bestMoment" class="issue-details playtest-answer" maxlength="${PLAYTEST_ANSWER_LIMIT}" rows="2" placeholder="A moment, fight or upgrade you enjoyed. No highlight yet is useful too."></textarea>
        <label class="issue-label" for="playtest-friction">What first felt confusing, unfair or frustrating?</label>
        <textarea id="playtest-friction" class="issue-details playtest-answer" maxlength="${PLAYTEST_ANSWER_LIMIT}" rows="2" placeholder="What happened, and what did you expect? Nothing confusing is a useful answer too."></textarea>
        <label class="issue-label" for="playtest-restart">After dying, did you restart? Did you want another run, and why?</label>
        <textarea id="playtest-restart" class="issue-details playtest-answer" maxlength="${PLAYTEST_ANSWER_LIMIT}" rows="2" placeholder="Tell us what you actually did. Stopped, did not die, or tried but could not restart are useful answers too."></textarea>
        <details class="playtest-summary"><summary>Review run summary</summary>
          <label class="issue-label" for="playtest-summary">Included when copied. Edit or remove anything you do not want to share.</label>
          <textarea id="playtest-summary" class="issue-details" maxlength="${PLAYTEST_SUMMARY_LIMIT}" spellcheck="false"></textarea>
        </details>`
      : '<label class="issue-label" for="issue-details">Report details</label><textarea id="issue-details" class="issue-details" maxlength="6000" spellcheck="false"></textarea>';
    if (playtest) {
      for (const key of ['experience', 'bestMoment', 'friction', 'restart', 'summary'] as const) {
        const field = editor.querySelector<HTMLTextAreaElement | HTMLSelectElement>(
          '#playtest-' + key,
        )!;
        field.value = draft.playtest[key];
        field.addEventListener(key === 'experience' ? 'change' : 'input', () => {
          draft.playtest[key] = field.value;
          draft.bodies.playtest = playtestDetails(draft.playtest);
          update();
        });
      }
    } else {
      const field = editor.querySelector<HTMLTextAreaElement>('#issue-details')!;
      field.value = draft.bodies[draft.type];
      field.addEventListener('input', () => {
        draft.bodies[draft.type] = field.value;
        update();
      });
    }
    update();
  };
  renderEditor();
  const types = root.querySelectorAll<HTMLButtonElement>('[data-feedback-type]');
  types.forEach((button) => {
    button.onclick = () => {
      draft.type = button.dataset.feedbackType as FeedbackType;
      types.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      renderEditor();
    };
  });
  root.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  root.querySelector<HTMLButtonElement>('#issue-copy')!.onclick = async () => {
    const copied = draft.bodies[draft.type];
    const type = draft.type;
    try {
      await navigator.clipboard.writeText(copied);
      if (!status.isConnected || draft.type !== type || draft.bodies[type] !== copied) return;
      status.textContent =
        type === 'playtest'
          ? 'Feedback copied. Open the itch.io discussion, paste it into a reply, and review before posting.'
          : 'Details copied.';
    } catch {
      if (!status.isConnected || draft.type !== type || draft.bodies[type] !== copied) return;
      // A selectable complete report also works when clipboard access is unavailable.
      manualCopy.hidden = false;
      const field = manualCopy.querySelector<HTMLTextAreaElement>('#issue-copy-text')!;
      field.value = copied;
      field.focus();
      field.select();
      status.textContent = 'Press Ctrl+C to copy the selected details.';
    }
  };
}
