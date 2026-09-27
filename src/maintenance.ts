import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Solid } from './levels.ts';
import { seeded, type Checkpoint } from './rules.ts';
import { CRUSHER_TELL } from './hazards.ts';

export type MaintenanceKind = 'piston' | 'lift';
export interface MaintenanceSave {
  stage: number;
  kind: MaintenanceKind;
}
export const SHAFT_TOP = -860;
export const shaftEntry = (kind: MaintenanceKind) => ({
  x: kind === 'piston' ? 1000 : 800,
  y: 720,
});
export const shaftExit = (kind: MaintenanceKind) => ({
  x: kind === 'piston' ? 1180 : 800,
  floor: -540,
});
export const SHAFT_NAMES = { piston: 'Piston shaft', lift: 'Broken lift' };

// Independent of combat/reward RNG. Older saves and versioned Dailies keep
// their original optional rooms; a new campaign can have at most one shaft.
export function planMaintenance(seed: string): MaintenanceSave | null {
  if (/^RF-D\d+-/.test(seed)) return null;
  const rng = seeded(seed + ':maintenance:1');
  if (rng() >= 0.45) return null;
  return { stage: [2, 6, 18][Math.floor(rng() * 3)], kind: rng() < 0.5 ? 'piston' : 'lift' };
}
export function validMaintenance(d: Checkpoint) {
  const s = d.maintenance;
  return (
    s === undefined ||
    (!!s &&
      typeof s === 'object' &&
      d.version === 6 &&
      !/^RF-D\d+-/.test(d.seed) &&
      [2, 6, 18].includes(s.stage) &&
      (s.kind === 'piston' || s.kind === 'lift') &&
      Object.keys(s).every((key) => key === 'stage' || key === 'kind'))
  );
}

export function maintenanceLevel(kind: MaintenanceKind): Level {
  const solids: Solid[] = [
    { x: 0, y: SHAFT_TOP, w: 650, h: 1600 },
    { x: 1350, y: SHAFT_TOP, w: 650, h: 1600 },
  ];
  const level: Level = {
    id: 'maintenance-' + kind,
    name: SHAFT_NAMES[kind],
    maintenance: kind,
    area: 'docks',
    detour: true,
    boss: false,
    mirrored: false,
    solids,
    spawns: [],
    route: [],
    hazards: [],
    setpiece: { rosters: [], props: [], cargo: [], weak: [] },
  };
  if (kind === 'piston') {
    for (let i = 0; i < 8; i++) {
      const left = i % 2 === 0,
        y = 580 - i * 160;
      solids.push({ x: left ? 650 : 1040, y, w: 310, h: 22 });
      level.route.push({ x: left ? 805 : 1195, y: y - 18 });
      // The outer half of each landing stays outside the press's sweep.
      level.hazards!.push({
        kind: 'crusher',
        x: left ? 910 : 1090,
        y: y - 178,
        w: 96,
        h: 24,
        travel: 154,
      });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const y = 420 - i * 320,
        left = i % 2 === 1;
      solids.push({ x: left ? 650 : 1120, y, w: 230, h: 22 });
      level.route.push({ x: 1000, y: y + 182 }, { x: left ? 800 : 1200, y: y - 18 });
      level.hazards!.push({ kind: 'lift', x: 1000, y: y + 200, w: 144, h: 20, travel: 190 });
    }
  }
  return level;
}

export class MaintenanceSystem {
  game: Game;
  state: MaintenanceSave | null = null;
  pulseAt = 0;
  bank = 0;
  constructor(game: Game) {
    this.game = game;
  }
  get scheduled() {
    const g = this.game;
    return (
      !!this.state &&
      this.state.stage === g.stage &&
      !g.overtime &&
      !g.practice &&
      !g.workshop.active &&
      !g.escape
    );
  }
  get active() {
    return this.scheduled && this.game.detour && !!this.game.level.maintenance;
  }
  get exit() {
    return shaftExit(this.game.level.maintenance ?? 'piston');
  }
  get atExit() {
    const g = this.game,
      p = g.player.position,
      door = this.exit;
    return g.grounded && Math.abs(p.x - door.x) < 75 && Math.abs(p.y - (door.floor - 18)) < 8;
  }
  reset(cleared: boolean) {
    if (!this.active) return;
    const g = this.game;
    this.pulseAt = g.time + 1.6;
    this.bank = 0;
    for (const h of g.hazards.items) if (h.kind === 'crusher') h.automatic = true;
    Matter.Body.setPosition(
      g.player,
      cleared ? { x: this.exit.x, y: this.exit.floor - 18 } : shaftEntry(g.level.maintenance!),
    );
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  }
  beforeStep() {
    const g = this.game;
    if (!this.active || g.level.maintenance !== 'piston' || g.clear || g.time < this.pulseAt)
      return;
    this.pulseAt += 4;
    let nearby = false;
    g.hazards.items.forEach((h, i) => {
      if (i % 2 !== this.bank || h.state !== 'idle') return;
      h.state = 'warning';
      h.timer = CRUSHER_TELL;
      h.hits.clear();
      nearby ||= Math.abs(g.player.position.y - h.placement.y) < 400;
    });
    this.bank = 1 - this.bank;
    if (nearby) g.onSound('machine');
  }
}
