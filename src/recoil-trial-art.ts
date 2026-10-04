import type { Game } from './game.ts';
import { RECOIL_TRIALS } from './recoil-trial-rules.ts';
import { trialEntry } from './recoil-trial-layouts.ts';

export function drawRecoilTrialHatch(c: CanvasRenderingContext2D, g: Game) {
  const { x, floor } = g.branchDoor,
    color = g.clear ? '#a8d6c7' : '#536b68';
  c.save();
  c.fillStyle = '#172529';
  c.fillRect(x - 36, floor - 111, 72, 111);
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.strokeRect(x - 36, floor - 111, 72, 111);
  c.font = '9px monospace';
  c.textAlign = 'center';
  c.fillStyle = color;
  c.fillText('RECOIL TRIAL', x, floor - 124);
  c.beginPath();
  c.moveTo(x - 15, floor - 60);
  c.lineTo(x + 12, floor - 60);
  c.lineTo(x + 3, floor - 70);
  c.moveTo(x + 12, floor - 60);
  c.lineTo(x + 3, floor - 50);
  c.stroke();
  c.font = '12px monospace';
  c.fillText(g.clear ? '+1' : '×', x, floor - 24);
  c.restore();
}
export function drawRecoilTrial(c: CanvasRenderingContext2D, g: Game) {
  if (!g.recoil.active) return;
  const trial = g.recoil,
    info = RECOIL_TRIALS[trial.kind],
    start = trialEntry(trial.kind);
  c.save();
  c.textAlign = 'center';
  c.fillStyle = '#d4e7dc';
  c.font = 'bold 15px monospace';
  const signX = trial.kind === 'launch' ? 1000 : trial.kind === 'cargo' ? 180 : 420;
  c.fillText(info.name.toUpperCase(), signX, start.y - 153);
  c.font = '11px sans-serif';
  const lines = info.instruction.split('. ').flatMap((sentence) => {
    const rows: string[] = [];
    for (const word of sentence.split(' ')) {
      const last = rows.length - 1;
      if (last < 0 || rows[last].length + word.length + 1 > 42) rows.push(word);
      else rows[last] += ' ' + word;
    }
    return rows;
  });
  lines.forEach((line, i) => c.fillText(line, signX, start.y - 129 + i * 17));
  c.fillStyle = '#92aaa5';
  c.fillText(
    'Clean clear ≤ ' + info.mastery / 1000 + 's earns a cosmetic.',
    signX,
    start.y - 129 + lines.length * 17 + 16,
  );
  c.fillText(
    trial.practice ? 'Pause → Menu to leave.' : 'Pause → Leave trial to skip.',
    signX,
    start.y - 129 + lines.length * 17 + 33,
  );
  if (trial.kind !== 'airborne')
    for (const [index, point] of g.level.route.entries()) {
      const h = trial.kind === 'cargo' ? g.hazards.items[index] : undefined;
      const y = h ? h.body.position.y - h.placement.h / 2 - 17 : point.y - 20;
      c.strokeStyle =
        index < trial.waypoint ? '#a8d6c7' : index === trial.waypoint ? '#f2c98c' : '#526765';
      c.fillStyle = c.strokeStyle;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(point.x, y, 11, 0, Math.PI * 2);
      c.stroke();
      c.font = '10px monospace';
      c.fillText(index < trial.waypoint ? '✓' : String(index + 1), point.x, y + 4);
    }
  if (trial.kind === 'cargo') {
    c.fillStyle = '#162629';
    c.fillRect(330, 730, 1330, 10);
    c.strokeStyle = '#6f6a4f';
    c.lineWidth = 3;
    for (let x = 340; x < 1650; x += 45) {
      c.beginPath();
      c.moveTo(x, 732);
      c.lineTo(x + 15, 740);
      c.stroke();
    }
    for (const h of g.hazards.items) {
      c.strokeStyle = '#4d6667';
      c.lineWidth = 2;
      for (const dx of [-55, 55]) {
        c.beginPath();
        c.moveTo(h.placement.x + dx, 350);
        c.lineTo(h.body.position.x + dx, h.body.position.y - 12);
        c.stroke();
      }
    }
  }
  if (trial.kind === 'airborne') {
    c.fillStyle = '#92aaa5';
    c.font = '11px monospace';
    c.fillText(
      trial.done
        ? 'ALL TARGETS CLEAR → EXIT'
        : trial.flying
          ? 'KEEP AIRBORNE'
          : 'JUMP · SHOOT · STAY UP',
      1080,
      265,
    );
    trial.targets.forEach((e, i) => {
      c.fillStyle = e.hp <= 0 ? '#a8d6c7' : '#e7c491';
      c.fillRect(1050 + i * 22, 285, 12, 4);
    });
  }
  const door = trial.exit;
  c.fillStyle = '#b6cdc2';
  c.font = '10px monospace';
  c.fillText(
    trial.done ? (trial.practice ? 'COURSE COMPLETE' : 'COMPLETE +1') : 'COMPLETE THE COURSE',
    door.x,
    door.floor - 128,
  );
  c.restore();
}
