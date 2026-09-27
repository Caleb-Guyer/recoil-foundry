import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Solid } from './levels.ts';
import { seeded, type Checkpoint } from './rules.ts';
import { CRUSHER_TELL, LIFT_PERIOD } from './hazards.ts';

export type MaintenanceKind = 'piston' | 'lift';
export interface MaintenanceSave {
  stage: number;
  kind: MaintenanceKind;
  revision?: 2;
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
  return {
    stage: [2, 6, 18][Math.floor(rng() * 3)],
    kind: rng() < 0.5 ? 'piston' : 'lift',
    revision: 2,
  };
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
      (s.revision === undefined || s.revision === 2) &&
      Object.keys(s).every((key) => key === 'stage' || key === 'kind' || key === 'revision'))
  );
}

// All four 320-unit sections share their entry/exit heights. Each new shaft
// includes all three authored patterns, plus one repeat, shuffled independently.
export function shaftSections(seed: string): number[] {
  const rng = seeded(seed + ':shaft-sections:2');
  const sections = [0, 1, 2, Math.floor(rng() * 3)];
  for (let i = sections.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [sections[i], sections[j]] = [sections[j], sections[i]];
  }
  return sections;
}

export function maintenanceLevel(kind: MaintenanceKind, seed = '', revision?: 2): Level {
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
  if (revision === 2) return variedShaft(level, shaftSections(seed));
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

function variedShaft(level: Level, sections: number[]): Level {
  const timing: number[] = [];
  level.maintenanceTiming = timing;
  level.id += '-2-' + sections.join('');
  for (let section = 0; section < 4; section++) {
    const pattern = sections[section];
    if (level.maintenance === 'piston') {
      for (let side = 0; side < 2; side++) {
        const left = side === 0,
          y = 580 - section * 320 - side * 160;
        const width = pattern === 2 ? 320 : 300;
        level.solids.push({ x: left ? 650 : 1350 - width, y, w: width, h: 22 });
        level.route.push({ x: left ? 790 : 1210, y: y - 18 });
        const centers = pattern === 1 ? [866, 924] : [pattern === 2 ? 918 : 900];
        centers.forEach((center, press) => {
          level.hazards!.push({
            kind: 'crusher',
            x: left ? center : 2000 - center,
            y: y - 178,
            w: pattern === 1 ? 48 : 96,
            h: 24,
            travel: 154,
          });
          // Every head gets a full warning. Paired presses follow one another;
          // staggered banks ripple upward instead of sharing an index parity.
          timing.push((section * 0.65 + side * 4 + press * 1.35) % 8);
        });
        if (pattern === 2) {
          // A canopy shields the outer pocket; its top is also a recoil perch.
          level.solids.push({ x: left ? 650 : 1280, y: y - 96, w: 70, h: 14 });
        }
      }
    } else {
      const y = 420 - section * 320,
        left = section % 2 === 1;
      level.solids.push({ x: left ? 650 : 1120, y, w: 230, h: 22 });
      const x = 1000 + (left ? -1 : 1) * [35, -45, 55][pattern];
      const width = pattern === 2 ? 80 : 120;
      level.hazards!.push({ kind: 'lift', x, y: y + 200, w: width, h: 20, travel: 190 });
      timing.push(0);
      level.route.push({ x, y: y + 182 });
      if (pattern === 1) {
        const transferX = left ? 895 : 1105;
        level.hazards!.push({
          kind: 'crumble',
          x: transferX,
          y: y + 100,
          w: 100,
          h: 16,
          travel: 0,
        });
        timing.push(0);
        level.route.push({ x: transferX, y: y + 82 });
      } else if (pattern === 2) {
        level.hazards!.push({ kind: 'lift', x: 2000 - x, y: y + 200, w: 80, h: 20, travel: 190 });
        timing.push(4);
        // The opposite perch makes a genuine second route with a safe transfer.
        level.solids.push({ x: left ? 1120 : 650, y: y + 80, w: 230, h: 22 });
      }
      level.route.push({ x: left ? 800 : 1200, y: y - 18 });
    }
  }
  return level;
}

export class MaintenanceSystem {
  game: Game;
  state: MaintenanceSave | null = null;
  pulseAt = 0;
  bank = 0;
  presses: { index: number; at: number }[] = [];
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
    this.presses = [];
    if (g.level.maintenanceTiming)
      g.hazards.items.forEach((h, index) => {
        const offset = g.level.maintenanceTiming![index];
        if (h.kind === 'crusher') this.presses.push({ index, at: g.time + 1.6 + offset });
        if (h.kind === 'lift') {
          h.phase = offset;
          const top =
            h.placement.y -
            (h.placement.travel * (1 - Math.cos((offset * Math.PI * 2) / LIFT_PERIOD))) / 2;
          Matter.Body.setPosition(h.body, { x: h.placement.x, y: top + h.placement.h / 2 });
        }
      });
    for (const h of g.hazards.items) if (h.kind === 'crusher') h.automatic = true;
    Matter.Body.setPosition(
      g.player,
      cleared ? { x: this.exit.x, y: this.exit.floor - 18 } : shaftEntry(g.level.maintenance!),
    );
    Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  }
  beforeStep() {
    const g = this.game;
    if (this.active && g.level.maintenanceTiming) {
      if (g.clear) return;
      let nearby = false;
      for (const press of this.presses) {
        if (g.time < press.at) continue;
        press.at += 8;
        const h = g.hazards.items[press.index];
        if (h.state !== 'idle') continue;
        h.state = 'warning';
        h.timer = CRUSHER_TELL;
        h.hits.clear();
        nearby ||= Math.abs(g.player.position.y - h.placement.y) < 400;
      }
      if (nearby) g.onSound('machine');
      return;
    }
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
