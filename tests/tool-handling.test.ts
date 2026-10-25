import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Shot } from '../src/game.ts';
import { getGun } from '../src/rules.ts';
import { drawWeapon } from '../src/weapon-art.ts';
import { handlingCycle, nativeMechanism, toolHandling } from '../src/tool-handling.ts';
import {
  CombatFeel,
  COIL_IMPACT_LIFETIME,
  MAX_COMBAT_IMPACTS,
  combatImpactFrame,
  drawCombatImpacts,
} from '../src/combat-feel.ts';
import { fixture, target, wall, advance, round } from './branches-fixture.ts';

const guns = ['carbine', 'twinbore', 'repeater'] as const;
const idle = { left: false, right: false, jump: false, fire: false, aim: { x: 1400, y: 300 } };
function tool(gun: (typeof guns)[number], mods: string[] = []) {
  const g = fixture(mods);
  g.startingGun = gun;
  g.gun = getGun(mods, gun);
  return g;
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
type Operation = { op: string; args: unknown[]; fill: unknown; stroke: unknown; alpha: number };
function canvas() {
  const operations: Operation[] = [];
  const styles: Record<string, unknown> = {
    globalAlpha: 1,
    lineWidth: 1,
    fillStyle: '#fff',
    strokeStyle: '#000',
    lineCap: 'butt',
  };
  const stack: Record<string, unknown>[] = [];
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save') return () => stack.push({ ...styles });
      if (key === 'restore')
        return () => {
          assert(stack.length);
          Object.assign(styles, stack.pop());
        };
      if (key in styles) return styles[String(key)];
      return (...args: unknown[]) => {
        assert(args.filter((v) => typeof v === 'number').every(Number.isFinite), String(key));
        operations.push({
          op: String(key),
          args,
          fill: styles.fillStyle,
          stroke: styles.strokeStyle,
          alpha: Number(styles.globalAlpha),
        });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      styles[String(key)] = value;
      return true;
    },
  });
  return {
    c,
    operations,
    styles,
    get depth() {
      return stack.length;
    },
  };
}
function image(g: Game, reduced = false) {
  const out = canvas();
  drawWeapon(out.c, g, reduced);
  return out;
}
const rects = (out: ReturnType<typeof canvas>, color: string) =>
  out.operations.filter((o) => o.op === 'fillRect' && o.fill === color);
const ballistic = (g: Game) => ({
  gun: { ...g.gun },
  player: { position: { ...g.player.position }, velocity: { ...g.player.velocity } },
  shots: g.shots.map((s) => ({
    id: s.id,
    pos: s.pos,
    vel: s.vel,
    damage: s.damage,
    pierce: s.pierce,
    nativeTool: s.nativeTool,
    life: s.life,
  })),
});

test('mechanisms recover before native, fitted and burst discharge cadences', () => {
  for (const interval of [0.025, 0.08, 0.25, 0.7, 2])
    for (const burst of [1, 3]) {
      const cadence = interval * (burst === 3 ? 0.3 : 1);
      assert.equal(handlingCycle(0, interval, burst).kick, 1);
      assert.equal(handlingCycle(cadence, interval, burst).kick, 0);
      let previous = 1;
      for (let i = 0; i <= 40; i++) {
        const cycle = handlingCycle((cadence * i) / 40, interval, burst);
        assert(cycle.kick >= 0 && cycle.kick <= previous);
        assert(cycle.progress >= 0 && cycle.progress <= 1);
        previous = cycle.kick;
      }
    }
  for (const age of [NaN, Infinity, -1]) assert.equal(handlingCycle(age, 0.2).kick, 0);
});

test('carbine discharges its three coils then recharges in order on the simulation clock', () => {
  const g = tool('carbine');
  assert.deepEqual(toolHandling(g).coilCharge, [1, 1, 1]);
  g.fire();
  assert.deepEqual(toolHandling(g).coilCharge, [0, 0, 0]);
  const discharged = image(g);
  assert.equal(rects(discharged, '#9ddae0').filter((r) => Number(r.args[3]) === 0).length, 3);
  g.time += Math.min(g.gun.interval * 0.86, 0.5) * 0.5;
  g.muzzle = 0;
  const middle = toolHandling(g);
  assert(
    middle.coilCharge[0] > middle.coilCharge[1] && middle.coilCharge[1] > middle.coilCharge[2],
  );
  g.time += g.gun.interval;
  assert.deepEqual(toolHandling(g).coilCharge, [1, 1, 1]);
  assert.equal(toolHandling(g).kick, 0);
  assert.equal(rects(image(g), '#9ddae0').filter((r) => r.args[3] === 12).length, 3);
  clean(g);
});

test('Twinbore moves and flashes both paired barrels on one real two-round discharge', () => {
  const g = tool('twinbore');
  const rested = image(g, true);
  g.fire();
  assert.equal(g.shots.length, 2);
  assert.notEqual(g.shots[0].vel.y, g.shots[1].vel.y);
  const recoil = image(g, true);
  const tips = rects(recoil, '#ffe4ad');
  assert.deepEqual(
    tips.map((o) => o.args),
    [
      [39 - 4 * 0.16, -6.5, 3, 3],
      [39 - 4 * 0.16, 3.5, 3, 3],
    ],
  );
  assert.equal(rects(rested, '#ffe4ad').length, 0);
  assert.equal(recoil.depth, 0);
  const normal = image(g);
  assert.equal(normal.operations.filter((o) => o.op === 'fill' && o.fill === '#ffe4ad').length, 2);
  g.time += g.gun.interval;
  g.muzzle = 0;
  assert.deepEqual(toolHandling(g).twinKick, [0, 0]);
  assert.equal(rects(image(g), '#ffe4ad').length, 0, 'no delayed fictional discharge');
  clean(g);
});

test('repeater feeds once per actual shot and pressure accumulates then decays without a timer', () => {
  const g = tool('repeater');
  assert.equal(toolHandling(g).pressure, 0);
  const indices: number[] = [],
    pressures: number[] = [];
  for (let i = 0; i < 3; i++) {
    if (i) g.time += g.gun.interval;
    g.fire();
    indices.push(toolHandling(g).feed);
    pressures.push(toolHandling(g).pressure);
    const before = { feed: g.combatFeel.feedIndex, pressure: g.combatFeel.toolPressure };
    g.combatFeel.discharge(g);
    assert.deepEqual(
      { feed: g.combatFeel.feedIndex, pressure: g.combatFeel.toolPressure },
      before,
      'duplicate callback cannot advance feed',
    );
  }
  assert.deepEqual(indices, [1, 2, 0]);
  assert(pressures[1] > pressures[0] && pressures[2] > pressures[1]);
  const out = image(g);
  assert.equal(rects(out, '#ddb984')[0].args[2], 10 * pressures[2]);
  g.time += 2;
  assert(toolHandling(g).pressure < 0.02);
  const feed = g.combatFeel.feedIndex;
  g.combatFeel.discharge(g);
  assert.equal(g.combatFeel.feedIndex, feed, 'cooldown is not another discharge');
  g.loadRoom();
  assert.equal(g.combatFeel.feedIndex, 0);
  assert.equal(g.combatFeel.toolPressure, 0);
  assert.equal(g.combatFeel.tool, null);
  clean(g);
});

test('mechanical presentation freezes during pause and hitstop and never mutates native ballistics or RNG', () => {
  for (const gun of guns) {
    const g = tool(gun, ['scatter', 'rapid']),
      reference = tool(gun, ['scatter', 'rapid']);
    g.fire();
    reference.fire();
    const before = ballistic(g),
      handling = toolHandling(g),
      out = image(g);
    const impacts = canvas();
    drawCombatImpacts(impacts.c, g, false, []);
    assert.deepEqual(ballistic(g), before);
    assert.deepEqual(ballistic(g), ballistic(reference));
    assert.equal(g.rng(), reference.rng());
    g.setMode('paused');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, idle);
    assert.deepEqual(toolHandling(g), handling);
    assert.deepEqual(image(g).operations, out.operations);
    g.setMode('playing');
    g.hitStop = 0.2;
    g.tick(1 / 60, idle);
    assert.deepEqual(toolHandling(g), handling);
    assert.deepEqual(image(g).operations, out.operations);
    for (const reduced of [false, true]) {
      const rendered = image(g, reduced);
      assert.equal(rendered.depth, 0);
      assert(rendered.operations.length < 190);
    }
    clean(g);
    clean(reference);
  }
});

test('native carbine penetration marks only actual contacted bodies and stops at walls', () => {
  const g = tool('carbine');
  const front = target(g, 500),
    barrier = wall(g, 620, 300, 30, 160),
    hidden = target(g, 780);
  g.fire();
  advance(g, 18);
  const marks = g.combatFeel.impacts.filter((i) => i.kind === 'coil');
  assert(marks.some((i) => i.body === front.body));
  assert(marks.some((i) => i.body === barrier));
  assert(!marks.some((i) => i.body === hidden.body));
  assert.equal(hidden.hp, hidden.maxHp);
  assert(front.hp < front.maxHp);
  for (const mark of marks) {
    assert(mark.body);
    const frame = combatImpactFrame(mark);
    assert(frame.pos.x >= mark.body.bounds.min.x - 1 && frame.pos.x <= mark.body.bounds.max.x + 1);
  }
  clean(g);
  const open = tool('carbine');
  const first = target(open, 450),
    second = target(open, 600),
    third = target(open, 780);
  open.fire();
  advance(open, 18);
  assert.deepEqual(
    open.combatFeel.impacts.filter((i) => i.kind === 'coil').map((i) => i.body),
    [first.body, second.body],
  );
  assert.equal(third.hp, third.maxHp, 'the base native pierce count remains one extra enemy');
  clean(open);
});

test('compact carbine marks follow moving targets, deduplicate, expire and disappear with their actual bodies', () => {
  const g = tool('carbine'),
    body = wall(g, 500, 300, 30, 150),
    s = round(g, { nativeTool: 'carbine', pos: { x: 482.5, y: 300 } });
  g.combatFeel.impact(s, { x: -1, y: 0 }, g.time, body);
  g.combatFeel.impact(s, { x: -1, y: 0 }, g.time, body);
  assert.equal(g.combatFeel.impacts.length, 1);
  assert(g.combatFeel.hasAttachments);
  const mark = g.combatFeel.impacts[0],
    old = combatImpactFrame(mark);
  assert.deepEqual(old.pos, { x: 485, y: 300 });
  Matter.Body.translate(body, { x: 30, y: -20 });
  assert.deepEqual(combatImpactFrame(mark).pos, { x: old.pos.x + 30, y: old.pos.y - 20 });
  Matter.Body.setAngle(body, Math.PI / 2);
  const moved = combatImpactFrame(mark);
  assert(Math.abs(moved.normal.x) < 1e-8 && Math.abs(moved.normal.y + 1) < 1e-8);
  for (const reduced of [false, true]) {
    const out = canvas();
    drawCombatImpacts(out.c, g, reduced, []);
    assert.equal(out.depth, 0);
    assert(
      out.operations
        .filter((o) => ['moveTo', 'lineTo'].includes(o.op))
        .every((o) => o.args.every((v) => Math.abs(Number(v)) <= 10)),
      'contact marks never become a cross-map trail',
    );
    assert(
      out.operations.some((o) => o.op === 'arc' && o.args[2] === 2.5),
      'Reduced Effects retains the physical contact ring',
    );
  }
  g.combatFeel.update(g.time + COIL_IMPACT_LIFETIME - 0.001, [body], () => {});
  assert.equal(g.combatFeel.impacts.length, 1);
  g.combatFeel.update(g.time + COIL_IMPACT_LIFETIME, [body], () => {});
  assert.equal(g.combatFeel.impacts.length, 0);
  g.combatFeel.impact(s, { x: -1, y: 0 }, 2, body);
  g.combatFeel.update(2, [], () => {});
  assert.equal(g.combatFeel.impacts.length, 0);
  clean(g);
});

test('contact effects remain bounded and converted ammunition retains its own presentation', () => {
  const g = tool('carbine'),
    surface = wall(g, 500, 300, 30, 150),
    s = round(g, { nativeTool: 'carbine' });
  for (let i = 0; i < 200; i++) {
    s.id = i;
    s.pos.x = 400 + i * 8;
    g.combatFeel.impact(s, { x: -1, y: 0 }, i / 1000, surface);
  }
  assert.equal(g.combatFeel.impacts.length, MAX_COMBAT_IMPACTS);
  const excluded: Partial<Shot>[] = [
    { fragment: true },
    { allied: true },
    { reflected: true },
    { echo: true },
    { friendly: false },
    { shell: { radius: 60, damage: 20 } },
    { blade: true },
    { rail: true },
    { massDriver: {} as never },
    { enemyAmmo: { kind: 'capacitor' } as never },
    { molten: true },
    { stasis: {} as never },
    { charged: true },
    { counter: 1 },
  ];
  for (const payload of excluded) {
    const f = new CombatFeel();
    f.impact({ ...s, ...payload }, { x: -1, y: 0 }, 0, surface);
    assert.equal(f.impacts.length, 0, JSON.stringify(payload));
  }
  for (const mod of ['shellshock', 'mass-driver', 'cutting-torch']) {
    const converted = tool('carbine', [mod]);
    assert.equal(nativeMechanism(converted), null, mod);
    if (mod !== 'cutting-torch') {
      converted.fire();
      assert.equal(rects(image(converted), '#9ddae0').length, 0);
    }
    clean(converted);
  }
  const rail = tool('carbine');
  rail.lastShot = rail.time;
  rail.shotCount++;
  rail.combatFeel.discharge(rail, true);
  assert.equal(nativeMechanism(rail), null);
  assert.equal(rects(image(rail), '#9ddae0').length, 0);
  rail.time += 1;
  rail.lastShot = rail.time;
  rail.shotCount++;
  rail.chargedFlash = true;
  rail.combatFeel.discharge(rail);
  assert.equal(
    nativeMechanism(rail),
    'carbine',
    'ordinary charged rounds keep their native mechanism',
  );
  clean(rail);
  clean(g);
});
