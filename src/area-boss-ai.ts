import Matter from 'matter-js';
import { firstSolid } from './collisions.ts';
import type { Enemy, Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp, direction, distance, segmentBox } from './rules.ts';
import {
  ENEMY_STATS,
  FLAK_LOCK,
  FLAK_TELL,
  LOADER_TELL,
  PRESS_LOCK,
  PRESS_TELL,
  bossMuzzle,
  flakAngles,
} from './enemies.ts';

const { Body, Query } = Matter;

function loaderGrounded(g: Game, e: Enemy) {
  if (g.enemyGrounded(e)) return true;
  if (e.body.velocity.y < -1) return false;
  const p = e.body.position,
    tread = ENEMY_STATS.loader.w / 2 - 10;
  // Either tread can rest on a prop edge while the center hangs over a gap.
  return [-tread, tread].some(
    (offset) =>
      Query.ray(
        g.solidBodies,
        { x: p.x + offset, y: e.body.bounds.max.y - 2 },
        { x: p.x + offset, y: e.body.bounds.max.y + 5 },
        12,
      ).length > 0,
  );
}

function visible(g: Game, from: Vec, target = g.player.position) {
  // Check the entire muzzle-to-player lane with room for the five-pixel bolt
  // and a little braking drift, rather than accepting a ray that skims cover.
  return distance(g.lineEnd(from, target, 7), target) < 0.1;
}

function beginFlak(g: Game, e: Enemy) {
  e.attack = 'flak';
  e.phase = g.overtime || e.hp < e.maxHp * 0.5 ? 1 : 0;
  e.state = 'windup';
  e.timer = FLAK_TELL;
  e.aim = direction(bossMuzzle(e), g.player.position);
  if (e.kind === 'press') Body.setVelocity(e.body, { x: 0, y: 0 });
  g.onSound('lock');
}

function updateFlak(g: Game, e: Enemy) {
  if (e.timer > FLAK_LOCK) e.aim = direction(bossMuzzle(e), g.player.position);
  if (e.timer > 0) return;
  const origin = bossMuzzle(e);
  for (const angle of flakAngles(Math.atan2(e.aim.y, e.aim.x), e.phase === 1))
    g.enemyShot(e, angle, 10, 18, origin);
  e.attacks++;
  // This is a firing cooldown, not the exposed crash/slam recovery state.
  e.state = 'idle';
  e.timer = 0.18;
  g.onSound('enemy');
}

function loaderApproach(g: Game, e: Enemy, counter: boolean) {
  const p = e.body.position;
  if (!counter || visible(g, bossMuzzle(e))) return g.player.position.x;
  // A ledge remains real cover. Seek its side, then use the existing physical
  // hop to find an elevated angle instead of firing through the platform.
  const candidates = [220, -220, 380, -380, 560, -560]
    .map((offset) => clamp(g.player.position.x + offset, 70, g.worldWidth - 70))
    .filter((x) => visible(g, { x, y: p.y - 42 - 140 }));
  candidates.sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
  return candidates[0] ?? g.player.position.x;
}

export function updateLoader(g: Game, e: Enemy) {
  const p = e.body.position,
    v = e.body.velocity,
    above = g.player.position.y < p.y - 130,
    corner = g.player.position.x < 95 || g.player.position.x > g.worldWidth - 95,
    counter = above || corner,
    grounded = loaderGrounded(g, e),
    nose = ENEMY_STATS.loader.w / 2 + 24;
  if (e.state === 'rush') {
    const contact =
      e.timer > 0
        ? firstSolid(
            p,
            { x: p.x + e.aim.x * 24, y: p.y },
            { x: ENEMY_STATS.loader.w / 2, y: ENEMY_STATS.loader.h / 2 - 1 },
            g.solidBodies,
          )
        : undefined;
    const prop = contact && g.props.items.find((prop) => prop.body === contact.body);
    const end = g.lineEnd(p, { x: p.x + e.aim.x * nose, y: p.y });
    // Keep the wall braking distance; destructible props need actual contact.
    const crashed =
      e.timer > 0 && (prop ? contact!.t * 24 <= 15 : Math.abs(end.x - p.x) < nose - 1);
    if (crashed || e.timer <= 0) {
      e.state = 'recover';
      e.timer = crashed ? 1.25 : 0.4;
      Body.setVelocity(e.body, { x: 0, y: v.y });
      if (crashed) {
        if (prop && contact)
          Body.setPosition(e.body, {
            x: p.x + e.aim.x * Math.max(0, contact.t * 24 - 0.05),
            y: p.y,
          });
        g.burst(
          prop ? { x: p.x + (e.aim.x * ENEMY_STATS.loader.w) / 2, y: p.y } : end,
          22,
          '#ffcf93',
          5,
        );
        g.feedback(5);
        g.onSound('crash');
        if (prop) g.props.strike(prop, 160, e.aim);
      }
    } else Body.setVelocity(e.body, { x: e.aim.x * 15, y: v.y });
  } else if (e.state === 'windup') {
    Body.setVelocity(e.body, { x: v.x * 0.55, y: v.y });
    if (e.attack === 'flak') updateFlak(g, e);
    else if (e.timer <= 0) {
      e.state = 'rush';
      e.timer = 1.3;
      g.onSound('loader');
    }
  } else if (e.state === 'recover') {
    Body.setVelocity(e.body, { x: v.x * 0.7, y: v.y });
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.15;
    }
  } else {
    const targetX = loaderApproach(g, e, counter),
      sign = Math.sign(targetX - p.x) || Math.sign(g.player.position.x - p.x) || -1;
    e.aim = { x: sign, y: 0 };
    Body.setVelocity(e.body, { x: v.x + (sign * 3.4 - v.x) * 0.1, y: v.y });
    const blocked = Math.abs(g.lineEnd(p, { x: p.x + sign * nose, y: p.y }).x - p.x) < nose - 1;
    if (counter && e.timer <= 0 && visible(g, bossMuzzle(e))) beginFlak(g, e);
    else if (grounded && blocked) {
      Body.setVelocity(e.body, { x: sign * 5.5, y: -12.5 });
      e.timer = Math.max(e.timer, 0.6);
    } else if (grounded && e.timer <= 0) {
      if (counter) {
        Body.setVelocity(e.body, { x: sign * 5.5, y: -12.5 });
        e.timer = 0.45;
      } else if (Math.abs(g.player.position.y - p.y) < 180) {
        e.attack = 'aimed';
        e.state = 'windup';
        e.timer = LOADER_TELL;
        g.onSound('charge');
      }
    }
  }
}

function pressSpot(g: Game, e: Enemy, hover: number): Vec {
  const half = ENEMY_STATS.press.w / 2,
    p = e.body.position,
    player = g.player.position;
  const candidates = [
    p.x,
    player.x,
    ...[140, 260, 400, 560, 740].flatMap((d) => [player.x - d, player.x + d]),
  ]
    .map((x) => ({ x: clamp(x, half, g.worldWidth - half), y: hover }))
    .filter((spot) => {
      if (!visible(g, { x: spot.x, y: spot.y - 38 })) return false;
      return !g.solidBodies.some(
        (body) =>
          body.bounds.min.x < spot.x + half &&
          body.bounds.max.x > spot.x - half &&
          body.bounds.min.y < spot.y + 31 &&
          body.bounds.max.y > spot.y - 31,
      );
    });
  candidates.sort((a, b) => distance(a, p) - distance(b, p));
  return candidates[0] ?? { x: clamp(player.x, half, g.worldWidth - half), y: hover };
}

export function updatePress(g: Game, e: Enemy) {
  const p = e.body.position,
    v = e.body.velocity,
    player = g.player.position,
    half = ENEMY_STATS.press.h / 2,
    halfWidth = ENEMY_STATS.press.w / 2;
  Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
  if (e.state === 'windup') {
    if (e.attack === 'flak') {
      Body.setVelocity(e.body, { x: v.x * 0.5, y: v.y * 0.5 });
      updateFlak(g, e);
      return;
    }
    if (e.timer > PRESS_LOCK) e.target.x = clamp(player.x, halfWidth, g.worldWidth - halfWidth);
    e.target.y = g.pressSurface(e.target.x, p.y + half);
    Body.setVelocity(e.body, {
      x: clamp((e.target.x - p.x) * 0.25, -12, 12),
      y: clamp((260 - p.y) * 0.15, -9, 9),
    });
    if (e.timer <= 0 && Math.abs(e.target.x - p.x) < 4) {
      // The marked column stays locked. Correct only the final sub-frame gap;
      // a remote target never causes a teleport through the room or its cover.
      Body.setPosition(e.body, { x: e.target.x, y: p.y });
      Body.setVelocity(e.body, { x: 0, y: 0 });
      e.state = 'rush';
      e.timer = 0.9;
      g.onSound('press');
    } else if (e.timer < -0.35) {
      e.state = 'idle';
      e.timer = 0.2;
    }
  } else if (e.state === 'rush') {
    const contact = firstSolid(
      p,
      { x: p.x, y: p.y + 20 },
      { x: halfWidth - 0.05, y: half },
      g.solidBodies,
    );
    const nextY = p.y + 20 * (contact?.t ?? 1);
    if (
      segmentBox(
        p,
        { x: p.x, y: nextY },
        { x: player.x - 13 - halfWidth, y: player.y - 18 - half },
        { x: player.x + 13 + halfWidth, y: player.y + 18 + half },
      )
    ) {
      g.damagePlayer(30, p);
      if (g.mode !== 'playing') return;
    }
    if (contact || e.timer <= 0) {
      if (contact) Body.setPosition(e.body, { x: p.x, y: nextY - 0.05 });
      Body.setVelocity(e.body, { x: 0, y: 0 });
      e.state = 'recover';
      e.timer = 0.8;
      e.attacks++;
      g.burst({ x: p.x, y: p.y + half }, 24, '#ffcb90', 5);
      g.feedback(6);
      g.onSound('slam');
      const prop = contact && g.props.items.find((prop) => prop.body === contact.body);
      if (prop) g.props.strike(prop, 144, { x: 0, y: 1 });
    } else Body.setVelocity(e.body, { x: 0, y: 20 });
  } else if (e.state === 'recover') {
    Body.setVelocity(e.body, { x: 0, y: 0 });
    if (e.timer <= 0) {
      e.state = 'return';
      e.timer = 2;
    }
  } else if (e.state === 'return') {
    const overhead = g.solidBodies.filter(
      (body) =>
        body.bounds.min.x < p.x + halfWidth &&
        body.bounds.max.x > p.x - halfWidth &&
        body.bounds.max.y > p.y - half - 22 &&
        body.bounds.max.y <= p.y &&
        body.bounds.min.y < p.y - half,
    );
    if (overhead.length) {
      const left = Math.min(...overhead.map((body) => body.bounds.min.x)) - halfWidth - 8,
        right = Math.max(...overhead.map((body) => body.bounds.max.x)) + halfWidth + 8;
      const exits = [left, right]
        .filter((x) => x >= halfWidth && x <= g.worldWidth - halfWidth)
        .sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x));
      if (exits.length) {
        // Getting knocked under a shelf is recoverable: slide around its edge
        // before rising, while ordinary Matter collisions keep the hull solid.
        Body.setVelocity(e.body, { x: clamp((exits[0] - p.x) * 0.15, -10, 10), y: 0 });
        return;
      }
    }
    const rise = Math.min(12, Math.max(0, p.y - 260));
    Body.setVelocity(e.body, { x: 0, y: -rise });
    if (p.y <= 263) {
      Body.setVelocity(e.body, { x: 0, y: 0 });
      e.state = 'idle';
      e.timer = 0.1;
    }
  } else {
    const hover = player.y < 220 ? clamp(player.y - 95, 90, 260) : 260,
      targetX = clamp(player.x, halfWidth, g.worldWidth - halfWidth),
      above = player.y < p.y - 30,
      covered = g.pressSurface(targetX, p.y + half) < player.y - 18,
      corner = player.x < 95 || player.x > g.worldWidth - 95,
      counter = above || covered || corner,
      spot = counter ? pressSpot(g, e, hover) : { x: targetX, y: hover };
    Body.setVelocity(e.body, {
      x: clamp((spot.x - p.x) * 0.06, -8, 8),
      y: clamp((spot.y - p.y) * 0.12, -9, 9),
    });
    if (e.timer <= 0) {
      if (counter && visible(g, bossMuzzle(e))) beginFlak(g, e);
      else if (!counter && Math.abs(targetX - p.x) < 180 && Math.abs(p.y - 260) < 35) {
        e.attack = 'aimed';
        e.target = { x: targetX, y: g.pressSurface(targetX, p.y + half) };
        e.state = 'windup';
        e.timer = PRESS_TELL;
        g.onSound('lock');
      }
    }
  }
}
