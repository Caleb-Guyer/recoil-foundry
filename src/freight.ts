import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Hazard } from './hazards.ts';
import { FREIGHT, FREIGHT_STOPS } from './freight-layout.ts';
import { REINFORCEMENT_TELL } from './reinforcements.ts';

const { Body } = Matter;
export class FreightSystem {
  game: Game;
  lift: Hazard | null = null;
  state: 'boarding' | 'warning' | 'rising' | 'waiting' | 'docked' = 'boarding';
  timer = 0;
  wave = -1;
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    return !!this.lift;
  }
  get top() {
    return this.lift ? this.lift.body.position.y - FREIGHT.h / 2 : FREIGHT.start;
  }
  get arrived() {
    return this.active && this.state === 'docked';
  }
  clear() {
    this.lift = null;
    this.state = 'boarding';
    this.timer = 0;
    this.wave = -1;
  }
  reset() {
    this.clear();
    const g = this.game;
    if (!g.level.freight) return;
    g.hazards.clear();
    g.breaches.clear();
    for (const p of [...g.props.items]) g.props.remove(p);
    this.lift = g.hazards.spawn({
      kind: 'lift',
      x: FREIGHT.x,
      y: FREIGHT.start,
      w: FREIGHT.w,
      h: FREIGHT.h,
      travel: FREIGHT.start - FREIGHT.dock,
    });
    // Its motion belongs to this encounter, rather than the cyclic lift update.
    this.lift.permanent = true;
    Body.setPosition(g.player, { x: 1000, y: FREIGHT.start - 18 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.props.spawn('crate', 840, FREIGHT.start - 23);
    g.cargo.spawn({ x: 530, y: 365, anchorY: 230 });
    g.cargo.spawn({ x: 1470, y: -175, anchorY: -310 });
  }
  private waveComplete() {
    return (
      this.wave >= 0 &&
      this.game.enemies.length === 0 &&
      this.game.waves.doors.every(
        (d) => d.state === 'sealed' || d.state === 'spent' || d.state === 'open',
      )
    );
  }
  beforeStep(dt: number) {
    const g = this.game,
      lift = this.lift;
    if (!lift || g.mode !== 'playing' || this.arrived) return;
    const aboard =
      g.hazards.supported(g.player, lift.body) ||
      g.props.items.some(
        (p) =>
          !p.body.isStatic &&
          g.hazards.supported(p.body, lift.body) &&
          g.hazards.supported(g.player, p.body),
      );
    if (this.state === 'boarding') {
      if (aboard) {
        this.state = 'warning';
        this.timer = FREIGHT.tell;
        g.onSound('machine');
      }
      return;
    }
    if (this.state === 'warning') {
      this.timer = Math.max(0, this.timer - dt);
      if (this.timer > 0) return;
    }
    const feet = Math.max(...g.player.vertices.map((v) => v.y));
    const behind = feet > this.top + 60;
    const stop =
      this.wave >= 0 && !this.waveComplete() ? FREIGHT_STOPS[this.wave] + 20 : FREIGHT.dock;
    if (behind || this.top <= stop + 0.01) {
      this.state = 'waiting';
      return;
    }
    this.state = 'rising';
    const next = Math.max(FREIGHT.dock, stop, this.top - FREIGHT.speed * dt);
    // A suspended load or an actor below a ceiling cannot be pushed through it.
    if (!g.hazards.movePlatform(lift, next)) {
      this.state = 'waiting';
      return;
    }
    if (
      this.wave < 2 &&
      this.top <= FREIGHT_STOPS[this.wave + 1] + 130 &&
      (this.wave < 0 || this.waveComplete())
    ) {
      this.wave++;
      for (const door of g.waves.doors) {
        const index = g.level.spawns.findIndex((s) => s.x === door.spawn.x && s.y === door.spawn.y);
        const wave = index < 2 ? 0 : index < 5 ? 1 : 2;
        if (wave !== this.wave || door.state !== 'sealed') continue;
        door.state = 'warning';
        door.timer = REINFORCEMENT_TELL;
      }
      g.waves.phase = 'warning';
      g.onSound('reinforce');
    }
    if (this.top <= FREIGHT.dock + 0.01 && this.wave === 2 && this.waveComplete()) {
      this.state = 'docked';
      g.onSound('slam');
      g.feedback(2);
    }
  }
}
