import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawSignalChassis } from '../src/signal-machine-art.ts';
import { TRANSMISSION } from '../src/annex.ts';
import {
  signalMachinesTestFromUrl,
  signalMachinesTestRoom,
  prepareSignalMachinesTest,
  type SignalUnit,
} from '../src/signal-machines-test.ts';
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
function course(kind: SignalUnit, scene = 'animations') {
  const f = signalMachinesTestFromUrl(
    new URL(`https://test/?test=signal-machines&unit=${kind}&scene=${scene}&v=1`),
  )!;
  if (!f) throw Error('Invalid signal inspection');
  const g = new Game();
  g.startTest(f.checkpoint, signalMachinesTestRoom(f));
  if (!prepareSignalMachinesTest(g, f)) throw Error('Native signal course did not prepare');
  for (const actor of [...g.enemies, ...g.factions.allies]) actor.spawn = 0;
  const e = [...g.enemies, ...g.factions.allies].find((e) => e.kind === kind)!;
  if (!e) throw Error('Missing signal actor');
  return { g, e };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, e: Enemy, check: () => boolean, max = 900) {
  for (let i = 0; i < max && !check() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  if (!check())
    throw Error(
      'Native signal inspection failed ' +
        JSON.stringify({
          time: g.time,
          hp: g.hp,
          mode: g.mode,
          state: e.state,
          timer: e.timer,
          caller: e.caller
            ? { phase: e.caller.phase, marks: e.caller.marks.length, next: e.caller.next }
            : null,
          transmission: g.annex.transmission?.phase,
          bodyShots: e.attacks,
          portVolleys: g.annex.volleys,
        }),
    );
}
type Cell = { label: string; detail: string; visual: MachineBodySnapshot };
function capture(g: Game, e: Enemy, label: string): Cell {
  const visual = machineBodySnapshot(e, g.time, g);
  if (!visual) throw Error('Signal snapshot missing');
  return {
    label,
    detail: `${Math.round(e.hp * 10) / 10}/${Math.round(e.maxHp * 10) / 10} HP; ${e.allied ? 'native blue ally; ' : ''}${e.caller ? e.caller.phase + ' / ' + e.caller.marks.length + ' records / next ' + e.caller.next : 'body shots ' + e.attacks + ' / port volleys ' + g.annex.volleys}`,
    visual,
  };
}
function callerCycle() {
  const { g, e } = course('caller'),
    cells = [capture(g, e, 'Caller / empty mechanical rack')];
  until(g, e, () => e.caller?.phase === 'recording');
  cells.push(capture(g, e, 'Caller / first real record'));
  until(g, e, () => e.caller?.marks.length === 2);
  cells.push(capture(g, e, 'Caller / second real record'));
  until(g, e, () => e.caller?.phase === 'locked');
  cells.push(capture(g, e, 'Caller / three locked records'));
  until(g, e, () => e.attacks === 1);
  cells.push(capture(g, e, 'Caller / first admitted playback'));
  until(g, e, () => e.attacks === 3);
  cells.push(capture(g, e, 'Caller / actual reset after third shot'));
  dispose(g);
  return cells;
}
function switchmanCycle() {
  const { g, e } = course('switchman'),
    cells = [capture(g, e, 'Switchman / native patrol')];
  until(g, e, () => e.timer <= 0.55);
  cells.push(capture(g, e, 'Switchman / planted body lock'));
  until(g, e, () => e.attacks > 0);
  cells.push(capture(g, e, 'Switchman / hand receiver recoil'));
  until(g, e, () => g.annex.transmission?.phase === 'charging');
  const t = g.annex.transmission!;
  until(g, e, () => g.time >= t.at - TRANSMISSION.tell / 2);
  cells.push(capture(g, e, 'Switchman / actual radio charge'));
  until(g, e, () => g.time >= t.at - TRANSMISSION.lock);
  cells.push(capture(g, e, 'Switchman / remote signal locked'));
  until(g, e, () => g.annex.volleys > 0);
  cells.push(capture(g, e, 'Switchman / remote release only'));
  dispose(g);
  return cells;
}
function damage(kind: SignalUnit) {
  const { g, e } = course(kind),
    cells = [capture(g, e, kind + ' / intact')];
  e.timer = 100;
  g.hitEnemy(e, e.maxHp * 0.4, { x: e.body.position.x - 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / actual first hit'));
  g.hitStop = 0;
  g.time += 0.3;
  g.hitEnemy(e, e.maxHp * 0.35, { x: e.body.position.x + 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / actual heavy wear'));
  dispose(g);
  return cells;
}
function counterplay() {
  const { g, e } = course('caller', 'mechanisms');
  until(g, e, () => e.caller?.phase === 'locked');
  const callers = [capture(g, e, 'Caller / real locked queue')];
  Matter.Body.translate(e.body, { x: 45, y: 0 });
  g.tick(1 / 60, idle);
  if (e.caller!.phase !== 'ready') throw Error('Native displacement did not reset Caller');
  callers.push(capture(g, e, 'Caller / displaced queue cancelled'));
  for (let i = 0; i < 19; i++) g.tick(1 / 60, idle);
  callers.push(capture(g, e, 'Caller / cleared records remain empty'));
  dispose(g);
  const a = course('caller', 'friendly');
  until(a.g, a.e, () => a.e.caller?.phase === 'locked');
  callers.push(capture(a.g, a.e, 'Caller / actual friendly recording'));
  dispose(a.g);
  const b = course('switchman', 'mechanisms');
  until(b.g, b.e, () => b.g.annex.transmission?.phase === 'charging');
  const switches = [capture(b.g, b.e, 'Switchman / native charging owner')];
  if (!b.g.annex.interrupt()) throw Error('Native junction did not interrupt');
  b.g.machineBreakdown.update();
  switches.push(capture(b.g, b.e, 'Switchman / actual42HP feedback'));
  for (let i = 0; i < 22; i++) b.g.tick(1 / 60, idle);
  switches.push(capture(b.g, b.e, 'Switchman / native feedback settled'));
  dispose(b.g);
  const f = course('switchman', 'friendly');
  until(
    f.g,
    f.e,
    () => f.g.annex.transmission?.phase === 'charging' && f.g.annex.transmission.owner === f.e,
  );
  switches.push(capture(f.g, f.e, 'Switchman / actual friendly sender'));
  dispose(f.g);
  return [callers, switches];
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
    'Authored inspection courses; actual native recording, shots, feedback and allies. Captured production hardware; not a playtest or balance claim.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      c.save();
      c.translate(col * 320, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '12px Arial';
      c.fillText(cell.label, 16, 24);
      c.fillStyle = '#879d94';
      c.font = '10px Arial';
      c.fillText(cell.detail, 16, 43);
      c.beginPath();
      c.rect(12, 52, 296, 225);
      c.clip();
      c.translate(165, 184);
      c.scale(3.1, 3.1);
      const s = cell.visual;
      if (s.signalMachine?.grounded && s.signalMachine.supportY !== null) {
        const y = s.signalMachine.supportY - s.position.y;
        c.strokeStyle = '#3b5255';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(-42, y);
        c.lineTo(42, y);
        c.stroke();
      }
      drawSignalChassis(c, s, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const cycles = [callerCycle(), switchmanCycle()];
const result = {
  kind: 'Signal Machines actual native body/port distinction, queues, feedback and friendly hardware audit',
  sheets: [
    sheet(
      'signal-live-cycles.png',
      'Signal Machines / actual record, body shot and remote transmission cycles',
      cycles,
    ),
    sheet(
      'signal-damage-wear.png',
      'Signal Machines / actual native hits and persistent damage wear',
      (['caller', 'switchman'] as const).map(damage),
    ),
    sheet(
      'signal-feedback-friendly.png',
      'Signal Machines / native cancellation, junction feedback and blue allies',
      counterplay(),
    ),
    sheet(
      'signal-live-reduced.png',
      'Signal Machines / Reduced Effects hardware with native state retained',
      cycles,
      true,
    ),
  ],
};
writeFileSync(resolve(out, 'signal-live-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
