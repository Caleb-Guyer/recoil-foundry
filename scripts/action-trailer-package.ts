import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MODS } from '../src/rules.ts';
import { STARTING_GUN_IDS } from '../src/starting-guns.ts';

const out = resolve(process.env.TRAILER_OUT ?? '../../YouTube Trailer 5.6.0 Revised');
const metadata = resolve('docs/trailer-5.6.0');
mkdirSync(out, { recursive: true });
mkdirSync(metadata, { recursive: true });
const capture = JSON.parse(readFileSync(resolve(out, 'Capture-Manifest.json'), 'utf8'));
if (MODS.length !== 141 || STARTING_GUN_IDS.length !== 6)
  throw new Error('Update promotional equipment counts');
const title = 'Recoil Foundry — Official Gameplay Trailer | Play Free';
const description = `Play free in your browser: https://caleb-guyer.github.io/recoil-foundry/

Your gun is your way out.

Shoot down. Go up. Turn recoil into movement in Recoil Foundry, a physics roguelike set inside a hostile factory.

Build one gun each run. Combine 141 upgrades, earn six starting weapons, and fight through 20 rooms across five factory zones. Discover changing encounters, branching jobs, optional hunts, and new ways for your upgrades to work together.

Keep coming back for Daily Runs, Overtime, Security levels, and the five-fight Boss Gauntlet — including Remix routes built from the arenas you discover.

See five bosses in action, from the Loader's charge to the Interceptor's aerial firefight.

Free to play. Available now on desktop in your web browser.

A game by Caleb Guyer.
Trailer captured from Recoil Foundry ${capture.version} using the actual game engine, active combat, and scripted controls. Gameplay is edited to the music; no invulnerability or fabricated attacks.

MUSIC
'Resonance' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au
Track: https://www.scottbuckley.com.au/library/resonance/
License: https://creativecommons.org/licenses/by/4.0/
Changes: two excerpts joined on a musical phrase with a short crossfade, equalization, level adjustment, and ducking beneath game sound effects. The recording's original closing accents and natural decay are retained.

#RecoilFoundry #Roguelike #IndieGame
`;
const tags =
  'Recoil Foundry, RecoilFoundry, Recoil Foundry trailer, Recoil Foundry gameplay, physics roguelike, recoil movement, roguelike shooter, indie game, free browser game, browser roguelike, weapon upgrades, indie game trailer, action roguelike';
const pinned = `Play Recoil Foundry free: https://caleb-guyer.github.io/recoil-foundry/

Shoot down to launch yourself up. What is the wildest upgrade combination you have found?`;
const credit = `MUSIC LICENSE — checked October 18, 2026

Resonance — Scott Buckley
Composer and source: https://www.scottbuckley.com.au/library/resonance/
Usage instructions: https://www.scottbuckley.com.au/library/using-this-music/
License: Creative Commons Attribution 4.0 International
https://creativecommons.org/licenses/by/4.0/

The composer expressly permits commercial projects with attribution. Keep the full music credit, track link, license link and edit disclosure from Description.txt in the YouTube description.

This export uses an excerpt from 2:43.276 to 3:21.676, then the original closing passage from 4:09.676 to 4:23.200. A 25 ms phrase-aligned crossfade joins the two excerpts. The mix includes EQ, gain adjustment and brief ducking under game sound effects. The original recorded ending is preserved. No other song is used, and no generative music is used.

Source recording SHA-256:
${capture.music.sha256}

The source recording was downloaded directly from:
https://www.scottbuckley.com.au/library/wp-content/uploads/2018/04/sb_resonance.mp3

Game footage, sound effects and game artwork: Recoil Foundry, Caleb Guyer.
The video uses the current game's own renderer and Sound class. No third-party gameplay footage or AI-generated thumbnail art is used. Fonts are rasterized from the local licensed Windows installation; no font files are redistributed.

The recording retains its CC BY 4.0 license. The game's software license does not replace the music license. This use does not imply endorsement by Scott Buckley. Do not register the licensed music in a Content ID fingerprinting service. If a music claim occurs, retain this record and use the composer's claims process linked from his website; this document is not a promise that automated claims cannot occur.
`;
const settings = `# YouTube upload details

Ready-to-upload files are in this folder. This package has not been uploaded or published to YouTube.

| Field | Recommended value |
| --- | --- |
| Video | Recoil-Foundry-Official-Trailer.mp4 |
| Title | ${title} |
| Description | Paste the complete contents of Description.txt, including the music credit. |
| Thumbnail | Recoil-Foundry-YouTube-Thumbnail.png |
| Audience | No, it is not made for kids. This trailer is intended for a general gaming audience. |
| Age restriction | No, based on this trailer's stylized, non-graphic robot combat. |
| Category | Gaming |
| Game title | Select Recoil Foundry if YouTube offers the exact game; otherwise leave this field empty. |
| Language | English; the video has on-screen English text and no spoken dialogue. |
| Captions | Upload Captions.en.srt as English with timing. |
| Caption certification | This content has never aired on television in the U.S. |
| Paid promotion | No third-party sponsor, placement or paid endorsement is included. Promoting your own game is not a third-party sponsorship. |
| Altered/synthetic content | No realistic synthetic content: this is stylized in-engine gameplay, ordinary editing and licensed recorded music. |
| Tags | Paste Tags.txt. Tags are optional; the title, thumbnail and description do the main work. |
| Video license | Standard YouTube License; the music retains its separately credited CC BY license. |
| Embedding | Allow |
| Comments | On, with the moderation level you normally use. |
| Show likes | On |
| Automatic chapters | Off; this is one continuous trailer. |
| Cards | None; keep the action unobstructed. |
| End screen | Leave off to preserve the closing title and play URL. |
| Shorts remixing | Don't allow remixing for this upload, to keep the trailer and its music attribution together. |
| Recording date/location | Optional; no physical filming location is needed for engine footage. |
| Playlist | Your Recoil Foundry playlist, if you have one. |
| Monetization | Optional if your channel is eligible; the music license permits commercial use with credit. |
| Visibility | Upload as Unlisted, inspect the finished 1080p60 playback and Checks result, then switch to Public when ready. |
| Premiere | Off for a normal trailer release. |
| Subscriber notifications | On when publishing publicly, if you want subscribers notified. |

## Copy to paste

- Title.txt: recommended title.
- Description.txt: complete description, play links, hashtags and required music attribution.
- Tags.txt: concise, relevant search tags.
- Pinned-Comment.txt: optional play link and a question for viewers. Pin only after publishing.
- Captions.en.srt: optional English captions for sound cues and on-screen text.

## Export

- Duration: ${capture.seconds.toFixed(3)} seconds; ${capture.frames} frames.
- Picture: 1920 × 1080, 60 fps, progressive H.264 High, YUV 4:2:0, BT.709, fast-start MP4.
- Audio: AAC-LC stereo, 48 kHz, 384 kb/s. Measured loudness and peak values are in Quality-Report.json.
- Thumbnail: 3840 × 2160 PNG, 16:9. An original character poster using the game's actual Night Shift outfit and Magnum weapon drawing functions, with native factory geometry and typography.
- Music: Resonance by Scott Buckley, free commercial use under CC BY 4.0 with the supplied credit.

## Upload order

1. In YouTube Studio choose Create → Upload videos, and select the MP4.
2. Paste Title.txt and Description.txt; upload the thumbnail.
3. Apply the settings above and add the optional English captions.
4. Wait for Checks and HD processing. Review the action and ending at 1080p60 on a desktop and at a small viewing size.
5. Make the video Public when you are ready. Add the optional pinned comment and share its watch URL.

There is no music purchase, subscription, or paid tool required for these files. Keep the credit in the published description. No upload, external post, or YouTube account change was performed by this package generator.

## References checked October 18, 2026

- Upload fields and Checks: https://support.google.com/youtube/answer/57407
- Encoding recommendations: https://support.google.com/youtube/answer/1722171
- Thumbnail requirements: https://support.google.com/youtube/answer/72431
- Tags: https://support.google.com/youtube/answer/146402
- Composer's license: https://www.scottbuckley.com.au/library/resonance/
- Attribution license: https://creativecommons.org/licenses/by/4.0/
`;
const stamp = (seconds: number) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const shots = capture.shots;
const titleAt = capture.music.closing.subtitleFrame / 60;
const fadeAt = (capture.music.closing.titleFrame + 186) / 60;
const cues: [number, number, string][] = [
  [0, shots[0].seconds - 0.05, '[Driving electronic music and gunfire]\nEVERY SHOT MOVES YOU.'],
  [
    shots[1].timelineStart,
    shots[3].timelineStart - 0.05,
    '[Shotgun blasts, rapid gunfire and ricochets]',
  ],
  [
    shots[3].timelineStart,
    shots[3].timelineStart + shots[3].seconds - 0.05,
    'ONE GUN. YOUR BUILD.',
  ],
  [
    shots[4].timelineStart,
    shots[12].timelineStart - 0.05,
    '[Beams, saws, explosions and gunfire over music]',
  ],
  [
    shots[12].timelineStart,
    shots[12].timelineStart + shots[12].seconds - 0.05,
    'MEET MANAGEMENT.\nThe Loader\n[Engine charge and crash]',
  ],
  [
    shots[13].timelineStart,
    shots[14].timelineStart - 0.05,
    'The Press\n[Heavy machine slams and gunfire]',
  ],
  [
    shots[14].timelineStart,
    shots[15].timelineStart - 0.05,
    'The Condenser\n[Energy volleys and gunfire]',
  ],
  [
    shots[15].timelineStart,
    shots[16].timelineStart - 0.05,
    'The Sorter\n[Falling cargo and machine impacts]',
  ],
  [
    shots[16].timelineStart,
    shots[17].timelineStart - 0.05,
    'The Interceptor\n[Rapid gunfire and impacts]',
  ],
  [shots[17].timelineStart, titleAt - 0.05, '[Gunfire and explosions build with the music]'],
  [
    titleAt,
    fadeAt - 0.05,
    'RECOIL FOUNDRY\nPLAY FREE IN YOUR BROWSER\ncaleb-guyer.github.io/recoil-foundry',
  ],
  [fadeAt, capture.seconds - 0.5, '[Music fades]'],
];
const captions = cues
  .map(([a, b, text], i) => `${i + 1}\n${stamp(a)} --> ${stamp(b)}\n${text}\n`)
  .join('\n');
const files: Record<string, string> = {
  'Title.txt': title + '\n',
  'Description.txt': description,
  'Tags.txt': tags + '\n',
  'Pinned-Comment.txt': pinned + '\n',
  'Music-License.txt': credit,
  'Upload-Details.md': settings,
  'Captions.en.srt': captions,
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(resolve(out, name), content, 'utf8');
  writeFileSync(resolve(metadata, name), content, 'utf8');
}
copyFileSync(
  resolve(out, 'Recoil-Foundry-YouTube-Thumbnail.png'),
  resolve(metadata, 'Recoil-Foundry-YouTube-Thumbnail.png'),
);
copyFileSync(
  resolve(out, 'Recoil-Foundry-Official-Trailer.mp4'),
  resolve(metadata, 'Recoil-Foundry-Official-Trailer.mp4'),
);
if (title.length > 100 || description.length > 5000 || tags.length > 500)
  throw new Error('YouTube text limits exceeded');
console.log(
  JSON.stringify({
    out,
    titleCharacters: title.length,
    descriptionCharacters: description.length,
    tagsCharacters: tags.length,
    files: Object.keys(files),
  }),
);
