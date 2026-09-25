import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import type { Prop } from './props.ts';
import {
  clamp,
  direction,
  distance,
  rewardMods,
  seeded,
  type Checkpoint,
  type Vec,
} from './rules.ts';
import { dailyFromSeed } from './daily.ts';
import {
  AUDITOR_HP,
  COMPANY_CASE,
  auditorEligible,
  planAuditor,
  type AuditorSave,
} from './auditor-layout.ts';

const { Body, Composite, Query } = Matter;
export const AUDITOR_WARNING = 1.8;
export const AUDITOR_VISIT = 18;
export const AUDITOR_RECALL = 1.4;
export type AuditAttack = 'burst' | 'charge' | 'fan' | 'sweep';
export interface AuditorRig {
  attack: AuditAttack;
  phase: number;
  rounds: number;
  fired: number;
  nextShot: number;
  jumpAt: number;
  stepAt: number;
}
export function auditPhase(hp: number, visits: number) {
  return Math.max(visits - 1, hp < AUDITOR_HP / 3 ? 2 : hp < (AUDITOR_HP * 2) / 3 ? 1 : 0);
}
export class AuditorSystem {
  game: Game;
  state: AuditorSave | null = null;
  caseProp: Prop | null = null;
  enemy: Enemy | null = null;
  door: Vec | null = null;
  warning = 0;
  age = 0;
  recall = 0;
  roomTime = 0;
  savedAt = 0;
  dirty = false;
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    const g = this.game;
    this.state = save
      ? save.auditor
        ? structuredClone(save.auditor)
        : null
      : planAuditor(g.seed, {
          event: g.areaEvents.state,
          courier: g.courier.state?.stage,
          floodgate: g.floodgate.stage,
          story: g.story.state?.stage,
        });
  }
  get eligible() {
    const g = this.game;
    return (
      !!this.state &&
      !g.practice &&
      !g.workshop.active &&
      !g.detour &&
      !g.escape &&
      !g.overtime &&
      (!g.testRun || !!g.testRun.auditor) &&
      !g.areaEvents.encounter &&
      auditorEligible(g.level)
    );
  }
  get scheduled() {
    const s = this.state;
    return (
      this.eligible &&
      s?.status === 'hunting' &&
      s.rooms.includes(this.game.stage) &&
      !(s.room === this.game.stage && s.retreated)
    );
  }
  get pending() {
    return this.scheduled && !this.enemy;
  }
  get caseReady() {
    const g = this.game;
    return (
      this.eligible &&
      this.state?.status === 'sealed' &&
      this.state.caseStage === g.stage &&
      g.clear &&
      !g.combatEnemyCount &&
      !g.waves.pending &&
      distance(g.player.position, COMPANY_CASE) <= 190
    );
  }
  clear() {
    this.enemy = null;
    this.caseProp = null;
    this.door = null;
    this.warning = this.age = this.recall = this.roomTime = this.savedAt = 0;
    this.dirty = false;
  }
  reset() {
    this.clear();
    const g = this.game,
      s = this.state;
    if (!this.eligible || !s) return;
    if (s.status === 'sealed' && s.caseStage === g.stage) {
      const prop = g.props.spawn('crate', COMPANY_CASE.x, COMPANY_CASE.y);
      prop.auditCase = true;
      prop.hp = prop.maxHp = 48;
      Body.setStatic(prop.body, true);
      this.caseProp = prop;
    }
    if (this.scheduled && s.room !== g.stage) {
      s.room = g.stage;
      s.visits = s.rooms.indexOf(g.stage) + 1;
      delete s.retreated;
    }
  }
  openCase() {
    const g = this.game,
      s = this.state;
    if (!s || !this.caseReady || g.mode !== 'playing' || g.hp <= 0) return false;
    const offers = rewardMods(
      g.mods,
      dailyFromSeed(g.seed) ? 1 : 3,
      seeded(g.seed + ':company-case:' + g.stage),
      { stage: g.stage, seed: g.seed },
    );
    if (!offers.length) return false;
    s.status = 'offered';
    g.offers = offers;
    g.auditorReward = true;
    g.courierReward = false;
    g.enteringDetour = false;
    g.enteringRoute = null;
    g.rewardTaken = false;
    g.rewardRerolled = false;
    g.onSound('audit-seal');
    g.setMode('upgrade');
    g.save();
    return true;
  }
  claim() {
    const g = this.game;
    if (this.state?.status !== 'offered') return;
    this.state.status = 'hunting';
    g.auditorReward = false;
    g.offers = [];
    g.setMode('playing');
    g.save();
    g.onSound('upgrade');
  }
  placement() {
    const g = this.game;
    const supports = [{ x: 40, y: 740, w: 1920 }, ...g.level.solids.filter((s) => s.w >= 90)];
    const candidates: Vec[] = [];
    for (const s of supports)
      for (let x = Math.max(70, s.x + 32); x <= Math.min(1930, s.x + s.w - 32); x += 80) {
        const p = { x, y: s.y - 30 };
        if (
          p.y >= 180 &&
          distance(p, g.player.position) >= 320 &&
          g.waves.canEnter({ kind: 'auditor', ...p })
        )
          candidates.push(p);
      }
    return (
      candidates.sort(
        (a, b) =>
          Math.abs(distance(a, g.player.position) - 680) -
            Math.abs(distance(b, g.player.position) - 680) ||
          a.y - b.y ||
          a.x - b.x,
      )[0] ?? null
    );
  }
  update(dt: number) {
    const g = this.game,
      s = this.state;
    if (!this.eligible || !s || g.mode !== 'playing' || g.hp <= 0) return;
    this.roomTime += dt;
    if (this.pending && this.roomTime >= 2 && (g.combatEnemyCount <= 3 || !g.waves.pending)) {
      if (!this.door) {
        this.door = this.placement();
        if (this.door) {
          this.warning = AUDITOR_WARNING;
          g.onSound('audit-arrive');
        }
      } else {
        this.warning = Math.max(0, this.warning - dt);
        if (
          this.warning <= 0 &&
          (!g.waves.canEnter({ kind: 'auditor', ...this.door }) ||
            distance(this.door, g.player.position) < 160)
        ) {
          this.door = null;
        } else if (this.warning <= 0 && g.combatEnemyCount < 12) {
          const e = g.spawnEnemy('auditor', this.door.x, this.door.y);
          if (e) {
            this.enemy = e;
            e.hp = s.hp;
            e.maxHp = AUDITOR_HP;
            e.timer = 0.8;
            e.auditor = {
              attack: 'burst',
              phase: 0,
              rounds: 0,
              fired: 0,
              nextShot: 0,
              jumpAt: 0,
              stepAt: 0,
            };
            Body.setMass(e.body, g.player.mass * 8);
            this.door = null;
            this.age = this.recall = 0;
            g.save();
          }
        }
      }
    }
    const e = this.enemy;
    if (!e) return;
    this.age += dt;
    if (s.visits < 3 && this.age >= AUDITOR_VISIT && !this.recall) {
      this.recall = AUDITOR_RECALL;
      e.state = 'return';
      g.onSound('audit-recall');
    } else if (this.recall > 0) {
      this.recall = Math.max(0, this.recall - dt);
      if (this.recall === 0) {
        this.retreat();
        return;
      }
    }
    if (!Number.isFinite(e.body.position.x) || e.body.position.y > 820) {
      const safe = this.placement();
      if (safe) {
        Body.setPosition(e.body, safe);
        Body.setVelocity(e.body, { x: 0, y: 0 });
        e.spawn = 0.8;
        e.state = 'recover';
        e.timer = 1;
      }
    }
    if (this.dirty && g.time - this.savedAt >= 0.5) {
      this.savedAt = g.time;
      this.dirty = false;
      g.save();
    }
  }
  damaged(e: Enemy) {
    if (e !== this.enemy || !this.state) return;
    this.state.hp = clamp(e.hp, 0, AUDITOR_HP);
    this.dirty = true;
  }
  retreat() {
    const g = this.game,
      e = this.enemy;
    if (!e || !this.state || this.state.status !== 'hunting') return;
    this.state.hp = e.hp;
    this.state.retreated = true;
    g.tethers.disrupt(e.body);
    g.harpoons.disrupt(e.body);
    Composite.remove(g.engine.world, e.body);
    g.enemies = g.enemies.filter((other) => other !== e);
    g.shots = g.shots.filter((s) => s.auditorOwner !== e.id);
    g.burst(e.body.position, 18, '#bc9d79', 4);
    g.onSound('audit-leave');
    this.enemy = null;
    this.door = null;
    this.dirty = false;
    g.save();
  }
  killed(e: Enemy, credited = true) {
    const g = this.game;
    if (e !== this.enemy || !this.state) return;
    this.state.hp = 0;
    this.state.status = 'defeated';
    delete this.state.retreated;
    this.enemy = null;
    this.door = null;
    this.recall = 0;
    this.dirty = false;
    g.shots = g.shots.filter((s) => s.auditorOwner !== e.id);
    if (credited) g.commendations.award('closed-account');
    g.onSound('audit-defeat');
    g.save();
  }
  updateEnemy(e: Enemy, dt: number) {
    const g = this.game,
      rig = e.auditor;
    if (!rig || e !== this.enemy) return;
    const p = e.body.position;
    e.phase = auditPhase(e.hp, this.state!.visits);
    const grounded =
      e.body.velocity.y >= -1 &&
      Query.ray(
        g.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 6 },
        25,
      ).length > 0;
    e.timer -= dt;
    if (this.recall > 0) {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.85, y: e.body.velocity.y });
      return;
    }
    const lane = distance(g.lineEnd(p, g.player.position), g.player.position) < 1;
    const range = distance(p, g.player.position);
    if (e.state === 'idle') {
      e.aim = direction(p, g.player.position);
      e.facing = Math.sign(e.aim.x) || e.facing;
      const sign = Math.sign(g.player.position.x - p.x);
      const blocked =
        Query.ray(g.solidBodies, { x: p.x, y: p.y + 8 }, { x: p.x + sign * 65, y: p.y + 8 }, 22)
          .length > 0;
      const speed =
        range > 350 || !lane ? sign * (3.8 + e.phase * 0.45) : range < 175 ? -sign * 2 : 0;
      Body.setVelocity(e.body, {
        x: e.body.velocity.x + (speed - e.body.velocity.x) * 0.12,
        y: clamp(e.body.velocity.y, -15, 16),
      });
      if (
        grounded &&
        g.time >= rig.jumpAt &&
        (blocked || (g.player.position.y < p.y - 95 && Math.abs(g.player.position.x - p.x) < 300))
      ) {
        Body.setVelocity(e.body, { x: sign * 5.5, y: -12.6 });
        rig.jumpAt = g.time + 1.3;
      }
      if (grounded && Math.abs(e.body.velocity.x) > 1.5 && g.time >= rig.stepAt) {
        g.onSound('audit-step');
        rig.stepAt = g.time + 0.43;
      }
      if (e.timer <= 0 && lane && range < 850) {
        const decks: AuditAttack[][] = [
          ['burst', 'charge'],
          ['fan', 'charge', 'burst'],
          ['sweep', 'charge', 'fan', 'burst'],
        ];
        rig.attack = decks[e.phase][e.attacks % decks[e.phase].length];
        if (
          rig.attack === 'charge' &&
          (!grounded || Math.abs(g.player.position.y - p.y) > 90 || range > 420)
        )
          rig.attack = 'fan';
        rig.phase = e.phase;
        e.attacks++;
        e.state = 'windup';
        e.timer = 1.05;
        e.target = { ...g.player.position };
        g.onSound('audit-tell');
      }
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.8, y: e.body.velocity.y });
      if (e.timer > 0.5) {
        e.target = { ...g.player.position };
        e.aim = direction(p, e.target);
      }
      if (e.timer <= 0) {
        e.state = 'rush';
        rig.fired = 0;
        rig.rounds = rig.attack === 'burst' ? 3 : rig.attack === 'sweep' ? 5 : 1;
        rig.nextShot = g.time;
        e.timer = rig.attack === 'charge' ? 0.4 : 0.75;
        g.onSound('audit-fire');
      }
    } else if (e.state === 'rush') {
      if (rig.attack === 'charge') {
        const sign = Math.sign(e.aim.x) || e.facing;
        const wall = Query.ray(g.terrainBodies, p, { x: p.x + sign * 38, y: p.y }, 28).length;
        if (wall) e.timer = 0;
        else Body.setVelocity(e.body, { x: sign * 11.5, y: e.body.velocity.y });
      } else {
        Body.setVelocity(e.body, { x: e.body.velocity.x * 0.82, y: e.body.velocity.y });
        if (rig.fired < rig.rounds && g.time >= rig.nextShot) {
          const aim = Math.atan2(e.aim.y, e.aim.x);
          const angles =
            rig.attack === 'fan'
              ? [-0.24, -0.12, 0, 0.12, 0.24]
              : [rig.attack === 'sweep' ? (rig.fired - 2) * 0.16 : 0];
          for (const offset of angles) {
            const d = { x: Math.cos(aim + offset), y: Math.sin(aim + offset) };
            const origin = g.lineEnd(p, { x: p.x + d.x * 35, y: p.y + d.y * 35 }, 4);
            g.addShot({
              pos: origin,
              vel: { x: d.x * 12, y: d.y * 12 },
              damage: 12,
              radius: 4,
              friendly: false,
              life: 1.6,
              bounces: 0,
              pierce: 0,
              fragment: false,
              split: false,
              source: { ...p },
              damageCause: { type: 'shot', enemy: 'auditor' },
              auditorOwner: e.id,
            });
          }
          rig.fired++;
          rig.nextShot = g.time + 0.14;
        }
      }
      if (e.timer <= 0) {
        e.state = 'recover';
        e.timer = 0.85;
      }
    } else {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.8, y: e.body.velocity.y });
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.65;
      }
    }
    if (e.state !== 'recover' && Query.collides(g.player, [e.body]).length && !g.salvage.ram(e))
      g.damagePlayer(e.state === 'rush' && rig.attack === 'charge' ? 24 : 16, p, {
        type: 'contact',
        enemy: 'auditor',
      });
  }
}
