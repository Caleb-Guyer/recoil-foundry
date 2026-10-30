import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import { huntMuzzle } from '../src/hunts.ts';
import { HUNT_KINDS } from '../src/hunt-rules.ts';
import { machineBodySnapshot, machinePose, isMachineKind } from '../src/machine-breakdown-pose.ts';
import {
  contractMachinePose,
  isContractMachineKind,
  type ContractMachineKind,
} from '../src/contract-machine-pose.ts';
import { MACHINE_MAX_HITS } from '../src/machine-breakdown.ts';
const { Body, Bodies, Composite } = Matter;
const DT = 1 / 60;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 710 },
};
function fixture(kind: ContractMachineKind = 'cableweaver') {
  const g = new Game();
  g.startTest(huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&v=1`))!);
  g.waves.clear();
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  Body.setPosition(e.body, { x: 1460, y: 710 });
  Body.setVelocity(e.body, { x: 0, y: 0 });
  Body.setStatic(g.player, true);
  Body.setPosition(g.player, { x: 1000, y: 722 });
  g.engine.gravity.y = 0;
  g.machineBreakdown.update();
  return { g, e };
}
function step(g: Game, e: Enemy, dt = DT) {
  g.time += dt;
  g.updateEnemy(e, dt);
  g.machineBreakdown.update();
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 1200) {
  for (let i = 0; i < max && !condition(); i++) step(g, e);
  assert(condition(), 'Native hunt state did not arrive');
}
function gear(g: Game, e: Enemy) {
  until(g, e, () =>
    e.kind === 'cableweaver'
      ? g.hunts.cables.length > 0
      : e.kind === 'demolisher'
        ? g.hunts.mines.length > 0
        : g.hunts.plates.length > 0,
  );
}
function snapshot(g: Game, e: Enemy) {
  return machineBodySnapshot(e, g.time, g)!;
}
function fan(g: Game, e: Enemy) {
  e.state = 'windup';
  e.attack = 'fan';
  e.timer = 0;
  e.aim = { x: -1, y: 0 };
  g.hunts.updateEnemy(e);
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

test('only the three native hunt bosses join machine presentation; all other bosses remain excluded', () => {
  for (const kind of HUNT_KINDS) {
    const { g, e } = fixture(kind);
    assert(isMachineKind(kind) && isContractMachineKind(kind));
    const s = snapshot(g, e);
    assert(s.contractMachine);
    plain(s);
    finite(contractMachinePose(s));
    assert.equal(machinePose(s).kind, kind);
  }
  for (const kind of [
    'runner',
    'caller',
    'switchman',
    'loader',
    'crane',
    'sorter',
    'condenser',
    'boss',
    'turbine',
    'interceptor',
    'auditor',
    'welder',
    'switchboard',
  ])
    assert.equal(isContractMachineKind(kind), false);
  for (const kind of ['loader', 'crane', 'sorter', 'condenser', 'boss', 'turbine', 'interceptor'])
    assert.equal(isMachineKind(kind), false);
});

test('Cableweaver records only successful native anchor placement and preserves its committed target', () => {
  const { g, e } = fixture();
  step(g, e);
  assert.equal(e.state, 'windup');
  assert.equal(e.attack, 'mortar');
  const target = { ...e.target };
  Body.setPosition(g.player, { x: 1300, y: 500 });
  until(g, e, () => g.hunts.cables.length === 1);
  const h = snapshot(g, e).contractMachine!;
  assert.equal(h.supplies, 1);
  assert.equal(h.cables.length, 1);
  assert.equal(h.deployment?.kind, 'anchors');
  near(h.cables[0].anchors[0].position.x, target.x - 135);
  near(h.cables[0].anchors[1].position.x, target.x + 135);
  assert.equal(h.deployment!.points.length, 2);
  assert.equal(h.discharges.length, 0);
  assert.equal(contractMachinePose(snapshot(g, e)).drums.length, 2);
});

test('actual cable arming and player cuts drive tension and break feedback without inventing new attacks', () => {
  const { g, e } = fixture();
  gear(g, e);
  const c = g.hunts.cables[0];
  assert.equal(contractMachinePose(snapshot(g, e)).drums[0].tension, 0);
  g.time = c.liveAt;
  g.machineBreakdown.update();
  assert.equal(contractMachinePose(snapshot(g, e)).drums[0].tension, 0.5);
  const before = { attacks: e.attacks, kills: g.kills, hp: g.hp };
  g.hunts.cutAlong(
    { x: c.anchors[0].body.position.x + 30, y: 680 },
    { x: c.anchors[0].body.position.x + 30, y: 730 },
    0,
    true,
  );
  assert.equal(g.hunts.cables.length, 0);
  assert.equal(e.timer, 1.6);
  assert.equal(e.state, 'recover');
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption?.kind, 'cable-cut');
  assert.equal(contractMachinePose(snapshot(g, e)).mode, 'cable-cut');
  assert.deepEqual({ attacks: e.attacks, kills: g.kills, hp: g.hp }, before);
});

test('hostile or partial anchor damage does not invent a cut; all snapshots detach real prop data', () => {
  const { g, e } = fixture();
  gear(g, e);
  const c = g.hunts.cables[0],
    a = c.anchors[0];
  const s = snapshot(g, e);
  plain(s);
  g.hunts.hitProp(a, 100, { x: 0, y: 0 }, false);
  assert.equal(a.hp, 22);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption, null);
  g.hunts.hitProp(a, 5, { x: 0, y: 0 }, true);
  assert.equal(a.hp, 17);
  assert.equal(g.hunts.cables.length, 1);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption, null);
  Body.setPosition(a.body, { x: a.body.position.x + 25, y: a.body.position.y });
  assert.equal(s.contractMachine!.cables[0].anchors[0].hp, 22);
  assert.notEqual(s.contractMachine!.cables[0].anchors[0].position.x, a.body.position.x);
});

test('Bulwark armor, pushed plates, separate plate breaks and exposed core use exact native outcomes', () => {
  const { g, e } = fixture('bulwark');
  assert.equal(g.hunts.plates.length, 2);
  assert(snapshot(g, e).contractMachine!.armorClosed);
  const before = e.hp;
  g.hitEnemy(e, 100, { x: 1300, y: 710 }, false);
  near(e.hp, before - 70);
  const hit = g.machineBreakdown.getHits(e.id).at(-1)!;
  near(hit.healthLost, 70);
  near(hit.absorbed, 30);
  assert(hit.contact?.local.x! < 0);
  assert(contractMachinePose(snapshot(g, e)).body.x > 0);
  const a = g.hunts.plates[0];
  g.hunts.hitProp(a, 20, { x: 1, y: 0 }, true);
  assert(a.body.velocity.x > 0);
  assert.equal(a.hp, 65);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption, null);
  g.hunts.hitProp(a, 65, { x: 1, y: 0 }, true);
  assert.equal(g.hunts.plates.length, 1);
  assert(snapshot(g, e).contractMachine!.armorClosed);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption?.kind, 'plate-break');
  g.hunts.hitProp(g.hunts.plates[0], 85, { x: 1, y: 0 }, true);
  assert.equal(g.hunts.armor(e), 1);
  assert(!snapshot(g, e).contractMachine!.armorClosed);
  assert.equal(e.state, 'recover');
  assert.equal(e.timer, 1.6);
  const exposed = e.hp;
  g.hitEnemy(e, 100, { x: 1300, y: 710 }, false);
  near(e.hp, exposed - 100);
  assert.equal(g.machineBreakdown.getHits(e.id).at(-1)!.absorbed, 0);
});

test('Bulwark replacement plates animate only when actually made and retain the native two-supply limit', () => {
  const { g, e } = fixture('bulwark');
  for (const p of [...g.hunts.plates]) g.hunts.hitProp(p, 100, { x: 1, y: 0 }, true);
  fan(g, e);
  assert.equal(g.hunts.supplies, 2);
  assert.equal(g.hunts.plates.length, 2);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.deployment?.kind, 'plates');
  for (const p of [...g.hunts.plates]) g.hunts.hitProp(p, 100, { x: 1, y: 0 }, true);
  fan(g, e);
  assert.equal(g.hunts.plates.length, 0);
  assert.equal(g.hunts.supplies, 2);
});

test('Demolisher rack follows actual deployed charge inventory and player disarm creates no blast or reward', () => {
  const { g, e } = fixture('demolisher');
  assert.equal(contractMachinePose(snapshot(g, e)).rack.filter((r) => r.loaded).length, 6);
  gear(g, e);
  const m = g.hunts.mines[0];
  assert.equal(g.hunts.supplies, 1);
  assert.equal(contractMachinePose(snapshot(g, e)).rack.filter((r) => r.loaded).length, 5);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.deployment?.kind, 'mine');
  const native = { hp: g.hp, kills: g.kills, attacks: e.attacks };
  g.hunts.hitProp(m.prop, 100, { x: 0, y: 0 }, false);
  assert.equal(g.hunts.mines.length, 1);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption, null);
  g.hunts.hitProp(m.prop, 12, { x: 0, y: 0 }, true);
  assert.equal(g.hunts.mines.length, 0);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption?.kind, 'mine-disarm');
  g.time = m.explodesAt;
  g.hunts.update();
  assert.deepEqual({ hp: g.hp, kills: g.kills, attacks: e.attacks }, native);
});

test('natural mine detonation and cable expiry are never mislabeled as player disarms or cuts', () => {
  const d = fixture('demolisher');
  gear(d.g, d.e);
  const m = d.g.hunts.mines[0];
  d.g.time = m.explodesAt;
  d.g.hunts.update();
  d.g.machineBreakdown.update();
  assert.equal(d.g.hunts.mines.length, 0);
  assert.equal(d.g.machineBreakdown.getContractMachine(d.e)?.interruption, null);
  assert.equal(d.g.hp, 80);
  const c = fixture();
  gear(c.g, c.e);
  c.g.time = c.g.hunts.cables[0].endsAt;
  c.g.hunts.update();
  c.g.machineBreakdown.update();
  assert.equal(c.g.hunts.cables.length, 0);
  assert.equal(c.g.machineBreakdown.getContractMachine(c.e)?.interruption, null);
});

test('native admitted body volleys retain all exact high/low muzzle origins and individual emitted rounds', () => {
  for (const kind of HUNT_KINDS) {
    const { g, e } = fixture(kind);
    fan(g, e);
    const h = snapshot(g, e).contractMachine!;
    assert.equal(h.discharges.length, 3);
    assert.equal(g.shots.length, 3);
    for (let i = 0; i < 3; i++) {
      const shot = g.shots[i],
        d = h.discharges[i];
      assert.deepEqual(d.origin, huntMuzzle(e));
      assert.deepEqual(d.muzzle, shot.pos);
      near(Math.hypot(d.muzzle.x - d.origin.x, d.muzzle.y - d.origin.y), 26);
    }
    assert(contractMachinePose(snapshot(g, e)).recoil > 0);
  }
});

test('fully rejected and partially admitted native volleys never manufacture receiver recoil or extra barrel events', () => {
  for (const kind of HUNT_KINDS) {
    const a = fixture(kind);
    fill(a.g, 180);
    fan(a.g, a.e);
    assert.equal(a.g.machineBreakdown.getContractMachine(a.e)?.discharges.length, 0);
    assert.equal(contractMachinePose(snapshot(a.g, a.e)).recoil, 0);
    const b = fixture(kind);
    fill(b.g, 179);
    fan(b.g, b.e);
    assert.equal(b.g.shots.length, 180);
    assert.equal(b.g.machineBreakdown.getContractMachine(b.e)?.discharges.length, 1);
    assert(contractMachinePose(snapshot(b.g, b.e)).recoil > 0);
  }
});

test('a real close-cover muzzle impact cycles the receiver without adding a projectile', () => {
  const { g, e } = fixture();
  const o = huntMuzzle(e),
    wall = Bodies.rectangle(o.x - 16, o.y, 8, 100, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  g.enemyShot(e, Math.PI, 8.5, 14, o);
  assert.equal(g.shots.length, 0);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.discharges.length, 1);
  assert(contractMachinePose(snapshot(g, e)).recoil > 0);
});

test('accepted hit direction and health-based wear react locally without changing native controls or making new weak spots', () => {
  for (const kind of HUNT_KINDS) {
    const { g, e } = fixture(kind),
      before = {
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        pos: { ...e.body.position },
        velocity: { ...e.body.velocity },
      };
    const start = e.hp;
    g.hitEnemy(e, 40, { x: e.body.position.x - 100, y: e.body.position.y }, false);
    const lost = kind === 'bulwark' ? 28 : 40;
    near(e.hp, start - lost);
    const s = snapshot(g, e),
      p = contractMachinePose(s);
    assert(s.contractMachine!.hullHit);
    assert(p.body.x > 0 && p.angle > 0);
    assert.deepEqual(
      {
        state: e.state,
        timer: e.timer,
        aim: { ...e.aim },
        pos: { ...e.body.position },
        velocity: { ...e.body.velocity },
      },
      before,
    );
    e.hp = e.maxHp * 0.6;
    assert.equal(contractMachinePose(snapshot(g, e)).wear, 1);
    e.hp = e.maxHp * 0.2;
    assert.equal(contractMachinePose(snapshot(g, e)).wear, 2);
    const reduced = contractMachinePose(snapshot(g, e), true);
    assert.equal(reduced.body.x, 0);
    assert.equal(reduced.angle, 0);
    assert.equal(reduced.wear, 2);
  }
});

test('prelethal snapshots preserve live gear before native death clears it, with no future deployment or extra shots', () => {
  for (const kind of HUNT_KINDS) {
    const { g, e } = fixture(kind);
    gear(g, e);
    fan(g, e);
    const shots = g.shots.map((s) => ({
      id: s.id,
      pos: { ...s.pos },
      vel: { ...s.vel },
      damage: s.damage,
    }));
    const before = snapshot(g, e);
    g.hitEnemy(e, 100000, { x: 1300, y: 710 }, false, false, false);
    assert.equal(g.enemies.includes(e), false);
    assert.equal(g.hunts.cables.length + g.hunts.plates.length + g.hunts.mines.length, 0);
    assert.equal(g.props.items.filter((p) => p.hunt).length, 0);
    assert.equal(g.machineBreakdown.wrecks.length, 1);
    const w = g.machineBreakdown.wrecks[0];
    plain(w);
    assert.deepEqual(w.visual.contractMachine?.cables, before.contractMachine?.cables);
    assert.deepEqual(w.visual.contractMachine?.plates, before.contractMachine?.plates);
    assert.deepEqual(w.visual.contractMachine?.mines, before.contractMachine?.mines);
    assert.equal(w.hit!.healthLost, before.hp);
    assert.deepEqual(
      g.shots.map((s) => ({ id: s.id, pos: { ...s.pos }, vel: { ...s.vel }, damage: s.damage })),
      shots,
    );
    assert.equal(g.machineBreakdown.getContractMachine(e), null);
    g.time += 1;
    g.hunts.update();
    assert.equal(g.hunts.cables.length + g.hunts.plates.length + g.hunts.mines.length, 0);
    assert.equal(g.kills, 0);
  }
});

test('snapshot projections are detached and pure, Pause freezes native state, histories are bounded and resets clear them', () => {
  const { g, e } = fixture();
  gear(g, e);
  fan(g, e);
  const s = snapshot(g, e),
    stable = structuredClone(s);
  for (let i = 0; i < 25; i++) {
    plain(s);
    finite(contractMachinePose(s));
    finite(contractMachinePose(s, true));
  }
  assert.deepEqual(s, stable);
  const native = {
    time: g.time,
    timer: e.timer,
    supplies: g.hunts.supplies,
    cables: g.hunts.cables.length,
    shots: g.shots.length,
  };
  g.setMode('paused');
  for (let i = 0; i < 120; i++) g.tick(DT, idle);
  assert.deepEqual(
    {
      time: g.time,
      timer: e.timer,
      supplies: g.hunts.supplies,
      cables: g.hunts.cables.length,
      shots: g.shots.length,
    },
    native,
  );
  g.setMode('playing');
  for (let i = 0; i < 50; i++)
    g.machineBreakdown.contractDischarge(e, 0, huntMuzzle(e), {
      x: huntMuzzle(e).x + 26,
      y: huntMuzzle(e).y,
    });
  assert.equal(g.machineBreakdown.getContractMachine(e)?.discharges.length, 6);
  g.time += 1;
  g.machineBreakdown.update();
  assert.equal(g.machineBreakdown.getContractMachine(e)?.discharges.length, 0);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.deployment, null);
  const original = s.contractMachine!.cables[0].anchors[0].position.x;
  Body.setPosition(g.hunts.cables[0].anchors[0].body, { x: original + 10, y: 730 });
  assert.equal(s.contractMachine!.cables[0].anchors[0].position.x, original);
  g.machineBreakdown.reset();
  assert.equal(g.machineBreakdown.getContractMachine(e), null);
  assert.deepEqual(g.machineBreakdown.diagnostics, { hits: 0, wrecks: 0 });
  for (let i = 0; i < MACHINE_MAX_HITS + 10; i++) {
    const actor = g.spawnEnemy('cableweaver', 1300, 710)!;
    actor.spawn = 0;
    g.machineBreakdown.contractDischarge(actor, 0, huntMuzzle(actor), { x: 1326, y: 683 });
    g.hitEnemy(actor, 100000, undefined, false, false, false, 'cleanup');
  }
  assert(
    (g.machineBreakdown as unknown as { contractMachines: Map<number, unknown> }).contractMachines
      .size <= MACHINE_MAX_HITS,
  );
});

test('cleanup, spawn, dead-player and unrelated props cannot create Contract combat presentation outcomes', () => {
  for (const state of ['cleanup', 'spawn', 'player-dead'] as const) {
    const { g, e } = fixture();
    if (state === 'spawn') e.spawn = 0.5;
    if (state === 'player-dead') g.hp = 0;
    g.hitEnemy(
      e,
      100000,
      undefined,
      false,
      false,
      false,
      state === 'cleanup' ? 'cleanup' : undefined,
    );
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert.equal(g.kills, 0);
  }
  const { g, e } = fixture('demolisher');
  const p = g.hunts.ownedProp('mine', 1100, 12);
  g.hunts.hitProp(p, 12, { x: 0, y: 0 }, true);
  assert.equal(g.machineBreakdown.getContractMachine(e)?.interruption, null);
});

test('real hunt shutdown remains playable after native clear cleanup, freezes on Pause, then follows normal private completion', () => {
  for (const kind of HUNT_KINDS) {
    const { g, e } = fixture(kind);
    gear(g, e);
    fan(g, e);
    g.hitEnemy(e, 100000, undefined, false, false, true);
    g.hitStop = 0;
    assert(g.machineBreakdown.contractShutdownActive);
    assert.equal(g.hunts.cables.length + g.hunts.plates.length + g.hunts.mines.length, 0);
    g.tick(DT, idle);
    assert(g.clear);
    assert.equal(g.mode, 'playing');
    assert(
      g.shots.every((s) => s.friendly),
      'native room clear still removes hostile rounds immediately',
    );
    const at = g.time,
      elapsedAtClear = g.elapsed,
      frames = structuredClone(g.machineBreakdown.wrecks);
    g.setMode('paused');
    for (let i = 0; i < 120; i++) g.tick(DT, idle);
    assert.equal(g.time, at);
    assert.deepEqual(g.machineBreakdown.wrecks, frames);
    assert(g.machineBreakdown.contractShutdownActive);
    g.setMode('playing');
    Body.setStatic(g.player, false);
    const x = g.player.position.x;
    for (let i = 0; i < 20; i++) g.tick(DT, { ...idle, right: true });
    assert.equal(g.mode, 'playing');
    assert(g.player.position.x > x, 'shutdown beat keeps ordinary movement');
    assert.equal(
      g.elapsed,
      elapsedAtClear,
      'new cosmetic settling time cannot inflate run scoring',
    );
    for (let i = 0; i < 100 && g.mode === 'playing'; i++) g.tick(DT, idle);
    assert.equal(g.mode, 'won');
    assert(!g.machineBreakdown.contractShutdownActive);
    assert.equal(
      g.elapsed,
      elapsedAtClear,
      'the tick crossing the settling deadline also stays off the score clock',
    );
    assert.equal(g.kills, 1);
    g.loadRoom();
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    assert(!g.machineBreakdown.contractShutdownActive);
  }
});

test('Contract observers do not alter native combat AI, gear, shot trajectories, audio, rewards, RNG or checkpoint data', (t) => {
  t.mock.method(Math, 'random', () => 0.5);
  for (const kind of HUNT_KINDS) {
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
    b.g.machineBreakdown.contractDischarge = () => {};
    b.g.machineBreakdown.contractDeployment = () => {};
    b.g.machineBreakdown.contractInterruption = () => {};
    a.g.onSound = (s) => soundsA.push(s);
    b.g.onSound = (s) => soundsB.push(s);
    a.g.onEnemyDefeated = (k) => awardsA.push(k);
    b.g.onEnemyDefeated = (k) => awardsB.push(k);
    const native = ({ g, e }: { g: Game; e: Enemy }) => ({
      mode: g.mode,
      hp: g.hp,
      time: g.time,
      elapsed: g.elapsed,
      actor: {
        hp: e.hp,
        state: e.state,
        timer: e.timer,
        attacks: e.attacks,
        aim: { ...e.aim },
        target: { ...e.target },
        position: { ...e.body.position },
        velocity: { ...e.body.velocity },
      },
      supplies: g.hunts.supplies,
      cables: g.hunts.cables.map((c) => ({
        anchors: c.anchors.map((p) => ({ position: { ...p.body.position }, hp: p.hp })),
        liveAt: c.liveAt,
        endsAt: c.endsAt,
      })),
      plates: g.hunts.plates.map((p) => ({
        position: { ...p.body.position },
        velocity: { ...p.body.velocity },
        hp: p.hp,
      })),
      mines: g.hunts.mines.map((m) => ({
        position: { ...m.prop.body.position },
        hp: m.prop.hp,
        explodesAt: m.explodesAt,
      })),
      shots: g.shots.map((s) => ({
        pos: { ...s.pos },
        vel: { ...s.vel },
        damage: s.damage,
        life: s.life,
      })),
      checkpoint: g.checkpointSnapshot(),
      bodies: Composite.allBodies(g.engine.world).length,
    });
    for (let i = 0; i < 240; i++) {
      step(a.g, a.e);
      step(b.g, b.e);
      contractMachinePose(snapshot(a.g, a.e), i % 2 === 0);
      assert.deepEqual(native(a), native(b));
    }
    for (const { g, e } of [a, b]) g.hitEnemy(e, 100000, { x: 1300, y: 710 }, false);
    assert.deepEqual(native(a), native(b));
    assert.deepEqual(soundsA, soundsB);
    assert.deepEqual(awardsA, awardsB);
    assert.equal(a.g.rng(), b.g.rng());
  }
});
