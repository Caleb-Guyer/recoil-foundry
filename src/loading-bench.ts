import './stability-bench.css';
import './loading-bench.css';
import { GAME_VERSION } from './version.ts';

const BASELINE = '5.9.0';
const root = document.getElementById('loading-test')!;
document.body.classList.add('loading-bench');
root.innerHTML =
  '<header><a href="./">← Game</a><h1>Loading comparison</h1><p>Compare the shipped 5.9.0 title screen with this build. Both use the same size frame and isolated rematch preview. Your progress and settings are untouched. The first comparison uses separate asset URLs; repeat for cached loads.</p><div class="bench-controls"><button id="measure">Compare loading</button><a href="./diagnostics.html?scenario=beam">Heavy beam test ↗</a><a href="./diagnostics.html?scenario=heat-mortar">Heat & mortar test ↗</a></div><p id="loading-status" role="status">Ready. Keep this tab visible.</p></header><section id="loading-summary" aria-live="polite"></section><details><summary>Full measurement report</summary><pre id="loading-report" aria-label="Loading measurements">No measurements yet.</pre></details><div id="loading-frame"></div>';
const button = document.getElementById('measure') as HTMLButtonElement;
const status = document.getElementById('loading-status')!;
const output = document.getElementById('loading-report')!;
const host = document.getElementById('loading-frame')!;
const samples: unknown[] = [];
let frame: HTMLIFrameElement | null = null;
let timeout = 0;
const round = (n: number) => Math.round(n * 100) / 100;

async function sample(version: string, reference: boolean) {
  frame?.remove();
  clearTimeout(timeout);
  status.textContent = 'Loading ' + version + '…';
  return await new Promise<{
    version: string;
    navigationToLoadedTitleMs: number;
    domContentLoadedMs: number;
    assetTransferredBytes: number;
    assetDecodedBytes: number;
    cache: string;
    assets: { name: string | undefined; durationMs: number; transferredBytes: number }[];
  }>((resolve, reject) => {
    const current = (frame = document.createElement('iframe'));
    current.title = 'Isolated ' + version + ' loading sample';
    current.inert = true;
    current.style.cssText = 'display:block;width:100%;height:650px;border:1px solid #34464b';
    current.onload = () => {
      // Deferred modules finish before window load; read on the next task so
      // the browser has written loadEventEnd. This does not wait for rAF.
      window.setTimeout(() => {
        if (frame !== current) return;
        clearTimeout(timeout);
        try {
          const w = current.contentWindow!;
          const doc = current.contentDocument!;
          if (doc.documentElement.dataset.loadingError === 'true')
            throw new Error(version + ' reported a startup error');
          const ready =
            version === BASELINE
              ? !!doc.querySelector('#play')
              : doc.documentElement.dataset.gameReady === 'true';
          if (!ready) throw new Error(version + ' title screen did not become ready');
          const nav = w.performance.getEntriesByType(
            'navigation',
          )[0] as PerformanceNavigationTiming;
          const assets = (
            w.performance.getEntriesByType('resource') as PerformanceResourceTiming[]
          ).filter((entry) => /\.(js|css)(\?|$)/.test(entry.name));
          const cached = assets.filter((entry) => entry.transferSize === 0).length;
          resolve({
            version,
            navigationToLoadedTitleMs: round(nav.loadEventEnd),
            domContentLoadedMs: round(nav.domContentLoadedEventEnd),
            assetTransferredBytes: assets.reduce((n, entry) => n + entry.transferSize, 0),
            assetDecodedBytes: assets.reduce((n, entry) => n + entry.decodedBodySize, 0),
            cache: cached === 0 ? 'network' : cached === assets.length ? 'cached' : 'mixed',
            assets: assets.map((entry) => ({
              name: new URL(entry.name).pathname.split('/').at(-1),
              durationMs: round(entry.duration),
              transferredBytes: entry.transferSize,
            })),
          });
        } catch (error) {
          reject(error);
        }
      }, 0);
    };
    timeout = window.setTimeout(() => {
      if (frame !== current) return;
      current.remove();
      frame = null;
      reject(new Error(version + ' loading timed out. Check your connection and retry.'));
    }, 30000);
    const path = reference ? './benchmark/' + version + '/index.html' : './';
    current.src = path + '?test=rematch&scene=patrol&v=1';
    host.replaceChildren(current);
  });
}

button.onclick = async () => {
  button.disabled = true;
  try {
    // A normal offline Vite build has no historic fixture. It still supports a
    // current-build sample, clearly labeled without a fabricated comparison.
    let paired = false;
    try {
      const response = await fetch('./benchmark/manifest.json');
      if (response.ok) {
        const manifest = await response.json();
        paired = manifest.baseline === BASELINE && manifest.current === GAME_VERSION;
      }
    } catch {
      /* Local/offline build: current sample only. */
    }
    const before = paired ? await sample(BASELINE, true) : null;
    const after = await sample(GAME_VERSION, paired);
    samples.push({
      before,
      after,
      comparableCache: !!before && before.cache === after.cache && before.cache !== 'mixed',
      differenceMs: before
        ? round(after.navigationToLoadedTitleMs - before.navigationToLoadedTitleMs)
        : null,
    });
    if (samples.length > 20) samples.shift();
    const row = (sample: typeof after) =>
      '<tr><th scope="row">' +
      sample.version +
      '</th><td>' +
      sample.navigationToLoadedTitleMs +
      ' ms</td><td>' +
      sample.cache +
      '</td><td>' +
      Math.round(sample.assetTransferredBytes / 1000) +
      ' kB</td></tr>';
    document.getElementById('loading-summary')!.innerHTML =
      '<table><caption>Most recent sample</caption><thead><tr><th scope="col">Version</th><th scope="col">Title ready</th><th scope="col">Asset cache</th><th scope="col">Transferred</th></tr></thead><tbody>' +
      (before ? row(before) : '') +
      row(after) +
      '</tbody></table><p>One sample on this browser and connection. Repeat and compare matching cache states.</p>';
    output.textContent = JSON.stringify(
      {
        version: GAME_VERSION,
        browser: navigator.userAgent,
        frame: { width: Math.round(host.clientWidth), height: 650 },
        methodology:
          'Navigation start to window load after each game module creates its title controls. Includes network/cache, module evaluation and CSS; not first paint or input latency. Separate, sequential iframes and asset URL namespaces. No CPU/network throttling. Network variability and browser caches still affect results. Compare matching cache states and repeat. JavaScript compile timings and CPU rendering audits are separate measurements.',
        samples,
      },
      null,
      2,
    );
    status.textContent = !paired
      ? 'Current build measured. The pinned 5.9.0 fixture is available on the published GitHub Pages comparison.'
      : before!.cache !== after.cache || before!.cache === 'mixed'
        ? 'Cache states differ or are mixed. Repeat for matching cached loads before comparing.'
        : 'Comparison complete. Repeat to check cached loads; timing varies with this browser and connection.';
  } catch (error) {
    status.textContent = 'Measurement unavailable: ' + String(error);
  } finally {
    button.disabled = false;
  }
};
window.addEventListener('pagehide', () => {
  clearTimeout(timeout);
  frame?.remove();
});
