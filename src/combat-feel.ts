import type Matter from 'matter-js';
import type { Enemy, Game, Shot } from './game.ts';
import { clamp, direction, type Vec } from './rules.ts';
import { attackBrace, effectOpacity } from './combat-readability.ts';

export type RoundFeel = 'pellet' | 'nail';
export const NAIL_LIFETIME = 1.8;
export const MAX_EMBEDDED_NAILS = 64;
export const MAX_COMBAT_IMPACTS = 48;

// Snapshot the native tool at discharge; converted ammunition keeps its own art.
export function roundFeel(s: Shot): RoundFeel | undefined {
  return s.friendly &&
    !s.fragment &&
    !s.allied &&
    !s.reflected &&
    !s.echo &&
    !s.shell &&
    !s.blade &&
    !s.rail &&
    !s.massDriver &&
    !s.enemyAmmo &&
    !s.molten
    ? s.feel
    : undefined;
}

export function pumpCycle(age: number, interval: number): number {
  const duration = clamp(interval * 0.72, 0.02, 0.42);
  const phase = (age - duration * 0.15) / duration;
  return phase > 0 && phase < 1 ? Math.sin(phase * Math.PI) ** 2 : 0;
}

export function playerPose(g: Game, reduced: boolean) {
  const motion = reduced ? 0 : 1;
  const velocity = g.player.velocity;
  const launch = !g.grounded ? clamp(1 - (g.time - g.jumpAt) / 0.18, 0, 1) : 0;
  const landing = g.grounded ? clamp(1 - (g.time - g.combatFeel.landedAt) / 0.2, 0, 1) : 0;
  const impact = landing * landing * g.combatFeel.landingStrength;
  const kick = clamp(1 - (g.time - g.lastShot) / 0.14, 0, 1) ** 2;
  const weight = g.startingGun === 'shotgun' || g.massDriver.equipped ? 1.5 : 1;
  const aim = direction(g.player.position, g.aim);
  const airborne = !g.grounded ? clamp(-velocity.y / 18, -0.045, 0.06) : 0;
  const stretch = (launch * 0.1 + airborne - impact * 0.17) * motion;
  return {
    x: motion ? -aim.x * kick * weight * 1.5 : 0,
    y: (impact * 3 - launch * 1.5 - aim.y * kick) * motion,
    angle: (clamp(velocity.x * 0.012, -0.14, 0.14) - aim.x * kick * weight * 0.035) * motion,
    scaleX: 1 - stretch * 0.7,
    scaleY: 1 + stretch,
    stride:
      motion *
      (g.grounded
        ? Math.sin(g.player.position.x * 0.16) * clamp(Math.abs(velocity.x), 0, 3)
        : clamp(-velocity.y * 0.18, -2, 2)),
  };
}

export function enemyPose(e: Enemy, reduced: boolean) {
  const mobile = ['runner', 'shooter', 'sniper', 'flyer'].includes(e.kind) && e.spawn <= 0;
  const motion = reduced || !mobile ? 0 : 1;
  const hit = clamp(e.flash / 0.08, 0, 1) ** 2;
  const brace = attackBrace(e);
  const stride =
    Math.sin(e.body.position.x * 0.19 + e.id) *
    clamp(Math.abs(e.body.velocity.x), 0, 2.5) *
    (1 - brace);
  return {
    angle:
      motion *
      (clamp(e.body.velocity.x * 0.014, -0.07, 0.07) +
        (e.hitDirection?.x ?? 0) * hit * 0.065 -
        e.aim.x * brace * 0.04),
    crouch: motion * brace * 1.5,
    stride: motion * stride,
    brace,
  };
}

interface EmbeddedNail {
  body: Matter.Body;
  local: Vec;
  angle: number;
  at: number;
}
interface CombatImpact {
  pos: Vec;
  normal: Vec;
  at: number;
  seed: number;
  kind: RoundFeel;
}

// All clocks and variation are cosmetic: no physics, damage or seeded RNG calls.
export class CombatFeel {
  nails: EmbeddedNail[] = [];
  impacts: CombatImpact[] = [];
  landedAt = -100;
  landingStrength = 0;
  pumpAt: number | null = null;
  pumpStartedAt = -100;
  reset() {
    this.nails = [];
    this.impacts = [];
    this.pumpAt = null;
    this.pumpStartedAt = -100;
    this.landedAt = -100;
    this.landingStrength = 0;
  }
  land(time: number, speed: number) {
    this.landedAt = time;
    this.landingStrength = clamp(speed / 12, 0, 1);
  }
  impact(s: Shot, normal: Vec, time: number, body?: Matter.Body) {
    const kind = roundFeel(s);
    if (!kind) return;
    // Nearby pellets share a compact impact; no screen-filling blast clouds.
    if (
      !this.impacts.some(
        (i) =>
          i.at === time && i.kind === kind && Math.hypot(i.pos.x - s.pos.x, i.pos.y - s.pos.y) < 7,
      )
    ) {
      this.impacts.push({ pos: { ...s.pos }, normal: { ...normal }, at: time, seed: s.id, kind });
      if (this.impacts.length > MAX_COMBAT_IMPACTS) this.impacts.shift();
    }
    if (kind !== 'nail' || !body) return;
    // The collision sweep stops the round's centre one radius off the surface.
    const dx = s.pos.x - normal.x * s.radius - body.position.x,
      dy = s.pos.y - normal.y * s.radius - body.position.y;
    const cos = Math.cos(body.angle),
      sin = Math.sin(body.angle);
    this.nails.push({
      body,
      local: { x: dx * cos + dy * sin, y: -dx * sin + dy * cos },
      angle: Math.atan2(s.vel.y, s.vel.x) - body.angle,
      at: time,
    });
    if (this.nails.length > MAX_EMBEDDED_NAILS) this.nails.shift();
  }
  update(time: number, bodies: readonly Matter.Body[], sound: (kind: string) => void) {
    this.impacts = this.impacts.filter((i) => time - i.at < 0.2);
    if (this.nails.length) {
      const active = new Set(bodies);
      this.nails = this.nails.filter((n) => time - n.at < NAIL_LIFETIME && active.has(n.body));
    }
    if (this.pumpAt !== null && time >= this.pumpAt) {
      this.pumpAt = null;
      sound('shotgun-pump');
    }
  }
}

export function nailPosition(nail: EmbeddedNail): Vec {
  const cos = Math.cos(nail.body.angle),
    sin = Math.sin(nail.body.angle);
  return {
    x: nail.body.position.x + nail.local.x * cos - nail.local.y * sin,
    y: nail.body.position.y + nail.local.x * sin + nail.local.y * cos,
  };
}

export function drawCombatImpacts(
  c: CanvasRenderingContext2D,
  g: Game,
  reduced: boolean,
  threats: Shot[],
) {
  c.save();
  c.lineCap = 'round';
  for (const nail of g.combatFeel.nails) {
    const age = g.time - nail.at,
      p = nailPosition(nail);
    c.save();
    c.globalAlpha = clamp((NAIL_LIFETIME - age) / 0.35, 0, 1) * effectOpacity(p, 10, threats);
    c.translate(p.x, p.y);
    c.rotate(nail.angle + nail.body.angle);
    c.strokeStyle = '#8badae';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-9, 0);
    c.lineTo(1, 0);
    c.stroke();
    c.strokeStyle = '#d7e3da';
    c.beginPath();
    c.moveTo(-9, -2);
    c.lineTo(-9, 2);
    c.stroke();
    c.restore();
  }
  for (const impact of g.combatFeel.impacts) {
    const age = clamp((g.time - impact.at) / 0.2, 0, 1);
    c.save();
    c.globalAlpha = (1 - age) * (reduced ? 0.3 : 0.8) * effectOpacity(impact.pos, 15, threats);
    c.translate(impact.pos.x, impact.pos.y);
    c.rotate(Math.atan2(impact.normal.y, impact.normal.x));
    c.strokeStyle = impact.kind === 'nail' ? '#b5d4d0' : '#f5cd8f';
    c.lineWidth = impact.kind === 'pellet' ? 2 : 1.3;
    for (let i = 0; i < (reduced ? 1 : 3); i++) {
      const angle = (i - 1) * 0.6 + ((impact.seed % 5) - 2) * 0.07;
      const length = (impact.kind === 'pellet' ? 13 : 9) * (0.25 + age);
      c.beginPath();
      c.moveTo(Math.cos(angle) * length * 0.4, Math.sin(angle) * length * 0.4);
      c.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

export function drawNail(c: CanvasRenderingContext2D, s: Shot) {
  c.save();
  c.translate(s.pos.x, s.pos.y);
  c.rotate(Math.atan2(s.vel.y, s.vel.x));
  c.fillStyle = s.charged ? '#eff5b5' : '#d0e5df';
  c.fillRect(-8, -0.8, 9, 1.6);
  c.fillRect(-8, -2, 1.5, 4);
  c.restore();
}
