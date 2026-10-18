import { Game } from '../src/game.ts';
import { getGun, seeded } from '../src/rules.ts';
import { drawOutfit } from '../src/cosmetics.ts';
import { drawWeapon } from '../src/weapon-art.ts';

// A deliberately spare character poster. The character and gun are the exact
// gameplay drawing functions, enlarged without invented anatomy or AI artwork.
export function drawHeroThumbnail(c: CanvasRenderingContext2D) {
  const g = new Game();
  g.mods = ['magnum', 'kick'];
  g.gun = getGun(g.mods, 'pistol');
  g.time = 10;
  g.lastShot = -99;
  g.muzzle = 0;
  const random = seeded('FOUNDRY-HERO-POSTER');
  c.save();
  c.scale(c.canvas.width / 1920, c.canvas.height / 1080);
  c.fillStyle = '#090f13';
  c.fillRect(0, 0, 1920, 1080);
  // Architectural shapes and one hard backlight echo the game's factory art.
  c.fillStyle = '#101a20';
  c.fillRect(930, 0, 820, 920);
  c.fillStyle = '#17262b';
  c.fillRect(1070, 0, 30, 920);
  c.fillRect(1630, 0, 30, 920);
  c.fillStyle = '#273332';
  c.fillRect(1163, 82, 328, 838);
  c.fillStyle = '#ae8551';
  c.fillRect(1171, 90, 312, 830);
  c.fillStyle = '#e0bb79';
  c.fillRect(1180, 90, 294, 830);
  const bloom = c.createRadialGradient(1330, 615, 60, 1330, 615, 670);
  bloom.addColorStop(0, '#ddb76d38');
  bloom.addColorStop(1, '#ddb76d00');
  c.fillStyle = bloom;
  c.fillRect(700, 0, 1220, 1080);
  c.fillStyle = '#142126';
  c.beginPath();
  c.moveTo(0, 940);
  c.lineTo(1920, 940);
  c.lineTo(1920, 1080);
  c.lineTo(0, 1080);
  c.fill();
  c.fillStyle = '#8f8e70';
  c.fillRect(0, 938, 1920, 3);
  c.fillStyle = '#070c10';
  c.beginPath();
  c.ellipse(1330, 939, 300, 38, 0, 0, Math.PI * 2);
  c.fill();
  // Long cast shadow rather than another decorative sci-fi ring.
  c.beginPath();
  c.moveTo(1200, 932);
  c.lineTo(1450, 932);
  c.lineTo(1750, 1080);
  c.lineTo(1000, 1080);
  c.closePath();
  c.fill();
  c.save();
  c.translate(1305, 683);
  c.scale(14, 14);
  c.shadowColor = '#e9cc91';
  c.shadowBlur = 1.4;
  drawOutfit(c, 'night', 1, 0);
  c.shadowBlur = 0;
  c.translate(6, -1);
  c.rotate(-0.82);
  drawWeapon(c, g, true);
  c.restore();
  // Sparse, deterministic embers; no noisy texture, fake depth of field or HUD.
  for (let i = 0; i < 28; i++) {
    const x = 980 + random() * 740,
      y = 70 + random() * 790;
    c.fillStyle = i % 3 ? '#cfa66c65' : '#f0d198b0';
    c.fillRect(x, y, i % 3 ? 2 : 3, i % 4 ? 5 : 11);
  }
  c.textAlign = 'left';
  c.fillStyle = '#e9eadc';
  c.font = '202px "Release Bold"';
  c.fillText('RECOIL', 94, 443);
  c.font = '105px "Release Mono"';
  c.fillText('F O U N D R Y', 105, 569);
  c.fillStyle = '#d9b177';
  c.fillRect(108, 618, 100, 5);
  c.font = '30px "Release Mono"';
  c.fillText('PLAY FREE', 108, 904);
  c.restore();
}
