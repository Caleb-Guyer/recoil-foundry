# Upgrade inspection validation — 4.5.0

Fourteen focused checks cover all 113 catalog entries with every starting gun; native shotgun pellet and nailgun burst comparisons; conversion and conditional-damage presentation; owned combination hints; removal of the old Reforge fitting; capped repairs; actual projectile payloads and recoil; real beam, lance, stasis, shell, rail, steel-ball and portal simulations; cleanup; protection of the real pending reward and random stream; and valid isolated UI checkpoints.

The simulations use separate real Game instances and ordinary fixed-step inputs. Targets are the existing non-attacking Workshop targets, with matching health in both ranges. Previews do not change the active Campaign or use profile callbacks. Situational mechanics remain subject to their real trigger and geometry; these demonstrations do not measure player win rates or ideal damage.

The full regular suite passed all **2,399 tests**, with no failures or skips. The final camera, Reforge layout and contextual-copy adjustments then passed all fourteen focused checks and a fresh TypeScript/Vite production build.

Browser checks used the actual development and production UI: pistol choices, the shotgun's nine-pellet Scattershot and Capacitor hint, native nailgun beam choices, and Reforge exchanges. Pointer inspection and keyboard focus changed the comparison without accepting a card. Reroll replaced the offers, cleared the previous comparison and kept focus on the heading; a numbered choice resumed the isolated run. Reduced-effects screenshots remained byte-identical over time. Desktop and narrow layouts had no horizontal overflow; resizing redrew the still image. Browser error logs were empty, and temporary preferences and viewport overrides were restored.

Reproduce focused checks with `node --experimental-strip-types --test tests/upgrade-preview.test.ts`, the production bundle with `npm run build`, and the full regular suite with `npm run test:ci`. The existing eight maximal-build groups remain part of Pages deployment.
