import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Enemy, type Input } from '../src/game.ts';
import { machineBodySnapshot } from '../src/machine-breakdown-pose.ts';
import { hazardMachinePose, type HazardMachineKind } from '../src/hazard-machine-pose.ts';
import { drawHazardChassis } from '../src/hazard-machine-art.ts';
import { drawMachineChassis, drawMachineContacts } from '../src/machine-breakdown-art.ts';
import { drawScrapper } from '../src/scrapper-art.ts';
import { drawHarpooner } from '../src/harpooner-art.ts';
import { drawSapper, drawCharge, drawSapperBlasts } from '../src/sapper-art.ts';
import { harpoonMuzzle, HARPOON_RANGE } from '../src/harpooner.ts';
import { sapperMuzzle } from '../src/sapper.ts';
import {
  hazardCrewTestFromUrl,
  hazardCrewTestRoom,
  prepareHazardCrewTest,
} from '../src/hazard-crew-test.ts';

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
const kinds = ['scrapper', 'harpooner', 'sapper'] as const;
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1800, y: 500 },
};
function native(kind: HazardMachineKind) {
  const f = hazardCrewTestFromUrl(new URL('https://test/?test=hazard-crew&unit=' + kind + '&v=1'))!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, hazardCrewTestRoom(f));
  assert(prepareHazardCrewTest(g, f));
  for (const actor of g.enemies) actor.spawn = 0;
  const e = g.enemies.find((e) => e.kind === kind)!;
  assert(e);
  e.timer = 0;
  return { g, e };
}
function until(g: Game, e: Enemy, condition: () => boolean, max = 360) {
  for (let i = 0; i < max && !condition(); i++) g.tick(1 / 60, idle);
  assert(
    condition(),
    JSON.stringify({
      hp: g.hp,
      mode: g.mode,
      time: g.time,
      state: e.state,
      timer: e.timer,
      position: e.body.position,
      attacks: e.attacks,
      scrapper: e.scrapper?.phase,
      held: e.scrapper?.held?.body.position,
      harpoon: e.harpoon?.phase,
      charges: g.sappers.items.length,
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
  if (e.scrapper) drawScrapper(c, g, e, reduced, portrait);
  else if (e.harpoon) drawHarpooner(c, g, e, reduced, portrait);
  else drawSapper(c, g, e, reduced, portrait);
}

test('Scrapper clamp follows its real grabbed crate through lift, fixed aim and committed throw without painting a duplicate prop', () => {
  const { g, e } = native('scrapper'),
    crate = g.props.items.find((p) => p.kind === 'crate')!;
  assert(crate);
  const original = { ...crate.body.position };
  until(g, e, () => !!e.scrapper!.held);
  assert.equal(e.scrapper!.held, crate);
  let p = hazardMachinePose(snapshot(g, e));
  assert.equal(p.mode, 'lift');
  close(p.arm!.hand.x, crate.body.position.x - e.body.position.x);
  close(p.arm!.hand.y, crate.body.position.y - e.body.position.y);
  assert.equal(p.arm!.grip, 1);
  until(g, e, () => e.scrapper!.phase === 'aim');
  p = hazardMachinePose(snapshot(g, e));
  assert.equal(p.mode, 'aim');
  assert(crate.body.position.y < original.y - 30);
  assert.equal(p.arm!.elbow.y, -39);
  const c = canvas(true);
  draw(c.c, g, e);
  assert.equal(c.depth, 0);
  assert(
    c.ops.some(
      (o) =>
        o.name === 'moveTo' &&
        o.args[0] === e.scrapper!.release.x &&
        o.args[1] === e.scrapper!.release.y,
    ),
    'trajectory starts at real held release point',
  );
  const props = g.props.items.length,
    id = crate.body.id;
  until(g, e, () => e.attacks === 1);
  p = hazardMachinePose(snapshot(g, e));
  assert.equal(e.scrapper!.held, null);
  assert.equal(g.props.items.length, props);
  assert(g.props.items.some((p) => p.body.id === id));
  assert.equal(p.mode, 'throw');
  assert(p.release > 0.9);
  assert.equal(p.arm!.grip, 0);
  const thrown = canvas();
  drawHazardChassis(thrown.c, snapshot(g, e));
  const hand = p.arm!.hand;
  assert(
    thrown.ops.some(
      (o) =>
        o.name === 'lineTo' &&
        Math.abs(Number(o.args[0]) - hand.x) > 35 &&
        o.args[1] === hand.y + 10,
    ),
    'clamp opens wider than the real crate after release',
  );
  assert.equal(p.barrel, null);
  assert.equal(p.loader, null);
});

test('Harpooner winch pays out and reels native cable length; launch and release preserve the true muzzle and target', () => {
  const { g, e } = native('harpooner');
  until(g, e, () => e.harpoon!.phase === 'aim');
  let p = hazardMachinePose(snapshot(g, e)),
    m = harpoonMuzzle(e);
  close(p.barrel!.origin.x + e.body.position.x, m.x);
  close(p.barrel!.origin.y + e.body.position.y, m.y);
  const c = canvas(true);
  draw(c.c, g, e);
  const end = g.lineEnd(
    m,
    { x: m.x + e.aim.x * HARPOON_RANGE, y: m.y + e.aim.y * HARPOON_RANGE },
    4,
  );
  assert(c.ops.some((o) => o.name === 'moveTo' && o.args[0] === m.x && o.args[1] === m.y));
  assert(c.ops.some((o) => o.name === 'lineTo' && o.args[0] === end.x && o.args[1] === end.y));
  until(g, e, () => e.harpoon!.phase === 'flight');
  p = hazardMachinePose(snapshot(g, e));
  assert(p.release > 0.9);
  assert.equal(p.mode, 'flight');
  const flight = canvas(true);
  draw(flight.c, g, e);
  assert(
    flight.ops.some(
      (o) =>
        o.name === 'quadraticCurveTo' &&
        o.args[2] === e.harpoon!.head.x &&
        o.args[3] === e.harpoon!.head.y,
    ),
  );
  until(g, e, () => e.harpoon!.phase === 'latched');
  assert.equal(e.harpoon!.target, g.player);
  p = hazardMachinePose(snapshot(g, e));
  assert.equal(p.mode, 'latched');
  const length = e.harpoon!.length,
    spool = p.spool!.angle;
  for (let i = 0; i < 6; i++) g.tick(1 / 60, idle);
  assert(e.harpoon!.length < length);
  assert.notEqual(hazardMachinePose(snapshot(g, e)).spool!.angle, spool);
  g.harpoons.release(e);
  g.machineBreakdown.update();
  assert.equal(e.harpoon!.phase, 'ready');
  assert.equal(e.harpoon!.target, null);
  const braking = hazardMachinePose(snapshot(g, e));
  assert.equal(braking.mode, 'braking');
  assert(braking.brake > 0.9);
  assert.equal(braking.release, 0);
  const after = canvas(true);
  draw(after.c, g, e);
  assert(
    !after.ops.some((o) => o.name === 'quadraticCurveTo'),
    'released native cable is never retained as a cosmetic ghost',
  );
});

test('Sapper loading rail, exact ejection cup and recoil follow successful native charge launch, never an interrupted windup', () => {
  const { g, e } = native('sapper');
  until(g, e, () => e.state === 'windup');
  let p = hazardMachinePose(snapshot(g, e));
  const muzzle = sapperMuzzle(e);
  assert(p.loader!.charge);
  assert.equal(p.barrel!.recoil, 0);
  close(p.barrel!.origin.x + e.body.position.x, muzzle.x);
  close(p.barrel!.origin.y + e.body.position.y, muzzle.y);
  const arc = structuredClone(e.sapper!.arc),
    c = canvas(true);
  draw(c.c, g, e);
  assert(
    c.ops.some((o) => o.name === 'moveTo' && o.args[0] === arc[0].x && o.args[1] === arc[0].y),
  );
  for (const point of arc.slice(1))
    assert(
      c.ops.some((o) => o.name === 'lineTo' && o.args[0] === point.x && o.args[1] === point.y),
    );
  assert(
    c.ops.some(
      (o) =>
        o.name === 'arc' &&
        o.args[0] === arc.at(-1)!.x &&
        o.args[1] === arc.at(-1)!.y &&
        o.args[2] === 12,
    ),
  );
  const first = p.loader!.stroke;
  until(g, e, () => e.state === 'windup' && e.timer < 0.5);
  assert(hazardMachinePose(snapshot(g, e)).loader!.stroke > first);
  until(g, e, () => e.attacks === 1);
  p = hazardMachinePose(snapshot(g, e));
  assert.equal(g.sappers.items.length, 1);
  assert(!p.loader!.charge);
  assert(p.barrel!.recoil > 0.9);
  assert.equal(e.sapper!.arc.length, 0);
  const charge = g.sappers.items[0],
    nativeCharge = canvas(true);
  drawCharge(nativeCharge.c, g, charge, false);
  drawSapperBlasts(nativeCharge.c, g, false);
  assert.equal(nativeCharge.depth, 0);
  const blocked = native('sapper');
  until(blocked.g, blocked.e, () => blocked.e.state === 'windup');
  blocked.g.sappers.disrupt(blocked.e.body);
  blocked.g.machineBreakdown.update();
  assert.equal(blocked.e.attacks, 0);
  assert.equal(blocked.g.sappers.items.length, 0);
  assert.equal(hazardMachinePose(snapshot(blocked.g, blocked.e)).barrel!.recoil, 0);
});

test('accepted hits add body-local contacts and actual 65/30 wear while legacy flash cannot whiten the whole chassis', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind),
      max = e.maxHp;
    g.hitEnemy(e, max * 0.36, { x: e.body.position.x - 80, y: e.body.position.y }, false);
    assert(e.hp > 0);
    assert.equal(hazardMachinePose(snapshot(g, e)).wear, 1);
    const hit = g.machineBreakdown.getHits(e.id).at(-1)!;
    assert(hit.contact && hit.healthLost > 0);
    const a = canvas();
    drawHazardChassis(a.c, snapshot(g, e));
    e.flash = 0;
    const b = canvas();
    drawHazardChassis(b.c, snapshot(g, e));
    assert.deepEqual(a.ops, b.ops, 'accepted-hit flash cannot alter every plate color');
    const contact = canvas();
    drawMachineContacts(contact.c, g, e, false);
    assert(contact.ops.some((o) => o.name === 'arc' && o.args[2] === 2.8));
    assert.equal(contact.depth, 0);
    g.hitEnemy(e, max * 0.35, { x: e.body.position.x + 80, y: e.body.position.y }, false);
    assert(e.hp > 0);
    assert.equal(hazardMachinePose(snapshot(g, e)).wear, 2);
    g.time += 0.25;
    const expired = canvas();
    drawMachineContacts(expired.c, g, e, false);
    assert(!expired.ops.some((o) => o.name === 'arc'));
  }
});

test('all three family rigs render finite bounded hardware across native state, facing, wear, vertical aim, faction and Reduced Effects', () => {
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
                p = hazardMachinePose(s, reduced),
                c = canvas();
              numeric(p);
              drawHazardChassis(c.c, s, reduced, p);
              assert.equal(c.depth, 0);
              assert(c.ops.length < 700);
              const shared = canvas();
              drawMachineChassis(shared.c, s, reduced);
              assert.deepEqual(
                shared.ops,
                c.ops,
                'shared hit/render pipeline uses the exact family rig',
              );
              rendered++;
            }
  }
  assert.equal(rendered, 432);
});

test('portraits contain one chassis with no world trajectory, cable, charge, health bar or aim markers', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    until(g, e, () =>
      kind === 'scrapper'
        ? e.scrapper!.phase === 'aim'
        : kind === 'harpooner'
          ? e.harpoon!.phase === 'aim'
          : e.state === 'windup',
    );
    e.hp = 1;
    const c = canvas();
    draw(c.c, g, e, false, true);
    assert.equal(c.depth, 0);
    assert(
      !c.ops.some(
        (o) => o.name === 'fillRect' && [34].includes(Number(o.args[2])) && o.args[3] === 2,
      ),
      'portrait has no health bar',
    );
    if (e.scrapper) {
      const hand = e.scrapper.held!.body.position;
      assert(
        !c.ops.some((o) => o.name === 'translate' && o.args[0] === hand.x && o.args[1] === hand.y),
        'actual crate remains in prop pass',
      );
    }
  }
});

test('live render is read-only for RNG, physics IDs, constraints, props, native mechanisms, saves and audio', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    until(g, e, () =>
      kind === 'scrapper'
        ? e.scrapper!.phase === 'aim'
        : kind === 'harpooner'
          ? e.harpoon!.phase === 'latched'
          : e.attacks === 1,
    );
    const capture = () =>
      JSON.stringify({
        checkpoint: g.checkpointSnapshot(),
        enemy: {
          pos: e.body.position,
          vel: e.body.velocity,
          state: e.state,
          timer: e.timer,
          hp: e.hp,
          aim: e.aim,
          attacks: e.attacks,
          scrapper: e.scrapper
            ? {
                phase: e.scrapper.phase,
                held: e.scrapper.held?.body.id,
                release: e.scrapper.release,
                velocity: e.scrapper.velocity,
              }
            : null,
          harpoon: e.harpoon
            ? {
                phase: e.harpoon.phase,
                head: e.harpoon.head,
                length: e.harpoon.length,
                target: e.harpoon.target?.id,
              }
            : null,
          sapper: e.sapper,
        },
        props: g.props.items.map((p) => ({
          id: p.body.id,
          pos: p.body.position,
          vel: p.body.velocity,
          charge: p.charge
            ? { at: p.charge.at, born: p.charge.born, host: p.charge.host?.id }
            : null,
        })),
        constraints: Matter.Composite.allConstraints(g.engine.world).map((c) => ({
          id: c.id,
          length: c.length,
          pointA: c.pointA,
          pointB: c.pointB,
        })),
        shots: g.shots,
        particles: g.particles,
      });
    const before = capture(),
      id = (Matter.Common as unknown as { _nextId: number })._nextId;
    g.rng = () => {
      throw Error('draw RNG');
    };
    g.onSound = () => {
      throw Error('draw sound');
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

test('Pause freezes hardware and Reduced Effects suppresses secondary recoil while keeping actual mechanisms visible', () => {
  for (const kind of kinds) {
    const { g, e } = native(kind);
    until(g, e, () => e.attacks === 1);
    const s = snapshot(g, e),
      before = hazardMachinePose(s);
    g.setMode('paused');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, idle);
    assert.deepEqual(hazardMachinePose(snapshot(g, e)), before);
    const a = canvas();
    drawHazardChassis(a.c, snapshot(g, e), true);
    g.time += 1;
    const b = canvas();
    drawHazardChassis(b.c, snapshot(g, e), true);
    assert.deepEqual(a.ops, b.ops);
  }
});
