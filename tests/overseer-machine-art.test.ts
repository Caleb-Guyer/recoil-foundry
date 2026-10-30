import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import {
  overseersTestFromUrl,
  overseersTestRoom,
  prepareOverseersTest,
} from '../src/overseers-test.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawOverseerChassis } from '../src/overseer-machine-art.ts';
import { overseerMachinePose, type OverseerMachineKind } from '../src/overseer-machine-pose.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import { drawWelder, drawWelds } from '../src/welder-art.ts';
import { drawSwitchboard, drawSwitchboardArena } from '../src/switchboard-art.ts';
import { drawAuditor, drawAuditDoor, drawCompanyCase } from '../src/auditor-art.ts';
import { AUDITOR_WARNING, AUDITOR_VISIT, AUDITOR_RECALL } from '../src/auditor.ts';
import { WELD_TELL } from '../src/welder.ts';
import { SIGNAL } from '../src/switchboard.ts';

type Op = { name: string; args: unknown[] };
function canvas(world = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(state, key)) return state[String(key)];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
      if (key === 'createRadialGradient' || key === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...state });
        if (key === 'restore') {
          assert(stack.length);
          Object.keys(state).forEach((k) => delete state[k]);
          Object.assign(state, stack.pop());
        }
        for (const n of args) if (typeof n === 'number') assert(Number.isFinite(n), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        assert(!['drawImage', 'clearRect'].includes(String(key)));
        assert(
          world || !['setLineDash', 'fillText', 'strokeText'].includes(String(key)),
          'chassis must not add world warnings or captions',
        );
        ops.push({ name: String(key), args });
      };
    },
    set(_, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      state[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    c,
    ops,
    get depth() {
      return stack.length;
    },
  };
}
const kinds = ['welder', 'switchboard', 'auditor'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
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
  if (kind === 'auditor') {
    g.auditor.update(2);
    g.auditor.update(AUDITOR_WARNING + 0.01);
  }
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  g.time = 1;
  g.machineBreakdown.update();
  return { g, e };
}
const snap = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function body(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced = false, portrait = false) {
  if (e.kind === 'welder') drawWelder(c, g, e, reduced, portrait);
  else if (e.kind === 'switchboard') drawSwitchboard(c, g, e, reduced, portrait);
  else drawAuditor(c, g, e, reduced, portrait);
}
function welderAttack(g: Game, e: Enemy, attack: 'arc' | 'seam' | 'cover') {
  e.state = 'idle';
  e.timer = 0;
  e.attacks = attack === 'seam' ? 0 : attack === 'arc' ? 1 : 2;
  g.welder.updateEnemy(e, 0.001);
  assert.equal(e.welder!.attack, attack);
  assert.equal(e.state, 'windup');
}
function switchStep(g: Game, e: Enemy, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    g.time += 1 / 60;
    g.switchboard.update(e, 1 / 60);
  }
  g.machineBreakdown.update();
}
function fireAuditor(g: Game, e: Enemy) {
  e.auditor!.attack = 'burst';
  e.state = 'windup';
  e.timer = 0;
  g.auditor.updateEnemy(e, 0.001);
  g.time += 0.01;
  g.auditor.updateEnemy(e, 0.001);
  g.machineBreakdown.update();
}

test('all Overseer rigs use distinct finite balanced production geometry through shared live dispatch', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { g, e } = course(kind),
      s = snap(g, e),
      a = canvas(),
      b = canvas();
    drawOverseerChassis(a.c, s);
    drawMachineChassis(b.c, s);
    assert.deepEqual(a.ops, b.ops);
    assert.equal(a.depth, 0);
    assert(a.ops.length > 180);
    signatures.push(JSON.stringify(a.ops));
    const p = overseerMachinePose(s);
    assert.equal(p.tracks.length, kind === 'welder' ? 2 : 0);
    assert.equal(p.channels.length, kind === 'switchboard' ? 3 : 0);
    assert.equal(p.magazine.length, kind === 'auditor' ? 5 : 0);
    dispose(g);
  }
  assert.equal(new Set(signatures).size, 3);
});

test('Welder real arc release drives its captive torch and receiver at the exact admitted native muzzle', () => {
  const { g, e } = course('welder');
  welderAttack(g, e, 'arc');
  assert.equal(overseerMachinePose(snap(g, e)).recoil, 0);
  e.timer = 0;
  g.welder.updateEnemy(e, 0.001);
  g.machineBreakdown.update();
  const shot = g.shots.filter((s) => s.damageCause?.enemy === 'welder').at(-1)!;
  assert(shot);
  const s = snap(g, e),
    p = overseerMachinePose(s),
    a = canvas();
  assert(p.recoil > 0.99);
  assert.equal(s.overseerMachine!.discharges.length, 5);
  close(p.barrel.origin.x + s.position.x, shot.pos.x);
  close(p.barrel.origin.y + s.position.y, shot.pos.y);
  assert.deepEqual(p.torch.tip, p.barrel.origin);
  close(p.barrel.length, 26);
  drawOverseerChassis(a.c, s);
  assert(
    a.ops.some(
      (o) =>
        o.name === 'translate' &&
        o.args[0] === p.barrel.origin.x &&
        o.args[1] === p.barrel.origin.y,
    ),
  );
  dispose(g);
});

test('Welder seam heating and cooling shutter follow actual ignition and native recover armor', () => {
  const { g, e } = course('welder');
  welderAttack(g, e, 'seam');
  assert(g.welder.seams.length > 0);
  assert(!g.welder.seams.some((s) => s.ignited));
  assert.equal(overseerMachinePose(snap(g, e)).torch.heat, 0);
  g.time += WELD_TELL + 0.01;
  g.welder.update(WELD_TELL + 0.01);
  assert(g.welder.seams.some((s) => s.ignited));
  assert.equal(overseerMachinePose(snap(g, e)).torch.heat, 1);
  e.timer = 0;
  g.welder.updateEnemy(e, 0.001);
  const p = overseerMachinePose(snap(g, e));
  assert.equal(e.state, 'recover');
  assert.equal(p.torch.opening, 1);
  assert(p.recover);
  assert.equal(p.recoil, 0);
  dispose(g);
});

test('Switchboard three attached relay channels retain real record/lock/interruption and admitted port release', () => {
  const { g, e } = course('switchboard');
  e.state = 'recover';
  g.hitEnemy(e, (e.maxHp * 0.55) / 1.25);
  e.attacks = 3;
  e.switchboard!.wait = 0;
  g.switchboard.update(e, 0.001);
  assert.equal(e.phase, 1);
  e.switchboard!.wait = 0;
  g.switchboard.update(e, 0.001);
  assert.equal(e.switchboard!.plans.length, 2);
  switchStep(g, e, 0.3);
  let p = overseerMachinePose(snap(g, e));
  assert(p.channels.some((c) => c.charge > 0 && c.charge < 1));
  assert(p.channels.every((c) => !c.locked));
  switchStep(g, e, 0.32);
  p = overseerMachinePose(snap(g, e));
  assert(p.channels.some((c) => c.locked));
  const slot = e.switchboard!.plans[0].slot;
  assert(g.switchboard.interrupt(slot));
  p = overseerMachinePose(snap(g, e));
  assert(p.channels[slot].cut);
  assert.equal(p.channels[slot].charge, 0);
  assert.equal(p.channels[slot].locked, false);
  assert(p.interruption > 0.99);
  switchStep(g, e, 1.2);
  const s = snap(g, e);
  p = overseerMachinePose(s);
  assert(s.overseerMachine!.discharges.some((d) => d.source === 'port'));
  assert.equal(p.recoil, 0);
  assert(p.channels.some((c) => c.release > 0));
  const a = canvas();
  drawOverseerChassis(a.c, s);
  assert.equal(a.depth, 0);
  // Ports remain native world geometry; body channels do not draw duplicate muzzle barrels.
  assert(
    !a.ops.some(
      (o) =>
        o.name === 'translate' &&
        o.args[0] === p.barrel.origin.x &&
        o.args[1] === p.barrel.origin.y,
    ),
  );
  dispose(g);
});

test('Auditor native burst uses admitted clipped muzzles and spends real magazine rounds', () => {
  const { g, e } = course('auditor');
  fireAuditor(g, e);
  const shot = g.shots.find((s) => s.auditorOwner === e.id)!;
  assert(shot);
  const s = snap(g, e),
    p = overseerMachinePose(s);
  assert(p.recoil > 0.99);
  assert.equal(e.auditor!.fired, 1);
  assert.equal(e.auditor!.rounds, 3);
  assert.equal(p.magazine.filter((m) => m.loaded).length, 2);
  assert.equal(p.magazine[0].loaded, false);
  assert(p.magazine[1].selected);
  close(p.barrel.origin.x + s.position.x, shot.pos.x);
  close(p.barrel.origin.y + s.position.y, shot.pos.y);
  const origin = s.overseerMachine!.discharges.at(-1)!.origin;
  close(p.barrel.length, Math.hypot(shot.pos.x - origin.x, shot.pos.y - origin.y));
  const a = canvas();
  drawOverseerChassis(a.c, s);
  assert.equal(a.depth, 0);
  dispose(g);
});

test('native projectile caps cannot invent Welder or Auditor receiver motion or Switchboard port-release kicks', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    for (let i = 0; i < 180; i++)
      g.addShot({
        pos: { x: 40, y: 40 },
        vel: { x: 0, y: 0 },
        damage: 1,
        life: 10,
        radius: 2,
        friendly: false,
        bounces: 0,
      });
    assert.equal(g.shots.length, 180);
    if (kind === 'welder') {
      welderAttack(g, e, 'arc');
      e.timer = 0;
      g.welder.updateEnemy(e, 0.001);
    } else if (kind === 'switchboard') {
      g.switchboard.begin(e);
      switchStep(g, e, SIGNAL.record + SIGNAL.lock + 0.05);
    } else fireAuditor(g, e);
    const s = snap(g, e),
      p = overseerMachinePose(s);
    assert.equal(s.overseerMachine!.discharges.length, 0);
    assert.equal(p.recoil, 0);
    assert(p.channels.every((c) => c.release === 0));
    dispose(g);
  }
});

test('accepted directional hull contacts and health-based wear never replace a boss with a whole white flash', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    e.state = 'recover';
    const armor = kind === 'welder' ? 1.5 : kind === 'switchboard' ? 1.25 : 1;
    g.hitEnemy(e, (e.maxHp * 0.4) / armor, { x: e.body.position.x - 80, y: e.body.position.y });
    let s = snap(g, e),
      p = overseerMachinePose(s);
    assert.equal(p.wear, 1);
    assert(s.overseerMachine!.hullHit?.direction);
    assert(p.body.x > 0);
    const a = canvas();
    drawOverseerChassis(a.c, s);
    drawMachineContacts(a.c, g, e, false);
    assert(
      !a.ops.some(
        (o) => o.name === 'style:fillStyle' && ['#ffffff', '#fff8dc'].includes(String(o.args[0])),
      ),
    );
    g.time += 0.3;
    g.hitStop = 0;
    g.hitEnemy(e, (e.maxHp * 0.35) / armor, { x: e.body.position.x + 80, y: e.body.position.y });
    s = snap(g, e);
    p = overseerMachinePose(s);
    assert.equal(p.wear, 2);
    assert(p.body.x < 0);
    const b = canvas();
    drawOverseerChassis(b.c, s);
    assert.notDeepEqual(a.ops, b.ops);
    dispose(g);
  }
});

test('body wrappers preserve native health bars and aim warnings while portraits omit world HUD', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    e.state = 'windup';
    e.timer = 0.6;
    if (kind === 'welder') welderAttack(g, e, 'arc');
    const hud = kind === 'welder' ? [-34, -46] : kind === 'switchboard' ? [-45, -61] : [-25, -37];
    const a = canvas(true);
    body(a.c, g, e);
    assert.equal(a.depth, 0);
    assert.equal(
      a.ops.filter((o) => o.name === 'fillRect' && o.args[0] === hud[0] && o.args[1] === hud[1])
        .length,
      2,
    );
    if (kind !== 'switchboard')
      assert(
        a.ops.some(
          (o) =>
            o.name === 'setLineDash' &&
            Array.isArray(o.args[0]) &&
            (o.args[0] as number[]).length > 0,
        ),
      );
    const b = canvas();
    body(b.c, g, e, false, true);
    assert.equal(b.depth, 0);
    assert(
      !b.ops.some((o) => o.name === 'fillRect' && o.args[0] === hud[0] && o.args[1] === hud[1]),
    );
    dispose(g);
  }
});

test('Reduced Effects preserves actual lock, cut, cooling and ammo information while suppressing transient recoil', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    if (kind === 'welder') {
      welderAttack(g, e, 'arc');
      e.timer = 0;
      g.welder.updateEnemy(e, 0.001);
    } else if (kind === 'switchboard') {
      e.attacks = 2;
      g.switchboard.begin(e);
      switchStep(g, e, 0.62);
      g.switchboard.interrupt(0);
    } else fireAuditor(g, e);
    const s = snap(g, e),
      p = overseerMachinePose(s),
      r = overseerMachinePose(s, true);
    assert.equal(r.recoil, 0);
    assert.equal(r.interruption, 0);
    assert.equal(r.deploy, 0);
    assert.deepEqual(
      p.channels.map((c) => [c.charge, c.locked, c.cut, c.mobile]),
      r.channels.map((c) => [c.charge, c.locked, c.cut, c.mobile]),
    );
    assert.deepEqual(p.magazine, r.magazine);
    assert.equal(p.torch.opening, r.torch.opening);
    const a = canvas();
    drawOverseerChassis(a.c, s, true);
    assert.equal(a.depth, 0);
    dispose(g);
  }
});

test('Auditor living recall opens the physical case without shutdown darkness, ammo emission or corpse creation', () => {
  const { g, e } = course('auditor', true);
  g.auditor.age = AUDITOR_VISIT;
  g.auditor.update(0.01);
  assert(g.auditor.recall > 0);
  g.auditor.update(AUDITOR_RECALL * 0.5);
  g.time += AUDITOR_RECALL * 0.5;
  g.machineBreakdown.update();
  const s = snap(g, e),
    p = overseerMachinePose(s);
  assert.equal(p.mode, 'recall');
  assert.equal(p.energy, 1);
  assert(p.caseLatch.open > 0.4);
  assert.equal(p.recoil, 0);
  assert.equal(g.machineBreakdown.wrecks.length, 0);
  const a = canvas(true);
  body(a.c, g, e);
  assert(
    a.ops.some(
      (o) => o.name === 'strokeRect' && o.args[0] === o.args[1] && Number(o.args[0]) < -31,
    ),
  );
  const before = g.shots.length;
  drawOverseerChassis(canvas().c, s);
  assert.equal(g.shots.length, before);
  dispose(g);
});

test('native world passes and production rigs are side-effect free, and paused frame geometry stays fixed', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    if (kind === 'welder') welderAttack(g, e, 'seam');
    if (kind === 'switchboard') g.switchboard.begin(e);
    const before = JSON.stringify({
      s: snap(g, e),
      shots: g.shots,
      props: g.props.items.map((p) => ({ id: p.body.id, hp: p.hp })),
      hp: g.hp,
      time: g.time,
      mode: g.mode,
    });
    const a = canvas(true),
      b = canvas(true);
    body(a.c, g, e);
    body(b.c, g, e);
    assert.deepEqual(a.ops, b.ops);
    const world = canvas(true);
    drawWelds(world.c, g);
    drawSwitchboardArena(world.c, g);
    for (const p of g.props.items) if (p.auditCase) drawCompanyCase(world.c, g, p);
    drawAuditDoor(world.c, g, false);
    assert.equal(
      before,
      JSON.stringify({
        s: snap(g, e),
        shots: g.shots,
        props: g.props.items.map((p) => ({ id: p.body.id, hp: p.hp })),
        hp: g.hp,
        time: g.time,
        mode: g.mode,
      }),
    );
    g.mode = 'paused';
    const p = overseerMachinePose(snap(g, e));
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.deepEqual(overseerMachinePose(snap(g, e)), p);
    dispose(g);
  }
});

test('inactive reusable geometry is balanced and has no energized torch, signal, loaded ammo or recall lamps', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind),
      s = snap(g, e),
      p = overseerMachinePose(s);
    p.energy = 0;
    const a = canvas();
    drawOverseerChassis(a.c, s, false, p);
    assert.equal(a.depth, 0);
    assert(
      !a.ops.some(
        (o) =>
          o.name === 'style:fillStyle' &&
          ['#e6c49a', '#dcbb85', '#e6cca0', '#e8c796'].includes(String(o.args[0])),
      ),
    );
    dispose(g);
  }
});
