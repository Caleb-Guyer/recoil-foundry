# 5.6 launch devlog and playtest setup — 19 October 2026

The owner authorized publishing the launch devlog and setting up the first-ten-minutes playtest. The [itch.io post](https://caleb-guyer.itch.io/recoil-foundry/devlog/1717658/recoil-foundry-56-is-live-trailer-ten-minute-playtest) is **Published**, classified **Major Update**, with comments enabled. It embeds the released YouTube trailer, retains the 5.6.0 game attachment and saves the native player/gun thumbnail as its custom cover. Its title is **Recoil Foundry 5.6 is live — trailer + ten-minute playtest**. [Announcement source](../itch-io/launch-5.6.0-devlog.html).

The actual public page was checked for the trailer, current-game summary, Remix Gauntlet requirements, ten-minute invitation, three questions, feedback form link, guide link and open comment field. The saved editor retains the custom cover and Published/Comments settings. No test comment, fake player report or direct recruitment message was submitted.

## Playtest resources

- [Player guide](../playtests/5.6.0/README.md): normal itch.io game link, optional ten-minute session, questions after play and two public response routes.
- [Moderator sheet](../playtests/5.6.0/moderator.md): ten explicitly empty slots, exposure/assistance and restart-opportunity fields, plus an evidence-based triage table for up to three 5.6.1 fixes.
- [GitHub form](https://github.com/Caleb-Guyer/recoil-foundry/issues/new?template=first_ten_minutes.yml): actual first-time status, optional session context and prior exposure, best moment, first friction, actual action after death and reason for continuing or stopping.

The issue form was parsed by Prettier and verified in GitHub's live new-issue UI without submitting it. GitHub initially selected the first option in required dropdowns. First-time and restart fields were changed to empty required text inputs so the form cannot silently invent a newcomer or successful retry. The live form then showed blank fields and all intended questions.

The main README and older observation packets link to the active 5.6 round. The devlog is the primary invitation and comment route; a GitHub account is needed only for the optional issue form. No personal contact details or recordings are requested. Reports are public, participation has no deadline, and no hosted-session booking or recurring monitoring was created.

**Status at setup: open for volunteers, zero completed human sessions logged.** No player-retention or balance result is claimed. The game runtime and saved progress are unchanged by this setup; its CI-verified 5.6.0 build remains the playtest baseline. Formatting and whitespace checks cover the new form, HTML and guide files; live publication and form rendering supply the relevant integration checks.
