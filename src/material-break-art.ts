import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { materialBreakPose, type MaterialFragmentPose } from './material-response.ts';

function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function face(c: CanvasRenderingContext2D, points: Vec[], fill: string, edge: string) {
  c.fillStyle = fill;
  c.strokeStyle = edge;
  c.lineWidth = 0.8;
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.fill();
  c.stroke();
}
function fragment(c: CanvasRenderingContext2D, f: MaterialFragmentPose) {
  const x = f.size.x / 2,
    y = f.size.y / 2;
  if (f.shape === 'cap') {
    c.strokeStyle = '#8a8066';
    c.lineWidth = 1.4;
    c.beginPath();
    c.ellipse(0, 0, x, y, 0, 0.3, Math.PI * 1.8);
    c.stroke();
    line(c, { x: -x * 0.8, y: 0 }, { x: x * 0.5, y: y * 0.2 }, '#655c43', 1);
    return;
  }
  if (f.material === 'wood') {
    face(
      c,
      [
        { x: -x, y: -y },
        { x: x * 0.7, y: -y * 0.75 },
        { x: x, y: y * 0.45 },
        { x: x * 0.6, y: y },
        { x: -x, y: y * 0.8 },
      ],
      '#796b4c',
      '#8b8467',
    );
    line(c, { x: -x * 0.8, y: -y * 0.4 }, { x: x * 0.6, y: -y * 0.1 }, '#403e30', 0.8);
    line(c, { x: -x * 0.6, y: y * 0.4 }, { x: x * 0.4, y: y * 0.5 }, '#a09974', 0.55);
  } else if (f.material === 'masonry') {
    face(
      c,
      [
        { x: -x, y: -y * 0.4 },
        { x: -x * 0.2, y: -y },
        { x: x * 0.8, y: -y * 0.7 },
        { x: x, y: y * 0.5 },
        { x: x * 0.1, y: y },
        { x: -x * 0.8, y: y * 0.6 },
      ],
      '#52615b',
      '#7c8980',
    );
    line(c, { x: -x * 0.8, y: -y * 0.2 }, { x: x * 0.3, y: y * 0.6 }, '#324944', 0.8);
  } else if (f.material === 'casing') {
    face(
      c,
      [
        { x: -x, y: -y },
        { x: x * 0.6, y: -y * 0.75 },
        { x: x, y: y * 0.2 },
        { x: x * 0.5, y: y },
        { x: -x * 0.7, y: y * 0.6 },
      ],
      '#736345',
      '#948464',
    );
    line(c, { x: -x * 0.6, y: -y * 0.65 }, { x: x * 0.6, y: -y * 0.45 }, '#343e35', 1);
    line(c, { x: x * 0.3, y: -y * 0.7 }, { x: x * 0.6, y: y * 0.5 }, '#a39a78', 0.8);
  } else {
    const freight = f.material === 'freight';
    face(
      c,
      [
        { x: -x, y: -y },
        { x: x * 0.8, y: -y * 0.8 },
        { x: x, y: y * 0.7 },
        { x: -x * 0.6, y: y },
        { x: -x, y: y * 0.4 },
      ],
      freight ? '#58684e' : '#4d625c',
      freight ? '#8a9474' : '#819187',
    );
    line(c, { x: -x * 0.75, y: 0 }, { x: x * 0.7, y: -y * 0.1 }, '#263e3c', 1);
    line(
      c,
      { x: -x * 0.65, y: -y * 0.65 },
      { x: x * 0.6, y: -y * 0.5 },
      freight ? '#a59e74' : '#8f9b89',
      0.7,
    );
    if (f.shape === 'strut')
      line(c, { x: -x * 0.7, y: y * 0.55 }, { x: x * 0.7, y: y * 0.5 }, '#2b4340', 1);
  }
}
/** One shared world pass for real prop and terrain fractures. None of these dim chips is solid rubble. */
export function drawMaterialBreaks(c: CanvasRenderingContext2D, g: Game, reduced = false) {
  for (const record of g.materialResponse.breaks) {
    if (record.life <= 0) continue;
    const pose = materialBreakPose(record, g.time, reduced);
    if (pose.alpha <= 0) continue;
    for (const f of pose.fragments) {
      c.save();
      c.globalAlpha *= f.alpha * (reduced ? 0.45 : 0.62);
      c.translate(f.position.x, f.position.y);
      c.rotate(f.angle);
      c.lineJoin = 'round';
      fragment(c, f);
      c.restore();
    }
  }
}
