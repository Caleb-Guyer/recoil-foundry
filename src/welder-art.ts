import type { Enemy, Game } from './game.ts';
import { WELD_LIFE, WELD_TELL } from './welder.ts';
import { drawMachineBody, drawMachineContacts } from './machine-breakdown-art.ts';

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

export function drawWelder(
  c: CanvasRenderingContext2D,
  g: Game,
  e: Enemy,
  reduced: boolean,
  portrait = false,
) {
  const p = e.body.position,
    open = e.state === 'recover',
    tell = e.state === 'windup';
  if (!portrait && tell && e.welder?.attack === 'arc') {
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
  c.globalAlpha = e.spawn > 0 ? 0.6 : 1;
  drawMachineBody(c, g, e, reduced || portrait);
  if (!portrait) {
    drawMachineContacts(c, g, e, reduced);
    c.fillStyle = '#483b32';
    c.fillRect(-34, -46, 68, 4);
    c.fillStyle = open ? '#ffd49a' : '#d79863';
    c.fillRect(-34, -46, 68 * Math.max(0, e.hp / e.maxHp), 4);
  }
  c.restore();
}
