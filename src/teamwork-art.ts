import type { Enemy, Game } from './game.ts';
import { clamp } from './rules.ts';
import { machineBodySnapshot } from './machine-breakdown-pose.ts';
import { drawSupportChassis } from './support-machine-art.ts';
import { drawMachineContacts } from './machine-breakdown-art.ts';

export function drawSupport(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced = false,
  portrait = false,
) {
  const snapshot = machineBodySnapshot(e, g.time, g);
  if (!snapshot) return;
  const rig = e.support!,
    p = e.body.position,
    repair = e.kind === 'repairer';
  const color = repair ? '#a8d9c3' : '#efc477';
  const partner = snapshot.supportMachine?.support?.partner;
  c.save();
  if (partner && e.spawn <= 0 && !portrait) {
    const q = partner.position,
      charging = rig.phase === 'windup';
    c.strokeStyle = '#152729';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.setLineDash(charging ? [5, 7] : []);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(q.x, q.y, 23, 0, Math.PI * 2);
    c.stroke();
    // Shape cues remain still and visible with Reduced effects.
    c.beginPath();
    if (repair) {
      c.moveTo(q.x - 5, q.y - 29);
      c.lineTo(q.x + 5, q.y - 29);
      c.moveTo(q.x, q.y - 34);
      c.lineTo(q.x, q.y - 24);
    } else {
      c.moveTo(q.x + 2, q.y - 36);
      c.lineTo(q.x - 3, q.y - 29);
      c.lineTo(q.x + 3, q.y - 29);
      c.lineTo(q.x - 2, q.y - 23);
    }
    c.stroke();
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  if (snapshot.scale !== 1) c.scale(snapshot.scale, snapshot.scale);
  drawSupportChassis(c, snapshot, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  c.restore();
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#384447';
    c.fillRect(p.x - 16, p.y - 28, 32, 3);
    c.fillStyle = color;
    c.fillRect(p.x - 16, p.y - 28, 32 * Math.max(0, e.hp / e.maxHp), 3);
  }
}
