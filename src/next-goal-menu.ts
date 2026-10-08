import type { NextGoal } from './next-goal.ts';

export function goalProgressLabel(goal: NextGoal) {
  return goal.progress ? `${goal.progress.current} / ${goal.progress.target}` : '';
}
export function nextGoalMenu(
  content: HTMLElement,
  goal: NextGoal,
  back: () => void,
  action?: { label: string; select: () => void },
) {
  content.innerHTML =
    '<p class="eyebrow" id="goal-category"></p><h2 id="dialog-title"></h2>' +
    '<p class="goal-requirement" id="goal-requirement"></p><p class="goal-count" id="goal-count" hidden></p>' +
    '<p class="goal-how" id="goal-how"></p><dl class="goal-reward" id="goal-reward" hidden><dt>Reward</dt><dd></dd></dl>' +
    '<p class="goal-optional">A suggested goal. Play at your own pace.</p>' +
    '<div class="actions">' +
    (action ? '<button id="goal-action" class="primary"></button>' : '') +
    '<button id="back" class="' +
    (action ? 'quiet' : 'primary') +
    '">Back</button></div>';
  content.querySelector('#goal-category')!.textContent =
    goal.kind === 'complete' ? 'YOUR PROGRESS' : 'NEXT GOAL';
  content.querySelector('#dialog-title')!.textContent = goal.title;
  content.querySelector('#goal-requirement')!.textContent = goal.requirement;
  content.querySelector('#goal-how')!.textContent = goal.hint;
  const count = content.querySelector<HTMLElement>('#goal-count')!;
  count.hidden = !goal.progress;
  count.textContent = goal.progress ? goalProgressLabel(goal) + ' ' + goal.progress.unit : '';
  const reward = content.querySelector<HTMLElement>('#goal-reward')!;
  reward.hidden = !goal.reward;
  reward.querySelector('dd')!.textContent = goal.reward ?? '';
  content.querySelector<HTMLButtonElement>('#back')!.onclick = back;
  if (action) {
    const button = content.querySelector<HTMLButtonElement>('#goal-action')!;
    button.textContent = action.label;
    button.onclick = action.select;
  }
}
