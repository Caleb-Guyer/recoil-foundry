import type { Vec } from './rules.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';
import {
  foundryPolygon as polygon,
  foundryLine as line,
  foundryWheel as wheel,
  foundryTruss as truss,
  foundryGlow as glow,
  foundryLamp as lamp,
  foundrySky as sky,
  foundryLayer as layer,
  unit,
} from './living-foundry-art-kit.ts';

const IRON = '#352e2b',
  SHADOW = '#211f21',
  EDGE = '#514136',
  DARK = '#16191d';
function pipe(c: CanvasRenderingContext2D, points: number[], width: number) {
  line(c, points, '#292624', width);
  line(c, points, '#45372e', Math.max(2, width * 0.61));
  line(c, points, '#544132', 2);
}
function band(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  c.fillStyle = '#45372f';
  c.fillRect(x, y, w, 13);
  c.fillStyle = '#252323';
  c.fillRect(x, y + 11, w, 3);
  for (const xx of [x + 9, x + w - 12]) {
    c.fillStyle = '#66503b';
    c.fillRect(xx, y + 4, 3, 3);
  }
}
function furnace(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  power: number,
  m: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  // Bell, stack, belly and bosh are a single recognisable blast-furnace profile.
  polygon(
    c,
    [
      -63, -260, 63, -260, 72, -167, 128, -112, 161, 91, 115, 194, 72, 244, -72, 244, -115, 194,
      -161, 91, -128, -112, -72, -167,
    ],
    '#2e2927',
  );
  polygon(
    c,
    [
      -49, -241, 31, -241, 36, -156, 94, -97, 119, 86, 79, 182, 47, 227, -52, 227, -92, 181, -131,
      87, -100, -101, -50, -159,
    ],
    '#3d322b',
  );
  polygon(
    c,
    [
      35, -241, 60, -241, 69, -164, 124, -111, 155, 89, 110, 189, 65, 238, 47, 224, 85, 173, 120,
      87, 95, -100, 40, -157,
    ],
    '#242324',
  );
  for (const [yy, ww] of [
    [-173, 155],
    [-104, 260],
    [41, 309],
    [154, 257],
    [219, 161],
  ])
    band(c, -ww / 2, yy, ww);
  for (const xx of [-112, 112]) {
    line(c, [xx, -92, xx * 1.26, 90, xx * 0.66, 218], '#544132', 3);
    line(c, [xx * 0.65, 244, xx * 0.65, 330], '#2e2927', 20);
  }
  c.fillStyle = '#1b1c20';
  c.fillRect(-48, 192, 96, 65);
  glow(c, 0, 218, 145, [180, 98, 45], 0.07 + 0.055 * power);
  c.save();
  c.globalAlpha = 0.25 + 0.6 * unit(power);
  polygon(c, [-35, 249, -32, 211, -17, 197, 19, 197, 33, 211, 36, 249], '#855232');
  polygon(c, [-23, 246, -20, 213, 20, 213, 24, 246], '#a86c3b');
  c.restore();
  // Tuyeres and a bustle pipe remain subdued rather than resembling attack tells.
  line(c, [-169, 156, -169, 127, 169, 127, 169, 156], '#493a30', 13);
  for (const xx of [-103, -51, 0, 51, 103]) {
    c.fillStyle = '#2a2827';
    c.fillRect(xx - 12, 126, 24, 32);
    c.fillStyle = '#54402f';
    c.fillRect(xx - 7, 148, 14, 8);
  }
  pipe(c, [-39, -258, -39, -315, -159, -356], 28);
  pipe(c, [45, -258, 45, -342, 166, -392], 23);
  wheel(c, -167, 130, 25, m * 0.14, '#5b4635', '#242222');
  line(c, [-150, 260, -150, 293, 150, 293, 150, 260], '#4c3d32', 6);
  for (let i = 0; i < 7; i++) line(c, [-132 + i * 44, 260, -132 + i * 44, 292], '#43372f', 2);
  c.restore();
}
function ladle(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  tilt: number,
  power: number,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  c.rotate(tilt);
  line(c, [-89, -34, -89, -85, 89, -85, 89, -34], '#574232', 8);
  polygon(c, [-97, -35, 97, -35, 75, 75, 48, 91, -49, 91, -78, 74], '#44352c');
  polygon(c, [-76, -21, 77, -21, 59, 63, 36, 74, -40, 74, -62, 61], '#302a26');
  c.fillStyle = '#58402d';
  c.beginPath();
  c.ellipse(0, -29, 97, 20, 0, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.globalAlpha = 0.35 + 0.55 * unit(power);
  c.fillStyle = '#96603a';
  c.beginPath();
  c.ellipse(0, -30, 79, 10, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  band(c, -85, 39, 169);
  for (const side of [-1, 1]) {
    c.fillStyle = '#534031';
    c.beginPath();
    c.arc(side * 96, -24, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#262526';
    c.beginPath();
    c.arc(side * 96, -24, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
function doorway(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  reveal: number,
  power: number,
  m: number,
  split = false,
) {
  c.fillStyle = '#2d2825';
  c.fillRect(x - 22, y - 20, w + 44, h + 26);
  c.fillStyle = '#11191c';
  c.fillRect(x, y, w, h);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const bay = c.createLinearGradient(0, y, 0, y + h);
  bay.addColorStop(0, '#1c2021');
  bay.addColorStop(1, '#3d2f27');
  c.fillStyle = bay;
  c.fillRect(x, y, w, h);
  // A smaller real furnace and connecting charging gallery recede into the bay.
  truss(c, x - 10, y + 65, w + 20, 31, 6, '#272725', '#453b31');
  furnace(c, x + w * 0.5, y + h * 0.53, 0.54, power, m);
  glow(c, x + w * 0.5, y + h * 0.83, w * 0.43, [184, 106, 50], 0.07 * power);
  const closed = 1 - unit(reveal);
  if (split) {
    // Rigid heat shields slide into side pockets; their ribs never squash.
    for (const side of [0, 1]) {
      const xx = side ? x + w / 2 + (w * (1 - closed)) / 2 : x - (w * (1 - closed)) / 2;
      c.fillStyle = '#302925';
      c.fillRect(xx, y, w / 2, h);
      line(
        c,
        [xx + 10, y + 14, xx + w / 2 - 10, y + 14, xx + w / 2 - 10, y + h - 10],
        '#493a30',
        3,
      );
      for (let i = 1; i < 5; i++)
        line(c, [xx + 4, y + (i * h) / 5, xx + w / 2 - 4, y + (i * h) / 5], '#392f29', 4);
    }
  } else {
    const shutter = h * closed;
    c.fillStyle = '#302925';
    c.fillRect(x, y, w, shutter);
    for (let i = 0; i < 8; i++) {
      const yy = y + shutter - 15 - i * 48;
      if (yy > y) line(c, [x + 5, yy, x + w - 5, yy], '#45362d', 5);
    }
    c.fillStyle = '#54402e';
    c.fillRect(x, y + shutter - 9, w, 9);
  }
  c.restore();
  line(c, [x - 12, y + h, x - 12, y - 10, x + w + 12, y - 10, x + w + 12, y + h], '#4a3c32', 15);
  lamp(c, x + w * 0.5, y - 14, power, true);
}
function ceiling(c: CanvasRenderingContext2D, power: number, variant: number) {
  truss(c, 0, 22, 2180, 59, 12, '#262524', '#40352e');
  for (const x of [70, 785, 1600, 2115]) {
    polygon(c, [x, 82, x + 16, 82, x + 34, 706, x - 13, 706], '#2b2826');
    line(c, [x + 6, 99, x + 11, 693], '#44382f', 3);
    lamp(c, x + 8, 111, power, true);
  }
  pipe(c, [-70, 118, 254, 118, 344, 211, 1190, 211, 1278, 118, 2220, 118], variant === 1 ? 30 : 39);
}
function blastTower(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  doorway(c, 1200, 212, 614, 438, f.reveal, f.power, m, true);
  furnace(c, 650, 363, 1.1, f.power, m);
  pipe(c, [518, 222, 393, 168, 316, 82, 316, -10], 44);
  pipe(c, [767, 196, 910, 146, 945, 12], 33);
  // Charging conveyor rises into the bell; its rungs advance on its own track.
  polygon(c, [44, 552, 96, 564, 491, 137, 464, 101], '#252726');
  line(c, [58, 554, 480, 121], '#4c4035', 5);
  for (let i = 0; i < 9; i++) {
    const step = (i / 9 + ((m * 0.016) % (1 / 9))) % 1;
    const x = 63 + step * 405,
      y = 546 - step * 411;
    line(c, [x - 10, y - 7, x + 12, y + 15], '#443a31', 5);
  }
  truss(c, 890, 196, 1020, 44, 9, '#2c2926', '#4b3c31');
  const x = 1000 + Math.sin(m * 0.055) * 150;
  line(c, [x - 41, 242, x - 41, 460, x + 41, 460, x + 41, 242], '#514031', 2);
  ladle(c, x, 491, 0.85, Math.sin(m * 0.08) * 0.035, f.power);
  wheel(c, 954, 259, 28, m * 0.12, '#5a4431', '#292624');
  pipe(c, [102, 710, 102, 589, 331, 589, 371, 627], 21);
  for (const x of [77, 1780]) {
    c.fillStyle = '#392e28';
    c.fillRect(x, 610, 130, 93);
    band(c, x - 4, 626, 138);
  }
  lamp(c, 479, 232, f.power, true);
}
function castingCathedral(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  // Tall, narrowing ribs make the casting hall read as one space, not tiled boxes.
  for (const [x, wide] of [
    [170, 370],
    [905, 470],
    [1760, 360],
  ]) {
    line(
      c,
      [
        x - wide * 0.45,
        707,
        x - wide * 0.45,
        275,
        x,
        89,
        x + wide * 0.45,
        275,
        x + wide * 0.45,
        707,
      ],
      '#302b27',
      22,
    );
    line(
      c,
      [
        x - wide * 0.45 + 12,
        695,
        x - wide * 0.45 + 12,
        278,
        x,
        104,
        x + wide * 0.45 - 12,
        278,
        x + wide * 0.45 - 12,
        695,
      ],
      '#46372d',
      3,
    );
  }
  doorway(c, 1030, 172, 640, 493, f.reveal, f.power, m);
  furnace(c, 426, 429, 0.86, f.power, m);
  truss(c, 190, 205, 1005, 49, 8, '#322b26', '#504033');
  const ladleX = 745 + Math.sin(m * 0.045) * 113,
    tilt = -0.11 + Math.sin(m * 0.075) * 0.045;
  for (const dx of [-47, 47]) line(c, [ladleX + dx, 256, ladleX + dx, 365], '#5b4635', 2);
  ladle(c, ladleX, 421, 1.14, tilt, f.power);
  // One narrow casting stream, dark enough to remain a background process.
  if (f.power > 0.01) {
    c.save();
    c.globalAlpha = unit(f.power) * 0.6;
    line(c, [ladleX - 99, 410, ladleX - 112, 544, ladleX - 117, 592], '#8c5530', 6);
    line(c, [ladleX - 99, 410, ladleX - 112, 544, ladleX - 117, 592], '#ad7540', 2);
    c.restore();
  }
  polygon(c, [590, 610, 1070, 610, 1108, 643, 570, 643], '#312b27');
  line(c, [603, 610, 1058, 610], '#6b462d', 5);
  for (let i = 0; i < 5; i++) {
    const x = 633 + i * 91;
    polygon(c, [x, 646, x + 49, 646, x + 41, 707, x + 7, 707], '#2b2926');
    wheel(c, x + 24, 652, 17, m * 0.18, '#504031', '#232323');
  }
  pipe(c, [21, 250, 135, 250, 200, 341, 244, 341], 31);
  wheel(c, 130, 250, 39, m * 0.08, '#53412f', '#262424');
  lamp(c, 750, 273, f.power, true);
  lamp(c, 1781, 268, f.power, true);
}
function rollingTrench(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  doorway(c, 887, 232, 820, 407, f.reveal, f.power, m, true);
  furnace(c, 280, 409, 0.91, f.power, m);
  // A great flywheel and its shaft drive the same roller line below the ladle.
  wheel(c, 562, 472, 124, m * 0.065, '#493b30', '#262624');
  wheel(c, 562, 472, 68, -m * 0.1, '#614a35', '#302923');
  line(c, [560, 472, 781, 472, 851, 579, 1860, 579], '#3d322b', 19);
  line(c, [579, 475, 797, 475, 858, 575], '#5b4431', 3);
  truss(c, 602, 153, 1320, 49, 10, '#292724', '#493b30');
  const liftX = 1040 + Math.sin(m * 0.04) * 181;
  for (const dx of [-42, 42]) line(c, [liftX + dx, 203, liftX + dx, 354], '#594332', 2);
  ladle(c, liftX, 391, 0.94, Math.sin(m * 0.07) * 0.025, f.power);
  polygon(c, [772, 588, 1908, 588, 1939, 682, 749, 682], '#252625');
  for (let i = 0; i < 8; i++) {
    const x = 818 + i * 147;
    wheel(c, x, 601, 38, m * 0.19, '#4d3e31', '#2d2a26');
    c.fillStyle = '#3b3028';
    c.fillRect(x - 40, 635, 80, 17);
  }
  // Warm slab on the far line; no pulsing light or hazard-shaped outline.
  c.save();
  c.globalAlpha = 0.2 + 0.35 * unit(f.power);
  polygon(c, [831, 558, 1692, 558, 1741, 581, 804, 581], '#825332');
  c.restore();
  pipe(c, [53, 159, 660, 159, 739, 244, 739, 366], 36);
  for (const x of [127, 1650, 1880]) lamp(c, x, 219, f.power, true);
}

/** Three industrial silhouettes with connected charging, casting and rolling machinery. */
export function drawLivingFurnace(
  c: CanvasRenderingContext2D,
  frame: LivingFoundryFrame,
  camera: Vec,
  width: number,
  height: number,
  reduced: boolean,
) {
  c.save();
  c.beginPath();
  c.rect(0, 0, width, height);
  c.clip();
  sky(c, width, height, '#17171a', '#2d241e');
  const m = reduced ? 0 : frame.motion,
    power = unit(frame.power);
  layer(c, camera, 0.075, () => {
    // Roof vents and smoke ducts recede behind the large authored machines.
    for (const [x, w, h] of [
      [-30, 205, 390],
      [359, 129, 475],
      [1060, 185, 360],
      [1810, 148, 452],
      [2280, 175, 330],
    ]) {
      polygon(
        c,
        [x, 700, x, 700 - h, x + 24, 670 - h, x + w - 22, 670 - h, x + w, 700 - h, x + w, 700],
        '#252221',
      );
      c.fillStyle = '#302824';
      c.fillRect(x + 17, 687 - h, w - 34, 11);
    }
    line(c, [-30, 374, 305, 374, 401, 458, 1010, 458, 1100, 362, 2400, 362], '#302823', 22);
    glow(c, 765, 490, 590, [151, 90, 49], 0.06 * power);
  });
  layer(c, camera, 0.19, () => {
    c.save();
    if (frame.mirrored) {
      c.translate(2000, 0);
      c.scale(-1, 1);
    }
    ceiling(c, power, frame.variant);
    if (frame.variant === 0) blastTower(c, frame, m);
    else if (frame.variant === 1) castingCathedral(c, frame, m);
    else rollingTrench(c, frame, m);
    // Small access stairs and valves establish the scale of the immense vessels.
    line(c, [24, 704, 24, 532, 97, 532], '#3f352d', 4);
    for (let i = 0; i < 6; i++) line(c, [24, 550 + i * 25, 60, 550 + i * 25], '#44392f', 3);
    pipe(c, [-10, 728, 2000, 728], 18);
    wheel(c, 84, 691, 17, m * 0.025, '#58422e', '#272526');
    const wet = unit(frame.coolant);
    if (wet > 0) {
      c.save();
      c.globalAlpha = wet * 0.45;
      line(c, [154, 715, 154, 626, 187, 626], '#4b615a', 5);
      c.restore();
    }
    c.restore();
  });
  const haze = c.createLinearGradient(0, Math.max(0, height * 0.38), 0, height);
  haze.addColorStop(0, '#211b1800');
  haze.addColorStop(1, '#18171980');
  c.fillStyle = haze;
  c.fillRect(0, 0, width, height);
  c.restore();
}
