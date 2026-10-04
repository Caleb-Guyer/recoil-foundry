import type { Game, Enemy } from './game.ts';
import type { Level, Spawn } from './levels.ts';
import { isBoss } from './enemies.ts';
import { clamp, distance, seeded, type Vec } from './rules.ts';

export type EncounterRhythm = 'intro' | 'ambush' | 'crossfire' | 'traversal' | 'breather' | 'boss';
export interface EncounterPlan {
  rhythm: EncounterRhythm;
  opening: number;
  deadline: number;
  overlap: number;
  spacing: number;
  cap: number;
  rest: number;
}

// The campaign's authored anchors and roster stay intact. Only their order changes.
export function encounterPlan(
  level: Level,
  seed: string,
  stage: number,
  mission?: 'steal' | 'escape' | 'sabotage' | 'defend' | null,
): EncounterPlan {
  let rhythm: EncounterRhythm;
  if (level.boss) rhythm = 'boss';
  else if (stage === 0) rhythm = 'intro';
  else if (mission)
    rhythm = mission === 'escape' ? 'traversal' : mission === 'defend' ? 'crossfire' : 'ambush';
  else if (stage % 4 === 0) rhythm = 'breather';
  else {
    const choices = ['ambush', 'crossfire', 'traversal'] as const;
    const offset = Math.floor(seeded(seed + ':encounters:' + Math.floor(stage / 4))() * 3);
    rhythm = choices[(offset + (stage % 4) - 1) % 3];
  }
  const count = level.spawns.length;
  const early = stage < 4;
  const settings = {
    intro: { opening: 1, deadline: 12, overlap: 0, spacing: 1.25, cap: 3, rest: 0.45 },
    ambush: {
      opening: Math.ceil(count * 0.5),
      deadline: 6.5,
      overlap: 1,
      spacing: 0.65,
      cap: early ? 4 : 6,
      rest: 0.15,
    },
    crossfire: {
      opening: Math.ceil(count / 3),
      deadline: 8,
      overlap: 1,
      spacing: 1.05,
      cap: early ? 4 : 5,
      rest: 0.3,
    },
    traversal: {
      opening: Math.ceil(count / 3),
      deadline: 9,
      overlap: 0,
      spacing: 1.15,
      cap: early ? 4 : 5,
      rest: 0.4,
    },
    breather: {
      opening: Math.max(1, Math.floor(count / 3)),
      deadline: 10,
      overlap: 0,
      spacing: 1.45,
      cap: 3,
      rest: 0.7,
    },
    boss: { opening: count, deadline: 9, overlap: 0, spacing: 1.25, cap: 5, rest: 0.4 },
  }[rhythm];
  return { rhythm, ...settings, opening: Math.min(count, settings.opening) };
}

const rushers = new Set(['runner', 'charger', 'hopper', 'scrapper', 'borer']);
const ranged = new Set(['shooter', 'sniper', 'flyer', 'sifter', 'skimmer', 'switchman']);

export function shapeEncounter(
  opening: Spawn[],
  reserve: Spawn[],
  level: Level,
  plan: EncounterPlan,
) {
  // Introduction fights retain the special unit they teach, on its actual anchor.
  if (
    level.boss ||
    level.freight ||
    level.annex ||
    level.fabricatorIntro ||
    level.harpoonIntro ||
    level.anglerIntro ||
    level.crawlerIntro ||
    level.sapperIntro
  )
    return;
  const roster = [...opening, ...reserve];
  const priority = (s: Spawn) => {
    if (s.elite || s.squad) return -10;
    if (plan.rhythm === 'intro' || plan.rhythm === 'breather')
      return s.kind === 'runner' ? 10 : s.kind === 'shooter' ? 7 : 0;
    if (plan.rhythm === 'ambush') return rushers.has(s.kind) ? 8 : 0;
    if (plan.rhythm === 'crossfire') return ranged.has(s.kind) ? 8 : 0;
    return (s.y < 600 ? 8 : 0) + (ranged.has(s.kind) ? 2 : 0);
  };
  roster.sort((a, b) => priority(b) - priority(a) || a.x - b.x || a.y - b.y);
  const first: Spawn[] = [],
    later: Spawn[] = [],
    assigned = new Set<Spawn>();
  for (const spawn of roster) {
    if (assigned.has(spawn)) continue;
    const group = spawn.squad ? roster.filter((s) => s.squad?.kind === spawn.squad!.kind) : [spawn];
    const fits = first.length + group.length <= plan.opening;
    (first.length === 0 || fits ? first : later).push(...group);
    for (const member of group) assigned.add(member);
  }
  opening.splice(0, opening.length, ...first);
  reserve.splice(0, reserve.length, ...later);
}

export function encounterDelays(reserve: readonly Spawn[], spacing: number) {
  let rank = 0;
  const squads = new Map<string, number>();
  return reserve.map((s) => {
    // A coordinated formation arrives together; ordinary enemies arrive in pairs.
    const key = s.squad ? 'squad:' + s.squad.kind : '';
    if (key) {
      if (!squads.has(key)) {
        squads.set(key, Math.floor(rank / 2));
        rank += 2;
      }
      return squads.get(key)! * spacing;
    }
    return Math.floor(rank++ / 2) * spacing;
  });
}

interface Grant {
  until: number;
  angle: number;
  heavy: boolean;
}
interface Wait {
  since: number;
  seen: number;
}
// Admit a new warning only; never slow a warning, charge or round already in flight.
export class EncounterPacer {
  readonly game: Game;
  grants = new Map<number, Grant>();
  waiting = new Map<number, Wait>();
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    const g = this.game;
    return (
      g.mode === 'playing' &&
      g.encounters === 1 &&
      !!g.waves.plan &&
      !g.overtime &&
      !g.escape &&
      !g.workshop.active &&
      !g.practice
    );
  }
  clear() {
    this.grants.clear();
    this.waiting.clear();
  }
  prune() {
    const g = this.game,
      live = new Set(g.enemies.filter((e) => e.hp > 0).map((e) => e.id));
    for (const [id, grant] of this.grants)
      if (!live.has(id) || grant.until <= g.time) this.grants.delete(id);
    for (const [id, wait] of this.waiting)
      if (!live.has(id) || g.time - wait.seen > 0.25) this.waiting.delete(id);
  }
  request(e: Enemy, heavy: boolean, duration: number, target: Vec = this.game.player.position) {
    if (!this.active || e.allied || e.squad || e.eventRole || e.courier) return true;
    const g = this.game;
    this.prune();
    if (this.grants.has(e.id)) return true;
    const wait = this.waiting.get(e.id) ?? { since: g.time, seen: g.time };
    wait.seen = g.time;
    this.waiting.set(e.id, wait);
    const first = [...this.waiting.entries()].sort(
      (a, b) => a[1].since - b[1].since || a[0] - b[0],
    )[0][0];
    if (first !== e.id) return false;
    const angle = Math.atan2(e.body.position.y - target.y, e.body.position.x - target.x);
    const grants = [...this.grants.values()];
    const activeHeavy = g.enemies.some(
      (other) =>
        other !== e &&
        other.hp > 0 &&
        other.spawn <= 0 &&
        !other.allied &&
        (isBoss(other.kind) || ['charger', 'hopper', 'sniper'].includes(other.kind)) &&
        ['windup', 'followup', 'rush', 'airborne'].includes(other.state),
    );
    const limit = ['intro', 'breather'].includes(g.waves.plan!.rhythm) ? 1 : 2;
    if (
      grants.length >= limit ||
      ((heavy || activeHeavy) && grants.length > 0) ||
      (heavy && activeHeavy)
    )
      return false;
    if (
      grants.some((grant) => {
        const difference = Math.abs(
          Math.atan2(Math.sin(angle - grant.angle), Math.cos(angle - grant.angle)),
        );
        return grant.heavy || difference < 0.5 || difference > 2.3;
      })
    )
      return false;
    this.waiting.delete(e.id);
    this.grants.set(e.id, { angle, heavy, until: g.time + duration });
    return true;
  }
  prepareRanged(e: Enemy, dt: number, target: Vec) {
    const objective = this.game.uprising.nodes.some((node) => node.body.position === target);
    if (
      !this.active ||
      e.elite === 'volatile' ||
      !['shooter', 'flyer'].includes(e.kind) ||
      e.state !== 'idle' ||
      e.timer <= 0.4 ||
      e.timer - dt > 0.4 ||
      distance(e.body.position, target) >= 1450 ||
      (!objective && distance(this.game.lineEnd(e.body.position, target, 5), target) > 1)
    )
      return;
    if (!this.request(e, false, 0.7, target)) e.timer = 0.4 + dt + 0.0001;
  }
  recovery(e: Enemy, previous: Enemy['state']) {
    if (!this.active || !isBoss(e.kind) || previous === 'recover' || e.state !== 'recover') return;
    const gun = this.game.gun;
    // Every base tool gets a complete firing cycle in a boss's exposed opening.
    e.timer = Math.max(
      e.timer,
      clamp(gun.interval * (gun.burstCount === 3 ? 3.1 : 1) + 0.12, 0.6, 1.05),
    );
  }
}
