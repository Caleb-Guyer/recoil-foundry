# Performance and stability — 2.96.0

19 September 2026. Software verification for release checklist item 5. Daily remains ruleset 78. Combat simulation, upgrade balance and save formats are unchanged.

## Fixes and repeatable checks

Replay capture snapshots the rendered canvas immediately, then transfers its image to a dedicated worker for scaling, pixel readback and JPEG encoding. The worker processes jobs serially and closes each transferred bitmap. Resolution (854×480), JPEG quality (0.8), the 24 fps capture target and the five-second/16 MiB buffer limit are unchanged. Browsers without the required worker/OffscreenCanvas/ImageBitmap capabilities use the existing canvas encoder. Worker startup, transfer and encoding failures release outstanding jobs and enable that fallback; they do not block the result screen. Snapshotting begins synchronously so later room/death rendering cannot replace the intended frame before capture.

Death replay now keeps its native image-encoding budget across resets: at most one ordinary capture and one final capture can be outstanding, including callbacks from older runs. Previously, each retry cleared the logical queue while the browser's old encoders kept running. A regression test reproduces 100 retries before any callback finishes, verifies the two-encode bound, and then verifies that fresh capture resumes without showing stale images.

Unavailable or throwing video-codec capability probes now leave replay viewing usable with export unavailable. A failed recorder stop still releases its stream tracks, image bitmap, animation callback and event listener. Normal completion, hidden-tab cancellation, null/throwing image encoders and closing during asynchronous decoding have regression coverage. The fallback Download clip link is included in controller menu navigation and visible focus styling.

A separate `diagnostics.html` entry runs six isolated late-game presets through the real simulation, renderer, sound and death-replay capture. It exposes bounded timing histograms, object/voice counts and optional JS heap samples, and downloads results only when requested. Ordinary play imports no diagnostic loop or reporting UI. It does not write progress or preferences. See the [reproduction and hardware acceptance procedure](performance-testing.md).

## Environment and limits

Production Vite assets were served locally and exercised in the Chromium-based Codex in-app browser. UA reports Chrome **153.0.0.0** on Windows; this is **not** an independent Chrome or Edge certification. Canvas resolution was **1920×1080**, from a 1280×720 CSS viewport at device pixel ratio 1.5. Animation-frame delivery was approximately 240 Hz. No CPU/GPU throttling was used.

Available machine: Lenovo 83F5, Windows 11 Home **10.0.26200**, Intel Core Ultra 9 **275HX** (24 logical processors), about **31.4 GiB RAM**, RTX **5080 Laptop GPU** (driver 32.0.16.1088) and Intel integrated graphics. The browser's active GPU was not independently identified. This is a powerful laptop, not the minimum-spec target; power mode and competing user workloads were not controlled.

Installed Chrome **153.0.8010.50** and Edge **153.0.4234.32** were identified from their executable versions, but no automation surface was available for those independent browsers. Firefox was not found in standard install locations. No physical controller, rumble, native fullscreen or touch acceptance is claimed. Safari remains unadvertised and untested.

## Simulation soak

The [raw simulation report](qa/performance-2.96/simulation-soak.json) records Node **24.16.0**, **216,000** combat input steps (60 input-equivalent minutes), plus **25,440** steps through **60 actual combat deaths**, **150** clears, **120** menu/reset cycles, **720** pause/resume cycles and **45** linked portal setups. Checkpoint writes were **zero**. Every reset returned to its scenario's original physics-object counts; finite-state and combat-budget assertions passed. Sampled shots/particles reached their existing bounds of 180/220.

Post-GC heap warmed from 16.9 MiB to roughly 20–21.2 MiB. During the separate repeated-death phase, the first and last reset samples were 20.25 and 20.29 MiB; each contained the same 15 bodies, zero collision pairs, zero shots and zero particles. Reports themselves retain a small bounded set of measurements. This run found no accumulating world-object backlog; it is not proof that every future build is leak-free or a browser-memory measurement.

## Production browser runs

The [three-minute baseline](qa/performance-2.96/browser-baseline.json), before the replay cleanup fixes, completed all six scenarios without an error. Mean frame delivery was 223–240 fps, with 95th-percentile intervals of 4.3–4.6 ms. Two frames exceeded 50 ms (maximum 62.6 ms). Timing localized these isolated stalls primarily to the synchronous replay-capture call; simulation and drawing maxima were 5.6 and 2.5 ms respectively. This motivated checking encoder lifetime rather than changing combat or reducing the recording quality. It does not establish that every GPU readback stall is eliminated.

The baseline's `measuredSeconds` field contains total scenario duration; the final harness corrects this to separate `scenarioSeconds` from measured time after the two-second warm-up. All histogram samples already excluded that warm-up.

The [twelve-minute browser run](qa/performance-2.96/browser-soak-scheduling-gap.json) completed all scenarios with **zero application errors**, 32 clears, replay retention below 2.52 MiB, and zero remaining effects/music voices after finishing. Sampled JS heap varied between 12.0 and 45.0 MiB with repeated collection; this includes the diagnostic page and is not native/GPU memory. The strong load-driving builds survived; actual death/retry coverage is in the separate simulation soak and replay checks.

This long run **does not establish twelve minutes of stable FPS**. Near the ten-minute mark, animation callbacks shifted to almost exactly one second apart. Overtime consequently averaged 1.1 callbacks/second and lost 6,594 fixed simulation steps, despite simulation/render/capture work remaining around a few milliseconds per callback. A follow-up in the same tab still reported this behavior while the document reported visible/focused and its audio context running. Reloading and Pause/Resume did not recover it; a fresh tab restored normal scheduling. Browser/host scheduling is the leading inference, not a proven root cause. The entire raw result is preserved, including the bad frames. A diagnostic-only rebuild occurred after the slowdown was already established, so that tail is also unsuitable as an isolated timing comparison.

Before the scheduling interruption, volley/explosion/portal/beam averaged 229–237 fps with a 4.3 ms 95th-percentile interval. Explosions had five frames above 50 ms, a 108.3 ms maximum and one dropped step. Replay capture remained the largest synchronous component of those isolated stalls. They are recorded rather than claimed eliminated. Independent browser and minimum-device acceptance remains open.

The final diagnostic page additionally samples document visibility, focus and audio-context state and adds a timing warning for frame gaps over 250 ms. It never silently removes slow samples or calls a completed run a performance pass.

A fresh **visible-browser** run exposed more costly replay readback than the initial background run: the [matched pre-worker baseline](qa/performance-2.96/browser-visible-before.json) averaged 151–161 fps, but its frame-interval p95 was 20.8–25 ms and synchronous capture p95 was 21.6–24.7 ms. Reduced effects, replay and audio were enabled at 1920×1080 in all six scenarios. An experiment using a CPU-backed capture canvas did not materially improve these timings and was discarded. The worker implementation addresses this measured bottleneck instead.

The first [worker result](qa/performance-2.96/browser-worker-720-summary.json) used Reduced effects and rendered at **1280×720**: the browser viewport override had also changed device pixel ratio to 1. Its 234–240 fps and 0.1 ms capture p95 are recorded, but it is not an equal-resolution comparison with the earlier 1080p baseline. This mismatch was caught in the environment fields and followed by a separate full-resolution test.

The final [1920×1080, full-effects worker run](qa/performance-2.96/browser-worker-1080.json) used the same CSS viewport and 1.5 pixel ratio as the initial 1080p run. Replay and audio stayed enabled. All six scenarios completed without an application error or timing warning:

| Scenario     | Mean frame delivery | Frame interval p95 | Synchronous capture p95 |
| ------------ | ------------------: | -----------------: | ----------------------: |
| Volley       |           238.5 fps |             4.3 ms |                  0.1 ms |
| Explosions   |           235.7 fps |             4.3 ms |                  0.1 ms |
| Portals      |           218.4 fps |             8.3 ms |                  0.1 ms |
| Beam         |           239.3 fps |             4.3 ms |                  0.1 ms |
| Boss arsenal |           239.8 fps |             4.3 ms |                  0.1 ms |
| Overtime     |           239.6 fps |             4.3 ms |                  0.1 ms |

Capture's measured maximum was **0.5 ms**. One explosion-scene frame reached 79.3 ms; one portal simulation step was dropped (the dropped-step counter includes warm-up/transitions while timing histograms exclude initial warm-up). Those outliers remain in the report. JS heap ranged from 13.4 to 41.6 MiB; replay storage peaked at 2.50 MiB, and effects/music voices returned to zero. Off-thread encoding still consumes resources: these timings measure main-thread calls, not total GPU/worker time. Runs are single observations on the available high-end machine, not minimum-spec certification or a controlled hardware benchmark.

## Playback and export checks

The real replay viewer opened the worker-generated clip, paused/resumed, and encoded a video through MediaRecorder to **Clip ready** with the fallback Download clip link and no console errors. Closing the viewer restored the diagnostic controls. The later 1080p run retained 98 replay frames and a valid report download completed.

**Downloaded-video delivery and playback remain unverified.** During the worker viewer check no new video file appeared in Downloads after the normal save/link actions. Attempting to open the generated video URL directly was blocked by the browser tool's URL security policy; no workaround was used. The earlier replay file already on disk was not counted as a new successful export. Verify a newly exported file in the independently supported browsers; this is explicitly retained in item 5.

## Automated verification

All **1,548 tests passed**, with no failures or skipped tests, including four additional worker lifecycle tests. TypeScript and the production build passed. Vite retains its existing advisory about a shared chunk over 500 kB. The diagnostic entry is separate from the ordinary game and uses relative asset paths compatible with GitHub Pages, including the worker asset.

Item 5's software checks are recorded here; independent browser/device acceptance and a representative low-end laptop remain release blockers. They remain on the unfinished checklist instead of being claimed complete from automated or high-end-machine results.

[Play 2.96.0](https://caleb-guyer.github.io/recoil-foundry/?v=2.96.0) · [Isolated stress test](https://caleb-guyer.github.io/recoil-foundry/diagnostics.html?v=2.96.0) (late-game spoilers). The deployment workflow runs the full suite and production build before publishing; the game, diagnostic entry and worker asset must all be included in the deployed smoke check.
