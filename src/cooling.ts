import Matter from 'matter-js';
import type { Enemy, Game } from './game.ts';
import { bossHasLane, huntBoss } from './boss-hunt.ts';
import { bossPhase } from './enemies.ts';
import { clamp, direction } from './rules.ts';

export const SKIMMER_TELL = 0.82;
export const COOLING_LOCK = 0.34;
export const CONDENSER_FOLLOWUP = 0.72;
export const CONDENSER_RECOVER = 0.9;
export const CONDENSER_PURGE_FOLLOWUP = 0.95;

export function onCoolant(g: Game) {
  const p = g.player;
  return (
    g.grounded &&
    (g.level.coolant ?? []).some(
      (pool) =>
        p.position.x > pool.x &&
        p.position.x < pool.x + pool.w &&
        p.bounds.max.y >= pool.y &&
        p.bounds.max.y <= pool.y + pool.h + 6,
    )
  );
}

export function coolingAngles(e: Enemy): number[] {
  const aim = Math.atan2(e.aim.y, e.aim.x);
  if (e.attack === 'ring') {
    // Four wide, rotating gaps are safe passages through the purge.
    return Array.from({ length: 16 }, (_, i) => aim + (i * Math.PI) / 8 + Math.PI / 16).filter(
      (_, i) => i % 4 !== 0,
    );
  }
  const count = e.kind === 'skimmer' ? 3 : e.phase >= 1 ? 5 : 3;
  return Array.from(
    { length: count },
    (_, i) => aim + (i - (count - 1) / 2) * (e.kind === 'skimmer' ? 0.11 : 0.18),
  );
}

export function updateCoolingEnemy(g: Game, e: Enemy) {
  const boss = e.kind === 'condenser';
  Matter.Body.applyForce(e.body, e.body.position, { x: 0, y: -e.body.mass * 0.001 });
  if (boss && bossPhase(e.hp, e.maxHp) > e.phase) {
    e.phase = bossPhase(e.hp, e.maxHp);
    e.state = 'transition';
    e.timer = 0.75;
    e.attacks = 0;
    g.feedback(3);
    g.onSound('phase');
  }
  if (['windup', 'followup', 'transition'].includes(e.state)) {
    Matter.Body.setVelocity(e.body, { x: e.body.velocity.x * 0.55, y: e.body.velocity.y * 0.55 });
  } else huntBoss(g, e);
  if (e.state === 'transition') {
    if (e.timer <= 0) {
      e.state = 'idle';
      e.timer = 0.3;
    }
    return;
  }
  if (e.state === 'windup' || e.state === 'followup') {
    const second = e.state === 'followup';
    if (e.timer > COOLING_LOCK && e.attack !== 'ring')
      e.aim = direction(e.body.position, g.player.position);
    if (e.timer > 0) return;
    for (const angle of coolingAngles(e))
      g.enemyShot(
        e,
        angle,
        e.attack === 'ring' ? 7.8 : g.stage >= 12 ? 11.6 : 10.2,
        boss ? 21 : g.stage >= 12 ? 20 : 18,
      );
    g.onSound(e.attack === 'ring' ? 'pulse' : 'cooling-shot');
    if (boss && !second) {
      e.state = 'followup';
      e.timer = e.attack === 'ring' ? CONDENSER_PURGE_FOLLOWUP : CONDENSER_FOLLOWUP;
      if (e.attack === 'ring') {
        // The second purge fills the old gaps, with its own complete warning.
        const angle = Math.atan2(e.aim.y, e.aim.x) + Math.PI / 4;
        e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
      } else e.aim = direction(e.body.position, g.player.position);
      g.onSound('lock');
    } else {
      e.attacks++;
      e.state = 'recover';
      e.timer = boss ? CONDENSER_RECOVER : g.stage >= 12 ? 1.05 : 1.4;
    }
  } else if (e.timer <= 0 && bossHasLane(g, e)) {
    e.attack = boss && e.attacks % 2 === 1 ? 'ring' : 'aimed';
    e.aim =
      e.attack === 'ring'
        ? { x: Math.cos(e.attacks * 0.67), y: Math.sin(e.attacks * 0.67) }
        : direction(e.body.position, g.player.position);
    e.state = 'windup';
    e.timer = boss ? (e.attack === 'ring' ? 1.1 : 0.95) : SKIMMER_TELL;
    g.onSound('lock');
  }
}

export function drawCoolant(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const pool of g.level.coolant ?? []) {
    c.fillStyle = '#386764';
    c.fillRect(pool.x, pool.y, pool.w, pool.h);
    c.strokeStyle = '#8ab7a8';
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= pool.w; x += 8) {
      const y = pool.y + (reduced ? 0 : Math.sin(x * 0.055 + g.time * 2) * 1.2);
      if (x === 0) c.moveTo(pool.x + x, y);
      else c.lineTo(pool.x + x, y);
    }
    c.stroke();
    c.fillStyle = '#233e41';
    c.fillRect(pool.x - 5, pool.y - 3, 5, pool.h + 3);
    c.fillRect(pool.x + pool.w, pool.y - 3, 5, pool.h + 3);
    c.fillStyle = '#5b8880';
    for (let x = pool.x + 24; x < pool.x + pool.w - 20; x += 63) c.fillRect(x, pool.y + 5, 18, 1);
  }
}

export function drawCoolingEnemy(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const boss = e.kind === 'condenser',
    r = boss ? 33 : 14,
    p = e.body.position;
  const warning = e.state === 'windup' || e.state === 'followup';
  c.save();
  c.translate(p.x, p.y);
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.fillStyle = e.flash > 0 ? '#fff2d7' : '#223c40';
  c.strokeStyle = e.flash > 0 ? '#fff2d7' : '#da9d79';
  c.lineWidth = boss ? 3 : 2;
  c.beginPath();
  c.roundRect(boss ? -45 : -19, boss ? -38 : -19, boss ? 90 : 38, boss ? 76 : 38, boss ? 12 : 8);
  c.fill();
  c.stroke();
  c.strokeStyle = '#557f7c';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.stroke();
  c.save();
  c.rotate(reduced ? 0 : g.time * (warning ? 3 : 1.2) * (boss ? 1 : -1));
  c.fillStyle = boss && e.state === 'recover' ? '#f7d9a0' : '#799b8e';
  for (let i = 0; i < 4; i++) {
    c.rotate(Math.PI / 2);
    c.beginPath();
    c.moveTo(5, 3);
    c.lineTo(r - 5, 5);
    c.lineTo(r - 10, 13);
    c.lineTo(2, 7);
    c.closePath();
    c.fill();
  }
  c.restore();
  for (const side of [-1, 1]) {
    c.fillStyle = warning ? '#f4ca92' : '#a57257';
    c.fillRect(side * (boss ? 35 : 14) - 3, boss ? -27 : -11, 6, boss ? 54 : 22);
  }
  if (boss)
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i <= e.phase ? '#efd2a1' : '#456464';
      c.fillRect(-14 + i * 11, -33, 6, 3);
    }
  c.fillStyle = '#f2c894';
  c.fillRect(e.aim.x * (boss ? 35 : 16) - 3, e.aim.y * (boss ? 28 : 13) - 3, 6, 6);
  if (e.hp < e.maxHp) {
    c.fillStyle = '#493c35';
    c.fillRect(-r, -(boss ? 50 : 28), r * 2, 3);
    c.fillStyle = '#e5a985';
    c.fillRect(-r, -(boss ? 50 : 28), (r * 2 * e.hp) / e.maxHp, 3);
  }
  c.restore();
  if (warning && e.spawn <= 0) {
    c.save();
    c.strokeStyle = '#ebc28c';
    c.lineWidth = e.timer <= COOLING_LOCK ? 1.8 : 1;
    c.globalAlpha = e.timer <= COOLING_LOCK ? 0.65 : 0.28;
    c.setLineDash(e.timer <= COOLING_LOCK ? [] : [6, 10]);
    for (const angle of coolingAngles(e)) {
      const end = g.lineEnd(p, {
        x: p.x + Math.cos(angle) * (e.attack === 'ring' ? 330 : 800),
        y: p.y + Math.sin(angle) * (e.attack === 'ring' ? 330 : 800),
      });
      if (Math.hypot(end.x - p.x, end.y - p.y) < (boss ? 55 : 26)) continue;
      c.beginPath();
      c.moveTo(p.x + Math.cos(angle) * (boss ? 55 : 26), p.y + Math.sin(angle) * (boss ? 55 : 26));
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.restore();
  }
}
