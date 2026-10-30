import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import {
  drawMachineWreck,
  drawMachineWrecks,
  projectMachineWreck,
} from '../src/machine-breakdown-wreck-art.ts';
import {
  contractShutdownPose,
  drawContractMachineWreck,
} from '../src/contract-machine-wreck-art.ts';
import { contractMachinePose } from '../src/contract-machine-pose.ts';
import { drawContractChassis } from '../src/contract-machine-art.ts';
import { MACHINE_MAX_WRECKS, type MachineWreck } from '../src/machine-breakdown.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import type { HuntKind } from '../src/hunt-rules.ts';
type Op = { name: string; args: unknown[] };
function canvas(world = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [];
  const values: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key in values) return values[String(key)];
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'measureText') return () => ({ width: 100 });
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...values });
        if (key === 'restore') {
          assert(stack.length > 0);
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, stack.pop());
        }
        assert(
          args.every((n) => typeof n !== 'number' || Number.isFinite(n)),
          String(key) + ' must use finite geometry',
        );
        assert(
          world ||
            !['fillText', 'strokeText', 'drawImage', 'clearRect', 'setLineDash'].includes(
              String(key),
            ),
          'wrecks must not add captions, health bars or warning footprints',
        );
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        ops.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    context,
    ops,
    values,
    get depth() {
      return stack.length;
    },
  };
}

const kinds = ['cableweaver', 'bulwark', 'demolisher'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 722 },
};
function course(kind: HuntKind) {
  const cp = huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&v=1`))!;
  assert(cp);
  const g = new Game();
  g.startTest(cp);
  g.time = 1;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  e.timer = 0;
  Matter.Body.setPosition(g.player, { x: 1000, y: 722 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.machineBreakdown.update();
  return { g, e };
}
function deploy(g: Game, e: Enemy) {
  if (e.kind === 'bulwark') {
    assert.equal(g.hunts.plates.length, 2);
    return;
  }
  e.state = 'idle';
  e.timer = 0;
  e.attacks = e.kind === 'demolisher' ? 1 : 0;
  g.hunts.updateEnemy(e);
  assert.equal(e.state, 'windup');
  assert.equal(e.attack, 'mortar');
  e.timer = 0;
  g.time += 1.15;
  g.hunts.updateEnemy(e);
  g.machineBreakdown.update();
  if (e.kind === 'cableweaver') assert.equal(g.hunts.cables.length, 1);
  else assert.equal(g.hunts.mines.length, 1);
}
function fan(g: Game, e: Enemy) {
  e.state = 'idle';
  e.timer = 0;
  e.attacks = e.kind === 'cableweaver' ? 1 : 0;
  g.hunts.updateEnemy(e);
  assert.equal(e.state, 'windup');
  assert.equal(e.attack, 'fan');
  e.timer = 0;
  g.time += 1.15;
  const from = g.shots.length;
  g.hunts.updateEnemy(e);
  g.machineBreakdown.update();
  const shots = g.shots.slice(from);
  assert.equal(shots.length, 3);
  return shots;
}
function defeat(g: Game, e: Enemy) {
  g.hitEnemy(e, 100000);
  const w = g.machineBreakdown.wrecks.find((w) => w.visual.id === e.id)!;
  assert(w, 'native defeat captures a detached hunt rig');
  return w;
}
function native(kind: HuntKind) {
  const { g, e } = course(kind);
  deploy(g, e);
  return { g, e, wreck: defeat(g, e) };
}
function close(a: number, b: number) {
  assert(Math.abs(a - b) < 1e-8, `${a} must equal ${b}`);
}
function inert(p: ReturnType<typeof contractShutdownPose>) {
  assert(p);
  assert.equal(p.energy, 0);
  assert.equal(p.mode, 'shutdown');
  assert.equal(p.recoil, 0);
  assert.equal(p.deploy, 0);
  assert.equal(p.interruption, 0);
  assert.equal(p.receiver, 0);
  assert(!p.shield.closed);
  assert(p.drums.every((d) => d.tension === 0 && d.release === 0));
  assert(p.rack.every((r) => !r.loaded && r.arming === 0));
}
function draw(wreck: MachineWreck, age: number, reduced = false) {
  const c = canvas();
  assert(drawMachineWreck(c.context, wreck, wreck.at + age, reduced));
  assert.equal(c.depth, 0);
  return c.ops;
}

test('each native Contract defeat folds its own rig into inert machinery rather than a generic boss flash', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { wreck } = native(kind),
      live = contractMachinePose(wreck.visual),
      start = contractShutdownPose(wreck.visual, 0)!,
      end = contractShutdownPose(wreck.visual, 0.38)!;
    inert(start);
    inert(end);
    assert.equal(end.wear, 2);
    assert.notDeepEqual(start.body, end.body);
    assert.notDeepEqual(start.legs, end.legs);
    assert.notEqual(start.barrel.angle, end.barrel.angle);
    assert.notDeepEqual(start.mast.tip, end.mast.tip);
    assert.equal(start.kind, kind);
    assert.equal(start.barrel.length, live.barrel.length);
    assert.deepEqual(
      contractShutdownPose(wreck.visual, 0.4),
      contractShutdownPose(wreck.visual, 0.8),
    );
    signatures.push(JSON.stringify(draw(wreck, 0.38)));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('Cableweaver captured cable tension loses drive and its two fixed-radius drums coast to a final stopped angle', () => {
  const { g, e } = course('cableweaver');
  deploy(g, e);
  g.time = g.hunts.cables[0].liveAt + 0.1;
  g.machineBreakdown.update();
  const wreck = defeat(g, e),
    live = contractMachinePose(wreck.visual),
    a = contractShutdownPose(wreck.visual, 0)!,
    b = contractShutdownPose(wreck.visual, 0.38)!;
  assert.equal(wreck.visual.contractMachine!.cables.length, 1);
  assert(live.drums.some((d) => d.tension > 0));
  assert.equal(a.drums.length, 2);
  assert.notDeepEqual(
    a.drums.map((d) => d.angle),
    b.drums.map((d) => d.angle),
  );
  assert.deepEqual(
    a.drums.map((d) => d.radius),
    b.drums.map((d) => d.radius),
  );
  inert(a);
  inert(b);
  assert.equal(g.hunts.cables.length, 0);
  assert(!g.props.items.some((p) => p.hunt));
});
test('Bulwark captures real shield plates before native cleanup and folds its connected gun mast without changing its length', () => {
  const { g, e } = course('bulwark'),
    plates = g.hunts.plates.map((p) => ({ id: p.body.id, p: { ...p.body.position }, hp: p.hp }));
  assert.equal(g.hunts.armor(e), 0.7);
  g.hitEnemy(e, 100, { x: e.body.position.x - 100, y: e.body.position.y });
  const hp = e.maxHp - 70;
  close(e.hp, hp);
  const wreck = defeat(g, e),
    h = wreck.visual.contractMachine!;
  assert(h.armorClosed);
  assert.equal(h.plates.length, 2);
  assert.equal(g.hunts.plates.length, 0);
  assert.deepEqual(
    h.plates.map((p) => ({ id: p.id, p: p.position, hp: p.hp })),
    plates,
  );
  close(wreck.hit!.healthLost, hp);
  assert(wreck.hit!.applied < wreck.hit!.incoming);
  const a = contractShutdownPose(wreck.visual, 0)!,
    b = contractShutdownPose(wreck.visual, 0.38)!;
  assert.equal(a.shield.extension, 1);
  assert.equal(b.shield.extension, 0);
  assert.equal(b.shield.plates.length, 2);
  inert(b);
  close(
    Math.hypot(a.mast.tip.x - a.mast.base.x, a.mast.tip.y - a.mast.base.y),
    Math.hypot(b.mast.tip.x - b.mast.base.x, b.mast.tip.y - b.mast.base.y),
  );
  close(a.gimbal.center.x - a.mast.tip.x, b.gimbal.center.x - b.mast.tip.x);
  close(a.gimbal.center.y - a.mast.tip.y, b.gimbal.center.y - b.mast.tip.y);
});
test('Demolisher captures its actual armed mine and supply count then lowers empty inert racks after native cleanup', () => {
  const { g, e } = course('demolisher');
  deploy(g, e);
  const mine = g.hunts.mines[0],
    at = mine.explodesAt,
    p = { ...mine.prop.body.position },
    wreck = defeat(g, e),
    h = wreck.visual.contractMachine!;
  assert.equal(h.supplies, 1);
  assert.equal(h.mines.length, 1);
  assert.equal(h.mines[0].explodesAt, at);
  assert.deepEqual(h.mines[0].prop.position, p);
  assert.equal(g.hunts.mines.length, 0);
  assert(!g.props.items.includes(mine.prop));
  const live = contractMachinePose(wreck.visual),
    a = contractShutdownPose(wreck.visual, 0)!,
    b = contractShutdownPose(wreck.visual, 0.38)!;
  assert.equal(live.rack.filter((r) => r.loaded).length, 5);
  assert.equal(b.rack.length, 6);
  assert.notDeepEqual(
    a.rack.map((r) => r.point),
    b.rack.map((r) => r.point),
  );
  inert(a);
  inert(b);
});
test('contract wrecks draw the exact production chassis override with no remote props, live warnings or extra effects', () => {
  for (const kind of kinds) {
    const { wreck } = native(kind),
      projection = projectMachineWreck(wreck, wreck.at + 0.2)!,
      pose = contractShutdownPose(wreck.visual, projection.age)!;
    const inactive = {
        ...wreck.visual,
        hp: 0,
        flash: 0,
        brace: 0,
        timer: 0,
        state: 'recover' as const,
        velocity: { x: 0, y: 0 },
      },
      a = canvas(),
      b = canvas();
    drawContractChassis(a.context, inactive, false, pose);
    assert(drawContractMachineWreck(b.context, wreck, projection));
    assert.deepEqual(a.ops, b.ops);
    assert(a.ops.length > 50 && a.ops.length < 2600);
    assert.notDeepEqual(draw(wreck, 0.02), draw(wreck, 0.38));
  }
});
test('actual emitted hunt volleys retain their native shot instances and damage after owner death; corpse art never fires', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind),
      shots = fan(g, e),
      records = shots.map((shot) => ({
        shot,
        pos: { ...shot.pos },
        vel: { ...shot.vel },
        damage: shot.damage,
        life: shot.life,
      })),
      attacks = e.attacks,
      wreck = defeat(g, e);
    draw(wreck, 0.3);
    for (const r of records) {
      assert(g.shots.includes(r.shot));
      assert.deepEqual(r.shot.pos, r.pos);
      assert.deepEqual(r.shot.vel, r.vel);
      assert.equal(r.shot.damage, r.damage);
      assert.equal(r.shot.life, r.life);
    }
    g.updateShots(1 / 60);
    assert(records.some((r) => r.shot.pos.x !== r.pos.x || r.shot.pos.y !== r.pos.y));
    g.hitStop = 0;
    for (let i = 0; i < 180; i++) g.tick(1 / 60, idle);
    assert.equal(e.attacks, attacks);
    assert(!g.enemies.includes(e));
    assert.equal(g.hunts.cables.length + g.hunts.mines.length + g.hunts.plates.length, 0);
  }
});
test('defeating a native deploy windup prevents any later anchor or mine deployment and does not invent loaded corpse ordnance', () => {
  for (const kind of ['cableweaver', 'demolisher'] as const) {
    const { g, e } = course(kind);
    e.attacks = kind === 'demolisher' ? 1 : 0;
    g.hunts.updateEnemy(e);
    assert.equal(e.state, 'windup');
    assert.equal(e.attack, 'mortar');
    const supplies = g.hunts.supplies,
      wreck = defeat(g, e);
    inert(contractShutdownPose(wreck.visual, 0.2));
    g.hitStop = 0;
    for (let i = 0; i < 180; i++) g.tick(1 / 60, idle);
    assert.equal(g.hunts.supplies, supplies);
    assert.equal(g.hunts.cables.length + g.hunts.mines.length, 0);
    assert(!g.props.items.some((p) => p.hunt));
  }
});
test('real player cable cuts and mine disarms remain captured interruption provenance while all corpse mechanisms stay unpowered', () => {
  for (const kind of ['cableweaver', 'demolisher'] as const) {
    const { g, e } = course(kind);
    deploy(g, e);
    const p = kind === 'cableweaver' ? g.hunts.cables[0].anchors[0] : g.hunts.mines[0].prop;
    const position = { ...p.body.position };
    g.hunts.hitProp(p, 100, { x: 1, y: 0 }, true);
    const wreck = defeat(g, e),
      interruption = wreck.visual.contractMachine!.interruption!;
    assert(interruption);
    assert.equal(interruption.kind, kind === 'cableweaver' ? 'cable-cut' : 'mine-disarm');
    assert.deepEqual(interruption.position, position);
    inert(contractShutdownPose(wreck.visual, 0.1));
    assert.equal(
      wreck.visual.contractMachine!.cables.length + wreck.visual.contractMachine!.mines.length,
      0,
    );
  }
});
test('native Bulwark plate break exposes its actual core, and the defeated snapshot retains only the remaining plate provenance', () => {
  const { g, e } = course('bulwark'),
    first = g.hunts.plates[0];
  g.hunts.hitProp(first, 100, { x: 1, y: 0 }, true);
  const remaining = g.hunts.plates[0];
  assert.equal(g.hunts.armor(e), 0.7);
  const w = defeat(g, e);
  assert.equal(w.visual.contractMachine!.plates.length, 1);
  assert.equal(w.visual.contractMachine!.plates[0].id, remaining.body.id);
  inert(contractShutdownPose(w.visual, 0.3));
  const x = course('bulwark');
  for (const p of [...x.g.hunts.plates]) x.g.hunts.hitProp(p, 100, { x: 1, y: 0 }, true);
  assert.equal(x.g.hunts.armor(x.e), 1);
  assert.equal(x.e.state, 'recover');
  const plain = defeat(x.g, x.e);
  assert(!plain.visual.contractMachine!.armorClosed);
  assert.equal(plain.visual.contractMachine!.plates.length, 0);
  inert(contractShutdownPose(plain.visual, 0.3));
});
test('contract wrecks settle against actual raised, moving and sloped supports and fade when that support disappears', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind),
      platform = g.level.solids.filter((s) => s.x > 1500).at(-1)!;
    assert(platform);
    const deck = g.solidBodies.find(
      (b) =>
        Math.abs(b.position.x - (platform.x + platform.w / 2)) < 1 &&
        Math.abs(b.position.y - (platform.y + platform.h / 2)) < 1,
    )!;
    assert(deck);
    Matter.Body.setPosition(e.body, { x: platform.x + platform.w / 2, y: platform.y - 30 });
    Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
    g.machineBreakdown.update();
    const wreck = defeat(g, e),
      landing = wreck.landing!;
    assert(landing);
    assert.equal(landing.bodyId, deck.id);
    assert(landing.point.y < 700);
    const before = { ...landing.point };
    Matter.Body.setPosition(deck, { x: deck.position.x + 20, y: deck.position.y - 17 });
    g.machineBreakdown.update();
    close(landing.point.x, before.x + 20);
    close(landing.point.y, before.y - 17);
    Matter.Body.setAngle(deck, -0.08);
    g.machineBreakdown.update();
    assert(Math.abs(landing.normal.x) > 0.05);
    assert(landing.normal.y < -0.9);
    assert.deepEqual(projectMachineWreck(wreck, wreck.at + 0.8)!.position, landing.center);
    assert(draw(wreck, 0.8).some((o) => o.name === 'clip'));
    g.terrain = g.terrain.filter((b) => b.id !== deck.id);
    g.machineBreakdown.update();
    assert(!landing.available);
    assert(wreck.lifetime <= 0.160001);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.161), null);
  }
});
test('unsupported Contract deaths never invent a floor or recreate native gear as landing support', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    g.hunts.clearGear();
    for (const body of g.terrain) Matter.Composite.remove(g.engine.world, body);
    g.terrain = [];
    for (const p of [...g.props.items]) g.props.remove(p);
    const wreck = defeat(g, e);
    assert.equal(wreck.landing, null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.750001), null);
    assert(!draw(wreck, 0.2).some((o) => o.name === 'clip'));
  }
});
test('Reduced Effects freezes distinct Contract shutdown poses inside the shared concise wreck lifetime', () => {
  const signatures = [];
  for (const kind of kinds) {
    const { wreck } = native(kind);
    assert.deepEqual(draw(wreck, 0.1, true), draw(wreck, 0.3, true));
    assert.notDeepEqual(draw(wreck, 0.1, true), draw(wreck, 0.1));
    assert.equal(projectMachineWreck(wreck, wreck.at + 0.900001, true), null);
    assert.equal(projectMachineWreck(wreck, wreck.at + 2.400001), null);
    inert(contractShutdownPose(wreck.visual, 0.1, true));
    signatures.push(JSON.stringify(draw(wreck, 0.1, true)));
  }
  assert.equal(new Set(signatures).size, 3);
});
test('detached Contract wreck drawing is finite, bounded and cannot mutate native gear, bodies, shots, damage, RNG, sound or saves', () => {
  for (const kind of kinds) {
    const { g, wreck } = native(kind);
    g.time += 0.3;
    const records = structuredClone(g.machineBreakdown.wrecks),
      bodies = () =>
        Matter.Composite.allBodies(g.engine.world).map((b) => ({
          id: b.id,
          p: { ...b.position },
          v: { ...b.velocity },
        })),
      beforeBodies = bodies(),
      shots = structuredClone(g.shots),
      hp = g.hp,
      kills = g.kills,
      gear = {
        cables: g.hunts.cables,
        mines: g.hunts.mines,
        plates: g.hunts.plates,
        supplies: g.hunts.supplies,
      };
    const random = Math.random,
      rng = g.rng;
    Math.random = g.rng = () => {
      throw Error('art cannot use RNG');
    };
    g.onSound = () => {
      throw Error('art cannot play audio');
    };
    g.onCheckpoint = () => {
      throw Error('art cannot save');
    };
    try {
      const a = canvas(),
        b = canvas();
      drawMachineWrecks(a.context, g);
      drawMachineWrecks(b.context, g);
      assert.deepEqual(a.ops, b.ops);
      assert(a.ops.length > 50 && a.ops.length < 2600);
      assert.deepEqual(g.machineBreakdown.wrecks, records);
      assert.deepEqual(bodies(), beforeBodies);
      assert.deepEqual(g.shots, shots);
      assert.equal(g.hp, hp);
      assert.equal(g.kills, kills);
      assert.deepEqual(
        {
          cables: g.hunts.cables,
          mines: g.hunts.mines,
          plates: g.hunts.plates,
          supplies: g.hunts.supplies,
        },
        gear,
      );
      g.machineBreakdown.wrecks = Array.from({ length: 50 }, () => structuredClone(wreck));
      const capped = canvas();
      drawMachineWrecks(capped.context, g);
      assert.equal(capped.ops.filter((o) => o.name === 'clip').length, MACHINE_MAX_WRECKS);
    } finally {
      Math.random = random;
      g.rng = rng;
    }
  }
});
test('production Renderer draws Contract wrecks beneath actors and actual warnings with exact Pause freeze', () => {
  const { g, wreck } = native('cableweaver');
  g.time += 0.4;
  const p = projectMachineWreck(wreck, g.time)!,
    c = canvas(true),
    element = {
      getContext: () => c.context,
      getBoundingClientRect: () => ({ width: 960, height: 600 }),
    } as unknown as HTMLCanvasElement,
    renderer = new Renderer(element, g);
  renderer.drawEnemies = () => c.ops.push({ name: 'layer:live', args: [] });
  renderer.drawPlayer = () => c.ops.push({ name: 'layer:player', args: [] });
  renderer.drawEnemyTells = () => c.ops.push({ name: 'layer:warnings', args: [] });
  renderer.draw(1000, { camera: { x: 0, y: 0 }, scale: 1, player: true, navigation: false });
  const corpse = c.ops.findIndex(
      (o) => o.name === 'translate' && o.args[0] === p.position.x && o.args[1] === p.position.y,
    ),
    live = c.ops.findIndex((o) => o.name === 'layer:live'),
    player = c.ops.findIndex((o) => o.name === 'layer:player'),
    warning = c.ops.findIndex((o) => o.name === 'layer:warnings');
  assert(corpse >= 0 && corpse < live && live < player && player < warning);
  assert.equal(c.depth, 0);
  const before = structuredClone(g.machineBreakdown.wrecks),
    time = g.time;
  g.setMode('paused');
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(g.time, time);
  assert.deepEqual(g.machineBreakdown.wrecks, before);
});
test('cleanup, spawning and later room resets never award or retain a Contract wreck', () => {
  for (const kind of kinds) {
    const { g, e } = course(kind);
    g.hitEnemy(e, 100000, undefined, false, false, false, 'cleanup');
    assert.equal(g.machineBreakdown.wrecks.length, 0);
    const x = course(kind);
    x.e.spawn = 1;
    x.g.hitEnemy(x.e, 100000);
    assert.equal(x.g.machineBreakdown.wrecks.length, 0);
    const y = native(kind);
    assert.equal(y.g.machineBreakdown.wrecks.length, 1);
    y.g.startTest(huntTestFromUrl(new URL(`https://test/?test=hunt&hunt=${kind}&v=1`))!);
    assert.equal(y.g.machineBreakdown.wrecks.length, 0);
  }
});
