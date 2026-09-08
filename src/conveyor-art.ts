import type { Game } from './game.ts';

export function drawConveyors(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  for (const b of g.conveyors.items) {
    c.save();
    c.beginPath();
    c.rect(b.x, b.y, b.w, 20);
    c.clip();
    c.fillStyle = '#111b1e';
    c.fillRect(b.x, b.y, b.w, 20);
    c.strokeStyle = '#536360';
    c.lineWidth = 1.5;
    const phase = reduced ? 0 : g.time * b.speed * 60;
    for (let x = b.x + 8; x < b.x + b.w; x += 18) {
      c.beginPath();
      c.arc(x, b.y + 10, 6, 0, Math.PI * 2);
      c.stroke();
      const angle = phase / 6;
      c.beginPath();
      c.moveTo(x - Math.cos(angle) * 4, b.y + 10 - Math.sin(angle) * 4);
      c.lineTo(x + Math.cos(angle) * 4, b.y + 10 + Math.sin(angle) * 4);
      c.stroke();
    }
    c.fillStyle = '#b49d66';
    c.fillRect(b.x, b.y, b.w, 2);
    c.fillStyle = '#d0b778';
    const offset = ((phase % 18) + 18) % 18;
    for (let x = b.x - 18 + offset; x < b.x + b.w; x += 18) c.fillRect(x, b.y, 5, 2);
    c.strokeStyle = '#c8ad70';
    c.lineWidth = 2;
    for (let x = b.x + 34; x < b.x + b.w - 18; x += 64) {
      const sign = Math.sign(b.speed);
      c.fillStyle = '#182225';
      c.fillRect(x - 10, b.y + 4, 20, 13);
      c.beginPath();
      c.moveTo(x - sign * 4, b.y + 6);
      c.lineTo(x + sign * 2, b.y + 10);
      c.lineTo(x - sign * 4, b.y + 14);
      c.stroke();
    }
    c.fillStyle = '#85908a';
    for (const x of [b.x, b.x + b.w - 4]) c.fillRect(x, b.y + 3, 4, 15);
    c.restore();
  }
}
