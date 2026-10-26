import test from 'node:test';
import assert from 'node:assert/strict';
import { MODS } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { SHIFT_MODS } from '../src/shift-catalog.ts';
import { withParents } from '../src/branch-builds.ts';
import { modMark } from '../src/upgrade-icons.ts';
import { inspectUpgrade } from '../src/upgrade-inspection.ts';
import { createUpgradeDemo, destroyUpgradeDemo, upgradeDemoInput } from '../src/upgrade-demo.ts';
const seed = 'RF-C107-UPGRADE-PREVIEW';
test('all twenty new upgrades have distinct deliberately drawn native icons', () => {
  const paths = SHIFT_MODS.map((m) => modMark(MODS.find((item) => item.id === m.id)!));
  assert.equal(paths.length, 20);
  assert.equal(new Set(paths).size, 20);
  assert(
    paths.every(
      (p) =>
        !p.includes('undefined') &&
        !p.includes('NaN') &&
        !p.includes('�') &&
        p.includes('<path d="M'),
    ),
  );
});
for (const id of ['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'])
  for (const conversion of [[], ['shellshock'], ['mass-driver'], ['cutting-torch']])
    test(`${id} inspection retains its actual ${conversion[0] ?? 'round'} pattern and owned continuity`, () => {
      const mods = ['scatter', 'crossfire', ...conversion],
        info = inspectUpgrade(
          mods,
          MODS.find((m) => m.id === id)!,
          'shotgun',
          100,
          undefined,
          seed,
        );
      const fire = info.changes.find((c) => c.label === 'Fire')!;
      assert(fire.after.includes(MODS.find((m) => m.id === id)!.name));
      assert(
        fire.after.includes(
          conversion[0] === 'shellshock'
            ? 'Shells'
            : conversion[0] === 'mass-driver'
              ? 'Steel balls'
              : conversion[0] === 'cutting-torch'
                ? 'Beam'
                : 'Rounds',
        ),
      );
      assert(info.connections.some((c) => c.startsWith('Keeps ')));
      if (id === 'seeker-rack') assert(info.changes.some((c) => c.label === 'Trigger'));
      if (id === 'piston-lance' || id === 'cable-saw')
        assert(info.changes.some((c) => c.label === 'Reach'));
    });
for (const mod of SHIFT_MODS)
  for (const gun of STARTING_GUN_IDS)
    test(`${mod.name}/${gun} preview earns a visible real mechanic without changing its owned build`, (t) => {
      const mods = withParents([], [mod.id])!;
      assert(mods);
      const g = createUpgradeDemo(mods, gun, seed, mod.id),
        before = [...g.mods];
      let writes = 0;
      g.onCheckpoint = () => writes++;
      g.onCommendation = () => writes++;
      const progress = new Set<string>();
      const original = g.shiftRun.progress.bind(g.shiftRun);
      g.shiftRun.progress = (kind) => {
        progress.add(kind);
        original(kind);
      };
      let active = false,
        shots = 0;
      for (let step = 0; step < 420 && g.mode === 'playing'; step++) {
        g.tick(1 / 60, upgradeDemoInput(g, step));
        const s = g.shiftUpgrades,
          f = g.shiftFusions,
          m = g.shiftMorphs;
        shots = Math.max(shots, g.shotCount);
        const observed: Record<string, boolean> = {
          'polarity-rounds': s.polarity.size >= 2,
          'ricochet-harness': progress.has('rebound'),
          'spring-rivets': s.rivets.length > 0,
          'slip-gauge': s.slipReady || progress.has('slip'),
          'wake-wire': !!s.wire,
          'false-silhouette': !!s.silhouette,
          'gimbal-mount': g.player.velocity.x > 9,
          'momentum-exchange': s.flash > 0,
          'offset-nozzle': !!s.nozzle,
          'momentum-battery': s.battery > 0,
          'piston-lance': [...m.flights.values()].some((v) => v.phase === 'return'),
          'cable-saw': [...m.flights.values()].some((v) => v.kind === 'cable-saw'),
          'seeker-rack': m.locks.some((v) => v.progress === 1),
          foamcaster: m.foams.length > 0,
          'catch-chamber': f.captured.length > 0,
          'gate-snare': !!f.gate,
          'hot-wire': !!f.hot,
          'ghost-shift': f.ghosts.length > 0,
          windmill: f.mills.length > 0,
          'scrap-comet': [...f.comets.values()].some((c) => c.props.size > 0),
        };
        active ||= observed[mod.id];
      }
      t.diagnostic(JSON.stringify({ id: mod.id, gun, active, shots, hp: g.hp, seconds: g.time }));
      assert.equal(writes, 0);
      assert.deepEqual(g.mods, before);
      assert(active, `${mod.name} never reached its production mechanic`);
      destroyUpgradeDemo(g);
      assert.equal(g.engine.world.bodies.length, 0);
    });

test('all rendered new-upgrade names and inspection strings are free of replacement or mojibake glyphs', () => {
  for (const mod of SHIFT_MODS)
    for (const gun of [
      'pistol',
      'shotgun',
      'nailgun',
      'twinbore',
      'carbine',
      'repeater',
    ] as const) {
      const owned = withParents([], [mod.id])!.filter((id) => id !== mod.id),
        inspection = inspectUpgrade(
          owned,
          MODS.find((m) => m.id === mod.id)!,
          gun,
          100,
          undefined,
          seed,
        );
      const text = JSON.stringify(inspection);
      assert(!/[\uFFFD]|Ã|Â|â€/.test(text), `${mod.id}/${gun} contains broken rendered copy`);
    }
});
