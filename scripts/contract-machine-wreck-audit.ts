import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy } from '../src/game.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import type { HuntKind } from '../src/hunt-rules.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import { drawMachineWreck, projectMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Contract Machines 5.42.0');
mkdirSync(out, { recursive: true });
function course(kind: HuntKind) {
  const cp = huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&v=1`))!;
  const g = new Game();
  g.startTest(cp);
  g.time = 1;
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Native hunt boss missing');
  e.spawn = 0;
  e.timer = 0;
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function deploy(g: Game, e: Enemy) {
  if (e.kind === 'bulwark') return;
  e.state = 'idle';
  e.timer = 0;
  e.attacks = e.kind === 'demolisher' ? 1 : 0;
  g.hunts.updateEnemy(e);
  if (e.state !== 'windup' || e.attack !== 'mortar')
    throw Error('Expected actual deployment windup');
  e.timer = 0;
  g.time += 1.15;
  g.hunts.updateEnemy(e);
  if (e.kind === 'cableweaver') {
    if (!g.hunts.cables.length) throw Error('No real anchors');
    g.time = g.hunts.cables[0].liveAt + 0.01;
  } else if (!g.hunts.mines.length) throw Error('No real mine');
  g.machineBreakdown.update();
}
function combat(
  kind: HuntKind,
  mode: 'armed' | 'cut' | 'one-plate' | 'exposed' | 'pending' = 'armed',
) {
  const { g, e } = course(kind);
  if (mode === 'pending') {
    e.attacks = 1;
    g.hunts.updateEnemy(e);
    if (e.state !== 'windup' || e.attack !== 'mortar') throw Error('No native pending charge');
  } else deploy(g, e);
  if (mode === 'cut') {
    const prop = kind === 'cableweaver' ? g.hunts.cables[0].anchors[0] : g.hunts.mines[0].prop;
    g.hunts.hitProp(prop, 100, { x: 1, y: 0 }, true);
  } else if (mode === 'one-plate') g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
  else if (mode === 'exposed')
    for (const prop of [...g.hunts.plates]) g.hunts.hitProp(prop, 100, { x: 1, y: 0 }, true);
  g.machineBreakdown.update();
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  if (!wreck) throw Error('Native lethal damage did not capture a Contract wreck');
  if (
    g.props.items.some((p) => p.hunt) ||
    g.hunts.cables.length ||
    g.hunts.mines.length ||
    g.hunts.plates.length
  )
    throw Error('Native owner defeat did not clear real gear');
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
  return wreck;
}
const groups = [
  {
    unit: 'cableweaver',
    rows: [
      { label: 'Cableweaver / live native cable', wreck: combat('cableweaver') },
      { label: 'Cableweaver / player cut interrupted', wreck: combat('cableweaver', 'cut') },
    ],
  },
  {
    unit: 'bulwark',
    rows: [
      { label: 'Bulwark / two native shield plates', wreck: combat('bulwark') },
      { label: 'Bulwark / one real plate broken', wreck: combat('bulwark', 'one-plate') },
      { label: 'Bulwark / native exposed core', wreck: combat('bulwark', 'exposed') },
    ],
  },
  {
    unit: 'demolisher',
    rows: [
      { label: 'Demolisher / real armed mine', wreck: combat('demolisher') },
      { label: 'Demolisher / player disarmed mine', wreck: combat('demolisher', 'cut') },
      { label: 'Demolisher / interrupted charge windup', wreck: combat('demolisher', 'pending') },
    ],
  },
];
function sheet(unit: string, rows: { label: string; wreck: MachineWreck }[], reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2],
    canvas = createCanvas(320 * ages.length, 80 + rows.length * 380),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    'Contract Machines / ' +
      unit +
      ' / ' +
      (reduced ? 'Reduced Effects' : 'native mechanical shutdowns'),
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Captured actual native hits and gear states. Gear remains native cleanup; no corpse cables, armor props or mines. Not a playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, { label, wreck }] of rows.entries())
    for (const [col, age] of ages.entries()) {
      const projection = projectMachineWreck(wreck, wreck.at + age, reduced);
      if (!projection) throw Error('Expected live wreck projection');
      c.save();
      c.translate(col * 320, 70 + row * 380);
      c.fillStyle = '#c5cbb8';
      c.font = '13px Arial';
      c.fillText(label, 16, 23);
      c.fillText('+' + age.toFixed(2) + 's', 16, 42);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(
        wreck.landing
          ? 'Captured real support; native gear cleared'
          : 'No support; brief visual air fade',
        16,
        60,
      );
      c.beginPath();
      c.rect(12, 66, 296, 298);
      c.clip();
      c.translate(unit === 'bulwark' ? 216 : 160, 275);
      c.scale(2, 2);
      c.translate(-projection.position.x, -projection.position.y);
      if (wreck.landing) {
        const { point, normal } = wreck.landing,
          tangent = { x: -normal.y, y: normal.x };
        c.strokeStyle = '#334749';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(point.x - tangent.x * 70, point.y - tangent.y * 70);
        c.lineTo(point.x + tangent.x * 70, point.y + tangent.y * 70);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(
    out,
    'contract-' + unit + '-shutdowns' + (reduced ? '-reduced' : '') + '.png',
  );
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const sheets = groups.flatMap((group) => [
  sheet(group.unit, group.rows),
  sheet(group.unit, group.rows, true),
]);
const report = {
  kind: 'Contract Machines actual native shutdown audit: captured pre-clear gear, inert shared chassis, real support and existing native lifetime',
  sheets,
  panels: sheets.reduce((n, s) => n + s.panels, 0),
};
writeFileSync(resolve(out, 'contract-wreck-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
