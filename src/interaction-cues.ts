import type { Game } from './game.ts';
import { distance, type Vec } from './rules.ts';

export interface InteractionCue {
  pos: Vec;
  kind: 'shoot' | 'jump';
}
export function interactionCues(g: Game): InteractionCue[] {
  if (g.mode === 'title' || g.workshop.active || g.practice) return [];
  const cues: InteractionCue[] = [];
  const reachable = (pos: Vec, range: number) =>
    distance(g.player.position, pos) <= range &&
    distance(g.lineEnd(g.player.position, pos), pos) < 1;
  const box = g.auditor.caseProp;
  if (
    box &&
    g.auditor.caseReady &&
    distance(g.lineEnd(g.player.position, box.body.position, 0, box), box.body.position) < 1
  )
    cues.push({ pos: box.body.position, kind: 'shoot' });
  const panel = g.shutdown.target;
  if (panel && reachable(panel, 190)) cues.push({ pos: panel, kind: 'shoot' });
  const relay = g.enemies.find((e) => e.eventRole === 'relay' && e.spawn <= 0);
  if (relay && reachable(relay.body.position, 190))
    cues.push({ pos: relay.body.position, kind: 'shoot' });
  if (g.areaEvents.terminalReady && distance(g.player.position, g.areaEvents.site) <= 65)
    cues.push({ pos: { x: g.areaEvents.site.x, y: g.areaEvents.site.y - 32 }, kind: 'jump' });
  return cues;
}

// Shared shapes on nearby ready machinery, not an objective overlay.
export function drawInteractionCues(c: CanvasRenderingContext2D, g: Game) {
  c.save();
  c.strokeStyle = '#eed4a0';
  c.lineWidth = 2;
  for (const { pos: p, kind } of interactionCues(g)) {
    c.beginPath();
    if (kind === 'shoot') {
      for (const x of [-1, 1])
        for (const y of [-1, 1]) {
          c.moveTo(p.x + x * 26, p.y + y * 34);
          c.lineTo(p.x + x * 34, p.y + y * 34);
          c.lineTo(p.x + x * 34, p.y + y * 26);
        }
    } else {
      c.moveTo(p.x - 8, p.y - 40);
      c.lineTo(p.x, p.y - 48);
      c.lineTo(p.x + 8, p.y - 40);
      c.moveTo(p.x, p.y - 48);
      c.lineTo(p.x, p.y - 30);
    }
    c.stroke();
  }
  c.restore();
}
