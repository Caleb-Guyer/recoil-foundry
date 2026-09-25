import assert from 'node:assert/strict';
import Matter from 'matter-js';
import type { Game, Input } from '../src/game.ts';
import { distance } from '../src/rules.ts';
import { EXTRACTION } from '../src/escape-layout.ts';
import { CRANE_LOCK } from '../src/crane-ai.ts';
import { CRAWLER } from '../src/wallcrawler.ts';
import { dodgePilot } from './combat-pilot.ts';
import { pressurePilot } from './pressure-pilot.ts';
import { freightPilot } from './freight-pilot.ts';
const { Query } = Matter;
const tick = (g: Game, n = 1, p: Partial<Input> = {}) => {
  for (let i = 0; i < n; i++)
    g.tick(1 / 60, {
      left: false,
      right: false,
      jump: false,
      jumpHeld: true,
      fire: false,
      aim: { x: 1000, y: 680 },
      ...p,
    });
};
export interface CampaignPilotOptions {
  pathMods: string[];
  pressSpacing?: number;
  fusion?: string;
  extendedRewards?: string[];
  highRoads?: number[];
  seconds?: number;
  chooseUpgrade?: (g: Game) => string;
  beforeInput?: (g: Game) => Input | undefined;
  stop?: (g: Game) => boolean;
}
// Shared ordinary-input campaign pilot. No enemy, health or physics overrides.
export function playCampaign(g: Game, options: CampaignPilotOptions) {
  const { pathMods, fusion, extendedRewards, highRoads, pressSpacing = 220 } = options;
  let previousX = 140,
    stuck = 0,
    lastProgress = 0,
    lastKills = 0,
    clearAt = -1,
    directExitReady = false,
    takingLowerRoute = false,
    lowerDropX = 1760,
    routeStep = 0,
    escapeSeen = false,
    pressDodgeUntil = 0,
    pressDirection = 1,
    pressReacted = false,
    craneDodgeUntil = 0,
    craneDirection = 1,
    loaderDodgeUntil = 0,
    loaderDirection = 1,
    loaderReacted = false;
  const ventInput = pressurePilot();
  let retreatWaypoint: { x: number; y: number } | undefined;
  let settlingGun = false;
  let fusionUsed = false;
  let tetherUsed = false;
  let arcUsed = false;
  let flashUsed = false,
    slipUsed = false;
  let cinderUsed = false,
    windUsed = false;
  const salvageStep = g.salvage.beforeStep.bind(g.salvage);
  g.salvage.beforeStep = (dt) => {
    cinderUsed ||= g.salvage.cinders.length > 0;
    windUsed ||= g.salvage.gusts.length > 0;
    salvageStep(dt);
    slipUsed ||= !!g.salvage.riding;
  };
  g.onSound = (kind) => {
    if (kind === 'tether-link') tetherUsed = true;
    if (kind === 'arc') arcUsed = true;
    if (kind === 'flashpoint') flashUsed = true;
  };
  const priority = [
    ...pathMods,
    'leech',
    'magnum',
    'scatter',
    'rapid',
    'airshot',
    'burst',
    'backblast',
    'banker',
    'landing',
    'pierce',
    'ricochet',
    'light',
    'split',
    'kick',
    'crossfire',
    'bloom',
    'deadeye',
    'execute',
    'fold',
  ];
  // A rail can hit nearby cover and expire in the same fixed step. Observe
  // its actual emission as well as rounds that survive until the next tick.
  const emitShot = g.addShot.bind(g);
  g.addShot = (data) => {
    emitShot(data);
    if (fusion === 'rail-spike' && g.shots.at(-1)?.rail) fusionUsed = true;
  };
  for (
    let i = 0;
    i < 60 * (options.seconds ?? 900) &&
    !options.stop?.(g) &&
    g.mode !== 'dead' &&
    g.mode !== 'won';
    i++
  ) {
    fusionUsed ||=
      fusion === 'rail-spike'
        ? g.shots.some((s) => s.rail)
        : fusion === 'orbit'
          ? g.shots.some((s) => s.orbitReleased)
          : fusion === 'implosion' && g.mods.includes(fusion) && g.ballistics.shells.length > 0;
    const custom = options.beforeInput?.(g);
    if (custom) {
      g.tick(1 / 60, custom);
      continue;
    }
    if (g.mode === 'reforge') {
      g.reforge.close();
      continue;
    }
    if (g.escape?.phase === 'extracting') {
      tick(g);
      continue;
    }
    if (g.freight.active && g.mode === 'playing') {
      g.tick(1 / 60, freightPilot(g));
      continue;
    }
    if (g.escape && !escapeSeen) {
      escapeSeen = true;
      clearAt = -1;
      stuck = 0;
      previousX = g.player.position.x;
      retreatWaypoint = undefined;
    }
    if (g.mode === 'upgrade') {
      g.chooseMod(
        options.chooseUpgrade?.(g) ??
          extendedRewards?.[g.stage] ??
          [...g.offers].sort(
            (a, b) =>
              (priority.includes(a.id) ? priority.indexOf(a.id) : Infinity) -
              (priority.includes(b.id) ? priority.indexOf(b.id) : Infinity),
          )[0].id,
      );
      clearAt = -1;
      lastProgress = g.time;
      directExitReady = false;
      takingLowerRoute = false;
      lowerDropX = 1760;
      routeStep = 0;
      retreatWaypoint = undefined;
      settlingGun = false;
      stuck = 0;
      previousX = g.player.position.x;
    }
    const p = g.player.position,
      e = [...g.enemies].sort(
        (a, b) =>
          distance(a.body.position, p) +
          (distance(g.lineEnd(p, a.body.position), a.body.position) > 1 ? 800 : 0) -
          (distance(b.body.position, p) +
            (distance(g.lineEnd(p, b.body.position), b.body.position) > 1 ? 800 : 0)),
      )[0];
    const terminal = g.areaEvents.terminalReady;
    const exitX = terminal ? g.areaEvents.site.x : g.escape ? EXTRACTION.x : 1910;
    const ep = e?.body.position ?? (terminal ? g.areaEvents.site : { x: exitX, y: 700 }),
      // Heavy shells should lead a short movement, not predict an entire
      // long flight through the target's next landing or direction change.
      lead = Math.min(
        pathMods[0] === 'shellshock' ? 15 : Infinity,
        distance(p, ep) / g.gun.projectileSpeed,
      ),
      dx = ep.x - p.x,
      dy = p.y - ep.y;
    let aim = {
      x: ep.x + (e?.body.velocity.x ?? 0) * lead,
      y: ep.y + (e?.body.velocity.y ?? 0) * lead,
    };
    stuck = Math.abs(p.x - previousX) < 0.5 ? stuck + 1 : 0;
    previousX = p.x;
    let move =
      g.clear || terminal
        ? p.x < exitX - (g.escape ? 10 : 0)
          ? 1
          : p.x > exitX + (g.escape ? 10 : 50)
            ? -1
            : 0
        : dx > 240
          ? 1
          : dx < -240
            ? -1
            : Math.abs(dx) < 100
              ? dx < 0
                ? 1
                : -1
              : 0;
    if (!g.clear && (p.x < 100 || p.x > 1900)) move = p.x < 100 ? 1 : -1;
    if (g.kills !== lastKills) {
      lastKills = g.kills;
      lastProgress = g.time;
    }
    if (!g.clear && g.time - lastProgress > 5) move = Math.sin(g.time * 0.65) > 0 ? 1 : -1;
    // If cover blocks a distant target, stop recoil and take the next terrain waypoint.
    const navigate = g.clear || terminal || (g.time - lastProgress > 8 && distance(p, ep) > 500);
    const path = [...g.level.route, { x: exitX, y: 720 }];
    let way = navigate
      ? dx > 0
        ? path.find((q) => q.x > p.x + 35)
        : [...path].reverse().find((q) => q.x < p.x - 35)
      : undefined;
    // A fight can leave us below a tall step. Return to its approach ledge
    // instead of repeating floor jumps against the vertical face forever.
    if (g.clear && stuck > 60 && !retreatWaypoint)
      retreatWaypoint = [...path].reverse().find((q) => q.x < p.x - 60);
    if (retreatWaypoint) {
      way = retreatWaypoint;
      if (Math.abs(p.x - way.x) < 30 && p.y <= way.y + 25) retreatWaypoint = undefined;
    }
    if (way) move = way.x > p.x ? 1 : -1;
    const blocked =
      !!move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
    const lift =
      (!navigate && ((!g.clear && dy > 70 && Math.abs(dx) < 500) || (blocked && stuck > 20))) ||
      // Keep climbing until the player's feet clear the ledge, rather than
      // cutting recoil while still pressed against its vertical face.
      !!(navigate && way && p.y > way.y - 12 && !g.grounded && stuck > 15);
    let jump = g.grounded && (i % 90 === 0 || blocked || stuck > 15 || lift);
    // Direct-fire builds hop off moving ground to hold a firing lane;
    // shell builds keep their existing trajectory into nearby cover.
    if (
      !g.clear &&
      !g.gun.shellshock &&
      g.grounded &&
      g.conveyors.items.some(
        (belt) =>
          Math.abs(g.player.bounds.max.y - belt.y) < 4 && p.x >= belt.x && p.x <= belt.x + belt.w,
      )
    )
      jump = true;
    if (lift && !g.grounded) aim = { x: p.x, y: p.y + 500 };
    if (g.clear) {
      if (clearAt < 0) clearAt = g.time;
      assert(
        g.time - clearAt < 35,
        `Exit unreachable in ${g.level.id}, stage ${g.stage}, at (${Math.round(p.x)}, ${Math.round(p.y)}), way ${JSON.stringify(way)}, retreat ${JSON.stringify(retreatWaypoint)}, props ${JSON.stringify(g.props.items.map((p) => ({ kind: p.kind, pos: p.body.position })))}`,
      );
      jump = g.grounded && (blocked || stuck > 15 || !!(way && p.y - way.y > 50));
    }
    if (way && p.y - way.y > 50 && g.grounded) jump = true;
    let firing = !g.clear && !terminal && (!navigate || (lift && !g.grounded));
    const terminalInput = { move, jump, fire: lift && !g.grounded };
    const breach = g.breaches.placement,
      hatch = breach?.panels.find((rect) => rect.w > rect.h);
    if (
      g.clear &&
      breach &&
      hatch &&
      p.x > Math.min(...breach.solids.map((rect) => rect.x)) - 10 &&
      p.x < Math.max(...breach.solids.map((rect) => rect.x + rect.w)) + 10 &&
      p.y > hatch.y - 90 &&
      p.y < hatch.y + 36
    ) {
      const center = hatch.x + hatch.w / 2;
      move = Math.abs(center - p.x) > 6 ? Math.sign(center - p.x) : 0;
      jump = false;
      aim = { x: p.x, y: p.y + 300 };
      firing =
        Math.abs(center - p.x) < 35 &&
        g.breaches.panels.some((panel) => panel.rect.w > panel.rect.h);
      // Entering from an outboard lip can put the vertical panel between
      // the player and the hatch. Shoot that visible barrier before centering.
      const sidePanel = g.breaches.panels.find(
        (panel) =>
          panel.rect.h > panel.rect.w &&
          (panel.body.position.x - p.x) * (center - p.x) > 0 &&
          Math.abs(panel.body.position.x - p.x) < Math.abs(center - p.x),
      );
      if (sidePanel) {
        move = 0;
        aim = { ...sidePanel.body.position };
        firing = true;
      }
    }
    if (e?.kind === 'press') {
      move = dx > pressSpacing ? 1 : dx < -pressSpacing ? -1 : 0;
      jump = false;
      firing = true;
      aim = { ...e.body.position };
      const pressBlocked =
        move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length;
      if (g.grounded && (pressBlocked || stuck > 25)) jump = true;
      if (e.state === 'windup' && e.timer <= (e.attack === 'flak' ? 0.38 : 0.65) && !pressReacted) {
        pressReacted = true;
        // Continue across the locked lanes rather than reversing into old bolts.
        pressDirection = p.x < 400 ? 1 : p.x > 1600 ? -1 : pressDirection;
        pressDodgeUntil = g.time + 1.1;
        jump = g.grounded;
      }
      if (e.state !== 'windup') pressReacted = false;
      if (g.time < pressDodgeUntil) {
        move = pressDirection;
        firing = false;
      }
      if (p.x < 160 || p.x > 1840) {
        move = p.x < 160 ? 1 : -1;
        firing = false;
      }
    }
    if (
      (e && g.overtime && g.enemies.some((enemy) => enemy.kind === 'kiln')) ||
      e?.kind === 'kiln' ||
      (e && ['borer', 'sifter'].includes(e.kind) && distance(g.lineEnd(p, ep), ep) < 1) ||
      e?.kind === 'sorter' ||
      e?.kind === 'boss' ||
      e?.kind === 'condenser' ||
      e?.kind === 'turbine' ||
      e?.kind === 'interceptor' ||
      // Slow shells need the full visible tell to start their approach. Direct
      // rounds can keep firing until the bank locks. Neither reads future aim.
      (e?.kind === 'angler' && e.state === 'windup' && e.timer <= (g.gun.shellshock ? 1.2 : 0.6))
    ) {
      const choice = dodgePilot(g, e);
      move = Number(choice.right) - Number(choice.left);
      jump = choice.jump!;
      firing = choice.fire!;
      aim = choice.aim!;
    }
    if (e?.kind === 'crane') {
      // Use the docks boss pilot's visible warning reactions. Treating these
      // bosses as ordinary shooters made survival depend on arrival timing.
      move = dx > 320 ? 1 : dx < -320 ? -1 : 0;
      if (distance(g.lineEnd(p, ep), ep) > 1) move = Math.sign(dx);
      jump =
        g.grounded &&
        ((!!move && Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0) ||
          stuck > 25);
      if (e.state === 'windup' && e.timer <= CRANE_LOCK) {
        if (e.attack === 'sweep') jump ||= g.grounded;
        else {
          craneDodgeUntil = g.time + 0.65;
          craneDirection = p.x < 1000 ? 1 : -1;
        }
      }
      if (g.time < craneDodgeUntil) move = craneDirection;
      firing = e.state !== 'rush' && !(e.state === 'windup' && e.timer <= CRANE_LOCK);
      aim = { ...ep };
      // The wider Overtime volley now clears the hammer. Use the projectile
      // forecast instead of running blindly across all five locked lanes.
      if (
        g.overtime &&
        e.attack === 'flak' &&
        ((e.state === 'windup' && e.timer <= 0.38) ||
          g.shots.some((s) => !s.friendly && s.damageCause?.enemy === 'crane'))
      ) {
        const choice = dodgePilot(g, e);
        move = Number(choice.right) - Number(choice.left);
        jump = !!choice.jump;
        firing = !!choice.fire;
        aim = choice.aim ?? aim;
      }
    }
    // Re-evaluate actual cover and visible fire after each support failure.
    // A fixed direction held for a full second can cross a newly opened charge lane.
    if (e?.kind === 'loader') {
      if (g.mods.includes('rapid')) {
        const input = dodgePilot(g, e);
        move = Number(input.right) - Number(input.left);
        jump = !!input.jump;
        firing = !!input.fire;
        aim = input.aim ?? aim;
      } else {
        // Slower guns jump across the locked volley and coast before firing again.
        const spacing = g.gun.pellets === 1 ? 320 : 220;
        move = dx > spacing ? 1 : dx < -spacing ? -1 : 0;
        if (distance(g.lineEnd(p, ep), ep) > 1) move = Math.sign(dx);
        jump =
          g.grounded &&
          !!move &&
          Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
        aim = { ...ep };
        firing = true;
        if (e.state === 'windup' && e.timer <= 0.38 && !loaderReacted) {
          loaderReacted = true;
          loaderDodgeUntil = g.time + 0.9;
          loaderDirection = p.x < 400 ? 1 : p.x > 1600 ? -1 : Math.sign(dx);
          jump ||= g.grounded;
        }
        if (e.state !== 'windup') loaderReacted = false;
        if (g.time < loaderDodgeUntil) {
          move = loaderDirection;
          firing = false;
        }
        if (e.state === 'rush' && Math.abs(dx) < 300) jump ||= g.grounded;
        if (p.x < 160 || p.x > 1840) {
          move = p.x < 160 ? 1 : -1;
          firing = false;
        }
      }
    }
    if (
      !g.clear &&
      e?.kind !== 'sorter' &&
      e?.kind !== 'borer' &&
      e?.kind !== 'sifter' &&
      e?.kind !== 'boss' &&
      e?.kind !== 'condenser' &&
      e?.kind !== 'turbine' &&
      e?.kind !== 'interceptor' &&
      e?.kind !== 'press' &&
      e?.kind !== 'loader' &&
      e?.kind !== 'crane' &&
      !(g.overtime && g.enemies.some((enemy) => enemy.kind === 'kiln'))
    ) {
      const threat = g.shots.find((s) => {
        if (s.friendly) return false;
        const rx = s.pos.x - p.x,
          ry = s.pos.y - p.y;
        const vx = s.vel.x - g.player.velocity.x,
          vy = s.vel.y - g.player.velocity.y;
        const t = Math.max(0, Math.min(12, -(rx * vx + ry * vy) / (vx * vx + vy * vy || 1)));
        return Math.hypot(rx + vx * t, ry + vy * t) < 38;
      });
      const warning =
        !g.level.boss &&
        g.enemies.some(
          (enemy) =>
            ((['shooter', 'flyer', 'sniper'].includes(enemy.kind) && enemy.timer <= 0.35) ||
              (enemy.crawler?.support &&
                (enemy.state === 'followup' ||
                  (enemy.state === 'windup' && enemy.timer <= CRAWLER.lock)))) &&
            distance(enemy.body.position, p) < (enemy.crawler ? 900 : 650) &&
            distance(g.lineEnd(enemy.body.position, p), p) < 1,
        );
      if ((threat || warning) && e && !g.level.boss) {
        // Pick a safe trajectory across all visible shots. A reflexive jump
        // away from one shot can now land in a second overlapping volley.
        const choice = dodgePilot(g, e);
        jump = choice.jump!;
        firing = choice.fire!;
        move = Number(choice.right) - Number(choice.left);
        aim = choice.aim!;
      } else if (threat) {
        jump = g.grounded;
        firing = false;
        move = threat.pos.x < p.x ? 1 : -1;
      }
    }
    const takeHighRoad = g.canChooseRoute && highRoads?.includes(g.stage);
    // Catch landings on either approach step too, not only flight above the
    // upper door. A low arrival must not accidentally select a bonus room.
    if (g.clear && g.canBranch && !takeHighRoad && p.x > 1700 && p.y < 600) takingLowerRoute = true;
    if (g.clear && g.canBranch && !takeHighRoad && takingLowerRoute) {
      // These runs verify the direct route. Land before the fork, then
      // walk below the steps instead of accidentally selecting the upper door.
      if (p.y > 630) directExitReady = true;
      // An authored shelf can extend through x=1760. Walk off its left edge
      // before dropping; waiting directly above it cannot reach the low exit.
      const shelf = g.terrain.find(
        (body) =>
          body.bounds.min.y < 720 &&
          body.bounds.max.y > g.player.bounds.max.y - 5 &&
          Math.abs(body.bounds.min.y - g.player.bounds.max.y) < 5 &&
          p.x > body.bounds.min.x - 14 &&
          p.x < body.bounds.max.x + 14,
      );
      if (shelf) lowerDropX = Math.min(lowerDropX, shelf.bounds.min.x - 30);
      move = directExitReady ? 1 : Math.abs(p.x - lowerDropX) > 8 ? Math.sign(lowerDropX - p.x) : 0;
      // Reaching the lower lane can still leave an ordinary obstacle before
      // the fork. Jump that obstacle, then walk beneath the actual exit steps.
      jump =
        directExitReady &&
        p.x < 1740 &&
        g.grounded &&
        Query.ray(g.solidBodies, p, { x: p.x + move * 65, y: p.y }, 20).length > 0;
      firing = false;
    }
    if (g.clear && takeHighRoad && p.x > 1600) {
      // Select terrain with normal movement. Precision gets open firing lanes;
      // one shell run takes the aerial Reclamation road to cover mixed routes.
      if (routeStep === 0 && Math.abs(p.x - 1725) < 22 && g.grounded) routeStep = 1;
      if (routeStep === 1 && Math.abs(p.x - 1828) < 22 && Math.abs(p.y - 572) < 8 && g.grounded)
        routeStep = 2;
      const target =
        routeStep === 0
          ? { x: 1725, y: 722 }
          : routeStep === 1
            ? { x: 1828, y: 572 }
            : { x: 1930, y: 442 };
      move = Math.abs(target.x - p.x) > 8 ? Math.sign(target.x - p.x) : 0;
      jump = g.grounded && p.y - target.y > 45;
      firing = false;
    }
    // React to the visible drop lane just as to a locked projectile warning.
    const fallingLoad = g.cargo.items.find(
      (load) =>
        (load.cargo!.state === 'warning' ||
          (load.cargo!.state === 'loose' && load.body.velocity.y > 4)) &&
        p.y > load.body.position.y &&
        Math.abs(p.x - load.body.position.x) < 100,
    );
    if (fallingLoad) {
      move = p.x < fallingLoad.body.position.x ? -1 : 1;
      jump = false;
      firing = false;
    }
    // Jump ahead of a visible moving bumper; continuing to fire can recoil
    // the pilot back into its path. This uses the same ordinary movement inputs.
    const train = g.crossing.cars.find((c) => {
      const d = g.crossing.direction;
      const gap = (p.x - c.body.position.x - d * 130) * d;
      return p.y > 600 && gap > -20 && gap < 160;
    });
    if (train && !g.crossing.blocked) {
      move = g.crossing.direction;
      jump ||= g.grounded;
      firing = false;
    }
    // Read the Harpooner's locked line and exposed winch using normal inputs.
    if (e?.harpoon?.phase === 'aim' && e.timer <= 0.55) jump ||= g.grounded;
    if (e?.harpoon?.phase === 'latched') {
      aim = { x: e.body.position.x + e.aim.x * 26, y: e.body.position.y - 5 + e.aim.y * 26 };
      firing = true;
    }
    // Large shell builds coast between volleys near the edge. Continuing to
    // shoot from a corner repeatedly propels the player back into that corner.
    if (g.stage >= 12 && g.gun.shellshock && !g.clear && !g.level.boss) {
      if (distance(p, ep) > 550 && !lift) firing = false;
      if (p.x < 180 || p.x > 1820) {
        move = p.x < 1000 ? 1 : -1;
        firing = false;
      }
      if (p.y < 200) firing = false;
    }
    // Sustained recoil can keep a rapid build above a covered target forever.
    // Release until landing before trying the next firing angle.
    if (
      g.mods.includes('orbit') &&
      !g.clear &&
      !g.level.boss &&
      g.time - lastProgress > 12 &&
      p.y < 200
    )
      settlingGun = true;
    if (settlingGun) {
      firing = false;
      if (g.grounded || g.clear) settlingGun = false;
    }
    // A charged build must release the trigger long enough to load its rail.
    if (g.mods.includes('rail-spike') && !lift && !g.clear)
      firing &&= g.ballistics.charges > 0 || g.burstRemaining > 0;
    // Use the charge's visible countdown and position: leave its blast area
    // and bat it away with the normal gun when a firing lane is available.
    const bomb = g.sappers.items.find(
      (b) => b.charge!.at - g.time < 1.2 && distance(p, b.body.position) < 180,
    );
    if (bomb) {
      move = Math.sign(p.x - bomb.body.position.x) || 1;
      jump ||= g.grounded;
      if (distance(g.lineEnd(p, bomb.body.position, 0, bomb), bomb.body.position) < 0.1) {
        aim = { ...bomb.body.position };
        firing = true;
      }
    }
    // An imminent crush takes precedence over conserving a shell volley.
    if (train && !g.crossing.blocked && !g.clear && (p.x < 100 || p.x > 1900)) {
      move = p.x < 1000 ? 1 : -1;
      jump ||= g.grounded;
      firing = !g.grounded && g.player.velocity.y > -4;
      if (firing) aim = { x: p.x, y: p.y + 500 };
    }
    if (g.pressure.items.length && !g.clear) {
      const input = ventInput(g);
      move = Number(input.right ?? false) - Number(input.left ?? false);
      jump = !!input.jump;
      firing = !!input.fire;
      aim = input.aim ?? aim;
    }
    // The slow shell gun coasts and dodges while recharging a spent deflection.
    // Rapid builds keep their recoil movement; lifts and urgent bombs take priority.
    if (
      e &&
      g.gun.shellshock &&
      g.mods.includes('countershot') &&
      !g.ballistics.counterReady &&
      !lift &&
      !bomb &&
      !train &&
      !(g.stage >= 12 && !g.level.boss && (p.x < 250 || p.x > 1750)) &&
      !g.clear
    ) {
      const recharge = dodgePilot(g, e, false);
      move = Number(recharge.right) - Number(recharge.left);
      jump = !!recharge.jump;
      firing = false;
      aim = recharge.aim ?? aim;
    }
    // Returning rounds cannot reach the overhead motor from the floor. Treat
    // recoil ascent as a firing option instead of replacing it with boss aim.
    if (firing && e && ['crane', 'press'].includes(e.kind) && g.mods.includes('recall')) {
      const reach = g.gun.projectileSpeed * 60 * (g.mods.includes('vector') ? 0.5 : 0.24) * 0.9;
      if (Math.abs(dx) > reach * 0.45) move = Math.sign(dx);
      if (dy > reach * 0.6) {
        jump ||= g.grounded;
        aim = { x: p.x, y: p.y + 500 };
      }
    }
    if (g.mods.includes('charge-lens')) firing &&= g.torch.chargeProgress < 1;
    if (g.mods.includes('suspension') && !g.mods.includes('tripline')) firing &&= i % 48 < 32;
    // A Lockdown has no target until the player approaches its visible terminal
    // and presses the ordinary interact/jump key. Do not hover toward the exit.
    if (terminal) {
      move = terminalInput.move;
      jump = terminalInput.jump;
      firing = terminalInput.fire;
      if (firing) aim = { x: p.x, y: p.y + 500 };
      if (Math.abs(p.x - g.areaEvents.site.x) < 65) {
        move = 0;
        firing = false;
        jump = distance(p, g.areaEvents.site) < 80;
      }
    }
    tick(g, 1, {
      left: move < 0,
      right: move > 0,
      jump,
      fire: firing,
      aim,
    });
  }
  return { escapeSeen, fusionUsed, tetherUsed, arcUsed, flashUsed, slipUsed, cinderUsed, windUsed };
}
