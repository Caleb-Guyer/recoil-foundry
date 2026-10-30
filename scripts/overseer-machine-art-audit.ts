import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import {
  overseersTestFromUrl,
  overseersTestRoom,
  prepareOverseersTest,
} from '../src/overseers-test.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawOverseerChassis } from '../src/overseer-machine-art.ts';
import { overseerMachinePose, type OverseerMachineKind } from '../src/overseer-machine-pose.ts';
import { AUDITOR_VISIT, AUDITOR_RECALL, AUDITOR_WARNING } from '../src/auditor.ts';
import { WELD_TELL } from '../src/welder.ts';
const nativeCanvas = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = nativeCanvas('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Factory Overseers 5.43.0');
mkdirSync(out, { recursive: true });
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1450, y: 700 },
};
const kinds = ['welder', 'switchboard', 'auditor'] as const;
type Cell = { label: string; detail: string; visual: MachineBodySnapshot };
function course(kind: OverseerMachineKind, recall = false) {
  const f = overseersTestFromUrl(
    new URL(
      `https://test/?test=overseers&unit=${kind}&scene=${recall ? 'recall' : 'animations'}&v=1`,
    ),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, overseersTestRoom(f));
  assert(prepareOverseersTest(g, f));
  if (kind === 'auditor') until(g, () => !!g.auditor.enemy);
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  until(g, () => e.spawn <= 0);
  return { g, e };
}
function until(g: Game, check: () => boolean, max = 1500) {
  for (let i = 0; i < max && !check() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert(
    check(),
    `Unreached native audit state: ${g.mode} ${g.time} ${g.hp} ${JSON.stringify(g.enemies.map((e) => [e.kind, e.state, e.timer, e.attacks]))}`,
  );
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function capture(g: Game, e: Enemy, label: string): Cell {
  const visual = machineBodySnapshot(e, g.time, g)!;
  assert(visual);
  const p = overseerMachinePose(visual);
  return {
    label,
    detail: `${Math.round(e.hp)}/${e.maxHp} HP | ${p.mode} | actual admissions ${visual.overseerMachine!.discharges.length}`,
    visual,
  };
}
function welderCycle() {
  const { g, e } = course('welder');
  const a = [capture(g, e, 'Welder / settled native tracked frame')];
  until(g, () => e.state === 'windup' && e.welder?.attack === 'seam');
  a.push(capture(g, e, 'Welder / real seam tracing'));
  until(g, () => e.state === 'windup' && e.timer < 0.45);
  a.push(capture(g, e, 'Welder / heat builds during native tell'));
  until(g, () => e.state === 'recover');
  a.push(capture(g, e, 'Welder / actual cooling armor opening'));
  until(g, () => e.state === 'windup' && e.welder?.attack === 'arc');
  a.push(capture(g, e, 'Welder / warned native arc aim'));
  until(g, () => !!g.machineBreakdown.getOverseerMachine(e)?.discharges.length);
  a.push(capture(g, e, 'Welder / admitted five-round torch release'));
  dispose(g);
  return a;
}
function switchCycle() {
  const { g, e } = course('switchboard');
  const a = [capture(g, e, 'Switchboard / native floating cabinet')];
  until(g, () => !!e.switchboard?.plans.length);
  a.push(capture(g, e, 'Switchboard / actual plan starts'));
  until(g, () => e.switchboard!.elapsed > 0.28);
  a.push(capture(g, e, 'Switchboard / recording physical channel'));
  until(g, () => e.switchboard!.plans.some((p) => p.locked));
  a.push(capture(g, e, 'Switchboard / real sample locked'));
  until(g, () => !!g.machineBreakdown.getOverseerMachine(e)?.discharges.length);
  a.push(capture(g, e, 'Switchboard / admitted native port release'));
  until(g, () => e.state === 'recover');
  a.push(capture(g, e, 'Switchboard / settled recovery cabinet'));
  dispose(g);
  return a;
}
function auditorCycle() {
  const { g, e } = course('auditor');
  const a = [capture(g, e, 'Auditor / actual warned-door arrival')];
  until(g, () => e.state === 'windup');
  a.push(capture(g, e, 'Auditor / native firing brace'));
  until(g, () => e.state === 'rush');
  a.push(capture(g, e, 'Auditor / real loaded attack enters rush'));
  until(g, () => !!g.machineBreakdown.getOverseerMachine(e)?.discharges.length);
  a.push(capture(g, e, 'Auditor / admitted clipped-muzzle shot'));
  until(g, () => e.auditor!.fired >= e.auditor!.rounds);
  a.push(capture(g, e, 'Auditor / native rounds spent'));
  until(g, () => e.state === 'recover');
  a.push(capture(g, e, 'Auditor / receiver and gait recover'));
  dispose(g);
  return a;
}
function damage(kind: OverseerMachineKind) {
  const { g, e } = course(kind),
    a = [capture(g, e, `${kind} / intact casing`)];
  e.state = 'recover';
  const armor = kind === 'welder' ? 1.5 : kind === 'switchboard' ? 1.25 : 1;
  g.hitEnemy(e, (e.maxHp * 0.4) / armor, { x: e.body.position.x - 80, y: e.body.position.y });
  a.push(capture(g, e, `${kind} / accepted directional hit, 60% HP`));
  g.time += 0.3;
  g.hitStop = 0;
  g.hitEnemy(e, (e.maxHp * 0.35) / armor, { x: e.body.position.x + 80, y: e.body.position.y });
  a.push(capture(g, e, `${kind} / opposite hit, 25% HP wear`));
  dispose(g);
  return a;
}
function stepSwitch(g: Game, e: Enemy, t: number) {
  for (let i = 0; i < Math.ceil(t * 60); i++) {
    g.time += 1 / 60;
    g.switchboard.update(e, 1 / 60);
  }
  g.machineBreakdown.update();
}
function welderMechanism() {
  const { g, e } = course('welder');
  // Drive the real cover attack entry on the authored arena; no cosmetic wall or interruption is synthesized.
  e.state = 'idle';
  e.timer = 0;
  e.attacks = 2;
  g.welder.updateEnemy(e, 0.001);
  assert.equal(e.welder!.attack, 'cover');
  const a = [capture(g, e, 'Welder / actual cover-deployment warning')];
  g.time += WELD_TELL + 0.01;
  g.welder.update(WELD_TELL + 0.01);
  const walls = g.welder.presentationWalls(e);
  assert(walls.length > 0);
  a.push(capture(g, e, 'Welder / native cover built'));
  const wall = walls[0];
  g.props.hit(wall, 120, { x: 1, y: 0 }, true);
  assert(!g.props.items.includes(wall));
  a.push(capture(g, e, 'Welder / actual wall break releases tool catch'));
  e.timer = 0;
  g.welder.updateEnemy(e, 0.001);
  a.push(capture(g, e, 'Welder / real cooling shutters open'));
  dispose(g);
  return a;
}
function switchMechanism() {
  const { g, e } = course('switchboard');
  e.state = 'recover';
  g.hitEnemy(e, (e.maxHp * 0.55) / 1.25);
  e.attacks = 3;
  e.switchboard!.wait = 0;
  g.switchboard.update(e, 0.001);
  assert.equal(e.phase, 1);
  e.switchboard!.wait = 0;
  g.switchboard.update(e, 0.001);
  const a = [capture(g, e, 'Switchboard / actual two-pattern second phase')];
  stepSwitch(g, e, 0.31);
  a.push(capture(g, e, 'Switchboard / native record and staggered channel'));
  stepSwitch(g, e, 0.31);
  a.push(capture(g, e, 'Switchboard / real first sample lock'));
  const slot = e.switchboard!.plans[0].slot;
  assert(g.switchboard.interrupt(slot));
  a.push(capture(g, e, 'Switchboard / actual junction cut, channel released'));
  stepSwitch(g, e, 1.2);
  assert(g.machineBreakdown.getOverseerMachine(e)!.discharges.length);
  a.push(capture(g, e, 'Switchboard / surviving actual channel transmits'));
  dispose(g);
  return a;
}
function auditorCharge() {
  const { g, e } = course('auditor');
  e.state = 'windup';
  e.timer = 0.45;
  e.auditor!.attack = 'charge';
  e.aim = { x: -1, y: 0 };
  const a = [capture(g, e, 'Auditor / native committed charge warning')];
  e.timer = 0;
  g.auditor.updateEnemy(e, 0.001);
  a.push(capture(g, e, 'Auditor / actual rush brace'));
  g.time += 0.1;
  g.auditor.updateEnemy(e, 0.001);
  a.push(capture(g, e, 'Auditor / real horizontal charge velocity'));
  dispose(g);
  return a;
}
function auditorRecall() {
  const { g, e } = course('auditor', true);
  const a = [capture(g, e, 'Auditor / living first-visit chassis')];
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  a.push(capture(g, e, 'Auditor / native timed recall starts'));
  g.time += AUDITOR_RECALL * 0.5;
  g.auditor.update(AUDITOR_RECALL * 0.5);
  a.push(capture(g, e, 'Auditor / living case latch opens'));
  g.time += AUDITOR_RECALL * 0.35;
  g.auditor.update(AUDITOR_RECALL * 0.35);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  a.push(capture(g, e, 'Auditor / actual recall, no defeat or wreck'));
  dispose(g);
  return a;
}
function sheet(filename: string, title: string, rows: Cell[][], reduced = false) {
  const cols = Math.max(...rows.map((r) => r.length)),
    canvas = createCanvas(cols * 340, 80 + rows.length * 310),
    c = canvas.getContext('2d');
  c.fillStyle = '#101c22';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c6d1bd';
  c.font = '18px Arial';
  c.fillText(title, 20, 28);
  c.fillStyle = '#8aa399';
  c.font = '11px Arial';
  c.fillText(
    'Actual private native rooms and controller events. Production chassis; no cosmetic attacks or combat changes. An inspection, not a human playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      c.save();
      c.translate(col * 340, 70 + row * 310);
      c.fillStyle = '#c6d1bd';
      c.font = '12px Arial';
      c.fillText(cell.label, 12, 24);
      c.fillStyle = '#8aa399';
      c.font = '10px Arial';
      c.fillText(cell.detail, 12, 42);
      c.beginPath();
      c.rect(8, 50, 324, 242);
      c.clip();
      c.translate(170, 193);
      c.scale(2.2, 2.2);
      const s = cell.visual,
        h = s.overseerMachine!;
      if (h.grounded && h.supportY !== null) {
        c.strokeStyle = '#385453';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-70, h.supportY - s.position.y);
        c.lineTo(70, h.supportY - s.position.y);
        c.stroke();
      }
      drawOverseerChassis(c, s, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const cycles = [welderCycle(), switchCycle(), auditorCycle()],
  mechanisms = [welderMechanism(), switchMechanism(), auditorCharge(), auditorRecall()];
const receipt = {
  kind: 'Factory Overseers native live chassis, admissions, cooling, channels, charge, recall and wear audit',
  sheets: [
    sheet('overseer-live-cycles.png', 'Factory Overseers / actual native attack cycles', cycles),
    sheet(
      'overseer-damage-wear.png',
      'Factory Overseers / actual directional hits and health-based wear',
      kinds.map(damage),
    ),
    sheet(
      'overseer-live-counterplay.png',
      'Factory Overseers / actual cover breaks, junction cuts, charge and living recall',
      mechanisms,
    ),
    sheet(
      'overseer-live-reduced.png',
      'Factory Overseers / Reduced Effects, native mechanism information retained',
      cycles,
      true,
    ),
    sheet(
      'overseer-counterplay-reduced.png',
      'Factory Overseers / Reduced Effects counterplay and living recall',
      mechanisms,
      true,
    ),
  ],
};
writeFileSync(resolve(out, 'overseer-live-audit.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
