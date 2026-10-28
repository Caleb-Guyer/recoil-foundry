import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { machineLanding } from '../src/machine-breakdown.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import {
  heavyIndustryTestFromUrl,
  heavyIndustryTestRoom,
  prepareHeavyIndustryTest,
} from '../src/heavy-industry-test.ts';
import { HEAVY_UNITS } from '../src/heavy-industry-test.ts';
import { MACHINE_VARIANTS, type MachineVariant } from '../src/patrol-machines.ts';
import type { HeavyMachineKind } from '../src/heavy-machine-pose.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Heavy Industry 5.36.0');
mkdirSync(out, { recursive: true });
function corpse(kind: HeavyMachineKind, variant: 'plain' | MachineVariant = 'plain') {
  const fixture = heavyIndustryTestFromUrl(
    new URL(
      'https://test/?test=heavy-industry&unit=' +
        kind +
        '&scene=shutdowns&variant=' +
        variant +
        '&v=1',
    ),
  )!;
  const g = new Game();
  g.startTest(fixture.checkpoint, heavyIndustryTestRoom(fixture));
  prepareHeavyIndustryTest(g, fixture);
  const enemy = g.enemies.find((e) => e.kind === kind)!;
  enemy.spawn = 0;
  enemy.state = 'windup';
  enemy.timer = 1.1;
  g.tick(1 / 60, {
    left: false,
    right: false,
    jump: false,
    jumpHeld: false,
    fire: false,
    aim: { x: 820, y: 720 },
  });
  const support = machineLanding(g, machineBodySnapshot(enemy, g.time, g)!);
  if (support) Matter.Body.setPosition(enemy.body, support.center);
  Matter.Body.setVelocity(enemy.body, { x: 0, y: 0 });
  g.hitEnemy(enemy, 10000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === enemy.id)!;
  if (!wreck) throw new Error('Native heavy lethal hit produced no snapshot');
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
  return wreck;
}
function sheet(filename: string, reduced = false, variants = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2],
    cols = variants ? 3 : ages.length;
  const canvas = createCanvas(cols * 320, 980),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    variants
      ? 'Heavy variant wrecks / actual native identities'
      : reduced
        ? 'Heavy shutdowns / Reduced Effects'
        : 'Heavy shutdowns / shutters, supports and falling cart barrels',
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '12px Arial';
  c.fillText(
    'Authored support staging from actual lethal-hit snapshots and native courses; production drawMachineWreck. Not a playtest.',
    20,
    50,
  );
  let count = 0;
  for (const [row, kind] of HEAVY_UNITS.entries()) {
    const nativeVariants: ('plain' | MachineVariant)[] = [
      'plain',
      ...Object.entries(MACHINE_VARIANTS)
        .filter(([, entry]) => entry.kind === kind)
        .map(([id]) => id as MachineVariant),
    ];
    const cases = variants
      ? nativeVariants.map((variant) => ({ variant, age: 0.45 }))
      : ages.map((age) => ({ variant: 'plain' as const, age }));
    for (const [col, { variant, age }] of cases.entries()) {
      const wreck = corpse(kind, variant);
      c.save();
      c.translate(col * 320, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '16px Arial';
      c.fillText(
        variants
          ? variant === 'plain'
            ? kind + ' / plain'
            : variant
          : kind + ' / +' + age.toFixed(2) + 's',
        20,
        28,
      );
      c.save();
      c.beginPath();
      c.rect(12, 42, 296, 236);
      c.clip();
      c.translate(160, 231);
      c.scale(4, 4);
      const anchor = wreck.landing?.point ?? {
        x: wreck.visual.position.x,
        y: wreck.visual.position.y + wreck.visual.hull.y / 2,
      };
      c.translate(-anchor.x, -anchor.y);
      if (wreck.landing) {
        c.strokeStyle = '#334749';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(anchor.x - 34, anchor.y);
        c.lineTo(anchor.x + 34, anchor.y);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      c.restore();
      count++;
    }
  }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels: count };
}
console.log(
  JSON.stringify(
    {
      kind: 'authored native Heavy Industry shutdown sheets; actual lethal hits, shared rig, real supports; no balance claim',
      sheets: [
        sheet('heavy-shutdowns.png'),
        sheet('heavy-shutdowns-reduced.png', true),
        sheet('heavy-variant-wrecks.png', false, true),
      ],
    },
    null,
    2,
  ),
);
