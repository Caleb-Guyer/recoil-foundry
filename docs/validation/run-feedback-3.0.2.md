# Run feedback — 3.0.2

25 September 2026. A shared categorized report form and a quiet Feedback button on every death/victory result. No gameplay, checkpoint or Daily changes.

## Verification

- Twelve focused reporting, dialog-dismissal and controller-menu checks pass. New regression cases cover regional route identity without exposing an unchosen route, real repository template files, exact edited text in draft URLs, end-state/build context and no game-state mutation. Existing URL destination/length and title-screen context checks remain intact.
- TypeScript and the Vite production build pass. The existing large-chunk advisory remains.
- Browser inspection at 1280×720 confirms a quiet result action and three clear category buttons. At 600×500, result actions wrap without horizontal overflow; the form remains scrollable and Back is reachable.
- Editing Bug and Difficulty independently, switching between them, Escape/Back to the result and reopening preserve the typed drafts and selected category. The outgoing link contains the exact reviewed text and selected template; deleted context is not silently added again. Copy details returns the selected text. Another run resets the draft to fresh context.
- The one-health replay preset reached a real death. Feedback identified its dead state, seed, starting gun and room correctly; Suggestion selected its matching template. Typing the retry key remained text entry, Escape restored the result, and Watch replay still opened the captured clip. Browser warning/error logs were empty.

These are technical/UI checks, not feedback from independent players. No issue or player report was submitted during verification.

## Publication

Published on GitHub Pages and itch.io. Runtime commit `0bc55580cf8878908731d53bd4670129a470ada8`; immutable tag `v3.0.2`. Previous stable reference: `v3.0.1`.

- [Pages CI](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36171302497) passed **1,891/1,891 tests**, zero failed/skipped, in 583.7 seconds, then built and deployed that exact commit. The [release workflow](https://github.com/Caleb-Guyer/recoil-foundry/actions/runs/36172630191) passed its same-commit gate before publishing the [stable ZIP](https://github.com/Caleb-Guyer/recoil-foundry/releases/tag/v3.0.2).
- Downloaded archive: `recoil-foundry-v3.0.2-site.zip`, **9,751,505 bytes**. SHA-256 `4f6ceda05b8b41bac8411c5db3c58bfacdb2526a0f026d7dee4b15ffeb102e18`, verified against GitHub's digest. Seventeen files, 10,501,237 uncompressed bytes, root `index.html`, all four relative entry assets present; no source, dependencies or test harness.
- itch.io upload **19398808** has the identical ZIP bytes, the existing replacement filename `recoil-foundry-v2.98.0-site.zip`, and display name **Recoil Foundry 3.0.2 — Dead Signal**. Browser play is checked; public/free/fullscreen settings are preserved.
- Live Pages About shows 3.0.2. The victory preview and actual death preset both expose Feedback; edited category text and matching draft links work. Existing Room 2 progress, one discovered upgrade and zero Practice victories are unchanged.
- The actual itch.io store iframe at `https://html-classic.itch.zone/html/19398808/index.html` shows 3.0.2. Its categorized report form selects the correct suggestion template. Continue daily, Room 1, zero discoveries and zero Practice victories remain intact. The isolated ending preview on that same hosted artifact also opens Feedback with all three categories.
- Browser warning/error logs were empty in the public checks. Checks used the available in-app browser. No existing run was restarted, and no public feedback was posted.

Implementation and publication checks are complete. The existing browser/hardware support limits remain unchanged.
