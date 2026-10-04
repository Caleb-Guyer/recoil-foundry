import type { Enemy, Game } from './game.ts';
import { distance, type Vec } from './rules.ts';
import { projectileLights, type ProjectileLight } from './projectile-light.ts';
const AMBER = '#e8bb76',
  BLUE = '#6bb7ff';
export function drawEventEnemy(c: CanvasRenderingContext2D, e: Enemy): boolean {
  if (e.eventRole !== 'relay') return false;
  const p = e.body.position;
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = '#152028';
  c.strokeStyle = AMBER;
  c.lineWidth = 2;
  c.fillRect(-19, -17, 38, 33);
  c.strokeRect(-19, -17, 38, 33);
  c.beginPath();
  c.moveTo(2, -11);
  c.lineTo(-6, 1);
  c.lineTo(3, 1);
  c.lineTo(-2, 11);
  c.stroke();
  c.fillStyle = '#ffc67e';
  c.fillRect(12, -12, 3, 3);
  c.restore();
  return true;
}
export function drawAreaEvent(c: CanvasRenderingContext2D, g: Game) {
  const event = g.areaEvents;
  if (!event.active) return;
  c.save();
  // A steady shield identifies allies even with no color perception or motion.
  for (const ally of event.allies) {
    const p = ally.body.position;
    const y = ally.body.bounds.min.y - 13;
    c.globalAlpha =
      event.departingAt === null ? 1 : Math.max(0, 1 - (g.time - event.departingAt) / 3);
    c.beginPath();
    c.moveTo(p.x - 6, y - 5);
    c.lineTo(p.x + 6, y - 5);
    c.lineTo(p.x + 6, y + 1);
    c.lineTo(p.x, y + 7);
    c.lineTo(p.x - 6, y + 1);
    c.closePath();
    c.fillStyle = '#12202a';
    c.fill();
    c.strokeStyle = '#d2e5e9';
    c.lineWidth = 2;
    c.stroke();
  }
  c.globalAlpha = 1;
  for (const s of g.shots)
    if (s.allied && s.life > 0) {
      c.strokeStyle = '#6bb7ff';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(s.pos.x - s.vel.x * 0.7, s.pos.y - s.vel.y * 0.7);
      c.lineTo(s.pos.x, s.pos.y);
      c.stroke();
    }
  for (const e of g.enemies)
    if (e.eventRole === 'commander') {
      const p = e.body.position;
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(p.x - 15, p.y - 29);
      c.lineTo(p.x - 12, p.y - 39);
      c.lineTo(p.x, p.y - 32);
      c.lineTo(p.x + 12, p.y - 39);
      c.lineTo(p.x + 15, p.y - 29);
      c.stroke();
      c.fillStyle = AMBER;
      c.fillRect(p.x - 24, p.y - 45, 48 * Math.max(0, e.hp / e.maxHp), 3);
    }
  const p = event.site;
  if (event.fuseBox) {
    const p = event.fuseBox.body.position,
      live = !event.powered;
    c.save();
    c.translate(p.x, p.y);
    c.fillStyle = '#192527';
    c.strokeStyle = live ? AMBER : '#687278';
    c.lineWidth = 2;
    c.fillRect(-20, -20, 40, 40);
    c.strokeRect(-20, -20, 40, 40);
    c.strokeStyle = '#45575d';
    c.strokeRect(-15, -15, 30, 30);
    c.fillStyle = '#45575d';
    c.fillRect(-23, 17, 46, 3);
    c.fillStyle = live ? '#ffc67e' : '#26383d';
    c.fillRect(11, -12, 4, 4);
    c.strokeStyle = live ? '#ffc67e' : '#687278';
    c.beginPath();
    if (live) {
      c.moveTo(1, -12);
      c.lineTo(-7, 1);
      c.lineTo(2, 1);
      c.lineTo(-2, 12);
    } else {
      c.moveTo(-7, 3);
      c.lineTo(5, -6);
      c.moveTo(7, 3);
      c.lineTo(11, 3);
    }
    c.stroke();
    c.restore();
  }
  if (event.active === 'turf' && !event.cacheTaken && !event.state?.caches.includes(g.stage)) {
    c.fillStyle = '#192527';
    c.strokeStyle = event.cacheReady ? BLUE : '#555e64';
    c.lineWidth = 2;
    c.fillRect(p.x - 20, p.y - 14, 40, 30);
    c.strokeRect(p.x - 20, p.y - 14, 40, 30);
    c.beginPath();
    c.moveTo(p.x - 20, p.y - 4);
    c.lineTo(p.x + 20, p.y - 4);
    c.stroke();
    c.fillStyle = event.cacheReady ? '#b9e0ff' : '#555e64';
    c.fillRect(p.x - 3, p.y + 3, 6, 6);
  }
  if (event.active === 'lockdown') {
    const ready = event.terminalReady,
      done = event.hunted && !event.pending;
    c.fillStyle = '#192527';
    c.strokeStyle = done ? '#8dcac5' : ready ? AMBER : '#687278';
    c.lineWidth = 2;
    c.fillRect(p.x - 16, p.y - 46, 32, 28);
    c.strokeRect(p.x - 16, p.y - 46, 32, 28);
    c.beginPath();
    c.moveTo(p.x, p.y - 18);
    c.lineTo(p.x, p.y + 16);
    c.stroke();
    c.fillStyle = c.strokeStyle;
    if (ready) {
      // A raised illuminated switch suggests the existing jump interaction.
      c.beginPath();
      c.moveTo(p.x - 7, p.y - 30);
      c.lineTo(p.x, p.y - 38);
      c.lineTo(p.x + 7, p.y - 30);
      c.stroke();
      c.fillRect(p.x - 4, p.y - 26, 8, 3);
      if (distance(g.player.position, p) < 80) {
        c.beginPath();
        c.arc(p.x, p.y - 32, 25, 0, Math.PI * 2);
        c.stroke();
      }
    } else
      for (let i = 0; i < 3; i++) c.fillRect(p.x - 9 + i * 7, p.y - 35, 4, event.pending ? 10 : 4);
  }
  c.restore();
}
// Projectile pools reveal the actual world under the darkness mask. Their tint
// follows the ammunition; the same glow remains subtle in ordinary rooms.
const masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export function drawBlackout(
  c: CanvasRenderingContext2D,
  g: Game,
  camera: Vec,
  scale: number,
  width: number,
  height: number,
) {
  const lights = projectileLights(g, { ...camera, w: width / scale, h: height / scale });
  if (!g.areaEvents.dark) {
    drawProjectileGlow(c, lights, camera, scale, false);
    return;
  }
  let mask = masks.get(c.canvas);
  if (!mask) {
    mask = document.createElement('canvas');
    masks.set(c.canvas, mask);
  }
  const w = Math.ceil(width),
    h = Math.ceil(height);
  if (mask.width !== w || mask.height !== h) {
    mask.width = w;
    mask.height = h;
  }
  const m = mask.getContext('2d')!;
  m.globalCompositeOperation = 'source-over';
  m.clearRect(0, 0, w, h);
  m.fillStyle = 'rgba(0,3,7,0.985)';
  m.fillRect(0, 0, w, h);
  m.globalCompositeOperation = 'destination-out';
  const light = (pos: Vec, radius: number, strength: number) => {
    const x = (pos.x - camera.x) * scale,
      y = (pos.y - camera.y) * scale,
      r = radius * scale;
    const gradient = m.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
    gradient.addColorStop(0.35, 'rgba(0,0,0,' + strength * 0.65 + ')');
    gradient.addColorStop(1, 'transparent');
    m.fillStyle = gradient;
    m.fillRect(x - r, y - r, r * 2, r * 2);
  };
  light(g.player.position, 175, 0.92);
  if (g.areaEvents.fuseBox) light(g.areaEvents.site, 75, 0.8);
  if (g.muzzle > 0) light(g.player.position, 225, Math.min(0.6, g.muzzle * 4));
  for (const s of lights) light(s.pos, s.radius, s.strength);
  c.save();
  c.drawImage(mask, 0, 0, width, height);
  c.restore();
  drawProjectileGlow(c, lights, camera, scale, true);
}
function drawProjectileGlow(
  c: CanvasRenderingContext2D,
  lights: ProjectileLight[],
  camera: Vec,
  scale: number,
  dark: boolean,
) {
  c.save();
  c.globalCompositeOperation = 'screen';
  for (const light of lights) {
    const x = (light.pos.x - camera.x) * scale,
      y = (light.pos.y - camera.y) * scale,
      r = light.radius * scale;
    const glow = c.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, light.color + (dark ? '55' : '18'));
    glow.addColorStop(0.35, light.color + (dark ? '20' : '08'));
    glow.addColorStop(1, light.color + '00');
    c.globalAlpha = light.strength;
    c.fillStyle = glow;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.restore();
}
