import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { ToolTrial } from '../src/tool-trial.ts';
import { Renderer } from '../src/render.ts';
import { drawWeapon } from '../src/weapon-art.ts';
import { STARTING_GUNS } from '../src/starting-guns.ts';
import { drawExperimentalWeaponHud } from '../src/experimental-weapons-art.ts';

const require = createRequire(
  process.env.RF_CANVAS_PACKAGE ?? new URL('../.media-tools/canvas/package.json', import.meta.url),
);
const { createCanvas } = require('@napi-rs/canvas');
Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
Object.defineProperty(globalThis, 'OffscreenCanvas', {
  value: function (w: number, h: number) {
    return createCanvas(w, h);
  },
  configurable: true,
});
const sheet = createCanvas(1440, 1280),
  c = sheet.getContext('2d');
c.fillStyle = '#10191e';
c.fillRect(0, 0, 1440, 1280);
const reports: Record<string, unknown>[] = [];
for (const [row, gun] of (['bellows', 'debt-collector', 'switchjack'] as const).entries()) {
  const trial = new ToolTrial(gun),
    g = trial.game;
  const input = {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: true,
    aim: { x: 750, y: 700 },
  };
  g.engine.gravity.y = 0;
  Matter.Body.setPosition(g.player, { x: 190, y: 660 });
  const seconds = gun === 'bellows' ? 0.56 : gun === 'debt-collector' ? 0.43 : 0.28;
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) trial.tick(1 / 60, input);
  // The beacon is launched by the first held frame; no second press is supplied.
  if (gun === 'switchjack' && !g.experimentalWeapons.bolt) throw Error('No live Switchjack bolt');
  const canvas = createCanvas(920, 300);
  canvas.getBoundingClientRect = () => ({ width: 920, height: 300 });
  const renderer = new Renderer(canvas, g);
  renderer.reduced = false;
  renderer.draw(g.time * 1000, {
    camera: { x: 0, y: 450 },
    scale: 1,
    player: true,
    navigation: false,
  });
  const y = row * 360;
  c.fillStyle = '#e2e4d5';
  c.font = 'bold 21px Arial';
  c.fillText(STARTING_GUNS[gun].name, 18, y + 31);
  c.fillStyle = '#a8bdb7';
  c.font = '13px Arial';
  c.fillText('Production renderer · actual native input/state', 18, y + 51);
  c.drawImage(canvas, 0, y + 60);
  c.fillStyle = '#15242a';
  c.fillRect(932, y + 60, 496, 288);
  for (let column = 0; column < 2; column++) {
    c.fillStyle = '#a8bdb7';
    c.font = '12px Arial';
    c.fillText(column ? 'Reduced motion' : 'Native mechanism', 950 + column * 238, y + 85);
    c.save();
    c.translate(964 + column * 238, y + 170);
    c.scale(3.7, 3.7);
    drawWeapon(c, g, !!column);
    c.restore();
  }
  c.save();
  c.translate(948, y + 215);
  drawExperimentalWeaponHud(c, g, 460, 120);
  c.restore();
  reports.push({
    gun,
    time: g.time,
    pressure: g.experimentalWeapons.pressure,
    debt: g.experimentalWeapons.debt,
    scrap: g.experimentalWeapons.scrapCount,
    bolt: g.experimentalWeapons.bolt?.id ?? null,
    shotCount: g.shotCount,
  });
  trial.dispose();
}
// Small production HUD captures use real input transitions and live room geometry.
for (const [column, gun] of (['bellows', 'debt-collector', 'switchjack'] as const).entries()) {
  const trial = new ToolTrial(gun),
    g = trial.game,
    input = {
      left: false,
      right: false,
      jump: false,
      jumpHeld: false,
      fire: true,
      aim: { x: 750, y: 660 },
    },
    x = 12 + column * 480;
  g.engine.gravity.y = 0;
  Matter.Body.setPosition(g.player, { x: 190, y: 660 });
  const advance = (frames: number) => {
    for (let i = 0; i < frames; i++) trial.tick(1 / 60, input);
  };
  const capture = (label: string, row: number) => {
    const y = 1100 + row * 84;
    c.fillStyle = '#a8bdb7';
    c.font = '12px Arial';
    c.fillText(label + ' · 320px viewport', x + 12, y);
    c.save();
    c.translate(x, y - 44);
    drawExperimentalWeaponHud(c, g, 320, 120);
    c.restore();
    reports.push({
      gun,
      state: label,
      time: g.time,
      pressure: g.experimentalWeapons.pressure,
      debt: g.experimentalWeapons.debt,
      preview: g.experimentalWeapons.landingPreview,
      nextLaunch: Math.max(0, g.shootAt - g.time),
    });
  };
  if (gun === 'bellows') {
    advance(46);
    capture('Bellows: fully charged', 0);
    input.fire = false;
    advance(1);
    input.fire = true;
    advance(7);
    capture('Bellows: charging during recovery', 1);
  } else if (gun === 'debt-collector') {
    capture('Debt: empty chamber', 0);
    for (let i = 0; i < 150 && g.experimentalWeapons.debt < 0.8; i++) advance(1);
    if (g.experimentalWeapons.debt < 0.8) throw Error('No high-debt snapshot');
    capture('Debt: near automatic vent', 1);
  } else {
    advance(17);
    const preview = g.experimentalWeapons.landingPreview;
    if (!preview?.ready) throw Error('No clear Switchjack snapshot');
    capture('Switchjack: clear, release before tap', 0);
    const wall = Matter.Bodies.rectangle((preview.from.x + preview.to.x) / 2, 660, 20, 100, {
      isStatic: true,
      label: 'terrain',
    });
    g.terrain.push(wall);
    Matter.Composite.add(g.engine.world, wall);
    if (g.experimentalWeapons.landingPreview?.ready) throw Error('No blocked Switchjack snapshot');
    capture('Switchjack: blocked before any tap', 1);
  }
  trial.dispose();
}
writeFileSync(
  process.argv[2] ?? 'experimental-weapons-visual-review.png',
  sheet.toBuffer('image/png'),
);
writeFileSync(
  process.argv[3] ?? 'experimental-weapons-visual-review.json',
  JSON.stringify(
    {
      renderer:
        'Production Renderer and drawWeapon, current actual native input snapshots; no installed dependencies',
      reports,
    },
    null,
    2,
  ),
);
