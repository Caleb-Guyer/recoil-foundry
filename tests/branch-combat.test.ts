import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from '../src/game.ts';
import { BRANCH_TEST_BUILDS, branchTestFromUrl } from '../src/branch-builds.ts';
import { distance } from '../src/rules.ts';
import { dodgePilot } from './combat-pilot.ts';

// Ordinary input only: navigate around shelves, use recoil to climb, and
// deliberately release charged weapons. Health, AI and physics stay intact.
function play(g: Game, seconds: number) {
  let stuck = 0,
    lastX = g.player.position.x,
    advanceUntil = 0,
    climbX: number | undefined;
  for (let frame = 0; frame < seconds * 60 && !g.clear && g.mode === 'playing'; frame++) {
    const target = g.enemies
      .filter((e) => e.spawn <= 0)
      .sort(
        (a, b) =>
          distance(a.body.position, g.player.position) -
          distance(b.body.position, g.player.position),
      )[0];
    let input: Partial<Input> = target ? dodgePilot(g, target) : {};
    stuck = Math.abs(g.player.position.x - lastX) < 0.2 ? stuck + 1 : 0;
    lastX = g.player.position.x;
    if (
      target &&
      (stuck > 90 || g.time < advanceUntil || (g.time > 2 && Math.floor(g.time) % 4 < 2)) &&
      distance(g.lineEnd(g.player.position, target.body.position), target.body.position) > 1
    ) {
      if (stuck > 90) {
        advanceUntil = g.time + 0.65;
        stuck = 0;
      }
      const dx = target.body.position.x - g.player.position.x;
      const dir =
        Math.abs(dx) < 80 ? (g.player.position.x < g.worldWidth / 2 ? 1 : -1) : Math.sign(dx);
      input = { left: dir < 0, right: dir > 0, jump: g.grounded, fire: false };
      if (target.body.position.y < g.player.position.y - 200)
        input = {
          ...input,
          fire: true,
          aim: { x: g.player.position.x, y: g.player.position.y + 300 },
        };
    }
    if (target && target.body.position.y < g.player.position.y - 180) {
      const ceiling = g.terrain
        .filter(
          (b) =>
            b.bounds.max.y < g.player.position.y &&
            b.bounds.min.y > target.body.position.y &&
            g.player.position.x > b.bounds.min.x - 22 &&
            g.player.position.x < b.bounds.max.x + 22,
        )
        .sort((a, b) => b.bounds.max.y - a.bounds.max.y)[0];
      if (ceiling && climbX === undefined)
        climbX =
          g.player.position.x - ceiling.bounds.min.x < ceiling.bounds.max.x - g.player.position.x
            ? ceiling.bounds.min.x - 50
            : ceiling.bounds.max.x + 50;
      if (climbX !== undefined) {
        const dx = climbX - g.player.position.x;
        input = {
          left: dx < -10,
          right: dx > 10,
          jump: g.grounded,
          fire: !ceiling,
          aim: { x: g.player.position.x, y: g.player.position.y + 300 },
        };
      }
    } else climbX = undefined;
    if (g.mods.includes('charge-lens')) input.fire = !!input.fire && frame % 72 < 48;
    if (g.mods.includes('suspension') && !g.mods.includes('tripline'))
      input.fire = !!input.fire && frame % 48 < 32;
    // Traps and returning rounds have finite reach. Stop thrusting downward
    // from the ceiling and move into range instead of firing forever outside it.
    const reach = g.mods.includes('tripline')
      ? 480
      : g.mods.includes('recall')
        ? g.gun.projectileSpeed * 60 * (g.mods.includes('vector') ? 0.5 : 0.24) * 0.9
        : Infinity;
    if (target && target.body.position.y - g.player.position.y > reach) input.fire = false;
    if (
      target &&
      distance(g.lineEnd(g.player.position, target.body.position), target.body.position) < 1 &&
      Math.abs(target.body.position.x - g.player.position.x) > reach
    ) {
      input.left = target.body.position.x < g.player.position.x;
      input.right = target.body.position.x > g.player.position.x;
    }
    if (g.mods.includes('prism-array') && input.aim) {
      const dx = input.aim.x - g.player.position.x,
        dy = input.aim.y - g.player.position.y;
      input.aim = {
        x: g.player.position.x + dx * Math.cos(0.09) - dy * Math.sin(0.09),
        y: g.player.position.y + dx * Math.sin(0.09) + dy * Math.cos(0.09),
      };
    }
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: target?.body.position ?? g.aim,
      ...input,
    });
    assert([g.hp, g.player.position.x, g.player.position.y].every(Number.isFinite));
  }
  return {
    clear: g.clear,
    hp: g.hp,
    kills: g.kills,
    time: g.time,
    shots: g.shotCount,
    player: { ...g.player.position },
    enemies: g.enemies.map((e) => ({ kind: e.kind, hp: e.hp, pos: { ...e.body.position } })),
  };
}

test('every branch preset fights real rooms in both orientations with ordinary health and input', (t) => {
  const results = [];
  for (const build of Object.keys(BRANCH_TEST_BUILDS))
    for (const mirror of [0, 1]) {
      const g = new Game();
      g.startTest(
        branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&mirror=${mirror}`))!,
      );
      assert.equal(g.hp, 100);
      const result = { build, mirror, ...play(g, 65) };
      results.push(result);
      assert(result.clear, JSON.stringify(result));
    }
  t.diagnostic(JSON.stringify(results));
});

test('each beam specialization damages the live final boss without an invincibility fixture', (t) => {
  for (const build of ['pulse', 'charge', 'prism']) {
    const g = new Game();
    g.startTest(
      branchTestFromUrl(new URL(`https://test/?test=branches&build=${build}&room=boss`))!,
    );
    const boss = g.enemies.find((e) => e.kind === 'interceptor')!;
    assert(boss);
    const hp = boss.hp;
    const result = play(g, 45);
    assert(hp - boss.hp > hp * 0.15, JSON.stringify({ build, hp, remaining: boss.hp, result }));
    t.diagnostic(JSON.stringify({ build, bossDamage: hp - boss.hp, bossMaxHp: hp, ...result }));
  }
});
