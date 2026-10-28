import type { Game, Enemy } from './game.ts';
import { clamp } from './rules.ts';
import { SENTRY_LOCK, sentryMuzzle } from './fabricator.ts';
import { machineBodySnapshot } from './machine-breakdown-pose.ts';
import { drawSupportChassis } from './support-machine-art.ts';
import { drawMachineContacts } from './machine-breakdown-art.ts';

export function drawFabricator(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced = false,
  portrait = false,
) {
  const snapshot = machineBodySnapshot(e, g.time, g);
  if (!snapshot) return;
  const p = e.body.position;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (!portrait && e.sentry?.ready && e.state === 'windup') {
    const from = sentryMuzzle(e),
      end = g.lineEnd(from, { x: from.x + e.aim.x * 1300, y: from.y + e.aim.y * 1300 }, 4);
    c.strokeStyle = e.timer <= SENTRY_LOCK ? '#ffc0a0' : '#c48268';
    c.lineWidth = e.timer <= SENTRY_LOCK ? 1.8 : 1;
    c.setLineDash(e.timer <= SENTRY_LOCK ? [] : [5, 8]);
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    c.setLineDash([]);
  }
  const frame = snapshot.supportMachine?.fabricator?.frame;
  if (frame && !portrait) {
    const target = frame.position;
    c.strokeStyle = '#b6a073';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(p.x + e.facing * 26, p.y - 12);
    c.lineTo(target.x, target.y - 10);
    c.stroke();
    // The weld is steady under reduced motion; sparks never cover aiming tells.
    const pulse = reduced ? 1 : 0.75 + Math.sin(g.time * 31) * 0.25;
    c.fillStyle = '#ffe0a4';
    c.beginPath();
    c.arc(target.x, target.y - 10, 3 + pulse * 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#dcaf72';
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI * 0.5 + (reduced ? 0.3 : g.time * 2);
      c.beginPath();
      c.moveTo(target.x + Math.cos(a) * 6, target.y - 10 + Math.sin(a) * 6);
      c.lineTo(
        target.x + Math.cos(a) * (9 + pulse * 4),
        target.y - 10 + Math.sin(a) * (9 + pulse * 4),
      );
      c.stroke();
    }
  }
  c.translate(p.x, p.y);
  if (snapshot.scale !== 1) c.scale(snapshot.scale, snapshot.scale);
  drawSupportChassis(c, snapshot, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#44372f';
    c.fillRect(-17, 23, 34, 2);
    c.fillStyle = '#ed9979';
    c.fillRect(-17, 23, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
