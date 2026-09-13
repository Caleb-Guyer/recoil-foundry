import type { MenuDirection } from './controller.ts';

function controls(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input[type="checkbox"], input[type="range"], summary',
    ),
  ).filter((el) => {
    if (
      el.closest('[hidden], [inert]') ||
      !el.getClientRects().length ||
      (el instanceof HTMLInputElement && el.disabled)
    )
      return false;
    // Closed details can still report layout rectangles for their hidden descendants.
    for (let parent = el.parentElement; parent && parent !== root; parent = parent.parentElement)
      if (
        parent instanceof HTMLDetailsElement &&
        !parent.open &&
        parent.querySelector(':scope > summary') !== el
      )
        return false;
    return getComputedStyle(el).visibility !== 'hidden';
  });
}
export function focusControllerMenu(root: HTMLElement) {
  const available = controls(root);
  if (!available.includes(document.activeElement as HTMLElement)) available[0]?.focus();
}
export function navigateControllerMenu(root: HTMLElement, direction: MenuDirection) {
  const available = controls(root);
  const current = document.activeElement as HTMLElement;
  if (!available.includes(current)) {
    available[0]?.focus();
    return;
  }
  const horizontal = direction === 'left' || direction === 'right';
  if (horizontal && current instanceof HTMLInputElement && current.type === 'range') {
    if (direction === 'right') current.stepUp();
    else current.stepDown();
    current.dispatchEvent(new Event('input', { bubbles: true }));
    current.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  const rect = current.getBoundingClientRect();
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  const candidates = available
    .filter((el) => el !== current)
    .map((el) => {
      const next = el.getBoundingClientRect();
      const dx = next.x + next.width / 2 - x,
        dy = next.y + next.height / 2 - y;
      const forward = (horizontal ? dx : dy) * sign;
      const cross = horizontal
        ? Math.max(0, rect.top - next.bottom, next.top - rect.bottom)
        : Math.max(0, rect.left - next.right, next.left - rect.right);
      return { el, forward, score: forward + cross * (horizontal ? 3 : 0.5), cross };
    })
    .filter((n) => n.forward > 4 && (!horizontal || n.cross < Math.max(40, rect.height / 2)));
  candidates.sort((a, b) => a.score - b.score);
  const next = candidates[0]?.el;
  if (next) {
    next.focus({ preventScroll: true });
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
export function confirmControllerMenu(root: HTMLElement) {
  const current = document.activeElement as HTMLElement;
  if (controls(root).includes(current)) current.click();
  else focusControllerMenu(root);
}
