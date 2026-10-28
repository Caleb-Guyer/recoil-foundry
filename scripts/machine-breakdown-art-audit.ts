import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { enemyRemasterTestFromUrl } from '../src/enemy-encounters.ts';
import type { MachineKind } from '../src/machine-breakdown-pose.ts';
import { SPLIT_SCALE } from '../src/mutations.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { machineLanding } from '../src/machine-breakdown.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import {
  machineBreakdownTestFromUrl,
  machineBreakdownTestRoom,
  prepareMachineBreakdownTest,
} from '../src/machine-breakdown-test.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Machine Breakdown 5.34.0');
mkdirSync(out, { recursive: true });
function sheet(filename: string, columns: string[], variants = false) {
  const canvas = createCanvas(columns.length * 300, 900),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  let count = 0;
  for (const [row, kind] of (['runner', 'shooter', 'flyer'] as MachineKind[]).entries())
    for (const [col, column] of columns.entries()) {
      const g = new Game();
      g.startTest(
        enemyRemasterTestFromUrl(new URL('https://test/?test=enemies&unit=' + kind + '&v=1'))!,
      );
      const e = g.enemies.find((e) => e.kind === kind)!;
      e.spawn = 0;
      g.time = 2;
      e.timer = 0.18;
      e.aim = { x: col % 2 ? -0.8 : 0.8, y: -0.6 };
      e.state = ['windup', 'recover'].includes(column) ? (column as 'windup' | 'recover') : 'idle';
      if (column === 'worn') e.hp = e.maxHp * 0.6;
      if (column === 'critical') e.hp = e.maxHp * 0.25;
      Matter.Body.setVelocity(e.body, { x: column === 'idle' ? 3 : 0, y: 0 });
      if (variants) {
        if (column === 'elite')
          e.elite = kind === 'runner' ? 'shielded' : kind === 'shooter' ? 'twin' : 'volatile';
        if (column === 'mutation')
          e.mutation = {
            kind: kind === 'runner' ? 'splitter' : kind === 'shooter' ? 'gunner' : 'blinker',
            phase: 'idle',
            timer: 0,
            count: 0,
          };
        if (column === 'squad')
          e.squad = {
            kind: 'shield',
            role: 'support',
            connected: true,
            side: 1,
            planAt: 0,
            jumpAt: 0,
          };
        if (column === 'split') {
          e.splitChild = true;
          Matter.Body.scale(e.body, SPLIT_SCALE, SPLIT_SCALE);
        }
        if (column === 'allied') e.allied = true;
      }
      c.save();
      c.translate(col * 300, row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '17px Arial';
      c.fillText(kind + ' / ' + column, 20, 30);
      c.strokeStyle = '#334749';
      c.beginPath();
      c.moveTo(20, 240);
      c.lineTo(280, 240);
      c.stroke();
      c.translate(150, 175);
      c.scale(4, 4);
      c.translate(-e.body.position.x, -e.body.position.y);
      const element = {
        getContext: () => c,
        getBoundingClientRect: () => ({ width: 960, height: 600 }),
      } as unknown as HTMLCanvasElement;
      const renderer = new Renderer(element, g);
      renderer.drawEnemies();
      c.restore();
      count++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels: count };
}
function wreckSheet(reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2];
  const canvas = createCanvas(ages.length * 300, 980),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    reduced
      ? 'Reduced Effects / fixed defeated poses'
      : 'Native machine shutdown / folded chassis and inert wrecks',
    20,
    28,
  );
  c.font = '12px Arial';
  c.fillStyle = '#879d94';
  c.fillText(
    'Authored floor staging from actual lethal-hit snapshots; real projected supports. Not a playtest or balance result.',
    20,
    50,
  );
  let count = 0;
  for (const [row, kind] of (['runner', 'shooter', 'flyer'] as const).entries()) {
    const fixture = machineBreakdownTestFromUrl(
      new URL('https://test/?test=machine-breakdown&scene=shutdowns&unit=all&v=1'),
    )!;
    const g = new Game();
    g.startTest(fixture.checkpoint, machineBreakdownTestRoom(fixture));
    prepareMachineBreakdownTest(g, fixture);
    const enemy = g.enemies.find((e) => e.kind === kind && e.body.position.x < 1500)!;
    enemy.spawn = 0;
    // Stage each family on its actual native support so the contact sheet can
    // compare joint motion at one useful scale, without inventing a floor.
    const support = machineLanding(g, machineBodySnapshot(enemy, g.time)!);
    if (support) Matter.Body.setPosition(enemy.body, support.center);
    Matter.Body.setVelocity(enemy.body, { x: 0, y: 0 });
    g.hitEnemy(enemy, 10000);
    const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === enemy.id)!;
    for (const [col, age] of ages.entries()) {
      c.save();
      c.translate(col * 300, 80 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '16px Arial';
      c.fillText(kind + ' / +' + age.toFixed(2) + 's', 20, 28);
      c.save();
      c.beginPath();
      c.rect(12, 42, 276, 236);
      c.clip();
      c.translate(150, 231);
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
        c.moveTo(wreck.landing.point.x - 30, wreck.landing.point.y);
        c.lineTo(wreck.landing.point.x + 30, wreck.landing.point.y);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      c.restore();
      count++;
    }
    Matter.Composite.clear(g.engine.world, false);
    Matter.Engine.clear(g.engine);
  }
  const path = resolve(out, reduced ? 'machine-shutdowns-reduced.png' : 'machine-shutdowns.png');
  writeFileSync(path, canvas.toBuffer('image/png'));
  return {
    path,
    panels: count,
    provenance:
      'actual native lethal-hit records, authored support staging, production drawMachineWreck',
  };
}
console.log(
  JSON.stringify(
    {
      kind: 'native Canvas visual contact sheets; staged native state, not a balance audit',
      sheets: [
        wreckSheet(),
        wreckSheet(true),
        sheet('machine-live-poses.png', ['idle', 'windup', 'recover', 'worn', 'critical']),
        sheet(
          'machine-identities.png',
          ['ordinary', 'elite', 'mutation', 'squad', 'split', 'allied'],
          true,
        ),
      ],
    },
    null,
    2,
  ),
);
