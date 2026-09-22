import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { drawScenery } from '../src/areas.ts';
import { seeded } from '../src/rules.ts';
import type { Vec } from '../src/rules.ts';

// Editorial cold open, separate from the unchanged, live-simulation combat takes.
export const INTRO_SECONDS = 4.8;
const SOURCE_SECONDS = 6;
const TIME_SCALE = INTRO_SECONDS / SOURCE_SECONDS;
export const FOOTSTEPS = [0.72, 1.24, 1.76, 2.28, 2.8, 3.32];
export const INTRO_AUDIO_TAIL = 0.28;
const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
const walkStart = FOOTSTEPS[0] - 0.26;
const strideLength = Math.PI / 0.14;
const walkSpeed = strideLength / 0.52;
const startX = (12 * Math.PI) / 0.14;

// Audio and animation share the same six heel plants, then settle onto both feet.
export function introWalk(t: number) {
  const last = FOOTSTEPS.at(-1)!;
  const x =
    startX +
    Math.max(0, Math.min(last - walkStart, t - walkStart)) * walkSpeed +
    (strideLength / 2) * smooth((t - last) / 0.26);
  const stride = Math.sin(x * 0.14) * 3;
  return { x, y: 436 - 18 - Math.abs(stride), stride, walking: t >= walkStart && t < last + 0.26 };
}
export interface OpeningMatch {
  player: Vec;
  scale: number;
  aimAngle: number;
  velocityX: number;
}

export class TrailerIntro {
  game = new Game();
  renderer: Renderer;
  match?: OpeningMatch;
  constructor(canvas: HTMLCanvasElement) {
    this.game.start('TRAILER-COLD-OPEN');
    this.renderer = new Renderer(canvas, this.game);
    this.game.grounded = true;
  }
  draw(t: number) {
    const seconds = t,
      pose = introWalk(t);
    const bridge = this.match ? smooth((seconds - 4.2) / 0.6) : 0;
    t /= TIME_SCALE;
    const r = this.renderer,
      c = r.ctx,
      w = r.width,
      h = r.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#050a0d';
    c.fillRect(0, 0, w, h);
    c.save();
    c.scale(w / 960, h / 540);
    const close = t >= 3.36;
    const push = close ? 2.9 + smooth((t - 3.36) / 2.64) * 0.12 : 1 + smooth(t / 3.36) * 0.045;
    const oldX = (close ? 340 : 480) + (pose.x - (close ? 392 : 480)) * push;
    const oldY = 350 + (pose.y - (close ? 402 : 350)) * push;
    const scale = push + ((this.match?.scale ?? push * 2) / 2 - push) * bridge;
    const anchorX = oldX + ((this.match?.player.x ?? oldX * 2) / 2 - oldX) * bridge;
    const anchorY = oldY + ((this.match?.player.y ?? oldY * 2) / 2 - oldY) * bridge;
    c.translate(anchorX, anchorY);
    c.scale(scale, scale);
    c.translate(-pose.x, -pose.y);
    drawScenery(c, 'docks', { x: 45 + t * 2, y: 360 }, 960, 540);

    // Closed shutter and overhead services use the existing loading-dock palette.
    c.fillStyle = '#19262c';
    c.fillRect(626, 167, 228, 272);
    c.fillStyle = '#0b151b';
    c.fillRect(639, 177, 202, 261);
    c.strokeStyle = '#26383e';
    c.lineWidth = 1;
    for (let y = 194; y < 438; y += 22) {
      c.beginPath();
      c.moveTo(643, y);
      c.lineTo(837, y);
      c.stroke();
    }
    c.fillStyle = '#16262d';
    c.fillRect(0, 87, 960, 9);
    c.fillRect(94, 95, 8, 343);
    c.fillRect(883, 95, 7, 343);
    c.fillStyle = '#24383e';
    c.fillRect(0, 436, 960, 3);
    c.fillStyle = '#16232b';
    c.fillRect(0, 439, 960, 110);
    c.strokeStyle = '#2b3b40';
    for (let x = -30; x < 990; x += 68) {
      c.beginPath();
      c.moveTo(x, 441);
      c.lineTo(x - 55, 540);
      c.stroke();
      c.fillStyle = '#35464a';
      c.fillRect(x + 5, 448, 9, 1);
    }

    const flicker = t > 4.58 && t < 4.76 ? 0.2 : t > 0.3 && t < 0.43 ? 0.45 : 1;
    const pool = c.createRadialGradient(400, 280, 2, 400, 340, 300);
    pool.addColorStop(0, `rgba(159,192,173,${0.2 * flicker})`);
    pool.addColorStop(1, 'rgba(130,180,170,0)');
    c.fillStyle = pool;
    c.fillRect(100, 70, 600, 400);
    c.fillStyle = '#445952';
    c.fillRect(367, 129, 68, 6);
    c.fillStyle = `rgba(190,209,184,${0.8 * flicker})`;
    c.fillRect(372, 133, 58, 2);

    const { x, y, walking } = pose;
    Matter.Body.setPosition(this.game.player, { x, y });
    Matter.Body.setVelocity(this.game.player, {
      x: walking ? 1.8 : (this.match?.velocityX ?? 0) * bridge,
      y: 0,
    });
    this.game.time = 20 + t;
    const lift = smooth((seconds - 3.74) / 0.52);
    const restAngle = Math.atan2(118 * (1 - lift), 150);
    const angle = restAngle + ((this.match?.aimAngle ?? 0) - restAngle) * bridge;
    this.game.aim = { x: x + Math.cos(angle) * 180, y: y + Math.sin(angle) * 180 };
    c.fillStyle = '#060d11';
    c.beginPath();
    c.ellipse(x + 3, 438, 31, 4, 0, 0, Math.PI * 2);
    c.fill();
    r.drawPlayer();

    // Grade the original game art into silhouettes; keep the light and eyes readable.
    c.fillStyle = `rgba(2,8,12,${0.43 - bridge * 0.31})`;
    c.fillRect(-100, -100, 1160, 740);
    const light = c.createRadialGradient(404, 360, 0, 404, 360, 190);
    light.addColorStop(0, `rgba(145,183,167,${0.11 * flicker})`);
    light.addColorStop(1, 'rgba(145,183,167,0)');
    c.fillStyle = light;
    c.fillRect(214, 170, 380, 380);
    // One distant warning light wakes up just before the gun rises.
    const red = smooth((t - 4.82) / 0.15);
    const warning = c.createRadialGradient(740, 163, 0, 740, 163, 74);
    warning.addColorStop(0, `rgba(239,111,79,${red * 0.25})`);
    warning.addColorStop(1, 'rgba(239,111,79,0)');
    c.fillStyle = warning;
    c.fillRect(666, 89, 148, 148);
    c.fillStyle = red ? `rgba(239,111,79,${red})` : '#39454a';
    c.fillRect(730, 161, 20, 3);
    for (let n = 0; n < 32; n++) {
      const dustX = 240 + ((n * 83.7 + t * (3 + (n % 3))) % 325);
      const dustY = 156 + ((n * 59.1 + t * 6) % 255);
      c.fillStyle = `rgba(184,206,190,${0.07 + (n % 4) * 0.022})`;
      c.fillRect(dustX, dustY, 0.7, 0.7);
    }
    c.restore();
    if (close) {
      const rim = c.createLinearGradient(w * 0.4, 0, w, 0);
      rim.addColorStop(0, 'rgba(166,49,26,0)');
      rim.addColorStop(1, `rgba(166,49,26,${smooth((t - 4.82) / 0.2) * 0.09})`);
      c.fillStyle = rim;
      c.fillRect(0, 0, w, h);
    }
    const vignette = c.createRadialGradient(
      w * 0.48,
      h * 0.64,
      h * 0.18,
      w * 0.48,
      h * 0.55,
      w * 0.65,
    );
    vignette.addColorStop(0, 'rgba(0,3,6,0)');
    vignette.addColorStop(1, `rgba(0,3,6,${0.72 - bridge * 0.5})`);
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
    c.fillStyle = `rgba(2,6,9,${1 - smooth(t / 0.65)})`;
    c.fillRect(0, 0, w, h);
    // The player matches the incoming gameplay frame; the real shot supplies the cut.
    return { player: { x: anchorX * 2, y: anchorY * 2 }, scale: scale * 2, aimAngle: angle };
  }
}

// CC0 Kenney footfalls with quiet original factory ambience and mechanical clicks.
export function introAudio(footsteps: readonly Float32Array[], sampleRate = 48000) {
  if (footsteps.length !== 5) throw new Error('Five distinct footstep recordings are required');
  const length = Math.ceil((INTRO_SECONDS + INTRO_AUDIO_TAIL) * sampleRate);
  const channels = [new Float32Array(length), new Float32Array(length)];
  const random = seeded('RF-FOOTSTEPS-AND-FACTORY');
  const add = (time: number, duration: number, pan: number, sample: (t: number) => number) => {
    const from = Math.round(time * sampleRate),
      count = Math.ceil(duration * sampleRate);
    for (let i = 0; i < count && from + i < length; i++) {
      const value = sample(i / sampleRate);
      channels[0][from + i] += value * Math.sqrt((1 - pan) / 2);
      channels[1][from + i] += value * Math.sqrt((1 + pan) / 2);
    }
  };
  let rumble = 0;
  add(0, INTRO_SECONDS + 0.24, 0, (t) => {
    rumble = rumble * 0.97 + (random() * 2 - 1) * 0.03;
    const envelope = smooth(t / 0.44) * (1 - smooth((t - INTRO_SECONDS + 0.08) / 0.32));
    return (
      envelope *
      (rumble * 0.035 +
        Math.sin(t * 2 * Math.PI * 74) * 0.008 +
        Math.sin(t * 2 * Math.PI * 111.3) * 0.004 +
        Math.sin(t * 2 * Math.PI * 148.2) * 0.002)
    );
  });
  for (const [index, time] of FOOTSTEPS.entries()) {
    const pan = -0.22 + index * 0.025;
    const sample = footsteps[[0, 3, 1, 4, 2, 0][index]];
    const gain = [0.72, 0.8, 0.77, 0.83, 0.94, 0.85][index];
    for (const [delay, level] of [
      [0, 1],
      [0.045, 0.09],
      [0.082, 0.045],
    ]) {
      add(
        time + delay,
        sample.length / 48000,
        delay ? -pan : pan,
        (t) => (sample[Math.floor(t * 48000)] ?? 0) * gain * level,
      );
    }
  }
  // Relay tick with the lamp, then a two-part mechanical gun click.
  for (const [time, level] of [
    [4.59, 0.07],
    [4.86, 0.12],
    [5.22, 0.16],
    [5.36, 0.1],
  ]) {
    add(
      time * TIME_SCALE,
      0.24,
      0.1,
      (t) =>
        level *
        Math.exp(-t * 50) *
        ((random() * 2 - 1) * 0.65 + Math.sin(t * 2 * Math.PI * 1460) * 0.35) *
        Math.min(1, t * 2200),
    );
  }
  return channels;
}
