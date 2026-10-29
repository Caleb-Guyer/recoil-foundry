import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawDistrictChassis } from '../src/district-machine-art.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import { machineLanding, type MachineWreck } from '../src/machine-breakdown.ts';
import {
  districtMachinesTestFromUrl,
  districtMachinesTestRoom,
  prepareDistrictMachinesTest,
  type DistrictUnit,
} from '../src/district-machines-test.ts';

const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../District Machines 5.39.0');
mkdirSync(out, { recursive: true });
const kinds = ['borer', 'sifter', 'skimmer'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: DistrictUnit, scene = 'animations') {
  const f = districtMachinesTestFromUrl(
    new URL(`https://test/?test=district-machines&unit=${kind}&scene=${scene}&v=1`),
  )!;
  if (!f) throw Error('Invalid native District Machines course');
  const g = new Game();
  g.startTest(f.checkpoint, districtMachinesTestRoom(f));
  if (!prepareDistrictMachinesTest(g, f)) throw Error('District Machines course did not prepare');
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Native district machine missing');
  for (const actor of g.enemies) actor.spawn = 0;
  return { g, e };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, check: () => boolean, limit = 600) {
  for (let n = 0; n < limit && !check() && g.mode === 'playing'; n++) g.tick(1 / 60, idle);
  if (!check())
    throw Error(
      'Native inspection failed ' +
        JSON.stringify({
          time: g.time,
          mode: g.mode,
          hp: g.hp,
          enemies: g.enemies.map((e) => ({
            kind: e.kind,
            state: e.state,
            attacks: e.attacks,
            phase: e.scrapper?.phase ?? e.harpoon?.phase,
          })),
        }),
    );
}
type LiveCell = { label: string; detail: string; visual: MachineBodySnapshot };
function capture(g: Game, e: Enemy, label: string): LiveCell {
  const visual = machineBodySnapshot(e, g.time, g);
  if (!visual) throw Error('Native district snapshot unavailable');
  return {
    label,
    detail: `${Math.round(e.hp * 10) / 10}/${Math.round(e.maxHp * 10) / 10} HP; native ${e.state}; ${e.attacks} volleys`,
    visual,
  };
}
function cycles(kind: DistrictUnit) {
  const { g, e } = course(kind),
    cells = [
      capture(g, e, kind + (kind === 'borer' ? ' / native cover brace' : ' / native hover')),
    ];
  until(g, () => e.state === 'windup');
  cells.push(capture(g, e, kind + ' / tracking hardware'));
  until(g, () => e.state === 'windup' && e.timer <= (kind === 'skimmer' ? 0.34 : 0.5));
  cells.push(capture(g, e, kind + ' / native locked ports'));
  until(g, () => e.attacks > 0);
  cells.push(capture(g, e, kind + ' / actual volley recoil'));
  dispose(g);
  return cells;
}
function damage(kind: DistrictUnit) {
  const { g, e } = course(kind),
    cells = [capture(g, e, kind + ' / intact')];
  e.timer = 100;
  g.hitEnemy(e, e.maxHp * 0.4);
  cells.push(capture(g, e, kind + ' / real first hit'));
  g.hitStop = 0;
  g.time += 0.3;
  g.hitEnemy(e, e.maxHp * 0.35);
  cells.push(capture(g, e, kind + ' / real heavy wear'));
  dispose(g);
  return cells;
}
function combat(kind: DistrictUnit) {
  const { g, e } = course(kind, 'wreckage');
  until(g, () => e.state === 'windup' && e.timer <= 0.25);
  // Close-up hardware audit only: place the captured native rig at its actual projected
  // support, with a short15px hover for fliers. Tests separately exercise full native falls.
  const landing = machineLanding(g, machineBodySnapshot(e, g.time, g)!);
  if (landing) {
    Matter.Body.setPosition(e.body, {
      ...landing.center,
      y: landing.center.y - (kind === 'borer' ? 0 : 15),
    });
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  }
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id);
  if (!wreck) throw Error('Native lethal hit did not create a wreck');
  dispose(g);
  return wreck;
}
function header(title: string, cols: number, rows: number) {
  const canvas = createCanvas(cols * 320, 80 + rows * 300),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(title, 20, 28);
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Authored inspection courses; actual native controllers and hits; shared production hardware only. Not a playtest or balance claim.',
    20,
    50,
  );
  return { canvas, c };
}
function panel(
  c: CanvasRenderingContext2D,
  row: number,
  col: number,
  label: string,
  detail: string,
) {
  c.save();
  c.translate(col * 320, 70 + row * 300);
  c.fillStyle = '#c5cbb8';
  c.font = '14px Arial';
  c.fillText(label, 16, 24);
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(detail, 16, 44);
  c.beginPath();
  c.rect(12, 52, 296, 225);
  c.clip();
  c.translate(160, 174);
  c.scale(3.3, 3.3);
}
function liveSheet(filename: string, title: string, rows: LiveCell[][]) {
  const { canvas, c } = header(title, Math.max(...rows.map((r) => r.length)), rows.length);
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      panel(c, row, col, cell.label, cell.detail);
      drawDistrictChassis(c, cell.visual);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
function wreckSheet(filename: string, title: string, reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2],
    { canvas, c } = header(title, ages.length, 3);
  let panels = 0;
  for (const [row, kind] of kinds.entries()) {
    const wreck = combat(kind);
    for (const [col, age] of ages.entries()) {
      panel(
        c,
        row,
        col,
        kind + ' / +' + age.toFixed(2) + 's',
        'Native lethal hit; captured mechanism',
      );
      const anchor = wreck.landing?.point ?? {
        x: wreck.visual.position.x,
        y: wreck.visual.position.y + wreck.visual.hull.y / 2,
      };
      c.translate(-anchor.x, -anchor.y + 18);
      if (wreck.landing) {
        c.strokeStyle = '#334749';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(anchor.x - 38, anchor.y);
        c.lineTo(anchor.x + 38, anchor.y);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      panels++;
    }
  }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
console.log(
  JSON.stringify(
    {
      kind: 'District Machines native hardware art audit; real released projectiles remain native; no balance claim',
      sheets: [
        liveSheet(
          'district-live-cycles.png',
          'District Machines / actual drive, fan and impeller cycles',
          kinds.map(cycles),
        ),
        liveSheet(
          'district-damage-wear.png',
          'District Machines / actual native hits and persistent damage wear',
          kinds.map(damage),
        ),
        wreckSheet('district-shutdowns.png', 'District Machines / shutdown and settling wreckage'),
        wreckSheet(
          'district-shutdowns-reduced.png',
          'District Machines / Reduced Effects shutdowns',
          true,
        ),
      ],
    },
    null,
    2,
  ),
);
