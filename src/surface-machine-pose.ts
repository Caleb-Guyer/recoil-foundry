import type { Enemy, Game } from './game.ts';
import type { MachineBodySnapshot, MachinePose, MachineLeg } from './machine-breakdown-pose.ts';
import { ANGLER, anglerSurfaceValid } from './angler.ts';
import { CRAWLER } from './wallcrawler.ts';
import { clamp, distance, type Vec } from './rules.ts';
export type SurfaceMachineKind = 'angler' | 'wallcrawler';
export const isSurfaceMachineKind = (kind: string): kind is SurfaceMachineKind =>
  kind === 'angler' || kind === 'wallcrawler';
export interface SurfaceDischarge {
  at: number;
  angle: number;
  muzzle: Vec;
  origin: Vec;
  index: number;
}
export interface SurfaceMachineEventState {
  discharges: SurfaceDischarge[];
  dropAt: number | null;
  interruptedAt: number | null;
}
export interface SurfaceMachineSnapshot extends SurfaceMachineEventState {
  grounded: boolean;
  supportY: number | null;
  angler?: {
    plan: {
      surfaceId: number;
      bodyPosition: Vec;
      bodyAngle: number;
      origin: Vec;
      start: Vec;
      bounce: Vec;
      end: Vec;
      incoming: Vec;
      outgoing: Vec;
      length: number;
      valid: boolean;
    } | null;
    exposed: number;
    searchAt: number;
  };
  crawler?: {
    attached: boolean;
    support: {
      id: number;
      position: Vec;
      angle: number;
      vertices: Vec[];
      available: boolean;
    } | null;
    edge: number;
    dir: number;
    normal: Vec;
    origin: Vec;
    angles: number[];
    fired: number;
    vulnerable: number;
    blocked: number;
    travel: number;
    contact: { point: Vec; normal: Vec; tangent: Vec; a: Vec; b: Vec } | null;
  };
}
export interface SurfaceMachinePose extends MachinePose {
  surfaceMachine: true;
  kind: SurfaceMachineKind;
  mode: string;
  energy: number;
  exposure: number;
  grip: number;
  recoil: number;
  normal: Vec;
  tangent: Vec;
  barrel: { origin: Vec; angle: number; length: number; recoil: number };
  gimbal: { center: Vec; angle: number };
  shutters: { from: Vec; to: Vec; open: number }[];
  pads: { point: Vec; normal: Vec; planted: boolean }[];
}
const copy = (v: Vec): Vec => ({ x: v.x, y: v.y });
const unit = (v: number) => clamp(Number.isFinite(v) ? v : 0, 0, 1);
function facePoint(p: Vec, a: Vec, b: Vec) {
  const length = distance(a, b) || 1,
    t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length },
    u = clamp((p.x - a.x) * t.x + (p.y - a.y) * t.y, 0, length);
  return { point: { x: a.x + t.x * u, y: a.y + t.y * u }, tangent: t };
}
/** Copies native support, bank and exposure data without invoking navigation or physics validators. */
export function surfaceMachineSnapshot(
  e: Enemy,
  g?: Game,
  grounded = false,
  supportY: number | null = null,
): SurfaceMachineSnapshot {
  const events = g?.machineBreakdown.getSurfaceMachine(e),
    a = e.angler,
    c = e.crawler,
    plan = a?.plan,
    host = c?.support,
    available =
      !!host &&
      (!g ||
        ((g.terrain.includes(host) || g.counterweights.owns(host)) &&
          Math.abs(host.angle) < 0.001)),
    edge =
      host && c
        ? ((c.edge % host.vertices.length) + host.vertices.length) % host.vertices.length
        : 0,
    face = host
      ? facePoint(
          e.body.position,
          host.vertices[edge],
          host.vertices[(edge + 1) % host.vertices.length],
        )
      : null;
  return {
    grounded,
    supportY,
    discharges: events?.discharges ?? [],
    dropAt: events?.dropAt ?? null,
    interruptedAt: events?.interruptedAt ?? null,
    ...(a
      ? {
          angler: {
            plan: plan
              ? {
                  surfaceId: plan.body.id,
                  bodyPosition: copy(plan.bodyPos),
                  bodyAngle: plan.bodyAngle,
                  origin: copy(plan.origin),
                  start: copy(plan.start),
                  bounce: copy(plan.bounce),
                  end: copy(plan.end),
                  incoming: copy(plan.incoming),
                  outgoing: copy(plan.outgoing),
                  length: plan.length,
                  valid: g ? anglerSurfaceValid(g, plan) : true,
                }
              : null,
            exposed: a.exposed,
            searchAt: a.searchAt,
          },
        }
      : {}),
    ...(c
      ? {
          crawler: {
            attached: !!host,
            support: host
              ? {
                  id: host.id,
                  position: copy(host.position),
                  angle: host.angle,
                  vertices: host.vertices.map(copy),
                  available,
                }
              : null,
            edge: c.edge,
            dir: c.dir,
            normal: copy(c.normal),
            origin: copy(c.origin),
            angles: c.angles.slice(0, 3),
            fired: c.fired,
            vulnerable: c.vulnerable,
            blocked: c.blocked,
            travel: c.travel,
            contact:
              host && face
                ? {
                    point: face.point,
                    normal: copy(c.normal),
                    tangent: face.tangent,
                    a: copy(host.vertices[edge]),
                    b: copy(host.vertices[(edge + 1) % host.vertices.length]),
                  }
                : null,
          },
        }
      : {}),
  };
}
/** All limb and pad coordinates are world-aligned relative to the real actor center. */
export function surfaceMachinePose(s: MachineBodySnapshot, reduced = false): SurfaceMachinePose {
  if (!isSurfaceMachineKind(s.kind)) throw Error('Expected a surface machine');
  const h = s.surfaceMachine,
    a = h?.angler,
    c = h?.crawler,
    f: -1 | 1 = s.facing < 0 ? -1 : 1,
    energy = s.hp > 0 ? 1 : 0,
    motion = !reduced && energy > 0 && s.spawn <= 0,
    event = h?.discharges.at(-1),
    age = event ? Math.max(0, s.time - event.at) : Infinity,
    duration = s.kind === 'wallcrawler' ? 0.105 : 0.24,
    recoil = motion ? Math.max(0, 1 - age / duration) ** 2 : 0,
    exposure = (a?.exposed ?? c?.vulnerable ?? 0) > 0 ? 1 : 0,
    normal = c ? copy(c.normal) : { x: 0, y: -1 },
    tangent = { x: -normal.y, y: normal.x },
    mount = s.kind === 'wallcrawler' ? Math.atan2(normal.y, normal.x) + Math.PI / 2 : 0,
    dropAge = h?.dropAt === null || h?.dropAt === undefined ? 0 : Math.max(0, s.time - h.dropAt),
    fallen = c && !c.attached,
    tumble =
      motion && fallen
        ? Math.min(CRAWLER.stun, c.vulnerable > 0 ? CRAWLER.stun - c.vulnerable : dropAge) * 2.6
        : 0,
    angle =
      s.kind === 'wallcrawler'
        ? mount + tumble
        : motion
          ? clamp(s.velocity.x * 0.015, -0.045, 0.045) - f * recoil * 0.035
          : 0,
    activePlan = a?.plan?.valid ? a.plan : null,
    warning =
      s.kind === 'angler'
        ? s.state === 'windup' && !!activePlan
        : (s.state === 'windup' || s.state === 'followup') && !!c?.attached,
    brace = warning
      ? reduced
        ? 0.7
        : s.kind === 'angler'
          ? unit(1 - s.timer / ANGLER.tell)
          : s.state === 'followup'
            ? 1
            : unit(1 - s.timer / CRAWLER.tell)
      : 0,
    grip = s.kind === 'wallcrawler' && c?.attached && c.support?.available ? 1 : 0,
    wear: 0 | 1 | 2 =
      s.hp <= 0 || s.hp / Math.max(1, s.maxHp) <= 0.3
        ? 2
        : s.hp / Math.max(1, s.maxHp) <= 0.65
          ? 1
          : 0,
    local = (p: Vec): Vec => ({
      x: (p.x - s.position.x) / s.scale,
      y: (p.y - s.position.y) / s.scale,
    }),
    basis = (p: Vec): Vec => ({
      x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
    }),
    useEvent = !reduced && !!event && age < duration,
    aimingAngle = activePlan
      ? Math.atan2(activePlan.incoming.y, activePlan.incoming.x)
      : c?.angles.length
        ? c.angles[Math.min(c.fired, 2)]
        : Math.atan2(s.aim.y, s.aim.x),
    barrelAngle = useEvent ? event!.angle : aimingAngle,
    worldCenter = useEvent
      ? event!.origin
      : (activePlan?.origin ??
        (c && c.angles.length
          ? c.origin
          : { x: s.position.x, y: s.position.y - (s.kind === 'angler' ? 5 : 0) })),
    worldTip = useEvent
      ? event!.muzzle
      : (activePlan?.start ?? {
          x: worldCenter.x + Math.cos(barrelAngle) * 26,
          y: worldCenter.y + Math.sin(barrelAngle) * 26,
        }),
    barrel = { origin: local(worldTip), angle: barrelAngle, length: 26, recoil },
    gimbal = { center: local(worldCenter), angle: barrelAngle },
    legs: MachineLeg[] = [],
    pads: SurfaceMachinePose['pads'] = [],
    shutters: SurfaceMachinePose['shutters'] = [],
    body = {
      x: s.kind === 'angler' ? -f * recoil * 0.7 : 0,
      y: s.kind === 'angler' ? brace * 0.6 : 0,
    };
  if (s.kind === 'angler') {
    const moving = motion && h?.grounded && Math.abs(s.velocity.x) > 0.04,
      stride = moving ? Math.sin(s.position.x * 0.18) * Math.min(3, Math.abs(s.velocity.x)) : 0,
      floor =
        h?.supportY === null || h?.supportY === undefined
          ? 15
          : (h.supportY - s.position.y) / s.scale - 1;
    for (const side of [-1, 1]) {
      const planted = !!h?.grounded && (!moving || side * stride <= 0),
        foot = {
          x: side * (11 + brace * 3) + side * stride,
          y: floor - (planted ? 0 : Math.abs(stride)),
        };
      legs.push({ hip: { x: side * 6, y: 6 }, knee: { x: side * 11, y: 11 }, foot, planted });
      pads.push({ point: { ...foot }, normal: { x: 0, y: -1 }, planted });
    }
    for (const side of [-1, 1])
      shutters.push({
        from: { x: side * (3 + (exposure > 0 ? 5 : 0)), y: -5 },
        to: { x: side * (3 + (exposure > 0 ? 5 : 0)), y: 6 },
        open: exposure > 0 ? 1 : 0,
      });
  } else {
    const contact = c?.contact,
      walk =
        motion && grip > 0 && s.state === 'idle' && Math.hypot(s.velocity.x, s.velocity.y) > 0.02,
      gait = walk ? Math.sin(c!.travel * 0.22) * 2.8 : 0;
    for (const side of [-1, 1])
      for (const row of [-1, 1]) {
        const hip = basis({ x: side * 7, y: row * 5 }),
          swing = !!walk && side * row * gait > 0,
          spread = side * (11 + row * 3) + row * gait,
          target =
            contact && grip
              ? facePoint(
                  {
                    x: contact.point.x + tangent.x * spread,
                    y: contact.point.y + tangent.y * spread,
                  },
                  contact.a,
                  contact.b,
                ).point
              : null,
          foot = target
            ? local({
                x: target.x + normal.x * (swing ? Math.abs(gait) : 0),
                y: target.y + normal.y * (swing ? Math.abs(gait) : 0),
              })
            : basis({ x: side * 13, y: row * 10 + 5 }),
          knee = target
            ? {
                x: (hip.x + foot.x) * 0.5 + tangent.x * side * 5,
                y: (hip.y + foot.y) * 0.5 + tangent.y * side * 5,
              }
            : basis({ x: side * 17, y: row * 7 }),
          planted = grip > 0 && !swing;
        legs.push({ hip, knee, foot, planted });
        pads.push({ point: { ...foot }, normal: copy(normal), planted });
      }
  }
  const mode =
    s.kind === 'angler'
      ? a && a.exposed > 0
        ? 'exposed'
        : recoil > 0
          ? 'discharge'
          : warning
            ? s.timer <= ANGLER.lock
              ? 'locked'
              : 'tracking'
            : s.state === 'recover'
              ? 'recover'
              : 'travel'
      : fallen
        ? 'fallen'
        : recoil > 0
          ? 'discharge'
          : warning
            ? s.state === 'followup' || s.timer <= CRAWLER.lock
              ? 'locked'
              : 'tracking'
            : s.state === 'recover'
              ? 'recover'
              : 'climbing';
  return {
    surfaceMachine: true,
    kind: s.kind,
    mode,
    energy,
    exposure,
    grip,
    recoil,
    normal,
    tangent,
    barrel,
    gimbal,
    shutters,
    pads,
    wear,
    forward: f,
    body,
    angle,
    brace,
    recover: s.state === 'recover',
    receiver: recoil * 2,
    rotor: 0,
    legs,
  };
}
