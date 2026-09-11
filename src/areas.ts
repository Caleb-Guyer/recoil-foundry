import type { Vec } from './rules.ts';

export type AreaId = 'docks' | 'furnace' | 'cooling' | 'reclamation' | 'rooftops';

export const AREAS = {
  docks: {
    name: 'Loading docks',
    sky: ['#101a21', '#1c2b33'],
    surface: '#82989c',
    body: '#2a3941',
    face: '#233139',
    edge: '#455b63',
    detail: '#33464f',
  },
  furnace: {
    name: 'Furnace halls',
    sky: ['#191719', '#2b211c'],
    surface: '#a49780',
    body: '#3b332d',
    face: '#2c2927',
    edge: '#5e5144',
    detail: '#433a31',
  },
  cooling: {
    name: 'Cooling Works',
    sky: ['#0b1d22', '#1e383b'],
    surface: '#94babb',
    body: '#294448',
    face: '#1f363b',
    edge: '#45696b',
    detail: '#315356',
  },
  reclamation: {
    name: 'Reclamation Works',
    sky: ['#141e19', '#2b3c2e'],
    surface: '#a6b49a',
    body: '#38483c',
    face: '#28382e',
    edge: '#5e715b',
    detail: '#405441',
  },
  rooftops: {
    name: 'Rooftops',
    sky: ['#111e2c', '#3d505a'],
    surface: '#a0b1b5',
    body: '#303e48',
    face: '#24313b',
    edge: '#526571',
    detail: '#394953',
  },
} satisfies Record<
  AreaId,
  {
    name: string;
    sky: [string, string];
    surface: string;
    body: string;
    face: string;
    edge: string;
    detail: string;
  }
>;

// Scenery stays behind the world, without the bright top edges of solid cover.
// Fixed geometry and shallow parallax keep movement cues calm during recoil.
export function drawScenery(
  c: CanvasRenderingContext2D,
  area: AreaId,
  camera: Vec,
  width: number,
  height: number,
) {
  const palette = AREAS[area];
  const sky = c.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  c.fillStyle = sky;
  c.fillRect(0, 0, width, height);
  c.save();
  if (area === 'docks') {
    c.translate(-camera.x * 0.22, -camera.y * 0.16);
    for (let i = 0; i < 6; i++) {
      const x = 75 + i * 475;
      c.fillStyle = '#203139';
      c.fillRect(x, 190, 330, 570);
      c.fillStyle = '#14232b';
      c.fillRect(x + 13, 207, 304, 553);
      c.strokeStyle = '#1d3039';
      c.lineWidth = 2;
      c.beginPath();
      for (let y = 244; y < 740; y += 57) {
        c.moveTo(x + 16, y);
        c.lineTo(x + 314, y);
      }
      c.stroke();
      const glow = c.createRadialGradient(x + 165, 177, 2, x + 165, 240, 240);
      glow.addColorStop(0, '#9bc9d110');
      glow.addColorStop(1, '#9bc9d100');
      c.fillStyle = glow;
      c.fillRect(x - 75, 0, 480, 485);
      c.fillStyle = '#48616b';
      c.fillRect(x + 139, 175, 52, 3);
    }
    c.fillStyle = '#1e2d34';
    c.fillRect(0, 95, width + camera.x + 100, 19);
    c.fillStyle = '#101d25';
    c.fillRect(0, 113, width + camera.x + 100, 5);
    // A suspended lifting frame, well above the playable route.
    c.fillRect(1000, 114, 5, 135);
    c.fillRect(1140, 114, 5, 135);
    c.fillRect(974, 246, 198, 12);
  } else if (area === 'furnace') {
    c.translate(-camera.x * 0.2, -camera.y * 0.16);
    c.strokeStyle = '#302724';
    c.lineWidth = 26;
    c.beginPath();
    c.moveTo(-100, 145);
    c.lineTo(475, 145);
    c.lineTo(475, 320);
    c.lineTo(width + camera.x + 100, 320);
    c.stroke();
    for (let i = 0; i < 5; i++) {
      const x = 125 + i * 560;
      const glow = c.createRadialGradient(x + 130, 520, 5, x + 130, 520, 310);
      glow.addColorStop(0, '#df854515');
      glow.addColorStop(1, '#df854500');
      c.fillStyle = glow;
      c.fillRect(x - 180, 210, 620, 620);
      c.fillStyle = '#302723';
      c.fillRect(x + 78, 0, 104, 200);
      c.beginPath();
      c.moveTo(x, 270);
      c.lineTo(x + 48, 202);
      c.lineTo(x + 212, 202);
      c.lineTo(x + 260, 270);
      c.lineTo(x + 260, 790);
      c.lineTo(x, 790);
      c.closePath();
      c.fill();
      c.fillStyle = '#211e1e';
      c.fillRect(x + 16, 279, 228, 490);
      c.fillStyle = '#3b2f27';
      c.fillRect(x - 6, 348, 272, 13);
      c.fillRect(x - 6, 651, 272, 13);
      c.fillStyle = '#65422b';
      for (let slot = 0; slot < 5; slot++) c.fillRect(x + 82 + slot * 20, 486, 5, 71);
      c.fillStyle = '#392c25';
      c.fillRect(x + 55, 480, 150, 5);
      c.fillRect(x + 55, 558, 150, 5);
    }
  } else if (area === 'reclamation') {
    c.translate(-camera.x * 0.18, -camera.y * 0.14);
    for (let i = 0; i < 7; i++) {
      const x = 55 + i * 390;
      c.fillStyle = '#24342a';
      c.fillRect(x, 150, 22, 620);
      c.fillRect(x, 150, 360, 15);
      c.strokeStyle = '#354738';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 20, 175);
      c.lineTo(x + 175, 320);
      c.lineTo(x + 335, 175);
      c.stroke();
      c.fillStyle = '#203027';
      for (let j = 0; j < 4; j++) c.fillRect(x + 50 + j * 63, 600 - (j % 2) * 33, 58, 150);
      c.fillStyle = '#6f795531';
      c.fillRect(x + 144, 168, 56, 3);
    }
  } else if (area === 'cooling') {
    c.translate(-camera.x * 0.18, -camera.y * 0.14);
    for (let i = 0; i < 6; i++) {
      const x = 80 + i * 440;
      c.fillStyle = '#163035';
      c.fillRect(x, 170, 270, 610);
      c.fillStyle = '#1e3b3e';
      c.fillRect(x + 14, 182, 242, 574);
      c.fillStyle = '#142c31';
      c.fillRect(x + 28, 225, 214, 486);
      c.fillStyle = '#294c4e';
      c.fillRect(x + 36, 564, 198, 142);
      c.fillStyle = '#426c69';
      c.fillRect(x + 36, 562, 198, 2);
      c.strokeStyle = '#254448';
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(x + 48, 0);
      c.lineTo(x + 48, 137);
      c.lineTo(x + 280, 137);
      c.stroke();
      c.fillStyle = '#345658';
      c.fillRect(x + 11, 320, 248, 8);
      c.fillRect(x + 11, 700, 248, 8);
    }
  } else {
    // The horizon and distant roofs stay below the open upper half of the sky.
    const horizon = 525 - camera.y * 0.08;
    const haze = c.createLinearGradient(0, horizon - 180, 0, horizon + 210);
    haze.addColorStop(0, '#ac998000');
    haze.addColorStop(0.6, '#ac998018');
    haze.addColorStop(1, '#ac998000');
    c.fillStyle = haze;
    c.fillRect(0, horizon - 180, width, 390);
    for (let layer = 0; layer < 2; layer++) {
      const spacing = layer === 0 ? 126 : 220;
      c.fillStyle = layer === 0 ? '#30424d' : '#253640';
      for (let i = -1; i < Math.ceil(width / spacing) + 4; i++) {
        const x = i * spacing - camera.x * (layer === 0 ? 0.07 : 0.14);
        const h = 45 + ((i * i * 37 + layer * 61) % 135);
        const y = horizon + layer * 82 - h;
        c.fillRect(x, y, spacing - 14, height - y);
        if (i % 3 === 0) {
          c.fillRect(x + 18, y - 16, 38, 16);
          c.fillRect(x + 33, y - 52, 2, 38);
        }
      }
    }
  }
  c.restore();
}

export function drawSurfaceDetails(
  c: CanvasRenderingContext2D,
  area: AreaId,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const palette = AREAS[area];
  c.fillStyle = palette.detail;
  if (h < 30) {
    if (area === 'rooftops') {
      // Small gussets give the bridges a steel profile without adding collision.
      for (const bx of [x + 12, x + w - 31]) {
        c.beginPath();
        c.moveTo(bx, y + h);
        c.lineTo(bx + 19, y + h);
        c.lineTo(bx + 19, y + h + 13);
        c.closePath();
        c.fill();
      }
    } else {
      c.fillRect(x + 12, y + h, 4, 9);
      c.fillRect(x + w - 16, y + h, 4, 9);
    }
    return;
  }
  if (y >= 740) {
    for (let bx = x + 120; bx < x + w; bx += 240) c.fillRect(bx, y + 8, 1, 25);
  } else if (area === 'docks') {
    c.fillRect(x + 10, y + 10, 4, h - 20);
    c.fillRect(x + w - 14, y + 10, 4, h - 20);
    c.fillRect(x + 14, y + h - 14, w - 28, 4);
  } else if (area === 'furnace') {
    c.fillRect(x + 9, y + 12, w - 18, 3);
    c.fillRect(x + 9, y + h - 15, w - 18, 3);
    if (w > 105 && h > 65) {
      for (let i = 0; i < 4; i++) c.fillRect(x + w / 2 - 21 + i * 12, y + 30, 4, 20);
    }
  } else {
    c.fillRect(x + 7, y + 8, w - 14, 3);
    c.fillRect(x + 12, y + 16, 2, h - 28);
    c.fillRect(x + w - 14, y + 16, 2, h - 28);
  }
}
