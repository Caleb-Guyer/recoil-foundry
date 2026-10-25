import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { drawUprising } from '../src/uprising-art.ts';
import { drawUprisingRemaster } from '../src/uprising-remaster-art.ts';
import { uprisingRemasterTestFromUrl } from '../src/uprising-remaster-test.ts';
import { uprisingTestFromUrl } from '../src/uprising-test.ts';
import { UPRISING_ROUTES, type UprisingRouteId } from '../src/uprising-model.ts';

type Operation = {
  op: string;
  args: unknown[];
  stroke: unknown;
  fill: unknown;
  alpha: number;
  width: number;
};
function canvas() {
  const operations: Operation[] = [];
  const styles: Record<string, unknown> = {
    globalAlpha: 1,
    lineWidth: 1,
    lineCap: 'butt',
    fillStyle: '#fff',
    strokeStyle: '#000',
    font: '10px sans-serif',
    textAlign: 'start',
  };
  const stack: Record<string, unknown>[] = [];
  const c = new Proxy({} as CanvasRenderingContext2D, {
    get(_target, key) {
      if (key === 'save') return () => stack.push({ ...styles });
      if (key === 'restore')
        return () => {
          assert(stack.length, 'the world renderer owns the surrounding canvas state');
          Object.assign(styles, stack.pop());
        };
      if (key === 'setLineDash')
        return (values: number[]) => assert(values.every((v) => Number.isFinite(v) && v >= 0));
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
          'fillText',
        ].includes(String(key))
      )
        return (...args: unknown[]) => {
          const numbers = key === 'fillText' ? args.slice(1) : args;
          assert(
            numbers.every((value) => typeof value === 'number' && Number.isFinite(value)),
            String(key),
          );
          operations.push({
            op: String(key),
            args,
            stroke: styles.strokeStyle,
            fill: styles.fillStyle,
            alpha: Number(styles.globalAlpha),
            width: Number(styles.lineWidth),
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
    styles,
    get depth() {
      return stack.length;
    },
  };
}
function fixture(route: UprisingRouteId) {
  const source = uprisingRemasterTestFromUrl(
    new URL('https://test/?test=uprising-remaster&route=' + route + '&v=1'),
  );
  assert(source);
  const g = new Game();
  g.startTest(source.checkpoint);
  return g;
}
function clean(g: Game) {
  Matter.Composite.clear(g.engine.world, false);
  Matter.Engine.clear(g.engine);
}
function bounds(body: Matter.Body) {
  const xs = body.vertices.map((p) => p.x),
    ys = body.vertices.map((p) => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
const text = (out: ReturnType<typeof canvas>) =>
  out.operations.filter((o) => o.op === 'fillText').map((o) => o.args[0]);
function rectangle(out: ReturnType<typeof canvas>, geometry: number[]) {
  return out.operations.find(
    (o) => o.op === 'strokeRect' && JSON.stringify(o.args) === JSON.stringify(geometry),
  );
}

test('all eleven native jobs draw bounded deterministic cues without changing mission state', () => {
  for (const route of UPRISING_ROUTES) {
    const g = fixture(route.id),
      before = {
        time: g.time,
        player: { ...g.player.position },
        nodes: g.uprising.nodes.map((n) => n.hp),
        state: g.uprising.remaster.snapshot,
        choices: structuredClone(g.uprising.run),
      };
    const ordinary = canvas(),
      reduced = canvas();
    drawUprising(ordinary.c, g);
    drawUprisingRemaster(reduced.c, g);
    assert(ordinary.operations.length > 0, route.id);
    assert(ordinary.operations.length < 200, route.id + ': keep the scene compact');
    assert.deepEqual(
      ordinary.operations,
      reduced.operations,
      'Reduced Effects retains identical world geometry',
    );
    assert.deepEqual(
      {
        time: g.time,
        player: { ...g.player.position },
        nodes: g.uprising.nodes.map((n) => n.hp),
        state: g.uprising.remaster.snapshot,
        choices: structuredClone(g.uprising.run),
      },
      before,
    );
    assert.equal(ordinary.depth, 0);
    assert.equal(ordinary.styles.strokeStyle, '#000');
    assert.equal(ordinary.styles.fillStyle, '#fff');
    assert.equal(ordinary.styles.globalAlpha, 1);
    assert(text(ordinary).length <= 4, route.id + ': no instruction paragraphs over combat');
    assert(!text(ordinary).some((t) => ['POWER', 'RELAY', 'SEALED', 'TAKE'].includes(String(t))));
    clean(g);
  }
});

test('theft interlocks use their actual switch and a locked case before collection', () => {
  const g = fixture('core-recovery'),
    out = canvas(),
    u = g.uprising;
  assert.equal(u.kind, 'steal');
  assert(u.switchTarget);
  drawUprising(out.c, g);
  const p = u.switchTarget;
  assert.equal(rectangle(out, [p.x - 16, p.y - 20, 32, 40])?.stroke, '#e8bd7d');
  assert.equal(rectangle(out, bounds(u.nodes[0].body))?.stroke, '#637b80');
  const zone = u.remaster.extraction!;
  assert.equal(rectangle(out, [zone.x, zone.y, zone.w, zone.h])?.stroke, '#637b80');
  assert.deepEqual(text(out), ['1']);
  clean(g);
});

test('all physical extraction volumes remain muted until ready and show bounded boarding progress', () => {
  for (const route of [
    'rail-heist',
    'core-recovery',
    'scrap-raid',
    'rail-escape',
    'roof-escape',
    'core-sabotage',
    'signal-cut',
  ] as const) {
    const g = fixture(route),
      u = g.uprising,
      zone = u.remaster.extraction!;
    const geometry = [zone.x, zone.y, zone.w, zone.h],
      locked = canvas();
    drawUprising(locked.c, g);
    assert.equal(rectangle(locked, geometry)?.stroke, '#637b80', route);
    if (u.kind === 'steal') u.collected = true;
    else if (u.kind === 'escape') u.routeStep = u.room!.switches!.length;
    else {
      for (const node of u.nodes) node.hp = 0;
      const bridge = u.remaster.room!.sabotageBridge!,
        anchor = u.anchors[0];
      // This is a presentation state, not a claim that a gameplay mission completed.
      Matter.Body.setPosition(anchor.body, { x: anchor.x, y: anchor.y + bridge.drop });
    }
    const active = canvas();
    drawUprising(active.c, g);
    assert.equal(rectangle(active, geometry)?.stroke, '#afd4b3', route);
    assert(
      text(active).includes(
        u.kind === 'steal' ? 'EXTRACT' : u.kind === 'sabotage' ? 'CROSS HERE' : 'BOARD HERE',
      ),
    );
    u.boardingAt = g.time - 1;
    const halfway = canvas();
    drawUprising(halfway.c, g);
    assert(text(halfway).includes('BOARDING'));
    assert(
      halfway.operations.some(
        (o) =>
          o.op === 'fillRect' &&
          JSON.stringify(o.args) ===
            JSON.stringify([zone.x + 9, zone.y + zone.h - 8, (zone.w - 18) / 2, 3]),
      ),
    );
    u.boardingAt = g.time - 999;
    const clamped = canvas();
    drawUprising(clamped.c, g);
    assert(
      clamped.operations.some(
        (o) =>
          o.op === 'fillRect' &&
          JSON.stringify(o.args) ===
            JSON.stringify([zone.x + 9, zone.y + zone.h - 8, zone.w - 18, 3]),
      ),
    );
    clean(g);
  }
});

test('sabotage extraction does not advertise a floating pad before the real bridge arrives', () => {
  const g = fixture('core-sabotage'),
    u = g.uprising,
    zone = u.remaster.extraction!;
  for (const node of u.nodes) node.hp = 0;
  assert(u.remaster.extracting);
  const out = canvas();
  drawUprising(out.c, g);
  assert.equal(rectangle(out, [zone.x, zone.y, zone.w, zone.h])?.stroke, '#637b80');
  assert(!text(out).includes('CROSS HERE'));
  clean(g);
});

test('sequential station bodies distinguish finished, current and future objectives', () => {
  const g = fixture('roof-relief'),
    u = g.uprising,
    out = canvas();
  u.remaster.station = 1;
  u.remaster.completedStations = 1;
  drawUprising(out.c, g);
  assert.deepEqual(
    u.nodes.map((n) => rectangle(out, bounds(n.body))?.stroke),
    ['#afd4b3', '#e8bd7d', '#637b80'],
  );
  assert.deepEqual(text(out), ['1', '2', '3']);
  u.armedAt = g.time - 3;
  const progress = canvas(),
    b = bounds(u.nodes[1].body);
  drawUprising(progress.c, g);
  assert(
    progress.operations.some(
      (o) =>
        o.op === 'fillRect' &&
        JSON.stringify(o.args) === JSON.stringify([b[0] + 8, b[1] + b[3] - 6, (b[2] - 16) / 2, 3]),
    ),
  );
  assert.equal(progress.depth, 0);
  clean(g);
});

test('moving hardware follows physical hulls and legacy jobs keep their original objective renderer', () => {
  const g = fixture('rail-guard'),
    u = g.uprising,
    anchor = u.anchors[0];
  const old = bounds(anchor.body);
  Matter.Body.setPosition(anchor.body, { x: anchor.x + 170, y: anchor.y });
  const out = canvas();
  drawUprising(out.c, g);
  assert(rectangle(out, bounds(anchor.body)));
  assert(!rectangle(out, old));
  clean(g);
  const cp = uprisingTestFromUrl(new URL('https://test/?test=uprising&route=core-defense&v=1'));
  assert(cp);
  const legacy = new Game();
  legacy.startTest(cp);
  const oldOut = canvas();
  drawUprising(oldOut.c, legacy);
  assert.equal(legacy.uprising.remaster.eligible, false);
  assert(text(oldOut).includes('POWER'));
  clean(legacy);
});

test('title and inactive scenes create no phantom mission art', () => {
  const g = fixture('rail-heist');
  g.mode = 'title';
  const out = canvas();
  drawUprising(out.c, g);
  drawUprisingRemaster(out.c, g);
  assert.equal(out.operations.length, 0);
  assert.equal(out.depth, 0);
  clean(g);
  const inactive = new Game(),
    blank = canvas();
  drawUprising(blank.c, inactive);
  drawUprisingRemaster(blank.c, inactive);
  assert.equal(blank.operations.length, 0);
  clean(inactive);
});
