import type { Game, Enemy } from './game.ts';
import { clamp } from './rules.ts';
import { FABRICATOR_BUILD, SENTRY_LOCK, sentryMuzzle } from './fabricator.ts';

export function drawFabricator(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const p = e.body.position;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (e.sentry?.ready && e.state === 'windup') {
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
  const frame =
    e.fabricator?.frame === undefined
      ? undefined
      : g.enemies.find((other) => other.id === e.fabricator!.frame);
  if (frame) {
    const target = frame.body.position;
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
  if (e.kind === 'sentry') {
    const owner = g.enemies.find((other) => other.id === e.sentry?.owner);
    const built = e.sentry?.ready
      ? 1
      : clamp(1 - (owner?.timer ?? FABRICATOR_BUILD) / FABRICATOR_BUILD, 0, 1);
    c.strokeStyle = '#bc8c6d';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(-16, 15);
    c.lineTo(-10, 7 + (1 - built) * 6);
    c.lineTo(10, 7 + (1 - built) * 6);
    c.lineTo(16, 15);
    c.stroke();
    c.fillStyle = e.flash ? '#fff0d0' : '#503b34';
    c.strokeStyle = e.sentry?.ready ? '#ed8c71' : '#b7a079';
    c.lineWidth = 2;
    c.fillRect(-12, -13, 24, 21);
    c.strokeRect(-12, -13, 24, 21);
    c.fillStyle = '#dcaa70';
    for (let i = 0; i < Math.ceil(built * 3); i++) c.fillRect(-8 + i * 6, 3, 3, 2);
    c.save();
    c.translate(0, -8);
    c.rotate(e.sentry?.ready ? Math.atan2(e.aim.y, e.aim.x) : (-Math.PI / 2) * (1 - built));
    c.fillStyle = e.flash ? '#fff0d0' : e.sentry?.ready ? '#ed8c71' : '#9d8a6c';
    c.fillRect(0, -3, 10 + built * 16, 6);
    c.fillStyle = '#262b2b';
    c.fillRect(2, -6, 11, 12);
    c.restore();
  } else {
    c.fillStyle = '#303b38';
    c.fillRect(-17, 8, 34, 8);
    c.strokeStyle = '#82958c';
    c.lineWidth = 2;
    c.strokeRect(-15, 9, 30, 6);
    c.fillStyle = e.flash ? '#fff0d0' : '#b27358';
    c.fillRect(-14, -9, 28, 19);
    c.fillStyle = '#bd9770';
    c.fillRect(-10, -19, 20, 18);
    c.fillStyle = '#222b29';
    c.fillRect(-7, -15, 14, 7);
    c.fillStyle = frame ? '#ffe3a3' : '#ee9476';
    c.fillRect(e.facing > 0 ? 1 : -6, -13, 5, 3);
    c.strokeStyle = '#b19875';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(e.facing * 7, 0);
    c.lineTo(e.facing * 20, -19);
    c.lineTo(e.facing * 28, frame ? -12 : -2);
    c.stroke();
    c.strokeStyle = '#e3b680';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(e.facing * 27, frame ? -12 : -2);
    c.lineTo(e.facing * 34, frame ? -12 : -2);
    c.stroke();
    c.fillStyle = '#9eb1a3';
    c.fillRect(-e.facing * 16 - 3, -6, 6, 15);
  }
  if (e.hp < e.maxHp) {
    c.fillStyle = '#44372f';
    c.fillRect(-17, 23, 34, 2);
    c.fillStyle = '#ed9979';
    c.fillRect(-17, 23, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
