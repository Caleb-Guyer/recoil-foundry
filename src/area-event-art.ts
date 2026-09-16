import type { Enemy, Game } from './game.ts';
import { clamp, distance } from './rules.ts';

const AMBER = '#e8bb76',
  TEAL = '#8dcac5';
export function drawEventEnemy(c: CanvasRenderingContext2D, e: Enemy): boolean {
  if (e.eventRole !== 'relay') return false;
  const p = e.body.position;
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = '#172125';
  c.strokeStyle = AMBER;
  c.lineWidth = 2;
  c.fillRect(-19, -17, 38, 33);
  c.strokeRect(-19, -17, 38, 33);
  c.beginPath();
  c.moveTo(2, -11);
  c.lineTo(-6, 1);
  c.lineTo(3, 1);
  c.lineTo(-2, 11);
  c.stroke();
  c.fillStyle = e.flash > 0 ? '#fff1d1' : AMBER;
  c.fillRect(-19, -24, 38 * Math.max(0, e.hp / e.maxHp), 3);
  c.restore();
  return true;
}
export function drawAreaEvent(c: CanvasRenderingContext2D, g: Game) {
  const event = g.areaEvents;
  if (!event.active || g.level.boss) return;
  c.save();
  for (const e of g.enemies) {
    if (e.crew === undefined && e.eventRole !== 'commander') continue;
    const p = e.body.position;
    c.strokeStyle = e.crew === 1 ? TEAL : AMBER;
    c.lineWidth = 2;
    c.beginPath();
    if (e.eventRole === 'commander') {
      c.moveTo(p.x - 15, p.y - 29);
      c.lineTo(p.x - 12, p.y - 39);
      c.lineTo(p.x, p.y - 32);
      c.lineTo(p.x + 12, p.y - 39);
      c.lineTo(p.x + 15, p.y - 29);
      c.stroke();
      c.fillStyle = AMBER;
      c.fillRect(p.x - 24, p.y - 45, 48 * Math.max(0, e.hp / e.maxHp), 3);
    } else {
      c.moveTo(p.x - 11, p.y - 28);
      c.lineTo(p.x + 11, p.y - 28);
      if (e.crew === 1) {
        c.moveTo(p.x - 11, p.y - 32);
        c.lineTo(p.x + 11, p.y - 32);
      }
      c.stroke();
    }
  }
  const beam = event.beam;
  if (beam) {
    const to = g.lineEnd(beam.from, beam.to, 5);
    c.strokeStyle = beam.warning ? '#e8bb7690' : '#fff0cd';
    c.lineWidth = beam.warning ? 1.5 : 10;
    if (beam.warning) c.setLineDash([8, 10]);
    c.beginPath();
    c.moveTo(beam.from.x, beam.from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
    c.setLineDash([]);
  }
  const p = event.site;
  if (event.active === 'turf' && !event.cacheTaken && !event.state?.caches.includes(g.stage)) {
    c.fillStyle = '#192527';
    c.strokeStyle = event.cacheReady ? TEAL : '#6b7470';
    c.lineWidth = 2;
    c.fillRect(p.x - 20, p.y - 14, 40, 30);
    c.strokeRect(p.x - 20, p.y - 14, 40, 30);
    c.beginPath();
    c.moveTo(p.x - 20, p.y - 4);
    c.lineTo(p.x + 20, p.y - 4);
    c.stroke();
    c.fillStyle = event.cacheReady ? TEAL : '#6b7470';
    for (let i = 0; i < 2; i++)
      if (event.crewKills > i) c.fillRect(p.x - 9 + i * 12, p.y + 3, 6, 6);
    if (event.cacheReady) {
      c.beginPath();
      c.arc(p.x, p.y - 36, 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (event.active === 'lockdown') {
    const done = event.state?.commander;
    c.fillStyle = '#192527';
    c.strokeStyle = done ? TEAL : AMBER;
    c.lineWidth = 2;
    c.fillRect(p.x - 14, p.y - 42, 28, 24);
    c.strokeRect(p.x - 14, p.y - 42, 28, 24);
    c.beginPath();
    c.moveTo(p.x, p.y - 18);
    c.lineTo(p.x, p.y + 16);
    c.stroke();
    if ((event.patrolWarned && !event.patrolDone) || event.pending) {
      c.beginPath();
      c.arc(p.x, p.y - 30, 26, 0, Math.PI * 2);
      c.stroke();
    }
    if (g.clear && !done && !event.hunted && distance(g.player.position, p) < 170) {
      c.font = '11px monospace';
      c.textAlign = 'center';
      c.fillStyle = AMBER;
      c.fillText('JUMP · HUNT', p.x, p.y - 57);
    }
  }
  c.restore();
}
export function drawEventNotice(c: CanvasRenderingContext2D, g: Game, width: number) {
  const ev = g.areaEvents;
  if (g.mode !== 'playing' || !ev.banner || g.time >= ev.bannerUntil) return;
  c.save();
  c.globalAlpha = clamp((ev.bannerUntil - g.time) * 2, 0, 1);
  c.font = '12px monospace';
  c.textAlign = 'center';
  c.fillStyle = '#e5e1d1';
  const lines: string[] = [];
  let line = '';
  for (const word of ev.banner.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (c.measureText(next).width > width - 64 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  const w = Math.min(width - 32, Math.max(...lines.map((l) => c.measureText(l).width)) + 28);
  c.fillStyle = '#111a20e8';
  c.fillRect((width - w) / 2, 71, w, 20 + lines.length * 18);
  c.fillStyle = '#e5e1d1';
  lines.forEach((l, i) => c.fillText(l, width / 2, 93 + i * 18));
  c.restore();
}
