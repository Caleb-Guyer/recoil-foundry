import type { Enemy, Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { machineBodySnapshot } from './machine-breakdown-pose.ts';
import { drawMachineContacts } from './machine-breakdown-art.ts';
import { drawHeavyChassis } from './heavy-machine-art.ts';
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
  reduced = false,
) {
  const snapshot = machineBodySnapshot(e, g.time, g);
  if (!snapshot) return;
  const p = e.body.position,
    color = e.allied
      ? '#79b9e0'
      : e.kind === 'shutter'
        ? '#d79f7b'
        : e.kind === 'strider'
          ? '#d3ba82'
          : '#b3c8a6';
  c.save();
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  if (snapshot.scale !== 1) c.scale(snapshot.scale, snapshot.scale);
  drawHeavyChassis(c, snapshot, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  c.restore();
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#3a3934';
    c.fillRect(p.x - 17, p.y - 28, 34, 3);
    c.fillStyle = color;
    c.fillRect(p.x - 17, p.y - 28, 34 * Math.max(0, e.hp / e.maxHp), 3);
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
