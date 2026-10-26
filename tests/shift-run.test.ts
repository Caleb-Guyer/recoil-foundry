import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, EXTRACTION_DURATION, type Input } from '../src/game.ts';
import { loadCheckpoint, MODS, availableMods, getGun, type Checkpoint } from '../src/rules.ts';
import { testCheckpoint } from '../src/practice.ts';
import { validShiftRunSave } from '../src/shift-run.ts';
import { isShiftMorph } from '../src/shift-catalog.ts';
import { legalSwaps } from '../src/reforge-rules.ts';
import { fixture, Body, Composite, round } from './branches-fixture.ts';

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1400, y: 500 },
};
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function native(stage = 6) {
  for (let i = 0; i < 24; i++) {
    const cp = testCheckpoint('SHIFT-RUN-OLD-BUILD', stage);
    cp.seed = `RF-C107-SHIFT-RUN-${i}`;
    cp.startingGun = 'pistol';
    assert(loadCheckpoint(cp));
    const g = new Game();
    g.start(cp.seed, cp);
    if (g.shiftRun.junction && g.shiftRun.leaseChoices().length) return g;
    clean(g);
  }
  throw new Error('No ordinary native service junction in bounded seeds');
}
function saved(g: Game): Checkpoint {
  const cp = loadCheckpoint(JSON.parse(JSON.stringify(g.checkpointSnapshot())));
  assert(cp, 'native ShiftRun save must load');
  return cp;
}
function resume(g: Game) {
  const cp = saved(g),
    h = new Game();
  h.start(cp.seed, cp);
  return h;
}
function clearToReward(g: Game) {
  // Exercise native room-completion/reward boundaries; this is not a combat win claim.
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.hitStop = 0;
  g.clear = true;
  g.setMode('playing');
  g.shiftRun.roomCleared();
  g.openReward();
  assert.equal(g.mode, 'upgrade');
}
function devices(kind: 'transport' | 'security' | 'reclamation') {
  const g = fixture([]);
  g.seed = 'RF-C107-SHIFT-DEVICE';
  g.stage = 6;
  g.shiftRun.start();
  const s = g.shiftRun.state!;
  s.powers.push(6);
  s.circuit = { kind, rooms: [] };
  g.shiftRun.resetRoom();
  return g;
}

test('a native service choice changes the real room once and survives Continue without profile unlocks', () => {
  const g = native(),
    s = g.shiftRun;
  assert(s.openOffice());
  assert.equal(g.mode, 'shift-office');
  const route = g.shiftRoutes.choices()[0];
  assert(route && s.chooseRoute(route));
  assert.equal(g.shiftRoutes.kind, route);
  assert.deepEqual(s.state?.routes, [6]);
  assert.equal(s.chooseRoute(route), false);
  assert(g.level.id.startsWith('shift-'));
  const h = resume(g);
  assert.equal(h.shiftRoutes.kind, route);
  assert.deepEqual(h.shiftRun.state?.routes, [6]);
  assert.deepEqual(h.mods, g.mods);
  assert.equal(h.stage, g.stage);
  clean(g);
  clean(h);
});

test('a borrowed morph is temporary, counts two actual Campaign rooms including the boss, and returns once before the ordinary upgrade', () => {
  const g = native(),
    s = g.shiftRun,
    base = [...g.mods];
  assert(s.openOffice());
  const morph = s.leaseChoices()[0];
  assert(morph && s.borrow(morph));
  assert.equal(s.leasedMorph, morph);
  assert(!g.mods.includes(morph));
  assert.deepEqual(g.mods, base);
  saved(g);
  s.closeOffice();
  clearToReward(g);
  assert.deepEqual(s.state?.lease?.cleared, [6]);
  assert.equal(s.leaseDue, false);
  g.chooseMod(g.offers.find((m) => !isShiftMorph(m.id))!.id);
  assert.equal(g.stage, 7);
  assert(g.level.boss);
  clearToReward(g);
  assert.deepEqual(s.state?.lease?.cleared, [6, 7]);
  assert(s.leaseDue);
  const h = resume(g),
    offers = h.offers.map((m) => m.id);
  h.hp = 50;
  assert(h.shiftRun.returnLease());
  assert.equal(h.hp, 62);
  assert.equal(h.shiftRun.returnLease(), false);
  assert.equal(h.shiftRun.leasedMorph, null);
  assert.deepEqual(
    h.offers.map((m) => m.id),
    offers,
  );
  assert.equal(h.stage, 7);
  assert.equal(h.rewardTaken, false);
  h.chooseMod(offers[0]);
  assert.equal(h.stage, 8);
  assert(!h.mods.includes(morph));
  saved(h);
  clean(g);
  clean(h);
});

test('keeping a due lease consumes the ordinary fitting choice and acquiring a morph early clears its temporary lease', () => {
  for (const early of [false, true]) {
    const g = native(),
      s = g.shiftRun;
    assert(s.openOffice());
    const morph = s.leaseChoices()[0];
    assert(s.borrow(morph));
    s.closeOffice();
    clearToReward(g);
    if (!early) {
      g.chooseMod(g.offers.find((m) => !isShiftMorph(m.id))!.id);
      clearToReward(g);
      assert(s.leaseDue);
      const stage = g.stage;
      assert(s.keepLease());
      assert.equal(g.stage, stage + 1);
      assert.equal(s.keepLease(), false);
    } else {
      assert(availableMods(g.mods, true).some((m) => m.id === morph));
      g.offers = [MODS.find((m) => m.id === morph)!];
      g.chooseMod(morph);
      assert.equal(g.stage, 7);
    }
    assert(g.mods.includes(morph));
    assert.equal(s.leasedMorph, null);
    saved(g);
    clean(g);
  }
});

test('a granted Field Experiment progresses only its real event, preserves bonus fitting count on Continue and evolves once', () => {
  const g = native(),
    s = g.shiftRun,
    length = g.mods.length;
  assert(s.openOffice());
  assert(s.beginExperiment('ricochet-harness'));
  assert(g.mods.includes('ricochet-harness'));
  assert.equal(g.mods.length, length + 1);
  assert.deepEqual(s.state?.grants, ['ricochet-harness']);
  saved(g);
  assert.equal(s.beginExperiment('slip-gauge'), false);
  s.closeOffice();
  s.progress('slip');
  assert.equal(s.state?.experiment?.progress, 0);
  s.progress('rebound');
  s.progress('rebound');
  const h = resume(g),
    e = h.shiftRun;
  assert.equal(e.state?.experiment?.progress, 2);
  assert.equal(e.experimentReady, false);
  e.progress('rebound');
  assert(e.experimentReady);
  e.progress('rebound');
  assert.equal(e.state?.experiment?.progress, 3);
  clearToReward(h);
  assert.equal(e.evolve('loaded-spring'), false);
  assert(e.evolve('double-return'));
  assert(e.hasEvolution('double-return'));
  assert.equal(e.evolve('impact-echo'), false);
  assert.deepEqual(h.mods, g.mods);
  saved(h);
  clean(g);
  clean(h);
});

test('an owned prototype starts its experiment without fabricating an extra fitting grant', () => {
  const g = native(),
    index = g.mods.length - 1;
  g.mods[index] = 'spring-rivets';
  g.gun = getGun(g.mods, g.startingGun);
  assert(g.shiftRun.openOffice());
  assert(g.shiftRun.beginExperiment('spring-rivets'));
  assert.deepEqual(g.shiftRun.state?.grants, []);
  assert.equal(g.mods.filter((id) => id === 'spring-rivets').length, 1);
  saved(g);
  clean(g);
});

test('a power circuit affects three eligible ordinary rooms and leaves boss geometry alone', () => {
  const g = native(),
    s = g.shiftRun;
  assert(s.openOffice());
  assert(s.chooseCircuit('transport'));
  assert(s.state?.circuit?.rooms.includes(6));
  assert(
    g.hazards.items.some((h) => h.kind === 'lift' && h.permanent) ||
      g.pressure.items.some((v) => v.overpressure),
  );
  assert.equal(s.chooseCircuit('security'), false);
  for (let i = 0; i < 4; i++) {
    clearToReward(g);
    g.chooseMod(g.offers.find((m) => !isShiftMorph(m.id))!.id);
    if (g.level.boss) assert.equal(s.circuit, null);
    saved(g);
  }
  assert.equal(s.state?.circuit?.rooms.length, 3);
  assert(!s.state?.circuit?.rooms.includes(7));
  assert.equal(s.circuit, null);
  clean(g);
});

test('the reclamation console heals once per room, keeps the spent receipt on Continue and ignores paused input', () => {
  const g = devices('reclamation'),
    s = g.shiftRun;
  assert(s.repairNode);
  g.kills = s.entryKills + 1;
  Body.setPosition(g.player, { ...s.repairNode });
  g.hp = 64;
  g.setMode('paused');
  assert.equal(s.interact(), false);
  assert.equal(g.hp, 64);
  g.setMode('playing');
  assert(s.interact());
  assert.equal(g.hp, 72);
  assert.equal(s.interact(), false);
  assert.deepEqual(s.state?.repairs, [6]);
  const state = s.snapshot()!;
  assert(validShiftRunSave(state, g.mods, 6));
  const h = devices('reclamation');
  h.shiftRun.start({ shiftRun: state });
  h.shiftRun.resetRoom();
  h.kills = h.shiftRun.entryKills + 1;
  Body.setPosition(h.player, { ...h.shiftRun.repairNode! });
  h.hp = 64;
  assert.equal(h.shiftRun.interact(), false);
  assert.equal(h.hp, 64);
  clean(g);
  clean(h);
});

test('the security shutter opens actual firing lanes and refuses to close through a native actor hull', () => {
  const g = devices('security'),
    s = g.shiftRun,
    shutter = s.shutter!;
  assert(shutter);
  Body.setPosition(g.player, { ...shutter.at });
  const a = { x: shutter.body.position.x - 100, y: 660 },
    b = { x: shutter.body.position.x + 100, y: 660 };
  assert(g.lineEnd(a, b).x < b.x);
  assert(s.interact());
  assert(shutter.open && shutter.body.isSensor);
  assert.deepEqual(g.lineEnd(a, b), b);
  const crate = g.props.spawn('crate', shutter.body.position.x, 650);
  assert.equal(s.interact(), false);
  assert(shutter.open);
  g.props.remove(crate);
  assert(s.interact());
  assert.equal(shutter.open, false);
  assert(g.lineEnd(a, b).x < b.x);
  clean(g);
});

test('the security lamp retains a full committed warning, clears its muzzle and dies to actual player shots', () => {
  const g = devices('security'),
    s = g.shiftRun,
    lamp = s.lamp!;
  assert(lamp);
  Body.setPosition(g.player, { x: 1200, y: 722 });
  s.tick(1.1, idle);
  assert.equal(lamp.phase, 'warning');
  const aim = { ...lamp.aim };
  Body.setPosition(g.player, { x: 1750, y: 722 });
  s.tick(0.5, idle);
  assert.deepEqual(lamp.aim, aim);
  assert.equal(g.shots.length, 0);
  g.setMode('paused');
  const timer = lamp.timer;
  s.tick(5, idle);
  assert.equal(lamp.timer, timer);
  g.setMode('playing');
  s.tick(0.5, idle);
  assert.equal(lamp.phase, 'recover');
  assert.equal(g.shots.filter((shot) => !shot.friendly).length, 1);
  g.updateShots(1 / 60);
  assert.equal(
    g.shots.filter((shot) => !shot.friendly).length,
    1,
    'the lamp must not shoot its own hull',
  );
  const shot = round(g, { damage: 100, pos: { ...lamp.at } });
  s.terrainHit(shot, lamp.body);
  assert(lamp.hp <= 0);
  assert(!g.terrain.includes(lamp.body));
  const count = g.shots.length;
  s.tick(10, idle);
  assert.equal(g.shots.length, count);
  clean(g);
});

test('ShiftRun validates canonical experiment outcomes, historical NG records and malformed state safely', () => {
  const g = native();
  assert(g.shiftRun.openOffice());
  assert(g.shiftRun.beginExperiment('slip-gauge'));
  g.shiftRun.closeOffice();
  const state = g.shiftRun.snapshot()!;
  state.experiment!.progress = 3;
  state.experiment!.status = 'complete';
  state.experiment!.evolution = 'counterstep';
  assert(validShiftRunSave(state, g.mods, 6));
  for (const change of [
    { freeRerolls: 5 },
    { routes: [6, 6] },
    { powers: [7] },
    { grants: ['made-up'] },
    { experiment: { ...state.experiment, evolution: 'double-return' } },
    { experiment: { ...state.experiment, progress: 2 } },
    { extra: true },
  ])
    assert.equal(validShiftRunSave({ ...state, ...change }, g.mods, 6), false);
  const ng = testCheckpoint('RF-C107-SHIFT-NG-STATE', 19);
  ng.shiftRun = {
    ...state,
    grants: [],
    experiment: undefined,
    routes: [6],
    powers: [6],
    leases: [],
    paid: [6],
    freeRerolls: 1,
    repairs: [6],
    circuit: { kind: 'transport', rooms: [6, 8, 9] },
  };
  ng.overtime = { baseMods: ng.mods.length, repairs: 0, remix: 5 };
  ng.stage = 0;
  assert(loadCheckpoint(ng), 'completed first-lap history must remain valid in NG stage zero');
  clean(g);
});

test('dead, title and won service handlers cannot grant equipment, circuits, experiments or write a new checkpoint', () => {
  for (const mode of ['dead', 'title', 'won'] as const) {
    const g = native(),
      s = g.shiftRun,
      original = JSON.stringify(s.snapshot()),
      mods = [...g.mods];
    g.setMode(mode);
    let writes = 0;
    g.onCheckpoint = () => writes++;
    assert.equal(s.chooseCircuit('transport'), false);
    assert.equal(s.borrow('piston-lance'), false);
    assert.equal(s.beginExperiment('ricochet-harness'), false);
    assert.equal(s.chooseRoute(g.shiftRoutes.choices()[0]), false);
    assert.equal(JSON.stringify(s.snapshot()), original);
    assert.deepEqual(g.mods, mods);
    assert.equal(writes, 0);
    clean(g);
  }
});

test('active and granted experiment prototypes survive every legal refit and keep a valid native checkpoint', () => {
  for (const id of ['ricochet-harness', 'spring-rivets', 'slip-gauge'] as const) {
    const g = native();
    assert(g.shiftRun.openOffice());
    assert(g.shiftRun.beginExperiment(id));
    g.shiftRun.closeOffice();
    const swaps = legalSwaps(g.mods, g.stage, g.legacyMods, g.unlocks, g.seed);
    assert(swaps.length > 0);
    assert(!swaps.some((swap) => swap.from === id));
    const swap = swaps[0];
    g.applyJobRefit([...g.mods.filter((owned) => owned !== swap.from), swap.to]);
    assert(g.mods.includes(id));
    assert.equal(g.shiftRun.state?.experiment?.id, id);
    assert.deepEqual(g.shiftRun.state?.grants, [id]);
    saved(g);
    clean(g);
  }
});

test('actual New Game+ entry and Continue preserve first-lap rerolls/history and end any unpaid temporary lease', () => {
  const seed = 'RF-C107-SHIFT-RUN-NG-ENTRY',
    cp = testCheckpoint('SHIFT-RUN-OLD-END', 19);
  cp.seed = seed;
  cp.version = 6;
  cp.finaleFirstClear = 0;
  cp.shiftRun = {
    version: 1,
    routes: [6],
    powers: [6],
    leases: [18],
    paid: [6],
    grants: [],
    freeRerolls: 1,
    repairs: [6],
    circuit: { kind: 'transport', rooms: [6, 8, 9] },
    lease: { morph: 'piston-lance', stage: 18, cleared: [18], status: 'active' },
  };
  assert(loadCheckpoint(cp));
  const g = new Game();
  g.start(seed, cp);
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.clear = true;
  g.startEscape();
  assert(g.escape && g.canOvertime);
  g.escape.phase = 'extracting';
  g.escape.destination = 'overtime';
  g.escape.depart = EXTRACTION_DURATION;
  assert(g.startOvertime());
  assert.equal(g.stage, 0);
  assert.equal(g.shiftRun.leasedMorph, null);
  assert(g.shiftRun.freeReroll);
  const h = resume(g);
  assert(h.overtime);
  assert.equal(h.shiftRun.state?.freeRerolls, 1);
  assert.deepEqual(h.shiftRun.state?.routes, [6]);
  assert.deepEqual(h.shiftRun.state?.powers, [6]);
  assert.deepEqual(h.shiftRun.state?.leases, [18]);
  assert.equal(h.shiftRun.leasedMorph, null);
  assert(h.shiftRun.spendReroll());
  assert.equal(h.shiftRun.spendReroll(), false);
  saved(h);
  clean(g);
  clean(h);
});

test('circuit devices fit isolated Docks geometry and native later-district choices never charge an empty room or intersect an actor', () => {
  for (const kind of ['transport', 'security', 'reclamation'] as const) {
    const g = devices(kind);
    assert.equal(g.level.area, 'docks');
    assert(g.shiftRun.state?.circuit?.rooms.includes(6));
    assert(
      g.shiftRun.shutter ||
        g.shiftRun.lamp ||
        g.shiftRun.repairNode ||
        g.hazards.items.some((h) => h.permanent) ||
        g.pressure.items.some((p) => p.overpressure),
    );
    clean(g);
  }
  const areas = new Set<string>();
  for (const stage of [6, 10, 14, 18])
    for (let n = 0; n < 12; n++)
      for (const kind of ['transport', 'security', 'reclamation'] as const) {
        const cp = testCheckpoint('SHIFT-OLD-BUILD', stage);
        cp.seed = `RF-C107-POWER-BATCH-${n}`;
        const g = new Game();
        g.start(cp.seed, cp);
        if (!g.shiftRun.junction) {
          clean(g);
          continue;
        }
        assert(g.shiftRun.openOffice());
        assert(g.shiftRun.chooseCircuit(kind));
        areas.add(g.level.area);
        const actors = [g.player, ...g.enemies.map((e) => e.body), ...g.props.bodies];
        for (const device of [g.shiftRun.shutter, g.shiftRun.lamp])
          if (device)
            assert.equal(
              Matter.Query.collides(device.body, actors).length,
              0,
              `${cp.seed} stage${stage} ${kind} device intersects actor`,
            );
        const installed = !!(
          g.shiftRun.shutter ||
          g.shiftRun.lamp ||
          g.shiftRun.repairNode ||
          g.hazards.items.some((h) => h.permanent) ||
          g.pressure.items.some((p) => p.overpressure)
        );
        if (g.shiftRun.state?.circuit?.rooms.includes(stage))
          assert(installed, 'a circuit room needs an actual installed device');
        saved(g);
        clean(g);
      }
  assert.deepEqual([...areas].sort(), ['cooling', 'furnace', 'reclamation', 'rooftops']);
});
