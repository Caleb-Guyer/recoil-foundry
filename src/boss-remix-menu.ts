import {
  BOSS_REMIXES,
  loadBossRemixes,
  remixEncounter,
  type BossRemixId,
} from './boss-remix-rules.ts';
import { PRACTICE_BOSSES, type Encounter } from './practice.ts';
import { archiveMark } from './archive-art.ts';
import { drawArchiveImages } from './archive-images.ts';
import type { MenuBack } from './blueprint-menu.ts';

export function remixMenuHtml(raw: unknown) {
  return (
    '<p class="eyebrow">PRACTICE · DISCOVERED ARENAS</p><h2 id="dialog-title">Boss remixes.</h2><p class="practice-note">Learn the machinery and attack sequence. Full health and preset fittings; your Campaign Continue stays available.</p><div class="gauntlet-grid">' +
    loadBossRemixes(raw)
      .seen.map(
        (id) =>
          '<button class="gauntlet-choice" data-boss-remix="' +
          id +
          '">' +
          archiveMark('remix:' + id) +
          '<strong>' +
          PRACTICE_BOSSES[BOSS_REMIXES[id].boss].name +
          ' · ' +
          BOSS_REMIXES[id].name +
          '</strong><span>' +
          BOSS_REMIXES[id].hint +
          '</span></button>',
      )
      .join('') +
    '</div><div class="actions"><button id="remix-back" class="quiet">Back</button></div>'
  );
}
export function bossRemixMenu(
  root: HTMLElement,
  raw: unknown,
  start: (encounter: Encounter) => void,
  back: () => void,
): MenuBack {
  root.innerHTML = remixMenuHtml(raw);
  drawArchiveImages(root);
  const seen = loadBossRemixes(raw).seen;
  root.querySelectorAll<HTMLButtonElement>('[data-boss-remix]').forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.bossRemix as BossRemixId;
      if (seen.includes(id)) start(remixEncounter(id));
    };
  });
  root.querySelector<HTMLButtonElement>('#remix-back')!.onclick = back;
  return {
    back() {
      back();
      return true;
    },
  };
}
