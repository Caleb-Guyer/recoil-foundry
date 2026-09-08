import type { Enemy, Game } from './game.ts';
import { squadGunOrigin, squadLineEnd, SQUAD_LOCK } from './squads.ts';

export function drawSquadTell(c: CanvasRenderingContext2D, g: Game, e: Enemy) {
  if (
    e.spawn > 0 ||
    e.squad?.kind !== 'shield' ||
    e.squad.role !== 'support' ||
    e.state !== 'windup'
  )
    return;
  const origin = squadGunOrigin(e),
    locked = e.timer <= SQUAD_LOCK;
  const end = squadLineEnd(g, e, origin, {
    x: origin.x + e.aim.x * 1450,
    y: origin.y + e.aim.y * 1450,
  });
  c.save();
  c.strokeStyle = locked ? '#efc893' : '#90664f';
  c.lineWidth = locked ? 1.5 : 1;
  c.setLineDash(locked ? [] : [6, 9]);
  c.beginPath();
  c.moveTo(origin.x, origin.y);
  c.lineTo(end.x, end.y);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#efc893';
  c.beginPath();
  c.arc(origin.x + e.aim.x * 28, origin.y + e.aim.y * 28, locked ? 4 : 2.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
