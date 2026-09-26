# Browser release support

Release target: **Windows desktop/laptop with keyboard and mouse**. The stable browser release is **3.1.0**. The browser/hardware evidence below was collected for 2.96.1; it is retained with its original scope rather than represented as a fresh physical-device test. The [release operations record](release-operations.md) links subsequent software checks and public-browser verification, including [Overtime Docks 3.1.0](validation/overtime-docks-3.1.0.md).

| Browser or input                 | Status                                                                                                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Microsoft Edge on Windows        | Most thoroughly checked: owner-supplied Quick, twelve-minute Soak and Reduced effects reports, replay export/playback, keyboard/mouse, focus/fullscreen and basic run transitions. The inspected installed version was 153.0.4234.32. |
| Google Chrome on Windows         | Owner confirmed basic gameplay, Quick-test completion and replay export/playback. The inspected installed version was 153.0.8010.50. Longer measurements and individual lifecycle checks were waived.                                 |
| Firefox on Windows               | Owner confirmed basic gameplay. The running version was not provided. Longer measurements, replay export/playback and individual lifecycle checks were waived.                                                                        |
| Controllers and rumble           | Implemented, with automated input/failure/reconnection checks. Physical hardware verification was unavailable; treat this as experimental support.                                                                                    |
| Touchscreens and mobile browsers | Controls exist, but real-device acceptance was not completed. Experimental; not an advertised mobile release.                                                                                                                         |
| Safari, macOS and Linux          | Not verified for this release.                                                                                                                                                                                                        |

Browser versions above came from installed executables, not independently inspected About screens. Owner reports and agent-controlled embedded-browser measurements are distinguished in the [performance report](performance-stability-2.96.0.md), [Chrome receipt](qa/performance-2.96.1/chrome-owner-check.json) and [gameplay confirmation](qa/performance-2.96.1/browser-owner-gameplay-check.json).

## Hardware and performance

The measured Windows laptop has an Intel Core Ultra 9 275HX, about 31.4 GiB RAM and NVIDIA RTX 5080 Laptop GPU plus Intel graphics. The browser's active GPU was not identified. These are **test-machine specifications, not minimum requirements**. No representative lower-end laptop was available, and no minimum specification or universal 60 fps guarantee is published.

Reduced effects is available in Settings. It reduces camera shake, cosmetic particles and hit flashes while preserving attack warnings and physics. If performance is poor, try it and close other resource-heavy applications.

## Known limitations

- External first-time-player observations, human balance/duration acceptance and physical headphone/laptop-speaker listening remain unverified. They are accepted release limitations under the owner's best-effort final-release direction, with optional future feedback welcome. See the [release closeout](browser-release-closeout-2.98.0.md).
- The Edge stress reports contain occasional frame stalls, including a 141.7 ms maximum in the Soak run. Reduced effects did not remove every hitch. These remain known performance limitations, not fixed results.
- Extended tests in the embedded browser developed severe frame-delivery slowdowns. Their cause remains unresolved. The independently supplied Edge Soak did not reproduce that one-frame-per-second pattern. See the [investigation](stability-follow-up-2026-09-20.md).
- Physical controller reconnect/rumble behavior and low-end performance remain unverified. Additional browser stress and lifecycle tests were waived by the owner; unavailable hardware checks were deferred during [item 5 closeout](performance-closeout-2.96.1.md).
- Replay export depends on browser capabilities. Where export is unavailable, the game keeps replay viewing available when image decoding works and shows an unavailable message. Firefox exported-video playback has not been confirmed.

For a reproducible problem, [open an issue](https://github.com/Caleb-Guyer/recoil-foundry/issues/new) with the browser/version, game version, mode, seed, room and steps to reproduce. Reports are submitted manually; the game does not upload diagnostic data automatically.
