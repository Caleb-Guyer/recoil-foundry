# itch.io 5.6.0 publication — 19 October 2026

The existing itch.io project now serves **Recoil Foundry 5.6.0 — Remix Gauntlet**. The page URL, project ID `5033600`, free pricing, click-to-launch setup, cover, screenshots and featured YouTube trailer are retained. The description has been refreshed from the old Dead Signal launch copy to cover the current game.

## Source and package

- Runtime/source commit: `621f574fef06388bc2103562500f02dd50d4d792`.
- Exact-commit [Pages CI and deployment](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/39139833883): completed successfully, including the regular suite and eight maximal-build groups.
- Immutable release: [v5.6.0](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v5.6.0).
- [Release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/39350345762): completed successfully after verifying the same commit's Pages run, rebuilding and packaging the static site.
- Official asset: `recoil-foundry-v5.6.0-site.zip`, **9,921,878 bytes**.
- SHA-256: `46a3f1518b6f3b3bc8b91ff162c879bffb86e9fb224d42c2ccf68d7ab6fecec4`, matching GitHub's release-asset digest.

The ZIP passes CRC checks and contains 17 files, a root `index.html`, relative entry references and every referenced local asset. It excludes repository source, tests and dependencies. The packaged shared JavaScript contains version 5.6.0. The identical archive was copied under the existing replacement basename `recoil-foundry-v2.98.0-site.zip`; its bytes were not rebuilt or edited after verification.

## Store publication

The old upload was replaced, its display label updated, and **This file will be played in the browser** re-enabled before saving. The new upload is **19890526**. The public game actually loads `https://html-classic.itch.zone/html/19890526/index.html?v=1792458293`; its About & credits panel reports **RECOIL FOUNDRY · 5.6.0** and its title shows the Remix Gauntlet update and next-goal card.

The live description now includes 141 upgrades, all six earned starting weapons, twenty rooms across five zones, branching jobs, hunts and alternate boss arenas, Daily/Overtime/Security, both Gauntlet routes, actual-art Logbook entries and the next-goal system. Controls, progress-transfer guidance, support links and credits remain available. The official YouTube trailer is still embedded and is now the description's trailer link too.

An initial HTML-source edit did not synchronize to the saved description. The editor was reloaded, the prepared HTML pasted through its normal rich-text control, and a keyboard edit used to trigger its change handling. After saving, the actual public page was reloaded and checked for the new copy. The editor's transient preview alone was not treated as publication evidence.

## Browser scope and progress

Before and after replacement, the existing itch.io profile shows **Continue daily**, **Room 1**, zero upgrades discovered, zero Practice victories, zero blueprints and zero Practice records. Sound and Music remain enabled, both volume sliders stay at 100%, and Reduced effects stays off. No save import, profile reset or fixture unlock was performed.

The public Controls warm-up starts. Movement, jump and fire inputs were sent; pause, Reset warm-up and Done return normally, and the original Continue daily remains available afterward. No browser error entries were reported during these checks. These are limited embedded-browser publication checks, not new physical-browser/hardware, long-duration gameplay or speaker-listening acceptance. The earlier CI and release tests cover the unchanged runtime.

A local backup-download attempt did not return a completed download event, so no new backup export is claimed. The original saved progress was left in place and compared through the game's Progress screen.
