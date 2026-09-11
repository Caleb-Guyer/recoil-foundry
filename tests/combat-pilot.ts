import type { Enemy, Game, Input } from '../src/game.ts';
import { attackAngles, bossMuzzle, flakAngles } from '../src/enemies.ts';
import { coolingAngles } from '../src/cooling.ts';
import { turbineRelease } from '../src/turbine.ts';
import { interceptorAngles, interceptorSpeed, interceptorOrigin } from '../src/interceptor.ts';
import { weaponAngles } from '../src/interceptor-weapons.ts';
import { sorterFan } from '../src/reclamation.ts';
import { areaIndex, clamp, distance, direction } from '../src/rules.ts';

// Test-only player: compare short movement trajectories with visible bolts and
// locked warnings. It sends ordinary inputs; it never changes health, enemies,
// shots, upgrades, or the simulation. Approximate terrain/recoil prediction is
// deliberately independent from Matter's collision solver.
export function dodgePilot(g: Game, e: Enemy): Partial<Input> {
  const p = g.player.position,
    target = e.body.position;
  const boxes = g.solidBodies.map((b) => ({
    left: Math.min(...b.vertices.map((v) => v.x)),
    right: Math.max(...b.vertices.map((v) => v.x)),
    top: Math.min(...b.vertices.map((v) => v.y)),
    bottom: Math.max(...b.vertices.map((v) => v.y)),
  }));
  const bolts = g.shots
    .filter((s) => !s.friendly)
    .map((s) => ({
      p: s.pos,
      v: s.vel,
      delay: 0,
      radius: s.radius,
      life: Math.min(
        s.life * 60,
        distance(
          s.pos,
          g.lineEnd(s.pos, { x: s.pos.x + s.vel.x * 120, y: s.pos.y + s.vel.y * 120 }),
        ) / Math.hypot(s.vel.x, s.vel.y),
      ),
    }));
  // Multiple enemies can commit together. Read all ordinary locked warnings,
  // including the Loader's marked anti-air fan, before choosing a trajectory.
  for (const enemy of g.enemies) {
    if (enemy.spawn > 0 || enemy.squad || enemy.elite === 'volatile') continue;
    const flak = enemy.attack === 'flak' && enemy.state === 'windup' && enemy.timer <= 0.38;
    const ordinary = ['shooter', 'flyer'].includes(enemy.kind) && enemy.timer <= 0.35;
    const sniper =
      enemy.kind === 'sniper' && !enemy.elite && enemy.state === 'windup' && enemy.timer <= 0.35;
    if (!flak && !ordinary && !sniper) continue;
    const origin = flak ? bossMuzzle(enemy) : enemy.body.position;
    const base = Math.atan2(enemy.aim.y, enemy.aim.x);
    const angles = flak
      ? flakAngles(base, enemy.phase === 1)
      : enemy.kind === 'flyer'
        ? [-1, 0, 1].map((i) => base + i * 0.18)
        : [base];
    const speed = flak ? 10 : sniper ? 18 : [8, 8.9, 9.7, 9.6, 11.2][areaIndex(g.stage)];
    for (const a of angles) {
      const muzzle = sniper ? 38 : 26;
      const start = { x: origin.x + Math.cos(a) * muzzle, y: origin.y + Math.sin(a) * muzzle };
      if (distance(g.lineEnd(origin, start), start) > 0.1) continue;
      const v = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      bolts.push({
        p: start,
        v,
        delay: Math.max(0, enemy.timer) * 60,
        radius: 5,
        life:
          distance(start, g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 })) /
          speed,
      });
    }
  }
  if (
    ['sorter', 'borer', 'sifter'].includes(e.kind) &&
    e.state === 'windup' &&
    e.attack !== 'slam' &&
    e.timer <= 0.5
  ) {
    const base = Math.atan2(e.aim.y, e.aim.x);
    const spread = e.kind === 'sifter' ? 0.22 : 0.045;
    const speed = e.kind === 'sorter' ? 10.8 : e.kind === 'sifter' ? 9 : 13;
    for (const a of e.kind === 'sorter' ? sorterFan(e) : [-1, 0, 1].map((i) => base + i * spread)) {
      const start = { x: target.x + Math.cos(a) * 26, y: target.y + Math.sin(a) * 26 };
      const v = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      bolts.push({
        p: start,
        v,
        radius: 5,
        delay: e.timer * 60,
        life:
          distance(start, g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 })) /
          speed,
      });
    }
  } else if (e.kind === 'interceptor' && (e.state === 'windup' || e.state === 'followup')) {
    for (const a of interceptorAngles(e)) {
      const origin = interceptorOrigin(e);
      const start = { x: origin.x + Math.cos(a) * 44, y: origin.y + Math.sin(a) * 44 };
      const speed = interceptorSpeed(e);
      const v = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      bolts.push({
        p: start,
        v,
        radius: 5,
        delay: e.timer * 60,
        life:
          distance(start, g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 }, 5)) /
          speed,
      });
    }
  } else if (e.kind === 'turbine' && e.turbine && (e.state === 'windup' || e.state === 'rush')) {
    const rig = e.turbine;
    for (
      let index = e.state === 'rush' ? rig.sent : 0;
      index < rig.angles.length * (e.attack === 'gust' ? 2 : 1);
      index++
    ) {
      const next = index % rig.angles.length;
      const a = rig.angles[e.phase === 2 ? rig.angles.length - 1 - next : next];
      const start = { x: rig.origin.x + Math.cos(a) * 62, y: rig.origin.y + Math.sin(a) * 62 };
      const speed = 9.6 + e.phase * 0.5;
      const v = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      bolts.push({
        p: start,
        v,
        radius: 11,
        delay:
          ((e.state === 'windup' ? e.timer : -rig.active) +
            turbineRelease(e.attack === 'gust', index, rig.angles.length)) *
          60,
        life:
          distance(
            start,
            g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 }, 11),
          ) / speed,
      });
    }
  } else if (
    e.kind !== 'sorter' &&
    (e.state === 'windup' || e.state === 'followup') &&
    e.timer <= 0.35
  ) {
    const angles =
      e.kind === 'boss' ? attackAngles(e.attack, Math.atan2(e.aim.y, e.aim.x)) : coolingAngles(e);
    for (const a of angles) {
      const start = { x: target.x + Math.cos(a) * 55, y: target.y + Math.sin(a) * 55 };
      const speed = e.attack === 'ring' ? 7.8 : e.kind === 'boss' ? 11.2 : 10.2;
      const v = { x: Math.cos(a) * speed, y: Math.sin(a) * speed };
      bolts.push({
        p: start,
        v,
        delay: e.timer * 60,
        radius: 5,
        life:
          distance(start, g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 })) /
          speed,
      });
    }
  }
  // Ghost guns and planted charges have their own visible commitments, even
  // while the real gunner is recovering or moving to a new firing position.
  for (const echo of e.interceptor?.echoes ?? []) {
    if (echo.left > 0.45) continue;
    for (const a of weaponAngles('afterimage', echo.aim, e.phase)) {
      const start = { x: echo.origin.x + Math.cos(a) * 44, y: echo.origin.y + Math.sin(a) * 44 };
      const v = { x: Math.cos(a) * 11, y: Math.sin(a) * 11 };
      bolts.push({
        p: start,
        v,
        radius: 5,
        delay: echo.left * 60,
        life:
          distance(start, g.lineEnd(start, { x: start.x + v.x * 120, y: start.y + v.y * 120 }, 5)) /
          11,
      });
    }
  }
  let best = Infinity,
    result: Partial<Input> = {};
  for (const move of [-1, 0, 1])
    for (const jump of g.grounded ? [false, true] : [false])
      for (const fire of [true, false])
        for (const lift of fire &&
        (e.kind === 'sorter' ||
          e.kind === 'boss' ||
          e.kind === 'turbine' ||
          e.kind === 'interceptor')
          ? [false, true]
          : [false]) {
          let x = p.x,
            y = p.y,
            vx = g.player.velocity.x,
            vy = g.player.velocity.y,
            ground = g.grounded;
          let score = 0,
            shootAt = g.shootAt,
            burst = g.burstRemaining,
            burstAt = g.burstAt,
            charged = g.gun.landing && g.landingReady;
          // Lead visible motion; aiming at the current position wastes slow
          // shells while a floating boss or recoil gunner is moving away.
          const flight = distance(p, target) / g.gun.projectileSpeed;
          const travel =
            e.kind === 'interceptor' && (e.state === 'airborne' || e.state === 'recover')
              ? (1 -
                  Math.pow(e.state === 'recover' ? 0.9118 : 0.97, Math.min(flight, e.timer * 60))) /
                (e.state === 'recover' ? 0.0882 : 0.03)
              : e.kind === 'boss' && e.state !== 'windup' && e.state !== 'followup'
                ? Math.min(12, flight)
                : 0;
          const aim = lift
            ? { x: p.x, y: p.y + 500 }
            : {
                x: target.x + e.body.velocity.x * travel,
                y: target.y + e.body.velocity.y * travel,
              };
          // Slow explosive volleys need enough look-ahead to include their
          // recoil landing, rather than choosing a safe first half of a jump.
          const horizon = e.kind === 'boss' && g.gun.shellshock ? 60 : 40;
          for (let frame = 1; frame <= horizon; frame++) {
            const time = g.time + frame / 60,
              ox = x,
              oy = y;
            if (move && (Math.sign(vx) !== move || Math.abs(vx) < 7.3 * g.gun.speed))
              vx += move * (ground ? 1.05 : 0.42) * g.gun.speed;
            if (ground && !move) vx *= 0.72;
            vx = clamp(vx, -23, 23);
            vy = clamp(vy, -21, 20);
            if (frame === 1 && jump && ground) {
              vy = -11.6;
              ground = false;
            }
            let shot = false;
            if (burst > 0 && time >= burstAt) {
              burst--;
              burstAt = time + g.gun.interval * 0.3;
              shot = true;
            } else if (fire && time >= shootAt && burst === 0) {
              shootAt = time + g.gun.interval * (g.gun.burstCount === 3 ? 3.1 : 1);
              burst = g.gun.burstCount - 1;
              burstAt = time + g.gun.interval * 0.3;
              shot = true;
            }
            if (shot) {
              const d = direction({ x, y }, aim),
                force = g.gun.recoil * (ground ? 0.21 : 1) * (charged ? 1.25 : 1);
              charged = false;
              vx = clamp(vx - d.x * force, -23, 23);
              vy = clamp(vy - d.y * force, -21, 20);
            }
            vx *= 0.992;
            vy = vy * 0.992 + 1000 / 3600;
            if (
              e.kind === 'turbine' &&
              e.attack === 'gust' &&
              e.turbine &&
              (e.state === 'rush' || (e.state === 'windup' && frame / 60 > e.timer))
            ) {
              const origin = e.turbine.origin;
              const along = (x - origin.x) * e.aim.x + (y - origin.y) * e.aim.y;
              const across = Math.abs((x - origin.x) * e.aim.y - (y - origin.y) * e.aim.x);
              if (
                along > 50 &&
                along < 850 &&
                across < 48 + along * 0.14 &&
                distance(g.lineEnd(origin, { x, y }), { x, y }) < 1
              ) {
                vx += e.aim.x * (ground ? 0.18 : 0.62);
                vy += e.aim.y * (ground ? 0.18 : 0.62);
              }
            }
            x += vx;
            for (const b of boxes)
              if (y + 17 > b.top && y - 17 < b.bottom && x + 13 > b.left && x - 13 < b.right) {
                if (ox + 13 <= b.left + 0.1) {
                  x = b.left - 13;
                  vx = 0;
                } else if (ox - 13 >= b.right - 0.1) {
                  x = b.right + 13;
                  vx = 0;
                }
              }
            y += vy;
            ground = false;
            for (const b of boxes)
              if (x + 12 > b.left && x - 12 < b.right && y + 18 > b.top && y - 18 < b.bottom) {
                if (oy + 18 <= b.top + 0.2) {
                  y = b.top - 18;
                  if (g.gun.landing && vy >= 7) charged = true;
                  vy = 0;
                  ground = true;
                } else if (oy - 18 >= b.bottom - 0.2) {
                  y = b.bottom + 18;
                  vy = 0;
                }
              }
            for (const b of bolts) {
              const t = frame - b.delay;
              if (t < 0 || t > b.life) continue;
              const dx = Math.abs(b.p.x + b.v.x * t - x),
                dy = Math.abs(b.p.y + b.v.y * t - y);
              if (dx < 20 + b.radius && dy < 26 + b.radius) score += 1000 / (frame + 8);
              else if (dx < 42 && dy < 45) score += 8 / (frame + 8);
            }
            for (const charge of e.interceptor?.charges ?? [])
              if (
                Math.abs(frame / 60 - charge.left) < 0.06 &&
                distance({ x, y }, charge.pos) < charge.radius + 25 &&
                distance(g.lineEnd(charge.pos, { x, y }), { x, y }) < 1
              )
                score += 8000 / (frame + 8);
            if (e.sorter && e.state === 'windup' && e.attack === 'slam' && e.timer <= 0.75) {
              if (
                Math.abs(frame / 60 - e.timer) < 0.08 &&
                e.sorter.lanes.some((lane) => Math.abs(lane - x) < 66)
              )
                score += 8000 / (frame + 8);
            }
            for (const m of g.magnets.items)
              if (
                m.held &&
                ['hold', 'drop'].includes(m.phase) &&
                y > m.held.body.position.y &&
                Math.abs(x - m.x) < 55
              )
                score += 50 / (frame + 8);
            const ex = target.x + e.body.velocity.x * Math.min(frame, 8),
              ey = target.y + e.body.velocity.y * Math.min(frame, 8);
            if (Math.abs(x - ex) < 72 && Math.abs(y - ey) < 73) score += 2000 / (frame + 8);
            score += x < 90 || x > 1910 ? 4 : 0;
          }
          // Prefer a useful firing lane and modest spacing when trajectories are safe.
          score += Math.abs(distance({ x, y }, target) - 340) * 0.008;
          if (distance(g.lineEnd({ x, y }, target), target) > 10) score += 9;
          if (fire)
            score += lift
              ? 2
              : e.kind === 'boss' && g.gun.shellshock && distance(p, target) > 550
                ? 4
                : -6;
          if (jump) score += 0.2;
          if (score < best) {
            best = score;
            result = { left: move < 0, right: move > 0, jump, fire, aim };
          }
        }
  return result;
}
