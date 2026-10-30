import { Renderer } from './render.ts';
import { runSeedLockComparison, type SeedLockTest, type SeedLockResult } from './seed-lock-test.ts';

export interface SeedLockInspectionHandle {
  dispose(): void;
}
/** Local inspection only: game settings, saves and challenge records are never read or written. */
export function renderSeedLockInspection(
  container: HTMLElement,
  fixture: SeedLockTest,
  back: () => void,
): SeedLockInspectionHandle {
  let disposed = false;
  container.replaceChildren();
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text: string,
    parent: HTMLElement = container,
    className = '',
  ): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    e.textContent = text;
    if (className) e.className = className;
    parent.append(e);
    return e;
  };
  add('p', 'SEED LOCK · PRIVATE COMPARISON', container, 'eyebrow');
  const title = add('h2', fixture.title);
  title.id = 'dialog-title';
  add('p', fixture.hint);
  add(
    'p',
    'Recorded input, real firing and wall impacts. Run the comparison, inspect both views, then repeat. Your progress and Sound settings stay untouched.',
    container,
    'seed-lock-intro',
  );
  const controls = add('div', '', container, 'actions');
  const run = add('button', 'Run comparison', controls, 'primary');
  run.id = 'seed-lock-run';
  const close = add('button', 'Back', controls, 'quiet');
  close.onclick = back;
  const status = add('p', 'Ready. No comparison has run yet.', container, 'seed-lock-status');
  status.id = 'seed-lock-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const pictures = add('div', '', container, 'seed-lock-canvases');
  const results = add('div', '', container, 'seed-lock-results');
  results.id = 'seed-lock-results';
  const show = (result: SeedLockResult) => {
    status.textContent = result.passed
      ? 'Matched · every measured gameplay sample agrees.'
      : 'Comparison needs attention · inspect the differing sample below.';
    status.dataset.passed = String(result.passed);
    results.replaceChildren();
    for (const pair of result.pairs) {
      const row = add('section', '', results, 'seed-lock-pair');
      add('h3', pair.label, row);
      add(
        'p',
        pair.seed +
          ' · checkpoint format ' +
          pair.checkpointVersion +
          ' · ' +
          (pair.locked ? 'Seed Lock combat' : 'Original combat rules'),
        row,
      );
      const values = add('dl', '', row, 'seed-lock-measurements');
      for (const [label, value] of [
        [
          'Gameplay samples',
          String(pair.samples) + ' / ' + pair.samples + (pair.matched ? ' matched' : ' compared'),
        ],
        ['Discharges', pair.baselineShots + ' / ' + pair.variantShots],
        ['Splinter fragments', pair.baselineFragments + ' / ' + pair.variantFragments],
        ['Trace fingerprints', pair.baselineFingerprint + ' / ' + pair.variantFingerprint],
        [
          'Save reconstruction',
          pair.serializedCheckpointPreserved
            ? 'Identity and checkpoint preserved'
            : 'Checkpoint changed',
        ],
        ['Progress writes', String(pair.checkpointWrites)],
        ['Actual render passes', String(pair.renderedFrames)],
        ...(pair.pausedTicks
          ? [
              [
                'Paused ticks',
                pair.pausedTicks +
                  ' · ' +
                  (pair.pauseFrozen ? 'simulation frozen' : 'simulation changed'),
              ],
            ]
          : []),
        ...(pair.firstMismatch !== null
          ? [['First differing sample', String(pair.firstMismatch)]]
          : []),
      ]) {
        add('dt', label, values);
        add('dd', value, values);
      }
      if (!pair.locked)
        add(
          'p',
          'This older identity deliberately keeps its original random stream. Reconstruction is compared under identical effects; cosmetic independence is not applied retroactively.',
          row,
        );
    }
    add('p', result.explanation, results, 'seed-lock-intro');
  };
  run.onclick = () => {
    if (disposed) return;
    run.disabled = true;
    status.textContent = 'Comparing the recorded samples…';
    pictures.replaceChildren();
    results.replaceChildren();
    const renderers = new Map<string, Renderer>();
    try {
      const measured = runSeedLockComparison(fixture, {
        render(game, frame) {
          const key = frame.pair + ':' + frame.side;
          let renderer = renderers.get(key);
          if (!renderer) {
            const figure = add('figure', '', pictures, 'seed-lock-figure');
            add(
              'figcaption',
              'Sample ' +
                (frame.pair + 1) +
                ' · ' +
                (frame.side === 'baseline'
                  ? 'Baseline'
                  : fixture.scene === 'reduced'
                    ? 'Reduced Effects'
                    : fixture.scene === 'pause'
                      ? 'Pause and resume'
                      : fixture.scene === 'legacy' ||
                          (fixture.scene === 'daily' && frame.pair === 0)
                        ? 'Reconstructed save'
                        : 'Heavy effects'),
              figure,
            );
            const canvas = document.createElement('canvas');
            canvas.className = 'seed-lock-canvas';
            canvas.setAttribute('aria-label', 'Actual private range rendering: ' + key);
            figure.append(canvas);
            renderer = new Renderer(canvas, game);
            renderers.set(key, renderer);
          }
          renderer.reduced = frame.reduced;
          renderer.draw(((frame.frame + 1) * 1000) / 60, {
            camera: { x: 0, y: 400 },
            scale: Math.max(1, renderer.width) / 1200,
            player: true,
            navigation: false,
            buildMotion: false,
          });
        },
      });
      if (!disposed) show(measured);
    } catch {
      status.textContent =
        'The comparison could not complete. Repeat it, or return to play. No progress was changed.';
      status.dataset.passed = 'false';
    } finally {
      renderers.clear();
      run.disabled = false;
      run.textContent = 'Repeat comparison';
    }
  };
  const keydown = (e: KeyboardEvent) => {
    if (e.code !== 'KeyR' || e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.matches('input,textarea,select,[contenteditable="true"]')) return;
    e.preventDefault();
    e.stopPropagation();
    run.click();
  };
  container.addEventListener('keydown', keydown);
  return {
    dispose() {
      disposed = true;
      container.removeEventListener('keydown', keydown);
      run.onclick = null;
      close.onclick = null;
    },
  };
}
