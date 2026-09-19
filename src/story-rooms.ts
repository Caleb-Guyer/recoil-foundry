import type { Game } from './game.ts';
import type { Level } from './levels.ts';
import { distance, type Checkpoint, type Vec } from './rules.ts';
import { COLD } from './cryogenic.ts';
import { isBoss } from './enemies.ts';
import { breakSquad } from './squads.ts';
import { releaseScrapper } from './scrapper.ts';
import {
  COLD_RIG,
  STORY_ROOMS,
  planStory,
  storyEligible,
  storyLevel,
  storyPoint,
  type StorySave,
} from './story-layout.ts';

export class StorySystem {
  game: Game;
  state: StorySave | null = null;
  active = false;
  age = 0;
  collectedAt = -100;
  pulsed = new Set<number>();
  cycle = -1;
  constructor(game: Game) {
    this.game = game;
  }
  start(save?: Checkpoint) {
    const g = this.game;
    this.state = save
      ? save.story
        ? { ...save.story }
        : null
      : planStory(g.seed, g.areaEvents.state, g.courier.state, g.floodgate.stage);
  }
  level(source: Level) {
    const g = this.game;
    if (
      !this.state ||
      this.state.stage !== g.stage ||
      g.practice ||
      g.workshop.active ||
      g.detour ||
      g.escape ||
      g.overtime ||
      g.route ||
      g.areaEvents.state?.area === Math.floor(g.stage / 4) ||
      source.courier ||
      source.floodgate ||
      (g.testRun && !g.testRun.story) ||
      (!g.testRun && !storyEligible(source))
    )
      return source;
    return storyLevel(source, this.state.kind, g.seed);
  }
  reset() {
    const g = this.game;
    this.active =
      !!g.level.story && this.state?.kind === g.level.story && this.state.stage === g.stage;
    this.age = 0;
    this.cycle = -1;
    this.collectedAt = -100;
    this.pulsed.clear();
    if (this.active && g.level.story === 'dispatch') {
      g.conveyors.items = [
        { x: 880, y: 530, w: 480, speed: 2 },
        { x: 880, y: 740, w: 480, speed: -2 },
      ].map((b) => ({
        ...b,
        x: g.level.mirrored ? 2000 - b.x - b.w : b.x,
        speed: b.speed * (g.level.mirrored ? -1 : 1),
      }));
    }
  }
  get note(): Vec | null {
    return this.active ? storyPoint(this.game.level, STORY_ROOMS[this.state!.kind].note) : null;
  }
  get rig() {
    return storyPoint(this.game.level, COLD_RIG);
  }
  get phase() {
    return this.age % COLD_RIG.period;
  }
  get emitting() {
    return (
      this.active &&
      this.state?.kind === 'experiment' &&
      !this.game.clear &&
      this.phase >= COLD_RIG.warning &&
      this.phase < COLD_RIG.warning + COLD_RIG.pulse
    );
  }
  update(dt: number) {
    const g = this.game,
      note = this.note;
    if (!this.active || !note || g.mode !== 'playing' || g.hp <= 0 || !(dt > 0)) return;
    const previousPhase = this.phase;
    this.age += dt;
    if (
      !this.state!.recovered &&
      distance(g.player.position, note) < 54 &&
      distance(g.lineEnd(g.player.position, note), note) < 1
    ) {
      this.state!.recovered = true;
      this.collectedAt = this.age;
      if (this.state!.kind === 'breakroom') g.hp = Math.min(100, g.hp + 10);
      g.onSound('story-found');
      g.burst(note, 7, '#e5cf9d', 1.6);
      g.save();
      g.onChange();
    }
    if (this.state!.kind !== 'experiment' || g.clear) return;
    if (previousPhase < COLD_RIG.warning && this.phase >= COLD_RIG.warning) g.onSound('story-cold');
    const cycle = Math.floor(this.age / COLD_RIG.period);
    if (cycle !== this.cycle) {
      this.cycle = cycle;
      this.pulsed.clear();
    }
    if (!this.emitting) return;
    const origin = this.rig;
    for (const e of g.enemies) {
      if (
        e.hp <= 0 ||
        e.spawn > 0 ||
        e.allied ||
        isBoss(e.kind) ||
        this.pulsed.has(e.id) ||
        distance(origin, e.body.position) > COLD_RIG.radius ||
        distance(g.lineEnd(origin, e.body.position), e.body.position) > 1
      )
        continue;
      this.pulsed.add(e.id);
      const cold = g.cryogenic.state(e);
      if (cold.immune > g.time) continue;
      cold.cold = COLD.threshold;
      cold.touched = g.time;
      cold.frozen = g.time + COLD.freeze;
      cold.immune = cold.frozen + COLD.immunity;
      breakSquad(g, e);
      releaseScrapper(g, e);
      g.burst(e.body.position, 4, '#a3e6ec', 1.3);
    }
  }
}
