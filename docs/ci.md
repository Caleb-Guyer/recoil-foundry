# Automated checks and deployment

Pushing `main` starts the **Build and deploy game** workflow. The regular suite runs alongside eight maximal-build jobs. Each maximal-build job selects a different interleaved eighth of the legal Workshop builds; the current 9,216 builds produce 1,152 per job. Every build runs the original firing, finite-physics, projectile/effect bounds and cleanup checks.

Deployment waits for the regular suite and all eight maximal-build jobs to succeed. A failing or cancelled job prevents deployment. Tag releases still require a successful Pages workflow for that exact commit.

The deployment and release workflows use the explicit `ubuntu-24.04` runner label so a change to `ubuntu-latest` cannot silently change the operating system. Checkout, Node setup and Pages use their Node 24 action releases; the game build and tests also run on Node 24.

`npm test` continues to run the entire suite locally. `npm run test:ci` runs all test files except `max-combos.test.ts`; use this command alongside `npm run test:max-combos` to reproduce the CI coverage. The regular-suite launcher automatically includes new `.test.ts` files.

`npm run test:max-combos` checks all builds when no shard variables are set. For one CI group, set both `RF_MAX_COMBO_SHARD` (1 through 8) and `RF_MAX_COMBO_SHARDS` (8). Missing, malformed or out-of-range shard settings fail the run. Uneven future totals are divided without dropping or duplicating builds. Logs show the selected count and progress every 128 builds.

GitHub runner availability and the slower regular tests still affect total run time. Parallelizing the exhaustive fixture changes how checks are scheduled; it does not remove checks or bypass deployment requirements.
