import type { Game, Enemy } from './game.ts';
import type { Prop } from './props.ts';
import { clamp } from './rules.ts';
import { AUDITOR_HP } from './auditor-layout.ts';
import { AUDITOR_RECALL } from './auditor.ts';

function seal(c: CanvasRenderingContext2D, x: number, y: number, size: number) {
  c.strokeRect(x - size, y - size * 0.7, size * 2, size * 1.4);
  c.fillRect(x - size * 0.55, y - size * 0.4, size * 0.28, size * 0.8);
  c.fillRect(x, y - size * 0.4, size * 0.15, size * 0.8);
  c.fillRect(x + size * 0.4, y - size * 0.4, size * 0.15, size * 0.8);
}
export function drawCompanyCase(c: CanvasRenderingContext2D, g: Game, prop: Prop) {
  const p = prop.body.position;
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = '#242b2b';
  c.fillRect(-22, -22, 44, 44);
  c.strokeStyle = prop.flash ? '#f3dfb4' : '#a99171';
  c.lineWidth = 2;
  c.strokeRect(-21, -21, 42, 42);
  c.fillStyle = '#847157';
  c.fillRect(-22, -14, 44, 3);
  c.fillRect(-22, 12, 44, 3);
  c.fillStyle = '#cfb48a';
  c.strokeStyle = '#cfb48a';
  c.lineWidth = 1;
  seal(c, 0, 0, 9);
  c.fillStyle = g.clear ? '#ead599' : '#535b51';
  c.fillRect(-3, -20, 6, 3);
  c.fillStyle = '#131c1e';
  c.fillRect(-15, 19, 8, 3);
  c.fillRect(7, 19, 8, 3);
  c.restore();
}
export function drawAuditDoor(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const a = g.auditor,
    p = a.door;
  if (!p) return;
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = '#111a1c';
  c.fillRect(-34, -42, 68, 72);
  c.strokeStyle = '#6b6658';
  c.lineWidth = 3;
  c.strokeRect(-34, -42, 68, 72);
  c.fillStyle = '#353a34';
  c.fillRect(-2, -39, 4, 68);
  c.globalAlpha = reduced ? 0.9 : 0.6 + Math.sin(g.time * 7) * 0.25;
  c.fillStyle = '#edbd77';
  c.fillRect(-31, -40, 5, 67);
  c.fillRect(26, -40, 5, 67);
  c.strokeStyle = '#edbd77';
  c.lineWidth = 1;
  seal(c, 0, -19, 9);
  c.restore();
}
export function drawAuditor(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const p = e.body.position,
    rig = e.auditor;
  if (!rig) return;
  const wound = e.hp < AUDITOR_HP / 3 ? 2 : e.hp < (AUDITOR_HP * 2) / 3 ? 1 : 0;
  if (e.state === 'windup') {
    c.save();
    c.strokeStyle = '#eabe87';
    c.lineWidth = 1.5;
    c.setLineDash([7, 7]);
    const aim = Math.atan2(e.aim.y, e.aim.x);
    const angles =
      rig.attack === 'fan' ? [-0.24, 0.24] : rig.attack === 'sweep' ? [-0.32, 0.32] : [0];
    for (const off of angles) {
      const end = g.lineEnd(p, {
        x: p.x + Math.cos(aim + off) * (rig.attack === 'charge' ? 300 : 850),
        y: rig.attack === 'charge' ? p.y : p.y + Math.sin(aim + off) * 850,
      });
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.restore();
  }
  c.save();
  c.translate(p.x, p.y);
  c.globalAlpha = e.spawn > 0 ? 0.4 + 0.6 * (1 - e.spawn / 0.65) : 1;
  const stride = reduced ? 0 : Math.sin(p.x * 0.13) * Math.min(3, Math.abs(e.body.velocity.x));
  c.fillStyle = '#90765c';
  c.fillRect(-15, 16, 10, 12 + stride);
  c.fillRect(5, 16, 10, 12 - stride);
  c.fillStyle = '#2e3735';
  c.fillRect(-19, -26, 38, 45);
  c.strokeStyle = e.flash > 0 ? '#f7e4c5' : '#c1a07b';
  c.lineWidth = 2;
  c.strokeRect(-19, -26, 38, 45);
  c.fillStyle = '#10191a';
  c.fillRect(-13, -23, 26, 10);
  c.fillStyle = e.state === 'windup' ? '#ffe0a4' : '#f18c71';
  c.fillRect(-10, -20, 20, 3);
  c.fillStyle = '#b5916c';
  c.strokeStyle = '#b5916c';
  c.lineWidth = 1;
  seal(c, 0, 2, 10);
  if (wound < 2) {
    c.fillStyle = '#bba180';
    c.fillRect(-25, -14, 9, 24);
  }
  if (wound < 1) {
    c.fillStyle = '#bba180';
    c.fillRect(16, -14, 9, 24);
  }
  if (wound) {
    c.strokeStyle = '#e88764';
    c.beginPath();
    c.moveTo(12, -12);
    c.lineTo(6, -4);
    c.lineTo(12, 2);
    c.lineTo(5, 11);
    c.stroke();
  }
  c.save();
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  c.fillStyle = '#88725a';
  c.fillRect(12, -5, 22, 10);
  c.fillStyle = '#d5bc94';
  c.fillRect(14, -5, 18, 2);
  c.fillStyle = '#202b2d';
  c.fillRect(30, -4, 5, 8);
  c.restore();
  c.fillStyle = '#574536';
  c.fillRect(-25, -37, 50, 3);
  c.fillStyle = '#d7b685';
  c.fillRect(-25, -37, 50 * clamp(e.hp / AUDITOR_HP, 0, 1), 3);
  if (g.auditor.recall > 0) {
    const edge = 31 + (1 - g.auditor.recall / AUDITOR_RECALL) * 16;
    c.strokeStyle = '#efc38c';
    c.lineWidth = 2;
    c.setLineDash([5, 4]);
    c.strokeRect(-edge, -edge, edge * 2, edge * 2);
  }
  c.restore();
}
