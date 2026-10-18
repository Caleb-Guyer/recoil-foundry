# Recoil Foundry — official gameplay trailer

Current-game trailer prepared October 18, 2026. This is a new edit and capture for **5.6.0**; the earlier 2.98.0 trailer is preserved in `docs/trailer/`.

- [Upload-ready video](Recoil-Foundry-Official-Trailer.mp4)
- [4K YouTube thumbnail](Recoil-Foundry-YouTube-Thumbnail.png)
- [All upload fields and settings](Upload-Details.md)
- [Title](Title.txt) · [Description with music credit](Description.txt) · [Tags](Tags.txt)
- [English captions](Captions.en.srt) · [Optional pinned comment](Pinned-Comment.txt)
- [Music license and source hash](Music-License.txt)
- [Capture manifest](capture.json) · [Encoded export measurements](quality-review.json)

The revised local delivery folder is **YouTube Trailer 5.6.0 Revised** in the task's outer workspace. It contains the MP4, thumbnail, upload copy, captions and license record. A separate ZIP contains only the delivery files. The earlier local kit remains available. No YouTube upload or external announcement has been performed.

## The edit

**52.383 seconds, 1920 × 1080 at 60 fps.** This revised edit opens in recoil combat, develops the weapon combinations, then gives five bosses a dedicated sequence. Nineteen moving shots show the pistol, shotgun, nailgun, Twinbore, Coil carbine and Pressure repeater, with beams, rotating fire, saws, explosive rounds and a Turf War. **The Loader, Press, Condenser, Sorter and Interceptor** cover all five factory zones. Their actual attacks, impacts and recovery openings remain visible, with camera framing that includes the player and machine. Boss names identify each fight. The three short captions are EVERY SHOT MOVES YOU, ONE GUN YOUR BUILD, and MEET MANAGEMENT. The closing wordmark lands on the recording's actual final accents, followed by the play invitation and URL.

Music is **Resonance by Scott Buckley**, a recorded industrial electronica track released under CC BY 4.0. The composer explicitly permits commercial projects with attribution. An extra 16-beat phrase compared with the first 5.6.0 edit leaves room for full boss exchanges; two excerpts join at a barline and keep the recording's natural conclusion. Keep the credit in Description.txt when uploading. Source and license links are in Music-License.txt.

The new thumbnail is a character poster: the actual **Night Shift player outfit and Magnum weapon art**, a raised gun, hard amber factory backlighting, a long cast shadow and restrained typography. It uses the same native drawing functions as the game. It is a 3840 × 2160 PNG, with no AI image generation, screenshot background, HUD or promotional tagline.

## Capture and verification

The current `Game`, `Renderer` and `Sound` classes supply picture and effects. Captures use isolated legal checkpoint builds and ordinary scripted controls; health, enemy AI, damage and collision remain active. No personal save is read, no equipment is awarded, and no attacks are fabricated. This is edited engine footage rather than a browser performance measurement or human playtest.

All nineteen shots pass the movement, visibility, damage and unobstructed-firing gates. Each boss shot also requires the player to remain in frame for at least 95% of the shot and the boss to change combat states. All **75** selected combat accents match their assigned video frames. All **3,143** exported frames and the full audio stream decode. Exact final audio levels, format details and file hash are in quality-review.json. No black gaps, sustained freezes or silence occur during the action. Detected stillness and silence belong to the intentional closing card and fade. Fast-start metadata precedes the media payload.

Encoded review sheets sample six frames per shot, with separate hook, end-card and thumbnail reviews. Five capture-driver regressions include live boss AI, actual weapon damage, unchanged boss health and isolation from player progression. Strict TypeScript checks for the capture/package scripts and the production build pass. These checks do not replace physical speaker listening or YouTube's upload processing.

## Rebuild

Use Node 24, Python with NumPy, the project dependencies, and the optional free capture tools. The default Windows renderer uses the locally installed Arial and Consolas fonts; it does not redistribute them.

```powershell
npm install --prefix .media-tools/canvas --no-audit --no-fund @napi-rs/canvas@0.1.100
npm install --prefix .media-tools/audio --no-audit --no-fund --ignore-scripts web-audio-engine@0.13.4
python -m pip install --target .media-tools/python imageio-ffmpeg==0.6.0 numpy
$env:PYTHONPATH = Join-Path (Get-Location) '.media-tools/python'
New-Item -ItemType Directory -Force .media-tools/music
Invoke-WebRequest 'https://www.scottbuckley.com.au/library/wp-content/uploads/2018/04/sb_resonance.mp3' -OutFile .media-tools/music/resonance.mp3
python scripts/action-trailer-beats.py
node --experimental-strip-types scripts/action-trailer.ts --survey
node --experimental-strip-types scripts/action-trailer.ts --plan
node --experimental-strip-types scripts/action-trailer.ts --storyboard
node --experimental-strip-types scripts/action-trailer.ts
node --experimental-strip-types scripts/action-trailer-package.ts
python scripts/action-trailer-review.py
```

The source recording's SHA-256 is checked before rendering. `TRAILER_OUT`, `TRAILER_MUSIC`, `FFMPEG` and `MEDIA_FONT_DIR` override local paths. The default output is `../../YouTube Trailer 5.6.0 Revised` relative to this checkout. `--survey --name=shotgun` regenerates one family. `--mix-only` rebuilds sound and the final MP4 from an existing rendered picture and its capture audits. New captures can require new edit planning if the game engine changes.

The original recording and optional tool installations are excluded from Git. Review frames, intermediate picture and effects stems stay in the local delivery folder's `production/` directory. The upload video does not require any of those tools to play.
