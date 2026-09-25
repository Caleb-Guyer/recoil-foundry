import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { seeded, loadCheckpoint, type Checkpoint } from '../src/rules.ts';
import { SIGNAL, signalPoint } from '../src/switchboard.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { dailyForDate } from '../src/daily.ts';
import { practiceCheckpoint } from '../src/practice.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1000, y: 400 },
};
function fixture(build = 'gun', mirror = false) {
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  Math.random = seeded('dead-signal-audit-particles');
  const save = switchboardTestFromUrl(
    new URL(`https://test/?test=switchboard&build=${build}&mirror=${+mirror}`),
  )!;
  const g = new Game();
  g.startTest(save);
  const e = g.enemies[0];
  e.spawn = 0;
  return { g, e, r: e.switchboard! };
}
function covered(mirror = false, build = 'gun') {
  const f = fixture(build, mirror);
  Matter.Body.setPosition(f.g.player, { x: 1000, y: 502 });
  Matter.Body.setPosition(f.e.body, { x: mirror ? 800 : 1200, y: 620 });
  f.g.switchboard.begin(f.e);
  return f;
}
function advanceRig(f: ReturnType<typeof fixture>, frames: number) {
  for (let i = 0; i < frames; i++) {
    f.g.time += 1 / 60;
    f.g.switchboard.update(f.e, 1 / 60);
  }
}

for (const mirror of [false, true]) {
  test(`covered emitter uses a braced, warned, interruptible controller; mirror=${mirror}`, () => {
    const f = covered(mirror),
      { g, e, r } = f,
      p = r.plans[0];
    assert(p.mobile && !p.locked && r.plans.length === 1);
    assert.deepEqual(p.origin, e.body.position);
    advanceRig(f, 37);
    assert(p.locked && p.escape && !p.cut);
    const locked = structuredClone({ origin: p.origin, angles: p.angles });
    Matter.Body.setPosition(g.player, { x: 100, y: 100 });
    advanceRig(f, 45);
    assert.equal(r.fired, 0, 'retains the full 1.4 second tell');
    assert.deepEqual({ origin: p.origin, angles: p.angles }, locked);
    assert.deepEqual(e.body.velocity, { x: 0, y: 0 });
    assert(g.switchboard.interrupt(p.slot));
    assert.equal(r.opening, SIGNAL.opening);
    advanceRig(f, 60);
    assert.equal(r.fired, 0);
  });

  test(`ordinary falling escapes the controller volley below cover; mirror=${mirror}`, () => {
    const f = covered(mirror),
      { g, e, r } = f;
    advanceRig(f, 37);
    assert(r.plans[0].locked && !r.plans[0].cut);
    // Release recoil after lock. No flight support, invulnerability, teleport,
    // altered gravity or suppressed collision is used during this escape.
    for (let i = 0; i < 110; i++) g.tick(1 / 60, idle);
    assert.equal(g.hp, 100);
    assert(r.fired >= 5);
    assert(g.player.position.y > 690);
    assert(e.hp > 0);
  });

  test(`covered phase two still schedules at most two attacks and one interruption; mirror=${mirror}`, () => {
    const f = covered(mirror),
      { g, e, r } = f;
    e.phase = 1;
    g.switchboard.begin(e);
    assert.equal(r.plans.length, 2);
    assert(r.plans.some((p) => p.mobile));
    const [first, second] = r.plans;
    assert(g.switchboard.interrupt(first.slot));
    assert(!g.switchboard.interrupt(second.slot));
    assert(!second.cut);
    advanceRig(f, 130);
    assert(r.fired > 0 && r.fired <= 5);
    assert.equal(r.interruptions, 1);
  });
}

for (const build of ['gun', 'counter'])
  for (const mirror of [false, true])
    for (const [x, y] of [
      [420, 692],
      [695, 592],
      [1000, 502],
      [1305, 592],
      [1560, 692],
    ])
      test(`${build}, mirror=${mirror}: shelf pocket ${x},${y} is not damage-free`, () => {
        const { g, e } = fixture(build, mirror);
        Matter.Body.setPosition(g.player, { x, y });
        Matter.Body.setStatic(g.player, true);
        for (let i = 0; i < 60 * 90 && g.mode === 'playing'; i++)
          g.tick(1 / 60, { ...idle, fire: true, aim: { ...e.body.position } });
        assert(g.hp <= 50, JSON.stringify({ mode: g.mode, hp: g.hp, boss: e.hp }));
      });

test('older Daily and checkpoint schedulers retain remote origins; new practice uses the fix', () => {
  for (const revision of [3, 4] as const) {
    const f = covered(),
      { g, e, r } = f;
    g.annexVersion = revision;
    g.switchboard.begin(e);
    assert(!r.plans[0].mobile);
    assert.deepEqual(r.plans[0].origin, signalPoint(g, r.plans[0].slot, 'port'));
    let save: Checkpoint | undefined;
    g.testRun = undefined;
    g.onCheckpoint = (s) => {
      save = s;
    };
    g.save();
    assert(save && loadCheckpoint(save));
    const resumed = new Game();
    resumed.start(save.seed, save);
    assert.equal(resumed.annexVersion, revision);
  }
  assert.equal(
    practiceCheckpoint({ kind: 'switchboard', seed: 'earned-victory' })!.annexVersion,
    5,
  );
  for (const ruleset of [83, 84]) {
    const g = new Game();
    g.start(dailyForDate('2026-09-25', ruleset)!.seed);
    assert.equal(g.annexVersion, ruleset - 79);
    g.openReward();
    assert.equal(g.offers.length, 1);
  }
});

test('the controller exceeds the portal hull budget while the player can use the same exits', () => {
  for (const floor of [false, true]) {
    const { g, e } = fixture('portal');
    assert(g.portals.place(floor ? { x: 270, y: 740 } : { x: 0, y: 400 }));
    assert(g.portals.place(floor ? { x: 1730, y: 740 } : { x: 2000, y: 400 }));
    const from = floor ? { x: 270, y: 650 } : { x: 80, y: 400 };
    const to = floor ? { x: 270, y: 735 } : { x: 5, y: 400 };
    assert.equal(g.portals.traceBody(from, to, e.body), null);
    assert(g.portals.traceBody(from, to, g.player));
  }
});

test('perfect junction spam cannot suppress every volley or bypass shared lockout', () => {
  const { g, e, r } = fixture('counter');
  Matter.Body.setPosition(g.player, { x: 470, y: 608 });
  Matter.Body.setStatic(g.player, true);
  for (let i = 0; i < 60 * 60 && g.mode === 'playing'; i++) {
    const plan = r.plans.find((p) => !p.cut && !p.done);
    const aim = plan ? signalPoint(g, plan.slot, 'junction') : signalPoint(g, 0, 'junction');
    g.tick(1 / 60, { ...idle, fire: true, aim });
  }
  assert(r.interruptions > 0, 'probe must actually hit a charging junction');
  assert(r.interruptions <= Math.ceil(g.time / SIGNAL.cooldown));
  assert(r.fired > 0 && g.hp < 100);
});

test('even injected temporary bodyguards expire instead of becoming permanent boss cover', () => {
  const { g, e, r } = fixture('subversion');
  assert.equal(g.factions.allies.length, 0, 'normal boss arrives without carryover allies');
  for (const x of [155, 215]) {
    const ally = g.factions.spawn('shooter', { x, y: 715 })!;
    ally.spawn = 0;
    ally.rebootUntil = g.time + g.spoof.stats.duration;
  }
  for (let i = 0; i < 60 * 12 && g.mode === 'playing'; i++) g.tick(1 / 60, idle);
  assert.equal(g.factions.allies.length, 0);
  assert.equal(g.spoof.reboots, 0);
  assert(e.hp > 0 && r.fired > 0);
});
