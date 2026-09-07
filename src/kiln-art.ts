import type { Enemy, Game } from './game.ts';
import { clamp } from './rules.ts';
import { flakAngles, FLAK_LOCK, FLAK_TELL } from './enemies.ts';
import {
  kilnMuzzle,
  kilnPoint,
  KILN_TELL,
  KILN_LOCK,
  KILN_HEAT_WARN,
  KILN_HEAT_WIDTH,
  KILN_RADIUS,
} from './kiln-ai.ts';
import type { KilnArc } from './kiln-ai.ts';

function landing(c: CanvasRenderingContext2D, g: Game, arc: KilnArc, locked: boolean) {
  c.strokeStyle = locked ? '#e7b47d' : '#95744e';
  c.lineWidth = locked ? 1.7 : 1;
  const y = arc.impact.y + KILN_RADIUS,
    support =
      arc.normal.y < -0.5
        ? g.terrainBodies.find(
            (body) =>
              body.isStatic &&
              Math.abs(body.bounds.min.y - y) < 0.1 &&
              arc.impact.x >= body.bounds.min.x - KILN_RADIUS &&
              arc.impact.x <= body.bounds.max.x + KILN_RADIUS,
          )
        : undefined,
    left = Math.max(support?.bounds.min.x ?? arc.impact.x, arc.impact.x - KILN_HEAT_WIDTH / 2),
    right = Math.min(support?.bounds.max.x ?? arc.impact.x, arc.impact.x + KILN_HEAT_WIDTH / 2);
  if (support && right - left >= 16) {
    c.beginPath();
    c.moveTo(left, y - 5);
    c.lineTo(left, y - 1);
    c.lineTo(right, y - 1);
    c.lineTo(right, y - 5);
    c.stroke();
  } else {
    c.beginPath();
    c.arc(arc.impact.x, arc.impact.y, KILN_RADIUS + 2, 0, Math.PI * 2);
    c.stroke();
  }
}

function drawKilnEffects(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const kiln = e.kiln;
  if (!kiln || e.spawn > 0) return;
  c.save();
  for (const patch of kiln.patches) {
    const left = patch.x - patch.w / 2,
      warning = patch.warn > 0,
      charge = clamp(1 - patch.warn / KILN_HEAT_WARN, 0, 1);
    c.save();
    if (!warning) c.globalAlpha *= clamp(patch.life / 0.3, 0.35, 1);
    c.fillStyle = warning ? '#bc815034' : '#d77c482b';
    c.fillRect(left, patch.y - (warning ? 4 : 8), patch.w, warning ? 4 : 8);
    c.strokeStyle = warning ? '#ba8d5d' : '#f2ba7a';
    c.lineWidth = warning ? 1 + charge : 2;
    c.setLineDash(warning ? [5, 7] : []);
    c.beginPath();
    c.moveTo(left, patch.y - 6);
    c.lineTo(left, patch.y - 1);
    c.lineTo(left + patch.w, patch.y - 1);
    c.lineTo(left + patch.w, patch.y - 6);
    c.stroke();
    c.setLineDash([]);
    if (!warning) {
      for (let x = left + 4; x < left + patch.w - 3; x += 9) {
        const height = reduced ? 5 : 4 + (Math.sin(x * 0.37 + g.time * 5) + 1) * 2;
        c.fillStyle = '#d9965f';
        c.beginPath();
        c.moveTo(x - 3, patch.y - 2);
        c.lineTo(x, patch.y - 2 - height);
        c.lineTo(x + 3, patch.y - 2);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }

  if ((e.state === 'windup' || e.state === 'rush') && e.attack !== 'flak') {
    const locked = e.state === 'rush' || e.timer <= KILN_LOCK,
      plans = e.state === 'rush' ? kiln.plans.slice(kiln.next) : kiln.plans;
    for (const arc of plans) {
      c.strokeStyle = locked ? '#b9916b' : '#785e49';
      c.lineWidth = 0.9;
      c.setLineDash(locked ? [] : [3, 12]);
      c.beginPath();
      for (let sample = 0; sample <= 24; sample++) {
        const point = sample === 24 ? arc.impact : kilnPoint(arc, (arc.fraction * sample) / 24);
        if (sample === 0) c.moveTo(point.x, point.y);
        else c.lineTo(point.x, point.y);
      }
      c.stroke();
      c.setLineDash([]);
      landing(c, g, arc, locked);
    }
  }

  for (const shell of kiln.shells) {
    landing(c, g, shell.arc, true);
    if (!reduced) {
      c.strokeStyle = '#a57750';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(shell.prev.x, shell.prev.y);
      c.lineTo(shell.pos.x, shell.pos.y);
      c.stroke();
    }
    c.fillStyle = '#bc8250';
    c.beginPath();
    c.arc(shell.pos.x, shell.pos.y, KILN_RADIUS, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#f2cd92';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = '#ffe0a1';
    c.fillRect(shell.pos.x - 2, shell.pos.y - 2, 4, 4);
  }

  if (e.state === 'windup' && e.attack === 'flak') {
    const origin = kilnMuzzle(e),
      angles = flakAngles(Math.atan2(e.aim.y, e.aim.x), e.phase === 1),
      locked = e.timer <= FLAK_LOCK;
    c.setLineDash(locked ? [] : [5, 8]);
    for (const [index, angle] of angles.entries()) {
      const center = index === Math.floor(angles.length / 2),
        end = g.lineEnd(origin, {
          x: origin.x + Math.cos(angle) * 380,
          y: origin.y + Math.sin(angle) * 380,
        });
      c.strokeStyle = locked ? (center ? '#ffe0a4' : '#d5ad73') : '#96714e';
      c.lineWidth = center ? 1.25 : 0.9;
      c.beginPath();
      c.moveTo(origin.x, origin.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
    c.setLineDash([]);
  }
  c.restore();
}

export function drawKiln(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean): void {
  const p = e.body.position,
    open = e.state === 'recover',
    lit = e.flash > 0;
  drawKilnEffects(c, g, e, reduced);
  c.save();
  c.translate(p.x, p.y);
  if (e.spawn > 0) c.globalAlpha *= clamp(1 - e.spawn / 0.65, 0.15, 1);

  // Broad treads and a round firebox distinguish the boiler from the tall press.
  c.fillStyle = '#242324';
  c.fillRect(-55, 26, 110, 16);
  c.fillStyle = '#6d6150';
  c.fillRect(-53, 27, 106, 3);
  for (const x of [-41, -14, 14, 41]) {
    c.fillStyle = '#81715a';
    c.beginPath();
    c.arc(x, 34, 5.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#39362f';
    c.beginPath();
    c.arc(x, 34, 2.5, 0, Math.PI * 2);
    c.fill();
  }

  for (const side of [-1, 1]) {
    c.save();
    c.translate(side * 26, -35);
    c.rotate(-side * 0.62);
    c.fillStyle = '#88755a';
    c.fillRect(-7, -33, 14, 37);
    c.fillStyle = '#b29b77';
    c.fillRect(-6, -31, 3, 32);
    c.fillStyle = '#514b3e';
    c.fillRect(-10, -32, 20, 7);
    c.fillStyle = '#201f20';
    c.fillRect(-7, -33, 14, 3);
    c.fillStyle = '#a3906f';
    c.fillRect(-10, -30, 3, 4);
    c.restore();
  }

  c.fillStyle = lit ? (reduced ? '#b1a18c' : '#fff0d5') : '#69533f';
  c.beginPath();
  c.moveTo(-58, -14);
  c.lineTo(-47, -32);
  c.lineTo(-30, -42);
  c.lineTo(30, -42);
  c.lineTo(47, -32);
  c.lineTo(58, -14);
  c.lineTo(58, 28);
  c.lineTo(-58, 28);
  c.closePath();
  c.fill();
  c.fillStyle = '#9f8463';
  c.fillRect(-29, -41, 58, 3);
  c.fillStyle = '#44392f';
  c.fillRect(-56, 14, 112, 12);
  c.fillStyle = '#bd7c53';
  c.fillRect(-58, 23, 116, 5);
  for (const side of [-1, 1]) {
    c.fillStyle = '#302d2a';
    c.fillRect(side < 0 ? -53 : 43, -12, 10, 23);
    c.fillStyle = '#a28b6b';
    c.fillRect(side < 0 ? -52 : 43, -13, 9, 2);
    c.fillRect(side < 0 ? -52 : 43, 10, 9, 2);
  }

  c.fillStyle = '#b09269';
  c.beginPath();
  c.ellipse(0, -5, 38, 29, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#292824';
  c.beginPath();
  c.ellipse(0, -5, 33, 25, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.ellipse(0, -5, 31, 23, 0, 0, Math.PI * 2);
  c.clip();
  if (open) {
    const glow = reduced ? 0.18 : 0.15 + (Math.sin(g.time * 5) + 1) * 0.03;
    c.fillStyle = `rgba(242,153,76,${glow})`;
    c.fillRect(-31, -28, 62, 46);
    c.fillStyle = lit ? '#fff0bc' : '#e8bd7e';
    for (let x = -23; x <= 23; x += 10) c.fillRect(x, -22, 5, 31);
    c.fillStyle = '#8b563b';
    c.fillRect(-29, -11, 58, 2);
    c.fillRect(-29, 2, 58, 2);
  }
  for (let y = -26; y < 18; y += 9) {
    c.fillStyle = lit ? '#c2ac85' : '#77624a';
    c.fillRect(-31, y, 62, open ? 2 : 7);
    c.fillStyle = '#ae9068';
    c.fillRect(-31, y, 62, 1.5);
    if (open) {
      c.fillStyle = '#463a2e';
      c.fillRect(-31, y + 2, 62, 1);
    }
  }
  c.restore();
  c.fillStyle = open ? '#efca8f' : '#bb7750';
  c.fillRect(-3, -37, 6, 3);
  if (e.state === 'windup' && e.spawn <= 0) {
    const tell = e.attack === 'flak' ? FLAK_TELL : KILN_TELL,
      lock = e.attack === 'flak' ? FLAK_LOCK : KILN_LOCK,
      charge = clamp(1 - e.timer / tell, 0, 1);
    c.fillStyle = e.timer <= lock ? '#ffe0a3' : '#c89562';
    c.beginPath();
    c.arc(0, -62, 2.5 + charge * 2, 0, Math.PI * 2);
    c.fill();
  }

  if (e.hp < e.maxHp) {
    c.fillStyle = '#493632';
    c.fillRect(-58, -77, 116, 3);
    c.fillStyle = '#e9a276';
    c.fillRect(-58, -77, 116 * clamp(e.hp / e.maxHp, 0, 1), 3);
  }
  if (e.spawn > 0) {
    c.strokeStyle = '#d7976b';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const side of [-1, 1]) {
      for (const y of [-70, 49]) {
        const x = side * 66,
          vertical = y < 0 ? 1 : -1;
        c.moveTo(x - side * 9, y);
        c.lineTo(x, y);
        c.lineTo(x, y + vertical * 9);
      }
    }
    c.stroke();
  }
  c.restore();
}
