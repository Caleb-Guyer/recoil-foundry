import { MODS, modDescription } from './rules.ts';
import { inspectUpgrade } from './upgrade-inspection.ts';
import { upgradePreviewMarkup } from './upgrade-preview-markup.ts';
import type { UpgradePreviewView } from './upgrade-preview-view.ts';
import type { FinaleService } from './finale-service.ts';

export type FinaleServicePanel = 'home' | 'offers' | 'confirm';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const name = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;

export function finaleServiceMarkup(
  service: FinaleService,
  panel: FinaleServicePanel = 'home',
  selected = 0,
) {
  if (panel === 'home')
    return (
      '<h2 id="dialog-title">Last service.</h2>' +
      '<p>One service before the fight.</p><div class="choices">' +
      '<button class="mod" data-service="repair"' +
      (service.game.hp >= 100 ? ' disabled' : '') +
      '><strong>Repair</strong><span>Recover up to 25 health.</span><span>' +
      Math.ceil(service.game.hp) +
      ' → ' +
      Math.min(100, Math.ceil(service.game.hp + 25)) +
      ' HP</span></button>' +
      '<button class="mod" data-service="refit"' +
      (!service.offers.length ? ' disabled' : '') +
      '><strong>Refit</strong><span>Exchange one fitting in your current path.</span></button>' +
      '<button class="mod quiet" data-service="leave"><strong>Leave</strong><span>Keep your build and move on.</span></button></div>'
    );
  if (panel === 'offers')
    return (
      '<h2 id="dialog-title">Refit one fitting.</h2><p>Choose a comparison.</p><div class="choices">' +
      service.offers
        .map(
          (swap, index) =>
            '<button class="mod reforge-choice" data-service-offer="' +
            index +
            '"><span class="reforge-from">' +
            escape(name(swap.from)) +
            '</span><span class="reforge-arrow" aria-hidden="true">↓</span><strong>' +
            escape(name(swap.to)) +
            '</strong><span class="mod-copy">' +
            escape(
              modDescription(
                MODS.find((m) => m.id === swap.to)!,
                service.game.mods.filter((id) => id !== swap.from),
                service.game.startingGun,
                service.game.seed,
              ),
            ) +
            '</span></button>',
        )
        .join('') +
      '</div><div class="dialog-actions finale-service-actions"><button data-service-back class="quiet">Back</button></div>'
    );
  const swap = service.offers[selected];
  if (!swap) return finaleServiceMarkup(service);
  return (
    '<h2 id="dialog-title">Refit your gun.</h2><p>' +
    escape(name(swap.from)) +
    ' → ' +
    escape(name(swap.to)) +
    '</p>' +
    upgradePreviewMarkup() +
    '<div class="dialog-actions finale-service-actions"><button data-service-confirm class="primary" disabled>Confirm refit</button><button data-service-back class="quiet">Back</button></div>'
  );
}

export interface FinaleServiceMenuOptions {
  closed: () => void;
  unlockAudio?: () => void;
  initialPanel?: 'home' | 'offers';
}
export class FinaleServiceMenu {
  root: HTMLElement;
  service: FinaleService;
  private options: FinaleServiceMenuOptions;
  private panel: FinaleServicePanel = 'home';
  private selected = 0;
  private preview: UpgradePreviewView | null = null;
  private previewLoadedAt = 0;
  private generation = 0;
  private stopped = false;
  private events = new AbortController();
  constructor(root: HTMLElement, service: FinaleService, options: FinaleServiceMenuOptions) {
    this.root = root;
    this.service = service;
    this.options = options;
    this.panel = options.initialPanel ?? 'home';
    this.render();
  }
  private completed(action: () => boolean) {
    this.options.unlockAudio?.();
    if (!action()) return;
    this.options.closed();
  }
  private render() {
    if (this.stopped) return;
    this.generation++;
    this.preview?.dispose();
    this.preview = null;
    this.events.abort();
    this.events = new AbortController();
    this.root.innerHTML = finaleServiceMarkup(this.service, this.panel, this.selected);
    const signal = this.events.signal;
    for (const button of Array.from(
      this.root.querySelectorAll<HTMLButtonElement>('[data-service]'),
    ))
      button.addEventListener(
        'click',
        () => {
          if (button.dataset.service === 'repair') this.completed(() => this.service.repair());
          else if (button.dataset.service === 'leave') this.completed(() => this.service.leave());
          else {
            this.panel = 'offers';
            this.render();
          }
        },
        { signal },
      );
    for (const button of Array.from(
      this.root.querySelectorAll<HTMLButtonElement>('[data-service-offer]'),
    ))
      button.addEventListener(
        'click',
        () => {
          this.selected = Number(button.dataset.serviceOffer);
          this.panel = 'confirm';
          this.render();
        },
        { signal },
      );
    this.root
      .querySelector<HTMLButtonElement>('[data-service-back]')
      ?.addEventListener('click', () => this.back(), { signal });
    this.root
      .querySelector<HTMLButtonElement>('[data-service-confirm]')
      ?.addEventListener('click', () => this.completed(() => this.service.choose(this.selected)), {
        signal,
      });
    this.root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    if (this.panel === 'confirm') void this.loadPreview();
  }
  private async loadPreview() {
    const generation = this.generation;
    const previewRoot = this.root.querySelector<HTMLElement>('.upgrade-preview')!;
    const idle = previewRoot.querySelector<HTMLElement>('.upgrade-preview-idle')!;
    idle.textContent = 'Loading gun comparison…';
    try {
      const { UpgradePreviewView } = await import('./upgrade-preview-view.ts');
      if (this.stopped || generation !== this.generation || !this.root.isConnected) return;
      const swap = this.service.offers[this.selected];
      const mod = MODS.find((m) => m.id === swap.to)!;
      const confirm = this.root.querySelector<HTMLButtonElement>('[data-service-confirm]')!;
      this.preview = new UpgradePreviewView(
        previewRoot,
        new Map([
          [
            confirm,
            inspectUpgrade(
              this.service.game.mods,
              mod,
              this.service.game.startingGun,
              this.service.game.hp,
              swap.from,
              this.service.game.seed,
            ),
          ],
        ]),
        true,
      );
      previewRoot.querySelector<HTMLElement>('[data-preview-after-label]')!.textContent =
        'After refit';
      this.previewLoadedAt = performance.now();
    } catch {
      if (this.stopped || generation !== this.generation || !this.root.isConnected) return;
      idle.textContent = 'Gun comparison could not load. ';
      const retry = document.createElement('button');
      retry.className = 'quiet';
      retry.textContent = 'Retry';
      retry.onclick = () => void this.loadPreview();
      idle.append(retry);
    }
  }
  back() {
    if (this.stopped) return;
    if (this.panel === 'home') this.completed(() => this.service.leave());
    else {
      this.panel = this.panel === 'confirm' ? 'offers' : 'home';
      this.render();
    }
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean) {
    this.preview?.frame(dt, now, reduced, active);
    if (!this.preview || !active || now - this.previewLoadedAt < 200) return;
    const previewRoot = this.root.querySelector<HTMLElement>('.upgrade-preview');
    const rect = previewRoot?.getBoundingClientRect();
    if (!rect || !rect.width || rect.bottom <= 0 || rect.top >= innerHeight) return;
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-service-confirm]');
    if (confirm) confirm.disabled = false;
  }
  dispose() {
    this.stopped = true;
    this.generation++;
    this.events.abort();
    this.preview?.dispose();
    this.preview = null;
  }
}
