import type { Game } from './game.ts';
import { Renderer } from './render.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from './upgrade-demo.ts';
import type { UpgradeInspection } from './upgrade-inspection.ts';

export const upgradePreviewMarkup = () =>
  '<section class="upgrade-preview" aria-label="Gun comparison"><div class="upgrade-preview-idle">Hover or focus a choice to compare your gun.</div><div class="upgrade-preview-detail" hidden><div class="upgrade-preview-heading"><strong data-preview-title></strong><span>Firing range</span></div><div class="upgrade-preview-scenes"><figure><figcaption>Current gun</figcaption><canvas data-preview-before aria-hidden="true"></canvas></figure><figure><figcaption data-preview-after-label>With upgrade</figcaption><canvas data-preview-after aria-hidden="true"></canvas></figure></div><div class="upgrade-preview-summary" id="upgrade-preview-summary" aria-live="polite"></div></div></section>';

export class UpgradePreviewView {
  root: HTMLElement;
  private abort = new AbortController();
  private selections = new Map<HTMLButtonElement, UpgradeInspection>();
  private selected: HTMLButtonElement | null = null;
  private demos: { game: Game; renderer: Renderer }[] = [];
  private dirty = false;
  private selectedAt = 0;
  private step = 0;
  private accumulator = 0;
  private renderedAt = -1000;
  private reduced = false;
  private stopped = false;
  constructor(root: HTMLElement, choices: Map<HTMLButtonElement, UpgradeInspection>) {
    this.root = root;
    this.selections = choices;
    for (const button of choices.keys()) {
      button.setAttribute('aria-controls', 'upgrade-preview-summary');
      button.addEventListener('pointerenter', () => this.select(button), {
        signal: this.abort.signal,
      });
      button.addEventListener('focus', () => this.select(button), { signal: this.abort.signal });
      button.addEventListener(
        'pointerleave',
        () =>
          this.select(
            choices.has(document.activeElement as HTMLButtonElement)
              ? (document.activeElement as HTMLButtonElement)
              : null,
          ),
        { signal: this.abort.signal },
      );
      button.addEventListener(
        'blur',
        (event) => {
          if (!choices.has(event.relatedTarget as HTMLButtonElement) && !button.matches(':hover'))
            this.select(null);
        },
        { signal: this.abort.signal },
      );
    }
  }
  private clearDemos() {
    for (const { game } of this.demos) destroyUpgradeDemo(game);
    this.demos = [];
    this.accumulator = this.step = 0;
  }
  private select(button: HTMLButtonElement | null) {
    if (this.stopped || button === this.selected) return;
    this.selected?.classList.remove('mod-inspected');
    this.selected = button;
    this.clearDemos();
    const selection = button && this.selections.get(button);
    this.root.querySelector<HTMLElement>('.upgrade-preview-idle')!.hidden = !!selection;
    this.root.querySelector<HTMLElement>('.upgrade-preview-detail')!.hidden = !selection;
    this.dirty = !!selection && selection.mod.id !== 'repair';
    this.selectedAt = performance.now();
    if (!selection) return;
    button!.classList.add('mod-inspected');
    this.root.querySelector<HTMLElement>('[data-preview-title]')!.textContent = selection.mod.name;
    const summary = this.root.querySelector<HTMLElement>('.upgrade-preview-summary')!;
    summary.replaceChildren();
    const stats = document.createElement('dl');
    stats.className = 'upgrade-preview-stats';
    for (const change of selection.changes) {
      const item = document.createElement('div'),
        label = document.createElement('dt'),
        value = document.createElement('dd');
      label.textContent = change.label;
      value.textContent =
        change.before === 'Current' ? change.after : change.before + ' → ' + change.after;
      item.append(label, value);
      stats.append(item);
    }
    if (stats.children.length) summary.append(stats);
    for (const text of selection.connections) {
      const note = document.createElement('p');
      note.textContent = text;
      summary.append(note);
    }
    this.root.querySelector<HTMLElement>('.upgrade-preview-scenes')!.hidden =
      selection.mod.id === 'repair';
    if (!selection.changes.length && !selection.connections.length) {
      const note = document.createElement('p');
      note.textContent = selection.description;
      summary.append(note);
    }
    this.root
      .querySelectorAll('canvas')
      .forEach((canvas) => canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height));
  }
  private rebuild() {
    const selection = this.selected && this.selections.get(this.selected);
    this.clearDemos();
    if (!selection || selection.mod.id === 'repair') return;
    for (const [index, mods] of [selection.beforeMods, selection.afterMods].entries()) {
      const canvas = this.root.querySelectorAll('canvas')[index];
      const game = createUpgradeDemo(mods, selection.startingGun, selection.seed, selection.mod.id);
      const renderer = new Renderer(canvas, game);
      renderer.reduced = true;
      this.demos.push({ game, renderer });
    }
    this.dirty = false;
    this.renderedAt = -1000;
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean) {
    if (this.stopped || !this.selected || !active || !this.root.isConnected) {
      this.accumulator = 0;
      return;
    }
    const rect = this.root.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= innerHeight || !rect.width) {
      this.accumulator = 0;
      return;
    }
    if (this.reduced !== reduced) {
      this.reduced = reduced;
      this.dirty = true;
    }
    if (this.dirty && now - this.selectedAt >= 100) this.rebuild();
    if (!this.demos.length) return;
    const resized = this.demos.some(({ renderer }) => {
      const bounds = renderer.canvas.getBoundingClientRect();
      return renderer.width !== bounds.width || renderer.height !== bounds.height;
    });
    if (reduced && this.step > 0 && !resized) return;
    this.accumulator = Math.min(0.1, this.accumulator + dt);
    const frames = reduced ? (this.step === 0 ? 25 : 0) : Math.floor(this.accumulator * 60);
    for (let i = 0; i < frames; i++) {
      for (const { game } of this.demos) game.tick(1 / 60, upgradeDemoInput(game, this.step));
      this.step++;
    }
    this.accumulator -= reduced ? this.accumulator : frames / 60;
    if (this.step >= 420 || this.demos.some(({ game }) => game.mode !== 'playing')) this.rebuild();
    if (now - this.renderedAt < 1000 / 30) return;
    for (const { game, renderer } of this.demos) {
      const rect = renderer.canvas.getBoundingClientRect();
      if (renderer.width !== rect.width || renderer.height !== rect.height) renderer.resize();
      renderer.draw(now, {
        camera: { x: 20, y: Math.min(420, Math.max(-60, game.player.position.y - 120)) },
        scale: renderer.width / 900,
        player: true,
      });
    }
    this.renderedAt = now;
  }
  dispose() {
    this.stopped = true;
    this.abort.abort();
    this.clearDemos();
    this.selected?.classList.remove('mod-inspected');
    this.selected = null;
    this.selections.clear();
  }
}
