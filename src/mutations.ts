import Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import type { Prop } from './props.ts';
import { direction, distance, seeded, type Checkpoint, type Vec } from './rules.ts';

export const MUTATIONS = {
  splitter: { name: 'Splitter', host: 'runner', stage: 2 },
  gunner: { name: 'Volatile Gunner', host: 'shooter', stage: 6 },
  blinker: { name: 'Blinker', host: 'flyer', stage: 10 },
} as const;
export type MutationKind = keyof typeof MUTATIONS;
export interface MutationRig {
  kind: MutationKind;
  phase: 'idle' | 'tell' | 'recover';
  timer: number;
  count: number;
  destination?: Vec;
}
export const BLINK_TELL = 0.8;
export const BLINK_RECOVERY = 0.7;
export const GUNNER_TELL = 0.8;
export const GUNNER_RADIUS = 105;
export const SPLIT_SCALE = 0.6;
const { Body, Query } = Matter;

export function mutationTestFromUrl(url: URL): Checkpoint | null {
  const p = url.searchParams;
  const kind = p.get('mutation') as MutationKind;
  if (
    p.get('test') !== 'mutations' ||
    p.getAll('test').length !== 1 ||
    p.getAll('mutation').length !== 1 ||
    !Object.hasOwn(MUTATIONS, kind)
  )
    return null;
  let unknown = false;
  p.forEach((_, key) => {
    if (!['test', 'mutation', 'arena', 'v'].includes(key)) unknown = true;
  });
  if (unknown || (p.has('arena') && (p.getAll('arena').length !== 1 || p.get('arena') !== 'turf')))
    return null;
  const turf = p.get('arena') === 'turf';
  const stage = turf ? Math.max(4, MUTATIONS[kind].stage) : MUTATIONS[kind].stage;
  return {
    version: 6,
    seed:
      (turf
        ? 'MUTATION-81-TURF-' + { splitter: 6, gunner: 1, blinker: 3 }[kind] + '-'
        : 'MUTATION-81-' + { splitter: 6, gunner: 2, blinker: 2 }[kind] + '-') + kind,
    stage,
    ...(turf
      ? {
          areaEvent: {
            kind: 'turf' as const,
            area: Math.floor(stage / 4),
            relays: [],
            caches: [],
            commander: false,
            rerolls: 0,
          },
        }
      : {}),
    hp: 100,
    mods: ['magnum', 'ricochet', 'airshot', 'light'],
    kills: 0,
    elapsed: 0,
  };
}

export class MutationSystem {
  game: Game;
  pending: { pos: Vec; left: number; at: number }[] = [];
  constructor(game: Game) {
    this.game = game;
  }
  clear() {
    this.pending = [];
    for (const e of this.game.enemies ?? [])
      if (e.mutation) {
        e.mutation.destination = undefined;
        e.mutation.phase = 'idle';
      }
  }
  reset(cleared: boolean) {
    this.clear();
    const g = this.game;
    if (
      cleared ||
      g.stage < 2 ||
      g.practice ||
      g.workshop.active ||
      g.detour ||
      g.escape ||
      g.overtime ||
      g.level.boss ||
      g.level.freight ||
      g.level.courier ||
      g.level.floodgate ||
      (g.testRun && !g.seed.startsWith('MUTATION-')) ||
      (g.areaEvents.active && g.areaEvents.active !== 'turf') ||
      (g.areaEvents.active !== 'turf' &&
        (g.level.anglerIntro ||
          g.level.fabricatorIntro ||
          g.level.crawlerIntro ||
          g.level.harpoonIntro ||
          g.level.sapperIntro))
    )
      return;
    const rng = seeded(g.roomSeed + ':mutations-v1:' + g.stage + ':' + (g.route ?? 'main'));
    const intro = (Object.keys(MUTATIONS) as MutationKind[]).find(
      (kind) => MUTATIONS[kind].stage === g.stage,
    );
    if ((g.areaEvents.active === 'turf' || !intro) && rng() >= 0.24) return;
    const candidates = [
      ...g.enemies
        .filter((e) => !e.allied && !e.elite && !e.squad && !e.eventRole && !e.splitChild)
        .map((enemy) => ({ kind: enemy.kind, enemy, spawn: undefined })),
      ...g.waves.doors
        .filter((d) => !d.spawn.elite && !d.spawn.squad)
        .map((d) => ({ kind: d.spawn.kind, enemy: undefined, spawn: d.spawn })),
    ];
    const kinds = (Object.keys(MUTATIONS) as MutationKind[]).filter(
      (kind) =>
        g.stage >= MUTATIONS[kind].stage &&
        (!intro || kind === intro) &&
        candidates.some((c) => c.kind === MUTATIONS[kind].host),
    );
    if (!kinds.length) return;
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const hosts = candidates.filter((c) => c.kind === MUTATIONS[kind].host);
    const host = hosts[Math.floor(rng() * hosts.length)];
    if (host.enemy) this.decorate(host.enemy, kind);
    else if (host.spawn) host.spawn.mutation = kind;
  }
  decorate(e: Enemy, variant: MutationKind | 'split-child') {
    if (e.allied || e.elite || e.squad || e.eventRole || e.splitChild) return;
    if (variant === 'split-child') {
      if (e.kind !== 'runner') return;
      e.splitChild = true;
      Body.scale(e.body, SPLIT_SCALE, SPLIT_SCALE);
      e.hp = e.maxHp = Math.ceil(e.maxHp * 0.32);
      e.spawn = 0.45;
      e.timer = 0.8;
    } else if (e.kind === MUTATIONS[variant].host) {
      e.mutation = {
        kind: variant,
        phase: 'idle',
        timer: variant === 'blinker' ? 3.2 : 1.1,
        count: 0,
      };
    }
  }
  killed(e: Enemy) {
    const g = this.game;
    if (
      e.mutation?.kind !== 'splitter' ||
      e.splitChild ||
      g.mode !== 'playing' ||
      g.hp <= 0 ||
      e.body.position.y > 820 ||
      g.level.boss
    )
      return;
    this.pending.push({ pos: { ...e.body.position }, left: 2, at: g.time });
    this.update();
  }
  space(p: Vec, half: Vec, ignored?: Matter.Body) {
    const g = this.game;
    return (
      p.x > half.x + 5 &&
      p.x < g.worldWidth - half.x - 5 &&
      p.y > g.worldTop + half.y + 5 &&
      p.y < 740 - half.y &&
      !Query.region(
        [
          ...g.solidBodies,
          g.player,
          ...g.enemies.filter((e) => e.body !== ignored).map((e) => e.body),
          ...g.areaEvents.allies.map((e) => e.body),
        ],
        {
          min: { x: p.x - half.x - 4, y: p.y - half.y - 4 },
          max: { x: p.x + half.x + 4, y: p.y + half.y + 4 },
        },
      ).length
    );
  }
  update() {
    const g = this.game;
    if (g.mode !== 'playing') return;
    for (const split of this.pending) {
      const candidates: Vec[] = [];
      for (const radius of [22, 48, 80, 120, 170])
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [-0.7, -0.7],
          [0.7, -0.7],
          [0, 1],
        ])
          candidates.push({ x: split.pos.x + dx * radius, y: split.pos.y + dy * radius - 6 });
      for (const p of candidates) {
        if (!split.left) break;
        if (
          !this.space(p, { x: 9, y: 10 }) ||
          distance(p, g.player.position) < 48 ||
          (g.time - split.at < 1.2 && distance(g.lineEnd(split.pos, p, 8), p) > 0.1)
        )
          continue;
        const child = g.spawnEnemy(
          'runner',
          p.x,
          p.y,
          undefined,
          undefined,
          undefined,
          'split-child',
        );
        if (!child) break;
        split.left--;
        g.burst(p, 6, '#e7bd88', 2);
      }
    }
    // Crushing machinery can bury the corpse completely. Give blocked buds a
    // brief chance to emerge, then crush them rather than trapping the exit.
    this.pending = this.pending.filter((s) => s.left > 0 && g.time - s.at < 3);
  }
  blinkDestination(e: Enemy): Vec | undefined {
    const g = this.game,
      rig = e.mutation!,
      origin = e.body.position;
    const target = g.areaEvents.combatTarget(e);
    const rng = seeded(g.roomSeed + ':blink:' + g.stage + ':' + rig.count);
    const start = rng() * Math.PI * 2;
    const candidates: Vec[] = [];
    for (const radius of [210, 270, 160])
      for (let i = 0; i < 12; i++) {
        const angle = start + (i * Math.PI) / 6;
        const p = {
          x: origin.x + Math.cos(angle) * radius,
          y: origin.y + Math.sin(angle) * radius,
        };
        if (
          p.y > 620 ||
          distance(p, g.player.position) < 170 ||
          distance(p, target) < 150 ||
          !this.space(p, { x: 19, y: 19 }, e.body)
        )
          continue;
        candidates.push(p);
      }
    return candidates.sort(
      (a, b) => Math.abs(distance(a, target) - 330) - Math.abs(distance(b, target) - 330),
    )[0];
  }
  updateEnemy(e: Enemy, dt: number): boolean {
    const g = this.game,
      rig = e.mutation;
    if (!rig || rig.kind === 'splitter') return false;
    rig.timer -= dt;
    if (rig.kind === 'gunner') {
      const target = g.areaEvents.combatTarget(e),
        p = e.body.position;
      if (
        rig.phase === 'idle' &&
        rig.timer <= 0 &&
        distance(p, target) < 1350 &&
        distance(g.lineEnd(p, target), target) < 0.1
      ) {
        e.aim = direction(p, target);
        rig.phase = 'tell';
        rig.timer = GUNNER_TELL;
        g.onSound('aim-warn');
      } else if (rig.phase === 'tell' && rig.timer <= 0) {
        this.fire(e);
        rig.phase = 'idle';
        rig.timer = 2.1;
      }
      if (Query.collides(g.player, [e.body]).length)
        g.damagePlayer(15, p, { type: 'contact', enemy: 'shooter' });
      this.game.areaEvents.contact(e);
      if (p.y > 900) g.hitEnemy(e, 9999);
      return true;
    }
    if (rig.phase === 'idle') {
      if (rig.timer > 0) return false;
      rig.destination = this.blinkDestination(e);
      rig.count++;
      if (!rig.destination) {
        rig.timer = 1.5;
        return false;
      }
      rig.phase = 'tell';
      rig.timer = BLINK_TELL;
      g.onSound('aim-warn');
    }
    Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
    Body.setVelocity(e.body, { x: 0, y: 0 });
    if (rig.phase === 'tell' && rig.timer <= 0) {
      const dest = rig.destination!;
      if (this.space(dest, { x: 19, y: 19 }, e.body) && distance(dest, g.player.position) >= 170) {
        g.tethers.disrupt(e.body);
        g.harpoons.disrupt(e.body);
        g.burst(e.body.position, 8, '#bdb0ee', 2);
        Body.setPosition(e.body, dest);
        g.burst(dest, 8, '#bdb0ee', 2);
        g.onSound('bank');
      }
      rig.destination = undefined;
      rig.phase = 'recover';
      rig.timer = BLINK_RECOVERY;
      e.timer = Math.max(e.timer, 1.05);
    } else if (rig.phase === 'recover' && rig.timer <= 0) {
      rig.phase = 'idle';
      rig.timer = 3.2;
    }
    return true;
  }
  fire(e: Enemy) {
    const g = this.game,
      p = e.body.position;
    const muzzle = { x: p.x + e.aim.x * 32, y: p.y + e.aim.y * 32 };
    if (distance(g.lineEnd(p, muzzle, 7), muzzle) > 0.1) return;
    g.addShot({
      pos: muzzle,
      vel: { x: e.aim.x * 6.5, y: e.aim.y * 6.5 },
      damage: 24,
      life: 3.5,
      friendly: false,
      radius: 7,
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
      source: { ...p },
      mutationShell: { owner: e.id },
      damageCause: { type: 'blast', enemy: 'shooter' },
    });
    g.onSound('enemy');
  }
  explode(s: Shot) {
    const g = this.game;
    if (!s.mutationShell || g.mode !== 'playing') return;
    s.mutationShell = undefined;
    s.life = 0;
    const p = { ...s.pos };
    const visible = (target: Vec, ignore?: Prop) =>
      distance(p, target) < GUNNER_RADIUS &&
      distance(g.lineEnd(p, target, 0, ignore), target) < 0.1;
    const enemies = g.enemies.filter((e) => e.spawn <= 0 && visible(e.body.position));
    const allies = g.areaEvents.allies.filter((e) => e.spawn <= 0 && visible(e.body.position));
    const player = visible(g.player.position);
    const props = g.props.items.filter((prop) => visible(prop.body.position, prop));
    const panels = g.breaches.targets(p, GUNNER_RADIUS);
    const terrain = g.destruction.targets(p, GUNNER_RADIUS);
    g.burst(p, 18, '#ffd08a', 4);
    if (g.particles.length < 220)
      g.particles.push({
        pos: p,
        vel: { x: 0, y: 0 },
        life: 0.2,
        max: 0.2,
        size: GUNNER_RADIUS,
        color: '#f1b671',
        kind: 'ring',
      });
    g.feedback(4);
    g.onSound('explode');
    for (const e of enemies) g.hitEnemy(e, 48, undefined, true, false, false);
    for (const e of allies) g.areaEvents.hitAlly(e, 48);
    if (player) g.damagePlayer(24, p, { type: 'blast', enemy: 'shooter' });
    if (g.mode !== 'playing') return;
    for (const prop of props) {
      if (prop.kind === 'canister') g.props.explode(prop, false);
      else g.props.hit(prop, 45, direction(p, prop.body.position));
      if (g.mode !== 'playing') return;
    }
    for (const panel of panels) g.breaches.hit(panel, 45, direction(p, panel.body.position));
    for (const piece of terrain)
      g.destruction.hitBody(piece.body, 45, direction(p, piece.body.position));
  }
}
