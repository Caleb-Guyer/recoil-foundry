import type { Game } from './game.ts';
import { COLD_RIG, STORY_ROOMS } from './story-layout.ts';

const line = (c: CanvasRenderingContext2D, points: number[], color: string, width = 2) => {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  for (let i = 0; i < points.length; i += 2)
    i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]);
  c.stroke();
};
function lamp(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cold = false,
) {
  const glow = c.createLinearGradient(x, y, x, y + height);
  glow.addColorStop(0, cold ? '#9bcac01c' : '#efd3a224');
  glow.addColorStop(1, '#e5d2a200');
  c.fillStyle = glow;
  c.beginPath();
  c.moveTo(x - width / 2, y);
  c.lineTo(x + width / 2, y);
  c.lineTo(x + width, y + height);
  c.lineTo(x - width, y + height);
  c.closePath();
  c.fill();
  c.fillStyle = cold ? '#88aaa2' : '#b7ad8e';
  c.fillRect(x - width / 2, y - 4, width, 4);
}
function wall(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#192527';
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#3f504f';
  c.lineWidth = 3;
  c.strokeRect(x, y, w, h);
  c.fillStyle = '#243234';
  c.fillRect(x + 8, y + 8, w - 16, 24);
}
function cup(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x, y, 8, 9);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x + 7, y + 2, 4, 4);
}

// These subdued fixtures sit behind the physical platforms and combat actors.
// Every bright paper is a real pickup; scenery has no instruction overlays.
export function drawStoryBackdrop(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const story = g.story;
  if (!story.active) return;
  const kind = story.state!.kind,
    floor = STORY_ROOMS[kind].floor;
  c.save();
  if (g.level.mirrored) {
    c.translate(2000, 0);
    c.scale(-1, 1);
  }
  if (kind === 'breakroom') {
    wall(c, 555, 292, 330, 228);
    lamp(c, 710, 328, 120, 185);
    // A blank window was bricked over, leaving a colder patch in the wall.
    c.fillStyle = '#2e4142';
    c.fillRect(610, 350, 146, 82);
    for (let row = 0; row < 4; row++)
      line(c, [610, 350 + row * 21, 756, 350 + row * 21], '#52605a', 1);
    for (let col = 0; col < 3; col++)
      line(c, [640 + col * 42, 350, 640 + col * 42, 432], '#41534f', 1);
    c.fillStyle = '#536057';
    c.fillRect(608, floor - 32, 173, 5);
    c.fillRect(620, floor - 27, 4, 27);
    c.fillRect(762, floor - 27, 4, 27);
    ['#bac6b4', '#9bafa9', '#bbad8d', '#758ba0'].forEach((color, i) =>
      cup(c, 686 + i * 21, floor - 42, color),
    );
    // One upright chair and one tipped against the empty fourth place.
    line(c, [632, 481, 632, 506, 652, 506, 652, 520], '#6b7568', 3);
    line(c, [800, 520, 814, 506, 830, 520, 817, 496, 803, 510], '#647267', 3);
    c.strokeStyle = '#6c8078';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(815, 338, 15, 0, Math.PI * 2);
    c.stroke();
    line(c, [815, 326, 815, 338, 815, 349], '#b3b7a1', 2);
    c.fillStyle = '#405747';
    c.fillRect(576, 461, 26, 32);
    c.fillStyle = story.state!.recovered ? '#52645a' : '#b6d4b8';
    c.fillRect(587, 469, 4, 16);
    c.fillRect(581, 475, 16, 4);
    line(c, [858, 350, 858, 388, 846, 406, 851, 420], '#9b8b66', 2);
  } else if (kind === 'dispatch') {
    wall(c, 440, 328, 295, 222);
    lamp(c, 555, 355, 95, 195);
    c.fillStyle = '#465751';
    c.fillRect(486, 520, 174, 7);
    c.fillRect(495, 527, 7, 23);
    c.fillRect(642, 527, 7, 23);
    c.fillStyle = '#263935';
    c.fillRect(593, 464, 43, 36);
    c.strokeStyle = '#77897b';
    c.strokeRect(593, 464, 43, 36);
    line(c, [600, 476, 625, 476, 625, 484, 602, 484], '#aab59a', 2);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#526259';
      c.fillRect(456, 412 + i * 24, 23, 17);
    }
    wall(c, 868, 554, 505, 172);
    line(c, [897, 581, 1338, 581, 1338, 692, 897, 692, 897, 581], '#435450', 9);
    // The same blue-threaded package travels a closed return loop behind glass.
    const t = (reduced ? 0.3 : story.age * 0.085) % 1,
      perimeter = 2 * (441 + 111),
      d = t * perimeter;
    let x = 897,
      y = 581;
    if (d < 441) x += d;
    else if (d < 552) {
      x = 1338;
      y += d - 441;
    } else if (d < 993) {
      x = 1338 - (d - 552);
      y = 692;
    } else y = 692 - (d - 993);
    c.fillStyle = '#998565';
    c.fillRect(x - 17, y - 11, 34, 22);
    c.strokeStyle = '#bfb194';
    c.lineWidth = 1;
    c.strokeRect(x - 17, y - 11, 34, 22);
    c.fillStyle = '#d5d0b6';
    c.fillRect(x - 8, y - 7, 15, 7);
    line(c, [x + 10, y - 10, x + 10, y + 10], '#85b7cb', 2);
    for (const ax of [1020, 1200]) {
      line(c, [ax - 6, 568, ax, 574, ax - 6, 580], '#73877a', 2);
      line(c, [ax + 6, 699, ax, 705, ax + 6, 711], '#73877a', 2);
    }
  } else if (kind === 'experiment') {
    wall(c, 325, 434, 322, 206);
    lamp(c, 490, 464, 100, 176, true);
    c.fillStyle = '#495e58';
    c.fillRect(438, 611, 165, 5);
    c.fillRect(449, 616, 5, 24);
    c.fillRect(587, 616, 5, 24);
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = '#728f87';
      c.lineWidth = 2;
      c.strokeRect(460 + i * 20, 589, 10, 21);
      c.fillStyle = '#8db7b37a';
      c.fillRect(462 + i * 20, 600 - i * 3, 6, 9 + i * 3);
    }
    line(c, [612, 557, 640, 557, 640, 574, 714, 574, 714, 429, 1130, 429, 1130, 475], '#456c68', 5);
    c.fillStyle = '#263c3c';
    c.fillRect(1088, 453, 84, 71);
    c.strokeStyle = '#729a91';
    c.lineWidth = 2;
    c.strokeRect(1088, 453, 84, 71);
    for (let i = 0; i < 4; i++) line(c, [1100, 465 + i * 12, 1160, 465 + i * 12], '#587872', 4);
    const lit = story.emitting || (!g.clear && story.phase < COLD_RIG.warning);
    c.fillStyle = lit ? '#b0e1d7' : '#50796d';
    c.fillRect(1100, 524, 60, 5);
    line(c, [1088, 493, 1070, 508, 1080, 520], '#b1af8a', 2);
    c.fillStyle = '#425752';
    c.fillRect(970, 725, 306, 15);
    for (let i = 0; i < 11; i++) line(c, [982 + i * 26, 726, 990 + i * 26, 737], '#68776a', 2);
  } else {
    wall(c, 422, 396, 355, 134);
    lamp(c, 579, 405, 88, 122);
    c.fillStyle = '#687264';
    c.fillRect(445, 516, 105, 10);
    c.fillStyle = '#89927c';
    c.fillRect(447, 512, 24, 7);
    c.fillStyle = '#4e6056';
    c.fillRect(581, 502, 111, 5);
    c.fillRect(590, 507, 5, 23);
    c.fillRect(681, 507, 5, 23);
    line(c, [595, 486, 614, 483, 620, 489], '#a8ab8f', 3);
    cup(c, 707, 513, '#bac6b4');
    // Uneven tally groups and a scratched route toward the roof.
    for (let i = 0; i < 18; i++)
      line(
        c,
        [
          450 + (i % 9) * 8,
          431 + Math.floor(i / 9) * 22,
          449 + (i % 9) * 8,
          444 + Math.floor(i / 9) * 22,
        ],
        '#8c9380',
        1,
      );
    line(c, [447, 442, 482, 433, 447, 463, 482, 455], '#8c9380', 1);
    line(c, [721, 464, 721, 432, 714, 439, 721, 432, 728, 439], '#a9b19a', 2);
    line(c, [757, 466, 750, 491, 760, 506], '#506860', 2);
  }
  c.restore();
}

export function drawStoryDetails(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  const s = g.story,
    note = s.note;
  if (!s.active || !note) return;
  c.save();
  if (s.state!.kind === 'experiment' && !g.clear) {
    const p = s.rig,
      warning = s.phase < COLD_RIG.warning;
    if (warning || s.emitting) {
      const r = s.emitting
        ? COLD_RIG.radius
        : COLD_RIG.radius * (0.85 + (0.15 * s.phase) / COLD_RIG.warning);
      c.strokeStyle = s.emitting ? '#a4d4d278' : '#82aca23a';
      c.lineWidth = s.emitting ? 2 : 1;
      c.setLineDash(s.emitting ? [] : [4, 13]);
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      if (s.emitting) {
        c.fillStyle = '#91d4cf0a';
        c.beginPath();
        c.arc(p.x, p.y, r, 0, Math.PI * 2);
        c.fill();
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5,
            d = reduced ? 110 : 55 + (((s.phase - COLD_RIG.warning) * 160 + i * 19) % 150);
          const x = p.x + Math.cos(a) * d,
            y = p.y + Math.sin(a) * d;
          line(c, [x - 2, y, x + 2, y], '#b0dace85', 1);
        }
      }
    }
  }
  if (!s.state!.recovered) {
    const pulse = reduced ? 0.55 : 0.42 + Math.sin(s.age * 2.6) * 0.14;
    const glow = c.createRadialGradient(note.x, note.y, 2, note.x, note.y, 29);
    glow.addColorStop(0, `rgba(232,201,139,${pulse})`);
    glow.addColorStop(1, '#e8c98b00');
    c.fillStyle = glow;
    c.fillRect(note.x - 29, note.y - 29, 58, 58);
    c.fillStyle = '#e3d3aa';
    c.fillRect(note.x - 7, note.y - 9, 14, 18);
    c.fillStyle = '#70654d';
    for (let i = 0; i < 3; i++) c.fillRect(note.x - 4, note.y - 5 + i * 4, i === 2 ? 5 : 8, 1);
    c.fillStyle = '#f8ebcc';
    c.fillRect(note.x + 3, note.y - 9, 4, 4);
  } else if (s.age - s.collectedAt < 0.8) {
    const progress = (s.age - s.collectedAt) / 0.8;
    c.globalAlpha = 1 - progress;
    c.strokeStyle = '#e4d3aa';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(note.x, note.y, 10 + progress * 24, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}
