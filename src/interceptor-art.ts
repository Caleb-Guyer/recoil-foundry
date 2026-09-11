import type { Enemy, Game } from './game.ts';
import { interceptorLock } from './interceptor.ts';
import { clamp } from './rules.ts';
import { INTERCEPTOR_WEAPONS } from './interceptor-weapons.ts';
import { drawRivalEffects, rivalWarningLanes } from './interceptor-effects.ts';

export function drawInterceptor(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const rig = e.interceptor!,
    p = e.body.position;
  const warning = e.spawn <= 0 && (e.state === 'windup' || e.state === 'followup');
  const locked = e.timer <= interceptorLock(e),
    open = e.state === 'recover';
  c.save();
  drawRivalEffects(c, g, e);
  if (warning) {
    c.strokeStyle = e.attack === 'vault' ? '#f5b583' : INTERCEPTOR_WEAPONS[rig.move].color;
    c.lineWidth = locked ? (rig.move === 'capacitor' || rig.move === 'precision' ? 2.5 : 1.5) : 1;
    c.globalAlpha = locked ? 0.6 : 0.27;
    c.setLineDash(locked ? [] : [5, 9]);
    for (const lane of rivalWarningLanes(g, e)) {
      c.beginPath();
      c.moveTo(lane.from.x, lane.from.y);
      c.lineTo(lane.to.x, lane.to.y);
      c.stroke();
    }
    c.setLineDash([]);
    if (e.attack === 'vault') {
      c.globalAlpha = 0.35;
      c.strokeStyle = '#b2ccc4';
      const end = g.lineEnd(p, { x: p.x + rig.launch.x * 19, y: p.y + rig.launch.y * 19 }, 28);
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
      c.beginPath();
      c.arc(end.x, end.y, 5, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
  c.translate(p.x, p.y);
  c.save();
  c.rotate(reduced ? 0 : clamp(e.body.velocity.x * 0.02, -0.2, 0.2));
  // A compact rival silhouette: two boots, a narrow visor, and split armor.
  c.fillStyle = '#54605b';
  c.fillRect(-22, 18, 15, 14);
  c.fillRect(7, 18, 15, 14);
  c.fillStyle = e.flash > 0 ? '#ffe3b6' : '#3c3431';
  c.strokeStyle = '#bd9d80';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-27, -22);
  c.lineTo(-17, -32);
  c.lineTo(17, -32);
  c.lineTo(27, -22);
  c.lineTo(27, 21);
  c.lineTo(-27, 21);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#18262a';
  c.fillRect(-21, -22, 42, 10);
  c.fillStyle = '#f0b47f';
  c.fillRect(e.aim.x > 0 ? 7 : -18, -20, 11, 3);
  c.fillStyle = open ? '#f6d49b' : '#796451';
  c.fillRect(-8, -3, 16, 19);
  for (const side of [-1, 1]) {
    c.fillStyle = e.flash > 0 ? '#fff0cd' : '#8f8170';
    c.fillRect(side < 0 ? -25 - (open ? 7 : 0) : 3 + (open ? 7 : 0), -5, 22, 23);
    c.fillStyle = '#4a4d45';
    for (let y = 1; y < 20; y += 6)
      c.fillRect(side < 0 ? -23 - (open ? 7 : 0) : 5 + (open ? 7 : 0), y, 18, 2);
  }
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i <= e.phase ? '#e6bb88' : '#645b50';
    c.fillRect(-9 + i * 7, -29, 4, 2);
  }
  c.restore();
  c.save();
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  const kick = reduced ? 0 : rig.muzzle * 24;
  c.translate(-kick, 0);
  c.fillStyle = '#273338';
  c.fillRect(8, -8, 34, 16);
  c.fillStyle = '#a5aaa0';
  c.fillRect(11, -7, 26, 4);
  c.fillStyle = '#797e73';
  c.fillRect(18, 4, 18, 4);
  c.fillStyle = warning ? INTERCEPTOR_WEAPONS[rig.move].color : '#cfad83';
  c.fillRect(38, -10, 6, 20);
  c.fillStyle = '#18282e';
  c.fillRect(40, -5, 5, 10);
  if (rig.move === 'precision' || rig.move === 'capacitor') {
    c.fillStyle = '#9ca79c';
    c.fillRect(43, -4, 14, 8);
    if (warning) {
      c.strokeStyle = INTERCEPTOR_WEAPONS[rig.move].color;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(
        28,
        0,
        14,
        -Math.PI / 2,
        -Math.PI / 2 + clamp(1 - e.timer / INTERCEPTOR_WEAPONS[rig.move].tell, 0, 1) * Math.PI * 2,
      );
      c.stroke();
    }
  }
  if (rig.move === 'scatter' || rig.move === 'crossfire') {
    c.fillStyle = '#bdab91';
    c.fillRect(29, -12, 12, 3);
    c.fillRect(29, 9, 12, 3);
  }
  if (rig.muzzle > 0) {
    c.globalAlpha *= rig.muzzle / 0.16;
    c.fillStyle = '#ffdfaa';
    c.beginPath();
    c.moveTo(44, -6);
    c.lineTo(74, 0);
    c.lineTo(44, 6);
    c.closePath();
    c.fill();
  }
  c.restore();
  if (e.hp < e.maxHp) {
    c.fillStyle = '#433b36';
    c.fillRect(-31, -44, 62, 3);
    c.fillStyle = '#e9b584';
    c.fillRect(-31, -44, (62 * e.hp) / e.maxHp, 3);
  }
  c.restore();
}
