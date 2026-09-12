import type { Enemy, Game } from './game.ts';
import type { Prop } from './props.ts';
import { clamp } from './rules.ts';
import { CHARGE_FUSE, CHARGE_RADIUS, SAPPER_LOCK, sapperMuzzle } from './sapper.ts';

export function drawSapper(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.sapper!,
    p = e.body.position,
    muzzle = sapperMuzzle(e);
  c.save();
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  if (e.state === 'windup' && rig.arc.length) {
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
  c.fillStyle = '#303333';
  c.fillRect(-17, 9, 34, 7);
  c.fillStyle = e.flash > 0 ? '#fff0d4' : '#ae8055';
  c.beginPath();
  c.moveTo(-15, 8);
  c.lineTo(-15, -9);
  c.lineTo(-8, -16);
  c.lineTo(12, -16);
  c.lineTo(15, 8);
  c.closePath();
  c.fill();
  c.fillStyle = '#493b31';
  c.fillRect(-10, -8, 20, 12);
  c.fillStyle = '#dfbd7f';
  for (const x of [-7, 1, 9]) c.fillRect(x - 2, -5, 4, 7);
  c.fillStyle = '#272f31';
  c.fillRect(e.facing > 0 ? 6 : -14, -14, 8, 4);
  c.strokeStyle = e.state === 'recover' ? '#8d7c62' : '#dfb981';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(e.facing * 6, -10);
  c.lineTo(muzzle.x - p.x, muzzle.y - p.y);
  c.stroke();
  c.lineWidth = 1.5;
  c.strokeRect(muzzle.x - p.x - 6, muzzle.y - p.y - 5, 12, 10);
  if (e.state === 'windup') {
    c.fillStyle = reduced || Math.sin(g.time * 14) > 0 ? '#f1d28e' : '#bb804d';
    c.fillRect(muzzle.x - p.x - 3, muzzle.y - p.y - 3, 6, 6);
  }
  if (e.hp < e.maxHp) {
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
