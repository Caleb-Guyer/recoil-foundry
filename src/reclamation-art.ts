import type { Game, Enemy } from './game.ts';
import { clamp } from './rules.ts';
import { MAGNET_PERIOD } from './magnets.ts';
import { SORTER_LOCK, SORTER_WIDTH, sorterFan } from './reclamation.ts';

export function drawMagnets(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const m of g.magnets.items) {
    c.save();
    const active = ['lift', 'hold'].includes(m.phase),
      warn = m.phase === 'warn' || m.phase === 'hold';
    const color = warn ? '#e2b978' : active ? '#a3c9b5' : '#657f75';
    c.strokeStyle = '#42574e';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(m.x, 60);
    c.lineTo(m.x, m.y - 17);
    c.stroke();
    c.fillStyle = '#2d4038';
    c.fillRect(m.x - 49, m.y - 16, 98, 32);
    c.strokeStyle = '#738c7c';
    c.lineWidth = 2;
    c.strokeRect(m.x - 49, m.y - 16, 98, 32);
    c.fillStyle = '#152721';
    c.fillRect(m.x - 32, m.y + 2, 64, 13);
    c.fillStyle = color;
    c.fillRect(m.x - 44, m.y + 12, 20, 7);
    c.fillRect(m.x + 24, m.y + 12, 20, 7);
    for (let i = 0; i < 5; i++) {
      c.fillStyle =
        i < (((g.time - g.magnets.startedAt + m.offset) % MAGNET_PERIOD) / MAGNET_PERIOD) * 5
          ? color
          : '#3c5047';
      c.fillRect(m.x - 26 + i * 11, m.y - 9, 7, 3);
    }
    if (active || warn || m.phase === 'drop') {
      c.fillStyle = warn ? '#deb1700c' : '#a5d0b009';
      c.fillRect(m.x - 64, m.y + 20, 128, m.floor - m.y - 20);
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.globalAlpha = 0.6;
      c.setLineDash([3, 9]);
      c.beginPath();
      c.moveTo(m.x - 64, m.y + 28);
      c.lineTo(m.x - 64, m.floor);
      c.moveTo(m.x + 64, m.y + 28);
      c.lineTo(m.x + 64, m.floor);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(m.x - 64, m.floor - 2);
      c.lineTo(m.x + 64, m.floor - 2);
      c.stroke();
      if (active && !reduced)
        for (let i = 0; i < 3; i++) {
          const y = m.floor - ((g.time * 95 + i * 110) % (m.floor - m.y - 40));
          c.strokeStyle = '#9cbea440';
          c.beginPath();
          c.moveTo(m.x - 9, y + 5);
          c.lineTo(m.x, y);
          c.lineTo(m.x + 9, y + 5);
          c.stroke();
        }
    }
    c.restore();
  }
}

export function drawReclamationEnemy(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
) {
  const p = e.body.position,
    boss = e.kind === 'sorter',
    flying = e.kind === 'sifter';
  c.save();
  if (boss && e.sorter && ((e.state === 'windup' && e.attack === 'slam') || e.sorter.pulse > 0)) {
    const pulse = e.sorter.pulse > 0,
      locked = e.timer <= SORTER_LOCK;
    for (const x of e.sorter.lanes) {
      c.fillStyle = pulse ? '#f2bd8050' : locked ? '#d88d6815' : '#d88d6809';
      c.fillRect(x - SORTER_WIDTH / 2, 50, SORTER_WIDTH, 690);
      c.strokeStyle = pulse ? '#ffe0ac' : locked ? '#ecb27f' : '#9b785e';
      c.lineWidth = pulse ? 3 : 1.5;
      c.setLineDash(locked || pulse ? [] : [8, 10]);
      c.strokeRect(x - SORTER_WIDTH / 2, 50, SORTER_WIDTH, 688);
      c.setLineDash([]);
      c.fillStyle = locked ? '#e6b080' : '#97765b';
      for (let y = 100; y < 710; y += 90) {
        c.beginPath();
        c.moveTo(x - 8, y - 6);
        c.lineTo(x, y);
        c.lineTo(x + 8, y - 6);
        c.stroke();
      }
    }
  }
  if (e.state === 'windup' && (!boss || e.attack === 'fan')) {
    const length = boss ? 650 : 480,
      angle = Math.atan2(e.aim.y, e.aim.x);
    c.strokeStyle = e.timer <= 0.5 ? '#e5b182' : '#94735e';
    c.lineWidth = 1;
    for (const offset of flying
      ? [-0.22, 0, 0.22]
      : boss
        ? sorterFan(e).map((a) => a - angle)
        : [0]) {
      const end = g.lineEnd(p, {
        x: p.x + Math.cos(angle + offset) * length,
        y: p.y + Math.sin(angle + offset) * length,
      });
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
  }
  c.translate(p.x, p.y);
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  const color = e.flash > 0 ? '#fff0d3' : e.state === 'recover' ? '#f0bf84' : '#ce866b';
  if (boss) {
    // Twin induction coils flank a shuttered central housing.
    for (const side of [-1, 1]) {
      c.fillStyle = '#33453e';
      c.fillRect(side * 35 - 13, -37, 26, 74);
      c.strokeStyle = '#8a9d83';
      c.lineWidth = 2;
      c.strokeRect(side * 35 - 13, -37, 26, 74);
      for (let y = -27; y < 33; y += 10) {
        c.fillStyle = color;
        c.fillRect(side * 35 - 10, y, 20, 3);
      }
    }
    c.fillStyle = e.flash > 0 ? '#ffe4c1' : '#475447';
    c.fillRect(-24, -28, 48, 56);
    c.fillStyle = '#162620';
    c.fillRect(-17, -19, 34, 38);
    const open = e.state === 'recover' ? 13 : 4;
    c.fillStyle = color;
    c.fillRect(-open, -13, open * 2, 26);
    c.strokeStyle = '#a7b49b';
    c.strokeRect(-24, -28, 48, 56);
  } else if (flying) {
    c.fillStyle = e.flash > 0 ? '#fff0d3' : '#46534b';
    c.beginPath();
    c.moveTo(0, -19);
    c.lineTo(19, 0);
    c.lineTo(0, 19);
    c.lineTo(-19, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#1b2b26';
    c.fillRect(-11, -5, 22, 10);
    c.fillStyle = color;
    c.fillRect(e.aim.x * 6 - 3, e.aim.y * 6 - 2, 6, 4);
    c.strokeStyle = '#799586';
    c.beginPath();
    c.moveTo(-17, 9);
    c.lineTo(-10, 18);
    c.moveTo(17, 9);
    c.lineTo(10, 18);
    c.stroke();
  } else {
    c.fillStyle = '#283a33';
    c.fillRect(-15, -16, 30, 32);
    c.strokeStyle = '#8e9c84';
    c.lineWidth = 1.5;
    c.strokeRect(-15, -16, 30, 32);
    c.fillStyle = color;
    c.fillRect(-11, -12, 22, 4);
    c.fillStyle = '#71806c';
    c.fillRect(-13, 10, 26, 6);
    c.rotate(Math.atan2(e.aim.y, e.aim.x));
    c.fillStyle = '#bba184';
    c.fillRect(3, -5, 20, 10);
    c.fillStyle = '#27392f';
    c.fillRect(12, -3, 6, 6);
    c.rotate(-Math.atan2(e.aim.y, e.aim.x));
  }
  if (boss || e.hp < e.maxHp) {
    const w = boss ? 96 : 34,
      y = boss ? -52 : -28;
    c.fillStyle = '#27382e';
    c.fillRect(-w / 2, y, w, 3);
    c.fillStyle = color;
    c.fillRect(-w / 2, y, w * clamp(e.hp / e.maxHp, 0, 1), 3);
  }
  if (e.state === 'transition' && !reduced) {
    c.strokeStyle = '#e7c28a';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(0, 0, 62 + (1.1 - e.timer) * 25, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
