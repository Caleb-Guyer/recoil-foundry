import type { Game } from './game.ts';
import type { Vec } from './rules.ts';
import { COURIER_DOOR, COURIER_DOOR_TIME } from './courier.ts';
import { drawCourierCase } from './courier-chassis-art.ts';
import { COURIER_EVENT_LIFE } from './courier-pose.ts';

export interface CourierWorldEvent {
  kind: 'drop' | 'pickup' | 'escape';
  position: Vec;
  age: number;
  life: number;
  snapshot?: { opening: number } | null;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
function line(c: CanvasRenderingContext2D, a: Vec, b: Vec, color: string, width = 1) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}
function gear(c: CanvasRenderingContext2D, x: number, y: number, angle: number, active: boolean) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.strokeStyle = active ? '#c5ae79' : '#66766b';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(0, 0, 6.5, 0, Math.PI * 2);
  c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    line(
      c,
      { x: Math.cos(a) * 7, y: Math.sin(a) * 7 },
      { x: Math.cos(a) * 9, y: Math.sin(a) * 9 },
      active ? '#c5ae79' : '#66766b',
      2,
    );
  }
  line(c, { x: -4, y: 0 }, { x: 4, y: 0 }, '#81937e', 1.4);
  line(c, { x: 0, y: -4 }, { x: 0, y: 4 }, '#81937e', 1.4);
  c.fillStyle = '#1b3032';
  c.fillRect(-2, -2, 4, 4);
  c.restore();
}

/** Native hatch progress and the one real case remain authoritative. These cues add no interaction. */
export function drawCourierDispatchWorld(
  c: CanvasRenderingContext2D,
  g: Game,
  reduced = false,
  events: readonly CourierWorldEvent[] = [],
) {
  if (!g.level.courier) return;
  const rig = g.courier,
    { x, y } = COURIER_DOOR,
    departed = !rig.enemy
      ? events.find(
          (event) =>
            event.kind === 'escape' &&
            event.life > 0 &&
            (event.snapshot?.opening ?? 0) >= COURIER_DOOR_TIME &&
            Math.abs(event.position.x - x) < 26 &&
            event.position.y > 700,
        )
      : undefined,
    // Only a completed native hatch escape earns this brief cosmetic closing.
    // Knockback resets and accidental escapes still show the authoritative closed hatch.
    opening = departed
      ? reduced
        ? 0
        : unit(1 - departed.age / 0.5)
      : unit(rig.opening / COURIER_DOOR_TIME),
    turning = opening > 0 && (!!rig.enemy || !!departed);
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.fillStyle = '#142326';
  c.fillRect(x - 29, y - 65, 58, 65);
  c.strokeStyle = '#677467';
  c.lineWidth = 3;
  c.strokeRect(x - 30, y - 66, 60, 66);
  // The drive shaft is linked to the real three-second door travel, including native resets.
  for (const side of [-1, 1]) {
    c.fillStyle = '#34463e';
    c.fillRect(x + side * 31 - 3, y - 68, 6, 66);
    line(c, { x: x + side * 31, y: y - 62 }, { x: x + side * 31, y: y - 8 }, '#8b8e70', 1.5);
  }
  line(c, { x: x - 33, y: y - 70 }, { x: x + 34, y: y - 70 }, '#879078', 3);
  gear(c, x + 40, y - 41, opening * Math.PI * 5, turning);
  line(c, { x: x + 32, y: y - 41 }, { x: x + 40, y: y - 41 }, '#7d846a', 3);
  c.save();
  c.beginPath();
  c.rect(x - 27, y - 62, 54, 62);
  c.clip();
  c.fillStyle = '#3b4a40';
  c.fillRect(x - 27, y - 62 - opening * 64, 54, 62);
  for (let i = 0; i < 5; i++) {
    const at = y - 8 - i * 12 - opening * 64;
    line(c, { x: x - 25, y: at }, { x: x + 25, y: at }, '#687561', 1.3);
    line(c, { x: x - 25, y: at - 1.5 }, { x: x + 25, y: at - 1.5 }, '#283c38', 1);
  }
  // A physical center seam keeps the shutter legible as it travels into its housing.
  line(c, { x, y: y - 62 - opening * 64 }, { x, y: y - opening * 64 }, '#243a37', 1.2);
  c.restore();
  c.fillStyle = '#213936';
  c.fillRect(x - 19, y - 79, 38, 9);
  for (let i = 0; i < 3; i++) {
    const amount = unit(opening * 3 - i);
    c.fillStyle = rig.enemy ? '#695f43' : '#465c51';
    c.fillRect(x - 14 + i * 10, y - 77, 7, 4);
    if (amount > 0) {
      c.fillStyle = '#d9ba7c';
      c.fillRect(x - 14 + i * 10, y - 77, 7 * amount, 4);
    }
  }
  // Emitted only by real outcomes. A living escape never displays a defeated chassis or case.
  for (const event of events) {
    if (
      !Number.isFinite(event.age) ||
      !Number.isFinite(event.life) ||
      event.age < 0 ||
      event.life <= 0
    )
      continue;
    const remaining = unit(event.life / COURIER_EVENT_LIFE),
      travel = reduced ? 0 : unit(event.age / 0.5),
      p = event.position;
    c.save();
    c.globalAlpha *= Math.min(0.8, remaining * (reduced ? 0.7 : 1));
    if (event.kind === 'drop') {
      for (const side of [-1, 1]) {
        line(
          c,
          { x: p.x + side * (16 + travel * 5), y: p.y - 11 },
          { x: p.x + side * (16 + travel * 5), y: p.y - 4 },
          '#d0b880',
          1.4,
        );
        line(
          c,
          { x: p.x + side * (16 + travel * 5), y: p.y - 4 },
          { x: p.x + side * (12 + travel * 5), y: p.y - 1 },
          '#d0b880',
          1.4,
        );
      }
    } else if (event.kind === 'pickup') {
      for (const side of [-1, 1]) {
        line(
          c,
          { x: p.x + side * (18 - travel * 5), y: p.y - 16 - travel * 5 },
          { x: p.x + side * (13 - travel * 5), y: p.y - 20 - travel * 5 },
          '#ded3a0',
          1.6,
        );
      }
      line(
        c,
        { x: p.x - 4, y: p.y - 19 - travel * 5 },
        { x: p.x, y: p.y - 15 - travel * 5 },
        '#ded3a0',
        1.5,
      );
      line(
        c,
        { x: p.x, y: p.y - 15 - travel * 5 },
        { x: p.x + 7, y: p.y - 23 - travel * 5 },
        '#ded3a0',
        1.5,
      );
    } else {
      for (const sy of [-8, 0, 8])
        line(
          c,
          { x: p.x - 16 - travel * 8, y: p.y + sy },
          { x: p.x - 4 - travel * 4, y: p.y + sy },
          '#738173',
          1.4,
        );
    }
    c.restore();
  }
  if (rig.cargo) {
    c.save();
    c.translate(rig.cargo.position.x, rig.cargo.position.y);
    c.rotate(rig.cargo.angle);
    drawCourierCase(c);
    c.restore();
  }
  if (rig.state?.status === 'collected') {
    // This is the native recovered-case display beside the normal reward exit.
    const target = { x: 1862, y: 728 };
    line(c, { x: target.x - 18, y: 739 }, { x: target.x + 18, y: 739 }, '#526b60', 2);
    for (const side of [-1, 1])
      line(
        c,
        { x: target.x + side * 17, y: 737 },
        { x: target.x + side * 17, y: 725 },
        '#9d9d79',
        1.6,
      );
    c.save();
    c.translate(target.x, target.y);
    drawCourierCase(c);
    c.restore();
  }
  c.restore();
}
