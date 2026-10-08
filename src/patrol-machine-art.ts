import type { Enemy, Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { enemyShielded } from './enemies.ts';
import {
  machineAngles,
  machineTell,
  mortarPoint,
  mortarImpact,
  type MortarArc,
} from './patrol-machine-system.ts';

const line = (c: CanvasRenderingContext2D, a: Vec, b: Vec) => {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
};
function landing(
  c: CanvasRenderingContext2D,
  g: Game,
  arc: MortarArc,
  start: number,
  locked: boolean,
) {
  const p = mortarImpact(g, arc, start);
  c.strokeStyle = locked ? '#f8d092' : '#aa8262';
  c.lineWidth = locked ? 2 : 1.5;
  c.setLineDash(locked ? [] : [5, 7]);
  // Use the same cover visibility as damage, including destructible crates.
  c.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i * Math.PI) / 24;
    const end = g.lineEnd(p, {
      x: p.x + Math.cos(a) * arc.radius,
      y: p.y + Math.sin(a) * arc.radius,
    });
    if (!i) c.moveTo(end.x, end.y);
    else c.lineTo(end.x, end.y);
  }
  c.closePath();
  c.stroke();
  c.setLineDash([]);
  line(c, { x: p.x - 6, y: p.y }, { x: p.x + 6, y: p.y });
  line(c, { x: p.x, y: p.y - 6 }, { x: p.x, y: p.y + 6 });
  c.fillStyle = '#cda571';
  for (let i = 1; i < 20; i++) {
    const q = mortarPoint(arc, start + ((1 - start) * i) / 20);
    // Stop the dotted path at the actual predicted impact.
    if (Math.abs(q.x - arc.from.x) > Math.abs(p.x - arc.from.x) + 1) break;
    c.fillRect(q.x - 1, q.y - 1, 2, 2);
  }
}
export function drawPatrolTell(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  if (e.spawn > 0 || !e.patrol || !['windup', 'followup'].includes(e.state)) return;
  c.save();
  const locked = e.timer <= 0.4,
    p = e.body.position;
  if (e.kind === 'mortar') {
    for (const arc of e.patrol.arcs) landing(c, g, arc, 0, locked);
  } else {
    c.strokeStyle = locked ? '#ffdb9b' : '#a57758';
    c.lineWidth = locked ? 1.8 : 1;
    c.setLineDash(locked ? [] : [6, 9]);
    for (const a of machineAngles(e)) {
      const to = g.lineEnd(p, { x: p.x + Math.cos(a) * 1150, y: p.y + Math.sin(a) * 1150 });
      line(c, p, to);
    }
    c.setLineDash([]);
  }
  c.fillStyle = '#f8d092';
  c.fillRect(p.x - 16, p.y - 32, 32 * clamp(1 - e.timer / machineTell(e), 0, 1), 2);
  c.restore();
}
export function drawPatrolMachine(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  portrait = false,
) {
  const p = e.body.position,
    v = e.patrol?.variant;
  const metal = e.flash > 0 ? '#fff3d0' : '#4b5555';
  const color = e.kind === 'shutter' ? '#d79f7b' : e.kind === 'strider' ? '#d3ba82' : '#b3c8a6';
  c.save();
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  c.scale(e.facing, 1);
  c.fillStyle = '#18272c';
  c.strokeStyle = '#84908c';
  c.lineWidth = 2;
  if (e.kind === 'shutter') {
    c.fillRect(-17, -19, 33, 33);
    c.strokeRect(-17, -19, 33, 33);
    c.fillStyle = metal;
    c.fillRect(-18, 14, 13, 6);
    c.fillRect(4, 14, 14, 6);
    c.fillStyle = color;
    c.fillRect(-8, -11, 15, 18);
    c.fillStyle = '#e4dfb9';
    c.fillRect(-4, -8, 8, 4);
    const closed = enemyShielded(e, { x: -e.facing, y: 0 });
    c.fillStyle = e.shieldFlash > 0 ? '#fff0b5' : '#707e7b';
    if (closed) {
      c.fillRect(10, -20, 8, 35);
      c.strokeStyle = color;
      for (let y = -16; y < 14; y += 7) line(c, { x: 12, y }, { x: 17, y: y + 3 });
    } else {
      c.fillRect(10, -22, 8, 7);
      c.fillRect(10, 11, 8, 5);
    }
    c.fillStyle = metal;
    const tubes = v === 'shutter-fan' ? 3 : v === 'shutter-burst' ? 2 : 1;
    for (let i = 0; i < tubes; i++) c.fillRect(8, -6 + i * 5 - (tubes - 1) * 2.5, 15, 3);
  } else if (e.kind === 'strider') {
    c.fillStyle = metal;
    c.fillRect(-13, -18, 27, 24);
    c.strokeRect(-13, -18, 27, 24);
    c.fillStyle = color;
    c.fillRect(-8, -13, 15, 4);
    c.fillStyle = '#18272c';
    c.fillRect(-8, -4, 16, 6);
    c.strokeStyle = '#a4aaa0';
    c.lineWidth = 4;
    const braced = e.state !== 'idle';
    for (const side of [-1, 1]) {
      const step = braced ? 0 : Math.sin(g.time * 7 + ((side + 1) * Math.PI) / 2) * 3;
      line(c, { x: side * 7, y: 5 }, { x: side * (braced ? 15 : 12), y: 15 + step });
      line(
        c,
        { x: side * (braced ? 15 : 12) - 4, y: 17 },
        { x: side * (braced ? 15 : 12) + 4, y: 17 },
      );
    }
    c.fillStyle = metal;
    const tubes = v === 'strider-volley' ? 3 : v === 'strider-survey' ? 1 : 2;
    for (let i = 0; i < tubes; i++) c.fillRect(8, -6 + i * 4, v === 'strider-survey' ? 24 : 15, 3);
    if (v === 'strider-survey') {
      c.fillStyle = color;
      c.fillRect(8, -13, 13, 3);
    }
  } else {
    c.fillStyle = metal;
    c.fillRect(-20, -6, 40, 17);
    c.strokeRect(-20, -6, 40, 17);
    c.fillStyle = '#18272c';
    c.strokeStyle = '#869a8b';
    for (const x of [-13, 13]) {
      c.beginPath();
      c.arc(x, 12, 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.fillStyle = color;
    c.fillRect(-8, 0, 16, 4);
    c.save();
    c.rotate(-0.85);
    c.fillStyle = metal;
    const tubes = v === 'mortar-twin' ? 2 : 1;
    for (let i = 0; i < tubes; i++) {
      c.fillRect(-4, -10 + i * 8, v === 'mortar-slow' ? 31 : 25, 7);
      c.fillStyle = color;
      c.fillRect(17, -9 + i * 8, 3, 5);
      c.fillStyle = metal;
    }
    c.restore();
  }
  c.restore();
  if (!portrait) {
    if (e.hp < e.maxHp) {
      c.fillStyle = '#3a3934';
      c.fillRect(p.x - 17, p.y - 28, 34, 3);
      c.fillStyle = color;
      c.fillRect(p.x - 17, p.y - 28, 34 * Math.max(0, e.hp / e.maxHp), 3);
    }
  }
}
export function drawPatrolShells(c: CanvasRenderingContext2D, g: Game) {
  c.save();
  for (const s of g.patrolMachines.shells) {
    landing(c, g, s.arc, clamp(s.age / s.arc.duration, 0, 1), true);
    c.fillStyle = '#253431';
    c.strokeStyle = '#f5d099';
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      if (!i) c.moveTo(s.pos.x + Math.cos(a) * 7, s.pos.y + Math.sin(a) * 7);
      else c.lineTo(s.pos.x + Math.cos(a) * 7, s.pos.y + Math.sin(a) * 7);
    }
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#ffebbd';
    c.fillRect(s.pos.x - 2, s.pos.y - 2, 4, 4);
  }
  for (const b of g.patrolMachines.blasts) {
    c.globalAlpha = clamp((b.until - g.time) / 0.2, 0, 1);
    c.strokeStyle = '#e9bd85';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
export function drawSurveyMarks(c: CanvasRenderingContext2D, g: Game) {
  c.save();
  c.strokeStyle = '#b9d9bd';
  c.lineWidth = 1.5;
  for (const e of g.enemies) {
    if ((g.toolroom.marks.get(e.id)?.until ?? 0) <= g.time) continue;
    const p = e.body.position,
      w = (e.body.bounds.max.x - e.body.bounds.min.x) / 2 + 5;
    for (const side of [-1, 1]) {
      line(c, { x: p.x + side * w, y: p.y - 9 }, { x: p.x + side * w, y: p.y + 9 });
      line(c, { x: p.x + side * w, y: p.y - 9 }, { x: p.x + side * (w - 4), y: p.y - 9 });
    }
  }
  c.restore();
}
