import type { Game } from './game.ts';
import { distance } from './rules.ts';
import { drawCapacitor, drawCountershot } from './ballistics-art.ts';

export function drawTorch(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const t = g.torch;
  if (!t.equipped || !t.active || !['playing', 'paused'].includes(g.mode)) return;
  c.save();
  c.lineCap = 'round';
  const width = (g.gun.pellets > 1 ? 8 : 1.6) * (t.finisher ? 0.6 : 1);
  for (const path of [t.segments, t.rear])
    for (let i = 0; i < path.length; i++) {
      const s = path[i],
        len = distance(s.a, s.b),
        offset = s.muzzle ? Math.min(path === t.rear ? 17 : 31, len) : 0,
        a = { x: s.a.x + s.dir.x * offset, y: s.a.y + s.dir.y * offset },
        hot = s.enemy?.id === t.target ? t.heat : 0;
      c.beginPath();
      c.moveTo(a.x, a.y);
      c.lineTo(s.b.x, s.b.y);
      c.strokeStyle = '#ebad68';
      c.globalAlpha = reduced ? 0.13 : 0.19;
      c.lineWidth = width + 5.4;
      c.stroke();
      c.strokeStyle = hot > 0.6 ? '#fff0c7' : '#ffd59b';
      c.globalAlpha = 0.9;
      c.lineWidth = width + hot * 0.6;
      c.stroke();
      if (s.body || s.cable || s.anchor) {
        c.globalAlpha = 0.8;
        c.fillStyle = '#ffdfad';
        c.beginPath();
        c.arc(s.b.x, s.b.y, 2 + hot * 2, 0, Math.PI * 2);
        c.fill();
        if (!reduced) {
          const turn = g.time * 11;
          c.strokeStyle = '#d99c61';
          c.lineWidth = 1;
          c.beginPath();
          for (let n = 0; n < 3; n++) {
            const a = turn + (n * Math.PI * 2) / 3,
              r = 5 + hot * 3;
            c.moveTo(s.b.x + Math.cos(a) * 4, s.b.y + Math.sin(a) * 4);
            c.lineTo(s.b.x + Math.cos(a) * r, s.b.y + Math.sin(a) * r);
          }
          c.stroke();
        }
      }
    }
  c.restore();
}

export function drawTorchWeapon(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  c.fillStyle = '#719084';
  c.fillRect(5, -5, 22, 10);
  c.fillStyle = '#e0e4cf';
  c.fillRect(8, -4, 15, 6);
  c.fillStyle = '#405c51';
  c.fillRect(9, 4, 10, 3);
  c.fillStyle = '#958e75';
  c.fillRect(22, -3, 10, 6);
  c.fillStyle = '#d1b181';
  for (const x of [23, 27]) c.fillRect(x, -5, 2, 10);
  c.fillStyle = g.torch.active ? '#ffe0a3' : '#5b7470';
  const aperture = g.gun.pellets > 1 ? 5 : 2;
  c.fillRect(31, -aperture, 3, aperture * 2);
  if (g.mods.includes('prism-array')) {
    c.strokeStyle = '#ddc597';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(27, 0);
    c.lineTo(35, -5);
    c.moveTo(27, 0);
    c.lineTo(35, 5);
    c.stroke();
  }
  if (g.mods.includes('pulse-chamber')) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = g.torch.active && (g.torch.finisher ? i === 2 : i < 2) ? '#ffe7b3' : '#658479';
      c.fillRect(9 + i * 5, -7, 3, 2);
    }
  }
  if (g.mods.includes('charge-lens')) {
    const charge = g.torch.chargeProgress;
    c.strokeStyle = '#b8a178';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(28, 0, 7, -Math.PI / 2, Math.PI * 1.5);
    c.stroke();
    c.strokeStyle = '#ffe3a5';
    c.beginPath();
    c.arc(28, 0, 7, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
    c.stroke();
    if (charge > 0) {
      c.globalAlpha = 0.3 + charge * 0.6;
      c.fillStyle = '#ffe3a5';
      c.beginPath();
      c.arc(33, 0, 1.5 + charge * 2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }
  if (g.mods.includes('thermal-runaway')) {
    c.fillStyle = g.torch.heat > 0.5 ? '#ffc97d' : '#9c805c';
    c.fillRect(15, -6, 5, 2);
  }
  if (g.gun.rearVolley) {
    c.fillStyle = '#9da78e';
    c.fillRect(-18, -2, 20, 4);
  }
  if (g.landingReady || g.evolutions.slingReady) {
    c.fillStyle = '#dbebb0';
    c.fillRect(10, -6, 10, 1);
  }
  drawCapacitor(c, g);
  drawCountershot(c, g, reduced);
  c.restore();
}
