import Matter from 'matter-js';
import type { Game, Input, Enemy, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { distance, type Vec } from './rules.ts';
import {
  uprisingRoute,
  uprisingFork,
  uprisingChoices,
  successfulUprising,
  uprisingFinale,
  FINALE_NAMES,
  type UprisingRun,
  type UprisingRouteId,
} from './uprising-model.ts';
import { uprisingLevel } from './uprising-layout.ts';
import { UPRISING_ROOMS } from './uprising-rooms.ts';

export class UprisingSystem {
  run: UprisingRun | null = null;
  mission: UprisingRouteId | null = null;
  nodes: Prop[] = [];
  collected = false;
  armedAt: number | null = null;
  deadline = 0;
  hurt = false;
  defenseWave = 0;
  routeStep = 0;
  startedAt = 0;
  patrolClearedAt: number | null = null;
  anchors: { body: Matter.Body; x: number; y: number }[] = [];
  game: Game;
  constructor(game: Game) {
    this.game = game;
  }
  get active() {
    const g = this.game;
    return (
      !!this.run &&
      !g.practice &&
      !g.workshop.active &&
      (!g.testRun || !!g.testRun.uprising) &&
      !g.overtime &&
      !g.detour &&
      !g.escape
    );
  }
  get choices() {
    return this.active &&
      this.game.mode === 'upgrade' &&
      !this.game.courierReward &&
      !this.game.auditorReward &&
      !this.game.welderReward &&
      !this.game.enteringDetour
      ? uprisingChoices(this.run, this.game.stage)
      : [];
  }
  get outcome() {
    return this.run?.outcomes.find((o) => o.route === this.mission);
  }
  get kind() {
    return this.mission ? uprisingRoute(this.mission).mission : null;
  }
  get waiting() {
    return this.active && !!this.mission && !this.outcome;
  }
  get escapeReady() {
    return this.active && this.kind === 'escape' && this.outcome?.result === 'success';
  }
  get finale() {
    return this.active && this.game.stage === 19 && this.run ? uprisingFinale(this.run) : null;
  }
  get room() {
    return this.active && this.mission && this.game.level.id === 'uprising-' + this.mission
      ? UPRISING_ROOMS[this.mission]
      : null;
  }
  get switchTarget() {
    return this.waiting ? this.room?.switches?.[this.routeStep] : undefined;
  }
  get evacuation() {
    return this.room?.evacuation;
  }
  get onEvacuationPad() {
    const zone = this.evacuation,
      g = this.game;
    return (
      !!zone &&
      g.grounded &&
      g.player.position.x > zone.x + 16 &&
      g.player.position.x < zone.x + zone.w - 16 &&
      Math.abs(g.player.bounds.max.y - (zone.y + zone.h)) < 8
    );
  }
  level(base: Game['level']) {
    return this.active && this.run ? uprisingLevel(base, this.run, this.game.stage) : base;
  }
  clear() {
    this.mission = null;
    this.nodes = [];
    this.anchors = [];
    this.armedAt = null;
    this.collected = false;
    this.hurt = false;
    this.defenseWave = 0;
    this.routeStep = 0;
    this.patrolClearedAt = null;
  }
  reset(cleared: boolean) {
    this.clear();
    if (!this.active || !this.run) return;
    const g = this.game;
    this.mission =
      this.run.choices.find((id) => uprisingFork(this.run!, id) + 1 === g.stage) ?? null;
    this.startedAt = g.time;
    this.deadline = g.time + 40;
    this.anchors = (this.room?.machines ?? []).map((index) => {
      const body = g.terrain[index + 4];
      return { body, x: body.position.x, y: body.position.y };
    });
    if (cleared || this.outcome || !this.mission) {
      if (
        g.level.boss &&
        ['rail-guard', 'crew-relief', 'roof-relief'].some((id) =>
          successfulUprising(this.run, id as UprisingRouteId),
        )
      ) {
        for (const x of [650, 1250]) {
          const cover = g.props.spawn('cover', x, 697);
          cover.hp = cover.maxHp = 150;
        }
      }
      return;
    }
    if (this.kind === 'escape') return;
    for (const { x, y } of this.room?.objectives ?? []) {
      const prop = g.props.spawn(this.kind === 'defend' ? 'cargo' : 'crate', x, y);
      Matter.Body.setStatic(prop.body, true);
      prop.uprising =
        this.kind === 'defend' ? 'generator' : this.kind === 'steal' ? 'prototype' : 'relay';
      prop.hp = prop.maxHp =
        this.kind === 'defend'
          ? 180 + Math.floor(g.stage / 4) * 50
          : this.kind === 'steal'
            ? 75
            : 100;
      this.nodes.push(prop);
    }
  }
  choose(id: UprisingRouteId) {
    if (!this.run || !this.choices.some((r) => r.id === id)) return false;
    this.run.choices.push(id);
    this.game.save();
    this.game.onChange();
    return true;
  }
  hit(
    prop: Prop,
    damage: number,
    _velocity: Vec,
    source?: Shot,
    direct = false,
    playerDamage = direct || !!(source?.friendly && !source.allied),
  ) {
    if (!this.nodes.includes(prop) || !this.waiting || !(damage > 0)) return;
    if (prop.uprising === 'generator' && this.armedAt === null) return;
    if (
      (prop.uprising === 'generator' && playerDamage) ||
      (prop.uprising !== 'generator' && !playerDamage)
    )
      return;
    prop.hp = Math.max(0, prop.hp - damage);
    prop.flash = 0.08;
    if (prop.hp <= 0 && prop.uprising === 'relay') this.game.props.remove(prop);
    this.game.burst(
      prop.body.position,
      4,
      prop.uprising === 'generator' ? '#e7b67c' : '#b9e4ed',
      2,
    );
    this.game.onSound('prop');
  }
  damage() {
    if (this.waiting) this.hurt = true;
  }
  target(enemy: Enemy): Vec | null {
    return this.waiting &&
      this.kind === 'defend' &&
      this.armedAt !== null &&
      !enemy.allied &&
      ['shooter', 'flyer'].includes(enemy.kind) &&
      this.nodes[0]?.hp > 0
      ? this.nodes[0].body.position
      : null;
  }
  resolve(success: boolean) {
    if (!this.run || !this.mission || this.outcome) return;
    const clean = success && !this.hurt;
    this.run.outcomes.push({
      route: this.mission,
      result: success ? 'success' : 'failed',
      ...(clean ? { clean: true as const } : {}),
    });
    for (const node of this.nodes)
      if (this.game.props.items.includes(node)) this.game.props.remove(node);
    if (success) {
      this.game.hp = Math.min(100, this.game.hp + 8);
      this.game.onUprisingMission(this.mission, clean);
      this.game.onSound('clear');
    }
    this.game.save();
  }
  abandon() {
    if (!this.waiting || !['playing', 'paused'].includes(this.game.mode)) return false;
    this.resolve(false);
    return true;
  }
  update(input: Input, dt: number) {
    const g = this.game;
    if (!this.active || g.mode !== 'playing' || g.hitStop > 0) return;
    for (const [i, a] of this.anchors.entries()) {
      const rail = g.level.uprising === 'railworks';
      const powered =
        this.kind === 'sabotage' &&
        (this.outcome?.result === 'success' ||
          (this.nodes.length > 0 && this.nodes.every((p) => p.hp <= 0)));
      const goal = rail
        ? { x: a.x + Math.sin((g.time - this.startedAt) * 0.55) * 85, y: a.y }
        : { x: a.x, y: a.y + (powered ? 70 : Math.sin((g.time - this.startedAt) * 0.6 + i) * 25) };
      const previous = { ...a.body.position };
      const limit = 90 * dt;
      const pos = {
        x: goal.x,
        y: previous.y + Math.max(-limit, Math.min(limit, goal.y - previous.y)),
      };
      const dx = pos.x - previous.x,
        dy = pos.y - previous.y;
      // Carry riders with the physical platform. Keep the floor passage above player height.
      const bounds = a.body.bounds;
      for (const body of [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies])
        if (
          !body.isStatic &&
          body.velocity.y >= -0.1 &&
          Math.abs(body.bounds.max.y - bounds.min.y) < 5 &&
          body.bounds.max.x > bounds.min.x + 3 &&
          body.bounds.min.x < bounds.max.x - 3
        )
          Matter.Body.translate(body, { x: dx, y: dy });
      Matter.Body.setPosition(a.body, pos);
      Matter.Body.setVelocity(a.body, { x: dx, y: dy });
    }
    if (!this.waiting) return;
    if (!g.combatEnemyCount && !g.waves.pending) this.patrolClearedAt ??= g.time;
    else this.patrolClearedAt = null;
    if (
      this.kind !== 'escape' &&
      !g.combatEnemyCount &&
      !g.waves.pending &&
      g.player.position.x > 1860 &&
      g.player.position.y > 590 &&
      (g.encounters === 0 ||
        (input.right &&
          !input.left &&
          g.grounded &&
          this.patrolClearedAt !== null &&
          g.time - this.patrolClearedAt >= 0.6))
    ) {
      this.resolve(false);
      return;
    }
    if (this.kind === 'escape') {
      if (g.time >= this.deadline) this.resolve(false);
      else {
        const target = this.switchTarget;
        if (
          target &&
          input.jump &&
          distance(g.player.position, target) < 70 &&
          distance(g.lineEnd(g.player.position, target), target) < 1
        ) {
          this.routeStep++;
          g.onSound('prop');
        }
        if (!this.switchTarget && this.onEvacuationPad) this.resolve(true);
      }
    } else if (this.kind === 'sabotage') {
      if (this.nodes.every((p) => p.hp <= 0)) this.resolve(true);
    } else if (this.kind === 'steal') {
      const prop = this.nodes[0];
      if (prop?.hp <= 0 && distance(g.player.position, prop.body.position) < 80) {
        this.collected = true;
        g.props.remove(prop);
        this.resolve(true);
      }
    } else if (this.kind === 'defend') {
      const prop = this.nodes[0];
      if (prop?.hp <= 0 || !g.props.items.includes(prop)) this.resolve(false);
      else {
        if (
          this.armedAt === null &&
          (g.encounters === 0 ||
            (this.patrolClearedAt !== null && g.time - this.patrolClearedAt >= 0.25)) &&
          input.jump &&
          distance(g.player.position, prop.body.position) < 150
        )
          this.armedAt = g.time;
        if (
          this.armedAt !== null &&
          this.defenseWave < 3 &&
          g.time - this.armedAt >= 3 + this.defenseWave * 5 &&
          g.enemies.length < 10
        ) {
          this.defenseWave++;
          for (const [i, { x, y }] of (this.room?.defenseEntries ?? []).entries()) {
            const enemy = g.spawnEnemy('flyer', x, y);
            if (enemy && g.encounters === 1) enemy.timer += i * 0.4;
          }
        }
        if (this.armedAt !== null && g.time - this.armedAt >= 18) this.resolve(true);
      }
    }
  }
  get status() {
    if (this.finale)
      return (
        FINALE_NAMES[this.finale] +
        ' · ' +
        {
          isolated: 'Command relays down · aimed volleys remain',
          hunted: 'Stolen cargo · Interceptor deployed',
          mutiny: 'Crew barricades · single volleys',
          overloaded: 'Command online · watch the radial release',
        }[this.finale]
      );
    if (!this.active || !this.mission) return '';
    const route = uprisingRoute(this.mission);
    if (this.outcome)
      return (
        route.name +
        ' · ' +
        (this.outcome.result === 'success'
          ? 'Objective complete · +8 health'
          : 'Objective missed · clear the remaining patrol')
      );
    if (this.kind === 'escape')
      return (
        (this.switchTarget
          ? 'Open route switch ' +
            (this.routeStep + 1) +
            ' / ' +
            this.room!.switches!.length +
            ' · jump beside it'
          : 'Board the marked evacuation platform') +
        ' · ' +
        Math.max(0, Math.ceil(this.deadline - this.game.time)) +
        's'
      );
    if (this.kind === 'sabotage')
      return (
        'Destroy the relays · ' +
        this.nodes.filter((p) => p.hp <= 0).length +
        ' / ' +
        this.nodes.length
      );
    if (this.kind === 'steal')
      return this.nodes[0]?.hp <= 0
        ? 'Prototype exposed · move beside it to collect'
        : 'Break the prototype case, then collect it';
    return this.armedAt === null
      ? this.game.encounters === 1 && (this.game.combatEnemyCount || this.game.waves.pending)
        ? 'Clear the patrol, then jump beside the generator'
        : 'Jump beside the generator to activate · protect it for 18s'
      : 'Protect generator · ' +
          Math.max(0, Math.ceil(18 - (this.game.time - this.armedAt))) +
          's · ' +
          Math.ceil(this.nodes[0]?.hp ?? 0) +
          ' integrity';
  }
}
