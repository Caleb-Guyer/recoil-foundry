import type { Game } from './game.ts';
import { GUN_FINISHES } from './cosmetics.ts';
import { EXPERIMENTAL_WEAPONS } from './experimental-weapons.ts';
import { clamp, direction, distance } from './rules.ts';

const TEAL = '#98d8cd';
const BRASS = '#d5b17b';
const COPPER = '#d79b72';
const VIOLET = '#c4b0f0';
const CYAN = '#a9e7e8';
const BLOCKED = '#e5b58b';

/** The ordinary weapon pivot/aim transform is supplied by drawWeapon. */
export function drawExperimentalWeapon(
  c: CanvasRenderingContext2D,
  g: Game,
  reduced: boolean,
): boolean {
  const tool = g.experimentalWeapons,
    kind = tool.kind;
  // A payload conversion keeps its own barrel and ammunition silhouette.
  if (
    !kind ||
    g.torch.equipped ||
    g.shiftMorphs.equipped ||
    g.massDriver.equipped ||
    g.gun.shellshock
  )
    return false;
  const finish = GUN_FINISHES[g.cosmetics.gun],
    age = Math.max(0, g.time - g.lastShot),
    shot = clamp(1 - age / 0.14, 0, 1),
    vent = clamp((tool.flash - g.time) / 0.16, 0, 1),
    motion = reduced ? 0.15 : 1;
  c.save();
  c.translate(-shot * shot * 3 * motion, 0);
  c.fillStyle = finish.shell;
  c.beginPath();
  c.roundRect(5, -6, 19, 12, 2);
  c.fill();
  c.fillStyle = finish.face;
  c.fillRect(8, -4, 14, 6);
  c.fillStyle = finish.trim;
  c.fillRect(7, 4, 15, 2);
  c.fillStyle = '#263b39';
  c.fillRect(10, 6, 6, 9);

  if (kind === 'bellows') {
    const pressure = tool.pressure,
      extension = pressure * 3 * motion;
    // Flexible dark bellows expand between their five rigid brass collars.
    c.fillStyle = '#284d4b';
    c.fillRect(19, -7, 16 + extension, 14);
    for (let i = 0; i < 5; i++) {
      const x = 19 + i * (3.1 + extension / 4);
      c.fillStyle = i % 2 ? '#9e855e' : BRASS;
      c.fillRect(x, -8, 1.5, 16);
      c.fillStyle = '#edcf98';
      c.fillRect(x, -8, 1.5, 2);
    }
    c.fillStyle = '#527b6f';
    c.beginPath();
    c.moveTo(33 + extension, -6);
    c.lineTo(43 + extension, -12);
    c.lineTo(47 + extension, -12);
    c.lineTo(47 + extension, 12);
    c.lineTo(43 + extension, 12);
    c.lineTo(33 + extension, 6);
    c.closePath();
    c.fill();
    c.fillStyle = BRASS;
    c.fillRect(44 + extension, -12, 3, 24);
    c.fillStyle = '#102d30';
    c.fillRect(46 + extension, -9, 2, 18);
    c.fillStyle = TEAL;
    c.fillRect(46 + extension, -9, 1, 18 * pressure);
    c.fillStyle = '#243e3d';
    c.fillRect(9, -12, 12, 4);
    c.fillStyle = TEAL;
    c.fillRect(10, -11, 10 * pressure, 2);
    if (pressure >= 0.999 && g.time >= g.shootAt) {
      // A steady white cap means charged AND mechanically ready, without a pulse.
      c.fillStyle = '#e2f5e5';
      c.fillRect(20, -12, 2, 4);
    }
    for (let i = 0; i < EXPERIMENTAL_WEAPONS.bellowsScrapCap; i++) {
      c.fillStyle = i < tool.scrapCount ? BRASS : '#52685f';
      c.fillRect(11 + i * 3, 8, 2, 3);
    }
    if (tool.holding) {
      c.strokeStyle = TEAL;
      c.lineWidth = 1;
      c.globalAlpha = 0.75;
      c.beginPath();
      for (const y of [-6, 0, 6]) {
        c.moveTo(56 + extension, y);
        c.lineTo(51 + extension, y);
        c.lineTo(53 + extension, y - 2);
      }
      c.stroke();
    }
  } else if (kind === 'debt-collector') {
    const debt = tool.debt;
    // Three exposed pistons sink into the receiver as pressure accumulates.
    c.fillStyle = '#65463d';
    c.fillRect(21, -7, 20, 14);
    c.fillStyle = '#c4b39a';
    c.fillRect(25, -5, 18, 10);
    for (let i = 0; i < 3; i++) {
      const x = 15 + i * 7,
        compression = debt * 4;
      c.fillStyle = '#513d37';
      c.fillRect(x, -11, 4, 19);
      c.fillStyle = COPPER;
      c.fillRect(x, -10 + compression, 4, 12 - compression);
      c.fillStyle = '#f0d0a1';
      c.fillRect(x, -10 + compression, 4, 2);
    }
    c.fillStyle = '#273c3a';
    c.fillRect(40, -6, 5, 12);
    c.fillStyle = COPPER;
    c.fillRect(41, -6, 3, 2);
    c.fillStyle = '#314540';
    c.beginPath();
    c.arc(10, -11, 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = debt >= 0.8 ? '#f1c28b' : COPPER;
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(10, -11, 4, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * debt));
    c.stroke();
    const needle = Math.PI * (0.75 + 1.5 * debt);
    c.beginPath();
    c.moveTo(10, -11);
    c.lineTo(10 + Math.cos(needle) * 3.4, -11 + Math.sin(needle) * 3.4);
    c.stroke();
    c.fillStyle = COPPER;
    c.fillRect(1, -4, 4, 8);
    if (vent > 0) {
      c.globalAlpha = vent * (reduced ? 0.35 : 0.8);
      c.fillStyle = '#f4d9ac';
      c.beginPath();
      c.moveTo(1, -4);
      c.lineTo(reduced ? -5 : -18, -6);
      c.lineTo(reduced ? -3 : -12, 0);
      c.lineTo(reduced ? -5 : -18, 6);
      c.lineTo(1, 4);
      c.closePath();
      c.fill();
    }
  } else {
    // The open split muzzle leaves a visible gap around its beacon contact.
    c.fillStyle = '#51476a';
    c.fillRect(19, -6, 14, 12);
    c.fillStyle = '#736581';
    c.fillRect(22, -4, 11, 8);
    for (const side of [-1, 1]) {
      c.fillStyle = '#756a8b';
      c.beginPath();
      c.moveTo(27, side * 3);
      c.lineTo(35, side * 9);
      c.lineTo(47, side * 9);
      c.lineTo(47, side * 6);
      c.lineTo(36, side * 6);
      c.lineTo(31, side * 2);
      c.closePath();
      c.fill();
      c.fillStyle = CYAN;
      c.fillRect(43, side < 0 ? -9 : 6, 5, 3);
    }
    c.fillStyle = '#211e38';
    c.fillRect(12, -10, 10, 6);
    const landing = tool.landingPreview;
    c.fillStyle = landing ? (landing.ready ? CYAN : BLOCKED) : VIOLET;
    c.fillRect(14, -9, 6, 4);
    c.strokeStyle = VIOLET;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(34, 0);
    c.lineTo(39, -3);
    c.lineTo(44, 0);
    c.lineTo(39, 3);
    c.closePath();
    c.stroke();
    if (landing) {
      c.fillStyle = landing.ready ? CYAN : BLOCKED;
      c.fillRect(25, 8, 10, 2);
    }
  }
  if (shot > 0) {
    c.globalAlpha = shot * (reduced ? 0.25 : 0.8);
    c.fillStyle = kind === 'switchjack' ? CYAN : '#f4e1b7';
    c.fillRect(kind === 'debt-collector' ? 45 : 48, -3, reduced ? 3 : 8, 6);
  }
  c.restore();
  return true;
}

function visible(g: Game) {
  return (
    g.mode === 'playing' &&
    g.hp > 0 &&
    !g.finale.safe &&
    !g.finale.cinema?.active &&
    !g.escape &&
    !!g.experimentalWeapons.kind
  );
}

/** Only cues for the real native state are drawn; no particles or gameplay state are changed. */
export function drawExperimentalWeapons(c: CanvasRenderingContext2D, g: Game, reduced: boolean) {
  if (!visible(g)) return;
  const tool = g.experimentalWeapons,
    p = g.player.position,
    aim = direction(p, g.aim),
    angle = Math.atan2(aim.y, aim.x);
  c.save();
  c.lineCap = 'round';
  if (tool.kind === 'bellows' && tool.holding) {
    const origin = { x: p.x, y: p.y - 3 },
      range = EXPERIMENTAL_WEAPONS.bellowsRange,
      spread = EXPERIMENTAL_WEAPONS.bellowsHalfAngle;
    c.strokeStyle = TEAL;
    c.lineWidth = 1;
    c.globalAlpha = reduced ? 0.28 : 0.36;
    c.beginPath();
    for (const side of [-1, 1]) {
      const a = angle + side * spread,
        end = g.lineEnd(origin, {
          x: origin.x + Math.cos(a) * range,
          y: origin.y + Math.sin(a) * range,
        });
      c.moveTo(origin.x + Math.cos(a) * 43, origin.y + Math.sin(a) * 43);
      c.lineTo(end.x, end.y);
    }
    c.stroke();
    // These short inward chevrons stay behind cover and never hide hostile rounds.
    for (let i = 0; i < 5; i++) {
      const offset = (i - 2) * spread * 0.35,
        a = angle + offset,
        travel = reduced ? 0.5 : (g.time * 1.6 + i * 0.19) % 1,
        r = 68 + (1 - travel) * (range - 95),
        end = { x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r };
      if (distance(g.lineEnd(origin, end), end) > 0.1) continue;
      c.save();
      c.translate(end.x, end.y);
      c.rotate(a);
      c.globalAlpha = reduced ? 0.35 : 0.4 + 0.2 * travel;
      c.beginPath();
      c.moveTo(4, -3);
      c.lineTo(0, 0);
      c.lineTo(4, 3);
      c.stroke();
      c.restore();
    }
  } else if (tool.kind === 'bellows' && tool.flash > g.time) {
    const fade = clamp((tool.flash - g.time) / 0.16, 0, 1),
      radius = reduced ? 67 : 48 + (1 - fade) * 94;
    c.strokeStyle = TEAL;
    c.globalAlpha = fade * (reduced ? 0.3 : 0.65);
    c.lineWidth = reduced ? 1 : 2;
    c.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = angle + (i / 4 - 1) * EXPERIMENTAL_WEAPONS.bellowsHalfAngle,
        point = g.lineEnd(p, {
          x: p.x + Math.cos(a) * radius,
          y: p.y + Math.sin(a) * radius,
        });
      if (i) c.lineTo(point.x, point.y);
      else c.moveTo(point.x, point.y);
    }
    c.stroke();
  } else if (tool.kind === 'debt-collector') {
    const debt = tool.debt,
      paid = tool.ventDirection,
      // Gimbal can steer the eventual kick. Only its actual paid direction is safe to show.
      prospective = debt > 0 && !g.mods.includes('gimbal-mount'),
      ventAngle = paid ? Math.atan2(paid.y, paid.x) : angle + Math.PI;
    if (paid || prospective) {
      const strength = paid ? 1 : debt,
        count = paid || debt >= 0.8 ? 3 : debt >= 0.3 ? 2 : 1;
      c.save();
      c.translate(p.x + Math.cos(ventAngle) * 31, p.y + Math.sin(ventAngle) * 31);
      c.rotate(ventAngle);
      c.globalAlpha = paid ? (reduced ? 0.65 : 0.9) : 0.4 + strength * 0.35;
      c.strokeStyle = paid || debt >= 0.8 ? '#f0d3a3' : COPPER;
      c.lineWidth = paid ? 2 : 1.5;
      c.beginPath();
      for (let i = 0; i < count; i++) {
        c.moveTo(i * 7 - 4, -5);
        c.lineTo(i * 7 + 3, 0);
        c.lineTo(i * 7 - 4, 5);
      }
      c.stroke();
      c.restore();
    }
  } else if (tool.kind === 'switchjack') {
    // The shared full-body validator is read once, so all cues agree with the next press.
    const landing = tool.landingPreview;
    if (!landing) {
      c.restore();
      return;
    }
    const color = landing.ready ? CYAN : BLOCKED,
      end = g.lineEnd(landing.from, landing.to),
      life = clamp(landing.remainingLife / EXPERIMENTAL_WEAPONS.switchLife, 0, 1);
    c.strokeStyle = color;
    c.globalAlpha = reduced ? 0.45 : 0.55;
    c.lineWidth = 1;
    c.setLineDash(landing.ready ? [7, 7] : [3, 6]);
    c.beginPath();
    c.moveTo(landing.from.x, landing.from.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    c.setLineDash([]);
    // The landing box is the operator's real hull, not the much smaller projectile.
    c.globalAlpha = reduced ? 0.65 : 0.75;
    c.strokeRect(
      landing.to.x - landing.half.x,
      landing.to.y - landing.half.y,
      landing.half.x * 2,
      landing.half.y * 2,
    );
    c.save();
    c.translate(landing.to.x, landing.to.y);
    c.globalAlpha = 0.9;
    c.strokeStyle = color;
    c.lineWidth = 1.5;
    c.strokeRect(-7, -7, 14, 14);
    c.globalAlpha = 0.25;
    c.beginPath();
    c.arc(0, 0, 12, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.9;
    c.beginPath();
    c.arc(0, 0, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * life);
    c.stroke();
    if (!landing.ready) {
      c.beginPath();
      c.moveTo(-3, -3);
      c.lineTo(3, 3);
      c.moveTo(3, -3);
      c.lineTo(-3, 3);
      c.stroke();
    }
    c.restore();
  }
  c.restore();
}

/** Screen-space status is readable while recoil moves the camera. */
export function drawExperimentalWeaponHud(
  c: CanvasRenderingContext2D,
  g: Game,
  width: number,
  height: number,
) {
  if (!visible(g) || width < 160 || height < 120) return;
  const tool = g.experimentalWeapons,
    w = Math.min(286, width - 24),
    compact = w < 230,
    x = 12,
    y = height - 70;
  let title: string, meta: string, hint: string, level: number, color: string;
  if (tool.kind === 'bellows') {
    const cycling = g.time < g.shootAt,
      full = tool.pressure >= 0.999;
    title = 'BELLOWS';
    meta = `${cycling ? 'CYCLING' : full ? 'FULL' : Math.round(tool.pressure * 100) + '%'} · ${compact ? '' : 'SCRAP '}${tool.scrapCount}/${EXPERIMENTAL_WEAPONS.bellowsScrapCap}`;
    hint = cycling
      ? 'Cycling · hold to charge'
      : full
        ? 'Full charge · release to blast'
        : tool.holding
          ? 'Charging · release to blast'
          : 'Hold: inhale · release: blast';
    if (compact)
      hint = cycling
        ? 'Hold to charge while cycling'
        : full
          ? 'Release for full blast'
          : tool.holding
            ? 'Charge · release to blast'
            : 'Hold, then release to blast';
    level = tool.pressure;
    color = full && !cycling ? '#e2f5e5' : TEAL;
  } else if (tool.kind === 'debt-collector') {
    const high = tool.debt >= 0.8,
      empty = tool.debt <= 0,
      vented = tool.ventDirection !== null;
    title = compact ? 'DEBT' : 'DEBT COLLECTOR';
    meta = vented
      ? 'VENTED'
      : empty
        ? 'EMPTY'
        : `${high ? 'HIGH · ' : ''}${Math.round(tool.debt * 100)}%`;
    hint = vented
      ? 'Kick paid · hold to bank again'
      : empty
        ? 'Hold fire to bank recoil'
        : high
          ? 'Release · auto-vent at full'
          : tool.debt < 0.2
            ? 'Release for a small kick'
            : g.mods.includes('gimbal-mount')
              ? 'Release to vent stored kick'
              : 'Release: kick away from aim';
    if (compact && vented) hint = 'Hold to bank another kick';
    level = tool.debt;
    color = high || vented ? '#f0d3a3' : COPPER;
  } else {
    const landing = tool.landingPreview,
      cooldown = Math.max(0, g.shootAt - g.time),
      seconds = (n: number) => (Math.ceil(n * 10) / 10).toFixed(1) + 's';
    title = 'SWITCHJACK';
    if (landing) {
      meta = `${landing.ready ? 'CLEAR' : compact ? 'NO' : 'BLOCKED'} · ${seconds(landing.remainingLife)}`;
      hint = landing.ready
        ? landing.needsRelease
          ? 'Release, then tap to relocate'
          : 'Tap: relocate · spends bolt'
        : landing.reason === 'too-close'
          ? 'Let the bolt travel farther'
          : landing.reason === 'out-of-range'
            ? 'Move closer to the bolt'
            : landing.reason === 'boundary'
              ? 'Landing outside room'
              : landing.reason === 'crusher'
                ? 'Landing in crusher sweep'
                : 'Route or landing blocked';
      if (compact && landing.ready)
        hint = landing.needsRelease ? 'Release, then tap to move' : 'Tap: relocate · spends bolt';
      level = clamp(landing.remainingLife / EXPERIMENTAL_WEAPONS.switchLife, 0, 1);
      color = landing.ready ? CYAN : BLOCKED;
    } else {
      meta = cooldown > 0 ? `CYCLING ${seconds(cooldown)}` : 'READY';
      hint = cooldown > 0 ? 'Wait to launch the next bolt' : 'Tap fire: launch a beacon bolt';
      if (compact) hint = cooldown > 0 ? 'Wait to launch next bolt' : 'Tap fire: launch a bolt';
      level = cooldown > 0 ? 1 - cooldown / Math.max(0.001, g.shootAt - g.lastShot) : 1;
      color = VIOLET;
    }
  }
  c.save();
  c.fillStyle = '#101c21eb';
  c.beginPath();
  c.roundRect(x, y, w, 55, 4);
  c.fill();
  c.strokeStyle = '#45585c';
  c.lineWidth = 1;
  c.stroke();
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.font = '600 10px sans-serif';
  c.fillStyle = color;
  c.fillText(title, x + 10, y + 16, w * 0.48 - 10);
  c.textAlign = 'right';
  c.fillText(meta, x + w - 10, y + 16, w * 0.52 - 10);
  c.textAlign = 'left';
  c.font = '11px sans-serif';
  c.fillStyle = '#d0d9d4';
  c.fillText(hint, x + 10, y + 33, w - 20);
  c.fillStyle = '#324648';
  c.fillRect(x + 10, y + 43, w - 20, 3);
  c.fillStyle = color;
  c.fillRect(x + 10, y + 43, (w - 20) * clamp(level, 0, 1), 3);
  if (tool.kind === 'debt-collector') {
    c.fillStyle = '#e9cfaa';
    c.fillRect(x + 10 + (w - 20) * 0.8, y + 41, 1, 7);
  }
  c.restore();
}
