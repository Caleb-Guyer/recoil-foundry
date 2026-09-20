# Item 7 — browser release-candidate packaging

20 September 2026 · 2.98.0-rc.1 · Daily ruleset 78 unchanged

The owner asked for best effort with available tools and supplied no external player feedback or listening notes. Packaging is complete; unavailable human acceptance remains unverified in the [remaining checklist](browser-release-checklist.md). This is an RC, not a claim that external acceptance passed.

## Delivered

- Concise [player README](../README.md), with controls, saves, settings and support. Previous development notes are preserved in [development history](development-history.md), including their historical values and spoilers.
- Settings/Pause → **Report an issue**: editable details, fixed GitHub destination, copy button with manual-copy fallback, no automatic submission or local-storage upload. Title reports omit stale run details. Escape/Back returns to the parent menu and preserves pause; editing does not trigger gameplay keys.
- [Bug template](../.github/ISSUE_TEMPLATE/bug_report.md), [support list](browser-support.md) and [blocker/rollback procedure](release-operations.md).
- [Media kit](release-media.md): three 1280 × 720 images, 18-second silent H.264 clip, 1200 × 630 social preview and metadata. Real engine simulation with scripted inputs, no human-playtest or audio evidence implied. Capture provenance is included.
- [Announcement draft](release-announcement.md), [release notes](releases/2.98.0-rc.1.md) and a tag-triggered prerelease workflow with a downloadable static-site archive. Stable release publication stays manual.
- Version tag `v2.98.0-rc.1`; prior deployed source preserved at `browser-rollback-2.97.0` (`9f5707fa7a6c3f9fab507f48ad026d37da2b8e02`).

## Verification

- **1,559 automated tests passed**, no failures or skips. Includes report context, mode identity, absence of previous-run details at title, safe URL encoding and report-size limits.
- TypeScript and Vite production build passed. Existing shared-chunk size warning remains; no new runtime dependency is added.
- Embedded-browser checks: title and live paused-run reports, edited text reflected in draft URL, pause-key typing, Copy details, Escape/Back focus restoration and 640 × 480 layout without horizontal overflow. No test issue was submitted.
- Three engine images and the sharing card visually inspected. Full 18-second video decoded successfully with FFmpeg.
- Publication is verified against the exact commit by [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/deploy.yml) and the [candidate workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/workflows/release.yml). Published notes and site archive are attached to the [candidate release](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v2.98.0-rc.1).

## Not performed

Recruitment, five first-time-player observations, real-session difficulty/duration/replayability acceptance, awkward-build full-route judgments and physical headphone/laptop-speaker listening. No recruitment messages were sent and no participant data was invented. A [session packet](external-playtest-packet.md) is ready for future feedback. Hardware/browser limitations already accepted in item 5 remain documented without reopening that item.
