import type { Enemy, Game, Shot } from './game.ts';
import { primaryGunShot } from './spoof.ts';

export const SUPPORT_MODS = [
  {
    id: 'collimator',
    name: 'Collimator',
    description:
      'Steady aim tightens your entire spread by up to 50% over 0.6s. Sweep your aim to open it again. Every projectile stays.',
    mark: 'collimator',
  },
  {
    id: 'heat-relay',
    name: 'Heat Relay',
    description:
      'Kill your heated beam target to carry half its heat to the next exposed target within 1s. One transfer per kill.',
    mark: 'heat-relay',
  },
  {
    id: 'overkill-bank',
    name: 'Overkill Bank',
    description:
      'Store half a direct killing hit’s excess damage for your next discharge, up to 50% bonus across the whole volley. Boosted hits cannot refill it.',
    mark: 'overkill-bank',
  },
  {
    id: 'scrap-armor',
    name: 'Scrap Armor',
    description:
      'Shoot crates or cracked cover apart for one plate lasting 4s. It absorbs one small enemy bullet. 6s recharge; plates cannot stack.',
    mark: 'scrap-armor',
  },
] as const;
export const SUPPORT_RULESET = 88;
export function supportDraftAllowed(id: string, seed?: string) {
  const daily = /^RF-D(\d+)-/.exec(seed ?? '');
  return !daily || Number(daily[1]) >= SUPPORT_RULESET || !SUPPORT_MODS.some((m) => m.id === id);
}
export const SUPPORT = {
  focusTime: 0.6,
  sweepSpeed: 0.65,
  relayTime: 1,
  plateTime: 4,
  plateCooldown: 6,
};

export function supportPoolAllowed(id: string, seed?: string) {
  if (!SUPPORT_MODS.some((m) => m.id === id)) return true;
  if (!seed || seed.startsWith('SUPPORT-')) return true;
  const revision = /^RF-[CD](\d+)-/.exec(seed);
  return !!revision && Number(revision[1]) >= SUPPORT_RULESET;
}

// These reserves belong to the player and the discharge, never individual rays.
export class SupportSystem {
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  focus = 0;
  reserve = 0;
  relay = 0;
  relayUntil = -1;
  plateUntil = -1;
  plateReadyAt = -1;
  plateFlashUntil = -1;
  private angle: number | undefined;
  reset() {
    this.focus = this.reserve = this.relay = 0;
    this.relayUntil = this.plateUntil = this.plateReadyAt = this.plateFlashUntil = -1;
    this.angle = undefined;
  }
  update(dt: number) {
    const g = this.game;
    if (!g.mods.includes('collimator') || !(dt > 0)) {
      this.focus = 0;
      this.angle = undefined;
      return;
    }
    const angle = Math.atan2(g.aim.y - g.player.position.y, g.aim.x - g.player.position.x);
    if (!Number.isFinite(angle)) return;
    const turn =
      this.angle === undefined
        ? 0
        : Math.abs(Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle)));
    this.angle = angle;
    this.focus =
      turn / dt > SUPPORT.sweepSpeed
        ? Math.max(0, this.focus - dt / 0.12)
        : Math.min(1, this.focus + dt / SUPPORT.focusTime);
  }
  get spreadScale() {
    return this.game.mods.includes('collimator') ? 1 - this.focus * 0.5 : 1;
  }
  get plate() {
    return this.game.mods.includes('scrap-armor') && this.game.time < this.plateUntil;
  }
  discharge(baseDamage: number) {
    if (!this.game.mods.includes('overkill-bank') || !(baseDamage > 0)) return 1;
    const gain = Math.min(this.game.toolroom.bankCap, this.reserve / baseDamage);
    this.reserve *= this.game.mods.includes('bank-memory') ? 0.25 : 0;
    this.game.combatReport.bankCharge(baseDamage * gain);
    return 1 + gain;
  }
  gunHit(e: Enemy, previousHp: number, s: Shot, beam = false) {
    const g = this.game;
    if (
      g.mode !== 'playing' ||
      previousHp <= 0 ||
      e.hp > 0 ||
      e.spawn > 0 ||
      e.allied ||
      e.kind === 'sentry' ||
      e.eventRole === 'relay' ||
      e.recoilTarget !== undefined ||
      !primaryGunShot(s) ||
      s.orbitReleased
    )
      return;
    if (g.mods.includes('overkill-bank') && !s.overkillSpent && e.hp < 0) {
      // Bound even a heavy charged volley; the next discharge caps the payout.
      this.reserve = Math.min(1000, this.reserve + -e.hp * 0.5);
      g.burst(g.player.position, 3, '#e7c984', 1.2);
    }
    if (beam && g.mods.includes('heat-relay') && g.torch.target === e.id && g.torch.heat > 0) {
      this.relay = g.torch.heat * (g.mods.includes('heat-exchanger') ? 0.75 : 0.5);
      this.relayUntil = g.time + (g.mods.includes('insulated-line') ? 1.8 : SUPPORT.relayTime);
      g.burst(e.body.position, 4, '#f0b879', 2);
    }
  }
  takeHeat() {
    const heat =
      this.game.mods.includes('heat-relay') && this.game.time <= this.relayUntil ? this.relay : 0;
    this.relay = 0;
    this.relayUntil = -1;
    this.game.combatReport.heatTransfer(heat);
    return heat;
  }
  collectPlate(s?: Shot) {
    const g = this.game;
    g.toolroom.scrap(s);
    if (
      !g.mods.includes('scrap-armor') ||
      g.mode !== 'playing' ||
      !s ||
      !primaryGunShot(s) ||
      s.orbitReleased ||
      !(s.damage > 0) ||
      this.plate ||
      g.time < this.plateReadyAt
    )
      return;
    this.plateUntil = g.time + g.toolroom.plateTime;
    this.plateReadyAt = g.time + SUPPORT.plateCooldown;
    g.onSound('loaded');
    g.burst(g.player.position, 5, '#b8ddc9', 1.8);
  }
  absorb(s: Shot) {
    if (
      !this.plate ||
      s.friendly ||
      s.allied ||
      s.blade ||
      s.shell ||
      s.radius > (this.game.mods.includes('reinforced-plate') ? 6 : 5) ||
      !(s.damage > 0) ||
      s.damage > (this.game.mods.includes('reinforced-plate') ? 28 : 20)
    )
      return false;
    this.plateUntil = -1;
    this.game.combatReport.armorBlock();
    this.plateFlashUntil = this.game.time + 0.2;
    this.game.burst(this.game.player.position, 8, '#b8ddc9', 2.5);
    this.game.onSound('armor');
    return true;
  }
}
