import { drawMagnets, drawReclamationEnemy } from './reclamation-art.ts';
import { drawCoolant, drawCoolingEnemy } from './cooling.ts';
import { drawTurbine, drawBlade } from './turbine-art.ts';
import { drawInterceptor } from './interceptor-art.ts';
import { drawRivalShot } from './interceptor-effects.ts';
import { drawDemolition } from './demolition-art.ts';
import { drawPortals } from './portal-art.ts';
import { drawDetourDoor } from './detour-art.ts';
import { drawRouteExits } from './route-art.ts';
import { drawCrane } from './crane-art.ts';
import { drawKiln } from './kiln-art.ts';
import { drawBossSignal } from './boss-signals.ts';
import { drawReinforcementDoors } from './reinforcement-art.ts';
import { Game, WORLD, EXTRACTION_DURATION } from './game.ts';
import type { Enemy } from './game.ts';
import {
  ENEMY_STATS,
  CHARGE_TELL,
  HOP_TELL,
  LOADER_TELL,
  PRESS_LOCK,
  SHIELD_TURN,
  TWIN_TELL,
  TWIN_LOCK,
  VOLATILE_TELL,
  VOLATILE_RADIUS,
  isBoss,
  attackAngles,
} from './enemies.ts';
import { clamp, direction, distance } from './rules.ts';
import type { Vec } from './rules.ts';
import { AREAS, drawScenery, drawSurfaceDetails } from './areas.ts';
import { PROP_STATS } from './props.ts';
import { drawCargoCables } from './cargo-art.ts';
import { drawConveyors } from './conveyor-art.ts';
import { drawFreightScenery, drawFreightLift } from './freight-art.ts';
import { drawScrapper } from './scrapper-art.ts';
import { drawHarpooner } from './harpooner-art.ts';
import { FREIGHT } from './freight-layout.ts';
import { drawSquadTell } from './squad-art.ts';
import { squadLineEnd } from './squads.ts';
import { LIFT_PERIOD, CRUSHER_TELL, CRUMBLE_TELL, CRUMBLE_RESET } from './hazards.ts';
import { EXTRACTION } from './escape-layout.ts';
import { drawWeapon } from './weapon-art.ts';
import { drawBallistics } from './ballistics-art.ts';
import { drawFusions } from './fusions-art.ts';
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
  portalRevision = 0;
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
    if (g.mode === 'playing' || g.mode === 'title') this.clock += dt;
    const ratio = this.canvas.width / this.width;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    const viewW = this.width / this.scale,
      viewH = this.height / this.scale;
    const lead = clamp((g.aim.x - g.player.position.x) * 0.1, -95, 125) + g.player.velocity.x * 5;
    const desiredX = clamp(
      g.player.position.x - viewW * 0.42 + lead,
      0,
      Math.max(0, g.worldWidth - viewW),
    );
    const desiredY = clamp(
      g.player.position.y - viewH * 0.58,
      g.worldTop,
      Math.max(g.worldTop, 835 - viewH),
    );
    const follow = this.portalRevision !== g.portals.revision ? 1 : 1 - Math.exp(-dt * 9);
    this.portalRevision = g.portals.revision;
    this.camera.x += (desiredX - this.camera.x) * follow;
    this.camera.y += (desiredY - this.camera.y) * follow;
    if (g.mode === 'title') {
      this.camera.x = 200;
      this.camera.y = Math.max(0, 825 - viewH);
    }
    c.save();
    c.scale(this.scale, this.scale);
    if (g.level.freight && g.mode !== 'title') drawFreightScenery(c, this.camera, viewW, viewH);
    else if (g.escape && g.mode !== 'title') this.drawEscapeScenery(viewW, viewH);
    else drawScenery(c, g.level.area, this.camera, viewW, viewH);
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
    this.drawBreachBackdrop();
    drawReinforcementDoors(c, g, this.reduced);
    const palette = AREAS[g.level.area];
    for (const b of g.terrain) {
      if (b.bounds.max.x <= 0 || b.bounds.min.x >= g.worldWidth || b.bounds.min.y < g.worldTop)
        continue;
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
    if (g.escape?.phase === 'route') this.drawEscapeDirections();
    this.drawExit();
    drawDetourDoor(c, g);
    drawRouteExits(c, g);
    this.drawHazards();
    drawFreightLift(c, g);
    drawConveyors(c, g, this.reduced);
    drawCoolant(c, g, this.reduced);
    drawMagnets(c, g, this.reduced);
    this.drawProps();
    this.drawBreaches();
    drawPortals(c, g, this.clock, this.reduced);
    drawDemolition(c, g, this.reduced);
    if (!this.reduced && !g.grounded && g.player.speed > 8) {
      g.trail.forEach((p, i) => {
        c.globalAlpha = (1 - i / 9) * 0.1;
        c.fillStyle = '#d1e2dd';
        c.fillRect(p.x - 11, p.y - 15, 22, 30);
      });
      c.globalAlpha = 1;
    }
    for (const e of g.enemies) {
      if (e.kind === 'borer' || e.kind === 'sifter' || e.kind === 'sorter') {
        drawReclamationEnemy(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'scrapper') {
        drawScrapper(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'harpooner') {
        drawHarpooner(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'interceptor') {
        drawInterceptor(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'turbine') {
        drawTurbine(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'skimmer' || e.kind === 'condenser') {
        drawCoolingEnemy(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'crane') {
        drawCrane(c, g, e, this.reduced);
        continue;
      }
      if (e.kind === 'kiln') {
        drawKiln(c, g, e, this.reduced);
        continue;
      }
      const p = e.body.position,
        size = ENEMY_STATS[e.kind].w;
      c.save();
      c.translate(p.x, p.y);
      if (e.spawn > 0) {
        c.globalAlpha = clamp(1 - e.spawn / 0.65, 0.15, 1);
        if (!e.fromDoor) {
          c.strokeStyle = '#ed735d';
          c.lineWidth = 1.5;
          c.strokeRect(-size / 2 - 8, -size / 2 - 8, size + 16, size + 16);
        }
      }
      const color =
        e.flash > 0
          ? '#fff5df'
          : e.kind === 'sniper'
            ? '#e9ac78'
            : e.kind === 'boss' && e.phase === 2
              ? '#ffbc83'
              : '#ee7965';
      if (e.kind === 'loader') {
        c.save();
        c.scale(e.aim.x < 0 ? -1 : 1, 1);
        c.fillStyle = e.flash > 0 ? '#fff5df' : '#393237';
        c.fillRect(-56, -23, 112, 57);
        c.fillRect(-31, -34, 58, 18);
        c.fillStyle = '#171f25';
        c.fillRect(-26, -29, 34, 15);
        c.fillRect(-49, 17, 88, 13);
        c.fillStyle = '#697072';
        for (let i = 0; i < 7; i++) c.fillRect(-45 + i * 12, 20, 7, 6);
        c.fillStyle = color;
        c.fillRect(-54, -17, 8, 26);
        c.fillRect(40, -22, 16, 56);
        this.line({ x: 24, y: -7 }, { x: 42, y: 11 }, '#b79a87', 5);
        c.fillStyle = e.state === 'recover' ? '#ffe2a0' : '#b26855';
        for (let i = 0; i < 3; i++) c.fillRect(-32 + i * 13, -5, 7, 11);
        if (e.state === 'windup' && e.attack !== 'flak') {
          c.fillStyle = '#ffd19a';
          c.fillRect(44, -20, 8, 50 * clamp(1 - e.timer / LOADER_TELL, 0, 1));
        }
        if (e.state === 'rush' && !this.reduced) {
          this.line({ x: -62, y: 18 }, { x: -104, y: 18 }, '#a46b55', 3);
          this.line({ x: -62, y: 28 }, { x: -88, y: 28 }, '#a46b55', 2);
        }
        c.restore();
      } else if (e.kind === 'press') {
        c.fillStyle = '#564a43';
        c.fillRect(-41, -65, 10, 36);
        c.fillRect(31, -65, 10, 36);
        c.fillStyle = e.flash > 0 ? '#fff5df' : '#352b2b';
        c.fillRect(-60, -31, 120, 62);
        c.fillStyle = color;
        c.fillRect(-60, -31, 120, 6);
        c.fillRect(-60, 19, 120, 12);
        c.fillStyle = '#1e2023';
        c.fillRect(-49, -18, 98, 28);
        c.fillStyle = e.state === 'recover' ? '#ffe0a0' : '#c38966';
        for (let i = 0; i < 4; i++) c.fillRect(-37 + i * 22, -11, 9, 14);
        for (const side of [-1, 1])
          this.line({ x: side * 52, y: -19 }, { x: side * 52, y: 12 }, '#948373', 3);
        if (e.state === 'rush' && !this.reduced) {
          this.line({ x: -48, y: -41 }, { x: -48, y: -80 }, '#ad8562', 2);
          this.line({ x: 48, y: -41 }, { x: 48, y: -80 }, '#ad8562', 2);
        }
      } else if (e.kind === 'charger') {
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
        if (e.elite === 'twin') {
          for (const [i, x] of [-6, 3].entries()) {
            c.fillStyle =
              (e.state === 'windup' && i === 0) || (e.state === 'followup' && i === 1)
                ? '#ffe1aa'
                : '#8c6750';
            c.fillRect(x, -23, 4, 6);
          }
        }
      } else if (e.kind === 'flyer') {
        if (e.elite === 'volatile') {
          c.fillStyle = '#392a2a';
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8,
              r = i % 2 ? 16 : 25;
            if (i === 0) c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          c.fill();
          c.stroke();
          this.circle({ x: 0, y: 0 }, 10, '#e7aa74', false, 2);
          if (e.state === 'windup')
            this.circle(
              { x: 0, y: 0 },
              4 + clamp(1 - e.timer / VOLATILE_TELL, 0, 1) * 5,
              '#ffe1a6',
            );
        } else {
          this.circle({ x: 0, y: 0 }, 18, '#392a2a');
          this.circle({ x: 0, y: 0 }, 18, color, false, 2.5);
          this.line({ x: -26, y: -5 }, { x: -18, y: 2 }, color, 3);
          this.line({ x: 18, y: 2 }, { x: 26, y: -5 }, color, 3);
        }
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
        }
      }
      if (e.elite === 'shielded') {
        c.save();
        c.scale(e.facing, 1);
        c.fillStyle = e.shieldFlash > 0 ? '#f6e6bb' : '#4c5351';
        c.strokeStyle = e.shieldFlash > 0 ? '#fff7df' : '#aab4ac';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(18, -23);
        c.lineTo(28, -18);
        c.lineTo(28, 18);
        c.lineTo(18, 23);
        c.closePath();
        c.fill();
        c.stroke();
        this.line({ x: 28, y: -15 }, { x: 28, y: 15 }, c.strokeStyle, 4);
        this.line({ x: 20, y: -7 }, { x: 26, y: -7 }, '#79857e', 2);
        this.line({ x: 20, y: 7 }, { x: 26, y: 7 }, '#79857e', 2);
        if (e.state === 'windup') {
          const x = -23 - clamp(1 - e.timer / SHIELD_TURN, 0, 1) * 5;
          this.line({ x: x + 7, y: -8 }, { x, y: 0 }, '#e5c898', 2);
          this.line({ x, y: 0 }, { x: x + 7, y: 8 }, '#e5c898', 2);
        }
        if (e.shieldFlash > 0) {
          for (const y of [-15, 0, 15])
            this.line({ x: 34, y }, { x: 40, y: y * 1.25 }, '#ffeac4', 2);
        }
        c.restore();
      }
      const aim =
        e.elite === 'shielded'
          ? { x: e.facing, y: 0 }
          : e.kind === 'runner' || e.kind === 'hopper'
            ? direction(p, g.player.position)
            : e.aim;
      if (['shooter', 'flyer', 'sniper', 'boss'].includes(e.kind) && e.elite !== 'volatile') {
        c.save();
        if (e.squad?.kind === 'shield' && e.squad.role === 'support') {
          this.line({ x: 0, y: -12 }, { x: 0, y: -34 }, '#a79b86', 4);
          c.translate(0, -34);
          this.circle({ x: 0, y: 0 }, 6, '#4c5351');
        }
        c.rotate(Math.atan2(aim.y, aim.x));
        if (e.elite === 'twin') {
          c.fillStyle = e.state === 'followup' ? '#85624e' : color;
          c.fillRect(7, -8, 30, 4);
          c.fillStyle = e.state === 'followup' ? '#ffe1aa' : color;
          c.fillRect(7, 4, 30, 4);
        } else {
          c.fillStyle = color;
          c.fillRect(
            e.kind === 'boss' ? 18 : 7,
            -3,
            e.kind === 'boss' ? 38 : e.kind === 'sniper' ? 30 : 22,
            e.kind === 'sniper' ? 4 : 6,
          );
        }
        c.restore();
      }
      if (e.kind !== 'loader' && e.kind !== 'press' && e.elite !== 'volatile')
        this.circle({ x: aim.x * 5, y: aim.y * 5 }, e.kind === 'boss' ? 8 : 4, color);
      if (e.squad?.connected) {
        c.fillStyle =
          e.squad.kind === 'shield' ? '#c9b38a' : e.squad.kind === 'flank' ? '#b3c3ba' : '#d4a087';
        c.fillRect(-7, 9, 4, 3);
        c.fillRect(3, 9, 4, 3);
      }
      if (e.hp < e.maxHp) {
        const w = isBoss(e.kind) ? ENEMY_STATS[e.kind].w : 30;
        const y = -ENEMY_STATS[e.kind].h / 2 - 13;
        c.fillStyle = '#493632';
        c.fillRect(-w / 2, y, w, 3);
        c.fillStyle = color;
        c.fillRect(-w / 2, y, (w * e.hp) / e.maxHp, 3);
      }
      c.restore();
      this.drawTell(e);
      drawSquadTell(c, g, e);
      if (
        (e.kind === 'shooter' || e.kind === 'flyer') &&
        !(e.squad?.kind === 'shield' && e.squad.role === 'support') &&
        e.elite !== 'volatile' &&
        e.timer < 0.4 &&
        e.spawn === 0
      ) {
        const length = 280;
        c.setLineDash([3, 10]);
        this.line(
          p,
          squadLineEnd(g, e, p, { x: p.x + e.aim.x * length, y: p.y + e.aim.y * length }),
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
    drawBallistics(c, g, this.reduced);
    drawFusions(c, g, this.reduced);
    for (const s of g.shots) {
      if (s.blade) {
        drawBlade(c, s, g.time, this.reduced);
        continue;
      }
      if (s.friendly) {
        c.save();
        if (s.echo) c.globalAlpha = 0.65;
        if (s.trace) {
          const { points, bank, pierce } = s.trace;
          c.save();
          c.lineCap = 'round';
          for (let i = 1; i < points.length; i++) {
            c.globalAlpha = (this.reduced ? 0.32 : 0.48) * (0.3 + (0.7 * i) / (points.length - 1));
            const color = s.rail ? '#b7e4ef' : s.charged ? '#e2edaf' : bank ? '#9dccb5' : '#bedde9';
            this.line(
              points[i - 1],
              points[i],
              color,
              s.rail ? 4 : bank && pierce ? 2.6 : pierce ? 1.25 : 1.8,
            );
            if (bank && pierce) this.line(points[i - 1], points[i], '#d5ebf2', 0.8);
          }
          c.restore();
          this.circle(s.pos, s.radius, s.charged ? '#eff5b5' : pierce ? '#e9f4f6' : '#ddedda');
        } else {
          this.line(
            { x: s.pos.x - s.vel.x * 0.55, y: s.pos.y - s.vel.y * 0.55 },
            s.pos,
            s.fragment ? '#bea88b' : s.charged ? '#eff5b5' : '#f6d49a',
            s.radius * 1.15 + (s.charged ? 1 : 0),
          );
          this.circle(s.pos, s.radius, '#fff2d5');
        }
        if (s.shell) {
          const d = direction({ x: 0, y: 0 }, s.vel);
          this.line(
            { x: s.pos.x - d.x * 7, y: s.pos.y - d.y * 7 },
            s.pos,
            '#f1ad61',
            s.radius * 2 + 1,
          );
          this.circle(s.pos, Math.max(1.5, s.radius * 0.6), '#ffe1a8');
        }
        if (s.recall?.returning || s.reflected)
          this.circle(s.pos, s.radius + 1, s.reflected ? '#b5ecd8' : '#a9ccd8', false, 1);
        c.restore();
      } else {
        if (s.enemyAmmo) {
          drawRivalShot(c, s);
          continue;
        }
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
    if (g.escape) this.drawExtraction(true);
    if (g.mode === 'playing' && g.escape?.phase !== 'extracting') {
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
      if (g.clear && (g.escape ? EXTRACTION.x : 1870) > this.camera.x + viewW - 80) {
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
    if (g.escape?.phase === 'extracting' && g.mode !== 'title') {
      const fade = clamp((g.escape.depart / EXTRACTION_DURATION - 0.82) / 0.18, 0, 1);
      if (fade > 0) {
        c.fillStyle = `rgba(10,17,21,${fade})`;
        c.fillRect(0, 0, this.width, this.height);
      }
    }
  }
  drawEscapeScenery(width: number, height: number) {
    const c = this.ctx,
      escape = this.game.escape!,
      dark = clamp(escape.time / 24, 0, 1);
    const sky = c.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#111b23');
    sky.addColorStop(1, '#303739');
    c.fillStyle = sky;
    c.fillRect(0, 0, width, height);
    for (const layer of [0, 1]) {
      const spacing = layer === 0 ? 250 : 390,
        offset = this.camera.x * (layer === 0 ? 0.12 : 0.26),
        first = Math.floor(offset / spacing) - 1,
        horizon = height * 0.55 + layer * 70 - this.camera.y * 0.15;
      for (let i = first; i < first + Math.ceil(width / spacing) + 3; i++) {
        const x = i * spacing - offset,
          top = horizon - 65 - Math.abs((i * 73 + layer * 29) % 150),
          w = spacing - 23;
        c.fillStyle = layer === 0 ? '#26343d' : '#1c2a31';
        c.fillRect(x, top, w, height - top);
        c.fillRect(x + 21, top - 30, w * 0.36, 30);
        this.line({ x: x + 12, y: top + 8 }, { x: x + w - 12, y: top + 8 }, '#3b4b50', 2);
        if (layer === 1) {
          for (const rail of [x + 29, x + w - 29])
            this.line({ x: rail, y: top + 25 }, { x: rail, y: height }, '#2e3e43', 3);
          const failure = this.reduced
            ? 0.6
            : clamp((escape.time - 3 - Math.abs((i * 7) % 16)) / 1.2, 0, 1);
          c.globalAlpha = 0.6 - failure * 0.48;
          c.fillStyle = '#bd9c6e';
          c.fillRect(x + w / 2 - 9, top + 28, 18, 3);
          c.globalAlpha = 1;
        }
      }
    }
    c.fillStyle = `rgba(9,17,23,${0.08 + dark * 0.2})`;
    c.fillRect(0, 0, width, height);
    if (!this.reduced) {
      const spacing = 370,
        offset = this.camera.x * 0.45,
        first = Math.floor(offset / spacing) - 1;
      for (let i = first; i < first + Math.ceil(width / spacing) + 3; i++) {
        const x = i * spacing - offset + 80 + Math.sin(escape.time * 0.7 + i) * 12,
          y = ((escape.time * 34 + Math.abs(i * 137)) % (height + 120)) - 60;
        this.line({ x, y }, { x: x - 1, y: y + 4 }, '#c3986b', 1);
      }
    }
  }
  drawEscapeDirections() {
    const g = this.game;
    for (let x = 520; x < EXTRACTION.x - 220; x += 880) {
      if (x < this.camera.x - 30 || x > this.camera.x + this.width / this.scale + 30) continue;
      const surface = g.lineEnd({ x, y: 300 }, { x, y: WORLD.floor });
      const y = surface.y - 10;
      this.line({ x: x - 7, y: y - 5 }, { x, y }, '#73998d', 1.5);
      this.line({ x, y }, { x: x - 7, y: y + 5 }, '#73998d', 1.5);
    }
  }
  drawExtraction(foreground = false) {
    const c = this.ctx,
      g = this.game;
    if (!g.escape || !g.extractionLift) return;
    const { x, y: restY, w, h } = EXTRACTION,
      left = x - w / 2,
      right = x + w / 2,
      floor = g.extractionLift.position.y - h / 2,
      roof = floor - 100,
      closing = clamp(g.escape.depart / 0.55, 0, 1);
    c.save();
    if (foreground) {
      if (closing > 0) {
        for (const side of [-1, 1]) {
          const doorWidth = (w / 2 - 7) * closing,
            edge = side < 0 ? left + 7 : right - 7 - doorWidth;
          c.fillStyle = 'rgba(57,85,77,0.28)';
          c.fillRect(edge, roof + 10, doorWidth, 82);
          c.strokeStyle = '#77998b';
          c.lineWidth = 1.5;
          c.strokeRect(edge, roof + 10, doorWidth, 82);
          for (let rail = edge + 12; rail < edge + doorWidth; rail += 16)
            this.line({ x: rail, y: roof + 13 }, { x: rail, y: floor - 11 }, '#587567', 1);
        }
      }
      c.restore();
      return;
    }
    for (const side of [-1, 1]) {
      const rail = x + side * (w / 2 + 10);
      this.line({ x: rail, y: restY - 690 }, { x: rail, y: restY + h }, '#293d40', 7);
      this.line({ x: rail - 1, y: restY - 690 }, { x: rail - 1, y: restY + h }, '#647e76', 2);
    }
    c.fillStyle = 'rgba(121,190,151,0.06)';
    c.fillRect(left + 7, floor - 95, w - 14, 95);
    c.fillStyle = '#243c36';
    c.fillRect(left, roof, w, 7);
    c.fillRect(left, floor, w, h);
    for (const edge of [left, right - 6]) {
      c.fillStyle = '#627d70';
      c.fillRect(edge, roof + 7, 6, 93);
    }
    c.fillStyle = '#a8d2b8';
    c.fillRect(left + 4, floor, w - 8, 3);
    c.fillRect(x - 17, roof + 3, 34, 2);
    c.fillStyle = '#172c28';
    c.fillRect(left + 8, floor + 6, w - 16, Math.max(3, h - 8));
    this.line({ x: x - 8, y: roof + 44 }, { x, y: roof + 35 }, '#a2c8af', 2);
    this.line({ x, y: roof + 35 }, { x: x + 8, y: roof + 44 }, '#a2c8af', 2);
    if (g.escape.phase === 'route') {
      this.line({ x: left - 34, y: restY - 20 }, { x: left - 22, y: restY - 11 }, '#9bbfac', 2);
      this.line({ x: left - 22, y: restY - 11 }, { x: left - 34, y: restY - 2 }, '#9bbfac', 2);
    }
    c.restore();
  }
  drawHazards() {
    const c = this.ctx,
      g = this.game;
    for (const hazard of g.hazards.items) {
      if (hazard === g.freight.lift) continue;
      if (!hazard.visible && hazard.permanent) continue;
      const { x, y: restY, w, h, travel } = hazard.placement,
        left = x - w / 2,
        right = x + w / 2,
        y = hazard.body.position.y - h / 2;
      c.save();
      if (hazard.kind === 'lift') {
        for (const side of [-1, 1]) {
          const railX = x + side * (w / 2 - 9);
          this.line(
            { x: railX, y: restY - travel - 17 },
            { x: railX, y: restY + h + 10 },
            '#283c43',
            5,
          );
          this.line(
            { x: railX, y: restY - travel - 17 },
            { x: railX, y: restY + h + 10 },
            '#4a6267',
            1,
          );
          c.fillStyle = '#54696c';
          c.fillRect(railX - 5, restY - travel - 20, 10, 5);
          c.fillRect(railX - 5, restY + h + 8, 10, 5);
        }
        c.fillStyle = '#30494d';
        c.fillRect(left, y, w, h);
        c.fillStyle = '#203438';
        c.fillRect(left + 7, y + 5, w - 14, Math.max(3, h - 8));
        this.line({ x: left, y }, { x: right, y }, '#a3bdb5', 2.5);
        for (const edge of [left, right - 6]) {
          c.fillStyle = '#819c98';
          c.fillRect(edge, y + 3, 6, h - 3);
        }
        const down = hazard.phase % LIFT_PERIOD >= LIFT_PERIOD / 2 ? 1 : -1,
          centerY = y + h / 2;
        this.line(
          { x: x - 5, y: centerY - down * 2 },
          { x, y: centerY + down * 2 },
          '#a7c9bd',
          1.5,
        );
        this.line(
          { x, y: centerY + down * 2 },
          { x: x + 5, y: centerY - down * 2 },
          '#a7c9bd',
          1.5,
        );
      } else if (hazard.kind === 'crusher') {
        const floor = restY + h + travel,
          warning = hazard.state === 'warning',
          falling = hazard.state === 'falling',
          progress = warning ? clamp(1 - hazard.timer / CRUSHER_TELL, 0, 1) : falling ? 1 : 0;
        // Permanent floor markings locate the machine before it begins a cycle.
        this.line({ x: left, y: floor - 2 }, { x: right, y: floor - 2 }, '#78543d', 2);
        for (const edge of [left, right])
          this.line({ x: edge, y: floor - 9 }, { x: edge, y: floor }, '#986b49', 2);
        if (warning || falling) {
          const bottom = y + h;
          c.fillStyle = `rgba(236,149,90,${0.025 + progress * 0.035})`;
          c.fillRect(left, bottom, w, Math.max(0, floor - bottom));
          c.setLineDash(falling ? [] : [5, 11]);
          for (const edge of [left, right])
            this.line({ x: edge, y: bottom }, { x: edge, y: floor - 7 }, '#966e4f', 1);
          c.setLineDash([]);
          this.line(
            { x: x - (w / 2) * progress, y: floor - 3 },
            { x: x + (w / 2) * progress, y: floor - 3 },
            '#ffd299',
            3,
          );
        }
        c.fillStyle = '#342e2a';
        c.fillRect(left + 13, restY - 44, w - 26, 20);
        this.line({ x: left + 13, y: restY - 44 }, { x: right - 13, y: restY - 44 }, '#827561', 2);
        for (const side of [-1, 1]) {
          const pistonX = x + side * w * 0.27;
          this.line({ x: pistonX, y: restY - 24 }, { x: pistonX, y: y + 1 }, '#4f4b40', 12);
          this.line({ x: pistonX - 2, y: restY - 24 }, { x: pistonX - 2, y: y + 1 }, '#8e8a72', 3);
          c.fillStyle = '#aea084';
          c.fillRect(pistonX - 2, restY - 37, 4, 4);
        }
        c.fillStyle = '#55463a';
        c.fillRect(left, y, w, h);
        c.fillStyle = '#312b27';
        c.fillRect(left + 7, y + 5, w - 14, Math.max(5, h - 13));
        this.line({ x: left, y }, { x: right, y }, '#99866b', 2);
        c.save();
        c.beginPath();
        c.rect(left + 2, y + h - 8, w - 4, 7);
        c.clip();
        c.fillStyle = '#be9561';
        c.fillRect(left + 2, y + h - 8, w - 4, 7);
        for (let stripe = left - 8; stripe < right + 10; stripe += 23)
          this.line({ x: stripe, y: y + h }, { x: stripe + 10, y: y + h - 10 }, '#4b3d2e', 8);
        c.restore();
        const lamp = warning || falling ? (progress > 0.65 ? '#ffe2a5' : '#d4a570') : '#866348';
        for (const side of [-1, 1]) {
          c.fillStyle = lamp;
          c.fillRect(x + side * (w / 2 - 13) - 3, y + 8, 6, 5);
        }
        if (falling && !this.reduced)
          for (const side of [-1, 1])
            this.line(
              { x: x + side * (w / 2 - 3), y: y - 5 },
              { x: x + side * (w / 2 - 3), y: y - 27 },
              '#9d7954',
              2,
            );
      } else {
        const warning = hazard.state === 'warning',
          progress = warning ? clamp(1 - hazard.timer / CRUMBLE_TELL, 0, 1) : 0;
        if (!hazard.visible) {
          const restore = clamp(1 - hazard.timer / CRUMBLE_RESET, 0, 1);
          c.globalAlpha = 0.2 + restore * 0.4;
          for (const side of [-1, 1]) {
            const edge = x + (side * w) / 2;
            this.line({ x: edge, y: restY + 6 }, { x: edge, y: restY + h }, '#91a39c', 1.5);
            this.line(
              { x: edge, y: restY + h },
              { x: edge - side * 8, y: restY + h },
              '#91a39c',
              1.5,
            );
          }
        } else {
          const count = Math.max(3, Math.round(w / 28)),
            segment = w / count;
          for (let i = 0; i < count; i++) {
            const tileX = left + i * segment + 1,
              tileW = segment - 3,
              stressed = warning && Math.abs(i - (count - 1) / 2) <= (progress * count) / 2;
            c.fillStyle = '#354447';
            c.fillRect(tileX, y + 2, tileW, h - 3);
            this.line(
              { x: tileX, y },
              { x: tileX + tileW, y },
              stressed ? '#e5b58a' : '#96aaa6',
              2,
            );
            this.line(
              { x: tileX + 5, y: y + 4 },
              { x: tileX + tileW - 5, y: y + h - 4 },
              '#647b7b',
              1.5,
            );
            if (stressed) {
              const middle = tileX + tileW / 2;
              this.line({ x: middle - 3, y }, { x: middle + 2, y: y + h * 0.45 }, '#172629', 2.5);
              this.line(
                { x: middle + 2, y: y + h * 0.45 },
                { x: middle - 2, y: y + h - 2 },
                '#172629',
                2.5,
              );
            }
          }
          for (const edge of [left, right - 4]) {
            c.fillStyle = '#697f7d';
            c.fillRect(edge, y + 3, 4, h - 1);
          }
        }
      }
      c.restore();
    }
  }
  drawBreachBackdrop() {
    const c = this.ctx,
      placement = this.game.breaches.placement;
    if (!placement) return;
    const roof = placement.solids.filter((rect) => rect.w > rect.h).sort((a, b) => b.w - a.w)[0];
    if (!roof) return;
    const left = roof.x,
      top = roof.y,
      right = roof.x + roof.w,
      bottom = Math.max(roof.y + roof.h, ...placement.panels.map((rect) => rect.y + rect.h));
    c.fillStyle = '#121e23';
    c.fillRect(left, top, right - left, bottom - top);
    c.fillStyle = '#1a292e';
    c.fillRect(left + 8, top + 8, right - left - 16, bottom - top - 16);
    for (let y = top + 27; y < bottom - 12; y += 27)
      this.line({ x: left + 12, y }, { x: right - 12, y }, '#243338', 1);
  }
  drawBreaches() {
    const c = this.ctx,
      g = this.game,
      breach = g.breaches,
      palette = AREAS[g.level.area];
    for (const body of breach.supports) {
      const x = body.bounds.min.x,
        y = body.bounds.min.y,
        w = body.bounds.max.x - x,
        h = body.bounds.max.y - y;
      c.fillStyle = palette.body;
      c.fillRect(x, y, w, h);
      c.fillStyle = palette.face;
      c.fillRect(x + 2, y + 4, w - 4, h - 5);
      this.line({ x, y }, { x: x + w, y }, palette.surface, 2);
      this.line({ x, y: y + h }, { x: x + w, y: y + h }, palette.edge, 1);
      for (const point of [
        { x: x + 4, y: y + 4 },
        { x: x + w - 6, y: y + h - 6 },
      ]) {
        c.fillStyle = '#79857b';
        c.fillRect(point.x, point.y, 2, 2);
      }
    }
    for (const panel of breach.panels) {
      const { x, y, w, h } = panel.rect,
        horizontal = w >= h,
        damage = clamp(1 - panel.hp / panel.maxHp, 0, 1),
        flash = panel.flash > 0;
      c.save();
      c.fillStyle = flash ? '#ac9875' : '#504b40';
      c.fillRect(x, y, w, h);
      c.strokeStyle = flash ? '#e9d2a1' : '#897d66';
      c.lineWidth = 1.25;
      c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      c.fillStyle = '#2c302b';
      if (horizontal) {
        c.fillRect(x + 6, y + 3, w - 12, 2);
        c.fillRect(x + 6, y + h - 5, w - 12, 2);
      } else {
        c.fillRect(x + 3, y + 6, 2, h - 12);
        c.fillRect(x + w - 5, y + 6, 2, h - 12);
      }
      const crack = [
        [0.03, 0.53],
        [0.23, 0.3],
        [0.43, 0.68],
        [0.63, 0.33],
        [0.79, 0.61],
        [0.97, 0.45],
      ].map(([along, across]) =>
        horizontal
          ? { x: x + w * along, y: y + h * across }
          : { x: x + w * across, y: y + h * along },
      );
      c.beginPath();
      c.moveTo(crack[0].x, crack[0].y);
      for (const point of crack.slice(1)) c.lineTo(point.x, point.y);
      c.lineJoin = 'miter';
      c.strokeStyle = '#182222';
      c.lineWidth = 2 + damage * 4;
      c.stroke();
      c.strokeStyle = flash ? '#fff0be' : damage > 0.35 ? '#dfbd89' : '#b09a78';
      c.lineWidth = 0.8 + damage * 1.5;
      c.stroke();
      if (damage > 0) {
        const branch = crack[damage > 0.55 ? 3 : 2];
        this.line(
          branch,
          horizontal
            ? { x: branch.x + w * 0.08, y: y + 2 }
            : { x: x + w - 2, y: branch.y + h * 0.08 },
          flash ? '#fff0be' : '#c8a979',
          0.8 + damage,
        );
      }
      c.restore();
    }
    if (breach.pickup) {
      const p = breach.pickup,
        glow = this.reduced ? 0.065 : 0.055 + (Math.sin(g.time * 2.5) + 1) * 0.012;
      this.circle(p, 12, `rgba(153,216,176,${glow})`);
      c.fillStyle = '#a9d9b9';
      c.fillRect(p.x - 2, p.y - 6, 4, 12);
      c.fillRect(p.x - 6, p.y - 2, 12, 4);
    }
    if (!this.reduced)
      for (const shard of breach.debris) {
        c.save();
        c.globalAlpha = clamp(shard.life / shard.max, 0, 1);
        c.translate(shard.pos.x, shard.pos.y);
        c.rotate(shard.angle);
        c.fillStyle = '#655a46';
        c.fillRect(-shard.w / 2, -shard.h / 2, shard.w, shard.h);
        this.line(
          { x: -shard.w / 2, y: -shard.h / 2 },
          { x: shard.w / 2, y: -shard.h / 2 },
          '#b49d77',
          1,
        );
        c.restore();
      }
  }
  drawProps() {
    const c = this.ctx,
      g = this.game;
    drawCargoCables(c, g, this.reduced);
    for (const prop of g.props.items) {
      const { w, h } = PROP_STATS[prop.kind];
      c.save();
      c.translate(prop.body.position.x, prop.body.position.y);
      c.rotate(prop.body.angle);
      c.fillStyle = prop.flash > 0 ? '#c7d2cb' : prop.kind === 'canister' ? '#514536' : '#37434a';
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = prop.flash > 0 ? '#f4ebcf' : prop.kind === 'canister' ? '#ba9b66' : '#91a4a7';
      c.lineWidth = 1.5;
      c.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
      if (prop.kind === 'cargo') {
        c.fillStyle = '#222e34';
        c.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16);
        c.fillStyle = '#819093';
        for (const x of [-30, 30]) c.fillRect(x - 3, -h / 2, 6, h);
        c.fillStyle = '#b59d72';
        for (let x = -w / 2 + 8; x < w / 2 - 8; x += 14) c.fillRect(x, h / 2 - 8, 8, 5);
        c.strokeStyle = '#b3beb7';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-w / 2 + 2, -h / 2 + 2);
        c.lineTo(w / 2 - 2, -h / 2 + 2);
        c.stroke();
      } else if (prop.kind === 'crate') {
        if (
          (prop.throwUntil ?? 0) > g.time &&
          Math.hypot(prop.body.velocity.x, prop.body.velocity.y) > 5
        ) {
          c.strokeStyle = '#eab27f';
          c.lineWidth = 2;
          c.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
        }
        this.line({ x: -16, y: -16 }, { x: 16, y: 16 }, '#71878c', 2);
        this.line({ x: 16, y: -16 }, { x: -16, y: 16 }, '#71878c', 2);
        c.fillStyle = '#c4c6ad';
        c.fillRect(-5, -5, 10, 10);
      } else if (prop.kind === 'canister') {
        c.fillStyle = '#2d3538';
        c.fillRect(-9, -14, 18, 5);
        c.fillRect(-9, 10, 18, 5);
        const armed = Number.isFinite(prop.armedAt);
        c.fillStyle = armed ? '#ffda87' : '#b79a68';
        c.fillRect(-6, -4, 12, 7);
        if (armed) {
          c.globalAlpha = 0.16 + (Math.sin(g.time * 25) + 1) * 0.12;
          c.strokeStyle = '#ffcd79';
          c.lineWidth = 3;
          c.strokeRect(-15, -22, 30, 44);
          c.globalAlpha = 1;
        }
      } else {
        c.fillStyle = '#798b8e';
        for (const y of [-30, 30]) {
          c.fillRect(-7, y, 3, 3);
          c.fillRect(4, y, 3, 3);
        }
        c.setLineDash([5, 5]);
        this.line({ x: 0, y: -28 }, { x: 0, y: 28 }, '#a0aeaa');
        c.setLineDash([]);
      }
      if (prop.hp < prop.maxHp) {
        c.strokeStyle = '#141f25';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-w / 2, -h * 0.22);
        c.lineTo(3, -4);
        c.lineTo(-4, 5);
        if (prop.hp < prop.maxHp / 2) c.lineTo(w / 2, h * 0.3);
        c.stroke();
      }
      c.restore();
    }
  }
  drawTell(e: Enemy) {
    drawBossSignal(this.ctx, this.game, e, this.reduced);
    if (e.attack === 'flak') return;
    if (e.spawn > 0 || (e.state !== 'windup' && e.state !== 'followup')) return;
    const c = this.ctx,
      g = this.game,
      p = e.body.position;
    if (e.elite === 'volatile') {
      const progress = clamp(1 - e.timer / VOLATILE_TELL, 0, 1);
      c.save();
      // The blast warning respects the same cover as the actual explosion.
      c.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i * Math.PI) / 32,
          end = g.lineEnd(p, {
            x: p.x + Math.cos(a) * VOLATILE_RADIUS,
            y: p.y + Math.sin(a) * VOLATILE_RADIUS,
          });
        if (i === 0) c.moveTo(end.x, end.y);
        else c.lineTo(end.x, end.y);
      }
      c.closePath();
      c.fillStyle = `rgba(232,133,89,${0.045 + progress * 0.065})`;
      c.fill();
      c.clip();
      this.circle(p, VOLATILE_RADIUS - 1, '#bd7960', false, 1.5);
      this.circle(
        p,
        18 + (VOLATILE_RADIUS - 18) * (1 - progress),
        '#ffce98',
        false,
        progress > 0.7 ? 3 : 2,
      );
      c.restore();
    } else if (e.kind === 'loader') {
      const end = g.lineEnd(p, { x: p.x + e.aim.x * 650, y: p.y });
      c.setLineDash([8, 8]);
      this.line({ x: p.x + e.aim.x * 60, y: p.y }, end, '#bc8260', 2);
      c.setLineDash([]);
      this.line({ x: end.x - e.aim.x * 14, y: end.y - 9 }, end, '#ffce98', 2);
      this.line({ x: end.x - e.aim.x * 14, y: end.y + 9 }, end, '#ffce98', 2);
    } else if (e.kind === 'press') {
      const locked = e.timer <= PRESS_LOCK,
        x = e.target.x;
      const y = p.y + ENEMY_STATS.press.h / 2,
        floor = e.target.y;
      c.fillStyle = locked ? '#e9ad6410' : '#e9ad6406';
      c.fillRect(x - 62, y, 124, Math.max(0, floor - y));
      c.setLineDash(locked ? [] : [6, 10]);
      for (const side of [-1, 1])
        this.line(
          { x: x + side * 62, y },
          { x: x + side * 62, y: floor },
          locked ? '#c69968' : '#735846',
          1,
        );
      c.setLineDash([]);
      this.line(
        { x: x - 62, y: floor - 3 },
        { x: x + 62, y: floor - 3 },
        locked ? '#ffda98' : '#aa7e55',
        locked ? 3 : 2,
      );
    } else if (e.kind === 'sniper') {
      const end = squadLineEnd(g, e, p, { x: p.x + e.aim.x * 1450, y: p.y + e.aim.y * 1450 });
      const second = e.state === 'followup',
        locked = e.timer <= (second ? TWIN_LOCK : 0.32);
      c.setLineDash(locked ? [] : [7, 7]);
      this.line(
        p,
        end,
        locked ? (second ? '#ffe8b9' : '#ffdda1') : '#946d51',
        locked ? (second ? 2 : 1.5) : 1,
      );
      c.setLineDash([]);
      this.circle(end, locked ? 4 : 2, '#ffdda1', false, 1);
      if (second)
        this.circle(
          { x: p.x + e.aim.x * 38, y: p.y + e.aim.y * 38 },
          4 + clamp(e.timer / TWIN_TELL, 0, 1) * 8,
          '#ffe8b9',
          false,
          2,
        );
    } else if (e.kind === 'charger') {
      const end = g.lineEnd(p, { x: p.x + e.aim.x * 180, y: p.y });
      c.setLineDash([6, 8]);
      this.line(p, end, '#af6650', 1.5);
      c.setLineDash([]);
      this.line({ x: end.x - e.aim.x * 9, y: end.y - 6 }, end, '#f8b480', 2);
      this.line({ x: end.x - e.aim.x * 9, y: end.y + 6 }, end, '#f8b480', 2);
    } else if (e.kind === 'boss') {
      const angles = attackAngles(e.attack, Math.atan2(e.aim.y, e.aim.x)),
        locked = e.timer <= 0.3,
        length = e.attack === 'ring' ? 380 : 800;
      c.setLineDash(locked ? [] : [5, 12]);
      for (const a of angles) {
        const end = g.lineEnd(p, { x: p.x + Math.cos(a) * length, y: p.y + Math.sin(a) * length });
        if (distance(p, end) < 55) continue;
        this.line(
          { x: p.x + Math.cos(a) * 55, y: p.y + Math.sin(a) * 55 },
          end,
          locked ? '#d9ad7e' : '#8e6c52',
          locked ? 1.4 : 1,
        );
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
    drawWeapon(c, g, this.reduced);
    c.restore();
  }
  drawExit() {
    if (this.game.canChooseRoute) return;
    if (this.game.escape) {
      this.drawExtraction();
      return;
    }
    const c = this.ctx,
      g = this.game,
      x = 1930,
      y = g.level.freight ? FREIGHT.dock : WORLD.floor;
    c.fillStyle = g.clear ? '#213832' : '#1b2326';
    c.fillRect(x - 36, y - 111, 72, 111);
    c.fillStyle = g.clear ? '#9bd9c2' : '#414e51';
    c.fillRect(x - 36, y - 111, 3, 111);
    c.fillRect(x + 33, y - 111, 3, 111);
    if (g.stage === 19 && !g.practice) {
      c.font = '9px monospace';
      c.textAlign = 'center';
      c.fillText('EXTRACT', x, y - 124);
    }
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
