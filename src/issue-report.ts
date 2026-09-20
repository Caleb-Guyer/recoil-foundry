import type { Game } from './game.ts';
import { GAME_VERSION } from './version.ts';
import { dailyFromSeed } from './daily.ts';

// Deliberate allowlist: never attach storage, URLs, browser fingerprints or save files.
export function issueDetails(game: Game): string {
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
  }
  return [
    'What happened?',
    '',
    'What did you expect?',
    '',
    'Steps to reproduce:',
    '',
    'Browser and device (optional):',
    '',
    'Game details (remove anything you do not want to share):',
    ...lines,
  ].join('\n');
}

export function issueDraftUrl(body: string): string {
  const url = new URL('https://github.com/Caleb-Guyer/recoil-foundry/issues/new');
  url.searchParams.set('template', 'bug_report.md');
  url.searchParams.set('body', body.slice(0, 6000));
  return url.href;
}

export function issueReportMenu(root: HTMLElement, game: Game, back: () => void) {
  root.innerHTML = `<h2 id="dialog-title">Report an issue.</h2>
    <p class="progress-intro">Edit the details below, then open a GitHub draft. Opening the draft shares this text with GitHub; review it before posting. A GitHub account is required. Nothing is sent automatically.</p>
    <label class="issue-label" for="issue-details">Report details</label>
    <textarea id="issue-details" class="issue-details" maxlength="6000" spellcheck="false"></textarea>
    <div class="actions"><button id="back" class="primary">Back</button>
      <a id="issue-draft" class="quiet" target="_blank" rel="noopener noreferrer">Open GitHub draft ↗</a>
      <button id="issue-copy" class="quiet">Copy details</button></div>
    <p id="issue-status" class="progress-feedback" role="status"></p>`;
  const field = root.querySelector<HTMLTextAreaElement>('#issue-details')!;
  const link = root.querySelector<HTMLAnchorElement>('#issue-draft')!;
  field.value = issueDetails(game);
  const update = () => {
    link.href = issueDraftUrl(field.value);
  };
  update();
  field.addEventListener('input', update);
  root.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  root.querySelector<HTMLButtonElement>('#issue-copy')!.onclick = async () => {
    const status = root.querySelector('#issue-status')!;
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = 'Details copied.';
    } catch {
      field.focus();
      field.select();
      status.textContent = 'Press Ctrl+C to copy the selected details.';
    }
  };
}
