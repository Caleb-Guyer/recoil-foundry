import type { Game, Enemy } from './game.ts';
import { clamp } from './rules.ts';
import { FINAL_FORMS, FINAL_WARNING } from './final-transformation.ts';
import { drawFinaleCinemaHud } from './finale-cinema-art.ts';
import { drawReclaimerArsenal } from './reclaimer-arsenal-art.ts';

const COLORS = ['#d1b28b', '#f2b26e', '#a6e9e1'];
export function drawFinalHull(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced: boolean) {
  const f = g.finale,
    phase = e.phase,
    open = e.state === 'recover',
    p = e.body.position;
  c.save();
  c.translate(p.x, p.y);
  const assembling =
    f.state === 'intro'
      ? clamp(f.clock / 1.6, 0, 1)
      : f.state === 'transform'
        ? clamp(f.clock / 1.1, 0, 1)
        : 1;
  const spread = (phase === 2 ? 74 : 54) * assembling;
  c.strokeStyle = '#677d7b';
  c.lineWidth = 6;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(side * 12, -10);
    c.lineTo(side * spread * assembling, -36);
    c.lineTo(side * (spread + 12) * assembling, 6);
    c.stroke();
    c.fillStyle = e.flash > 0 ? '#ffe1b1' : '#394c4f';
    c.strokeStyle = COLORS[phase];
    c.lineWidth = 1.5;
    c.fillRect(side * spread - 17, -54, 34, 50);
    c.strokeRect(side * spread - 17, -54, 34, 50);
    for (let n = 0; n < 3; n++) {
      c.fillStyle = COLORS[phase];
      c.fillRect(side * spread - 11 + n * 9, -49, 4, 17);
    }
    c.fillStyle = '#14272c';
    c.fillRect(side * spread - 11, -10, 22, 10);
    if (phase === 2) {
      c.save();
      c.rotate(side * (reduced ? 0.25 : 0.22 + Math.sin(g.time * 1.8) * 0.035));
      c.strokeStyle = '#79adae';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(side * 14, 8);
      c.lineTo(side * 67, 47);
      c.stroke();
      c.fillStyle = '#3e5457';
      c.fillRect(side * 67 - 14, 31, 28, 36);
      c.fillStyle = COLORS[2];
      c.fillRect(side * 67 - 10, 35, 20, 3);
      c.restore();
    } else {
      c.fillStyle = '#556263';
      c.fillRect(side * 16 - 8, 22, 16, 27);
      c.fillStyle = '#bba186';
      c.fillRect(side * 18 - 14, 46, 28, 8);
    }
  }
  c.fillStyle = e.flash > 0 ? '#fce8bf' : '#283c41';
  c.strokeStyle = COLORS[phase];
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-26, -33);
  c.lineTo(26, -33);
  c.lineTo(35, 1);
  c.lineTo(phase === 2 ? 16 : 29, 34);
  c.lineTo(phase === 2 ? -16 : -29, 34);
  c.lineTo(-35, 1);
  c.closePath();
  c.fill();
  c.stroke();
  const aperture = phase === 2 ? 19 : 11;
  c.fillStyle = '#112328';
  c.fillRect(-21, -25, 42, 9);
  c.fillStyle = COLORS[phase];
  c.fillRect(-14, -22, 28, 3);
  c.beginPath();
  c.arc(0, 7, aperture, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = open ? '#f9f3c8' : '#21434a';
  c.beginPath();
  c.arc(0, 7, aperture - 5, 0, Math.PI * 2);
  c.fill();
  if (phase === 2) {
    c.strokeStyle = '#b8f5e6';
    c.lineWidth = 3;
    for (let n = 0; n < 3; n++) {
      const a = (n * Math.PI * 2) / 3 + (reduced ? 0 : g.time * 0.4);
      c.beginPath();
      c.arc(0, 7, 29, a, a + 0.8);
      c.stroke();
    }
  }
  for (const side of [-1, 1]) {
    c.fillStyle = '#89918a';
    c.fillRect(side < 0 ? -36 - (open ? 7 : 0) : 12 + (open ? 7 : 0), -6, 24, 26);
    c.fillStyle = '#344c4f';
    c.fillRect(side < 0 ? -32 - (open ? 7 : 0) : 16 + (open ? 7 : 0), -2, 16, 17);
  }
  c.save();
  c.rotate(Math.atan2(e.aim.y, e.aim.x));
  c.fillStyle = '#364e52';
  c.fillRect(17, -10, 47, 20);
  c.fillStyle = '#b5c3b7';
  c.fillRect(23, -9, 31, 4);
  c.fillStyle = COLORS[phase];
  c.fillRect(57, -13, 8, 26);
  c.fillStyle = '#0c2028';
  c.fillRect(62, -6, 8, 12);
  if (e.interceptor!.muzzle > 0) {
    c.fillStyle = '#fff2c6';
    c.fillRect(70, -3, reduced ? 10 : 28, 6);
  }
  c.restore();
  c.restore();
}

export function drawFinalArena(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (g.finale.cinema?.active) return;
  const f = g.finale;
  if (!f.active || g.mode === 'title') return;
  const phase = f.phase,
    color = COLORS[phase];
  c.save();
  // Fixed rails, suspended machinery and torn roof spars define each form.
  c.strokeStyle = phase === 2 ? '#557b7f' : '#414b4b';
  c.lineWidth = 5;
  for (const x of [150, 650, 1350, 1850]) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, phase === 2 ? 140 : 215);
    c.stroke();
    c.fillStyle = '#1c3036';
    c.fillRect(x - 31, phase === 2 ? 105 : 180, 62, 40);
    c.fillStyle = color;
    c.fillRect(x - 24, phase === 2 ? 112 : 187, 48, 3);
  }
  if (phase === 2) {
    c.strokeStyle = '#7d9d94';
    c.lineWidth = 3;
    for (const x of [60, 1940]) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + (x < 1000 ? 120 : -120), 90);
      c.lineTo(x + (x < 1000 ? 70 : -70), 180);
      c.stroke();
    }
  }
  for (const s of g.level.solids) {
    c.fillStyle = color;
    c.globalAlpha = 0.6;
    c.fillRect(s.x + 5, s.y, s.w - 10, 3);
    c.globalAlpha = 1;
  }
  if (f.state === 'transform' && !f.changed) {
    const t = clamp(f.clock / 0.95, 0, 1);
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(f.enemy!.body.position.x, f.enemy!.body.position.y, 45 + t * 230, 0, Math.PI * 2);
    c.stroke();
  }
  if (f.state === 'defeat' || f.state === 'complete') {
    const t = clamp(f.clock / 2.2, 0, 1),
      p = f.wreck;
    c.save();
    c.translate(p.x, p.y + Math.max(0, Math.min(70, t * 70, 715 - p.y)));
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * (20 + t * 72), t * 12);
      c.rotate(side * t * 0.7);
      c.fillStyle = '#34484a';
      c.fillRect(-17, -24, 34, 48);
      c.strokeStyle = '#788779';
      c.lineWidth = 2;
      c.strokeRect(-17, -24, 34, 48);
      c.restore();
    }
    c.fillStyle = '#172f34';
    c.fillRect(-21, -22, 42, 45);
    c.fillStyle = t > 0.85 ? '#466260' : '#bcebd4';
    c.fillRect(-9, -6, 18, 9);
    if (!reduced && f.state === 'defeat') {
      c.strokeStyle = '#9dbeb1';
      c.lineWidth = 1;
      c.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
        c.lineTo(Math.cos(a) * (40 + t * 150), Math.sin(a) * (40 + t * 150));
        c.stroke();
      }
    }
    c.restore();
  }
  c.restore();
}

export function drawFinalThreat(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  if (g.finale.cinema?.active && !['duel', 'siege', 'rupture'].includes(g.finale.cinema.state))
    return;
  drawReclaimerArsenal(c, g, reduced);
  const f = g.finale,
    strike = f.strike;
  if (!strike || f.state !== 'combat') return;
  c.save();
  const progress = strike.fired ? 1 : clamp(1 - strike.left / FINAL_WARNING, 0, 1);
  for (const s of strike.rects) {
    c.fillStyle = strike.fired ? '#e9fff1' : '#e9c67c';
    c.globalAlpha = strike.fired ? 0.65 : 0.055;
    c.fillRect(s.x, s.y, s.w, s.h);
    c.globalAlpha = 1;
    c.strokeStyle = '#12272d';
    c.lineWidth = 5;
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.strokeStyle = strike.fired ? '#edfff7' : '#f8d49a';
    c.lineWidth = 2;
    c.setLineDash(strike.fired ? [] : [8, 6]);
    c.strokeRect(s.x, s.y, s.w, s.h);
    c.setLineDash([]);
    const x = s.x + s.w / 2,
      y = strike.kind === 'column' ? s.y + 70 : s.y + s.h / 2;
    c.fillStyle = '#11252e';
    c.fillRect(x - 25, y - 14, 50, 28);
    c.strokeStyle = '#f8d49a';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    c.stroke();
    c.beginPath();
    c.moveTo(x - 17, y);
    c.lineTo(x - 12, y);
    c.moveTo(x + 12, y);
    c.lineTo(x + 17, y);
    c.stroke();
  }
  c.restore();
}

export function drawFinalHud(c: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  if (g.finale.cinema?.active) {
    drawFinaleCinemaHud(c, g, w, h);
    return;
  }
  const f = g.finale,
    e = f.enemy;
  if (!f.active || !e || g.mode === 'title' || g.escape) return;
  const compact = w < 620,
    barW = Math.min(420, w - 80),
    x = (w - barW) / 2;
  c.save();
  if (e.hp > 0) {
    c.fillStyle = '#0c1b22e8';
    c.fillRect(x - 12, 62, barW + 24, compact ? 48 : 53);
    c.fillStyle = '#d8e3d4';
    c.textAlign = 'left';
    c.font = `600 ${compact ? 11 : 12}px sans-serif`;
    c.fillText('THE RECLAIMER', x, 78);
    c.textAlign = 'right';
    c.fillStyle = COLORS[f.phase];
    c.font = `${compact ? 10 : 11}px sans-serif`;
    c.fillText(
      `${g.overtime ? 'NG+ · ' : ''}${f.phase + 1} / 3 · ${FINAL_FORMS[f.phase].toUpperCase()}`,
      x + barW,
      78,
    );
    c.fillStyle = '#374647';
    c.fillRect(x, 88, barW, 5);
    c.fillStyle = COLORS[f.phase];
    c.fillRect(x, 88, barW * clamp(e.hp / e.maxHp, 0, 1), 5);
    for (const threshold of [0.68, 0.34]) {
      c.fillStyle = '#10232a';
      c.fillRect(x + barW * threshold - 1, 86, 2, 9);
    }
    if (f.state === 'combat' && f.strike && !f.strike.fired) {
      c.textAlign = 'center';
      c.font = '11px sans-serif';
      c.fillStyle = '#ffe2a9';
      c.fillText(
        f.strike.kind === 'floor'
          ? 'FLOOR BATTERIES · LEAVE THE MARKED DECK'
          : f.strike.kind === 'column'
            ? 'REACTOR COLUMNS · MOVE BETWEEN THE MARKS'
            : 'CROSSCUT · CHANGE HEIGHT OR USE THE CENTER GAP',
        w / 2,
        compact ? 124 : 128,
      );
    }
  }
  if (f.presenting) {
    c.fillStyle = '#0b1a22dd';
    c.fillRect(0, h * 0.61, w, compact ? 100 : 113);
    c.fillStyle = COLORS[f.phase];
    c.textAlign = 'center';
    c.font = `600 ${compact ? 20 : 28}px sans-serif`;
    const title =
      f.state === 'defeat'
        ? 'RECLAIMER OFFLINE'
        : f.state === 'intro'
          ? 'THE RECLAIMER'
          : FINAL_FORMS[f.phase].toUpperCase();
    c.fillText(title, w / 2, h * 0.61 + 32);
    c.fillStyle = '#e0e6d8';
    c.font = `${compact ? 11 : 13}px sans-serif`;
    const note =
      f.state === 'defeat'
        ? 'The factory loses its final command.'
        : f.state === 'intro'
          ? f.phase
            ? 'The next form is already waiting.'
            : 'It learned your gun. It kept the factory.'
          : f.phase === 1
            ? 'Armor unfolds. Siege decks rise. Watch the floor batteries.'
            : 'The roof tears open. Reactor columns and crosscuts take over.';
    c.fillText(note, w / 2, h * 0.61 + 57);
    if (f.state === 'intro') {
      c.fillStyle = '#9cadab';
      c.font = '11px sans-serif';
      c.fillText('Jump or press fire to skip', w / 2, h * 0.61 + 80);
    }
  }
  c.restore();
}
