# Build Momentum validation — 5.1.0

## Drafts and deterministic combat

The focused tests sample 640 scheduled drafts, check two unchanged open draws, legal prerequisites, earned unlocks, branch exclusions, salvage and reroll exclusions. They also freeze published revision 89/unversioned/Daily offers and reconstruct real pending drafts through Continue. All three public draft previews load, reroll and retry without saving progress or earning awards.

`npm run balance:progression -- report.json all` audits every native tool on two normal Campaign seeds, both five-fight Gauntlet routes, and a legal 19-pick Overtime volley checkpoint. The before/after comparison uses the same `RF-C90-BP-17`, `RF-C90-BP-39` and `RF-C90-OT-BP-0` seeds, deterministic particles/Matter identities, ordinary inputs, real rewards, normal health and carried damage. It does not heal, teleport or remove opponents. Preview mode bypasses Gauntlet ownership only.

| Tool     | Campaign completions / 2 | Gauntlet completions / 2 | Overtime volley result                      |
| -------- | ------------------------ | ------------------------ | ------------------------------------------- |
| Pistol   | 1                        | 2                        | Alive, navigation timeout in Split boilers  |
| Shotgun  | 0                        | 2                        | Died against Crane                          |
| Nailgun  | 2                        | 2                        | Died in Split boilers                       |
| Twinbore | 1                        | 1                        | Alive, navigation timeout in Relief gallery |
| Carbine  | 2                        | 2                        | Died against Crane                          |
| Repeater | 1                        | 1                        | Alive, navigation timeout in Split boilers  |

All 30 after cases retained the exact before mode, stage, health, selected mods and completion time. The strategy favors immediate power and retained its selections from the open slots. Its 37 scheduled Campaign drafts went from **13 with a follow-up to 37**, while the first two offers were preserved. This checks continuity and behavior preservation, not an increased win rate.

An additional six-tool Overtime beam cohort retained five deaths and one live Split boilers timeout. Strong fixtures are legal checkpoints, not promises that every first lap offers that precise build. The stalled pilots remain below raised shelves while elevated opponents survive. The pressure-room driver releases recoil and approaches a blocked opponent's horizontal position, but does not route around a shelf overhead when already beneath that opponent; changing gun damage would not validate this navigation. Boss failures include warned Crane slams and contact; the generic Gauntlet pilot lacks the Campaign pilot's explicit Crane reactions. No unproven global damage or boss-health adjustment was made to make bots win.

The existing native-tool regressions additionally check equal ideal starting DPS, actual pellet/burst emissions, recoil once per discharge, upgrades/Continue, and complete Shotgun/Nailgun Campaigns on their published fixture. Bot completions demonstrate possible control paths; bot deaths and two sampled seeds do not estimate human difficulty. Full six-tool Overtime completion remains unverified by this pilot.

## Collision and rendering checks

Six hundred randomized sweeps over forty rotated/moving bodies compare the optimized query with exhaustive convex collision time, normal and body. An instrumented 300-body case confirms distant bodies never enter vertex projection. The optimization uses current Matter bounds, with no stale spatial cache. Synthetic swept cover in tripwires and Storm Cells supplies bounds enclosing the combined previous/current convex hull. Real-system regressions cover fast cover passing completely through a link, restored Storm links after passage, and teleport gaps that must not cut a link.

The dense beam renderer test retains all 120 visible core segments, limits halos to two strokes, combines a shared cosmetic impact, and leaves simulation segments intact. Reduced effects retains all cores without a halo. Offscreen segments skip drawing while crossing/edge segments remain visible. Real combined heat/blast stress fixtures emit mortar warnings and shells before firing; they use unchanged AI and damage.

## Release checks

The production build passed TypeScript and Vite. Vite retains the existing shared-chunk size advisory; no bundle-size or universal FPS claim is made.

The first 5.0 baseline browser Quick test completed all nine cases with no errors, slow frames over 50 ms or dropped simulation steps. A normalized viewport-override repeat developed approximately one-second frame-delivery gaps despite visible/focused samples, running audio and small preceding callback work. The 5.1 repeat and a fresh-tab recovery attempt reproduced that scheduling pattern. Returning to native sizing recovered normal delivery initially; its eleven-case long test later reproduced the known slowdown. All eleven cases completed without game errors, and audio voices returned to zero. A completed report with dropped steps is not a performance pass.

These reports are retained under `.release-assets/progression-browser-*.json`. The existing [browser support record](../browser-support.md) already documents this embedded-browser limitation and distinguishes independent owner-supplied Edge checks. Baseline and recovered native runs used different viewport/canvas sizes, so their FPS or work timings are not presented as a controlled speedup. Exact collision results, skipped projections and bounded drawing work provide the implementation evidence; representative low-end hardware and long physical-browser timing remain outside this pass.

The scenario selector was checked in the production UI: direct Heat/mortar selection, pause/resume showing `1 / 1`, completion, switching to Blast/mortar, and Prism with Reduced effects. Each completed without game errors; their timing warnings remain retained. Some UI checks overlapped local regression work and are functional checks, not additional performance acceptance. The three public draft links loaded actual cards; a paid beam reroll showed Thermal Runaway as a follow-up, its comparison opened with keyboard focus, and choosing it advanced to the next room. The compact layout was visually inspected and saved as `.release-assets/progression-draft.png`.

The Node lifecycle soak passed **120 reset/menu cycles**, **216,000 combat input steps**, **720 pauses**, **351 combat clears** and **60 actual combat deaths**, with **zero checkpoint writes**. Tracked object counts retained identical per-scenario reset baselines. Post-reset explicit-GC heap samples stayed between about 20 and 26 MB; this is JS heap in Node, not total browser/native memory. The full report is `.release-assets/progression-soak.json`.

All **9,216 maximal builds** passed their real Workshop firing, finite physics, secondary-effect budget and cleanup checks in eight local shards, including a full rerun after the swept-cover correction. The unmodified CI fixture partitions the same catalog, 1,152 builds per shard. Final logs are `.release-assets/progression-fixed-max-1.log` through `-8.log`; the initial `progression-max-` logs are also retained.

The first full regular run found an outdated expected Daily revision and a swept-cover tripwire regression: the synthetic hull had replaced vertices while retaining the current body's smaller bounds. Both swept-cover callers now rebuild the hull bounds, and the current Daily expectation is 90. All **58 targeted checks** passed after these corrections. The original failure log is retained as `.release-assets/progression-regression.log`; final rerun logs use the `progression-fixed-` prefix.

The final full regular rerun passed **2,838 / 2,838 checks**, with no failures, cancellations or skips, using the official regular-file partition and four local test workers. Its log is `.release-assets/progression-fixed-regression.log`. TypeScript/Vite, formatting for all changed TypeScript files, and the whitespace diff check passed. The production entry assets are `game-ZU3-g8s8.js`, `game-Ct5kAKRQ.css`, `diagnostics-Bs5IRcq9.js` and shared `toolroom-test-nhaEwCn9.js`.

Publication uses the existing Pages workflow, gated by the complete regular suite and all eight maximal-build shards. The release response reports the exact committed SHA, successful workflow and public asset verification; the local deployment receipt is `.release-assets/progression-deployment.json`.
