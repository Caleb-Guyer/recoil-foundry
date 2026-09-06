import { Game, WORLD, ENEMY_COLORS } from './game.ts';
import { clamp, direction, WEAPONS } from './rules.ts';
import type { Vec } from './rules.ts';
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  game: Game;
  width = 1280;
  height = 720;
  scale = 1;
  camera = { x: 0, y: 100 };
  reduced = false;
  frame = 0;
  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.game = game;
    this.resize();
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.scale = Math.max(0.55, this.height / 820);
  }
  toWorld(x: number, y: number): Vec {
    return { x: x / this.scale + this.camera.x, y: y / this.scale + this.camera.y };
  }
  path(vertices: Vec[]) {
    const c = this.ctx;
    c.beginPath();
    vertices.forEach((v, i) => (i ? c.lineTo(v.x, v.y) : c.moveTo(v.x, v.y)));
    c.closePath();
  }
  line(a: Vec, b: Vec, color: string, width = 1) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  circle(x: number, y: number, r: number, color: string, fill = false, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.lineWidth = width;
    if (fill) {
      c.fillStyle = color;
      c.fill();
    } else {
      c.strokeStyle = color;
      c.stroke();
    }
  }
  text(text: string, x: number, y: number, color = '#6d8190', size = 12) {
    const c = this.ctx;
    c.font = `${size}px "Courier New", monospace`;
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  draw() {
    const c = this.ctx,
      g = this.game;
    this.frame++;
    const ratio = this.canvas.width / this.width;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    c.fillStyle = '#151a1d';
    c.fillRect(0, 0, this.width, this.height);
    const viewW = this.width / this.scale,
      viewH = this.height / this.scale;
    const desiredX = clamp(g.player.position.x - viewW * 0.37, 0, Math.max(0, WORLD.width - viewW));
    const targetY = clamp(g.player.position.y - viewH * 0.62, 40, Math.max(40, 880 - viewH));
    this.camera.x += (desiredX - this.camera.x) * 0.09;
    this.camera.y += (targetY - this.camera.y) * 0.08;
    if (g.mode === 'title') {
      this.camera.x = 340;
      this.camera.y = 70;
    }
    c.save();
    if (!this.reduced && g.shake > 0.2)
      c.translate(Math.sin(this.frame * 2.4) * g.shake, Math.cos(this.frame * 1.8) * g.shake * 0.5);
    c.scale(this.scale, this.scale);
    c.translate(-this.camera.x, -this.camera.y);
    for (const b of g.terrain) {
      if (b.bounds.max.x < 0 || b.bounds.min.x > WORLD.width) continue;
      this.path(b.vertices);
      c.fillStyle = '#242c30';
      c.fill();
      c.strokeStyle = '#3c505b';
      c.lineWidth = 1;
      c.stroke();
      const top = b.bounds.min.y;
      if (top > 0) {
        this.line({ x: b.bounds.min.x, y: top }, { x: b.bounds.max.x, y: top }, '#647882', 2);
      }
    }
    this.drawExit();
    for (const p of g.props) {
      c.save();
      c.translate(p.body.position.x, p.body.position.y);
      c.rotate(p.body.angle);
      const size = Math.sqrt(p.body.area),
        half = size / 2;
      c.fillStyle = g.held === p ? '#2d5049' : '#283e45';
      c.strokeStyle = g.held === p ? '#9cf9dc' : p.launched ? '#79baa9' : '#68848b';
      c.lineWidth = 1.5;
      c.fillRect(-half, -half, size, size);
      c.strokeRect(-half, -half, size, size);
      c.restore();
    }
    for (const d of g.drops) {
      const y = d.pos.y + Math.sin(d.phase * 4) * 3;
      this.circle(d.pos.x, y, 16, d.type === 'health' ? '#79bba1' : '#4d817c');
      this.circle(d.pos.x, y, 10, d.type === 'health' ? '#b0f2b6' : '#8bf4d8', true);
      this.line({ x: d.pos.x - 4, y }, { x: d.pos.x + 4, y }, '#173330', 2);
      if (d.type === 'health')
        this.line({ x: d.pos.x, y: y - 4 }, { x: d.pos.x, y: y + 4 }, '#173330', 2);
    }
    for (const e of g.enemies) {
      const pos = e.body.position,
        color = ENEMY_COLORS[e.type];
      c.save();
      if (e.type === 'drone' || e.type === 'boss') {
        this.circle(pos.x, pos.y, e.type === 'boss' ? 88 : 27, color, false, 0.7);
      }
      this.path(e.body.vertices);
      c.fillStyle = e.flash > 0 ? '#ffe4cb' : '#352c32';
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = e.type === 'boss' ? 3 : 1.8;
      c.stroke();
      const dir = direction(pos, g.player.position);
      this.circle(pos.x + dir.x * 8, pos.y + dir.y * 8, e.type === 'boss' ? 17 : 5, color, true);
      if (e.type === 'sentry' || e.type === 'drone' || e.type === 'boss') {
        this.line(
          { x: pos.x + dir.x * 12, y: pos.y + dir.y * 12 },
          {
            x: pos.x + dir.x * (e.type === 'boss' ? 75 : 34),
            y: pos.y + dir.y * (e.type === 'boss' ? 75 : 34),
          },
          color,
          e.type === 'boss' ? 8 : 4,
        );
        if (e.timer < 0.5) {
          c.setLineDash([5, 7]);
          this.line(pos, g.player.position, '#bb675a', 1);
          c.setLineDash([]);
        }
      }
      if (e.hp < e.maxHp) {
        const w = e.type === 'boss' ? 120 : 42;
        c.fillStyle = '#26313a';
        c.fillRect(pos.x - w / 2, e.body.bounds.min.y - 14, w, 4);
        c.fillStyle = color;
        c.fillRect(pos.x - w / 2, e.body.bounds.min.y - 14, (w * e.hp) / e.maxHp, 4);
      }
      c.restore();
    }
    this.drawPlayer();
    for (const b of g.beams) {
      if (b.color === 'explosion') {
        this.circle(b.from.x, b.from.y, b.width * (1 - b.life / 0.35), '#d9a2f7', false, 2);
        this.circle(b.from.x, b.from.y, b.width * (1 - b.life / 0.5), '#70476d', false, 1);
      } else {
        c.globalAlpha = Math.min(1, b.life * 12);
        this.line(b.from, b.to, b.color, b.width + 4);
        this.line(b.from, b.to, '#e8fff8', 1);
        c.globalAlpha = 1;
      }
    }
    for (const s of g.shots) {
      if (s.kind === 'grenade') {
        this.circle(s.pos.x, s.pos.y, 8, s.color, false, 2);
        this.circle(s.pos.x, s.pos.y, 3, '#f2d9ff', true);
      } else {
        this.line(
          { x: s.pos.x - s.vel.x * 0.65, y: s.pos.y - s.vel.y * 0.65 },
          s.pos,
          s.color,
          s.friendly ? 2.5 : 3,
        );
        this.circle(s.pos.x, s.pos.y, s.radius, s.color, true);
      }
    }
    for (const p of g.particles) {
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.color;
      c.fillRect(p.pos.x, p.pos.y, p.size, p.size);
    }
    c.globalAlpha = 1;
    if (g.mode === 'playing') {
      const a = g.aim;
      this.circle(a.x, a.y, 9, '#99d7c9', false, 1 / this.scale);
      this.line({ x: a.x - 15, y: a.y }, { x: a.x - 7, y: a.y }, '#c9eee0');
      this.line({ x: a.x + 7, y: a.y }, { x: a.x + 15, y: a.y }, '#c9eee0');
      this.line({ x: a.x, y: a.y - 15 }, { x: a.x, y: a.y - 7 }, '#c9eee0');
      this.line({ x: a.x, y: a.y + 7 }, { x: a.x, y: a.y + 15 }, '#c9eee0');
    }
    c.restore();
    const vignette = c.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.2,
      this.width / 2,
      this.height / 2,
      this.width * 0.8,
    );
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, '#030a1080');
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.width, this.height);
    if (g.mode === 'playing' && g.time - g.hurtAt < 0.3) {
      c.fillStyle = `rgba(233,85,73,${(0.3 - (g.time - g.hurtAt)) * 0.45})`;
      c.fillRect(0, 0, this.width, this.height);
    }
  }
  drawPlayer() {
    const g = this.game,
      c = this.ctx,
      p = g.player.position,
      d = direction(p, g.aim),
      a = Math.atan2(d.y, d.x);
    if (g.fieldActive) {
      this.circle(p.x, p.y, g.field === 'repulsor' ? 175 : 200, '#71cfb6', false, 1);
      c.fillStyle = '#79efc80c';
      c.beginPath();
      c.arc(p.x, p.y, g.field === 'repulsor' ? 175 : 200, 0, Math.PI * 2);
      c.fill();
      c.setLineDash([5, 12]);
      this.circle(p.x, p.y, g.field === 'repulsor' ? 163 : 185, '#84f8d4', false, 1);
      c.setLineDash([]);
      if (g.held) this.line(p, g.held.body.position, '#8cf6d4', 2);
    }
    c.save();
    if (g.time - g.hurtAt < 0.6) c.globalAlpha = 0.45 + Math.abs(Math.sin(g.time * 40)) * 0.55;
    this.path(g.player.vertices);
    c.fillStyle = '#76c9b4';
    c.fill();
    c.strokeStyle = '#c4fff0';
    c.lineWidth = 2;
    c.stroke();
    this.circle(p.x, p.y - 3, 9, '#152d34', true);
    this.circle(p.x + d.x * 3, p.y - 3 + d.y * 3, 4, '#c3fff0', true);
    c.save();
    c.translate(p.x, p.y - 3);
    c.rotate(a);
    c.fillStyle = '#e4d6b9';
    c.fillRect(9, -5, 25, 10);
    c.fillStyle = WEAPONS[g.weapon].color;
    c.fillRect(29, -6, 9, 12);
    c.fillStyle = '#24323a';
    c.fillRect(15, -2, 12, 4);
    c.restore();
    const bottom = g.player.bounds.max.y;
    this.line({ x: p.x - 10, y: bottom }, { x: p.x - 12, y: bottom + 4 }, '#b4f1dc', 4);
    this.line({ x: p.x + 10, y: bottom }, { x: p.x + 12, y: bottom + 4 }, '#b4f1dc', 4);
    c.restore();
  }
  drawExit() {
    const g = this.game,
      c = this.ctx,
      x = 2190,
      y = 748,
      color = g.clear ? '#9af6cf' : '#516873';
    c.fillStyle = '#142932';
    c.fillRect(x - 34, y - 53, 68, 116);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.strokeRect(x - 34, y - 53, 68, 116);
    c.setLineDash([4, 8]);
    c.beginPath();
    c.moveTo(x, y - 45);
    c.lineTo(x, y + 50);
    c.stroke();
    c.setLineDash([]);
    this.text('→', x - 14, y + 8, color, 30);
    if (g.clear) {
      this.circle(x, y, 70, '#54856e', false, 1);
      if (Math.hypot(g.player.position.x - x, g.player.position.y - y) < 150)
        this.text('[ E ]', x - 18, y - 70, color, 14);
    }
  }
}
