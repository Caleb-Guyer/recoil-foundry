import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import type { Level } from './levels.ts';
import { direction, distance, type Vec } from './rules.ts';
const { Body, Query } = Matter;

export interface WorkshopTarget {
  home: Vec;
  moving: boolean;
  firing?: boolean;
}
export const WORKSHOP_SCENARIOS = [
  {
    id: 'standard',
    label: 'Open range',
    hint: 'Single, armored and moving targets, with a recoil shaft.',
  },
  {
    id: 'groups',
    label: 'Grouped targets',
    hint: 'Line up targets or test chains, penetration and area effects.',
  },
  {
    id: 'incoming',
    label: 'Incoming fire',
    hint: 'Gunners lock a warning before firing real rounds. Shoot the supply crate behind the entrance to test Scrap Armor. Health works normally; defeat resets this private range.',
  },
  {
    id: 'cover',
    label: 'Cover & banks',
    hint: 'Break real cover, drop a loaded ledge or bank shots around the steel wall. Reset restores everything.',
  },
  {
    id: 'recoil',
    label: 'Recoil course',
    hint: 'Climb the marked shaft with your own gun and use the landing decks to recover.',
  },
] as const;
export type WorkshopScenario = (typeof WORKSHOP_SCENARIOS)[number]['id'];
export const isWorkshopScenario = (value: unknown): value is WorkshopScenario =>
  WORKSHOP_SCENARIOS.some((scenario) => scenario.id === value);
export const WORKSHOP_INCOMING_WARNING = 1.1;
export interface WorkshopTargetSpec extends Vec {
  moving: boolean;
  shielded: boolean;
  firing?: boolean;
}
const RANGE_TARGETS: Record<Exclude<WorkshopScenario, 'standard'>, WorkshopTargetSpec[]> = {
  groups: [
    { x: 560, y: 723, moving: false, shielded: false },
    { x: 630, y: 723, moving: false, shielded: false },
    { x: 700, y: 723, moving: false, shielded: false },
    { x: 980, y: 503, moving: false, shielded: false },
    { x: 1050, y: 503, moving: false, shielded: false },
    { x: 1460, y: 343, moving: true, shielded: false },
  ],
  incoming: [
    { x: 950, y: 723, moving: false, shielded: false, firing: true },
    { x: 1250, y: 503, moving: false, shielded: false, firing: true },
    { x: 650, y: 723, moving: false, shielded: false },
  ],
  cover: [
    { x: 1040, y: 723, moving: false, shielded: false },
    { x: 1300, y: 723, moving: false, shielded: false },
    { x: 1650, y: 723, moving: false, shielded: true },
  ],
  recoil: [
    { x: 420, y: 723, moving: false, shielded: false },
    { x: 980, y: 443, moving: false, shielded: false },
    { x: 1400, y: 183, moving: false, shielded: false },
  ],
};
export function workshopTargets(
  scenario: WorkshopScenario = 'standard',
): readonly WorkshopTargetSpec[] {
  return scenario === 'standard' ? TARGETS : RANGE_TARGETS[scenario];
}
function scenarioLevel(scenario: Exclude<WorkshopScenario, 'standard'>): Level {
  const data: Record<
    Exclude<WorkshopScenario, 'standard'>,
    Pick<Level, 'solids' | 'route' | 'setpiece'>
  > = {
    groups: {
      solids: [
        { x: 900, y: 520, w: 260, h: 22 },
        { x: 1290, y: 360, w: 360, h: 22 },
      ],
      route: [
        { x: 220, y: 720 },
        { x: 1800, y: 720 },
      ],
      setpiece: { rosters: [[]], weak: [], props: [] },
    },
    incoming: {
      solids: [
        { x: 1230, y: 520, w: 330, h: 22 },
        { x: 480, y: 570, w: 220, h: 22 },
      ],
      route: [
        { x: 220, y: 720 },
        { x: 1800, y: 720 },
      ],
      setpiece: { rosters: [[]], weak: [], props: [{ kind: 'crate', x: 100, y: 717 }] },
    },
    cover: {
      solids: [
        { x: 930, y: 540, w: 240, h: 22 },
        { x: 1460, y: 250, w: 30, h: 490 },
        { x: 1610, y: 520, w: 240, h: 22 },
      ],
      route: [
        { x: 220, y: 720 },
        { x: 1300, y: 720 },
      ],
      setpiece: {
        rosters: [[]],
        weak: [0],
        props: [
          { kind: 'cover', x: 570, y: 717 },
          { kind: 'crate', x: 740, y: 717 },
          { kind: 'crate', x: 1040, y: 517 },
          { kind: 'canister', x: 1190, y: 717 },
        ],
      },
    },
    recoil: {
      solids: [
        { x: 520, y: 180, w: 32, h: 430 },
        { x: 1080, y: 180, w: 32, h: 560 },
        { x: 552, y: 590, w: 145, h: 22 },
        { x: 920, y: 460, w: 160, h: 22 },
        { x: 552, y: 330, w: 145, h: 22 },
        { x: 810, y: 200, w: 270, h: 22 },
        { x: 1112, y: 200, w: 500, h: 22 },
      ],
      route: [
        { x: 220, y: 720 },
        { x: 790, y: 720 },
        { x: 1400, y: 180 },
      ],
      setpiece: { rosters: [[]], weak: [], props: [] },
    },
  };
  return {
    id: 'workshop-' + scenario,
    name: 'Workshop / ' + WORKSHOP_SCENARIOS.find((s) => s.id === scenario)!.label,
    area: 'docks',
    mirrored: false,
    boss: false,
    spawns: [],
    hazards: [],
    ...structuredClone(data[scenario]),
  };
}

const TARGETS = [
  { x: 500, y: 723, moving: false, shielded: false },
  { x: 780, y: 723, moving: false, shielded: true },
  { x: 1040, y: 723, moving: true, shielded: false },
  { x: 1420, y: 573, moving: false, shielded: false },
];

export function workshopLevel(scenario: WorkshopScenario = 'standard'): Level {
  if (scenario !== 'standard') return scenarioLevel(scenario);
  return {
    id: 'workshop',
    name: 'The Workshop',
    area: 'docks',
    mirrored: false,
    boss: false,
    solids: [
      { x: 430, y: 525, w: 200, h: 22 },
      { x: 800, y: 575, w: 180, h: 22 },
      { x: 1040, y: 430, w: 180, h: 22 },
      { x: 1320, y: 180, w: 32, h: 430 },
      { x: 1880, y: 180, w: 32, h: 560 },
      { x: 1352, y: 590, w: 145, h: 22 },
      { x: 1720, y: 460, w: 160, h: 22 },
      { x: 1352, y: 330, w: 145, h: 22 },
      { x: 1610, y: 200, w: 270, h: 22 },
    ],
    route: [
      { x: 220, y: 720 },
      { x: 1250, y: 720 },
      { x: 1590, y: 720 },
    ],
    spawns: [],
    hazards: [],
    setpiece: {
      rosters: [[]],
      weak: [0, 7],
      props: [
        { kind: 'crate', x: 500, y: 502 },
        { kind: 'crate', x: 650, y: 717 },
        { kind: 'crate', x: 1420, y: 307 },
      ],
    },
  };
}

export class WorkshopSystem {
  active = false;
  discovered: string[] = [];
  scenario: WorkshopScenario = 'standard';
  revision = 0;
  get targets() {
    return workshopTargets(this.scenario);
  }
  slots: { enemy?: Enemy; remaining: number }[] = [];
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.revision++;
    this.slots = this.active ? this.targets.map(() => ({ remaining: 0 })) : [];
    if (this.active) this.update(0);
  }
  update(dt: number) {
    if (!this.active) return;
    const g = this.game;
    for (const [index, slot] of this.slots.entries()) {
      if (slot.enemy && g.enemies.includes(slot.enemy)) continue;
      if (slot.enemy) {
        slot.enemy = undefined;
        slot.remaining = 1.2;
      }
      slot.remaining = Math.max(0, slot.remaining - dt);
      if (slot.remaining > 0) continue;
      const t = this.targets[index];
      // Wait for the player, crates and other targets to leave the reset mount.
      // Returning targets never materialize through an occupied physical hull.
      const hull = { min: { x: t.x - 18, y: t.y - 17 }, max: { x: t.x + 18, y: t.y + 16 } };
      if (Query.region([...g.solidBodies, g.player, ...g.enemies.map((e) => e.body)], hull).length)
        continue;
      g.spawnEnemy(t.firing ? 'shooter' : 'runner', t.x, t.y, t.shielded ? 'shielded' : undefined);
      const e = g.enemies.at(-1)!;
      e.workshopTarget = {
        home: { x: t.x, y: t.y },
        moving: t.moving,
        ...(t.firing ? { firing: true } : {}),
      };
      e.hp = e.maxHp = t.shielded ? 300 : 160;
      e.spawn = 0.3;
      e.facing = -1;
      e.aim = { x: -1, y: 0 };
      e.timer = t.firing ? 0.9 + index * 0.7 : 0;
      slot.enemy = e;
    }
  }
  move(e: Enemy, dt = 1 / 60) {
    const target = e.workshopTarget!;
    const g = this.game,
      p = e.body.position;
    if (p.y > 820) {
      g.hitEnemy(e, e.maxHp * 20);
      return;
    }
    const desired = target.moving ? target.home.x + Math.sin(g.time * 0.8) * 115 : p.x;
    const side = Math.sign(desired - p.x);
    const blocked = side && Query.ray(g.solidBodies, p, { x: p.x + side * 25, y: p.y }, 22).length;
    const speed = target.moving && !blocked ? Math.max(-2, Math.min(2, (desired - p.x) * 0.1)) : 0;
    Body.setVelocity(e.body, {
      x: target.moving ? speed : e.body.velocity.x * 0.92,
      y: e.body.velocity.y,
    });
    if (!target.firing || e.allied || !(dt > 0) || !Number.isFinite(dt)) return;
    e.timer -= dt;
    if (e.state === 'windup') {
      if (e.timer <= 0) {
        g.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), 8, 14);
        e.attacks++;
        e.state = 'recover';
        e.timer = 2.2;
        g.soundAt('enemy', p, `enemy:${e.id}`);
      }
    } else if (e.timer <= 0) {
      if (
        distance(p, g.player.position) < 1450 &&
        distance(g.lineEnd(p, g.player.position, 5), g.player.position) < 1
      ) {
        e.state = 'windup';
        e.timer = WORKSHOP_INCOMING_WARNING;
        e.target = { ...g.player.position };
        e.aim = direction(p, e.target);
        g.soundAt('aim-warn', p, `enemy:${e.id}`);
      } else e.timer = 0.5;
    }
  }
}
