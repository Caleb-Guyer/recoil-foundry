import type { Game } from './game.ts';
import type { Breakable } from './destruction.ts';
import type { Prop } from './props.ts';

export const LOADER_COLLAPSE_TELL = 1.35;
export const LOADER_COLLAPSE_GAP = 1.1;
export interface LoaderSupport {
  barrier: Breakable;
  cargo: Prop;
  state: 'braced' | 'warning' | 'spent';
  releaseAt: number;
}

// A finite, authored encounter. Each damaged support can fail only once.
export class LoaderArenaSystem {
  game: Game;
  supports: LoaderSupport[] = [];
  active = false;
  phase = 0;
  nextAt = 0;
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.supports = [];
    this.active = false;
    this.phase = 0;
    this.nextAt = 0;
  }
  reset() {
    this.clear();
    const g = this.game;
    if (g.level.id !== 'loader-bay' || !g.enemies.some((e) => e.kind === 'loader')) return;
    this.active = true;
    for (const [i, index] of g.level.setpiece!.weak.entries()) {
      const rect = g.level.solids[index];
      const barrier = g.destruction.pieces.find((p) => p.rect.x === rect.x && p.rect.y === rect.y);
      const origin = g.level.setpiece!.cargo![i];
      const cargo = g.cargo.items.find((p) => p.cargo!.origin.x === origin.x);
      if (!barrier || !cargo) continue;
      cargo.cargo!.tell = LOADER_COLLAPSE_TELL;
      // Fresh cover still yields to one committed ram; it cannot cage the boss.
      cargo.hp = cargo.maxHp = 150;
      this.supports.push({ barrier, cargo, state: 'braced', releaseAt: Infinity });
    }
  }
  stop() {
    this.active = false;
    for (const support of this.supports) {
      const rig = support.cargo.cargo!;
      rig.disabled = true;
      if (rig.state === 'warning') {
        rig.state = 'hanging';
        rig.releaseAt = Infinity;
      }
      support.state = 'spent';
      support.releaseAt = Infinity;
    }
  }
  update() {
    const g = this.game;
    if (!this.active || g.mode !== 'playing') return;
    const boss = g.enemies.find((e) => e.kind === 'loader' && e.hp > 0);
    if (!boss) {
      this.stop();
      return;
    }
    if (boss.spawn > 0) return;
    for (const support of this.supports) {
      const rig = support.cargo.cargo!;
      // Shooting a cable is also a deliberate way to bring its support down.
      if (
        support.state === 'braced' &&
        !g.props.items.includes(support.cargo) &&
        !g.destruction.pieces.includes(support.barrier)
      )
        support.state = 'spent';
      if (support.state === 'braced' && rig.state === 'warning') this.watch(support);
      if (support.state === 'warning' && g.time >= support.releaseAt) {
        support.state = 'spent';
        g.destruction.break(support.barrier, { x: g.level.mirrored ? -1 : 1, y: 0 });
      }
    }
    if (g.time < this.nextAt) return;
    const phase = boss.hp <= boss.maxHp * 0.3 ? 2 : boss.hp <= boss.maxHp * 0.65 ? 1 : 0;
    // A ram or player fire can destroy a barrier before a health threshold.
    const broken = this.supports.find(
      (s) => s.state === 'braced' && !g.destruction.pieces.includes(s.barrier),
    );
    const pending =
      broken ?? (phase > this.phase ? this.supports.find((s) => s.state === 'braced') : undefined);
    if (!pending) {
      this.phase = phase;
      return;
    }
    if (!broken) this.phase++;
    const rig = pending.cargo.cargo!;
    if (g.props.items.includes(pending.cargo) && rig.state === 'hanging') {
      g.cargo.cut(pending.cargo, rig.cableHp);
      this.watch(pending);
    } else {
      // A shot-up load must not leave its barrier immune to later failure.
      pending.state = 'warning';
      pending.releaseAt = g.time + LOADER_COLLAPSE_TELL;
      this.nextAt = pending.releaseAt + LOADER_COLLAPSE_GAP;
      g.onSound('cargo-release');
    }
  }
  private watch(support: LoaderSupport) {
    support.state = 'warning';
    support.releaseAt = support.cargo.cargo!.releaseAt;
    this.nextAt = Math.max(this.nextAt, support.releaseAt + LOADER_COLLAPSE_GAP);
  }
}
