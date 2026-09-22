# YouTube launch trailer

Final editorial pass, September 21, 2026, for the stable **2.98.0** browser release. Revision 11 completes the full-trailer review: the play invitation and link are larger, and overlapping blast sounds are balanced to leave room for gunfire and music. The matched opening, sampled footsteps, 38-second edit and music-led ending retain their timing.

- [Finished MP4](Recoil-Foundry-Launch-Trailer.mp4)
- [YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [Title and description to paste](upload-text.txt)
- [Capture record](capture.json)
- [Export verification](quality-review.json)
- [Measured musical accents and closing arrangement](music-beats.json)
- [Combat edit and retiming plan](edit-plan.json)
- [Music source and attribution](music-license.md)

The video is 37.983 seconds, 1920 × 1080 at 60 fps: H.264 High profile, progressive BT.709 picture, AAC-LC stereo audio at 48 kHz, and fast-start MP4 metadata. The thumbnail is a 1920 × 1080 PNG. Include the supplied music credit when uploading. This package does not publish to YouTube.

## Final cut

| Time           | Content                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| 0:00–0:04.8    | Factory footsteps, close-up, gun lifting and a matched camera pullback   |
| 0:04.8–0:09.6  | Recoil movement with a simple build, then scatter fire                   |
| 0:09.6–0:24    | Beam, pinwheel, Turf War, saws and explosive builds                      |
| 0:24–0:28.8    | Loader encounter and dense combat as the music enters its closing phrase |
| 0:28.8–0:33.18 | Shorter cuts follow the closing fill and its final pickup                |
| 0:33.183       | RECOIL lands on the first closing accent                                 |
| 0:33.617       | FOUNDRY lands on the second closing accent                               |
| 0:34.2–0:36.3  | Play invitation and URL over the song's natural ring-out                 |
| 0:36.3–0:38    | Fade with the musical decay, then half a second of black                 |

The cold open is 4.8 seconds. During its final 0.6 seconds, the camera pulls back while the player raises the gun to match the incoming gameplay position, scale and aim. The cut lands on the real first gunshot and music downbeat, without a black gap. A ten-frame lighting adjustment eases into gameplay, and the first caption waits twelve frames before appearing. Quiet factory ambience continues briefly across the cut.

Five concrete footfall samples from Kenney's CC0 Impact Sounds replace the synthetic thumps and ringing tones. Six varied steps follow a shared animation/audio timeline; quiet, short room reflections replace the old long repeats. The feet meet the floor at each plant, then settle before the gun rises. See [Foley sources and preparation](foley/README.md).

The sixteen-shot montage first establishes recoil movement, then builds toward more elaborate weapons, a faction battle and the first boss. Three brief captions carry the pitch: **EVERY SHOT / MOVES YOU.**, **ONE GUN. / YOUR BUILD.**, and **CLOCK OUT / ALIVE.** The health bar and stage counter are omitted from the trailer composition. Shot-specific framing keeps the player readable and gives wider attacks room. Later bosses, story reveals and endings are omitted.

The thumbnail recomposes an actual frame around the player and blast on the right, keeping the wordmark and short hook readable on the left. It uses the established game art and palette.

## The musical ending

Music is **“Resonance” by Scott Buckley**, under CC BY 4.0. At 0:24, the edit skips seven complete 16-beat phrases (112 beats / 67.2 seconds) into the recording's real closing passage. A 25 ms crossfade before the aligned barline joins the excerpts. Closing action markers follow measured accents, including the offbeat final pickup.

The final recorded accents occur at source times 4:18.856 and 4:19.296. Both title lines appear fully on their respective hits, with frame-rounding errors of +3.00 ms and −3.67 ms. A six-frame trace of the last action shot sits behind the first word. Combat effects ease back before the title; the original recording supplies the closing fill and natural ring-out. There is no added title stinger, synthetic riser or artificial echo.

The larger, single-line invitation reads **PLAY FREE IN YOUR BROWSER**, with a brighter 44-pixel URL beneath it. The invitation enters at 0:34.217 and the URL at 0:34.317. The card begins fading at 0:36.283, reaches black at 0:37.483, and ends at 0:37.983. The recording's natural decay accompanies the fade.

[`trailer-ending.ts`](../../scripts/trailer-ending.ts) and [`trailer-mix.ts`](../../scripts/trailer-mix.ts) share timing from [music-beats.json](music-beats.json). Changing title timing requires updating the musical arrangement and combat edit together.

## Capture and sound

[`trailer-intro.ts`](../../scripts/trailer-intro.ts) creates the editorial opening with the game's scenery, outfit and weapon renderer. Its keyframed walk is separate from the simulated combat. The factory ambience and mechanical clicks are original sound design; footfalls use the committed CC0 Kenney samples with deterministic placement and room reflections.

[`youtube-trailer.ts`](../../scripts/youtube-trailer.ts) captures the actual `Game`, `Renderer` and `Sound` classes with legal checkpoint builds and ordinary scripted inputs. Health, collision, recoil, enemy AI and damage remain active. No personal saves are used. This is an offline engine capture, not a human playtest or browser-performance measurement.

The scout rejects blocked firing, extended inactivity, inadequate movement and clips with no damage. [`trailer-edit.ts`](../../scripts/trailer-edit.ts) chooses real combat events and gently retimes them to measured musical accents. Physics retains its fixed timestep. The renderer checks each exact cut and camera framing, and aborts on missing or off-frame planned events.

[`trailer-sound.ts`](../../scripts/trailer-sound.ts) places the game's original cues at retimed events. Weapons and explosions lead; quieter warnings sit behind them and beams have a continuous layer. Transient shaping and saturation control dense combat. When impact sounds overlap within 120 ms, later impacts receive progressively less gain, down to −6 dB; the first impact and weapon sounds retain their full levels. Every cue remains on its original event frame. Every clip passes an effects-level gate. Music uses a small EQ cut, brief ducking beneath effects, measured constant gain and a final peak limiter. No voiceover is used. Game runtime and runtime audio are unchanged.

## Verification

All sixteen clips pass their quality gates, with no blocked firing. All 45 planned combat accents match their assigned frames. The two title reveals match the recorded closing accents within 3.67 ms; waveform comparison of the encoded export finds zero additional offset around either reveal (correlations 0.9996 and 0.9892).

All 2,279 frames and the full audio stream decode without errors. Final AAC measures −14.09 LUFS integrated and −1.88 dBTP. No unintended black or silent gaps occur through the montage or title transition. The natural music decay falls below −60 dB during the final picture fade. MP4 fast-start metadata and stream formats are checked.

The capture-driver regressions pass. Ending and sound modules pass strict TypeScript checking; the unchanged intro and Foley modules retain their prior checks. All sixteen six-frame gameplay sequences, the opening and ending transitions, and six small-screen stills from the encoded master were visually reviewed. The mono compatibility check found a worst two-second level change of -1.17 dB versus stereo energy. The last intro frame aligns to the incoming player within 0.28 pixels, with a 0.0082 scale difference. All six foot plants match their sound onsets within 6.67 ms of the nearest video frame. Measurements describe the exported file, not physical-speaker listening or a completed YouTube upload.

## Rebuild

Use Node.js 24 and the project's installed dependencies. Optional capture dependencies are not shipped in the browser game:

```powershell
npm install --prefix .media-tools/audio --no-audit --no-fund --ignore-scripts web-audio-engine@0.13.4
npm install --prefix .media-tools/canvas --no-audit --no-fund @napi-rs/canvas@0.1.100
$env:MEDIA_MODULE_ROOT = (Join-Path (Get-Location) '.media-tools/canvas/node_modules')
$env:MEDIA_FONT_DIR = 'C:/Windows/Fonts'
$env:FFMPEG = 'C:/path/to/ffmpeg.exe'
New-Item -ItemType Directory -Force .media-tools/music
Invoke-WebRequest 'https://www.scottbuckley.com.au/library/wp-content/uploads/2018/04/sb_resonance.mp3' -OutFile .media-tools/music/resonance.mp3
node --experimental-strip-types scripts/youtube-trailer.ts
```

Use FFmpeg with libx264 and AAC support; this export uses FFmpeg 7.1 from `imageio-ffmpeg==0.6.0`. Arial, Arial Bold, and Consolas are rasterized from Windows fonts without redistributing font files. `MEDIA_MODULE_ROOT` can point to an existing directory containing `@napi-rs/canvas`.

The default output is `../recoil-foundry-trailer`; override with `TRAILER_OUT`. `TRAILER_MUSIC` selects a local copy of the licensed song. Output includes contact sheets, a dedicated transition sheet, sequence sheets, shot and sync reviews, capture manifest, effects stem, sound-cue and mix audits, silent master, and review frames.

`--intro-only` previews the opening. `--thumbnail-only` rebuilds the thumbnail from its cached gameplay still. `--survey` regenerates encounter candidates; `--survey-name=recoil` updates only one build; `--edit-survey` rebuilds the edit from candidates and the committed musical markers. `--storyboard` validates and previews without encoding. `--mix-only` remixes existing picture and effects. `TRAILER_TAKES` overrides the candidate JSON path. Engine or dependency changes can change captures.

After a rebuild, inspect the transition, sequence, ending, and thumbnail images; decode the full MP4 and check final audio. Capture-driver regressions: `node --experimental-strip-types --test tests/trailer-scenes.test.ts`.
