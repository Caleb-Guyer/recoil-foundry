import type { Game } from './game.ts';
import { distance } from './rules.ts';
import { DISCONNECT, DISCONNECT_STAGES, SHUTDOWN_PANELS } from './shutdown-layout.ts';

// The broken loop is a painted maintenance mark, shared by clues and machinery.
export function shutdownMark(c: CanvasRenderingContext2D, x: number, y: number, color = '#a8b69b') {
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, 10, 0.45, Math.PI * 2 - 0.45);
  c.stroke();
  c.beginPath();
  c.moveTo(x + 2, y - 4);
  c.lineTo(x + 13, y + 4);
  c.stroke();
}
function panel(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  open: boolean,
  spent: boolean,
  flash: number,
  ready = open,
) {
  c.fillStyle = '#161f20';
  c.fillRect(x - 28, y - 37, 56, 74);
  c.strokeStyle = flash > 0 ? '#e4fae8' : '#52635c';
  c.lineWidth = 2;
  c.strokeRect(x - 28, y - 37, 56, 74);
  c.fillStyle = spent ? '#566860' : ready ? '#b9e4cb' : '#736348';
  c.fillRect(x - 18, y - 25, 5, 5);
  shutdownMark(c, x, y, spent ? '#52635c' : open ? '#bbd9bc' : '#81775d');
  if (!open && !spent) {
    c.fillStyle = '#303a37';
    c.fillRect(x - 22, y - 12, 44, 25);
    c.strokeStyle = '#867351';
    c.beginPath();
    c.moveTo(x - 16, y + 6);
    c.lineTo(x + 16, y - 6);
    c.stroke();
  }
  if (spent) {
    c.strokeStyle = '#91b89c';
    c.beginPath();
    c.moveTo(x - 8, y + 18);
    c.lineTo(x + 12, y + 29);
    c.stroke();
  }
}
export function drawShutdown(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const s = g.shutdown;
  if (!s.eligible) return;
  c.save();
  if (s.cabinet) {
    const p = DISCONNECT;
    c.strokeStyle = '#4e5b4f';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(22, 738);
    c.lineTo(22, p.y);
    c.lineTo(p.x - 28, p.y);
    c.stroke();
    panel(
      c,
      p.x,
      p.y,
      !!s.target && distance(g.player.position, p) <= 190,
      s.state!.disabled.includes(g.stage),
      s.flash,
      !!s.target,
    );
    c.fillStyle = '#657360';
    c.fillRect(20, 692, 4, 13);
    c.fillRect(18, 695, 8, 3);
  }
  if (s.entrance) {
    c.fillStyle = '#101b19';
    c.fillRect(8, 634, 88, 106);
    c.strokeStyle = '#9ab8a1';
    c.lineWidth = 2;
    c.strokeRect(8, 634, 88, 106);
    shutdownMark(c, 52, 614, '#b9e4cb');
    DISCONNECT_STAGES.forEach((_, i) => {
      c.fillStyle = '#b9e4cb';
      c.fillRect(28 + i * 20, 650, 8, 3);
    });
    c.fillStyle = '#b9e4cb16';
    c.fillRect(8, 733, 170, 7);
  }
  if (s.chamber) {
    const cycle = s.state!.cycle!;
    SHUTDOWN_PANELS.forEach((p, i) => {
      c.strokeStyle = i < cycle ? '#303a38' : '#5c695d';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(p.x, p.y - 37);
      c.lineTo(p.x, 180);
      c.lineTo(1000, 180);
      c.stroke();
      panel(
        c,
        p.x,
        p.y,
        i === cycle && !!s.target && distance(g.player.position, p) <= 190,
        i < cycle,
        s.flash,
        i === cycle && !!s.target,
      );
    });
    for (let i = 0; i < 3; i++) {
      const x = 858 + i * 100;
      c.fillStyle = '#192423';
      c.fillRect(x, 95, 84, 145);
      c.strokeStyle = '#3e4c45';
      c.strokeRect(x, 95, 84, 145);
      for (let j = 0; j < 6; j++) {
        c.fillStyle = i < cycle ? '#29332e' : '#82977b';
        c.globalAlpha = i < cycle ? 1 : reduced ? 0.6 : 0.4 + 0.25 * Math.sin(g.time * 2 + j);
        c.fillRect(x + 12, 113 + j * 18, 60, 3);
      }
      c.globalAlpha = 1;
      shutdownMark(c, x + 42, 219, i < cycle ? '#39453c' : '#b3c29c');
    }
    if (s.complete) {
      c.fillStyle = `rgba(10,17,16,${Math.min(0.55, s.finishTime / 8)})`;
      c.fillRect(0, 0, 2000, 740);
      c.fillStyle = '#e6dbb433';
      c.fillRect(5, 650, 140, 90);
    }
  }
  c.restore();
}

export function drawShutdownBackdrop(c: CanvasRenderingContext2D, g: Game) {
  if (!g.shutdown.chamber) return;
  c.save();
  c.fillStyle = '#14201f';
  c.fillRect(0, 0, 2000, 740);
  for (let i = 0; i < 8; i++) {
    const x = 35 + i * 245;
    c.fillStyle = '#182623';
    c.fillRect(x, 100, 220, 620);
    c.strokeStyle = '#26362f';
    c.lineWidth = 3;
    c.strokeRect(x, 100, 220, 620);
    for (let j = 0; j < 7; j++) {
      c.fillStyle = '#22312b';
      c.fillRect(x + 15, 370 + j * 45, 190, 2);
    }
    c.fillStyle = '#64725b';
    c.fillRect(x + 85, 85, 50, 3);
  }
  c.fillStyle = '#1c2b26';
  c.fillRect(0, 54, 2000, 18);
  c.fillStyle = '#1c2b26';
  c.fillRect(0, 716, 2000, 24);
  c.restore();
}
