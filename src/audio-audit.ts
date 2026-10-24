import { Sound } from './audio.ts';
import { FactoryAmbience } from './factory-ambience.ts';
import type { SoundMaterial, SoundOrigin } from './sound-event.ts';
import type { AreaId } from './areas.ts';

type Samples = {
  leftRms: number;
  rightRms: number;
  peak: number;
  finite: boolean;
  monoError: number;
};
function measure(buffer: AudioBuffer): Samples {
  const left = buffer.getChannelData(0),
    right = buffer.getChannelData(1);
  let l = 0,
    r = 0,
    peak = 0,
    finite = true,
    monoError = 0;
  for (let i = 0; i < left.length; i++) {
    finite &&= Number.isFinite(left[i]) && Number.isFinite(right[i]);
    l += left[i] * left[i];
    r += right[i] * right[i];
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    monoError = Math.max(monoError, Math.abs(left[i] - right[i]));
  }
  return {
    leftRms: Math.sqrt(l / left.length),
    rightRms: Math.sqrt(r / right.length),
    peak,
    finite,
    monoError,
  };
}
// Offline graphs render the production Sound/FactoryAmbience methods through
// native browser nodes. The adapter permits scheduling before offline rendering
// starts; no live game, global AudioContext, settings or profile is replaced.
function graph(seconds = 1.6) {
  const context = new OfflineAudioContext(2, Math.ceil(48000 * seconds), 48000);
  const adapter = new Proxy(context, {
    get(target, key) {
      if (key === 'state') return 'running';
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as AudioContext;
  const sound = new Sound();
  sound.context = adapter;
  const master = context.createGain(),
    compressor = context.createDynamicsCompressor();
  master.gain.value = 0.34;
  compressor.threshold.value = -18;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.12;
  master.connect(compressor);
  compressor.connect(context.destination);
  sound.master = master;
  sound.effects = context.createGain();
  sound.effectsOutput = context.createGain();
  sound.effects.connect(sound.effectsOutput);
  sound.effectsOutput.connect(master);
  sound.noise = context.createBuffer(1, 14400, 48000);
  let seed = 80319;
  const data = sound.noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed / 2147483648 - 1;
  }
  sound.setListener({ x: 0, y: 0 });
  return { context, sound, adapter };
}
export async function runAudioAudit() {
  if (typeof OfflineAudioContext !== 'function')
    throw new Error(
      'Offline audio checks are unavailable in this browser. Listening tests still work.',
    );
  const cases: {
    name: string;
    pass: boolean;
    voices?: number;
    samples: Samples;
    detail?: string;
  }[] = [];
  let singleVoices = 0;
  for (const scenario of ['left', 'right', 'mono', 'both', 'muted', 'paused'] as const) {
    const { context, sound } = graph();
    sound.mono = scenario === 'mono';
    if (scenario === 'muted') sound.enabled = false;
    const origin: SoundOrigin = {
      x: scenario === 'right' ? 420 : -420,
      y: 0,
      source: 'audit-left',
    };
    sound.play('lock', origin);
    if (scenario === 'both') sound.play('lock', { x: 420, y: 0, source: 'audit-right' });
    const voices = sound.voices;
    if (scenario === 'left') singleVoices = voices;
    if (scenario === 'paused')
      sound.updateMusic(
        {
          area: 'docks',
          room: 'audio-audit',
          mode: 'paused',
          intensity: 0,
          boss: false,
          clear: false,
        },
        false,
      );
    const samples = measure(await context.startRendering());
    let pass = samples.finite && samples.peak < 1;
    if (scenario === 'left')
      pass &&= samples.leftRms > samples.rightRms * 1.6 && samples.leftRms > 0;
    if (scenario === 'right')
      pass &&= samples.rightRms > samples.leftRms * 1.6 && samples.rightRms > 0;
    if (scenario === 'mono') pass &&= samples.monoError < 0.000001 && samples.leftRms > 0;
    if (scenario === 'both')
      pass &&= voices > singleVoices && Math.min(samples.leftRms, samples.rightRms) > 0;
    if (scenario === 'muted' || scenario === 'paused')
      pass &&= samples.peak === 0 && sound.voices === 0;
    cases.push({ name: scenario, pass, voices, samples });
  }
  for (const material of ['armor', 'casing', 'cover', 'power', 'terrain'] as SoundMaterial[]) {
    const { context, sound } = graph();
    sound.play(
      material === 'armor'
        ? 'armor'
        : material === 'casing'
          ? 'hit'
          : material === 'power'
            ? 'shutdown-break'
            : 'break',
      {
        x: 0,
        y: 0,
        source: 'audit-material',
        material,
      },
    );
    const voices = sound.voices,
      samples = measure(await context.startRendering());
    cases.push({
      name: 'impact-' + material,
      pass: samples.finite && samples.peak > 0 && samples.peak < 1,
      voices,
      samples,
    });
  }
  const ambience: { area: AreaId; powered: Samples; unpowered: Samples; pass: boolean }[] = [];
  for (const area of ['docks', 'furnace', 'cooling', 'reclamation', 'rooftops'] as AreaId[]) {
    const results: Samples[] = [];
    for (const power of [1, 0]) {
      const { context, sound, adapter } = graph(2);
      const factory = new FactoryAmbience(adapter, sound.effects);
      factory.update({ area, room: 'audio-audit-' + area, power, activity: power }, true, true);
      const samples = measure(await context.startRendering());
      results.push(samples);
      factory.stop();
      cases.push({
        name: area + '-' + (power ? 'powered' : 'off'),
        pass:
          samples.finite &&
          samples.peak < 1 &&
          samples.leftRms > 0 &&
          samples.monoError < 0.000001 &&
          factory.voiceCount === 0,
        samples,
      });
    }
    const pass = results[0].leftRms > results[1].leftRms * 1.05;
    ambience.push({ area, powered: results[0], unpowered: results[1], pass });
  }
  return {
    checkedAtUtc: new Date().toISOString(),
    method:
      'Native OfflineAudioContext renders of production Sound and FactoryAmbience. Synthetic soundcheck fixtures; no saved progress or live game changes.',
    pass: cases.every((c) => c.pass) && ambience.every((c) => c.pass),
    cases,
    ambience,
  };
}
