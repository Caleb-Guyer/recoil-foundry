import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import { withParents, completeBuild } from '../src/branch-builds.ts';
import { availableMods, buildPath, isFusion, validBuild } from '../src/rules.ts';
import { BRANCH_GROUPS } from '../src/upgrade-branches.ts';
import { SHIFT_MODS, SHIFT_MORPHS, SHIFT_FUSIONS as FUSION_PARENTS } from '../src/shift-catalog.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';
import { SHIFT } from '../src/shift-upgrades.ts';
import { MORPH } from '../src/shift-morphs.ts';
import { SHIFT_FUSIONS } from '../src/shift-fusions.ts';
import { MASS_DRIVER } from '../src/mass-driver.ts';
import { GRIND } from '../src/grindshot.ts';
import { TORCH } from '../src/torch.ts';
import {
  CLUSTER_LIMIT,
  DEMOLITION_EFFECT_LIMIT,
  DEMOLITION_PENDING_LIMIT,
} from '../src/demolition.ts';
import { RESONATOR, STORM_CELL } from '../src/cross-fusions.ts';

const DT = 1 / 60;
const PATHS = ['deadeye', 'crossfire', 'shellshock', 'coolant-rounds', 'suspension'];
const FORMS = [
  'continuous',
  'pulse-chamber',
  'charge-lens',
  'prism-array',
  'mass-driver',
  'rail-spike',
];
const BASE = SHIFT_MODS.filter(
  (m) => !SHIFT_MORPHS.some((id) => id === m.id) && !Object.hasOwn(FUSION_PARENTS, m.id),
).map((m) => m.id);
const BEAM_BRANCHES = BRANCH_GROUPS.Beam;
interface Combo {
  code: string;
  path: string;
  form: string;
  morph: string;
  fusion: string;
  mods: string[];
}

/** Select before filling: a maximal build must not silently consume the one fusion/morph slot. */
function combinations() {
  const buckets: Combo[][] = [];
  for (const [pathIndex, path] of PATHS.entries())
    for (const [formIndex, form] of FORMS.entries()) {
      const candidates: Combo[] = [];
      for (const [morphIndex, morph] of SHIFT_MORPHS.entries())
        for (const [fusionIndex, fusion] of (form === 'rail-spike'
          ? ['rail-spike']
          : Object.keys(FUSION_PARENTS)
        ).entries())
          for (let variant = 0; variant < 4; variant++) {
            const weapon = ['mass-driver', 'rail-spike'].includes(form)
              ? [form]
              : ['cutting-torch', ...(form === 'continuous' ? [] : [form])];
            let mods = withParents([], [path, ...weapon, fusion, morph, ...BASE]);
            if (!mods) continue;
            const rotation = pathIndex + formIndex + morphIndex + fusionIndex;
            for (const [index, options] of Object.values(BRANCH_GROUPS).entries()) {
              if (form === 'continuous' && options === BEAM_BRANCHES) continue;
              for (let n = 0; n < options.length; n++) {
                const next = withParents(mods, [
                  options[(rotation + index + n + (variant >> index % 3)) % options.length],
                ]);
                if (next) {
                  mods = next;
                  break;
                }
              }
            }
            if (form === 'continuous') {
              // This is the continuous beam's maximal geometry, rather than converting it to a pulse/lance/prism.
              for (;;) {
                const next = availableMods(mods, true).find((m) => !BEAM_BRANCHES.includes(m.id));
                if (!next) break;
                mods.push(next.id);
              }
            } else mods = completeBuild(mods)!;
            if (!mods || !validBuild(mods)) continue;
            candidates.push({
              code: [path, form, morph, fusion, variant].join('/'),
              path,
              form,
              morph,
              fusion,
              mods,
            });
          }
      // Spread each bucket across both morphs and fusions, instead of selecting the first morph repeatedly.
      candidates.sort(
        (a, b) =>
          ((SHIFT_MORPHS.indexOf(a.morph as (typeof SHIFT_MORPHS)[number]) * 7 +
            Object.keys(FUSION_PARENTS).indexOf(a.fusion) * 3) %
            23) -
          ((SHIFT_MORPHS.indexOf(b.morph as (typeof SHIFT_MORPHS)[number]) * 7 +
            Object.keys(FUSION_PARENTS).indexOf(b.fusion) * 3) %
            23),
      );
      buckets.push(candidates);
    }
  const seen = new Set<string>(),
    result: Combo[] = [];
  for (let pass = 0; pass < 12 && result.length < 180; pass++)
    for (const bucket of buckets) {
      if (result.length >= 180) break;
      const next = bucket.find((combo) => !seen.has([...combo.mods].sort().join(',')));
      if (!next) continue;
      seen.add([...next.mods].sort().join(','));
      result.push(next);
    }
  return result;
}
function finite(...values: number[]) {
  return values.every(Number.isFinite);
}
function vector(p: { x: number; y: number }) {
  return finite(p.x, p.y);
}
function bounded(g: Game, code: string) {
  assert(vector(g.player.position) && vector(g.player.velocity), code + ': player');
  assert(g.shots.length <= 180, code + ': shot cap');
  assert(
    g.shots.filter((s) => s.massDriver && s.life > 0).length <= MASS_DRIVER.limit,
    code + ': steel cap',
  );
  assert(g.grind.saws.length <= GRIND.limit, code + ': saw cap');
  assert(
    g.demolition.bomblets.length <= CLUSTER_LIMIT &&
      g.demolition.effects.length <= DEMOLITION_EFFECT_LIMIT &&
      g.demolition.pending.length <= DEMOLITION_PENDING_LIMIT,
    code + ': demolition caps',
  );
  assert(g.tripwires.wires.length <= 2, code + ': trap cap');
  assert(
    g.fusions.resonator.pending.length <= RESONATOR.limit &&
      g.fusions.storm.cells.length <= STORM_CELL.limit,
    code + ': original fusion caps',
  );
  assert(
    g.torch.segments.length + g.torch.rear.length <= TORCH.maxSegments,
    code + ': beam trace cap',
  );
  const s = g.shiftUpgrades,
    m = g.shiftMorphs,
    f = g.shiftFusions;
  assert(
    s.polarity.size <= SHIFT.polarityCap &&
      s.rivets.length <= 4 &&
      s.trail.length <= SHIFT.wirePoints &&
      (s.wire?.points.length ?? 0) <= SHIFT.wirePoints,
    code + ': base effect caps',
  );
  assert(
    finite(s.battery, s.slipCharges) &&
      s.battery >= 0 &&
      s.battery <= SHIFT.batteryCap &&
      s.slipCharges <= 2,
    code + ': reserves',
  );
  assert(
    m.locks.length <= MORPH.locks && m.foams.length <= MORPH.foamLimit && m.flights.size <= 180,
    code + ': morph caps',
  );
  assert(
    f.captured.length <= SHIFT_FUSIONS.caught &&
      f.mills.length <= SHIFT_FUSIONS.mills &&
      f.ghosts.length <= SHIFT_FUSIONS.ghosts &&
      f.comets.size <= SHIFT_FUSIONS.cometBalls &&
      (f.gate?.segments.length ?? 0) <= 2,
    code + ': new fusion caps',
  );
  for (const comet of f.comets.values())
    assert(comet.props.size <= SHIFT_FUSIONS.cometProps, code + ': comet payload');
  for (const shot of g.shots)
    assert(
      vector(shot.pos) &&
        vector(shot.vel) &&
        finite(shot.damage, shot.life, shot.radius) &&
        shot.damage >= 0,
      code + ': finite projectile',
    );
  for (const body of Matter.Composite.allBodies(g.engine.world))
    assert(
      vector(body.position) && vector(body.velocity) && finite(body.angle, body.angularVelocity),
      code + ': finite body',
    );
  for (const point of [
    ...s.trail,
    ...(s.wire?.points ?? []),
    ...g.torch.segments.flatMap((ray) => [ray.a, ray.b]),
    ...f.ghostEffects.flatMap((ray) => [ray.a, ray.b]),
    ...f.mills.flatMap((mill) => [mill.center, mill.pos, ...mill.trail]),
  ])
    assert(vector(point), code + ': finite effect');
  assert(
    f.mills.every((mill) => finite(mill.life, mill.damage, mill.radius) && mill.trail.length <= 8),
    code + ': finite windmills',
  );
}
function snapshot(g: Game) {
  return JSON.stringify({
    time: g.time,
    elapsed: g.elapsed,
    pos: g.player.position,
    velocity: g.player.velocity,
    shots: g.shots.map((s) => [s.id, s.life, s.pos, s.vel]),
    pads: g.shiftUpgrades.rivets.map((p) => p.until),
    wire: g.shiftUpgrades.wire,
    battery: g.shiftUpgrades.battery,
    foams: g.shiftMorphs.foams.map((f) => [f.until, f.body.position]),
    captured: g.shiftFusions.captured.map((c) => c.until),
    mills: g.shiftFusions.mills.map((m) => [m.life, m.pos]),
    ghosts: g.shiftFusions.ghosts.map((v) => v.at),
  });
}

test('current expansion maximal builds remain native, finite and bounded across six tools, paths, all beam forms, morphs and fusions', () => {
  const combos = combinations();
  assert(combos.length >= 100 && combos.length <= 200, `deduplicated matrix size ${combos.length}`);
  const seen = new Set(combos.flatMap((c) => c.mods));
  for (const mod of SHIFT_MODS) assert(seen.has(mod.id), `missing expansion upgrade ${mod.id}`);
  for (const path of PATHS)
    assert(
      combos.some((c) => c.path === path),
      `missing path ${path}`,
    );
  for (const form of FORMS)
    assert(
      combos.some((c) => c.form === form),
      `missing form ${form}`,
    );
  console.log(
    `Current expansion matrix: ${combos.length} distinct maximal builds × ${STARTING_GUN_IDS.length} native tools = ${combos.length * STARTING_GUN_IDS.length} native simulations.`,
  );
  let checked = 0,
    seekers = 0,
    beams = 0;
  for (const gun of STARTING_GUN_IDS)
    for (const combo of combos) {
      const code = gun + '/' + combo.code,
        g = new Game();
      try {
        assert(validBuild(combo.mods), code + ': legal acquisition order');
        assert.equal(combo.mods.filter(isFusion).length, 1, code + ': one fusion');
        assert.equal(
          combo.mods.filter((id) => SHIFT_MORPHS.some((m) => m === id)).length,
          1,
          code + ': one morph',
        );
        assert.equal(buildPath(combo.mods), buildPath([combo.path]), code + ': selected path');
        assert(
          availableMods(combo.mods, true).every(
            (m) => combo.form === 'continuous' && BEAM_BRANCHES.includes(m.id),
          ),
          code + ': maximal within selected beam geometry',
        );
        g.startWorkshop(combo.mods, combo.mods, gun);
        assert.deepEqual(g.mods, combo.mods, code + ': Workshop preserves entire legal build');
        assert.equal(g.startingGun, gun);
        let beamSeen = false,
          painted = false;
        const frames =
          combo.morph === 'seeker-rack' && combo.form === 'charge-lens'
            ? Math.max(180, Math.ceil(g.torch.chargeDuration / DT) + 100)
            : 180;
        for (let frame = 0; frame < frames; frame++) {
          const target = g.enemies.find((e) => e.spawn <= 0 && e.elite !== 'shielded' && e.hp > 0);
          const aim = target ? { ...target.body.position } : { x: 500, y: 723 };
          const seeker = combo.morph === 'seeker-rack';
          const fire = seeker
            ? frame % 70 < 40
            : combo.form === 'charge-lens'
              ? frame % 70 < 55
              : combo.form === 'rail-spike'
                ? g.ballistics.charges > 0 || g.burstRemaining > 0
                : frame % 70 < 55;
          const input: Input = {
            left: !seeker && frame > 145,
            right: !seeker && frame > 70 && frame < 105,
            jump: frame === 112,
            jumpHeld: false,
            fire,
            aim,
          };
          g.tick(DT, input);
          painted ||= g.shiftMorphs.locks.some((lock) => lock.progress === 1);
          beamSeen ||= g.torch.active;
          bounded(g, code + '@' + frame);
        }
        assert(g.shotCount > 0, code + ': native firing actually occurred');
        if (combo.morph === 'seeker-rack') {
          assert(painted, code + ': Seeker genuinely painted an exposed target');
          seekers++;
        }
        if (g.torch.equipped) {
          assert(beamSeen, code + ': actual native beam emitted');
          beams++;
        }
        g.setMode('paused');
        const paused = snapshot(g);
        for (let i = 0; i < 3; i++)
          g.tick(DT, {
            left: true,
            right: false,
            jump: true,
            jumpHeld: true,
            fire: true,
            aim: { x: 500, y: 723 },
          });
        assert.equal(snapshot(g), paused, code + ': paused physics and effects freeze');
        g.setMode('playing');
        const foamBodies = g.shiftMorphs.foams.map((f) => f.body);
        g.setMode('dead');
        assert.equal(g.shiftUpgrades.polarity.size, 0, code);
        assert.equal(g.shiftUpgrades.rivets.length, 0, code);
        assert.equal(g.shiftUpgrades.battery, 0, code);
        assert.equal(g.shiftUpgrades.wire, null, code);
        assert.equal(g.shiftUpgrades.silhouette, null, code);
        assert.equal(g.shiftUpgrades.nozzle, null, code);
        assert.equal(g.shiftMorphs.flights.size, 0, code);
        assert.equal(g.shiftMorphs.foams.length, 0, code);
        assert.equal(g.shiftMorphs.locks.length, 0, code);
        assert(
          foamBodies.every(
            (body) =>
              !g.terrain.includes(body) &&
              !Matter.Composite.allBodies(g.engine.world).includes(body),
          ),
          code + ': expired foam leaves no invisible hull',
        );
        assert.equal(
          g.shiftFusions.captured.length +
            g.shiftFusions.mills.length +
            g.shiftFusions.ghosts.length +
            g.shiftFusions.comets.size +
            g.shiftFusions.ghostEffects.length,
          0,
          code,
        );
        assert.equal(g.shiftFusions.gate, null, code);
        assert.equal(g.shiftFusions.hot, null, code);
        assert.equal(
          g.demolition.bomblets.length +
            g.grind.saws.length +
            g.fusions.resonator.pending.length +
            g.fusions.storm.cells.length,
          0,
          code,
        );
        checked++;
      } finally {
        Matter.Composite.clear(g.engine.world, false);
        Matter.Engine.clear(g.engine);
      }
    }
  assert.equal(checked, combos.length * STARTING_GUN_IDS.length);
  assert(seekers > 0 && beams > 0);
  console.log(
    `${checked} simulations passed; ${seekers} native Seeker paint/release builds and ${beams} beam builds emitted real output.`,
  );
});
