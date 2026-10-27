import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { drawOperator } from '../src/operator-art.ts';
import { OUTFITS } from '../src/cosmetics.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import {
  operatorTestFromUrl,
  operatorTestRoom,
  prepareOperatorTest,
  OPERATOR_MORPHS,
} from '../src/operator-test.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../The Operator 5.33.0');
mkdirSync(out, { recursive: true });
function actor(query = '') {
  if (!query.includes('gun=')) query = 'gun=pistol&' + query;
  const f = operatorTestFromUrl(new URL('https://test/?test=operator&scene=grips&v=1&' + query))!;
  const g = new Game();
  g.startTest(f.checkpoint, operatorTestRoom(f));
  prepareOperatorTest(g, f);
  g.time = 2;
  g.grounded = true;
  g.aim = { x: 600, y: g.player.position.y - 60 };
  return g;
}
const poses = [
  { name: 'Standing', vx: 0, vy: 0, ground: true, t: 2, shot: false },
  { name: 'Running / plant', vx: 5, vy: 0, ground: true, t: 2.17, shot: false },
  { name: 'Running / stride', vx: 5, vy: 0, ground: true, t: 2.32, shot: false },
  { name: 'Braking', vx: 3, vy: 0, ground: true, t: 2.35, shot: false, brake: 1 },
  { name: 'Launch', vx: 2, vy: -9, ground: false, t: 2.04, shot: false, jump: true },
  { name: 'Recoil flight', vx: -5, vy: -7, ground: false, t: 2.045, shot: true },
  { name: 'Falling', vx: 2, vy: 8, ground: false, t: 2.8, shot: false },
  { name: 'Landing', vx: 1, vy: 0, ground: true, t: 2.045, shot: false, land: true },
];
const sheet = createCanvas(1600, 800),
  c = sheet.getContext('2d');
c.fillStyle = '#0b151a';
c.fillRect(0, 0, 1600, 800);
poses.forEach((p, i) => {
  const g = actor();
  Matter.Body.setPosition(g.player, { x: 140 + (i === 2 ? 16 : 0), y: 722 });
  Matter.Body.setVelocity(g.player, { x: p.vx, y: p.vy });
  g.grounded = p.ground;
  g.time = p.t;
  g.jumpAt = p.jump ? 2 : -100;
  if (p.shot) {
    g.time = 2;
    g.fire();
    g.time = p.t;
  }
  if (p.land) {
    g.combatFeel.landedAt = 2;
    g.combatFeel.landingStrength = 1;
  }
  if (p.brake) g.operatorSurface.braking = p.brake;
  const x = (i % 4) * 400,
    y = Math.floor(i / 4) * 400;
  c.save();
  c.translate(x, y);
  c.fillStyle = '#c1cdbd';
  c.font = '18px Arial';
  c.fillText(p.name, 24, 34);
  c.strokeStyle = '#354446';
  c.beginPath();
  c.moveTo(25, 292);
  c.lineTo(375, 292);
  c.stroke();
  c.translate(190, 220);
  c.scale(4, 4);
  drawOperator(c, g, false);
  c.restore();
});
writeFileSync(resolve(out, 'operator-poses.png'), sheet.toBuffer('image/png'));
const tools = [
  ...STARTING_GUN_IDS.map((gun) => ({ name: gun, query: 'gun=' + gun })),
  ...Object.keys(OPERATOR_MORPHS)
    .filter((m) => m !== 'native')
    .map((m) => ({ name: m, query: 'morph=' + m })),
];
const grip = createCanvas(1600, Math.ceil(tools.length / 4) * 310),
  gc = grip.getContext('2d');
gc.fillStyle = '#0b151a';
gc.fillRect(0, 0, grip.width, grip.height);
tools.forEach((t, i) => {
  const g = actor(t.query);
  g.fire();
  g.time += 0.035;
  const x = (i % 4) * 400,
    y = Math.floor(i / 4) * 310;
  gc.save();
  gc.translate(x, y);
  gc.fillStyle = '#c1cdbd';
  gc.font = '18px Arial';
  gc.fillText(t.name, 24, 30);
  gc.translate(155, 168);
  gc.scale(3.2, 3.2);
  drawOperator(gc, g, false);
  gc.restore();
});
writeFileSync(resolve(out, 'operator-grips.png'), grip.toBuffer('image/png'));
const outfits = Object.keys(OUTFITS);
const wardrobe = createCanvas(1600, Math.ceil(outfits.length / 4) * 310),
  wc = wardrobe.getContext('2d');
wc.fillStyle = '#0b151a';
wc.fillRect(0, 0, wardrobe.width, wardrobe.height);
outfits.forEach((id, i) => {
  const g = actor('outfit=' + id);
  Matter.Body.setVelocity(g.player, { x: 3, y: 0 });
  const x = (i % 4) * 400,
    y = Math.floor(i / 4) * 310;
  wc.save();
  wc.translate(x, y);
  wc.fillStyle = '#c1cdbd';
  wc.font = '18px Arial';
  wc.fillText(OUTFITS[id as keyof typeof OUTFITS].name, 24, 30);
  wc.translate(160, 170);
  wc.scale(3.2, 3.2);
  drawOperator(wc, g, false);
  wc.restore();
});
writeFileSync(resolve(out, 'operator-outfits.png'), wardrobe.toBuffer('image/png'));
writeFileSync(
  resolve(out, 'visual-audit.json'),
  JSON.stringify(
    {
      scope:
        'Native Canvas render of actual shared gameplay renderer; authored inspection poses, not human playtests.',
      poses: poses.length,
      grips: tools.length,
      outfits: outfits.length,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ poses: poses.length, grips: tools.length, outfits: outfits.length, out }),
);
