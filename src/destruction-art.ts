import type { Game } from './game.ts';
import type { Breakable } from './destruction.ts';
import type { Solid } from './levels.ts';
import type { Vec } from './rules.ts';
import { materialPose, materialTerrainSnapshot } from './material-response.ts';

const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function bolt(c: CanvasRenderingContext2D, x: number, y: number, worn = false) {
  c.fillStyle = worn ? '#384b48' : '#a0ad9e';
  c.beginPath();
  c.arc(x, y, 1.35, 0, Math.PI * 2);
  c.fill();
  line(c, { x: x - 0.6, y: y + 0.2 }, { x: x + 0.6, y: y - 0.2 }, '#263b3a', 0.7);
}
interface TerrainAppearance {
  wear: 0 | 1 | 2;
  damage: number;
  hitLocal: Vec | null;
  hitStrength: number;
}
/** Paint captive construction inside the real solid; no apparent extra platform or detached collision. */
function drawTerrainAssembly(
  c: CanvasRenderingContext2D,
  rect: Solid,
  appearance: TerrainAppearance,
  reduced: boolean,
) {
  const { x, y, w, h } = rect;
  if (![x, y, w, h].every(Number.isFinite) || w < 12 || h < 12) return;
  const shelf = h <= 28,
    damage = limit(appearance.damage, 0, 1),
    strain = reduced ? 0 : limit(appearance.hitStrength, 0, 1) * 1.1,
    ribs = Math.max(1, Math.min(shelf ? 8 : 5, Math.floor(w / (shelf ? 46 : 62)))),
    spacing = (w - 12) / ribs;
  c.save();
  c.beginPath();
  c.rect(x + 1, y + 1, w - 2, h - 2);
  c.clip();
  c.translate(x, y);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (shelf) {
    // A continuous top plate remains readable above the weaker riveted web.
    c.fillStyle = '#3b514e';
    c.fillRect(3, 4, w - 6, h - 7);
    c.fillStyle = '#263d3c';
    c.fillRect(5, 7, w - 10, Math.max(1, h - 12));
    line(c, { x: 3, y: 3 }, { x: w - 3, y: 3 }, '#96a99e', 1.25);
    line(c, { x: 3, y: h - 3 }, { x: w - 3, y: h - 3 }, '#6d8378', 1.3);
    for (let i = 0; i < ribs; i++) {
      const left = 6 + i * spacing,
        right = left + spacing;
      line(c, { x: left, y: h - 5 }, { x: (left + right) / 2, y: 6 + strain }, '#778c7f', 1.2);
      line(c, { x: (left + right) / 2, y: 6 + strain }, { x: right, y: h - 5 }, '#556e64', 1.2);
      bolt(c, left, h / 2, appearance.wear === 2 && i % 2 === 0);
    }
    bolt(c, w - 6, h / 2);
  } else {
    c.strokeStyle = '#6f8379';
    c.lineWidth = 1.1;
    c.strokeRect(3, 3, w - 6, h - 6);
    for (let i = 0; i < ribs; i++) {
      const left = 6 + i * spacing,
        right = left + spacing - 3,
        mid = h * (0.46 + (i % 2) * 0.08);
      c.fillStyle = i % 2 ? 'rgba(48,69,65,0.26)' : 'rgba(30,49,47,0.22)';
      c.fillRect(left, 6, Math.max(1, right - left), h - 12);
      line(c, { x: left, y: 6 }, { x: left, y: h - 6 }, '#73887d', 1.15);
      line(c, { x: left + 1.5, y: 7 }, { x: left + 1.5, y: h - 7 }, '#243b39', 1);
      line(c, { x: left + 2, y: mid + strain }, { x: right, y: mid }, '#536e64', 1.5);
      for (const by of [8, h - 8]) bolt(c, left + 4, by, appearance.wear === 2 && i % 2 === 0);
    }
    for (const by of [8, h - 8]) bolt(c, w - 8, by);
  }
  // An existing fractured seam identifies registered weak stock at full health.
  const seam = limit(w * 0.57, 6, w - 6),
    spread = shelf ? Math.min(4, w * 0.025) : Math.min(11, w * 0.07),
    top = shelf ? 4 : 5,
    bottom = h - (shelf ? 4 : 5);
  const fissure = [
    { x: seam - spread * 0.8, y: top },
    { x: seam + spread * 0.2, y: h * 0.34 },
    { x: seam - spread * 0.45, y: h * 0.62 },
    { x: seam + spread * 0.75, y: bottom },
  ];
  c.strokeStyle = '#223735';
  c.lineWidth = 1.6 + damage * 2.1;
  c.beginPath();
  c.moveTo(fissure[0].x, fissure[0].y);
  for (const p of fissure.slice(1)) c.lineTo(p.x, p.y);
  c.stroke();
  c.strokeStyle = appearance.wear > 0 ? '#bcb497' : '#8e9e8e';
  c.lineWidth = 0.7 + damage * 0.5;
  c.stroke();
  for (let i = 0; i < appearance.wear; i++) {
    const p = fissure[i + 1],
      sign = i % 2 ? 1 : -1,
      end = {
        x: limit(p.x + sign * (7 + damage * 8), 4, w - 4),
        y: limit(p.y + (shelf ? 2 : 11), 4, h - 4),
      };
    line(c, p, end, '#203431', 2.1);
    line(c, { x: p.x, y: p.y + 1 }, { x: end.x, y: end.y + 1 }, '#a5ab91', 0.7);
  }
  if (appearance.hitLocal) {
    const px = limit(appearance.hitLocal.x + w / 2, 4, w - 4),
      py = limit(appearance.hitLocal.y + h / 2, 4, h - 4),
      radius = 2.5 + appearance.wear * 0.65,
      reach = radius + (reduced ? 0 : strain * 3.5);
    // A captive chip at the admitted contact persists; the restrained strain eases with simulation time.
    c.fillStyle = '#213632';
    c.beginPath();
    c.moveTo(px - radius, py);
    c.lineTo(px - 0.8, py - radius);
    c.lineTo(px + radius, py + 0.6);
    c.lineTo(px + 0.3, py + radius);
    c.closePath();
    c.fill();
    line(c, { x: px - radius, y: py }, { x: px - 0.8, y: py - radius }, '#d0c3a1', 1.1);
    line(
      c,
      { x: px + 0.6, y: py + 0.7 },
      { x: limit(px + reach, 3, w - 3), y: limit(py + reach * 0.52, 3, h - 3) },
      '#b7b69a',
      0.9,
    );
    if (!reduced && appearance.hitStrength > 0) {
      c.globalAlpha *= limit(appearance.hitStrength, 0, 1) * 0.28;
      c.strokeStyle = '#dfd0ab';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(px, py, reach + 1.5, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.restore();
}

/** Production path: only actual registered weak terrain can receive this construction and response. */
export function drawMaterialTerrain(
  c: CanvasRenderingContext2D,
  g: Game,
  piece: Breakable,
  reduced: boolean,
): boolean {
  const snapshot = materialTerrainSnapshot(g, piece);
  if (!snapshot) return false;
  const pose = materialPose(snapshot, g.time, reduced);
  drawTerrainAssembly(
    c,
    piece.rect,
    {
      wear: pose.wear,
      damage: 1 - snapshot.hp / snapshot.maxHp,
      hitLocal: snapshot.hit?.local ?? null,
      hitStrength: pose.hitStrength,
    },
    reduced,
  );
  return true;
}

/** Compatibility entry point for existing standalone weak-material pictures. */
export function drawCracks(c: CanvasRenderingContext2D, piece: Breakable, reduced: boolean) {
  const health = piece.maxHp > 0 ? limit(piece.hp / piece.maxHp, 0, 1) : 1;
  drawTerrainAssembly(
    c,
    piece.rect,
    {
      wear: health <= 0.3 ? 2 : health <= 0.65 ? 1 : 0,
      damage: 1 - health,
      hitLocal: null,
      hitStrength: reduced ? 0 : limit(piece.flash / 0.07, 0, 1),
    },
    reduced,
  );
}
