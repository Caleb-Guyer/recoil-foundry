import Matter from 'matter-js';
import type { Game, Input, Enemy } from './game.ts';
import type { Prop } from './props.ts';
import type { Spawn } from './levels.ts';
import type { Vec } from './rules.ts';
import type { UprisingRemasterRoom } from './uprising-remaster-rooms.ts';
import { ENEMY_STATS } from './enemies.ts';
import { distance } from './rules.ts';
import { uprisingRoute } from './uprising-model.ts';
import {
  UPRISING_REMASTER as R,
  UPRISING_REMASTER_JOBS,
  uprisingRemasterSeed,
} from './uprising-remaster-rules.ts';

interface PendingArrival {
  spawn: Spawn;
  at: number;
}
interface Platform {
  body: Matter.Body;
  origin: Vec;
  attached: { prop: Prop; offset: Vec }[];
}

/** New Campaign missions use physical supports and native enemy arrivals. Older jobs keep their controller. */
export class UprisingRemaster {
  readonly game: Game;
  station = 0;
  completedStations = 0;
  extractionStartedAt: number | null = null;
  private groups = new Set<number>();
  private pending: PendingArrival[] = [];
  private convoy: Platform | null = null;
  private bridge: Platform | null = null;
  constructor(game: Game) {
    this.game = game;
  }
  get eligible() {
    const u = this.game.uprising;
    return (
      !!u?.active &&
      uprisingRemasterSeed(this.game.seed) &&
      Number(u.run?.version) === 3 &&
      !!u.mission &&
      this.game.level.id === 'uprising-' + u.mission
    );
  }
  get room() {
    return this.game.uprising.room as UprisingRemasterRoom | null;
  }
  get spec() {
    const id = this.game.uprising.mission;
    return id ? UPRISING_REMASTER_JOBS[id] : null;
  }
  get activeNode() {
    return this.game.uprising.nodes[this.game.uprising.kind === 'defend' ? this.station : 0];
  }
  get stationTarget(): Vec | null {
    return this.activeNode ? { ...this.activeNode.body.position } : null;
  }
  get extraction() {
    return this.room?.evacuation;
  }
  get extracting() {
    const u = this.game.uprising;
    return (
      this.eligible &&
      u.waiting &&
      (u.kind === 'steal'
        ? u.collected
        : u.kind === 'sabotage'
          ? u.nodes.length > 0 && u.nodes.every((n) => n.hp <= 0)
          : u.kind === 'escape' && !u.switchTarget)
    );
  }
  get evacuated() {
    const u = this.game.uprising;
    return (
      this.eligible &&
      u.outcome?.result === 'success' &&
      (u.kind === 'escape' || u.kind === 'steal')
    );
  }
  get objectiveTarget(): Vec | null {
    const u = this.game.uprising;
    if (!this.eligible || !u.waiting) return null;
    if (this.extracting && this.extraction)
      return {
        x: this.extraction.x + this.extraction.w / 2,
        y: this.extraction.y + this.extraction.h - 18,
      };
    if (u.switchTarget) return { ...u.switchTarget };
    const n = u.kind === 'sabotage' ? u.nodes.find((n) => n.hp > 0) : this.activeNode;
    return n ? { ...n.body.position } : null;
  }
  get phase() {
    const u = this.game.uprising;
    if (!this.eligible) return 'idle';
    if (u.outcome) return u.outcome.result === 'success' ? 'complete' : 'failed';
    if (this.extracting) return 'extract';
    return u.kind === 'defend'
      ? 'defend'
      : u.switchTarget
        ? 'interlock'
        : u.kind === 'steal'
          ? 'collect'
          : u.kind === 'sabotage'
            ? 'sabotage'
            : 'escape';
  }
  get snapshot() {
    return {
      phase: this.phase,
      station: this.station,
      completedStations: this.completedStations,
      groups: [...this.groups],
      pending: this.pending.map((p) => ({ ...p, spawn: { ...p.spawn } })),
      extractionStartedAt: this.extractionStartedAt,
    };
  }
  clear() {
    this.station = 0;
    this.completedStations = 0;
    this.extractionStartedAt = null;
    this.groups.clear();
    this.pending = [];
    this.convoy = null;
    this.bridge = null;
  }
  reset() {
    this.clear();
    if (!this.eligible) return;
    const g = this.game,
      u = g.uprising,
      room = this.room!;
    u.deadline = 0;
    const platform = (solid: number): Platform | null => {
      const body = g.terrain[solid + 4];
      if (!body) return null;
      return {
        body,
        origin: { ...body.position },
        attached: u.nodes
          .filter(
            (p) =>
              Math.abs(p.body.bounds.max.y - body.bounds.min.y) < 3 &&
              p.body.position.x > body.bounds.min.x &&
              p.body.position.x < body.bounds.max.x,
          )
          .map((prop) => ({
            prop,
            offset: {
              x: prop.body.position.x - body.position.x,
              y: prop.body.position.y - body.position.y,
            },
          })),
      };
    };
    if (room.convoy) this.convoy = platform(room.convoy.solid);
    if (room.sabotageBridge) {
      this.bridge = platform(room.sabotageBridge.solid);
      if (this.bridge && u.outcome?.result === 'success') {
        this.translate(
          this.bridge,
          {
            x: this.bridge.origin.x,
            y: this.bridge.origin.y + room.sabotageBridge.drop,
          },
          room.sabotageBridge.drop / R.bridgeSpeed,
        );
        this.stopStructure(this.bridge);
      }
    }
  }
  canHit(prop: Prop) {
    if (!this.eligible) return true;
    const u = this.game.uprising;
    if (prop.uprising === 'generator') return prop === this.activeNode && u.armedAt !== null;
    if (prop.uprising === 'prototype' && u.switchTarget) return false;
    return true;
  }
  target(enemy: Enemy): Vec | null {
    const u = this.game.uprising,
      n = this.activeNode;
    return this.eligible &&
      u.waiting &&
      u.kind === 'defend' &&
      u.armedAt !== null &&
      n?.hp > 0 &&
      !enemy.allied &&
      ['shooter', 'flyer'].includes(enemy.kind)
      ? n.body.position
      : null;
  }
  private stopStructure(platform: Platform) {
    Matter.Body.setVelocity(platform.body, { x: 0, y: 0 });
    for (const { prop } of platform.attached) Matter.Body.setVelocity(prop.body, { x: 0, y: 0 });
  }
  private translate(platform: Platform, goal: Vec, dt: number) {
    const g = this.game,
      body = platform.body,
      from = { ...body.position };
    const limit = R.bridgeSpeed * dt;
    const next = {
      x: from.x + Math.max(-limit, Math.min(limit, goal.x - from.x)),
      y: from.y + Math.max(-limit, Math.min(limit, goal.y - from.y)),
    };
    const delta = { x: next.x - from.x, y: next.y - from.y };
    if (!delta.x && !delta.y) {
      this.stopStructure(platform);
      return;
    }
    const bounds = body.bounds;
    for (const actor of [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies]) {
      if (actor.isStatic || actor.velocity.y < -0.1) continue;
      const bottom = Math.max(...actor.vertices.map((p) => p.y));
      if (
        Math.abs(bottom - bounds.min.y) < 5 &&
        actor.bounds.max.x > bounds.min.x + 3 &&
        actor.bounds.min.x < bounds.max.x - 3
      )
        Matter.Body.translate(actor, delta);
    }
    Matter.Body.setPosition(body, next);
    Matter.Body.setVelocity(body, delta);
    for (const { prop, offset } of platform.attached)
      if (g.props.items.includes(prop)) {
        Matter.Body.setPosition(prop.body, { x: next.x + offset.x, y: next.y + offset.y });
        Matter.Body.setVelocity(prop.body, delta);
      }
  }
  private moveStructures(dt: number) {
    const g = this.game,
      u = g.uprising,
      room = this.room!;
    if (this.convoy && u.outcome) this.stopStructure(this.convoy);
    if (this.convoy && room.convoy && !u.outcome) {
      const begin = u.kind === 'defend' ? u.armedAt : u.startedAt;
      const p =
        begin === null ? 0 : Math.min(1, Math.max(0, (g.time - begin) / room.convoy.duration));
      this.translate(
        this.convoy,
        {
          x: this.convoy.origin.x + (room.convoy.toX - this.convoy.origin.x) * p,
          y: this.convoy.origin.y,
        },
        dt,
      );
    }
    if (this.bridge && room.sabotageBridge) {
      const lowered =
        u.outcome?.result === 'success' || (u.nodes.length > 0 && u.nodes.every((n) => n.hp <= 0));
      this.translate(
        this.bridge,
        {
          x: this.bridge.origin.x,
          y: this.bridge.origin.y + (lowered ? room.sabotageBridge.drop : 0),
        },
        dt,
      );
    }
  }
  private group(index: number, delay = 0) {
    if (this.groups.has(index)) return;
    this.groups.add(index);
    for (const [i, spawn] of (this.room?.reinforcements?.[index] ?? []).entries())
      this.pending.push({ spawn: { ...spawn }, at: this.game.time + delay + i * 0.28 });
  }
  private safeArrival(spawn: Spawn) {
    const g = this.game,
      { w, h } = ENEMY_STATS[spawn.kind];
    if (distance(g.player.position, spawn) < R.safeArrival) return false;
    const left = spawn.x - w / 2,
      right = spawn.x + w / 2,
      top = spawn.y - h / 2,
      bottom = spawn.y + h / 2;
    return ![...g.solidBodies, ...g.enemies.map((e) => e.body)].some(
      (body) =>
        left < body.bounds.max.x - 0.1 &&
        right > body.bounds.min.x + 0.1 &&
        top < body.bounds.max.y - 0.1 &&
        bottom > body.bounds.min.y + 0.1,
    );
  }
  private arrivals() {
    const g = this.game;
    if (g.combatEnemyCount >= R.reinforcementCap) return;
    for (let i = 0; i < this.pending.length; i++) {
      const item = this.pending[i];
      if (item.at > g.time || !this.safeArrival(item.spawn)) continue;
      const { kind, x, y, elite } = item.spawn;
      const enemy = g.spawnEnemy(kind, x, y, elite);
      if (!enemy) return;
      this.pending.splice(i, 1);
      g.soundAt('spawn', enemy.body.position, `job-arrival:${enemy.id}`);
      if (g.combatEnemyCount >= R.reinforcementCap) return;
      i--;
    }
  }
  private interactSwitch(input: Input) {
    const g = this.game,
      u = g.uprising,
      target = u.switchTarget;
    if (
      !target ||
      !input.jump ||
      distance(g.player.position, target) >= 70 ||
      distance(g.lineEnd(g.player.position, target), target) >= 1
    )
      return;
    u.routeStep++;
    g.soundAt('prop', target, 'job-switch');
    if (u.kind === 'escape') {
      if (u.deadline === 0) u.deadline = g.time + (this.spec?.escapeTime ?? 46);
      this.group(Math.min(u.routeStep - 1, 2));
    }
  }
  private board() {
    const g = this.game,
      u = g.uprising,
      zone = this.extraction;
    if (!zone) return false;
    const p = g.player.position,
      bottom = Math.max(...g.player.vertices.map((v) => v.y));
    const inside =
      p.x > zone.x + 16 &&
      p.x < zone.x + zone.w - 16 &&
      bottom >= zone.y &&
      bottom <= zone.y + zone.h + 8;
    const landed = inside && g.grounded && Math.abs(bottom - zone.y - zone.h) < 8;
    if (!landed) {
      u.boardingAt = null;
      return false;
    }
    u.boardingAt ??= g.time;
    return landed && u.boardingAt !== null && g.time - u.boardingAt >= R.boarding;
  }
  private defend(input: Input) {
    const g = this.game,
      u = g.uprising,
      node = this.activeNode;
    if (!node || node.hp <= 0 || !g.props.items.includes(node)) {
      u.resolve(false);
      return;
    }
    const holds = this.spec?.holds ?? [20];
    const hold =
      u.mission === 'rail-guard' ? (this.room?.convoy?.duration ?? holds[0]) : holds[this.station];
    if (u.armedAt === null) {
      const ready =
        this.station > 0 ||
        (!g.combatEnemyCount &&
          !g.waves.pending &&
          u.patrolClearedAt !== null &&
          g.time - u.patrolClearedAt >= 0.25);
      if (ready && input.jump && distance(g.player.position, node.body.position) < R.interaction) {
        u.armedAt = g.time;
        g.soundAt('prop', node.body.position, 'job-generator');
      }
      return;
    }
    const elapsed = g.time - u.armedAt;
    if (holds.length === 1)
      for (let i = 0; i < 3; i++) {
        if (elapsed >= hold * [0.2, 0.5, 0.8][i]) this.group(i);
      }
    else if (holds.length === 2) {
      if (this.station === 0 && elapsed >= 2) this.group(0);
      if (this.station === 0 && elapsed >= 5) this.group(1);
      if (this.station === 1 && elapsed >= 2) this.group(2);
    } else if (elapsed >= 1) this.group(this.station);
    if (elapsed < hold || this.pending.length) return;
    this.completedStations = ++this.station;
    u.armedAt = null;
    u.boardingAt = null;
    if (this.station >= Math.min(holds.length, u.nodes.length)) u.resolve(true);
    else g.soundAt('clear', node.body.position, 'job-station');
  }
  private steal(input: Input) {
    const g = this.game,
      u = g.uprising;
    this.interactSwitch(input);
    const node = u.nodes[0];
    if (
      !u.collected &&
      node?.hp <= 0 &&
      !u.switchTarget &&
      distance(g.player.position, node.body.position) < 80
    ) {
      u.collected = true;
      g.props.remove(node);
      this.extractionStartedAt = g.time;
      u.boardingAt = null;
      this.group(0);
      g.soundAt('prop', g.player.position, 'job-prototype');
    }
    if (!u.collected || this.extractionStartedAt === null) return;
    const elapsed = g.time - this.extractionStartedAt;
    if (elapsed >= 3) this.group(1);
    if (elapsed >= 6) this.group(2);
    if (elapsed < 6 || this.pending.length) {
      u.boardingAt = null;
      return;
    }
    if (this.board()) u.resolve(true);
  }
  private sabotage() {
    const g = this.game,
      u = g.uprising;
    if (!u.nodes.length || u.nodes.some((n) => n.hp > 0)) return;
    this.extractionStartedAt ??= g.time;
    this.group(0);
    if (g.time - this.extractionStartedAt >= 2) this.group(1);
    if (g.time - this.extractionStartedAt >= 4) this.group(2);
    const bridgeReady =
      !this.bridge ||
      !this.room?.sabotageBridge ||
      Math.abs(
        this.bridge.body.position.y - (this.bridge.origin.y + this.room.sabotageBridge.drop),
      ) < 0.1;
    if (
      !bridgeReady ||
      g.combatEnemyCount ||
      g.waves.pending ||
      this.pending.length ||
      g.time - this.extractionStartedAt < 4
    ) {
      u.boardingAt = null;
      return;
    }
    if (this.board()) u.resolve(true);
  }
  private escape(input: Input) {
    const g = this.game,
      u = g.uprising;
    this.interactSwitch(input);
    if (u.deadline > 0 && g.time >= u.deadline) {
      u.resolve(false);
      return;
    }
    if (u.switchTarget) {
      u.boardingAt = null;
      return;
    }
    this.extractionStartedAt ??= g.time;
    this.group(2);
    if (this.pending.length) {
      u.boardingAt = null;
      return;
    }
    if (this.board()) u.resolve(true);
  }
  update(input: Input, dt: number) {
    const g = this.game,
      u = g.uprising;
    if (!this.eligible || g.mode !== 'playing' || g.hitStop > 0 || !Number.isFinite(dt) || dt <= 0)
      return;
    dt = Math.min(dt, 0.1);
    this.moveStructures(dt);
    if (!u.waiting) {
      this.pending = [];
      return;
    }
    if (!g.combatEnemyCount && !g.waves.pending) u.patrolClearedAt ??= g.time;
    else u.patrolClearedAt = null;
    if (
      u.kind !== 'escape' &&
      !this.pending.length &&
      !g.combatEnemyCount &&
      !g.waves.pending &&
      g.player.position.x > 1860 &&
      g.player.position.y > 590 &&
      input.right &&
      !input.left &&
      g.grounded &&
      u.patrolClearedAt !== null &&
      g.time - u.patrolClearedAt >= 0.6
    ) {
      u.resolve(false);
      this.pending = [];
      return;
    }
    if (u.kind === 'defend') this.defend(input);
    else if (u.kind === 'steal') this.steal(input);
    else if (u.kind === 'sabotage') this.sabotage();
    else this.escape(input);
    if (u.waiting) this.arrivals();
    else this.pending = [];
  }
  get status() {
    const g = this.game,
      u = g.uprising;
    if (!this.eligible || !u.mission) return '';
    const title = uprisingRoute(u.mission).name;
    if (u.outcome)
      return (
        title +
        (u.outcome.result === 'success'
          ? ' · Job complete'
          : ' · Objective missed · clear the patrol')
      );
    if (u.kind === 'defend') {
      const holds = this.spec?.holds ?? [20],
        node = this.activeNode;
      if (u.armedAt === null)
        return this.station === 0 && (g.combatEnemyCount || g.waves.pending)
          ? 'Clear the patrol, then activate the first generator'
          : `Jump beside generator ${this.station + 1} / ${Math.min(holds.length, u.nodes.length)}`;
      const hold =
        u.mission === 'rail-guard'
          ? (this.room?.convoy?.duration ?? holds[0])
          : holds[this.station];
      return (
        (u.mission === 'rail-guard'
          ? 'Protect the moving convoy'
          : `Protect station ${this.station + 1} / ${holds.length}`) +
        ` · ${Math.max(0, Math.ceil(hold - (g.time - u.armedAt)))}s · ${Math.ceil(node?.hp ?? 0)} integrity`
      );
    }
    if (u.switchTarget)
      return (
        `Jump beside ${u.kind === 'escape' ? 'route switch' : 'research interlock'} ${u.routeStep + 1} / ${this.room?.switches?.length ?? 1}` +
        (u.deadline > 0 ? ` · ${Math.max(0, Math.ceil(u.deadline - g.time))}s` : '')
      );
    if (u.kind === 'steal' && !u.collected)
      return this.activeNode?.hp <= 0
        ? 'Prototype exposed · collect it'
        : 'Break the prototype case';
    if (u.kind === 'sabotage' && !this.extracting)
      return `Destroy the relays · ${u.nodes.filter((n) => n.hp <= 0).length} / ${u.nodes.length}`;
    if (u.kind === 'sabotage' && (g.combatEnemyCount || g.waves.pending || this.pending.length))
      return 'Relays down · clear the response, then cross the service bridge';
    return (
      (u.boardingAt === null
        ? u.kind === 'sabotage'
          ? 'Cross the lowered service bridge'
          : 'Reach the marked extraction deck'
        : 'Hold the deck · ' + Math.max(0, Math.ceil(R.boarding - (g.time - u.boardingAt))) + 's') +
      (u.deadline > 0 ? ` · ${Math.max(0, Math.ceil(u.deadline - g.time))}s` : '')
    );
  }
}
