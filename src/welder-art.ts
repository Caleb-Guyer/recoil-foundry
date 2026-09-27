import type { Enemy, Game } from './game.ts';
import { WELD_LIFE, WELD_TELL } from './welder.ts';

export function drawWelds(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  for (const s of g.welder.seams) {
    const live = s.age >= WELD_TELL;
    c.globalAlpha = live ? Math.min(1, (WELD_TELL + WELD_LIFE - s.age) * 3) : 0.85;
    c.strokeStyle = live ? '#ffc589' : '#eb9861';
    c.lineWidth = live ? 9 : 3;
    c.setLineDash(live ? [] : [8, 5]);
    c.beginPath();
    c.moveTo(s.a.x, s.a.y);
    c.lineTo(s.b.x, s.b.y);
    c.stroke();
    if (live) {
      c.strokeStyle = '#fff2c7';
      c.lineWidth = 2;
      c.stroke();
      if (!reduced) {
        c.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          const t = (i + 0.5) / 6,
            length = 5 + ((s.age * 23 + i * 3) % 13);
          const x = s.a.x + (s.b.x - s.a.x) * t,
            y = s.a.y + (s.b.y - s.a.y) * t;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + s.normal.x * length, y + s.normal.y * length);
          c.stroke();
        }
      }
    }
  }
  c.globalAlpha = 0.9;
  c.setLineDash([5, 5]);
  c.strokeStyle = '#eb9861';
  c.lineWidth = 2;
  for (const b of g.welder.barriers) {
    c.strokeRect(b.x - 12, b.y - 42, 24, 84);
    c.fillStyle = '#eb9861';
    c.fillRect(b.x - 12, b.y + 40, 24 * Math.min(1, b.age / WELD_TELL), 3);
  }
  c.setLineDash([]);
  for (const p of g.props.items)
    if (p.welded) {
      c.save();
      c.translate(p.body.position.x, p.body.position.y);
      c.rotate(p.body.angle);
      c.strokeStyle = '#eb9861';
      c.lineWidth = 2;
      c.strokeRect(-12, -42, 24, 84);
      c.beginPath();
      c.moveTo(-8, -34);
      c.lineTo(8, 34);
      c.stroke();
      c.restore();
    }
  c.restore();
}

export function drawWelder(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const p = e.body.position,
    open = e.state === 'recover',
    tell = e.state === 'windup';
  if (tell && e.welder?.attack === 'arc') {
    c.save();
    c.strokeStyle = '#eeaa75';
    c.lineWidth = 1.5;
    c.setLineDash([6, 6]);
    const angle = Math.atan2(e.aim.y, e.aim.x);
    for (const spread of [-0.22, 0, 0.22]) {
      const end = g.lineEnd(
        p,
        { x: p.x + Math.cos(angle + spread) * 850, y: p.y + Math.sin(angle + spread) * 850 },
        5,
      );
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.restore();
  }
  c.save();
  c.translate(p.x, p.y);
  c.scale(e.facing || 1, 1);
  c.globalAlpha = e.spawn > 0 ? 0.6 : 1;
  c.fillStyle = '#262c2d';
  c.strokeStyle = '#947a64';
  c.lineWidth = 2;
  // Twin bottles, low tracked chassis, forward helmet and articulated torch.
  for (const x of [-29, -17]) {
    c.fillRect(x, -34, 9, 47);
    c.strokeRect(x, -34, 9, 47);
  }
  c.fillStyle = '#3b3c36';
  c.fillRect(-29, 17, 58, 13);
  c.strokeRect(-29, 17, 58, 13);
  c.strokeStyle = '#a68e71';
  for (let x = -23; x < 27; x += 10) {
    c.beginPath();
    c.moveTo(x, 20);
    c.lineTo(x - 3, 28);
    c.stroke();
  }
  c.fillStyle = e.flash > 0 ? '#fff0d5' : '#554b3b';
  c.fillRect(-15, -22, 37, 38);
  c.strokeRect(-15, -22, 37, 38);
  c.fillStyle = '#151e21';
  c.fillRect(-9, -29, 35, 23);
  c.strokeRect(-9, -29, 35, 23);
  c.fillStyle = tell ? '#fff0c0' : '#e7a05b';
  c.fillRect(6, -23, 16, 4);
  c.fillStyle = open ? '#ffc589' : '#292e2d';
  c.fillRect(-10, -1, 24, 13);
  c.strokeStyle = open ? '#ffcf8b' : '#bc9268';
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(15, -3);
  c.lineTo(31, 1);
  c.lineTo(39, -12);
  c.stroke();
  c.strokeStyle = '#728482';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-25, -15);
  c.quadraticCurveTo(-40, 24, 30, 12);
  c.lineTo(38, -8);
  c.stroke();
  if (tell) {
    c.fillStyle = '#d9f8ef';
    c.fillRect(36, -17, 6, 7);
    if (!reduced) {
      c.strokeStyle = '#fce5a7';
      c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = g.time * 5 + i * 1.7;
        c.beginPath();
        c.moveTo(39, -17);
        c.lineTo(39 + Math.cos(a) * 12, -17 + Math.sin(a) * 12);
        c.stroke();
      }
    }
  }
  if (open) {
    c.strokeStyle = '#ffc589';
    c.lineWidth = 2;
    for (const x of [-8, 1, 10]) {
      c.beginPath();
      c.moveTo(x, -1);
      c.lineTo(x, -8);
      c.stroke();
    }
  }
  c.restore();
  c.fillStyle = '#483b32';
  c.fillRect(p.x - 34, p.y - 46, 68, 4);
  c.fillStyle = open ? '#ffd49a' : '#d79863';
  c.fillRect(p.x - 34, p.y - 46, 68 * Math.max(0, e.hp / e.maxHp), 4);
}
