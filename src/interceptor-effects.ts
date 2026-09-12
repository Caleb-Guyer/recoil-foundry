import { grindPlanValid } from './interceptor-grindshot.ts';
import type { Enemy, Game, Shot } from './game.ts';
import { firstSolid } from './collisions.ts';
import { distance, clamp } from './rules.ts';
import type { Vec } from './rules.ts';
import { INTERCEPTOR_WEAPONS, weaponAngles } from './interceptor-weapons.ts';
import { interceptorAngles, interceptorOrigin } from './interceptor.ts';

export function rivalWarningLanes(g: Game, e: Enemy): { from: Vec; to: Vec; bank: boolean }[] {
  const rig = e.interceptor!,
    lanes: { from: Vec; to: Vec; bank: boolean }[] = [];
  const origin =
    rig.move === 'shockwave' && e.attack !== 'vault'
      ? { x: e.target.x, y: e.target.y - 32 }
      : interceptorOrigin(e);
  const angles =
    rig.move === 'grindshot' && e.attack !== 'vault'
      ? [
          ...rig.grindPlans.filter((p) => grindPlanValid(g, p)).map((p) => p.heading),
          ...rig.grindBullets,
        ]
      : interceptorAngles(e);
  for (const a of angles) {
    let d = { x: Math.cos(a), y: Math.sin(a) },
      from = { x: origin.x + d.x * 44, y: origin.y + d.y * 44 };
    if (distance(g.lineEnd(origin, from, 5), from) > 0.1) continue;
    for (let n = 0; n < (rig.move === 'ricochet' && e.attack !== 'vault' ? 2 : 1); n++) {
      const end = { x: from.x + d.x * 1050, y: from.y + d.y * 1050 };
      const hit = firstSolid(from, end, { x: 5, y: 5 }, g.solidBodies);
      const to = hit
        ? { x: from.x + (end.x - from.x) * hit.t, y: from.y + (end.y - from.y) * hit.t }
        : end;
      lanes.push({ from, to, bank: n > 0 });
      if (!hit) break;
      const dot = d.x * hit.normal.x + d.y * hit.normal.y;
      d = { x: d.x - 2 * dot * hit.normal.x, y: d.y - 2 * dot * hit.normal.y };
      from = { x: to.x + hit.normal.x, y: to.y + hit.normal.y };
    }
  }
  return lanes;
}
export function drawRivalEffects(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const rig = e.interceptor!;
  c.save();
  for (const charge of rig.charges) {
    const progress = clamp(1 - charge.left / charge.duration, 0, 1);
    c.strokeStyle = '#e8c16c';
    c.fillStyle = '#e8c16c';
    c.globalAlpha = 0.055 + progress * 0.055;
    c.beginPath();
    c.arc(charge.pos.x, charge.pos.y, charge.radius, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 0.6;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(charge.pos.x, charge.pos.y, charge.radius, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.arc(charge.pos.x, charge.pos.y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    c.stroke();
    c.fillRect(charge.pos.x - 3, charge.pos.y - 3, 6, 6);
  }
  for (const echo of rig.echoes) {
    c.strokeStyle = '#c7b2e0';
    c.lineWidth = 1.5;
    c.globalAlpha = 0.35;
    c.strokeRect(echo.origin.x - 15, echo.origin.y - 22, 30, 44);
    c.beginPath();
    c.arc(echo.origin.x, echo.origin.y, 32, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash(echo.left > 0.45 ? [4, 7] : []);
    for (const a of weaponAngles('afterimage', echo.aim, e.phase)) {
      const end = g.lineEnd(
        echo.origin,
        { x: echo.origin.x + Math.cos(a) * 1000, y: echo.origin.y + Math.sin(a) * 1000 },
        5,
      );
      c.beginPath();
      c.moveTo(echo.origin.x, echo.origin.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.setLineDash([]);
  }
  if (rig.gate) {
    for (const [i, p] of [rig.gate.entry, rig.gate.exit].entries()) {
      c.strokeStyle = i ? '#e9b57b' : '#92d5e5';
      c.lineWidth = 2.5;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.ellipse(p.x, p.y, 35, 45, 0, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.15;
      c.beginPath();
      c.ellipse(p.x, p.y, 29, 39, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }
  if (e.state === 'windup' && rig.move === 'countershot' && e.attack !== 'vault') {
    c.strokeStyle = '#a9e0ce';
    c.lineWidth = 2;
    c.globalAlpha = e.timer > 0.5 ? 0.75 : 0.25;
    c.beginPath();
    c.arc(e.body.position.x, e.body.position.y, 86, 0, Math.PI * 2);
    c.stroke();
    for (let n = 0; n < 3; n++) {
      c.fillStyle = n < rig.caught ? '#d7ffed' : '#465e55';
      c.fillRect(e.body.position.x - 12 + n * 9, e.body.position.y - 49, 6, 4);
    }
  }
  c.restore();
}
export function drawRivalShot(c: CanvasRenderingContext2D, s: Shot) {
  const ammo = s.enemyAmmo!,
    color = INTERCEPTOR_WEAPONS[ammo.kind].color;
  c.save();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.fillStyle = '#ffcdb4';
  c.beginPath();
  c.arc(s.pos.x, s.pos.y, s.radius + 1, 0, Math.PI * 2);
  c.stroke();
  c.fillRect(s.pos.x - 1.5, s.pos.y - 1.5, 3, 3);
  if (ammo.kind === 'recall') {
    const a = Math.atan2((ammo.reverse ?? s.vel).y, (ammo.reverse ?? s.vel).x);
    c.translate(s.pos.x, s.pos.y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(-10, -4);
    c.lineTo(-5, 0);
    c.lineTo(-10, 4);
    c.stroke();
    if (ammo.reverse && !ammo.returning) {
      c.beginPath();
      c.arc(
        0,
        0,
        13,
        -Math.PI / 2,
        -Math.PI / 2 + clamp((ammo.age - 0.7) / 0.4, 0, 1) * Math.PI * 2,
      );
      c.stroke();
    }
  } else if (ammo.kind === 'shatter') {
    const a = Math.atan2(s.vel.y, s.vel.x);
    c.globalAlpha = 0.45;
    for (let n = -2; n <= 2; n++) {
      c.beginPath();
      c.moveTo(s.pos.x + Math.cos(a + n * 0.26) * 12, s.pos.y + Math.sin(a + n * 0.26) * 12);
      c.lineTo(s.pos.x + Math.cos(a + n * 0.26) * 35, s.pos.y + Math.sin(a + n * 0.26) * 35);
      c.stroke();
    }
  } else if (ammo.kind === 'fuse') {
    c.strokeRect(s.pos.x - 4, s.pos.y - 4, 8, 8);
  } else if (ammo.kind === 'capacitor' || ammo.kind === 'precision') {
    c.beginPath();
    c.moveTo(s.prev.x, s.prev.y);
    c.lineTo(s.pos.x, s.pos.y);
    c.stroke();
  }
  c.restore();
}
