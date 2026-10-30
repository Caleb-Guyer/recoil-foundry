import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import type { MachineWreck } from '../src/machine-breakdown.ts';
import type { OverseerMachineKind } from '../src/overseer-machine-pose.ts';
import { drawMachineWreck, projectMachineWreck } from '../src/machine-breakdown-wreck-art.ts';
import { welderTestFromUrl } from '../src/welder-test.ts';
import { WELD_TELL } from '../src/welder.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { auditorTestFromUrl } from '../src/auditor-layout.ts';
import { AUDITOR_VISIT, AUDITOR_WARNING } from '../src/auditor.ts';
const nativeCanvas = createRequire(resolve('.media-tools/canvas/package.json'));
const { createCanvas } = nativeCanvas('@napi-rs/canvas');
const out = resolve(process.argv[2] ?? '../../Factory Overseers 5.43.0');
mkdirSync(out, { recursive: true });
const kinds = ['welder', 'switchboard', 'auditor'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1100, y: 710 },
};
function floorOnly(g: Game) {
  for (const b of [...g.terrain])
    if (b.bounds.min.y < 739 && b.bounds.min.x >= 0 && b.bounds.max.x <= 2000) {
      Matter.Composite.remove(g.engine.world, b);
      g.terrain = g.terrain.filter((t) => t !== b);
    }
  for (const p of [...g.props.items]) g.props.remove(p);
}
function course(kind: OverseerMachineKind, recall = false) {
  const cp =
    kind === 'welder'
      ? welderTestFromUrl(new URL('https://test/?test=welder'))!
      : kind === 'switchboard'
        ? switchboardTestFromUrl(new URL('https://test/?test=switchboard&build=gun&mirror=0'))!
        : auditorTestFromUrl(
            new URL('https://test/?test=auditor&phase=' + (recall ? 'hunt' : 'final')),
          )!;
  assert(cp);
  const g = new Game();
  g.startTest(cp);
  g.time = 1;
  if (kind !== 'switchboard') {
    for (const e of [...g.enemies]) Matter.Composite.remove(g.engine.world, e.body);
    g.enemies = [];
    g.waves.clear();
    g.hazards.clear();
    g.mutations.clear();
  }
  floorOnly(g);
  let e: Enemy;
  if (kind === 'welder') {
    e = g.spawnEnemy('welder', 1100, 710);
    e.welder = { attack: 'seam', jumpAt: 0, stepAt: 0 };
  } else if (kind === 'switchboard') {
    e = g.enemies.find((e) => e.kind === 'switchboard')!;
    Matter.Body.setPosition(e.body, { x: 1400, y: 300 });
    g.engine.gravity.y = 0;
  } else {
    g.clear = false;
    g.auditor.update(2);
    assert(g.auditor.door);
    g.auditor.update(AUDITOR_WARNING + 0.01);
    e = g.auditor.enemy!;
    assert(e);
    Matter.Body.setPosition(e.body, { x: 1100, y: 711 });
  }
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  Matter.Body.setPosition(g.player, { x: 500, y: 700 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function welderAttack(g: Game, e: Enemy, attack: 'seam' | 'cover' | 'arc') {
  e.state = 'idle';
  e.timer = 0;
  e.attacks = attack === 'seam' ? 0 : attack === 'arc' ? 1 : 2;
  g.welder.updateEnemy(e, 0.001);
  assert.equal(e.state, 'windup');
  assert.equal(e.welder!.attack, attack);
  if (attack === 'arc') {
    e.timer = 0;
    g.time += WELD_TELL;
    g.welder.updateEnemy(e, 0.001);
  } else {
    g.time += WELD_TELL + 0.01;
    g.welder.update(WELD_TELL + 0.01);
  }
  g.machineBreakdown.update();
}
function switchStep(g: Game, e: Enemy, seconds: number) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    g.time += 1 / 60;
    g.switchboard.update(e, 1 / 60);
  }
  g.machineBreakdown.update();
}
function switchPlan(g: Game, e: Enemy, attack = 2) {
  e.attacks = attack;
  g.switchboard.begin(e);
  g.machineBreakdown.update();
  assert(e.switchboard!.plans.length);
}
function auditorFire(g: Game, e: Enemy) {
  e.auditor!.attack = 'burst';
  e.state = 'windup';
  e.timer = 0;
  g.auditor.updateEnemy(e, 0.001);
  assert.equal(e.state, 'rush');
  g.time += 0.01;
  g.auditor.updateEnemy(e, 0.001);
  g.machineBreakdown.update();
  assert.equal(e.auditor!.fired, 1);
  assert(g.shots.some((s) => s.auditorOwner === e.id));
}
function defeat(g: Game, e: Enemy) {
  g.hitEnemy(e, 1e9);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w, 'only real lethal damage captures a wreck');
  return w;
}
function native(kind: OverseerMachineKind) {
  const { g, e } = course(kind);
  if (kind === 'welder') welderAttack(g, e, 'seam');
  else if (kind === 'switchboard') switchPlan(g, e);
  else auditorFire(g, e);
  return { g, e, wreck: defeat(g, e) };
}
function combat(kind: OverseerMachineKind, state: string) {
  const { g, e } = course(kind, state === 'recall-kill');
  if (kind === 'welder') welderAttack(g, e, state as 'seam' | 'cover' | 'arc');
  else if (kind === 'switchboard') {
    switchPlan(g, e, state === 'transmission' ? 1 : state === 'feedback' ? 0 : 2);
    if (state === 'recording') {
      Matter.Body.setPosition(g.player, { x: 620, y: 650 });
      switchStep(g, e, 0.31);
      Matter.Body.setPosition(g.player, { x: 730, y: 610 });
      switchStep(g, e, 0.31);
      assert(e.switchboard!.plans[0].locked && !e.switchboard!.plans[0].cut);
    } else if (state === 'transmission') {
      switchStep(g, e, 1.42);
      assert(g.shots.some((s) => s.signalOwner === e.id));
    } else {
      e.hp = 50;
      assert(g.switchboard.interrupt(e.switchboard!.plans[0].slot));
    }
  } else if (state === 'burst') auditorFire(g, e);
  else if (state === 'charge') {
    e.auditor!.attack = 'charge';
    e.state = 'windup';
    e.timer = 0;
    g.auditor.updateEnemy(e, 0.001);
    g.time += 0.01;
    g.auditor.updateEnemy(e, 0.001);
    assert(e.state === 'rush' && e.auditor!.attack === 'charge');
    g.machineBreakdown.update();
  } else {
    g.auditor.age = AUDITOR_VISIT;
    g.auditor.update(0.01);
    assert(g.auditor.recall > 0 && e.state === 'return');
    g.machineBreakdown.update();
  }
  const wreck = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id) ?? defeat(g, e);
  assert(wreck.reason === 'combat');
  if (kind === 'welder')
    assert(
      !g.welder.seams.length && !g.welder.barriers.length && !g.props.items.some((p) => p.welded),
    );
  if (kind === 'switchboard')
    assert(!e.switchboard && !g.shots.some((s) => s.signalOwner === e.id && !s.friendly));
  if (kind === 'auditor')
    assert(
      g.auditor.state?.status === 'defeated' &&
        !g.auditor.enemy &&
        !g.shots.some((s) => s.auditorOwner === e.id),
    );
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
  return wreck;
}
const groups = [
  {
    unit: 'welder',
    rows: [
      { label: 'Welder / actual ignited seams', wreck: combat('welder', 'seam') },
      { label: 'Welder / real deployed walls', wreck: combat('welder', 'cover') },
      { label: 'Welder / native arc release', wreck: combat('welder', 'arc') },
    ],
  },
  {
    unit: 'switchboard',
    rows: [
      { label: 'Switchboard / locked playback records', wreck: combat('switchboard', 'recording') },
      { label: 'Switchboard / actual port dispatch', wreck: combat('switchboard', 'transmission') },
      { label: 'Switchboard / real lethal junction hit', wreck: combat('switchboard', 'feedback') },
    ],
  },
  {
    unit: 'auditor',
    rows: [
      { label: 'Auditor / partial native burst', wreck: combat('auditor', 'burst') },
      { label: 'Auditor / committed native charge', wreck: combat('auditor', 'charge') },
      { label: 'Auditor / lethal damage during recall', wreck: combat('auditor', 'recall-kill') },
    ],
  },
];
function sheet(unit: string, rows: { label: string; wreck: MachineWreck }[], reduced = false) {
  const ages = reduced ? [0.05, 0.3, 0.75] : [0.02, 0.16, 0.38, 0.8, 2],
    canvas = createCanvas(320 * ages.length, 80 + rows.length * 350),
    c = canvas.getContext('2d');
  c.fillStyle = '#101b21';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#c5cbb8';
  c.font = '17px Arial';
  c.fillText(
    'Factory Overseers / ' +
      unit +
      ' / ' +
      (reduced ? 'Reduced Effects' : 'actual native shutdowns'),
    20,
    28,
  );
  c.fillStyle = '#879d94';
  c.font = '11px Arial';
  c.fillText(
    'Actual defeat snapshots only. Native tool, signal and owned-shot cleanup retained. Auditor recall alone creates no corpse. Not a playtest.',
    20,
    50,
  );
  let panels = 0;
  for (const [row, { label, wreck }] of rows.entries())
    for (const [col, age] of ages.entries()) {
      const projection = projectMachineWreck(wreck, wreck.at + age, reduced);
      if (!projection) throw Error('Expected live native Overseer wreck projection');
      c.save();
      c.translate(col * 320, 70 + row * 350);
      c.fillStyle = '#c5cbb8';
      c.font = '13px Arial';
      c.fillText(label, 16, 23);
      c.fillText('+' + age.toFixed(2) + 's', 16, 42);
      c.fillStyle = '#879d94';
      c.font = '11px Arial';
      c.fillText(
        wreck.landing
          ? 'Native support drop ' +
              Math.round(wreck.landing.center.y - projection.position.y) +
              'px remains'
          : 'No native support; brief visual air fade',
        16,
        60,
      );
      c.beginPath();
      c.rect(12, 66, 296, 268);
      c.clip();
      c.translate(160, 245);
      c.scale(unit === 'switchboard' ? 2 : 2.5, unit === 'switchboard' ? 2 : 2.5);
      c.translate(-projection.position.x, -projection.position.y);
      if (wreck.landing) {
        const { point, normal } = wreck.landing,
          tangent = { x: -normal.y, y: normal.x };
        c.strokeStyle = '#334749';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(point.x - tangent.x * 60, point.y - tangent.y * 60);
        c.lineTo(point.x + tangent.x * 60, point.y + tangent.y * 60);
        c.stroke();
      }
      drawMachineWreck(c, wreck, wreck.at + age, reduced);
      c.restore();
      panels++;
    }
  const path = resolve(
    out,
    'overseer-' + unit + '-shutdowns' + (reduced ? '-reduced' : '') + '.png',
  );
  writeFileSync(path, canvas.toBuffer('image/png'));
  return { path, panels };
}
const sheets = groups.flatMap((g) => [sheet(g.unit, g.rows), sheet(g.unit, g.rows, true)]),
  report = {
    kind: 'Factory Overseers native defeat-only shutdown audit: real captured tools, plans and partial bursts; no corpse recall, signal, weld or owned projectile',
    sheets,
    panels: sheets.reduce((n, s) => n + s.panels, 0),
  };
writeFileSync(resolve(out, 'overseer-wreck-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
