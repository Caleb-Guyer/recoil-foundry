# Dead Signal: music and machinery

Historical implementation notes from `feature/dead-signal`, 25 September 2026, while the public build was 2.98.1. This work is now included in [stable 3.0](../validation/dead-signal-3.0.md).

## Listen and play

With the local development server on port 4186:

- [Play Crossed Lines](http://127.0.0.1:4186/?test=annex-route&room=broadcast&layout=alternate)
- [Play Switchboard](http://127.0.0.1:4186/?test=switchboard)
- [Listen to the arrangement](http://127.0.0.1:4186/scripts/annex-audio-preview.html): choose music only, music with gunfire/cues, or the existing Cooling score; render, then press Play. The 60-second WAV can also be downloaded.

The listening tool is development-only, does not enter the production build, and does not read or modify progress or preferences. The game uses the existing Sound, Music and volume controls. R retries the gameplay presets.

## Implemented

“Orders After Hours” is an original eight-bar D-minor composition at 112 BPM. A low filtered hum, detuned pulse and falling melodic answer establish the entrance. After the first bar, combat pressure introduces muted synth bass, kick and a snare backbeat. Hostile port charging raises that pressure even when the sender is distant. The opening is not replayed at every loop.

Switchboard plays a filtered lead version of the melody. Its second phase adds answering notes and occasional fills without restarting the phrase or changing tempo. Clearing the room removes drums, bass and lead, leaving a quieter hum and sparse harmony. Room/theme changes and clearing release the old notes over 240ms; pause, music mute, master mute and lost focus use the existing short cancellation. No extra HUD or combat controls are added.

Regional selection follows the actual authored level, including campaign, Continue, isolated tests and Switchboard Practice. It does not change the Cooling difficulty tier. Leaving the Annex restores the destination area's score; escape keeps its own music. This changes audio only, so Daily 83, old challenge identities, layouts and pending rewards are unchanged.

| Event | Cue |
| --- | --- |
| Port / Switchboard charge | Rising two-part electrical call |
| Switchboard lock | Fixed high note and falling answer |
| Caller recording | Two rising notes |
| Caller lock | Three short repeated notes for its three stored positions |
| Junction interruption | Short crack and descending power-down |
| Spoof reboot | Three ascending confirmation notes, separate from obtaining an upgrade |
| Allied charge / Caller | Quiet confirmation, without a hostile warning or music duck |
| Remote discharge | Short low pulse and filtered impact |

Hostile cues reserve effect voices and lower ordinary gun effects for the whole cue. Music ducks for at least 650ms. Success and allied cues use ordinary effect limits. All cues obey the effects slider; the hum and score obey the music slider. New sources are bounded by the existing 24 music / 24 ordinary effect / 32 priority effect limits, with no new timers or continuously running ambient nodes.

## Verification

The focused music/Annex audio suite passes **38/38**. Coverage includes actual campaign/Continue/Practice selection; pressure and clearing; emitted charge/lock/cut/reboot events; hostile versus allied Caller cues; deterministic bounded notes; boss-phase continuity; clear transitions; retries, long frame stalls, mute, pause and focus loss; reserved warning voices under saturated gunfire; and source/filter cleanup. TypeScript and the production build pass with the existing Vite large-chunk advisory.

Three actual Web Audio offline renders in the in-app browser each cover 60 seconds at 48kHz, through production `Sound.unlock`, the music scheduler, synthesis, filtering and compressor. The adapter only reports an active device while the offline clock is suspended for scheduling; it does not replace audio nodes or synthesize surrogate samples.

| Render | Peak amplitude | Maximum music voices | Clipped / nonfinite samples | Paused final-second RMS |
| --- | --- | --- | --- | --- |
| Annex score | 0.0815 | 13 | 0 / 0 | 0 |
| Annex with gunfire and cues | 0.1206 | 13 | 0 / 0 | 0 |
| Existing Cooling comparison | 0.0692 | 9 | 0 / 0 | 0 |

The Annex combat music RMS is 0.00702 versus Cooling's 0.00654 in this fixture; the cleared Annex drops to 0.00201. Effect noise varies slightly between renders. These measurements establish headroom, bounded scheduling and silence, not a headphone/speaker listening verdict. No browser warnings or errors appeared during these renders.

The complete regression run passes **1,853/1,853** with no failures or skipped tests (220 seconds). One additional Switchboard cue-integration test was added afterward; it and the other focused audio checks pass **38/38**, with no subsequent runtime edits. In-game browser checks cover startup, live gameplay, pause/resume, retry, death and return to menu. Sound and Music were enabled at 100%; no preferences were changed and the console reported no warnings or errors. These checks do not claim human headphone/speaker listening or the separate whole-update balance sign-off.

The [whole-update balance audit and 3.0.0-rc.1 preparation](dead-signal-balance.md) are complete. Public-host acceptance remains in the [weekend plan](dead-signal-weekend.md).
