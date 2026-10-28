import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { machineLanding } from '../src/machine-breakdown.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import {
  specialistMachineTestFromUrl,
  specialistMachineTestRoom,
  prepareSpecialistMachineTest,
} from '../src/specialist-machines-test.ts';
import type { SpecialistMachineKind } from '../src/specialist-machine-pose.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Specialist Machines 5.35.0');
mkdirSync(out, { recursive: true });
function sheet(reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2];
  const canvas = createCanvas(ages.length * 300, 1270),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    reduced
      ? 'Specialist shutdowns / Reduced Effects'
      : 'Specialist shutdowns / ram, spring, tripod and long barrels',
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '12px Arial';
  c.fillText(
    'Authored supported staging, actual native lethal-hit records, production shared-rig drawMachineWreck. Not a playtest.',
    20,
    50,
  );
  const rows: [SpecialistMachineKind, 'plain' | 'twin'][] = [
    ['charger', 'plain'],
    ['hopper', 'plain'],
    ['sniper', 'plain'],
    ['sniper', 'twin'],
  ];
  for (const [row, [kind, elite]] of rows.entries()) {
    const fixture = specialistMachineTestFromUrl(
      new URL(
        'https://test/?test=specialists&unit=' + kind + '&scene=shutdowns&elite=' + elite + '&v=1',
      ),
    )!;
    const g = new Game();
    g.startTest(fixture.checkpoint, specialistMachineTestRoom(fixture));
    prepareSpecialistMachineTest(g, fixture);
    const enemy = g.enemies.find((e) => e.kind === kind)!;
    enemy.spawn = 0;
    enemy.state = 'windup';
    enemy.timer = 0.05;
    const support = machineLanding(g, machineBodySnapshot(enemy, g.time, g)!);
    if (support) Matter.Body.setPosition(enemy.body, support.center);
    Matter.Body.setVelocity(enemy.body, { x: 0, y: 0 });
    g.hitEnemy(enemy, 10000);
    const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === enemy.id)!;
    if (!wreck) throw new Error('Native specialist death did not produce a snapshot');
    for (const [col, age] of ages.entries()) {
      c.save();
      c.translate(col * 300, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '16px Arial';
      c.fillText((elite === 'twin' ? 'Twin ' : '') + kind + ' / +' + age.toFixed(2) + 's', 20, 28);
      c.save();
      c.beginPath();
      c.rect(12, 42, 276, 236);
      c.clip();
      c.translate(kind === 'sniper' ? 170 : 150, 231);
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
        c.moveTo(anchor.x - 30, anchor.y);
        c.lineTo(anchor.x + 30, anchor.y);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      c.restore();
    }
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
  const path = resolve(
    out,
    reduced ? 'specialist-shutdowns-reduced.png' : 'specialist-shutdowns.png',
  );
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels: rows.length * ages.length };
}
console.log(
  JSON.stringify(
    {
      kind: 'authored native specialist lethal-hit contact sheets; no balance or human-session claims',
      sheets: [sheet(), sheet(true)],
    },
    null,
    2,
  ),
);
