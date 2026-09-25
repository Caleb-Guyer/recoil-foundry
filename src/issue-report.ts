import type { Game } from './game.ts';
import { GAME_VERSION } from './version.ts';
import { dailyFromSeed } from './daily.ts';
import { REGION_NAMES } from './regions.ts';

export const FEEDBACK_TYPES = {
  bug: { label: 'Bug', template: 'bug_report.md' },
  difficulty: { label: 'Difficulty', template: 'difficulty_report.md' },
  suggestion: { label: 'Suggestion', template: 'suggestion.md' },
} as const;
export type FeedbackType = keyof typeof FEEDBACK_TYPES;
export interface ReportDraft {
  type: FeedbackType;
  bodies: Record<FeedbackType, string>;
}

// One in-memory draft per gameplay session; never stored or sent in the background.
export function createReportDraft(game: Game): ReportDraft {
  return {
    type: 'bug',
    bodies: {
      bug: issueDetails(game, 'bug'),
      difficulty: issueDetails(game, 'difficulty'),
      suggestion: issueDetails(game, 'suggestion'),
    },
  };
}

// Deliberate allowlist: never attach storage, URLs, browser fingerprints or save files.
export function issueDetails(game: Game, type: FeedbackType = 'bug'): string {
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
      `Seed: ${JSON.stringify(game.seed)}`,
      `Room: ${game.stage + 1} / ${game.level.area} / ${game.level.id}`,
      `Route: ${game.escape ? 'Extraction' : game.detour ? 'Detour' : 'Main'}`,
      `Gun: ${game.mods.join(', ') || 'Starting gun'}`,
    );
    if (game.region)
      lines.push(
        `Regional route: ${game.region === 'pending' ? 'Not chosen' : REGION_NAMES[game.region]}`,
        `Route revision: ${game.annexVersion}`,
      );
  }
  const prompts =
    type === 'difficulty'
      ? ['Which encounter or upgrade?', '', 'Too easy, too hard, or unclear? What happened?', '']
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
  return [...prompts, 'Game details (remove anything you do not want to share):', ...lines].join(
    '\n',
  );
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
    <p class="progress-intro">Edit the details below, then open a GitHub draft. Opening the draft shares this text with GitHub; review it before posting. A GitHub account is required. Nothing is sent automatically.</p>
    <div class="feedback-types" role="group" aria-label="Feedback type">${(
      Object.keys(FEEDBACK_TYPES) as FeedbackType[]
    )
      .map(
        (type) =>
          `<button type="button" class="quiet" data-feedback-type="${type}" aria-pressed="${draft.type === type}">${FEEDBACK_TYPES[type].label}</button>`,
      )
      .join('')}</div>
    <label class="issue-label" for="issue-details">Report details</label>
    <textarea id="issue-details" class="issue-details" maxlength="6000" spellcheck="false"></textarea>
    <div class="actions"><button id="back" class="primary">Back</button>
      <a id="issue-draft" class="quiet" target="_blank" rel="noopener noreferrer">Open GitHub draft ↗</a>
      <button id="issue-copy" class="quiet">Copy details</button></div>
    <p id="issue-status" class="progress-feedback" role="status"></p>`;
  const field = root.querySelector<HTMLTextAreaElement>('#issue-details')!;
  const link = root.querySelector<HTMLAnchorElement>('#issue-draft')!;
  const status = root.querySelector('#issue-status')!;
  field.value = draft.bodies[draft.type];
  const update = () => {
    draft.bodies[draft.type] = field.value;
    link.href = issueDraftUrl(field.value, draft.type);
  };
  update();
  field.addEventListener('input', () => {
    update();
    status.textContent = '';
  });
  const types = root.querySelectorAll<HTMLButtonElement>('[data-feedback-type]');
  types.forEach((button) => {
    button.onclick = () => {
      update();
      draft.type = button.dataset.feedbackType as FeedbackType;
      field.value = draft.bodies[draft.type];
      types.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      update();
      status.textContent = '';
    };
  });
  root.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  root.querySelector<HTMLButtonElement>('#issue-copy')!.onclick = async () => {
    const copied = field.value;
    const type = draft.type;
    try {
      await navigator.clipboard.writeText(copied);
      if (!field.isConnected || draft.type !== type || field.value !== copied) return;
      status.textContent = 'Details copied.';
    } catch {
      if (!field.isConnected || draft.type !== type || field.value !== copied) return;
      field.focus();
      field.select();
      status.textContent = 'Press Ctrl+C to copy the selected details.';
    }
  };
}
