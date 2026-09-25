import { GAME_VERSION } from './version.ts';

export function creditsMarkup() {
  return `<p class="eyebrow">RECOIL FOUNDRY · ${GAME_VERSION}</p>
    <h2 id="dialog-title">Off the clock.</h2>
    <div class="credits-copy">
      <p>A game by <strong>Caleb Guyer</strong>.</p>
      <p>One gun, a factory full of bad ideas, and the people who kept asking for one more run. Thanks for playing.</p>
      <dl><dt>Music & sound</dt><dd>Original procedural score and synthesized effects, made for Recoil Foundry. Regional themes change with the fight.</dd>
      <dt>Built with</dt><dd>Matter.js by Liam Brummitt and contributors. TypeScript and Vite.</dd></dl>
    </div>
    <div class="actions"><button id="back" class="primary">Back</button>
      <a class="quiet" href="https://github.com/Caleb-Guyer/recoil-foundry" target="_blank" rel="noopener noreferrer">Source</a>
      <a class="quiet" href="./third-party-notices.txt" target="_blank" rel="noopener noreferrer">Licenses</a></div>`;
}
