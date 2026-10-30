import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import {
  overseersTestFromUrl,
  overseersTestRoom,
  prepareOverseersTest,
} from '../src/overseers-test.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import {
  overseerMachinePose,
  isOverseerMachineKind,
  type OverseerMachineKind,
} from '../src/overseer-machine-pose.ts';
import { WELD_TELL } from '../src/welder.ts';
import { SIGNAL, signalPoint } from '../src/switchboard.ts';
import { AUDITOR_WARNING, AUDITOR_VISIT, AUDITOR_RECALL } from '../src/auditor.ts';
import { MACHINE_MAX_HITS } from '../src/machine-breakdown.ts';
const { Body, Bodies, Composite } = Matter,
  DT = 1 / 60;
const kinds: OverseerMachineKind[] = ['welder', 'switchboard', 'auditor'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1200, y: 710 },
};
function fixture(kind: OverseerMachineKind = 'welder', recall = false) {
  const f = overseersTestFromUrl(
      new URL(
        `https://test/?test=overseers&unit=${kind}&scene=${recall ? 'recall' : 'animations'}&v=1`,
      ),
    )!,
    g = new Game();
  g.startTest(f.checkpoint, overseersTestRoom(f));
  assert(prepareOverseersTest(g, f));
  g.waves.clear();
  if (kind === 'auditor') {
    g.auditor.update(2);
    assert(g.auditor.door);
    g.auditor.update(AUDITOR_WARNING + 0.01);
    assert(g.auditor.enemy);
  }
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  g.hazards.clear();
  for (const p of [...g.props.items]) g.props.remove(p);
  Body.setPosition(g.player, { x: 500, y: 722 });
  Body.setStatic(g.player, true);
  g.engine.gravity.y = 0;
  Body.setPosition(e.body, {
    x: 1200,
    y: kind === 'switchboard' ? 300 : 740 - (e.body.bounds.max.y - e.body.bounds.min.y) / 2,
  });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function snapshot(g: Game, e: Enemy) {
  return machineBodySnapshot(e, g.time, g)!;
}
function step(g: Game, e: Enemy, dt = DT) {
  g.time += dt;
  g.updateEnemy(e, dt);
  if (e.kind === 'welder') g.welder.update(dt);
  if (e.kind === 'auditor') g.auditor.update(dt);
  g.machineBreakdown.update();
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 1000) {
  for (let i = 0; i < max && !condition(); i++) step(g, e);
  assert(condition(), 'native Overseer condition not reached');
}
function cover(g: Game, e: Enemy) {
  g.welder.planBarriers(e);
  assert(g.welder.barriers.length);
  g.time += WELD_TELL;
  g.welder.update(WELD_TELL);
  g.machineBreakdown.update();
  assert(g.welder.presentationWalls(e).length);
}
function arc(g: Game, e: Enemy) {
  e.welder ??= { attack: 'arc', jumpAt: 0, stepAt: 0 };
  e.welder.attack = 'arc';
  e.state = 'windup';
  e.timer = 0;
  e.aim = { x: -1, y: 0 };
  g.welder.updateEnemy(e, DT);
  g.machineBreakdown.update();
}
function board(g: Game, e: Enemy, mobile = false) {
  g.switchboard.begin(e);
  if (mobile) {
    const p = e.switchboard!.plans[0];
    p.mobile = true;
    p.origin = { ...e.body.position };
  }
  until(g, e, () => e.switchboard!.plans.every((p) => p.locked || p.cut));
  assert(e.switchboard!.plans.some((p) => p.locked && !p.cut));
  return e.switchboard!.plans[0];
}
function auditShot(g: Game, e: Enemy, attack: 'burst' | 'fan' | 'sweep' = 'burst') {
  e.auditor!.attack = attack;
  e.auditor!.fired = 0;
  e.auditor!.rounds = attack === 'burst' ? 3 : attack === 'sweep' ? 5 : 1;
  e.auditor!.nextShot = g.time;
  e.state = 'rush';
  e.timer = 0.75;
  e.aim = { x: -1, y: 0 };
  g.auditor.updateEnemy(e, DT);
  g.machineBreakdown.update();
}
function fill(g: Game, n: number) {
  for (let i = 0; i < n; i++)
    assert(
      g.addShot({
        pos: { x: 50, y: 100 },
        vel: { x: 1, y: 0 },
        damage: 1,
        life: 4,
        friendly: false,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: false,
        split: false,
      }),
    );
}
function plain(v: unknown) {
  if (!v || typeof v !== 'object') return;
  assert(Object.getPrototypeOf(v) === Object.prototype || Array.isArray(v));
  for (const x of Object.values(v)) plain(x);
}
function finite(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (v && typeof v === 'object') for (const x of Object.values(v)) finite(x);
}
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('only Welder, Switchboard and Auditor join Overseer presentation; preceding machines and other bosses keep their families', () => {
  for (const kind of kinds) {
    const { g, e } = fixture(kind);
    assert(isMachineKind(kind) && isOverseerMachineKind(kind));
    const s = snapshot(g, e);
    assert(s.overseerMachine);
    assert.equal(machinePose(s).kind, kind);
    plain(s);
    finite(overseerMachinePose(s));
  }
  for (const kind of [
    'runner',
    'caller',
    'switchman',
    'cableweaver',
    'bulwark',
    'demolisher',
    'loader',
    'crane',
    'sorter',
    'condenser',
    'boss',
    'turbine',
    'interceptor',
  ])
    assert(!isOverseerMachineKind(kind));
  for (const kind of ['loader', 'crane', 'sorter', 'condenser', 'boss', 'turbine', 'interceptor'])
    assert(!isMachineKind(kind));
});

test('Welder torch and tracks follow real support, seam warnings, accepted ignition and the native cooling opening', () => {
  const { g, e } = fixture();
  g.welder.traceSeams(e);
  const h = snapshot(g, e).overseerMachine!.welder!;
  assert(h.seams.length);
  assert(h.seams.every((s) => !s.ignited));
  assert.equal(g.machineBreakdown.getOverseerMachine(e)?.deployments.at(-1)?.kind, 'seam-trace');
  g.time += WELD_TELL;
  g.welder.update(WELD_TELL);
  g.machineBreakdown.update();
  assert(snapshot(g, e).overseerMachine!.welder!.seams.every((s) => s.ignited));
  assert.equal(g.machineBreakdown.getOverseerMachine(e)?.deployments.at(-1)?.kind, 'seam-ignite');
  assert.equal(overseerMachinePose(snapshot(g, e)).torch.heat, 1);
  e.state = 'recover';
  e.timer = 2.2;
  assert.equal(overseerMachinePose(snapshot(g, e)).torch.opening, 1);
  assert.equal(overseerMachinePose(snapshot(g, e)).tracks.length, 2);
  assert(snapshot(g, e).overseerMachine!.grounded);
  const supported = snapshot(g, e),
    p = overseerMachinePose(supported);
  assert(
    p.tracks.every(
      (t) =>
        t.center.y + 8 <=
        (supported.overseerMachine!.supportY! - supported.position.y) / supported.scale,
    ),
    'track belts stay above their actual supporting surface',
  );
});

test('Welder only records actual cover placements and genuine player breaks; replacement and expiry create no break feedback', () => {
  const { g, e } = fixture();
  cover(g, e);
  const walls = g.welder.presentationWalls(e);
  assert.equal(walls.length, 2);
  const h = snapshot(g, e).overseerMachine!;
  assert.equal(h.welder!.walls.length, 2);
  assert.equal(h.deployments.filter((d) => d.kind === 'barrier').length, 2);
  const p = walls[0];
  g.props.hit(p, 110, { x: 1, y: 0 }, undefined, true, true);
  assert.equal(
    g.machineBreakdown.getOverseerMachine(e)?.interruptions.at(-1)?.kind,
    'barrier-break',
  );
  assert.equal(g.welder.presentationWalls(e).length, 1);
  assert.equal(h.welder!.walls[0].hp, 110, 'captured cover remains detached');
  g.time += 1;
  g.machineBreakdown.update();
  g.welder.planBarriers(e);
  assert.equal(g.machineBreakdown.getOverseerMachine(e)?.interruptions.length, 0);
  g.time += WELD_TELL;
  g.welder.update(WELD_TELL);
  const expired = g.welder.presentationWalls(e)[0];
  assert(expired);
  g.time = expired.expires!;
  expired.hp = 0;
  g.welder.brokenBarrier(expired);
  assert.equal(g.machineBreakdown.getOverseerMachine(e)?.interruptions.length, 0);
});

test('occupied Welder cover warnings cancel with no fake wall or deployment event', () => {
  const { g, e } = fixture();
  g.welder.planBarriers(e);
  const candidates = g.welder.barriers.slice();
  assert.equal(candidates.length, 2);
  Body.setPosition(g.player, { x: candidates[0].x, y: candidates[0].y });
  g.time += WELD_TELL;
  g.welder.update(WELD_TELL);
  g.machineBreakdown.update();
  const walls = g.welder.presentationWalls(e);
  assert.equal(walls.length, 1);
  assert.equal(
    g.machineBreakdown.getOverseerMachine(e)?.deployments.filter((d) => d.kind === 'barrier')
      .length,
    1,
  );
  assert.equal(g.welder.barriers.length, 0);
});

test('Welder arc recoil uses every actual admitted 26px native muzzle and never an attempted counter', () => {
  for (const available of [0, 1, 5]) {
    const { g, e } = fixture();
    fill(g, 180 - available);
    arc(g, e);
    const d = g.machineBreakdown.getOverseerMachine(e)!.discharges;
    assert.equal(d.length, available);
    assert.equal(g.shots.length, 180);
    for (const shot of d) {
      assert.equal(shot.source, 'body');
      assert.deepEqual(shot.origin, e.body.position);
      near(Math.hypot(shot.muzzle.x - shot.origin.x, shot.muzzle.y - shot.origin.y), 26);
    }
    assert.equal(overseerMachinePose(snapshot(g, e)).recoil > 0, available > 0);
  }
});

test('Switchboard channels follow native recording and lock; remote admissions animate channels without recoiling a body gun', () => {
  const { g, e } = fixture('switchboard'),
    p = board(g, e),
    s = snapshot(g, e),
    o = s.overseerMachine!.switchboard!;
  assert.equal(o.plans[0].locked, true);
  assert.deepEqual(o.plans[0].port, signalPoint(g, p.slot, 'port'));
  assert(overseerMachinePose(s).channels[p.slot].locked);
  until(g, e, () => g.machineBreakdown.getOverseerMachine(e)!.discharges.length > 0);
  const after = snapshot(g, e),
    d = after.overseerMachine!.discharges[0];
  assert.equal(d.source, 'port');
  assert.equal(d.slot, p.slot);
  assert.deepEqual(d.origin, p.origin);
  assert.equal(overseerMachinePose(after).recoil, 0);
  assert(overseerMachinePose(after).channels[p.slot].release > 0);
});

test('native Switchboard mobile plans use the actual body-origin muzzle and full/partial caps never invent emissions', () => {
  const a = fixture('switchboard'),
    p = board(a.g, a.e, true);
  until(a.g, a.e, () => a.g.machineBreakdown.getOverseerMachine(a.e)!.discharges.length > 0);
  const d = a.g.machineBreakdown.getOverseerMachine(a.e)!.discharges[0];
  assert.equal(d.source, 'body');
  assert.equal(d.slot, p.slot);
  assert(overseerMachinePose(snapshot(a.g, a.e)).recoil > 0);
  for (const available of [0, 1]) {
    const { g, e } = fixture('switchboard');
    board(g, e);
    fill(g, 180 - available);
    for (let i = 0; i < 150; i++) step(g, e);
    const events = g.machineBreakdown.getOverseerMachine(e)!.discharges;
    assert(events.length <= available);
    assert.equal(g.shots.length, 180);
    assert.equal(overseerMachinePose(snapshot(g, e)).recoil, 0);
  }
});

test('actual Switchboard junction feedback records native multiplied damage and prelethal remaining health, never a successful transmission', () => {
  for (const lethal of [false, true]) {
    const { g, e } = fixture('switchboard'),
      p = board(g, e);
    if (lethal) e.hp = 40;
    const hp = e.hp;
    assert(g.switchboard.interrupt(p.slot));
    const hit = lethal
      ? g.machineBreakdown.wrecks[0].visual.overseerMachine!
      : snapshot(g, e).overseerMachine!;
    const cut = hit.interruptions.at(-1)!;
    assert.equal(cut.kind, 'junction-cut');
    near(cut.healthLost!, Math.min(hp, 70 * 1.55));
    assert.deepEqual(cut.position, signalPoint(g, p.slot, 'junction'));
    assert.equal(hit.discharges.length, 0);
    if (lethal) {
      assert.equal(g.machineBreakdown.wrecks[0].hit!.healthLost, 40);
      assert(g.machineBreakdown.overseerShutdownActive);
    } else {
      assert.equal(e.switchboard!.cooldown, SIGNAL.cooldown);
      assert(!g.switchboard.interrupt(p.slot));
    }
  }
});

test('Auditor braced burst, sweep magazine and clipped muzzle use admitted direct native shots only', () => {
  for (const attack of ['burst', 'sweep', 'fan'] as const) {
    const { g, e } = fixture('auditor');
    auditShot(g, e, attack);
    const d = g.machineBreakdown.getOverseerMachine(e)!.discharges;
    assert.equal(d.length, attack === 'fan' ? 5 : 1);
    assert(d.every((d) => d.source === 'body'));
    assert.equal(
      overseerMachinePose(snapshot(g, e)).magazine.filter((m) => m.loaded).length,
      attack === 'burst' ? 2 : attack === 'sweep' ? 4 : 0,
    );
    for (const shot of d)
      near(Math.hypot(shot.muzzle.x - shot.origin.x, shot.muzzle.y - shot.origin.y), 35);
  }
  const { g, e } = fixture('auditor'),
    wall = Bodies.rectangle(e.body.position.x - 20, e.body.position.y, 6, 100, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  auditShot(g, e);
  const d = g.machineBreakdown.getOverseerMachine(e)!.discharges[0];
  assert(d);
  assert(Math.hypot(d.muzzle.x - d.origin.x, d.muzzle.y - d.origin.y) < 35);
  assert.deepEqual(d.muzzle, g.shots[0].pos);
});

test('fully rejected and partial Auditor fans do not turn attempt counters into fake receiver recoil', () => {
  for (const available of [0, 1, 3]) {
    const { g, e } = fixture('auditor');
    fill(g, 180 - available);
    auditShot(g, e, 'fan');
    assert.equal(e.auditor!.fired, 1);
    assert.equal(g.machineBreakdown.getOverseerMachine(e)!.discharges.length, available);
    assert.equal(overseerMachinePose(snapshot(g, e)).recoil > 0, available > 0);
  }
});

test('Auditor committed charge is a native rush rather than a projectile or recall', () => {
  const { g, e } = fixture('auditor');
  e.auditor!.attack = 'charge';
  e.state = 'windup';
  e.timer = 0;
  e.aim = { x: -1, y: 0 };
  g.auditor.updateEnemy(e, DT);
  g.auditor.updateEnemy(e, DT);
  g.machineBreakdown.update();
  assert.equal(e.state, 'rush');
  assert.equal(e.body.velocity.x, -11.5);
  assert.equal(g.machineBreakdown.getOverseerMachine(e)!.discharges.length, 0);
  assert.equal(overseerMachinePose(snapshot(g, e)).recoil, 0);
  assert(!snapshot(g, e).overseerMachine!.auditor!.returning);
});

test('native Auditor recall freezes on Pause and retreats without a corpse, kill reward, completion hold or retained presentation records', () => {
  const { g, e } = fixture('auditor', true);
  auditShot(g, e);
  g.hitEnemy(e, 10, { x: 1000, y: 710 }, false);
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  g.machineBreakdown.update();
  assert(e.state === 'return' && g.auditor.recall > 0);
  assert.equal(overseerMachinePose(snapshot(g, e)).mode, 'recall');
  g.setMode('paused');
  const before = g.auditor.recall;
  for (let i = 0; i < 120; i++) g.tick(DT, idle);
  assert.equal(g.auditor.recall, before);
  g.setMode('playing');
  g.auditor.update(AUDITOR_RECALL + 0.1);
  assert(!g.auditor.enemy);
  assert(g.auditor.state!.retreated);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  assert.equal(g.machineBreakdown.getOverseerMachine(e), null);
  assert.deepEqual(g.machineBreakdown.getHits(e.id), []);
  assert(!g.machineBreakdown.shutdownActive);
  assert.equal(g.kills, 0);
  assert.equal(g.shots.filter((s) => s.auditorOwner === e.id).length, 0);
});

test('a genuinely lethal hit during Auditor recall still records a true defeat before native owner-shot cleanup', () => {
  const { g, e } = fixture('auditor', true);
  auditShot(g, e);
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  assert(g.auditor.recall > 0);
  g.hitEnemy(e, 100000, { x: 1000, y: 710 }, false);
  assert.equal(g.auditor.state!.status, 'defeated');
  assert.equal(g.machineBreakdown.wrecks.length, 1);
  assert(g.machineBreakdown.wrecks[0].visual.overseerMachine!.auditor!.returning);
  assert.equal(g.machineBreakdown.wrecks[0].hit!.healthLost, 1800);
  assert.equal(g.kills, 1);
  assert.equal(g.shots.filter((s) => s.auditorOwner === e.id).length, 0);
});

test('Overseer hull reactions and wear use accepted native damage while preserving controls and every armor multiplier', () => {
  for (const kind of kinds) {
    const { g, e } = fixture(kind),
      before = {
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
      },
      hp = e.hp;
    g.hitEnemy(e, 100, { x: e.body.position.x - 150, y: e.body.position.y }, false);
    const lost = kind === 'welder' ? 55 : 60;
    near(e.hp, hp - lost);
    near(g.machineBreakdown.getHits(e.id).at(-1)!.healthLost, lost);
    assert(overseerMachinePose(snapshot(g, e)).body.x > 0);
    assert.deepEqual(
      {
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
      },
      before,
    );
    e.hp = e.maxHp * 0.6;
    assert.equal(overseerMachinePose(snapshot(g, e)).wear, 1);
    e.hp = e.maxHp * 0.2;
    assert.equal(overseerMachinePose(snapshot(g, e)).wear, 2);
    const reduced = overseerMachinePose(snapshot(g, e), true);
    assert.equal(reduced.recoil, 0);
    assert.equal(reduced.body.x, 0);
    assert.equal(reduced.angle, 0);
  }
});

test('true Overseer defeats capture preclear native mechanisms and preserve each native cleanup rule', () => {
  for (const kind of kinds) {
    const { g, e } = fixture(kind);
    if (kind === 'welder') {
      cover(g, e);
      g.welder.traceSeams(e);
      arc(g, e);
    }
    if (kind === 'switchboard') {
      board(g, e);
      until(g, e, () => g.shots.length > 0);
    }
    if (kind === 'auditor') auditShot(g, e);
    const before = snapshot(g, e);
    g.hitEnemy(e, 100000, { x: 1000, y: 710 }, false, false, false);
    assert.equal(g.machineBreakdown.wrecks.length, 1);
    const w = g.machineBreakdown.wrecks[0];
    plain(w);
    assert.deepEqual(w.visual.overseerMachine?.welder, before.overseerMachine?.welder);
    assert.deepEqual(w.visual.overseerMachine?.switchboard, before.overseerMachine?.switchboard);
    assert.deepEqual(w.visual.overseerMachine?.auditor, before.overseerMachine?.auditor);
    assert.equal(g.machineBreakdown.getOverseerMachine(e), null);
    if (kind === 'welder') {
      assert.equal(
        g.welder.seams.length + g.welder.barriers.length + g.welder.presentationWalls(e).length,
        0,
      );
      assert(g.shots.length > 0, 'Welder native rounds survive its source');
    } else
      assert.equal(
        g.shots.filter((s) =>
          kind === 'switchboard' ? s.signalOwner === e.id : s.auditorOwner === e.id,
        ).length,
        0,
      );
    assert.equal(g.kills, 0);
  }
});

test('Overseer projections detach plain finite data, allocate no Matter bodies and keep histories capped, expiring and resettable', () => {
  const { g, e } = fixture();
  cover(g, e);
  arc(g, e);
  const s = snapshot(g, e),
    copy = structuredClone(s),
    id = Bodies.rectangle(0, 0, 1, 1).id;
  for (let i = 0; i < 40; i++) {
    plain(s);
    finite(overseerMachinePose(s, i % 2 === 0));
  }
  assert.equal(Bodies.rectangle(0, 0, 1, 1).id, id + 1);
  assert.deepEqual(s, copy);
  for (let i = 0; i < 40; i++) {
    g.machineBreakdown.overseerDischarge(e, 0, e.body.position, {
      x: e.body.position.x + 26,
      y: e.body.position.y,
    });
    g.machineBreakdown.overseerDeployment(e, 'barrier', [e.body.position]);
    g.machineBreakdown.overseerInterruption(e, 'barrier-break', e.body.position);
  }
  const state = g.machineBreakdown.getOverseerMachine(e)!;
  assert.equal(state.discharges.length, 12);
  assert.equal(state.deployments.length, 6);
  assert.equal(state.interruptions.length, 6);
  g.time += 1;
  g.machineBreakdown.update();
  assert.deepEqual(g.machineBreakdown.getOverseerMachine(e), {
    discharges: [],
    deployments: [],
    interruptions: [],
  });
  g.machineBreakdown.reset();
  assert.equal(g.machineBreakdown.getOverseerMachine(e), null);
  assert.deepEqual(g.machineBreakdown.diagnostics, { hits: 0, wrecks: 0 });
  for (let i = 0; i < MACHINE_MAX_HITS + 5; i++) {
    const actor = g.spawnEnemy('welder', 1200, 710)!;
    actor.spawn = 0;
    g.machineBreakdown.overseerDischarge(actor, 0, actor.body.position, { x: 1226, y: 710 });
    g.hitEnemy(actor, 100000, undefined, false, false, false, 'cleanup');
  }
  assert(
    (g.machineBreakdown as unknown as { overseerMachines: Map<number, unknown> }).overseerMachines
      .size <= MACHINE_MAX_HITS,
  );
});

test('real Overseer shutdowns settle before private results with native cleanup immediate and new cosmetic time excluded from scoring', () => {
  for (const kind of kinds) {
    const { g, e } = fixture(kind);
    g.hitEnemy(e, 100000, undefined, false, false, true);
    g.hitStop = 0;
    g.tick(DT, idle);
    assert(g.clear);
    assert.equal(g.mode, 'playing');
    assert(g.machineBreakdown.overseerShutdownActive);
    const elapsed = g.elapsed,
      time = g.time;
    g.setMode('paused');
    for (let i = 0; i < 120; i++) g.tick(DT, idle);
    assert.equal(g.time, time);
    g.setMode('playing');
    for (let i = 0; i < 120 && g.mode === 'playing'; i++) g.tick(DT, idle);
    assert.equal(g.mode, 'won');
    assert.equal(g.elapsed, elapsed);
    assert(!g.machineBreakdown.shutdownActive);
    g.loadRoom();
    assert.equal(g.machineBreakdown.wrecks.length, 0);
  }
});

test('Overseer observers preserve native controllers, geometry, projectiles, audio, RNG, rewards and checkpoints until their ordinary cleanup', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const kind of kinds) {
    const a = fixture(kind),
      b = fixture(kind),
      soundsA: string[] = [],
      soundsB: string[] = [],
      awardsA: string[] = [],
      awardsB: string[] = [];
    b.g.machineBreakdown.update = () => {};
    b.g.machineBreakdown.beforeHit = () => null;
    b.g.machineBreakdown.hit = () => {};
    b.g.machineBreakdown.defeated = () => {};
    b.g.machineBreakdown.overseerDischarge = () => {};
    b.g.machineBreakdown.overseerDeployment = () => {};
    b.g.machineBreakdown.overseerInterruption = () => {};
    b.g.machineBreakdown.overseerRecalled = () => {};
    a.g.onSound = (k) => soundsA.push(k);
    b.g.onSound = (k) => soundsB.push(k);
    a.g.onEnemyDefeated = (k) => awardsA.push(k);
    b.g.onEnemyDefeated = (k) => awardsB.push(k);
    const native = ({ g, e }: { g: Game; e: Enemy }) => ({
      mode: g.mode,
      hp: g.hp,
      time: g.time,
      elapsed: g.elapsed,
      enemyCount: g.enemies.length,
      kills: g.kills,
      actor: {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        attacks: e.attacks,
        aim: { ...e.aim },
        target: { ...e.target },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
        welder: e.welder,
        switchboard: e.switchboard,
        auditor: e.auditor,
      },
      seams: g.welder.seams.map((s) => ({
        a: s.a,
        b: s.b,
        normal: s.normal,
        age: s.age,
        ignited: s.ignited,
      })),
      barriers: g.welder.barriers.map((b) => ({ x: b.x, y: b.y, age: b.age })),
      props: g.props.items.map((p) => ({
        kind: p.kind,
        welded: p.welded,
        hp: p.hp,
        maxHp: p.maxHp,
        position: { ...p.body.position },
        velocity: { ...p.body.velocity },
        expires: p.expires,
      })),
      shots: g.shots.map((s) => ({
        pos: { ...s.pos },
        vel: { ...s.vel },
        damage: s.damage,
        life: s.life,
        signalOwner: s.signalOwner,
        auditorOwner: s.auditorOwner,
      })),
      auditor: { age: g.auditor.age, recall: g.auditor.recall, state: g.auditor.state },
      checkpoint: g.checkpointSnapshot(),
      bodies: Composite.allBodies(g.engine.world).length,
    });
    for (let i = 0; i < 260; i++) {
      step(a.g, a.e);
      step(b.g, b.e);
      overseerMachinePose(snapshot(a.g, a.e), i % 2 === 0);
      assert.deepEqual(native(a), native(b));
    }
    for (const { g, e } of [a, b]) g.hitEnemy(e, 100000, { x: 1000, y: 710 }, false);
    assert.deepEqual(native(a), native(b));
    assert.deepEqual(soundsA, soundsB);
    assert.deepEqual(awardsA, awardsB);
    assert.equal(a.g.rng(), b.g.rng());
  }
});

test('scaled detached Overseer poses keep real admitted and resting muzzles on their same local-unit barrel hinges', () => {
  for (const kind of kinds) {
    const { g, e } = fixture(kind);
    for (const admitted of [false, true]) {
      if (admitted) {
        if (kind === 'welder') arc(g, e);
        else if (kind === 'auditor') auditShot(g, e);
        else {
          board(g, e, true);
          until(g, e, () => g.machineBreakdown.getOverseerMachine(e)!.discharges.length > 0);
        }
      }
      for (const scale of [0.6, 1, 1.4]) {
        const s = { ...snapshot(g, e), scale };
        const p = overseerMachinePose(s);
        near(
          Math.hypot(p.barrel.origin.x - p.gimbal.center.x, p.barrel.origin.y - p.gimbal.center.y),
          p.barrel.length,
        );
        if (admitted) {
          const last = s.overseerMachine!.discharges.filter((d) => d.source === 'body').at(-1)!;
          near(s.position.x + p.barrel.origin.x * scale, last.muzzle.x);
          near(s.position.y + p.barrel.origin.y * scale, last.muzzle.y);
        }
      }
    }
  }
});
