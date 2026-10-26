import Matter from 'matter-js';
import type { Game } from './game.ts';
import type { Checkpoint } from './rules.ts';
import { reclaimerPressureTestFromUrl } from './reclaimer-pressure-test.ts';

export const RECLAIMER_ARSENAL_FORMS = ['chassis', 'siege', 'rupture'] as const;
export type ReclaimerArsenalForm = (typeof RECLAIMER_ARSENAL_FORMS)[number];
const formLabels = ['Chassis', 'Siege', 'Rupture'] as const;
const formHints = [
  'Bait the counter-dash after its lane locks, then punish the recovery.',
  'Break the armor to expose the hull. Watch the aircraft and leave the marked bomb lanes.',
  'Move with the rotating core beams and leave a cracking platform before it falls.',
] as const;
export interface ReclaimerArsenalFixture {
  checkpoint: Checkpoint;
  form: ReclaimerArsenalForm;
  phase: 0 | 1 | 2;
  overtime: boolean;
  mirror: boolean;
  title: string;
  hint: string;
}

/** Explicit mechanic previews use real Campaign/NG+ rules and legal retained fittings. */
export function reclaimerArsenalTestFromUrl(url: URL): ReclaimerArsenalFixture | null {
  const p = url.searchParams;
  if (p.get('test') !== 'arsenal' || p.get('v') !== '1') return null;
  let invalid = false;
  p.forEach((_, key) => {
    if (!['test', 'form', 'fight', 'mirror', 'v'].includes(key) || p.getAll(key).length !== 1)
      invalid = true;
  });
  const form = p.get('form') ?? 'chassis',
    fight = p.get('fight') ?? 'campaign',
    mirror = p.get('mirror') ?? '0';
  if (
    invalid ||
    !RECLAIMER_ARSENAL_FORMS.includes(form as ReclaimerArsenalForm) ||
    !['campaign', 'overtime'].includes(fight) ||
    !['0', '1'].includes(mirror)
  )
    return null;
  const phase = RECLAIMER_ARSENAL_FORMS.indexOf(form as ReclaimerArsenalForm) as 0 | 1 | 2,
    baseline = reclaimerPressureTestFromUrl(
      new URL(`?test=reclaimer&phase=${phase + 1}&fight=${fight}&mirror=${mirror}&v=1`, url),
    )!;
  const checkpoint: Checkpoint = {
    ...baseline.checkpoint,
    seed: `RF-C108-F-${fight === 'overtime' ? 'O' : 'C'}-${phase + 1}-A-0-${mirror}`,
  };
  const overtime = fight === 'overtime';
  return {
    checkpoint,
    form: form as ReclaimerArsenalForm,
    phase,
    overtime,
    mirror: mirror === '1',
    title: `The Reclaimer / ${formLabels[phase]}${overtime ? ' / New Game+' : ''}`,
    hint:
      formHints[phase] +
      (overtime
        ? ' New Game+ combines the attacks with stronger pressure and full warnings.'
        : '') +
      ' This isolated test leaves Continue, unlocks and records untouched.',
  };
}

/** Re-applied on every explicit start and retry; normal Campaign/Continue cannot enter here. */
export function prepareReclaimerArsenalTest(g: Game, fixture: ReclaimerArsenalFixture | null) {
  if (
    !fixture ||
    !g.testRun ||
    g.testRun.seed !== fixture.checkpoint.seed ||
    g.seed !== fixture.checkpoint.seed ||
    g.stage !== 19 ||
    g.escape ||
    g.detour ||
    !g.finale.cinema
  )
    return false;
  const cinema = g.finale.cinema;
  cinema.enterForm(fixture.phase);
  Matter.Body.setPosition(g.player, { x: cinema.x(600), y: 718 });
  Matter.Body.setVelocity(g.player, { x: 0, y: 0 });
  g.grounded = true;
  g.level.name = fixture.title;
  return true;
}
