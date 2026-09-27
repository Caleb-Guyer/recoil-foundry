import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { overtimeReclamationTestFromUrl, overtimeCoolingTestFromUrl } from '../src/practice.ts';
import { getOvertimeLevel } from '../src/overtime.ts';
import { getLevel, type Solid } from '../src/levels.ts';
import { getGun, loadCheckpoint } from '../src/rules.ts';
import { ENEMY_STATS } from '../src/enemies.ts';
import { CARGO_SIZE } from '../src/cargo-layout.ts';
import { CABLE_HP } from '../src/cargo.ts';
import { SCRAP_SPEED, SCRAP_TELL } from '../src/scrap-circuit.ts';
import { splitWaves, REINFORCEMENT_TELL } from '../src/reinforcements.ts';
const { Body, Bodies, Composite, Engine } = Matter;
const rooms = ['sorting', 'transfer', 'service', 'highline', 'sorter', 'reclaimer'];
const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1400, y: 400 },
};
const fixture = (room = 'sorting', mirror = false) =>
  overtimeReclamationTestFromUrl(
    new URL(`https://test/?test=overtime-reclamation&room=${room}&mirror=${Number(mirror)}`),
  )!;
function game(room = 'sorting', mirror = false) {
  const g = new Game();
  g.startTest(fixture(room, mirror));
  return g;
}
function quiet(g: Game) {
  for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
  g.enemies = [];
  g.waves.clear();
  g.waves.held = true;
  g.waves.phase = 'opening';
}
function rig() {
  const g = game();
  quiet(g);
  for (const p of [...g.props.items]) g.props.remove(p);
  for (const b of g.terrain.slice(4)) Composite.remove(g.engine.world, b);
  g.terrain = g.terrain.slice(0, 4);
  const p = g.cargo.spawn({ x: 700, y: 440, anchorY: 280, transport: { toX: 900, delay: 2 } });
  return { g, p, r: p.cargo! };
}
const overlap = (a: Solid, b: Solid) =>
  a.x + a.w > b.x + 0.5 && a.x < b.x + b.w - 0.5 && a.y + a.h > b.y + 0.5 && a.y < b.y + b.h - 0.5;
function shot(g: Game, x: number, y: number, friendly = true, damage = 24) {
  g.addShot({
    pos: { x, y },
    vel: { x: 500, y: 0 },
    damage,
    life: 1,
    friendly,
    radius: 2.5,
    bounces: 0,
    pierce: 0,
    fragment: false,
    split: false,
  });
  g.updateShots(1 / 60);
}

test('revision 4 changes only Reclamation and preserves all older room generations', () => {
  const seen = new Set();
  for (let n = 0; n < 24; n++)
    for (let stage = 0; stage < 20; stage++) {
      const seed = 'OT-SCRAP-' + n,
        ordinary = getLevel(seed, stage),
        before = getOvertimeLevel(seed, stage, 3),
        after = getOvertimeLevel(seed, stage, 4);
      assert.deepEqual(after, getOvertimeLevel(seed, stage, 4));
      assert.deepEqual(ordinary, getLevel(seed, stage));
      assert.deepEqual(before, getOvertimeLevel(seed, stage, 3));
      if (stage < 12 || stage >= 16) assert.deepEqual(after, before);
      else {
        assert(after.overtimeReclamation);
        assert.notDeepEqual(after.solids, before.solids);
        seen.add(after.name + after.mirrored);
      }
    }
  assert.equal(seen.size, 10);
  const changed = getOvertimeLevel('OT-SCRAP-0', 12, 4);
  changed.setpiece!.cargo![0].transport!.toX = 5;
  assert.notEqual(getOvertimeLevel('OT-SCRAP-0', 12, 4).setpiece!.cargo![0].transport!.toX, 5);
});

test('all six layouts and mirrors reserve clear transport paths and safe enemy entrances', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const g = game(room, mirror),
        l = g.level;
      assert.equal(l.mirrored, mirror);
      assert(l.overtimeReclamation);
      assert.equal(g.breaches.placement, null);
      for (const items of [
        g.pressure.items,
        g.crosswind.items,
        g.magnets.items,
        g.hazards.items,
        g.conveyors.items,
        g.counterweights.items,
      ])
        assert.equal(items.length, 0);
      assert(g.cargo.items.length >= 2 && g.cargo.items.length <= 3);
      for (const p of l.setpiece!.cargo!) {
        const sweep = {
          x: Math.min(p.x, p.transport!.toX) - CARGO_SIZE.w / 2 - 2,
          y: p.y - CARGO_SIZE.h / 2 - 2,
          w: Math.abs(p.x - p.transport!.toX) + CARGO_SIZE.w + 4,
          h: CARGO_SIZE.h + 4,
        };
        assert(!l.solids.some((s) => overlap(s, sweep)), room + ' blocked rail');
        assert(sweep.x > 280 && sweep.x + sweep.w < 1740, 'exit clearance');
        assert(p.anchorY >= 110 && p.y + 28 < 620);
        for (const s of l.spawns) {
          const { w, h } = ENEMY_STATS[s.kind];
          assert(
            !overlap(
              { x: p.x - 48, y: p.y - 28, w: 96, h: 56 },
              { x: s.x - w / 2, y: s.y - h / 2, w, h },
            ),
            room + ' initial load/spawn',
          );
        }
      }
      for (const s of l.spawns) {
        const { w, h } = ENEMY_STATS[s.kind];
        assert(
          !l.solids.some((b) => overlap(b, { x: s.x - w / 2, y: s.y - h / 2, w, h })),
          room + ' ' + s.kind,
        );
        assert(s.x >= 310 && s.x <= 1690);
      }
      if (room === 'sorter' || room === 'reclaimer')
        assert.equal(l.spawns[0].kind, room === 'sorter' ? 'sorter' : 'boss');
    }
});

test('revision 4 saves round-trip; older runs retain their machinery and test entries never write progress', () => {
  for (const room of rooms)
    for (const mirror of [false, true]) {
      const cp = fixture(room, mirror),
        parsed = loadCheckpoint(cp)!;
      assert(parsed);
      const g = game(room, mirror),
        resumed = new Game();
      resumed.start(parsed.seed, parsed);
      assert.deepEqual(resumed.level, g.level);
      for (const revision of [undefined, 1, 2, 3] as const) {
        const old = loadCheckpoint({ ...cp, overtime: { ...cp.overtime, remix: revision } })!;
        assert(old);
        resumed.start(old.seed, old);
        assert(!resumed.level.overtimeReclamation);
      }
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onBossDefeated = () => writes++;
      g.save();
      g.die();
      g.startTest(cp);
      assert.equal(writes, 0);
      assert.equal(g.hp, 100);
      assert.deepEqual(g.level, getOvertimeLevel(cp.seed, cp.stage, 4, cp.route));
      assert(
        g.cargo.items.every(
          (p) => p.cargo!.state === 'hanging' && p.cargo!.rail!.startsAt > g.time,
        ),
      );
    }
  for (const remix of [0, 6, -1, '4', null, true])
    assert.equal(
      loadCheckpoint({ ...fixture(), overtime: { ...fixture().overtime, remix } }),
      null,
    );
  for (const suffix of [
    '&seed=x',
    '&room=bad',
    '&room=sorting&room=sorting',
    '&test=overtime-reclamation',
    '&mirror=2',
    '&mirror=0&mirror=1',
    '&daily=2026-09-26',
    '&build=beam',
    '&v=1&v=2',
  ])
    assert.equal(
      overtimeReclamationTestFromUrl(new URL('https://test/?test=overtime-reclamation' + suffix)),
      null,
    );
});

test('latches move with their loads; real bullets cut them, cables pass shots and solid cover protects them', () => {
  const { g, p, r } = rig();
  g.time = 2;
  g.cargo.update(0.5);
  assert.equal(p.body.position.x, 700 + SCRAP_SPEED * 0.5);
  assert.equal(r.origin.x, p.body.position.x);
  assert.equal(r.anchor.x, p.body.position.x);
  const x = p.body.position.x,
    joint = r.origin.y - 28 - 48;
  shot(g, x - 120, 300);
  assert.equal(r.cableHp, CABLE_HP, 'only the yellow latch is a target');
  const wall = Bodies.rectangle(x - 65, joint, 10, 35, { isStatic: true });
  g.terrain.push(wall);
  Composite.add(g.engine.world, wall);
  shot(g, x - 120, joint);
  assert.equal(r.cableHp, CABLE_HP);
  g.terrain = g.terrain.filter((b) => b !== wall);
  Composite.remove(g.engine.world, wall);
  shot(g, x - 120, joint);
  assert.equal(r.cableHp, 24);
  shot(g, x - 120, joint, false);
  assert.equal(r.state, 'warning');
  assert.equal(r.releaseAt - g.time, SCRAP_TELL);
  const deadline = r.releaseAt;
  shot(g, x - 120, joint);
  assert.equal(r.releaseAt, deadline);
  g.time = deadline - 0.001;
  g.cargo.update(0.1);
  assert(p.body.isStatic);
  assert.equal(p.body.position.x, x);
  g.time = deadline;
  g.cargo.update(0.01);
  assert(!p.body.isStatic);
  assert.equal(r.state, 'loose');
});

test('transport automatically warns once at its endpoint and retains the full tell after a delayed step', () => {
  const { g, p, r } = rig();
  g.cargo.update(1);
  assert.equal(p.body.position.x, 700);
  g.time = 2;
  g.cargo.update(10);
  assert.equal(p.body.position.x, 900);
  assert.equal(r.state, 'warning');
  assert.equal(r.releaseAt, 2 + SCRAP_TELL);
  g.cargo.update(10);
  assert(p.body.isStatic);
  assert.equal(r.releaseAt, 2 + SCRAP_TELL);
  g.time = r.releaseAt;
  g.cargo.update(1 / 60);
  assert.equal(r.state, 'loose');
  const count = g.cargo.items.length;
  g.time += 200;
  g.cargo.update(200);
  assert.equal(g.cargo.items.length, count);
  assert.equal(r.state, 'loose');
});

test('Ray and continuous Torch cut the same real latch without shooting the hanging body', () => {
  for (const mod of ['ray', 'cutting-torch']) {
    const { g, p, r } = rig();
    g.mods = [mod];
    g.gun = getGun(g.mods);
    const joint = r.origin.y - 28 - 48;
    Body.setPosition(g.player, { x: 400, y: joint + 3 });
    g.aim = { x: 1000, y: joint + 3 };
    for (let n = 0; n < 180 && r.state === 'hanging'; n++) {
      g.time += 1 / 60;
      if (mod === 'cutting-torch') {
        g.ballistics.charge(1 / 60, true);
        g.torch.beforeStep(1 / 60, true);
        g.torch.afterStep(1 / 60);
      } else {
        g.fire();
        g.updateShots(1 / 60);
      }
    }
    assert.equal(r.state, 'warning', mod);
    assert.equal(p.hp, p.maxHp);
  }
});

test('players, enemies, rotated crates, fixed terrain and other loads stop a trolley without being pushed through', () => {
  for (const kind of ['player', 'enemy', 'crate', 'terrain', 'load']) {
    const { g, p, r } = rig();
    let b: Matter.Body;
    if (kind === 'player') b = g.player;
    else if (kind === 'enemy') b = g.spawnEnemy('boss', 780, 440).body;
    else if (kind === 'crate') {
      b = g.props.spawn('crate', 780, 440).body;
      Body.setAngle(b, 0.4);
    } else if (kind === 'load') b = g.cargo.spawn({ x: 810, y: 440, anchorY: 280 }).body;
    else {
      b = Bodies.rectangle(780, 440, 20, 100, { isStatic: true });
      g.terrain.push(b);
      Composite.add(g.engine.world, b);
    }
    if (kind === 'player') Body.setPosition(b, { x: 770, y: 440 });
    const before = { ...b.position };
    g.time = 2;
    g.cargo.update(1);
    assert.equal(r.state, 'warning', kind);
    assert.equal(p.body.position.x, 700);
    assert.deepEqual(b.position, before, kind);
    assert.equal(r.releaseAt - g.time, SCRAP_TELL);
    assert(p.body.isStatic);
  }
});

test('pause and hitstop freeze transport and warnings; clearance safely powers down remaining loads', () => {
  const { g, p, r } = rig();
  g.time = 2;
  g.setMode('paused');
  const initial = JSON.stringify(r);
  for (let i = 0; i < 60; i++) g.tick(1 / 60, idle);
  assert.equal(JSON.stringify(r), initial);
  assert.equal(p.body.position.x, 700);
  g.setMode('playing');
  g.hitStop = 0.2;
  g.tick(1 / 60, idle);
  assert.equal(p.body.position.x, 700);
  g.hitStop = 0;
  g.cargo.cut(p, CABLE_HP);
  const deadline = r.releaseAt;
  g.setMode('paused');
  for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
  assert.equal(r.releaseAt, deadline);
  assert(p.body.isStatic);
  g.setMode('playing');
  g.clear = true;
  g.time = deadline + 1;
  g.cargo.update(1);
  assert(p.body.isStatic);
  assert(r.disabled);
  assert.equal(r.state, 'hanging');
  g.cargo.cut(p, 100);
  assert.equal(r.state, 'hanging');
  assert.equal(g.cargo.trace({ x: 600, y: 364 }, { x: 800, y: 364 }, 0), null);
});

test('released scrap physically falls, damages a target once per impact window and remains breakable cover', () => {
  const { g, p, r } = rig();
  g.cargo.cut(p, CABLE_HP);
  g.time = r.releaseAt;
  g.cargo.update(1 / 60);
  for (let n = 0; n < 95; n++) {
    g.time += 1 / 60;
    g.props.beforeStep();
    Engine.update(g.engine, 1000 / 60);
    g.props.afterStep(1 / 60);
  }
  assert(p.body.position.y > 708 && p.body.position.y < 714);
  assert(g.props.items.includes(p));
  const target = g.spawnEnemy('shooter', 850, 700);
  target.spawn = 0;
  const hp = target.hp;
  p.velocity = { x: 0, y: 12 };
  assert(g.cargo.impact(p, target.body, 12));
  assert(target.hp < hp);
  const after = target.hp;
  g.cargo.impact(p, target.body, 12);
  assert.equal(target.hp, after);
  g.props.hit(p, p.hp, { x: 1, y: 0 });
  assert(!g.props.items.includes(p));
  assert(!g.cargo.items.includes(p));
  g.time += 100;
  g.cargo.update(1);
  assert.equal(g.cargo.items.length, 0);
});

test('finite squads arrive after their tells; actual exits carry both routes from Cooling into Rooftops', () => {
  for (const room of rooms.slice(0, 4)) {
    const g = game(room),
      [opening, final] = splitWaves(g.level, g.roomSeed, 12);
    assert(!opening.some((s) => s.squad));
    assert.equal(final.filter((s) => s.squad).length, 2);
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e6);
    g.waves.update(0.01);
    assert.equal(g.waves.phase, 'warning');
    assert(g.waves.doors.every((d) => d.timer === REINFORCEMENT_TELL));
    g.waves.update(REINFORCEMENT_TELL + 0.01);
    assert.equal(g.enemies.filter((e) => e.squad).length, 2);
  }
  for (const route of ['low', 'high'] as const) {
    const cp = overtimeCoolingTestFromUrl(
      new URL('https://test/?test=overtime-cooling&room=condenser'),
    )!;
    cp.overtime!.remix = 4;
    const g = new Game();
    g.startTest(cp);
    g.testRun = null;
    let saved: unknown;
    g.onCheckpoint = (s) => {
      saved = s;
    };
    for (let stage = 11; stage <= 15; stage++) {
      for (let f = 0; f < 360 && !g.clear; f++) {
        for (const e of [...g.enemies]) {
          e.spawn = 0;
          g.hitEnemy(e, 1e6);
        }
        g.tick(1 / 60, idle);
      }
      assert(g.clear, 'finite waves ' + stage);
      g.openReward(false, stage === 13 ? route : undefined);
      assert.equal(g.mode, 'upgrade');
      g.chooseMod(g.offers[0].id);
      assert.equal(g.stage, stage + 1);
      assert(loadCheckpoint(saved));
      assert.equal(g.overtime!.remix, 4);
      if (stage < 15) assert(g.level.overtimeReclamation);
      if (stage === 13)
        assert.equal(g.level.id, route === 'high' ? 'ot-scrap-highline' : 'ot-scrap-service');
      if (stage === 15) {
        assert.deepEqual(g.level, getOvertimeLevel(g.seed, 16, 3));
        assert(g.cargo.items.every((p) => !p.cargo!.rail));
      }
    }
  }
});

test('every mirrored room remains traversable both ways using base jumps after all scrap lands or breaks', () => {
  for (const room of rooms)
    for (const mirror of [false, true])
      for (const reverse of [false, true])
        for (const broken of [false, true]) {
          const g = game(room, mirror);
          quiet(g);
          g.mods = [];
          g.gun = getGun([]);
          for (const p of [...g.cargo.items]) {
            if (broken) g.props.break(p);
            else {
              g.time = p.cargo!.rail!.startsAt;
              g.cargo.update(10);
              g.cargo.cut(p, CABLE_HP);
            }
          }
          g.time += SCRAP_TELL + 1;
          g.cargo.update(1 / 60);
          for (let i = 0; i < 100; i++) g.tick(1 / 60, idle);
          if (reverse) Body.setPosition(g.player, { x: 1840, y: 720 });
          for (
            let n = 0;
            n < 2400 && (reverse ? g.player.position.x > 180 : g.player.position.x < 1820);
            n++
          ) {
            const p = g.player.position;
            const obstacle = g.solidBodies.some(
              (b) =>
                b.bounds.min.x < p.x + (reverse ? -10 : 95) &&
                b.bounds.max.x > p.x + (reverse ? -95 : 10) &&
                b.bounds.min.y < p.y + 20 &&
                b.bounds.max.y > p.y - 30,
            );
            g.tick(1 / 60, {
              ...idle,
              left: reverse,
              right: !reverse,
              jump: obstacle && g.grounded,
            });
            assert(Number.isFinite(g.player.position.x));
          }
          assert(
            reverse ? g.player.position.x <= 180 : g.player.position.x >= 1820,
            `${room}:${mirror}:${reverse}:${broken} ${JSON.stringify(g.player.position)}`,
          );
        }
});
