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
    debris(c, state, reduced);
    c.restore();
    return;
  }
  const opening =
    state.stage === 'startup' ? 1 - p : state.stage === 'transition' ? Math.sin(p * Math.PI) : 0;
  if (state.kind === 'condenser') {
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
  c.strokeStyle = kind === 'condenser' ? '#9bd5d0' : '#e0b07a';
  c.lineWidth = width;
  c.globalAlpha = cue.active ? 0.16 : 0.035 + unit(cue.progress) * 0.055;
  line(c, from, to);
  c.lineWidth = cue.active ? 2.8 : locked ? 1.8 : 1.2;
  c.globalAlpha = cue.active ? 0.95 : locked ? 0.85 : 0.4 + unit(cue.progress) * 0.25;
  line(c, from, to);
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
      c.fillStyle = state.kind === 'condenser' ? '#8dcbc5' : '#dda678';
      c.globalAlpha = cue.active ? 0.22 : locked ? 0.1 : 0.04 + unit(cue.progress) * 0.035;
      c.fillRect(x, cue.top, cue.width, height);
      c.strokeStyle = state.kind === 'condenser' ? '#b8e0d5' : '#edc18b';
      c.globalAlpha = cue.active ? 0.95 : locked ? 0.85 : 0.5;
      c.lineWidth = cue.active ? 2.8 : locked ? 1.8 : 1.2;
      c.setLineDash(locked ? [] : [8, 8]);
      c.strokeRect(x, cue.top, cue.width, height);
      c.setLineDash([]);
    } else if (cue.kind === 'segment') segment(c, cue.from, cue.to, cue.width, cue, state.kind);
    else if (point(cue.from))
      for (const end of cue.ends) segment(c, cue.from, end, cue.width, cue, state.kind);
    c.restore();
  }
  c.restore();
}
