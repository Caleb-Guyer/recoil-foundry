import { seeded } from '../src/rules.ts';

// Editorial timing, shared by the picture, game-effects stem and music edit.
export function endingTiming(impactFrame: number) {
  return {
    impactFrame,
    buildStartFrame: impactFrame - 288,
    breathFrame: impactFrame - 12,
    ctaFrame: impactFrame + 66,
    linkFrame: impactFrame + 90,
    fadeStartFrame: impactFrame + 360,
    fadeEndFrame: impactFrame + 432,
    endFrame: impactFrame + 462,
  };
}
export type EndingTiming = ReturnType<typeof endingTiming>;
const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};

export function drawEnding(c: CanvasRenderingContext2D, frame: number, timing: EndingTiming) {
  const w = c.canvas.width,
    h = c.canvas.height,
    t = (frame - timing.impactFrame) / 60;
  c.setTransform(w / 1920, 0, 0, h / 1080, 0, 0);
  c.fillStyle = '#000000';
  c.fillRect(0, 0, 1920, 1080);
  if (frame >= timing.fadeEndFrame) return;
  c.save();
  c.globalAlpha = 1 - smooth((frame - timing.fadeStartFrame) / 72);
  c.fillStyle = '#080e11';
  c.fillRect(0, 0, 1920, 1080);

  // Restrained steel seams and a fading amber glow continue the factory setting.
  const glow = c.createRadialGradient(960, 540, 50, 960, 540, 840);
  glow.addColorStop(0, `rgba(106,139,124,${0.07 + 0.16 * Math.exp(-t * 4)})`);
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

  // The entire wordmark lands together on the musical downbeat.
  c.save();
  const settle = 1 + 0.048 * Math.exp(-t * 14);
  c.translate(960, 430 + Math.sin(t * 64) * 4 * Math.exp(-t * 18));
  c.scale(settle, settle);
  c.textAlign = 'center';
  c.fillStyle = '#e9eadc';
  c.font = '248px "Release Bold"';
  c.fillText('RECOIL', 0, 40);
  c.fillStyle = '#acc3b6';
  c.font = '78px "Release Mono"';
  c.fillText('F O U N D R Y', 0, 153);
  c.restore();

  c.save();
  c.globalAlpha *= smooth((frame - timing.ctaFrame) / 24);
  c.textAlign = 'center';
  c.fillStyle = '#d49463';
  c.fillRect(926, 680, 68, 3);
  c.fillStyle = '#e9eadc';
  c.font = '42px "Release Bold"';
  c.fillText('PLAY FREE NOW', 960, 760);
  c.fillStyle = '#a8b8af';
  c.font = '28px "Release Sans"';
  c.fillText('IN YOUR BROWSER', 960, 806);
  c.globalAlpha *= smooth((frame - timing.linkFrame) / 24);
  c.font = '31px "Release Mono"';
  c.fillStyle = '#c0cbc1';
  c.fillText('caleb-guyer.itch.io/recoil-foundry', 960, 875);
  c.restore();
  c.restore();
}

// Original industrial sound design: rising air, a weighty metal hit and its room tail.
export function endingAudio(timing: EndingTiming, duration: number, rate = 48000) {
  const channels = [
    new Float32Array(Math.ceil(duration * rate)),
    new Float32Array(Math.ceil(duration * rate)),
  ];
  const random = seeded('RF-TRAILER-ENDING-6');
  const impact = timing.impactFrame / 60,
    build = timing.buildStartFrame / 60,
    breath = timing.breathFrame / 60;
  let low = 0,
    mid = 0,
    phase = 0;
  for (let i = Math.round(build * rate); i < channels[0].length; i++) {
    const time = i / rate;
    const noise = random() * 2 - 1;
    low += (noise - low) * 0.02;
    mid += (noise - mid) * 0.16;
    let center = 0,
      side = 0;
    if (time < breath) {
      const x = (time - build) / (breath - build);
      const shut = 1 - smooth((time - breath + 0.018) / 0.018);
      phase += (Math.PI * 2 * (80 + 160 * x * x)) / rate;
      center = (Math.sin(phase) * 0.022 + (mid - low) * 0.28) * x * x * shut;
      side = noise * x * x * 0.018 * shut;
    }
    if (time >= impact) {
      const t = time - impact;
      const attack = smooth(t / 0.002);
      // A short descending body with non-harmonic steel partials; no borrowed samples.
      const body = Math.sin(2 * Math.PI * (48 * t + 4 * (1 - Math.exp(-t * 18))));
      const steel =
        Math.sin(t * 2 * Math.PI * 173) * 0.1 +
        Math.sin(t * 2 * Math.PI * 281) * 0.055 +
        Math.sin(t * 2 * Math.PI * 461) * 0.025;
      center =
        attack *
        (body * 0.46 * Math.exp(-t * 5) +
          steel * Math.exp(-t * 2.8) +
          mid * 0.62 * Math.exp(-t * 24));
      // Quiet factory tail under the readable play link, with a continuous closing fade.
      const fade = 1 - smooth((time - timing.fadeStartFrame / 60) / 1.2);
      center += (low * 0.055 + Math.sin(t * 2 * Math.PI * 74) * 0.008) * smooth(t / 0.15) * fade;
      side = mid * 0.024 * Math.exp(-t * 1.6);
    }
    channels[0][i] = center + side;
    channels[1][i] = center - side;
  }
  // Short, offset reflections let the impact resolve as the CTA arrives.
  const dry = channels.map((ch) => ch.slice());
  for (const [delay, gain] of [
    [0.11, 0.22],
    [0.23, 0.14],
    [0.39, 0.075],
    [0.61, 0.035],
  ])
    for (let ch = 0; ch < 2; ch++) {
      const offset = Math.round((delay + ch * 0.013) * rate);
      for (let i = Math.round(impact * rate); i < Math.round((impact + 2) * rate); i++)
        if (i + offset < channels[ch].length) channels[ch][i + offset] += dry[ch][i] * gain;
    }
  return channels;
}
