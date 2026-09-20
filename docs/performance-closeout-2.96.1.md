# Item 5 closeout — performance and stability

**Closed 20 September 2026 for the browser release**, under the owner's instruction: "Finish 5. Do this in one set. whatever you can't do - dont do, try your best., 5 needs to be completed."

Available software work and final verification are complete. Unavailable hardware checks are deferred, further browser testing remains waived, and unresolved measurements are published as known limitations. This closes the release work item; it does not certify untested hardware or establish that every performance issue is fixed. The release's [browser/device/input support list](browser-support.md) is published and linked from the README.

## Completed work

- Replay image encoding runs in a worker where available, with a safe canvas fallback. Outstanding native encoding stays bounded across retries. Unsupported export, recorder/decode failures, hidden-tab cancellation and closing during asynchronous work release resources or leave usable fallback UI.
- The separate diagnostic page measures real game simulation, rendering, audio, replay, object budgets and optional memory. Bounded frame traces preserve preceding-callback timing and available browser observations. Normal gameplay contains no diagnostic overlay.
- Progress/retry, pause/focus/input recovery, unavailable audio/controllers, replay lifecycle and diagnostic limits have automated checks. Independent owner evidence covers Edge's stress/replay/input flows, Chrome's Quick/replay flow and basic Chrome/Firefox gameplay.
- The simulation audit's hard-coded version was replaced with the package version, so future reports identify the build they test. The final report correctly identifies 2.96.1. Gameplay, balance, save formats and Daily ruleset 78 are unchanged.

Implementation and earlier evidence are preserved in the [2.96.0 report](performance-stability-2.96.0.md), [2.96.1 instrumentation report](frame-stall-investigation-2.96.1.md) and [extended-run investigation](stability-follow-up-2026-09-20.md).

## Final available verification

**90 focused automated tests passed**, with no failures or skips. They cover controller polling/menu/game integration, keyboard/display safety, replay/worker lifecycle, music/audio failure handling, progress/recovery, frame tracing and timing summaries. TypeScript and the production Vite build passed. The existing shared-chunk size advisory remains; emitted game and diagnostic asset names are unchanged.

The [fresh simulation report](qa/performance-2.96.1/simulation-closeout.json), produced by `npm run stability -- docs/qa/performance-2.96.1/simulation-closeout.json`, records:

| Check | Result |
| --- | ---: |
| Combat input steps | 216,000 (60 input-equivalent minutes) |
| Additional repeated-death steps | 25,440 |
| Menu/reset cycles | 120 |
| Pause/resume cycles | 720 |
| Actual combat deaths | 61, including 60 dedicated death/retry checks |
| Clears | 147 |
| Linked portal setups | 44 |
| Campaign checkpoint writes | 0 |
| Assertions | Passed: finite physics, bounded combat objects, stable reset counts, paused simulation and isolated progress |

Runtime was Node 24.16.0 on Windows; the audit completed in 86.6 wall-clock seconds. Forced-GC heap across stress resets ranged from 17.4 to 21.3 MiB and ended at 20.9 MiB. The dedicated death sequence went from 19.9 to 20.4 MiB; all 60 resets retained exactly 15 bodies, zero collision pairs, zero shots and zero particles. This is simulation/lifecycle evidence, not a browser FPS measurement, native/GPU-memory audit or proof of leak-free behavior.

## Skipped, deferred and accepted limits

| Area | Closeout disposition |
| --- | --- |
| Additional Chrome/Firefox long runs and individual replay/lifecycle checks | Waived by the owner; basic gameplay confirmations and existing Chrome Quick/replay evidence are retained. No new pass is claimed. |
| Physical controllers, disconnect/reconnect and rumble | Hardware unavailable; deferred. Controller support is labeled experimental. |
| Touch and mobile devices | Not physically verified; experimental and outside the advertised desktop target. |
| Representative low-end laptop and minimum specifications | Hardware unavailable; deferred. No minimum requirements or universal 60 fps claim is published. |
| Isolated Edge hitches and embedded-browser frame-delivery slowdown | Investigation performed, cause unresolved. Retained as known limitations; further browser profiling is not required for this closeout. |
| Safari and other desktop operating systems | Unverified and outside the tested release target. |

The failed extended runs are not relabeled as successes. Their reports, the owner's confirmations and the [browser-testing waiver](stability-follow-up-2026-09-20.md#owner-decision) remain archived. New reproducible player bugs can still be fixed after this closeout. None of the deferred checks is silently carried forward as a required item 5 task.

Item 5 and the completed support-list task are removed from the unfinished release checklist. Its next section remains **6. Presentation, sound and endings**.
