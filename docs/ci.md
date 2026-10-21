# Automated checks and deployment

Pushing `main` starts the **Build and deploy game** workflow. Four regular-test jobs run alongside eight maximal-build jobs. Regular test files are sorted, then distributed into four interleaved groups, so every file runs exactly once. Newly added `.test.ts` files are included automatically.

Each maximal-build job selects a different interleaved eighth of the legal Workshop builds; the current 9,216 builds produce 1,152 per job. Every build runs the original firing, finite-physics, projectile/effect bounds and cleanup checks, plus its original catalog validation, save/link round trip and Reforge assertions.

Eight existing catalog-related tests now live in `tests/max-combo-rules.ts`, imported by the existing `max-combos.test.ts` entry point. They share one cached catalog generation per job. Their assertions and original test names are retained. The exhaustive per-build catalog and Reforge loops are partitioned across the same eight groups; global uniqueness, upgrade reachability, invalid-link checks and historical-link checks remain intact. Ordinary test files keep their normal process isolation; no generated catalog snapshot replaces production code.

Deployment waits for all four regular jobs and all eight maximal-build jobs to succeed. The existing **Regular regression tests** check aggregates the four regular workers and fails unless every one succeeds, preserving its check name. A failing or cancelled job prevents deployment. Both matrices disable fail-fast, so a failure does not cancel the remaining coverage. Tag releases still require a successful Pages workflow for that exact commit.

The deployment and release workflows use the explicit `ubuntu-24.04` runner label so a change to `ubuntu-latest` cannot silently change the operating system. Checkout, Node setup and Pages use their Node 24 action releases; the game build and tests also run on Node 24.

`npm test` continues to run the entire suite locally. `npm run test:ci` runs all regular test files when no shard variables are set. To reproduce one regular CI group, set both `RF_REGRESSION_SHARD` (1 through 4) and `RF_REGRESSION_SHARDS` (4). Use the regular command alongside `npm run test:max-combos` to reproduce the full CI coverage.

`npm run test:max-combos` checks all builds and catalog rules when no shard variables are set. For one CI group, set both `RF_MAX_COMBO_SHARD` (1 through 8) and `RF_MAX_COMBO_SHARDS` (8). Missing, malformed, out-of-range or empty shard settings fail the run. The two sets of variables are independent. Uneven future totals are divided without dropping or duplicating builds. Logs show the selected count for catalog/Reforge checks and Workshop progress every 128 builds.

GitHub runner availability and the slower regular tests still affect total run time. Parallelizing the exhaustive fixture changes how checks are scheduled; it does not remove checks or bypass deployment requirements.
