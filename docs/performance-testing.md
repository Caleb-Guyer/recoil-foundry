# Browser performance acceptance

Use the production [stability test](https://caleb-guyer.github.io/recoil-foundry/diagnostics.html) on each browser/device being considered for support. This separate diagnostic page contains late-game encounter spoilers. It does not save a run, unlock content, change preferences or upload its report.

## Capture a comparable result

1. Record the browser's full version, Windows version, CPU, GPU, RAM, screen resolution and refresh rate. Record whether the laptop is plugged in and which power mode it uses. Do not include account names, serial numbers or other private identifiers.
2. Close other games, video playback and heavy work. Keep the browser at its usual resolution and zoom. Do not use CPU throttling as a substitute for an actual low-end device.
3. Keep **Replay capture** and **Audio** on. Run **Quick · 3 minutes**, then **Soak · 12 minutes**. Keep the test tab visible; switching away pauses it. Resume explicitly when returning. Download each report.
4. Repeat Quick with **Reduced effects** checked. This changes rendering only. If replay capture dominates frame stalls, repeat Quick with Replay capture off to help isolate the cost; the acceptance run still needs it on.
5. Review the captured clip, pause and resume it, save it, then close the viewer. Verify that the downloaded clip plays and that a second test can start normally.
6. Play the actual game too. Test death/retry, entering the next room, opening menus, returning from another tab and fullscreen. Use the intended physical keyboard/mouse and controller; disconnect and reconnect the controller during play. Check rumble and neutral-stick/released-trigger recovery. Test touch only on actual touch hardware if it will be advertised.

## Read the measurements

The six presets cover dense volleys, chain explosions, portals, beams, the boss arsenal and Overtime. They use real game simulation, AI, collisions, rendering, audio and replay capture. An automatic input driver restarts a preset after death or a clear. It is a load test, not a complete campaign playthrough or a difficulty assessment.

The first two seconds of each scenario are excluded from timing histograms. Frame intervals measure browser animation-frame delivery. Simulation time is total fixed-step work **per rendered frame**, including frames with no simulation step on high-refresh displays. Render and replay timings measure synchronous main-thread calls, not total GPU or encoder time. Histograms use 0.1 ms bins; values at or above 400 ms share an overflow bin and report the observed maximum conservatively. Object peaks are sampled once per second and can miss shorter peaks.

Browser JS heap is sampled when the browser exposes it; it does not include all native image, audio or GPU memory and is not forced through garbage collection. Normal heap sawtoothing is expected. Compare repeat runs, post-reset baselines and longer-term trends. Replay clips are intentionally retained after a test for review, with a five-second / 16 MiB bound. Active audio voices should fall back to zero after the test finishes.

Reports include sampled visibility, focus and audio-context state. Frame gaps over 250 ms produce a timing warning, even if every scenario finishes. A "complete" status means the scenarios ran; it is not a performance pass. If animation-frame delivery shifts to a fixed low frequency while measured game work stays small, preserve the report and investigate browser scheduling/power state. Record any recovery action and repeat in a fresh tab; never discard the bad run without documenting it.

On the chosen minimum device, aim for 60 fps, a 95th-percentile frame interval near 16.7 ms, no persistent slow scenes, and no growing memory/voice backlog. Investigate repeated frames over 50 ms, dropped simulation steps, errors or rising post-reset memory. A high average FPS does not excuse disruptive stalls.

## Record the decision

| Field                                | Result |
| ------------------------------------ | ------ |
| Build / date                         |        |
| Browser / OS                         |        |
| CPU / GPU / RAM                      |        |
| Resolution / refresh / browser zoom  |        |
| Power / background load              |        |
| Full-effects report                  |        |
| Reduced-effects report               |        |
| Long-soak report                     |        |
| Replay view / downloaded playback    |        |
| Physical input / reconnect / rumble  |        |
| Focus / fullscreen / menus / retry   |        |
| Problems and reproducible steps      |        |
| Supported / needs fixes / not tested |        |

The current [verification report](performance-stability-2.96.0.md) records the available machine's results. Installed browsers are not automatically verified browsers. Keep untested hardware and browsers off the supported list until their checks pass.

## Simulation-only soak

From the repository, run `npm run stability -- report.json` with Node 24. The default covers 216,000 combat input steps, 120 reset/menu cycles, 720 pauses and 60 actual combat deaths. It checks finite physics, projectile/particle budgets, identical reset body counts and isolated progress hooks. Node starts with explicit GC enabled so memory can be compared after identical resets. This complements the browser test; it cannot establish browser FPS, native memory use, physical-device behavior or human playability.
