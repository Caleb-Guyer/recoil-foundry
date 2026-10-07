import type { Game } from './game.ts';
import type { Vec } from './rules.ts';

export const UPRISING_PALETTES = {
  railworks: {
    surface: '#c0ad86',
    body: '#334047',
    face: '#26333a',
    edge: '#59636a',
    detail: '#425058',
  },
  core: {
    surface: '#8bc7ca',
    body: '#253f43',
    face: '#203238',
    edge: '#416468',
    detail: '#315157',
  },
};

export function drawUprisingScenery(
  c: CanvasRenderingContext2D,
  district: 'railworks' | 'core',
  camera: Vec,
  width: number,
  height: number,
) {
  const rail = district === 'railworks',
    sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rail ? '#0d1922' : '#0b1c22');
  sky.addColorStop(1, rail ? '#26363b' : '#18383b');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  c.save();
  c.translate(-camera.x * 0.18, -camera.y * 0.12);
  if (rail) {
    for (let i = 0; i < 7; i++) {
      const x = i * 360;
      c.fillStyle = '#17292f';
      c.fillRect(x, 180, 300, 520);
      c.strokeStyle = '#324950';
      c.lineWidth = 7;
      c.strokeRect(x + 14, 200, 272, 500);
      c.fillStyle = '#72877b';
      c.fillRect(x + 120, 210, 45, 5);
    }
    c.fillStyle = '#0f2027';
    c.fillRect(0, 555, 2600, 105);
    c.strokeStyle = '#465657';
    c.lineWidth = 3;
    for (const y of [560, 670]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(2600, y);
      c.stroke();
    }
    for (let x = 0; x < 2600; x += 96) {
      c.beginPath();
      c.moveTo(x, 560);
      c.lineTo(x + 30, 670);
      c.stroke();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const x = 140 + i * 470;
      c.fillStyle = '#132e34';
      c.fillRect(x, 130, 330, 580);
      c.strokeStyle = '#2d555b';
      c.lineWidth = 12;
      c.strokeRect(x + 30, 170, 270, 470);
      c.beginPath();
      c.arc(x + 165, 390, 95, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#497374';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x + 165, 390, 70, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#557d74';
      c.fillRect(x + 150, 315, 30, 150);
      c.strokeStyle = '#34565a';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x + 165, 570);
      c.lineTo(x + 165, 730);
      c.stroke();
    }
  }
  c.restore();
}

export function drawUprising(c: CanvasRenderingContext2D, g: Game) {
  const u = g.uprising;
  if (!u.active || g.mode === 'title') return;
  c.save();
  c.lineWidth = 3;
  for (const a of u.anchors) {
    const b = a.body.bounds,
      rail = g.level.uprising === 'railworks';
    c.strokeStyle = rail ? '#d6ae70' : '#87cbd6';
    c.strokeRect(b.min.x, b.min.y, b.max.x - b.min.x, b.max.y - b.min.y);
    c.fillStyle = '#151b22';
    if (rail)
      for (const x of [b.min.x + 38, b.max.x - 38]) {
        c.beginPath();
        c.arc(x, b.max.y + 10, 12, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    else {
      c.beginPath();
      c.moveTo(a.body.position.x, b.max.y);
      c.lineTo(a.body.position.x, 750);
      c.stroke();
    }
  }
  for (const p of u.nodes) {
    if (u.outcome || !g.props.items.includes(p)) continue;
    const pos = p.body.position,
      width = p.body.bounds.max.x - p.body.bounds.min.x,
      height = p.body.bounds.max.y - p.body.bounds.min.y;
    c.fillStyle = '#17222a';
    c.strokeStyle = p.hp <= 0 ? '#768c8c' : p.uprising === 'generator' ? '#e4bc77' : '#87dbe7';
    c.fillRect(pos.x - width / 2, pos.y - height / 2, width, height);
    c.strokeRect(pos.x - width / 2, pos.y - height / 2, width, height);
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillStyle = c.strokeStyle;
    c.fillText(
      p.uprising === 'generator'
        ? 'POWER'
        : p.uprising === 'relay'
          ? 'RELAY'
          : p.hp > 0
            ? 'SEALED'
            : 'TAKE',
      pos.x,
      pos.y + 4,
    );
    c.fillRect(
      pos.x - width / 2,
      pos.y - height / 2 - 10,
      (width * Math.max(0, p.hp)) / p.maxHp,
      4,
    );
  }
  if (u.waiting && u.kind === 'escape' && u.evacuation) {
    for (const [i, p] of (u.room?.switches ?? []).entries()) {
      c.strokeStyle = i < u.routeStep ? '#aedcb6' : i === u.routeStep ? '#e4bc77' : '#637b83';
      c.fillStyle = '#17222a';
      c.fillRect(p.x - 16, p.y - 20, 32, 40);
      c.strokeRect(p.x - 16, p.y - 20, 32, 40);
      c.fillStyle = c.strokeStyle;
      c.font = 'bold 12px monospace';
      c.textAlign = 'center';
      c.fillText(i < u.routeStep ? '✓' : String(i + 1), p.x, p.y + 4);
    }
    const { x, y, w, h } = u.evacuation;
    c.strokeStyle = u.switchTarget ? '#637b83' : '#aedcb6';
    c.fillStyle = u.switchTarget ? '#637b8314' : '#aedcb618';
    c.fillRect(x, y, w, h);
    c.strokeRect(x, y, w, h);
    if (u.boardingAt !== null && u.boardingDuration > 0) {
      c.fillStyle = '#aedcb6';
      c.fillRect(x + 8, y + h - 10, (w - 16) * u.boardingProgress, 4);
    }
    c.fillStyle = c.strokeStyle;
    c.font = 'bold 14px monospace';
    c.textAlign = 'center';
    c.fillText(
      u.switchTarget
        ? 'ROUTE LOCKED'
        : u.boardingAt !== null && u.boardingDuration > 0
          ? 'BOARDING'
          : 'BOARD HERE',
      x + w / 2,
      y - 12,
    );
  }
  c.restore();
}
