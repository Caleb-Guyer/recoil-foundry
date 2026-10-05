// Real-input camping diagnostics: initial positions are fixtures, subsequent
// movement, recoil, cover, damage and deaths use the ordinary game simulation.
import { writeFileSync } from 'node:fs';
import Matter from 'matter-js';
import { Game } from '../src/game.ts';
import { getLevel } from '../src/levels.ts';
import { PRACTICE_BOSSES, testCheckpoint } from '../src/practice.ts';
import type { PracticeBoss } from '../src/practice.ts';
import { auditorTestFromUrl } from '../src/auditor-layout.ts';
import { switchboardTestFromUrl } from '../src/switchboard-layout.ts';
import { seeded } from '../src/rules.ts';
import { isHunt, huntSeed } from '../src/hunt-rules.ts';

const { Body } = Matter;
const idle = {
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  fire: false,
  aim: { x: 0, y: 0 },
};
const kinds = [...Object.keys(PRACTICE_BOSSES), 'auditor'] as (PracticeBoss | 'auditor')[];
const selected = process.argv[2] ?? 'all';
const results: Record<string, unknown>[] = [];
export function campingRoom(kind: (typeof kinds)[number], mirror: boolean) {
  const common = Matter.Common as typeof Matter.Common & { _nextId: number; _seed: number };
  common._nextId = common._seed = 0;
  Math.random = seeded('boss-camping-particles');
  const g = new Game();
  if (isHunt(kind)) {
    g.startPractice({ kind, seed: huntSeed(kind) });
  } else if (kind === 'auditor') {
    g.startTest(auditorTestFromUrl(new URL('https://test/?test=auditor&phase=hunt'))!);
    for (let n = 0; n < 300 && !g.auditor.enemy; n++) g.tick(1 / 60, idle);
  } else if (kind === 'switchboard') {
    g.startTest(
      switchboardTestFromUrl(new URL(`https://test/?test=switchboard&mirror=${+mirror}`))!,
    );
  } else {
    const stage = PRACTICE_BOSSES[kind].stage;
    let seed = '';
    for (let n = 0; n < 500; n++) {
      const candidate = 'boss-camp-' + n;
      const level = getLevel(
        candidate,
        stage,
        undefined,
        kind === 'boss' || kind === 'sorter' ? kind : undefined,
      );
      if (
        level.mirrored === mirror &&
        (['welder', 'condenser'].includes(kind) || level.spawns[0]?.kind === kind)
      ) {
        seed = candidate;
        break;
      }
    }
    if (!seed) throw new Error('No seed for ' + kind);
    g.start(seed, testCheckpoint(seed, stage), { kind, seed });
  }
  const e = g.enemies.find((e) => e.kind === kind);
  if (!e) throw new Error('Missing ' + kind);
  return { g, e };
}
if (process.argv[1]?.endsWith('boss-camping-audit.ts')) {
  for (const kind of kinds.filter((k) => selected === 'all' || k === selected)) {
    for (const mirror of kind === 'auditor' ? [false] : [false, true]) {
      const base = campingRoom(kind, mirror);
      const spots = [
        { x: 16, y: 722, spot: 'left-corner' },
        { x: 1984, y: 722, spot: 'right-corner' },
        { x: 1000, y: 722, spot: 'center-floor' },
        { x: base.e.body.position.x, y: 60, spot: 'overhead-recoil' },
        ...base.g.level.solids.flatMap((s, i) => [
          { x: s.x + s.w / 2, y: s.y - 18, spot: 'perch-' + i },
          { x: s.x + 25, y: 722, spot: 'under-' + i },
          ...(s.h >= 60
            ? [
                { x: s.x - 28, y: 722, spot: 'cover-left-' + i },
                { x: s.x + s.w + 28, y: 722, spot: 'cover-right-' + i },
              ]
            : []),
        ]),
      ].filter(
        (p) =>
          p.y > 45 &&
          p.x > 13 &&
          p.x < 1987 &&
          !base.g.solidBodies.some(
            (b) =>
              p.x + 12 > b.bounds.min.x &&
              p.x - 12 < b.bounds.max.x &&
              p.y + 17 > b.bounds.min.y &&
              p.y - 17 < b.bounds.max.y,
          ),
      );
      for (const spot of spots)
        for (const firing of [false, true]) {
          const { g, e } = campingRoom(kind, mirror);
          const started = g.time;
          Body.setPosition(g.player, { x: spot.x, y: spot.y });
          Body.setVelocity(g.player, { x: 0, y: 0 });
          let hits = 0,
            lastHit = g.time,
            gap = 0,
            firstHit: number | null = null,
            dealt = 0,
            taken = 0;
          const damage = g.damagePlayer.bind(g),
            hit = g.hitEnemy.bind(g);
          g.damagePlayer = (...args) => {
            const hp = g.hp;
            damage(...args);
            if (g.hp < hp) {
              hits++;
              taken += hp - g.hp;
              firstHit ??= g.time - started;
              gap = Math.max(gap, g.time - lastHit);
              lastHit = g.time;
            }
          };
          g.hitEnemy = (...args) => {
            const hp = e.hp;
            const result = hit(...args);
            dealt += Math.max(0, hp - e.hp);
            return result;
          };
          for (
            let n = 0;
            n < 2400 && g.mode === 'playing' && e.hp > 0 && g.enemies.includes(e);
            n++
          ) {
            const dx = spot.x - g.player.position.x - g.player.velocity.x * 5;
            g.tick(1 / 60, {
              ...idle,
              left: dx < -8,
              right: dx > 8,
              fire: firing,
              aim: { ...e.body.position },
            });
          }
          const result = {
            kind,
            mirror,
            seed: g.seed,
            layout: g.level.id,
            ...spot,
            firing,
            hp: g.hp,
            bossHp: e.hp,
            seconds: g.time - started,
            hits,
            taken,
            dealt,
            firstHit,
            maxGap: Math.max(gap, g.time - lastHit),
            state: e.state,
            attack: e.attack,
            attacks: e.attacks,
            player: { ...g.player.position },
            boss: { ...e.body.position },
          };
          results.push(result);
          if (taken === 0 || result.maxGap > 15 || (e.hp <= 0 && g.hp > 0))
            console.log(JSON.stringify(result));
        }
    }
    console.log(JSON.stringify({ kind, cases: results.filter((r) => r.kind === kind).length }));
  }
  writeFileSync(
    process.argv[3] ?? '.release-assets/boss-camping-baseline.json',
    JSON.stringify(results, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      cases: results.length,
      untouched: results.filter((r) => r.taken === 0).length,
      safeKills: results.filter((r) => Number(r.bossHp) <= 0 && r.taken === 0).length,
      stalls: results.filter((r) => Number(r.maxGap) > 15).length,
    }),
  );
}
