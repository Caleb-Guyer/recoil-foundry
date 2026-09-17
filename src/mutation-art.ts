import type { Enemy, Game, Shot } from './game.ts';
import { BLINK_TELL, GUNNER_TELL } from './mutations.ts';

// These marks are part of the enemy's body, not floating nameplates.
export function drawMutationBody(c: CanvasRenderingContext2D, e: Enemy) {
  const rig = e.mutation;
  if (!rig) return;
  c.save();
  if (rig.kind === 'splitter') {
    c.fillStyle = '#322b28';
    c.fillRect(-14, -14, 28, 28);
    c.strokeStyle = '#e6b884';
    c.lineWidth = 3;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 5, -18);
      c.lineTo(side * 16, -13);
      c.lineTo(side * 16, 13);
      c.lineTo(side * 5, 18);
      c.stroke();
      c.fillStyle = '#ef9675';
      c.fillRect(side * 7 - 3, -3, 6, 6);
    }
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(-3, -5);
    c.lineTo(3, 3);
    c.lineTo(0, 14);
    c.stroke();
  } else if (rig.kind === 'gunner') {
    c.fillStyle = '#413226';
    c.strokeStyle = '#e8ba77';
    c.lineWidth = 2;
    c.fillRect(-23, -14, 10, 28);
    c.strokeRect(-23, -14, 10, 28);
    c.fillStyle = rig.phase === 'tell' ? '#ffe0a0' : '#b78a53';
    c.fillRect(-21, -7, 6, 14);
    c.rotate(Math.atan2(e.aim.y, e.aim.x));
    c.strokeRect(15, -6, 17, 12);
    c.fillRect(26, -4, 5, 8);
  } else {
    c.strokeStyle = rig.phase === 'recover' ? '#efe2ff' : '#bd9fde';
    c.lineWidth = 3;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 15, -22);
      c.lineTo(side * 25, -11);
      c.lineTo(side * 25, 11);
      c.lineTo(side * 15, 22);
      c.stroke();
    }
  }
  c.restore();
}

export function drawMutationTells(c: CanvasRenderingContext2D, g: Game) {
  c.save();
  for (const e of g.enemies) {
    const rig = e.mutation,
      p = e.body.position;
    if (!rig || e.spawn > 0 || rig.phase !== 'tell') continue;
    if (rig.kind === 'blinker' && rig.destination) {
      const dest = rig.destination;
      c.strokeStyle = '#c5abe6';
      c.fillStyle = '#be9fe322';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(dest.x, dest.y, 19, 0, Math.PI * 2);
      c.fill();
      c.setLineDash([4, 5]);
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.arc(
        dest.x,
        dest.y,
        27,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - rig.timer / BLINK_TELL),
      );
      c.stroke();
      c.globalAlpha = 0.3;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(dest.x, dest.y);
      c.stroke();
      c.globalAlpha = 1;
    } else if (rig.kind === 'gunner') {
      const end = g.lineEnd(p, { x: p.x + e.aim.x * 310, y: p.y + e.aim.y * 310 });
      c.strokeStyle = '#efc58c';
      c.lineWidth = 1.5;
      c.setLineDash([5, 9]);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
      c.setLineDash([]);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(
        p.x,
        p.y,
        25,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.max(0, 1 - rig.timer / GUNNER_TELL),
      );
      c.stroke();
    }
  }
  for (const bud of g.mutations.pending) {
    c.strokeStyle = '#e6b884';
    c.lineWidth = 2;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.arc(bud.pos.x + side * 8, bud.pos.y - 5, 7, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}

export function drawMutationShell(c: CanvasRenderingContext2D, s: Shot) {
  c.save();
  c.translate(s.pos.x, s.pos.y);
  c.rotate(Math.atan2(s.vel.y, s.vel.x));
  c.beginPath();
  c.moveTo(10, 0);
  c.lineTo(0, -8);
  c.lineTo(-10, 0);
  c.lineTo(0, 8);
  c.closePath();
  c.fillStyle = '#32221c';
  c.fill();
  c.strokeStyle = '#ffe0a0';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#f18c57';
  c.fillRect(-3, -3, 6, 6);
  c.restore();
}
