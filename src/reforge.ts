import Matter from 'matter-js';
import type { Game } from './game.ts';
import { distance, getGun, type Checkpoint, type Vec } from './rules.ts';
import { planReforge, reforgeOffers, type ReforgeSave, type ReforgeSwap } from './reforge-rules.ts';

export class ReforgeSystem {
  game: Game;
  state: ReforgeSave | null = null;
  site: (Vec & { floor: number }) | null = null;
  offers: ReforgeSwap[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    this.state = save ? (save.reforge ? { ...save.reforge } : null) : planReforge(this.game.seed);
    this.site = null;
    this.offers = [];
  }
  get eligible() {
    const g = this.game;
    return (
      this.state?.stage === g.stage &&
      g.level.boss &&
      !g.practice &&
      !g.workshop.active &&
      !g.detour &&
      !g.escape &&
      !g.overtime &&
      (!g.testRun || !!g.testRun.reforge)
    );
  }
  get roomSave() {
    if (!this.eligible || !this.game.clear) return undefined;
    return {
      ...(this.game.mode === 'reforge' ? { open: true as const } : {}),
      ...(this.game.earnedSalvage ? { salvage: this.game.earnedSalvage } : {}),
    };
  }
  reset() {
    this.site = null;
    this.offers = [];
    if (this.game.clear) this.arrive(false);
  }
  arrive(save = true) {
    const g = this.game;
    if (!this.eligible || !g.clear || this.site) return;
    this.offers = this.state!.used ? [] : reforgeOffers(g.mods, g.seed, g.stage, g.legacyMods);
    if (!this.state!.used && !this.offers.length) return;
    for (const x of [1830, 1800, 1770, 1740, 1710, 1680, 1650, 1620, 1590, 1560]) {
      const supports = g.terrain
        .filter(
          (b) =>
            b.isStatic &&
            b.bounds.min.x <= x - 90 &&
            b.bounds.max.x >= x + 60 &&
            b.bounds.min.y >= 400 &&
            b.bounds.min.y <= 740,
        )
        .sort((a, b) => b.bounds.min.y - a.bounds.min.y);
      for (const support of supports) {
        const floor = support.bounds.min.y;
        const probe = Matter.Bodies.rectangle(x - 15, floor - 42, 150, 80);
        if (Matter.Query.collides(probe, g.solidBodies).length) continue;
        this.site = { x, y: floor - 30, floor };
        break;
      }
      if (this.site) break;
    }
    if (this.site && save) {
      g.onSound('reforge-ready');
      g.save();
    }
  }
  get nearby() {
    const g = this.game;
    return (
      !!this.site &&
      distance(g.player.position, this.site) < 68 &&
      distance(g.lineEnd(g.player.position, this.site), this.site) < 1
    );
  }
  interact() {
    const g = this.game;
    if (
      !this.eligible ||
      g.mode !== 'playing' ||
      !g.clear ||
      g.hitStop > 0 ||
      !g.grounded ||
      g.time - g.clearAt < 0.4 ||
      this.state!.used ||
      !this.nearby
    )
      return false;
    this.offers = reforgeOffers(g.mods, g.seed, g.stage, g.legacyMods);
    if (!this.offers.length) return false;
    g.setMode('reforge');
    g.save();
    return true;
  }
  close() {
    if (this.game.mode !== 'reforge') return;
    this.game.setMode('playing');
    this.game.save();
  }
  choose(index: number) {
    const g = this.game,
      swap = this.offers[index];
    if (
      !Number.isInteger(index) ||
      !swap ||
      !this.eligible ||
      !g.clear ||
      g.mode !== 'reforge' ||
      this.state!.used ||
      !reforgeOffers(g.mods, g.seed, g.stage, g.legacyMods).some(
        (s) => s.from === swap.from && s.to === swap.to,
      )
    )
      return false;
    this.state!.used = true;
    g.mods = [...g.mods.filter((id) => id !== swap.from), swap.to];
    g.gun = getGun(g.mods);
    // A replaced weapon cannot leave charged, parked or delayed attacks alive.
    // Keep world geometry and the room's spent portal budget intact.
    g.massDriver.reset();
    g.arcs.reset();
    g.grind.reset();
    g.torch.reset();
    g.tripwires.reset();
    g.salvage.reset();
    g.salvageEvolutions.reset();
    g.tethers.reset();
    g.evolutions.reset();
    g.ballistics.reset();
    g.cryogenic.reset();
    g.stasis.reset();
    g.mobility.reset();
    g.grapnel.reset();
    g.scrap.reset();
    g.fusions.reset();
    g.demolition.clear();
    if (swap.from === 'fold') g.portals.reset();
    g.shots = [];
    g.burstRemaining = g.fireBuffer = g.jumpBuffer = 0;
    g.portalRequest = null;
    g.landingReady = false;
    g.chargedFlash = false;
    g.blast.life = g.muzzle = 0;
    g.shootAt = g.time;
    this.offers = [];
    g.setMode('playing');
    g.save();
    g.onSound('reforge');
    if (this.site) g.burst(this.site, 16, '#e6c596', 3);
    return true;
  }
}
