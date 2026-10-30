import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { huntTestFromUrl } from '../src/hunt-test.ts';
import { huntMuzzle } from '../src/hunts.ts';
import { drawHuntEnemy, drawHunts, drawHuntProps } from '../src/hunt-art.ts';
import { machineBodySnapshot, type MachineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { drawContractChassis } from '../src/contract-machine-art.ts';
import { contractMachinePose, type ContractMachineKind } from '../src/contract-machine-pose.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';

type Op = { name: string; args: unknown[] };
function canvas(world = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(state, key)) return state[String(key)];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 6 });
      if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
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
          'chassis contains no world warnings or captions',
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
const kinds = ['cableweaver', 'bulwark', 'demolisher'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1460, y: 705 },
};
function native(kind: ContractMachineKind) {
  const g = new Game(),
    f = huntTestFromUrl(new URL('https://test/?test=hunt&hunt=' + kind + '&v=1'))!;
  assert(f);
  g.startTest(f);
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.spawn = 0;
  return { g, e };
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, a + ' != ' + b);
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function deploy(g: Game, e: Enemy) {
  e.state = 'windup';
  e.timer = 0;
  e.attack = 'mortar';
  e.target = { x: 1000, y: 730 };
  g.hunts.updateEnemy(e);
  g.machineBreakdown.update();
}
function state(g: Game, e: Enemy) {
  return JSON.stringify({
    time: g.time,
    hp: g.hp,
    mode: g.mode,
    e: {
      hp: e.hp,
      state: e.state,
      timer: e.timer,
      attacks: e.attacks,
      pos: e.body.position,
      vel: e.body.velocity,
      angle: e.body.angle,
    },
    props: g.props.items.map((p) => ({ id: p.body.id, hp: p.hp, pos: p.body.position })),
    cables: g.hunts.cables.map((v) => ({
      ids: v.anchors.map((p) => p.body.id),
      live: v.liveAt,
      end: v.endsAt,
    })),
    mines: g.hunts.mines.map((v) => ({ id: v.prop.body.id, at: v.explodesAt })),
    supplies: g.hunts.supplies,
    shots: g.shots.map((v) => ({ pos: v.pos, vel: v.vel, damage: v.damage })),
    snapshot: snapshot(g, e),
  });
}

test('each Contract chassis uses distinct connected hardware, finite balanced Canvas calls and the shared dispatch', () => {
  const operations = [];
  for (const kind of kinds) {
    const { g, e } = native(kind),
      s = snapshot(g, e),
      p = contractMachinePose(s),
      a = canvas(),
      b = canvas();
    drawContractChassis(a.c, s);
    drawMachineChassis(b.c, s);
    assert.deepEqual(a.ops, b.ops);
    assert.equal(a.depth, 0);
    assert(a.ops.length > 150);
    operations.push(JSON.stringify(a.ops));
    assert.equal(p.drums.length, kind === 'cableweaver' ? 2 : 0);
    assert.equal(p.rack.length, kind === 'demolisher' ? 6 : 0);
    assert(
      a.ops.some(
        (o) =>
          o.name === 'translate' &&
          o.args[0] === p.barrel.origin.x &&
          o.args[1] === p.barrel.origin.y,
      ),
    );
    dispose(g);
  }
  assert.equal(new Set(operations).size, 3);
});

test('real admitted volleys cycle each receiver while preserving the exact high Bulwark and low hunt muzzles', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind),
      origin = huntMuzzle(e),
      angle = Math.atan2(g.player.position.y - origin.y, g.player.position.x - origin.x);
    assert.equal(origin.y, e.body.position.y - (kind === 'bulwark' ? 95 : 27));
    g.enemyShot(e, angle, 8.5, 14, origin);
    const shot = g.shots.at(-1)!;
    assert(shot);
    const s = snapshot(g, e),
      p = contractMachinePose(s),
      a = canvas();
    assert(p.recoil > 0.99);
    drawContractChassis(a.c, s);
    close(p.barrel.origin.x + e.body.position.x, shot.pos.x);
    close(p.barrel.origin.y + e.body.position.y, shot.pos.y);
    close(p.gimbal.center.x + e.body.position.x, origin.x);
    close(p.gimbal.center.y + e.body.position.y, origin.y);
    assert(
      a.ops.some(
        (o) =>
          o.name === 'translate' &&
          o.args[0] === p.barrel.origin.x &&
          o.args[1] === p.barrel.origin.y,
      ),
    );
    dispose(g);
  }
});

test('a native full projectile cap cannot invent receiver motion or cosmetic release hardware', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
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
    g.enemyShot(e, 0, 8.5, 14, huntMuzzle(e));
    const p = contractMachinePose(snapshot(g, e));
    assert.equal(p.recoil, 0);
    assert.equal(p.receiver, 0);
    assert.equal(snapshot(g, e).contractMachine!.discharges.length, 0);
    dispose(g);
  }
});

test('Cableweaver drums release only on a real anchor deployment, show native tension and react to an actual cut', () => {
  const { g, e } = native('cableweaver');
  e.state = 'windup';
  e.attack = 'mortar';
  e.timer = 0.45;
  let p = contractMachinePose(snapshot(g, e));
  assert(p.drums.every((v) => v.release === 0 && v.tension === 0));
  deploy(g, e);
  assert.equal(g.hunts.cables.length, 1);
  p = contractMachinePose(snapshot(g, e));
  assert(p.drums.every((v) => v.release > 0.99));
  assert(p.deploy > 0.99);
  assert.equal(p.recoil, 0);
  g.time = g.hunts.cables[0].liveAt;
  p = contractMachinePose(snapshot(g, e));
  assert(p.drums.every((v) => v.tension > 0));
  const anchor = g.hunts.cables[0].anchors[0];
  g.hunts.hitProp(anchor, 22, { x: 1, y: 0 }, true);
  p = contractMachinePose(snapshot(g, e));
  assert.equal(g.hunts.cables.length, 0);
  assert(p.drums.every((v) => v.tension === 0));
  assert(p.interruption > 0.99);
  assert.equal(p.recoil, 0);
  const a = canvas();
  drawContractChassis(a.c, snapshot(g, e));
  assert(a.ops.length > 150);
  dispose(g);
});

test('Bulwark brace shutters follow actual shield props and expose the core only after both native plates break', () => {
  const { g, e } = native('bulwark');
  assert.equal(g.hunts.plates.length, 2);
  const before = canvas();
  drawContractChassis(before.c, snapshot(g, e));
  let p = contractMachinePose(snapshot(g, e));
  assert(p.shield.closed);
  assert.equal(p.shield.extension, 1);
  assert.equal(p.shield.plates.length, 2);
  g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
  p = contractMachinePose(snapshot(g, e));
  assert(p.shield.closed);
  assert.equal(p.shield.plates.length, 1);
  g.hunts.hitProp(g.hunts.plates[0], 100, { x: 1, y: 0 }, true);
  p = contractMachinePose(snapshot(g, e));
  assert(!p.shield.closed);
  assert.equal(p.shield.extension, 0);
  assert.equal(p.shield.plates.length, 0);
  assert(p.interruption > 0.99);
  const after = canvas();
  drawContractChassis(after.c, snapshot(g, e));
  assert.notDeepEqual(before.ops, after.ops);
  assert.equal(g.hunts.armor(e), 1);
  dispose(g);
});

test('Demolisher rack cells count real remaining supplies, loader release follows deployment, and disarm does not reload a spent cell', () => {
  const { g, e } = native('demolisher');
  assert.equal(contractMachinePose(snapshot(g, e)).rack.filter((v) => v.loaded).length, 6);
  e.state = 'windup';
  e.attack = 'mortar';
  e.timer = 0.4;
  let p = contractMachinePose(snapshot(g, e));
  assert.equal(p.rack.filter((v) => v.arming > 0).length, 1);
  assert.equal(p.deploy, 0);
  deploy(g, e);
  assert.equal(g.hunts.mines.length, 1);
  p = contractMachinePose(snapshot(g, e));
  assert.equal(p.rack.filter((v) => v.loaded).length, 5);
  assert(p.deploy > 0.99);
  assert.equal(p.recoil, 0);
  const mine = g.hunts.mines[0];
  g.hunts.hitProp(mine.prop, 12, { x: 1, y: 0 }, true);
  p = contractMachinePose(snapshot(g, e));
  assert.equal(g.hunts.mines.length, 0);
  assert.equal(p.rack.filter((v) => v.loaded).length, 5);
  assert(p.interruption > 0.99);
  dispose(g);
});

test('real accepted hull hits produce local contacts and persistent 65/30 percent wear without a white hull flash', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    const armor = g.hunts.armor(e);
    g.hitEnemy(e, (e.maxHp * 0.4) / armor, { x: e.body.position.x - 90, y: e.body.position.y });
    let s = snapshot(g, e);
    assert.equal(contractMachinePose(s).wear, 1);
    const a = canvas();
    drawContractChassis(a.c, s);
    drawMachineContacts(a.c, g, e, false);
    assert(g.machineBreakdown.getHits(e.id).some((v) => v.healthLost > 0 && v.contact));
    assert(!a.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#fff8dc'));
    g.time += 0.3;
    g.hitStop = 0;
    g.hitEnemy(e, (e.maxHp * 0.35) / armor, { x: e.body.position.x + 90, y: e.body.position.y });
    s = snapshot(g, e);
    assert.equal(contractMachinePose(s).wear, 2);
    const b = canvas();
    drawContractChassis(b.c, s);
    assert.notDeepEqual(a.ops, b.ops);
    dispose(g);
  }
});

test('Reduced Effects retains native gear and armor information while suppressing transient receiver recoil', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    g.enemyShot(e, 0, 8.5, 14, huntMuzzle(e));
    const s = snapshot(g, e),
      normal = contractMachinePose(s),
      reduced = contractMachinePose(s, true);
    assert(normal.recoil > 0);
    assert.equal(reduced.recoil, 0);
    assert.deepEqual(normal.shield, reduced.shield);
    assert.deepEqual(
      normal.rack.map((v) => v.loaded),
      reduced.rack.map((v) => v.loaded),
    );
    const a = canvas();
    drawContractChassis(a.c, s, true);
    assert.equal(a.depth, 0);
    dispose(g);
  }
});

test('native body wrappers retain one health bar and native windup ring, while portraits omit HUD and contact marks', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.state = 'windup';
    e.timer = 0.6;
    const a = canvas();
    assert(drawHuntEnemy(a.c, g, e, false));
    assert.equal(a.depth, 0);
    assert.equal(
      a.ops.filter((o) => o.name === 'fillRect' && o.args[0] === -45 && o.args[1] === -58).length,
      2,
    );
    assert.equal(a.ops.filter((o) => o.name === 'arc' && o.args[2] === 48).length, 1);
    const b = canvas();
    assert(drawHuntEnemy(b.c, g, e, false, true));
    assert(!b.ops.some((o) => o.name === 'fillRect' && o.args[0] === -45 && o.args[1] === -58));
    assert(!b.ops.some((o) => o.name === 'arc' && o.args[2] === 48));
    dispose(g);
  }
});

test('drawing all native body and world passes is deterministic, side-effect free and paused frames remain fixed', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    if (kind !== 'bulwark') deploy(g, e);
    const before = state(g, e),
      a = canvas(),
      b = canvas();
    drawHuntEnemy(a.c, g, e, false);
    drawHuntEnemy(b.c, g, e, false);
    assert.deepEqual(a.ops, b.ops);
    const world = canvas(true);
    drawHunts(world.c, g);
    drawHuntProps(world.c, g);
    assert.equal(before, state(g, e));
    g.mode = 'paused';
    const p1 = contractMachinePose(snapshot(g, e));
    for (let i = 0; i < 12; i++) g.tick(1 / 60, idle);
    const p2 = contractMachinePose(snapshot(g, e));
    assert.deepEqual(p1, p2);
    dispose(g);
  }
});

test('inactive production geometry emits no loaded payloads, live energy colors, cables, mines or additional warnings', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind),
      s = snapshot(g, e),
      p = contractMachinePose(s);
    p.energy = 0;
    p.recoil = 0;
    p.deploy = 0;
    p.interruption = 0;
    p.rack = p.rack.map((v) => ({ ...v, loaded: false, arming: 0 }));
    const a = canvas();
    drawContractChassis(a.c, s, false, p);
    assert(
      !a.ops.some(
        (o) =>
          o.name === 'style:fillStyle' &&
          ['#87d4cc', '#c1caaa', '#e8b87e', '#efce9b'].includes(String(o.args[0])),
      ),
    );
    assert.equal(a.depth, 0);
    dispose(g);
  }
});
