import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawContractChassis } from '../src/contract-machine-art.ts';
import { type ContractMachineKind } from '../src/contract-machine-pose.ts';
const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Contract Machines 5.42.0');
mkdirSync(out, { recursive: true });
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
const kinds = ['cableweaver', 'bulwark', 'demolisher'] as const;
function course(kind: ContractMachineKind) {
  const g = new Game(),
    f = huntTestFromUrl(new URL('https://test/?test=hunt&hunt=' + kind + '&v=1'))!;
  if (!f) throw Error('Invalid native hunt');
  g.startTest(f);
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  const e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw Error('Missing hunt actor');
  return { g, e };
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function until(g: Game, e: Enemy, check: () => boolean, max = 1200) {
  for (let i = 0; i < max && !check() && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  if (!check())
    throw Error(
      'Native Contract audit did not reach state ' +
        JSON.stringify({
          kind: e.kind,
          state: e.state,
          attack: e.attack,
          timer: e.timer,
          attacks: e.attacks,
          time: g.time,
          hp: g.hp,
          mode: g.mode,
        }),
    );
}
type Cell = { label: string; detail: string; visual: MachineBodySnapshot };
function capture(g: Game, e: Enemy, label: string): Cell {
  const visual = machineBodySnapshot(e, g.time, g);
  if (!visual) throw Error('Missing Contract snapshot');
  const h = visual.contractMachine!;
  return {
    label,
    detail:
      Math.round(e.hp) +
      '/' +
      Math.round(e.maxHp) +
      ' HP; ' +
      e.state +
      ' / ' +
      (e.attack ?? 'idle') +
      '; cables ' +
      h.cables.length +
      ' / plates ' +
      h.plates.length +
      ' / charges ' +
      h.mines.length,
    visual,
  };
}
function cableCycle() {
  const { g, e } = course('cableweaver');
  until(g, e, () => e.spawn <= 0);
  const cells = [capture(g, e, 'Cableweaver / native settled hull')];
  until(g, e, () => e.state === 'windup');
  cells.push(capture(g, e, 'Cableweaver / anchor deployment windup'));
  until(g, e, () => e.state === 'windup' && e.timer < 0.22);
  cells.push(capture(g, e, 'Cableweaver / loading drums and braced launcher'));
  until(g, e, () => g.hunts.cables.length === 1);
  cells.push(capture(g, e, 'Cableweaver / actual paired anchor deployment'));
  until(g, e, () => g.time >= g.hunts.cables[0].liveAt);
  cells.push(capture(g, e, 'Cableweaver / real live cable tension'));
  until(g, e, () => e.attacks >= 2);
  cells.push(capture(g, e, 'Cableweaver / admitted native volley'));
  dispose(g);
  return cells;
}
function bulwarkCycle() {
  const { g, e } = course('bulwark');
  until(g, e, () => e.spawn <= 0);
  const cells = [capture(g, e, 'Bulwark / native two-plate protection')];
  until(g, e, () => e.state === 'windup');
  cells.push(capture(g, e, 'Bulwark / hydraulic firing brace'));
  until(g, e, () => e.state === 'windup' && e.timer < 0.22);
  cells.push(capture(g, e, 'Bulwark / committed high muzzle'));
  until(g, e, () => e.attacks > 0);
  cells.push(capture(g, e, 'Bulwark / admitted native volley'));
  const first = g.hunts.plates[0];
  if (!first) throw Error('Missing actual shield plate');
  g.hunts.hitProp(first, 100, { x: 1, y: 0 }, true);
  cells.push(capture(g, e, 'Bulwark / first actual plate break'));
  g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
  cells.push(capture(g, e, 'Bulwark / actual exposed core'));
  dispose(g);
  return cells;
}
function demolisherCycle() {
  const { g, e } = course('demolisher');
  until(g, e, () => e.spawn <= 0);
  const cells = [capture(g, e, 'Demolisher / six remaining native charges')];
  until(g, e, () => e.state === 'windup');
  cells.push(capture(g, e, 'Demolisher / warned opening volley'));
  until(g, e, () => e.attacks > 0);
  cells.push(capture(g, e, 'Demolisher / admitted native volley'));
  until(g, e, () => e.state === 'windup' && e.attack === 'mortar' && e.timer < 0.3);
  cells.push(capture(g, e, 'Demolisher / real charge loader armed'));
  until(g, e, () => g.hunts.mines.length > 0);
  cells.push(capture(g, e, 'Demolisher / actual planted charge'));
  g.hunts.hitProp(g.hunts.mines[0].prop, 12, { x: 1, y: 0 }, true);
  cells.push(capture(g, e, 'Demolisher / actual disarm and spent rack cell'));
  dispose(g);
  return cells;
}
function damage(kind: ContractMachineKind) {
  const { g, e } = course(kind);
  until(g, e, () => e.spawn <= 0);
  const cells = [capture(g, e, kind + ' / intact casing')];
  e.timer = 100;
  const armor = g.hunts.armor(e);
  g.hitEnemy(e, (e.maxHp * 0.4) / armor, { x: e.body.position.x - 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / real accepted hull hit'));
  g.hitStop = 0;
  g.time += 0.3;
  g.hitEnemy(e, (e.maxHp * 0.35) / armor, { x: e.body.position.x + 80, y: e.body.position.y });
  cells.push(capture(g, e, kind + ' / real heavy casing wear'));
  dispose(g);
  return cells;
}
function mechanism(kind: ContractMachineKind) {
  const { g, e } = course(kind);
  until(g, e, () => e.spawn <= 0);
  const cells: Cell[] = [];
  if (kind === 'cableweaver') {
    until(g, e, () => g.hunts.cables.length > 0 && g.time >= g.hunts.cables[0].liveAt);
    cells.push(capture(g, e, 'Cableweaver / live native cable'));
    const a = g.hunts.cables[0].anchors[0];
    g.hunts.hitProp(a, 11, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Cableweaver / anchor damaged, span stays live'));
    g.hunts.hitProp(a, 11, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Cableweaver / actual anchor cut, tension released'));
  } else if (kind === 'bulwark') {
    cells.push(capture(g, e, 'Bulwark / actual two-plate armor gate'));
    g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Bulwark / one plate still protects'));
    g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Bulwark / both real plates broken'));
  } else {
    until(g, e, () => g.hunts.mines.length > 0);
    cells.push(capture(g, e, 'Demolisher / one native charge planted'));
    const m = g.hunts.mines[0];
    g.hunts.hitProp(m.prop, 6, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Demolisher / damaged charge keeps its fuse'));
    g.hunts.hitProp(m.prop, 6, { x: 1, y: 0 }, true);
    cells.push(capture(g, e, 'Demolisher / actual disarm, no charge reload'));
  }
  for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
  cells.push(capture(g, e, kind + ' / recovery hardware settled'));
  dispose(g);
  return cells;
}
function sheet(filename: string, title: string, rows: Cell[][], reduced = false) {
  const cols = Math.max(...rows.map((r) => r.length)),
    canvas = createCanvas(cols * 340, 80 + rows.length * 360),
    c = canvas.getContext('2d');
  c.fillStyle = '#101c22';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c6d1bd';
  c.font = '18px Arial';
  c.fillText(title, 20, 28);
  c.fillStyle = '#8aa399';
  c.font = '11px Arial';
  c.fillText(
    'Native hunt machinery, real admissions, gear and damage. Captured production rigs; no new combat rules. An inspection, not a human playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      c.save();
      c.translate(col * 340, 70 + row * 360);
      c.fillStyle = '#c6d1bd';
      c.font = '12px Arial';
      c.fillText(cell.label, 14, 24);
      c.fillStyle = '#8aa399';
      c.font = '10px Arial';
      c.fillText(cell.detail, 14, 43);
      c.beginPath();
      c.rect(10, 50, 320, 290);
      c.clip();
      c.translate(170, 269);
      c.scale(2, 2);
      const s = cell.visual,
        h = s.contractMachine;
      if (h?.grounded && h.supportY !== null) {
        const y = h.supportY - s.position.y;
        c.strokeStyle = '#385453';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-70, y);
        c.lineTo(70, y);
        c.stroke();
      }
      drawContractChassis(c, s, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const cycles = [cableCycle(), bulwarkCycle(), demolisherCycle()];
const receipt = {
  kind: 'Contract Machines actual native hull, gear release, armor, counterplay and wear audit',
  sheets: [
    sheet(
      'contract-live-cycles.png',
      'Contract Machines / actual native attack and deployment cycles',
      cycles,
    ),
    sheet(
      'contract-damage-wear.png',
      'Contract Machines / accepted hits and persistent health-based wear',
      kinds.map(damage),
    ),
    sheet(
      'contract-counterplay.png',
      'Contract Machines / actual cable cuts, shield breaks and charge disarms',
      kinds.map(mechanism),
    ),
    sheet(
      'contract-live-reduced.png',
      'Contract Machines / Reduced Effects with native gear information retained',
      cycles,
      true,
    ),
  ],
};
writeFileSync(resolve(out, 'contract-live-audit.json'), JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
