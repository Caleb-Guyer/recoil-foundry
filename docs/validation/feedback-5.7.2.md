# Feedback 5.7.2 validation

## Automated checks

The focused report suite passes all **10 tests**. It covers every GitHub template destination, exact text encoding, maximum-length playtest reports fitting within the GitHub draft limit, unanswered questions, redacted or removed summaries, named upgrades, continued-run timing, title-screen omission of previous-run details, and report generation without checkpoint writes or run changes. Both playtest templates point to the menu's current itch.io discussion and avoid fixed release versions.

The full regular suite passes **3,064 tests**, with zero failures, skips or cancellations. The final production TypeScript/Vite build, formatting and diff checks pass. Pages CI still requires all four regular groups and all eight maximal-build groups before deployment. No tests or exhaustive build cases were removed.

## Production-preview browser checks

Checked the built site at 1280 × 720 through ordinary browser controls:

- The isolated mastery result opens Feedback on Playtest; Pause → Report an issue still opens Bug. The selected category receives focus and the menu starts at its heading.
- All three questions, the unanswered first-time/returning selector, collapsed run summary and sharing controls fit in the desktop dialog. Expanding the summary provides a labeled editable textarea.
- Filled explicitly labeled QA answers and chose Returning player. Edited the summary to remove its seed. Switching to Bug, editing that separate draft, then returning to Playtest retained the answers and redaction.
- Copy placed the reviewed answers and redacted summary on the clipboard, without the original seed or separate Bug text. The success message explains the remaining paste/review step. The generated GitHub draft URL contains the same reviewed text and the correct template.
- Back returned to the same result with its original 19:23 / 216-kill preview and loadout. Reopening Feedback retained the draft. The isolated opening-room report showed room 1, the Service pistol, no upgrades and paused state.

Screenshots are in the workspace's `Feedback 5.7.2` folder. No test feedback was posted, no GitHub issue was submitted, and these QA reports are not human playtest evidence. The denied-clipboard path retains a selectable full report for manual copying; browser clipboard access succeeded in this check, so denial was not simulated.

Deployment status is verified against the exact pushed commit separately; local checks alone do not establish public availability or an itch.io build update.
