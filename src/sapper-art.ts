import type { Enemy, Game } from './game.ts';
import type { Prop } from './props.ts';
import { clamp } from './rules.ts';
import { CHARGE_FUSE, CHARGE_RADIUS, SAPPER_LOCK } from './sapper.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';
import { SPLIT_SCALE } from './mutations.ts';

export function drawSapper(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const rig = e.sapper!,
    p = e.body.position;
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (!portrait && e.state === 'windup' && rig.arc.length) {
    const locked = e.timer <= SAPPER_LOCK;
    c.strokeStyle = locked ? '#efbf7b' : '#a88c6a';
    c.lineWidth = locked ? 1.4 : 1;
    c.setLineDash(locked ? [6, 6] : [2, 10]);
    c.beginPath();
    rig.arc.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
    c.setLineDash([]);
    const target = rig.arc.at(-1)!;
    c.beginPath();
    c.arc(target.x, target.y, 12, 0, Math.PI * 2);
    c.stroke();
  }
  c.translate(p.x, p.y);
  if (e.splitChild) c.scale(SPLIT_SCALE, SPLIT_SCALE);
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) drawMachineContacts(c, g, e, reduced);
  if (!portrait && e.hp < e.maxHp) {
    c.fillStyle = '#352f27';
    c.fillRect(-17, 22, 34, 2);
    c.fillStyle = '#d9b075';
    c.fillRect(-17, 22, 34 * Math.max(0, e.hp / e.maxHp), 2);
  }
  c.restore();
}
export function drawCharge(c: CanvasRenderingContext2D, g: Game, p: Prop, reduced: boolean) {
  const charge = p.charge!,
    left = Math.max(0, charge.at - g.time),
    pos = p.body.position;
  const hot = left < 1.2;
  c.save();
  if (hot) {
    c.strokeStyle = '#dba15f';
    c.globalAlpha = 0.22;
    c.lineWidth = 1;
    c.setLineDash([3, 7]);
    c.beginPath();
    c.arc(pos.x, pos.y, CHARGE_RADIUS, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 1;
  }
  c.translate(pos.x, pos.y);
  c.strokeStyle = hot ? '#f8ca85' : '#d3b283';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(left / CHARGE_FUSE, 0, 1));
  c.stroke();
  c.rotate(p.body.angle);
  c.fillStyle = p.flash > 0 ? '#ffe4b0' : '#41362a';
  c.fillRect(-9, -9, 18, 18);
  c.lineWidth = 1.5;
  c.strokeStyle = charge.loose ? '#eed1a1' : '#b59265';
  c.strokeRect(-8, -8, 16, 16);
  c.fillStyle =
    hot && (reduced || Math.sin(g.time * (left < 0.5 ? 22 : 12)) > 0) ? '#ffe4a4' : '#c49152';
  c.fillRect(-3, -4, 6, 8);
  c.restore();
}
export function drawSapperBlasts(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  for (const f of g.sappers.effects) {
    const life = clamp(1 - (g.time - f.at) / 0.2, 0, 1);
    c.globalAlpha = life * (reduced ? 0.1 : 0.2);
    c.fillStyle = '#efbb75';
    c.strokeStyle = '#efbb75';
    c.lineWidth = 2;
    c.beginPath();
    f.outline.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fill();
    c.globalAlpha = life * 0.6;
    c.stroke();
  }
  c.restore();
}
