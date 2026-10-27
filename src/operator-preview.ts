import Matter from 'matter-js';
import { Game } from './game.ts';
import { drawOperator } from './operator-art.ts';
import { GUN_FINISHES, OUTFITS, loadCosmetics, type Cosmetics } from './cosmetics.ts';
import type { CommendationId } from './commendations.ts';
import {
  STARTING_GUNS,
  STARTING_GUN_IDS,
  isStartingGun,
  type StartingGun,
} from './starting-guns.ts';
import { escapeLogbook as escape } from './html.ts';

export const OPERATOR_PREVIEW_POSES = [
  { id: 'idle', name: 'Idle' },
  { id: 'run', name: 'Run' },
  { id: 'air', name: 'Airborne' },
  { id: 'brace', name: 'Brace' },
  { id: 'landing', name: 'Landing' },
] as const;
export type OperatorPreviewPose = (typeof OPERATOR_PREVIEW_POSES)[number]['id'];
const isPose = (value: unknown): value is OperatorPreviewPose =>
  OPERATOR_PREVIEW_POSES.some((pose) => pose.id === value);
const sample: Record<OperatorPreviewPose, number> = {
  idle: 0.4,
  run: 0.23,
  air: 0.57,
  brace: 0.055,
  landing: 0.065,
};
export interface OperatorPreviewOptions {
  selection: Cosmetics;
  earned: readonly CommendationId[];
  gun?: StartingGun;
  unlockedGuns?: readonly StartingGun[];
  showTools?: boolean;
}

/** A disposable actor for visual posing. It never ticks, fires or receives profile callbacks. */
export class OperatorPreviewStage {
  readonly game = new Game();
  readonly guns: StartingGun[];
  readonly showTools: boolean;
  readonly earned: readonly CommendationId[];
  pose: OperatorPreviewPose = 'idle';
  clock = 0;
  playing = true;
  reduced = false;
  disposed = false;
  constructor(options: OperatorPreviewOptions) {
    this.showTools = options.showTools === true;
    this.guns = STARTING_GUN_IDS.filter(
      (id) => id === 'pistol' || options.unlockedGuns?.includes(id),
    );
    this.earned = [...options.earned];
    this.game.startWorkshop([], [], this.allowedGun(options.gun));
    this.setAppearance(options.selection);
    this.applyPose();
  }
  private allowedGun(value: unknown): StartingGun {
    return this.showTools && isStartingGun(value) && this.guns.includes(value) ? value : 'pistol';
  }
  setAppearance(selection: Cosmetics) {
    if (this.disposed) return;
    this.game.cosmetics = loadCosmetics(selection, this.earned);
  }
  setTool(value: unknown) {
    if (this.disposed) return;
    const gun = this.allowedGun(value);
    if (gun === this.game.startingGun) return;
    const appearance = { ...this.game.cosmetics };
    this.game.startWorkshop([], [], gun);
    this.game.cosmetics = appearance;
    this.applyPose();
  }
  setPose(value: unknown) {
    if (this.disposed || !isPose(value)) return false;
    this.pose = value;
    this.clock = 0;
    this.applyPose();
    return true;
  }
  frame(dt: number, active: boolean, reduced: boolean) {
    if (this.disposed) return false;
    const changed = this.reduced !== reduced;
    this.reduced = reduced;
    const advancing = active && this.playing && !reduced && Number.isFinite(dt) && dt > 0;
    if (advancing) this.clock = (this.clock + Math.min(dt, 0.1)) % 3600;
    if (changed || advancing) this.applyPose();
    return changed || advancing;
  }
  get sampleTime() {
    return this.reduced ? sample[this.pose] : this.clock;
  }
  get lift() {
    return this.pose === 'air' ? Math.sin(((this.sampleTime % 1.8) / 1.8) * Math.PI) * 12 : 0;
  }
  private applyPose() {
    const g = this.game,
      t = this.sampleTime;
    g.time = t;
    g.grounded = this.pose !== 'air';
    const x = this.pose === 'run' ? 100 + t * 58 : 100;
    Matter.Body.setPosition(g.player, { x, y: 100 - this.lift / 3 });
    Matter.Body.setVelocity(g.player, {
      x: this.pose === 'run' ? 5 : 0,
      y: this.pose === 'air' ? -Math.cos(((t % 1.8) / 1.8) * Math.PI) * 7 : 0,
    });
    g.aim = { x: x + 300, y: g.player.position.y - 34 };
    g.jumpAt = this.pose === 'air' ? t - 0.12 : -100;
    g.lastShot = this.pose === 'brace' ? t - (t % 1.15) : -100;
    g.muzzle = this.pose === 'brace' ? Math.max(0, 0.065 - (t - g.lastShot)) : 0;
    g.combatFeel.pumpStartedAt = this.pose === 'brace' ? g.lastShot : -100;
    g.combatFeel.landedAt = this.pose === 'landing' ? t - (t % 1.4) : -100;
    g.combatFeel.landingStrength = this.pose === 'landing' ? 0.78 : 0;
    g.land = this.pose === 'landing' ? Math.max(0, 0.16 - (t - g.combatFeel.landedAt)) : 0;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    Matter.Composite.clear(this.game.engine.world, false);
    Matter.Engine.clear(this.game.engine);
  }
}

export function operatorPreviewMarkup(options: OperatorPreviewOptions) {
  const guns = STARTING_GUN_IDS.filter(
    (id) => id === 'pistol' || options.unlockedGuns?.includes(id),
  );
  return (
    '<canvas class="operator-preview-canvas" width="720" height="440" role="img" aria-label="Outfit and tool preview"></canvas>' +
    '<div class="operator-preview-controls"><div class="operator-preview-poses" role="group" aria-label="Preview pose">' +
    OPERATOR_PREVIEW_POSES.map(
      (pose) =>
        '<button class="quiet" type="button" data-operator-pose="' +
        pose.id +
        '" aria-pressed="' +
        (pose.id === 'idle') +
        '">' +
        pose.name +
        '</button>',
    ).join('') +
    '</div>' +
    '<div class="operator-preview-actions">' +
    (options.showTools
      ? '<label>Preview tool<select data-operator-tool>' +
        guns
          .map((id) => '<option value="' + id + '">' + escape(STARTING_GUNS[id].name) + '</option>')
          .join('') +
        '</select></label>'
      : '') +
    '<button class="quiet" type="button" data-operator-toggle>Pause preview</button></div><p class="operator-preview-motion" role="status"></p></div><figcaption></figcaption>'
  );
}

/** Uses the Workshop frame lifecycle; owns no animation timer, input capture or sound. */
export class OperatorPreviewView {
  readonly stage: OperatorPreviewStage;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly abort = new AbortController();
  private renderedAt = -Infinity;
  private pending = true;
  private stopped = false;
  constructor(root: HTMLElement, options: OperatorPreviewOptions) {
    this.root = root;
    root.innerHTML = operatorPreviewMarkup(options);
    this.canvas = root.querySelector<HTMLCanvasElement>('.operator-preview-canvas')!;
    this.context = this.canvas.getContext('2d');
    this.stage = new OperatorPreviewStage(options);
    const events = { signal: this.abort.signal };
    root.querySelectorAll<HTMLButtonElement>('[data-operator-pose]').forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          if (!this.stage.setPose(button.dataset.operatorPose)) return;
          this.pending = true;
          this.labels();
          this.paint();
        },
        events,
      );
    });
    const tools = root.querySelector<HTMLSelectElement>('[data-operator-tool]');
    tools?.addEventListener(
      'change',
      () => {
        this.stage.setTool(tools.value);
        this.pending = true;
        this.labels();
        this.paint();
      },
      events,
    );
    root.querySelector<HTMLButtonElement>('[data-operator-toggle]')!.addEventListener(
      'click',
      () => {
        if (this.stage.reduced) return;
        this.stage.playing = !this.stage.playing;
        this.labels();
      },
      events,
    );
    this.labels();
    this.paint();
  }
  update(selection: Cosmetics) {
    if (this.stopped) return;
    this.stage.setAppearance(selection);
    this.pending = true;
    this.labels();
    this.paint();
  }
  tool(gun: StartingGun) {
    if (this.stopped) return;
    this.stage.setTool(gun);
    this.pending = true;
    this.labels();
    this.paint();
  }
  private labels() {
    const g = this.stage.game,
      look = g.cosmetics;
    const pose = OPERATOR_PREVIEW_POSES.find((p) => p.id === this.stage.pose)!.name;
    const caption = OUTFITS[look.outfit].name + ' / ' + GUN_FINISHES[look.gun].name;
    this.root.querySelector('figcaption')!.textContent = caption;
    this.canvas.setAttribute(
      'aria-label',
      caption + ' · ' + STARTING_GUNS[g.startingGun].name + ' · ' + pose + ' preview',
    );
    this.root
      .querySelectorAll<HTMLButtonElement>('[data-operator-pose]')
      .forEach((button) =>
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.operatorPose === this.stage.pose),
        ),
      );
    const tools = this.root.querySelector<HTMLSelectElement>('[data-operator-tool]');
    if (tools) tools.value = g.startingGun;
    const toggle = this.root.querySelector<HTMLButtonElement>('[data-operator-toggle]')!;
    toggle.textContent = this.stage.reduced
      ? 'Still preview'
      : this.stage.playing
        ? 'Pause preview'
        : 'Play preview';
    toggle.disabled = this.stage.reduced || !this.context;
    this.root.querySelector<HTMLElement>('.operator-preview-motion')!.textContent = !this.context
      ? 'Preview unavailable. You can still equip appearances.'
      : this.stage.reduced
        ? 'Reduced Effects · choose a still pose.'
        : '';
  }
  private paint() {
    const c = this.context;
    if (this.stopped || !c) return;
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.save();
    c.scale(2, 2);
    const wall = c.createRadialGradient(157, 115, 10, 157, 115, 194);
    wall.addColorStop(0, '#233335');
    wall.addColorStop(1, '#101b1e');
    c.fillStyle = wall;
    c.fillRect(0, 0, 360, 220);
    c.strokeStyle = '#2e4141';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(30, 198);
    c.lineTo(330, 198);
    c.stroke();
    c.fillStyle = '#0c151748';
    c.beginPath();
    c.ellipse(149, 200, 35 - this.stage.lift * 0.4, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.translate(144, 139 - this.stage.lift);
    c.scale(3, 3);
    // Fixed representative samples keep reduced previews motionless while
    // preserving a distinct pose. The exact native body and weapon do all art.
    drawOperator(c, this.stage.game, false);
    c.restore();
    this.pending = false;
  }
  frame(dt: number, now: number, reduced: boolean, active: boolean) {
    if (this.stopped) return;
    const visible =
      !!this.context && active && this.root.isConnected && !this.root.ownerDocument.hidden;
    const modeChanged = this.stage.reduced !== reduced;
    const changed = this.stage.frame(dt, visible, reduced);
    if (changed) this.pending = true;
    if (modeChanged) this.labels();
    if (!visible) return;
    if (
      (this.pending || changed) &&
      (!Number.isFinite(now) || now - this.renderedAt >= 1000 / 30)
    ) {
      this.paint();
      this.renderedAt = Number.isFinite(now) ? now : 0;
    }
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    this.abort.abort();
    this.stage.dispose();
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
