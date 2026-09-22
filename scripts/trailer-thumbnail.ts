// Recompose a real frame for small YouTube cards without inventing game effects.
export function drawThumbnail(c: CanvasRenderingContext2D, gameplay: CanvasImageSource) {
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#071015';
  c.fillRect(0, 0, 1920, 1080);
  c.drawImage(gameplay, 300, -160, 2400, 1350);
  const shade = c.createLinearGradient(0, 0, 1500, 0);
  shade.addColorStop(0, '#071015');
  shade.addColorStop(0.48, 'rgba(7,16,21,.97)');
  shade.addColorStop(0.72, 'rgba(7,16,21,.72)');
  shade.addColorStop(1, 'rgba(7,16,21,0)');
  c.fillStyle = shade;
  c.fillRect(0, 0, 1920, 1080);
  c.textAlign = 'left';
  c.fillStyle = '#e9eadc';
  c.font = '200px "Release Bold"';
  c.fillText('RECOIL', 96, 370);
  c.fillStyle = '#acc3b6';
  c.font = '70px "Release Mono"';
  c.fillText('F O U N D R Y', 102, 482);
  c.fillStyle = '#e9eadc';
  c.font = '54px "Release Bold"';
  c.fillText('ONE GUN.', 104, 661);
  c.fillText('ALL RECOIL.', 104, 724);
  c.fillStyle = '#d49463';
  c.fillRect(106, 870, 5, 43);
  c.fillStyle = '#c0cbc1';
  c.font = '36px "Release Mono"';
  c.fillText('LAUNCH TRAILER', 132, 905);
}
