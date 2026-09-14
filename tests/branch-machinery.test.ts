import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import { fixture, round, Body, Composite, wall } from './branches-fixture.ts';
import { massDriverTestFromUrl, countershotTestFromUrl } from '../src/practice.ts';
import { getGun } from '../src/rules.ts';
import { CROSSING } from '../src/crossing-layout.ts';
import { MASS_DRIVER } from '../src/mass-driver.ts';
import { CLUSTER_LIMIT } from '../src/demolition.ts';
import { withParents } from '../src/branch-builds.ts';
import { STORM_CELL } from '../src/cross-fusions.ts';
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: true,
  fire: false,
  aim: { x: 1100, y: 300 },
};

test('rolling balls ride a rising deck, respect adjacent cover and leave steep supports', () => {
  const g = fixture(['mass-driver', 'skid-plate']);
  const lift = g.hazards.spawn({ kind: 'lift', x: 500, y: 500, w: 800, h: 20, travel: 300 });
  lift.phase = 2;
  Body.setPosition(lift.body, { x: 500, y: 510 });
  const s = round(g, { pos: { x: 400, y: 491 }, vel: { x: 18, y: 0 } });
  s.massDriver!.rolling = { bodyId: lift.body.id };
  const before = { ...s.pos };
  g.tick(1 / 60, idle);
  assert(s.massDriver!.rolling);
  assert(s.pos.y < before.y);
  assert(s.pos.x > before.x);
  wall(g, s.pos.x + 22, s.pos.y, 8, 120);
  const limit = s.pos.x + 18;
  g.tick(1 / 60, idle);
  assert(s.pos.x < limit);
  Body.setAngle(lift.body, 1);
  g.tick(1 / 60, idle);
  assert(!s.massDriver!.rolling);
});

test('rolling balls, charged saws and Storm cells cannot wedge the train at either boundary', () => {
  for (const fusion of [[], ['flywheel'], ['storm-cell']])
    for (const mirror of [0, 1]) {
      const g = new Game();
      g.startTest(
        massDriverTestFromUrl(
          new URL(`https://test/?test=mass-driver&room=train&mirror=${mirror}`),
        )!,
      );
      g.mods = withParents(
        [],
        ['mass-driver', 'skid-plate', 'shellshock', 'cluster-shell', 'aftershock', ...fusion],
      )!;
      g.gun = getGun(g.mods);
      for (const e of g.enemies) Composite.remove(g.engine.world, e.body);
      g.enemies = [];
      g.waves.clear();
      g.spawnEnemy('shooter', 1000, 100);
      g.updateEnemy = () => {};
      Body.setPosition(g.player, { x: 1000, y: 250 });
      g.crossing.beginStep(1.01);
      g.crossing.beginStep(CROSSING.tell + 0.01);
      const d = g.crossing.direction,
        edge = d > 0 ? 1930 : 70;
      g.props.spawn('crate', d > 0 ? 1974 : 26, 715);
      g.props.spawn('canister', d > 0 ? 1960 : 40, 700);
      for (const [i, c] of g.crossing.cars.entries())
        Body.setPosition(c.body, {
          x: edge - d * (CROSSING.width / 2 + i * (CROSSING.width + CROSSING.gap)),
          y: c.body.position.y,
        });
      for (let i = 0; i < 300 && g.crossing.cars.length; i++) {
        for (let j = 0; j < 4; j++)
          round(g, { pos: { x: d > 0 ? 1980 : 20, y: 700 - j * 4 }, vel: { x: -d * 18, y: 0 } });
        if (i % 6 === 0)
          g.demolition.detonate({
            pos: { x: edge, y: 700 },
            damage: 100,
            radius: 96,
            launch: 6,
            kind: 'shell',
          });
        g.hitStop = 0;
        g.tick(1 / 60, idle);
        assert.equal(g.mode, 'playing');
        assert(g.demolition.bomblets.length <= CLUSTER_LIMIT);
        assert(g.fusions.storm.cells.length <= STORM_CELL.limit);
      }
      assert.equal(g.crossing.cars.length, 0);
      assert(g.shots.filter((s) => s.massDriver).length <= MASS_DRIVER.limit);
    }
});

test('Breach with rapid Burst and Countershot still leaves stationary players vulnerable to the final boss', () => {
  for (const build of ['barrage', 'torch']) {
    const g = new Game();
    g.startTest(countershotTestFromUrl(new URL(`https://test/?test=countershot&build=${build}`))!);
    for (const id of ['backblast', 'backfire', 'breach', 'rapid', 'burst'])
      if (!g.mods.includes(id)) g.mods.push(id);
    g.gun = getGun(g.mods);
    const boss = g.enemies[0];
    Body.setPosition(g.player, { x: 740, y: 722 });
    let hurt = 0;
    const original = g.damagePlayer.bind(g);
    g.damagePlayer = (amount, source) => {
      const hp = g.hp;
      original(amount, source);
      hurt += hp - g.hp;
    };
    for (let i = 0; i < 3600 && g.mode === 'playing' && boss.hp > 0; i++) {
      const dx = 740 - g.player.position.x - g.player.velocity.x * 5;
      g.tick(1 / 60, {
        ...idle,
        left: dx < -8,
        right: dx > 8,
        fire: true,
        aim: { ...boss.body.position },
      });
    }
    assert(hurt >= 70, `${build}: ${hurt} damage received`);
  }
});
