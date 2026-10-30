import { seedLockedCombat } from './seed-lock.ts';
import { MachineBreakdown } from './machine-breakdown.ts';
import { OperatorSurface } from './operator-surface.ts';
import { factoryUnboundRoom, prepareFactoryUnbound } from './factory-unbound-room.ts';
import { shiftOfferAllowed } from './shift-catalog.ts';
import { ShiftMorphs } from './shift-morphs.ts';
import { ShiftRun } from './shift-run.ts';
import { ShiftUpgrades } from './shift-upgrades.ts';
import { ShiftFusions } from './shift-fusions.ts';
import { ShiftRoutes } from './shift-routes.ts';
import { uprisingRemasterSeed } from './uprising-remaster-rules.ts';
import { rivalShiftLevel } from './rival-shift-layout.ts';
import { firstShiftLevel } from './first-shift-layout.ts';
import type { SoundOrigin, SoundMaterial } from './sound-event.ts';
import {
  FinalTransformation,
  transformedLevel,
  transformedFinale,
} from './final-transformation.ts';
import { MeltThroughSystem, type MeltTransit } from './melt-through.ts';
import { BossGauntlet } from './gauntlet.ts';
import { QuickShift } from './quick-shift.ts';
import { bossRemixLevel } from './boss-remix-layout.ts';
import { BossRemasterSystem } from './boss-remaster.ts';
import { bossRemasterLevel } from './boss-remaster-layout.ts';
import { reclaimerFinale, cinematicFinale } from './boss-progression.ts';
import { resolveFinaleFirstClear } from './finale-progression.ts';
import { FinaleService } from './finale-service.ts';
import { FinalApproachSystem, finalApproachLevel } from './final-approach.ts';
import {
  createFinalArsenal,
  finalArsenalSeed,
  configureFinalePreview,
  finalePreviewLevel,
} from './final-arsenal.ts';
import { commandRemix, commandRemixAttack, commandRemixAngles } from './late-boss-patterns.ts';
import { TeamworkSystem, createSupport, isSupport, SUPPORT, type SupportRig } from './teamwork.ts';
import { teamworkLevel } from './teamwork-layout.ts';
import { ToolroomSystem, type ToolroomShot } from './toolroom-system.ts';
import { toolroomLevel } from './toolroom-layouts.ts';
import { remasterTestLevel } from './room-remaster.ts';
import { enemyEncounterRoom } from './enemy-encounters.ts';
import { combatFlowLevel } from './combat-flow-rooms.ts';
import { combatFocusLevel, prepareCombatFocus } from './combat-focus-test.ts';
import { damageControlLevel, prepareDamageControl } from './damage-control-test.ts';
import { remasterRouteLevel } from './route-remaster.ts';
import { chooseRouteCampaign, recordRouteDecision, type RouteDecision } from './route-history.ts';
import type { RoutePreview } from './route-preview.ts';
import { chooseRouteTestIdentity } from './choose-route-test.ts';
import { EnemyRemaster, type EnemyRemasterRig } from './enemy-remaster.ts';
import { PatrolMachineSystem, createPatrolRig, type PatrolRig } from './patrol-machine-system.ts';
import { isPatrolMachine, type MachineVariant } from './patrol-machines.ts';
import { CombatFeel, roundFeel, type RoundFeel } from './combat-feel.ts';
import { EncounterPacer } from './encounter-pacing.ts';
import { dailyStartingGun, isStartingGun, type StartingGun } from './starting-guns.ts';
import {
  campaignClearScore,
  type SecurityLevel,
  type SecurityRun,
  type SecurityScore,
} from './security.ts';
import { SecurityCombat } from './security-combat.ts';
import { redlineLayout, reinforceSecurity } from './security-layouts.ts';
import { MutationSystem, type MutationKind, type MutationRig } from './mutations.ts';
import { CourierSystem } from './courier.ts';
import { FloodgateSystem, type FloodValve } from './floodgate.ts';
import { SortingPitSystem } from './sorting-pit.ts';
import { ReforgeSystem } from './reforge.ts';
import { ShutdownSystem } from './shutdown.ts';
import { StorySystem } from './story-rooms.ts';
import {
  FabricatorSystem,
  createFabricator,
  type FabricatorRig,
  type SentryRig,
} from './fabricator.ts';
import { fabricatorLevel } from './fabricator-layout.ts';
import { AreaEventSystem, type EventRole } from './area-events.ts';
import { planFactory, factoryEncounter, type FactoryRun } from './factory.ts';
import { UprisingSystem } from './uprising-system.ts';
import { uprisingForks, type UprisingRun, type UprisingRouteId } from './uprising-model.ts';
import { PressureSystem, type PressureVent } from './pressure.ts';
import { CrosswindSystem } from './crosswind.ts';
import { StormfrontSystem } from './stormfront.ts';
import { LoaderArenaSystem } from './loader-arena.ts';
import { loadDamageCause, type DamageCause } from './damage-cause.ts';
import { DamageControl, DAMAGE_RECOVERY, type DamageHit } from './damage-control.ts';
import {
  WorkshopSystem,
  workshopLevel,
  isWorkshopScenario,
  type WorkshopTarget,
  type WorkshopScenario,
} from './workshop.ts';
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
import { ClockOut, CLOCK_OUT_ENTRY } from './clock-out.ts';
import Matter from 'matter-js';
import { WelderSystem, type WelderRig } from './welder.ts';
import { planWelder, welderLevel, welderPracticeLevel } from './welder-layout.ts';
import { AuditorSystem, type AuditorRig } from './auditor.ts';
import { auditorTestLevel } from './auditor-layout.ts';
import { CommendationTracker, type CommendationId, type KillSource } from './commendations.ts';
import { markShot, shotTrace, type WeaponTrace } from './weapon-mastery.ts';
import type { Cosmetics } from './cosmetics.ts';
import { CryogenicSystem } from './cryogenic.ts';
import { StasisSystem, suspended, type StasisFlight } from './stasis.ts';
import { MobilitySystem } from './mobility.ts';
import { loadUnlocks, draftUnlocked, type LongevityId, type MilestoneId } from './longevity.ts';
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
import { Hunts } from './hunts.ts';
import { isHunt } from './hunt-rules.ts';
import { getDetour, DETOUR_STEPS, DETOUR_DOOR, DETOUR_HEALTH } from './detours.ts';
import { MaintenanceSystem, maintenanceLevel, planMaintenance, SHAFT_TOP } from './maintenance.ts';
import { RecoilTrials } from './recoil-trials.ts';
import { planRecoilTrial } from './recoil-trial-rules.ts';
import { recoilTrialLevel, TRIAL_TOP } from './recoil-trial-layouts.ts';
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
  betterDraftCampaign,
  updateDraftDeclines,
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
  enemyShielded,
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
import type { GroundBossHunt } from './ground-boss-hunt.ts';
import { createKiln, updateKiln, clearKiln } from './kiln-ai.ts';
import type { KilnRig } from './kiln-ai.ts';
import { practiceCheckpoint } from './practice.ts';
import type { Encounter, PracticeSession } from './practice.ts';
import { ReinforcementSystem } from './reinforcements.ts';
import { recordShotTrace } from './shot-trails.ts';
import { FactionSystem } from './factions.ts';
import { SwitchboardSystem, createSwitchboard, type SwitchboardRig } from './switchboard.ts';
import { switchboardLevel } from './switchboard-layout.ts';
import { clearCaller, updateCaller, type CallerRig } from './caller.ts';
import { AnnexSystem } from './annex.ts';
import { annexLevel } from './annex-layout.ts';
import { annexRouteLevel } from './annex-route.ts';
import {
  dailyRegion,
  annexRevision,
  isAnnexStage,
  type RegionChoice,
  type RegionDecision,
} from './regions.ts';
import { SpoofSystem, primaryGunShot } from './spoof.ts';
import { SupportSystem, supportPoolAllowed } from './support-upgrades.ts';
import { CombatReport } from './combat-report.ts';
import { isSubversion } from './subversion-rules.ts';
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
export type Mode =
  | 'title'
  | 'playing'
  | 'paused'
  | 'upgrade'
  | 'reforge'
  | 'finale-service'
  | 'dead'
  | 'won'
  | 'shift-office';
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
  remaster?: EnemyRemasterRig;
  patrol?: PatrolRig;
  support?: SupportRig;
  recoilTarget?: number;
  hitDirection?: Vec;
  welder?: WelderRig;
  switchboard?: SwitchboardRig;
  caller?: CallerRig;
  auditor?: AuditorRig;
  fabricator?: FabricatorRig;
  sentry?: SentryRig;
  courier?: true;
  eventRole?: EventRole;
  allied?: boolean;
  rebootUntil?: number;
  rebootDuration?: number;
  rebootDamage?: number;
  workshopTarget?: WorkshopTarget;
  id: number;
  body: Matter.Body;
  kind: EnemyKind;
  elite?: EliteKind;
  mutation?: MutationRig;
  splitChild?: boolean;
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
  loaderClimb?: { platform: Matter.Body; x: number; launched: boolean };
  loaderDrop?: { platform: Matter.Body; x: number };
  loaderPerch?: { platform: Matter.Body; since: number };
  loaderCamp?: { at: Vec; since: number };
  crane?: CraneRig;
  groundHunt?: GroundBossHunt;
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
  nativeTool?: StartingGun;
  toolroom?: ToolroomShot;
  overkillSpent?: true;
  supportCharged?: true;
  feel?: RoundFeel;
  weaponTrace?: WeaponTrace;
  meltSpent?: boolean;
  meltTransit?: MeltTransit;
  molten?: boolean;
  signalOwner?: number;
  rebooted?: boolean;
  auditorOwner?: number;
  sentryOwner?: number;
  mutationShell?: { owner: number };
  allied?: boolean;
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
let soundSession = 0;

export class Game {
  // Cosmetic emitter identities never enter checkpoints or gameplay RNG.
  private readonly soundSession = ++soundSession;
  private soundRoom = 0;
  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
  player!: Matter.Body;
  level!: Level;
  terrain: Matter.Body[] = [];
  areaEvents = new AreaEventSystem(this);
  factory: FactoryRun | null = null;
  factions = new FactionSystem(this);
  annex = new AnnexSystem(this);
  switchboard = new SwitchboardSystem(this);
  spoof = new SpoofSystem(this);
  support = new SupportSystem(this);
  toolroom = new ToolroomSystem(this);
  shiftUpgrades = new ShiftUpgrades(this);
  shiftFusions = new ShiftFusions(this);
  shiftRoutes = new ShiftRoutes(this);
  shiftRun = new ShiftRun(this);
  shiftMorphs = new ShiftMorphs(this);
  private shiftOrigin: Vec | null = null;
  patrolMachines = new PatrolMachineSystem(this);
  combatReport = new CombatReport(this);
  mutations = new MutationSystem(this);
  courier = new CourierSystem(this);
  floodgate = new FloodgateSystem(this);
  sortingPit = new SortingPitSystem(this);
  reforge = new ReforgeSystem(this);
  story = new StorySystem(this);
  shutdown = new ShutdownSystem(this);
  fabricators = new FabricatorSystem(this);
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
  crosswind = new CrosswindSystem(this);
  stormfront = new StormfrontSystem(this);
  massDriver = new MassDriverSystem(this);
  breaches = new BreachSystem(this);
  waves = new ReinforcementSystem(this);
  encounters: 0 | 1 = 0;
  enemyRemaster = new EnemyRemaster(this);
  bossRemaster = new BossRemasterSystem(this);
  encounterPacer = new EncounterPacer(this);
  portals = new PortalSystem(this);
  portalRequest: Vec | null = null;
  demolition = new DemolitionSystem(this);
  evolutions = new EvolutionSystem(this);
  ballistics = new BallisticsSystem(this);
  cryogenic = new CryogenicSystem(this);
  stasis = new StasisSystem(this);
  mobility = new MobilitySystem(this);
  unlocks: LongevityId[] = [];
  onMilestone: (id: MilestoneId) => void = () => {};
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
  clockOut = new ClockOut();
  finale = new FinalTransformation(this);
  escape: EscapeState | null = null;
  extractionLift: Matter.Body | null = null;
  overtimeLift: Matter.Body | null = null;
  get worldWidth() {
    return this.escape ? ESCAPE_WIDTH : WORLD.width;
  }
  get worldTop() {
    return this.level?.recoilTrial === 'launch'
      ? TRIAL_TOP
      : this.level?.maintenance
        ? SHAFT_TOP
        : this.level?.freight
          ? FREIGHT.top
          : 0;
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
  combatFeel = new CombatFeel();
  machineBreakdown = new MachineBreakdown(this);
  operatorSurface = new OperatorSurface(this);
  trail: Vec[] = [];
  mode: Mode = 'title';
  cosmetics: Cosmetics = { gun: 'standard', outfit: 'standard' };
  commendations = new CommendationTracker(this);
  welder = new WelderSystem(this);
  melt = new MeltThroughSystem(this);
  welderReward = false;
  auditor = new AuditorSystem(this);
  auditorReward = false;
  practice: PracticeSession | null = null;
  gauntlet = new BossGauntlet(this);
  quickShift = new QuickShift(this);
  teamwork = new TeamworkSystem(this);
  bossRemixes = false;
  hunts = new Hunts(this);
  practiceHits = 0;
  workshop = new WorkshopSystem(this);
  seed = '';
  stage = 0;
  overtime: Checkpoint['overtime'] | null = null;
  security: SecurityRun | null = null;
  securityCombat = new SecurityCombat(this);
  private securityRecorded = false;
  onCampaignClear: (score: SecurityScore) => void = () => {};
  recordCampaignClear() {
    const score = campaignClearScore(this);
    if (!score || this.securityRecorded) return;
    this.securityRecorded = true;
    this.onCampaignClear(score);
    if (score.level === 3) this.onCommendation('redline');
  }
  missedUpgrades = 0;
  // An in-memory room copy is never a persisted checkpoint or a Practice unlock.
  testRun: (Checkpoint & { rematchRoom?: Level }) | null = null;
  detour = false;
  maintenance = new MaintenanceSystem(this);
  recoil = new RecoilTrials(this);
  detours: number[] = [];
  enteringDetour = false;
  route: RouteChoice | null = null;
  enteringRoute: RouteChoice | null = null;
  region: RegionDecision | null = null;
  uprising = new UprisingSystem(this);
  onUprisingMission: (route: UprisingRouteId, clean: boolean) => void = () => {};
  annexVersion: import('./regions.ts').AnnexVersion = 6;
  get inAnnex() {
    return (
      !this.practice &&
      !this.workshop.active &&
      !this.detour &&
      !this.escape &&
      isAnnexStage(this.region, this.stage, !!this.overtime, this.annexVersion)
    );
  }
  get regionChoices(): RegionChoice[] {
    if (
      !this.region ||
      this.stage !== 7 ||
      this.practice ||
      this.workshop.active ||
      this.overtime ||
      this.detour ||
      this.escape
    )
      return [];
    const daily = dailyFromSeed(this.seed);
    return daily ? [dailyRegion(this.seed)!].filter(Boolean) : ['cooling', 'annex'];
  }
  // Archived Daily links retain their encounter rules; current Practice has
  // its own versioned record table and always uses the corrected behavior.
  get adaptiveBosses() {
    const daily = /^RF-D(\d+)-/.exec(this.seed);
    return !!this.practice || !daily || Number(daily[1]) >= 85;
  }
  get canChooseRoute() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.escape &&
      !this.detour &&
      !this.inAnnex &&
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
  routeHistory: RouteDecision[] = [];
  private routePreviewCache = new Map<RouteChoice, RoutePreview | null>();
  private routePreviewContext = '';
  get nearbyRoutePreview(): RoutePreview | null {
    if (
      !chooseRouteCampaign(this.seed) ||
      this.overtime ||
      this.mode !== 'playing' ||
      !this.clear ||
      this.combatEnemyCount ||
      this.waves.pending ||
      !this.canChooseRoute
    )
      return null;
    const p = this.player.position;
    const choices = this.routeChoices.map((route) => ({
      route,
      x: DETOUR_DOOR.x,
      y: (route === 'high' ? this.branchDoor.floor : this.level.freight ? FREIGHT.dock : 740) - 32,
    }));
    const nearest = choices.sort(
      (a, b) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(p.x - b.x, p.y - b.y),
    )[0];
    return nearest && Math.hypot(p.x - nearest.x, p.y - nearest.y) <= 205
      ? this.createRoutePreview(nearest.route)
      : null;
  }
  // Resolve the exact native destination in a detached world. No callbacks,
  // ticking, combat RNG consumption or source checkpoint writes are involved.
  createRoutePreview(route: RouteChoice): RoutePreview | null {
    if (
      !chooseRouteCampaign(this.seed) ||
      this.overtime ||
      this.practice ||
      this.workshop.active ||
      !this.canChooseRoute ||
      !this.routeChoices.includes(route)
    )
      return null;
    const snapshot = this.checkpointSnapshot();
    // The same cleared room can still gain a completed job consequence or a
    // fitting. Cache actual destination inputs, excluding counters that change
    // as time passes or health recovers while the invitation stays visible.
    const {
      elapsed: _elapsed,
      hp: _hp,
      kills: _kills,
      combatResults: _combatResults,
      ...context
    } = snapshot;
    const contextKey = JSON.stringify(context);
    if (contextKey !== this.routePreviewContext) {
      this.routePreviewCache.clear();
      this.routePreviewContext = contextKey;
    }
    if (this.routePreviewCache.has(route)) return this.routePreviewCache.get(route) ?? null;
    const checkpoint = structuredClone(snapshot);
    checkpoint.stage = this.stage + 1;
    checkpoint.route = route;
    checkpoint.missedUpgrades = (checkpoint.missedUpgrades ?? 0) + 1;
    delete checkpoint.reward;
    delete checkpoint.escape;
    delete checkpoint.detour;
    delete checkpoint.reforgeRoom;
    let destination: Game | undefined;
    try {
      destination = new Game();
      destination.start(this.seed, checkpoint);
      const preview: RoutePreview = {
        route,
        stage: destination.stage,
        level: structuredClone(destination.level),
        checkpoint: destination.checkpointSnapshot(),
      };
      this.routePreviewCache.set(route, preview);
      return preview;
    } catch {
      this.routePreviewCache.set(route, null);
      return null;
    } finally {
      if (destination) {
        Composite.clear(destination.engine.world, false);
        Engine.clear(destination.engine);
      }
    }
  }
  detourStepsReady = false;
  get canDetour() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.overtime &&
      !this.escape &&
      !this.detour &&
      !this.inAnnex &&
      isDetourStage(this.stage) &&
      !this.detours.includes(areaIndex(this.stage))
    );
  }
  get roomSeed() {
    return this.layoutSeed + (this.detour ? ':detour:' + this.stage : '');
  }
  get reservedEncounterStages() {
    const stages = [
      ...(this.factory?.encounters.map((e) => e.stage) ?? []),
      ...this.hunts.reservedStages,
    ];
    return this.uprising.run
      ? [...(stages ?? []), ...uprisingForks(this.uprising.run).map((f) => f + 1)]
      : stages;
  }
  get layoutSeed() {
    return this.overtime ? overtimeSeed(this.seed) : this.seed;
  }
  reachedFinalePhase: 0 | 1 | 2 = 0;
  finaleService = new FinaleService(this);
  finalApproach = new FinalApproachSystem(this);
  finaleFirstClear = true;
  get canOvertime() {
    return (
      !this.workshop.active &&
      !this.practice &&
      !this.overtime &&
      !!this.escape &&
      !this.detour &&
      this.stage === STAGES - 1 &&
      !dailyFromSeed(this.seed) &&
      (!cinematicFinale(this.seed) || !this.finaleFirstClear)
    );
  }
  get canBranch() {
    return (
      !this.shutdown.chamber &&
      (this.canDetour || this.routeChoices.length === 2 || this.regionChoices.length === 2)
    );
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
  damageControl = new DamageControl();
  deathCause: DamageCause | null = null;
  mods: string[] = [];
  legacyMods?: string[];
  legacyOffers?: string[];
  startingGun: StartingGun = 'pistol';
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
  private cosmeticRng = seeded('run:cosmetic:seed-lock-1');
  /** Visual noise never advances a Seed Lock run's native combat stream. */
  cosmeticRandom() {
    return seedLockedCombat(this.seed) ? this.cosmeticRng() : Math.random();
  }
  rewardTaken = false;
  courierReward = false;
  rewardRerolled = false;
  heldReward: string | null = null;
  draftHistory: Checkpoint['draftHistory'];
  get recentDeclined() {
    return this.draftHistory?.zone === areaIndex(this.stage) ? this.draftHistory.declined : [];
  }
  private rememberDeclined(ids: readonly string[]) {
    if (!betterDraftCampaign(this.seed)) return;
    this.draftHistory = {
      zone: areaIndex(this.stage),
      declined: updateDraftDeclines(this.recentDeclined, ids),
    };
  }
  onChange: () => void = () => {};
  onDeath: (origin?: Vec) => void = () => {};
  onDamage: (hit: DamageHit) => void = () => {};
  onSound: (kind: string, origin?: SoundOrigin) => void = () => {};
  soundAt(kind: string, position: Vec, source?: string, material?: SoundMaterial) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      this.onSound(kind);
      return;
    }
    this.onSound(kind, {
      x: position.x,
      y: position.y,
      ...(source ? { source: `${this.soundSession}:${this.soundRoom}:${source}` } : {}),
      ...(material ? { material } : {}),
    });
  }
  onHaptic: (kind: 'shot' | 'land' | 'hurt', strength: number) => void = () => {};
  onCheckpoint: (save: Checkpoint | null) => void = () => {};
  onBossDefeated: (kind: EnemyKind) => void = () => {};
  onEnemyDefeated: (kind: EnemyKind) => void = () => {};
  onEnemyEncountered: (enemy: Enemy) => void = () => {};
  private reportedEncounters = new Set<number>();
  onCommendation: (id: CommendationId) => void = () => {};
  constructor() {
    Matter.Events.on(this.engine, 'beforeSolve', () => {
      this.counterweights.afterIntegrate();
      this.portals.afterIntegrate();
      this.sappers.afterIntegrate();
    });
    this.loadRoom();
  }
  setMode(mode: Mode) {
    if (mode === 'dead' || mode === 'title') this.bossRemaster.clear();
    if (mode === 'dead') {
      this.gauntlet.died();
      this.quickShift.died();
    }
    if (mode === 'won') this.recordCampaignClear();
    if (mode === 'dead' || mode === 'won' || mode === 'title') this.securityCombat.reset();
    if (mode === 'title') {
      this.machineBreakdown.reset();
      this.gauntlet.reset();
      this.quickShift.reset();
      this.clockOut = new ClockOut();
      this.recoil.race.reset();
    }
    if (mode === 'dead' || mode === 'won' || mode === 'title') this.melt.reset();
    if (mode === 'paused' && this.auditor.enemy) this.save();
    if (mode === 'paused' && this.recoil.active) this.save();
    if (mode !== 'playing') {
      this.operatorSurface.pause(mode === 'paused');
      this.stasis.held = false;
      this.mobility.pause();
      this.shiftUpgrades.pause();
      this.shiftMorphs.pause();
      this.burstRemaining = 0;
      this.portalRequest = null;
      if (this.mods.includes('charge-lens')) this.torch.stop();
    }
    if (mode === 'dead' || mode === 'won' || mode === 'title') {
      this.combatFeel.reset();
      this.commendations.weapons.reset();
      this.welder.clear();
      this.switchboard.clear();
      this.annex.clear();
      this.spoof.clear();
      this.fabricators.clear();
      this.teamwork.clear();
      this.courier.clear();
      this.areaEvents.clear();
      this.mutations.clear();
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
        clearCaller(e);
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
      this.support.reset();
      this.toolroom.reset();
      this.patrolMachines.clear();
      this.fusions.reset();
      this.shiftFusions.reset();
      this.shiftUpgrades.reset();
      this.shiftMorphs.reset();
      this.shiftOrigin = null;
      this.harpoons.clear();
    }
    this.mode = mode;
    if (mode === 'playing') this.combatReport.checkMasteries();
    this.onChange();
  }
  startPractice(
    encounter: Encounter,
    mods: readonly string[] | null = null,
    known: readonly string[] = [],
  ) {
    const save = practiceCheckpoint(encounter, mods, known);
    if (!save) return false;
    this.start(save.seed, save, {
      kind: encounter.kind,
      seed: encounter.seed,
      ...(encounter.remix ? { remix: encounter.remix } : {}),
      ...(mods === null ? {} : { build: [...save.mods] }),
    });
    return true;
  }
  startWorkshop(
    discovered: readonly string[],
    mods: readonly string[] = [],
    startingGun: StartingGun = 'pistol',
    scenario: WorkshopScenario = this.workshop.active ? this.workshop.scenario : 'standard',
  ) {
    this.workshop.scenario = isWorkshopScenario(scenario) ? scenario : 'standard';
    this.workshop.discovered = loadDiscoveries(discovered);
    const build = workshopBuild(mods, this.workshop.discovered);
    this.start(
      'WORKSHOP',
      {
        version: 6,
        seed: 'WORKSHOP',
        startingGun,
        stage: 0,
        hp: 100,
        mods: build,
        kills: 0,
        elapsed: 0,
      },
      null,
      null,
      true,
    );
  }
  setWorkshopScenario(scenario: WorkshopScenario) {
    if (!this.workshop.active || !isWorkshopScenario(scenario)) return false;
    this.startWorkshop(this.workshop.discovered, this.mods, this.startingGun, scenario);
    return true;
  }
  resetWorkshop() {
    if (!this.workshop.active) return false;
    return this.setWorkshopScenario(this.workshop.scenario);
  }
  startTest(save: Checkpoint, rematchRoom?: Level) {
    this.start(save.seed, save, null, rematchRoom ? { ...save, rematchRoom } : save);
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
    practice: PracticeSession | null = null,
    testRun: (Checkpoint & { rematchRoom?: Level }) | null = null,
    workshop = false,
    securityLevel: SecurityLevel = 0,
    factoryRules: boolean | 1 | 2 | 3 | 4 = true,
    unlocks: readonly string[] = [],
    uprising: UprisingRun | null = null,
    startingGun: StartingGun = 'pistol',
    encounterRules: 0 | 1 = 1,
    recoilRules = true,
    teamworkRules = true,
    remixRules = false,
    huntRules: boolean | 1 | 2 = false,
    huntOrder?: readonly import('./hunt-rules.ts').HuntKind[],
    finaleFirstClear = true,
  ) {
    this.workshop.active = workshop;
    this.gauntlet.reset();
    if (!this.quickShift.loading) this.quickShift.reset();
    this.maintenance.trial = null;
    this.recoil.practice = null;
    this.practice = practice;
    this.practiceHits = 0;
    this.testRun = testRun ? structuredClone(testRun) : null;
    this.seed = seed.slice(0, 40) || 'RECOIL';
    this.routeHistory = chooseRouteCampaign(this.seed)
      ? structuredClone(save?.routeHistory ?? [])
      : [];
    this.heldReward = null;
    this.draftHistory =
      betterDraftCampaign(this.seed) && save?.draftHistory
        ? structuredClone(save.draftHistory)
        : undefined;
    this.finaleFirstClear = resolveFinaleFirstClear(this.seed, save, finaleFirstClear);
    const requestedGun = save
      ? (save.startingGun ?? 'pistol')
      : practice || testRun || workshop
        ? 'pistol'
        : startingGun;
    this.startingGun =
      dailyStartingGun(this.seed) ?? (isStartingGun(requestedGun) ? requestedGun : 'pistol');
    this.encounters =
      practice || workshop || /^RF-D\d+-/.test(this.seed)
        ? 0
        : save
          ? (save.encounters ?? 0)
          : testRun
            ? 0
            : encounterRules;
    this.teamwork.enabled =
      this.encounters === 1 &&
      !practice &&
      !workshop &&
      !/^RF-D\d+-/.test(this.seed) &&
      (save ? save.teamwork === 1 : !testRun && teamworkRules);
    this.bossRemixes =
      this.encounters === 1 &&
      !practice &&
      (!testRun || !!testRun.rematchRoom) &&
      !workshop &&
      !/^RF-D\d+-/.test(this.seed) &&
      (save ? save.bossRemixes === 1 : remixRules);
    this.hunts.start(save, huntRules, huntOrder);
    this.unlocks = /^RF-D\d+-/.test(this.seed) ? [] : loadUnlocks(save ? save.unlocks : unlocks);
    this.uprising.run =
      !practice && !workshop && !/^RF-D\d+-/.test(this.seed)
        ? structuredClone(save ? (save.uprising ?? null) : uprising)
        : null;
    if (!save && this.uprising.run && uprisingRemasterSeed(this.seed))
      this.uprising.run.version = 3;
    this.security =
      !practice && !workshop && !/^RF-D\d+-/.test(this.seed)
        ? save?.security
          ? { ...save.security }
          : !save && securityLevel
            ? { level: securityLevel, rules: 1 }
            : null
        : null;
    this.securityRecorded = !!save?.overtime;
    this.factory =
      !practice && (!testRun || !!testRun.rematchRoom) && !workshop && !/^RF-D\d+-/.test(this.seed)
        ? save
          ? save.factory
            ? structuredClone(save.factory)
            : null
          : factoryRules
            ? planFactory(
                this.seed,
                typeof factoryRules === 'number' ? factoryRules : this.uprising.run ? 4 : undefined,
              )
            : null
        : null;
    this.areaEvents.start(save);
    this.courier.start(save);
    this.floodgate.start(save);
    this.reforge.start(save);
    this.story.start(save);
    this.shutdown.start(save);
    this.auditor.start(save);
    this.sortingPit.start(save);
    this.welder.state = save?.welder ? structuredClone(save.welder) : null;
    this.fabricators.enabled = save ? save.fabricators === true : true;
    this.stage = save?.stage ?? 0;
    this.overtime = !practice && save?.overtime ? { ...save.overtime } : null;
    this.missedUpgrades = save?.missedUpgrades ?? 0;
    this.detour = !practice && save?.detour === true;
    this.detours = !practice ? [...(save?.detours ?? [])] : [];
    this.maintenance.state =
      practice || workshop
        ? null
        : save
          ? save.maintenance
            ? { ...save.maintenance }
            : null
          : planMaintenance(this.seed);
    this.recoil.state =
      practice || workshop
        ? null
        : save
          ? save.recoilTrial
            ? { ...save.recoilTrial }
            : null
          : !testRun && recoilRules && encounterRules === 1
            ? planRecoilTrial(this.seed, this.maintenance.state?.stage)
            : null;
    this.region =
      save?.region ??
      dailyRegion(this.seed) ??
      (!save && !dailyFromSeed(this.seed) ? 'pending' : null);
    this.annexVersion = annexRevision(this.seed, save);
    this.route =
      !practice &&
      !this.detour &&
      !save?.escape &&
      !isAnnexStage(this.region, this.stage, !!this.overtime, this.annexVersion) &&
      isRouteStage(this.stage)
        ? dailyFromSeed(this.seed)
          ? dailyRoute(this.seed, this.stage)
          : (save?.route ?? null)
        : null;
    this.hp = save?.hp ?? 100;
    this.deathCause = null;
    this.mods = save ? [...save.mods] : [];
    this.legacyMods = save?.legacyMods ? [...save.legacyMods] : undefined;
    this.legacyOffers = save?.legacyOffers ? [...save.legacyOffers] : undefined;
    this.gun = getGun(this.mods, this.startingGun);
    this.elapsed = save?.elapsed ?? 0;
    this.kills = save?.kills ?? 0;
    this.combatReport.reset(
      save?.combatResults,
      save &&
        !practice &&
        !testRun &&
        !workshop &&
        (save.stage > 0 || save.elapsed > 0 || save.kills > 0)
        ? save.stage
        : undefined,
    );
    this.time = 0;
    this.shotCount = 0;
    this.shootAt = 0;
    this.hurtAt = -100;
    this.lastShot = -100;
    this.offers = [];
    this.auditorReward = false;
    this.welderReward = false;
    const shutdownInspection =
      !!this.testRun?.shutdown && ['SHUTDOWN-89-RELAY', 'SHUTDOWN-89-ENTRANCE'].includes(this.seed);
    const storyInspection = !!this.testRun?.story && this.testRun.seed.endsWith('-INSPECT');
    const disabledRoom =
      !!save?.shutdown?.disabled.includes(this.stage) &&
      !save.shutdown.chamber &&
      !save.overtime &&
      !save.escape &&
      !save.detour;
    this.shiftRoutes.start(save ?? testRun ?? undefined);
    this.shiftRun.start(save ?? testRun ?? undefined);
    // Quick Shift owns its draft and optional job; Campaign offices stay private.
    if (this.quickShift.loading) this.shiftRun.state = null;
    this.finaleService.start(save);
    this.loadRoom(
      save?.escape === true,
      !!save?.reward ||
        save?.hunt?.phase === 'reward' ||
        (save?.hunt?.phase === 'finished' && save.stage === save.hunt.stage) ||
        !!save?.hunts?.some(
          (s) => s.stage === save.stage && ['reward', 'finished'].includes(s.phase),
        ) ||
        (!!this.testRun?.annexRouteTest?.fork && this.stage === 7) ||
        !!save?.reforgeRoom ||
        storyInspection ||
        shutdownInspection ||
        disabledRoom ||
        (!!save?.auditor &&
          save.auditor.caseStage === this.stage &&
          (save.auditor.status !== 'sealed' || !!this.testRun?.auditor)),
    );
    if (save) this.commendations.cleanBoss = save.cleanBoss === true;
    if (save?.detour && this.maintenance.active)
      this.maintenance.state!.clean = save.maintenance?.clean === true;
    if (this.testRun?.annexRouteTest?.fork && this.stage === 7) {
      Body.setPosition(this.player, { x: 1660, y: 720 });
      Body.setVelocity(this.player, { x: 0, y: 0 });
    }
    if (storyInspection && this.story.note) {
      Body.setPosition(this.player, { x: this.story.note.x - 35, y: this.story.note.y + 16 });
      Body.setVelocity(this.player, { x: 0, y: 0 });
    }
    if (save?.reforgeRoom) {
      this.earnedSalvage = save.reforgeRoom.salvage ?? null;
      if (this.reforge.site && !save.reward) {
        Body.setPosition(this.player, {
          x: this.reforge.site.x - 52,
          y: this.reforge.site.floor - 18,
        });
        this.grounded = true;
      }
    }
    if (save?.reward) {
      this.offers = save.reward.offers.map((id) =>
        id === 'repair' ? REPAIR_REWARD : MODS.find((m) => m.id === id)!,
      );
      this.rewardRerolled = save.reward.rerolled;
      this.heldReward = save.reward.held ?? null;
      this.courierReward = save.reward.courier === true;
      this.auditorReward = save.reward.auditor === true;
      this.welderReward = save.reward.welder === true;
      this.earnedSalvage = save.reward.salvage ?? null;
      this.enteringDetour = save.reward.enteringDetour === true;
      this.enteringRoute = save.reward.enteringRoute ?? null;
    }
    this.setMode(
      save?.reward || this.hunts.rewarding
        ? 'upgrade'
        : this.finaleService.open && this.finaleService.available
          ? 'finale-service'
          : save?.reforgeRoom?.open && this.reforge.site
            ? 'reforge'
            : 'playing',
    );
    prepareFactoryUnbound(this);
    this.save();
  }
  save() {
    if (this.practice || this.testRun || this.workshop.active) return;
    this.onCheckpoint(this.checkpointSnapshot());
  }
  checkpointSnapshot(): Checkpoint {
    return {
      version: 6,
      ...(this.shiftRun.snapshot() ? { shiftRun: this.shiftRun.snapshot() } : {}),
      startingGun: this.startingGun,
      ...(this.shiftRoutes.snapshot() ? { shiftRoute: this.shiftRoutes.snapshot() } : {}),
      ...(this.shiftRoutes.lastRework
        ? { shiftRework: structuredClone(this.shiftRoutes.lastRework) }
        : {}),
      ...(chooseRouteCampaign(this.seed) && this.routeHistory.length
        ? { routeHistory: structuredClone(this.routeHistory) }
        : {}),
      ...(betterDraftCampaign(this.seed) && this.draftHistory
        ? { draftHistory: structuredClone(this.draftHistory) }
        : {}),
      ...(this.finaleService.checkpoint ? { finaleService: this.finaleService.checkpoint } : {}),
      ...(cinematicFinale(this.seed)
        ? { finaleFirstClear: this.finaleFirstClear ? (1 as const) : (0 as const) }
        : {}),
      ...(this.encounters ? { encounters: this.encounters } : {}),
      ...(this.teamwork.enabled ? { teamwork: 1 as const } : {}),
      ...(this.bossRemixes ? { bossRemixes: 1 as const } : {}),
      ...(this.hunts.enabled
        ? {
            huntRules: this.hunts.rules as 1 | 2,
            ...(this.hunts.rules === 2
              ? { hunts: structuredClone(this.hunts.plans) }
              : this.hunts.state
                ? { hunt: structuredClone(this.hunts.state) }
                : {}),
          }
        : {}),
      ...(!/^RF-D\d+-/.test(this.seed) ? { unlocks: [...this.unlocks] } : {}),
      ...(this.factory ? { factory: structuredClone(this.factory) } : {}),
      ...(this.uprising.run ? { uprising: structuredClone(this.uprising.run) } : {}),
      ...(this.security ? { security: { ...this.security } } : {}),
      ...(this.maintenance.state ? { maintenance: { ...this.maintenance.state } } : {}),
      ...(this.recoil.state ? { recoilTrial: this.recoil.snapshot()! } : {}),
      ...(this.welder.state ? { welder: structuredClone(this.welder.state) } : {}),
      ...(this.auditor.state ? { auditor: structuredClone(this.auditor.state) } : {}),
      ...(this.level.boss && !this.escape ? { cleanBoss: this.commendations.cleanBoss } : {}),
      ...(this.fabricators.enabled ? { fabricators: true as const } : {}),
      ...(this.courier.state ? { courier: { ...this.courier.state } } : {}),
      ...(this.floodgate.stage !== null ? { floodgate: this.floodgate.stage } : {}),
      ...(this.sortingPit.stage !== null ? { sortingPit: this.sortingPit.stage } : {}),
      ...(this.reforge.state ? { reforge: { ...this.reforge.state } } : {}),
      ...(this.shutdown.state ? { shutdown: structuredClone(this.shutdown.state) } : {}),
      ...(this.story.state ? { story: { ...this.story.state } } : {}),
      ...(this.reforge.roomSave ? { reforgeRoom: this.reforge.roomSave } : {}),
      ...(!this.factory && this.areaEvents.state
        ? { areaEvent: structuredClone(this.areaEvents.state) }
        : {}),
      ...(this.legacyMods ? { legacyMods: [...this.legacyMods] } : {}),
      ...(this.legacyOffers ? { legacyOffers: [...this.legacyOffers] } : {}),
      seed: this.seed,
      stage: this.stage,
      hp: this.hp,
      mods: [...this.mods],
      kills: this.kills,
      elapsed: this.elapsed,
      combatResults: this.combatReport.snapshot(),
      ...(this.missedUpgrades ? { missedUpgrades: this.missedUpgrades } : {}),
      ...(this.escape ? { escape: true as const } : {}),
      ...(this.detour ? { detour: true as const } : {}),
      ...(this.detours.length ? { detours: [...this.detours] } : {}),
      ...(this.overtime ? { overtime: { ...this.overtime } } : {}),
      ...(this.route ? { route: this.route } : {}),
      ...(this.region ? { region: this.region, annexVersion: this.annexVersion } : {}),
      ...(this.mode === 'upgrade' && !this.rewardTaken && !this.hunts.rewarding
        ? {
            reward: {
              offers: this.offers.map((m) => m.id),
              rerolled: this.rewardRerolled,
              ...(this.heldReward ? { held: this.heldReward } : {}),
              ...(this.courierReward ? { courier: true as const } : {}),
              ...(this.welderReward ? { welder: true as const } : {}),
              ...(this.auditorReward ? { auditor: true as const } : {}),
              ...(this.earnedSalvage ? { salvage: this.earnedSalvage } : {}),
              ...(this.enteringDetour ? { enteringDetour: true as const } : {}),
              ...(this.enteringRoute ? { enteringRoute: this.enteringRoute } : {}),
            },
          }
        : {}),
    };
  }
  loadRoom(escapeRoom = false, clearedRoom = false) {
    this.operatorSurface.reset();
    this.machineBreakdown.reset();
    this.bossRemaster.clear();
    this.routePreviewCache.clear();
    this.routePreviewContext = '';
    this.damageControl.reset();
    this.soundRoom++;
    this.reachedFinalePhase = 0;
    this.uprising.clear();
    this.reportedEncounters.clear();
    this.clockOut = new ClockOut();
    this.switchboard.clear();
    this.annex.clear();
    this.spoof.clear();
    this.auditor.clear();
    this.welder.clear();
    this.commendations.resetRoom();
    this.fabricators.clear();
    this.teamwork.clear();
    this.floodgate.clear();
    this.sortingPit.clear();
    this.courier.clear();
    this.areaEvents.clear();
    this.mutations.clear();
    this.breachAt = -1;
    this.breachClears = 0;
    this.massDriver.reset();
    this.earnedSalvage = null;
    this.melt.reset();
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
    this.support.reset();
    this.toolroom.reset();
    this.patrolMachines.clear();
    this.fusions.reset();
    this.shiftFusions.reset();
    this.shiftUpgrades.reset();
    this.shiftMorphs.reset();
    this.shiftOrigin = null;
    this.harpoons.clear();
    this.magnets.items = [];
    this.conveyors.clear();
    this.freight.clear();
    this.crossing.clear();
    this.counterweights.clear();
    this.pressure.clear();
    this.crosswind.clear();
    this.stormfront.clear();
    this.finalApproach.clear();
    this.portals.reset();
    this.demolition.clear();
    this.portalRequest = null;
    for (const enemy of this.enemies) {
      clearKiln(enemy);
      clearCaller(enemy);
    }
    Composite.clear(this.engine.world, false);
    this.securityCombat.reset();
    Engine.clear(this.engine);
    this.escape = escapeRoom ? { phase: 'route', time: 0, depart: 0 } : null;
    this.extractionLift = null;
    this.overtimeLift = null;
    this.breaches.clear();
    this.terrain = [];
    this.enemies = [];
    this.shots = [];
    this.particles = [];
    this.combatFeel.reset();
    this.trail = [];
    this.clear = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.fireBuffer = 0;
    this.jumpCut = false;
    this.jumpAt = -100;
    this.grounded = false;
    this.rewardTaken = false;
    this.courierReward = false;
    this.auditorReward = false;
    this.welderReward = false;
    this.rewardRerolled = false;
    this.heldReward = null;
    if (this.draftHistory?.zone !== areaIndex(this.stage)) this.draftHistory = undefined;
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
    this.cosmeticRng = seeded(this.roomSeed + ':' + this.stage + ':cosmetic:seed-lock-1');
    const wall = (x: number, y: number, w: number, h: number) => {
      const b = Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0, label: 'terrain' });
      this.terrain.push(b);
      Composite.add(this.engine.world, b);
    };
    this.areaEvents.selectFactoryEvent();
    const planned =
      !escapeRoom && !this.detour && !this.overtime
        ? factoryEncounter(this.factory, this.stage)
        : undefined;
    const huntRoom = this.hunts.level();
    this.level = this.workshop.active
      ? workshopLevel(this.workshop.scenario)
      : escapeRoom
        ? {
            ...ESCAPE_LAYOUT,
            solids: ESCAPE_LAYOUT.solids.map((s) => ({ ...s })),
            route: ESCAPE_LAYOUT.route.map((p) => ({ ...p })),
            spawns: [],
          }
        : huntRoom
          ? huntRoom
          : this.detour
            ? this.recoil.scheduled
              ? recoilTrialLevel(this.recoil.state!.kind)
              : this.maintenance.scheduled
                ? maintenanceLevel(
                    this.maintenance.state!.kind,
                    this.seed,
                    this.maintenance.state!.revision,
                  )
                : getDetour(this.seed, this.stage)
            : this.overtime
              ? getOvertimeLevel(this.seed, this.stage, this.overtime.remix, this.route)
              : getLevel(
                  this.seed,
                  this.stage,
                  this.practice?.kind === 'condenser' ? 'condenser' : undefined,
                  this.practice?.kind === 'boss' ||
                    this.practice?.kind === 'sorter' ||
                    this.practice?.kind === 'interceptor'
                    ? this.practice.kind
                    : undefined,
                  planned
                    ? {
                        crossing: planned.kind === 'crossing',
                        freight: planned.kind === 'freight',
                        ordinary: true,
                      }
                    : undefined,
                );
    // The opening faction fight teaches one mechanic with a small roster;
    // its authored crew replaces the standard patrol rather than piling on.
    if (planned?.kind === 'turf' && this.stage === this.factory?.encounters[0].stage)
      this.level.spawns = [];
    if (
      this.route &&
      !escapeRoom &&
      !this.detour &&
      !this.level.overtimeDocks &&
      !this.level.overtimeFurnace &&
      !this.level.overtimeCooling &&
      !this.level.overtimeReclamation &&
      !this.level.overtimeRooftops
    ) {
      this.level = getRouteLevel(this.layoutSeed, this.stage, this.route);
      if (!this.overtime)
        this.level = remasterRouteLevel(
          this.level,
          this.seed,
          this.stage,
          this.route,
          this.teamwork.enabled,
        );
      if (this.overtime) this.level = reinforceRoute(this.level, this.seed, this.stage);
    }
    if (this.inAnnex && this.stage < 11)
      this.level = annexRouteLevel(
        this.seed,
        this.stage,
        this.testRun?.annexRouteTest?.mirror,
        this.annexVersion,
        this.testRun?.annexRouteTest?.layout,
      );
    if ((this.inAnnex && this.stage === 11) || this.practice?.kind === 'switchboard')
      this.level = switchboardLevel(
        this.seed,
        this.testRun?.switchboardTest?.mirror ?? this.testRun?.annexRouteTest?.mirror,
      );
    if (!escapeRoom && !this.inAnnex) this.level = this.courier.level(this.level);
    if (!escapeRoom && !this.inAnnex) this.level = this.floodgate.level(this.level);
    if (!escapeRoom && !this.inAnnex) this.level = this.story.level(this.level);
    if (!escapeRoom && !this.inAnnex) this.level = this.sortingPit.level(this.level);
    if (!escapeRoom && !this.inAnnex) this.level = fabricatorLevel(this, this.level);
    this.level = this.shutdown.level(this.level);
    if (this.testRun?.auditor && !escapeRoom && !this.detour)
      this.level = auditorTestLevel(this.level);
    if (this.testRun?.annex && !escapeRoom) this.level = annexLevel(this.testRun.annex);
    if (!escapeRoom && this.overtime)
      this.level = welderLevel(this.level, this.welder.state, this.stage);
    if (this.practice?.kind === 'welder') this.level = welderPracticeLevel(this.seed);
    this.level = bossRemixLevel(this, this.level);
    this.level = rivalShiftLevel(this, bossRemasterLevel(this, firstShiftLevel(this, this.level)));
    if (
      !escapeRoom &&
      !this.overtime &&
      !this.detour &&
      !this.practice &&
      !this.workshop.active &&
      this.security
    ) {
      if (
        this.security.level === 3 &&
        this.stage % 4 === 0 &&
        !this.level.annex &&
        !this.level.story &&
        !this.level.shutdown &&
        !this.level.courier &&
        !this.level.floodgate &&
        !this.level.sortingPit &&
        !this.areaEvents.encounter
      )
        this.level = redlineLayout(this.level, this.stage);
      if (!this.areaEvents.encounter)
        this.level = reinforceSecurity(this.level, this.seed, this.stage, this.security.level);
    }
    this.level = this.uprising.level(this.level);
    // The final Uprising defense authors its own arena. New final remixes are
    // applied after that choice so its boss identity is retained.
    if (this.stage === 19) this.level = bossRemixLevel(this, this.level);
    if (this.security && this.level.id.startsWith('uprising-'))
      this.level = reinforceSecurity(this.level, this.seed, this.stage, this.security.level);
    this.level = toolroomLevel(this, this.level);
    this.level = teamworkLevel(this, this.level);
    this.level = remasterTestLevel(this, this.level);
    this.level = huntRoom ?? this.level;
    this.level = enemyEncounterRoom(this, this.level);
    this.level = combatFlowLevel(this, this.level);
    this.level = finalApproachLevel(this, this.level);
    this.level = combatFocusLevel(this, this.level);
    this.level = damageControlLevel(this, this.level);
    this.level = finalePreviewLevel(this, this.level);
    this.level = transformedLevel(this, this.level);
    this.level = factoryUnboundRoom(this, this.level);
    if (!escapeRoom && !this.detour && !huntRoom) this.level = this.shiftRoutes.level(this.level);
    if (this.testRun?.rematchRoom) this.level = structuredClone(this.testRun.rematchRoom);
    if (this.canOvertime && !this.testRun?.rematchRoom)
      this.level.solids.push(...OVERTIME_STEPS.map((s) => ({ ...s })));
    wall(this.worldWidth / 2, 790, this.worldWidth, 100);
    wall(-30, (this.worldTop + 800) / 2, 60, 900 - this.worldTop);
    wall(this.worldWidth + 30, (this.worldTop + 800) / 2, 60, 900 - this.worldTop);
    wall(this.worldWidth / 2, this.worldTop - 40, this.worldWidth, 80);
    for (const solid of this.level.solids)
      wall(solid.x + solid.w / 2, solid.y + solid.h / 2, solid.w, solid.h);
    this.player = Bodies.rectangle(
      escapeRoom && this.overtime ? CLOCK_OUT_ENTRY.x : 140,
      CLOCK_OUT_ENTRY.y,
      26,
      36,
      {
        inertia: Infinity,
        friction: 0,
        frictionAir: 0.008,
        restitution: 0,
        chamfer: { radius: 4 },
        label: 'player',
        collisionFilter: { mask: 0x7fff },
      },
    );
    Composite.add(this.engine.world, this.player);
    this.counterweights.reset();
    if (clearedRoom) {
      this.waves.clear();
      this.clear = true;
      this.clearAt = this.time;
    } else {
      for (const spawn of this.waves.reset(this.level))
        this.spawnEnemy(
          spawn.kind,
          spawn.x,
          spawn.y,
          spawn.elite,
          undefined,
          this.level.security ? spawn.squad : undefined,
          spawn.mutation,
          spawn.machineVariant,
        );
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
    this.crosswind.reset();
    this.stormfront.reset();
    this.finalApproach.reset(clearedRoom);
    this.workshop.reset();
    this.areaEvents.reset(clearedRoom);
    this.mutations.reset(clearedRoom);
    this.courier.reset(clearedRoom);
    this.floodgate.reset(clearedRoom);
    this.sortingPit.reset(clearedRoom);
    this.reforge.reset();
    this.story.reset();
    this.shutdown.reset();
    this.auditor.reset();
    this.annex.reset();
    this.maintenance.reset(clearedRoom);
    this.recoil.reset(clearedRoom);
    this.uprising.reset(clearedRoom);
    this.hunts.reset(clearedRoom);
    this.finale.reset();
    this.finaleService.reset();
    prepareCombatFocus(this);
    prepareDamageControl(this);
    this.bossRemaster.reset(clearedRoom);
    this.shiftRoutes.reset(clearedRoom);
    this.shiftRun.resetRoom();
    const routeTest =
      this.testRun && this.testRun.stage === this.stage ? chooseRouteTestIdentity(this.seed) : null;
    if (routeTest && this.stage === routeTest.destinationStage - 1) {
      // This explicit fixture begins after the patrol was cleared. Ordinary
      // Campaigns never enter this branch, and no playtest victory is recorded.
      for (const enemy of this.enemies) Composite.remove(this.engine.world, enemy.body);
      this.enemies = [];
      this.waves.clear();
      this.clear = true;
      this.clearAt = this.time;
      this.extendDetourSteps();
      Body.setPosition(this.player, {
        x: routeTest.route === 'high' ? 1898 : 1865,
        y: (routeTest.route === 'high' ? this.branchDoor.floor : 740) - 18,
      });
      Body.setVelocity(this.player, { x: 0, y: 0 });
      this.grounded = true;
    }
  }
  startEscape() {
    if (this.testRun?.rematchRoom) return;
    if (this.practice || this.detour || this.workshop.active || this.shutdown.chamber) return;
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
    this.recordCampaignClear();
    this.finaleFirstClear = false;
    this.areaEvents.state = null;
    this.shiftRun.finishLap();
    this.overtime = { baseMods: this.mods.length, repairs: 0, remix: 5 };
    this.welder.state = planWelder(this.seed);
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
    if (this.overtime) return;
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
    this.melt.reset();
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
    this.support.reset();
    this.toolroom.reset();
    this.patrolMachines.clear();
    this.fusions.reset();
    this.shiftFusions.reset();
    this.shiftUpgrades.reset();
    this.shiftMorphs.reset();
    this.shiftOrigin = null;
    this.harpoons.clear();
    this.demolition.clear();
    this.escape.depart = 0;
    this.shots = [];
    this.trail = [];
    this.particles = [];
    this.combatFeel.reset();
    this.burstRemaining = 0;
    this.fireBuffer = this.jumpBuffer = 0;
    this.blast.life = this.muzzle = this.hitStop = 0;
    Body.setVelocity(p, { x: 0, y: 0 });
    Body.setPosition(p, { x: lift.x, y: lift.y - 18 });
    this.grounded = true;
    this.onSound('extract');
    if (this.overtime && this.escape.destination !== 'overtime') {
      this.clockOut.begin();
      this.commendations.extracted();
      if (!this.testRun) this.onCheckpoint(null);
      this.setMode('won');
      return;
    }
    this.onChange();
  }
  readyClockOut() {
    if (this.clockOut.release()) this.onChange();
  }
  skipClockOut() {
    if (this.clockOut.skip()) this.onChange();
  }
  updateClockOut(dt: number, foreground: boolean) {
    if (this.clockOut.update(dt, foreground)) this.onChange();
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
      this.commendations.extracted();
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
    variant?: MutationKind | 'split-child',
    machineVariant?: MachineVariant,
  ) {
    if (
      this.combatEnemyCount >=
      (this.areaEvents.encounter === 'turf' ? 24 : variant === 'split-child' ? 16 : 14)
    )
      return;
    const { w, h } = ENEMY_STATS[kind];
    const hp = Math.ceil(
      (this.overtime
        ? overtimeHealth(kind, this.stage, elite)
        : enemyHealth(kind, this.stage, elite)) *
        (this.detour && !isBoss(kind) ? DETOUR_HEALTH : 1),
    );
    const body =
      kind === 'flyer' || kind === 'wallcrawler' || isSupport(kind)
        ? Bodies.circle(x, y, kind === 'wallcrawler' || isSupport(kind) ? 14 : 19, {
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
      (kind === 'shooter' || kind === 'sniper' || kind === 'crane' || kind === 'mortar') &&
      !this.counterweights.movingPerch(body)
    )
      Body.setStatic(body, true);
    body.collisionFilter.mask = 0x7fff;
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
    if (isPatrolMachine(kind)) enemy.patrol = createPatrolRig(enemy, machineVariant);
    if (isSupport(kind)) {
      enemy.support = createSupport(kind);
      this.teamwork.sources.add(enemy);
    }
    if (kind === 'crane') enemy.crane = createCrane(this, enemy);
    if (kind === 'kiln') enemy.kiln = createKiln();
    if (kind === 'switchboard') enemy.switchboard = createSwitchboard();
    if (kind === 'turbine') enemy.turbine = createTurbine();
    if (kind === 'interceptor') enemy.interceptor = createInterceptor();
    if (kind === 'interceptor' && finalArsenalSeed(this.seed)) {
      enemy.interceptor!.finale = createFinalArsenal(!!this.overtime);
      enemy.maxHp = enemy.hp = Math.ceil(enemy.hp * (this.overtime ? 1.2 : 1.15));
      if (transformedFinale(this.seed)) {
        enemy.maxHp = enemy.hp = Math.ceil(enemy.hp * (this.overtime ? 1.18 : 1.2));
        enemy.phase = 0;
      }
      configureFinalePreview(this, enemy);
    }
    if (kind === 'interceptor' && this.overtime) enemy.attacks = 2;
    if (kind === 'sorter') enemy.sorter = createSorter();
    if (kind === 'scrapper') enemy.scrapper = createScrapper();
    if (kind === 'fabricator') enemy.fabricator = createFabricator();
    if (kind === 'angler') enemy.angler = createAngler();
    if (kind === 'sapper') enemy.sapper = createSapper();
    if (kind === 'wallcrawler') enemy.crawler = createWallcrawler(this, enemy);
    if (kind === 'welder') Body.setMass(body, this.player.mass * 3);
    if (kind === 'harpooner') {
      enemy.harpoon = createHarpooner();
      Body.setMass(body, this.player.mass * 1.6);
    }
    if (variant) this.mutations.decorate(enemy, variant);
    this.destruction.releaseUnsupported();
    return enemy;
  }
  feedback(amount: number, dir: Vec = { x: 0, y: 0 }) {
    this.shake = Math.min(12, this.shake + amount);
    this.kick.x = clamp(this.kick.x - dir.x * amount * 0.65, -10, 10);
    this.kick.y = clamp(this.kick.y - dir.y * amount * 0.65, -10, 10);
  }
  tick(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    if (this.finale.beforeTick(dt, input)) return;
    input = this.finale.cinema?.filterInput(input) ?? input;
    if (this.shutdown.complete)
      input = {
        ...input,
        left: false,
        right: false,
        jump: false,
        jumpHeld: false,
        fire: false,
        firePressed: false,
        portal: undefined,
      };
    if (input.jump && this.finaleService.interact()) return;
    if (input.jump && this.reforge.interact()) return;
    if (input.jump && this.shiftRun.interact()) return;
    if (input.jump && this.shiftRoutes.interact()) return;
    if (this.escape?.phase === 'extracting') {
      this.updateExtraction(dt);
      return;
    }
    this.shake *= 0.8;
    this.kick.x *= 0.72;
    this.kick.y *= 0.72;
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.land = Math.max(0, this.land - dt);
    input = this.shiftMorphs.input(dt, input);
    // Keep jump taps through the tiny impact pause.
    if (input.jump) this.jumpBuffer = this.areaEvents.input(true) ? 0 : 0.12;
    if (input.firePressed) this.fireBuffer = 0.12;
    if (input.portal) this.portalRequest = { ...input.portal };
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      return;
    }
    if (this.hunts.enter(input.jump)) return;
    this.massDriver.beforeStep(dt);
    this.commendations.weapons.sampleGround();
    const machineSettling = this.clear && this.machineBreakdown.shutdownActive;
    this.time += dt;
    if (!machineSettling) this.elapsed += dt;
    this.blast.life = Math.max(0, this.blast.life - dt);
    this.aim = { ...input.aim };
    this.shiftUpgrades.beforeStep(dt, input);
    this.shiftRoutes.beforeStep(input, dt);
    this.support.update(dt);
    this.toolroom.update(dt);
    this.cryogenic.update(dt);
    this.story.update(dt);
    this.stasis.input(input.fire);
    this.ballistics.charge(dt, input.fire || !!input.firePressed || this.fireBuffer > 0);
    if (this.portalRequest) {
      this.portals.place(this.portalRequest);
      this.portalRequest = null;
    }
    this.updateEscape(dt);
    this.freight.beforeStep(dt);
    this.crossing.beginStep(dt);
    this.maintenance.beforeStep();
    this.hazards.beforeStep(dt);
    this.demolition.update();
    if (this.mode !== 'playing') return;
    this.tripwires.beforeStep();
    this.shiftFusions.beforeStep(dt);
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
      this.combatFeel.land(this.time, impact);
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
    if (this.grounded) {
      this.mobility.land();
      this.arcs.land();
    }
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
    this.shiftUpgrades.afterGround(input, wasGrounded);
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
    this.mutations.update();
    this.teamwork.tick(dt);
    this.patrolMachines.tick(dt);
    for (const e of [...this.enemies]) {
      const slow = this.cryogenic.slow(e);
      const previousState = e.state;
      this.updateEnemy(e, dt * slow);
      this.encounterPacer.recovery(e, previousState);
      if (
        e.spawn <= 0 &&
        e.hp > 0 &&
        !e.allied &&
        e.eventRole !== 'relay' &&
        e.recoilTarget === undefined &&
        !this.reportedEncounters.has(e.id)
      ) {
        this.reportedEncounters.add(e.id);
        if (!this.quickShift.state) this.onEnemyEncountered(e);
      }
      if (slow < 1 && !e.body.isStatic && e.spawn <= 0)
        Body.setVelocity(e.body, {
          x: e.body.velocity.x * slow,
          y: e.kind === 'flyer' ? e.body.velocity.y * slow : e.body.velocity.y,
        });
      if (this.mode !== 'playing') return;
    }
    this.areaEvents.beforeStep(dt);
    this.annex.update();
    // Capture descent before Matter resolves the landing collision and zeros velocity.
    if (!this.grounded) this.landingSpeed = this.player.velocity.y;
    this.cargo.update(dt);
    this.conveyors.beforeStep();
    this.magnets.update();
    this.sortingPit.update(dt);
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
    if (this.mode !== 'playing') return;
    this.crosswind.beforeStep(dt);
    this.stormfront.beforeStep(dt);
    this.finalApproach.beforeStep(dt);
    this.finale.update(dt);
    if (this.mode !== 'playing') return;
    this.props.beforeStep();
    this.sappers.beforeStep();
    this.destruction.beforeStep();
    this.portals.beforeStep();
    this.counterweights.beforeStep();
    this.uprising.update(input, dt);
    this.shiftMorphs.tick(dt);
    this.shiftRun.tick(dt, input);
    this.shiftUpgrades.beforeIntegrate(dt);
    Engine.update(this.engine, 1000 / 60);
    this.commendations.weapons.sampleGround();
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
    this.recoil.afterStep();
    this.shiftUpgrades.afterStep(dt, input);
    this.shiftRoutes.afterStep(dt);
    this.containPlayer();
    this.operatorSurface.update(dt, input);
    this.machineBreakdown.update();
    this.harpoons.afterStep(dt);
    if (this.mode !== 'playing') return;
    this.ballistics.update();
    if (this.mode !== 'playing') return;
    this.updateShots(dt);
    this.torch.afterStep(dt);
    if (this.finale.cinema?.waiting && !this.finale.cinema.combat) {
      // A finishing hit may have switched scenes inside a weapon callback.
      // Keep the physics step, but cancel every remaining combat callback.
      this.finale.quiet();
      return;
    }
    this.tripwires.afterStep();
    this.fusions.storm.afterStep();
    if (this.mode !== 'playing') return;
    this.arcs.update();
    this.grind.update(dt);
    this.shiftFusions.afterStep(dt);
    if (this.mode !== 'playing') return;
    this.breaches.update(dt);
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.pos.x += p.vel.x * dt * 60;
      p.pos.y += p.vel.y * dt * 60;
      p.vel.y += p.kind === 'shell' ? 0.15 : 0.035;
      return p.life > 0;
    });
    this.combatFeel.update(
      this.time,
      this.combatFeel.hasAttachments ? Composite.allBodies(this.engine.world) : [],
      this.onSound,
    );
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
      this.spoof.update();
      this.workshop.update(dt);
      return;
    }
    this.courier.update(dt);
    this.areaEvents.update(dt);
    this.spoof.update();
    if (this.mode !== 'playing') return;
    this.waves.update(dt);
    this.auditor.update(dt);
    this.welder.update(dt);
    if (this.mode !== 'playing') return;
    this.floodgate.update(dt);
    if (this.mode !== 'playing') return;
    this.recoil.race.afterStep();
    this.hunts.update();
    this.bossRemaster.afterStep();
    if (
      (!this.combatEnemyCount || this.uprising.escapeReady) &&
      !this.areaEvents.waiting &&
      !this.mutations.pending.length &&
      (!this.waves.pending || this.uprising.escapeReady) &&
      !this.auditor.pending &&
      !this.clear &&
      !this.finale.waiting &&
      !this.bossRemaster.waiting &&
      !this.hunts.waiting &&
      !this.uprising.waiting &&
      !this.shiftRoutes.pending &&
      (!this.maintenance.active || this.maintenance.atExit) &&
      (!this.recoil.active || this.recoil.atExit) &&
      (!this.freight.active || this.freight.arrived)
    ) {
      this.clear = true;
      this.clearAt = this.time;
      this.shiftRun.roomCleared();
      this.maintenance.completed();
      this.recoil.completed();
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
      this.reforge.arrive();
      this.onChange();
    }
    // Native clear/gear/projectile cleanup has already completed. Keep the new
    // machine chassis shutdown visible while movement remains available, then route normally.
    if (this.clear && this.machineBreakdown.shutdownActive) return;
    if (this.quickShift.state) {
      this.quickShift.update();
      return;
    }
    if (this.finale.cleared && this.testRun && !this.practice && this.clear) {
      this.setMode('won');
      return;
    }
    if (this.testRun?.rematchRoom && this.clear) {
      this.setMode('won');
      return;
    }
    if (this.hunts.complete()) return;
    if (
      (this.practice ||
        this.maintenance.trial ||
        this.recoil.practice ||
        this.testRun?.switchboardTest) &&
      this.clear
    ) {
      if (this.gauntlet.state && !this.gauntlet.completeFight()) return;
      this.setMode('won');
      return;
    }
    this.shutdown.update(dt);
    if (this.shutdown.chamber || this.mode !== 'playing') return;
    this.extendDetourSteps();
    if (this.recoil.active) {
      if (this.clear && this.time - this.clearAt > 0.4 && this.recoil.atExit) this.openReward();
      return;
    }
    if (this.maintenance.active) {
      if (this.clear && this.time - this.clearAt > 0.4 && this.maintenance.atExit)
        this.openReward();
      return;
    }
    if (
      this.clear &&
      this.canBranch &&
      this.time - this.clearAt > 0.4 &&
      this.grounded &&
      this.player.position.x > this.branchDoor.x - 24 &&
      this.player.position.x < this.branchDoor.x + 40 &&
      Math.abs(this.player.position.y - (this.branchDoor.floor - 18)) < 8
    ) {
      if (this.regionChoices.length === 2) this.openReward(false, undefined, 'annex');
      else if (this.canChooseRoute) this.openReward(false, 'high');
      else this.openReward(true);
      return;
    }
    if (
      this.clear &&
      this.time - this.clearAt > 0.4 &&
      this.player.position.x > 1870 &&
      // At the two-way fork, cross the visible threshold before committing.
      // Old checkpoints and the one-door Daily retain their existing exit.
      (this.annexVersion < 6 ||
        this.regionChoices.length !== 2 ||
        this.player.position.x > this.branchDoor.x - 24) &&
      this.player.position.y > (this.level.freight ? FREIGHT.dock - 70 : 590) &&
      (!this.regionChoices.length || (this.grounded && this.player.position.y > 690)) &&
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
    if (this.escape?.phase === 'extracting' || this.shutdown.complete) return;
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
    const toolroomDamage = this.toolroom.discharge();
    this.muzzle = 0.065;
    const d = direction(this.player.position, this.aim);
    if (d.x === 0 && d.y === 0) d.x = 1;
    Object.assign(origin, this.shiftUpgrades.origin(origin, d));
    this.shiftOrigin = origin;
    const impulse =
      this.gun.recoil *
      this.mobility.shot(d) *
      (this.grounded ? 0.21 * this.toolroom.groundScale : 1) *
      (charged ? 1.25 : 1) *
      (rail ? RAIL_RECOIL : 1);
    const beforeRecoil = this.player.velocity.y;
    const shiftDelta = this.shiftUpgrades.recoilDelta(d, impulse);
    Body.setVelocity(this.player, {
      x: clamp(this.player.velocity.x + shiftDelta.x, -23, 23),
      y: clamp(this.player.velocity.y + shiftDelta.y, -21, 20),
    });
    this.commendations.mastery.recoiled(beforeRecoil - this.player.velocity.y);
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
              : this.startingGun === 'shotgun'
                ? 'shotgun-shot'
                : this.startingGun === 'nailgun'
                  ? 'nail-shot'
                  : this.startingGun === 'carbine'
                    ? 'carbine-shot'
                    : this.startingGun === 'twinbore'
                      ? 'twinbore-shot'
                      : this.startingGun === 'repeater'
                        ? 'repeater-shot'
                        : this.mods.includes('scatter')
                          ? 'scatter'
                          : 'shot',
    );
    this.combatFeel.pumpAt = null;
    this.combatFeel.pumpStartedAt = -100;
    if (
      this.startingGun === 'shotgun' &&
      !rail &&
      !this.gun.shellshock &&
      !this.massDriver.equipped
    ) {
      this.combatFeel.pumpStartedAt = this.time;
      this.combatFeel.pumpAt = this.time + clamp(this.gun.interval * 0.72, 0.02, 0.42) * 0.65;
    }
    this.combatFeel.discharge(this, rail);
    const baseDamage =
      this.gun.damage *
      (this.grounded ? 1 : this.gun.airDamage) *
      (charged ? 2 : 1) *
      (capacitor ? 2 : 1) *
      evolutionDamage *
      toolroomDamage;
    const bank = this.support.discharge(
      baseDamage *
        this.gun.pellets *
        this.gun.lanes *
        (1 + Number(this.gun.rearVolley) + (this.gun.backblast ? 0.8 : 0)),
    );
    const damage = baseDamage * bank;
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
    for (const s of this.shots)
      if (s.id > beforeVolley && primaryGunShot(s)) {
        s.nativeTool = this.startingGun;
        this.toolroom.tag(s);
        if (bank > 1) s.overkillSpent = true;
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
        vel: {
          x: -d.x * 2 + ((seedLockedCombat(this.seed) ? this.cosmeticRandom() : this.rng()) - 0.5),
          y: -2.8,
        },
        life: 0.6,
        max: 0.6,
        size: 2,
        color: '#bdae84',
        kind: 'shell',
      });
    this.shiftOrigin = null;
  }
  primaryOrigin(): Vec {
    return this.shiftOrigin ?? { x: this.player.position.x, y: this.player.position.y - 3 };
  }
  fireVolley(d: Vec, damage: number, charged: boolean, primary = true) {
    const baseOrigin = this.primaryOrigin();
    const pos = { x: baseOrigin.x + d.x * 26, y: baseOrigin.y + d.y * 26 };
    const radius = this.massDriver.equipped
      ? MASS_DRIVER.radius
      : this.mods.includes('magnum') || this.startingGun === 'carbine'
        ? 4
        : 2.5;
    const spawn = this.lineEnd(baseOrigin, pos, radius);
    const valveOrigin = baseOrigin;
    if (this.pressure.trace(valveOrigin, spawn, radius)) Object.assign(spawn, valveOrigin);
    if (this.floodgate.trace(valveOrigin, spawn, radius)) Object.assign(spawn, valveOrigin);
    if (this.sortingPit.trace(valveOrigin, spawn, radius)) Object.assign(spawn, valveOrigin);
    if (this.shutdown.trace(valveOrigin, spawn, radius)) Object.assign(spawn, valveOrigin);
    this.teamwork.cutAlong(valveOrigin, spawn, radius, damage > 0);
    if (distance(spawn, pos) > 0.01) {
      spawn.x -= d.x * 0.5;
      spawn.y -= d.y * 0.5;
    }
    for (let lane = 0; lane < this.gun.lanes; lane++)
      for (let i = 0; i < this.gun.pellets; i++) {
        const pellet = i - (this.gun.pellets - 1) / 2;
        // Twinbore keeps its native tight pair inside a wider Scattershot fan.
        const spread =
          pellet *
          (this.startingGun === 'twinbore' && Math.abs(pellet) === 0.5
            ? Math.min(this.gun.spread, this.mods.includes('deadeye') ? 0.013 : 0.026)
            : this.gun.spread);
        let a =
          Math.atan2(d.y, d.x) +
          (lane - (this.gun.lanes - 1) / 2) *
            (this.mods.includes('pinwheel')
              ? 0.12 + (Math.sin((this.shotCount * Math.PI) / 4) + 1) * 0.2
              : 0.22) +
          spread;
        let waypoints: Vec[] | undefined;
        if (this.gun.convergence && this.gun.lanes > 1) {
          const origin = baseOrigin;
          const rear = d.x * (this.aim.x - origin.x) + d.y * (this.aim.y - origin.y) < 0;
          const target = rear
            ? { x: origin.x * 2 - this.aim.x, y: origin.y * 2 - this.aim.y }
            : this.aim;
          const range = Math.max(32, distance(spawn, target));
          const axis = distance(spawn, target) > 32 ? direction(spawn, target) : d;
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
        if (this.support.spreadScale < 1)
          a = Math.atan2(d.y, d.x) + (a - Math.atan2(d.y, d.x)) * this.support.spreadScale;
        if (waypoints && this.support.spreadScale < 1)
          waypoints = waypoints.map((point) => {
            const along = (point.x - spawn.x) * d.x + (point.y - spawn.y) * d.y;
            const across =
              ((point.y - spawn.y) * d.x - (point.x - spawn.x) * d.y) * this.support.spreadScale;
            return {
              x: spawn.x + d.x * along - d.y * across,
              y: spawn.y + d.y * along + d.x * across,
            };
          });
        this.addShot({
          feel:
            this.startingGun === 'shotgun' || this.startingGun === 'twinbore'
              ? 'pellet'
              : this.startingGun === 'nailgun'
                ? 'nail'
                : undefined,
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
          shot.allied ||
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
    const disconnect = this.shutdown.target;
    if (disconnect) {
      const d = direction(p, disconnect);
      if (rear.x * d.x + rear.y * d.y >= Math.SQRT1_2) this.shutdown.blast(p, 130);
    }
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
    for (const prop of targets) this.props.hit(prop, damage, rear, undefined, true);
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
    this.shiftUpgrades.tag(shot);
    this.stasis.prepare(shot);
    this.shiftMorphs.prepare(shot);
    this.shots.push(shot);
    if (shot.angler && !shot.friendly && !shot.reflected && !shot.angler.banked) {
      const owner = [...this.enemies, ...this.factions.allies].find(
        (e) => e.id === shot.angler!.owner,
      );
      if (owner)
        this.machineBreakdown.surfaceDischarge(
          owner,
          Math.atan2(shot.vel.y, shot.vel.x),
          shot.angler.plan.origin,
          shot.angler.plan.start,
          0,
        );
    }
    return shot;
  }
  updateEnemy(e: Enemy, dt: number) {
    if (e.hp <= 0 || !(e.allied ? this.areaEvents.allies : this.enemies).includes(e)) return;
    if (e.remaster && e.allied) {
      e.remaster = undefined;
      e.state = 'idle';
      e.timer = Math.max(e.timer, 0.7);
    }
    if (e.allied && !this.enemies.length) return;
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
      this.workshop.move(e, dt);
      return;
    }
    if (isSupport(e.kind)) {
      this.teamwork.move(e);
      return;
    }
    if (e.kind === 'welder') {
      this.welder.updateEnemy(e, dt);
      return;
    }
    if (e.kind === 'auditor') {
      this.auditor.updateEnemy(e, dt);
      return;
    }
    if (this.areaEvents.updateEnemy(e, dt)) return;
    if (this.courier.updateEnemy(e, dt)) return;
    if (this.mutations.updateEnemy(e, dt)) return;
    this.securityCombat.update(e, dt);
    const combatTarget =
      this.shiftUpgrades.decoyTarget(e) ??
      this.uprising.target(e) ??
      this.areaEvents.combatTarget(e);
    this.encounterPacer.prepareRanged(e, dt, combatTarget);
    // Shorten downtime only. Every marked attack and spawn keeps its full tell.
    e.timer -=
      dt *
      (this.overtime && ((e.state === 'idle' && e.timer > 0.5) || e.state === 'recover')
        ? 1.12
        : 1);
    if (this.hunts.updateEnemy(e)) return;
    const p = e.body.position,
      target = combatTarget,
      d = direction(p, target),
      dist = distance(p, target);
    if (e.elite === 'volatile') {
      this.updateVolatile(e);
      // A volatile flyer only harms the player through its warned explosion.
      return;
    }
    const coordinated = updateSquad(this, e);
    const remastered = !coordinated && this.enemyRemaster.update(e, combatTarget);
    if (!coordinated && !remastered) {
      if (this.bossRemaster.tryUpdate(e, dt)) {
        // Revised boss AI; native contact, damage and room completion continue below.
      } else if (isPatrolMachine(e.kind)) this.patrolMachines.updateEnemy(e);
      else if (e.kind === 'switchboard') this.switchboard.update(e, dt);
      else if (e.kind === 'caller') updateCaller(this, e, dt);
      else if (e.kind === 'switchman') this.annex.updateSwitchman(e, dt);
      else if (e.kind === 'sorter' || e.kind === 'borer' || e.kind === 'sifter')
        updateReclamationEnemy(this, e, dt);
      else if (e.kind === 'charger') this.updateCharger(e);
      else if (e.kind === 'loader') this.updateLoader(e);
      else if (e.kind === 'crane') updateCrane(this, e);
      else if (e.kind === 'press') this.updatePress(e);
      else if (e.kind === 'kiln') updateKiln(this, e, dt);
      else if (e.kind === 'hopper') this.updateHopper(e);
      else if (e.kind === 'scrapper') updateScrapper(this, e);
      else if (e.kind === 'fabricator') this.fabricators.updateBuilder(e);
      else if (e.kind === 'sentry') this.fabricators.updateSentry(e);
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
        if (!turning) this.updateRunner(e, d, dist, target);
        if (e.allied) e.aim = d;
      } else if (e.kind === 'flyer') {
        Body.applyForce(e.body, p, { x: 0, y: -e.body.mass * 0.001 });
        const height = clamp(target.y - 190, this.worldTop + 220, 500);
        Body.setVelocity(e.body, {
          x: clamp((target.x - d.x * 350 - p.x) * 0.009, -2.4, 2.4),
          y: clamp((height - p.y) * 0.04, -3, 3),
        });
      }
    }
    if (!remastered && ((e.kind === 'shooter' && !coordinated) || e.kind === 'flyer')) {
      if (
        e.timer <= 0.35 &&
        e.timer + dt > 0.35 &&
        dist < 1450 &&
        distance(this.lineEnd(p, target), target) < 1
      )
        this.soundAt('aim-warn', e.body.position, `enemy:${e.id}`);
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
        this.soundAt('enemy', e.body.position, `enemy:${e.id}`);
      } else if (e.timer <= 0) e.timer = 0.8;
    }
    if (this.mode !== 'playing' || e.hp <= 0) return;
    this.areaEvents.contact(e);
    if (e.allied) {
      if (p.y > 900) this.areaEvents.removeAlly(e);
      return;
    }
    if (
      !(e.remaster && e.kind === 'runner' && (e.state === 'windup' || e.state === 'recover')) &&
      !(
        (e.kind === 'charger' || e.kind === 'loader' || e.kind === 'kiln') &&
        e.state === 'recover'
      ) &&
      !(
        (e.kind === 'scrapper' ||
          e.kind === 'fabricator' ||
          e.kind === 'harpooner' ||
          e.kind === 'sapper' ||
          e.kind === 'wallcrawler' ||
          e.kind === 'angler') &&
        e.state === 'recover'
      ) &&
      !(e.kind === 'press' && this.bossRemaster.owns(e)) &&
      (e.kind !== 'press' || e.state === 'rush') &&
      e.kind !== 'sentry' &&
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
            : e.splitChild
              ? 9
              : 15,
        p,
        { type: 'contact', enemy: e.kind },
      );
    if (p.y > 900) this.hitEnemy(e, 9999);
  }
  updateRunner(e: Enemy, d: Vec, dist: number, target = this.player.position) {
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
      (blocked || Math.abs(e.body.velocity.x) < 0.7 || (target.y < p.y - 60 && dist < 280))
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
      this.soundAt('lock', e.body.position, `enemy:${e.id}`);
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
    this.soundAt('explode', e.body.position, `enemy:${e.id}`);
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
      const hit =
        this.counterweights.owns(b) || this.shiftRoutes.owns(b)
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
          this.soundAt('crash', e.body.position, `enemy:${e.id}`);
          if (prop) this.props.strike(prop, 140, e.aim);
          if (weak) this.destruction.hitBody(contact!.body, 140, e.aim);
        }
      } else Body.setVelocity(e.body, { x: e.aim.x * 14, y: v.y });
    } else if (e.state === 'windup') {
      Body.setVelocity(e.body, { x: v.x * 0.65, y: v.y });
      if (e.timer <= 0) {
        e.state = 'rush';
        e.timer = 0.62;
        this.soundAt('rush', e.body.position, `enemy:${e.id}`);
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
          if (!this.encounterPacer.request(e, true, CHARGE_TELL + 0.75)) return;
          e.state = 'windup';
          e.timer = CHARGE_TELL;
          this.soundAt('charge', e.body.position, `enemy:${e.id}`);
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
      player = this.factions.combatTarget(e);
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
        this.soundAt('land', e.body.position, `enemy:${e.id}`);
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
        this.soundAt('hop', e.body.position, `enemy:${e.id}`);
      } else if (e.timer < -0.5) {
        e.state = 'airborne';
        e.timer = 0.2;
      }
    } else {
      Body.setVelocity(e.body, { x: v.x * 0.8, y: v.y });
      if (e.timer <= 0 && grounded) {
        if (!this.encounterPacer.request(e, true, HOP_TELL + 0.6)) return;
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
        this.soundAt('snipe', e.body.position, `enemy:${e.id}`);
        if (e.elite === 'twin' && !second) {
          e.state = 'followup';
          e.timer = TWIN_TELL;
          e.aim = direction(e.body.position, this.player.position);
          this.soundAt('lock', e.body.position, `enemy:${e.id}`);
        } else {
          e.state = 'recover';
          e.timer = e.elite === 'twin' ? 1.9 : 1.65;
        }
      }
    } else {
      e.aim = direction(e.body.position, this.player.position);
      if (e.timer <= 0 && distance(e.body.position, this.player.position) < 1450) {
        if (!this.encounterPacer.request(e, true, SNIPER_TELL + 0.35)) return;
        e.state = 'windup';
        e.timer = SNIPER_TELL;
        this.soundAt('lock', e.body.position, `enemy:${e.id}`);
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
      this.soundAt('phase', e.body.position, `enemy:${e.id}`);
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
        for (const angle of commandRemixAngles(this.level.bossRemix, e))
          this.enemyShot(e, angle, e.attack === 'ring' ? 7.8 : 11.2, 23);
        if (!second && e.attack !== 'ring' && this.uprising.finale !== 'mutiny') {
          e.state = 'followup';
          e.timer = commandRemix(this.level.bossRemix) ? 0.9 : 0.7;
          e.aim = d;
          this.soundAt('lock', e.body.position, `enemy:${e.id}`);
        } else {
          e.attacks++;
          e.state = 'recover';
          e.timer = commandRemix(this.level.bossRemix)
            ? [1.5, 1.35, 1.2][e.phase]
            : [1.1, 1, 0.9][e.phase];
        }
        this.soundAt(e.attack === 'ring' ? 'pulse' : 'enemy', e.body.position, `enemy:${e.id}`);
      }
    } else if (e.timer <= 0 && bossHasLane(this, e)) {
      e.attack = commandRemix(this.level.bossRemix)
        ? commandRemixAttack(
            this.level.bossRemix!,
            e.phase,
            e.attacks,
            this.uprising.finale === 'overloaded',
          )
        : bossAttack(e.phase, e.attacks);
      if (!commandRemix(this.level.bossRemix) && this.uprising.finale === 'overloaded')
        e.attack = ['fan', 'ring', 'aimed'][e.attacks % 3] as Enemy['attack'];
      if (reclaimerFinale(this.seed) && this.uprising.finale === 'hunted')
        e.attack = e.attacks % 2 === 0 ? 'aimed' : 'fan';
      if (this.uprising.finale === 'isolated' && e.attack === 'ring') e.attack = 'fan';
      e.aim = d;
      e.state = 'windup';
      e.timer = attackTell(e.attack) + (commandRemix(this.level.bossRemix) ? 0.2 : 0);
      this.soundAt('lock', e.body.position, `enemy:${e.id}`);
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
    if (this.shiftFusions.suppressAllyFire(e)) return;
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
      if (e.allied) return;
      this.machineBreakdown.districtDischarge(e, a, origin, muzzle);
      this.machineBreakdown.signalDischarge(e, a, origin, muzzle);
      this.machineBreakdown.contractDischarge(e, a, origin, muzzle);
      this.machineBreakdown.overseerDischarge(e, a, origin, muzzle);
      if (e.crawler)
        this.machineBreakdown.surfaceDischarge(e, a, origin, muzzle, e.crawler.fired - 1);
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
    const supportCharged = this.teamwork.takeCharge(e);
    const admittedShot = this.addShot({
      pos: portalMuzzle ? { ...origin } : muzzle,
      vel: { x: d.x * speed, y: d.y * speed },
      damage: damage * (e.rebootDamage ?? 1) * (supportCharged ? SUPPORT.boost : 1),
      ...(supportCharged ? { supportCharged: true as const } : {}),
      life: 4,
      friendly: false,
      ...(e.allied ? { allied: true } : {}),
      ...(e.rebootUntil !== undefined ? { rebooted: true } : {}),
      damageCause: { type: blade ? 'blade' : 'shot', enemy: e.kind },
      ...(e.sentry ? { sentryOwner: e.sentry.owner } : {}),
      source: { ...e.body.position },
      ...(e.squad ? { allyBlock: e.id } : {}),
      radius: blade ? 11 : 5,
      ...(blade ? { blade: true as const } : {}),
      bounces: 0,
      pierce: 0,
      fragment: false,
      split: true,
    });
    if (admittedShot) {
      this.machineBreakdown.districtDischarge(e, a, origin, muzzle);
      this.machineBreakdown.signalDischarge(e, a, origin, muzzle);
      this.machineBreakdown.contractDischarge(e, a, origin, muzzle);
      this.machineBreakdown.overseerDischarge(e, a, origin, muzzle);
      if (e.crawler)
        this.machineBreakdown.surfaceDischarge(e, a, origin, muzzle, e.crawler.fired - 1);
    }
  }
  updateShots(dt: number) {
    const workshopRevision = this.workshop.revision;
    this.stasis.update();
    this.massDriver.update(dt);
    if (this.mode !== 'playing') return;
    for (const s of [...this.shots]) updateRivalAmmo(this, s, dt);
    for (const s of this.shots) updateAnglerShot(this, s);
    for (const s of this.shots) if (!s.meltTransit) this.ballistics.flight(s, dt);
    for (const s of this.shots) if (!s.meltTransit) steerVector(s, this.aim, dt);
    for (const s of this.shots) this.shiftMorphs.updateShot(s, dt);
    this.ballistics.reflect(dt);
    for (const s of [...this.shots]) {
      updateAnglerShot(this, s);
      if (s.reflectedAt === this.time) continue;
      if (s.stasis?.phase === 'parked' || s.stasis?.phase === 'queued') continue;
      if (!suspended(s)) s.life -= dt;
      s.prev = { ...s.pos };
      let remaining = dt * 60;
      for (let attempt = 0; attempt < 4 && remaining > 0.001 && s.life > 0; attempt++) {
        if (s.meltTransit) {
          remaining = this.melt.advance(s, remaining);
          if (s.meltTransit || s.life <= 0) break;
          continue;
        }
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
          floodValve?: FloodValve;
          sortingCoil?: true;
          disconnect?: true;
          annexJunction?: number;
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
          if (s.allied) {
            for (const e of this.enemies)
              if (this.factions.targetable(e)) targets.push([e.body, e]);
          } else {
            targets.push([this.player, undefined, true]);
            for (const e of this.areaEvents.allies) if (e.spawn <= 0) targets.push([e.body, e]);
            if (s.mutationShell)
              for (const e of this.enemies)
                if (e.id !== s.mutationShell.owner && e.spawn <= 0) targets.push([e.body, e]);
          }
          if (s.allyBlock !== undefined)
            for (const e of this.enemies)
              if (e.id !== s.allyBlock && e.spawn <= 0) targets.push([e.body]);
        }
        for (const [body, enemy, player] of targets) {
          const h =
            s.massDriver ||
            s.angler ||
            s.tripwire !== undefined ||
            this.counterweights.owns(body) ||
            this.shiftRoutes.owns(body) ||
            (s.friendly && this.mods.includes('melt-through') && this.terrain.includes(body))
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
        const disconnect =
          s.friendly && !s.allied ? this.shutdown.trace(s.pos, end, s.radius) : null;
        if (disconnect && (!nearest || disconnect.t < nearest.t))
          nearest = { ...disconnect, disconnect: true };
        const floodValve = s.friendly ? this.floodgate.trace(s.pos, end, s.radius) : undefined;
        const sortingCoil =
          s.friendly && !s.allied ? this.sortingPit.trace(s.pos, end, s.radius) : null;
        if (sortingCoil && (!nearest || sortingCoil.t < nearest.t))
          nearest = { ...sortingCoil, sortingCoil: true };
        const annexJunction = s.friendly ? this.annex.trace(s.pos, end, s.radius) : null;
        if (annexJunction && (!nearest || annexJunction.t < nearest.t))
          nearest = { ...annexJunction, annexJunction: annexJunction.slot };
        if (floodValve && (!nearest || floodValve.t < nearest.t))
          nearest = { t: floodValve.t, normal: floodValve.normal, floodValve: floodValve.valve };
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
          markShot(s, 'portaled');
          const entryPoint = {
            x: s.pos.x + (end.x - s.pos.x) * passage.t + passage.entry.normal.x * 0.5,
            y: s.pos.y + (end.y - s.pos.y) * passage.t + passage.entry.normal.y * 0.5,
          };
          recordRoute(s, entryPoint);
          this.teamwork.cutAlong(s.pos, entryPoint, s.radius, s.friendly);
          if (s.friendly) this.patrolMachines.trace(s.pos, entryPoint, s.radius, s.damage);
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
          this.teamwork.cutAlong(s.pos, end, s.radius, s.friendly);
          if (s.friendly) this.patrolMachines.trace(s.pos, end, s.radius, s.damage);
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
        this.teamwork.cutAlong(segmentStart, s.pos, s.radius, s.friendly);
        if (s.friendly) this.patrolMachines.trace(segmentStart, s.pos, s.radius, s.damage);
        recordShotTrace(s.trace, s.pos);
        this.stasis.abandon(s);
        remaining -= segment * nearest.t;
        s.waypoints = undefined;
        if (
          nearest.body &&
          !nearest.enemy &&
          this.shiftRoutes.reflect(s, nearest.body, nearest.normal)
        ) {
          remaining = Math.max(0, remaining - 0.002);
          continue;
        }
        if (nearest.body && !nearest.enemy) {
          this.shiftUpgrades.terrainHit(s, nearest.body, nearest.normal);
          this.shiftRun.terrainHit(s, nearest.body);
          this.shiftMorphs.terrainHit(s, nearest.body, nearest.normal);
        }
        if (nearest.body && !nearest.enemy && this.melt.begin(s, nearest.body)) continue;
        const impactDamage = this.massDriver.impactDamage(s);
        s.impactNormal = { ...nearest.normal };
        this.combatFeel.impact(
          s,
          nearest.normal,
          this.time,
          s.nativeTool === 'carbine'
            ? (nearest.enemy?.body ?? nearest.prop?.body ?? nearest.body)
            : undefined,
        );
        if (s.mutationShell) {
          this.mutations.explode(s);
          if (this.mode !== 'playing') return;
          continue;
        }
        if (s.allied && !nearest.enemy) {
          // Allied rounds stop at scenery without detonating player-adjacent
          // canisters or cutting suspended cargo onto the player.
          s.life = 0;
          this.burst(s.pos, 2, '#6bb7ff', 1);
          continue;
        }
        if (nearest.caught) {
          this.fusions.catch(s);
          s.life = 0;
          s.shell = undefined;
        } else if (nearest.annexJunction !== undefined) {
          this.annex.interrupt(nearest.annexJunction);
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.disconnect) {
          this.shutdown.trigger();
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.sortingCoil) {
          this.sortingPit.trigger();
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
        } else if (nearest.floodValve) {
          this.floodgate.trigger(nearest.floodValve);
          s.life = 0;
          this.demolition.impact(s);
          if (this.mode !== 'playing') return;
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
          if (!s.friendly) {
            if (e.allied) {
              if (e.kind === 'caller' || e.kind === 'switchman')
                this.factions.hitAlly(e, s.damage, {
                  x: e.body.position.x - s.vel.x,
                  y: e.body.position.y - s.vel.y,
                });
              else {
                const hpBefore = e.hp;
                const machineDeath = this.machineBreakdown.beforeHit(e, s.damage);
                this.areaEvents.hitAlly(e, s.damage);
                if (e.hp < hpBefore) {
                  this.machineBreakdown.hit(
                    e,
                    s.damage,
                    hpBefore - e.hp,
                    Math.min(hpBefore, hpBefore - e.hp),
                    false,
                    { x: e.body.position.x - s.vel.x, y: e.body.position.y - s.vel.y },
                  );
                  this.machineBreakdown.defeated(e, machineDeath);
                }
              }
            } else
              this.hitEnemy(
                e,
                this.spoof.alliedDamage(e, s.damage, !!s.rebooted),
                { x: e.body.position.x - s.vel.x, y: e.body.position.y - s.vel.y },
                true,
                false,
                false,
              );
            if (this.finale.cinema?.waiting && !this.finale.cinema.combat) return;
            s.life = 0;
            continue;
          }
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
          const previousHp = e.hp;
          const blocked = this.hitEnemy(
            e,
            this.toolroom.damage(e, s, damage),
            {
              x: e.body.position.x - s.vel.x,
              y: e.body.position.y - s.vel.y,
            },
            true,
            true,
            true,
            s.reflected ? 'reflection' : undefined,
            shotTrace(s),
          );
          // A cinematic form break cancels this round before split, Fuse or
          // other post-hit effects can repopulate the freshly cleared arena.
          if (this.finale.cinema?.waiting && !this.finale.cinema.combat) return;
          this.support.gunHit(e, previousHp, s);
          this.toolroom.gunHit(e, previousHp, s, blocked);
          this.spoof.hit(e, previousHp, primaryGunShot(s));
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
          this.shiftUpgrades.primaryHit(e, s);
          this.salvage.impact(s);
          this.cryogenic.hit(e, s);
          this.stasis.hit(s);
          this.evolutions.hit(s);
          this.ballistics.consumeFracture(e, s);
          this.ballistics.rivet(e, s);
          this.tethers.hit(e, s);
          if (e.hp <= 0 && e.kind !== 'sentry' && this.gun.deathBloom && !s.fragment)
            this.deathBloom(s, e.body.position);
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
          this.damagePlayer(s.damage, s.pos, s.damageCause ?? { type: 'shot' }, s);
          if (this.workshop.revision !== workshopRevision) return;
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
            markShot(s, 'banked');
            s.damage *= 1 + s.bankGrowth;
            if (s.shell) s.shell.damage *= 1 + s.bankGrowth;
            if (s.bankGrowth > 0) {
              this.burst(s.pos, 4, '#a1dbbf', 2);
              this.soundAt('bank', s.pos, `surface:${impactBody?.id ?? 'world'}`, 'terrain');
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
            if (impactBody && roundFeel(s) === 'nail') {
              this.combatFeel.impact(s, nearest.normal, this.time, impactBody);
              this.soundAt('nail-impact', s.pos, `surface:${impactBody.id}`, 'terrain');
            } else if (impactBody && !nearest.prop && s.friendly && !s.allied && !s.fragment) {
              this.soundAt('prop', s.pos, `surface:${impactBody.id}`, 'terrain');
            }
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
        weaponTrace: shotTrace(s),
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
  hitEnemy(
    e: Enemy,
    damage: number,
    from?: Vec,
    feedback = true,
    killEffects = true,
    credited = true,
    source?: KillSource,
    trace?: WeaponTrace,
  ): boolean {
    if (e.hp <= 0 || e.allied) return false;
    if (e.recoilTarget !== undefined) {
      if (!this.recoil.canHitTarget(e) || source === 'cleanup') return true;
      credited = false;
    }
    if ((e.kind === 'auditor' || e.kind === 'welder') && e.spawn > 0) return true;
    if (e.kind === 'sentry') credited = false;
    const incomingDamage = damage;
    damage *= this.hunts.armor(e);
    if (e.kind === 'welder') damage *= e.state === 'recover' ? 1.5 : 0.55;
    if (e.kind === 'auditor')
      damage *=
        e.state === 'recover' ? 1 : e.hp > (e.maxHp * 2) / 3 ? 0.6 : e.hp > e.maxHp / 3 ? 0.8 : 1;
    const blocked = !!from && enemyShielded(e, direction(from, e.body.position));
    if (blocked) {
      damage *= e.kind === 'shutter' ? 0.3 : 0.1;
      e.shieldFlash = 0.14;
    }
    if (e.angler && e.angler.exposed > 0) damage *= 1.5;
    if (e.crawler && e.crawler.vulnerable > 0) damage *= 1.5;
    if (e.kind === 'charger' && e.state === 'recover') damage *= 1.4;
    if (e.kind === 'loader') damage *= e.state === 'recover' ? 1.25 : 0.4;
    if (e.kind === 'crane') damage *= e.state === 'recover' && e.crane && !e.crane.hit ? 1.4 : 0.35;
    if (e.kind === 'press')
      damage *= e.state === 'recover' || this.pressure.opening(e) ? 1.25 : 0.4;
    if (e.kind === 'kiln') damage *= e.state === 'recover' || this.pressure.opening(e) ? 1.35 : 0.4;
    if (e.kind === 'sorter') damage *= e.state === 'recover' ? 1.35 : 0.32;
    if (e.kind === 'condenser')
      damage *=
        e.state === 'recover' || (this.level.bossRemix && this.pressure.opening(e)) ? 1.3 : 0.25;
    if (e.kind === 'switchboard')
      damage *= (e.switchboard?.opening ?? 0) > 0 ? 1.55 : e.state === 'recover' ? 1.25 : 0.6;
    if (e.kind === 'turbine') damage *= e.state === 'recover' ? 1.35 : 0.32;
    if (e.kind === 'interceptor') damage *= e.state === 'recover' ? 1.3 : 0.35;
    if (e.kind === 'boss')
      damage *=
        e.state === 'transition' ? 0.35 : e.state === 'windup' || e.state === 'followup' ? 0.3 : 1;
    damage = this.finale.limitDamage(e, damage);
    const healthLost = Math.min(e.hp, Math.max(0, damage));
    const machineDeath = this.machineBreakdown.beforeHit(e, damage, source);
    this.courier.presentation.beforeHit(e, damage, source);
    e.hp -= damage;
    this.machineBreakdown.hit(e, incomingDamage, damage, healthLost, blocked, from, source);
    this.courier.presentation.acceptedHit(e, healthLost, from, source);
    if (credited && source !== 'cleanup') this.commendations.weapons.hit(e, healthLost, trace);
    if (credited && from && damage > 0 && source !== 'cleanup' && typeof source !== 'object')
      this.commendations.mastery.hit(e);
    this.auditor.damaged(e);
    if (damage > 0 && e.hp > 0 && e.fabricator) this.fabricators.interrupt(e);
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
      e.hitDirection = { x: -directionToHit.x, y: -directionToHit.y };
      this.burst(
        impact,
        4,
        armored ? '#e7d6ac' : '#f28a79',
        armored ? 2 : 2.3,
        armored ? directionToHit : undefined,
      );
      if (e.hp > 0)
        this.soundAt(
          armored ? 'armor' : 'hit',
          impact,
          `enemy:${e.id}`,
          armored ? 'armor' : 'casing',
        );
    }
    if (e.hp > 0) return blocked;
    if (this.finale.cinema?.breakForm(e)) return blocked;
    this.machineBreakdown.defeated(e, machineDeath, source);
    this.finale.defeated(e);
    this.bossRemaster.defeated(e);
    this.auditor.killed(e, credited && source !== 'cleanup');
    this.welder.killed(e, credited && source !== 'cleanup');
    if (credited) this.commendations.defeated(e, source, trace);
    if (
      credited &&
      source !== 'cleanup' &&
      isBoss(e.kind) &&
      this.mods.includes('arc-coil') &&
      this.commendations.eligible &&
      !e.allied &&
      e.spawn <= 0
    )
      this.onMilestone('arcBoss');
    if (
      isBoss(e.kind) &&
      !this.practice &&
      !this.workshop.active &&
      this.mode === 'playing' &&
      this.hp > 0 &&
      e.spawn <= 0
    )
      if (e.kind !== 'welder') this.earnedSalvage = SALVAGE_BOSSES[e.kind] ?? null;
    breakSquad(this, e);
    releaseScrapper(this, e);
    this.harpoons.disrupt(e.body);
    if (credited && e.eventRole !== 'relay') this.kills++;
    this.areaEvents.killed(e, credited);
    this.tethers.disrupt(e.body);
    if (credited && e.eventRole !== 'relay') {
      const before = this.hp;
      this.hp = Math.min(100, this.hp + this.gun.heal);
      this.combatReport.bloodworkHeal(this.hp - before);
    }
    Composite.remove(this.engine.world, e.body);
    if (e.crane) Composite.remove(this.engine.world, e.crane.body);
    this.switchboard.clear(e);
    clearCaller(e);
    clearKiln(e);
    clearArsenal(this, e);
    this.enemies = this.enemies.filter((x) => x !== e);
    if (
      !this.practice &&
      !this.testRun &&
      !this.workshop.active &&
      this.mode === 'playing' &&
      this.hp > 0 &&
      e.spawn <= 0 &&
      e.eventRole !== 'relay' &&
      e.recoilTarget === undefined &&
      (e.kind !== 'welder' || (credited && source !== 'cleanup'))
    )
      this.onEnemyDefeated(e.kind);
    this.hunts.defeated(e, credited && source !== 'cleanup');
    this.fabricators.killed(e, source === 'cleanup' ? 'cleanup' : 'owner-lost');
    this.teamwork.disrupt(e);
    this.patrolMachines.remove(e);
    this.mutations.killed(e);
    this.courier.killed(e);
    if (e.kind === 'loader') this.loaderArena.stop();
    if (credited && e.eventRole !== 'relay') this.salvageEvolutions.killed(e, killEffects);
    if (this.mode === 'playing' && this.hp > 0 && e.spawn <= 0) {
      this.gauntlet.defeated(e.kind, credited && source !== 'cleanup' && !e.allied);
      this.quickShift.defeated(e.kind, credited && source !== 'cleanup' && !e.allied);
    }
    if (
      isBoss(e.kind) &&
      !this.practice &&
      !this.testRun &&
      !this.workshop.active &&
      this.mode === 'playing' &&
      this.hp > 0 &&
      e.spawn <= 0
    )
      if (
        !isHunt(e.kind) &&
        e.kind !== 'auditor' &&
        (e.kind !== 'welder' || (credited && source !== 'cleanup'))
      )
        this.onBossDefeated(e.kind);
    this.feedback(isBoss(e.kind) ? 10 : 4);
    this.hitStop = Math.max(this.hitStop, isBoss(e.kind) ? 0.075 : 0.035);
    this.burst(
      e.body.position,
      isBoss(e.kind) ? 45 : e.remaster ? 7 : 16,
      '#f28371',
      isBoss(e.kind) ? 8 : 4,
    );
    if (e.remaster && source !== 'cleanup') {
      const colors =
        e.kind === 'flyer'
          ? ['#83b8bb', '#435b62']
          : e.kind === 'runner'
            ? ['#c18a70', '#64504a']
            : ['#d0af79', '#646960'];
      for (let i = 0; i < 4 && this.particles.length < 200; i++)
        this.particles.push({
          pos: { ...e.body.position },
          vel: { x: (i - 1.5) * 1.8, y: -2.8 - (i % 2) },
          life: 0.35,
          max: 0.35,
          size: e.kind === 'flyer' ? 5 : 4,
          color: colors[i % 2],
          kind: 'shell',
        });
    }
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
    this.soundAt('kill', e.body.position, `enemy:${e.id}`, 'casing');
    if (isBoss(e.kind) && e.kind !== 'auditor' && e.kind !== 'welder')
      for (const other of [...this.enemies])
        this.hitEnemy(other, 9999, undefined, true, true, true, 'cleanup');
    return blocked;
  }
  damagePlayer(amount: number, from?: Vec, cause: DamageCause = { type: 'unknown' }, shot?: Shot) {
    if ((this.workshop.active && this.workshop.scenario !== 'incoming') || this.finale.safe) return;
    if (this.escape?.phase === 'extracting' || this.shutdown.complete) return;
    if (this.mode !== 'playing' || this.time - this.hurtAt < DAMAGE_RECOVERY) return;
    if (shot && this.support.absorb(shot)) return;
    const hpBefore = this.hp;
    this.hp = Math.max(0, this.hp - amount);
    if (this.practice && amount > 0) this.practiceHits++;
    if (amount > 0) this.quickShift.damaged();
    if (amount > 0) this.maintenance.damaged();
    if (amount > 0) this.recoil.damaged();
    if (amount > 0) this.commendations.damaged();
    if (amount > 0) this.uprising.damage();
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
    const incoming =
      shot &&
      Number.isFinite(shot.vel.x) &&
      Number.isFinite(shot.vel.y) &&
      Math.hypot(shot.vel.x, shot.vel.y) > 0.001
        ? { x: -shot.vel.x, y: -shot.vel.y }
        : from
          ? { x: from.x - this.player.position.x, y: from.y - this.player.position.y }
          : undefined;
    const hit = this.damageControl.record({
      at: this.time,
      elapsed: this.elapsed,
      hpBefore,
      hpAfter: this.hp,
      player: this.player.position,
      origin: from,
      direction: incoming,
      cause,
    });
    if (hit) {
      // Optional presentation observers cannot block lethal handling or saving.
      try {
        this.onDamage(hit);
      } catch {
        /* Replay/feedback is optional. */
      }
    }
    if (this.hp <= 0) this.die(cause, from);
  }
  die(cause: DamageCause = { type: 'unknown' }, origin?: Vec) {
    if (this.mode === 'dead' || this.mode === 'won') return;
    if (this.workshop.active) {
      this.startWorkshop(
        this.workshop.discovered,
        this.mods,
        this.startingGun,
        this.workshop.scenario,
      );
      return;
    }
    this.deathCause = loadDamageCause(cause);
    // Capture the lethal moment before mode cleanup removes attacks and machines.
    this.onDeath(origin ? { ...origin } : undefined);
    this.setMode('dead');
    if (!this.practice && !this.testRun) this.onCheckpoint(null);
    this.onSound('dead');
  }
  burst(pos: Vec, count: number, color: string, speed: number, dir?: Vec) {
    for (let i = 0; i < count && this.particles.length < 220; i++) {
      const angle = dir
        ? Math.atan2(dir.y, dir.x) + (this.cosmeticRandom() - 0.5) * 1.4
        : this.cosmeticRandom() * Math.PI * 2;
      const v = speed * (0.4 + this.cosmeticRandom()),
        life = 0.12 + this.cosmeticRandom() * 0.22;
      this.particles.push({
        pos: { ...pos },
        vel: { x: Math.cos(angle) * v, y: Math.sin(angle) * v },
        life,
        max: life,
        size: 1 + this.cosmeticRandom() * 2,
        color,
        kind: 'spark',
      });
    }
  }
  get combatEnemyCount() {
    return this.enemies.filter((e) => !e.courier).length;
  }
  openReward(enterDetour = false, route?: RouteChoice, region?: RegionChoice) {
    if (this.testRun?.rematchRoom) return;
    if (this.testRun?.annex) {
      if (this.mode === 'playing' && this.clear && !this.combatEnemyCount && !this.waves.pending) {
        this.setMode('won');
        this.onSound('win');
      }
      return;
    }
    if (this.auditor.pending || this.auditor.enemy) return;
    if (this.areaEvents.waiting || this.mutations.pending.length) return;
    if (
      this.practice ||
      this.workshop.active ||
      this.escape ||
      this.shutdown.chamber ||
      this.mode !== 'playing'
    )
      return;
    if (
      route &&
      (enterDetour ||
        !this.routeChoices.includes(route) ||
        !this.clear ||
        (this.combatEnemyCount && !this.uprising.escapeReady) ||
        (this.waves.pending && !this.uprising.escapeReady))
    )
      return;
    if (
      enterDetour &&
      (!this.canDetour || !this.clear || this.combatEnemyCount || this.waves.pending)
    )
      return;
    if (this.detour && (!this.clear || this.enemies.length || this.waves.pending)) return;
    if (this.recoil.active && !this.recoil.atExit) return;
    if (
      region &&
      (!this.regionChoices.includes(region) ||
        route ||
        enterDetour ||
        !this.clear ||
        this.combatEnemyCount ||
        this.waves.pending)
    )
      return;
    if (this.regionChoices.length) this.region = region ?? this.regionChoices[0];
    this.enteringDetour = enterDetour;
    this.auditorReward = false;
    this.welderReward = false;
    this.enteringRoute = this.canChooseRoute ? (route ?? this.routeChoices[0]) : null;
    if (this.clear && this.shiftRun.enabled) this.shiftRoutes.remember();
    this.courier.leave();
    this.courierReward = this.courier.state?.status === 'collected';
    this.welderReward =
      this.welder.state?.stage === this.stage && this.welder.state.status === 'defeated';
    if (this.welderReward)
      this.earnedSalvage = this.mods.includes('melt-through') ? null : 'melt-through';
    this.hunts.skip();
    this.offers = rewardMods(
      this.mods,
      dailyFromSeed(this.seed) ? 1 : 3,
      seeded(
        this.layoutSeed +
          (this.welderReward
            ? ':welder-rewards:'
            : this.courierReward
              ? ':courier-rewards:'
              : this.detour
                ? ':detour-rewards:'
                : ':rewards:') +
          this.stage,
      ),
      {
        stage: this.stage,
        overtime: !!this.overtime,
        salvage: this.courierReward ? null : this.earnedSalvage,
        seed: this.seed,
        unlocks: this.unlocks,
        startingGun: this.startingGun,
        recentDeclined: this.recentDeclined,
        factory: !!this.factory,
      },
    );
    if (!this.courierReward && !this.welderReward && this.areaEvents.clearance)
      this.offers = this.areaEvents.preferRewards(
        this.offers,
        rewardMods(
          this.mods,
          MODS.length,
          seeded(this.layoutSeed + ':event-rewards:' + this.stage),
          {
            stage: this.stage,
            overtime: !!this.overtime,
            salvage: this.earnedSalvage,
            seed: this.seed,
            unlocks: this.unlocks,
            startingGun: this.startingGun,
            recentDeclined: this.recentDeclined,
          },
        ),
      );
    const annexIntroduction =
      this.annexVersion >= 6 &&
      !dailyFromSeed(this.seed) &&
      !this.overtime &&
      this.region === 'annex' &&
      (this.stage === 7 || this.stage === 8);
    if (annexIntroduction && !this.courierReward && !this.offers.some((m) => isSubversion(m.id))) {
      const candidates = availableMods(this.mods).filter((m) => isSubversion(m.id));
      let replacement = this.offers.length - 1;
      while (replacement >= 0 && isSalvage(this.offers[replacement].id)) replacement--;
      if (candidates.length && replacement >= 0) {
        const rng = seeded(this.layoutSeed + ':annex-introduction:' + this.stage);
        this.offers[replacement] = candidates[Math.floor(rng() * candidates.length)];
      }
    }
    if (
      this.inAnnex &&
      this.stage === 8 &&
      !this.courierReward &&
      !this.mods.includes('spoof') &&
      !this.offers.some((m) => m.id === 'spoof')
    ) {
      const spoof = availableMods(this.mods).find((m) => m.id === 'spoof');
      if (spoof) this.offers.splice(Math.max(0, this.offers.length - 1), 1, spoof);
    }
    if (this.overtime && this.offers.length === 0) this.offers = [REPAIR_REWARD];
    this.offers = this.shiftRun.offers(this.offers);
    this.rewardTaken = false;
    this.rewardRerolled = false;
    this.heldReward = null;
    this.setMode('upgrade');
    this.save();
  }
  private replacementOffers() {
    const held = betterDraftCampaign(this.seed) ? this.heldReward : null;
    const heldIndex = this.offers.findIndex((m) => m.id === held);
    const excluded = this.offers.map((m) => m.id);
    let replacements = rewardMods(
      this.mods,
      this.offers.length,
      seeded(
        this.layoutSeed + (this.detour ? ':detour-rewards:' : ':rewards:') + this.stage + ':reroll',
      ),
      {
        stage: this.stage,
        overtime: !!this.overtime,
        seed: this.seed,
        factory: !!this.factory,
        unlocks: this.unlocks,
        startingGun: this.startingGun,
        recentDeclined: this.recentDeclined,
        ...(held && heldIndex >= 0 ? { held, heldIndex } : {}),
      },
      excluded,
    );
    if (!this.areaEvents.clearance) return replacements;
    if (!held)
      return this.areaEvents.preferRewards(
        replacements,
        rewardMods(
          this.mods,
          MODS.length,
          seeded(this.layoutSeed + ':event-reroll:' + this.stage),
          {
            stage: this.stage,
            seed: this.seed,
            unlocks: this.unlocks,
            overtime: !!this.overtime,
          },
        ),
        excluded,
      );
    // Event priority applies only to unheld cards. The kept card stays in its slot.
    const unheld = replacements.filter((m) => m.id !== held);
    const preferred = this.areaEvents.preferRewards(
      unheld,
      rewardMods(this.mods, MODS.length, seeded(this.layoutSeed + ':event-reroll:' + this.stage), {
        stage: this.stage,
        seed: this.seed,
        unlocks: this.unlocks,
        overtime: !!this.overtime,
      }),
      excluded,
    );
    let i = 0;
    replacements = replacements.map((m) => (m.id === held ? m : (preferred[i++] ?? m)));
    return replacements;
  }
  get canHoldReward() {
    return (
      betterDraftCampaign(this.seed) &&
      !this.workshop.active &&
      !this.practice &&
      !this.courierReward &&
      !this.auditorReward &&
      !this.welderReward &&
      !this.hunts.rewarding &&
      this.mode === 'upgrade' &&
      !this.uprising.pendingPayment &&
      !this.rewardTaken &&
      !this.rewardRerolled &&
      this.offers.length === 3 &&
      !this.offers.some((m) => m.id === 'repair') &&
      (this.shiftRun.freeReroll ||
        this.hunts.freeReroll ||
        this.areaEvents.freeReroll ||
        this.uprising.freeReroll ||
        this.hp > REROLL_COST)
    );
  }
  holdReward(id: string) {
    if (!this.canHoldReward || isSalvage(id) || !this.offers.some((m) => m.id === id)) return false;
    this.heldReward = this.heldReward === id ? null : id;
    this.save();
    this.onChange();
    return true;
  }
  get canReroll() {
    return (
      !this.workshop.active &&
      !this.courierReward &&
      !this.auditorReward &&
      !this.welderReward &&
      !this.hunts.rewarding &&
      this.mode === 'upgrade' &&
      !this.practice &&
      !dailyFromSeed(this.seed) &&
      !this.rewardTaken &&
      !this.rewardRerolled &&
      !this.uprising.pendingPayment &&
      !this.shiftRun.leaseDue &&
      !this.shiftRun.evolutionDue &&
      (this.shiftRun.freeReroll ||
        this.hunts.freeReroll ||
        this.areaEvents.freeReroll ||
        this.uprising.freeReroll ||
        this.hp > REROLL_COST) &&
      this.offers.length > 0 &&
      !this.offers.some((m) => m.id === 'repair') &&
      this.replacementOffers().length === this.offers.length
    );
  }
  rerollReward() {
    if (!this.canReroll) return false;
    const replacements = this.replacementOffers();
    if (this.shiftRun.freeReroll) this.shiftRun.spendReroll();
    else if (this.hunts.freeReroll) this.hunts.spendReroll();
    else if (this.areaEvents.freeReroll) this.areaEvents.spendReroll();
    else if (this.uprising.freeReroll) this.uprising.spendReroll();
    else this.hp -= REROLL_COST;
    this.rememberDeclined(this.offers.filter((m) => m.id !== this.heldReward).map((m) => m.id));
    this.rewardRerolled = true;
    this.heldReward = null;
    this.offers = replacements;
    this.legacyOffers = undefined;
    this.save();
    this.onSound('upgrade');
    this.onChange();
    return true;
  }
  applyJobRefit(mods: readonly string[]) {
    this.mods = [...mods];
    this.shiftRun.fitted();
    this.gun = getGun(this.mods, this.startingGun);
    this.melt.reset();
    this.massDriver.reset();
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
    this.support.reset();
    this.fusions.reset();
    this.shiftFusions.reset();
    this.shiftUpgrades.reset();
    this.shiftMorphs.reset();
    this.shiftOrigin = null;
    this.demolition.clear();
    this.shots = [];
    this.burstRemaining = this.fireBuffer = this.jumpBuffer = 0;
    this.portalRequest = null;
    this.landingReady = this.chargedFlash = false;
    this.blast.life = this.muzzle = 0;
    this.shootAt = this.time;
  }
  chooseMod(id: string) {
    if (this.quickShift.state) {
      this.quickShift.chooseMod(id);
      return;
    }
    if (this.shiftRun.leaseDue || this.shiftRun.evolutionDue) return;
    if (this.hunts.rewarding) return;
    if (this.uprising.choices.length || this.uprising.pendingPayment) return;
    if (this.practice || this.workshop.active) return;
    if (
      this.mode !== 'upgrade' ||
      this.rewardTaken ||
      !this.offers.some((m) => m.id === id) ||
      (isSalvage(id) && id !== this.earnedSalvage) ||
      (isFusion(id) && !fusionUnlocked({ stage: this.stage, overtime: !!this.overtime })) ||
      (isBranch(id) && !this.overtime && this.stage < BRANCH_STAGE) ||
      (!(
        id === 'repair' &&
        this.overtime &&
        availableMods(this.mods).filter(
          (m) =>
            draftUnlocked(m.id, this.unlocks, this.seed) &&
            supportPoolAllowed(m.id, this.seed) &&
            shiftOfferAllowed(m.id, this.seed, 20),
        ).length === 0
      ) &&
        !availableMods(this.mods, true, !!this.legacyOffers?.includes(id)).some((m) => m.id === id))
    )
      return;
    if (this.enteringDetour && !this.canDetour) return;
    this.rewardTaken = true;
    if (id === 'repair' && this.overtime) this.overtime.repairs++;
    else this.mods.push(id);
    this.shiftRun.fitted();
    if (this.legacyOffers?.includes(id)) this.legacyMods = [...this.mods];
    this.legacyOffers = undefined;
    this.gun = getGun(this.mods, this.startingGun);
    if (this.auditorReward) {
      this.auditor.claim();
      return;
    }
    if (this.welderReward) {
      this.earnedSalvage = null;
      if (this.welder.state) this.welder.state.status = 'claimed';
      if (id === 'repair') this.hp = Math.min(100, this.hp + 24);
      this.mode = 'playing';
      this.openReward(this.enteringDetour, this.enteringRoute ?? undefined);
      this.onSound('upgrade');
      return;
    }
    if (this.courierReward) {
      if (this.courier.state) this.courier.state.status = 'claimed';
      this.mode = 'playing';
      this.openReward(
        this.enteringDetour,
        this.enteringRoute ?? undefined,
        this.regionChoices.length && this.region !== 'pending'
          ? (this.region ?? undefined)
          : undefined,
      );
      this.onSound('upgrade');
      return;
    }
    this.rememberDeclined(this.offers.filter((m) => m.id !== id).map((m) => m.id));
    this.heldReward = null;
    this.route = this.enteringRoute;
    if (this.detour) {
      this.maintenance.completed();
      this.detours.push(areaIndex(this.stage));
      this.detour = false;
      this.stage++;
    } else {
      this.hp = Math.min(
        100,
        this.hp + (id === 'repair' ? 24 : ROOM_HEAL) + this.areaEvents.roomHeal,
      );
      if (this.enteringDetour) this.detour = true;
      else this.stage++;
    }
    this.loadRoom();
    if (chooseRouteCampaign(this.seed) && !this.overtime && this.route)
      this.routeHistory = recordRouteDecision(this.routeHistory, this.stage, this.route);
    this.setMode('playing');
    this.save();
    this.onSound('upgrade');
  }
}
