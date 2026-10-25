import { MODS } from './rules.ts';
import { inspectUpgrade } from './upgrade-inspection.ts';
import { upgradePreviewMarkup } from './upgrade-preview-markup.ts';
import type { UpgradePreviewView } from './upgrade-preview-view.ts';
import {
  UPRISING_REPAIR,
  type UprisingReward,
  type UprisingRewardChoice,
  type UprisingRewardContext,
} from './uprising-rewards.ts';

export interface UprisingRewardMenuSource extends UprisingRewardContext {
  reward: UprisingReward;
  title?: string;
  consequence?: string;
}
export interface UprisingRewardMenuOptions {
  choose: (choice: UprisingRewardChoice) => boolean;
  completed: () => void;
  unlockAudio?: () => void;
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const name = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;

export function uprisingRewardMarkup(
  source: UprisingRewardMenuSource,
  panel: 'home' | 'refit' = 'home',
) {
  const reward = source.reward;
  if (reward.selected !== undefined)
    return '<h2 id="dialog-title">Payment received.</h2><p>Your job reward is already recorded.</p><div class="actions"><button class="primary" data-job-reward-done>Continue</button></div>';
  if (panel === 'refit' && reward.offer)
    return (
      '<h2 id="dialog-title">Refit your gun.</h2><p>' +
      escape(name(reward.offer.from)) +
      ' → ' +
      escape(name(reward.offer.to)) +
      '</p>' +
      upgradePreviewMarkup() +
      '<div class="dialog-actions finale-service-actions"><button class="primary" data-job-reward-confirm disabled>Confirm refit</button><button class="quiet" data-job-reward-back>Back</button></div>'
    );
  return (
    '<p class="eyebrow">JOB PAYMENT</p><h2 id="dialog-title">' +
    escape(source.title ?? 'Job complete.') +
    '</h2>' +
    (source.consequence
      ? '<p class="practice-record-note">' + escape(source.consequence) + '</p>'
      : '') +
    '<p>Choose one payment.</p><div class="choices">' +
    '<button class="mod" data-job-reward="repair"' +
    (source.hp >= 100 ? ' disabled' : '') +
    '><strong>Repair</strong><span>Recover up to ' +
    UPRISING_REPAIR +
    ' health.</span><span>' +
    Math.ceil(source.hp) +
    ' → ' +
    Math.min(100, Math.ceil(source.hp + UPRISING_REPAIR)) +
    ' HP</span></button>' +
    '<button class="mod" data-job-reward="reroll"><strong>Reroll credit</strong><span>One future upgrade reroll costs no health.</span></button>' +
    (reward.offer
      ? '<button class="mod" data-job-reward="refit"><strong>Refit</strong><span>' +
        escape(name(reward.offer.from)) +
        ' → ' +
        escape(name(reward.offer.to)) +
        '</span><span>Compare your complete gun before confirming.</span></button>'
      : '') +
    '</div><p class="practice-record-note">Your ordinary room upgrade follows this payment.</p>'
  );
}

/** A single payment step; the complete native gun comparison remains lazy-loaded. */
export class UprisingRewardMenu {
  readonly root: HTMLElement;
  readonly source: UprisingRewardMenuSource;
  private options: UprisingRewardMenuOptions;
  private panel: 'home' | 'refit' = 'home';
  private preview: UpgradePreviewView | null = null;
  private previewLoadedAt = 0;
  private generation = 0;
  private stopped = false;
  private events = new AbortController();
  constructor(
    root: HTMLElement,
    source: UprisingRewardMenuSource,
    options: UprisingRewardMenuOptions,
  ) {
    this.root = root;
    this.source = source;
    this.options = options;
    this.render();
  }
  private choose(choice: UprisingRewardChoice) {
    this.options.unlockAudio?.();
    if (this.stopped || !this.options.choose(choice)) return false;
    this.options.completed();
    return true;
  }
  private render() {
    if (this.stopped) return;
    this.generation++;
    this.preview?.dispose();
    this.preview = null;
    this.events.abort();
    this.events = new AbortController();
    this.root.innerHTML = uprisingRewardMarkup(this.source, this.panel);
    const signal = this.events.signal;
    for (const button of Array.from(
      this.root.querySelectorAll<HTMLButtonElement>('[data-job-reward]'),
    ))
      button.addEventListener(
        'click',
        () => {
          const choice = button.dataset.jobReward as UprisingRewardChoice;
          if (choice === 'refit') {
            this.panel = 'refit';
            this.render();
          } else this.choose(choice);
        },
        { signal },
      );
    this.root
      .querySelector<HTMLButtonElement>('[data-job-reward-back]')
      ?.addEventListener('click', () => this.back(), { signal });
    this.root.querySelector<HTMLButtonElement>('[data-job-reward-confirm]')?.addEventListener(
      'click',
      () => {
        const button = this.root.querySelector<HTMLButtonElement>('[data-job-reward-confirm]');
        if (button && !button.disabled) this.choose('refit');
      },
      { signal },
    );
    this.root
      .querySelector<HTMLButtonElement>('[data-job-reward-done]')
      ?.addEventListener('click', () => this.options.completed(), { signal });
    this.root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    if (this.panel === 'refit') void this.loadPreview();
  }
  private async loadPreview() {
    const generation = this.generation;
    const previewRoot = this.root.querySelector<HTMLElement>('.upgrade-preview')!;
    const idle = previewRoot.querySelector<HTMLElement>('.upgrade-preview-idle')!;
    idle.textContent = 'Loading gun comparison…';
    try {
      const { UpgradePreviewView } = await import('./upgrade-preview-view.ts');
      if (this.stopped || generation !== this.generation || !this.root.isConnected) return;
      const swap = this.source.reward.offer!;
      const mod = MODS.find((m) => m.id === swap.to)!;
      const confirm = this.root.querySelector<HTMLButtonElement>('[data-job-reward-confirm]')!;
      this.preview = new UpgradePreviewView(
        previewRoot,
        new Map([
          [
            confirm,
            inspectUpgrade(
              this.source.mods,
              mod,
              this.source.startingGun,
              this.source.hp,
              swap.from,
              this.source.seed,
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
    if (this.stopped || this.panel === 'home') return;
    this.panel = 'home';
    this.render();
  }
  /** Optional number-key adapter; a refit always opens its comparison first. */
  activate(index: number) {
    if (this.stopped || this.panel !== 'home' || !Number.isInteger(index)) return false;
    const choice = (['repair', 'reroll', 'refit'] as const)[index];
    if (!choice || (choice === 'repair' && this.source.hp >= 100)) return false;
    if (choice === 'refit') {
      if (!this.source.reward.offer) return false;
      this.panel = 'refit';
      this.render();
      return true;
    }
    return this.choose(choice);
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean) {
    this.preview?.frame(dt, now, reduced, active);
    if (!this.preview || !active || now - this.previewLoadedAt < 200) return;
    const previewRoot = this.root.querySelector<HTMLElement>('.upgrade-preview');
    const rect = previewRoot?.getBoundingClientRect();
    if (!rect || !rect.width || rect.bottom <= 0 || rect.top >= innerHeight) return;
    const confirm = this.root.querySelector<HTMLButtonElement>('[data-job-reward-confirm]');
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
