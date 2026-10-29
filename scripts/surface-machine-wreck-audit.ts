import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import { drawMachineWreck, projectMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import {
  surfaceMachinesTestFromUrl,
  surfaceMachinesTestRoom,
  prepareSurfaceMachinesTest,
  type SurfaceUnit,
  type SurfaceFace,
} from '../src/surface-machines-test.ts';
import { beginAnglerAttack } from '../src/angler.ts';
import { updateWallcrawler } from '../src/wallcrawler.ts';

const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Surface Machines 5.40.0');
mkdirSync(out, { recursive: true });
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: SurfaceUnit, face: SurfaceFace = 'wall') {
  const f = surfaceMachinesTestFromUrl(
    new URL(
      `https://test/?test=surface-machines&unit=${kind}&scene=wreckage${kind === 'wallcrawler' ? '&face=' + face : ''}&v=1`,
    ),
  )!;
  if (!f) throw Error('Invalid native Surface Machines inspection');
  const g = new Game();
  g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
  if (!prepareSurfaceMachinesTest(g, f)) throw Error('Surface course did not prepare');
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Native surface machine missing');
  e.spawn = 0;
  e.timer = 0;
  g.time = 1;
  g.machineBreakdown.update();
  return { g, e };
}
function combat(kind: SurfaceUnit, face: SurfaceFace = 'wall', fallen = false) {
  const { g, e } = course(kind, face);
  if (kind === 'angler') {
    if (!beginAnglerAttack(g, e)) throw Error('Native Angler failed to find its bank');
  }
  if (fallen) {
    const host = e.crawler!.support;
    if (!host) throw Error('Native crawler had no grip to release');
    g.destruction.hitBody(host, 100000, { x: 0, y: 1 });
    updateWallcrawler(g, e, 1 / 60);
    g.machineBreakdown.update();
    for (let n = 0; n < 8; n++) g.tick(1 / 60, idle);
    if (e.crawler!.support) throw Error('Native support break did not release grip');
  }
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  if (!wreck) throw Error('Actual lethal hit did not capture surface wreck');
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
  return wreck;
}
const rows = [
  { label: 'Angler / native bank mount', wreck: combat('angler') },
  ...(['floor', 'wall', 'ceiling'] as const).map((face) => ({
    label: 'Wallcrawler / ' + face,
    wreck: combat('wallcrawler', face),
  })),
  { label: 'Wallcrawler / actual broken grip fall', wreck: combat('wallcrawler', 'ceiling', true) },
];
function sheet(filename: string, reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2],
    canvas = createCanvas(320 * ages.length, 80 + rows.length * 300),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    'Surface Machines / ' +
      (reduced ? 'Reduced Effects' : 'captured orientation, shutdown and settling'),
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Actual native hits and broken support. Production wrecks; camera follows real projection. Support line is actual. Not a playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, { label, wreck }] of rows.entries())
    for (const [col, age] of ages.entries()) {
      const projection = projectMachineWreck(wreck, wreck.at + age, reduced);
      if (!projection) throw Error('Expected live native wreck projection');
      c.save();
      c.translate(col * 320, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '14px Arial';
      c.fillText(label + ' / +' + age.toFixed(2) + 's', 16, 24);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(
        wreck.landing
          ? 'Native support drop ' +
              Math.round(wreck.landing.center.y - projection.position.y) +
              'px remains'
          : 'No native landing support; short air fade',
        16,
        44,
      );
      c.beginPath();
      c.rect(12, 52, 296, 225);
      c.clip();
      c.translate(160, 190);
      c.scale(3.5, 3.5);
      c.translate(-projection.position.x, -projection.position.y);
      if (wreck.landing) {
        const { point, normal } = wreck.landing,
          tangent = { x: -normal.y, y: normal.x };
        c.strokeStyle = '#334749';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(point.x - tangent.x * 40, point.y - tangent.y * 40);
        c.lineTo(point.x + tangent.x * 40, point.y + tangent.y * 40);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
console.log(
  JSON.stringify(
    {
      kind: 'Surface Machines actual native shutdown audit; orientation captured, real projected support, no extra bodies or projectiles',
      sheets: [sheet('surface-shutdowns.png'), sheet('surface-shutdowns-reduced.png', true)],
    },
    null,
    2,
  ),
);
