import type { Enemy, Game } from './game.ts';
import type { LoaderSupport } from './loader-arena.ts';
import type { Vec } from './rules.ts';
import { CRANE_HEAD } from './crane-ai.ts';

interface Vault {
  previous: Vec;
  head: Vec;
  lift: number;
  entered: boolean;
  crossed: boolean;
}

// Fight-local evidence only. Restarting a room means doing the maneuver again.
export class BossMastery {
  game: Game;
  private loads = new Set<Enemy>();
  private clearances = new Set<Enemy>();
  private vaults = new Map<Enemy, Vault>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.loads.clear();
    this.clearances.clear();
    this.vaults.clear();
  }
  private active(e: Enemy) {
    const g = this.game;
    return g.commendations.eligible && g.enemies.includes(e) && !e.allied && e.spawn <= 0;
  }
  loaderRam(e: Enemy, support: LoaderSupport) {
    const g = this.game;
    if (
      this.active(e) &&
      e.hp > 0 &&
      e.kind === 'loader' &&
      g.loaderArena.active &&
      g.loaderArena.supports.includes(support) &&
      support.state === 'braced' &&
      support.barrier.hp <= 0 &&
      !g.destruction.pieces.includes(support.barrier) &&
      g.props.items.includes(support.cargo) &&
      support.cargo.cargo?.state === 'hanging'
    )
      this.loads.add(e);
  }
  beginSweep(e: Enemy) {
    this.vaults.delete(e);
    if (!this.active(e) || e.attack !== 'sweep' || !e.crane) return;
    // Starting on a high shelf is not a vault. The player must leave the lane
    // during this warning/strike and use real upward gun recoil before crossing.
    if (this.game.player.position.y + 18 < e.crane.from.y - CRANE_HEAD.h / 2 - 45) return;
    this.vaults.set(e, {
      previous: { ...this.game.player.position },
      head: { ...e.crane.head },
      lift: 0,
      entered: false,
      crossed: false,
    });
  }
  recoiled(lift: number) {
    if (!this.game.commendations.eligible || this.game.grounded || lift <= 0) return;
    for (const [e, vault] of this.vaults)
      if (e.state === 'windup' || (e.state === 'rush' && !vault.entered)) vault.lift += lift;
  }
  teleported() {
    this.vaults.clear();
  }
  sampleSweep(e: Enemy) {
    const v = this.vaults.get(e),
      rig = e.crane,
      g = this.game;
    if (!v || !rig) return;
    if (
      !this.active(e) ||
      rig.hit ||
      e.attack !== 'sweep' ||
      !['windup', 'rush', 'recover'].includes(e.state)
    ) {
      this.vaults.delete(e);
      return;
    }
    const p = g.player.position;
    if (g.grounded && !v.crossed) v.lift = 0;
    if (e.state === 'rush' && !v.crossed) {
      const side = Math.sign(rig.to.x - rig.from.x),
        half = CRANE_HEAD.w / 2 + 13;
      const before = (v.previous.x - v.head.x) * side,
        after = (p.x - rig.head.x) * side;
      // Interpolate the overlap interval, including the player's movement since
      // the previous frame. Both complete hulls must stay clear throughout it.
      if (side && before >= -half && after <= half && before > after) {
        const span = before - after;
        const enter = Math.max(0, (before - half) / span);
        const leave = Math.min(1, (before + half) / span);
        const gap = (t: number) =>
          v.head.y +
          (rig.head.y - v.head.y) * t -
          CRANE_HEAD.h / 2 -
          (v.previous.y + (p.y - v.previous.y) * t + 18);
        if (
          g.grounded ||
          v.lift < 0.5 ||
          gap(enter) < 1 ||
          gap(leave) < 1 ||
          (!v.entered && before < half)
        ) {
          this.vaults.delete(e);
          return;
        }
        v.entered = true;
        if (after <= -half) v.crossed = true;
      }
    }
    v.previous = { ...p };
    v.head = { ...rig.head };
  }
  hit(e: Enemy) {
    if (!this.vaults.get(e)?.crossed) return;
    if (
      this.active(e) &&
      e.state === 'recover' &&
      e.attack === 'sweep' &&
      e.timer > 0 &&
      !e.crane?.hit
    )
      this.clearances.add(e);
  }
  defeated(e: Enemy) {
    if (!this.active(e)) return;
    if (this.loads.has(e)) this.game.commendations.award('unsafe-load');
    if (this.clearances.has(e)) this.game.commendations.award('clearance');
    this.loads.delete(e);
    this.clearances.delete(e);
    this.vaults.delete(e);
  }
}
