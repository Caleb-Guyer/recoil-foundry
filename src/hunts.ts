import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import type { Prop } from './props.ts';
import { clamp, direction, distance, type Vec, type Checkpoint } from './rules.ts';
import {
  HUNTS,
  HUNT_STAGES,
  HUNT_THRESHOLD,
  isHunt,
  isHuntOrder,
  planHunt,
  planHunts,
  huntLevel,
  type HuntKind,
  type HuntSave,
} from './hunt-rules.ts';
import { crossesSupport } from './teamwork.ts';
const { Bodies, Body, Composite, Query } = Matter;
export const huntMuzzle = (e: Enemy): Vec => ({
  x: e.body.position.x,
  y: e.body.position.y - (e.kind === 'bulwark' ? 95 : 27),
});
export interface HuntCable {
  anchors: [Prop, Prop];
  liveAt: number;
  endsAt: number;
}
export interface HuntMine {
  prop: Prop;
  explodesAt: number;
}
export class Hunts {
  game: Game;
  enabled = false;
  state: HuntSave | null = null;
  rules: 0 | 1 | 2 = 0;
  plans: HuntSave[] = [];
  gate: Matter.Body | null = null;
  previewApproach = false;
  cables: HuntCable[] = [];
  mines: HuntMine[] = [];
  plates: Prop[] = [];
  supplies = 0;
  door: Vec | null = null;
  onClear: (kind: HuntKind) => void = () => {};
  constructor(game: Game) {
    this.game = game;
  }
  start(save: Checkpoint | undefined, rules: boolean | 1 | 2, order?: readonly HuntKind[]) {
    const g = this.game;
    this.previewApproach = !!g.testRun?.huntApproach;
    this.enabled =
      g.encounters === 1 &&
      !g.practice &&
      (!g.testRun || !!g.testRun.rematchRoom) &&
      !g.workshop.active &&
      !/^RF-D\d+-/.test(g.seed) &&
      !!(save ? save.huntRules : rules);
    this.rules = this.enabled ? (save?.huntRules ?? (rules === 1 ? 1 : 2)) : 0;
    this.plans =
      this.rules === 2
        ? save
          ? structuredClone(save.hunts!)
          : isHuntOrder(order)
            ? HUNT_STAGES.map((stage, i) => ({ kind: order[i], stage, phase: 'available' }))
            : planHunts(g.seed)
        : [];
    this.state =
      this.rules === 1 ? (save ? structuredClone(save.hunt ?? null) : planHunt(g.seed)) : null;
  }
  get reservedStages(): readonly number[] {
    return this.rules === 2 ? HUNT_STAGES : [];
  }
  get order() {
    return this.plans.map((s) => s.kind);
  }
  get reserved() {
    const g = this.game;
    return (
      this.rules === 2 &&
      !g.detour &&
      !g.overtime &&
      !g.escape &&
      this.reservedStages.includes(g.stage)
    );
  }
  get approaching() {
    return this.previewApproach || (this.fighting && this.state?.phase === 'approach');
  }
  get waiting() {
    return !!this.kind && this.approaching;
  }
  get fighting() {
    return (
      !!this.state &&
      this.game.stage === this.state.stage &&
      this.game.detour &&
      ['approach', 'fight', 'reward'].includes(this.state.phase)
    );
  }
  get rewarding() {
    return this.fighting && this.state!.phase === 'reward';
  }
  get freeReroll() {
    return !!this.rerollCredit;
  }
  get rerollCredit() {
    return (this.rules === 2 ? this.plans : [this.state]).find(
      (s) => s?.phase === 'finished' && s.reward === 'reroll' && !s.rerollSpent,
    );
  }
  spendReroll() {
    const credit = this.rerollCredit;
    if (credit) credit.rerollSpent = true;
  }
  get kind(): HuntKind | undefined {
    return this.game.level?.hunt;
  }
  level() {
    const g = this.game,
      forced = g.practice && isHunt(g.practice.kind) ? g.practice.kind : g.testRun?.huntTest;
    if (this.rules === 2) this.state = this.plans.find((s) => s.stage === g.stage) ?? null;
    return forced
      ? huntLevel(forced, this.previewApproach)
      : this.fighting
        ? huntLevel(this.state!.kind, this.approaching)
        : null;
  }
  reset(cleared: boolean) {
    this.cables = [];
    this.mines = [];
    this.plates = [];
    this.supplies = 0;
    this.door = null;
    this.gate = null;
    const g = this.game,
      s = this.state;
    if (this.kind) {
      if (!this.approaching && !cleared) {
        Body.setPosition(g.player, { x: HUNT_THRESHOLD + 95, y: 722 });
        this.seal();
      }
      if (!cleared && this.kind === 'bulwark') this.makePlates();
      return;
    }
    if (!s || s.phase !== 'available' || g.stage !== s.stage) return;
    // Quiet post-boss patrols only. A special room owns its entrance and exits.
    if (
      g.detour ||
      g.overtime ||
      g.escape ||
      g.level.boss ||
      (g.level.annex && this.rules !== 2) ||
      g.level.story ||
      g.level.shutdown ||
      g.level.uprising ||
      g.level.courier ||
      g.level.floodgate ||
      g.level.sortingPit ||
      g.level.freight ||
      g.level.crossing ||
      g.areaEvents.encounter
    ) {
      s.phase = 'skipped';
      return;
    }
    // Reserved rooms always have a hatch: keep the known-clear player entrance
    // as a fallback for tall or mirrored Annex layouts. Props cannot cancel it.
    for (const x of this.rules === 2 ? [1760, 1660, 260, 200, 140] : [1810, 1750, 1690]) {
      if (
        Query.region(
          this.rules === 2
            ? [...g.terrain, ...g.hazards.bodies]
            : [...g.terrain, ...g.props.bodies, ...g.hazards.bodies],
          {
            min: { x: x - 48, y: 644 },
            max: { x: x + 48, y: 737 },
          },
        ).length === 0
      ) {
        this.door = { x, y: 740 };
        if (this.rules === 2)
          for (const prop of [...g.props.items])
            if (Math.abs(prop.body.position.x - x) < 90 && prop.body.bounds.max.y > 620)
              g.props.remove(prop);
        break;
      }
    }
    if (!this.door) s.phase = 'skipped';
  }
  enter(jump: boolean) {
    const g = this.game,
      door = this.door;
    if (
      !jump ||
      !door ||
      !g.clear ||
      g.time - g.clearAt < 0.4 ||
      !g.grounded ||
      Math.abs(g.player.position.x - door.x) > 46 ||
      Math.abs(g.player.position.y - 722) > 10 ||
      this.state?.phase !== 'available'
    )
      return false;
    this.state.phase = this.rules === 2 ? 'approach' : 'fight';
    g.detour = true;
    g.loadRoom();
    g.save();
    g.onChange();
    return true;
  }
  skip() {
    if (this.state?.phase === 'available' && this.game.stage === this.state.stage)
      this.state.phase = 'skipped';
  }
  defeated(e: Enemy, credited: boolean) {
    if (!isHunt(e.kind)) return;
    this.clearGear();
    this.unseal();
    const g = this.game;
    if (
      !credited ||
      e.spawn > 0 ||
      e.allied ||
      !this.enabled ||
      !this.fighting ||
      this.state?.phase !== 'fight' ||
      this.kind !== e.kind ||
      g.mode !== 'playing' ||
      g.hp <= 0
    )
      return;
    this.state.phase = 'reward';
    g.commendations.award(HUNTS[e.kind].commendation);
    this.onClear(e.kind);
  }
  complete() {
    const g = this.game;
    if (!this.kind || !g.clear) return false;
    this.clearGear();
    if (g.practice || g.testRun) {
      g.setMode('won');
      return true;
    }
    if (this.rewarding) {
      g.setMode('upgrade');
      g.save();
      return true;
    }
    // An uncredited cleanup never proves a victory or earns a reward.
    if (this.fighting) {
      this.state!.phase = 'skipped';
      this.returnToPatrol();
      return true;
    }
    return false;
  }
  choose(reward: 'repair' | 'reroll') {
    const g = this.game;
    if (!this.rewarding || g.mode !== 'upgrade' || !['repair', 'reroll'].includes(reward))
      return false;
    this.state!.phase = 'finished';
    this.state!.reward = reward;
    if (reward === 'repair') g.hp = Math.min(100, g.hp + 30);
    this.returnToPatrol();
    return true;
  }
  returnToPatrol() {
    const g = this.game;
    g.detour = false;
    g.loadRoom(false, true);
    const x =
      [1810, 1750, 1690].find(
        (x) =>
          Query.region(g.solidBodies, { min: { x: x - 24, y: 681 }, max: { x: x + 24, y: 737 } })
            .length === 0,
      ) ?? 140;
    Body.setPosition(g.player, { x, y: 722 });
    Body.setVelocity(g.player, { x: 0, y: 0 });
    g.setMode('playing');
    g.save();
  }
  clearGear() {
    for (const prop of [...this.game.props.items]) if (prop.hunt) this.game.props.remove(prop);
    this.cables = [];
    this.mines = [];
    this.plates = [];
  }
  seal() {
    if (this.gate) return;
    const g = this.game;
    this.gate = Bodies.rectangle(HUNT_THRESHOLD, 370, 26, 740, {
      isStatic: true,
      friction: 0,
      label: 'hunt-gate',
    });
    g.terrain.push(this.gate);
    Composite.add(g.engine.world, this.gate);
  }
  unseal() {
    if (!this.gate) return;
    const g = this.game;
    Composite.remove(g.engine.world, this.gate);
    g.terrain = g.terrain.filter((b) => b !== this.gate);
    this.gate = null;
  }
  ownedProp(tag: NonNullable<Prop['hunt']>, x: number, hp: number) {
    const p = this.game.props.spawn(
      tag === 'plate' ? 'cover' : 'charge',
      x,
      tag === 'plate' ? 697 : 730,
    );
    p.hunt = tag;
    p.hp = p.maxHp = hp;
    Body.setStatic(p.body, tag !== 'plate');
    Body.setInertia(p.body, Infinity);
    p.body.restitution = 0;
    return p;
  }
  makePlates() {
    if (this.supplies >= 2) return;
    const e = this.game.enemies.find((e) => e.kind === 'bulwark');
    if (!e) return;
    const x = clamp(e.body.position.x, 420, 1620);
    this.plates = [this.ownedProp('plate', x - 90, 85), this.ownedProp('plate', x + 90, 85)];
    this.supplies++;
  }
  hitProp(p: Prop, damage: number, velocity: Vec, playerDamage: boolean) {
    if (!p.hunt || !this.game.props.items.includes(p)) return;
    if (!playerDamage || damage <= 0 || this.game.mode !== 'playing') return;
    p.hp -= damage;
    p.flash = 0.1;
    if (p.hunt === 'plate') {
      const d = direction({ x: 0, y: 0 }, velocity);
      Body.setVelocity(p.body, {
        x: clamp(p.body.velocity.x + d.x * Math.min(5, damage * 0.1), -8, 8),
        y: p.body.velocity.y,
      });
    }
    if (p.hp > 0) return;
    this.game.props.remove(p);
    this.game.burst(p.body.position, 8, '#e8c886', 3);
    this.game.onSound('prop');
    const cable = this.cables.find((c) => c.anchors.includes(p));
    if (cable) {
      cable.anchors.forEach((a) => this.game.props.remove(a));
      this.cables = this.cables.filter((c) => c !== cable);
    }
    this.mines = this.mines.filter((m) => m.prop !== p);
    this.plates = this.plates.filter((a) => a !== p);
    if (cable || (p.hunt === 'plate' && !this.plates.length)) {
      const e = this.game.enemies.find((e) => isHunt(e.kind));
      if (e) {
        e.state = 'recover';
        e.timer = 1.6;
      }
    }
  }
  armor(e: Enemy) {
    return e.kind === 'bulwark' && this.plates.some((p) => this.game.props.items.includes(p))
      ? 0.7
      : 1;
  }
  cutAlong(from: Vec, to: Vec, radius: number, friendly: boolean) {
    if (!friendly || this.game.mode !== 'playing') return;
    for (const cable of [...this.cables]) {
      const [a, b] = cable.anchors.map((p) => ({
        x: p.body.position.x,
        y: p.body.position.y - 18,
      }));
      if (crossesSupport(from, to, a, b, radius))
        this.hitProp(cable.anchors[0], 22, { x: 0, y: 0 }, true);
    }
  }
  clearFloor(x: number, width = 40) {
    return (
      Query.region(this.game.terrain, {
        min: { x: x - width, y: 670 },
        max: { x: x + width, y: 738 },
      }).length === 0
    );
  }
  updateEnemy(e: Enemy) {
    if (!isHunt(e.kind)) return false;
    const g = this.game,
      p = e.body.position,
      player = g.player.position;
    e.facing = Math.sign(player.x - p.x) || e.facing;
    if (e.state === 'idle') {
      const vx = Math.abs(player.x - p.x) > 460 ? e.facing * 1.9 : 0;
      Body.setVelocity(e.body, { x: vx, y: e.body.velocity.y });
      if (e.timer <= 0) {
        e.state = 'windup';
        e.timer = 1.15;
        e.aim = direction(huntMuzzle(e), player);
        e.target = {
          x: clamp(
            player.x,
            e.kind === 'cableweaver' ? 300 : 80,
            e.kind === 'cableweaver' ? 1660 : 1920,
          ),
          y: 730,
        };
        const cableX = clamp(e.target.x, 300, 1660);
        const deploy =
          e.kind === 'cableweaver'
            ? this.supplies < 5 &&
              this.cables.length < 2 &&
              this.clearFloor(cableX - 135, 14) &&
              this.clearFloor(cableX + 135, 14)
            : e.kind === 'demolisher' &&
              this.supplies < 6 &&
              this.mines.length < 2 &&
              this.clearFloor(e.target.x, 14);
        // Lead with a warned volley before charges. An edge camper should
        // have to dodge, rather than disarming the only attack before a kill.
        e.attack = e.attacks % 2 === (e.kind === 'demolisher' ? 1 : 0) && deploy ? 'mortar' : 'fan';
        g.onSound('arm');
      }
    } else if (e.state === 'windup' && e.timer <= 0) {
      if (
        e.attack === 'mortar' &&
        e.kind === 'cableweaver' &&
        this.supplies < 5 &&
        this.cables.length < 2
      ) {
        const x = clamp(e.target.x, 300, 1660),
          a = x - 135,
          b = x + 135;
        if (this.clearFloor(a, 14) && this.clearFloor(b, 14)) {
          const anchors: [Prop, Prop] = [
            this.ownedProp('anchor', a, 22),
            this.ownedProp('anchor', b, 22),
          ];
          this.cables.push({ anchors, liveAt: g.time + 1.2, endsAt: g.time + 3.8 });
          this.supplies++;
        }
      } else if (
        e.attack === 'mortar' &&
        e.kind === 'demolisher' &&
        this.supplies < 6 &&
        this.mines.length < 2 &&
        this.clearFloor(e.target.x, 14)
      ) {
        this.mines.push({ prop: this.ownedProp('mine', e.target.x, 12), explodesAt: g.time + 2.8 });
        this.supplies++;
      } else {
        if (e.kind === 'bulwark' && !this.plates.length && this.supplies < 2) this.makePlates();
        const angle = Math.atan2(e.aim.y, e.aim.x);
        for (const offset of [-0.19, 0, 0.19])
          g.enemyShot(e, angle + offset, 8.5, 14, huntMuzzle(e));
      }
      e.attacks++;
      e.state = 'recover';
      e.timer = 1.8;
    } else if (e.state === 'recover' && e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.7;
    }
    return true;
  }
  update() {
    const g = this.game;
    if (!this.kind || g.mode !== 'playing' || g.hp <= 0) return;
    if (this.approaching) {
      if (g.player.position.x < HUNT_THRESHOLD + 50) return;
      if (this.state) this.state.phase = 'fight';
      this.previewApproach = false;
      this.seal();
      g.spawnEnemy(this.kind, 1460, 705);
      if (this.kind === 'bulwark') this.makePlates();
      g.onSound('arm');
      g.save();
      g.onChange();
    }
    if (this.gate && g.player.position.x < HUNT_THRESHOLD + 28) {
      Body.setPosition(g.player, { x: HUNT_THRESHOLD + 28, y: g.player.position.y });
      Body.setVelocity(g.player, { x: Math.max(0, g.player.velocity.x), y: g.player.velocity.y });
    }
    for (const c of [...this.cables]) {
      if (g.time >= c.endsAt || c.anchors.some((p) => !g.props.items.includes(p))) {
        c.anchors.forEach((p) => g.props.remove(p));
        this.cables = this.cables.filter((a) => a !== c);
        continue;
      }
      if (g.time < c.liveAt) continue;
      const [a, b] = c.anchors.map((p) => p.body.position),
        player = g.player.position;
      if (
        player.x > a.x - 13 &&
        player.x < b.x + 13 &&
        Math.abs(player.y - 711) < 21 &&
        distance(g.lineEnd({ x: a.x, y: 712 }, { x: player.x, y: 712 }, 0, c.anchors[0]), {
          x: player.x,
          y: 712,
        }) < 1
      )
        g.damagePlayer(14, a, { type: 'lightning', enemy: 'cableweaver' });
    }
    for (const m of [...this.mines]) {
      if (!g.props.items.includes(m.prop)) {
        this.mines = this.mines.filter((a) => a !== m);
        continue;
      }
      if (g.time < m.explodesAt) continue;
      const p = { ...m.prop.body.position };
      g.props.remove(m.prop);
      this.mines = this.mines.filter((a) => a !== m);
      g.burst(p, 22, '#f3b579', 6);
      g.feedback(4);
      g.onSound('crash');
      if (
        distance(p, g.player.position) < 120 &&
        distance(g.lineEnd(p, g.player.position), g.player.position) < 1
      )
        g.damagePlayer(20, p, { type: 'blast', enemy: 'demolisher' });
    }
    this.plates = this.plates.filter((p) => g.props.items.includes(p));
  }
}
