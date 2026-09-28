import type { Game } from './game.ts';

export function drawSortingPit(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const s = g.sortingPit;
  if (!s.active) return;
  const powered = ['lift', 'hold', 'warning'].includes(s.phase),
    warn = s.phase === 'warning';
  const pulse = reduced ? 0.7 : 0.65 + Math.sin(g.time * (warn ? 15 : 4)) * 0.25;
  c.save();
  // Rail, suspension and a single broad magnet are part of the room scenery.
  c.fillStyle = '#242e31';
  c.fillRect(605, 90, 790, 15);
  c.strokeStyle = '#566562';
  c.lineWidth = 4;
  for (const x of [750, 1250]) {
    c.beginPath();
    c.moveTo(x, 105);
    c.lineTo(x, 176);
    c.stroke();
  }
  c.fillStyle = '#172123';
  c.fillRect(665, 170, 670, 48);
  c.strokeStyle = '#657770';
  c.lineWidth = 2;
  c.strokeRect(665, 170, 670, 48);
  c.fillStyle = '#33433d';
  c.fillRect(688, 181, 624, 21);
  c.fillStyle = powered ? (warn ? '#e3ae69' : '#94c6b5') : '#53645b';
  for (let x = 690; x < 1320; x += 40) c.fillRect(x, 211, 20, 8);
  c.fillStyle = '#7c8e78';
  c.font = '10px monospace';
  c.textAlign = 'center';
  c.fillText('S / 04', 1000, 195);
  const coil = s.coil;
  c.strokeStyle = '#475b52';
  c.lineWidth = 5;
  c.beginPath();
  c.moveTo(coil.x, coil.y);
  c.lineTo(coil.x, 150);
  c.lineTo(1000, 150);
  c.stroke();
  c.fillStyle = '#17201e';
  c.fillRect(coil.x - 29, coil.y - 32, 58, 64);
  c.strokeStyle = s.exposed ? '#b8e5d1' : '#53655c';
  c.lineWidth = 2;
  c.strokeRect(coil.x - 29, coil.y - 32, 58, 64);
  if (s.exposed || s.flash > 0) {
    c.fillStyle = `rgba(128,211,173,${0.12 + pulse * 0.16})`;
    c.fillRect(coil.x - 25, coil.y - 28, 50, 56);
    c.strokeStyle = s.flash > 0 ? '#f0f8dc' : '#bee9ba';
    c.lineWidth = 3;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.ellipse(coil.x, coil.y + i * 8, 17, 6, 0, 0, Math.PI * 2);
      c.stroke();
    }
  } else {
    c.fillStyle = '#44554d';
    for (let y = -23; y < 24; y += 10) c.fillRect(coil.x - 23, coil.y + y, 46, 6);
  }
  for (const { prop: p } of s.held) {
    const pos = p.body.position;
    if (!reduced) {
      c.strokeStyle = `rgba(143,190,163,${warn ? 0.16 : 0.23})`;
      c.lineWidth = 1;
      c.setLineDash([7, 13]);
      c.lineDashOffset = -g.time * 50;
      for (const dx of [-16, 16]) {
        c.beginPath();
        c.moveTo(pos.x + dx, 224);
        c.lineTo(pos.x + dx, pos.y - 25);
        c.stroke();
      }
      c.setLineDash([]);
    }
  }
  // Shadows are on the first real landing surface, not blindly on the floor.
  const loads = [...s.held.map((p) => p.prop), ...s.drops.keys()];
  for (const p of loads) {
    if (!g.props.items.includes(p)) continue;
    const at = s.landing(p),
      danger = warn || s.drops.has(p);
    c.fillStyle = danger ? `rgba(231,155,84,${0.18 + pulse * 0.2})` : 'rgba(6,13,10,0.5)';
    c.beginPath();
    c.ellipse(at.x, at.y - 3, at.w / 2, 7, 0, 0, Math.PI * 2);
    c.fill();
    if (danger) {
      c.strokeStyle = '#ddb57d';
      c.lineWidth = 2;
      c.beginPath();
      for (const sign of [-1, 1]) {
        const x = at.x + sign * (at.w / 2 + 5);
        c.moveTo(x - sign * 8, at.y - 3);
        c.lineTo(x, at.y - 3);
        c.lineTo(x, at.y - 12);
      }
      c.stroke();
    }
  }
  // Flush floor marks define the work area without adding HUD text.
  c.strokeStyle = '#746c4c';
  c.lineWidth = 2;
  for (const x of [668, 1332]) {
    c.beginPath();
    c.moveTo(x - 16, 738);
    c.lineTo(x, 723);
    c.lineTo(x + 16, 738);
    c.stroke();
  }
  c.restore();
}
