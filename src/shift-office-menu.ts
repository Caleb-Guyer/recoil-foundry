import type { Game } from './game.ts';
import { MODS } from './rules.ts';
import { SHIFT_ROUTE_NAMES } from './shift-route-layouts.ts';
import type { ShiftRouteId } from './shift-route-layouts.ts';
import { EXPERIMENTS, EVOLUTIONS, type ExperimentId, type ShiftCircuit } from './shift-run.ts';
import type { ShiftMorphId } from './shift-catalog.ts';
import { upgradePreviewMarkup } from './upgrade-preview-markup.ts';
import { inspectUpgrade } from './upgrade-inspection.ts';
import type { UpgradePreviewView } from './upgrade-preview-view.ts';

type Panel = 'home' | 'district' | 'power' | 'prototype' | 'experiment' | 'lease' | 'evolution';
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const name = (id: string) => MODS.find((m) => m.id === id)?.name ?? id;
const MORPH_COPY: Record<ShiftMorphId, string> = {
  'piston-lance': 'Short, powerful pistons strike and retract. Keeps your earned firing pattern.',
  'cable-saw':
    'Cast tethered blades, sweep your aim, then cut on their return. Cover blocks the cable.',
  'seeker-rack': 'Hold fire to paint exposed machines. Release to fire your native salvo.',
  foamcaster: 'Impacts make brief cover and supported platforms. Keep up to three at once.',
};
export const DISTRICT_COPY: Record<ShiftRouteId, string> = {
  'vacuum-docks': 'Low gravity and controlled decompression. Recoil crosses the open bays.',
  'turntable-works': 'Rotate the platforms at their consoles to change cover and firing lanes.',
  'prism-glassworks': 'Turn real glass mirrors to bank shots through a new line of sight.',
  'express-airlocks':
    'Open a bay early to carry its surviving patrol forward and earn a reroll credit. Closed gates keep the next fight contained.',
  'rework-loop':
    'Return through the actual damage left in your last ordinary room. A new patrol guards a choice of weapon morphs.',
};
export const CIRCUIT_COPY: Record<ShiftCircuit, { name: string; copy: string }> = {
  transport: {
    name: 'Transport',
    copy: 'Power lifts and pressure vents for the next three ordinary rooms.',
  },
  security: {
    name: 'Security',
    copy: 'Power a manual cover shutter and an exposed, destructible security gun for three ordinary rooms.',
  },
  reclamation: {
    name: 'Reclamation',
    copy: 'Power a crusher and one repair station per room. Three ordinary rooms; each station restores 8 health.',
  },
};
function card(action: string, label: string, copy: string, disabled = false) {
  return (
    '<button class="mod" data-shift="' +
    esc(action) +
    '"' +
    (disabled ? ' disabled' : '') +
    '><strong>' +
    esc(label) +
    '</strong><span class="mod-copy">' +
    esc(copy) +
    '</span></button>'
  );
}
export class ShiftOfficeMenu {
  private panel: Panel;
  private abort = new AbortController();
  private generation = 0;
  private stopped = false;
  private preview: UpgradePreviewView | null = null;
  constructor(
    private root: HTMLElement,
    private game: Game,
    private completed: () => void,
    private unlock: () => void,
    kind: 'office' | 'lease' | 'evolution' = 'office',
  ) {
    this.panel = kind === 'office' ? 'home' : kind;
    this.render();
  }
  private finish(action: () => boolean) {
    this.unlock();
    if (action()) this.completed();
  }
  private render() {
    if (this.stopped) return;
    this.generation++;
    this.abort.abort();
    this.abort = new AbortController();
    this.preview?.dispose();
    this.preview = null;
    const g = this.game,
      s = g.shiftRun,
      state = s.state!,
      panel = this.panel;
    let title = 'Service junction.',
      copy = 'Optional work before the patrol. Choose what suits this run.',
      cards = '';
    if (panel === 'home') {
      cards =
        card(
          'panel:district',
          'Take a district',
          'Two alternate rooms from this shift.',
          state.routes.includes(g.stage),
        ) +
        card(
          'panel:prototype',
          'Borrow a prototype',
          state.lease
            ? 'On loan: ' + name(state.lease.morph) + '.'
            : 'Try a weapon morph for two cleared rooms.',
          !s.leaseChoices().length,
        ) +
        card(
          'panel:power',
          'Route power',
          state.circuit
            ? 'Current circuit: ' + CIRCUIT_COPY[state.circuit.kind].name + '.'
            : 'Choose which machinery comes online.',
          state.powers.includes(g.stage),
        ) +
        card(
          'panel:experiment',
          'Field experiment',
          state.experiment
            ? EXPERIMENTS[state.experiment.id].task + ' ' + state.experiment.progress + '/3.'
            : 'Fit a free prototype, use it, then choose its evolution.',
          !s.experimentChoices().length,
        ) +
        (s.repairNode
          ? card(
              'repair',
              'Reclamation repair',
              'Restore up to 8 health. Once in this room.',
              g.hp >= 100 || state.repairs.includes(g.stage),
            )
          : '');
    } else if (panel === 'district') {
      title = 'Take another way.';
      copy = 'This replaces the room ahead. Your run rejoins the campaign at its exit.';
      cards = g.shiftRoutes
        .choices()
        .map((id) => card('route:' + id, SHIFT_ROUTE_NAMES[id], DISTRICT_COPY[id]))
        .join('');
    } else if (panel === 'power') {
      title = 'Route the power.';
      copy = 'One circuit for the next three ordinary rooms. Bosses do not consume its rooms.';
      cards = (Object.keys(CIRCUIT_COPY) as ShiftCircuit[])
        .map((id) => card('power:' + id, CIRCUIT_COPY[id].name, CIRCUIT_COPY[id].copy))
        .join('');
    } else if (panel === 'prototype') {
      title = 'Borrow a prototype.';
      copy =
        'Your firing pattern and damage fittings stay. After two cleared rooms, return it for 12 health or keep it instead of that room’s fitting.';
      cards = s
        .leaseChoices()
        .map((id) => card('borrow:' + id, name(id), MORPH_COPY[id]))
        .join('');
    } else if (panel === 'experiment') {
      title = 'Test it in the field.';
      copy =
        'A free fitting if you need it. Complete three real uses, then choose one permanent evolution for this run.';
      cards = s
        .experimentChoices()
        .map((id) => card('experiment:' + id, name(id), EXPERIMENTS[id].task))
        .join('');
    } else if (panel === 'lease') {
      title = 'Prototype trial complete.';
      copy = 'The loan has covered two rooms. Choose how to settle it.';
      const id = state.lease!.morph;
      cards =
        card(
          'keep',
          'Keep ' + name(id),
          'Use this room’s normal fitting choice to make the morph permanent.',
        ) +
        card(
          'return',
          'Return prototype',
          'Recover up to 12 health, then choose your normal fitting.',
        );
    } else {
      const e = state.experiment!;
      title = 'Field test complete.';
      copy = 'Choose one evolution. ' + name(e.id) + ' stays fitted for the rest of this run.';
      cards = EXPERIMENTS[e.id].outcomes
        .map((id) => card('evolve:' + id, EVOLUTIONS[id].name, EVOLUTIONS[id].description))
        .join('');
    }
    this.root.innerHTML =
      '<h2 id="dialog-title">' +
      esc(title) +
      '</h2><p>' +
      esc(copy) +
      '</p><div class="choices">' +
      cards +
      '</div>' +
      (panel === 'prototype' ? upgradePreviewMarkup() : '') +
      (panel === 'home' || ['district', 'prototype', 'power', 'experiment'].includes(panel)
        ? '<div class="dialog-actions"><button data-shift="back" class="quiet">' +
          (panel === 'home' ? 'Leave junction' : 'Back') +
          '</button></div>'
        : '');
    const signal = this.abort.signal;
    this.root.querySelectorAll<HTMLButtonElement>('[data-shift]').forEach((button) =>
      button.addEventListener(
        'click',
        () => {
          const [action, id] = button.dataset.shift!.split(':');
          if (action === 'panel') {
            this.panel = id as Panel;
            this.render();
          } else if (action === 'back') this.back();
          else if (action === 'route') this.finish(() => s.chooseRoute(id as ShiftRouteId));
          else if (action === 'power') this.finish(() => s.chooseCircuit(id as ShiftCircuit));
          else if (action === 'borrow') {
            this.unlock();
            if (s.borrow(id as ShiftMorphId)) {
              this.panel = 'home';
              this.render();
            }
          } else if (action === 'experiment') {
            this.unlock();
            if (s.beginExperiment(id as ExperimentId)) {
              this.panel = 'home';
              this.render();
            }
          } else if (action === 'repair') {
            this.unlock();
            if (s.useRepair()) this.render();
          } else if (action === 'keep') this.finish(() => s.keepLease());
          else if (action === 'return') this.finish(() => s.returnLease());
          else if (action === 'evolve') this.finish(() => s.evolve(id));
        },
        { signal },
      ),
    );
    this.root.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    if (panel === 'prototype') void this.loadPreview();
  }
  private async loadPreview() {
    const generation = this.generation;
    try {
      const { UpgradePreviewView } = await import('./upgrade-preview-view.ts');
      if (this.stopped || generation !== this.generation || !this.root.isConnected) return;
      const choices = new Map<HTMLButtonElement, ReturnType<typeof inspectUpgrade>>();
      this.root.querySelectorAll<HTMLButtonElement>('[data-shift^="borrow:"]').forEach((b) => {
        const id = b.dataset.shift!.split(':')[1],
          mod = MODS.find((m) => m.id === id)!;
        choices.set(
          b,
          inspectUpgrade(
            this.game.mods,
            mod,
            this.game.startingGun,
            this.game.hp,
            undefined,
            this.game.seed,
          ),
        );
      });
      this.preview = new UpgradePreviewView(
        this.root.querySelector('.upgrade-preview')!,
        choices,
        true,
      );
    } catch {
      if (generation !== this.generation) return;
      const idle = this.root.querySelector('.upgrade-preview-idle');
      if (idle)
        idle.textContent = 'Comparison unavailable. Prototype descriptions remain available.';
    }
  }
  back() {
    if (this.panel === 'lease' || this.panel === 'evolution') return;
    if (this.panel === 'home') {
      this.game.shiftRun.closeOffice();
      this.completed();
    } else {
      this.panel = 'home';
      this.render();
    }
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean) {
    this.preview?.frame(dt, now, reduced, active);
  }
  dispose() {
    this.stopped = true;
    this.generation++;
    this.abort.abort();
    this.preview?.dispose();
    this.preview = null;
  }
}
