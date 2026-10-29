import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import {
  districtMachinePose,
  districtNativeAngles,
  type DistrictMachineKind,
} from '../src/district-machine-pose.ts';
import { drawDistrictChassis } from '../src/district-machine-art.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import { drawReclamationEnemy } from '../src/reclamation-art.ts';
import { drawCoolingEnemy, updateCoolingEnemy } from '../src/cooling.ts';
import { updateReclamationEnemy } from '../src/reclamation.ts';
import {
  districtMachinesTestFromUrl,
  districtMachinesTestRoom,
  prepareDistrictMachinesTest,
} from '../src/district-machines-test.ts';

type Op = { name: string; args: unknown[] };
function canvas(warnings = false) {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    state: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_, key) {
      if (Object.hasOwn(state, key)) return state[String(key)];
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
        assert(!['fillText', 'strokeText', 'drawImage', 'clearRect'].includes(String(key)));
        assert(warnings || key !== 'setLineDash', 'chassis adds no world warnings');
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
const kinds = ['borer', 'sifter', 'skimmer'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: DistrictMachineKind, scene = 'animations') {
  const f = districtMachinesTestFromUrl(
    new URL('https://test/?test=district-machines&unit=' + kind + '&scene=' + scene + '&v=1'),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, districtMachinesTestRoom(f));
  assert(prepareDistrictMachinesTest(g, f));
  for (const actor of g.enemies) actor.spawn = 0;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  return { g, e };
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 300) {
  for (let i = 0; i < max && !condition(); i++) g.tick(1 / 60, idle);
  assert(
    condition(),
    JSON.stringify({
      hp: g.hp,
      mode: g.mode,
      time: g.time,
      state: e.state,
      timer: e.timer,
      pos: e.body.position,
      attacks: e.attacks,
    }),
  );
}
const snapshot = (g: Game, e: Enemy) => machineBodySnapshot(e, g.time, g)!;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, a + ' != ' + b);
function numeric(v: unknown) {
  if (typeof v === 'number') assert(Number.isFinite(v));
  else if (Array.isArray(v)) v.forEach(numeric);
  else if (v && typeof v === 'object') Object.values(v).forEach(numeric);
}
function draw(c: CanvasRenderingContext2D, g: Game, e: Enemy, reduced = false, portrait = false) {
  if (e.kind === 'skimmer') drawCoolingEnemy(c, g, e, reduced, portrait);
  else drawReclamationEnemy(c, g, e, reduced, portrait);
}
function release(g: Game, e: Enemy) {
  e.timer = 0;
  if (e.kind === 'skimmer') updateCoolingEnemy(g, e);
  else updateReclamationEnemy(g, e, 1 / 60);
  g.machineBreakdown.update();
}

test('Borer brace derives actual nearby loose cover and tracked drive derives ground motion, without painting or moving the crate', () => {
  const { g, e } = native('borer'),
    crate = g.props.items.find((p) => p.kind === 'crate')!;
  assert(crate);
  const pos = { ...crate.body.position };
  assert.equal(e.state, 'idle');
  const p = districtMachinePose(snapshot(g, e));
  assert.equal(p.coverBrace, 1);
  assert.equal(p.mode, 'braced');
  const c = canvas();
  drawDistrictChassis(c.c, snapshot(g, e));
  assert.equal(c.depth, 0);
  assert.deepEqual(crate.body.position, pos);
  assert.equal(p.tread, 0);
  Matter.Body.setVelocity(e.body, { x: 1.2, y: 0 });
  const moving = districtMachinePose(snapshot(g, e));
  assert.notEqual(moving.tread, 0);
  Matter.Body.translate(e.body, { x: 2, y: 0 });
  assert.notEqual(districtMachinePose(snapshot(g, e)).tread, moving.tread);
  Matter.Body.setVelocity(e.body, { x: 0, y: 0 });
  assert.equal(districtMachinePose(snapshot(g, e)).tread, 0);
  g.props.remove(crate);
  assert.equal(snapshot(g, e).districtMachine!.cover, null);
  assert.equal(districtMachinePose(snapshot(g, e)).coverBrace, 0);
});

test('native Borer compact burst, Sifter wide fan and Skimmer locked jets all retain their exact three release tips and recoil only after admitted shots', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions');
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    const before = snapshot(g, e),
      hardware = districtMachinePose(before),
      angles = districtNativeAngles(e);
    assert.equal(hardware.ports.length, 3);
    assert.equal(hardware.recoil, 0);
    for (let i = 0; i < 3; i++) {
      close(hardware.ports[i].angle, angles[i]);
      close(hardware.ports[i].origin.x + e.body.position.x, before.districtMachine!.muzzles[i].x);
      close(hardware.ports[i].origin.y + e.body.position.y, before.districtMachine!.muzzles[i].y);
    }
    const original = { ...e.aim };
    Matter.Body.setPosition(g.player, { x: 480, y: 600 });
    for (let i = 0; i < 5; i++) g.tick(1 / 60, idle);
    assert.notDeepEqual(e.aim, original);
    until(g, e, () => e.state === 'windup' && e.timer <= snapshot(g, e).districtMachine!.lock);
    const locked = { ...e.aim },
      s = snapshot(g, e);
    assert(s.districtMachine!.locked);
    assert.equal(districtMachinePose(s).mode, 'locked');
    Matter.Body.setPosition(g.player, { x: 460, y: 710 });
    for (let i = 0; i < 2; i++) g.tick(1 / 60, idle);
    assert.deepEqual(e.aim, locked);
    const ports = districtMachinePose(snapshot(g, e)).ports;
    g.shots = [];
    release(g, e);
    assert.equal(e.attacks, 1);
    assert.equal(g.shots.length, 3);
    for (const shot of g.shots)
      assert(
        ports.some(
          (p) =>
            Math.hypot(
              shot.pos.x - e.body.position.x - p.origin.x,
              shot.pos.y - e.body.position.y - p.origin.y,
            ) < 1e-7,
        ),
      );
    const fired = districtMachinePose(snapshot(g, e));
    assert(fired.recoil > 0.99);
    g.time += 0.12;
    assert(districtMachinePose(snapshot(g, e)).recoil < fired.recoil);
  }
});

test('a cap-blocked native release increments no cosmetic discharge and cannot move receivers or invent open ports', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions');
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
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
    release(g, e);
    assert.equal(e.state, 'recover');
    assert.equal(e.attacks, 1);
    assert.equal(g.shots.length, 180);
    assert.equal(snapshot(g, e).districtMachine!.dischargeAt, null);
    const p = districtMachinePose(snapshot(g, e));
    assert.equal(p.recoil, 0);
    assert(p.ports.every((p) => p.recoil === 0 && p.open === 0));
  }
});

test('a partially full native projectile cap preserves exactly one admitted muzzle and still drives a factual single discharge', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions');
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    const ports = districtMachinePose(snapshot(g, e)).ports;
    for (let i = 0; i < 179; i++)
      g.addShot({
        pos: { x: 40, y: 40 },
        vel: { x: 0, y: 0 },
        damage: 1,
        life: 10,
        radius: 2,
        friendly: false,
        bounces: 0,
      });
    release(g, e);
    assert.equal(g.shots.length, 180);
    assert.equal(e.attacks, 1);
    const d = snapshot(g, e).districtMachine!;
    assert.equal(d.dischargeMuzzles.length, 1);
    assert.equal(d.dischargeAngles.length, 1);
    const shot = g.shots.at(-1)!;
    close(shot.pos.x, e.body.position.x + ports[0].origin.x);
    close(shot.pos.y, e.body.position.y + ports[0].origin.y);
    close(d.dischargeMuzzles[0].x, shot.pos.x);
    close(d.dischargeMuzzles[0].y, shot.pos.y);
    assert(districtMachinePose(snapshot(g, e)).recoil > 0.99);
  }
});

test('Sifter and Skimmer retain native lane endpoints, lock dash rules and ordinary projectiles while body hardware changes', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions');
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    const c = canvas(true);
    draw(c.c, g, e);
    assert.equal(c.depth, 0);
    const p = e.body.position,
      angles = districtNativeAngles(e),
      offsets = kind === 'borer' ? [Math.atan2(e.aim.y, e.aim.x)] : angles;
    for (const angle of offsets) {
      const length = kind === 'skimmer' ? 800 : 480,
        end = g.lineEnd(p, {
          x: p.x + Math.cos(angle) * length,
          y: p.y + Math.sin(angle) * length,
        });
      assert(
        c.ops.some((o) => o.name === 'lineTo' && o.args[0] === end.x && o.args[1] === end.y),
        'native warning end retained',
      );
      const start =
        kind === 'skimmer' ? { x: p.x + Math.cos(angle) * 26, y: p.y + Math.sin(angle) * 26 } : p;
      assert(
        c.ops.some((o) => o.name === 'moveTo' && o.args[0] === start.x && o.args[1] === start.y),
        'native warning origin retained',
      );
    }
    const portrait = canvas();
    e.hp = 1;
    draw(portrait.c, g, e, false, true);
    assert.equal(portrait.depth, 0);
    assert(
      !portrait.ops.some((o) => o.name === 'fillRect' && o.args[1] === -28 && o.args[3] === 3),
      'portrait adds no health bar',
    );
  }
});

test('local accepted damage contacts and actual65/30 wear replace whole-machine whitening for every district kind', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions'),
      max = e.maxHp;
    g.hitEnemy(e, max * 0.36, { x: e.body.position.x - 80, y: e.body.position.y }, false);
    assert.equal(districtMachinePose(snapshot(g, e)).wear, 1);
    const hit = g.machineBreakdown.getHits(e.id).at(-1)!;
    assert(hit.contact && hit.healthLost > 0);
    const a = canvas();
    drawDistrictChassis(a.c, snapshot(g, e));
    e.flash = 0;
    const b = canvas();
    drawDistrictChassis(b.c, snapshot(g, e));
    assert.deepEqual(a.ops, b.ops);
    const contacts = canvas();
    drawMachineContacts(contacts.c, g, e, false);
    assert(contacts.ops.some((o) => o.name === 'arc' && o.args[2] === 2.8));
    assert.equal(contacts.depth, 0);
    g.hitEnemy(e, max * 0.35, { x: e.body.position.x + 80, y: e.body.position.y }, false);
    assert(e.hp > 0);
    assert.equal(districtMachinePose(snapshot(g, e)).wear, 2);
  }
});

test('all family rigs render finite bounded ports and machinery across state, wear, facing, vertical aim, factions and Reduced Effects', () => {
  let rendered = 0;
  for (const kind of kinds) {
    const { g, e } = native(kind);
    for (const state of ['idle', 'windup', 'recover'] as Enemy['state'][])
      for (const ratio of [1, 0.65, 0.3])
        for (const facing of [-1, 1])
          for (const reduced of [false, true])
            for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
              e.state = state;
              e.timer = 0.2;
              e.hp = e.maxHp * ratio;
              e.facing = facing;
              e.aim = { x: Math.cos(angle), y: Math.sin(angle) };
              e.allied = facing < 0;
              const s = snapshot(g, e),
                p = districtMachinePose(s, reduced),
                c = canvas();
              numeric(p);
              drawDistrictChassis(c.c, s, reduced, p);
              assert.equal(c.depth, 0);
              assert(c.ops.length < 900);
              const common = canvas();
              drawMachineChassis(common.c, s, reduced);
              assert.deepEqual(common.ops, c.ops);
              rendered++;
            }
  }
  assert.equal(rendered, 432);
});

test('rendering leaves native controller, exact muzzle, crate, RNG, Matter IDs, shots, saves and audio unchanged', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    const capture = () =>
      JSON.stringify({
        save: g.checkpointSnapshot(),
        pos: e.body.position,
        vel: e.body.velocity,
        state: e.state,
        timer: e.timer,
        hp: e.hp,
        aim: e.aim,
        shots: g.shots,
        particles: g.particles,
        props: g.props.items.map((p) => ({
          id: p.body.id,
          pos: p.body.position,
          vel: p.body.velocity,
          hp: p.hp,
        })),
        muzzles: snapshot(g, e).districtMachine!.muzzles,
      });
    const before = capture(),
      id = (Matter.Common as unknown as { _nextId: number })._nextId;
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw audio');
    };
    g.onCheckpoint = () => {
      throw Error('draw save');
    };
    for (const reduced of [false, true]) {
      const c = canvas(true);
      draw(c.c, g, e, reduced);
      assert.equal(c.depth, 0);
    }
    assert.equal(capture(), before);
    assert.equal((Matter.Common as unknown as { _nextId: number })._nextId, id);
  }
});

test('Pause freezes district hardware; Reduced Effects holds secondary rotation and recoil without hiding actual lock or cover state', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind, 'reactions');
    e.timer = 0;
    until(g, e, () => e.state === 'windup');
    release(g, e);
    const before = districtMachinePose(snapshot(g, e));
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(districtMachinePose(snapshot(g, e)), before);
    const a = canvas();
    drawDistrictChassis(a.c, snapshot(g, e), true);
    g.time += 1;
    const b = canvas();
    drawDistrictChassis(b.c, snapshot(g, e), true);
    assert.deepEqual(a.ops, b.ops);
  }
});

test('Sorter induction housings and Condenser ninety-by-seventy-six hull retain their original boss drawing paths', () => {
  const { g } = native('borer');
  const sorter = g.spawnEnemy('sorter', 1200, 400)!;
  sorter.spawn = 0;
  const a = canvas(true);
  drawReclamationEnemy(a.c, g, sorter, false);
  assert(a.ops.some((o) => o.name === 'fillRect' && JSON.stringify(o.args) === '[-48,-37,26,74]'));
  assert(a.ops.some((o) => o.name === 'fillRect' && JSON.stringify(o.args) === '[22,-37,26,74]'));
  assert.equal(a.depth, 0);
  const condenser = g.spawnEnemy('condenser', 1400, 400)!;
  condenser.spawn = 0;
  const b = canvas(true);
  drawCoolingEnemy(b.c, g, condenser, false);
  assert(
    b.ops.some((o) => o.name === 'roundRect' && JSON.stringify(o.args) === '[-45,-38,90,76,12]'),
  );
  assert(b.ops.some((o) => o.name === 'arc' && o.args[2] === 33));
  assert.equal(b.depth, 0);
});
