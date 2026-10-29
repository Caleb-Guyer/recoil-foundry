import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawSurfaceChassis } from '../src/surface-machine-art.ts';
import { ANGLER, updateAngler } from '../src/angler.ts';
import { CRAWLER } from '../src/wallcrawler.ts';
import {
  surfaceMachinesTestFromUrl,
  surfaceMachinesTestRoom,
  prepareSurfaceMachinesTest,
  type SurfaceUnit,
  type SurfaceFace,
} from '../src/surface-machines-test.ts';

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
function course(kind: SurfaceUnit, face: SurfaceFace = 'wall', scene = 'animations') {
  const f = surfaceMachinesTestFromUrl(
    new URL(
      `https://test/?test=surface-machines&unit=${kind}&scene=${scene}${kind === 'wallcrawler' ? '&face=' + face : ''}&v=1`,
    ),
  )!;
  if (!f) throw Error('Invalid authored surface inspection');
  const g = new Game();
  g.startTest(f.checkpoint, surfaceMachinesTestRoom(f));
  if (!prepareSurfaceMachinesTest(g, f)) throw Error('Native surface course did not prepare');
  for (const actor of g.enemies) actor.spawn = 0;
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Missing native surface actor');
  return { g, e };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, e: Enemy, check: () => boolean, max = 600) {
  for (let i = 0; i < max && !check() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  if (!check())
    throw Error(
      'Native inspection failed ' +
        JSON.stringify({
          time: g.time,
          hp: g.hp,
          mode: g.mode,
          state: e.state,
          timer: e.timer,
          shots: e.crawler?.fired,
          normal: e.crawler?.normal,
          plan: !!e.angler?.plan,
        }),
    );
}
type Cell = { label: string; detail: string; visual: MachineBodySnapshot };
function capture(g: Game, e: Enemy, label: string): Cell {
  const visual = machineBodySnapshot(e, g.time, g);
  if (!visual) throw Error('Surface snapshot missing');
  return {
    label,
    detail: `${Math.round(e.hp * 10) / 10}/${Math.round(e.maxHp * 10) / 10} HP; native ${e.state}; ${e.crawler ? 'shot ' + e.crawler.fired + '/3' : 'exposure ' + e.angler!.exposed.toFixed(2) + 's'}`,
    visual,
  };
}
function cycles(kind: SurfaceUnit) {
  const { g, e } = course(kind),
    cells = [capture(g, e, kind + ' / native ' + (kind === 'angler' ? 'stance' : 'wall grip'))];
  until(g, e, () => e.state === 'windup');
  cells.push(capture(g, e, kind + ' / tracking hardware'));
  until(
    g,
    e,
    () => e.state === 'windup' && e.timer <= (kind === 'angler' ? ANGLER.lock : CRAWLER.lock),
  );
  cells.push(capture(g, e, kind + ' / actual locked aim'));
  until(g, e, () => e.attacks > 0);
  cells.push(capture(g, e, kind + ' / admitted recoil'));
  dispose(g);
  return cells;
}
function damage(kind: SurfaceUnit) {
  const { g, e } = course(kind),
    cells = [capture(g, e, kind + ' / intact')];
  e.timer = 100;
  g.hitEnemy(e, e.maxHp * 0.4, { x: e.body.position.x - 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / real first hit'));
  g.hitStop = 0;
  g.time += 0.3;
  g.hitEnemy(e, e.maxHp * 0.35, { x: e.body.position.x + 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / real heavy wear'));
  dispose(g);
  return cells;
}
function counterplay() {
  const { g, e } = course('angler', 'floor', 'mechanisms');
  until(g, e, () => e.state === 'windup');
  const bank = e.angler!.plan!.body,
    cells = [capture(g, e, 'Angler / valid bank surface')];
  g.destruction.hitBody(bank, 100000, { x: 0, y: 0 });
  g.tick(1 / 60, idle);
  if (!e.angler!.exposed) throw Error('Native broken bank did not expose Angler');
  cells.push(capture(g, e, 'Angler / actual exposed casing'));
  updateAngler(g, e, ANGLER.exposed - 0.02);
  if (e.angler!.exposed <= 0) throw Error('Exposure interval expired early');
  cells.push(capture(g, e, 'Angler / exposure nearly finished'));
  updateAngler(g, e, 0.04);
  if (e.angler!.exposed > 0) throw Error('Exposure interval failed to expire');
  cells.push(capture(g, e, 'Angler / actual casing closed'));
  dispose(g);
  const crawler: Cell[] = [];
  for (const face of ['floor', 'wall', 'ceiling'] as const) {
    const f = course('wallcrawler', face);
    crawler.push(capture(f.g, f.e, 'Wallcrawler / actual ' + face + ' contact'));
    dispose(f.g);
  }
  const f = course('wallcrawler', 'ceiling', 'mechanisms');
  const host = f.e.crawler!.support!;
  f.g.destruction.hitBody(host, 100000, { x: 0, y: -1 });
  for (let i = 0; i < 10; i++) f.g.tick(1 / 60, idle);
  crawler.push(capture(f.g, f.e, 'Wallcrawler / native grip lost'));
  dispose(f.g);
  return [cells, crawler];
}
function sheet(filename: string, title: string, rows: Cell[][], reduced = false) {
  const cols = Math.max(...rows.map((r) => r.length)),
    canvas = createCanvas(cols * 320, 80 + rows.length * 300),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(title, 20, 28);
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Authored inspection courses; actual native controllers, terrain breaks and hits. Captured production hardware, not a playtest or balance claim.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      c.save();
      c.translate(col * 320, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '13px Arial';
      c.fillText(cell.label, 16, 24);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(cell.detail, 16, 43);
      c.beginPath();
      c.rect(12, 52, 296, 225);
      c.clip();
      c.translate(160, 174);
      c.scale(3.1, 3.1);
      const s = cell.visual,
        contact = s.surfaceMachine?.crawler?.contact;
      c.strokeStyle = '#3c5556';
      c.lineWidth = 0.7;
      c.beginPath();
      if (contact) {
        c.moveTo(contact.a.x - s.position.x, contact.a.y - s.position.y);
        c.lineTo(contact.b.x - s.position.x, contact.b.y - s.position.y);
        c.stroke();
      } else if (s.surfaceMachine?.grounded && s.surfaceMachine.supportY !== null) {
        const y = s.surfaceMachine!.supportY! - s.position.y;
        c.moveTo(-42, y);
        c.lineTo(42, y);
        c.stroke();
      }
      drawSurfaceChassis(c, s, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const nativeCycles = (['angler', 'wallcrawler'] as const).map(cycles),
  counters = counterplay();
console.log(
  JSON.stringify(
    {
      kind: 'Surface Machines native live hardware audit; native world projectiles/warnings stay in their own passes',
      sheets: [
        sheet(
          'surface-live-cycles.png',
          'Surface Machines / actual bank gimbal and gripping machinery',
          nativeCycles,
        ),
        sheet(
          'surface-damage-wear.png',
          'Surface Machines / actual native hits and persistent damage wear',
          (['angler', 'wallcrawler'] as const).map(damage),
        ),
        sheet(
          'surface-support-counterplay.png',
          'Surface Machines / true exposure and actual terrain contacts',
          counters,
        ),
        sheet(
          'surface-live-reduced.png',
          'Surface Machines / Reduced Effects live hardware',
          nativeCycles,
          true,
        ),
      ],
    },
    null,
    2,
  ),
);
