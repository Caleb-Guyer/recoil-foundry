import type { Game } from './game.ts';
import type { WorkshopScenario } from './workshop.ts';
import { clamp, direction, distance } from './rules.ts';
import { firstSolid } from './collisions.ts';
import { enemyShielded } from './enemies.ts';
import { SHIFT_MODS } from './shift-catalog.ts';
import { SHIFT, mountPoint, mountNormal } from './shift-upgrades.ts';
import { CHARGE_TIME } from './ballistics.ts';

export type BuildMotionState = 'ready' | 'charging' | 'active' | 'blocked' | 'waiting';
export interface BuildMotionDefinition {
  id: string;
  name: string;
  trigger: string;
  detail: string;
  scenario: WorkshopScenario;
}
export interface BuildMotionRow extends BuildMotionDefinition {
  state: BuildMotionState;
  progress?: number;
}
const instructions: Record<string, { trigger: string; scenario: WorkshopScenario }> = {
  'polarity-rounds': {
    trigger: 'Hit nearby machines with separate discharges.',
    scenario: 'groups',
  },
  'ricochet-harness': {
    trigger: 'Recoil into a wall during a fast airborne launch.',
    scenario: 'recoil',
  },
  'spring-rivets': {
    trigger: 'Hit a surface while airborne, then jump beside the fitted pad.',
    scenario: 'recoil',
  },
  'slip-gauge': {
    trigger: 'Graze a small hostile round, then jump while airborne.',
    scenario: 'incoming',
  },
  'wake-wire': {
    trigger: 'Keep firing through recoil flight, then release fire.',
    scenario: 'recoil',
  },
  'false-silhouette': {
    trigger: 'Use a shot to reverse your airborne movement.',
    scenario: 'incoming',
  },
  'gimbal-mount': { trigger: 'Hold a movement direction while firing.', scenario: 'recoil' },
  'momentum-exchange': { trigger: 'Land a direct hit while airborne.', scenario: 'groups' },
  'offset-nozzle': {
    trigger: 'Hit scenery to fit a muzzle, then fire another discharge.',
    scenario: 'cover',
  },
  'momentum-battery': {
    trigger: 'Fire while grounded, then jump from the ground.',
    scenario: 'recoil',
  },
  'piston-lance': { trigger: 'Fire your full pattern at close range.', scenario: 'groups' },
  'cable-saw': {
    trigger: 'Fire at close range; hold fire to sweep the cast blades.',
    scenario: 'groups',
  },
  'seeker-rack': {
    trigger: 'Hold fire over exposed targets, then release completed locks.',
    scenario: 'groups',
  },
  foamcaster: {
    trigger: 'Hit an unoccupied supported surface away from entrances.',
    scenario: 'cover',
  },
  'catch-chamber': {
    trigger: 'Intercept a small round beside parked ammunition; release fire to launch it.',
    scenario: 'incoming',
  },
  'gate-snare': {
    trigger: 'Place two portals, then shoot two surfaces to fit a routed wire.',
    scenario: 'cover',
  },
  'hot-wire': {
    trigger: 'Link two enemies, then sweep your beam across their cable.',
    scenario: 'groups',
  },
  'ghost-shift': { trigger: 'Reboot an ally, then fire complete discharges.', scenario: 'groups' },
  windmill: { trigger: 'Send a spent surface saw through one of your gusts.', scenario: 'cover' },
  'scrap-comet': { trigger: 'Fire a steel ball near exposed loose debris.', scenario: 'cover' },
};
const extras: BuildMotionDefinition[] = [
  {
    id: 'capacitor',
    name: 'Capacitor',
    trigger: 'Stop firing to load a cell; fire to spend it.',
    detail: 'One stored cell doubles the damage of the next complete discharge.',
    scenario: 'groups',
  },
  {
    id: 'countershot',
    name: 'Countershot',
    trigger: 'Meet a small hostile round with your fire.',
    detail:
      'A successful interception spends the shared charge. Release fire for 0.8 seconds to recharge.',
    scenario: 'incoming',
  },
  {
    id: 'suspension',
    name: 'Suspension',
    trigger: 'Hold fire to park ammunition; release to launch it.',
    detail:
      'Recoil still happens when the shot is fired. Parked rounds are bounded and eventually auto-launch.',
    scenario: 'groups',
  },
  {
    id: 'overkill-bank',
    name: 'Overkill Bank',
    trigger: 'Finish a target with excess direct damage, then fire again.',
    detail:
      'The next discharge shares the reserve across its full pattern. Boosted hits cannot refill it.',
    scenario: 'groups',
  },
  {
    id: 'heat-relay',
    name: 'Heat Relay',
    trigger: 'Kill a heated beam target and acquire another exposed target.',
    detail: 'A bounded part of its heat transfers once before the short reserve expires.',
    scenario: 'groups',
  },
  {
    id: 'scrap-armor',
    name: 'Scrap Armor',
    trigger: 'Break a crate or cracked cover with direct fire.',
    detail: 'One temporary plate absorbs a small hostile bullet. Plates cannot stack.',
    scenario: 'incoming',
  },
];
const definitions: BuildMotionDefinition[] = [
  ...SHIFT_MODS.map((mod) => ({
    ...instructions[mod.id],
    id: mod.id,
    name: mod.name,
    detail: mod.description,
  })),
  ...extras,
];
const byId = new Map(definitions.map((definition) => [definition.id, definition]));
/** A new record is returned: callers cannot change the authored catalog. */
export function buildMotionDefinition(id: string): BuildMotionDefinition | undefined {
  const definition = byId.get(id);
  return definition ? { ...definition } : undefined;
}

const morphs = ['piston-lance', 'cable-saw', 'seeker-rack', 'foamcaster'];
const fusions = [
  'catch-chamber',
  'gate-snare',
  'hot-wire',
  'ghost-shift',
  'windmill',
  'scrap-comet',
];
/** Describes only equipped mechanics; no unlock hints, hypothetical damage or invented results. */
export function buildMotionConnections(
  mods: readonly string[],
): { title: string; detail: string }[] {
  const order = [...morphs, ...fusions, ...SHIFT_MODS.map((mod) => mod.id)];
  return [...new Set(order)]
    .filter((id) => mods.includes(id))
    .map((id) => {
      const definition = byId.get(id)!;
      return { title: definition.name, detail: definition.trigger + ' ' + definition.detail };
    });
}

function exposed(g: Game, e: Game['enemies'][number]) {
  return (
    e.hp > 0 &&
    e.spawn <= 0 &&
    !e.allied &&
    !e.courier &&
    e.eventRole !== 'relay' &&
    g.enemies.includes(e) &&
    distance(g.player.position, e.body.position) < 1250 &&
    distance(g.lineEnd(g.player.position, e.body.position), e.body.position) < 1 &&
    !enemyShielded(e, direction(g.player.position, e.body.position))
  );
}
const count = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
function rowState(g: Game, id: string): Pick<BuildMotionRow, 'state' | 'detail' | 'progress'> {
  const s = g.shiftUpgrades,
    f = g.shiftFusions,
    m = g.shiftMorphs;
  const result = (state: BuildMotionState, detail: string, progress?: number) => ({
    state,
    detail,
    ...(progress === undefined ? {} : { progress: clamp(progress, 0, 1) }),
  });
  if (morphs.includes(id) && m.equipped !== id)
    return result('blocked', 'Another morph is currently equipped.');
  switch (id) {
    case 'seeker-rack': {
      const locks = m.locks.filter((lock) => exposed(g, lock.enemy));
      const complete = locks.filter((lock) => lock.progress >= 1).length;
      if (complete)
        return result(
          'ready',
          `${count(complete, 'lock')} complete. Release fire to queue your native salvo. Cover still blocks it.`,
          1,
        );
      if (locks.length)
        return result(
          'charging',
          'Keep holding fire over an exposed target to finish its lock.',
          Math.max(...locks.map((lock) => lock.progress)),
        );
      return result(
        'waiting',
        'Hold fire over an exposed target. A wall or shield prevents painting.',
      );
    }
    case 'piston-lance':
    case 'cable-saw': {
      const flights = [...m.flights].filter(
        ([shot, flight]) => shot.life > 0 && g.shots.includes(shot) && flight.kind === id,
      );
      return result(
        flights.length || g.torch.emitting ? 'active' : 'waiting',
        g.torch.equipped
          ? 'Your existing beam pattern gains 35% energy and one extra penetration, with the morph’s short reach. Aim close.'
          : `${count(flights.length, 'cast')} in flight. Your existing pellets and firing lanes remain. ${id === 'piston-lance' ? 'Short piston strokes carry stronger payloads and extra penetration.' : g.mods.includes('recall') ? 'Recall keeps its own complete return leg.' : 'The return strike carries half of the outgoing payload.'}`,
      );
    }
    case 'foamcaster': {
      const supports = m.foams.filter(
        (foam) => foam.until > g.time && g.terrainBodies.includes(foam.surface),
      );
      return result(
        supports.length ? 'active' : 'waiting',
        supports.length
          ? `${count(supports.length, 'temporary support')} fitted. Crowded space and entrances reject new foam.`
          : 'Aim at supported terrain with empty space beside it. Foam cannot fill an entrance or overlap a body.',
      );
    }
    case 'slip-gauge':
      return s.slipReady
        ? result(
            g.grounded ? 'active' : 'ready',
            `${count(s.slipCharges, 'air burst')} stored briefly. ${g.grounded ? 'Leave the ground before spending it.' : 'Your next airborne jump spends one; it gives no invulnerability.'}`,
            1,
          )
        : result(
            'waiting',
            'Narrowly miss a small hostile round through clear space. Heavy rounds and blasts do not charge this fitting.',
          );
    case 'momentum-battery':
      return s.battery > 0
        ? result(
            g.grounded ? 'ready' : 'active',
            g.grounded
              ? 'Jump now to release the stored recoil into this grounded launch.'
              : 'Recoil reserve stored. Land, then jump to release it.',
            s.battery / SHIFT.batteryCap,
          )
        : result('waiting', 'Fire while grounded to bank recoil for a later grounded jump.', 0);
    case 'offset-nozzle': {
      const nozzle = s.nozzle;
      if (!nozzle || nozzle.until <= g.time || !g.terrainBodies.includes(nozzle.body))
        return result(
          'waiting',
          'Hit scenery with direct fire to fit a short-lived remote muzzle.',
        );
      if (nozzle.used !== undefined)
        return result(
          'active',
          'This discharge is using the fitted muzzle; later discharges return to your gun.',
        );
      const point = mountPoint(nozzle),
        normal = mountNormal(nozzle);
      const from = { x: point.x + normal.x * 7, y: point.y + normal.y * 7 };
      if (distance(g.player.position, point) > SHIFT.nozzleRange)
        return result(
          'blocked',
          'The fitted muzzle is out of range. The next discharge will use your own gun.',
        );
      if (firstSolid(from, { x: from.x + 0.01, y: from.y + 0.01 }, { x: 3, y: 3 }, g.solidBodies))
        return result(
          'blocked',
          'The fitted muzzle is obstructed. The next discharge will use your own gun.',
        );
      const cycling = g.time < g.shootAt || g.burstRemaining > 0;
      return result(
        cycling ? 'charging' : 'ready',
        cycling
          ? 'The fitted muzzle is live, but your tool is still cycling. It must survive until the next complete discharge.'
          : 'Your next complete discharge will fire from the fitted muzzle while your body keeps the recoil.',
      );
    }
    case 'spring-rivets': {
      const pads = s.rivets.filter(
        (pad) => pad.until > g.time && g.terrainBodies.includes(pad.body),
      );
      const near = pads.some((pad) => {
        const p = mountPoint(pad),
          n = mountNormal(pad),
          dx = g.player.position.x - p.x,
          dy = g.player.position.y - p.y;
        return (
          dx * n.x + dy * n.y >= 7 &&
          dx * n.x + dy * n.y <= 38 &&
          Math.abs(dx * -n.y + dy * n.x) < 40 &&
          firstSolid(g.player.position, p, { x: 8, y: 14 }, g.terrainBodies)?.body === pad.body
        );
      });
      return result(
        near ? 'ready' : pads.length ? 'active' : 'waiting',
        near
          ? 'Jump beside this pad to consume it and launch outward.'
          : pads.length
            ? `${count(pads.length, 'pad')} fitted. Move beside one and jump before it expires.`
            : 'Your first airborne surface hit fits a pad. A normal grounded shot cannot place one.',
      );
    }
    case 'wake-wire': {
      if (s.wire && s.wire.until > g.time)
        return result(
          'active',
          'Your released flight path is armed briefly. Real terrain blocks its line.',
        );
      const length = s.trail
        .slice(1)
        .reduce((sum, point, i) => sum + distance(s.trail[i], point), 0);
      return result(
        length >= 60 && s.holdingFire ? 'ready' : length ? 'charging' : 'waiting',
        length >= 60 && s.holdingFire
          ? 'Release fire to arm the recoil path you just drew.'
          : 'Keep firing through recoil flight to draw at least a short continuous path.',
        length / 60,
      );
    }
    case 'polarity-rounds': {
      const marks = [...s.polarity.values()].filter(
        (mark) => mark.until > g.time && mark.enemy.hp > 0 && g.enemies.includes(mark.enemy),
      );
      return result(
        marks.length ? 'active' : 'waiting',
        marks.length
          ? `${count(marks.length, 'machine')} charged. Forces require nearby poles and clear space between them.`
          : 'Separate discharges alternate polarity. Hit nearby enemies to build a pair.',
      );
    }
    case 'ricochet-harness':
      return result(
        'waiting',
        `A fast airborne recoil collision can rebound from a wall ${g.shiftRun.hasEvolution('double-return') ? 'twice' : 'once'} per discharge. Walking into a wall does not trigger it.` +
          (g.shiftRun.hasEvolution('impact-echo')
            ? ' Your rebound also sends a short cover-blocked impact echo.'
            : ''),
      );
    case 'false-silhouette':
      return result(
        s.silhouette && s.silhouette.until > g.time ? 'active' : 'waiting',
        s.silhouette && s.silhouette.until > g.time
          ? 'Your decoy is present briefly. It can draw a nearby patrol’s next attack; committed warnings keep their aim.'
          : 'Use actual recoil to reverse flight. Steering or a wall alone cannot leave the decoy.',
      );
    case 'gimbal-mount':
      return result(
        'active',
        'Hold a movement direction to steer the next recoil along it. Neutral movement keeps normal recoil while your gun keeps its aim.',
      );
    case 'momentum-exchange':
      return result(
        g.grounded ? 'waiting' : 'active',
        g.grounded
          ? 'Leave the ground, then land a direct hit. Reflected rounds and secondary effects do not exchange velocity.'
          : 'An eligible direct airborne hit can exchange velocity after the brief recharge. Heavy machines resist and keep their attack.',
      );
    case 'catch-chamber': {
      const stock = f.captured.filter((entry) => entry.until > g.time);
      return result(
        stock.length ? (g.stasis.held ? 'ready' : 'active') : 'waiting',
        stock.length
          ? `${count(stock.length, 'captured round')} held briefly. ${g.stasis.held ? 'Release fire to launch the payload.' : 'Hold, then release fire to launch the payload.'}`
          : 'Park ammunition and intercept a small hostile round nearby. The shared Countershot charge must be ready.',
      );
    }
    case 'gate-snare': {
      const gate = f.gate;
      if (!gate || gate.until <= g.time)
        return result(
          'waiting',
          g.portals.linked
            ? 'Your portal pair is linked. Shoot two supported surfaces with clear routed segments to fit the wire.'
            : 'Place a linked portal pair, then shoot the two wire anchors.',
        );
      const valid =
        g.portals.linked &&
        gate.portals.every((portal) => g.portals.pair.includes(portal)) &&
        [gate.a, gate.b].every(
          (anchor) =>
            g.terrainBodies.includes(anchor.body) &&
            distance(anchor.body.position, anchor.origin) < 0.01 &&
            Math.abs(anchor.body.angle - anchor.angle) < 0.0001,
        ) &&
        gate.segments.every(
          (segment) =>
            !firstSolid(segment.a, segment.b, { x: 1, y: 1 }, [
              ...g.solidBodies,
              ...g.enemies.flatMap((enemy) =>
                enemy.crane && enemy.spawn <= 0 ? [enemy.crane.body] : [],
              ),
            ]),
        );
      return result(
        !valid ? 'blocked' : g.time < gate.armed ? 'charging' : 'active',
        !valid
          ? 'The routed wire lost a clear supported path or its original portals. Rebuild its anchors.'
          : g.time < gate.armed
            ? 'The routed wire is fitted and arming.'
            : 'Both visible segments share one armed trap. Moving the portals breaks the wire.',
      );
    }
    case 'hot-wire': {
      const link = g.tethers.link;
      const valid =
        !!link &&
        link.until > g.time &&
        link.a.hp > 0 &&
        link.b.hp > 0 &&
        g.enemies.includes(link.a) &&
        g.enemies.includes(link.b) &&
        distance(link.a.body.position, link.b.body.position) <= 640 &&
        g.tethers.clearPath(link.a, link.b);
      const hot = valid && f.hot?.link === link && f.hot.until > g.time;
      return result(
        hot ? 'active' : valid ? 'waiting' : 'blocked',
        hot
          ? 'Your beam is supplying energy to the live cable. The direct beam shares that energy.'
          : valid
            ? 'Sweep the beam across the clear live cable to heat it.'
            : 'Link two living enemies through clear space before crossing their cable with the beam.',
      );
    }
    case 'ghost-shift': {
      const allies = g.factions.allies.filter(
        (ally) =>
          ally.hp > 0 &&
          ally.spawn <= 0 &&
          ally.rebootUntil !== undefined &&
          ally.rebootUntil > g.time,
      );
      return result(
        f.ghosts.length ? 'charging' : allies.length ? 'active' : 'waiting',
        f.ghosts.length
          ? 'A delayed copy of your real discharge is queued. It still needs the living ally and clear firing space.'
          : allies.length
            ? `${count(allies.length, 'rebooted ally', 'rebooted allies')} present. Every fourth eligible discharge can queue its delayed copy.`
            : 'Reboot a defeated patrol unit first. Resistant machines give Spoof feedback instead of an ally.',
      );
    }
    case 'windmill': {
      const mills = f.mills.filter((mill) => mill.life > 0);
      return result(
        mills.length ? 'active' : 'waiting',
        mills.length
          ? `${count(mills.length, 'cutting trap')} airborne briefly. Each uses part of its caught saw’s damage and keeps that saw’s hit history.`
          : 'A live surface saw must reach a recent gust through clear space. Firing alone does not create a trap.',
      );
    }
    case 'scrap-comet': {
      const comets = [...f.comets.values()].filter(
        (comet) => comet.shot.life > 0 && g.shots.includes(comet.shot) && comet.props.size > 0,
      );
      return result(
        comets.length ? 'active' : 'waiting',
        comets.length
          ? `${count(comets.length, 'steel ball')} towing loose debris. Impacts release it; the extra load costs speed and banks.`
          : 'Fire steel balls near loose crates or rubble. Fixed machinery, occupied debris and blocked paths cannot be collected.',
      );
    }
    case 'capacitor':
      return g.ballistics.charges > 0
        ? result(
            'ready',
            `${count(g.ballistics.charges, 'cell')} loaded. Your next complete discharge spends one.`,
            1,
          )
        : result(
            'charging',
            'Release fire fully to load a cell. Holding or continuing a burst resets loading.',
            g.ballistics.idle / CHARGE_TIME,
          );
    case 'countershot':
      return result(
        g.ballistics.counterReady ? 'ready' : 'charging',
        g.ballistics.counterReady
          ? 'Shared interception charge ready. An eligible small round still needs to meet your fire.'
          : 'Release fire for the full recharge. Every firing lane shares this charge.',
        g.ballistics.counterCharge,
      );
    case 'suspension': {
      const stock = g.stasis.stock;
      return result(
        stock.length
          ? g.stasis.held && !g.mods.includes('tripline')
            ? 'ready'
            : 'active'
          : 'waiting',
        stock.length
          ? `${count(stock.length, 'round')} parked. ${g.mods.includes('tripline') ? 'Your proximity traps launch at an exposed nearby enemy.' : 'Release fire to launch the stored pattern.'}`
          : 'Hold fire to park rounds while keeping the immediate recoil.',
      );
    }
    case 'overkill-bank':
      return result(
        g.support.reserve > 0 ? 'ready' : 'waiting',
        g.support.reserve > 0
          ? 'Excess damage is banked. The next complete discharge shares its bounded payout.'
          : 'Finish a target with excess direct damage to bank a later payout.',
      );
    case 'heat-relay':
      return result(
        g.support.relay > 0 && g.support.relayUntil >= g.time ? 'ready' : 'waiting',
        g.support.relay > 0 && g.support.relayUntil >= g.time
          ? 'Heat is stored briefly. Acquire the next exposed beam target before it expires.'
          : 'Kill a target carrying Thermal Runaway heat to store a transfer.',
      );
    case 'scrap-armor':
      return result(
        g.support.plate ? 'active' : g.time < g.support.plateReadyAt ? 'charging' : 'waiting',
        g.support.plate
          ? 'One temporary armor plate is active. Large, explosive and blade attacks pass through.'
          : g.time < g.support.plateReadyAt
            ? 'The armor fitting is recharging. Breaking another crate cannot stack a plate.'
            : 'Break a crate or cracked cover with direct fire to earn one plate.',
      );
  }
  return result('waiting', byId.get(id)?.detail ?? '');
}
function unavailable(g: Game): string | null {
  if (g.hp <= 0 || !['playing', 'paused'].includes(g.mode))
    return 'Unavailable outside a living run.';
  if (g.finale.safe) return 'Unavailable during this visual transition.';
  if (g.hitStop > 0) return 'Combat is briefly stopped by an impact.';
  return null;
}
function motionRow(g: Game, definition: BuildMotionDefinition): BuildMotionRow {
  const block = unavailable(g);
  const state = block ? { state: 'blocked' as const, detail: block } : rowState(g, definition.id);
  return {
    ...definition,
    ...state,
    detail: g.mode === 'paused' && !block ? 'On resume: ' + state.detail : state.detail,
  };
}
/** A pure snapshot: inspecting this model never invokes an ability or consumes a reserve. */
export function buildMotion(g: Game): BuildMotionRow[] {
  return definitions
    .filter(
      (definition) => g.mods.includes(definition.id) || g.shiftMorphs.equipped === definition.id,
    )
    .map((definition) => motionRow(g, definition));
}
export interface BuildMotionCue {
  id: string;
  label: string;
}
const cueLabels: Record<string, string> = {
  'seeker-rack': 'Release locks',
  'catch-chamber': 'Release payload',
  'slip-gauge': 'Air burst ready',
  'offset-nozzle': 'Next shot remote',
  'wake-wire': 'Release to arm',
  'momentum-battery': 'Jump reserve',
  'spring-rivets': 'Jump from pad',
};
/** Constant-sized scan; do not build all explanation cards on every rendered frame. */
export function buildMotionCue(g: Game): BuildMotionCue | null {
  if (g.mode !== 'playing' || unavailable(g)) return null;
  for (const [id, label] of Object.entries(cueLabels)) {
    if (!g.mods.includes(id) && g.shiftMorphs.equipped !== id) continue;
    if (rowState(g, id).state === 'ready') return { id, label };
  }
  return null;
}
