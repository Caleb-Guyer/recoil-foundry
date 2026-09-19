import type { Lore } from './lore-upgrades.ts';
import type { Game, Enemy } from './game.ts';
import { isBoss } from './enemies.ts';

export const COMMENDATIONS_KEY = 'rf-commendations-v1';
export const COMMENDATIONS = [
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
] as const;
export type CommendationId = (typeof COMMENDATIONS)[number]['id'];
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
  constructor(game: Game) {
    this.game = game;
  }
  resetRoom() {
    this.cleanBoss = true;
    this.loads.clear();
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
  defeated(e: Enemy, source?: KillSource) {
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
    if (isBoss(e.kind)) {
      if (this.cleanBoss && g.level.boss && !g.escape) this.award('clean-work');
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
