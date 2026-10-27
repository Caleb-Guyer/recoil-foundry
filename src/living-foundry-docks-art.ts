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

// Distant steel deliberately has no pale walkable top edges or danger colors.
const STEEL = '#21353e',
  DARK = '#10242d',
  EDGE = '#344c54',
  FACE = '#1a2e37';
function cargo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone = 0) {
  polygon(
    c,
    [x, y + 10, x + 12, y, x + w, y, x + w, y + h, x, y + h],
    tone ? '#243941' : '#293d44',
  );
  polygon(c, [x, y + 10, x + 12, y, x + 12, y + h - 6, x, y + h], tone ? '#1a2e36' : '#1f333b');
  c.fillStyle = '#1b2e36';
  c.fillRect(x + 18, y + 8, w - 27, 4);
  c.fillRect(x + 18, y + h - 11, w - 27, 4);
  const ribs = Math.min(7, Math.max(2, Math.floor(w / 32)));
  for (let i = 0; i < ribs; i++) c.fillRect(x + 22 + (i * (w - 40)) / ribs, y + 17, 3, h - 35);
  line(c, [x + w * 0.7, y + 9, x + w * 0.7, y + h - 12], EDGE, 2);
  c.fillStyle = '#50605b';
  c.fillRect(x + w * 0.7 - 5, y + h * 0.5, 3, 7);
}
function pylon(c: CanvasRenderingContext2D, x: number, y: number, h: number, lean = 0) {
  polygon(c, [x, y, x + 30, y, x + 30 + lean, y + h, x - 8 + lean, y + h], STEEL);
  line(c, [x + 5, y + 12, x + 13 + lean, y + h - 8], EDGE, 3);
  polygon(
    c,
    [
      x - 25 + lean,
      y + h,
      x + 52 + lean,
      y + h,
      x + 62 + lean,
      y + h + 15,
      x - 36 + lean,
      y + h + 15,
    ],
    FACE,
  );
  for (let i = 0; i < 4; i++)
    line(
      c,
      [x + 30 + (i * lean) / 4, y + (i * h) / 4, x + (lean * i) / 4, y + ((i + 1) * h) / 4],
      EDGE,
      2,
    );
}
function boat(c: CanvasRenderingContext2D, x: number, y: number, scale: number, working: boolean) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  polygon(c, [-410, 12, -305, 82, 280, 82, 420, -28, 190, -12, -235, -12], '#152b34');
  polygon(c, [-405, 12, -310, 39, 302, 39, 420, -28, 396, -4, 281, 72, -300, 72], '#243e46');
  line(c, [-390, 10, 320, 10, 400, -22], '#3d575b', 3);
  c.fillStyle = '#1b333b';
  c.fillRect(135, -115, 115, 105);
  polygon(c, [122, -116, 265, -116, 249, -137, 145, -137], '#304850');
  c.fillStyle = '#45605f';
  c.fillRect(147, -106, 24, 16);
  c.fillRect(178, -106, 24, 16);
  c.fillRect(209, -106, 24, 16);
  line(c, [205, -140, 205, -204, 245, -204], '#344d54', 5);
  for (let i = 0; i < 3; i++) cargo(c, -236 + i * 114, -62, 104, 50, i % 2);
  if (working) {
    c.fillStyle = '#5c6c60';
    c.fillRect(245, -37, 6, 3);
  }
  c.restore();
}
/** A real loading-bay shutter: the opening exposes far scenery, never the playfield. */
function bay(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  reveal: number,
  power: number,
  variant: number,
) {
  c.fillStyle = '#152b34';
  c.fillRect(x - 12, y - 15, w + 24, h + 25);
  c.fillStyle = '#0c202a';
  c.fillRect(x, y, w, h);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  const haze = c.createLinearGradient(0, y, 0, y + h);
  haze.addColorStop(0, '#182f39');
  haze.addColorStop(1, '#37505a');
  c.fillStyle = haze;
  c.fillRect(x, y, w, h);
  for (let i = 0; i < 3; i++) {
    const cx = x + 65 + i * 180;
    line(c, [cx, y + h - 95, cx, y + 80, cx + 125, y + 42, cx + 175, y + 80], '#233e48', 6);
    line(c, [cx + 119, y + 43, cx + 119, y + 190], '#294650', 2);
  }
  line(c, [x, y + h - 66, x + w, y + h - 66], '#3a545c', 2);
  boat(c, x + w * 0.48, y + h - 83, variant === 1 ? 0.75 : 0.55, power > 0.2);
  const amount = unit(reveal),
    shutter = h * (1 - amount);
  c.fillStyle = '#172a33';
  c.fillRect(x, y, w, shutter);
  c.strokeStyle = '#263d46';
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const yy = y + shutter - 10 - i * 40;
    if (yy > y) {
      c.moveTo(x + 5, yy);
      c.lineTo(x + w - 5, yy);
    }
  }
  c.stroke();
  c.fillStyle = '#344950';
  c.fillRect(x, y + shutter - 5, w, 5);
  c.restore();
  line(c, [x - 7, y + h, x - 7, y - 7, x + w + 7, y - 7, x + w + 7, y + h], '#304750', 9);
  lamp(c, x + w * 0.5, y - 11, power);
}
function trolley(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  drop: number,
  motion: number,
  power: number,
  small = false,
) {
  const w = small ? 92 : 142;
  c.fillStyle = '#30434a';
  c.fillRect(x - w / 2, y, w, 27);
  for (const dx of [-w * 0.33, w * 0.33])
    wheel(c, x + dx, y + 6, 9, motion * 0.23, '#45585b', '#162a33');
  const spread = small ? 34 : 49;
  for (const dx of [-spread, spread]) line(c, [x + dx, y + 28, x + dx, y + drop], '#4a5c5d', 2);
  c.fillStyle = '#344a50';
  c.fillRect(x - spread - 17, y + drop, spread * 2 + 34, 12);
  cargo(c, x - spread - 10, y + drop + 13, spread * 2 + 20, small ? 67 : 88, 1);
  lamp(c, x, y + 29, power);
}
function transfer(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  bay(c, 1000, 225, 600, 420, f.reveal, f.power, 0);
  // One continuous transfer bridge, with its trolley mounted on the same rail.
  pylon(c, 118, 145, 550, 35);
  pylon(c, 1820, 145, 550, -35);
  truss(c, 105, 138, 1765, 71, 11, '#1a2c35', '#344a52');
  line(c, [104, 218, 1878, 218], '#42565a', 5);
  const travel = 620 + Math.sin(m * 0.065) * 245;
  trolley(c, travel, 207, 213 + Math.sin(m * 0.08) * 31, m, f.power);
  line(c, [140, 145, 410, 25, 1540, 25, 1835, 145], '#233942', 15);
  line(c, [151, 147, 415, 34, 1538, 34, 1824, 147], '#38505a', 2);
  c.fillStyle = '#1c313a';
  c.fillRect(52, 420, 187, 205);
  polygon(c, [40, 420, 247, 420, 222, 372, 70, 372], '#293f47');
  c.fillStyle = '#3b5458';
  c.fillRect(72, 391, 45, 18);
  c.fillRect(125, 391, 45, 18);
  c.fillRect(178, 391, 34, 18);
  line(c, [185, 373, 185, 299, 140, 299], '#314a52', 5);
  line(c, [53, 628, 252, 628], '#334950', 5);
  cargo(c, 327, 570, 195, 111, 1);
  cargo(c, 540, 619, 172, 75);
  cargo(c, 1690, 600, 210, 105, 1);
  for (const x of [250, 900, 1650]) lamp(c, x, 233, f.power);
}
function drydock(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  bay(c, 1120, 155, 720, 485, f.reveal, f.power, 1);
  // Tall articulated dock crane gives this room an asymmetric skyline.
  pylon(c, 215, 115, 582, 25);
  polygon(c, [209, 135, 337, 44, 1030, 118, 1018, 153, 349, 94, 246, 176], '#263c45');
  line(c, [240, 128, 344, 64, 1016, 130], '#3b5159', 4);
  for (let i = 0; i < 7; i++)
    line(c, [357 + i * 90, 74 + i * 9, 381 + i * 90, 113 + i * 8], '#1a303a', 9);
  const cx = 745 + Math.sin(m * 0.05) * 145;
  line(c, [cx, 141, cx, 337 + Math.sin(m * 0.11) * 24], '#40565c', 3);
  line(c, [cx + 26, 144, cx + 26, 337 + Math.sin(m * 0.11) * 24], '#40565c', 3);
  wheel(c, 270, 188, 45, m * 0.09, '#3b5259', '#142a33');
  const boatX = 615;
  c.save();
  c.translate(boatX, 539);
  polygon(c, [-330, 0, -266, 133, 241, 133, 394, -22, 280, -7], '#273e47');
  polygon(c, [-315, 18, -256, 105, 247, 105, 356, -3], '#1b333e');
  line(c, [-297, 28, 286, 28, 365, -9], '#3c535b', 3);
  c.fillStyle = '#314851';
  c.fillRect(-120, -127, 228, 128);
  polygon(c, [-146, -128, 123, -128, 97, -162, -111, -162], '#243b45');
  c.fillStyle = '#435c60';
  c.fillRect(-98, -115, 54, 25);
  c.fillRect(-28, -115, 54, 25);
  c.fillRect(42, -115, 44, 25);
  line(c, [76, -163, 76, -242, 126, -242], '#37505a', 5);
  line(c, [-265, 139, -210, 176, -145, 176], '#314952', 12);
  line(c, [150, 139, 202, 176, 264, 176], '#314952', 12);
  c.restore();
  trolley(c, 1510, 169, 80 + Math.sin(m * 0.09) * 15, m, f.power, true);
  cargo(c, 34, 630, 130, 75, 1);
  cargo(c, 1750, 631, 200, 83);
  lamp(c, 206, 147, f.power);
  lamp(c, 980, 169, f.power);
}
function elevator(c: CanvasRenderingContext2D, f: LivingFoundryFrame, m: number) {
  bay(c, 600, 172, 770, 490, f.reveal, f.power, 2);
  for (const x of [290, 1430]) {
    pylon(c, x, 54, 660, x < 800 ? 18 : -18);
    line(c, [x + 51, 84, x + 51, 685], '#2b444e', 10);
    line(c, [x + 75, 84, x + 75, 685], '#3a5159', 3);
    wheel(c, x + 61, 121, 43, m * (x < 800 ? 0.09 : -0.09), '#3c545a', '#172d37');
    line(c, [x + 29, 120, x + 29, 515, x + 89, 515, x + 89, 120], '#42565a', 2);
    c.fillStyle = '#273f48';
    c.fillRect(x + 9, 480, 41, 126);
    for (let i = 0; i < 4; i++) {
      c.fillStyle = '#334b51';
      c.fillRect(x + 7, 489 + i * 27, 45, 4);
    }
  }
  truss(c, 245, 45, 1330, 74, 9, '#1d323c', '#364e57');
  const lift = 353 + Math.sin(m * 0.06) * 74;
  for (const x of [472, 1258]) line(c, [x, 117, x, lift], '#3e555c', 3);
  truss(c, 437, lift, 860, 34, 9, '#213a44', '#40565d');
  cargo(c, 515, lift - 108, 215, 104);
  cargo(c, 744, lift - 82, 188, 78, 1);
  cargo(c, 951, lift - 115, 240, 111, 1);
  // A small operator bridge anchors the huge lift to an understandable scale.
  line(c, [25, 359, 282, 359, 325, 401], '#29424c', 12);
  line(c, [24, 322, 282, 322, 325, 364], '#3b5359', 3);
  for (let i = 0; i < 5; i++) line(c, [35 + i * 52, 322, 35 + i * 52, 357], '#344d56', 2);
  c.fillStyle = '#263c44';
  c.fillRect(39, 225, 176, 96);
  polygon(c, [24, 226, 231, 226, 210, 201, 42, 201], '#314750');
  c.fillStyle = '#3f5a5e';
  c.fillRect(58, 244, 48, 28);
  c.fillRect(115, 244, 48, 28);
  c.fillRect(172, 244, 25, 28);
  cargo(c, 1570, 604, 205, 96, 1);
  cargo(c, 1792, 637, 178, 65);
  lamp(c, 472, 138, f.power);
  lamp(c, 1258, 138, f.power);
  lamp(c, 146, 324, f.power);
}

/** Three authored loading-dock compositions, with only local far-depth reveals. */
export function drawLivingDocks(
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
  sky(c, width, height, '#0b1821', '#1d323c');
  const m = reduced ? 0 : frame.motion,
    power = unit(frame.power);
  // A hazy exterior and structural roof remain legible before any opening moves.
  layer(c, camera, 0.085, () => {
    polygon(
      c,
      [
        -100, 414, 155, 363, 310, 380, 510, 301, 752, 333, 1000, 248, 1280, 289, 1520, 219, 1815,
        284, 2500, 255, 2500, 850, -100, 850,
      ],
      '#152a34',
    );
    for (const [x, y, h] of [
      [105, 255, 335],
      [805, 176, 440],
      [1580, 169, 475],
      [2110, 221, 430],
    ]) {
      c.fillStyle = '#203740';
      c.fillRect(x, y, 54, h);
      polygon(c, [x - 22, y + 25, x + 77, y + 25, x + 64, y - 9, x - 8, y - 9], '#263d45');
      line(c, [x + 27, y - 9, x + 27, y - 70], '#2c454e', 3);
    }
    glow(c, 950, 395, 600, [92, 126, 139], 0.065 * power);
  });
  layer(c, camera, 0.19, () => {
    c.save();
    if (frame.mirrored) {
      c.translate(2000, 0);
      c.scale(-1, 1);
    }
    const extent = Math.max(2400, width + camera.x * 0.19 + 150);
    c.fillStyle = '#142832';
    c.fillRect(-50, 9, extent, 42);
    line(c, [-50, 60, extent, 60], '#273e48', 5);
    line(c, [-50, 734, extent, 734], '#203942', 12);
    if (frame.variant === 0) transfer(c, frame, m);
    else if (frame.variant === 1) drydock(c, frame, m);
    else elevator(c, frame, m);
    // The power bus and its isolators connect the lights to the building.
    line(c, [0, 75, 1960, 75, 1960, 536], '#29434c', 7);
    for (const x of [75, 700, 1310, 1920]) {
      c.fillStyle = '#344950';
      c.fillRect(x, 66, 14, 20);
      lamp(c, x + 7, 90, power);
    }
    // A hanging signal vane responds only to the accumulated motor clock.
    const vane = reduced ? 0 : Math.sin(m * 0.2) * 0.07;
    c.save();
    c.translate(80, 77);
    c.rotate(vane);
    line(c, [0, 0, 0, 97], '#314b55', 2);
    polygon(c, [-21, 96, 20, 96, 11, 139, -13, 139], '#344950');
    c.restore();
    c.restore();
  });
  // A quiet floor haze makes the deep cargo read as scenery behind playable cover.
  const fog = c.createLinearGradient(0, height * 0.55, 0, height);
  fog.addColorStop(0, '#10232a00');
  fog.addColorStop(1, '#0c1e2770');
  c.fillStyle = fog;
  c.fillRect(0, 0, width, height);
  c.restore();
}
