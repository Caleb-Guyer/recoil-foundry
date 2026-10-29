import type { Enemy, Game } from './game.ts';
import { clamp } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { SCRAPPER_TELL } from './scrapper.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';
import { SPLIT_SCALE } from './mutations.ts';

export function drawScrapper(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const rig = e.scrapper!,
    p = e.body.position,
    held = rig.held;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (!portrait && held && rig.phase === 'aim') {
    let pos = { ...rig.release },
      vel = { ...rig.velocity };
    const gravity = g.engine.gravity.y * g.engine.gravity.scale * (1000 / 60) ** 2;
    c.strokeStyle = '#dcaa73';
    c.lineWidth = 1.4;
    c.setLineDash([5, 8]);
    c.beginPath();
    c.moveTo(pos.x, pos.y);
    const blockers = g.solidBodies.filter((b) => b !== held.body);
    for (let i = 0; i < 60; i++) {
      vel = {
        x: vel.x * (1 - held.body.frictionAir),
        y: vel.y * (1 - held.body.frictionAir) + gravity,
      };
      const next = { x: pos.x + vel.x, y: pos.y + vel.y };
      const hit = firstSolid(pos, next, { x: 24, y: 24 }, blockers);
      c.lineTo(pos.x + vel.x * (hit?.t ?? 1), pos.y + vel.y * (hit?.t ?? 1));
      if (hit) break;
      pos = next;
    }
    c.stroke();
    c.setLineDash([]);
  }
  // Native props stay in the prop pass. Only the articulated hardware is drawn here.
  c.translate(p.x, p.y);
  if (e.splitChild) c.scale(SPLIT_SCALE, SPLIT_SCALE);
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  const hand = held
    ? { x: held.body.position.x - p.x, y: held.body.position.y - p.y }
    : { x: e.facing * 25, y: e.state === 'recover' ? 6 : -12 };
  const armSide = held ? Math.sign(hand.x) || e.facing : e.facing;
  const elbow = { x: armSide * 21, y: held ? -39 : -25 };
  if (!portrait && held && rig.phase === 'aim') {
    const progress = clamp(1 - e.timer / SCRAPPER_TELL, 0, 1);
    c.strokeStyle = '#f0b47d';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(elbow.x, elbow.y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    c.stroke();
  }
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#342c29';
    c.fillRect(-17, 23, 34, 2);
    c.fillStyle = '#d48769';
    c.fillRect(-17, 23, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
