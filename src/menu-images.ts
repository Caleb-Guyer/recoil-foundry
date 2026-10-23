import { LazyResource } from './lazy-resource.ts';
import type { Game } from './game.ts';
import type { ReportGun } from './combat-report-menu.ts';

const archive = new LazyResource(() => import('./archive-images.ts'));
const reward = new LazyResource(() => import('./reward-images.ts'));
const report = new LazyResource(() => import('./combat-report-art.ts'));
const epochs = new WeakMap<HTMLElement, number>();
export function cancelMenuImages(root: HTMLElement) {
  epochs.set(root, (epochs.get(root) ?? 0) + 1);
  archive.value?.stopArchiveImages(root);
}

function paint<T>(
  root: HTMLElement,
  selector: string,
  resource: LazyResource<T>,
  draw: (module: T) => void,
) {
  const targets = Array.from(root.querySelectorAll<HTMLCanvasElement>(selector));
  const epoch = epochs.get(root);
  if (!targets.length) return;
  // A menu may be rebuilt while its image code is downloading.
  const current = () =>
    epochs.get(root) === epoch &&
    targets.some((canvas) => canvas.isConnected && root.contains(canvas));
  const run = () => {
    if (resource.value) {
      if (current()) draw(resource.value);
      return;
    }
    void resource
      .load()
      .then((module) => {
        if (current()) draw(module);
      })
      .catch(() => {
        if (!current()) return;
        const status = document.createElement('button');
        status.className = 'quiet';
        status.textContent = 'Pictures unavailable · Retry';
        status.onclick = () => {
          status.remove();
          run();
        };
        targets.find((canvas) => canvas.isConnected)?.after(status);
      });
  };
  run();
}
export function drawArchiveImages(root: HTMLElement) {
  paint(root, 'canvas[data-archive-image]', archive, (m) => m.drawArchiveImages(root));
}
export function drawRewardImages(root: HTMLElement, game: Game) {
  paint(root, 'canvas[data-reward-image]', reward, (m) => m.drawRewardImages(root, game));
  drawArchiveImages(root);
}
export function drawCombatReportImages(root: HTMLElement, records: readonly ReportGun[]) {
  paint(root, 'canvas[data-run-gun]', report, (m) => m.drawCombatReportImages(root, records));
}
