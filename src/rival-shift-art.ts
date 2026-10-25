import type { BossRemasterVisual } from './boss-remaster-cues.ts';

const line = (c: CanvasRenderingContext2D, x: number, y: number, ex: number, ey: number) => {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(ex, ey);
  c.stroke();
};
/** Decorations follow the native hull and recovery; no extra collision face or text. */
export function drawRivalMachine(
  c: CanvasRenderingContext2D,
  state: BossRemasterVisual,
  reduced: boolean,
) {
  const phase = Math.max(0, Math.min(2, Math.floor(state.phase)));
  const p = Math.max(0, Math.min(1, state.progress));
  const opening =
    state.stage === 'startup'
      ? 1 - p
      : state.stage === 'transition'
        ? Math.sin(p * Math.PI)
        : state.exposed
          ? 0.5
          : 0;
  const slide = opening * (reduced ? 5 : 12);
  c.lineWidth = 1.5;
  if (state.kind === 'turbine') {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = '#314d50';
      c.strokeStyle = '#91b5a6';
      c.fillRect(43 + slide, -31, 12, 62);
      c.strokeRect(43 + slide, -31, 12, 62);
      c.fillStyle = '#182d34';
      c.fillRect(46 + slide, -25, 6, 50);
      c.strokeStyle = '#6f9690';
      for (let i = 0; i < 5; i++) line(c, 44 + slide, -20 + i * 10, 54 + slide, -20 + i * 10);
      c.fillStyle = '#b8d3b5';
      for (let i = 0; i < 3 - phase; i++) c.fillRect(45 + slide, 18 - i * 8, 8, 3);
      c.restore();
    }
    c.strokeStyle = '#b28d70';
    if (phase > 0) line(c, -31, -33, -20, -22);
    if (phase > 1) {
      line(c, 24, 20, 34, 31);
      line(c, 29, 24, 34, 17);
    }
  } else {
    for (const side of [-1, 1]) {
      c.save();
      c.scale(side, 1);
      c.fillStyle = '#363d43';
      c.strokeStyle = '#9aa995';
      c.fillRect(42 + slide, -34, 10, 63);
      c.strokeRect(42 + slide, -34, 10, 63);
      c.fillStyle = '#162a31';
      c.fillRect(44 + slide, -26, 6, 47);
      c.strokeStyle = '#bba37d';
      for (let i = 0; i < 3 - phase; i++)
        line(c, 44 + slide, -19 + i * 12, 51 + slide, -19 + i * 12);
      c.strokeStyle = '#71877e';
      line(c, 28, -33, 44 + slide, -44);
      c.restore();
    }
    // The native armor opens in recovery. The central light shares that state.
    c.fillStyle = state.exposed ? '#f1cf92' : '#4b5a55';
    c.fillRect(-7, -11, 14, 20);
    c.strokeStyle = state.exposed ? '#f6e7b8' : '#a6af98';
    c.strokeRect(-7, -11, 14, 20);
    c.strokeStyle = '#c38c70';
    if (phase > 0) line(c, -24, -22, -11, -15);
    if (phase > 1) {
      line(c, 15, 13, 28, 25);
      line(c, 24, 21, 28, 14);
    }
  }
}

export function drawRivalWreck(
  c: CanvasRenderingContext2D,
  state: BossRemasterVisual,
  reduced: boolean,
) {
  const p = Math.max(0, Math.min(1, state.progress));
  const travel = reduced ? 0.4 : p;
  c.globalAlpha = 1 - p * 0.75;
  c.lineWidth = 2;
  c.fillStyle = '#29393a';
  c.strokeStyle = '#82958a';
  c.save();
  c.translate(0, travel * 28);
  if (state.kind === 'turbine') {
    c.beginPath();
    c.arc(0, 0, 34, 0.18, Math.PI * 1.85);
    c.stroke();
    for (const side of [-1, 1]) {
      line(c, side * 34, -28, side * 47, 20);
      c.fillRect(side * 41 - 4, -20, 8, 40);
    }
    line(c, -22, 3, 20, -9);
    line(c, -7, 1, 5, 24);
  } else {
    c.fillRect(-32, -25, 64, 48);
    c.strokeRect(-32, -25, 64, 48);
    c.fillStyle = '#14262c';
    c.fillRect(-18, -14, 36, 27);
    line(c, -39, -35, -48, 15);
    line(c, 32, -17, 50, -30);
    line(c, -21, 25, 29, 20);
  }
  c.restore();
  for (let i = 0; i < 8; i++) {
    const a = i * 2.39996,
      r = (26 + (i % 3) * 17) * travel;
    c.save();
    c.translate(Math.cos(a) * r, Math.sin(a) * r + p * p * 45);
    c.rotate(reduced ? a : a + p * (i % 2 ? 1.3 : -1.3));
    c.fillRect(-7, -3, 14, 6);
    c.strokeRect(-7, -3, 14, 6);
    c.restore();
  }
  if (!reduced) {
    c.globalAlpha = (1 - p) * 0.7;
    c.strokeStyle = '#e6bc8c';
    c.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const a = i * 2.39996,
        r = 18 + p * (30 + (i % 5) * 12);
      line(
        c,
        Math.cos(a) * r,
        Math.sin(a) * r,
        Math.cos(a) * (r + 8 * (1 - p)),
        Math.sin(a) * (r + 8 * (1 - p)),
      );
    }
  }
}
