# Upgrade continuity validation — 4.12.0

The full local regular suite passed **2,628 tests**, followed by **47 focused checks** after the final fragment clearance fix. TypeScript and the Vite production build passed. GitHub runs the regular suite and all eight groups of the 9,216 maximal-build simulations before deployment.

## Real firing behavior

- Five Scattershot rays and ten Prism rays each hit separate physical targets. Their aggregate damage matches the existing spread budget and Prism's declared 60% per split ray.
- Damage remains equal at 30, 60 and 120 Hz for continuous, Prism, charged and Pulse Chamber spreads. Recoil forecast and real emitted impulses remain equal through charge, hold, release and recovery.
- Charge Lens spends one stored cell and one Landing shot bonus for the whole five-lance discharge. Front and rear rays retain unique identities and do not cancel the forward kick.
- Splinter produces three fragments per ray once per pulse, preserves total fragment energy, and starts outside the hit surface so outward fragments actually travel. Secondary rounds retain their existing cap and cannot recursively splinter.
- Every ray respects real rotated cover, muzzle obstructions, banks and penetration limits. Rays hitting the same prop sum their contact energy before destruction; nothing behind it takes damage in the same step.
- Resonator groups all portal-crossing rays into the same delayed discharge, retains frozen exits and remaining budgets, and retraces current cover. Echoes do not grant extra recoil or charges.
- Pistol, shotgun and nailgun retain their native patterns in either acquisition order. Existing build, checkpoint, Workshop and replay validation stays intact.
- Daily ruleset 87 gives the changed mechanics a new challenge identity. Every supported older Daily keeps its wide-beam pattern and damage, including Prism, charged lances and Pulse Chamber. Contextual descriptions and the real comparison renderer use the archived rules; old links, saves and best-time keys remain supported.

## Playable presets and presentation

All seven new presets clear the real test room in both orientations with ordinary health, aiming and movement. Links are deterministic, repeatable and isolated; all three starting guns validate without unlocking them. Mixed modes, unknown builds and repeated parameters are rejected.

Native browser review of the actual Game traces and Renderer verified five rays, ten Prism rays, five charged lances, ten forward plus ten rear rays, live fragment flight, and independent wall banks. Both normal and reduced effects keep the fans thin and distinct. The title screen names the selected preset and explains its controls. Upgrade descriptions and comparisons show the actual combined beam count.
