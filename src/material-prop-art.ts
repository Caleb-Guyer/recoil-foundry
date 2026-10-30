import type { Game } from './game.ts';
import type { Prop } from './props.ts';
import type { Vec } from './rules.ts';
import { materialPropSnapshot, materialPose, type MaterialSnapshot } from './material-response.ts';

type Pose = ReturnType<typeof materialPose>;
const DARK = '#17272b';
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function bolt(c: CanvasRenderingContext2D, x: number, y: number, color = '#a9b5a3', radius = 1.4) {
  c.fillStyle = DARK;
  c.beginPath();
  c.arc(x, y, radius + 0.7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  line(c, { x: x - radius * 0.55, y: y - 0.1 }, { x: x + radius * 0.55, y: y - 0.1 }, DARK, 0.65);
}
function plate(
  c: CanvasRenderingContext2D,
  points: readonly Vec[],
  fill: string,
  edge: string,
  width = 1,
) {
  c.fillStyle = fill;
  c.strokeStyle = edge;
  c.lineWidth = width;
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fill();
  c.stroke();
}
function rail(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#526963';
  c.fillRect(x, y, w, h);
  line(c, { x, y }, { x: x + w, y }, '#a8b29b', 1.1);
  line(c, { x, y: y + h }, { x: x + w, y: y + h }, '#263d3c', 1.2);
}
function crate(c: CanvasRenderingContext2D, s: MaterialSnapshot, p: Pose) {
  const x = -s.width / 2,
    y = -s.height / 2,
    w = s.width,
    h = s.height;
  c.fillStyle = '#354c49';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#76684b';
  c.fillRect(x + 4, y + 4, w - 8, h - 8);
  for (let i = 0; i < 3; i++) {
    const yy = y + 6 + (i * (h - 12)) / 3;
    c.fillStyle = i % 2 ? '#746344' : '#827351';
    c.fillRect(x + 5, yy, w - 10, (h - 16) / 3);
    line(c, { x: x + 5, y: yy + 1 }, { x: x + w - 5, y: yy + 1 }, '#ad9d71', 0.8);
  }
  c.save();
  c.translate(p.offset.x, p.offset.y);
  c.rotate(p.angle);
  // Cross stays captive inside the fixed native hull; impacts never move the collision outline.
  for (const side of [-1, 1]) {
    line(
      c,
      { x: x + 7, y: side < 0 ? y + 7 : y + h - 7 },
      { x: x + w - 7, y: side < 0 ? y + h - 7 : y + 7 },
      DARK,
      6,
    );
    line(
      c,
      { x: x + 7, y: side < 0 ? y + 7 : y + h - 7 },
      { x: x + w - 7, y: side < 0 ? y + h - 7 : y + 7 },
      '#87968a',
      3.2,
    );
  }
  c.fillStyle = '#354b45';
  c.fillRect(-7, -7, 14, 14);
  c.strokeStyle = '#b8b68e';
  c.lineWidth = 1;
  c.strokeRect(-7, -7, 14, 14);
  c.fillStyle = '#b5b995';
  c.fillRect(-3.5, -3, 7, 6);
  line(c, { x: -2, y: 0 }, { x: 2, y: 0 }, '#526451', 1);
  c.restore();
  for (const yy of [y, y + h - 5]) rail(c, x, yy, w, 5);
  for (const xx of [x, x + w - 5]) rail(c, xx, y, 5, h);
  for (const xx of [x + 4, x + w - 4]) for (const yy of [y + 4, y + h - 4]) bolt(c, xx, yy);
  for (const side of [-1, 1]) {
    c.fillStyle = DARK;
    c.fillRect(side < 0 ? x + 1 : x + w - 4, -5, 3, 10);
    line(
      c,
      { x: side < 0 ? x + 2 : x + w - 2, y: -4 },
      { x: side < 0 ? x + 2 : x + w - 2, y: 4 },
      '#8c9c87',
      1,
    );
  }
  if (p.wear > 0) {
    line(c, { x: -12, y: -14 }, { x: -6, y: -9 }, DARK, 2.2);
    line(c, { x: -6, y: -9 }, { x: -8, y: -4 }, DARK, 1.6);
    line(c, { x: -12, y: -15 }, { x: -6, y: -10 }, '#b4aa7c', 0.8);
  }
  if (p.wear > 1) {
    plate(
      c,
      [
        { x: 8, y: 6 },
        { x: 16, y: 3 },
        { x: 16, y: 14 },
        { x: 10, y: 11 },
      ],
      DARK,
      '#a5996c',
      0.8,
    );
    line(c, { x: 11, y: 7 }, { x: 14, y: 8 }, '#8d9a84', 1);
    line(c, { x: -15, y: 12 }, { x: -7, y: 14 }, DARK, 2);
  }
}
function cover(c: CanvasRenderingContext2D, s: MaterialSnapshot, p: Pose) {
  const x = -s.width / 2,
    y = -s.height / 2,
    w = s.width,
    h = s.height;
  c.fillStyle = '#263e40';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#71847a';
  c.fillRect(x + 2, y + 2, w - 4, h - 4);
  c.fillStyle = '#304a48';
  c.fillRect(x + 4, y + 5, w - 8, h - 10);
  c.save();
  c.translate(p.offset.x * 0.65, p.offset.y);
  c.rotate(p.angle * 0.7);
  for (let i = 0; i < 4; i++) {
    const top = y + 7 + (i * (h - 13)) / 4,
      bend = p.wear > 1 && i === 2 ? 2 : 0;
    plate(
      c,
      [
        { x: x + 5, y: top },
        { x: x + w - 5, y: top + bend },
        { x: x + w - 5 - bend, y: top + 13 },
        { x: x + 5, y: top + 13 },
      ],
      i % 2 ? '#50675e' : '#5d7266',
      '#8c9a83',
      0.8,
    );
    line(c, { x: x + 7, y: top + 4 }, { x: x + w - 7, y: top + 4 }, '#293e3c', 1.3);
    line(c, { x: x + 7, y: top + 9 }, { x: x + w - 7, y: top + 9 }, '#a1a88b', 0.7);
  }
  c.restore();
  for (const xx of [x + 2, x + w - 3]) {
    c.fillStyle = '#90a18e';
    c.fillRect(xx, y + 2, 1, h - 4);
  }
  for (const yy of [y + 4, 0, y + h - 4])
    for (const xx of [x + 4, x + w - 4]) bolt(c, xx, yy, '#b0b69a', 1.1);
  // Thick foot and top cap retain the real narrow upright silhouette.
  rail(c, x, y, w, 4);
  rail(c, x, y + h - 5, w, 5);
  if (p.wear > 0) {
    line(c, { x: -6, y: -24 }, { x: 3, y: -19 }, DARK, 2);
    line(c, { x: 3, y: -19 }, { x: -2, y: -12 }, DARK, 1.6);
  }
  if (p.wear > 1) {
    line(c, { x: -7, y: 12 }, { x: 5, y: 17 }, DARK, 2.5);
    line(c, { x: 5, y: 17 }, { x: 2, y: 26 }, DARK, 1.8);
    line(c, { x: -6, y: 11 }, { x: 4, y: 16 }, '#c6b28b', 0.7);
  }
}
function canister(c: CanvasRenderingContext2D, s: MaterialSnapshot, p: Pose, reduced: boolean) {
  const w = s.width,
    h = s.height,
    x = -w / 2,
    y = -h / 2,
    armed = p.canister !== 'sealed';
  c.fillStyle = DARK;
  c.fillRect(x, y, w, h);
  // Curved vessel faces sit wholly within the native rectangular sweep hull.
  plate(
    c,
    [
      { x: x + 4, y: y + 2 },
      { x: x + w - 4, y: y + 2 },
      { x: x + w - 1, y: y + 6 },
      { x: x + w - 1, y: y + h - 5 },
      { x: x + w - 4, y: y + h - 1 },
      { x: x + 4, y: y + h - 1 },
      { x: x + 1, y: y + h - 5 },
      { x: x + 1, y: y + 6 },
    ],
    armed ? '#887141' : '#65563b',
    armed ? '#d6b876' : '#b19d6e',
    1.1,
  );
  c.fillStyle = '#aa9160';
  c.fillRect(x + 4, y + 5, 3, h - 10);
  c.fillStyle = '#4a4b37';
  c.fillRect(x + w - 5, y + 5, 3, h - 10);
  c.save();
  c.translate(p.offset.x * 0.5, p.offset.y * 0.5);
  c.rotate(p.angle * 0.45);
  for (const yy of [y + 6, y + h - 9]) {
    c.fillStyle = '#334843';
    c.fillRect(x + 1, yy, w - 2, 4);
    line(c, { x: x + 2, y: yy }, { x: x + w - 2, y: yy }, '#94a08a', 1);
  }
  // The valve follows native arming, not an invented detonation countdown.
  c.save();
  c.translate(0, y + 4);
  c.rotate((reduced ? (armed ? 1 : 0) : p.arming) * Math.PI * 0.5);
  line(c, { x: -5, y: 0 }, { x: 5, y: 0 }, '#dad0a0', 2);
  line(c, { x: 0, y: -2 }, { x: 0, y: 2 }, '#dad0a0', 1.5);
  bolt(c, 0, 0, '#6e7861', 1.25);
  c.restore();
  plate(
    c,
    [
      { x: 0, y: -6 },
      { x: 7, y: 1 },
      { x: 0, y: 8 },
      { x: -7, y: 1 },
    ],
    DARK,
    armed ? '#f2cf85' : '#b59c62',
    1,
  );
  c.fillStyle = armed ? '#ffdc90' : '#c1ac78';
  c.fillRect(-1, -3, 2, 5);
  c.fillRect(-1, 4, 2, 1.5);
  c.restore();
}
function cargo(c: CanvasRenderingContext2D, s: MaterialSnapshot, p: Pose, railLoad: boolean) {
  const w = s.width,
    h = s.height,
    x = -w / 2,
    y = -h / 2;
  c.fillStyle = '#2d4442';
  c.fillRect(x, y, w, h);
  c.fillStyle = '#192e32';
  c.fillRect(x + 5, y + 5, w - 10, h - 10);
  c.save();
  c.translate(p.offset.x, p.offset.y * 0.65);
  c.rotate(p.angle * 0.35);
  if (railLoad) {
    for (let i = 0; i < 4; i++) {
      const yy = y + 8 + i * 10,
        shift = i % 2 ? 4 : 0;
      plate(
        c,
        [
          { x: x + 10 + shift, y: yy },
          { x: x + w - 10, y: yy },
          { x: x + w - 13, y: yy + 7 },
          { x: x + 8 + shift, y: yy + 7 },
        ],
        i % 2 ? '#657557' : '#7c8160',
        '#a3aa86',
        0.8,
      );
      line(c, { x: x + 14 + shift, y: yy + 2 }, { x: x + w - 16, y: yy + 2 }, '#344d44', 0.8);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const xx = x + 8 + (i * (w - 16)) / 3;
      plate(
        c,
        [
          { x: xx, y: y + 8 },
          { x: xx + (w - 22) / 3, y: y + 8 },
          { x: xx + (w - 22) / 3, y: y + h - 8 },
          { x: xx, y: y + h - 8 },
        ],
        i % 2 ? '#4f6457' : '#5b705e',
        '#7d927c',
        0.8,
      );
      for (let row = 0; row < 3; row++)
        line(
          c,
          { x: xx + 4, y: y + 16 + row * 10 },
          { x: xx + (w - 22) / 3 - 4, y: y + 16 + row * 10 },
          '#314c43',
          1.3,
        );
    }
  }
  c.restore();
  for (const side of [-1, 1]) {
    const xx = side * 30;
    rail(c, xx - 3, y, 6, h);
    for (const yy of [y + 6, y + h - 6]) bolt(c, xx, yy, '#c6c2a0', 1.5);
  }
  rail(c, x, y, w, 5);
  rail(c, x, y + h - 5, w, 5);
  for (let xx = x + 8; xx < x + w - 8; xx += 14) {
    c.fillStyle = '#b8a06b';
    c.fillRect(xx, y + h - 8, 8, 3);
    line(c, { x: xx + 1, y: y + h - 8 }, { x: xx + 5, y: y + h - 5 }, '#5d6650', 1);
  }
  // Fixed lifting eyes join the unchanged native cable at the top center.
  c.fillStyle = DARK;
  c.fillRect(-8, y, 16, 6);
  c.strokeStyle = '#b0ae82';
  c.lineWidth = 1.4;
  c.strokeRect(-5, y + 1, 10, 3);
  if (p.wear > 0) {
    line(c, { x: x + 14, y: y + 11 }, { x: x + 23, y: y + 17 }, DARK, 2);
    line(c, { x: x + 23, y: y + 17 }, { x: x + 19, y: y + 24 }, DARK, 1.8);
  }
  if (p.wear > 1) {
    plate(
      c,
      [
        { x: 9, y: 4 },
        { x: 22, y: 1 },
        { x: 21, y: 17 },
        { x: 10, y: 14 },
      ],
      DARK,
      '#a5a07a',
      1,
    );
    line(c, { x: 12, y: 8 }, { x: 18, y: 10 }, '#69816e', 1.5);
  }
}
function localImpact(c: CanvasRenderingContext2D, s: MaterialSnapshot, p: Pose, reduced: boolean) {
  if (!p.hitLocal || !(p.hitStrength > 0)) return;
  const point = {
    x: Math.max(-s.width / 2 + 1, Math.min(s.width / 2 - 1, p.hitLocal.x)),
    y: Math.max(-s.height / 2 + 1, Math.min(s.height / 2 - 1, p.hitLocal.y)),
  };
  c.save();
  c.globalAlpha *= reduced ? 0.7 : Math.max(0.25, p.hitStrength);
  line(c, { x: point.x - 2, y: point.y - 2 }, { x: point.x + 1, y: point.y + 1 }, '#d7c7a1', 1.4);
  line(c, { x: point.x + 1, y: point.y + 1 }, { x: point.x + 3, y: point.y - 1 }, DARK, 1.5);
  c.restore();
}
/** Dedicated ordinary props only; specialized hunt/job/fuse/charge gear keeps its renderer. */
export function drawMaterialProp(
  c: CanvasRenderingContext2D,
  g: Game,
  prop: Prop,
  reduced = false,
): boolean {
  if (prop.hunt || prop.uprising || prop.auditCase || prop.charge || prop.welded) return false;
  const s = materialPropSnapshot(g, prop);
  if (!s) return false;
  const p = materialPose(s, g.time, reduced);
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.translate(s.position.x, s.position.y);
  c.rotate(s.angle);
  c.save();
  c.beginPath();
  c.rect(-s.width / 2, -s.height / 2, s.width, s.height);
  c.clip();
  if (s.kind === 'crate') crate(c, s, p);
  else if (s.kind === 'cover') cover(c, s, p);
  else if (s.kind === 'canister') canister(c, s, p, reduced);
  else if (s.kind === 'cargo') cargo(c, s, p, !!prop.cargo?.rail);
  localImpact(c, s, p, reduced);
  c.restore();
  // Preserve the native visible collision edge even while captive inner hardware reacts.
  c.strokeStyle = s.kind === 'canister' ? '#ba9b66' : '#a2afa0';
  c.lineWidth = 1.1;
  c.strokeRect(-s.width / 2 + 0.6, -s.height / 2 + 0.6, s.width - 1.2, s.height - 1.2);
  if (s.kind === 'canister' && p.canister !== 'sealed') {
    // State brackets stay outside the native hull; this is a steady armed cue, never a fuse timer.
    const color =
      p.canister === 'impact' ? '#ffe2a3' : p.canister === 'grace' ? '#c6b485' : '#ffcd79';
    for (const side of [-1, 1]) {
      const xx = side * (s.width / 2 + 2);
      line(
        c,
        { x: xx - side * 3, y: -s.height / 2 - 1 },
        { x: xx, y: -s.height / 2 - 1 },
        color,
        1.5,
      );
      line(c, { x: xx, y: -s.height / 2 - 1 }, { x: xx, y: -s.height / 2 + 6 }, color, 1.5);
      line(c, { x: xx, y: s.height / 2 - 6 }, { x: xx, y: s.height / 2 + 1 }, color, 1.5);
      line(
        c,
        { x: xx, y: s.height / 2 + 1 },
        { x: xx - side * 3, y: s.height / 2 + 1 },
        color,
        1.5,
      );
    }
  }
  if (
    s.kind === 'crate' &&
    (prop.throwUntil ?? 0) > g.time &&
    Math.hypot(prop.body.velocity.x, prop.body.velocity.y) > 5
  ) {
    c.strokeStyle = '#eab27f';
    c.lineWidth = 2;
    c.strokeRect(-s.width / 2 - 2, -s.height / 2 - 2, s.width + 4, s.height + 4);
  }
  c.restore();
  return true;
}
