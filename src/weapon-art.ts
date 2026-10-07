import { drawTorchWeapon } from './torch-art.ts';
import { GUN_FINISHES, drawFinishMark } from './cosmetics.ts';
import type { Game } from './game.ts';
import { clamp } from './rules.ts';
import { drawCapacitor, drawCountershot } from './ballistics-art.ts';
import { pumpCycle } from './combat-feel.ts';

// The caller supplies the player's position and aim transform. Every moving
// part follows the simulation clock, so a paused shot stays exactly still.
export function drawWeapon(c: CanvasRenderingContext2D, g: Game, reduced: boolean): void {
  c.save();
  if (g.mods.includes('collimator')) {
    c.fillStyle = '#344d46';
    c.fillRect(23, -13, 12, 2);
    c.fillStyle = '#b8ddc9';
    c.fillRect(23, -13, 12 * g.support.focus, 2);
  }
  if (g.mods.includes('overkill-bank')) {
    c.fillStyle = g.support.reserve > 0 ? '#e7c984' : '#625b48';
    c.fillRect(5, -14, 5, 3);
  }
  if (g.mods.includes('heat-relay')) {
    c.fillStyle = g.support.relay > 0 && g.time <= g.support.relayUntil ? '#f0b879' : '#68533f';
    c.fillRect(13, -14, 5, 3);
  }
  c.restore();
  if (g.mods.includes('scrap-feed')) {
    c.save();
    c.fillStyle = g.scrap.loaded ? '#dec297' : '#63756a';
    for (let i = 0; i < 3; i++) c.fillRect(9 + i * 4, -12, 2, 4);
    c.restore();
  }
  if (g.torch.equipped) {
    drawTorchWeapon(c, g, reduced);
    return;
  }
  const massDriver = g.massDriver.equipped,
    carbine = g.startingGun === 'carbine' && !massDriver && !g.gun.shellshock,
    twinbore = g.startingGun === 'twinbore' && !massDriver && !g.gun.shellshock,
    repeater = g.startingGun === 'repeater',
    shotgun = g.startingGun === 'shotgun' && !massDriver && !g.gun.shellshock,
    heavy = g.mods.includes('magnum') || massDriver || carbine,
    scatter = g.startingGun === 'shotgun' || g.mods.includes('scatter') || twinbore,
    burst = g.startingGun === 'nailgun' || g.mods.includes('burst'),
    rapid = g.mods.includes('rapid'),
    backblast = g.mods.includes('backblast'),
    piercing = g.mods.includes('pierce'),
    banking = g.mods.includes('ricochet') || g.mods.includes('banker'),
    shotAge = Math.max(0, g.time - g.lastShot),
    flash = clamp(g.muzzle / 0.065, 0, 1),
    spring = clamp(1 - shotAge / (heavy ? 0.18 : 0.11), 0, 1),
    punch = Math.max(flash, spring * spring),
    motion = reduced ? 0.16 : 1,
    receiverKick = punch * (shotgun ? 4.2 : heavy ? 2.2 : 2.8) * motion,
    barrelKick = punch * (shotgun ? 1.5 : heavy ? 4.8 : 0.4) * motion,
    muzzle = massDriver
      ? 45
      : carbine
        ? 46
        : twinbore
          ? 39
          : heavy
            ? 40
            : scatter
              ? 35
              : repeater
                ? 34
                : 31,
    muzzleHalf = massDriver ? 8 : scatter ? 8.5 : heavy ? 5.5 : 4,
    cycling = burst && shotAge < Math.max(0.13, g.gun.interval * 0.35),
    // Pause cancels queued rounds; the mechanism follows the last discharge.
    chamber = clamp(
      Math.round((g.lastShot - (g.shootAt - g.gun.interval * 3.1)) / (g.gun.interval * 0.3)),
      0,
      2,
    );

  c.save();
  if (g.mods.includes('coolant-rounds') || g.mods.includes('suspension')) {
    c.fillStyle = g.mods.includes('suspension') ? '#b4a6dd' : '#9bdbe5';
    c.fillRect(17, -9, 12, 2);
  }
  if (g.mobility.launchReady) {
    c.fillStyle = '#b8ddc9';
    c.fillRect(7, -7, 5, 2);
  }
  if (backblast) {
    c.fillStyle = '#b99f71';
    c.fillRect(2, -4.5, 4, 9);
    c.fillStyle = '#34493f';
    c.fillRect(2, -2.5, 2, 5);
    if (g.gun.rearVolley) {
      c.fillStyle = '#b4c3a8';
      c.fillRect(-7, -3, 9, 6);
      c.fillStyle = '#26392f';
      c.fillRect(-8, -2, 2, 4);
    }
  }
  c.translate(-receiverKick, 0);

  if (rapid) {
    c.fillStyle = '#678779';
    c.beginPath();
    c.roundRect(9, 2.5, 10, 6, 1.5);
    c.fill();
    c.fillStyle = '#a4bba3';
    c.fillRect(11, 6, 6, 1);
  }

  // The heavy shroud retracts into the receiver while its muzzle stays one
  // coherent shape with the scatter attachment.
  c.save();
  c.translate(-barrelKick, 0);
  if (heavy) {
    c.fillStyle = '#b1bdae';
    c.beginPath();
    c.moveTo(18, -7);
    c.lineTo(31, -7);
    c.lineTo(35, -5.5);
    c.lineTo(38, -5.5);
    c.lineTo(38, 5.5);
    c.lineTo(31, 7);
    c.lineTo(18, 7);
    c.closePath();
    c.fill();
    c.fillStyle = '#e0e3d1';
    c.fillRect(20, -7, 11, 2.5);
    c.fillStyle = '#536c5f';
    c.fillRect(19, 4, 12, 3);
    c.fillStyle = '#384c41';
    c.fillRect(28, -3, 3, 6);
  } else {
    c.fillStyle = '#718779';
    c.fillRect(20, -4, muzzle - 20, 8);
    c.fillStyle = '#b7c5b2';
    c.fillRect(22, -4, muzzle - 23, 2);
  }

  if (massDriver) {
    c.fillStyle = '#617a7b';
    c.fillRect(27, -7, 17, 14);
    c.fillStyle = '#c2cfc3';
    c.fillRect(27, -9, 15, 2);
    c.fillRect(27, 7, 15, 2);
    c.fillStyle = '#334749';
    c.fillRect(39, -8, 6, 16);
    c.fillStyle = '#cbd3c5';
    c.fillRect(40, -8, 4, 2);
    c.fillStyle = '#15282c';
    c.fillRect(43, -6, 2, 12);
  } else if (scatter) {
    c.fillStyle = '#718879';
    c.beginPath();
    c.moveTo(muzzle - 10, -4);
    c.lineTo(muzzle - 5, -muzzleHalf);
    c.lineTo(muzzle, -muzzleHalf);
    c.lineTo(muzzle, muzzleHalf);
    c.lineTo(muzzle - 5, muzzleHalf);
    c.lineTo(muzzle - 10, 4);
    c.closePath();
    c.fill();
    c.fillStyle = '#d0d9bf';
    c.fillRect(muzzle - 5, -muzzleHalf, 4, 2);
    c.fillRect(muzzle - 5, muzzleHalf - 2, 4, 2);
    c.fillStyle = '#26392f';
    c.fillRect(muzzle - 2, -muzzleHalf + 2, 2, muzzleHalf * 2 - 4);
    c.fillStyle = '#a3b697';
    c.fillRect(muzzle - 2, -0.75, 2, 1.5);
  } else {
    c.fillStyle = '#394f42';
    c.fillRect(muzzle - 5, -muzzleHalf, 5, muzzleHalf * 2);
    c.fillStyle = '#b6c5ab';
    c.fillRect(muzzle - 5, -muzzleHalf, 4, 1.5);
    c.fillStyle = '#182d22';
    c.fillRect(muzzle - 1.5, -muzzleHalf + 1.5, 1.5, muzzleHalf * 2 - 3);
  }
  if (piercing) {
    c.fillStyle = '#c0d5b9';
    c.fillRect(24, heavy ? -7 : -5.5, heavy ? 10 : 5, 1.5);
  }
  if (carbine) {
    c.fillStyle = '#546e72';
    c.fillRect(32, -5, 14, 10);
    c.fillStyle = '#9ddae0';
    for (let i = 0; i < 3; i++) c.fillRect(33 + i * 4, -6, 2, 12);
    c.fillStyle = '#263b3e';
    c.fillRect(45, -4, 2, 8);
    c.fillStyle = '#c8d6c7';
    c.fillRect(11, -10, 22, 2);
    c.fillRect(30, -11, 3, 4);
  }
  if (twinbore) {
    c.fillStyle = '#a5b8a2';
    c.fillRect(25, -7, 15, 4);
    c.fillRect(25, 3, 15, 4);
    c.fillStyle = '#253a31';
    c.fillRect(38, -6, 2, 2);
    c.fillRect(38, 4, 2, 2);
  }
  if (banking) {
    c.fillStyle = '#c0ab7c';
    c.fillRect(23, heavy ? 6 : 3, heavy ? 9 : 5, 1.5);
  }
  if (g.mods.includes('vector')) {
    c.strokeStyle = g.mods.includes('afterburner') ? '#d4b586' : '#a5cad0';
    c.lineWidth = 1.5;
    c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo(muzzle - 10, side * (muzzleHalf + 1));
      c.lineTo(muzzle - 5, side * (muzzleHalf + 3));
    }
    c.stroke();
  }
  if (g.gun.shellshock) {
    c.fillStyle = '#ba8b56';
    c.fillRect(muzzle - 7, -muzzleHalf - 1.5, 3, muzzleHalf * 2 + 3);
    c.fillStyle = '#edc791';
    c.fillRect(muzzle - 7, -muzzleHalf - 1.5, 3, 2);
  }
  c.restore();

  const half = burst ? 6 : 5;
  const finish = GUN_FINISHES[g.cosmetics.gun];
  if (repeater) {
    c.fillStyle = finish.shell;
    c.beginPath();
    c.roundRect(15, 4, 16, 13, 4);
    c.fill();
    c.fillStyle = '#3a5148';
    c.fillRect(18, 7, 10, 7);
    c.fillStyle = '#a8c0b2';
    for (let i = 0; i < 3; i++) c.fillRect(20 + i * 3, 8, 1, 5);
  }
  c.fillStyle = finish.shell;
  c.beginPath();
  c.roundRect(5, -half, 21, half * 2, 2);
  c.fill();
  c.fillStyle = finish.face;
  c.fillRect(8, -half + 1, 16, half * 2 - 3);
  c.fillStyle = finish.trim;
  c.fillRect(7, half - 1.5, 16, 1.5);
  drawFinishMark(c, g.cosmetics.gun, clamp(1 - shotAge / 0.35, 0, 1) * (reduced ? 0.4 : 1));
  if (burst) {
    c.fillStyle = '#3b5243';
    c.fillRect(7, -4, 17, 5);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = cycling && chamber === i ? '#c5dcb7' : '#7c9b84';
      c.fillRect(8 + i * 5, -3, 3, 3);
    }
    c.fillStyle = '#405846';
    c.fillRect(8, 2, 15, 2);
    c.fillStyle = '#c1d3b3';
    c.fillRect(12 - punch * 3.5 * motion, 2, 7, 2);
  } else {
    c.fillStyle = finish.light;
    c.fillRect(10, -3, 11, 2);
    c.fillStyle = '#637e68';
    c.fillRect(9, 1, 6, 2);
  }
  if (g.gun.redline && g.evolutions.redline > 0) {
    c.fillStyle = '#eead76';
    c.fillRect(10, half - 1, (12 * g.evolutions.redline) / 0.5, 1.5);
  }
  if (g.gun.deadlock) {
    for (let i = 0; i < g.evolutions.streak; i++) {
      c.fillStyle = '#d3dfb7';
      c.fillRect(9 + i * 3, -half, 2, 2);
    }
  }
  if (g.landingReady || g.evolutions.slingReady) {
    c.fillStyle = reduced ? 'rgba(220,240,166,0.06)' : 'rgba(220,240,166,0.12)';
    c.fillRect(7, -half - 3, 18, 5);
    c.fillStyle = g.evolutions.slingReady ? '#8edaff' : '#e2edaa';
    c.fillRect(9, -half - 1, 14, 2);
  }

  if (g.mods.includes('tripwire')) {
    c.fillStyle = '#687867';
    c.fillRect(17, 4, 9, 4);
    c.strokeStyle = '#c2b18a';
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(21, 8, 3, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = g.tripwires.anchor ? '#f0ce8a' : '#899783';
    c.fillRect(24, 5, 2, 2);
  }
  drawCapacitor(c, g);
  drawCountershot(c, g, reduced, heavy ? -8 : -half - 1);
  if (shotgun) {
    const pull = pumpCycle(g.time - g.combatFeel.pumpStartedAt, g.gun.interval) * (reduced ? 1 : 7);
    c.fillStyle = '#293c35';
    c.fillRect(18, 5, 17, 2);
    c.fillStyle = finish.shell;
    c.fillRect(22 - pull, 6, 11, 5);
    c.fillStyle = finish.trim;
    for (let i = 0; i < 3; i++) c.fillRect(24 - pull + i * 3, 7, 1, 3);
    c.fillStyle = '#97a59c';
    c.fillRect(24 - pull, 10, 6, 2);
  }
  if (flash > 0) {
    const tip = muzzle - barrelKick;
    c.globalAlpha *= flash * (reduced ? 0.28 : 0.9);
    c.fillStyle = g.chargedFlash ? '#edf5b9' : '#ffe4ad';
    if (reduced) c.fillRect(tip, -2, 3, 4);
    else {
      const length =
          (shotgun ? 23 : heavy ? 20 : burst ? 10 : 14) +
          (g.chargedFlash ? 7 : 0) +
          (g.shotCount % 3) * 1.5,
        width = shotgun ? 9 : scatter ? 8 : heavy ? 5.5 : burst ? 2.5 : 4;
      c.beginPath();
      c.moveTo(tip - 0.5, -width);
      c.lineTo(tip + length * 0.48, -width * 0.22);
      c.lineTo(tip + length, 0);
      c.lineTo(tip + length * 0.48, width * 0.22);
      c.lineTo(tip - 0.5, width);
      c.lineTo(tip + 2, 0);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}
