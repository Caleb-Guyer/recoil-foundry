# CI scheduling and playtest invitation — 20 October 2026

The 5.7.1 release's regular regression job took **23 minutes 30 seconds** in [workflow 39519321564](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/39519321564). The complete workflow took approximately 24 minutes 44 seconds. This change parallelizes the work while retaining all existing tests and simulation cases.

## Coverage preserved

- An AST inventory against commit `6a22f6f22b296b8dd7922acc144e2de7b1347af7` contains **2,181 original test declarations**. Every declaration remains present after relocation. There are three additional shard-configuration tests, for 2,184 declarations in total.
- Eight original catalog-related tests move intact into `tests/max-combo-rules.ts`, which is imported by the existing maximal-build test entry point. An AST comparison confirms that all **60 assertion calls** in those tests are unchanged.
- The catalog validation and Reforge loops select disjoint eighths of the same complete production catalog. Each of the current **9,216 builds** still receives its original checks. Global uniqueness, upgrade reachability, save/link round trips, old link compatibility and invalid-link rejection remain covered.
- The existing Workshop simulation still executes **180 frames per build** with all original physics, projectile/effect bounds and cleanup assertions.
- The catalog is generated once per maximal-build worker and reused by the relocated tests and Workshop simulation. No catalog snapshot, sampled subset or production-code substitute is introduced.
- Four regular workers cover every remaining test file exactly once. New `.test.ts` files enter automatically. With no shard settings, the local commands still run their complete respective suites.
- Both matrices disable fail-fast. Invalid, incomplete, unsafe or empty shard settings fail the command. The original **Regular regression tests** check remains as an aggregate gate; it fails unless every regular worker succeeds. Deployment and exact-commit release verification remain gated on all regular and exhaustive jobs.

The six sharding tests pass. Production build, formatting, and `git diff --check` are checked separately. A full regular run and a maximal-build shard run are exercised locally, and the main workflow must pass all four regular groups and all eight exhaustive groups before deployment. Runtime version and game source are unchanged at 5.7.1.

Detailed inventory and assertion-comparison receipts are saved in the workspace's `CI Speedup 5.7.1` folder. Compare the completed new workflow with the baseline above to measure the actual wall-clock improvement; do not infer speed from an aggregate check's short runtime.

## itch.io update

The original feedback invitation now points to 5.7.1 and describes contextual hints, the automatic first-upgrade comparison and the always-available safe warm-up. One [follow-up post](https://itch.io/post/17663579) invites three to five first-time desktop players to share their best moment, first confusion, approximate duration, room reached and whether they restarted after dying. Existing human replies are retained. The owner's update is recorded as ignored owner content in the local feedback-monitor state.

This publishes an invitation, not a claimed completed playtest or a response from a tester.
