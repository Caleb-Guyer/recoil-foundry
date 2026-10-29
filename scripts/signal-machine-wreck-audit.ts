import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import { drawMachineWreck, projectMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import {
  signalMachinesTestFromUrl,
  signalMachinesTestRoom,
  prepareSignalMachinesTest,
  type SignalUnit,
  type SignalScene,
} from '../src/signal-machines-test.ts';
import { CALLER, updateCaller } from '../src/caller.ts';

const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Signal Machines 5.41.0');
mkdirSync(out, { recursive: true });
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: SignalUnit, scene = 'wreckage') {
  const f = signalMachinesTestFromUrl(
    new URL(`https://test/?test=signal-machines&unit=${kind}&scene=${scene}&v=1`),
  )!;
  if (!f) throw Error('Invalid native Signal Machines inspection');
  const g = new Game();
  g.startTest(f.checkpoint, signalMachinesTestRoom(f));
  if (!prepareSignalMachinesTest(g, f)) throw Error('Signal course did not prepare');
  const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === kind)!;
  if (!e) throw Error('Native signal machine missing');
  for (const actor of [...g.enemies, ...g.factions.allies]) actor.spawn = 0;
  e.spawn = 0;
  e.timer = 0;
  g.time = 1;
  g.machineBreakdown.update();
  return { g, e };
}
function combat(kind: SignalUnit, scene = 'wreckage', feedback = false) {
  const { g, e } = course(kind, scene);
  if (kind === 'caller') {
    for (const dt of [0.001, CALLER.sample + 0.001, CALLER.sample + 0.001]) {
      g.time += dt;
      updateCaller(g, e, dt);
      g.machineBreakdown.update();
    }
    if (e.caller?.phase !== 'locked' || e.caller.marks.length !== 3)
      throw Error('Native Caller did not lock its recording');
  } else {
    g.annex.readyAt = g.time;
    g.annex.update();
    g.machineBreakdown.update();
    if (g.annex.transmission?.owner !== e || g.annex.transmission.phase !== 'charging')
      throw Error('Native radio did not begin owner transmission');
  }
  if (feedback) {
    e.hp = 20;
    if (!g.annex.interrupt()) throw Error('Native junction feedback failed');
  } else if (e.allied) g.factions.hitAlly(e, 100000);
  else g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  if (!wreck) throw Error('Native lethal damage did not capture signal wreck');
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
  return wreck;
}
const rows = [
  { label: 'Caller / recorded three native marks', wreck: combat('caller') },
  { label: 'Switchman / native remote charge', wreck: combat('switchman') },
  { label: 'Switchman / actual lethal feedback', wreck: combat('switchman', 'wreckage', true) },
  { label: 'Blue Caller / native friendly defeat', wreck: combat('caller', 'friendly') },
  { label: 'Blue Switchman / native friendly defeat', wreck: combat('switchman', 'friendly') },
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
    'Signal Machines / ' +
      (reduced ? 'Reduced Effects' : 'inert recorded horn and radio shutdowns'),
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Native hits, real faction defeat and actual lethal feedback. Inert production rigs only; no queued signals. Not a playtest.',
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
      kind: 'Signal Machines actual native shutdown audit; no corpse recording, transmission, extra bodies or projectiles',
      sheets: [sheet('signal-shutdowns.png'), sheet('signal-shutdowns-reduced.png', true)],
    },
    null,
    2,
  ),
);
