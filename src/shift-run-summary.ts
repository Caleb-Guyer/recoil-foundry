import type { Game } from './game.ts';
import { MODS } from './rules.ts';
import { EXPERIMENTS, EVOLUTIONS } from './shift-run.ts';
const safe = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function shiftRunSummary(g: Game) {
  const s = g.shiftRun.state;
  if (!s) return '';
  const rows: string[] = [];
  if (s.lease)
    rows.push(
      'Prototype loan: ' +
        (MODS.find((m) => m.id === s.lease!.morph)?.name ?? s.lease.morph) +
        ' · ' +
        s.lease.cleared.length +
        '/2 rooms cleared.',
    );
  if (s.circuit)
    rows.push(
      'Power: ' + s.circuit.kind + ' · ' + s.circuit.rooms.length + '/3 ordinary rooms used.',
    );
  if (s.experiment) {
    const e = s.experiment;
    rows.push(
      EXPERIMENTS[e.id].name +
        ' · ' +
        (e.status === 'complete'
          ? EVOLUTIONS[e.evolution!].name
          : e.progress + '/3 · ' + EXPERIMENTS[e.id].task),
    );
  }
  if (s.freeRerolls) rows.push('District reroll credits: ' + s.freeRerolls + '.');
  return rows.length
    ? '<details class="build"><summary>Shift equipment</summary><ul>' +
        rows.map((row) => '<li>' + safe(row) + '</li>').join('') +
        '</ul></details>'
    : '';
}
