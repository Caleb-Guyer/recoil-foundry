# Stability follow-up — 20 September 2026

**Closeout update:** item 5 is now [closed under the owner's revised scope](performance-closeout-2.96.1.md). The investigation below remains evidence of unresolved behavior; it is not an outstanding request to repeat skipped tests.

Build 2.96.1. Attempted the remaining extended browser checks. **No long-run or hardware acceptance pass is claimed.** The owner later [confirmed basic gameplay in Chrome and Firefox](qa/performance-2.96.1/browser-owner-gameplay-check.json), explicitly saying longer tests were not done. Game code, saves, balance and rendering quality are unchanged.

## Access and conditions

Opening standalone Chrome through the available browser tool returned `Browser is not available: chrome`. The available controlled browser remains Codex's Chromium-based in-app browser. The owner's earlier Chrome Quick/replay confirmation remains valid; it does not provide a measured long run. Firefox has no connected automation surface. Physical controllers and a representative lower-end laptop remain unavailable for these checks.

The laptop reported the **High performance** power scheme, Win32 battery status 2 and 76% charge. Intel and NVIDIA adapters reported 240 Hz displays at 2560×1440 and 2560×1600; the active browser GPU was not identified. No local build or automated test suite ran during the measurements. Other user workloads were not controlled. No power, security or browser settings were changed.

## Failed extended runs

The intended twelve-minute public-site soak initially ran normally, then shifted to approximately **one animation callback per second after 102 seconds**. The [downloaded report](qa/performance-2.96.1/browser-background-scheduling-stall.json) retains the full 192-second interrupted run. Its SHA-256 is `cc73d7afa71d98fee02f5a33eed21c8cb1f83604e606bef7aa513b0c2893165c`. All 40 visibility/focus samples still reported visible/focused. The first delayed interval followed a **0.6 ms** callback; synchronous callback maxima stayed at 12.4 ms in volley and 14.2 ms in explosions. The one-second gaps are not explained by those main-thread timings alone.

Showing the existing browser and restarting did not restore timing. A fresh visible public-site tab also remained near one callback per second. The [visible-run observations](qa/performance-2.96.1/browser-visible-stall-observations.json) preserve selected report values. The fresh visible tab used its natural 1415×1347 canvas, while the initial background run used 1920×1080; these are not equal-resolution performance comparisons.

A [minimal animation control](qa/performance-2.96.1/raf-control.html), served locally with no game modules, canvas, audio or replay, completed one minute at **240 callbacks/second**, with no interval over 50 ms. Its [observed result](qa/performance-2.96.1/raf-control-observation.json) shows that every page in the session was not continuously limited to one Hz. This short localhost control is not proof of a cause or a same-origin comparison with GitHub Pages.

The same production game build on localhost initially recovered normal timing, then degraded too. The local diagnostic and shared game JavaScript hashes matched the published assets byte for byte; both hashes are recorded in the [local-run observations](qa/performance-2.96.1/browser-local-stall-observation.json). The intended soak was stopped at 385 active seconds:

| Scene | Mean FPS | Frame p95 | Frames over 50 ms | Callback maximum |
| --- | ---: | ---: | ---: | ---: |
| Volley, 120 s | 239.6 | 4.3 ms | 1 | 9.6 ms |
| Explosions, 120 s | 217.3 | 8.3 ms | 1 | 8.6 ms |
| Portals, 120 s | 143.5 | 25.1 ms | 141 | 14.7 ms |
| Beam, 25.2 s | 14.7 | 1004.2 ms | 25 | 5.3 ms |

The beam average includes its initial normal period before the one-Hz tail. A retained 1004.2 ms gap followed a 3.3 ms callback. Sampled JS heap ranged from 13.3 to 40.1 MiB and ended at 21.9 MiB; no sustained heap-growth conclusion is possible from this interrupted run. No application errors were reported, and audio voices returned to zero after Stop.

Finally, [disabling audio and replay and enabling Reduced effects](qa/performance-2.96.1/browser-minimal-workload-observation.json) in that affected local tab did not restore timing during a 97-second recovery comparison. This does not prove those workloads could not have triggered an earlier problem. It is not the required Reduced effects acceptance run, which keeps audio and replay enabled.

## Evidence limits and next decision

Initially, only the first new run produced a retrieved download; later requests produced no file in the inspected Downloads location, and an explicit download-event wait timed out. During the subsequent evidence check, `recoil-foundry-stability (12).json` was found and verified against the recorded 385-second local run. Its [complete report](qa/performance-2.96.1/browser-local-stall-full.json) is now archived unchanged, with SHA-256 `11676e356f116a5428637d4bcb5275e2914051185f531984afc8bb637e79114b`. The other observation artifacts remain clearly labeled as selected values read from the visible page, not complete raw downloads. Histories remained bounded, and discarded-entry counters are preserved where observed.

The slowdown is reproducible in this testing session, but its cause is **unresolved**. Browser/host scheduling, native/GPU work, asynchronous encoding and interaction with other workloads are not separated by these measurements. The normal animation-only control and initially normal local game prevent a blanket attribution to the entire browser or only the public host. Short synchronous callbacks do not rule out work outside those callbacks.

Further long runs in the same affected environment would not establish release acceptance. The earlier independently supplied Edge measurements and Chrome functional confirmation remain valid. At the end of this investigation, independent browser and hardware checks were still outstanding; the subsequent owner decision below supersedes the requirement for more Chrome/Firefox browser tests.

## Owner decision

After confirming basic Chrome and Firefox gameplay and clarifying that longer tests were not done, the owner said: **"It works, we dont need it."** Further browser testing is stopped. The remaining Chrome/Firefox long-run, replay and lifecycle verification requirements are waived and removed from the unfinished release checklist. They are not recorded as test passes, and the previously captured slowdown remains unresolved. Existing evidence is retained. Physical-controller and minimum-device requirements remain separate.

Before this decision, a further access attempt successfully initialized the native Windows Computer Use runtime and located Chrome, so the earlier blanket description of standalone control as unavailable was too broad; the limitation applied to the browser connector. Native control then stopped because its safety check could not reliably identify Chrome's current URL. No new benchmark or input result was obtained from that attempt. No further automation attempt is requested after the owner's decision.
