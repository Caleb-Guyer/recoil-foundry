import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawHazardChassis } from '../src/hazard-machine-art.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import {
  hazardCrewTestFromUrl,
  hazardCrewTestRoom,
  prepareHazardCrewTest,
  type HazardUnit,
} from '../src/hazard-crew-test.ts';

const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Hazard Crew 5.38.0');
mkdirSync(out, { recursive: true });
const kinds = ['scrapper', 'harpooner', 'sapper'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 900, y: 650 },
};
function course(kind: HazardUnit, scene = 'animations') {
  const f = hazardCrewTestFromUrl(
    new URL(`https://test/?test=hazard-crew&unit=${kind}&scene=${scene}&v=1`),
  )!;
  if (!f) throw Error('Invalid native Hazard Crew course');
  const g = new Game();
  g.startTest(f.checkpoint, hazardCrewTestRoom(f));
  if (!prepareHazardCrewTest(g, f)) throw Error('Hazard Crew course did not prepare');
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Native hazard machine missing');
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
  if (!visual) throw Error('Native hazard snapshot unavailable');
  return {
    label,
    detail: `${Math.round(e.hp * 10) / 10}/${Math.round(e.maxHp * 10) / 10} HP; native ${e.scrapper?.held ? e.scrapper.phase : (e.harpoon?.phase ?? e.state)}; ${e.attacks} releases`,
    visual,
  };
}
function cycles(kind: HazardUnit) {
  const { g, e } = course(kind),
    cells = [capture(g, e, kind + ' / native idle')];
  if (kind === 'scrapper') {
    until(g, () => !!e.scrapper?.held);
    cells.push(capture(g, e, 'Scrapper / real crate lifted'));
    until(g, () => e.scrapper?.phase === 'aim' && !!e.scrapper.held);
    cells.push(capture(g, e, 'Scrapper / committed throw'));
    until(g, () => e.attacks > 0);
    cells.push(capture(g, e, 'Scrapper / actual release'));
  } else if (kind === 'harpooner') {
    until(g, () => e.harpoon?.phase === 'aim');
    cells.push(capture(g, e, 'Harpooner / native aim'));
    until(g, () => e.harpoon?.phase === 'flight');
    cells.push(capture(g, e, 'Harpooner / real launch'));
    until(g, () => e.harpoon?.phase === 'latched');
    cells.push(capture(g, e, 'Harpooner / native tension'));
  } else {
    until(g, () => e.state === 'windup');
    cells.push(capture(g, e, 'Sapper / real loading'));
    until(g, () => e.state === 'windup' && e.timer <= 0.45);
    cells.push(capture(g, e, 'Sapper / locked launcher'));
    until(g, () => g.sappers.items.some((p) => p.charge?.owner === e.id));
    cells.push(capture(g, e, 'Sapper / actual ejection'));
  }
  dispose(g);
  return cells;
}
function damage(kind: HazardUnit) {
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
function combat(kind: HazardUnit) {
  const { g, e } = course(kind, 'wreckage');
  until(g, () =>
    kind === 'scrapper'
      ? !!e.scrapper?.held && e.scrapper.phase === 'aim'
      : kind === 'harpooner'
        ? e.harpoon?.phase === 'flight'
        : e.state === 'windup',
  );
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
  const scrapper = label.toLowerCase().startsWith('scrapper');
  c.translate(scrapper ? 210 : 160, scrapper ? 227 : 205);
  c.scale(scrapper ? 2.2 : 3.5, scrapper ? 2.2 : 3.5);
}
function liveSheet(filename: string, title: string, rows: LiveCell[][]) {
  const { canvas, c } = header(title, Math.max(...rows.map((r) => r.length)), rows.length);
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      panel(c, row, col, cell.label, cell.detail);
      drawHazardChassis(c, cell.visual);
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
      kind: 'Hazard Crew native hardware art audit; no fake hazard actors or balance claim',
      sheets: [
        liveSheet(
          'hazard-live-cycles.png',
          'Hazard Crew / actual clamp, winch and loading cycles',
          kinds.map(cycles),
        ),
        liveSheet(
          'hazard-damage-wear.png',
          'Hazard Crew / actual native hits and persistent damage wear',
          kinds.map(damage),
        ),
        wreckSheet('hazard-shutdowns.png', 'Hazard Crew / shutdown and settling wreckage'),
        wreckSheet('hazard-shutdowns-reduced.png', 'Hazard Crew / Reduced Effects shutdowns', true),
      ],
    },
    null,
    2,
  ),
);
