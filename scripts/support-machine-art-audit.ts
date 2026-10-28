import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy } from '../src/game.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { machineLanding, type MachineWreck } from '../src/machine-breakdown.ts';
import { drawMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import { FABRICATOR_BUILD } from '../src/fabricator.ts';
import { SUPPORT } from '../src/teamwork.ts';
import { drawSupportChassis } from '../src/support-machine-art.ts';
import {
  supportSystemsTestFromUrl,
  supportSystemsTestRoom,
  prepareSupportSystemsTest,
} from '../src/support-systems-test.ts';
import type { SupportMachineKind } from '../src/support-machine-pose.ts';

const native = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = native('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Support Systems 5.37.0');
mkdirSync(out, { recursive: true });
const kinds = ['repairer', 'relay', 'fabricator', 'sentry'] as const;
function course(kind: SupportMachineKind, scene: string) {
  const f = supportSystemsTestFromUrl(
    new URL('https://test/?test=support-systems&unit=' + kind + '&scene=' + scene + '&v=1'),
  )!;
  if (!f) throw new Error('Invalid native support inspection');
  const g = new Game();
  g.startTest(f.checkpoint, supportSystemsTestRoom(f));
  if (!prepareSupportSystemsTest(g, f)) throw new Error('Support inspection did not prepare');
  return g;
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function combat(kind: SupportMachineKind) {
  const g = course(kind, 'shutdowns'),
    e = g.enemies.find((e) => e.kind === kind)!;
  if (!e) throw new Error('Native machine missing');
  e.spawn = 0;
  const support = machineLanding(g, machineBodySnapshot(e, g.time, g)!);
  if (support) Matter.Body.setPosition(e.body, support.center);
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  g.hitEnemy(e, 100000);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  if (!wreck) throw new Error('Actual lethal hit produced no support wreck');
  dispose(g);
  return wreck;
}
function powerLoss(ready: boolean, progress = 0.5, ownerLost = false) {
  const g = course('fabricator', ready ? 'power-loss' : 'interruptions');
  const owner = g.enemies.find((e) => e.kind === 'fabricator')!;
  let frame = g.enemies.find((e) => e.sentry?.owner === owner.id);
  if (!frame) {
    owner.spawn = 0;
    owner.timer = 0;
    g.fabricators.updateBuilder(owner);
    frame = g.enemies.find((e) => e.sentry?.owner === owner.id);
  }
  if (!frame) throw new Error('Native Fabricator did not create a frame');
  frame.spawn = 0;
  if (ready && !frame.sentry!.ready) {
    owner.timer = 0;
    g.fabricators.updateBuilder(owner);
  }
  if (!ready) owner.timer = FABRICATOR_BUILD * (1 - progress);
  if (ready || ownerLost) g.hitEnemy(owner, 100000);
  else g.hitEnemy(owner, 1);
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === frame!.id)!;
  if (!wreck) throw new Error('Actual native removal produced no detached frame');
  dispose(g);
  return wreck;
}
type Cell = { label: string; wreck: MachineWreck; age: number; reduced?: boolean };
function sheet(filename: string, title: string, rows: Cell[][]) {
  const cols = Math.max(...rows.map((r) => r.length)),
    canvas = createCanvas(cols * 320, 80 + rows.length * 300),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(title, 20, 28);
  c.fillStyle = '#879d94';
  c.font = '12px Arial';
  c.fillText(
    'Authored support staging; actual native hits/removals, detached snapshots and production drawMachineWreck. Not a playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      const { wreck, age } = cell;
      c.save();
      c.translate(col * 320, 70 + row * 300);
      c.fillStyle = '#c5cbb8';
      c.font = '15px Arial';
      c.fillText(cell.label, 16, 24);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(
        (wreck.reason ?? 'combat') +
          ' / ' +
          (wreck.visual.supportMachine?.sentry?.ready === false
            ? 'partial ' + Math.round(wreck.visual.supportMachine.sentry.buildProgress * 100) + '%'
            : 'captured hardware'),
        16,
        43,
      );
      c.save();
      c.beginPath();
      c.rect(12, 48, 296, 230);
      c.clip();
      c.translate(160, 239);
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
        c.moveTo(anchor.x - 34, anchor.y);
        c.lineTo(anchor.x + 34, anchor.y);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, cell.reduced ?? false);
      c.restore();
      c.restore();
      panels++;
    }
  const path = resolve(out, filename);
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
type LiveCell = { label: string; detail: string; bodies: MachineBodySnapshot[] };
/** Authored stationary inspection: advance native controller clocks, never assign a presentation phase. */
function liveCycles(): LiveCell[][] {
  const rows: LiveCell[][] = [];
  for (const kind of ['repairer', 'relay'] as const) {
    const g = course(kind, 'animations'),
      e = g.enemies.find((e) => e.kind === kind)!;
    for (const actor of g.enemies) actor.spawn = 0;
    const patient = g.enemies.find((e) => e.kind === 'shooter' && e.body.position.x < 1400)!;
    const capture = (label: string): LiveCell => ({
      label,
      detail:
        kind === 'repairer'
          ? `Repair supply ${e.support!.remaining}/${SUPPORT.budget}; patient ${patient.hp}/${patient.maxHp} HP`
          : `${e.support!.remaining}/${SUPPORT.charges} actual charge cells`,
      bodies: [machineBodySnapshot(e, g.time, g)!],
    });
    const step = (dt: number) => {
      g.time += dt;
      g.teamwork.tick(dt);
      g.machineBreakdown.update();
    };
    g.machineBreakdown.update();
    const cells = [capture(kind + ' / idle')];
    step(e.support!.timer + 0.001);
    step(SUPPORT.tell / 2);
    cells.push(capture(kind + ' / native windup'));
    step(e.support!.timer + 0.001);
    if (kind === 'repairer') {
      cells.push(capture('Repairer / first real repair'));
      let turns = 0;
      while (patient.hp < patient.maxHp && e.support!.remaining > 0 && turns++ < 20)
        step(e.support!.timer + 0.001);
      cells.push(capture('Repairer / repair cycle finished'));
    } else {
      cells.push(capture('Relay / charged partner'));
      g.enemyShot(patient, Math.PI, 8, 10);
      if (!g.shots.some((shot) => shot.supportCharged))
        throw Error('Native Relay did not charge its partner shot');
      g.machineBreakdown.update();
      cells.push(capture('Relay / actual shot discharged'));
    }
    rows.push(cells);
    dispose(g);
  }
  {
    const g = course('fabricator', 'animations'),
      owner = g.enemies.find((e) => e.kind === 'fabricator')!;
    for (const actor of g.enemies) actor.spawn = 0;
    let child: Enemy | undefined;
    const capture = (label: string): LiveCell => ({
      label,
      detail: `Built ${owner.fabricator!.built}; ${child?.sentry?.ready ? 'ready owned Sentry' : child ? Math.round((1 - owner.timer / FABRICATOR_BUILD) * 100) + '% actual assembly' : 'native site search'}`,
      bodies: [
        machineBodySnapshot(owner, g.time, g)!,
        ...(child ? [machineBodySnapshot(child, g.time, g)!] : []),
      ],
    });
    const step = (dt: number) => {
      g.time += dt;
      owner.timer -= dt;
      g.fabricators.updateBuilder(owner);
      g.machineBreakdown.update();
    };
    g.machineBreakdown.update();
    const cells = [capture('Fabricator / seeking')];
    step(Math.max(0, owner.timer) + 0.001);
    child = g.enemies.find((e) => e.sentry?.owner === owner.id);
    if (!child) throw Error('Native Fabricator audit failed to create child');
    step(FABRICATOR_BUILD * 0.25);
    cells.push(capture('Fabricator / quarter assembled'));
    step(FABRICATOR_BUILD * 0.5);
    cells.push(capture('Fabricator / three quarters'));
    step(owner.timer + 0.001);
    cells.push(capture('Fabricator / actual completion'));
    rows.push(cells);
    dispose(g);
  }
  {
    const g = course('sentry', 'animations'),
      e = g.enemies.find((e) => e.kind === 'sentry')!;
    for (const actor of g.enemies) actor.spawn = 0;
    const capture = (label: string): LiveCell => ({
      label,
      detail: `Native ${e.state}; ${e.attacks} actual attacks; owner remains present`,
      bodies: [machineBodySnapshot(e, g.time, g)!],
    });
    const step = (dt: number) => {
      g.time += dt;
      e.timer -= dt;
      g.fabricators.updateSentry(e);
      g.machineBreakdown.update();
    };
    g.machineBreakdown.update();
    const cells = [capture('Sentry / assembled')];
    step(e.timer + 0.001);
    cells.push(capture('Sentry / tracking'));
    step(0.6);
    cells.push(capture('Sentry / locked aim'));
    step(e.timer + 0.001);
    if (e.attacks !== 1 || !g.shots.some((shot) => shot.sentryOwner === e.sentry!.owner))
      throw Error('Native Sentry audit failed to fire');
    cells.push(capture('Sentry / real firing recoil'));
    rows.push(cells);
    dispose(g);
  }
  return rows;
}
function liveSheet() {
  const rows = liveCycles(),
    canvas = createCanvas(1600, 80 + rows.length * 290),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    'Support mechanical cycles / actual native controllers and shared production chassis',
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '12px Arial';
  c.fillText(
    'Authored stationary staging; native clocks advanced for inspection. Real repair, charge consumption, assembly and discharge. Not a playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, cells] of rows.entries())
    for (const [col, cell] of cells.entries()) {
      c.save();
      c.translate(col * 400, 70 + row * 290);
      c.fillStyle = '#c5cbb8';
      c.font = '15px Arial';
      c.fillText(cell.label, 16, 24);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(cell.detail, 16, 44);
      c.beginPath();
      c.rect(12, 52, 376, 225);
      c.clip();
      c.translate(row === 2 ? 270 : 200, 205);
      c.scale(row === 2 ? 2.8 : 4, row === 2 ? 2.8 : 4);
      const source = cell.bodies[0];
      for (const body of cell.bodies) {
        c.save();
        c.translate(body.position.x - source.position.x, body.position.y - source.position.y);
        c.scale(body.scale, body.scale);
        drawSupportChassis(c, body);
        c.restore();
      }
      c.restore();
      panels++;
    }
  const path = resolve(out, 'support-live-cycles.png');
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const ages = [0.02, 0.16, 0.38, 0.8, 2],
  reducedAges = [0.05, 0.3, 0.75];
const losses = [
  { name: 'Ready Sentry / owner lost', make: () => powerLoss(true) },
  { name: 'Early frame / interrupted', make: () => powerLoss(false, 0.2) },
  { name: 'Late frame / interrupted', make: () => powerLoss(false, 0.65) },
  { name: 'Partial frame / owner lost', make: () => powerLoss(false, 0.45, true) },
];
console.log(
  JSON.stringify(
    {
      kind: 'authored native Support Systems shutdown sheets; exact live hardware, real support and non-scoring removal reasons; no balance claim',
      sheets: [
        liveSheet(),
        sheet(
          'support-shutdowns.png',
          'Support shutdowns / tools, cells, assembly arms and gun supports',
          kinds.map((kind) => {
            const wreck = combat(kind);
            return ages.map((age) => ({ label: kind + ' / +' + age.toFixed(2) + 's', wreck, age }));
          }),
        ),
        sheet(
          'support-shutdowns-reduced.png',
          'Support shutdowns / Reduced Effects',
          kinds.map((kind) => {
            const wreck = combat(kind);
            return reducedAges.map((age) => ({
              label: kind + ' / +' + age.toFixed(2) + 's',
              wreck,
              age,
              reduced: true,
            }));
          }),
        ),
        sheet(
          'support-power-loss.png',
          'Power loss and interrupted construction / actual surviving health and partial hardware',
          losses.map(({ name, make }) => {
            const wreck = make();
            return [0.02, 0.16, 0.38, 0.8].map((age) => ({
              label: name + ' / +' + age.toFixed(2) + 's',
              wreck,
              age,
            }));
          }),
        ),
      ],
    },
    null,
    2,
  ),
);
