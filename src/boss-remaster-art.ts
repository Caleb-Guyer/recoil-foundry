import type { Vec } from './rules.ts';
import type { BossRemasterCue, BossRemasterVisual } from './boss-remaster-cues.ts';

export type { BossRemasterCue, BossRemasterVisual } from './boss-remaster-cues.ts';
const TAU = Math.PI * 2;
const unit = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);
const point = (p: Vec) => Number.isFinite(p.x) && Number.isFinite(p.y);
const line = (c: CanvasRenderingContext2D, a: Vec, b: Vec) => {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
};
const circle = (c: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
  c.beginPath();
  c.arc(x, y, radius, 0, TAU);
  c.stroke();
};

function condenserCollar(c: CanvasRenderingContext2D, phase: number, spread: number) {
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    c.translate(spread, 0);
    c.fillStyle = '#233c40';
    c.strokeStyle = '#789b91';
    c.lineWidth = 2;
    c.fillRect(48, -28, 19, 56);
    c.strokeRect(48, -28, 19, 56);
    c.fillStyle = '#132b31';
    c.fillRect(53, -24, 9, 48);
    c.strokeStyle = '#82b9b0';
    c.lineWidth = 3;
    line(c, { x: 39, y: -16 }, { x: 48, y: -16 });
    line(c, { x: 39, y: 16 }, { x: 48, y: 16 });
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i <= phase + 1 ? '#b4dbcd' : '#456965';
      c.fillRect(51, -21 + i * 10, 13, 3);
    }
    c.restore();
  }
}
function sorterArms(c: CanvasRenderingContext2D, phase: number, open: number, reduced: boolean) {
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side, 1);
    c.translate(42, 18);
    c.rotate(reduced ? -0.24 - phase * 0.13 : -0.24 - phase * 0.13 - open * 0.45);
    c.fillStyle = '#35463c';
    c.strokeStyle = '#889b7e';
    c.lineWidth = 2;
    c.fillRect(0, -7, 40, 14);
    c.strokeRect(0, -7, 40, 14);
    c.fillStyle = '#1d3029';
    c.fillRect(8, -3, 29, 6);
    c.translate(38, 0);
    c.fillStyle = '#5d6852';
    c.fillRect(-1, -14, 24, 28);
    c.strokeRect(-1, -14, 24, 28);
    c.fillStyle = '#1d2d24';
    c.fillRect(11, -8, 13, 16);
    c.fillStyle = '#e3b37d';
    c.fillRect(15, -14, 9, 5);
    c.fillRect(15, 9, 9, 5);
    c.restore();
  }
}
function debris(c: CanvasRenderingContext2D, state: BossRemasterVisual, reduced: boolean) {
  const p = unit(state.progress),
    travel = reduced ? 0.55 : p,
    condenser = state.kind === 'condenser';
  c.globalAlpha = 1 - p * 0.72;
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.39996 + (condenser ? 0.3 : 0.7),
      speed = 27 + (i % 4) * 17;
    c.save();
    c.translate(Math.cos(angle) * speed * travel, Math.sin(angle) * speed * travel + p * p * 48);
    c.rotate(reduced ? angle : angle + p * (i % 2 ? 2 : -2));
    c.fillStyle = i % 3 ? (condenser ? '#3e6262' : '#5b6553') : '#9c987a';
    c.strokeStyle = condenser ? '#8ebbb0' : '#c2b48c';
    c.lineWidth = 1.5;
    const width = i % 3 ? 12 : 22;
    c.fillRect(-width / 2, -4, width, 8);
    c.strokeRect(-width / 2, -4, width, 8);
    c.restore();
  }
  c.globalAlpha = (1 - p) * (reduced ? 0.22 : 0.5);
  c.strokeStyle = condenser ? '#c0e8dd' : '#f0c68c';
  c.lineWidth = 3;
  circle(c, 0, 0, 22 + (reduced ? 35 : p * 95));
  c.globalAlpha = 1 - p;
  c.fillStyle = condenser ? '#c1dfcc' : '#e7bf87';
  c.fillRect(-5 + p * 4, -7 + p * 5, 10 - p * 8, 14 - p * 10);
  if (!reduced) {
    c.strokeStyle = condenser ? '#c6e6d3' : '#f2d09b';
    c.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996,
        r = 14 + p * (35 + (i % 5) * 13);
      line(
        c,
        { x: Math.cos(a) * r, y: Math.sin(a) * r + p * p * 35 },
        { x: Math.cos(a) * (r + 9 * (1 - p)), y: Math.sin(a) * (r + 9 * (1 - p)) + p * p * 35 },
      );
    }
  }
}

const firstShift = (kind: BossRemasterVisual['kind']) =>
  kind === 'loader' || kind === 'crane' || kind === 'press' || kind === 'kiln';
const warningColor = (kind: BossRemasterVisual['kind']) =>
  kind === 'condenser' ? '#9bd5d0' : kind === 'kiln' ? '#efb278' : '#e0b07a';

/** Small additions to the native body: no replacement rig or false collision face. */
function firstShiftMachine(
  c: CanvasRenderingContext2D,
  kind: BossRemasterVisual['kind'],
  phase: number,
  opening: number,
  reduced: boolean,
) {
  const lift = opening * (reduced ? 4 : 10);
  c.lineWidth = 1.5;
  if (kind === 'loader') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.strokeStyle = '#9c9982';
      c.fillStyle = '#42494a';
      c.fillRect(49, -37 - lift, 8, 58 + lift);
      c.strokeRect(49, -37 - lift, 8, 58 + lift);
      c.fillStyle = '#899083';
      c.fillRect(51, -32 - lift, 3, 25 + lift);
      c.fillStyle = '#d2ae77';
      for (let i = 0; i < 3 - phase; i++) c.fillRect(49, -20 + i * 11, 8, 3);
      c.fillStyle = '#293234';
      c.fillRect(38, 30, 24, 7);
      c.strokeStyle = '#727f7a';
      line(c, { x: 43, y: 32 }, { x: 58, y: 32 });
      c.restore();
    }
    c.strokeStyle = phase === 2 ? '#bd8064' : '#878a76';
    line(c, { x: -23, y: -37 - lift }, { x: 23, y: -37 - lift });
  } else if (kind === 'crane') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = '#3c4d4d';
      c.strokeStyle = '#8c9c8a';
      c.fillRect(35 + lift, -22, 12, 34);
      c.strokeRect(35 + lift, -22, 12, 34);
      c.fillStyle = '#b2b19a';
      c.fillRect(38 + lift, -18, 3, 25);
      c.strokeStyle = '#9eaa94';
      circle(c, 28, -32, 9);
      line(c, { x: 23, y: -32 }, { x: 33, y: -32 });
      c.fillStyle = '#d1b783';
      for (let i = 0; i < 3 - phase; i++) c.fillRect(38 + lift, -14 + i * 8, 6, 2);
      c.restore();
    }
    c.strokeStyle = '#bd8b70';
    if (phase > 0) line(c, { x: -18, y: -27 }, { x: -5, y: -19 });
    if (phase > 1) line(c, { x: 4, y: -26 }, { x: 17, y: -20 });
  } else if (kind === 'press') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = '#6a6155';
      c.strokeStyle = '#b4a38a';
      c.fillRect(32, -78 - lift, 18, 17);
      c.strokeRect(32, -78 - lift, 18, 17);
      c.fillStyle = '#9d9b88';
      c.fillRect(38, -61 - lift, 5, 28 + lift);
      c.strokeStyle = '#4a4c42';
      for (let i = 0; i < 4; i++)
        line(c, { x: 34, y: -74 - lift + i * 3 }, { x: 47, y: -74 - lift + i * 3 });
      c.fillStyle = '#d8ad78';
      c.fillRect(33, -79 - lift, 14 - phase * 4, 2);
      c.restore();
    }
    c.strokeStyle = phase === 2 ? '#c99070' : '#7e7768';
    line(c, { x: -28, y: -55 }, { x: 28, y: -55 });
  } else if (kind === 'kiln') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = '#64513f';
      c.strokeStyle = '#b18f66';
      c.fillRect(45 + lift, -21, 8, 34);
      c.strokeRect(45 + lift, -21, 8, 34);
      c.fillStyle = '#d2a36b';
      for (let i = 0; i < 3 - phase; i++) c.fillRect(46 + lift, -17 + i * 10, 6, 2);
      c.strokeStyle = '#977354';
      line(c, { x: 43, y: -41 }, { x: 53 + lift, y: -49 });
      if (opening > 0) {
        c.save();
        c.globalAlpha *= 0.3;
        c.strokeStyle = '#e0b182';
        line(c, { x: 54 + lift, y: -48 }, { x: 59 + lift, y: -59 - lift });
        c.restore();
      }
      c.restore();
    }
    c.strokeStyle = phase === 2 ? '#dd9c6a' : '#ba976a';
    c.beginPath();
    c.arc(0, -5, 39, Math.PI * 0.17, Math.PI * 0.83);
    c.stroke();
  }
}

function firstShiftWreck(c: CanvasRenderingContext2D, state: BossRemasterVisual, reduced: boolean) {
  const p = unit(state.progress),
    travel = reduced ? 0.4 : p;
  c.globalAlpha = 1 - p * 0.8;
  c.fillStyle = state.kind === 'kiln' ? '#67503c' : '#4a504b';
  c.strokeStyle = state.kind === 'kiln' ? '#ca9864' : '#a6a18b';
  c.lineWidth = 1.5;
  c.save();
  c.translate(0, 6 + travel * 23);
  if (state.kind === 'loader') {
    c.fillRect(-47, 18, 94, 12);
    c.strokeRect(-47, 18, 94, 12);
    c.fillRect(-25, -10, 51, 27);
    c.strokeRect(-25, -10, 51, 27);
    line(c, { x: 28, y: 12 }, { x: 59, y: 24 });
    line(c, { x: -17, y: -17 }, { x: 20, y: -12 });
  } else if (state.kind === 'crane') {
    c.fillRect(-36, -18, 72, 25);
    c.strokeRect(-36, -18, 72, 25);
    c.strokeRect(-16, -12, 31, 13);
    line(c, { x: -23, y: 8 }, { x: -17, y: 35 });
    line(c, { x: 23, y: 8 }, { x: 32, y: 25 });
    c.fillRect(4, 21, 40, 17);
    c.strokeRect(4, 21, 40, 17);
  } else if (state.kind === 'press') {
    c.fillRect(-48, 20, 96, 12);
    c.strokeRect(-48, 20, 96, 12);
    for (const side of [-1, 1]) {
      line(c, { x: side * 37, y: -31 }, { x: side * 30, y: 20 });
      c.fillRect(side * 37 - 7, -36, 14, 11);
    }
    c.fillRect(-32, 4, 64, 14);
  } else {
    c.beginPath();
    c.arc(0, -2, 29, Math.PI * 0.16, Math.PI * 1.83);
    c.stroke();
    c.fillRect(-42, 26, 84, 9);
    for (const side of [-1, 1]) {
      line(c, { x: side * 22, y: -23 }, { x: side * 35, y: -43 });
      line(c, { x: side * 35, y: -43 }, { x: side * 28, y: -47 });
    }
    line(c, { x: -16, y: 6 }, { x: 7, y: -3 });
  }
  c.restore();
  // Deterministic finite scraps; sparks stay outside the physical silhouette.
  for (let i = 0; i < 6; i++) {
    const a = i * 2.39996,
      r = (24 + (i % 3) * 18) * travel;
    c.save();
    c.translate(Math.cos(a) * r, Math.sin(a) * r + p * p * 43);
    c.rotate(reduced ? a : a + p * (i % 2 ? 1.5 : -1.5));
    c.fillRect(-7, -3, 14, 6);
    c.strokeRect(-7, -3, 14, 6);
    c.restore();
  }
  if (!reduced) {
    c.globalAlpha = (1 - p) * 0.65;
    c.strokeStyle = '#e8c18c';
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996,
        r = 18 + p * (30 + (i % 4) * 13);
      line(
        c,
        { x: Math.cos(a) * r, y: Math.sin(a) * r },
        { x: Math.cos(a) * (r + 7 * (1 - p)), y: Math.sin(a) * (r + 7 * (1 - p)) },
      );
    }
  }
}

/** World-space decoration only. This never draws text or a second health bar. */
export function drawBossRemaster(
  c: CanvasRenderingContext2D,
  state: BossRemasterVisual | null,
  reduced: boolean,
) {
  if (!state || !point(state.center)) return;
  const p = unit(state.progress),
    phase = Number.isFinite(state.phase) ? Math.max(0, Math.min(2, Math.floor(state.phase))) : 0;
  c.save();
  c.translate(state.center.x, state.center.y);
  if (state.stage === 'destroyed') {
    if (firstShift(state.kind)) firstShiftWreck(c, state, reduced);
    else debris(c, state, reduced);
    c.restore();
    return;
  }
  const opening =
    state.stage === 'startup' ? 1 - p : state.stage === 'transition' ? Math.sin(p * Math.PI) : 0;
  if (firstShift(state.kind)) {
    firstShiftMachine(c, state.kind, phase, opening, reduced);
  } else if (state.kind === 'condenser') {
    condenserCollar(c, phase, opening * (reduced ? 9 : 20));
    if (state.stage !== 'combat') {
      c.strokeStyle = '#a0cfc3';
      c.lineWidth = 2;
      for (const side of [-1, 1]) {
        c.beginPath();
        const center = side === 1 ? 0 : Math.PI;
        c.arc(0, 0, 56 + opening * 9, center - 0.66, center + 0.66);
        c.stroke();
        // Fixed seams read as venting, without a bloom that hides attack lanes.
        for (let i = 0; i < 3; i++) {
          const x = side * (63 + i * 7),
            height = 18 + (reduced ? 8 : p * 19) + i * 4;
          c.globalAlpha = 0.22 + (1 - p) * 0.28;
          line(c, { x, y: -26 }, { x: x + side * 8, y: -26 - height });
        }
      }
    }
  } else {
    sorterArms(c, phase, opening, reduced);
    if (state.stage !== 'combat') {
      c.strokeStyle = '#e3b782';
      c.lineWidth = 2;
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const x = side * (55 + i * 9);
          line(c, { x, y: -28 + i * 4 }, { x: x + side * (7 + opening * 9), y: -39 + i * 4 });
        }
    }
  }
  c.restore();
}

function validWidth(width: number) {
  return Number.isFinite(width) && width > 0 && width <= 2000;
}
function segment(
  c: CanvasRenderingContext2D,
  from: Vec,
  to: Vec,
  width: number,
  cue: BossRemasterCue,
  kind: BossRemasterVisual['kind'],
) {
  if (!point(from) || !point(to) || !validWidth(width)) return;
  const locked = cue.active || cue.locked === true;
  c.setLineDash(locked ? [] : [8, 8]);
  c.strokeStyle = warningColor(kind);
  c.lineWidth = width;
  c.globalAlpha = cue.active ? 0.16 : 0.035 + unit(cue.progress) * 0.055;
  line(c, from, to);
  c.lineWidth = cue.active ? 2.8 : locked ? 1.8 : 1.2;
  c.globalAlpha = cue.active ? 0.95 : locked ? 0.85 : 0.4 + unit(cue.progress) * 0.25;
  line(c, from, to);
  c.setLineDash([]);
}

function hull(
  c: CanvasRenderingContext2D,
  cue: Extract<BossRemasterCue, { kind: 'hull' }>,
  kind: BossRemasterVisual['kind'],
) {
  if (
    !point(cue.from) ||
    !point(cue.to) ||
    !validWidth(cue.halfWidth * 2) ||
    !validWidth(cue.halfHeight * 2)
  )
    return;
  const points = [cue.from, cue.to]
    .flatMap((p) =>
      [-1, 1].flatMap((x) =>
        [-1, 1].map((y) => ({ x: p.x + x * cue.halfWidth, y: p.y + y * cue.halfHeight })),
      ),
    )
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Vec, b: Vec, p: Vec) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const lower: Vec[] = [],
    upper: Vec[] = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...points].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  const polygon = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  const locked = cue.active || cue.locked === true;
  c.beginPath();
  for (const [index, p] of polygon.entries()) {
    if (index === 0) c.moveTo(p.x, p.y);
    else c.lineTo(p.x, p.y);
  }
  c.closePath();
  c.fillStyle = warningColor(kind);
  c.globalAlpha = cue.active ? 0.22 : locked ? 0.1 : 0.04 + unit(cue.progress) * 0.035;
  c.fill();
  c.strokeStyle = warningColor(kind);
  c.globalAlpha = cue.active ? 0.95 : locked ? 0.85 : 0.5;
  c.lineWidth = cue.active ? 2.8 : locked ? 1.8 : 1.2;
  c.setLineDash(locked ? [] : [8, 8]);
  c.stroke();
  c.setLineDash([]);
}

/** Exact attack geometry, drawn late so friendly effects cannot bury a warning. */
export function drawBossRemasterWarnings(
  c: CanvasRenderingContext2D,
  state: BossRemasterVisual | null,
  _reduced: boolean,
) {
  if (!state || state.stage === 'destroyed') return;
  c.save();
  c.lineCap = 'butt';
  c.lineJoin = 'miter';
  for (const cue of state.warnings) {
    c.save();
    if (cue.kind === 'lane') {
      if (
        !Number.isFinite(cue.x) ||
        !validWidth(cue.width) ||
        !Number.isFinite(cue.top) ||
        !Number.isFinite(cue.bottom) ||
        cue.bottom <= cue.top
      ) {
        c.restore();
        continue;
      }
      const locked = cue.active || cue.locked === true;
      const x = cue.x - cue.width / 2,
        height = cue.bottom - cue.top;
      c.fillStyle =
        state.kind === 'condenser' ? '#8dcbc5' : state.kind === 'kiln' ? '#e7a56a' : '#dda678';
      c.globalAlpha = cue.active ? 0.22 : locked ? 0.1 : 0.04 + unit(cue.progress) * 0.035;
      c.fillRect(x, cue.top, cue.width, height);
      c.strokeStyle =
        state.kind === 'condenser' ? '#b8e0d5' : state.kind === 'kiln' ? '#f0bf87' : '#edc18b';
      c.globalAlpha = cue.active ? 0.95 : locked ? 0.85 : 0.5;
      c.lineWidth = cue.active ? 2.8 : locked ? 1.8 : 1.2;
      c.setLineDash(locked ? [] : [8, 8]);
      c.strokeRect(x, cue.top, cue.width, height);
      c.setLineDash([]);
    } else if (cue.kind === 'segment') segment(c, cue.from, cue.to, cue.width, cue, state.kind);
    else if (cue.kind === 'hull') hull(c, cue, state.kind);
    else if (point(cue.from))
      for (const end of cue.ends) segment(c, cue.from, end, cue.width, cue, state.kind);
    c.restore();
  }
  c.restore();
}
