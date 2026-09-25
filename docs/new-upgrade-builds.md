# New upgrade builds

Implemented in **3.0.0-development** · Daily ruleset **79**.

Development preview on `feature/dead-signal`; local links require `npm run dev -- --port 4186 --strictPort`. Stable public releases are unchanged.

Cryogenic and Stasis join Precision, Bullet Hell and Demolition. Each run chooses one main path, with local alternatives within it. Cryogenic forks into Deep Freeze → Icebreaker or Cold Snap → Cold Front. Stasis forks into Crosshatch → Thread the Needle or Tripline → Chain Release. Retrace, Wallrunner and Air Brake are shared follow-ups. Grapnel branches away from Snapback, and Convoy branches away from Thread the Needle. Corner Pocket follows Banker; Scrap Feed follows Splinter. Thermal Shock fuses Coolant Rounds with Cinder in the one fusion slot. All follow-ups require their parents. The twelve earlier local specializations retain their stage-7 gate, and fusions retain their parent and rarity rules. Daily still gives one predetermined legal card.

Subversion is a shared support family: Spoof → Standing Orders → Priority Target, or Spoof → Cross Talk → Dead Switch. Its two branches exclude each other and coexist with every main weapon path. New Daily 79 uses the expanded pool; supported Daily 78 retains its original pool, links, saves and records.

For **every upgrade in every new max combo**, use the [2048-build catalog](max-upgrade-combos.md) or [CSV](max-upgrade-combos.csv).

## Quick tests

These start in a real room with 100 health and a ten-upgrade gun. Each link opens a title-screen test button. R restarts the preset. Boss variants have 19 picks; “max” variants exhaust the legal pool. They preserve ordinary saves, discoveries, Daily records and boss unlocks.

| Build | Normal room | Mirrored room | Final boss | Fully maxed |
| --- | --- | --- | --- | --- |
| Priority Target | [Play](http://127.0.0.1:4186/?test=branches&build=priority&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=priority&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=priority&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=priority&max=1&v=3.0.0-development) |
| Dead Switch | [Play](http://127.0.0.1:4186/?test=branches&build=dead-switch&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=dead-switch&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=dead-switch&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=dead-switch&max=1&v=3.0.0-development) |
| Grapnel | [Play](http://127.0.0.1:4186/?test=branches&build=grapnel&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=grapnel&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=grapnel&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=grapnel&max=1&v=3.0.0-development) |
| Convoy | [Play](http://127.0.0.1:4186/?test=branches&build=convoy&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=convoy&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=convoy&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=convoy&max=1&v=3.0.0-development) |
| Thermal Shock | [Play](http://127.0.0.1:4186/?test=branches&build=thermal&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=thermal&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=thermal&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=thermal&max=1&v=3.0.0-development) |
| Corner Pocket | [Play](http://127.0.0.1:4186/?test=branches&build=pocket&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pocket&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pocket&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pocket&max=1&v=3.0.0-development) |
| Scrap Feed | [Play](http://127.0.0.1:4186/?test=branches&build=scrap&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=scrap&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=scrap&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=scrap&max=1&v=3.0.0-development) |
| Icebreaker | [Play](http://127.0.0.1:4186/?test=branches&build=icebreaker&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=icebreaker&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=icebreaker&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=icebreaker&max=1&v=3.0.0-development) |
| Cold Front | [Play](http://127.0.0.1:4186/?test=branches&build=coldfront&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=coldfront&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=coldfront&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=coldfront&max=1&v=3.0.0-development) |
| Thread the Needle | [Play](http://127.0.0.1:4186/?test=branches&build=crosshatch&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosshatch&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosshatch&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosshatch&max=1&v=3.0.0-development) |
| Chain Release | [Play](http://127.0.0.1:4186/?test=branches&build=tripline&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=tripline&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=tripline&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=tripline&max=1&v=3.0.0-development) |
| Retrace | [Play](http://127.0.0.1:4186/?test=branches&build=retrace&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=retrace&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=retrace&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=retrace&max=1&v=3.0.0-development) |
| Wallrunner | [Play](http://127.0.0.1:4186/?test=branches&build=wallrunner&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=wallrunner&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=wallrunner&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=wallrunner&max=1&v=3.0.0-development) |
| Air Brake | [Play](http://127.0.0.1:4186/?test=branches&build=airbrake&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=airbrake&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=airbrake&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=airbrake&max=1&v=3.0.0-development) |
| Resonator | [Play](http://127.0.0.1:4186/?test=branches&build=resonator&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=resonator&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=resonator&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=resonator&max=1&v=3.0.0-development) |
| Flywheel | [Play](http://127.0.0.1:4186/?test=branches&build=flywheel&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=flywheel&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=flywheel&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=flywheel&max=1&v=3.0.0-development) |
| Storm Cell | [Play](http://127.0.0.1:4186/?test=branches&build=storm&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=storm&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=storm&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=storm&max=1&v=3.0.0-development) |
| Pulse Chamber | [Play](http://127.0.0.1:4186/?test=branches&build=pulse&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pulse&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pulse&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pulse&max=1&v=3.0.0-development) |
| Charge Lens | [Play](http://127.0.0.1:4186/?test=branches&build=charge&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=charge&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=charge&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=charge&max=1&v=3.0.0-development) |
| Prism Array | [Play](http://127.0.0.1:4186/?test=branches&build=prism&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=prism&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=prism&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=prism&max=1&v=3.0.0-development) |
| Pinwheel | [Play](http://127.0.0.1:4186/?test=branches&build=pinwheel&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pinwheel&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pinwheel&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=pinwheel&max=1&v=3.0.0-development) |
| Follow-through | [Play](http://127.0.0.1:4186/?test=branches&build=follow&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=follow&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=follow&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=follow&max=1&v=3.0.0-development) |
| Shaped Charge | [Play](http://127.0.0.1:4186/?test=branches&build=shaped&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=shaped&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=shaped&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=shaped&max=1&v=3.0.0-development) |
| Cluster Shell | [Play](http://127.0.0.1:4186/?test=branches&build=cluster&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=cluster&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=cluster&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=cluster&max=1&v=3.0.0-development) |
| Skid Plate | [Play](http://127.0.0.1:4186/?test=branches&build=skid&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=skid&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=skid&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=skid&max=1&v=3.0.0-development) |
| Relay Gate | [Play](http://127.0.0.1:4186/?test=branches&build=relay&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=relay&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=relay&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=relay&max=1&v=3.0.0-development) |
| Short Circuit | [Play](http://127.0.0.1:4186/?test=branches&build=short&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=short&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=short&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=short&max=1&v=3.0.0-development) |
| Triphammer | [Play](http://127.0.0.1:4186/?test=branches&build=triphammer&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=triphammer&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=triphammer&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=triphammer&max=1&v=3.0.0-development) |
| Crosscut | [Play](http://127.0.0.1:4186/?test=branches&build=crosscut&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosscut&mirror=1&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosscut&room=boss&v=3.0.0-development) | [Play](http://127.0.0.1:4186/?test=branches&build=crosscut&max=1&v=3.0.0-development) |

## What to fit

### Priority Target

Spoof reboots an eligible patrol unit. Standing Orders extends it to 7.5 seconds with 115% normal health. Shoot a target to mark it for three seconds: your ally prefers it when visible and deals 40% more damage. Resistant machines take stronger feedback, including a 25% marked-target bonus. One ally, eight-second recharge, four conversions per room.

**Parents:** Standing Orders.

**Complete room build:** Spoof → Standing Orders → Priority Target → Heavy hitter → Hair trigger → Light frame → Kickback → Bloodwork → Airshot → Punch through.

**Card:** Gun hits mark one target for 3s. Your ally focuses it when exposed and hits 40% harder. Marked feedback gains 25% damage.

### Dead Switch

Cross Talk permits two allies with 45% normal health, 70% output and 3.5-second lifetimes, at most six conversions per room with a 2.5-second recharge. Natural expiry releases a covered, enemy-only overload. Resistant machines take two feedback pulses; Dead Switch adds a bounded overload on the second. Damage death and room cleanup do not detonate allies.

**Parents:** Cross Talk.

**Complete room build:** Spoof → Cross Talk → Dead Switch → Heavy hitter → Hair trigger → Light frame → Kickback → Bloodwork → Airshot → Punch through.

**Card:** Expiring allies overload nearby enemies. The second feedback pulse adds an overload, including against a lone boss.

### Grapnel

Requires Tether rounds; replaces enemy links and locks Snapback. Your first eligible airborne surface hit within 560 units anchors a cable for 2.8 seconds. Recoil supplies tangential momentum; jump detaches. Landing rearms it. Cover, destroyed hosts and teleportation break the cable; it never constrains moving machinery.

**Parents:** Tether rounds.

**Complete room build:** Tether rounds → Grapnel → Kickback → Light frame → Airshot → Redline → Bloodwork → Punch through → Heavy hitter → Hair trigger.

**Card:** Your first airborne wall hit anchors a swing cable instead of linking enemies. Jump to detach. One anchor per airtime.

### Convoy

Requires Suspension and Crosshatch; alternative to Thread the Needle. Hold to store 15 rounds that follow your actual movement trail, then release to converge on your aim from their current positions. Cover can consume the formation; player teleportation clears it. Stored movement is inert. Old and excess rounds still auto-launch.

**Parents:** Crosshatch.

**Complete room build:** Suspension → Crosshatch → Convoy → Scattershot → Hair trigger → Light frame → Kickback → Airshot → Bloodwork → Punch through.

**Card:** Stored rounds trail your movement. Release to converge from their positions. Holds 15 rounds.

### Thermal Shock

Requires Coolant Rounds and Cinder rounds; occupies the one fusion slot. Flame ticks consume accumulated cold, including a frozen target or a ready boss bonus, for up to 48 steam damage in a 110-unit radius. Nearby enemies take 65% splash. Cover and armor apply. Steam pushes ordinary enemies and loose props, never stuns bosses, and cannot trigger Flashpoint or spread cold.

**Parents:** Coolant Rounds + Cinder rounds.

**Complete room build:** Coolant Rounds → Cinder rounds → Thermal Shock → Deep Freeze → Punch through → Hair trigger → Light frame → Airshot → Bloodwork → Bank shot.

**Card:** Your flames consume cold for a steam blast. More cold, more damage. Pushes debris and ordinary enemies.

### Corner Pocket

Requires Banker. The first terrain bank aims toward the nearest exposed enemy within 480 units, spending its opportunity even if no target is visible. Pre-bank direct hits are 20% weaker. Later bounces, returning routes and portals retain their spent budget. Steel balls and beam banks use the same targeting; Vector yields briefly after the bank.

**Parents:** Banker.

**Complete room build:** Bank shot → Banker → Corner Pocket → Punch through → Heavy hitter → Hair trigger → Light frame → Airshot → Bloodwork → Kickback.

**Card:** The first wall bounce aims at a nearby exposed enemy. Hits before that bounce deal 20% less damage.

### Scrap Feed

Requires Splinter. Your primary rounds and their Splinter fragments load one charge when they destroy crates, cover, cracked panels or breakable terrain. Your next discharge adds seven short-range fragments at eight damage each. Beam pulses use the same cadence. One credit per discharge prevents recycling; rubble, explosions, echoes and the extra scrap shrapnel cannot load it.

**Parents:** Splinter.

**Complete room build:** Splinter → Scrap Feed → Shatter → Heavy hitter → Hair trigger → Light frame → Airshot → Bloodwork → Punch through → Kickback.

**Card:** Break crates or cover with your shots to load a short shrapnel blast into your next discharge. Stores one charge; its shrapnel cannot reload it.

### Icebreaker

Coolant Rounds trades 20% direct damage for cold. At 48 cold, Deep Freeze holds an ordinary enemy for 0.55 seconds; Icebreaker spends it on one hit and three inert fragments. A 1.6-second immunity follows. Bosses never freeze: they bank one capped bonus hit, followed by a 0.7-second recharge.

**Parents:** Deep Freeze.

**Complete room build:** Coolant Rounds → Deep Freeze → Icebreaker → Punch through → Hair trigger → Airshot → Light frame → Kickback → Bloodwork → Vector rounds.

**Card:** Hit a frozen enemy to shatter it for heavy damage and three ice fragments.

### Cold Front

Cold Snap spends full cold on a burst instead of a freeze. Cold Front spreads 24 cold to exposed enemies within 150 units; spread stops below the trigger threshold and cannot trigger itself. Shoot again to continue the chain. Bosses bank the bonus for the next hit.

**Parents:** Cold Snap.

**Complete room build:** Coolant Rounds → Cold Snap → Cold Front → Punch through → Hair trigger → Airshot → Light frame → Kickback → Bloodwork → Banker.

**Card:** Cold bursts chill nearby exposed enemies. Follow up with a shot to burst them.

### Thread the Needle

Hold fire to park rounds, then aim and release. Crosshatch converges from their real positions. Thread the Needle gives the final round up to 150% extra damage for consecutive earlier hits in that release; a miss breaks the streak and piercing/returning cannot reuse the bonus. Recoil happens when firing. Thirty-round cap; overflow and rounds held for 2.5 seconds launch automatically.

**Parents:** Crosshatch.

**Complete room build:** Suspension → Crosshatch → Thread the Needle → Scattershot → Hair trigger → Light frame → Kickback → Airshot → Bloodwork → Punch through.

**Card:** Your last round follows a beat later. Consecutive hits in that release strengthen it; a miss breaks the streak.

### Chain Release

Fire to leave parked proximity traps, then move to draw enemies within 140 units. Chain Release launches traps within 200 units of the triggering round toward the same enemy, each with its own cover check. Release no longer launches the traps. They expire after four seconds; at most thirty remain. Enemy shots stay live and parked rounds cannot deflect them.

**Parents:** Tripline.

**Complete room build:** Suspension → Tripline → Chain Release → Scattershot → Backblast → Backfire → Light frame → Airshot → Hair trigger → Bloodwork.

**Card:** A triggered trap launches nearby parked rounds at the same enemy, if their shot is clear.

### Retrace

Returning rounds reverse their recorded outward route, then home toward you. Banks keep their spent budget. Portal gaps are never swept for damage, and changing the portal pair cuts the recorded return. New cover still blocks the return.

**Parents:** Recall.

**Complete room build:** Recall → Retrace → Homecoming → Bank shot → Punch through → Banker → Fold → Slingshot → Light frame → Airshot.

**Card:** Recall rounds return along their outward route, including banks and unchanged portals.

### Wallrunner

Shoot away from a nearby wall so recoil drives you into it. A 0.32-second grip lets you jump away. Gripping the same wall again requires touching another surface; moving walls retain collision and destroyed support releases the grip.

**Parents:** Light frame.

**Complete room build:** Light frame → Wallrunner → Kickback → Redline → Airshot → Bloodwork → Hair trigger → Heavy hitter → Backblast → Punch through.

**Card:** Recoil into a wall to grip briefly. Jump away; touch a different surface before gripping that wall again.

### Air Brake

Release fire during recoil flight to reduce velocity to 25%, once per jump. The next airborne shot has 35% more recoil. Landing clears the launch charge. Burst rounds, rear volleys and beam pulses share the same one-use charge; pause is not a trigger release.

**Parents:** Kickback.

**Complete room build:** Kickback → Air Brake → Backblast → Backfire → Light frame → Airshot → Bloodwork → Heavy hitter → Landing shot → Hair trigger.

**Card:** Release fire in recoil flight to brake once per jump. Your next airborne shot kicks 35% harder.

### Resonator

Right-click/E or LT/L2 to place both portals, then hold fire through the entrance. Every third pulse repeats its transmitted energy from the exit at 60% power after a short delay. The first two pulses are 25% lighter. Repeats keep the original exit aim and spent range, check current cover and cannot trigger more repeats.

**Parents:** Pulse Chamber + Relay Gate.

**Complete room build:** Cutting Torch → Burst fire → Pulse Chamber → Fold → Relay Gate → Resonator → Scattershot → Airshot → Light frame → Bloodwork.

**Card:** A third pulse through a portal repeats from its exit at 60% power. First two pulses are 25% lighter.

### Flywheel

Fire shallowly into a floor. After 600 units of actual rolling travel, the final saw pair reaches double damage. The ball has two fewer banks. Air travel, riding a moving platform and teleporting do not charge it; the saw pair spends its charge once.

**Parents:** Skid Plate + Crosscut.

**Complete room build:** Mass Driver → Skid Plate → Grindshot → Crosscut → Flywheel → Punch through → Banker → Airshot → Light frame → Bloodwork.

**Card:** Rolling distance charges your final saws, up to double damage. Two fewer ball banks.

### Storm Cell

Aim near floors so the three bomblets can land apart. Two landings arm a cell after 0.12 seconds, linking exposed nodes for 1.3 seconds. Each cell hits an enemy once for half the original shell payload. Shell explosions have 28% less radius; at most three cells can remain. Cover interrupts links.

**Parents:** Cluster Shell + Arc Coil.

**Complete room build:** Shellshock → Cluster Shell → Arc Coil → Storm Cell → Aftershock → Blast surfing → Airshot → Light frame → Bloodwork → Hair trigger.

**Card:** Landed bomblets link into brief electrical traps. 28% smaller shell explosions. Keep three cells.

### Pulse Chamber

Hold fire. Two light pulses lead into a narrow piercing finisher. Burst fire is a required parent.

**Parents:** Cutting Torch + Burst fire.

**Complete room build:** Cutting Torch → Burst fire → Pulse Chamber → Thermal Runaway → Scattershot → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Two light beam pulses, then a hard, narrow finisher that pierces an extra enemy.

### Charge Lens

Hold left click or RT/R2, then release. Aim while charging; Thermal needs one exposed target. Burst adds three release lances. Pause cancels the charge.

**Parents:** Cutting Torch.

**Complete room build:** Cutting Torch → Charge Lens → Thermal Runaway → Scattershot → Capacitor → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Hold to charge. Release a powerful cutting lance with a heavy kick.

### Prism Array

Hold fire. Aim along either angled ray for one target, or put separate targets in both lanes. The middle is a gap; Scattershot widens the rays.

**Parents:** Cutting Torch.

**Complete room build:** Cutting Torch → Prism Array → Thermal Runaway → Scattershot → Punch through → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Two angled rays, each at 60% power. Aim between them to split your fire.

### Pinwheel

Keep the center lane on target while successive volleys sweep the outer lanes. Alternatives: Pinwheel or Convergence.

**Parents:** Crossfire.

**Complete room build:** Crossfire → Pinwheel → Scattershot → Hair trigger → Burst fire → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Outer firing lanes sweep across a forward fan. The center stays on aim.

### Follow-through

Fire, then move. The echo starts at your new muzzle with your original aim. Vector echoes replay recorded turns. Alternatives: Follow-through or Parallax.

**Parents:** Afterimage.

**Complete room build:** Crossfire → Afterimage → Follow-through → Vector rounds → Afterburner → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Your echo fires from your new position, keeping the original aim.

### Shaped Charge

Aim into the target. The blast reaches farther forward and sacrifices side/rear coverage; real cover still blocks it. Fuse retains impact direction as its host rotates.

**Parents:** Shellshock.

**Complete room build:** Shellshock → Shaped Charge → Fuse → Linked fuse → Aftershock → Shockfront → Blast surfing → Airshot → Light frame → Bloodwork.

**Card:** Shell blasts hit 30% harder in a longer, narrow cone. Less side coverage.

### Cluster Shell

Use floors and exposed cover to scatter three physical bomblets. Parent plus children share the shell payload. Aftershock echoes the same divided budget.

**Parents:** Shellshock.

**Complete room build:** Shellshock → Cluster Shell → Fuse → Linked fuse → Aftershock → Shockfront → Blast surfing → Airshot → Light frame → Bloodwork.

**Card:** 25% more blast damage, split between a solid impact and three short-lived bomblets.

### Skid Plate

Fire shallowly into a floor to turn a ball into a rolling shot. It follows real moving support and spends its existing banks and lifetime.

**Parents:** Mass Driver.

**Complete room build:** Mass Driver → Skid Plate → Punch through → Banker → Tether rounds → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Shallow floor hits turn steel balls into fast rolling shots that bowl through debris.

### Relay Gate

Right-click/E or LT/L2 to place the fixed pair. Friendly primary shots get one extra bank and 15% speed on first transit; beams get remaining range instead. Rewire is the alternative.

**Parents:** Fold.

**Complete room build:** Fold → Relay Gate → Slingshot → Banker → Bank shot → Airshot → Light frame → Bloodwork → Kickback → Heavy hitter.

**Card:** Your fixed portals give each shot one extra bank and 15% speed, once.

### Short Circuit

Land three hits on the same enemy. The stored arc damage discharges into that target. Daisy Chain is the crowd-control alternative.

**Parents:** Arc Coil.

**Complete room build:** Arc Coil → Short Circuit → Heavy hitter → Hair trigger → Punch through → Airshot → Light frame → Bloodwork → Kickback → Scattershot.

**Card:** Every third hit discharges into that enemy instead of arcing away.

### Triphammer

Fire away from a target to launch into it. A successful fast ram rebounds you upward. Move at least 64 units away and fire again to rearm; boss armor still applies.

**Parents:** Ramjet.

**Complete room build:** Ramjet → Triphammer → Kickback → Redline → Backblast → Breach → Airshot → Light frame → Bloodwork → Heavy hitter.

**Card:** A fast ram kicks you back into the air. Travel and fire again to earn another impact.

### Crosscut

Spend a shot against a solid surface after its banks/return. Two saws travel opposite ways at 60% payload each. Rail and echo payloads carry through; Corner Cutter is the alternative.

**Parents:** Grindshot.

**Complete room build:** Grindshot → Crosscut → Splinter → Shatter → Punch through → Banker → Airshot → Light frame → Bloodwork → Heavy hitter.

**Card:** Spent hits send two saws in opposite directions, each at 60% power.

## Local forks

| Family | Choose one |
| --- | --- |
| Beam | Pulse Chamber / Charge Lens / Prism Array |
| Pattern | Convergence / Pinwheel |
| Echo | Parallax / Follow-through |
| Shell | Implosion / Shaped Charge / Cluster Shell |
| Ball | Drop Forge / Skid Plate |
| Portal | Rewire / Relay Gate |
| Arc | Daisy Chain / Short Circuit |
| Ram | Wrecking Ball / Triphammer |
| Saw | Corner Cutter / Crosscut |
| Cold | Deep Freeze / Cold Snap |
| Stasis | Crosshatch / Tripline |
| Cable | Snapback / Grapnel |
| Volley | Thread the Needle / Convoy |
| Subversion | Standing Orders / Cross Talk |

## Existing combinations repaired

- Rail spike + Vector/Afterburner are alternatives for new builds. Existing saved runs and recaps keep owned legacy builds.
- Charged Backfire fires a real rear rail. Spent rails and Afterimage rounds can produce payload-correct saws.
- Mass Driver + Recall permits one hit per enemy on each flight leg. Banks and portals cannot refresh that allowance.
- Guided Recall gets a half-second outward window. Echo guidance follows recorded turns, including one earned Afterburner boost.
- Breach clears at most two small rounds per 0.45 seconds. Heavy rounds and blades resist it; Countershot retains its separate shared charge.
- Contextual cards explain beam, charged-lance, rail, trap and direct-impact adaptations.

Regenerate these documents with `node --experimental-strip-types scripts/catalog-branch-builds.mjs --preview`.
