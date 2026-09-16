import { PressureSystem, type PressureVent } from './pressure.ts';
import { LoaderArenaSystem } from './loader-arena.ts';
import { loadDamageCause, type DamageCause } from './damage-cause.ts';
import { WorkshopSystem, workshopLevel, type WorkshopTarget } from './workshop.ts';
import { workshopBuild, loadDiscoveries } from './workshop-build.ts';
import { MassDriverSystem, MASS_DRIVER, type MassFlight } from './mass-driver.ts';
import { TripwireSystem } from './tripwire.ts';
import { TorchSystem } from './torch.ts';
import { isBranch, BRANCH_STAGE } from './upgrade-branches.ts';
import { GrindshotSystem } from './grindshot.ts';
import { CrossingSystem } from './crossing.ts';
import { MagnetSystem } from './magnets.ts';
import { TetherSystem } from './tethers.ts';
import { SalvageEvolutionSystem } from './salvage-evolutions.ts';
import { BossSalvageSystem } from './boss-salvage.ts';
import { ArcCoilSystem } from './arc-coil.ts';
import { DestructionSystem } from './destruction.ts';
import {
  createAngler,
  updateAngler,
  updateAnglerShot,
  type AnglerRig,
  type AnglerFlight,
} from './angler.ts';
import { createWallcrawler, updateWallcrawler } from './wallcrawler.ts';
import type { CrawlerRig } from './wallcrawler.ts';
import { SapperSystem, createSapper } from './sapper.ts';
import type { SapperRig } from './sapper.ts';
import { getRouteLevel, reinforceRoute } from './route-layouts.ts';
import { getOvertimeLevel, overtimeHealth, overtimeSeed } from './overtime.ts';
import { createSorter, updateReclamationEnemy } from './reclamation.ts';
import type { SorterRig } from './reclamation.ts';
import Matter from 'matter-js';
import { CryogenicSystem } from './cryogenic.ts';
import { StasisSystem, suspended, type StasisFlight } from './stasis.ts';
import { MobilitySystem } from './mobility.ts';
import { GrapnelSystem } from './grapnel.ts';
import { ScrapFeedSystem } from './scrap-feed.ts';
import { pocketBank } from './corner-pocket.ts';
import { recordRoute, routeTarget } from './retrace.ts';
import { prepareVector, steerVector, redirectVector, type VectorFlight } from './vector-rounds.ts';
import { CounterweightSystem } from './counterweights.ts';
import { createInterceptor, updateInterceptor } from './interceptor.ts';
import type { InterceptorRig } from './interceptor.ts';
import { updateRivalAmmo, rivalImpact, clearArsenal } from './interceptor-weapons.ts';
import type { EnemyAmmo } from './interceptor-weapons.ts';
import { createTurbine, updateTurbine } from './turbine.ts';
import type { TurbineRig } from './turbine.ts';
import { EvolutionSystem } from './evolutions.ts';
import { BallisticsSystem } from './ballistics.ts';
import { FusionSystem, RAIL_RECOIL } from './fusions.ts';
import { HarpoonSystem, createHarpooner } from './harpooner.ts';
import type { HarpoonRig } from './harpooner.ts';
import type { RecallFlight } from './ballistics.ts';
import { getDetour, DETOUR_STEPS, DETOUR_DOOR, DETOUR_HEALTH } from './detours.ts';
import { onCoolant, updateCoolingEnemy } from './cooling.ts';
import { DemolitionSystem, SHELL_DIRECT } from './demolition.ts';
import type { ShellPayload } from './demolition.ts';
import { PortalSystem, portalVector } from './portals.ts';
import { firstSolid, sweepBox } from './collisions.ts';
import {
  clamp,
  direction,
  distance,
  seeded,
  rewardMods,
  getGun,
  availableMods,
  STAGES,
  areaIndex,
  ROOM_HEAL,
  REROLL_COST,
  MODS,
  REPAIR_REWARD,
  segmentBox,
  isDetourStage,
  isFusion,
  fusionUnlocked,
  SALVAGE_BOSSES,
  isSalvage,
  isRouteStage,
  dailyRoute,
} from './rules.ts';
import type { Vec, Gun, Mod, Checkpoint, RouteChoice } from './rules.ts';
import { dailyFromSeed } from './daily.ts';
import { getLevel } from './levels.ts';
import type { Level, EnemyKind } from './levels.ts';
import {
  ENEMY_STATS,
  enemyHealth,
  SHIELD_TURN,
  TWIN_TELL,
  TWIN_LOCK,
  VOLATILE_TELL,
  VOLATILE_RADIUS,
  CHARGE_TELL,
  SNIPER_TELL,
  HOP_TELL,
  isBoss,
  bossPhase,
  bossAttack,
  attackTell,
  attackAngles,
} from './enemies.ts';
import type { EnemyState, Attack, EliteKind } from './enemies.ts';
import { PropSystem, traceProp } from './props.ts';
import { CargoSystem } from './cargo.ts';
import { updateSquad, squadGunOrigin, squadLineEnd, breakSquad } from './squads.ts';
import type { SquadTag, SquadMember } from './squads.ts';
import type { Prop } from './props.ts';
import { HazardSystem, CRUMBLE_TELL } from './hazards.ts';
import { ConveyorSystem } from './conveyors.ts';
import { FreightSystem } from './freight.ts';
import { createScrapper, updateScrapper, releaseScrapper } from './scrapper.ts';
import type { ScrapperRig } from './scrapper.ts';
import { FREIGHT } from './freight-layout.ts';
import { BreachSystem } from './breaches.ts';
import { updateLoader, updatePress } from './area-boss-ai.ts';
import { huntBoss, bossHasLane } from './boss-hunt.ts';
import type { BossHunt } from './boss-hunt.ts';
import { createCrane, updateCrane } from './crane-ai.ts';
import type { CraneRig } from './crane-ai.ts';
import { createKiln, updateKiln, clearKiln } from './kiln-ai.ts';
import type { KilnRig } from './kiln-ai.ts';
import { practiceCheckpoint } from './practice.ts';
import type { Encounter } from './practice.ts';
import { ReinforcementSystem } from './reinforcements.ts';
import { recordShotTrace } from './shot-trails.ts';
import type { ShotTrace } from './shot-trails.ts';
import {
  ESCAPE_WIDTH,
  ESCAPE_LAYOUT,
  ESCAPE_PLATFORMS,
  EXTRACTION,
  OVERTIME_LIFT,
  OVERTIME_STEPS,
} from './escape-layout.ts';
export type { EnemyKind } from './levels.ts';
const { Engine, Bodies, Body, Composite, Query } = Matter;
export type Mode = 'title' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won';
export interface Input {
  left: boolean;
  right: boolean;
  move?: number;
  jump: boolean;
  jumpHeld: boolean;
  fire: boolean;
  firePressed?: boolean;
  portal?: Vec;
  aim: Vec;
}
export interface Enemy {
  workshopTarget?: WorkshopTarget;
  id: number;
  body: Matter.Body;
  kind: EnemyKind;
  elite?: EliteKind;
  facing: number;
  shieldFlash: number;
  hp: number;
  maxHp: number;
  timer: number;
  flash: number;
  spawn: number;
  fromDoor?: boolean;
  squad?: SquadMember;
  phase: number;
  aim: Vec;
  state: EnemyState;
  target: Vec;
  attacks: number;
  attack: Attack;
  hunt?: BossHunt;
  crane?: CraneRig;
  kiln?: KilnRig;
  turbine?: TurbineRig;
  interceptor?: InterceptorRig;
  scrapper?: ScrapperRig;
  harpoon?: HarpoonRig;
  sapper?: SapperRig;
  angler?: AnglerRig;
  crawler?: CrawlerRig;
  sorter?: SorterRig;
}
export interface Shot {
  damageCause?: DamageCause;
  id: number;
  launch?: { pos: Vec; at: number };
  pos: Vec;
  prev: Vec;
  vel: Vec;
  damage: number;
  life: number;
  friendly: boolean;
  radius: number;
  bounces: number;
  pierce: number;
  fragment: boolean;
  split: boolean;
  hits: Set<number>;
  banks: number;
  bankGrowth: number;
  charged: boolean;
  trace?: ShotTrace;
  shell?: ShellPayload;
  discharge?: number;
  waypoints?: Vec[];
  blade?: true;
  allyBlock?: number;
  source?: Vec;
  recall?: RecallFlight;
  stasis?: StasisFlight;
  pocketSpent?: boolean;
  feedGeneration?: number;
  counter?: number;
  reflected?: boolean;
  reflectedAt?: number;
  echo?: boolean;
  enemyAmmo?: EnemyAmmo;
  rail?: boolean;
  orbitReleased?: boolean;
  vector?: VectorFlight;
  angler?: AnglerFlight;
  tripwire?: number;
  massDriver?: MassFlight;
  relay?: boolean;
  impactNormal?: Vec;
}
export interface Particle {
  pos: Vec;
  vel: Vec;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'shell';
}
export const WORLD = { width: 2000, height: 840, floor: 740 };
export const EXTRACTION_DURATION = 2.6;
export interface EscapeState {
  phase: 'route' | 'extracting';
  destination?: 'overtime';
  time: number;
  depart: number;
}
export class Game {
  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  player!: Matter.Body;
  level!: Level;
  terrain: Matter.Body[] = [];
  props = new PropSystem(this);
  cargo = new CargoSystem(this);
  loaderArena = new LoaderArenaSystem(this);
  magnets = new MagnetSystem(this);
  hazards = new HazardSystem(this);
  conveyors = new ConveyorSystem(this);
  freight = new FreightSystem(this);
  crossing = new CrossingSystem(this);
  counterweights = new CounterweightSystem(this);
  pressure = new PressureSystem(this);
  massDriver = new MassDriverSystem(this);
  breaches = new BreachSystem(this);
  waves = new ReinforcementSystem(this);
  portals = new PortalSystem(this);
  portalRequest: Vec | null = null;
  demolition = new DemolitionSystem(this);
  evolutions = new EvolutionSystem(this);
  ballistics = new BallisticsSystem(this);
  cryogenic = new CryogenicSystem(this);
  stasis = new StasisSystem(this);
  mobility = new MobilitySystem(this);
  grapnel = new GrapnelSystem(this);
  scrap = new ScrapFeedSystem(this);
  fusions = new FusionSystem(this);
  harpoons = new HarpoonSystem(this);
  destruction = new DestructionSystem(this);
  sappers = new SapperSystem(this);
  tethers = new TetherSystem(this);
  arcs = new ArcCoilSystem(this);
  grind = new GrindshotSystem(this);
  torch = new TorchSystem(this);
  tripwires = new TripwireSystem(this);
  salvage = new BossSalvageSystem(this);
  salvageEvolutions = new SalvageEvolutionSystem(this);
  earnedSalvage: string | null = null;
  escape: EscapeState | null = null;
  extractionLift: Matter.Body | null = null;
  overtimeLift: Matter.Body | null = null;
  get worldWidth() {
    return this.escape ? ESCAPE_WIDTH : WORLD.width;
  }
  get worldTop() {
    return this.level?.freight ? FREIGHT.top : 0;
  }
  get terrainBodies() {
    return [
      ...this.terrain,
      ...this.hazards.bodies,
      ...this.crossing.bodies,
      ...this.counterweights.bodies,
      ...this.breaches.bodies,
      ...this.salvageEvolutions.bodies,
      ...(this.extractionLift ? [this.extractionLift] : []),
      ...(this.overtimeLift ? [this.overtimeLift] : []),
    ];
  }
  get solidBodies() {
    return [...this.terrainBodies, ...this.props.bodies];
  }
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  particles: Particle[] = [];
  trail: Vec[] = [];
  mode: Mode = 'title';
  practice: Encounter | null = null;
  workshop = new WorkshopSystem(this);
  seed = '';
  stage = 0;
  overtime: Checkpoint['overtime'] | null = null;
  missedUpgrades = 0;
  testRun: Checkpoint | null = null;
  detour = false;
  detours: number[] = [];
  enteringDetour = false;
  route: RouteChoice | null = null;
  enteringRoute: RouteChoice | null = null;
  get canChooseRoute() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.escape &&
      !this.detour &&
      isRouteStage(this.stage + 1)
    );
  }
  get routeChoices(): RouteChoice[] {
    return !this.canChooseRoute
      ? []
      : dailyFromSeed(this.seed)
        ? [dailyRoute(this.seed, this.stage + 1)]
        : ['low', 'high'];
  }
  detourStepsReady = false;
  get canDetour() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.overtime &&
      !this.escape &&
      !this.detour &&
      isDetourStage(this.stage) &&
      !this.detours.includes(areaIndex(this.stage))
    );
  }
  get roomSeed() {
    return this.layoutSeed + (this.detour ? ':detour:' + this.stage : '');
  }
  get layoutSeed() {
    return this.overtime ? overtimeSeed(this.seed) : this.seed;
  }
  get canOvertime() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.overtime &&
      !!this.escape &&
      !this.detour &&
      this.stage === STAGES - 1 &&
      !dailyFromSeed(this.seed)
    );
  }
  get canBranch() {
    return this.canDetour || this.routeChoices.length === 2;
  }
  get branchDoor() {
    return {
      ...DETOUR_DOOR,
      floor: this.level.freight ? FREIGHT.dock - 180 : DETOUR_DOOR.floor,
    };
  }
  get branchSteps() {
    return DETOUR_STEPS.map((s, i) => ({
      ...s,
      y: this.level.freight ? FREIGHT.dock - (i + 1) * 90 : s.y,
    }));
  }
  hp = 100;
  deathCause: DamageCause | null = null;
  mods: string[] = [];
  legacyMods?: string[];
  legacyOffers?: string[];
  gun: Gun = getGun([]);
  elapsed = 0;
  time = 0;
  kills = 0;
  shotCount = 0;
  id = 0;
  grounded = false;
  clear = false;
  clearAt = 0;
  aim: Vec = { x: 650, y: 550 };
  shootAt = 0;
  hurtAt = -100;
  jumpAt = -100;
  lastShot = -100;
  coyote = 0;
  jumpBuffer = 0;
  fireBuffer = 0;
  jumpCut = false;
  shake = 0;
  kick: Vec = { x: 0, y: 0 };
  hitStop = 0;
  muzzle = 0;
  land = 0;
  landingSpeed = 0;
  landingReady = false;
  chargedFlash = false;
  burstRemaining = 0;
  breachAt = -1;
  breachClears = 0;
  burstAt = 0;
  blast = { pos: { x: 0, y: 0 }, dir: { x: -1, y: 0 }, life: 0 };
  offers: Mod[] = [];
  rng = seeded('run');
  rewardTaken = false;
  rewardRerolled = false;
  onChange: () => void = () => {};
  onSound: (kind: string) => void = () => {};
  onHaptic: (kind: 'shot' | 'land' | 'hurt', strength: number) => void = () => {};
  onCheckpoint: (save: Checkpoint | null) => void = () => {};
  onBossDefeated: (kind: EnemyKind) => void = () => {};
  constructor() {
    Matter.Events.on(this.engine, 'beforeSolve', () => {
      this.counterweights.afterIntegrate();
      this.portals.afterIntegrate();
      this.sappers.afterIntegrate();
    });
    this.loadRoom();
  }
  setMode(mode: Mode) {
    if (mode !== 'playing') {
      this.stasis.held = false;
      this.mobility.pause();
      this.burstRemaining = 0;
      this.portalRequest = null;
      if (this.mods.includes('charge-lens')) this.torch.stop();
    }
    if (mode === 'dead' || mode === 'won' || mode === 'title') {
      this.loaderArena.stop();
      this.massDriver.reset();
      this.arcs.reset();
      this.grind.reset();
      this.torch.reset();
      this.tripwires.reset();
      this.salvage.reset();
      this.salvageEvolutions.reset();
      this.tethers.reset();
      this.sappers.clear();
      for (const prop of [...this.props.items]) if (prop.kind === 'rubble') this.props.remove(prop);
      for (const e of this.enemies) {
        releaseScrapper(this, e);
        clearArsenal(this, e);
      }
      this.demolition.clear();
      this.evolutions.reset();
      this.ballistics.reset();
      this.cryogenic.reset();
      this.stasis.reset();
      this.mobility.reset();
      this.grapnel.reset();
      this.scrap.reset();
      this.fusions.reset();
      this.harpoons.clear();
    }
    this.mode = mode;
    this.onChange();
  }
  startPractice(encounter: Encounter) {
    const save = practiceCheckpoint(encounter);
    if (!save) return false;
    this.start(save.seed, save, { ...encounter });
    return true;
  }
  startWorkshop(discovered: readonly string[], mods: readonly string[] = []) {
    this.workshop.discovered = loadDiscoveries(discovered);
    const build = workshopBuild(mods, this.workshop.discovered);
    this.start(
      'WORKSHOP',
      { version: 5, seed: 'WORKSHOP', stage: 0, hp: 100, mods: build, kills: 0, elapsed: 0 },
      null,
      null,
      true,
    );
  }
  startTest(save: Checkpoint) {
    this.start(save.seed, save, null, save);
    if (save.seed === 'EXITS-73' && this.escape) {
      Body.setPosition(this.player, { x: 6600, y: 722 });
      Body.setVelocity(this.player, { x: 0, y: 0 });
    }
    const match = /^SAW-BOSS-53-([123])-/.exec(save.seed);
    const boss = this.enemies.find((e) => e.kind === 'interceptor');
    if (match && boss) {
      boss.phase = Number(match[1]) - 1;
      // Keep full health so the focused test has time to demonstrate its attack.
    }
  }
  start(
    seed: string,
    save?: Checkpoint,
    practice: Encounter | null = null,
    testRun: Checkpoint | null = null,
    workshop = false,
  ) {
    this.workshop.active = workshop;
    this.practice = practice;
    this.testRun = testRun ? structuredClone(testRun) : null;
    this.seed = seed.slice(0, 40) || 'RECOIL';
    this.stage = save?.stage ?? 0;
    this.overtime = !practice && save?.overtime ? { ...save.overtime } : null;
    this.missedUpgrades = save?.missedUpgrades ?? 0;
    this.detour = !practice && save?.detour === true;
    this.detours = !practice ? [...(save?.detours ?? [])] : [];
    this.route =
      !practice && !this.detour && !save?.escape && isRouteStage(this.stage)
        ? dailyFromSeed(this.seed)
          ? dailyRoute(this.seed, this.stage)
          : (save?.route ?? null)
        : null;
    this.hp = save?.hp ?? 100;
    this.deathCause = null;
    this.mods = save ? [...save.mods] : [];
    this.legacyMods = save?.legacyMods ? [...save.legacyMods] : undefined;
    this.legacyOffers = save?.legacyOffers ? [...save.legacyOffers] : undefined;
    this.gun = getGun(this.mods);
    this.elapsed = save?.elapsed ?? 0;
    this.kills = save?.kills ?? 0;
    this.time = 0;
    this.shotCount = 0;
    this.shootAt = 0;
    this.hurtAt = -100;
    this.lastShot = -100;
    this.offers = [];
    this.loadRoom(save?.escape === true, !!save?.reward);
    if (save?.reward) {
      this.offers = save.reward.offers.map((id) =>
        id === 'repair' ? REPAIR_REWARD : MODS.find((m) => m.id === id)!,
      );
      this.rewardRerolled = save.reward.rerolled;
      this.earnedSalvage = save.reward.salvage ?? null;
      this.enteringDetour = save.reward.enteringDetour === true;
      this.enteringRoute = save.reward.enteringRoute ?? null;
    }
    this.setMode(save?.reward ? 'upgrade' : 'playing');
    this.save();
  }
  save() {
    if (this.practice || this.testRun || this.workshop.active) return;
    this.onCheckpoint({
      version: 6,
      ...(this.legacyMods ? { legacyMods: [...this.legacyMods] } : {}),
      ...(this.legacyOffers ? { legacyOffers: [...this.legacyOffers] } : {}),
      seed: this.seed,
      stage: this.stage,
      hp: this.hp,
      mods: [...this.mods],
      kills: this.kills,
      elapsed: this.elapsed,
      ...(this.missedUpgrades ? { missedUpgrades: this.missedUpgrades } : {}),
      ...(this.escape ? { escape: true as const } : {}),
      ...(this.detour ? { detour: true as const } : {}),
      ...(this.detours.length ? { detours: [...this.detours] } : {}),
      ...(this.overtime ? { overtime: { ...this.overtime } } : {}),
      ...(this.route ? { route: this.route } : {}),
      ...(this.mode === 'upgrade' && !this.rewardTaken
        ? {
            reward: {
              offers: this.offers.map((m) => m.id),
              rerolled: this.rewardRerolled,
              ...(this.earnedSalvage ? { salvage: this.earnedSalvage } : {}),
              ...(this.enteringDetour ? { enteringDetour: true as const } : {}),
              ...(this.enteringRoute ? { enteringRoute: this.enteringRoute } : {}),
            },
          }
        : {}),
    });
  }
  loadRoom(escapeRoom = false, clearedRoom = false) {
    this.breachAt = -1;
    this.breachClears = 0;
    this.massDriver.reset();
    this.earnedSalvage = null;
    this.arcs.reset();
    this.grind.reset();
    this.torch.reset();
    this.tripwires.reset();
    this.salvage.reset();
    this.salvageEvolutions.reset();
    this.tethers.reset();
    this.sappers.clear();
    this.destruction.clear();
    this.loaderArena.clear();
    this.enteringDetour = false;
    this.enteringRoute = null;
    this.detourStepsReady = false;
    this.evolutions.reset();
    this.ballistics.reset();
    this.cryogenic.reset();
    this.stasis.reset();
    this.mobility.reset();
    this.grapnel.reset();
    this.scrap.reset();
    this.fusions.reset();
    this.harpoons.clear();
    this.magnets.items = [];
    this.conveyors.clear();
    this.freight.clear();
    this.crossing.clear();
    this.counterweights.clear();
    this.pressure.clear();
    this.portals.reset();
    this.demolition.clear();
    this.portalRequest = null;
    for (const enemy of this.enemies) clearKiln(enemy);
    Composite.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.escape = escapeRoom ? { phase: 'route', time: 0, depart: 0 } : null;
    this.extractionLift = null;
    this.overtimeLift = null;
    this.breaches.clear();
    this.terrain = [];
    this.enemies = [];
    this.shots = [];
    this.particles = [];
    this.trail = [];
    this.clear = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fireBuffer = 0;
    this.jumpCut = false;
    this.jumpAt = -100;
    this.grounded = false;
    this.rewardTaken = false;
    this.rewardRerolled = false;
    this.offers = [];
    this.shake = 0;
    this.kick = { x: 0, y: 0 };
    this.hitStop = 0;
    this.muzzle = 0;
    this.land = 0;
    this.landingSpeed = 0;
    this.landingReady = false;
    this.chargedFlash = false;
    this.burstRemaining = 0;
    this.burstAt = 0;
    this.blast.life = 0;
    this.shootAt = this.time;
    this.rng = seeded(this.roomSeed + ':' + this.stage);
    const wall = (x: number, y: number, w: number, h: number) => {
      const b = Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0, label: 'terrain' });
      this.terrain.push(b);
      Composite.add(this.engine.world, b);
    };
    this.level = this.workshop.active
      ? workshopLevel()
      : escapeRoom
        ? {
            ...ESCAPE_LAYOUT,
            solids: ESCAPE_LAYOUT.solids.map((s) => ({ ...s })),
            route: ESCAPE_LAYOUT.route.map((p) => ({ ...p })),
            spawns: [],
          }
        : this.detour
          ? getDetour(this.seed, this.stage)
          : this.overtime
            ? getOvertimeLevel(this.seed, this.stage)
            : getLevel(
                this.seed,
                this.stage,
                this.practice?.kind === 'condenser' ? 'condenser' : undefined,
                this.practice?.kind === 'boss' || this.practice?.kind === 'sorter'
                  ? this.practice.kind
                  : undefined,
              );
    if (this.route && !escapeRoom && !this.detour) {
      this.level = getRouteLevel(this.layoutSeed, this.stage, this.route);
      if (this.overtime) this.level = reinforceRoute(this.level, this.seed, this.stage);
    }
    if (this.canOvertime) this.level.solids.push(...OVERTIME_STEPS.map((s) => ({ ...s })));
    wall(this.worldWidth / 2, 790, this.worldWidth, 100);
    wall(-30, (this.worldTop + 800) / 2, 60, 900 - this.worldTop);
    wall(this.worldWidth + 30, (this.worldTop + 800) / 2, 60, 900 - this.worldTop);
    wall(this.worldWidth / 2, this.worldTop - 40, this.worldWidth, 80);
    for (const solid of this.level.solids)
      wall(solid.x + solid.w / 2, solid.y + solid.h / 2, solid.w, solid.h);
    this.player = Bodies.rectangle(140, 680, 26, 36, {
      inertia: Infinity,
      friction: 0,
      frictionAir: 0.008,
      restitution: 0,
      chamfer: { radius: 4 },
      label: 'player',
    });
    Composite.add(this.engine.world, this.player);
    this.counterweights.reset();
    if (clearedRoom) {
      this.waves.clear();
      this.clear = true;
      this.clearAt = this.time;
    } else {
      for (const spawn of this.waves.reset(this.level))
        this.spawnEnemy(spawn.kind, spawn.x, spawn.y, spawn.elite);
    }
    if (escapeRoom) {
      this.hazards.clear();
      for (const placement of ESCAPE_PLATFORMS) this.hazards.spawn(placement).permanent = true;
      this.props.items = [];
      this.props.impacts = [];
      this.clear = true;
      this.clearAt = this.time;
      const { x, y, w, h } = EXTRACTION;
      this.extractionLift = Bodies.rectangle(x, y + h / 2, w, h, {
        isStatic: true,
        friction: 0,
        label: 'extraction',
      });
      Composite.add(this.engine.world, this.extractionLift);
      if (this.canOvertime) {
        const { x, y, w, h } = OVERTIME_LIFT;
        this.overtimeLift = Bodies.rectangle(x, y + h / 2, w, h, {
          isStatic: true,
          friction: 0,
          label: 'new-game-plus',
        });
        Composite.add(this.engine.world, this.overtimeLift);
      }
    } else if (this.level.freight) {
      this.freight.reset();
    } else {
      this.hazards.reset(this.level, this.roomSeed, this.stage);
      if (!this.detour) this.breaches.reset(this.level, this.layoutSeed, this.stage);
      this.props.reset(this.level);
      this.cargo.reset();
      this.conveyors.reset();
      this.magnets.reset();
    }
    this.crossing.reset();
    this.destruction.reset();
    this.loaderArena.reset();
    this.pressure.reset();
    this.workshop.reset();
  }
  startEscape() {
    if (this.practice || this.detour || this.workshop.active) return;
    if (this.escape || this.stage !== STAGES - 1 || !this.clear || this.mode !== 'playing') return;
    this.loadRoom(true);
    this.save();
    this.onSound('evacuate');
    this.onChange();
  }
  startOvertime() {
    if (
      !this.canOvertime ||
      this.escape?.phase !== 'extracting' ||
      this.escape.destination !== 'overtime' ||
      this.escape.depart < EXTRACTION_DURATION ||
      !this.clear ||
      this.enemies.length ||
      this.waves.pending ||
      this.mode !== 'playing'
    )
      return false;
    this.overtime = { baseMods: this.mods.length, repairs: 0 };
    this.stage = 0;
    this.route = null;
    this.loadRoom();
    this.save();
    this.onSound('evacuate');
    this.onChange();
    return true;
  }
  extendDetourSteps() {
    if (!this.clear || !this.canBranch || this.detourStepsReady) return;
    // Never materialize a step through the player or a loose prop.
    for (const s of this.branchSteps)
      if (
        Query.region([this.player, ...this.props.bodies], {
          min: { x: s.x - 1, y: s.y - 1 },
          max: { x: s.x + s.w + 1, y: s.y + s.h + 1 },
        }).length
      )
        return;
    for (const s of this.branchSteps) {
      const body = Bodies.rectangle(s.x + s.w / 2, s.y + s.h / 2, s.w, s.h, {
        isStatic: true,
        friction: 0,
        label: 'detour-step',
      });
      this.terrain.push(body);
      Composite.add(this.engine.world, body);
    }
    this.detourStepsReady = true;
  }
  updateEscape(dt: number) {
    const escape = this.escape;
    if (!escape) return;
    const before = escape.time;
    escape.time += dt;
    if (Math.floor(before / 2.8) !== Math.floor(escape.time / 2.8)) {
      this.feedback(1.6);
      this.onSound('collapse');
      this.burst({ x: Math.max(180, this.player.position.x - 180), y: 350 }, 12, '#ba9872', 2);
    }
    for (const h of this.hazards.items) {
      if (
        h.kind === 'crumble' &&
        h.state === 'idle' &&
        h.placement.x < this.player.position.x - 100
      ) {
        h.state = 'warning';
        h.timer = CRUMBLE_TELL;
      }
    }
  }
  boardExtraction() {
    if (this.escape?.phase !== 'route' || !this.extractionLift) return;
    const p = this.player;
    const supported = (body: Matter.Body, lift: typeof EXTRACTION) =>
      this.hazards.supported(p, body) &&
      p.bounds.min.x >= lift.x - lift.w / 2 + 8 &&
      p.bounds.max.x <= lift.x + lift.w / 2 - 8;
    const overtime =
      this.canOvertime && this.overtimeLift && supported(this.overtimeLift, OVERTIME_LIFT);
    if (!overtime && !supported(this.extractionLift, EXTRACTION)) return;
    const lift = overtime ? OVERTIME_LIFT : EXTRACTION;
    if (overtime) this.escape.destination = 'overtime';
    this.escape.phase = 'extracting';
    this.arcs.reset();
    this.grind.reset();
    this.torch.reset();
    this.tripwires.reset();
    this.salvage.reset();
    this.salvageEvolutions.reset();
    this.tethers.reset();
    this.evolutions.reset();
    this.ballistics.reset();
    this.cryogenic.reset();
    this.stasis.reset();
    this.mobility.reset();
    this.grapnel.reset();
    this.scrap.reset();
    this.fusions.reset();
    this.harpoons.clear();
    this.demolition.clear();
    this.escape.depart = 0;
    this.shots = [];
    this.trail = [];
    this.particles = [];
    this.burstRemaining = 0;
    this.fireBuffer = this.jumpBuffer = 0;
    this.blast.life = this.muzzle = this.hitStop = 0;
    Body.setVelocity(p, { x: 0, y: 0 });
    Body.setPosition(p, { x: lift.x, y: lift.y - 18 });
    this.grounded = true;
    this.onSound('extract');
    this.onChange();
  }
  updateExtraction(dt: number) {
    if (!this.escape || !this.extractionLift) return;
    const overtime = this.escape.destination === 'overtime';
    const lift = overtime ? OVERTIME_LIFT : EXTRACTION;
    const body = overtime ? this.overtimeLift : this.extractionLift;
    if (!body) return;
    this.time += dt;
    this.escape.time += dt;
    this.escape.depart = Math.min(EXTRACTION_DURATION, this.escape.depart + dt);
    const t = this.escape.depart / EXTRACTION_DURATION;
    const top = lift.y - t * t * (3 - 2 * t) * (lift.y - 120);
    Body.setPosition(body, { x: lift.x, y: top + lift.h / 2 });
    Body.setPosition(this.player, { x: lift.x, y: top - 18 });
    Body.setVelocity(this.player, { x: 0, y: 0 });
    this.shake *= 0.8;
    this.kick.x *= 0.72;
    this.kick.y *= 0.72;
    if (t >= 1) {
      if (overtime) {
        this.startOvertime();
        return;
      }
      this.setMode('won');
      if (!this.testRun) this.onCheckpoint(null);
      this.onSound('win');
    }
  }
  spawnEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    elite?: EliteKind,
    attackDelay?: number,
    squad?: SquadTag,
  ) {
    if (this.enemies.length >= 14) return;
    const { w, h } = ENEMY_STATS[kind];
    const hp = Math.ceil(
      (this.overtime
        ? overtimeHealth(kind, this.stage, elite)
        : enemyHealth(kind, this.stage, elite)) *
        (this.detour && !isBoss(kind) ? DETOUR_HEALTH : 1),
    );
    const body =
      kind === 'flyer' || kind === 'wallcrawler'
        ? Bodies.circle(x, y, kind === 'wallcrawler' ? 14 : 19, {
            frictionAir: 0.035,
            inertia: Infinity,
            label: 'enemy',
          })
        : Bodies.rectangle(x, y, w, h, {
            friction: 0.05,
            frictionAir: kind === 'hopper' ? 0.008 : 0.03,
            inertia: Infinity,
            chamfer: { radius: 3 },
            label: 'enemy',
          });
    if (
      (kind === 'shooter' || kind === 'sniper' || kind === 'crane') &&
      !this.counterweights.movingPerch(body)
    )
      Body.setStatic(body, true);
    if (squad?.kind === 'shield' && squad.role === 'support') Body.setStatic(body, false);
    Composite.add(this.engine.world, body);
    const enemy: Enemy = {
      id: ++this.id,
      body,
      kind,
      elite,
      ...(squad ? { squad: { ...squad, connected: false, side: 0, planAt: 0, jumpAt: 0 } } : {}),
      facing: Math.sign(this.player.position.x - x) || -1,
      shieldFlash: 0,
      hp,
      maxHp: hp,
      timer: attackDelay ?? (isBoss(kind) ? 0.55 : 1.1 + this.rng()),
      flash: 0,
      spawn: 0.65,
      phase: this.overtime && isBoss(kind) ? 1 : 0,
      aim: { x: -1, y: 0 },
      state: 'idle',
      target: { x, y },
      attacks: 0,
      attack: 'aimed',
    };
    this.enemies.push(enemy);
    if (kind === 'crane') enemy.crane = createCrane(this, enemy);
    if (kind === 'kiln') enemy.kiln = createKiln();
    if (kind === 'turbine') enemy.turbine = createTurbine();
    if (kind === 'interceptor') enemy.interceptor = createInterceptor();
    if (kind === 'interceptor' && this.overtime) enemy.attacks = 2;
    if (kind === 'sorter') enemy.sorter = createSorter();
    if (kind === 'scrapper') enemy.scrapper = createScrapper();
    if (kind === 'angler') enemy.angler = createAngler();
    if (kind === 'sapper') enemy.sapper = createSapper();
    if (kind === 'wallcrawler') enemy.crawler = createWallcrawler(this, enemy);
    if (kind === 'harpooner') {
      enemy.harpoon = createHarpooner();
      Body.setMass(body, this.player.mass * 1.6);
    }
    this.destruction.releaseUnsupported();
  }
  feedback(amount: number, dir: Vec = { x: 0, y: 0 }) {
    this.shake = Math.min(12, this.shake + amount);
    this.kick.x = clamp(this.kick.x - dir.x * amount * 0.65, -10, 10);
    this.kick.y = clamp(this.kick.y - dir.y * amount * 0.65, -10, 10);
  }
  tick(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    if (this.escape?.phase === 'extracting') {
      this.updateExtraction(dt);
      return;
    }
    this.shake *= 0.8;
    this.kick.x *= 0.72;
    this.kick.y *= 0.72;
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.land = Math.max(0, this.land - dt);
    // Keep jump taps through the tiny impact pause.
    if (input.jump) this.jumpBuffer = 0.12;
    if (input.firePressed) this.fireBuffer = 0.12;
    if (input.portal) this.portalRequest = { ...input.portal };
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    this.massDriver.beforeStep(dt);
    this.time += dt;
    this.elapsed += dt;
    this.blast.life = Math.max(0, this.blast.life - dt);
    this.aim = { ...input.aim };
    this.cryogenic.update(dt);
    this.stasis.input(input.fire);
    this.ballistics.charge(dt, input.fire || !!input.firePressed || this.fireBuffer > 0);
    if (this.portalRequest) {
      this.portals.place(this.portalRequest);
      this.portalRequest = null;
    }
    this.updateEscape(dt);
    this.freight.beforeStep(dt);
    this.crossing.beginStep(dt);
    this.hazards.beforeStep(dt);
    this.demolition.update();
    if (this.mode !== 'playing') return;
    this.tripwires.beforeStep();
    const wasGrounded = this.grounded,
      vy = this.player.velocity.y;
    const counterweightSupport = this.counterweights.supporting(this.player);
    this.grounded =
      !!counterweightSupport ||
      (vy >= -1 &&
        Query.ray(
          this.solidBodies,
          { x: this.player.position.x, y: this.player.bounds.max.y - 2 },
          { x: this.player.position.x, y: this.player.bounds.max.y + 5 },
          18,
        ).length > 0);
    if (this.grounded && !wasGrounded) {
      const impact = Math.max(vy, this.landingSpeed);
      if (impact > 2) {
        this.land = 0.13;
        this.feedback(Math.min(3, impact * 0.15));
        this.burst({ x: this.player.position.x, y: this.player.bounds.max.y }, 8, '#697477', 2);
        this.onSound('land');
        if (impact >= 7) this.onHaptic('land', Math.min(1, impact / 18));
      }
      if (this.gun.landing && impact >= 7 && !this.landingReady) {
        this.landingReady = true;
        this.burst(this.player.position, 7, '#d7ebac', 2.5);
        this.onSound('loaded');
      }
      this.landingSpeed = 0;
    }
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.fireBuffer = Math.max(0, this.fireBuffer - dt);
    this.conveyors.beginStep();
    const move =
        typeof input.move === 'number' && Number.isFinite(input.move)
          ? clamp(input.move, -1, 1)
          : Number(input.right) - Number(input.left),
      max = 7.3 * this.gun.speed;
    let vx = this.player.velocity.x;
    // Steering never clamps a recoil boost back to walking speed.
    if (move && (Math.sign(vx) !== Math.sign(move) || Math.abs(vx) < max * Math.abs(move)))
      vx += move * (this.grounded ? 1.05 : 0.42) * this.gun.speed;
    // Ease a walking pace down with the stick, without eating an airborne recoil boost.
    if (
      this.grounded &&
      move &&
      Math.abs(move) < 1 &&
      Math.sign(vx) === Math.sign(move) &&
      Math.abs(vx) <= max &&
      Math.abs(vx) > max * Math.abs(move)
    )
      vx += (max * move - vx) * 0.18;
    if (this.grounded && !move) vx *= onCoolant(this) ? 0.965 : 0.72;
    Body.setVelocity(this.player, { x: clamp(vx, -23, 23), y: clamp(vy, -21, 20) });
    this.grapnel.input();
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      Body.setVelocity(this.player, {
        x: this.player.velocity.x,
        y: -11.6 + Math.min(0, counterweightSupport?.velocity.y ?? 0),
      });
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumpAt = this.time;
      this.jumpCut = false;
      this.onSound('jump');
      this.burst({ x: this.player.position.x, y: this.player.bounds.max.y }, 7, '#818d90', 1.8);
    }
    if (
      !input.jumpHeld &&
      !this.jumpCut &&
      this.time - this.jumpAt >= 0 &&
      this.time - this.jumpAt < 0.25 &&
      this.player.velocity.y < -3
    ) {
      // A shot takes ownership of flight; releasing jump must not erase its impulse.
      if (this.lastShot < this.jumpAt)
        Body.setVelocity(this.player, {
          x: this.player.velocity.x,
          y: this.player.velocity.y * 0.55,
        });
      this.jumpCut = true;
    }
    this.mobility.update(input);
    if (this.torch.equipped) {
      this.torch.beforeStep(
        dt,
        input.fire || (!this.mods.includes('charge-lens') && this.fireBuffer > 0),
      );
      this.fireBuffer = 0;
    } else if (this.burstRemaining > 0 && this.time >= this.burstAt) {
      this.burstRemaining--;
      this.burstAt = this.time + this.gun.interval * 0.3;
      this.fireRound();
    } else if (
      (input.fire || this.fireBuffer > 0) &&
      this.time >= this.shootAt &&
      this.burstRemaining === 0
    ) {
      this.fire();
      this.fireBuffer = 0;
    }
    this.loaderArena.update();
    for (const e of [...this.enemies]) {
      const slow = this.cryogenic.slow(e);
      this.updateEnemy(e, dt * slow);
      if (slow < 1 && !e.body.isStatic && e.spawn <= 0)
        Body.setVelocity(e.body, {
          x: e.body.velocity.x * slow,
          y: e.kind === 'flyer' ? e.body.velocity.y * slow : e.body.velocity.y,
        });
      if (this.mode !== 'playing') return;
    }
    // Capture descent before Matter resolves the landing collision and zeros velocity.
    if (!this.grounded) this.landingSpeed = this.player.velocity.y;
    this.cargo.update(dt);
    this.conveyors.beforeStep();
    this.magnets.update();
    this.fusions.beforeStep(dt);
    this.harpoons.beforeStep(dt);
    this.tethers.beforeStep(dt);
    this.grapnel.beforeStep();
    this.salvage.beforeStep(dt);
    if (this.mode !== 'playing') return;
    this.salvageEvolutions.beforeStep();
    this.crossing.beforeStep(dt);
    if (this.mode !== 'playing') return;
    this.pressure.beforeStep(dt);
    this.props.beforeStep();
    this.sappers.beforeStep();
    this.destruction.beforeStep();
    this.portals.beforeStep();
    this.counterweights.beforeStep();
    Engine.update(this.engine, 1000 / 60);
    this.counterweights.afterStep();
    this.salvage.afterStep();
    this.salvageEvolutions.afterStep();
    if (this.mode !== 'playing') return;
    this.conveyors.afterStep();
    this.props.afterStep(dt);
    if (this.mode !== 'playing') return;
    this.destruction.afterStep(dt);
    this.sappers.afterStep();
    if (this.mode !== 'playing') return;
    this.tethers.afterStep();
    if (this.mode !== 'playing') return;
    this.hazards.afterStep(dt);
    this.containPlayer();
    this.harpoons.afterStep(dt);
    if (this.mode !== 'playing') return;
    this.ballistics.update();
    if (this.mode !== 'playing') return;
    this.updateShots(dt);
    this.torch.afterStep(dt);
    this.tripwires.afterStep();
    this.fusions.storm.afterStep();
    if (this.mode !== 'playing') return;
    this.arcs.update();
    this.grind.update(dt);
    if (this.mode !== 'playing') return;
    this.breaches.update(dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.pos.x += p.vel.x * dt * 60;
      p.pos.y += p.vel.y * dt * 60;
      p.vel.y += p.kind === 'shell' ? 0.15 : 0.035;
      return p.life > 0;
    });
    this.trail.unshift({ ...this.player.position });
    if (this.trail.length > 9) this.trail.pop();
    if (this.player.position.y > 900 || !Number.isFinite(this.player.position.x)) {
      this.hp = 0;
      this.die({ type: 'fall' });
      return;
    }
    if (this.escape) {
      this.boardExtraction();
      return;
    }
    if (this.workshop.active) {
      this.workshop.update(dt);
      return;
    }
    this.waves.update(dt);
    if (
      !this.enemies.length &&
      !this.waves.pending &&
      !this.clear &&
      (!this.freight.active || this.freight.arrived)
    ) {
      this.clear = true;
      this.clearAt = this.time;
      this.arcs.reset();
      this.grind.reset();
      this.torch.reset();
      this.tripwires.reset();
      this.salvage.reset();
      this.salvageEvolutions.reset();
      this.tethers.reset();
      this.sappers.clear();
      this.shots = this.shots.filter((s) => s.friendly);
      this.onSound('clear');
      this.onChange();
    }
    if (this.practice && this.clear) {
      this.setMode('won');
      return;
    }
    this.extendDetourSteps();
    if (
      this.clear &&
      this.canBranch &&
      this.time - this.clearAt > 0.4 &&
      this.grounded &&
      this.player.position.x > this.branchDoor.x - 24 &&
      this.player.position.x < this.branchDoor.x + 40 &&
      Math.abs(this.player.position.y - (this.branchDoor.floor - 18)) < 8
    ) {
      if (this.canChooseRoute) this.openReward(false, 'high');
      else this.openReward(true);
      return;
    }
    if (
      this.clear &&
      this.time - this.clearAt > 0.4 &&
      this.player.position.x > 1870 &&
      this.player.position.y > (this.level.freight ? FREIGHT.dock - 70 : 590) &&
      (!this.level.freight || this.player.position.y < FREIGHT.dock)
    ) {
      if (this.stage === STAGES - 1) {
        this.startEscape();
      } else this.openReward();
    }
  }
  containPlayer() {
    const p = this.player.position,
      v = this.player.velocity;
    // Matter's broad-phase bounds include velocity; use the actual hull extents here.
    const halfW = Math.max(...this.player.vertices.map((v) => Math.abs(v.x - p.x))),
      halfH = Math.max(...this.player.vertices.map((v) => Math.abs(v.y - p.y)));
    const x = clamp(p.x, halfW, this.worldWidth - halfW),
      y = clamp(p.y, this.worldTop + halfH, WORLD.floor - halfH);
    if (x === p.x && y === p.y) return;
    // Keep tangential momentum when a boosted shot hits an arena boundary.
    const vx = x !== p.x && ((p.x < x && v.x < 0) || (p.x > x && v.x > 0)) ? 0 : v.x;
    const vy = y !== p.y && ((p.y < y && v.y < 0) || (p.y > y && v.y > 0)) ? 0 : v.y;
    Body.setPosition(this.player, { x, y });
    Body.setVelocity(this.player, { x: vx, y: vy });
  }
  fire() {
    if (this.escape?.phase === 'extracting') return;
    if (this.burstRemaining > 0) return;
    this.shootAt = this.time + this.gun.interval * (this.gun.burstCount === 3 ? 3.1 : 1);
    this.burstRemaining = this.gun.burstCount - 1;
    this.burstAt = this.time + this.gun.interval * 0.3;
    this.fireRound();
  }
  fireRound() {
    if (this.torch.equipped) {
      this.torch.beforeStep(1 / 60, true);
      this.torch.afterStep(1 / 60);
      return;
    }
    const charged = this.gun.landing && this.landingReady;
    const capacitor = this.ballistics.discharge();
    const rail = capacitor && this.fusions.has('rail-spike');
    const beforeVolley = this.id;
    const origin = { x: this.player.position.x, y: this.player.position.y - 3 };
    this.landingReady = false;
    this.chargedFlash = charged || this.evolutions.slingReady || capacitor;
    this.lastShot = this.time;
    this.shotCount++;
    // Snapshot movement and earned charges before this discharge applies recoil.
    const evolutionDamage = this.evolutions.discharge(this.shotCount);
    this.muzzle = 0.065;
    const d = direction(this.player.position, this.aim);
    if (d.x === 0 && d.y === 0) d.x = 1;
    const impulse =
      this.gun.recoil *
      this.mobility.shot(d) *
      (this.grounded ? 0.21 : 1) *
      (charged ? 1.25 : 1) *
      (rail ? RAIL_RECOIL : 1);
    Body.setVelocity(this.player, {
      x: clamp(this.player.velocity.x - d.x * impulse, -23, 23),
      y: clamp(this.player.velocity.y - d.y * impulse, -21, 20),
    });
    this.salvage.launch(d, impulse);
    this.onHaptic('shot', Math.min(1, 0.3 + impulse / 12));
    this.feedback(
      (this.grounded ? 2.2 : 3.8) *
        (charged ? 1.3 : 1) *
        (rail ? 1.5 : this.massDriver.equipped ? 1.35 : 1),
      d,
    );
    this.onSound(
      this.massDriver.equipped
        ? 'mass-shot'
        : this.chargedFlash
          ? 'charged'
          : this.gun.shellshock
            ? 'shell-shot'
            : this.mods.includes('magnum')
              ? 'heavy'
              : this.mods.includes('scatter')
                ? 'scatter'
                : 'shot',
    );
    const damage =
      this.gun.damage *
      (this.grounded ? 1 : this.gun.airDamage) *
      (charged ? 2 : 1) *
      (capacitor ? 2 : 1) *
      evolutionDamage;
    this.scrap.fire(d);
    if (rail) {
      this.fusions.fireRail(d, damage);
      if (this.gun.rearVolley) this.fusions.fireRail({ x: -d.x, y: -d.y }, damage);
    } else {
      this.fireVolley(d, damage, this.chargedFlash);
      // Recoil belongs to the aimed shot; Backfire never cancels movement.
      if (this.gun.rearVolley)
        this.fireVolley({ x: -d.x, y: -d.y }, damage, this.chargedFlash, false);
    }
    this.ballistics.record(beforeVolley, origin, d);
    if (!this.stasis.held && !this.mods.includes('tripline'))
      this.stasis.release(this.shots.filter((s) => s.id > beforeVolley));
    this.fusions.release(d);
    if (this.gun.backblast) this.fireBackblast(d, damage * this.gun.pellets * this.gun.lanes * 0.8);
    this.evolutions.settle();
    if (this.particles.length < 220)
      this.particles.push({
        pos: { ...this.player.position },
        vel: { x: -d.x * 2 + (this.rng() - 0.5), y: -2.8 },
        life: 0.6,
        max: 0.6,
        size: 2,
        color: '#bdae84',
        kind: 'shell',
      });
  }
  fireVolley(d: Vec, damage: number, charged: boolean, primary = true) {
    const pos = { x: this.player.position.x + d.x * 26, y: this.player.position.y - 3 + d.y * 26 };
    const radius = this.massDriver.equipped
      ? MASS_DRIVER.radius
      : this.mods.includes('magnum')
        ? 4
        : 2.5;
    const spawn = this.lineEnd(
      { x: this.player.position.x, y: this.player.position.y - 3 },
      pos,
      radius,
    );
    const valveOrigin = { x: this.player.position.x, y: this.player.position.y - 3 };
    if (this.pressure.trace(valveOrigin, spawn, radius)) Object.assign(spawn, valveOrigin);
    if (distance(spawn, pos) > 0.01) {
      spawn.x -= d.x * 0.5;
      spawn.y -= d.y * 0.5;
    }
    for (let lane = 0; lane < this.gun.lanes; lane++)
      for (let i = 0; i < this.gun.pellets; i++) {
        let a =
          Math.atan2(d.y, d.x) +
          (lane - (this.gun.lanes - 1) / 2) *
            (this.mods.includes('pinwheel')
              ? 0.12 + (Math.sin((this.shotCount * Math.PI) / 4) + 1) * 0.2
              : 0.22) +
          (i - (this.gun.pellets - 1) / 2) * this.gun.spread;
        let waypoints: Vec[] | undefined;
        if (this.gun.convergence && this.gun.lanes > 1) {
          const origin = { x: this.player.position.x, y: this.player.position.y - 3 };
          const rear = d.x * (this.aim.x - origin.x) + d.y * (this.aim.y - origin.y) < 0;
          const target = rear
            ? { x: origin.x * 2 - this.aim.x, y: origin.y * 2 - this.aim.y }
            : this.aim;
          const range = Math.max(32, distance(spawn, target));
          const axis = distance(spawn, target) > 32 ? direction(spawn, target) : d;
          const spread = (i - (this.gun.pellets - 1) / 2) * this.gun.spread;
          const side = lane - (this.gun.lanes - 1) / 2;
          a = Math.atan2(axis.y, axis.x) + side * 0.22 + spread;
          if (side !== 0) {
            const along = range * 0.5,
              across = Math.tan(side * 0.22 + spread) * along;
            const endAcross = Math.tan(spread) * range;
            waypoints = [
              {
                x: spawn.x + axis.x * along - axis.y * across,
                y: spawn.y + axis.y * along + axis.x * across,
              },
              {
                x: spawn.x + axis.x * range - axis.y * endAcross,
                y: spawn.y + axis.y * range + axis.x * endAcross,
              },
            ];
          }
        }
        this.addShot({
          pos: { ...spawn },
          vel: {
            x: Math.cos(a) * this.gun.projectileSpeed,
            y: Math.sin(a) * this.gun.projectileSpeed,
          },
          damage,
          life: 1.4,
          friendly: true,
          radius,
          bounces: this.gun.bounces,
          pierce: this.gun.pierce,
          fragment: false,
          split: false,
          bankGrowth: this.gun.bankGrowth,
          charged,
          discharge: this.gun.deadlock ? this.shotCount : undefined,
          waypoints,
          tripwire:
            primary &&
            this.mods.includes('tripwire') &&
            lane === Math.floor(this.gun.lanes / 2) &&
            i === Math.floor(this.gun.pellets / 2)
              ? damage * this.gun.pellets
              : undefined,
        });
      }
    this.burst(pos, 4, '#ffcc84', 3, d);
  }
  fireBackblast(forward: Vec, damage: number) {
    const p = { ...this.player.position },
      rear = { x: -forward.x, y: -forward.y };
    this.blast = { pos: p, dir: rear, life: 0.1 };
    this.burst(p, 8, '#e3b47a', 4.5, rear);
    // Check cover before this same blast can break it. Only ordinary hostile
    // rounds are cleared; warned hazards, bombs and boss machinery stay intact.
    if (this.gun.breach) {
      if (this.time >= this.breachAt) {
        this.breachClears = 2;
        this.breachAt = this.time + 0.45;
      }
      for (const shot of this.shots) {
        const d = direction(p, shot.pos);
        if (
          shot.friendly ||
          shot.blade ||
          shot.radius > 5 ||
          this.breachClears <= 0 ||
          shot.life <= 0 ||
          distance(p, shot.pos) > 130 ||
          rear.x * d.x + rear.y * d.y < Math.SQRT1_2 ||
          distance(this.lineEnd(p, shot.pos), shot.pos) > 0.1
        )
          continue;
        shot.life = 0;
        this.breachClears--;
        this.burst(shot.pos, 2, '#e3b47a', 1.4);
      }
      this.shots = this.shots.filter((shot) => shot.life > 0);
    }
    for (const e of [...this.enemies]) {
      if (e.spawn > 0 || e.hp <= 0) continue;
      const target = e.body.position,
        d = direction(p, target);
      if (distance(p, target) > 130 || rear.x * d.x + rear.y * d.y < Math.SQRT1_2) continue;
      if (distance(this.lineEnd(p, target), target) > 0.1) continue;
      this.hitEnemy(e, damage, p);
      if (e.hp > 0 && !e.body.isStatic)
        Body.setVelocity(e.body, {
          x: e.body.velocity.x + rear.x * 3.5 * (isBoss(e.kind) ? 0.25 : 1),
          y: e.body.velocity.y + rear.y * 3.5 * (isBoss(e.kind) ? 0.25 : 1),
        });
    }
    this.harpoons.blast(p, damage, 130, (target) => {
      const d = direction(p, target);
      return rear.x * d.x + rear.y * d.y >= Math.SQRT1_2;
    });
    const targets = this.props.items.filter((prop) => {
      const target = prop.body.position,
        d = direction(p, target);
      return (
        distance(p, target) <= 130 &&
        rear.x * d.x + rear.y * d.y >= Math.SQRT1_2 &&
        distance(this.lineEnd(p, target, 0, prop), target) < 0.1
      );
    });
    const panels = this.breaches.targets(p, 130, (target) => {
      const d = direction(p, target);
      return rear.x * d.x + rear.y * d.y >= Math.SQRT1_2;
    });
    const terrain = this.destruction.targets(p, 130, (target) => {
      const d = direction(p, target);
      return rear.x * d.x + rear.y * d.y >= Math.SQRT1_2;
    });
    for (const prop of targets) this.props.hit(prop, damage, rear);
    for (const panel of panels) this.breaches.hit(panel, damage, rear);
    for (const piece of terrain) this.destruction.hitBody(piece.body, damage, rear);
  }
  addShot(
    data: Omit<
      Shot,
      'id' | 'prev' | 'hits' | 'banks' | 'bankGrowth' | 'charged' | 'trace' | 'shell'
    > &
      Partial<Pick<Shot, 'banks' | 'bankGrowth' | 'charged'>>,
  ) {
    if (this.shots.length >= 180) return;
    const shell =
      data.friendly && !data.fragment ? this.demolition.payload(data.damage) : undefined;
    const shot: Shot = {
      banks: 0,
      bankGrowth: 0,
      charged: false,
      ...data,
      launch: data.friendly ? undefined : { pos: { ...(data.source ?? data.pos) }, at: this.time },
      shell,
      damage: shell ? data.damage * SHELL_DIRECT : data.damage,
      trace:
        data.friendly && !data.fragment && (data.bounces > 0 || data.pierce > 0)
          ? { bank: data.bounces > 0, pierce: data.pierce > 0, points: [{ ...data.pos }] }
          : undefined,
      id: ++this.id,
      prev: { ...data.pos },
      hits: new Set(),
    };
    this.ballistics.prepare(shot);
    prepareVector(shot, this.mods);
    this.massDriver.prepare(shot);
    if (shot.friendly && !shot.fragment && !shot.echo && !shot.reflected)
      shot.feedGeneration ??= this.shotCount;
    this.stasis.prepare(shot);
    this.shots.push(shot);
    return shot;
  }
  updateEnemy(e: Enemy, dt: number) {
    if (e.hp <= 0 || !this.enemies.includes(e)) return;
    e.flash = Math.max(0, e.flash - dt);
    e.shieldFlash = Math.max(0, e.shieldFlash - dt);
    e.spawn = Math.max(0, e.spawn - dt);
    if (e.spawn > 0) {
      if (e.crawler) updateWallcrawler(this, e, dt);
      return;
    }
    if (this.cryogenic.frozen(e)) return;
    if (this.salvageEvolutions.carried(e)) return;
    if (this.ballistics.pinned(e)) return;
    if (this.tethers.staggered(e)) return;
    if (this.pressure.staggered(e)) return;
    if (this.massDriver.staggered(e)) return;
    if (e.workshopTarget) {
      this.workshop.move(e);
      return;
    }
    // Shorten downtime only. Every marked attack and spawn keeps its full tell.
    e.timer -=
      dt *
      (this.overtime && ((e.state === 'idle' && e.timer > 0.5) || e.state === 'recover')
        ? 1.12
        : 1);
    const p = e.body.position,
      d = direction(p, this.player.position),
      dist = distance(p, this.player.position);
    if (e.elite === 'volatile') {
      this.updateVolatile(e);
      // A volatile flyer only harms the player through its warned explosion.
      return;
    }
    const coordinated = updateSquad(this, e);
    if (!coordinated) {
      if (e.kind === 'sorter' || e.kind === 'borer' || e.kind === 'sifter')
        updateReclamationEnemy(this, e, dt);
      else if (e.kind === 'charger') this.updateCharger(e);
      else if (e.kind === 'loader') this.updateLoader(e);
      else if (e.kind === 'crane') updateCrane(this, e);
      else if (e.kind === 'press') this.updatePress(e);
      else if (e.kind === 'kiln') updateKiln(this, e, dt);
      else if (e.kind === 'hopper') this.updateHopper(e);
      else if (e.kind === 'scrapper') updateScrapper(this, e);
      else if (e.kind === 'harpooner') this.harpoons.updateEnemy(e);
      else if (e.kind === 'sapper') this.sappers.updateEnemy(e);
      else if (e.kind === 'angler') updateAngler(this, e, dt);
      else if (e.kind === 'wallcrawler') updateWallcrawler(this, e, dt);
      else if (e.kind === 'sniper') this.updateSniper(e);
      else if (e.kind === 'boss') this.updateBoss(e);
      else if (e.kind === 'skimmer' || e.kind === 'condenser') updateCoolingEnemy(this, e);
      else if (e.kind === 'turbine') updateTurbine(this, e, dt);
      else if (e.kind === 'interceptor') updateInterceptor(this, e, dt);
      else if (e.kind === 'runner') {
        const turning = e.elite === 'shielded' && this.updateShield(e);
        if (!turning) this.updateRunner(e, d, dist);
      } else if (e.kind === 'flyer') {
        Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
        const height = clamp(this.player.position.y - 190, this.worldTop + 220, 500);
        Body.setVelocity(e.body, {
          x: clamp((this.player.position.x - d.x * 350 - p.x) * 0.009, -2.4, 2.4),
          y: clamp((height - p.y) * 0.04, -3, 3),
        });
      }
    }
    if ((e.kind === 'shooter' && !coordinated) || e.kind === 'flyer') {
      if (
        e.timer <= 0.35 &&
        e.timer + dt > 0.35 &&
        dist < 1450 &&
        distance(this.lineEnd(p, this.player.position), this.player.position) < 1
      )
        this.onSound('aim-warn');
      if (e.timer > 0.35) e.aim = d;
      if (e.timer <= 0 && dist < 1450) {
        const base = Math.atan2(e.aim.y, e.aim.x);
        const count = e.kind === 'flyer' ? 3 : 1;
        for (let i = 0; i < count; i++) this.enemyShot(e, base + (i - (count - 1) / 2) * 0.18);
        const area = areaIndex(this.stage);
        e.timer =
          e.kind === 'flyer'
            ? [1.55, 1.35, 1.2, 1.3, 0.96][area]
            : [1.2, 1.08, 0.96, 1.05, 0.78][area];
        this.onSound('enemy');
      } else if (e.timer <= 0) e.timer = 0.8;
    }
    if (this.mode !== 'playing' || e.hp <= 0) return;
    if (
      !(
        (e.kind === 'charger' || e.kind === 'loader' || e.kind === 'kiln') &&
        e.state === 'recover'
      ) &&
      !(
        (e.kind === 'scrapper' ||
          e.kind === 'harpooner' ||
          e.kind === 'sapper' ||
          e.kind === 'wallcrawler' ||
          e.kind === 'angler') &&
        e.state === 'recover'
      ) &&
      (e.kind !== 'press' || e.state === 'rush') &&
      e.kind !== 'crane' &&
      Query.collides(this.player, [e.body]).length &&
      !this.salvage.ram(e)
    )
      this.damagePlayer(
        isBoss(e.kind)
          ? e.kind === 'loader'
            ? 28
            : 30
          : e.kind === 'charger' && e.state === 'rush'
            ? 22
            : 15,
        p,
        { type: 'contact', enemy: e.kind },
      );
    if (p.y > 900) this.hitEnemy(e, 9999);
  }
  updateRunner(e: Enemy, d: Vec, dist: number) {
    const p = e.body.position;
    const speed = [3.1, 3.35, 3.6, 2.5, 3.9][areaIndex(this.stage)];
    Body.setVelocity(e.body, {
      x: e.body.velocity.x + (d.x * speed - e.body.velocity.x) * 0.08,
      y: e.body.velocity.y,
    });
    const grounded =
      Query.ray(
        this.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 5 },
        20,
      ).length > 0;
    const portalAhead = this.portals.traceBody(p, { x: p.x + Math.sign(d.x) * 45, y: p.y }, e.body);
    const blocked =
      !portalAhead &&
      Query.ray(
        this.solidBodies,
        { x: p.x, y: p.y + 8 },
        { x: p.x + Math.sign(d.x) * 45, y: p.y + 8 },
        12,
      ).length > 0;
    if (
      e.timer <= 0 &&
      grounded &&
      dist > 60 &&
      (blocked ||
        Math.abs(e.body.velocity.x) < 0.7 ||
        (this.player.position.y < p.y - 60 && dist < 280))
    ) {
      Body.setVelocity(e.body, { x: d.x * 4.5, y: -11.8 });
      e.timer = 0.9;
    }
  }
  updateShield(e: Enemy): boolean {
    if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.65, y: e.body.velocity.y });
      if (e.timer <= 0) {
        e.facing = e.target.x;
        e.state = 'recover';
        e.timer = 0.25;
      }
      return true;
    }
    if (e.state === 'recover') {
      if (e.timer <= 0) e.state = 'idle';
      return true;
    }
    const dx = this.player.position.x - e.body.position.x;
    if (Math.abs(dx) > 18 && Math.sign(dx) !== e.facing) {
      e.target = { x: Math.sign(dx), y: 0 };
      e.state = 'windup';
      e.timer = SHIELD_TURN;
      return true;
    }
    return false;
  }
  updateVolatile(e: Enemy) {
    const p = e.body.position;
    if (e.state === 'windup') {
      if (e.timer <= 0) this.detonateVolatile(e);
      return;
    }
    const target = this.player.position;
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    Body.setVelocity(e.body, {
      x: clamp((target.x - p.x) * 0.012, -2.7, 2.7),
      y: clamp((target.y - 22 - p.y) * 0.016, -2.5, 2.5),
    });
    if (distance(p, target) <= 120 && distance(this.lineEnd(p, target), target) < 0.1) {
      Body.setVelocity(e.body, { x: 0, y: 0 });
      Body.setStatic(e.body, true);
      e.state = 'windup';
      e.timer = VOLATILE_TELL;
      e.target = { ...p };
      this.onSound('lock');
    }
  }
  detonateVolatile(e: Enemy) {
    if (this.mode !== 'playing' || e.hp <= 0 || !this.enemies.includes(e)) return;
    const p = { ...e.body.position };
    e.hp = 0;
    Composite.remove(this.engine.world, e.body);
    this.enemies = this.enemies.filter((other) => other !== e);
    // Snapshot all blast cover before any prop can be broken or set off.
    const visible = (target: Vec, ignored?: Prop) =>
      distance(p, target) < VOLATILE_RADIUS &&
      distance(this.lineEnd(p, target, 0, ignored), target) < 0.1;
    const hurtsPlayer = visible(this.player.position);
    const enemies = this.enemies.filter(
      (other) => other.spawn <= 0 && visible(other.body.position),
    );
    const props = this.props.items.filter((prop) => visible(prop.body.position, prop));
    const panels = this.breaches.targets(p, VOLATILE_RADIUS);
    const terrain = this.destruction.targets(p, VOLATILE_RADIUS);
    this.burst(p, 26, '#ffd28a', 6);
    if (this.particles.length < 220)
      this.particles.push({
        pos: p,
        vel: { x: 0, y: 0 },
        life: 0.22,
        max: 0.22,
        size: VOLATILE_RADIUS,
        color: '#f5b96e',
        kind: 'ring',
      });
    this.feedback(6);
    this.onSound('explode');
    if (hurtsPlayer)
      this.damagePlayer(
        Math.ceil(24 * (1 - distance(p, this.player.position) / (VOLATILE_RADIUS * 2))),
        p,
        { type: 'volatile', enemy: e.kind },
      );
    if (this.mode !== 'playing') return;
    for (const other of enemies)
      this.hitEnemy(other, 55 * (1 - distance(p, other.body.position) / (VOLATILE_RADIUS * 2)));
    for (const prop of props) {
      if (prop.kind === 'canister') this.props.explode(prop);
      else this.props.hit(prop, 65, direction(p, prop.body.position));
      if (this.mode !== 'playing') return;
    }
    for (const panel of panels) this.breaches.hit(panel, 65, direction(p, panel.body.position));
    for (const piece of terrain)
      this.destruction.hitBody(piece.body, 65, direction(p, piece.body.position));
  }
  enemyGrounded(e: Enemy) {
    const p = e.body.position;
    return (
      e.body.velocity.y >= -1 &&
      Query.ray(
        this.solidBodies,
        { x: p.x, y: e.body.bounds.max.y - 2 },
        { x: p.x, y: e.body.bounds.max.y + 5 },
        20,
      ).length > 0
    );
  }
  lineEnd(start: Vec, end: Vec, padding = 0, ignore?: Prop | Matter.Body): Vec {
    let t = 1;
    for (const b of this.terrainBodies) {
      if (b === ignore) continue;
      const hit = this.counterweights.owns(b)
        ? sweepBox(start, end, { x: padding, y: padding }, b)
        : segmentBox(
            start,
            end,
            { x: b.bounds.min.x - padding, y: b.bounds.min.y - padding },
            { x: b.bounds.max.x + padding, y: b.bounds.max.y + padding },
          );
      if (hit) t = Math.min(t, hit.t);
    }
    for (const prop of this.props.items) {
      if (prop === ignore) continue;
      const hit = traceProp(prop, start, end, padding);
      if (hit) t = Math.min(t, hit.t);
    }
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  }
  updateCharger(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity,
      dx = this.player.position.x - p.x;
    const grounded = this.enemyGrounded(e),
      sign = Math.sign(dx) || 1;
    if (e.state === 'rush') {
      const end = this.lineEnd(p, { x: p.x + e.aim.x * 35, y: p.y });
      const contact =
        e.timer > 0
          ? firstSolid(
              p,
              { x: p.x + e.aim.x * 20, y: p.y },
              { x: ENEMY_STATS.charger.w / 2, y: ENEMY_STATS.charger.h / 2 - 1 },
              this.solidBodies,
            )
          : undefined;
      const prop = contact && this.props.items.find((prop) => prop.body === contact.body);
      const weak = contact && this.destruction.pieces.some((piece) => piece.body === contact.body);
      const portalAhead = this.portals.traceBody(p, { x: p.x + e.aim.x * 35, y: p.y }, e.body);
      const crashed =
        e.timer > 0 &&
        !portalAhead &&
        (prop || weak ? contact!.t * 20 <= 14 : Math.abs(end.x - p.x) < 34);
      if (crashed || e.timer <= 0) {
        e.state = 'recover';
        e.timer = crashed ? 1.1 : 0.6;
        Body.setVelocity(e.body, { x: 0, y: v.y });
        if (crashed) {
          if ((prop || weak) && contact)
            Body.setPosition(e.body, {
              x: p.x + e.aim.x * Math.max(0, contact.t * 20 - 0.05),
              y: p.y,
            });
          this.burst(prop ? prop.body.position : end, 12, '#ffc07a', 3.5);
          this.feedback(2);
          this.onSound('crash');
          if (prop) this.props.strike(prop, 140, e.aim);
          if (weak) this.destruction.hitBody(contact!.body, 140, e.aim);
        }
      } else Body.setVelocity(e.body, { x: e.aim.x * 14, y: v.y });
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.65, y: v.y });
      if (e.timer <= 0) {
        e.state = 'rush';
        e.timer = 0.62;
        this.onSound('rush');
      }
    } else if (e.state === 'recover') {
      Body.setVelocity(e.body, { x: v.x * 0.75, y: v.y });
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.8;
      }
    } else {
      e.aim = { x: sign, y: 0 };
      Body.setVelocity(e.body, { x: v.x + (sign * 2.1 - v.x) * 0.08, y: v.y });
      if (grounded && e.timer <= 0) {
        if (Math.abs(dx) < 680 && Math.abs(this.player.position.y - p.y) < 80) {
          e.state = 'windup';
          e.timer = CHARGE_TELL;
          this.onSound('charge');
        } else if (
          Math.abs(v.x) < 0.7 ||
          this.player.position.y < p.y - 55 ||
          Query.ray(this.solidBodies, p, { x: p.x + sign * 45, y: p.y }, 12).length
        ) {
          Body.setVelocity(e.body, { x: sign * 4.5, y: -12.3 });
          e.timer = 0.7;
        }
      }
    }
  }
  updateLoader(e: Enemy) {
    updateLoader(this, e);
  }
  pressSurface(x: number, bottom: number) {
    const half = ENEMY_STATS.press.w / 2;
    return Math.min(
      WORLD.floor,
      ...this.terrainBodies
        .filter(
          (b) =>
            b.bounds.min.y >= bottom - 1 &&
            b.bounds.min.y <= WORLD.floor &&
            b.bounds.min.x < x + half &&
            b.bounds.max.x > x - half,
        )
        .map((b) => b.bounds.min.y),
    );
  }
  updatePress(e: Enemy) {
    updatePress(this, e);
  }
  hopperTarget(e: Enemy): Vec {
    const p = e.body.position,
      player = this.player.position;
    const candidates: Vec[] = [];
    for (const b of this.terrainBodies) {
      const min = b.bounds.min,
        max = b.bounds.max;
      if (
        min.y < this.worldTop ||
        min.y > WORLD.floor ||
        max.x <= 0 ||
        min.x >= this.worldWidth ||
        max.x - min.x < 48
      )
        continue;
      const target = {
        x: clamp(player.x, Math.max(35, min.x + 23), Math.min(1965, max.x - 23)),
        y: min.y - 17,
      };
      if (Math.abs(target.x - p.x) > 390) target.x = clamp(target.x, p.x - 390, p.x + 390);
      if (
        target.x < min.x + 23 ||
        target.x > max.x - 23 ||
        p.y - target.y > 225 ||
        target.y - p.y > 400
      )
        continue;
      if (
        this.solidBodies.some(
          (other) =>
            other !== b &&
            target.x + 15 > other.bounds.min.x &&
            target.x - 15 < other.bounds.max.x &&
            target.y + 16 > other.bounds.min.y &&
            target.y - 16 < other.bounds.max.y,
        )
      )
        continue;
      candidates.push(target);
    }
    return (
      candidates.sort((a, b) => distance(a, player) - distance(b, player))[0] ?? {
        x: clamp(p.x + Math.sign(player.x - p.x) * 200, 35, 1965),
        y: p.y,
      }
    );
  }
  updateHopper(e: Enemy) {
    const p = e.body.position,
      v = e.body.velocity,
      grounded = this.enemyGrounded(e);
    if (e.state === 'airborne') {
      Body.setVelocity(e.body, { x: clamp((e.target.x - p.x) * 0.07, -6.5, 6.5), y: v.y });
      if (grounded && e.timer <= 0) {
        e.state = 'recover';
        e.timer = 0.5;
        this.burst({ x: p.x, y: p.y + 16 }, 7, '#bc9685', 2);
        this.onSound('land');
      }
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.65, y: v.y });
      if (e.timer <= 0 && grounded) {
        e.state = 'airborne';
        e.timer = 0.2;
        Body.setVelocity(e.body, {
          x: clamp((e.target.x - p.x) / 42, -6.5, 6.5),
          y: -13.5 - Math.max(0, p.y - e.target.y) * 0.009,
        });
        this.onSound('hop');
      } else if (e.timer < -0.5) {
        e.state = 'airborne';
        e.timer = 0.2;
      }
    } else {
      Body.setVelocity(e.body, { x: v.x * 0.8, y: v.y });
      if (e.timer <= 0 && grounded) {
        e.target = this.hopperTarget(e);
        e.aim = direction(p, e.target);
        e.state = 'windup';
        e.timer = HOP_TELL;
      }
    }
  }
  updateSniper(e: Enemy) {
    if (e.state === 'windup' || e.state === 'followup') {
      const second = e.state === 'followup';
      if (e.timer > (second ? TWIN_LOCK : 0.32))
        e.aim = direction(e.body.position, this.player.position);
      if (e.timer <= 0) {
        this.enemyShot(e, Math.atan2(e.aim.y, e.aim.x), 18, 20);
        this.onSound('snipe');
        if (e.elite === 'twin' && !second) {
          e.state = 'followup';
          e.timer = TWIN_TELL;
          e.aim = direction(e.body.position, this.player.position);
          this.onSound('lock');
        } else {
          e.state = 'recover';
          e.timer = e.elite === 'twin' ? 1.9 : 1.65;
        }
      }
    } else {
      e.aim = direction(e.body.position, this.player.position);
      if (e.timer <= 0 && distance(e.body.position, this.player.position) < 1450) {
        e.state = 'windup';
        e.timer = SNIPER_TELL;
        this.onSound('lock');
      }
    }
  }
  updateBoss(e: Enemy) {
    const p = e.body.position,
      d = direction(p, this.player.position);
    Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
    const phase = bossPhase(e.hp, e.maxHp, !!this.overtime);
    if (phase > e.phase) {
      e.phase = phase;
      e.state = 'transition';
      e.timer = 0.75;
      e.attacks = 0;
      this.burst(p, 25, '#ffd19b', 4);
      this.feedback(4);
      this.onSound('phase');
    }
    if (e.state === 'windup' || e.state === 'followup' || e.state === 'transition') {
      Body.setVelocity(e.body, { x: e.body.velocity.x * 0.65, y: e.body.velocity.y * 0.65 });
    } else huntBoss(this, e);
    if (e.state === 'transition') {
      if (e.timer <= 0) {
        e.state = 'idle';
        e.timer = 0.25;
      }
    } else if (e.state === 'windup' || e.state === 'followup') {
      const second = e.state === 'followup';
      if (e.timer > 0.3) e.aim = d;
      if (e.timer <= 0) {
        for (const angle of attackAngles(e.attack, Math.atan2(e.aim.y, e.aim.x)))
          this.enemyShot(e, angle, e.attack === 'ring' ? 7.8 : 11.2, 23);
        if (!second && e.attack !== 'ring') {
          e.state = 'followup';
          e.timer = 0.7;
          e.aim = d;
          this.onSound('lock');
        } else {
          e.attacks++;
          e.state = 'recover';
          e.timer = [1.1, 1, 0.9][e.phase];
        }
        this.onSound(e.attack === 'ring' ? 'pulse' : 'enemy');
      }
    } else if (e.timer <= 0 && bossHasLane(this, e)) {
      e.attack = bossAttack(e.phase, e.attacks);
      e.aim = d;
      e.state = 'windup';
      e.timer = attackTell(e.attack);
      this.onSound('lock');
    }
  }
  enemyShot(
    e: Enemy,
    a: number,
    speed = (this.overtime ? [10.5, 11, 11.5, 12, 12.5] : [8, 8.9, 9.7, 9.6, 11.2])[
      areaIndex(this.stage)
    ],
    damage = this.overtime
      ? 22 + areaIndex(this.stage)
      : e.kind === 'boss'
        ? 22
        : [14, 16, 18, 20, 22][areaIndex(this.stage)],
    origin: Vec = squadGunOrigin(e),
    blade = false,
  ) {
    if (
      e.squad?.kind === 'shield' &&
      e.squad.role === 'support' &&
      distance(this.lineEnd(e.body.position, origin, 4), origin) > 0.1
    )
      return;
    const d = { x: Math.cos(a), y: Math.sin(a) },
      radius =
        e.kind === 'turbine'
          ? 62
          : e.kind === 'boss' || e.kind === 'condenser'
            ? 55
            : e.kind === 'interceptor'
              ? 44
              : e.kind === 'sniper'
                ? 38
                : 26;
    const muzzle = { x: origin.x + d.x * radius, y: origin.y + d.y * radius };
    const padding = blade
      ? 11
      : e.squad || e.kind === 'interceptor' || e.kind === 'wallcrawler'
        ? 5
        : 0;
    const end = e.squad
      ? squadLineEnd(this, e, origin, muzzle)
      : this.lineEnd(origin, muzzle, padding);
    const portalMuzzle = this.portals.trace(origin, muzzle, {
      x: blade ? 11 : 5,
      y: blade ? 11 : 5,
    });
    if (distance(end, muzzle) > 0.01 && !portalMuzzle) {
      this.burst(end, 3, '#ef7264', 1.5);
      const prop = this.props.items.find((p) => {
        const hit = traceProp(p, origin, muzzle, padding);
        return hit && Math.abs(distance(origin, end) - distance(origin, muzzle) * hit.t) < 0.1;
      });
      if (prop) this.props.hit(prop, damage, d);
      this.breaches.hitAlong(origin, muzzle, end, damage, d, padding);
      this.destruction.hitAlong(origin, muzzle, end, damage, d, padding);
      return;
    }
    this.addShot({
      pos: portalMuzzle ? { ...origin } : muzzle,
      vel: { x: d.x * speed, y: d.y * speed },
      damage,
      life: 4,
      friendly: false,
      damageCause: { type: blade ? 'blade' : 'shot', enemy: e.kind },
      source: { ...e.body.position },
      ...(e.squad ? { allyBlock: e.id } : {}),
      radius: blade ? 11 : 5,
      ...(blade ? { blade: true as const } : {}),
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
    });
  }
  updateShots(dt: number) {
    this.stasis.update();
    this.massDriver.update(dt);
    if (this.mode !== 'playing') return;
    for (const s of [...this.shots]) updateRivalAmmo(this, s, dt);
    for (const s of this.shots) updateAnglerShot(this, s);
    for (const s of this.shots) this.ballistics.flight(s, dt);
    for (const s of this.shots) steerVector(s, this.aim, dt);
    this.ballistics.reflect(dt);
    for (const s of [...this.shots]) {
      updateAnglerShot(this, s);
      if (s.reflectedAt === this.time) continue;
      if (s.stasis?.phase === 'parked' || s.stasis?.phase === 'queued') continue;
      if (!suspended(s)) s.life -= dt;
      s.prev = { ...s.pos };
      let remaining = dt * 60;
      for (let attempt = 0; attempt < 4 && remaining > 0.001 && s.life > 0; attempt++) {
        this.massDriver.heading(s);
        const retracing = !!s.recall?.returning && !!s.recall.route?.length;
        const waypoint =
          routeTarget(this, s) ??
          (s.stasis?.phase === 'setting' ? s.stasis.target : s.waypoints?.[0]);
        if (s.life <= 0) break;
        const speed = Math.hypot(s.vel.x, s.vel.y);
        const segment =
          waypoint && speed > 0
            ? Math.min(remaining, distance(s.pos, waypoint) / speed)
            : remaining;
        const end = { x: s.pos.x + s.vel.x * segment, y: s.pos.y + s.vel.y * segment };
        let nearest: {
          t: number;
          normal: Vec;
          enemy?: Enemy;
          anchor?: Enemy;
          valve?: PressureVent;
          player?: boolean;
          caught?: boolean;
          prop?: Prop;
          cable?: Prop;
          body?: Matter.Body;
        } | null = null;
        const targets: [Matter.Body, Enemy?, boolean?][] = this.terrainBodies
          .filter((b) => s.massDriver?.rolling?.bodyId !== b.id)
          .map((b) => [b]);
        for (const e of this.enemies) if (e.crane && e.spawn <= 0) targets.push([e.crane.body]);
        if (s.friendly) {
          for (const e of this.enemies)
            if (
              (s.massDriver || !s.hits.has(e.id)) &&
              !s.massDriver?.penetrating.has(e.id) &&
              !s.recall?.skip.has(e.id) &&
              e.spawn <= 0
            )
              targets.push([e.body, e]);
        } else {
          targets.push([this.player, undefined, true]);
          if (s.allyBlock !== undefined)
            for (const e of this.enemies)
              if (e.id !== s.allyBlock && e.spawn <= 0) targets.push([e.body]);
        }
        for (const [body, enemy, player] of targets) {
          const h =
            s.massDriver || s.angler || s.tripwire !== undefined || this.counterweights.owns(body)
              ? sweepBox(s.pos, end, { x: s.radius, y: s.radius }, body)
              : segmentBox(
                  s.pos,
                  end,
                  { x: body.bounds.min.x - s.radius, y: body.bounds.min.y - s.radius },
                  { x: body.bounds.max.x + s.radius, y: body.bounds.max.y + s.radius },
                );
          if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, enemy, player, body };
        }
        for (const prop of this.props.items) {
          const h = s.angler
            ? sweepBox(s.pos, end, { x: s.radius, y: s.radius }, prop.body)
            : traceProp(prop, s.pos, end, s.radius);
          if (h && (!nearest || h.t < nearest.t)) nearest = { ...h, prop };
        }
        const cable = this.cargo.trace(s.pos, end, s.radius);
        if (cable && (!nearest || cable.t < nearest.t))
          nearest = { t: cable.t, normal: cable.normal, cable: cable.prop };
        const anchor = s.friendly ? this.harpoons.trace(s.pos, end, s.radius) : null;
        if (anchor && (!nearest || anchor.t < nearest.t))
          nearest = { t: anchor.t, normal: anchor.normal, anchor: anchor.enemy };
        const valve = s.friendly ? this.pressure.trace(s.pos, end, s.radius) : undefined;
        if (valve && (!nearest || valve.t < nearest.t))
          nearest = { t: valve.t, normal: valve.normal, valve: valve.vent };
        if (s.recall?.returning) {
          const hit = segmentBox(s.pos, end, this.player.bounds.min, this.player.bounds.max);
          if (hit && (!nearest || hit.t < nearest.t)) nearest = { ...hit, caught: true };
        }
        const passage = retracing
          ? null
          : this.portals.trace(s.pos, end, { x: s.radius, y: s.radius });
        this.massDriver.travel(
          s,
          speed *
            segment *
            (passage && (!nearest || passage.t <= nearest.t + 1e-6)
              ? passage.t
              : (nearest?.t ?? 1)),
        );
        if (passage && (!nearest || passage.t <= nearest.t + 1e-6)) {
          const entryPoint = {
            x: s.pos.x + (end.x - s.pos.x) * passage.t + passage.entry.normal.x * 0.5,
            y: s.pos.y + (end.y - s.pos.y) * passage.t + passage.entry.normal.y * 0.5,
          };
          recordRoute(s, entryPoint);
          recordRoute(s, passage.pos, {
            pos: entryPoint,
            entry: passage.entry,
            exit: passage.exit,
          });
          this.stasis.abandon(s);
          s.pos = { ...passage.pos };
          s.prev = { ...s.pos };
          s.vel = portalVector(s.vel, passage.entry, passage.exit);
          if (
            this.mods.includes('relay-gate') &&
            s.friendly &&
            !s.fragment &&
            !s.reflected &&
            !s.echo &&
            !s.relay
          ) {
            s.relay = true;
            s.bounces++;
            s.vel.x *= 1.15;
            s.vel.y *= 1.15;
          }
          if (s.massDriver) s.massDriver.rolling = undefined;
          this.massDriver.redirect(s);
          redirectVector(s);
          if (s.angler) {
            s.angler = undefined;
            s.bounces = 0;
          }
          s.waypoints = undefined;
          if (s.trace) s.trace.points = [{ ...s.pos }];
          remaining -= segment * passage.t;
          continue;
        }
        if (!nearest) {
          this.salvage.trace(s, s.pos, end);
          s.pos = end;
          recordRoute(s);
          recordShotTrace(s.trace, s.pos);
          if (waypoint && distance(s.pos, waypoint) < 0.01) {
            if (retracing) {
              routeTarget(this, s);
              remaining -= segment;
              continue;
            }
            if (s.stasis?.phase === 'setting') {
              s.stasis.phase = 'parked';
              break;
            }
            s.waypoints!.shift();
            const next = s.waypoints![0];
            if (next) {
              const d = direction(s.pos, next);
              s.vel = { x: d.x * speed, y: d.y * speed };
            } else s.waypoints = undefined;
            remaining -= segment;
            continue;
          }
          break;
        }
        const segmentStart = { ...s.pos };
        s.pos = {
          x: s.pos.x + (end.x - s.pos.x) * nearest.t,
          y: s.pos.y + (end.y - s.pos.y) * nearest.t,
        };
        this.salvage.trace(s, segmentStart, s.pos);
        recordShotTrace(s.trace, s.pos);
        this.stasis.abandon(s);
        remaining -= segment * nearest.t;
        s.waypoints = undefined;
        const impactDamage = this.massDriver.impactDamage(s);
        s.impactNormal = { ...nearest.normal };
        if (nearest.caught) {
          this.fusions.catch(s);
          s.life = 0;
          s.shell = undefined;
        } else if (nearest.valve) {
          this.pressure.trigger(nearest.valve);
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.cable) {
          this.cargo.cut(nearest.cable, impactDamage);
          rivalImpact(this, s);
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.anchor) {
          this.harpoons.hitAnchor(nearest.anchor, impactDamage);
          this.splitShot(s, nearest.normal);
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.enemy) {
          const e = nearest.enemy;
          if (s.massDriver?.struck.has(e.id)) {
            this.massDriver.bounce(s, nearest.normal, e.body, false);
            if (!e.body.isStatic) remaining = 0;
            continue;
          }
          s.massDriver?.struck.add(e.id);
          s.hits.add(e.id);
          // Use this segment's incoming direction, including after a bank, rather
          // than the player's current position or the shot's original origin.
          const damage = this.cryogenic.damage(
            e,
            s,
            impactDamage *
              this.stasis.damage(s) *
              this.ballistics.fracture(e, s) *
              (this.gun.execute && s.friendly && !s.fragment && e.hp < e.maxHp * 0.3 ? 1.6 : 1),
          );
          const blocked = this.hitEnemy(e, damage, {
            x: e.body.position.x - s.vel.x,
            y: e.body.position.y - s.vel.y,
          });
          if (blocked) {
            if (s.massDriver && !s.shell) {
              this.massDriver.bounce(s, nearest.normal, e.body, false);
              if (!e.body.isStatic) remaining = 0;
              continue;
            }
            this.demolition.impact(s, e.body);
            if (this.mode !== 'playing') return;
            s.life = 0;
            continue;
          }
          this.salvage.impact(s);
          this.cryogenic.hit(e, s);
          this.stasis.hit(s);
          this.evolutions.hit(s);
          this.ballistics.consumeFracture(e, s);
          this.ballistics.rivet(e, s);
          this.tethers.hit(e, s);
          if (e.hp <= 0 && this.gun.deathBloom && !s.fragment) this.deathBloom(s, e.body.position);
          this.splitShot(s);
          this.arcs.hit(e, s);
          if (this.mode !== 'playing') return;
          if (s.massDriver) this.massDriver.hitEnemy(s, e, nearest.normal);
          else if (!e.body.isStatic)
            Body.setVelocity(e.body, {
              x: e.body.velocity.x + s.vel.x * 0.12 * (isBoss(e.kind) ? 0.08 : 1),
              y: e.body.velocity.y + s.vel.y * 0.09 * (isBoss(e.kind) ? 0.08 : 1),
            });
          if (s.pierce > 0) {
            s.massDriver?.penetrating.add(e.id);
            s.pierce--;
            const falloff =
              s.rail || (s.recall?.returning && this.ballistics.has('homecoming')) ? 1 : 0.8;
            s.damage *= falloff;
            if (s.shell) s.shell.damage *= falloff;
            const d = direction({ x: 0, y: 0 }, s.vel);
            s.pos.x += d.x;
            s.pos.y += d.y;
          } else if (s.massDriver && !s.shell) {
            this.massDriver.bounce(s, nearest.normal, e.body, false);
            if (!e.body.isStatic) remaining = 0;
          } else if (this.ballistics.turn(s)) {
            const d = direction({ x: 0, y: 0 }, s.vel);
            s.pos.x += d.x;
            s.pos.y += d.y;
          } else {
            s.life = 0;
            this.demolition.impact(s, e.body);
            if (this.mode !== 'playing') return;
          }
        } else if (nearest.player) {
          rivalImpact(this, s);
          this.damagePlayer(s.damage, s.pos, s.damageCause ?? { type: 'shot' });
          s.life = 0;
          if (this.mode !== 'playing') return;
        } else {
          const impactBody = nearest.prop?.body ?? nearest.body;
          if (s.massDriver && impactBody && s.massDriver.surfaces.has(impactBody.id)) {
            this.massDriver.bounce(s, nearest.normal, impactBody);
            if (!impactBody.isStatic) remaining = 0;
            continue;
          }
          if (impactBody) s.massDriver?.surfaces.add(impactBody.id);
          this.grapnel.impact(s, nearest.body, nearest.normal);
          this.tripwires.impact(s, nearest.body, nearest.normal);
          this.counterweights.hit(nearest.body, s.pos, s.vel, impactDamage);
          this.salvage.impact(s, nearest.prop?.body ?? nearest.body, nearest.normal);
          if (nearest.prop && s.massDriver)
            this.massDriver.hitProp(s, nearest.prop, nearest.normal);
          else if (nearest.prop)
            this.props.hit(
              nearest.prop,
              !s.friendly && s.enemyAmmo?.kind === 'precision' ? 90 : s.damage,
              s.vel,
              s,
            );
          if (
            !s.friendly &&
            s.enemyAmmo?.kind === 'precision' &&
            s.pierce > 0 &&
            nearest.prop &&
            !this.props.items.includes(nearest.prop)
          ) {
            s.pierce--;
            const d = direction({ x: 0, y: 0 }, s.vel);
            s.pos.x += d.x;
            s.pos.y += d.y;
            continue;
          }
          this.breaches.hitBody(nearest.body, impactDamage, s.vel, s);
          this.destruction.hitBody(
            nearest.body,
            !s.friendly && s.enemyAmmo?.kind === 'precision' ? 90 : impactDamage,
            s.vel,
            s,
          );
          this.burst(s.pos, 3, s.friendly ? '#bcbdb2' : '#ef7264', 1.5);
          this.splitShot(s, nearest.normal);
          if (s.angler && !s.friendly) {
            if (
              nearest.body !== s.angler.plan.body ||
              s.angler.banked ||
              distance(s.pos, s.angler.plan.bounce) > 3
            )
              s.bounces = 0;
            else s.angler.banked = true;
          }
          if (s.massDriver) {
            const alive = this.massDriver.bounce(s, nearest.normal, impactBody);
            if (impactBody && !impactBody.isStatic) remaining = 0;
            if (alive) redirectVector(s);
            else this.grind.impact(s, nearest.body, nearest.normal);
            if (this.mode !== 'playing') return;
          } else if (s.bounces > 0) {
            const dot = s.vel.x * nearest.normal.x + s.vel.y * nearest.normal.y;
            s.vel.x -= 2 * dot * nearest.normal.x;
            s.vel.y -= 2 * dot * nearest.normal.y;
            redirectVector(s);
            s.bounces--;
            s.banks++;
            s.damage *= 1 + s.bankGrowth;
            if (s.shell) s.shell.damage *= 1 + s.bankGrowth;
            if (s.bankGrowth > 0) {
              this.burst(s.pos, 4, '#a1dbbf', 2);
              this.onSound('bank');
            }
            s.pos.x += nearest.normal.x;
            s.pos.y += nearest.normal.y;
            pocketBank(this, s, nearest.body, nearest.normal);
            recordRoute(s);
          } else if (this.ballistics.turn(s, nearest.normal)) {
            s.pos.x += nearest.normal.x;
            s.pos.y += nearest.normal.y;
          } else {
            s.life = 0;
            this.grind.impact(s, nearest.body, nearest.normal);
            rivalImpact(this, s, nearest.prop?.body ?? nearest.body);
            this.demolition.impact(s, nearest.prop?.body ?? nearest.body);
            if (this.mode !== 'playing') return;
          }
        }
        recordShotTrace(s.trace, s.pos);
        recordRoute(s);
      }
      if (
        s.pos.x < -50 ||
        s.pos.x > this.worldWidth + 50 ||
        s.pos.y < this.worldTop - 100 ||
        s.pos.y > 900
      )
        s.life = 0;
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    this.evolutions.settle();
  }
  splitShot(s: Shot, surface?: Vec) {
    if (!this.gun.fragments || s.split || !s.friendly || s.fragment) return;
    s.split = true;
    const shatter = this.gun.shatter && surface && Math.hypot(surface.x, surface.y) > 0;
    for (let i = 0; i < (shatter ? 6 : 3); i++) {
      const a = shatter
        ? Math.atan2(surface.y, surface.x) + (i - 2.5) * 0.48
        : this.rng() * Math.PI * 2;
      this.addShot({
        pos: shatter
          ? { x: s.pos.x + surface.x * 0.6, y: s.pos.y + surface.y * 0.6 }
          : { ...s.pos },
        vel: { x: Math.cos(a) * (shatter ? 20 : 16), y: Math.sin(a) * (shatter ? 20 : 16) },
        damage: s.damage * (shatter ? 0.3 : 0.2),
        // Splinter shares its originating discharge's scrap credit. Echo and
        // reflected fragments cannot turn secondary damage into a fresh charge.
        feedGeneration: !s.echo && !s.reflected ? (s.feedGeneration ?? s.discharge) : undefined,
        life: shatter ? 0.6 : 0.4,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: true,
        split: true,
      });
    }
  }
  deathBloom(s: Shot, pos: Vec) {
    const base = Math.atan2(s.vel.y, s.vel.x);
    for (let i = 0; i < 6; i++) {
      const angle = base + (i * Math.PI) / 3;
      this.addShot({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * 16, y: Math.sin(angle) * 16 },
        damage: s.damage * 0.35,
        life: 0.65,
        friendly: true,
        radius: 2,
        bounces: 0,
        pierce: 0,
        fragment: true,
        split: true,
      });
    }
  }
  hitEnemy(e: Enemy, damage: number, from?: Vec, feedback = true, killEffects = true): boolean {
    if (e.hp <= 0) return false;
    const incomingDamage = damage;
    const blocked =
      e.elite === 'shielded' && !!from && direction(e.body.position, from).x * e.facing > 0.45;
    if (blocked) {
      damage *= 0.1;
      e.shieldFlash = 0.14;
    }
    if (e.angler && e.angler.exposed > 0) damage *= 1.5;
    if (e.crawler && e.crawler.vulnerable > 0) damage *= 1.5;
    if (e.kind === 'charger' && e.state === 'recover') damage *= 1.4;
    if (e.kind === 'loader') damage *= e.state === 'recover' ? 1.25 : 0.4;
    if (e.kind === 'crane') damage *= e.state === 'recover' && e.crane && !e.crane.hit ? 1.4 : 0.35;
    if (e.kind === 'press') damage *= e.state === 'recover' ? 1.25 : 0.4;
    if (e.kind === 'kiln') damage *= e.state === 'recover' ? 1.35 : 0.4;
    if (e.kind === 'sorter') damage *= e.state === 'recover' ? 1.35 : 0.32;
    if (e.kind === 'condenser') damage *= e.state === 'recover' ? 1.3 : 0.25;
    if (e.kind === 'turbine') damage *= e.state === 'recover' ? 1.35 : 0.32;
    if (e.kind === 'interceptor') damage *= e.state === 'recover' ? 1.3 : 0.35;
    if (e.kind === 'boss')
      damage *=
        e.state === 'transition' ? 0.35 : e.state === 'windup' || e.state === 'followup' ? 0.3 : 1;
    e.hp -= damage;
    if (feedback) {
      const armored = blocked || damage < incomingDamage * 0.75;
      const directionToHit = from ? direction(e.body.position, from) : { x: 0, y: -1 };
      const impact = armored
        ? {
            x: e.body.position.x + directionToHit.x * ENEMY_STATS[e.kind].w * 0.5,
            y: e.body.position.y + directionToHit.y * ENEMY_STATS[e.kind].h * 0.5,
          }
        : e.body.position;
      e.flash = 0.08;
      this.burst(
        impact,
        4,
        armored ? '#e7d6ac' : '#f28a79',
        armored ? 2 : 2.3,
        armored ? directionToHit : undefined,
      );
      if (e.hp > 0) this.onSound(armored ? 'armor' : 'hit');
    }
    if (e.hp > 0) return blocked;
    if (
      isBoss(e.kind) &&
      !this.practice &&
      !this.workshop.active &&
      this.mode === 'playing' &&
      this.hp > 0 &&
      e.spawn <= 0
    )
      this.earnedSalvage = SALVAGE_BOSSES[e.kind] ?? null;
    breakSquad(this, e);
    releaseScrapper(this, e);
    this.harpoons.disrupt(e.body);
    this.kills++;
    this.tethers.disrupt(e.body);
    this.hp = Math.min(100, this.hp + this.gun.heal);
    Composite.remove(this.engine.world, e.body);
    if (e.crane) Composite.remove(this.engine.world, e.crane.body);
    clearKiln(e);
    clearArsenal(this, e);
    this.enemies = this.enemies.filter((x) => x !== e);
    if (e.kind === 'loader') this.loaderArena.stop();
    this.salvageEvolutions.killed(e, killEffects);
    if (
      isBoss(e.kind) &&
      !this.practice &&
      !this.testRun &&
      !this.workshop.active &&
      this.mode === 'playing' &&
      this.hp > 0 &&
      e.spawn <= 0
    )
      this.onBossDefeated(e.kind);
    this.feedback(isBoss(e.kind) ? 10 : 4);
    this.hitStop = Math.max(this.hitStop, isBoss(e.kind) ? 0.075 : 0.035);
    this.burst(e.body.position, isBoss(e.kind) ? 45 : 16, '#f28371', isBoss(e.kind) ? 8 : 4);
    if (this.particles.length < 220)
      this.particles.push({
        pos: { ...e.body.position },
        vel: { x: 0, y: 0 },
        life: 0.25,
        max: 0.25,
        size: isBoss(e.kind) ? 120 : 45,
        color: '#f28371',
        kind: 'ring',
      });
    this.onSound('kill');
    if (isBoss(e.kind)) for (const other of [...this.enemies]) this.hitEnemy(other, 9999);
    return blocked;
  }
  damagePlayer(amount: number, from?: Vec, cause: DamageCause = { type: 'unknown' }) {
    if (this.workshop.active) return;
    if (this.escape?.phase === 'extracting') return;
    if (this.mode !== 'playing' || this.time - this.hurtAt < 0.75) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtAt = this.time;
    this.feedback(8);
    this.hitStop = 0.045;
    this.burst(this.player.position, 12, '#f5eee1', 3);
    this.onSound('hurt');
    this.onHaptic('hurt', Math.min(1, 0.5 + amount / 40));
    if (from) {
      const d = direction(from, this.player.position);
      Body.setVelocity(this.player, { x: clamp(this.player.velocity.x + d.x * 4, -23, 23), y: -5 });
    }
    if (this.hp <= 0) this.die(cause);
  }
  die(cause: DamageCause = { type: 'unknown' }) {
    if (this.mode === 'dead' || this.mode === 'won') return;
    if (this.workshop.active) {
      this.startWorkshop(this.workshop.discovered, this.mods);
      return;
    }
    this.deathCause = loadDamageCause(cause);
    this.setMode('dead');
    if (!this.practice && !this.testRun) this.onCheckpoint(null);
    this.onSound('dead');
  }
  burst(pos: Vec, count: number, color: string, speed: number, dir?: Vec) {
    for (let i = 0; i < count && this.particles.length < 220; i++) {
      const angle = dir
        ? Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.4
        : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random()),
        life = 0.12 + Math.random() * 0.22;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * v, y: Math.sin(angle) * v },
        life,
        max: life,
        size: 1 + Math.random() * 2,
        color,
        kind: 'spark',
      });
    }
  }
  openReward(enterDetour = false, route?: RouteChoice) {
    if (this.practice || this.workshop.active || this.escape || this.mode !== 'playing') return;
    if (
      route &&
      (enterDetour ||
        !this.routeChoices.includes(route) ||
        !this.clear ||
        this.enemies.length ||
        this.waves.pending)
    )
      return;
    if (
      enterDetour &&
      (!this.canDetour || !this.clear || this.enemies.length || this.waves.pending)
    )
      return;
    if (this.detour && (!this.clear || this.enemies.length || this.waves.pending)) return;
    this.enteringDetour = enterDetour;
    this.enteringRoute = this.canChooseRoute ? (route ?? this.routeChoices[0]) : null;
    this.offers = rewardMods(
      this.mods,
      dailyFromSeed(this.seed) ? 1 : 3,
      seeded(this.layoutSeed + (this.detour ? ':detour-rewards:' : ':rewards:') + this.stage),
      { stage: this.stage, overtime: !!this.overtime, salvage: this.earnedSalvage },
    );
    if (this.overtime && this.offers.length === 0) this.offers = [REPAIR_REWARD];
    this.rewardTaken = false;
    this.rewardRerolled = false;
    this.setMode('upgrade');
    this.save();
  }
  private replacementOffers() {
    return rewardMods(
      this.mods,
      this.offers.length,
      seeded(
        this.layoutSeed + (this.detour ? ':detour-rewards:' : ':rewards:') + this.stage + ':reroll',
      ),
      { stage: this.stage, overtime: !!this.overtime },
      this.offers.map((m) => m.id),
    );
  }
  get canReroll() {
    return (
      !this.workshop.active &&
      this.mode === 'upgrade' &&
      !this.practice &&
      !dailyFromSeed(this.seed) &&
      !this.rewardTaken &&
      !this.rewardRerolled &&
      this.hp > REROLL_COST &&
      this.offers.length > 0 &&
      !this.offers.some((m) => m.id === 'repair') &&
      this.replacementOffers().length === this.offers.length
    );
  }
  rerollReward() {
    if (!this.canReroll) return false;
    const replacements = this.replacementOffers();
    this.hp -= REROLL_COST;
    this.rewardRerolled = true;
    this.offers = replacements;
    this.legacyOffers = undefined;
    this.save();
    this.onSound('upgrade');
    this.onChange();
    return true;
  }
  chooseMod(id: string) {
    if (this.practice || this.workshop.active) return;
    if (
      this.mode !== 'upgrade' ||
      this.rewardTaken ||
      !this.offers.some((m) => m.id === id) ||
      (isSalvage(id) && id !== this.earnedSalvage) ||
      (isFusion(id) && !fusionUnlocked({ stage: this.stage, overtime: !!this.overtime })) ||
      (isBranch(id) && !this.overtime && this.stage < BRANCH_STAGE) ||
      (!(id === 'repair' && this.overtime && availableMods(this.mods).length === 0) &&
        !availableMods(this.mods, true, !!this.legacyOffers?.includes(id)).some((m) => m.id === id))
    )
      return;
    if (this.enteringDetour && !this.canDetour) return;
    this.rewardTaken = true;
    if (id === 'repair' && this.overtime) this.overtime.repairs++;
    else this.mods.push(id);
    if (this.legacyOffers?.includes(id)) this.legacyMods = [...this.mods];
    this.legacyOffers = undefined;
    this.gun = getGun(this.mods);
    this.route = this.enteringRoute;
    if (this.detour) {
      this.detours.push(areaIndex(this.stage));
      this.detour = false;
      this.stage++;
    } else {
      this.hp = Math.min(100, this.hp + (id === 'repair' ? 24 : ROOM_HEAL));
      if (this.enteringDetour) this.detour = true;
      else this.stage++;
    }
    this.loadRoom();
    this.setMode('playing');
    this.save();
    this.onSound('upgrade');
  }
}
