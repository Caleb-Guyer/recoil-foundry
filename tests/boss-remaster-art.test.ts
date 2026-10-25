import test from 'node:test';
import assert from 'node:assert/strict';
import { drawBossRemaster, drawBossRemasterWarnings } from '../src/boss-remaster-art.ts';
import type { BossRemasterVisual } from '../src/boss-remaster-cues.ts';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { Renderer } from '../src/render.ts';
import { drawCrane } from '../src/crane-art.ts';
import { drawKiln } from '../src/kiln-art.ts';

type Operation = { op: string; args: number[]; width?: number; cap?: string };
function canvas() {
  const operations: Operation[] = [];
  const text: unknown[][] = [];
  const styles: Record<string, unknown> = { globalAlpha: 1, lineWidth: 1, lineCap: 'round' };
  const stack: Record<string, unknown>[] = [];
  let depth = 0;
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save')
        return () => {
          stack.push({ ...styles });
          depth++;
        };
      if (key === 'restore')
        return () => {
          assert(stack.length, 'canvas state must be balanced');
          Object.assign(styles, stack.pop());
          depth--;
        };
      if (key === 'fillText' || key === 'strokeText')
        return (...args: unknown[]) => text.push(args);
      if (key === 'setLineDash') return () => {};
      if (
        [
          'moveTo',
          'lineTo',
          'arc',
          'fillRect',
          'strokeRect',
          'translate',
          'rotate',
          'scale',
        ].includes(String(key))
      )
        return (...args: number[]) => {
          assert(
            args.every(Number.isFinite),
            String(key) + ' must not pass non-finite canvas geometry',
          );
          operations.push({
            op: String(key),
            args,
            width: Number(styles.lineWidth),
            cap: String(styles.lineCap),
          });
        };
      if (key in styles) return styles[String(key)];
      return () => {};
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
    text,
    styles,
    get depth() {
      return depth;
    },
  };
}
const visual = (kind: BossRemasterVisual['kind']): BossRemasterVisual => ({
  kind,
  center: { x: 1400, y: 380 },
  phase: 1,
  stage: 'combat',
  progress: 0.5,
  warnings: [
    {
      kind: 'lane',
      x: 900,
      width: 84,
      top: 50,
      bottom: 740,
      progress: 0.7,
      active: false,
      locked: true,
    },
    { kind: 'lane', x: 1350, width: 430, top: 684, bottom: 740, progress: 1, active: true },
    {
      kind: 'segment',
      from: { x: 64, y: 690 },
      to: { x: 1936, y: 690 },
      width: 100,
      progress: 0.4,
      active: false,
    },
    {
      kind: 'fan',
      from: { x: 1400, y: 380 },
      ends: [
        { x: 1960, y: 600 },
        { x: 260, y: 490 },
      ],
      width: 22,
      progress: 0.9,
      active: false,
      locked: true,
    },
  ],
});

test('warning footprints exactly retain supplied lanes, clipped rays and sweep extents in both effects modes', () => {
  for (const kind of ['condenser', 'sorter'] as const) {
    const state = visual(kind),
      before = structuredClone(state),
      ordinary = canvas(),
      reduced = canvas();
    drawBossRemasterWarnings(ordinary.c, state, false);
    drawBossRemasterWarnings(reduced.c, state, true);
    assert.deepEqual(
      reduced.operations,
      ordinary.operations,
      'Reduced effects must preserve every danger edge and safe gap',
    );
    assert.deepEqual(state, before, 'Drawing must not move or retarget an attack');
    const fills = ordinary.operations.filter((op) => op.op === 'fillRect').map((op) => op.args);
    assert.deepEqual(fills, [
      [858, 50, 84, 690],
      [1135, 684, 430, 56],
    ]);
    assert(
      ordinary.operations.some(
        (op) => op.op === 'lineTo' && op.args[0] === 1936 && op.args[1] === 690,
      ),
    );
    assert(
      ordinary.operations.some(
        (op) => op.op === 'moveTo' && op.args[0] === 64 && op.args[1] === 690,
      ),
    );
    assert(
      ordinary.operations.some((op) => op.op === 'moveTo' && op.width === 100 && op.cap === 'butt'),
    );
    assert(ordinary.operations.some((op) => op.op === 'moveTo' && op.width === 22));
    assert.equal(ordinary.depth, 0);
    assert.equal(ordinary.styles.lineCap, 'round', 'Renderer state belongs to the caller');
    assert.equal(ordinary.text.length, 0);
  }
});

test('startup, phase breaks and destruction are deterministic bounded native art without text or input mutation', () => {
  for (const kind of ['condenser', 'sorter'] as const)
    for (const stage of ['startup', 'transition', 'combat', 'destroyed'] as const)
      for (const progress of [0, 0.25, 0.6, 1])
        for (const effects of [false, true]) {
          const state = { ...visual(kind), stage, progress },
            before = structuredClone(state);
          const out = canvas(),
            second = canvas();
          drawBossRemaster(out.c, state, effects);
          drawBossRemaster(second.c, state, effects);
          assert.deepEqual(out.operations, second.operations);
          assert.deepEqual(state, before);
          assert.equal(out.text.length, 0);
          assert.equal(out.depth, 0);
          assert(out.operations.length < 160, 'A phase beat cannot create unbounded debris');
        }
});

test('expired or malformed presentation cannot leave ghost attacks or invalid canvas geometry', () => {
  const expired = canvas();
  drawBossRemasterWarnings(expired.c, { ...visual('sorter'), stage: 'destroyed' }, false);
  assert.equal(expired.operations.length, 0);
  const invalid = canvas();
  drawBossRemaster(invalid.c, { ...visual('condenser'), center: { x: NaN, y: 10 } }, false);
  assert.equal(invalid.operations.length, 0);
  drawBossRemasterWarnings(
    invalid.c,
    {
      ...visual('condenser'),
      warnings: [
        { kind: 'lane', x: NaN, width: 84, top: 50, bottom: 740, progress: 0.2, active: false },
        { kind: 'lane', x: 200, width: 84, top: 740, bottom: 50, progress: 0.2, active: true },
        {
          kind: 'segment',
          from: { x: 40, y: 80 },
          to: { x: Infinity, y: 100 },
          width: 10,
          progress: 1,
          active: true,
        },
      ],
    },
    true,
  );
  assert.equal(invalid.operations.length, 0);
  assert.equal(invalid.depth, 0);
});

test('First Shift machines have distinct deterministic native silhouettes, damage phases and wrecks', () => {
  const firstShift = ['loader', 'crane', 'press', 'kiln'] as const;
  const silhouettes = new Set<string>();
  const wrecks = new Set<string>();
  for (const kind of firstShift) {
    const phases = new Set<string>();
    for (const phase of [0, 1, 2])
      for (const stage of ['startup', 'transition', 'combat', 'destroyed'] as const)
        for (const progress of [0, 0.25, 0.6, 1])
          for (const reduced of [false, true]) {
            const state = { ...visual(kind), phase, stage, progress };
            const before = structuredClone(state);
            const out = canvas(),
              second = canvas();
            drawBossRemaster(out.c, state, reduced);
            drawBossRemaster(second.c, state, reduced);
            assert.deepEqual(out.operations, second.operations);
            assert.deepEqual(state, before);
            assert.equal(out.depth, 0);
            assert.equal(out.text.length, 0);
            assert(
              out.operations.length > 4,
              `${kind} ${stage} should have a visible mechanical beat`,
            );
            assert(out.operations.length < 160, 'Machine presentation stays bounded');
            if (stage === 'combat' && progress === 1 && !reduced)
              phases.add(JSON.stringify(out.operations));
          }
    assert.equal(phases.size, 3, `${kind} visibly changes after both damage breaks`);
    for (const [stage, collection] of [
      ['combat', silhouettes],
      ['destroyed', wrecks],
    ] as const) {
      const out = canvas();
      drawBossRemaster(out.c, { ...visual(kind), stage, progress: 0.4 }, false);
      collection.add(JSON.stringify(out.operations));
    }
  }
  assert.equal(silhouettes.size, 4);
  assert.equal(wrecks.size, 4);
});

test('Loader and Crane rectangular sweeps retain exact endpoint hulls and diagonal safe corners in both effects modes', () => {
  const scenes = [
    {
      kind: 'loader' as const,
      from: { x: 180, y: 700 },
      to: { x: 1000, y: 700 },
      halfWidth: 56,
      halfHeight: 34,
      points: [
        [124, 666],
        [1056, 666],
        [1056, 734],
        [124, 734],
      ],
    },
    {
      kind: 'crane' as const,
      from: { x: 500, y: 200 },
      to: { x: 1100, y: 200 },
      halfWidth: 25,
      halfHeight: 23,
      points: [
        [475, 177],
        [1125, 177],
        [1125, 223],
        [475, 223],
      ],
    },
    {
      kind: 'crane' as const,
      from: { x: 1000, y: 250 },
      to: { x: 1000, y: 690 },
      halfWidth: 25,
      halfHeight: 23,
      points: [
        [975, 227],
        [1025, 227],
        [1025, 713],
        [975, 713],
      ],
    },
    {
      kind: 'crane' as const,
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
      halfWidth: 25,
      halfHeight: 23,
      points: [
        [-25, -23],
        [25, -23],
        [125, 77],
        [125, 123],
        [75, 123],
        [-25, 23],
      ],
    },
  ];
  for (const scene of scenes)
    for (const active of [false, true]) {
      const state: BossRemasterVisual = {
        ...visual(scene.kind),
        warnings: [
          {
            kind: 'hull',
            from: scene.from,
            to: scene.to,
            halfWidth: scene.halfWidth,
            halfHeight: scene.halfHeight,
            progress: 0.8,
            locked: true,
            active,
          },
        ],
      };
      const before = structuredClone(state),
        ordinary = canvas(),
        reduced = canvas();
      drawBossRemasterWarnings(ordinary.c, state, false);
      drawBossRemasterWarnings(reduced.c, state, true);
      assert.deepEqual(reduced.operations, ordinary.operations);
      assert.deepEqual(state, before);
      assert.deepEqual(
        ordinary.operations
          .filter((op) => op.op === 'moveTo' || op.op === 'lineTo')
          .map((op) => op.args),
        scene.points,
      );
      assert.equal(ordinary.depth, 0);
      assert.equal(ordinary.text.length, 0);
    }
});

test('new boss warnings preserve every lane, ray, width and safe gap with Reduced Effects', () => {
  for (const kind of ['loader', 'crane', 'press', 'kiln'] as const) {
    const ordinary = canvas(),
      reduced = canvas(),
      state = visual(kind);
    drawBossRemasterWarnings(ordinary.c, state, false);
    drawBossRemasterWarnings(reduced.c, state, true);
    assert.deepEqual(ordinary.operations, reduced.operations);
    assert.deepEqual(
      ordinary.operations.filter((op) => op.op === 'fillRect').map((op) => op.args),
      [
        [858, 50, 84, 690],
        [1135, 684, 430, 56],
      ],
    );
  }
});

test('malformed rectangular warnings do not produce phantom collision footprints', () => {
  for (const invalid of [
    { from: { x: NaN, y: 100 }, to: { x: 300, y: 100 }, halfWidth: 25, halfHeight: 23 },
    { from: { x: 100, y: 100 }, to: { x: Infinity, y: 100 }, halfWidth: 25, halfHeight: 23 },
    { from: { x: 100, y: 100 }, to: { x: 300, y: 100 }, halfWidth: 0, halfHeight: 23 },
    { from: { x: 100, y: 100 }, to: { x: 300, y: 100 }, halfWidth: 25, halfHeight: -23 },
  ]) {
    const out = canvas();
    drawBossRemasterWarnings(
      out.c,
      { ...visual('crane'), warnings: [{ ...invalid, kind: 'hull', progress: 1, active: true }] },
      false,
    );
    assert.equal(out.operations.length, 0);
    assert.equal(out.depth, 0);
  }
});

test('owned early-boss renders suppress only legacy predictions and preserve native physical silhouettes', () => {
  const g = new Game();
  g.startWorkshop([]);
  const renderer = Object.create(Renderer.prototype) as Renderer;
  renderer.game = g;
  renderer.reduced = false;
  for (const kind of ['loader', 'press'] as const) {
    const e = g.spawnEnemy(kind, 900, 400);
    e.spawn = 0;
    e.state = 'windup';
    e.timer = 0.15;
    e.aim = { x: -1, y: 0 };
    e.target = { x: 650, y: 740 };
    const original = canvas(),
      owned = canvas();
    g.bossRemaster.owns = () => false;
    renderer.ctx = original.c;
    renderer.drawTell(e);
    assert(original.operations.length > 0);
    g.bossRemaster.owns = (candidate) => candidate === e;
    renderer.ctx = owned.c;
    renderer.drawTell(e);
    assert.equal(owned.operations.length, 0);
  }
  const crane = g.spawnEnemy('crane', 900, 400);
  crane.spawn = 0;
  crane.state = 'windup';
  crane.attack = 'sweep';
  crane.timer = 0.15;
  crane.crane!.from = { x: 900, y: 300 };
  crane.crane!.to = { x: 1300, y: 690 };
  const headBefore = { ...crane.crane!.head };
  const bodyBefore = { ...crane.crane!.body.position };
  const oldCrane = canvas(),
    ownedCrane = canvas();
  g.bossRemaster.owns = () => false;
  drawCrane(oldCrane.c, g, crane, false);
  g.bossRemaster.owns = (candidate) => candidate === crane;
  drawCrane(ownedCrane.c, g, crane, false);
  const oldStart = (op: Operation) =>
    op.op === 'moveTo' && op.args[0] === 875 && op.args[1] === 277;
  assert(oldCrane.operations.some(oldStart), 'legacy crane hull tell is present before ownership');
  assert(!ownedCrane.operations.some(oldStart), 'new exact hull warning owns the attack boundary');
  assert(
    ownedCrane.operations.some(
      (op) => op.op === 'translate' && op.args[0] === headBefore.x && op.args[1] === headBefore.y,
    ),
  );
  assert.deepEqual(crane.crane!.head, headBefore);
  assert.deepEqual(crane.crane!.body.position, bodyBefore);
  assert.equal(ownedCrane.depth, 0);

  const kiln = g.spawnEnemy('kiln', 900, 400);
  kiln.spawn = 0;
  kiln.state = 'windup';
  kiln.attack = 'aimed';
  kiln.timer = 0.15;
  kiln.kiln!.plans = [
    {
      from: { x: 900, y: 338 },
      to: { x: 500, y: 700 },
      height: 150,
      duration: 0.8,
      impact: { x: 500, y: 733 },
      normal: { x: 0, y: -1 },
      fraction: 1,
    },
  ];
  kiln.kiln!.patches = [{ x: 500, y: 740, w: 112, warn: 0, life: 1.5, support: g.terrain[0] }];
  const oldKiln = canvas(),
    ownedKiln = canvas();
  g.bossRemaster.owns = () => false;
  drawKiln(oldKiln.c, g, kiln, false);
  g.bossRemaster.owns = (candidate) => candidate === kiln;
  drawKiln(ownedKiln.c, g, kiln, false);
  const arcStart = (op: Operation) =>
    op.op === 'moveTo' && op.args[0] === 900 && op.args[1] === 338;
  assert(oldKiln.operations.some(arcStart));
  assert(!ownedKiln.operations.some(arcStart));
  assert(
    ownedKiln.operations.some(
      (op) =>
        op.op === 'fillRect' && JSON.stringify(op.args) === JSON.stringify([-55, 26, 110, 16]),
    ),
    'the native boiler tread silhouette remains',
  );
  assert(
    ownedKiln.operations.some(
      (op) =>
        op.op === 'fillRect' && JSON.stringify(op.args) === JSON.stringify([444, 732, 112, 8]),
    ),
    'actual native heat patches remain visible if present',
  );
  assert.equal(ownedKiln.depth, 0);
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
});
