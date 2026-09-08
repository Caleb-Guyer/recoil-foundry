import type Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import { ENEMY_STATS } from './enemies.ts';
import { distance, seeded } from './rules.ts';

export const REINFORCEMENT_TELL = 0.75;
export const REINFORCEMENT_ENTRY = 0.65;
export interface ReinforcementDoor {
  spawn: Spawn;
  state: 'sealed' | 'warning' | 'open' | 'spent';
  timer: number;
  blocked: number;
  attackDelay: number;
}

export function splitWaves(level: Level, seed: string, stage: number): [Spawn[], Spawn[]] {
  if (level.boss || level.spawns.length < 3) return [level.spawns.map((s) => ({ ...s })), []];
  const count = level.spawns.length;
  const openingCount = level.detour
    ? Math.ceil(count / 2)
    : count === 4
      ? 2
      : Math.max(1, Math.floor(count / 3));
  const finalCount = count - openingCount;
  const random = seeded(seed + ':waves:' + stage);
  const ranked = level.spawns.map((spawn, index) => ({ spawn, index, tie: random() }));
  const strength = (spawn: Spawn) =>
    spawn.elite
      ? 20
      : {
          runner: 1,
          shooter: 2,
          flyer: 3,
          hopper: 4,
          charger: 5,
          sniper: 6,
          loader: 0,
          crane: 0,
          press: 0,
          kiln: 0,
          boss: 0,
          skimmer: 7,
          condenser: 0,
          turbine: 0,
          interceptor: 0,
        }[spawn.kind];
  ranked.sort((a, b) => strength(b.spawn) - strength(a.spawn) || a.tie - b.tie);
  const final = new Set<number>();
  const reserve = (test: (s: Spawn) => boolean) => {
    const match = ranked.find((entry) => test(entry.spawn));
    if (match && final.size < finalCount) final.add(match.index);
  };
  reserve((s) => !!s.elite);
  reserve((s) => s.kind === 'flyer');
  reserve((s) => ['runner', 'charger', 'hopper'].includes(s.kind));
  for (const entry of ranked) {
    if (final.size >= count - openingCount) break;
    final.add(entry.index);
  }
  return [
    level.spawns.filter((_, i) => !final.has(i)).map((s) => ({ ...s })),
    level.spawns.filter((_, i) => final.has(i)).map((s) => ({ ...s })),
  ];
}

export class ReinforcementSystem {
  game: Game;
  doors: ReinforcementDoor[] = [];
  phase: 'opening' | 'warning' | 'final' | 'done' = 'done';
  openingCount = 0;
  constructor(game: Game) {
    this.game = game;
  }
  get pending() {
    return this.phase === 'opening' || this.phase === 'warning';
  }
  clear() {
    this.doors = [];
    this.phase = 'done';
    this.openingCount = 0;
  }
  reset(level: Level) {
    this.clear();
    const [opening, final] = splitWaves(level, this.game.roomSeed, this.game.stage);
    this.openingCount = opening.length;
    const random = seeded(this.game.roomSeed + ':reinforcement-timers:' + this.game.stage);
    this.doors = final.map((spawn) => ({
      spawn,
      state: 'sealed',
      timer: 0,
      blocked: 0,
      attackDelay: 0.65 + random() * 0.65,
    }));
    this.phase = final.length ? 'opening' : 'done';
    return opening;
  }
  canEnter(spawn: Spawn) {
    const g = this.game,
      { w, h } = ENEMY_STATS[spawn.kind];
    if (distance(spawn, g.player.position) < 100) return false;
    const overlaps = (body: Matter.Body, margin: number) =>
      spawn.x + w / 2 + margin > body.bounds.min.x + 0.5 &&
      spawn.x - w / 2 - margin < body.bounds.max.x - 0.5 &&
      spawn.y + h / 2 + margin > body.bounds.min.y + 0.5 &&
      spawn.y - h / 2 - margin < body.bounds.max.y - 0.5;
    return (
      !g.solidBodies.some((body) => overlaps(body, 0)) &&
      !g.enemies.some((e) => overlaps(e.body, 8))
    );
  }
  relocate(door: ReinforcementDoor) {
    const g = this.game;
    // Use only reserved authored anchors. Props, moving hazards, and vents
    // already keep these anchors clear across the whole room's layout.
    const alternatives = g.level.spawns
      .filter(
        (s) =>
          ['flyer', 'skimmer'].includes(s.kind) === ['flyer', 'skimmer'].includes(door.spawn.kind),
      )
      .map((anchor) => ({ ...door.spawn, x: anchor.x, y: anchor.y }))
      .filter(
        (s) =>
          distance(s, door.spawn) > 40 &&
          this.canEnter(s) &&
          !this.doors.some(
            (other) => other !== door && other.state !== 'spent' && distance(other.spawn, s) < 70,
          ),
      )
      .sort((a, b) => distance(b, g.player.position) - distance(a, g.player.position));
    const replacement = alternatives[0];
    if (!replacement) return;
    door.spawn = replacement;
    door.timer = REINFORCEMENT_TELL;
    door.blocked = 0;
    g.onSound('reinforce');
  }
  update(dt: number) {
    const g = this.game;
    if (g.mode !== 'playing' || g.escape || g.level.boss) return;
    if (this.phase === 'opening') {
      if (
        g.enemies.length === 0 ||
        ((g.stage >= 4 || g.detour) &&
          this.openingCount >= 2 &&
          g.enemies.length <= (g.detour ? 2 : 1))
      ) {
        this.phase = 'warning';
        for (const door of this.doors) {
          door.state = 'warning';
          door.timer = REINFORCEMENT_TELL;
        }
        g.onSound('reinforce');
      }
      return;
    }
    for (const door of this.doors) {
      if (door.state === 'open') {
        door.timer = Math.max(0, door.timer - dt);
        if (door.timer === 0) door.state = 'spent';
      } else if (door.state === 'warning') {
        door.timer = Math.max(0, door.timer - dt);
        if (door.timer > 0) continue;
        if (this.canEnter(door.spawn) && g.enemies.length < 14) {
          const s = door.spawn;
          g.spawnEnemy(s.kind, s.x, s.y, s.elite, door.attackDelay);
          g.enemies[g.enemies.length - 1].fromDoor = true;
          door.state = 'open';
          door.timer = REINFORCEMENT_ENTRY;
          door.blocked = 0;
        } else {
          door.blocked += dt;
          if (door.blocked >= 0.5) this.relocate(door);
        }
      }
    }
    if (
      this.phase === 'warning' &&
      this.doors.every((door) => door.state === 'open' || door.state === 'spent')
    )
      this.phase = 'final';
    if (this.phase === 'final' && g.enemies.length === 0) this.phase = 'done';
  }
}
