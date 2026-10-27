import type { Vec } from './rules.ts';
import type { LivingFoundryFrame } from './living-foundry-types.ts';
const bound = (n: number) => Math.max(0, Math.min(1, n));
function line(c: CanvasRenderingContext2D, p: number[], color: string, w = 1) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.beginPath();
  for (let i = 0; i < p.length; i += 2) i ? c.lineTo(p[i], p[i + 1]) : c.moveTo(p[i], p[i + 1]);
  c.stroke();
}
function shape(c: CanvasRenderingContext2D, p: number[], color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < p.length; i += 2) i ? c.lineTo(p[i], p[i + 1]) : c.moveTo(p[i], p[i + 1]);
  c.closePath();
  c.fill();
}
function layer(
  c: CanvasRenderingContext2D,
  f: LivingFoundryFrame,
  camera: Vec,
  width: number,
  depth: number,
) {
  c.save();
  if (f.mirrored) {
    c.translate(width, 0);
    c.scale(-1, 1);
  }
  c.translate((f.mirrored ? camera.x : -camera.x) * depth, -camera.y * depth * 0.65);
}
function turbine(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  power: number,
) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#1e303e';
  c.strokeStyle = '#405360';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.rotate(phase);
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    shape(c, [7, -7, r * 0.65, -r * 0.36, r * 0.82, -r * 0.1, r * 0.34, 8, 5, 9], '#374e59');
  }
  c.fillStyle = power > 0.1 ? '#70857e' : '#44565f';
  c.beginPath();
  c.arc(0, 0, 9, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
function beacon(c: CanvasRenderingContext2D, x: number, y: number, power: number) {
  line(c, [x, y + 42, x, y], '#415361', 2);
  c.fillStyle = power > 0.1 ? '#9b8970' : '#49575f';
  c.fillRect(x - 3, y - 3, 6, 5);
  if (power > 0.1) {
    c.fillStyle = '#9b89700e';
    c.beginPath();
    c.arc(x, y, 13, 0, Math.PI * 2);
    c.fill();
  }
}
/** An open observation hangar frames the skyline behind sliding steel doors. */
function observationGate(
  c: CanvasRenderingContext2D,
  center: number,
  reveal: number,
  power: number,
) {
  const left = center - 328,
    top = 154,
    width = 656,
    height = 382,
    leaf = 200;
  const travel = bound(reveal) * (leaf + 16);
  shape(
    c,
    [
      left - 30,
      top + height + 10,
      left - 30,
      top + 12,
      left + 9,
      top - 31,
      left + width - 9,
      top - 31,
      left + width + 30,
      top + 12,
      left + width + 30,
      top + height + 10,
      left + width + 15,
      top + height + 10,
      left + width + 15,
      top + 17,
      left + width - 2,
      top - 9,
      left + 2,
      top - 9,
      left - 15,
      top + 17,
      left - 15,
      top + height + 10,
    ],
    '#2a414e',
  );
  line(
    c,
    [
      left - 18,
      top + 1,
      left + 13,
      top - 25,
      left + width - 13,
      top - 25,
      left + width + 18,
      top + 1,
    ],
    '#455c66',
    5,
  );
  line(c, [left - 10, top + height + 9, left + width + 10, top + height + 9], '#354e5a', 8);
  c.save();
  c.beginPath();
  c.rect(left, top, width, height);
  c.clip();
  for (const side of [-1, 1]) {
    c.save();
    c.translate(side < 0 ? left - travel : left + width - leaf + travel, top);
    c.fillStyle = '#243b49';
    c.fillRect(0, 0, leaf, height);
    c.fillStyle = '#2c4552';
    c.fillRect(9, 9, leaf - 18, height - 18);
    for (let i = 0; i < 5; i++) line(c, [24 + i * 38, 16, 24 + i * 38, height - 16], '#354f5c', 6);
    line(c, [11, 70, leaf - 11, 70, leaf - 11, height - 70, 11, height - 70], '#415966', 3);
    const edge = side < 0 ? leaf - 10 : 10;
    line(c, [edge, 0, edge, height], '#536975', 3);
    line(c, [edge + side * 10, height * 0.46, edge + side * 10, height * 0.55], '#6b7a7a', 4);
    c.restore();
  }
  c.restore();
  for (const offset of [-width * 0.36, width * 0.36]) {
    c.fillStyle = '#2a404e';
    c.fillRect(center + offset - 20, top - 42, 40, 15);
    c.fillStyle = power > 0.1 ? '#9b8970' : '#49575f';
    c.fillRect(center + offset - 10, top - 33, 20, 3);
  }
}
/** The city remains scenery; no aircraft or finale actor is duplicated here. */
export function drawLivingRooftops(
  c: CanvasRenderingContext2D,
  frame: LivingFoundryFrame,
  camera: Vec,
  width: number,
  height: number,
  reduced: boolean,
) {
  const power = bound(frame.power),
    wind = bound(frame.wind);
  const t = reduced || wind <= 0.001 ? 0 : frame.motion,
    air = reduced ? 0 : frame.time;
  const horizon = Math.max(390, height * 0.61);
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#101d2e');
  sky.addColorStop(0.56, '#304652');
  sky.addColorStop(1, '#59615c');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  const haze = c.createLinearGradient(0, horizon - 135, 0, horizon + 150);
  haze.addColorStop(0, '#b7a48700');
  haze.addColorStop(0.65, '#b7a48718');
  haze.addColorStop(1, '#b7a48700');
  c.fillStyle = haze;
  c.fillRect(0, horizon - 135, width, 285);
  // Two long banks of high cloud move slowly, independently of powered machinery.
  const drift = Math.sin(air * 0.025) * (6 + Math.abs(wind) * 18);
  for (let i = 0; i < 2; i++) {
    const x = width * (0.15 + i * 0.55) + drift,
      y = 100 + i * 76;
    c.fillStyle = '#83939408';
    c.beginPath();
    c.moveTo(x - 260, y + 18);
    c.bezierCurveTo(x - 110, y - 26, x + 120, y - 20, x + 295, y + 22);
    c.bezierCurveTo(x + 110, y + 10, x - 70, y + 33, x - 260, y + 18);
    c.fill();
  }
  layer(c, frame, camera, width, 0.035);
  const skyline = [76, 122, 98, 170, 113, 202, 136, 88, 151, 104, 181, 96];
  for (let i = 0; i < skyline.length; i++) {
    const spacing = Math.max(143, (width + 180) / 11),
      x = -60 + i * spacing,
      h = skyline[i];
    c.fillStyle = '#2b414d';
    c.fillRect(x, horizon - h, spacing - 17, height + 150 - horizon + h);
    c.fillRect(x + 19, horizon - h - 11, 49, 11);
    if (i % 3 === 0) line(c, [x + 80, horizon - h, x + 80, horizon - h - 34], '#405361', 2);
    for (let row = 0; row < 3; row++) {
      c.fillStyle = power > 0.1 ? '#787b6526' : '#405461';
      c.fillRect(x + 17 + (row % 2) * 15, horizon - h + 22 + row * 29, 13, 3);
    }
  }
  c.restore();
  layer(c, frame, camera, width, 0.095);
  const center = width * 0.57 + 55,
    floor = Math.max(570, height * 0.88);
  if (frame.variant === 0) {
    // A civic-scale service tower, distinct from the finale's exposed city core.
    shape(
      c,
      [
        center - 117,
        floor,
        center - 117,
        277,
        center - 68,
        227,
        center - 68,
        171,
        center + 68,
        171,
        center + 68,
        227,
        center + 117,
        277,
        center + 117,
        floor,
      ],
      '#283e4b',
    );
    c.fillStyle = '#1c313f';
    c.fillRect(center - 65, 284, 130, floor - 284);
    line(c, [center - 121, 280, center + 121, 280], '#4a5a61', 6);
    for (const offset of [-90, 90])
      line(c, [center + offset, 304, center + offset, floor], '#405560', 5);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = power > 0.1 ? '#718077' : '#3d525c';
      c.fillRect(center - 26, 319 + i * 44, 52, 3);
    }
    turbine(c, center, 233, 37, -t * 0.28, power);
    beacon(c, center, 130, power);
    line(c, [center - 300, 370, center - 120, 370], '#314956', 23);
    line(c, [center + 120, 419, center + 400, 419], '#314956', 23);
  } else if (frame.variant === 1) {
    // Rooftop air handling: four real fan faces in one deep curved duct shell.
    shape(
      c,
      [
        center - 329,
        floor,
        center - 329,
        362,
        center - 285,
        310,
        center + 285,
        310,
        center + 329,
        362,
        center + 329,
        floor,
      ],
      '#2c4350',
    );
    line(
      c,
      [center - 319, 361, center - 281, 321, center + 281, 321, center + 319, 361],
      '#485c65',
      4,
    );
    for (let i = 0; i < 4; i++)
      turbine(c, center - 234 + i * 156, 413, 57, t * (i % 2 ? 0.32 : -0.32), power);
    for (const offset of [-275, 275]) {
      c.fillStyle = '#243b49';
      c.fillRect(center + offset - 21, 464, 42, floor - 464);
      beacon(c, center + offset, 279, power);
    }
    line(c, [center - 258, 505, center + 258, 505], '#3f5660', 4);
    c.fillStyle = '#263e4b';
    c.fillRect(center - 117, 252, 234, 58);
    for (let i = 0; i < 7; i++)
      line(c, [center - 98 + i * 32, 269, center - 98 + i * 32, 300], '#415560', 4);
  } else {
    // A long suspended service bridge crosses a deeper gap in the city.
    for (const offset of [-262, 262]) {
      c.fillStyle = '#283f4c';
      c.fillRect(center + offset - 55, 234, 110, floor - 234);
      c.fillStyle = '#354b55';
      c.fillRect(center + offset - 69, 229, 138, 18);
      beacon(c, center + offset, 176, power);
      for (let i = 0; i < 4; i++)
        line(
          c,
          [center + offset - 29, 289 + i * 62, center + offset + 29, 289 + i * 62],
          '#4a5a60',
          3,
        );
    }
    line(
      c,
      [
        center - 262,
        246,
        center - 262,
        265,
        center - 132,
        330,
        center,
        348,
        center + 132,
        330,
        center + 262,
        265,
        center + 262,
        246,
      ],
      '#50616a',
      3,
    );
    line(c, [center - 262, 407, center + 262, 407], '#344d59', 21);
    for (let i = 0; i < 7; i++) {
      const x = center - 230 + i * 77;
      line(c, [x, 285 + (1 - Math.abs(i - 3) / 3) * 61, x, 397], '#3e5661', 2);
    }
    turbine(c, center, 481, 55, t * 0.35, power);
    line(
      c,
      [center - 41, 537, center - 41, floor, center + 41, floor, center + 41, 537],
      '#304956',
      14,
    );
  }
  // A large observation opening preserves a central glimpse, then exposes the
  // skyline landmark through rigid doors sliding back into the side structure.
  observationGate(c, center, frame.reveal, power);
  c.restore();
  layer(c, frame, camera, width, 0.19);
  const ventX = width * 0.16;
  shape(
    c,
    [
      ventX - 68,
      floor + 44,
      ventX - 68,
      floor - 90,
      ventX - 44,
      floor - 113,
      ventX + 43,
      floor - 113,
      ventX + 68,
      floor - 90,
      ventX + 68,
      floor + 44,
    ],
    '#253c49',
  );
  for (let i = 0; i < 5; i++)
    line(c, [ventX - 43, floor - 81 + i * 15, ventX + 43, floor - 81 + i * 15], '#3a505b', 3);
  const flagX = width * 0.82,
    flutter = Math.sin(air * 2.2) * 3 * Math.abs(wind),
    direction = wind * (frame.mirrored ? -1 : 1);
  line(c, [flagX, floor, flagX, floor - 159], '#455b65', 2);
  shape(
    c,
    wind > 0.001
      ? [
          flagX,
          floor - 152,
          flagX + direction * 41,
          floor - 145 + flutter,
          flagX + direction * 24,
          floor - 137 - flutter,
          flagX,
          floor - 142,
        ]
      : [
          flagX,
          floor - 152,
          flagX + 5,
          floor - 123,
          flagX - 3,
          floor - 130,
          flagX - 2,
          floor - 143,
        ],
    '#5d6e6a',
  );
  c.restore();
}
