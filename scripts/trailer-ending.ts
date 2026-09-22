// Picture timing follows the original recording's two closing accents.
export function endingTiming(impactFrame: number, subtitleFrame: number) {
  return {
    impactFrame,
    subtitleFrame,
    transitionStartFrame: impactFrame,
    transitionEndFrame: impactFrame + 6,
    ctaFrame: subtitleFrame + 36,
    linkFrame: subtitleFrame + 42,
    fadeStartFrame: impactFrame + 186,
    fadeEndFrame: impactFrame + 258,
    endFrame: impactFrame + 288,
  };
}
export type EndingTiming = ReturnType<typeof endingTiming>;
const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

export function drawEnding(
  c: CanvasRenderingContext2D,
  frame: number,
  timing: EndingTiming,
  gameplay?: CanvasImageSource,
) {
  const w = c.canvas.width,
    h = c.canvas.height;
  c.setTransform(w / 1920, 0, 0, h / 1080, 0, 0);
  c.fillStyle = '#000000';
  c.fillRect(0, 0, 1920, 1080);
  if (frame >= timing.fadeEndFrame) return;
  c.save();
  c.globalAlpha =
    1 - smooth((frame - timing.fadeStartFrame) / (timing.fadeEndFrame - timing.fadeStartFrame));
  c.fillStyle = '#080e11';
  c.fillRect(0, 0, 1920, 1080);
  const glow = c.createRadialGradient(960, 540, 50, 960, 540, 840);
  glow.addColorStop(0, 'rgba(106,139,124,0.07)');
  glow.addColorStop(1, 'rgba(8,14,17,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, 1920, 1080);
  c.strokeStyle = '#131e21';
  c.lineWidth = 2;
  for (const x of [220, 1700]) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 1080);
    c.stroke();
  }
  // A brief trace of the last blast remains behind the first musical hit.
  if (gameplay && frame < timing.transitionEndFrame) {
    c.save();
    c.globalAlpha *= 0.14 * (1 - smooth((frame - timing.impactFrame) / 6));
    c.drawImage(gameplay, 0, 0, 1920, 1080);
    c.restore();
  }
  c.textAlign = 'center';
  c.fillStyle = '#e9eadc';
  c.font = '248px "Release Bold"';
  c.fillText('RECOIL', 960, 470);
  // Both reveals are fully visible on their assigned transient frame, not after a fade.
  if (frame >= timing.subtitleFrame) {
    c.fillStyle = '#acc3b6';
    c.font = '78px "Release Mono"';
    c.fillText('F O U N D R Y', 960, 583);
  }
  c.save();
  c.globalAlpha *= smooth((frame - timing.ctaFrame) / 12);
  c.fillStyle = '#d49463';
  c.fillRect(926, 680, 68, 3);
  c.fillStyle = '#e9eadc';
  c.font = '58px "Release Bold"';
  c.fillText('PLAY FREE IN YOUR BROWSER', 960, 760);
  c.globalAlpha *= smooth((frame - timing.linkFrame) / 12);
  c.font = '44px "Release Mono"';
  c.fillStyle = '#cbd5cc';
  c.fillText('caleb-guyer.itch.io/recoil-foundry', 960, 850);
  c.restore();
  c.restore();
}
