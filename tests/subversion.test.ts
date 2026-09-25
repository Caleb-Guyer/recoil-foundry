import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Enemy } from '../src/game.ts';
import {
  MODS,
  availableMods,
  rewardMods,
  validBuild,
  loadCheckpoint,
  getGun,
  seeded,
  modPathLabel,
  type Checkpoint,
} from '../src/rules.ts';
import { withParents, maxCombos, branchTestFromUrl } from '../src/branch-builds.ts';
import { SUBVERSION_MODS, SPOOF, isSubversion } from '../src/subversion-rules.ts';
import { annexTestFromUrl } from '../src/annex-layout.ts';
import { workshopBuild, discoverBuild } from '../src/workshop-build.ts';
import {
  fixture,
  target,
  round,
  advance,
  beam,
  wall,
  Body,
  Composite,
} from './branches-fixture.ts';
import { FUSE_TIME } from '../src/ballistics.ts';
import { playRoom } from './room-pilot.ts';

const orders = ['spoof', 'standing-orders', 'priority-target'];
const cross = ['spoof', 'cross-talk', 'dead-switch'];
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function victim(g: Game, kind: Enemy['kind'] = 'shooter', x = 600, y = 300, hp = 1) {
  const e = target(g, x, y, kind);
  e.hp = e.maxHp = hp;
  return e;
}
function kill(g: Game, kind: Enemy['kind'] = 'shooter', x = 600, y = 300) {
  const e = victim(g, kind, x, y);
  round(g, { pos: { x: x - 90, y }, damage: 100 });
  advance(g, 6);
  g.spoof.update();
  assert(e.hp <= 0);
  return g.factions.allies.at(-1)!;
}
function primaryHit(g: Game, e: Enemy, damage: number) {
  const before = e.hp;
  g.hitEnemy(e, damage);
  g.spoof.hit(e, before, true);
}
function feedbackDamage(mods: string[], damage = 100) {
  const g = fixture(mods),
    e = target(g, 600, 300, 'loader');
  e.state = 'recover';
  primaryHit(g, e, damage);
  const after = e.hp;
  g.time += 0.61;
  g.spoof.update();
  const first = after - e.hp;
  g.time += 0.26;
  g.spoof.update();
  return { g, e, first, total: after - e.hp };
}

test('all five upgrades are reachable, branch prerequisites are mandatory, and cards use only Subversion', () => {
  for (const m of SUBVERSION_MODS) {
    assert(MODS.some((n) => n.id === m.id));
    assert.equal(modPathLabel(m.id), 'Subversion');
    const chain = withParents([], [m.id])!;
    assert(validBuild(chain));
    if (m.id !== 'spoof') assert(!availableMods([]).some((n) => n.id === m.id));
    for (let i = 0; i < chain.length - 1; i++) assert(!validBuild(chain.filter((_, j) => i !== j)));
  }
  assert.equal(withParents(orders, ['dead-switch']), null);
  assert.equal(withParents(cross, ['priority-target']), null);
  for (const path of ['deadeye', 'crossfire', 'shellshock', 'coolant-rounds', 'suspension'])
    for (const chain of [orders, cross]) assert(validBuild(withParents([path], chain)!));
});

test('all 510 new upgrade pairs respect prerequisites in either order and leave base gun stats stable', () => {
  let pairs = 0;
  for (let i = 0; i < MODS.length; i++)
    for (let j = i + 1; j < MODS.length; j++) {
      const a = MODS[i].id,
        b = MODS[j].id;
      if (!isSubversion(a) && !isSubversion(b)) continue;
      pairs++;
      const ab = withParents([], [a, b]),
        ba = withParents([], [b, a]);
      assert.equal(!!ab, !!ba, a + '/' + b);
      if (ab && ba) {
        assert(validBuild(ab) && validBuild(ba));
        assert.deepEqual(getGun(ab), getGun(ba));
      }
    }
  assert.equal(pairs, 510);
});

test('reward weighting favors owned Subversion without allowing the opposite fork', () => {
  const mods = ['spoof'],
    eligible = availableMods(mods).filter((m) =>
      rewardMods(mods, 200, seeded('pool'), { stage: 8 }).some((n) => n.id === m.id),
    );
  const family = eligible.filter((m) => isSubversion(m.id)).length;
  let found = 0;
  // Stratified deterministic draws measure actual selection intervals, without flaky sampling.
  for (let i = 0; i < 10000; i++)
    if (isSubversion(rewardMods(mods, 1, () => (i + 0.5) / 10000, { stage: 8 })[0].id)) found++;
  const expected = ((family * 1.5) / (eligible.length + family * 0.5)) * 10000;
  assert(Math.abs(found - expected) < 3);
  for (const chain of [orders, cross]) {
    const offers = rewardMods(chain, 200, seeded('branch'), { stage: 8 });
    assert(!offers.some((m) => isSubversion(m.id)));
  }
});

for (const chain of [orders, cross])
  test(
    chain.at(-1) + ' survives real reward selection, pending save/reload and Workshop discovery',
    () => {
      const g = new Game();
      let save: Checkpoint | null = null;
      g.onCheckpoint = (s) => {
        save = s;
      };
      g.start('subversion-save');
      for (const id of chain) {
        g.openReward();
        g.offers = rewardMods(g.mods, 200, seeded('all'), { stage: g.stage });
        assert(g.offers.some((m) => m.id === id));
        g.chooseMod(id);
        assert(g.mods.includes(id));
      }
      assert(save && loadCheckpoint(save));
      const next = new Game();
      next.start(save.seed, loadCheckpoint(save)!);
      assert.deepEqual(next.mods, chain);
      assert(next.spoof.equipped);
      next.openReward();
      next.onCheckpoint = (s) => {
        save = s;
      };
      next.save();
      const reload = new Game();
      reload.start(save!.seed, loadCheckpoint(save)!);
      assert.deepEqual(
        reload.offers.map((m) => m.id),
        next.offers.map((m) => m.id),
      );
      const known = discoverBuild([], chain);
      assert.deepEqual(new Set(known), new Set(chain));
      assert.deepEqual(workshopBuild([...chain, 'magnum'], [...known, 'magnum']), [
        ...chain,
        'magnum',
      ]);
      assert.deepEqual(workshopBuild([...chain.slice(1), 'magnum'], [...known, 'magnum']), [
        'magnum',
      ]);
      assert(
        !loadCheckpoint({
          ...save!,
          mods: [...chain, chain === orders ? 'cross-talk' : 'standing-orders'],
        }),
      );
    },
  );

test('old maximal-combo URLs retain their exact pre-Subversion upgrades', () => {
  for (const combo of maxCombos()
    .filter((c) => c.choices.includes('standing-orders'))
    .slice(0, 24)) {
    const oldCode = combo.code
      .split('.')
      .filter((p) => !isSubversion(p))
      .join('.');
    const save = branchTestFromUrl(new URL('https://test/?test=branches&combo=' + oldCode));
    assert.deepEqual(
      save?.mods,
      combo.mods.filter((m) => !isSubversion(m)),
    );
  }
});

test('Standing Orders extends one ally and increases its real maximum health', () => {
  const samples = [];
  for (const mods of [['spoof'], orders, cross]) {
    const g = fixture(mods);
    target(g, 1700, 600);
    const ally = kill(g);
    samples.push(ally);
    near(ally.rebootUntil! - g.time - ally.spawn, mods === orders ? 7.5 : mods === cross ? 3.5 : 4);
    g.time = ally.rebootUntil! + 0.001;
    g.factions.beforeStep(0);
    assert.equal(g.factions.allies.length, 0);
    assert.equal(g.kills, 1);
  }
  assert(samples[1].hp > samples[0].hp && samples[0].hp > samples[2].hp);
});

test('Cross Talk permits two allies, enforces cooldown and retains six-conversion room budget after combat cleanup', () => {
  const g = fixture(cross);
  target(g, 1700, 600);
  kill(g);
  const first = g.factions.allies[0];
  kill(g);
  assert.equal(g.spoof.reboots, 1);
  g.time = g.spoof.readyAt + 0.001;
  kill(g, 'runner', 800);
  assert.equal(g.factions.allies.length, 2);
  assert(first.rebootUntil! > g.time);
  near(g.factions.allies[1].rebootDamage!, 0.7);
  g.time = g.spoof.readyAt + 0.001;
  kill(g, 'flyer', 1000);
  assert.equal(g.spoof.reboots, 2, 'pending expiry cannot exceed two active allies');
  for (const a of [...g.factions.allies]) g.factions.removeAlly(a);
  while (g.spoof.reboots < 6) {
    g.time = g.spoof.readyAt + 0.001;
    kill(g);
    g.factions.removeAlly(g.factions.allies[0]);
  }
  g.time = g.spoof.readyAt + 0.001;
  kill(g);
  assert.equal(g.factions.allies.length, 0);
  g.spoof.endCombat();
  assert.equal(g.spoof.reboots, 6);
  g.spoof.clear();
  assert.equal(g.spoof.reboots, 0);
});

test('Priority Target swaps one mark, expires after three seconds and respects line of sight and Turf War ownership', () => {
  const g = fixture(orders),
    close = target(g, 500, 300),
    far = target(g, 900, 300);
  const a = g.factions.spawn('shooter', { x: 300, y: 300 })!;
  a.rebootUntil = 100;
  const turf = g.factions.spawn('shooter', { x: 300, y: 300 })!;
  primaryHit(g, far, 10);
  assert.equal(g.spoof.target(), far);
  assert.deepEqual(g.factions.combatTarget(a), far.body.position);
  assert.deepEqual(g.factions.combatTarget(turf), close.body.position);
  const cover = wall(g, 700, 300, 20, 100);
  assert.deepEqual(g.factions.combatTarget(a), close.body.position);
  Composite.remove(g.engine.world, cover);
  g.terrain = g.terrain.filter((b) => b !== cover);
  primaryHit(g, close, 10);
  assert.equal(g.spoof.target(), close);
  g.time += 3.01;
  g.spoof.update();
  assert.equal(g.spoof.target(), null);
});

test('real allied projectiles apply Cross Talk weakness and Priority Target bonus without buffing Turf War allies', () => {
  for (const [mods, rebooted, expected] of [
    [orders, true, 28],
    [orders, false, 20],
    [cross, true, 14],
  ] as const) {
    const g = fixture([...mods]),
      e = target(g, 600, 300);
    primaryHit(g, e, 1);
    const before = e.hp;
    const a = g.factions.spawn('shooter', { x: 400, y: 300 })!;
    a.spawn = 0;
    if (rebooted) {
      a.rebootUntil = 100;
      a.rebootDamage = g.spoof.stats.damage;
    }
    g.enemyShot(a, 0, 20, 20);
    advance(g, 20);
    near(before - e.hp, expected);
    assert.equal(g.hp, 100);
    assert.equal(g.spoof.reboots, 0);
  }
});

test('rebooted hopper chooses a red enemy landing lane instead of the player', () => {
  const g = fixture(orders),
    e = target(g, 800, 723);
  const a = g.factions.spawn('hopper', { x: 650, y: 723 })!;
  a.rebootUntil = 100;
  Body.setPosition(g.player, { x: 300, y: 723 });
  assert(g.hopperTarget(a).x > 700);
  primaryHit(g, e, 1);
  assert(g.hopperTarget(a).x > 700);
});

test('allied aim, projectiles and contact leave Blackout boxes and couriers to the player', () => {
  for (const objective of ['relay', 'courier']) {
    const g = fixture(orders),
      box = victim(g, 'shooter', 500, 300, 1),
      red = target(g, 700, 300);
    if (objective === 'relay') box.eventRole = 'relay';
    else box.courier = true;
    const blue = g.factions.spawn('shooter', { x: 400, y: 300 })!;
    blue.spawn = 0;
    blue.rebootUntil = 100;
    assert.deepEqual(g.factions.combatTarget(blue), red.body.position);
    g.enemyShot(blue, 0, 20, 20);
    advance(g, 30);
    assert.equal(box.hp, 1);
    assert(red.hp < 100000);
    Body.setPosition(blue.body, box.body.position);
    g.factions.contact(blue);
    assert.equal(box.hp, 1);
    assert.equal(g.spoof.feedback.size, 0);
  }
});

test('resistant machinery receives feedback instead of using unsafe allied AI', () => {
  for (const kind of [
    'charger',
    'loader',
    'press',
    'boss',
    'auditor',
    'interceptor',
  ] as Enemy['kind'][]) {
    const g = fixture(orders),
      e = target(g, 600, 300, kind);
    primaryHit(g, e, 100);
    assert(g.spoof.feedback.has(e.id), kind);
    primaryHit(g, e, 1e9);
    target(g, 1500, 300);
    g.spoof.update();
    assert.equal(g.factions.allies.length, 0, kind);
  }
});

test('each node increases lone-boss feedback, Cross Talk delays its second half, and nothing loops', () => {
  const samples = [['spoof'], orders.slice(0, 2), orders, cross.slice(0, 2), cross].map((mods) =>
    feedbackDamage(mods),
  );
  const [base, standing, priority, crosstalk, dead] = samples;
  assert(standing.total > base.total && priority.total > standing.total);
  assert(crosstalk.total > base.total && dead.total > crosstalk.total);
  near(crosstalk.first * 2, crosstalk.total);
  assert(dead.first < dead.total / 2);
  for (const { g, e } of samples) {
    const hp = e.hp;
    for (let i = 0; i < 20; i++) {
      g.time++;
      g.spoof.update();
    }
    assert.equal(e.hp, hp);
    assert.equal(g.spoof.feedback.size, 0);
    assert.equal(g.spoof.pulses.length, 0);
    assert.equal(g.spoof.reboots, 0);
  }
});

test('Dead Switch expiry hurts exposed reds only, respects cover, and grants no duplicate kill or proc', () => {
  const g = fixture(cross),
    exposed = victim(g, 'shooter', 620, 300, 1),
    covered = target(g, 700, 300);
  target(g, 1700, 600);
  const a = g.factions.spawn('shooter', { x: 600, y: 300 })!;
  a.rebootUntil = 1;
  a.spawn = 0;
  const blue = g.factions.spawn('shooter', { x: 620, y: 300 })!;
  blue.spawn = 0;
  const hp = blue.hp;
  wall(g, 660, 300, 10, 200);
  g.props.spawn('crate', 600, 365);
  const props = g.props.items.map((p) => p.hp);
  g.time = 1.001;
  g.factions.beforeStep(0);
  assert(exposed.hp <= 0);
  assert.equal(covered.hp, 100000);
  assert.equal(blue.hp, hp);
  assert.equal(g.hp, 100);
  assert.deepEqual(
    g.props.items.map((p) => p.hp),
    props,
  );
  assert.equal(g.kills, 0);
  assert.equal(g.spoof.reboots, 0);
  assert.equal(g.spoof.feedback.size, 0);
  assert.equal(g.spoof.effects.length, 1);
});

test('damage death, room cleanup, pause and menu never trigger an expiry overload', () => {
  for (const cleanup of ['damage', 'clear', 'pause', 'title']) {
    const g = fixture(cross),
      e = target(g, 620, 300);
    const a = g.factions.spawn('shooter', { x: 600, y: 300 })!;
    a.rebootUntil = 1;
    a.spawn = 0;
    if (cleanup === 'damage') g.factions.hitAlly(a, 1e9);
    if (cleanup === 'clear') g.spoof.endCombat();
    if (cleanup === 'pause') g.setMode('paused');
    if (cleanup === 'title') g.setMode('title');
    g.time = 2;
    g.spoof.update();
    assert.equal(e.hp, 100000);
    assert.equal(g.spoof.effects.length, 0);
    if (cleanup !== 'pause') assert.equal(g.factions.allies.length, 0);
  }
});

test('feedback queues and effects stay bounded under many resistant targets and huge overkill', () => {
  const g = fixture(cross);
  for (let i = 0; i < 50; i++) {
    // Rotate live targets out briefly to exceed the ordinary spawn cap and
    // exercise the feedback system's own independent bound.
    const previous = g.enemies;
    g.enemies = [];
    const e = target(g, 600 + i, 300, 'loader');
    g.enemies = [...previous, e];
    primaryHit(g, e, 10000);
  }
  assert.equal(g.spoof.feedback.size, 16);
  assert([...g.spoof.feedback.values()].every((f) => f.damage <= 32));
  for (let i = 0; i < 50; i++) {
    g.time += 0.1;
    g.spoof.update();
    assert(g.spoof.pulses.length <= 32);
    assert(g.spoof.effects.length <= 12);
  }
  assert.equal(g.spoof.feedback.size, 0);
  assert.equal(g.spoof.pulses.length, 0);
});

for (const flags of [
  { fragment: true },
  { echo: true },
  { reflected: true },
  { friendly: false, allied: true },
])
  test('secondary shot cannot mark, reboot or feed back: ' + JSON.stringify(flags), () => {
    const g = fixture(orders),
      e = target(g, 600, 300, 'loader');
    round(g, { damage: 100, ...flags });
    advance(g, 20);
    g.spoof.update();
    assert(e.hp < 100000);
    assert.equal(g.spoof.target(), null);
    assert.equal(g.spoof.feedback.size, 0);
  });

test('Fuse retains primary shell credit, while echoed fused shells remain ineligible', () => {
  for (const echo of [false, true]) {
    const g = fixture(['spoof', 'shellshock', 'fuse']);
    target(g, 1700, 600);
    const e = victim(g),
      s = round(g, { pos: { x: 590, y: 300 }, echo, shell: g.demolition.payload(100) });
    g.demolition.impact(s, e.body);
    assert.equal(g.ballistics.shells.length, 1);
    g.time += FUSE_TIME + 0.01;
    g.ballistics.update();
    g.spoof.update();
    assert(e.hp <= 0);
    assert.equal(g.spoof.reboots, echo ? 0 : 1);
  }
});

test('primary Cluster Shell children retain credit; a later child can reboot a target outside the parent blast', () => {
  const g = fixture(['spoof', 'shellshock', 'cluster-shell']);
  target(g, 1700, 600);
  g.demolition.impact(round(g, { pos: { x: 600, y: 500 }, shell: g.demolition.payload(100) }));
  const b = g.demolition.bomblets[0];
  assert(b?.primaryGun);
  // Introduce the target only after the parent: only the real child can hit it.
  const e = victim(g, 'runner', b.pos.x + 10, b.pos.y, 1);
  g.hitStop = 0;
  g.time += 0.31;
  g.demolition.update();
  g.spoof.update();
  assert(e.hp <= 0);
  assert.equal(g.spoof.reboots, 1);
});

const weapons = [
  ['magnum'],
  ['crossfire', 'bloom'],
  ['deadeye', 'rail-spike'],
  ['mass-driver', 'recall'],
  ['vector', 'recall'],
  ['suspension', 'crosshatch'],
  ['suspension', 'tripline'],
  ['fold'],
  ['cutting-torch'],
  ['cutting-torch', 'pulse-chamber'],
  ['cutting-torch', 'charge-lens'],
  ['cutting-torch', 'prism-array'],
  ['shellshock', 'shaped-charge'],
  ['coolant-rounds'],
];
for (const wanted of weapons)
  test('primary weapon still reboots with ' + wanted.join(' + '), () => {
    const mods = withParents(['spoof'], wanted);
    assert(mods, 'legal weapon preset');
    const g = fixture(mods),
      e = victim(g, 'shooter', 450, 300);
    target(g, 1700, 600);
    g.aim = { ...e.body.position };
    if (mods.includes('cutting-torch')) {
      if (mods.includes('prism-array')) {
        Body.setPosition(e.body, { x: 450, y: 325 });
      }
      beam(g, 1.2);
      beam(g, 0.15, false);
    } else {
      if (mods.includes('rail-spike')) g.ballistics.charge(1.5, true);
      g.fire();
      if (mods.includes('suspension')) {
        g.stasis.input(true);
        g.stasis.input(false);
      }
      for (let i = 0; i < 100; i++) {
        advance(g);
        g.stasis.update();
      }
    }
    g.spoof.update();
    assert(e.hp <= 0, 'weapon hits');
    assert.equal(g.spoof.reboots, 1);
  });

for (const torch of [false, true])
  test('primary ' + (torch ? 'beam' : 'bullet') + ' can reboot after a real portal transit', () => {
    const g = fixture(['spoof', 'fold', ...(torch ? ['cutting-torch'] : [])]);
    wall(g, 600, 400, 40, 600);
    assert(g.portals.place({ x: 580, y: 300 }));
    assert(g.portals.place({ x: 1300, y: 740 }));
    const e = victim(g, 'shooter', 1300, 480);
    target(g, 1700, 600);
    g.aim = { x: 900, y: 300 };
    if (torch) beam(g, 0.5);
    else {
      g.fire();
      advance(g, 70);
    }
    g.spoof.update();
    assert(e.hp <= 0);
    assert.equal(g.spoof.reboots, 1);
  });

for (const path of ['priority', 'switch'])
  for (const build of ['gun', 'beam', 'shell'])
    for (const mirror of [false, true])
      test(`ordinary input completes ${path}/${build}/mirror=${mirror} with live AI`, () => {
        const g = new Game();
        g.startTest(
          annexTestFromUrl(
            new URL(
              `https://test/?test=annex&path=${path}&build=${build}&mirror=${mirror ? 1 : 0}`,
            ),
          )!,
        );
        let peak = 0;
        const result = playRoom(g, 100, () => {
          peak = Math.max(peak, g.factions.allies.length);
          return false;
        });
        assert(result.clear && result.hp > 0, JSON.stringify(result));
        assert(peak > 0);
        assert.equal(g.factions.allies.length, 0);
      });

for (const build of ['priority', 'dead-switch'])
  test(build + ' damages a live final boss with ordinary health and inputs', (t) => {
    const g = new Game();
    g.startTest(
      branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&room=boss`))!,
    );
    const boss = g.enemies.find((e) => e.kind === 'interceptor')!,
      hp = boss.hp;
    let pulses = 0;
    const hit = g.hitEnemy.bind(g);
    g.hitEnemy = (...args) => {
      if (args[0] === boss && args[4] === false) pulses++;
      return hit(...args);
    };
    const result = playRoom(g, 45);
    assert(hp - boss.hp > hp * 0.15, JSON.stringify(result));
    assert(pulses > 0);
    t.diagnostic(
      JSON.stringify({ build, bossDamage: hp - boss.hp, bossMaxHp: hp, pulses, ...result }),
    );
  });
