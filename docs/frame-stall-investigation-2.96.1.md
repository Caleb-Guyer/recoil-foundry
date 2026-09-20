# Frame-stall investigation — 2.96.1

Follow-up to [item 5 evidence](performance-stability-2.96.0.md). This patch changes the separate diagnostic page and version metadata. Ordinary combat, rendering, replay encoding, input, balance and Daily ruleset 78 are unchanged. The owner's completed Edge gameplay checks remain valid for those unchanged systems.

Subsequent extended-run attempts and the reproduced frame-delivery slowdown are recorded in the [20 September follow-up](stability-follow-up-2026-09-20.md). Its failed runs qualify the earlier short-run observations below; the cause remains unresolved.

## Measurement changes

Schema 2 records audio, report/housekeeping and whole frame-callback timing, including room resets. Each delayed animation interval retains the work from the **preceding** callback, so subsequent catch-up simulation is not misidentified as its cause. Optional Long Task/Long Animation Frame observers provide overlapping browser timing when supported. Overlap is evidence of concurrent work, not proof of causality. Sources: [Long Animation Frames draft](https://www.w3.org/TR/long-animation-frames/) and [Long Tasks draft](https://www.w3.org/TR/longtasks-1/).

Both trace histories retain only the latest 120 entries and expose discarded counts. Up to eight overlapping entries are attached per delayed interval. Pause/resume breaks continuity and flushes/disconnects observers. Missing/rejected observer capabilities leave manual callback timing available. Exported observations contain timings, not script URLs, function names, browsing history or DOM/container text. The normal game bundle contains none of this instrumentation.

The live diagnostic UI now shows compact summaries. Full histories are still available on pause, stop/completion and download. This avoids repeatedly laying out a growing trace during the run itself; no gameplay effects were removed to make the test faster.

## Preliminary validation under competing load

The [59-second preliminary run](qa/performance-2.96.1/instrumentation-concurrent-tests-partial.json) overlapped the local full automated suite. It recorded 175 slow intervals and 220 browser entries, hit the bounded-history limits and stopped without an application error. Its large live trace also showed periodic browser layout costs. It validates trace collection and bounded storage under load; **it is not a performance baseline or evidence that the game causes those delays**. It is preserved to make the competing-workload confound explicit. The test was stopped, automated tests were allowed to finish, and measured runs used a fresh tab with compact live reporting.

## Final instrumented comparisons

Two complete three-minute runs used the production build in the Chromium-based in-app browser at **1920×1080**, full effects and audio enabled, after local automated tests finished. These are not standalone Chrome/Edge measurements. The first [kept replay capture on](qa/performance-2.96.1/browser-instrumented-replay-on.json); the second [turned it off](qa/performance-2.96.1/browser-instrumented-replay-off.json) in the same tab and viewport. Other system workloads/power state were not controlled, and the sequential runs are not a causal experiment.

| Scenario | Replay on FPS / interval p95 | Replay off FPS / interval p95 |
| --- | ---: | ---: |
| Volley | 183.0 / 12.6 ms | 197.9 / 8.4 ms |
| Explosions | 195.9 / 12.5 ms | 158.8 / 12.5 ms |
| Portals | 218.5 / 8.3 ms | 204.4 / 8.4 ms |
| Beam | 213.3 / 8.3 ms | 166.3 / 12.5 ms |
| Boss | 204.0 / 8.4 ms | 137.3 / 12.5 ms |
| Overtime | 154.8 / 20.9 ms | 139.6 / 12.5 ms |

Both completed with **zero application errors, zero dropped simulation steps and zero measured animation intervals over 50 ms**. Replay on recorded 32,755 intervals; replay off recorded 28,120. The longest intervals were 50.0 and 45.8 ms respectively. Replay-on Overtime's 20.9 ms p95 still misses the desired 16.7 ms baseline target; a high average is not a substitute for smooth delivery. The in-app browser's delivery was more variable than the owner's earlier Edge results. Disabling replay did not produce a consistent improvement across scenes, so this does **not** establish replay capture as the root cause of earlier Edge stalls or justify changing recorder quality.

The full callback maxima were **13.4 ms with replay** and **9.7 ms without**. Live housekeeping maxima were 0.6 and 0.5 ms; browser layout within the captured Long Animation Frame entries was reported as zero at exposed precision. The observer recorded one 52.3 ms Long Animation Frame with replay, and two (55.2 and 50.2 ms) without. All reported zero blocking duration. These entries cover browser-defined frame periods, which differ from the measured animation-callback intervals, so those counts need not match. They do not identify a specific application fault.

Replay-on sampled JS heap ranged from **13.7 to 39.2 MiB**; replay retention peaked at **2.50 MiB**, and voices returned to zero after completion. Replay-off cleanup retained no replay frames/bytes and no voices. A separate start → pause → resume → stop check reset old trace counts, preserved full detail on pause and did not turn paused time into a false stall. No browser console warnings/errors were reported. Exported reports were downloaded normally and copied into this evidence directory.

**Conclusion:** the prior Edge stalls were not reproduced above 50 ms in these two instrumented runs. Better timing attribution and lower live-report overhead are complete; the earlier stalls are not claimed fixed. Keep their reports and investigate a reproduction with schema 2 before making speculative game changes. Do not restart all completed Edge acceptance checks solely because of this diagnostic patch.

## Verification

All **1,552 automated tests passed**. Six focused diagnostic/statistics tests also passed after the compact-report adjustment, covering preceding-frame attribution, bounded histories, pause/reset continuity, observer cleanup, unsupported capability fallback, preserving full evidence behind compact display, and omission of source data. TypeScript and the production build passed. The existing Vite shared-chunk-size advisory remains. The normal game bundle was checked for absence of the diagnostic tracing identifiers.

## Remaining acceptance

The owner subsequently replied **"Chrome works."** to the request to run Quick with Audio and Replay capture on, review/export the clip and play the downloaded video in standalone Chrome. The [Chrome receipt](qa/performance-2.96.1/chrome-owner-check.json) records this as functional acceptance of that requested flow. No Chrome JSON report or replay file has been supplied, so this confirmation establishes no measured FPS, stall count or memory result. Chrome Soak, Reduced effects and normal-game physical input/window transitions still need verification. The installed Chrome executable was version 153.0.8010.50; the running About screen was not independently inspected.

The owner confirmed that neither a physical controller nor a lower-end laptop is currently available. Those checks remain open. Current automation exposes only the Codex in-app browser; standalone Chrome is not independently controllable, and Firefox has no connected browser surface. Firefox, controller, touch and low-end-device acceptance remain unverified. The owner's separate Edge reports and manual confirmations remain the evidence for Edge.

Use the [updated diagnostic page](https://caleb-guyer.github.io/recoil-foundry/diagnostics.html?v=2.96.1) for further reproducible stalls or independent-browser tests. It contains late-game spoilers and does not save or upload progress/preferences. Full-effects/replay-enabled acceptance remains necessary; replay-disabled results can only help isolate cost.
