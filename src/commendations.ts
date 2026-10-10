import type { Lore } from './lore-upgrades.ts';
import { SUPPORT_MASTERIES } from './support-mastery.ts';
import { LATE_BOSS_MASTERIES } from './late-boss-mastery.ts';
import { BOSS_REMIXES, matchesRemixBoss } from './boss-remix-rules.ts';
import type { Game, Enemy } from './game.ts';
import { isHunt } from './hunt-rules.ts';
import { isBoss } from './enemies.ts';
import { BossMastery } from './boss-mastery.ts';
import { WeaponMastery, type WeaponTrace } from './weapon-mastery.ts';

export const COMMENDATIONS_KEY = 'rf-commendations-v1';
export const COMMENDATIONS = [
  {
    id: 'cable-cut',
    name: 'Disconnected',
    objective: 'Defeat The Cableweaver in a Campaign hunt.',
    reward: 'Copperline',
    slot: 'Gun finish',
    lore: [
      'MAINTENANCE · CIRCUIT CLOSED',
      'M. Vale · Maintenance',
      'The reels are quiet. I kept a length of copper braid for the receiver. It carries no current now, but the pale sight line still looks like the warning lamp just before an anchor goes live.\n\nDispatch can find another way to connect its orders. This circuit belongs to the person who opened it.',
    ] as Lore,
  },
  {
    id: 'plate-breaker',
    name: 'Open Plate',
    objective: 'Defeat The Bulwark in a Campaign hunt.',
    reward: 'Sentinel',
    slot: 'Outfit',
    lore: [
      'SAFETY · PROTECTION RELEASED',
      'E. Holt · Safety',
      'The carrier no longer decides who needs shielding. Its plates are back in the depot, where a maintenance crew can use them without asking permission from the rack.\n\nThe new jacket uses the same green as the steel, with a pale chest strip for the person inside. Protection should have a name attached to it.',
    ] as Lore,
  },
  {
    id: 'fuse-pulled',
    name: 'Safe Disposal',
    objective: 'Defeat The Demolisher in a Campaign hunt.',
    reward: 'Fusekeeper',
    slot: 'Gun finish',
    lore: [
      'DISPATCH · STOCK RECONCILED',
      'T. Orr · Dispatch',
      'Every missing charge has been accounted for. I have crossed six entries off the stock sheet and left the demolition permit unsigned. Nobody could tell me which wall it was meant to remove.\n\nThe orange enamel came from the safe disposal cabinet. The tool may keep it. Its operator has demonstrated a much better understanding of when to stop the timer.',
    ] as Lore,
  },
  {
    id: 'gauntlet-cleared',
    name: 'Five Machines Down',
    objective: 'Complete all five rounds of the Boss Gauntlet.',
    reward: 'Victor',
    slot: 'Outfit',
    lore: [
      'DISPATCH · COMPLETE INSPECTION CIRCUIT',
      'T. Orr · Dispatch',
      'Five departments requested a demonstration. You brought one tool and declined four opportunities to replace it.\n\nThe jacket came from the old inspection team stores. Brass stitching, dark green cloth, pale cuffs. Vale added five small marks to the chest panel. There is no space left for another signature.\n\nEvery department has now approved your exit. Please take it before someone asks for a sixth demonstration.',
    ] as Lore,
  },
  {
    id: 'launch-certified',
    name: 'Launch Certified',
    objective: 'Clear Launch shaft in 35 seconds without damage or a reset.',
    reward: 'Aeronaut',
    slot: 'Gun finish',
    lore: [
      'MAINTENANCE · ASCENT CERTIFICATE',
      'M. Vale · Maintenance',
      'The lift was out of service. You signed the top landing anyway. Six separate stamps, all above the point where the cable stopped working.\n\nI painted an upward stripe on the receiver so Dispatch can stop asking which way it travels. The enamel is blue, the sight line pale enough to see against the shaft walls.\n\nKeep the certificate with the tool. The lift repair is still awaiting approval.',
    ] as Lore,
  },
  {
    id: 'cargo-certified',
    name: 'Cargo Certified',
    objective: 'Clear Cargo crossing in 30 seconds without damage or touching the return floor.',
    reward: 'Transit',
    slot: 'Gun finish',
    lore: [
      'DISPATCH · TRANSFER CERTIFICATE',
      'T. Orr · Dispatch',
      'Five loads. Five recorded landings. No request to stop the motors. I checked the transfer schedule and found no entry for a passenger.\n\nThe receiver has the same brass finish as our cargo tags. Vale added a pale band where the destination code normally goes. Yours says onward.\n\nPlease keep it with its assigned operator. We have enough trouble finding things that travel by the approved route.',
    ] as Lore,
  },
  {
    id: 'flight-certified',
    name: 'Flight Certified',
    objective:
      'Clear Airborne targets in 12 seconds without damage or landing before all three targets break.',
    reward: 'Skyline',
    slot: 'Outfit',
    lore: [
      'SAFETY · OVERHEAD WORK CERTIFICATE',
      'E. Holt · Safety',
      'All three indicators went dark before your boots came down. The overhead work form asks which platform you used. There is no box for that answer.\n\nThe new jacket has pale straps at the shoulders and blue cloth from the roof crew stores. Anyone checking the rafters should be able to see you coming.\n\nI have entered the exercise as completed. Please land before you come to collect the paperwork.',
    ] as Lore,
  },
  {
    id: 'bank-job',
    name: 'Bank Job',
    upgrades: ['ricochet'],
    objective: 'Defeat a boss with at least half your damage coming from ricocheted shots.',
    reward: 'Carom',
    slot: 'Gun finish',
    lore: [
      'TOOLROOM · SURFACE DAMAGE CLAIM 036',
      'M. Vale · Maintenance',
      'The wall repairs came out of my budget. The security replacement came out of theirs. I have put both invoices on the same desk.\n\nYou marked the concrete before you marked the machine. Every strike on the receiver arrived from somewhere the machine was not watching. There is a diagram attached to the complaint. Someone has drawn the same angle seventeen times.\n\nI used the green enamel from the toolroom lockers, then inlaid a brass corner along the receiver. It is a reminder to check the surroundings before blaming the tool.\n\nPlease aim for a different wall next time.',
    ] as Lore,
  },
  {
    id: 'air-traffic',
    name: 'Air Traffic',
    upgrades: ['kick', 'airshot'],
    objective: 'Defeat six enemies in one room without touching the ground between kills.',
    reward: 'Airmail',
    slot: 'Gun finish',
    lore: [
      'DISPATCH · UNSCHEDULED AIR MOVEMENT 037',
      'T. Orr · Dispatch',
      'Six separate reports came in from the same aisle. Every unit requested assistance with a target above its assigned search area. By the sixth report, the first five units were unavailable.\n\nI checked the lift schedule. Nothing had moved. I checked the overhead camera and found you correcting your height with the gun. The recoil figures on the service sheet suddenly look less like a defect.\n\nThere was blue paint left from the roof beacons. Vale added a pale flight stripe. I have entered the receiver as an aerial delivery device.\n\nThis should stop Purchasing asking why it has no stock.',
    ] as Lore,
  },
  {
    id: 'special-delivery',
    name: 'Special Delivery',
    upgrades: ['fold'],
    objective: 'Defeat four enemies in one room with shots that traveled through your portals.',
    reward: 'Waybill',
    slot: 'Gun finish',
    lore: [
      'INTERNAL MAIL · ROUTING EXCEPTION 038',
      'Dr. S. Anik · Development',
      'Four deliveries. One entrance. One exit. No recorded transit time.\n\nThe receiving department insists the parcels originated inside its own perimeter. Dispatch insists they left a loading door on the other side of the room. Both statements are accurate. I would prefer that the incident report contain neither.\n\nThe receiver is now violet with a cream routing label. Orr drew an arrow into one end of the label and another out of the opposite end. There is no line between them.\n\nWe used to spend months trying to explain that gap. You appear to have found a practical use for it.',
    ] as Lore,
  },
  {
    id: 'redline',
    name: 'Beyond Clearance',
    objective: 'Clear the full campaign on Security III.',
    reward: 'Redline',
    slot: 'Outfit',
    lore: [
      'SECURITY · EXCEPTION REPORT 035',
      'T. Orr · Dispatch',
      'They raised the inspection grade three times. More guards. Revised firing protocols. Machinery diverted from production to the checkpoints.\n\nEvery morning I received another list of doors you were not authorised to open. Every evening the list came back with the doors missing.\n\nVale found the supervisor’s coat in the security office. Charcoal cloth, copper seams, a white stripe along each shoulder. The red line inside the collar used to mean nobody could question the person wearing it.\n\nI have crossed out the job title. You have already demonstrated the relevant qualifications.',
    ] as Lore,
  },
  {
    id: 'unsafe-load',
    name: 'Unsafe Load',
    boss: 'loader',
    objective: 'Bait the Loader into ramming a standing cargo support, then defeat it.',
    reward: 'Caution',
    slot: 'Gun finish',
    lore: [
      'LIFTING OPERATIONS · INCIDENT 033',
      'E. Holt · Safety',
      'The driver was instructed to keep the aisle clear. It interpreted this as permission to remove the aisle supports. You appear to have encouraged that interpretation.\n\nI have watched the recording. You waited until it committed, then moved. The machine continued to follow an instruction that no longer made sense. I am required to call this unacceptable handling of company equipment.\n\nThere was enough warning paint left on the broken brace for one receiver. Vale put it on yours.\n\nThe stripes mean keep your distance. Perhaps something down here will finally read them.',
    ] as Lore,
  },
  {
    id: 'clearance',
    name: 'Clearance',
    boss: 'crane',
    objective:
      'Recoil-vault over the Crane’s sweeping head, hit it during that recovery, then defeat it.',
    reward: 'Operator',
    slot: 'Outfit',
    lore: [
      'OVERHEAD HANDLING · INCIDENT 034',
      'T. Orr · Dispatch',
      'The clearance diagram allows for a load, a hook and a generous margin of empty air. It does not allow for a worker crossing above the hook while firing a service tool at the floor.\n\nYou were already turning when the head stopped. One shot into the motor before it could wind the cable back in. I replayed that part. Twice.\n\nThe operator’s coat was still hanging in the empty control booth. Blue canvas, pale shoulder tape, the little headset nobody answered. I have crossed out the old employee number.\n\nFor once, someone on the floor was operating the crane.',
    ] as Lore,
  },
  {
    id: 'maintenance-certified',
    name: 'Safe Passage',
    objective: 'Complete both types of Maintenance Shaft without taking damage.',
    reward: 'Servicewear',
    slot: 'Outfit',
    lore: [
      'MAINTENANCE · ACCESS CERTIFICATION 032',
      'M. Vale · Maintenance',
      'Two shafts. No injuries. I checked the forms twice.\n\nThe presses have not been recalibrated in eleven years. The lifts still answer to a supervisor whose office was bricked up before you arrived. You found a way through both, and brought back the same number of fingers.\n\nThere is a green jacket in the service locker. The pale strips used to tell the machinery that someone was working inside it. They no longer do that.\n\nWear it anyway. It tells me you know how to get back out.',
    ] as Lore,
  },
  {
    id: 'hot-work',
    name: 'Hot Work',
    objective: 'Destroy both of The Welder’s barricades during one deployment, then defeat it.',
    reward: 'Forgehand + Kiln',
    slot: 'Outfit + gun finish',
    lore: [
      'MAINTENANCE · DECOMMISSION NOTICE 031',
      'M. Vale · Maintenance',
      'I signed the disposal order myself. Jacket, visor, cutting assembly. Permanently withdrawn from service. The word “permanently” was underlined on the form, so I underlined it on the bin.\n\nThis morning the bin was empty. Someone had stitched the jacket back together with copper wire and filed the serial number off the receiver. Two fresh piles of slag blocked the aisle where the machine used to stand.\n\nThe vents still hold heat after you let go of the trigger. Keep your fingers clear. I have left the visor raised; you should be able to see who is asking you to work.\n\nIf anyone asks, I disposed of everything correctly.',
    ] as Lore,
  },
  {
    id: 'closed-account',
    name: 'Closed Account',
    objective: 'Defeat the pursuer summoned by a sealed company case.',
    reward: 'Red Ledger',
    slot: 'Gun finish',
    lore: [
      'LOSS PREVENTION · INCIDENT 000 / CLOSED',
      'T. Orr · Dispatch',
      'The case contained a tool fitting. The recovery order consumed three departments, six authorisations and a machine worth more than the entire loading bay.\n\nI put the totals side by side. There is no column for what you were worth. There never was.\n\nVale saved a strip of copper from the machine’s chest plate. It fits your receiver. I have entered that under “recovered property” and closed the account before anyone can open it again.',
    ] as Lore,
  },
  {
    id: 'clean-work',
    name: 'Clean Work',
    objective: 'Defeat a boss without taking damage in its room.',
    reward: 'Inspector',
    slot: 'Gun finish',
    lore: [
      'QUALITY ASSURANCE · TOOL REISSUE 014',
      'M. Vale · Maintenance',
      'There is no box on the inspection sheet for a worker coming back uninjured. I checked the reverse. More boxes for the tool.\n\nI gave yours the white enamel we keep for instruments that must not pick up contamination. Two brass lines down the receiver. Orr says it looks too good to take downstairs.\n\nTake it downstairs. Let them see what passed inspection.',
    ] as Lore,
  },
  {
    id: 'heavy-equipment',
    name: 'Heavy Equipment',
    objective: 'Crush three enemies with one falling cargo load.',
    reward: 'Rigger',
    slot: 'Outfit',
    lore: [
      'LIFTING OPERATIONS · INCIDENT AMENDMENT',
      'E. Holt · Safety',
      'The report says three machines were lost to improper load handling. The report does not mention that the machines were firing at the person beneath the load.\n\nI have amended the cause to “successful use of available equipment.” I expect the amendment to be rejected.\n\nThe reinforced jacket is yours. The yellow straps were meant to help a crane operator find a stranded worker. Someone ought to be wearing them.',
    ] as Lore,
  },
  {
    id: 'return-to-sender',
    name: 'Return to Sender',
    objective: 'Deal the killing blow to a boss with a reflected projectile.',
    reward: 'Mirror',
    slot: 'Gun finish',
    lore: [
      'DISPATCH · REFUSED DELIVERY',
      'T. Orr · Dispatch',
      'A projectile returned to its originating department today. Delivery was successful. The department is no longer accepting correspondence.\n\nI polished the spare receiver while waiting for the complaint. You can see yourself in it now, if you hold it at the right angle. I thought that might be useful. Most things down here only show you where to aim.\n\nNo forwarding address required.',
    ] as Lore,
  },
  {
    id: 'after-hours',
    name: 'After Hours',
    objective: 'Complete Overtime and leave through the exit elevator.',
    reward: 'Night Shift',
    slot: 'Outfit',
    lore: [
      'PERSONNEL · SECOND SHIFT RETURN',
      'Dr. S. Anik · Development',
      'You came back after the doors had already opened. I keep trying to find a practical explanation for that. There are several. None of them account for you leaving again.\n\nWe used to give the overnight staff dark coveralls with pale stitching so we could count them under the emergency lamps. Yours has a silver mark at the shoulder. One for each shift.\n\nThis is not a request for a third.',
    ] as Lore,
  },
  ...SUPPORT_MASTERIES,
  ...LATE_BOSS_MASTERIES,
] as const;
export type CommendationId = (typeof COMMENDATIONS)[number]['id'];
export function commendationVisible(
  id: CommendationId,
  defeated: readonly string[],
  earned: readonly CommendationId[],
  discovered: readonly string[] = [],
  revealed: readonly string[] = [],
) {
  const entry = COMMENDATIONS.find((c) => c.id === id)!;
  return (
    earned.includes(id) ||
    ('remix' in entry
      ? revealed.includes('remix:' + entry.remix)
      : 'upgrades' in entry
        ? entry.upgrades.some((upgrade) => discovered.includes(upgrade))
        : !('boss' in entry) || defeated.includes(entry.boss))
  );
}
export function loadCommendations(raw: unknown): CommendationId[] {
  return COMMENDATIONS.filter((c) => Array.isArray(raw) && raw.includes(c.id)).map((c) => c.id);
}
export function mergeCommendations(a: readonly CommendationId[], raw: unknown) {
  return loadCommendations([...a, ...loadCommendations(raw)]);
}
export function commendationPreviewLink(url: URL) {
  const p = url.searchParams;
  let invalid = false;
  p.forEach((_, key) => {
    if (key !== 'test' && key !== 'v') invalid = true;
  });
  return !invalid && p.get('test') === 'commendations' && p.getAll('test').length === 1;
}

export type KillSource = 'reflection' | 'cleanup' | { cargo: number };
export class CommendationTracker {
  game: Game;
  cleanBoss = true;
  private loads = new Map<number, number>();
  private awarded = new Set<CommendationId>();
  mastery: BossMastery;
  weapons: WeaponMastery;
  constructor(game: Game) {
    this.game = game;
    this.mastery = new BossMastery(game);
    this.weapons = new WeaponMastery(game);
  }
  resetRoom() {
    this.cleanBoss = true;
    this.loads.clear();
    this.mastery.reset();
    this.weapons.reset();
  }
  get eligible() {
    const g = this.game;
    return !g.practice && !g.testRun && !g.workshop.active && g.mode === 'playing' && g.hp > 0;
  }
  award(id: CommendationId) {
    if (!this.eligible || this.awarded.has(id)) return;
    this.awarded.add(id);
    this.game.onCommendation(id);
  }
  damaged() {
    if (!this.cleanBoss) return;
    this.cleanBoss = false;
    // A room restart must not erase an accepted hit. Older saves without evidence
    // are conservatively ineligible until the player enters the next boss room.
    if (this.game.level.boss && this.eligible) this.game.save();
  }
  defeated(e: Enemy, source?: KillSource, trace?: WeaponTrace) {
    const g = this.game;
    if (
      !this.eligible ||
      e.spawn > 0 ||
      e.allied ||
      e.eventRole === 'relay' ||
      e.kind === 'sentry' ||
      e.workshopTarget ||
      source === 'cleanup'
    )
      return;
    this.weapons.killed(e, trace);
    if (isBoss(e.kind) && !isHunt(e.kind)) {
      this.mastery.defeated(e);
      if (this.cleanBoss && g.level.boss && !g.escape) this.award('clean-work');
      const remix = g.level.bossRemix;
      if (
        this.cleanBoss &&
        g.bossRemixes &&
        remix &&
        g.level.boss &&
        !g.overtime &&
        !g.escape &&
        !g.detour &&
        matchesRemixBoss(remix, e.kind) &&
        BOSS_REMIXES[remix].stage === g.stage
      ) {
        const mastery = LATE_BOSS_MASTERIES.find((m) => m.remix === remix);
        if (mastery) this.award(mastery.id);
      }
      if (source === 'reflection') this.award('return-to-sender');
    }
    if (source && typeof source === 'object') {
      const count = (this.loads.get(source.cargo) ?? 0) + 1;
      this.loads.set(source.cargo, count);
      if (count >= 3) this.award('heavy-equipment');
    }
  }
  extracted() {
    const g = this.game;
    if (
      g.overtime &&
      g.stage === 19 &&
      g.escape?.phase === 'extracting' &&
      g.escape.destination !== 'overtime' &&
      !g.shutdown.chamber
    )
      this.award('after-hours');
  }
}
