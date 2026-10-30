import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game, type Input } from '../src/game.ts';
import type { Prop } from '../src/props.ts';
import { PROP_STATS } from '../src/props.ts';
import { drawMaterialProp } from '../src/material-prop-art.ts';
import { drawMaterialBreaks } from '../src/material-break-art.ts';
import {
  materialPropSnapshot,
  materialPose,
  MATERIAL_BREAK_LIFE,
} from '../src/material-response.ts';
import {
  materialTestFromUrl,
  materialTestRoom,
  prepareMaterialTest,
} from '../src/material-test.ts';
import { Renderer } from '../src/render.ts';
interface Op {
  name: string;
  args: unknown[];
}
function canvas() {
  const ops: Op[] = [],
    stack: Record<string, unknown>[] = [],
    values: Record<string, unknown> = { globalAlpha: 0.85, lineWidth: 1 };
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key in values) return values[String(key)];
      if (key === 'createLinearGradient' || key === 'createRadialGradient')
        return () => ({ addColorStop() {} });
      if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (key === 'getLineDash') return () => [];
      if (key === 'measureText') return () => ({ width: 50 });
      return (...args: unknown[]) => {
        if (key === 'save') stack.push({ ...values });
        if (key === 'restore') {
          assert(stack.length, 'every restore must have a save');
          Object.keys(values).forEach((k) => delete values[k]);
          Object.assign(values, stack.pop());
        }
        for (const arg of args)
          if (typeof arg === 'number') assert(Number.isFinite(arg), String(key));
        if (key === 'arc' || key === 'ellipse') assert(Number(args[2]) >= 0);
        if (key === 'fillRect' || key === 'strokeRect')
          assert(Number(args[2]) >= 0 && Number(args[3]) >= 0);
        ops.push({ name: String(key), args });
      };
    },
    set(_target, key, value) {
      if (key === 'globalAlpha') assert(Number.isFinite(value) && value >= 0 && value <= 1);
      if (key === 'lineWidth') assert(Number.isFinite(value) && value > 0);
      values[String(key)] = value;
      ops.push({ name: 'style:' + String(key), args: [value] });
      return true;
    },
  });
  return {
    c,
    ops,
    get depth() {
      return stack.length;
    },
  };
}

const idle: Input = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 1700, y: 600 },
};
function fixture(scene = 'props', mirror = false) {
  const f = materialTestFromUrl(
    new URL(`https://test/?test=material-response&scene=${scene}${mirror ? '&mirror=1' : ''}&v=1`),
  )!;
  assert(f);
  const g = new Game();
  g.startTest(f.checkpoint, materialTestRoom(f));
  assert(prepareMaterialTest(g, f));
  return g;
}
function tick(g: Game, n = 1) {
  for (let i = 0; i < n; i++) g.tick(1 / 60, idle);
}
function dispose(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function native(g: Game) {
  return JSON.stringify({
    mode: g.mode,
    time: g.time,
    hp: g.hp,
    shots: g.shots,
    kills: g.kills,
    props: g.props.items.map((p) => ({
      kind: p.kind,
      hp: p.hp,
      position: { ...p.body.position },
      velocity: { ...p.body.velocity },
      angle: p.body.angle,
      armedAt: p.armedAt,
      detonateAt: p.detonateAt,
      throwUntil: p.throwUntil,
    })),
    bodies: Matter.Composite.allBodies(g.engine.world).map((b) => ({
      id: b.id,
      position: { ...b.position },
      velocity: { ...b.velocity },
      angle: b.angle,
    })),
    observer: g.materialResponse.breaks,
    saved: g.checkpointSnapshot(),
  });
}
function prop(g: Game, kind: Prop['kind']) {
  const p = g.props.items.find((p) => p.kind === kind);
  assert(p, kind);
  return p;
}
function draw(g: Game, p: Prop, reduced = false) {
  const out = canvas();
  assert(drawMaterialProp(out.c, g, p, reduced));
  assert.equal(out.depth, 0);
  return out;
}

test('all four native materials use distinct finite balanced art inside their actual rotated hulls', () => {
  for (const mirror of [false, true]) {
    const g = fixture('props', mirror);
    try {
      const signatures = new Set<string>();
      for (const kind of ['crate', 'cover', 'canister', 'cargo'] as const) {
        const p = prop(g, kind);
        Matter.Body.setAngle(p.body, 0.31);
        const before = native(g),
          rng = g.rng;
        g.rng = () => {
          throw Error('art consumed combat RNG');
        };
        try {
          for (const reduced of [false, true]) {
            const out = draw(g, p, reduced),
              { w, h } = PROP_STATS[kind];
            assert(
              out.ops.some(
                (o) =>
                  o.name === 'translate' &&
                  o.args[0] === p.body.position.x &&
                  o.args[1] === p.body.position.y,
              ),
            );
            assert(out.ops.some((o) => o.name === 'rotate' && o.args[0] === p.body.angle));
            assert(
              out.ops.some(
                (o) =>
                  o.name === 'rect' &&
                  o.args[0] === -w / 2 &&
                  o.args[1] === -h / 2 &&
                  o.args[2] === w &&
                  o.args[3] === h,
              ),
            );
            assert(out.ops.length > 75);
            assert(!out.ops.some((o) => ['fillText', 'strokeText'].includes(o.name)));
            signatures.add(kind + JSON.stringify(out.ops));
          }
        } finally {
          g.rng = rng;
        }
        assert.equal(native(g), before);
      }
      assert(signatures.size >= 4);
    } finally {
      dispose(g);
    }
  }
});

test('hunt, job, case, charge, fuse, welded cover and native solid rubble keep their specialized paths', () => {
  const g = fixture();
  try {
    const p = prop(g, 'crate');
    for (const flag of ['hunt', 'uprising', 'auditCase', 'charge', 'welded'] as const) {
      const sample = {
          ...p,
          [flag]: flag === 'hunt' ? 'plate' : flag === 'uprising' ? 'relay' : true,
        } as unknown as Prop,
        out = canvas();
      assert.equal(drawMaterialProp(out.c, g, sample), false);
      assert.equal(out.ops.length, 0);
    }
    for (const kind of ['rubble', 'fuse', 'charge'] as const) {
      const p = g.props.spawn(kind, 1350, 600),
        out = canvas();
      assert.equal(drawMaterialProp(out.c, g, p), false);
      assert.equal(out.ops.length, 0);
    }
  } finally {
    dispose(g);
  }
});

test('actual accepted prop damage drives local surface hardware and health wear without moving the collision outline', () => {
  const g = fixture('reactions');
  try {
    for (const kind of ['crate', 'cover', 'cargo'] as const) {
      const p = prop(g, kind),
        outputs: string[] = [];
      for (const [i, damage] of [0, p.maxHp * 0.36, p.maxHp * 0.36].entries()) {
        if (damage) g.props.hit(p, damage, { x: 1, y: 0.1 });
        const s = materialPropSnapshot(g, p)!;
        assert.equal(s.wear, i);
        if (damage) assert(s.hit?.local && materialPose(s).hitStrength > 0);
        const out = draw(g, p);
        outputs.push(JSON.stringify(out.ops));
        const { w, h } = PROP_STATS[kind];
        assert(
          out.ops.some(
            (o) =>
              o.name === 'strokeRect' &&
              o.args[0] === -w / 2 + 0.6 &&
              o.args[1] === -h / 2 + 0.6 &&
              o.args[2] === w - 1.2 &&
              o.args[3] === h - 1.2,
          ),
        );
      }
      assert.equal(new Set(outputs).size, 3);
    }
  } finally {
    dispose(g);
  }
});

test('native canister grace stays truthful and an armed canister has no blinking countdown in either effect mode', () => {
  const g = fixture('canisters');
  try {
    const p = prop(g, 'canister'),
      sealed = draw(g, p);
    g.props.hit(p, 1, { x: 1, y: 0 });
    assert.equal(materialPose(materialPropSnapshot(g, p)!).canister, 'grace');
    const grace = draw(g, p);
    assert.notDeepEqual(grace.ops, sealed.ops);
    g.time = p.armedAt + 0.5;
    assert.equal(materialPose(materialPropSnapshot(g, p)!).canister, 'armed');
    for (const reduced of [false, true]) {
      const a = draw(g, p, reduced);
      g.time += 0.137;
      const b = draw(g, p, reduced);
      assert.deepEqual(a.ops, b.ops, 'steady armed hardware must not pulse or count down');
    }
    assert.equal(p.detonateAt, Infinity);
    assert(g.props.items.includes(p));
  } finally {
    dispose(g);
  }
});

test('native Scrapper throw outline remains above the crate material artwork', () => {
  const g = fixture();
  try {
    const p = prop(g, 'crate');
    p.throwUntil = g.time + 0.5;
    Matter.Body.setVelocity(p.body, { x: 7, y: 0 });
    const out = draw(g, p),
      last = out.ops.findLastIndex((o) => o.name === 'strokeRect');
    assert(
      out.ops.slice(0, last).some((o) => o.name === 'style:strokeStyle' && o.args[0] === '#eab27f'),
    );
    assert.deepEqual(out.ops[last].args, [-24, -24, 48, 48]);
  } finally {
    dispose(g);
  }
});

test('real prop fractures produce material-specific inert chips with no extra bodies, collision hull or reward-bearing rubble', () => {
  for (const kind of ['crate', 'cover', 'cargo', 'canister'] as const) {
    const g = fixture('breakage');
    try {
      const p = prop(g, kind),
        count = Matter.Composite.allBodies(g.engine.world).length;
      if (kind === 'canister') g.props.explode(p);
      else g.props.hit(p, 1e6, { x: 1, y: 0 });
      const record = g.materialResponse.breaks.find((b) => b.snapshot.bodyId === p.body.id);
      assert(record);
      assert.equal(record.snapshot.kind, kind);
      assert(!g.props.items.includes(p));
      assert(Matter.Composite.allBodies(g.engine.world).length < count);
      for (const reduced of [false, true]) {
        const out = canvas(),
          before = native(g);
        drawMaterialBreaks(out.c, g, reduced);
        assert.equal(out.depth, 0);
        assert(out.ops.length > 0);
        assert(
          !out.ops.some((o) => o.name === 'strokeRect'),
          'inert chips do not draw a complete collision hull',
        );
        assert(
          out.ops
            .filter((o) => o.name === 'style:globalAlpha')
            .some((o) => Number(o.args[0]) < 0.7),
        );
        assert.equal(native(g), before);
      }
    } finally {
      dispose(g);
    }
  }
});

test('terrain chips share exactly the same bounded world art pass while native solid rubble remains separate', () => {
  const g = fixture('terrain');
  try {
    const piece = g.destruction.pieces.find((p) => p.rect.h > 28)!;
    assert(piece);
    g.destruction.hitBody(piece.body, 1e6, { x: 1, y: 0 });
    assert(g.materialResponse.breaks.some((b) => b.snapshot.source === 'terrain'));
    assert(g.props.items.some((p) => p.kind === 'rubble'));
    const a = canvas();
    drawMaterialBreaks(a.c, g);
    assert(a.ops.length > 0);
    for (const p of g.props.items.filter((p) => p.kind === 'rubble'))
      assert.equal(drawMaterialProp(canvas().c, g, p), false);
  } finally {
    dispose(g);
  }
});

test('Pause freezes native surface reactions and fragments, and presentation expiry never changes native props', () => {
  const g = fixture('breakage');
  try {
    const p = prop(g, 'crate');
    g.props.hit(p, 1e6, { x: 1, y: 0 });
    g.setMode('paused');
    const before = native(g),
      a = canvas();
    drawMaterialBreaks(a.c, g);
    tick(g, 120);
    const b = canvas();
    drawMaterialBreaks(b.c, g);
    assert.equal(native(g), before);
    assert.deepEqual(a.ops, b.ops);
    g.setMode('playing');
    tick(g, Math.ceil((MATERIAL_BREAK_LIFE + 0.4) * 60));
    assert.equal(g.materialResponse.breaks.length, 0);
    const empty = canvas();
    drawMaterialBreaks(empty.c, g);
    assert.equal(empty.ops.length, 0);
  } finally {
    dispose(g);
  }
});

test('production Renderer uses ordinary material art and draws the shared fragment pass once before native props', () => {
  const g = fixture('breakage'),
    out = canvas();
  try {
    g.props.hit(prop(g, 'crate'), 1e6, { x: 1, y: 0 });
    const element = {
        getContext: () => out.c,
        getBoundingClientRect: () => ({ width: 960, height: 600 }),
      } as unknown as HTMLCanvasElement,
      r = new Renderer(element, g);
    r.draw(1000, { camera: { x: 300, y: 450 }, scale: 1, player: true, navigation: false });
    assert.equal(out.depth, 0);
    const fragmentCount = out.ops.filter(
      (o) => o.name === 'style:globalAlpha' && Math.abs(Number(o.args[0]) - 0.85 * 0.62) < 1e-7,
    ).length;
    assert(fragmentCount > 0);
    assert(
      out.ops.some((o) => o.name === 'style:fillStyle' && o.args[0] === '#304a48'),
      'native cover uses its captive panel assembly',
    );
  } finally {
    dispose(g);
  }
});
