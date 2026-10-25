import type Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { UPRISING_REMASTER } from './uprising-remaster-rules.ts';

const COLORS = {
  active: '#e8bd7d',
  complete: '#afd4b3',
  idle: '#637b80',
  case: '#90c8c8',
  body: '#17292e',
  dark: '#233c40',
} as const;
const finite = (...values: number[]) => values.every(Number.isFinite);
const unit = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
const line = (c: CanvasRenderingContext2D, a: Vec, b: Vec) => {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
};
function hull(body: Matter.Body) {
  const xs = body.vertices.map((p) => p.x),
    ys = body.vertices.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    w = Math.max(...xs) - x,
    h = Math.max(...ys) - y;
  return finite(x, y, w, h) && w > 0 && h > 0 ? { x, y, w, h } : null;
}
function check(c: CanvasRenderingContext2D, x: number, y: number) {
  line(c, { x: x - 5, y }, { x: x - 1, y: y + 4 });
  line(c, { x: x - 1, y: y + 4 }, { x: x + 7, y: y - 5 });
}
function bolt(c: CanvasRenderingContext2D, x: number, y: number) {
  c.beginPath();
  c.moveTo(x + 3, y - 11);
  c.lineTo(x - 5, y + 1);
  c.lineTo(x + 2, y + 1);
  c.lineTo(x - 2, y + 12);
  c.stroke();
}
function drawStructures(c: CanvasRenderingContext2D, g: Game) {
  const u = g.uprising,
    room = u.remaster.room;
  if (!room) return;
  for (const anchor of u.anchors) {
    const b = hull(anchor.body);
    if (!b) continue;
    c.save();
    c.strokeStyle = g.level.uprising === 'railworks' ? '#b4a17d' : '#79a7aa';
    c.lineWidth = 1.5;
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.fillStyle = COLORS.body;
    if (room.convoy) {
      for (const x of [b.x + 30, b.x + b.w - 30]) {
        c.beginPath();
        c.arc(x, b.y + b.h + 8, 8, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      // The rail follows the actual machine sweep, not an invented collision deck.
      const plan = room.solids[room.convoy.solid];
      c.globalAlpha = 0.32;
      line(
        c,
        { x: plan.x - 12, y: plan.y + plan.h + 18 },
        { x: room.convoy.toX + plan.w / 2 + 12, y: plan.y + plan.h + 18 },
      );
      c.globalAlpha = 1;
      for (let x = b.x + 18; x < b.x + b.w - 12; x += 34)
        line(c, { x, y: b.y + 5 }, { x: x + 11, y: b.y + 5 });
    } else if (room.sabotageBridge) {
      const plan = room.solids[room.sabotageBridge.solid];
      c.globalAlpha = 0.32;
      c.setLineDash([4, 8]);
      for (const x of [plan.x - 10, plan.x + plan.w + 10])
        line(c, { x, y: plan.y - 8 }, { x, y: plan.y + room.sabotageBridge.drop + plan.h + 8 });
      c.setLineDash([]);
      c.globalAlpha = 1;
      for (const x of [b.x + 15, b.x + b.w - 15]) {
        c.fillRect(x - 5, b.y + 3, 10, b.h - 6);
        c.strokeRect(x - 5, b.y + 3, 10, b.h - 6);
      }
    }
    c.restore();
  }
}
function drawObjectives(c: CanvasRenderingContext2D, g: Game) {
  const u = g.uprising,
    rig = u.remaster;
  if (u.outcome) return;
  for (const [index, p] of u.nodes.entries()) {
    const b = hull(p.body);
    if (!b) continue;
    const present = g.props.items.includes(p);
    if (!present) {
      if (p.uprising === 'relay' && p.hp <= 0) {
        c.strokeStyle = COLORS.idle;
        c.lineWidth = 2;
        line(c, { x: b.x + 8, y: b.y + b.h - 2 }, { x: b.x + b.w - 8, y: b.y + b.h - 2 });
      }
      continue;
    }
    const generator = p.uprising === 'generator';
    const complete = generator && index < rig.completedStations;
    const current = !generator || index === rig.station;
    const interlocked = p.uprising === 'prototype' && !!u.switchTarget;
    const color = complete
      ? COLORS.complete
      : !current || interlocked
        ? COLORS.idle
        : generator
          ? COLORS.active
          : COLORS.case;
    const x = b.x + b.w / 2,
      y = b.y + b.h / 2;
    c.save();
    c.fillStyle = COLORS.body;
    c.strokeStyle = color;
    c.lineWidth = current ? 2 : 1.5;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeRect(b.x, b.y, b.w, b.h);
    c.globalAlpha = current || complete ? 1 : 0.55;
    if (generator) {
      c.fillStyle = COLORS.dark;
      c.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++)
          line(
            c,
            { x: x + side * 23, y: y - 12 + i * 12 },
            { x: x + side * 33, y: y - 12 + i * 12 },
          );
      if (complete) check(c, x, y);
      else bolt(c, x, y);
      // Small station numbers explain order without covering the fight with prose.
      if (u.nodes.length > 1) {
        c.font = 'bold 10px monospace';
        c.textAlign = 'center';
        c.fillStyle = color;
        c.fillText(String(index + 1), b.x + 11, b.y + 13);
      }
      if (current && u.armedAt !== null) {
        const hold =
          u.mission === 'rail-guard'
            ? (rig.room?.convoy?.duration ?? 25)
            : (rig.spec?.holds?.[rig.station] ?? 1);
        const progress = unit((g.time - u.armedAt) / hold);
        c.fillStyle = COLORS.active;
        c.fillRect(b.x + 8, b.y + b.h - 6, (b.w - 16) * progress, 3);
      }
    } else if (p.uprising === 'relay') {
      c.strokeRect(b.x + 8, b.y + 6, b.w - 16, b.h - 12);
      bolt(c, x, y);
    } else {
      if (p.hp > 0) {
        c.strokeRect(b.x + 7, b.y + 10, b.w - 14, b.h - 18);
        line(c, { x: b.x + 8, y: y - 1 }, { x: b.x + b.w - 8, y: y - 1 });
        c.fillStyle = color;
        c.fillRect(x - 3, y - 6, 6, 10);
        if (interlocked) {
          c.strokeRect(x - 5, b.y - 8, 10, 8);
          c.beginPath();
          c.arc(x, b.y - 8, 4, Math.PI, Math.PI * 2);
          c.stroke();
        }
      } else {
        line(c, { x: b.x + 2, y: b.y + 6 }, { x: b.x + b.w - 2, y: b.y - 5 });
        c.beginPath();
        c.moveTo(x, y - 11);
        c.lineTo(x + 8, y);
        c.lineTo(x, y + 11);
        c.lineTo(x - 8, y);
        c.closePath();
        c.stroke();
      }
    }
    if (current && !complete && p.hp > 0 && finite(p.hp, p.maxHp) && p.maxHp > 0) {
      c.globalAlpha = 1;
      c.fillStyle = '#263b3f';
      c.fillRect(b.x, b.y - 7, b.w, 3);
      c.fillStyle = color;
      c.fillRect(b.x, b.y - 7, b.w * unit(p.hp / p.maxHp), 3);
    }
    c.restore();
  }
}
function drawSwitches(c: CanvasRenderingContext2D, g: Game) {
  const u = g.uprising;
  if (u.outcome) return;
  for (const [index, p] of (u.room?.switches ?? []).entries()) {
    if (!finite(p.x, p.y)) continue;
    const complete = index < u.routeStep,
      current = index === u.routeStep;
    c.save();
    c.fillStyle = COLORS.body;
    c.strokeStyle = complete ? COLORS.complete : current ? COLORS.active : COLORS.idle;
    c.lineWidth = current ? 2 : 1.5;
    c.fillRect(p.x - 16, p.y - 20, 32, 40);
    c.strokeRect(p.x - 16, p.y - 20, 32, 40);
    c.globalAlpha = current || complete ? 1 : 0.5;
    if (complete) check(c, p.x, p.y);
    else {
      line(c, { x: p.x - 6, y: p.y + 8 }, { x: p.x + 6, y: p.y - 8 });
      c.beginPath();
      c.arc(p.x + 6, p.y - 8, 3, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = c.strokeStyle;
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillText(String(index + 1), p.x, p.y - 25);
    c.restore();
  }
}
function drawExtraction(c: CanvasRenderingContext2D, g: Game) {
  const u = g.uprising,
    rig = u.remaster,
    zone = rig.extraction;
  if (!zone || u.outcome?.result === 'failed') return;
  const { x, y, w, h } = zone;
  if (!finite(x, y, w, h) || w <= 32 || h <= 0) return;
  const complete = u.outcome?.result === 'success';
  const supported = g.terrain.some((body) => {
    const b = hull(body);
    return b && Math.abs(b.y - (y + h)) < 2 && x >= b.x && x + w <= b.x + b.w;
  });
  const active = (rig.extracting && supported) || complete;
  const color = active ? COLORS.complete : COLORS.idle;
  c.save();
  c.lineWidth = active ? 2 : 1;
  c.strokeStyle = color;
  // This rectangle is the controller's exact boarding volume. The heavy lower
  // strip identifies its physical support rather than implying a floating wall.
  c.globalAlpha = active ? 0.65 : 0.22;
  c.fillStyle = active ? '#afd4b30c' : '#637b8004';
  c.fillRect(x, y, w, h);
  c.strokeRect(x, y, w, h);
  c.globalAlpha = active ? 1 : 0.5;
  c.lineWidth = 3;
  line(c, { x: x + 5, y: y + h - 2 }, { x: x + w - 5, y: y + h - 2 });
  for (const px of [x + 13, x + w - 13]) {
    line(c, { x: px - 5, y: y + h - 13 }, { x: px, y: y + h - 7 });
    line(c, { x: px, y: y + h - 7 }, { x: px + 5, y: y + h - 13 });
  }
  if (active) {
    c.globalAlpha = 1;
    c.fillStyle = color;
    c.font = 'bold 11px monospace';
    c.textAlign = 'center';
    c.fillText(
      complete
        ? 'COMPLETE'
        : u.boardingAt !== null
          ? 'BOARDING'
          : u.kind === 'sabotage'
            ? 'CROSS HERE'
            : u.kind === 'steal'
              ? 'EXTRACT'
              : 'BOARD HERE',
      x + w / 2,
      y - 9,
    );
    if (u.boardingAt !== null && !complete) {
      const progress = unit((g.time - u.boardingAt) / UPRISING_REMASTER.boarding);
      c.fillRect(x + 9, y + h - 8, (w - 18) * progress, 3);
    }
  }
  c.restore();
}

/** Deterministic world cues retain identical geometry with Reduced Effects. */
export function drawUprisingRemaster(c: CanvasRenderingContext2D, g: Game) {
  if (!g.uprising.remaster.eligible || g.mode === 'title') return;
  c.save();
  drawStructures(c, g);
  drawObjectives(c, g);
  drawSwitches(c, g);
  drawExtraction(c, g);
  c.restore();
}
