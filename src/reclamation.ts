import Matter from 'matter-js';
import type { Game, Enemy } from './game.ts';
import { clamp, direction, distance } from './rules.ts';
import { bossPhase } from './enemies.ts';
import { bossHasLane, bossHuntTarget, huntBoss } from './boss-hunt.ts';

const { Body } = Matter;
export const SORTER_TELL = 1.15;
export const SORTER_LOCK = 0.75;
export const SORTER_WIDTH = 84;
export interface SorterRig {
  lanes: number[];
  pulse: number;
}
export const createSorter = (): SorterRig => ({ lanes: [], pulse: 0 });
export function sorterFan(e: Enemy) {
  const base = Math.atan2(e.aim.y, e.aim.x);
  return (e.phase === 0 ? [-0.27, 0, 0.27] : [-0.44, -0.22, 0, 0.22, 0.44]).map((a) => base + a);
}

export function updateReclamationEnemy(g: Game, e: Enemy, dt: number) {
  if (e.kind === 'sorter') {
    updateSorter(g, e, dt);
    return;
  }
  const p = e.body.position,
    player = g.player.position;
  const flying = e.kind === 'sifter';
  if (flying) Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
  if (e.state === 'windup') {
    Body.setVelocity(e.body, {
      x: e.body.velocity.x * 0.65,
      y: flying ? e.body.velocity.y * 0.65 : e.body.velocity.y,
    });
    if (e.timer > 0.5) e.aim = direction(p, player);
    if (e.timer <= 0) {
      const angle = Math.atan2(e.aim.y, e.aim.x);
      // Borer's compact burst cuts the actual crate in its firing lane. Sifter
      // crosses above cover, then paints a wider, slower falling fan.
      for (let i = -1; i <= 1; i++)
        g.enemyShot(e, angle + i * (flying ? 0.22 : 0.045), flying ? 9 : 13, flying ? 19 : 18);
      e.attacks++;
      e.state = 'recover';
      e.timer = flying ? 1.35 : 1.15;
      g.onSound('enemy');
    }
    return;
  }
  if (e.state === 'recover') {
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.45;
      e.hunt = undefined;
    }
    return;
  }
  if (flying) {
    const target = bossHuntTarget(g, e, true, Math.sign(p.x - player.x) * -1);
    Body.setVelocity(e.body, {
      x: clamp((target.x - p.x) * 0.06, -3.4, 3.4),
      y: clamp((target.y - p.y) * 0.06, -3.5, 3.5),
    });
  } else {
    // Stop behind loose cover when it provides a firing position; otherwise
    // use the same collision-aware jumps as the other ground enemies.
    const cover = g.props.items.find(
      (prop) =>
        prop.kind === 'crate' &&
        Math.abs(prop.body.position.y - p.y) < 55 &&
        distance(prop.body.position, p) < 170 &&
        (prop.body.position.x - p.x) * (player.x - p.x) > 0,
    );
    if (cover && distance(player, p) < 700)
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y });
    else g.updateRunner(e, direction(p, player), distance(p, player));
  }
  const visible = distance(g.lineEnd(p, player), player) < 2;
  const crateLane = g.props.items.some(
    (prop) => prop.kind === 'crate' && distance(prop.body.position, p) < 180,
  );
  if (e.timer <= 0 && distance(p, player) < 850 && (visible || (!flying && crateLane))) {
    e.state = 'windup';
    e.timer = 0.9;
    e.aim = direction(p, player);
    g.onSound('lock');
  }
}

function updateSorter(g: Game, e: Enemy, dt: number) {
  const rig = e.sorter!,
    p = e.body.position;
  Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
  rig.pulse = Math.max(0, rig.pulse - dt);
  const phase = bossPhase(e.hp, e.maxHp);
  if (phase > e.phase) {
    e.phase = phase;
    e.state = 'transition';
    e.timer = 1.1;
    rig.lanes = [];
    rig.pulse = 0;
    g.feedback(5);
    g.onSound('phase');
  }
  if (e.state === 'transition') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.85, y: e.body.velocity.y * 0.85 });
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.3;
    }
    return;
  }
  if (e.state === 'windup') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.7, y: e.body.velocity.y * 0.7 });
    if (e.attack === 'slam') {
      if (e.timer > SORTER_LOCK) {
        const x = clamp(g.player.position.x, 60, 1940);
        rig.lanes = [x];
        if (e.phase >= 1) rig.lanes.push(clamp(x + (x < 1000 ? 420 : -420), 60, 1940));
        if (e.phase >= 2) rig.lanes.push(clamp(x + (x < 1000 ? 840 : -840), 60, 1940));
      }
      if (e.timer <= 0) {
        rig.pulse = 0.22;
        for (const x of rig.lanes) {
          if (Math.abs(g.player.position.x - x) < SORTER_WIDTH / 2 + 13)
            g.damagePlayer(24, { x, y: g.player.position.y - 80 });
          // Induction strikes dislodge metal as well as threatening the player.
          for (const prop of [...g.props.items])
            if (Math.abs(prop.body.position.x - x) < SORTER_WIDTH / 2 + 22)
              g.props.hit(prop, 65, { x: 0, y: -1 });
        }
        e.state = 'recover';
        // Long enough for a delayed shell and its follow-up to reach the
        // exposed housing after the player clears the induction lane.
        e.timer = 1.6;
        e.attacks++;
        g.onSound('slam');
        g.feedback(5);
      }
    } else {
      if (e.timer > 0.5) e.aim = direction(p, g.player.position);
      if (e.timer <= 0) {
        for (const angle of sorterFan(e)) g.enemyShot(e, angle, 10.8, 22);
        e.state = 'recover';
        e.timer = 1.15;
        e.attacks++;
        g.onSound('enemy');
      }
    }
    return;
  }
  if (e.state === 'recover') {
    Body.setVelocity(e.body, { x: e.body.velocity.x * 0.85, y: e.body.velocity.y * 0.85 });
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.55;
      e.hunt = undefined;
      rig.lanes = [];
    }
    return;
  }
  huntBoss(g, e);
  if (e.timer <= 0) {
    // The field attack reaches camped corners and elevated players. Gunfire
    // still respects cover, with navigation finding a real firing opening.
    e.attack =
      e.attacks % 2 === 0 || !bossHasLane(g, e) || distance(p, g.player.position) < 260
        ? 'slam'
        : 'fan';
    e.state = 'windup';
    e.timer = e.attack === 'slam' ? SORTER_TELL : 0.95;
    e.aim = direction(p, g.player.position);
    rig.lanes = e.attack === 'slam' ? [clamp(g.player.position.x, 60, 1940)] : [];
    g.onSound('lock');
  }
}
