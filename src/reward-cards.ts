import { MODS } from './rules.ts';
import { modMark } from './upgrade-icons.ts';

import { REWARD_CATALOG } from './run-rewards.ts';
import { escapeLogbook } from './html.ts';
import { archiveMark } from './archive-art.ts';

export function rewardImage(id: string, name: string) {
  return (
    '<canvas class="reward-image" width="640" height="320" role="img" aria-label="' +
    escapeLogbook(name) +
    '" data-reward-image="' +
    escapeLogbook(id) +
    '"></canvas>'
  );
}
export function rewardCards(ids: readonly string[]) {
  const rewards = REWARD_CATALOG.filter((r) => ids.includes(r.id));
  if (!rewards.length) return '';
  const cards = (items: typeof rewards) =>
    items
      .map(
        (r) =>
          '<article class="reward-card">' +
          (r.image.startsWith('uprising:')
            ? archiveMark(
                r.id === 'uprising:rail-license'
                  ? 'region:railworks'
                  : r.id === 'uprising:core-license'
                    ? 'region:core'
                    : 'area:rooftops',
              )
            : r.image.startsWith('mod:')
              ? modMark(MODS.find((m) => m.id === r.id.slice(4))!)
              : rewardImage(r.image, r.name)) +
          '<small>' +
          r.label +
          '</small><strong>' +
          r.name +
          '</strong><p>' +
          escapeLogbook(r.detail) +
          '</p></article>',
      )
      .join('');
  return (
    '<section class="run-rewards" aria-label="Rewards earned this run"><h3>Earned this run' +
    (rewards.length > 6 ? ' · ' + rewards.length : '') +
    '</h3><div class="reward-cards">' +
    cards(rewards.slice(0, 6)) +
    '</div>' +
    (rewards.length > 6
      ? '<details class="reward-overflow"><summary>Show ' +
        (rewards.length - 6) +
        ' more rewards</summary><div class="reward-cards">' +
        cards(rewards.slice(6)) +
        '</div></details>'
      : '') +
    '<button id="earned-rewards" class="quiet">View rewards in Logbook ↗</button></section>'
  );
}

export { drawRewardImages } from './menu-images.ts';
