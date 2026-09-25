import type { Enemy, Game } from './game.ts';
import { clamp, type Vec } from './rules.ts';
import { SIGNAL, signalPoint, signalFireAt } from './switchboard.ts';
import { SIGNAL_PORTS } from './switchboard-layout.ts';

const amber = '#e8bb76',
  red = '#ed735d';
function line(c: CanvasRenderingContext2D, points: Vec[]) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}
export function drawSwitchboardArena(c: CanvasRenderingContext2D, g: Game) {
  if (g.level.id !== 'annex-switchboard') return;
  const e = g.switchboard.enemy,
    r = e?.switchboard;
  c.save();
  for (let slot = 0; slot < 3; slot++) {
    const p = r?.plans.find((p) => p.slot === slot && !p.cut && !p.done);
    if (p?.mobile) {
      // The fixed mount stays in the room while control is routed to the boss.
      const fixed = signalPoint(g, slot, 'port');
      c.strokeStyle = '#605468';
      c.lineWidth = 3;
      line(c, [{ x: fixed.x, y: 80 }, fixed]);
      c.fillStyle = '#17151e';
      c.beginPath();
      c.arc(fixed.x, fixed.y, 22, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    const port = p?.mobile ? p.origin : signalPoint(g, slot, 'port'),
      j = signalPoint(g, slot, 'junction');
    const lit = !!p,
      canCut = lit && p!.sent === 0 && r!.cooldown <= 0;
    const cable = [j, { x: j.x, y: 80 }, { x: port.x, y: 80 }, port];
    c.strokeStyle = '#2e2938';
    c.lineWidth = 5;
    line(c, cable);
    c.strokeStyle = lit ? amber : '#605468';
    c.lineWidth = 1;
    line(c, cable);
    c.strokeStyle = '#6e6178';
    c.lineWidth = 3;
    line(c, [
      { x: j.x, y: j.y + 17 },
      { x: j.x, y: SIGNAL_PORTS[slot].mount },
    ]);
    c.fillStyle = '#17151e';
    c.fillRect(j.x - 20, j.y - 20, 40, 40);
    c.strokeStyle = canCut ? amber : '#61556a';
    c.lineWidth = canCut ? 3 : 2;
    c.strokeRect(j.x - 17, j.y - 17, 34, 34);
    if (canCut) {
      line(c, [
        { x: j.x - 9, y: j.y - 9 },
        { x: j.x + 9, y: j.y + 9 },
      ]);
      line(c, [
        { x: j.x + 9, y: j.y - 9 },
        { x: j.x - 9, y: j.y + 9 },
      ]);
    } else {
      // Closed horizontal contacts distinguish shared lockout without relying on color.
      line(c, [
        { x: j.x - 9, y: j.y - 4 },
        { x: j.x + 9, y: j.y - 4 },
      ]);
      line(c, [
        { x: j.x - 9, y: j.y + 4 },
        { x: j.x + 9, y: j.y + 4 },
      ]);
    }
    if (lit) {
      const progress = clamp((r!.elapsed - p!.delay) / (SIGNAL.record + SIGNAL.lock), 0, 1);
      c.fillStyle = amber;
      c.fillRect(j.x - 17, j.y + 24, progress * 34, 3);
      const angles = p!.angles.slice(p!.sent);
      c.strokeStyle = p!.locked ? red : '#b79662';
      c.lineWidth = p!.locked ? 1.5 : 1;
      c.setLineDash(p!.locked ? [8, 5] : [2, 8]);
      for (const a of angles)
        line(c, [
          port,
          g.lineEnd(port, { x: port.x + Math.cos(a) * 2300, y: port.y + Math.sin(a) * 2300 }, 5),
        ]);
      c.setLineDash([]);
      if (p!.kind === 'playback')
        for (const [i, at] of p!.marks.entries()) {
          if (i < p!.sent) continue;
          c.beginPath();
          c.arc(at.x, at.y, 12 + i * 4, 0, Math.PI * 2);
          c.stroke();
          if (p!.locked)
            line(c, [
              { x: at.x - 20, y: at.y },
              { x: at.x - 12, y: at.y },
            ]);
        }
    }
    c.fillStyle = '#17151e';
    c.strokeStyle = lit ? amber : '#796a86';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(port.x, port.y, p?.mobile ? 52 : 22, 0, Math.PI * 2);
    if (!p?.mobile) c.fill();
    c.stroke();
    const angle =
      p?.angles[Math.min(p.sent, p.angles.length - 1)] ??
      (slot === 1 ? Math.PI / 2 : port.x < 1000 ? 0 : Math.PI);
    c.lineWidth = 7;
    c.strokeStyle = lit && r!.elapsed >= signalFireAt(p!) - SIGNAL.lock ? red : '#96859e';
    const barrel = p?.mobile ? 60 : 29;
    line(c, [port, { x: port.x + Math.cos(angle) * barrel, y: port.y + Math.sin(angle) * barrel }]);
  }
  c.restore();
}
export function drawSwitchboard(c: CanvasRenderingContext2D, e: Enemy, reduced: boolean) {
  const r = e.switchboard,
    open = e.state === 'recover' || (r?.opening ?? 0) > 0;
  c.save();
  c.translate(e.body.position.x, e.body.position.y);
  c.globalAlpha = e.spawn > 0 ? clamp(1 - e.spawn / 0.65, 0.15, 1) : 1;
  c.fillStyle = '#201b29';
  c.strokeStyle = e.flash > 0 && !reduced ? '#fff1da' : red;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-42, -23);
  c.lineTo(-27, -35);
  c.lineTo(27, -35);
  c.lineTo(42, -23);
  c.lineTo(42, 23);
  c.lineTo(27, 35);
  c.lineTo(-27, 35);
  c.lineTo(-42, 23);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = '#3f324a';
  c.fillRect(-31, -24, 62, 48);
  c.fillStyle = open ? amber : '#8b515a';
  for (let i = 0; i < 3; i++) c.fillRect(-22 + i * 18, -17, 9, open ? 34 : 8);
  c.strokeStyle = e.phase ? amber : red;
  c.lineWidth = 2;
  line(c, [
    { x: -29, y: -29 },
    { x: -29, y: -48 },
    { x: -11, y: -48 },
  ]);
  line(c, [
    { x: 29, y: -29 },
    { x: 29, y: -48 },
    { x: 11, y: -48 },
  ]);
  c.fillStyle = red;
  c.fillRect(-35, 36, 13, 4);
  c.fillRect(22, 36, 13, 4);
  c.fillStyle = '#453241';
  c.fillRect(-45, -61, 90, 4);
  c.fillStyle = open ? amber : red;
  c.fillRect(-45, -61, 90 * clamp(e.hp / e.maxHp, 0, 1), 4);
  c.restore();
}
