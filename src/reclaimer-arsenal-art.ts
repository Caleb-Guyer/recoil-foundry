import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { clamp } from './rules.ts';
import { drawFinaleTransport } from './finale-cinema-art.ts';

const TAU = Math.PI * 2;
const AMBER = '#f4c083';
const DARK = '#091b23';
const RED = '#e84b3c';
const WHITE = '#fff0cb';
const fract = (n: number) => n - Math.floor(n);

function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width: number) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function disc(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, TAU);
  c.fill();
}
function polygon(c: CanvasRenderingContext2D, points: number[], color: string, edge: string) {
  c.fillStyle = color;
  c.strokeStyle = edge;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let n = 2; n < points.length; n += 2) c.lineTo(points[n], points[n + 1]);
  c.closePath();
  c.fill();
  c.stroke();
}
function chevron(c: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.strokeStyle = DARK;
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(-6, -7);
  c.lineTo(2, 0);
  c.lineTo(-6, 7);
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();
  c.restore();
}

/** Draw only controller state: presentation cannot advance attacks or consume RNG. */
export function drawReclaimerArsenal(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  const cine = g.finale.cinema,
    e = g.finale.enemy,
    arsenal = cine?.arsenal;
  if (!arsenal?.active || !cine?.combat || !e || e.hp <= 0 || g.mode === 'title') return;
  c.save();
  c.lineCap = 'butt';
  const dash = arsenal.dash;
  if (dash) {
    const dx = dash.to.x - dash.from.x,
      dy = dash.to.y - dash.from.y,
      length = Math.hypot(dx, dy),
      angle = Math.atan2(dy, dx),
      nx = length > 0 ? (-dy / length) * 37 : 0,
      ny = length > 0 ? (dx / length) * 37 : 37;
    if (dash.state === 'warning') {
      const progress = clamp(1 - dash.left / dash.duration, 0, 1);
      c.globalAlpha = 0.075;
      c.fillStyle = AMBER;
      c.beginPath();
      c.moveTo(dash.from.x + nx, dash.from.y + ny);
      c.lineTo(dash.to.x + nx, dash.to.y + ny);
      c.lineTo(dash.to.x - nx, dash.to.y - ny);
      c.lineTo(dash.from.x - nx, dash.from.y - ny);
      c.closePath();
      c.fill();
      c.globalAlpha = 1;
      for (const side of [-1, 1]) {
        const from = { x: dash.from.x + nx * side, y: dash.from.y + ny * side },
          to = { x: dash.to.x + nx * side, y: dash.to.y + ny * side };
        line(c, from, to, DARK, 5);
        c.setLineDash([12, 9]);
        line(c, from, to, AMBER, 2);
        c.setLineDash([]);
      }
      // The lane is fixed at commitment. Filling it records elapsed warning time.
      line(c, dash.from, dash.to, DARK, 5);
      line(
        c,
        dash.from,
        { x: dash.from.x + dx * progress, y: dash.from.y + dy * progress },
        AMBER,
        2,
      );
      for (let n = 1; n <= 3; n++)
        chevron(c, dash.from.x + (dx * n) / 4, dash.from.y + (dy * n) / 4, angle, AMBER);
      c.strokeStyle = AMBER;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(e.body.position.x, e.body.position.y, 47, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
      c.stroke();
    } else if (dash.state === 'dash') {
      // Sparse physical afterimages never obscure the player or the dash endpoint.
      const trail = reduced ? dash.trail.slice(-2) : dash.trail;
      for (let n = 0; n < trail.length; n++) {
        const p = trail[n];
        c.globalAlpha = (0.06 + ((n + 1) / Math.max(1, trail.length)) * 0.18) * (reduced ? 0.6 : 1);
        polygon(
          c,
          [
            p.x - 27,
            p.y - 32,
            p.x + 23,
            p.y - 32,
            p.x + 34,
            p.y - 9,
            p.x + 26,
            p.y + 29,
            p.x - 25,
            p.y + 29,
            p.x - 34,
            p.y - 7,
          ],
          '#a44b3c',
          AMBER,
        );
      }
      c.globalAlpha = 1;
      line(c, dash.from, e.body.position, '#e66b49', reduced ? 1 : 2);
      chevron(c, dash.to.x, dash.to.y, angle, RED);
    } else {
      // Vents open while the committed charge recovers: an actual punish window.
      const p = e.body.position;
      for (const side of [-1, 1]) {
        c.fillStyle = '#9c4a36';
        c.fillRect(p.x + side * 31 - 4, p.y - 21, 8, 23);
        c.fillStyle = AMBER;
        c.fillRect(p.x + side * 31 - 2, p.y - 18, 3, 17);
      }
    }
  }

  const flight = arsenal.flight;
  if (flight) {
    // Reuse the aircraft that delivered the machine during the introduction.
    drawFinaleTransport(c, flight.x, flight.y, flight.time, reduced, flight.direction);
    c.save();
    c.translate(flight.x, flight.y);
    c.scale(flight.direction, 1);
    c.fillStyle = '#152b32';
    c.fillRect(-28, 18, 56, 17);
    c.fillStyle = '#c4835f';
    c.fillRect(-23, 18, 46, 3);
    for (let n = 0; n < 3; n++) {
      c.fillStyle = '#ab7a53';
      c.fillRect(-17 + n * 13, 27, 5, 7);
    }
    c.restore();
  }
  for (const bomb of arsenal.bombs) {
    const { target, radius } = bomb;
    if (bomb.state !== 'blast') {
      const progress = clamp(1 - bomb.left / bomb.duration, 0, 1);
      c.fillStyle = AMBER;
      c.globalAlpha = 0.045;
      c.beginPath();
      c.arc(target.x, target.y, radius, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      c.strokeStyle = DARK;
      c.lineWidth = 5;
      c.beginPath();
      c.arc(target.x, target.y, radius, 0, TAU);
      c.stroke();
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.setLineDash([7, 6]);
      c.stroke();
      c.setLineDash([]);
      c.lineWidth = 3;
      c.beginPath();
      c.arc(target.x, target.y, 14, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
      c.stroke();
      for (const side of [-1, 1]) {
        line(
          c,
          { x: target.x + side * (radius - 9), y: target.y - 5 },
          { x: target.x + side * (radius - 9), y: target.y + 5 },
          AMBER,
          2,
        );
      }
    }
    if (bomb.state === 'falling') {
      const p = bomb.pos,
        a = Math.atan2(target.y - p.y, target.x - p.x);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(a - Math.PI / 2);
      polygon(c, [-6, -13, -6, 5, 0, 14, 6, 5, 6, -13], '#b68c64', '#192c31');
      polygon(
        c,
        [-7, -11, -12, -18, -2, -17, 0, -10, 2, -17, 12, -18, 7, -11],
        '#526569',
        '#83958a',
      );
      c.fillStyle = '#f4bc7a';
      c.fillRect(-4, -3, 8, 3);
      if (!reduced) line(c, { x: 0, y: -20 }, { x: 0, y: -33 }, '#d0b18a', 2);
      c.restore();
    } else if (bomb.state === 'blast') {
      const age = clamp(bomb.age / 0.32, 0, 1),
        ring = radius * (0.5 + age * 0.5);
      c.globalAlpha = (1 - age) * (reduced ? 0.35 : 0.7);
      disc(c, target.x, target.y, ring, '#b95533');
      disc(c, target.x, target.y, ring * 0.68, '#efaa61');
      c.globalAlpha *= 0.8;
      disc(c, target.x, target.y, ring * 0.25, WHITE);
      c.globalAlpha = 1 - age;
      c.strokeStyle = '#ffce8c';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(target.x, target.y, ring, 0, TAU);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  if (g.finale.phase === 1) {
    const a = arsenal.armor,
      p = e.body.position,
      open = a.exposedLeft > 0 || a.plates === 0,
      hp = clamp(a.hp / Math.max(1, a.maxHp), 0, 1),
      split = open ? 22 : 0;
    c.save();
    c.translate(p.x, p.y);
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.translate(split, 0);
      polygon(
        c,
        [3, -22, 28, -26, 42, -11, 36, 28, 7, 31],
        a.flash > 0 ? '#f5c18c' : open ? '#34464a' : '#735a46',
        '#b18e68',
      );
      c.fillStyle = '#2c373a';
      c.fillRect(13, -13, 17, 5);
      c.fillStyle = '#bc986a';
      c.fillRect(12, -20, 16, 2);
      for (let n = 0; n < 3; n++) {
        c.fillStyle = n / 3 < hp && !open ? '#d1a875' : '#282e2f';
        c.fillRect(13, 1 + n * 7, 14, 3);
      }
      for (const y of [-16, 22]) {
        c.fillStyle = '#c6ad84';
        c.fillRect(7, y, 3, 3);
      }
      if (hp < 0.7 || open || a.plates < 3)
        line(c, { x: 7, y: -6 }, { x: 30, y: 14 }, '#17252b', 3);
      c.restore();
    }
    // Three physical locking cartridges darken as successive armor shells break.
    for (let n = 0; n < 3; n++) {
      c.fillStyle = '#18292d';
      c.fillRect(-16 + n * 12, 34, 9, 8);
      c.fillStyle = n < a.plates ? '#cfac78' : '#423a32';
      c.fillRect(-14 + n * 12, 36, 5, 3);
    }
    if (open) {
      disc(c, 0, 8, 20, DARK);
      c.strokeStyle = '#a5d4c4';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 8, 18, 0, TAU);
      c.stroke();
      disc(c, 0, 8, 12, '#e9d69e');
      disc(c, 0, 8, 5, WHITE);
      if (a.exposedLeft > 0) {
        c.strokeStyle = '#b4e2ce';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(
          0,
          8,
          24,
          -Math.PI / 2,
          -Math.PI / 2 + TAU * clamp(a.exposedLeft / Math.max(0.01, a.exposedDuration), 0, 1),
        );
        c.stroke();
      }
    }
    c.restore();
  }

  const core = arsenal.core;
  if (core) {
    const warning = core.state === 'warning',
      progress = clamp(1 - core.left / core.duration, 0, 1);
    for (const beam of core.segments) {
      if (warning) {
        line(c, beam.from, beam.to, DARK, 5);
        c.setLineDash([11, 8]);
        line(c, beam.from, beam.to, AMBER, 2);
        c.setLineDash([]);
      } else {
        // The bright center is exactly the ten-pixel damaging beam.
        line(c, beam.from, beam.to, DARK, 14);
        line(c, beam.from, beam.to, RED, 10);
        line(c, beam.from, beam.to, WHITE, reduced ? 2 : 3);
      }
    }
    const p = core.origin;
    c.strokeStyle = DARK;
    c.lineWidth = 8;
    c.beginPath();
    c.arc(p.x, p.y, 44, 0, TAU);
    c.stroke();
    c.strokeStyle = warning ? AMBER : RED;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(p.x, p.y, 44, -Math.PI / 2, -Math.PI / 2 + TAU * (warning ? progress : 1));
    c.stroke();
    // Sweep direction is visible before activation; no player tracking is implied.
    for (let n = 0; n < core.segments.length; n++) {
      const beam = core.segments[n],
        start = Math.atan2(beam.to.y - p.y, beam.to.x - p.x),
        end = start + core.direction * Math.min(0.7, core.sweep);
      c.strokeStyle = warning ? AMBER : '#f09962';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, 62, start, end, core.direction < 0);
      c.stroke();
      chevron(
        c,
        p.x + Math.cos(end) * 62,
        p.y + Math.sin(end) * 62,
        end + (core.direction * Math.PI) / 2,
        warning ? AMBER : '#f09962',
      );
    }
  }

  for (const collapse of arsenal.collapses) {
    const s = collapse.rect,
      progress = clamp(1 - collapse.left / collapse.duration, 0, 1);
    if (!collapse.fallen) {
      c.fillStyle = '#cf8757';
      c.globalAlpha = 0.13;
      c.fillRect(s.x, s.y, s.w, s.h);
      c.globalAlpha = 1;
      c.strokeStyle = DARK;
      c.lineWidth = 6;
      c.strokeRect(s.x, s.y, s.w, s.h);
      c.strokeStyle = AMBER;
      c.lineWidth = 2;
      c.strokeRect(s.x, s.y, s.w, s.h);
      c.fillStyle = '#5b3831';
      c.fillRect(s.x + 4, s.y + 4, s.w - 8, 3);
      c.fillStyle = AMBER;
      c.fillRect(s.x + 4, s.y + 4, (s.w - 8) * progress, 3);
      for (let n = 1; n < 5; n++) {
        const x = s.x + (s.w * n) / 5;
        line(c, { x: x - 7, y: s.y }, { x: x + 2, y: s.y + s.h * 0.45 }, '#1b2528', 2);
        line(c, { x: x + 2, y: s.y + s.h * 0.45 }, { x: x - 2, y: s.y + s.h }, '#1b2528', 2);
        if (!reduced) {
          const age = fract(g.time * 0.7 + n * 0.31),
            y = s.y + s.h + age * age * 55;
          c.globalAlpha = (1 - age) * 0.7;
          c.fillStyle = '#aa9778';
          c.fillRect(x + n * 3, y, 2, 3);
          c.globalAlpha = 1;
        }
      }
    } else if (collapse.age < 1.7) {
      // Debris is visual only after the controller removes the real platform.
      const age = collapse.age,
        count = reduced ? 4 : 9;
      for (let n = 0; n < count; n++) {
        const x = s.x + ((n + 0.5) * s.w) / count + (n % 2 ? 1 : -1) * age * 16,
          y = s.y + 85 * age * age + n * 3;
        c.save();
        c.globalAlpha = clamp(1 - age / 1.7, 0, 1);
        c.translate(x, y);
        c.rotate((n % 2 ? 1 : -1) * age * 0.8);
        c.fillStyle = n % 3 ? '#405254' : '#857c62';
        c.fillRect(-s.w / count / 2, -s.h / 2, s.w / count - 3, s.h);
        c.fillStyle = '#b8a179';
        c.fillRect(-s.w / count / 2, -s.h / 2, s.w / count - 3, 2);
        c.restore();
      }
    }
  }
  c.restore();
}
