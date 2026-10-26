import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import type { ShiftRoutes } from './shift-routes.ts';

const line = (c: CanvasRenderingContext2D, a: Vec, b: Vec) => {
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
};
function consoleArt(
  c: CanvasRenderingContext2D,
  p: Vec,
  active: boolean,
  current: boolean,
  near: boolean,
  label: string,
) {
  c.save();
  c.fillStyle = '#172b2e';
  c.strokeStyle = active ? '#a9d4b4' : current ? '#e8bd7d' : '#637c80';
  c.lineWidth = current ? 2 : 1;
  c.fillRect(p.x - 17, p.y - 23, 34, 42);
  c.strokeRect(p.x - 17, p.y - 23, 34, 42);
  c.beginPath();
  c.arc(p.x, p.y - 3, 8, 0, Math.PI * 2);
  c.stroke();
  line(c, { x: p.x, y: p.y - 3 }, { x: p.x + 5, y: p.y - 9 });
  if (near && current) {
    c.fillStyle = '#e8bd7d';
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillText(label, p.x, p.y - 32);
  }
  c.restore();
}
/** Physical mechanism cues only. Presentation never changes a route or trace. */
export function drawShiftRoute(c: CanvasRenderingContext2D, g: Game, _reduced = false) {
  const routes = (g as Game & { shiftRoutes?: ShiftRoutes }).shiftRoutes;
  if (!routes?.active || g.mode === 'title') return;
  c.save();
  c.lineWidth = 1.5;
  if (routes.kind === 'vacuum-docks') {
    c.strokeStyle = '#72969f';
    c.globalAlpha = 0.35;
    for (const x of [300, 680, 1060, 1440, 1800]) {
      c.beginPath();
      c.arc(x, 190, 43, 0, Math.PI * 2);
      c.stroke();
      line(c, { x: x - 29, y: 161 }, { x: x + 29, y: 219 });
      line(c, { x: x - 29, y: 219 }, { x: x + 29, y: 161 });
    }
    c.setLineDash([7, 12]);
    line(c, { x: 90, y: 290 }, { x: 1910, y: 290 });
    c.setLineDash([]);
    c.globalAlpha = 0.8;
    c.strokeStyle = '#a5d2d8';
    for (const x of [230, 560, 1290, 1820]) {
      line(c, { x: x - 10, y: 731 }, { x: x, y: 724 });
      line(c, { x: x, y: 724 }, { x: x + 10, y: 731 });
    }
  }
  for (const rotor of routes.rotors) {
    c.save();
    c.translate(rotor.body.position.x, rotor.body.position.y);
    c.rotate(rotor.body.angle);
    c.fillStyle = '#344346';
    c.strokeStyle = '#bbc8bd';
    c.fillRect(-150, -11, 300, 22);
    c.strokeRect(-150, -11, 300, 22);
    c.strokeStyle = '#728e8b';
    for (let x = -130; x < 140; x += 26) line(c, { x, y: -6 }, { x: x + 12, y: 6 });
    c.fillStyle = '#172c30';
    c.beginPath();
    c.arc(0, 0, 12, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    const moving = Math.abs(rotor.target - rotor.body.angle) > 0.01;
    consoleArt(
      c,
      rotor.console,
      false,
      true,
      !g.clear &&
        Math.hypot(g.player.position.x - rotor.console.x, g.player.position.y - rotor.console.y) <
          125,
      moving ? 'MOVING' : 'ROTATE',
    );
  }
  for (const mirror of routes.mirrors) {
    c.save();
    c.translate(mirror.body.position.x, mirror.body.position.y);
    c.rotate(mirror.body.angle);
    c.fillStyle = '#1c3b43';
    c.fillRect(-70, -6, 140, 12);
    c.strokeStyle = '#90d8e3';
    c.strokeRect(-70, -6, 140, 12);
    c.strokeStyle = '#d7eff0';
    line(c, { x: -63, y: -4 }, { x: 63, y: -4 });
    c.fillStyle = '#759da5';
    for (const x of [-67, 67]) c.fillRect(x - 3, -9, 6, 18);
    c.restore();
    consoleArt(
      c,
      mirror.console,
      false,
      true,
      !g.clear &&
        Math.hypot(g.player.position.x - mirror.console.x, g.player.position.y - mirror.console.y) <
          125,
      'TURN',
    );
  }
  if (routes.kind === 'express-airlocks') {
    for (const [index, gate] of routes.gates.entries()) {
      const opened = index < (routes.state!.gates ?? 0);
      if (!opened) {
        c.fillStyle = '#273e43';
        c.strokeStyle = '#9caeaa';
        const b = gate.body.bounds;
        c.fillRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
        c.strokeRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
        c.strokeStyle = '#c0a475';
        c.setLineDash([8, 10]);
        line(c, { x: gate.body.position.x, y: 425 }, { x: gate.body.position.x, y: 723 });
        c.setLineDash([]);
      }
      const current = index === (routes.state!.gates ?? 0);
      consoleArt(
        c,
        gate.console,
        opened,
        current,
        !g.clear &&
          Math.hypot(g.player.position.x - gate.console.x, g.player.position.y - gate.console.y) <
            125,
        'OPEN',
      );
    }
  }
  if (routes.kind === 'rework-loop') {
    c.strokeStyle = '#ad9c7f';
    c.lineWidth = 2;
    for (const p of routes.state!.rework!.scars) {
      const x = 2000 - p.x;
      for (let i = 0; i < 3; i++)
        line(c, { x: x - 13 + i * 9, y: p.y - 4 }, { x: x - 7 + i * 9, y: p.y });
    }
    c.fillStyle = '#1b2d30';
    c.fillRect(55, 647, 99, 30);
    c.strokeStyle = '#647c77';
    c.strokeRect(55, 647, 99, 30);
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillStyle = '#c9bda1';
    c.fillText('REWORK →', 104, 667);
  }
  c.restore();
}
