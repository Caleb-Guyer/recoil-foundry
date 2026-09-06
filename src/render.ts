import { Game, WORLD } from './game.ts';
import type { Enemy } from './game.ts';
import { ENEMY_STATS, CHARGE_TELL, HOP_TELL, attackAngles } from './enemies.ts';
import { clamp, direction } from './rules.ts';
import type { Vec } from './rules.ts';
import { AREAS, drawScenery, drawSurfaceDetails } from './areas.ts';
export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  game: Game;
  width = 1;
  height = 1;
  scale = 1;
  camera: Vec = { x: 0, y: 0 };
  reduced = false;
  last = 0;
  clock = 0;
  constructor(canvas: HTMLCanvasElement, game: Game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.game = game;
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    const d = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * d);
    this.canvas.height = Math.round(r.height * d);
    this.scale = clamp(r.height / 830, 0.55, 1.6);
  }
  toWorld(x: number, y: number): Vec {
    return { x: x / this.scale + this.camera.x, y: y / this.scale + this.camera.y };
  }
  reset() {
    this.camera = { x: 0, y: Math.max(0, WORLD.floor - this.height / this.scale + 90) };
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
  circle(p: Vec, r: number, color: string, fill = true, width = 1) {
    const c = this.ctx;
    c.beginPath();
    c.arc(p.x, p.y, r, 0, Math.PI * 2);
    c.lineWidth = width;
    if (fill) {
      c.fillStyle = color;
      c.fill();
    } else {
      c.strokeStyle = color;
      c.stroke();
    }
  }
  draw(now = performance.now()) {
    const c = this.ctx,
      g = this.game,
      dt = Math.min(0.05, (now - this.last) / 1000 || 1 / 60);
    this.last = now;
    this.clock += dt;
    const ratio = this.canvas.width / this.width;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const viewW = this.width / this.scale,
      viewH = this.height / this.scale;
    const lead = clamp((g.aim.x - g.player.position.x) * 0.1, -95, 125) + g.player.velocity.x * 5;
    const desiredX = clamp(
      g.player.position.x - viewW * 0.42 + lead,
      0,
      Math.max(0, WORLD.width - viewW),
    );
    const desiredY = clamp(g.player.position.y - viewH * 0.58, 0, Math.max(0, 835 - viewH));
    const follow = 1 - Math.exp(-dt * 9);
    this.camera.x += (desiredX - this.camera.x) * follow;
    this.camera.y += (desiredY - this.camera.y) * follow;
    if (g.mode === 'title') {
      this.camera.x = 200;
      this.camera.y = Math.max(0, 825 - viewH);
    }
    c.save();
    c.scale(this.scale, this.scale);
    drawScenery(c, g.level.area, this.camera, viewW, viewH);
    c.restore();
    c.save();
    if (!this.reduced && g.mode !== 'title') {
      const a = this.clock * 95,
        shake = g.shake;
      c.translate(
        Math.sin(a) * shake * 0.48 + g.kick.x,
        Math.cos(a * 1.3) * shake * 0.32 + g.kick.y,
      );
    }
    c.scale(this.scale, this.scale);
    c.translate(-this.camera.x, -this.camera.y);
    const palette = AREAS[g.level.area];
    for (const b of g.terrain) {
      if (b.bounds.max.x <= 0 || b.bounds.min.x >= WORLD.width || b.bounds.min.y < 0) continue;
      const x = b.bounds.min.x,
        y = b.bounds.min.y,
        w = b.bounds.max.x - x,
        h = b.bounds.max.y - y;
      c.fillStyle = palette.body;
      c.fillRect(x, y, w, h);
      c.fillStyle = palette.face;
      c.fillRect(x, y + 5, w, h - 5);
      this.line({ x, y }, { x: x + w, y }, palette.surface, 2);
      if (h >= 30 && y < WORLD.floor) {
        this.line({ x, y: y + 2 }, { x, y: y + h }, palette.edge);
        this.line({ x: x + w, y: y + 2 }, { x: x + w, y: y + h }, palette.edge);
        if (y + h < WORLD.floor) this.line({ x, y: y + h }, { x: x + w, y: y + h }, palette.edge);
      }
      drawSurfaceDetails(c, g.level.area, x, y, w, h);
    }
    this.drawExit();
    if (!this.reduced && !g.grounded && g.player.speed > 8) {
      g.trail.forEach((p, i) => {
        c.globalAlpha = (1 - i / 9) * 0.1;
        c.fillStyle = '#d1e2dd';
        c.fillRect(p.x - 11, p.y - 15, 22, 30);
      });
      c.globalAlpha = 1;
    }
    for (const e of g.enemies) {
      const p = e.body.position,
        size = ENEMY_STATS[e.kind].w;
      c.save();
      c.translate(p.x, p.y);
      if (e.spawn > 0) {
        c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
        c.strokeStyle = '#ed735d';
        c.lineWidth = 1.5;
        c.strokeRect(-size / 2 - 8, -size / 2 - 8, size + 16, size + 16);
      }
      const color =
        e.flash > 0
          ? '#fff5df'
          : e.kind === 'sniper'
            ? '#e9ac78'
            : e.kind === 'boss' && e.phase === 2
              ? '#ffbc83'
              : '#ee7965';
      if (e.kind === 'charger') {
        c.save();
        c.scale(e.aim.x < 0 ? -1 : 1, 1);
        const brace = e.state === 'windup' ? (1 - e.timer / CHARGE_TELL) * 5 : 0;
        c.translate(-brace, 0);
        c.fillStyle = '#392c29';
        c.beginPath();
        c.moveTo(-15, -16);
        c.lineTo(9, -16);
        c.lineTo(18, 0);
        c.lineTo(9, 16);
        c.lineTo(-15, 16);
        c.closePath();
        c.fill();
        this.line({ x: 8, y: -15 }, { x: 17, y: 0 }, color, 4);
        this.line({ x: 17, y: 0 }, { x: 8, y: 15 }, color, 4);
        c.fillStyle = e.state === 'recover' ? '#ffdfa2' : '#a65343';
        for (let i = 0; i < 3; i++) c.fillRect(-12 + i * 6, -9, 3, 18);
        if (e.state === 'rush' && !this.reduced) {
          this.line({ x: -20, y: -8 }, { x: -53, y: -8 }, '#a35948', 2);
          this.line({ x: -20, y: 8 }, { x: -41, y: 8 }, '#a35948', 2);
        }
        c.restore();
      } else if (e.kind === 'hopper') {
        const crouch = e.state === 'windup' ? 1 - e.timer / HOP_TELL : 0;
        c.save();
        c.translate(0, crouch * 5);
        c.scale(1 + crouch * 0.12, 1 - crouch * 0.28);
        c.fillStyle = '#392b2b';
        c.beginPath();
        c.moveTo(0, -17);
        c.lineTo(15, -4);
        c.lineTo(10, 12);
        c.lineTo(-10, 12);
        c.lineTo(-15, -4);
        c.closePath();
        c.fill();
        this.line({ x: -14, y: -4 }, { x: 0, y: -17 }, color, 2.5);
        this.line({ x: 0, y: -17 }, { x: 14, y: -4 }, color, 2.5);
        const spread = e.state === 'airborne' ? 8 : 0;
        for (const side of [-1, 1]) {
          this.line({ x: side * 9, y: 4 }, { x: side * (20 + spread), y: 9 - spread }, color, 3);
          this.line({ x: side * (20 + spread), y: 9 - spread }, { x: side * 16, y: 17 }, color, 3);
        }
        c.restore();
      } else if (e.kind === 'sniper') {
        c.fillStyle = '#392d29';
        c.fillRect(-15, -12, 30, 25);
        this.line({ x: -18, y: 16 }, { x: -10, y: -15 }, color, 3);
        this.line({ x: 18, y: 16 }, { x: 10, y: -15 }, color, 3);
        this.line({ x: -10, y: -15 }, { x: 10, y: -15 }, color, 2);
      } else if (e.kind === 'flyer') {
        this.circle({ x: 0, y: 0 }, 18, '#392a2a');
        this.circle({ x: 0, y: 0 }, 18, color, false, 2.5);
        this.line({ x: -26, y: -5 }, { x: -18, y: 2 }, color, 3);
        this.line({ x: 18, y: 2 }, { x: 26, y: -5 }, color, 3);
      } else {
        c.fillStyle = e.flash > 0 ? '#fff5df' : '#33282a';
        c.fillRect(-size / 2, -(e.kind === 'boss' ? 38 : 16), size, e.kind === 'boss' ? 76 : 32);
        c.fillStyle = color;
        if (e.kind === 'runner') {
          c.fillRect(-size / 2, -16, 5, 32);
          c.fillRect(size / 2 - 5, -16, 5, 32);
        } else {
          c.fillRect(-size / 2, -(e.kind === 'boss' ? 38 : 16), size, 4);
          c.fillRect(-size / 2, e.kind === 'boss' ? 34 : 12, size, 4);
        }
        if (e.kind === 'boss') {
          c.fillStyle = '#211c20';
          c.fillRect(-35, -24, 70, 48);
          this.circle({ x: 0, y: 0 }, 21, color, false, 3);
          for (let i = 0; i < 3; i++) {
            c.fillStyle = i <= e.phase ? '#ffd3a0' : '#683f37';
            c.fillRect(-15 + i * 12, -33, 6, 5);
          }
          if (e.phase > 0) {
            this.line({ x: -45, y: -20 }, { x: -54, y: -30 }, color, 3);
            this.line({ x: 45, y: -20 }, { x: 54, y: -30 }, color, 3);
          }
          if (e.state === 'transition')
            this.circle({ x: 0, y: 0 }, 48 + (1.2 - e.timer) * 30, '#ffd3a0', false, 2);
        }
      }
      const aim =
        e.kind === 'runner' || e.kind === 'hopper' ? direction(p, g.player.position) : e.aim;
      if (['shooter', 'flyer', 'sniper', 'boss'].includes(e.kind)) {
        c.save();
        c.rotate(Math.atan2(aim.y, aim.x));
        c.fillStyle = color;
        c.fillRect(
          e.kind === 'boss' ? 18 : 7,
          -3,
          e.kind === 'boss' ? 38 : e.kind === 'sniper' ? 30 : 22,
          e.kind === 'sniper' ? 4 : 6,
        );
        c.restore();
      }
      this.circle({ x: aim.x * 5, y: aim.y * 5 }, e.kind === 'boss' ? 8 : 4, color);
      if (e.hp < e.maxHp) {
        const w = e.kind === 'boss' ? 90 : 30;
        c.fillStyle = '#493632';
        c.fillRect(-w / 2, -size / 2 - 13, w, 3);
        c.fillStyle = color;
        c.fillRect(-w / 2, -size / 2 - 13, (w * e.hp) / e.maxHp, 3);
      }
      c.restore();
      this.drawTell(e);
      if ((e.kind === 'shooter' || e.kind === 'flyer') && e.timer < 0.4 && e.spawn === 0) {
        const length = 280;
        c.setLineDash([3, 10]);
        this.line(
          p,
          g.lineEnd(p, { x: p.x + e.aim.x * length, y: p.y + e.aim.y * length }),
          '#794239',
          1,
        );
        c.setLineDash([]);
        this.circle(
          {
            x: p.x + e.aim.x * 28,
            y: p.y + e.aim.y * 28,
          },
          3 + Math.sin(this.clock * 30) * 1.5,
          '#ffd7a0',
        );
      }
    }
    if (g.blast.life > 0) {
      const { pos, dir, life } = g.blast,
        base = Math.atan2(dir.y, dir.x);
      c.beginPath();
      c.moveTo(pos.x, pos.y);
      for (let i = 0; i <= 8; i++) {
        const a = base - Math.PI / 4 + (i * Math.PI) / 16;
        const end = g.lineEnd(pos, { x: pos.x + Math.cos(a) * 130, y: pos.y + Math.sin(a) * 130 });
        c.lineTo(end.x, end.y);
      }
      c.closePath();
      c.fillStyle = `rgba(242,184,116,${life * 1.8})`;
      c.fill();
    }
    this.drawPlayer();
    for (const s of g.shots) {
      if (s.friendly) {
        this.line(
          { x: s.pos.x - s.vel.x * 0.55, y: s.pos.y - s.vel.y * 0.55 },
          s.pos,
          s.fragment
            ? '#bea88b'
            : s.charged
              ? '#eff5b5'
              : s.bankGrowth > 0 && s.banks > 0
                ? '#a1e0c3'
                : '#f6d49a',
          s.radius * 1.15 + (s.charged ? 1 : 0),
        );
        this.circle(s.pos, s.radius, '#fff2d5');
      } else {
        if (Math.hypot(s.vel.x, s.vel.y) > 12) this.line(s.prev, s.pos, '#ffd3a0', 2);
        this.circle(s.pos, 6, '#ee745f', false, 2);
        this.circle(s.pos, 2, '#ffcdb4');
      }
    }
    for (const p of g.particles) {
      c.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'ring') this.circle(p.pos, p.size * (1 - p.life / p.max), p.color, false, 1.5);
      else if (p.kind === 'shell') {
        c.save();
        c.translate(p.pos.x, p.pos.y);
        c.rotate((1 - p.life / p.max) * 9);
        c.fillStyle = p.color;
        c.fillRect(-3, -1, 6, 2);
        c.restore();
      } else
        this.line(
          p.pos,
          { x: p.pos.x - p.vel.x * 1.7, y: p.pos.y - p.vel.y * 1.7 },
          p.color,
          p.size,
        );
    }
    c.globalAlpha = 1;
    if (g.mode === 'playing') {
      const a = g.aim,
        r = 6 + g.muzzle * 70;
      this.circle(a, r, '#dce8e1', false, 1 / this.scale);
      for (const sign of [-1, 1]) {
        this.line(
          { x: a.x + sign * (r + 4), y: a.y },
          { x: a.x + sign * (r + 8), y: a.y },
          '#c4d1cc',
          1 / this.scale,
        );
        this.line(
          { x: a.x, y: a.y + sign * (r + 4) },
          { x: a.x, y: a.y + sign * (r + 8) },
          '#c4d1cc',
          1 / this.scale,
        );
      }
      if (g.clear && 1870 > this.camera.x + viewW - 80) {
        const x = this.camera.x + viewW - 45,
          y = this.camera.y + viewH / 2;
        this.line({ x: x - 12, y: y - 8 }, { x, y }, '#96d4c2', 2);
        this.line({ x, y }, { x: x - 12, y: y + 8 }, '#96d4c2', 2);
      }
    }
    c.restore();
    if (g.mode === 'playing' && g.time - g.hurtAt < 0.2) {
      c.fillStyle = 'rgba(222,64,44,' + (0.2 - (g.time - g.hurtAt)) * 0.28 + ')';
      c.fillRect(0, 0, this.width, this.height);
    }
  }
  drawTell(e: Enemy) {
    if (e.spawn > 0 || e.state !== 'windup') return;
    const c = this.ctx,
      g = this.game,
      p = e.body.position;
    if (e.kind === 'sniper') {
      const end = g.lineEnd(p, { x: p.x + e.aim.x * 1450, y: p.y + e.aim.y * 1450 });
      const locked = e.timer <= 0.32;
      c.setLineDash(locked ? [] : [7, 7]);
      this.line(p, end, locked ? '#ffdda1' : '#946d51', locked ? 1.5 : 1);
      c.setLineDash([]);
      this.circle(end, locked ? 4 : 2, '#ffdda1', false, 1);
    } else if (e.kind === 'charger') {
      const end = g.lineEnd(p, { x: p.x + e.aim.x * 180, y: p.y });
      c.setLineDash([6, 8]);
      this.line(p, end, '#af6650', 1.5);
      c.setLineDash([]);
      this.line({ x: end.x - e.aim.x * 9, y: end.y - 6 }, end, '#f8b480', 2);
      this.line({ x: end.x - e.aim.x * 9, y: end.y + 6 }, end, '#f8b480', 2);
    } else if (e.kind === 'boss') {
      const angles = attackAngles(e.attack, Math.atan2(e.aim.y, e.aim.x));
      c.setLineDash([3, 12]);
      for (const a of angles) {
        const end = g.lineEnd(p, { x: p.x + Math.cos(a) * 380, y: p.y + Math.sin(a) * 380 });
        this.line(p, end, e.timer <= 0.3 ? '#c38a63' : '#814a3d', 1);
      }
      c.setLineDash([]);
      this.circle(p, 47 - e.timer * 8, '#f7bd83', false, 2);
    }
  }
  drawPlayer() {
    const g = this.game,
      c = this.ctx,
      p = g.player.position,
      d = direction(p, g.aim),
      a = Math.atan2(d.y, d.x),
      squash = this.reduced ? 0 : g.land / 0.13;
    c.save();
    c.translate(p.x, p.y);
    if (g.time - g.hurtAt < 0.75) c.globalAlpha = 0.4 + Math.abs(Math.sin(g.time * 28)) * 0.6;
    c.save();
    c.rotate(clamp(g.player.velocity.x * 0.012, -0.18, 0.18));
    c.scale(1 + squash * 0.16, 1 - squash * 0.16);
    c.fillStyle = '#e7e8db';
    c.beginPath();
    c.roundRect(-13, -18, 26, 31, 4);
    c.fill();
    c.fillStyle = '#172125';
    c.fillRect(-8, -10, 16, 7);
    c.fillStyle = '#9bcfc1';
    c.fillRect(d.x > 0 ? 3 : -6, -9, 3, 5);
    const stride = g.grounded ? Math.sin(p.x * 0.14) * 3 : 2;
    c.fillStyle = '#a6b4ae';
    c.fillRect(-10, 10, 7, 8 + stride);
    c.fillRect(3, 10, 7, 8 - stride);
    c.restore();
    c.translate(0, -3);
    c.rotate(a);
    const kick = (g.muzzle / 0.065) * 5;
    c.fillStyle = '#899894';
    c.fillRect(5 - kick, -5, 22, 10);
    c.fillStyle = '#e4e5d8';
    c.fillRect(8 - kick, -4, 19, 7);
    if (g.mods.includes('burst')) {
      c.fillStyle = '#658b7c';
      for (let i = 0; i < 3; i++) c.fillRect(9 - kick + i * 5, -3, 2, 4);
    }
    if (g.mods.includes('backblast')) {
      c.fillStyle = '#ccac79';
      c.fillRect(2 - kick, -5, 3, 10);
    }
    if (g.landingReady) {
      this.circle({ x: 17 - kick, y: 0 }, 10, 'rgba(219,237,168,0.15)');
      c.fillStyle = '#e5efa7';
      c.fillRect(9 - kick, -3, 15, 3);
    }
    c.fillStyle = '#333c3c';
    c.fillRect(
      24 - kick,
      -5,
      g.mods.includes('magnum') ? 12 : 8,
      g.mods.includes('scatter') ? 13 : 10,
    );
    if (g.mods.includes('rapid')) {
      c.fillStyle = '#718d83';
      c.fillRect(9 - kick, 5, 5, 5);
    }
    if (g.muzzle > 0) {
      c.globalAlpha = g.muzzle / 0.065;
      c.fillStyle = g.chargedFlash ? '#f0f8b9' : '#ffe6b1';
      c.beginPath();
      c.moveTo(29, -7);
      c.lineTo(49 + (g.chargedFlash ? 15 : 0) + Math.random() * 8, 0);
      c.lineTo(29, 7);
      c.lineTo(34, 0);
      c.fill();
    }
    c.restore();
  }
  drawExit() {
    const c = this.ctx,
      g = this.game,
      x = 1930,
      y = WORLD.floor;
    c.fillStyle = g.clear ? '#213832' : '#1b2326';
    c.fillRect(x - 36, y - 111, 72, 111);
    c.fillStyle = g.clear ? '#9bd9c2' : '#414e51';
    c.fillRect(x - 36, y - 111, 3, 111);
    c.fillRect(x + 33, y - 111, 3, 111);
    if (g.clear) {
      c.globalAlpha = 0.7 + Math.sin(this.clock * 3) * 0.2;
      this.line({ x: x - 10, y: y - 63 }, { x: x + 7, y: y - 52 }, '#b8f0d6', 2);
      this.line({ x: x + 7, y: y - 52 }, { x: x - 10, y: y - 41 }, '#b8f0d6', 2);
      c.globalAlpha = 1;
    } else {
      this.line({ x: x - 8, y: y - 63 }, { x: x + 8, y: y - 47 }, '#647374', 2);
      this.line({ x: x + 8, y: y - 63 }, { x: x - 8, y: y - 47 }, '#647374', 2);
    }
  }
}
