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

## Owner-supplied Edge Quick run

The owner supplied the [original three-minute report](qa/performance-2.96/browser-edge-owner-quick.json), generated **20 September 2026 at 03:14:22 UTC** (19 September, 22:14 CDT). Its user agent identifies **Edge 153**, not Chrome, despite containing the Chromium `Chrome/153` token. The exact running patch version is not exposed by this report; the earlier installed Edge executable reported 153.0.4234.32. The report records 24 logical cores, 32 GiB device memory, and a **2552×1308** canvas at pixel ratio 1. Full effects, audio and replay were enabled. Power mode, active GPU and background load were not recorded.

All six scenarios completed, with **zero application errors**, eight clears, and the document visible/focused at every five-second memory sample. This is a completed load test with unresolved frame stalls, rather than final Edge acceptance:

| Scenario     | Mean frame delivery | Frame interval p95 | Longest frame | Frames over 50 ms | Dropped steps |
| ------------ | ------------------: | -----------------: | ------------: | ----------------: | ------------: |
| Volley       |           239.8 fps |             4.3 ms |       16.7 ms |                 0 |             0 |
| Explosions   |           233.4 fps |             4.3 ms |       45.9 ms |                 0 |             0 |
| Portals      |           214.7 fps |             8.3 ms |      121.0 ms |                 5 |             7 |
| Beam         |           183.5 fps |            12.4 ms |      104.2 ms |                 1 |             3 |
| Boss arsenal |           197.1 fps |            12.4 ms |       20.8 ms |                 0 |             0 |
| Overtime     |           205.9 fps |            12.4 ms |       20.9 ms |                 0 |             0 |

The six measured frames above 50 ms and ten dropped simulation steps remain open for investigation. Dropped-step totals include warm-up/transitions; the timing table excludes each scenario's first two seconds. The report's `timingWarning` is null because that field only flags intervals over 250 ms, not because this was stall-free. Synchronous replay capture p95 stayed at 0.1 ms, with a 0.4 ms maximum; measured simulation and rendering maxima were 7.8 ms and 2.3 ms. These separate histograms do not identify the cause of the longer frame intervals or rule out asynchronous encoding, GPU, browser scheduling or other work.

Sampled JS heap varied between **14.9 and 42.7 MiB**, falling repeatedly between peaks; the last sample was 31.4 MiB. Replay retention peaked at **2.63 MiB**. Effects and music voices returned to zero at cleanup, with 96 replay frames retained for review. This short run shows no monotonic sampled heap growth, but does not establish long-term/native-memory stability. It prompted the twelve-minute Soak and Reduced effects Quick runs analyzed below. If further profiling is needed to attribute the remaining stalls, a replay-disabled comparison can help isolate capture overhead; such a comparison cannot replace acceptance with capture enabled.

The raw attachment is preserved without edits (SHA-256 `fefc6f91666072cd3a0b7278f1387d6635ed9dd11306864d27612ec8dd7aa100`). This report supplies Edge Quick evidence only; it does not establish Chrome performance, physical input, exported-video playback in Edge, or minimum-device acceptance.

## Owner-supplied Edge Soak run

The owner supplied the [original twelve-minute report](qa/performance-2.96/browser-edge-owner-soak.json), generated **20 September 2026 at 03:34:16 UTC** (19 September, 22:34 CDT), for build **2.96.0** in **Edge 153**. All six scenarios ran for 120 seconds each with full effects, replay capture and audio enabled. The canvas was **2549×1403**, from a 1699×935 CSS viewport at pixel ratio 1.5. That is about 7.1% more rendered pixels than the Quick run; these two observations are not a controlled, identical-resolution comparison. Browser patch version, active GPU, power mode and competing workloads were not recorded.

The run completed with **zero application errors**, 45 clears and three linked-portal setups. Mean frame delivery stayed at **227.3–238.9 fps** and frame-interval p95 was **4.3 ms in every scenario**. The earlier in-app-browser slowdown to approximately 1 fps near ten minutes did not recur in this standalone Edge run.

| Scenario     | Mean frame delivery | Frame interval p95 | Longest frame | Frames over 50 ms | Dropped steps |
| ------------ | ------------------: | -----------------: | ------------: | ----------------: | ------------: |
| Volley       |           238.2 fps |             4.3 ms |       25.0 ms |                 0 |             0 |
| Explosions   |           236.5 fps |             4.3 ms |       79.1 ms |                 5 |             0 |
| Portals      |           237.9 fps |             4.3 ms |       29.2 ms |                 0 |             0 |
| Beam         |           238.9 fps |             4.3 ms |       29.2 ms |                 0 |             0 |
| Boss arsenal |           227.3 fps |             4.3 ms |       29.2 ms |                 0 |             0 |
| Overtime     |           232.0 fps |             4.3 ms |      141.7 ms |                 1 |             3 |

The Quick run's portal/beam frames over 50 ms did not recur during their longer scenarios. However, **six frames over 50 ms** occurred among **166,475 measured frame intervals**: five in explosions and one in Overtime. The Overtime scenario recorded three dropped simulation steps. These isolated hitches remain documented for follow-up; the good averages do not establish their cause or prove they are fixed. No interval crossed the diagnostic's 250 ms warning threshold. Synchronous capture p95 remained 0.1 ms, with a 1.5 ms maximum; simulation and drawing maxima were 5.7 ms and 2.1 ms. Aggregate component histograms cannot attribute the stalled frames to a specific subsystem.

All **145 memory samples** reported the document visible/focused and audio running. Sampled JS heap ranged from **17.4 to 44.7 MiB**, with repeated drops: per-scenario minima were 18.2, 18.6, 18.4, 18.2, 17.4 and 19.2 MiB. The first and last samples were 19.2 and 27.9 MiB. This is evidence against sustained sampled-JS-heap growth during this run, not a total native/GPU-memory measurement or proof of absence of leaks. Replay retention peaked at **2.65 MiB**; cleanup left **zero effects/music voices**, with 55 replay frames (1.17 MiB) intentionally retained for review.

The twelve-minute execution check is complete and removed from the unfinished checklist. Reduced effects, Edge replay playback and basic keyboard/mouse checks are covered below. Remaining hitch investigation, full browser/input acceptance and a representative low-end laptop remain open. No additional identical Soak is required unless follow-up findings or changes justify it. The raw attachment is preserved without edits (SHA-256 `846daa36d37c25abff36f082a31a9183a84b2daa2cd5f8b2489b401afe5d5015`).

## Owner-supplied Edge Reduced effects run

The [original Reduced effects Quick report](qa/performance-2.96/browser-edge-owner-reduced.json) was generated **20 September 2026 at 03:52:10 UTC** (19 September, 22:52 CDT) in **Edge 153**, build **2.96.0**. Reduced effects was enabled; audio and replay capture remained enabled. All six 30-second scenarios completed with **zero application errors**, **zero dropped simulation steps**, nine clears and one linked-portal setup. The **2552×1308** canvas, pixel ratio 1 and viewport match the original full-effects Quick run. Power mode, active GPU and competing load remain uncontrolled.

| Scenario     | Mean frame delivery | Frame interval p95 | Longest frame | Frames over 50 ms |
| ------------ | ------------------: | -----------------: | ------------: | ----------------: |
| Volley       |           231.1 fps |             4.3 ms |       20.9 ms |                 0 |
| Explosions   |           227.8 fps |             4.3 ms |       37.5 ms |                 0 |
| Portals      |           219.6 fps |             4.3 ms |       54.2 ms |                 1 |
| Beam         |           235.5 fps |             4.3 ms |       21.0 ms |                 0 |
| Boss arsenal |           234.3 fps |             4.3 ms |       25.4 ms |                 0 |
| Overtime     |           232.8 fps |             4.3 ms |       58.4 ms |                 1 |

There were **two frames over 50 ms among 38,673 measured intervals**, compared with six in the earlier full-effects Quick run. The longest interval fell from 121.0 to 58.4 ms and every scenario's p95 was 4.3 ms. These observations do not establish that Reduced effects caused the change or eliminates stalls: mean FPS did not improve in every scene, and the intervening full-effects Soak also delivered a 4.3 ms p95 in every scene. No measured interval crossed the 250 ms warning threshold. Synchronous simulation, rendering and replay-capture maxima were 4.9, 4.4 and 0.5 ms respectively; their aggregate histograms do not identify the source of the two longer intervals.

All **37 memory samples** reported visible/focused and audio running. Sampled JS heap ranged from **14.9 to 45.2 MiB**, repeatedly returning to approximately 20–22 MiB after warm-up; the last sample was 35.1 MiB. Replay retention peaked at **2.58 MiB**. Effects and music voices returned to zero at cleanup, with 96 replay frames (2,092,854 bytes) retained for review. This short run shows no monotonically accumulating sampled heap or audio-voice backlog; native/GPU memory was not measured.

The requested Edge full-effects Quick, twelve-minute Soak and Reduced effects Quick executions are now complete. The Reduced effects execution check is removed from the unfinished list. This completes the benchmark set on the available laptop, not all of item 5: isolated hitch attribution, remaining browser/input checks and low-end-device acceptance remain open. Do not repeat the same benchmark set without a concrete new finding or change to verify. The original attachment is preserved without edits (SHA-256 `62ca9d2f8f35332727083fdf07b9d6a6d3a7f033519cbe28561e04dfecc259de`).

## Playback and export checks

The real replay viewer opened the worker-generated clip, paused/resumed, and encoded a video through MediaRecorder to **Clip ready** with the fallback Download clip link and no console errors. Closing the viewer restored the diagnostic controls. The later 1080p run retained 98 replay frames and a valid report download completed.

During the first worker viewer check no new video file appeared in Downloads after the normal save/link actions. Attempting to open the generated video URL directly was blocked by the browser tool's URL security policy; no workaround was used. The earlier replay file already on disk was not counted as a new successful export.

A subsequent public-build recheck on 19 September at 22:05 CDT **did deliver a new video file** through the ordinary Save clip action. The browser tool's download event timed out after 15 seconds, but a later filesystem check established a fresh 324,782-byte WebM with a matching creation time. The viewer reached Clip ready without console warnings or errors. The [download receipt](qa/performance-2.96/replay-download-recheck.json) records its timestamp, size, SHA-256 and WebM header. A missing tool event therefore cannot be treated as proof of failed delivery. This recheck used no direct blob navigation or workaround.

**Standalone Edge replay export and downloaded playback passed the owner's manual check.** The owner performed the public death/replay/export test, explicitly confirmed that the newly downloaded video plays correctly, and supplied that new file. The [Edge playback receipt](qa/performance-2.96/replay-edge-playback.json) records its creation time, 252,411-byte size and SHA-256. The owner subsequently clarified that this was **Edge**, correcting the earlier attribution to Chrome from the question's wording. This test provides no Chrome acceptance evidence. Edge's installed executable reports **153.0.4234.32**; its running About screen was not independently inspected. Playback is owner-observed evidence, rather than an agent-controlled browser or header-only check.

## Owner-confirmed Edge input checks

After the Reduced effects run, the owner explicitly confirmed that **movement, aiming, shooting, pause/resume, switching away and returning, and entering/exiting fullscreen all work in Edge**. The [manual input receipt](qa/performance-2.96/edge-owner-input-check.json) records this as owner-observed physical keyboard/mouse and browser-window evidence. Those specific acceptance checks are complete and removed from the unfinished list. This does not separately attest to retry/reward/room-transition UI flows, a whole-campaign playthrough, physical controllers, rumble or touch.

The Edge benchmark set, basic keyboard/mouse/window checks and replay export/playback are complete. Remaining isolated hitch investigation, Edge retry/room-transition/menu smoke checks, independent Chrome/Firefox testing, controller acceptance and baseline-device acceptance remain in item 5. No unperformed browser or device check is inferred from these results.

## Automated verification

All **1,548 tests passed**, with no failures or skipped tests, including four additional worker lifecycle tests. TypeScript and the production build passed. Vite retains its existing advisory about a shared chunk over 500 kB. The diagnostic entry is separate from the ordinary game and uses relative asset paths compatible with GitHub Pages, including the worker asset.

Item 5's software checks are recorded here; independent browser/device acceptance and a representative low-end laptop remain release blockers. They remain on the unfinished checklist instead of being claimed complete from automated or high-end-machine results.

[Play 2.96.0](https://caleb-guyer.github.io/recoil-foundry/?v=2.96.0) · [Isolated stress test](https://caleb-guyer.github.io/recoil-foundry/diagnostics.html?v=2.96.0) (late-game spoilers). The deployment workflow runs the full suite and production build before publishing; the game, diagnostic entry and worker asset must all be included in the deployed smoke check.
