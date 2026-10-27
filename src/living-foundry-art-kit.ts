import type { Vec } from './rules.ts';

export const FOUNDRY_TAU = Math.PI * 2;
export const unit = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
export function foundryPolygon(
  c: CanvasRenderingContext2D,
  points: readonly number[],
  color: string,
) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fill();
}
export function foundryLine(
  c: CanvasRenderingContext2D,
  points: readonly number[],
  color: string,
  width = 2,
) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.stroke();
}
export function foundryWheel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  angle: number,
  rim: string,
  hub: string,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = hub;
  c.beginPath();
  c.arc(0, 0, radius, 0, FOUNDRY_TAU);
  c.fill();
  c.strokeStyle = rim;
  c.lineWidth = Math.max(3, radius * 0.13);
  c.beginPath();
  c.arc(0, 0, radius * 0.88, 0, FOUNDRY_TAU);
  c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i * FOUNDRY_TAU) / 6;
    foundryLine(
      c,
      [
        Math.cos(a) * radius * 0.25,
        Math.sin(a) * radius * 0.25,
        Math.cos(a) * radius * 0.77,
        Math.sin(a) * radius * 0.77,
      ],
      rim,
      Math.max(2, radius * 0.09),
    );
  }
  c.fillStyle = rim;
  c.beginPath();
  c.arc(0, 0, radius * 0.19, 0, FOUNDRY_TAU);
  c.fill();
  c.restore();
}
/** Fixed panel count: this is a structural truss, not a viewport-sized texture loop. */
export function foundryTruss(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  panels: number,
  face: string,
  edge: string,
) {
  c.fillStyle = face;
  c.fillRect(x, y, width, height);
  foundryLine(c, [x, y + 4, x + width, y + 4], edge, 4);
  foundryLine(c, [x, y + height - 4, x + width, y + height - 4], edge, 4);
  for (let i = 0; i < panels; i++) {
    const left = x + (i * width) / panels,
      right = x + ((i + 1) * width) / panels;
    foundryLine(
      c,
      [left, y + height - 5, (left + right) / 2, y + 6, right, y + height - 5],
      edge,
      3,
    );
  }
}
export function foundryGlow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: readonly [number, number, number],
  strength: number,
) {
  const a = unit(strength);
  if (a <= 0) return;
  const glow = c.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(${color.join(',')},${a})`);
  glow.addColorStop(1, `rgba(${color.join(',')},0)`);
  c.fillStyle = glow;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
export function foundryLamp(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  power: number,
  warm = false,
) {
  c.fillStyle = warm ? '#38312a' : '#263b41';
  c.fillRect(x - 15, y - 4, 30, 8);
  c.fillStyle = warm ? '#4a382c' : '#33484b';
  c.fillRect(x - 10, y, 20, 3);
  c.save();
  c.globalAlpha = unit(power);
  c.fillStyle = warm ? '#9d7850' : '#7c9791';
  c.fillRect(x - 10, y, 20, 3);
  c.restore();
}
/** A whole screen is always covered, even in an ultrawide or zoomed-out view. */
export function foundrySky(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  top: string,
  bottom: string,
) {
  const sky = c.createLinearGradient(0, 0, 0, Math.max(1, height));
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
}
export function foundryLayer(
  c: CanvasRenderingContext2D,
  camera: Vec,
  depth: number,
  draw: () => void,
) {
  c.save();
  c.translate(-camera.x * depth, -camera.y * depth * 0.65);
  draw();
  c.restore();
}
