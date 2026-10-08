import type { goalRunSummary } from './goal-run.ts';
import { escapeLogbook } from './logbook-menu.ts';
type Summary = NonNullable<ReturnType<typeof goalRunSummary>>;

export function goalRunMarkup(
  summary: Summary | null,
  ended = false,
  saved = true,
  preview = false,
) {
  if (!summary) return '';
  const { goal, status, discoveries, resumed } = summary;
  const note =
    ended && discoveries
      ? `${discoveries} new upgrade${discoveries === 1 ? '' : 's'} ${preview ? 'in this preview' : saved ? 'kept' : 'in this session'}${resumed ? ' since Continue' : ''}.`
      : '';
  return `<${ended ? 'section' : 'button type="button"'} class="run-goal${ended ? ' run-goal-result' : ''}"${ended ? ' aria-label="Goal progress this attempt"' : ' id="pause-goal" aria-haspopup="dialog"'}><span class="next-goal-label">${ended ? (preview ? 'PREVIEW GOAL' : 'GOAL THIS ATTEMPT') : 'YOUR GOAL'}</span><strong>${escapeLogbook(goal.title)}</strong><span class="run-goal-status">${escapeLogbook(status)}</span>${note ? `<span class="run-goal-note">${note}</span>` : ''}</${ended ? 'section' : 'button'}>`;
}
