import type Matter from 'matter-js';
import type { Game, Shot } from './game.ts';
import { firstSolid } from './collisions.ts';
import { direction, distance, type Vec } from './rules.ts';
import { recordRoute } from './retrace.ts';

export const MELT = { thickness: 48, cleanThickness: 96, gain: 0.65, cleanGain: 0.85, glow: 0.28 };
export interface MeltPass {
  entry: Vec;
  exit: Vec;
  dir: Vec;
  normal: Vec;
  length: number;
  gain: number;
}
export interface MeltTransit {
  pass: MeltPass;
  left: number;
}

// Clip against the actual convex hull. Thickness is distance travelled through
// material, so a shallow angle cannot turn a thick wall into a thin platform.
function interval(body: Matter.Body, from: Vec, d: Vec, radius: number) {
  let near = -Infinity,
    far = Infinity;
  let normal: Vec = { x: 0, y: 0 };
  const vertices = body.vertices;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const size = Math.hypot(b.x - a.x, b.y - a.y);
    if (!size) continue;
    const n = { x: -(b.y - a.y) / size, y: (b.x - a.x) / size };
    const dots = vertices.map((v) => v.x * n.x + v.y * n.y);
    const padding = radius * (Math.abs(n.x) + Math.abs(n.y));
    const low = Math.min(...dots) - padding,
      high = Math.max(...dots) + padding;
    const start = from.x * n.x + from.y * n.y,
      delta = d.x * n.x + d.y * n.y;
    if (Math.abs(delta) < 1e-8) {
      if (start < low || start > high) return null;
      continue;
    }
    const t1 = (low - start) / delta,
      t2 = (high - start) / delta;
    near = Math.max(near, Math.min(t1, t2));
    if (Math.max(t1, t2) < far) {
      far = Math.max(t1, t2);
      normal = { x: Math.sign(delta) * n.x, y: Math.sign(delta) * n.y };
    }
    if (near > far) return null;
  }
  return Number.isFinite(near + far) && far > 0 ? { near, far, normal } : null;
}

// Pure geometry, shared by bullets and beam traces. Loose props, moving
// machinery and world boundaries deliberately keep their ordinary collisions.
export function meltPass(
  g: Game,
  body: Matter.Body,
  entry: Vec,
  dir: Vec,
  radius: number,
): MeltPass | null {
  if (!g.mods.includes('melt-through') || !body.isStatic || !g.terrain.includes(body)) return null;
  const b = body.bounds;
  if (b.min.x < 0 || b.max.x > g.worldWidth || b.min.y <= g.worldTop || b.max.y > 740) return null;
  const d = direction({ x: 0, y: 0 }, dir);
  if (!d.x && !d.y) return null;
  const material = interval(body, entry, d, 0),
    hull = interval(body, entry, d, radius);
  const clean = g.mods.includes('clean-cut');
  if (
    !material ||
    !hull ||
    material.far - material.near > (clean ? MELT.cleanThickness : MELT.thickness) + 1e-6
  )
    return null;
  const length = hull.far + 0.5;
  const exit = { x: entry.x + d.x * length, y: entry.y + d.y * length };
  if (
    firstSolid(
      entry,
      exit,
      { x: radius, y: radius },
      g.solidBodies.filter((other) => other !== body),
    )
  )
    return null;
  return {
    entry: { ...entry },
    exit,
    dir: d,
    normal: hull.normal,
    length,
    gain: clean ? MELT.cleanGain : MELT.gain,
  };
}

export class MeltThroughSystem {
  game: Game;
  marks: { pos: Vec; normal: Vec; at: number }[] = [];
  private beamId = -1;
  private beams = new Map<number, { pass: MeltPass; damage: number }>();
  constructor(game: Game) {
    this.game = game;
  }
  reset() {
    this.marks = [];
    this.beams.clear();
    this.beamId = -1;
  }
  private glow(pos: Vec, normal: Vec) {
    const g = this.game;
    this.marks = this.marks.filter((m) => g.time - m.at < MELT.glow);
    const mark = this.marks.find((m) => distance(m.pos, pos) < 9);
    if (mark) mark.at = g.time;
    else this.marks.push({ pos: { ...pos }, normal: { ...normal }, at: g.time });
    if (this.marks.length > 32) this.marks.shift();
  }
  begin(s: Shot, body: Matter.Body) {
    if (!s.friendly || s.fragment || s.reflected || s.blade || s.meltSpent) return false;
    const pass = meltPass(this.game, body, s.pos, s.vel, s.radius);
    if (!pass) return false;
    s.meltSpent = true;
    s.meltTransit = { pass, left: pass.length };
    s.waypoints = undefined;
    if (s.massDriver) s.massDriver.rolling = undefined;
    recordRoute(s);
    this.glow(pass.entry, { x: -pass.dir.x, y: -pass.dir.y });
    return true;
  }
  advance(s: Shot, remaining: number) {
    const transit = s.meltTransit!;
    const speed = Math.hypot(s.vel.x, s.vel.y);
    if (!(speed > 0)) {
      s.life = 0;
      return 0;
    }
    const travelled = Math.min(transit.left, speed * remaining);
    const p = transit.pass;
    s.pos = { x: s.pos.x + p.dir.x * travelled, y: s.pos.y + p.dir.y * travelled };
    transit.left -= travelled;
    this.game.massDriver.travel(s, travelled);
    if (transit.left < 1e-6) {
      s.pos = { ...p.exit };
      s.prev = { ...p.exit };
      s.meltTransit = undefined;
      const damage = s.damage;
      s.damage *= p.gain;
      if (s.shell) s.shell.damage *= p.gain;
      if (s.trace) s.trace.points = [{ ...p.exit }];
      recordRoute(s);
      this.glow(p.exit, p.normal);
      if (s.life > 0) this.fragments(p, damage);
    }
    return Math.max(0, remaining - travelled / speed);
  }
  beam(id: number, ray: number, pass: MeltPass, damage: number) {
    if (this.beamId !== id) {
      this.flushBeam();
      this.beamId = id;
    }
    this.glow(pass.entry, { x: -pass.dir.x, y: -pass.dir.y });
    this.glow(pass.exit, pass.normal);
    if (!this.game.mods.includes('blowout')) return;
    const previous = this.beams.get(ray);
    if (previous) {
      previous.damage += damage;
      previous.pass = pass;
    } else if (this.beams.size < 4) this.beams.set(ray, { pass, damage });
  }
  // Integrate actual lit damage, then release at most one cone per ray/pulse.
  // A tap cannot receive a full pulse's fragments and FPS cannot multiply them.
  flushBeam() {
    for (const { pass, damage } of this.beams.values()) this.fragments(pass, damage);
    this.beams.clear();
  }
  private fragments(p: MeltPass, damage: number) {
    const g = this.game;
    if (!g.mods.includes('blowout') || g.mode !== 'playing' || !(damage > 0)) return;
    const angle = Math.atan2(p.dir.y, p.dir.x);
    for (const offset of [-0.28, 0, 0.28])
      g.addShot({
        pos: { ...p.exit },
        vel: { x: Math.cos(angle + offset) * 16, y: Math.sin(angle + offset) * 16 },
        damage: damage * 0.12,
        life: 0.18,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: true,
        split: true,
        molten: true,
      });
  }
}

export function drawMelt(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  c.save();
  c.lineCap = 'round';
  for (const m of g.melt.marks) {
    const fade = 1 - (g.time - m.at) / MELT.glow;
    if (fade <= 0) continue;
    const tangent = { x: -m.normal.y * 5, y: m.normal.x * 5 };
    c.beginPath();
    c.moveTo(m.pos.x - tangent.x, m.pos.y - tangent.y);
    c.lineTo(m.pos.x + tangent.x, m.pos.y + tangent.y);
    if (!reduced) {
      c.globalAlpha = fade * 0.3;
      c.lineWidth = 8;
      c.strokeStyle = '#e89958';
      c.stroke();
    }
    c.globalAlpha = fade;
    c.lineWidth = 2;
    c.strokeStyle = '#fff0d6';
    c.stroke();
  }
  c.restore();
}
