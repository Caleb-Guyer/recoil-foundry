import type { Enemy, Game } from './game.ts';
import { HUNTS, HUNT_THRESHOLD, isHunt } from './hunt-rules.ts';
import { clamp } from './rules.ts';
import { huntMuzzle } from './hunts.ts';
export function drawHuntEnemy(c: CanvasRenderingContext2D, e: Enemy, portrait: boolean) {
  if (!isHunt(e.kind)) return false;
  const { x, y } = e.body.position,
    color = e.kind === 'cableweaver' ? '#85d5d0' : e.kind === 'bulwark' ? '#a9bfaa' : '#e5ae73';
  c.save();
  c.translate(x, y);
  c.globalAlpha = e.spawn > 0 ? 0.6 : 1;
  c.fillStyle = '#26363c';
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.fillRect(-32, -28, 64, 54);
  c.strokeRect(-30, -26, 60, 50);
  c.fillStyle = '#607476';
  c.fillRect(-28, 22, 20, 8);
  c.fillRect(8, 22, 20, 8);
  c.fillStyle = e.flash > 0 ? '#fff8dc' : color;
  c.fillRect(-14, -13, 28, 9);
  c.fillRect(e.facing * 27 - 8, -23, 16, 12);
  c.strokeStyle = '#17282e';
  c.lineWidth = 2;
  if (e.kind === 'cableweaver') {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.arc(side * 29, 4, 16, 0, Math.PI * 2);
      c.fillStyle = '#406f72';
      c.fill();
      c.strokeStyle = color;
      c.stroke();
      c.beginPath();
      c.arc(side * 29, 4, 9, 0, Math.PI * 2);
      c.stroke();
    }
    c.fillStyle = color;
    c.fillRect(-3, -40, 6, 14);
  } else if (e.kind === 'bulwark') {
    c.fillStyle = '#668278';
    c.fillRect(-6, -91, 12, 61);
    c.fillStyle = color;
    c.fillRect(-14, -101, 28, 12);
    c.fillStyle = '#668278';
    c.fillRect(-39, -30, 14, 42);
    c.fillRect(25, -30, 14, 42);
    c.strokeStyle = color;
    c.strokeRect(-39, -30, 14, 42);
    c.strokeRect(25, -30, 14, 42);
    c.fillStyle = '#ebd28c';
    c.fillRect(-5, 2, 10, 14);
  } else {
    for (const side of [-1, 1]) {
      c.fillStyle = '#a17b56';
      c.fillRect(side * 24 - 6, -34, 12, 20);
      c.fillStyle = '#f0cb91';
      c.fillRect(side * 24 - 3, -32, 6, 7);
    }
    c.fillStyle = color;
    c.fillRect(-17, 4, 34, 9);
    c.fillStyle = '#27343b';
    c.fillRect(-11, 6, 22, 5);
  }
  if (!portrait) {
    c.fillStyle = '#1b272c';
    c.fillRect(-45, -58, 90, 5);
    c.fillStyle = color;
    c.fillRect(-45, -58, 90 * clamp(e.hp / e.maxHp, 0, 1), 5);
    if (e.state === 'windup') {
      c.strokeStyle = '#f0c17e';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - clamp(e.timer / 1.15, 0, 1)));
      c.stroke();
    }
  }
  c.restore();
  return true;
}
export function drawHunts(c: CanvasRenderingContext2D, g: Game) {
  const h = g.hunts;
  c.save();
  if (h.door && h.state?.phase === 'available') {
    const { x, y } = h.door;
    const glow = c.createRadialGradient(x, y - 35, 8, x, y - 35, 150);
    glow.addColorStop(0, '#df865b36');
    glow.addColorStop(1, '#df865b00');
    c.fillStyle = glow;
    c.fillRect(x - 150, y - 185, 300, 185);
    c.fillStyle = '#0c141a';
    c.fillRect(x - 45, y - 104, 90, 104);
    c.strokeStyle = '#b47758';
    c.lineWidth = 2;
    c.strokeRect(x - 45, y - 104, 90, 104);
    for (const side of [-1, 1]) {
      c.fillStyle = '#344147';
      c.fillRect(x + side * 39 - 4, y - 99, 8, 99);
      c.fillStyle = g.clear ? '#e4a771' : '#856344';
      c.fillRect(x + side * 39 - 2, y - 94, 4, 24);
    }
    c.fillStyle = '#b47758';
    c.beginPath();
    c.moveTo(x, y - 75);
    c.lineTo(x + 14, y - 54);
    c.lineTo(x + 8, y - 30);
    c.lineTo(x - 8, y - 30);
    c.lineTo(x - 14, y - 54);
    c.closePath();
    c.fill();
    c.fillStyle = '#131d22';
    c.fillRect(x - 8, y - 53, 5, 5);
    c.fillRect(x + 3, y - 53, 5, 5);
    c.fillStyle = '#dfaf85';
    c.textAlign = x < 500 ? 'left' : 'right';
    const labelX = x < 500 ? x - 45 : x + 45;
    c.font = 'bold 13px sans-serif';
    c.fillText('BOSS HUNT · OPTIONAL', labelX, y - 158);
    c.font = 'bold 18px sans-serif';
    c.fillText(HUNTS[h.state.kind].name, labelX, y - 133);
    c.font = '15px sans-serif';
    c.fillStyle = '#c5d6d2';
    c.fillText(
      g.clear ? 'Jump to enter · Repair or free reroll' : 'Clear the patrol to enter',
      labelX,
      y - 112,
    );
  }
  if (h.kind) {
    const color =
      h.kind === 'cableweaver' ? '#85d5d0' : h.kind === 'bulwark' ? '#a9bfaa' : '#e5ae73';
    // The same authored platforms have distinct machinery around them. Keep
    // decoration on their undersides so silhouettes and warning circles read.
    c.strokeStyle = color + '45';
    c.lineWidth = 2;
    for (const s of g.level.solids.filter((s) => s.x > HUNT_THRESHOLD)) {
      if (h.kind === 'cableweaver') {
        for (const x of [s.x + 15, s.x + s.w - 15]) {
          c.beginPath();
          c.moveTo(x, s.y + s.h);
          c.lineTo(x, s.y + s.h + 32);
          c.stroke();
          c.strokeRect(x - 5, s.y + s.h + 26, 10, 10);
        }
      } else if (h.kind === 'bulwark') {
        c.beginPath();
        c.moveTo(s.x + 8, s.y + s.h);
        c.lineTo(s.x + s.w / 2, s.y + 80);
        c.lineTo(s.x + s.w - 8, s.y + s.h);
        c.stroke();
      } else {
        for (let x = s.x + 10; x < s.x + s.w - 10; x += 24) {
          c.beginPath();
          c.moveTo(x, s.y + 4);
          c.lineTo(x + 15, s.y + s.h - 4);
          c.stroke();
        }
      }
    }
    c.fillStyle = '#1d2a2e';
    c.fillRect(HUNT_THRESHOLD - 22, 555, 12, 185);
    c.fillRect(HUNT_THRESHOLD + 10, 555, 12, 185);
    c.fillRect(HUNT_THRESHOLD - 22, 548, 44, 15);
    c.fillStyle = h.gate ? '#d47d5c' : color;
    c.fillRect(HUNT_THRESHOLD - 18, 551, 36, 5);
    if (h.gate) {
      c.fillStyle = '#17242a';
      c.fillRect(HUNT_THRESHOLD - 10, 563, 20, 177);
      c.strokeStyle = '#b47758';
      for (let y = 570; y < 735; y += 20) {
        c.beginPath();
        c.moveTo(HUNT_THRESHOLD - 8, y);
        c.lineTo(HUNT_THRESHOLD + 8, y + 12);
        c.stroke();
      }
    }
    c.fillStyle = '#9ab7b8';
    c.font = 'bold 18px sans-serif';
    c.fillText(HUNTS[h.kind].name, 100, 600);
    c.font = '15px sans-serif';
    const words = HUNTS[h.kind].hint.split(' ');
    let line = '',
      y = 626;
    for (const word of words) {
      if (c.measureText(line + word).width > 330) {
        c.fillText(line, 100, y);
        line = '';
        y += 21;
      }
      line += word + ' ';
    }
    c.fillText(line, 100, y);
    c.fillStyle = color;
    c.font = 'bold 13px sans-serif';
    c.fillText(
      h.approaching ? 'CROSS THE LIT GATE TO BEGIN →' : g.clear ? 'HUNT COMPLETE' : 'ARENA SEALED',
      100,
      685,
    );
  }
  for (const e of g.enemies) {
    if (!isHunt(e.kind) || e.state !== 'windup') continue;
    c.strokeStyle = '#e8b97b';
    c.setLineDash([7, 7]);
    c.lineWidth = 2;
    if (e.attack === 'mortar' && e.kind !== 'bulwark') {
      c.beginPath();
      c.ellipse(e.target.x, 735, e.kind === 'cableweaver' ? 135 : 120, 12, 0, 0, Math.PI * 2);
      c.stroke();
    } else {
      const muzzle = huntMuzzle(e);
      const aim = Math.atan2(e.aim.y, e.aim.x);
      for (const offset of [-0.19, 0, 0.19]) {
        const angle = aim + offset,
          end = g.lineEnd(muzzle, {
            x: muzzle.x + Math.cos(angle) * 2000,
            y: muzzle.y + Math.sin(angle) * 2000,
          });
        c.beginPath();
        c.moveTo(muzzle.x, muzzle.y);
        c.lineTo(end.x, end.y);
        c.stroke();
      }
    }
    c.setLineDash([]);
  }
  for (const cable of h.cables) {
    const [a, b] = cable.anchors.map((p) => p.body.position),
      live = g.time >= cable.liveAt;
    c.strokeStyle = live ? '#91e6de' : '#d5bc82';
    c.lineWidth = live ? 4 : 2;
    c.setLineDash(live ? [] : [8, 8]);
    c.beginPath();
    c.moveTo(a.x, a.y - 18);
    c.lineTo(b.x, b.y - 18);
    c.stroke();
    c.setLineDash([]);
  }
  for (const mine of h.mines) {
    const p = mine.prop.body.position,
      remaining = clamp((mine.explodesAt - g.time) / 2.8, 0, 1);
    c.fillStyle = '#edb77b22';
    c.beginPath();
    c.arc(p.x, p.y, 120, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#edb77b';
    c.lineWidth = 2;
    c.setLineDash([5, 8]);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    c.stroke();
  }
  c.restore();
}
export function drawHuntProps(c: CanvasRenderingContext2D, g: Game) {
  for (const p of g.props.items) {
    if (!p.hunt) continue;
    const plate = p.hunt === 'plate',
      w = plate ? 24 : 18,
      h = plate ? 84 : 18;
    c.save();
    c.translate(p.body.position.x, p.body.position.y);
    c.rotate(p.body.angle);
    c.fillStyle = p.flash > 0 ? '#fff0c2' : plate ? '#48665e' : '#304d53';
    c.strokeStyle = plate ? '#bdd0ab' : p.hunt === 'mine' ? '#eab378' : '#90dcd5';
    c.lineWidth = 2;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeRect(-w / 2, -h / 2, w, h);
    if (plate) {
      c.strokeStyle = '#809b86';
      for (let y = -26; y <= 26; y += 13) {
        c.beginPath();
        c.moveTo(-7, y);
        c.lineTo(7, y);
        c.stroke();
      }
    } else {
      c.fillStyle = c.strokeStyle;
      c.fillRect(-3, -3, 6, 6);
    }
    c.restore();
  }
}
