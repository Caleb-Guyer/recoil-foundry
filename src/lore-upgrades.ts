import type { MODS } from './rules.ts';

export type Lore = readonly [source: string, author: string, text: string];

// These are original Foundry documents. Mechanical descriptions live in the upgrade catalog.
export const UPGRADE_LORE = {
  spoof: [
    'Dispatch credential test',
    'T. Orr · dispatch',
    'The patrol units check who issued an order only when they wake. After that, they trust the badge. Vale found a way to put a different badge in the restart packet.\n\nThe larger machines reject it. Their receivers still spend a moment arguing with themselves. That moment has proved useful.',
  ],
  'standing-orders': [
    'Instruction retention memo',
    'M. Vale · maintenance',
    'The borrowed units kept forgetting which side they were on. I fitted a retention circuit and reinforced the receiver housing. They remember longer now.\n\nI told one to keep Orr safe. For seven seconds, someone in this building took that instruction seriously.',
  ],
  'priority-target': [
    'Red-pencil protocol',
    'T. Orr · dispatch',
    'We used to circle the urgent jobs on the shift sheet. Now the tool sends a reference number with each hit. The borrowed machine follows the most recent reference it can see.\n\nA sensible system. One job at a time. I suggested it at a planning meeting once, before those stopped.',
  ],
  'cross-talk': [
    'Receiver duplication trial',
    'Dr. S. Anik · development',
    'Two machines accepted the same borrowed authority. Splitting the carrier weakens both receivers, and neither holds the instruction for long.\n\nAcross the bay they turned together, hesitated, and opened fire on their former supervisor. The recording has been requested by three departments.',
  ],
  'dead-switch': [
    'Final instruction',
    'M. Vale · maintenance',
    'The receiver knows when its borrowed authority is about to run out. I gave it one last job before the circuit opens.\n\nIt empties what is left into the company equipment around it. Keep your badge; the discharge recognizes us. I wish the rest of the factory still did.',
  ],
  magnum: [
    'Tool requisition 08',
    'M. Vale · maintenance',
    'The replacement striker arrived with a two-person lifting instruction. It fits in one hand. I assumed the instruction belonged to a different part.\n\nThe first test drove the bench through the partition into Payroll. They approved the requisition that afternoon.',
  ],
  scatter: [
    'Packing discrepancy',
    'T. Orr · dispatch',
    'Five fasteners in every sleeve. One sleeve per pull. That was the specification for fastening insulation to furnace doors.\n\nSomebody removed the insulation from the test order but left the rest of the numbers alone. We have been shipping it as a security fitting ever since.',
  ],
  rapid: [
    'Adjustment card',
    'M. Vale · maintenance',
    'I backed the trigger screw out until I could hear each spring return separately. Then I backed it out a quarter turn more.\n\nIt has a lovely rhythm now. You can almost forget the rest of the building is making the same noise.',
  ],
  ricochet: [
    'Surface certification',
    'E. Holt · safety office',
    'The wall failed the projectile test. The projectile passed the wall test.\n\nThese are separate forms, submitted to separate departments. Neither department accepts responsibility for the second impact. Maintenance has requested permission to stop polishing the test chamber.',
  ],
  pierce: [
    'Inspection notebook',
    'Dr. S. Anik · development',
    'We used stacked plates to measure penetration. A good round stopped at the witness plate; we could recover it, weigh it, and write a sensible report.\n\nThe new batch passed through the witness plate. The witness has been moved to another building.',
  ],
  split: [
    'Sweepings analysis',
    'M. Vale · maintenance',
    'Three pieces, every time. Not shavings. Not sparks. Three small, finished rounds, with machining marks finer than anything on our line.\n\nI asked Development where the extra material came from. They sent me a larger dustpan.',
  ],
  airshot: [
    'Load test margin',
    'Dr. S. Anik · development',
    'Output rose when we suspended the rig. We changed the cable, the mounting, the scale. Output remained high. Set it on the floor and the effect vanished.\n\nVale suggested that the building was taking a cut. I have kept that sentence out of the formal report.',
  ],
  kick: [
    'Returned damping assembly',
    'M. Vale · maintenance',
    'The dampers were eating useful energy. I removed them and put the extra pressure through the chamber instead.\n\nThis is not an approved repair. Neither was leaving the door controls on the other side of a locked door. Keep your knees loose.',
  ],
  leech: [
    'Recovery-fluid memorandum',
    'E. Holt · safety office',
    'The cartridge converts recovered machine residue into a sealant compatible with the operator harness. It is not medicine. Please stop listing it under Medical Supplies.\n\nHandwritten below: Medical Supplies is empty. What heading would you prefer?',
  ],
  light: [
    'Locker note',
    'M. Vale · maintenance',
    'I took the decorative shell off your harness. Then the inspection plate. Then the bracket whose only job was to hold the inspection plate.\n\nIt is lighter now. I left the little hook for your coat. There should be something on it that does not belong to the company.',
  ],
  burst: [
    'Cycle controller revision',
    'Dr. S. Anik · development',
    'Three operations, then a cooling interval. The old packaging controller has performed that sequence for nineteen years without a missed cycle.\n\nIts original machine was dismantled last winter. Connected to a gun, it continues to request cartons.',
  ],
  backblast: [
    'Vent relocation request',
    'M. Vale · maintenance',
    'The chamber needed somewhere to put the excess pressure. Behind the operator was the only direction the design committee had not reserved for something else.\n\nWait for the mechanism to settle between shots. The scorch mark on my locker is exactly the shape of somebody who did not.',
  ],
  banker: [
    'Damage assessment, revised',
    'E. Holt · safety office',
    'Our calculations assumed that each collision would reduce the energy of the round. After the third impact we removed that assumption. After the fourth we removed the observers.\n\nThe room remains booked for Thursday. Please do not enter to collect the chairs.',
  ],
  landing: [
    'Harness modification',
    'M. Vale · maintenance',
    'Lift operators used to complain about the jolt at the bottom. We fitted accumulators to catch it.\n\nThere are no lift operators on the current roster, so I borrowed one. Try to land somewhere solid. You will feel the next shot waiting in your heels.',
  ],
  crossfire: [
    'Alignment exchange',
    'T. Orr · dispatch',
    'We ordered one straight barrel. Receiving counted three. Development says there is still only one tool.\n\nI have drawn the difference on the back of the invoice. It resembles a fork. Accounts has charged us for cutlery.',
  ],
  bloom: [
    'Fragment recovery report',
    'Dr. S. Anik · development',
    'The secondary projectiles form only after the target fails. We recorded six clean exit tracks from an empty chassis. Its remaining casing was lighter by precisely the expected amount.\n\nThis is the first process here that has explained where it gets its material. That should have reassured me.',
  ],
  deadeye: [
    'Calibration bench note',
    'M. Vale · maintenance',
    'Orr held a washer at the far end of the bench while I adjusted the bore. We argued about whether the washer was straight. Then whether the bench was straight.\n\nThe shot went through the middle. For a moment we had one thing in the factory we could agree on.',
  ],
  execute: [
    'End-of-life procedure',
    'E. Holt · safety office',
    'A damaged unit draws power until it is completely decommissioned. This attachment makes that last step economical.\n\nThe phrase end of life refers exclusively to equipment. It should not appear on personnel documents. I have now corrected this on six consecutive revisions.',
  ],
  fold: [
    'Transit experiment 02',
    'Dr. S. Anik · development',
    'I placed the receiving aperture on the opposite wall. The chalk line on the floor was suddenly a very poor description of the distance between them.\n\nOne pair exhausted the factory limiter. Through the opening I could see my own back, still bent over the switch. I waited until I had stood up before walking through.',
  ],
  shellshock: [
    'Demolition stores slip',
    'T. Orr · dispatch',
    'These were issued to remove seized bolts from condemned machinery. The instructions said to clear the surrounding area.\n\nBy the time the revised instructions arrived, the surrounding area had been removed as well. I keep the unopened revision in the same drawer as the bolts.',
  ],
  'blast-surf': [
    'Trial harness recording',
    'M. Vale · maintenance',
    'Test one: harness empty. Test two: sandbag. Test three: me.\n\nThe lining shed the blast cleanly. The launch was the problem. I landed on a beam nobody had dusted since the extension opened. There was a lunch tin up there, still wrapped in a coat.',
  ],
  aftershock: [
    'Pressure trace 44',
    'Dr. S. Anik · development',
    'The first peak is ordinary. The second occurs after the chamber is empty.\n\nWe disconnected the feed, replaced the gauge, and ran it again. Two peaks. Vale said the room sounded as if it was answering. I have labelled the second trace residual pressure.',
  ],
  'chain-reaction': [
    'Stores amendment',
    'E. Holt · safety office',
    'Containers assigned to reactive storage must not share a wall with ordinary stock. Ordinary stock must not share a wall with reactive storage.\n\nBoth requests have been returned. The floor plan has one room. The proposed remedy is to change the name of the room.',
  ],
  rewire: [
    'Limiter bypass',
    'M. Vale · maintenance',
    'There was no shortage of power. The transit unit stopped because a little counter had reached one.\n\nI bridged the counter. Opened a pair. Moved it. Moved it again. Somewhere in the wall a printer began producing violation notices faster than I could fold them.',
  ],
  slingshot: [
    'Transfer loss investigation',
    'Dr. S. Anik · development',
    'The outgoing object was faster than the incoming object. I expected an error in the clocks. Instead, the nearest conveyor slowed by the missing amount.\n\nWe have not invented energy. We have found a way to take it from the schedule. Dispatch has noticed.',
  ],
  redline: [
    'Shift notebook, loose page',
    'M. Vale · maintenance',
    'At speed, the induction collar starts feeding the chamber. At rest, it is just another weight around your wrist.\n\nDo not waste time polishing it. Run it hard enough and the grime burns off. Orr says this is also my approach to looking after myself.',
  ],
  breach: [
    'Rear shield service record',
    'M. Vale · maintenance',
    'We found the first flattened bullet in the exhaust grille. Then another. Nothing behind the tool had been struck.\n\nI replaced the grille with a proper pressure lip. It will clear the space at your back for an instant. An instant is a useful thing to have.',
  ],
  shatter: [
    'Range wall complaint',
    'T. Orr · dispatch',
    'The rounds are coming back as a fan of fragments. Development calls this a useful surface interaction.\n\nThe useful surface is the wall of my office. I have asked to be informed before it participates in further research.',
  ],
  convergence: [
    'Focusing trial',
    'Dr. S. Anik · development',
    'The outer lanes were meant to compensate for a moving workpiece. They converge on the mark even when the mark is empty air.\n\nI watched three cuts meet on a suspended sheet. For once, the holes looked intentional. Vale asked whether we could make that happen to the paperwork.',
  ],
  deadlock: [
    'Operator assessment form',
    'E. Holt · safety office',
    'Consecutive accurate operations increase permitted output. A single failed operation returns output to baseline. The operator may not appeal the reset.\n\nSomeone has circled may not and written a single question beside it: Why? There is no field for the answer.',
  ],
  shockfront: [
    'Second-wave survey',
    'M. Vale · maintenance',
    'The echo is broader with this collar fitted. It pushes the loose stock away instead of dropping it at your feet.\n\nI tested it in the aisle where they used to stack our lockers. Afterward I could see the old painted line: KEEP EXIT CLEAR.',
  ],
  backfire: [
    'Unauthorised barrel order',
    'T. Orr · dispatch',
    'Vale requested a barrel with its mounting reversed. I asked which end should face the operator. She said both ends were somebody else’s problem.\n\nI made her draw it. The rear shot is deliberate. The longer reset is deliberate too. Do not file another fault report.',
  ],
  recall: [
    'Reusable fastener trial',
    'Dr. S. Anik · development',
    'The recovery field recognises the tool that fired the round, not the bench where the tool was mounted. Moving the tool moves the destination.\n\nWe used to count the recovered pieces into trays. Now we stand aside and let them come home.',
  ],
  homecoming: [
    'Return-path annotation',
    'M. Vale · maintenance',
    'The return field was losing pressure every time a round crossed damaged metal. I widened the recovery channel.\n\nIt comes back with more purpose now. Do not reach out to catch it. I know the name makes that sound friendly.',
  ],
  capacitor: [
    'Idle power audit',
    'E. Holt · safety office',
    'Equipment awaiting an operator must draw no current. This unit draws current specifically while its operator waits.\n\nDevelopment has requested an exemption on the grounds that waiting is now part of the work. Personnel has requested a copy of the design.',
  ],
  'reserve-cell': [
    'Bench drawer inventory',
    'M. Vale · maintenance',
    'A spare accumulator from the emergency lamps. It will hold a second charge if you give it time.\n\nThe lamps were taken off the emergency circuit last month. They still light up at shift change. I have not found what is feeding them.',
  ],
  countershot: [
    'Intercept test, operator notes',
    'M. Vale · maintenance',
    'One round turned cleanly. The next went straight through the guard. The coil needs a quiet moment to recover; keeping the trigger down only keeps it empty.\n\nThere is a dent in my bench to remind me. Keep something between you and the thing firing back.',
  ],
  reprisal: [
    'Returned stock classification',
    'T. Orr · dispatch',
    'A reflected round retains its original serial number. It leaves additional holes, but apparently that does not count as a modification.\n\nI sent one back with the usual returns label. Nobody in Receiving will sign for it.',
  ],
  rivet: [
    'Temporary fixing instruction',
    'M. Vale · maintenance',
    'Useful when the other end of the assembly refuses to stay still. Drive it against a surface, make your repair, and leave before the fixing gives.\n\nOn large frames it mostly makes an expensive noise. I have underlined temporary three times.',
  ],
  fracture: [
    'Failed-joint study',
    'Dr. S. Anik · development',
    'A pinned chassis carries stress through fewer joints. The follow-up round does not need to be heavier; it needs to arrive before the frame can unload.\n\nI wrote that as a materials observation. Security copied it into the training manual without the word materials.',
  ],
  fuse: [
    'Adhesive test receipt',
    'T. Orr · dispatch',
    'The sample stuck to the target. The target moved. The sample remained attached. Development checked all three boxes.\n\nBy the time they reached the box marked safe to handle, there was no longer a sample, target, or clipboard.',
  ],
  'linked-fuse': [
    'Demolition crew note',
    'M. Vale · maintenance',
    'One charge can wake another if there is a clear path between them. Leave a wall in the way and the message does not get through.\n\nIt is the only communication system in this place that reliably respects a closed door.',
  ],
  afterimage: [
    'Recorder fault 04',
    'Dr. S. Anik · development',
    'Every fourth discharge left a second exposure on the recording. At first we blamed the camera. Then the second exposure struck the witness plate.\n\nThe tool stores more of an action than we intended. Do not stand where you have just finished firing.',
  ],
  parallax: [
    'Tracking correction',
    'Dr. S. Anik · development',
    'The stored discharge accepts a fresh aiming reference before release. Position remains fixed; intention does not.\n\nOrr asked if this meant we could change our minds after doing something. I said there was a very small window. He stayed after the demonstration.',
  ],
  'rail-spike': [
    'Rail salvage docket',
    'T. Orr · dispatch',
    'We pulled the first conductor out of the freight braking system. The gun took the charge. The test cradle took the recoil. The cradle took a section of floor with it.\n\nI have entered all three items as consumed during testing.',
  ],
  tether: [
    'Paired-load handbook',
    'E. Holt · safety office',
    'When two units share a cable, their combined movement becomes the responsibility of both operators.\n\nNeither unit in the trial had an operator. They pulled in opposite directions until they struck each other. The form required two signatures. I signed it twice.',
  ],
  snapback: [
    'Cable fatigue report',
    'M. Vale · maintenance',
    'A stretched cable is a spring that has not admitted it yet. This release catches the tension just before the strands fail.\n\nStand clear of the middle. There is a reason riggers used to paint that area yellow, back when we still had riggers.',
  ],
  orbit: [
    'Recovery field observation',
    'Dr. S. Anik · development',
    'The recovered rounds settle into a moving ring around the tool. They remain there until the next discharge supplies a direction.\n\nVale called them patient. I reminded her that a field has no temperament. Later I found myself apologising to one for leaving it waiting.',
  ],
  'arc-coil': [
    'Grounding inspection',
    'M. Vale · maintenance',
    'The third strike makes the charge jump. It prefers a nearby chassis, but a good piece of metal will do.\n\nRemove your watch before handling the coil. If you still have a watch, set it five minutes fast. Nobody here is leaving on time.',
  ],
  'daisy-chain': [
    'Continuity survey',
    'E. Holt · safety office',
    'The new bus follows a fault through several adjacent units. Each link carries less energy, as expected.\n\nThe unexpected result was how many machines shared a ground with the staff entrance. That drawing is no longer attached to the public copy.',
  ],
  implosion: [
    'Containment trial',
    'Dr. S. Anik · development',
    'The shell draws loose material toward itself before detonation. We had hoped to confine the debris. Instead, we supplied it with more debris.\n\nThe trial room is very tidy in the centre and much less tidy everywhere else.',
  ],
  ramjet: [
    'Harness misuse investigation',
    'M. Vale · maintenance',
    'Yes, the operator struck the machine. No, the machine did not strike the operator first.\n\nThe recoil collar held. The machine did not. I have been instructed to classify the event as a collision rather than a successful test, which seems unkind to the collar.',
  ],
  cinder: [
    'Hot-work permit',
    'E. Holt · safety office',
    'The round carries heat to the nearest surface and leaves it there. The surface does not require a permit. The operator does.\n\nPlease note that renewing a hot-work permit does not extinguish the work covered by the previous permit.',
  ],
  crosswind: [
    'Ventilation adjustment',
    'M. Vale · maintenance',
    'A directional exhaust sleeve from the polishing booths. It will shove a loose crate and take the certainty out of a small incoming round.\n\nBefore all this, we used it to keep metal dust out of our sandwiches. I miss having that as the principal concern.',
  ],
  'wrecking-ball': [
    'Secondary collision notice',
    'E. Holt · safety office',
    'A displaced machine must be treated as a moving load until it comes to rest. Any machine struck by that load must also be treated as a moving load.\n\nThe instruction was clear enough on paper. On the floor, we ran out of room to apply it.',
  ],
  flashpoint: [
    'Furnace-floor observation',
    'Dr. S. Anik · development',
    'Failure of a burning chassis consumes the surrounding flame in a single release. The fire goes out. Something louder takes its place.\n\nThis does not repeat indefinitely. I have written that last sentence in ink because I need one result to remain true tomorrow.',
  ],
  slipstream: [
    'Airflow map, amended',
    'M. Vale · maintenance',
    'The gust stays long enough to carry a person. Not comfortably, and not in a direction a lift inspector would recognise.\n\nI crossed the broken catwalk without touching it. Orr waved from the other side as though he had been expecting a visitor by air.',
  ],
  grindshot: [
    'Reclamation sample',
    'T. Orr · dispatch',
    'Spent rounds returned from the floor with teeth cut into their edges. The recycling label called them serviceable rotary stock.\n\nI watched one follow the skirting board all the way to the loading door. We have stopped storing parcels on the floor.',
  ],
  'corner-cutter': [
    'Edge-following trial',
    'Dr. S. Anik · development',
    'The guide catches the exposed edge and carries the saw around it. The shape of the room becomes part of the cutting path.\n\nOn the test drawing, Vale had written a shortcut across the middle. The saw ignored her. It was correct to do so.',
  ],
  tripwire: [
    'Temporary perimeter order',
    'E. Holt · safety office',
    'Two anchors define an exclusion line. Crossing the line constitutes acknowledgement of the warning.\n\nThere is no warning sign in the supplied kit. Procurement says the wire itself is sufficiently visible. I have requested that Procurement cross the test room.',
  ],
  tension: [
    'Rigging diary',
    'M. Vale · maintenance',
    'Longer spans leave more energy in the line. You can hear it if the room is quiet enough: a thin note under the fans.\n\nDo not pluck it. We used to do that with ordinary rigging wire. This is not the same sort of instrument.',
  ],
  'cutting-torch': [
    'Tool conversion sheet',
    'Dr. S. Anik · development',
    'The portable cutter was designed to follow seams. Its recoil was considered an unfortunate by-product until the stairs failed.\n\nVale brought it back with a boot mark on the casing and soot up both sleeves. Her entire report was: stairs optional.',
  ],
  'thermal-runaway': [
    'Temperature chart',
    'E. Holt · safety office',
    'The longer the beam remains on the work, the more efficiently the work accepts heat. Moving the beam allows the process to settle.\n\nThe chart ends at the point where the thermocouple ceased to be a thermocouple. The line was still going up.',
  ],
  vector: [
    'Guidance trial',
    'Dr. S. Anik · development',
    'The round follows the operator’s reference after leaving the barrel. We reduced its speed to give the correction time to act.\n\nIt looks uncertain in flight. This is misleading. The uncertain part is holding the gun.',
  ],
  afterburner: [
    'Straightening jig note',
    'M. Vale · maintenance',
    'Once the curve settles, the collar gives the round its stored push. You can hear the change in the air.\n\nDo not keep correcting out of habit. Sometimes the useful thing is to decide where something is going and let it get there.',
  ],
  'mass-driver': [
    'Freight component transfer',
    'T. Orr · dispatch',
    'The balls were bearings for a machine that never arrived. We have paid storage on them for nine years.\n\nDevelopment finally found a use. Please enter them as issued, not shipped. I do not want the system arranging their return.',
  ],
  'drop-forge': [
    'Gravity feed test',
    'Dr. S. Anik · development',
    'The falling ball accumulates force in the same way the old hammer did. We have simply stopped insisting that the hammer remain attached to the ceiling.\n\nThe ceiling has benefited enormously from this arrangement. The floor has filed no comment.',
  ],
  'pulse-chamber': [
    'Cutter timing insert',
    'M. Vale · maintenance',
    'Two light passes to open the surface, one hard pass to finish. My first foreman taught me that on a manual press.\n\nI found his initials under the old controller housing. Kept the sequence. Left the initials where they were.',
  ],
  'charge-lens': [
    'Optics bench record',
    'Dr. S. Anik · development',
    'The lens holds the light until release. In the dark, the whole housing shines through the seams.\n\nI used it to read a note that had fallen behind the bench. An evacuation date, six months old. The concentrated beam cut straight through the paper.',
  ],
  'prism-array': [
    'Rejected optical assembly',
    'M. Vale · maintenance',
    'A chip through the centre split the cutting line in two. They marked the lens unusable and charged the cost to our shift.\n\nI fitted it anyway. Aim between the cuts. If they want to charge us for two tools now, they can come down and count them.',
  ],
  pinwheel: [
    'Pattern controller tape',
    'T. Orr · dispatch',
    'The centre carriage stays true while the outer heads sweep. It was a paint pattern for the old shipping logo.\n\nWe no longer put a destination on the crates, but apparently the logo is still important. The controller knows the motion by heart.',
  ],
  'follow-through': [
    'Motion recorder correction',
    'Dr. S. Anik · development',
    'The delayed discharge can now follow the tool instead of remaining at the original position. Its bearing stays as recorded.\n\nPosition and direction are separate memories. I keep repeating this to myself when I try to remember the route out.',
  ],
  'shaped-charge': [
    'Opening permit',
    'M. Vale · maintenance',
    'Packed the charge behind a liner to keep the force going one way. Less trouble on either side. Considerably more trouble in front.\n\nOrr wants one for the jammed records cabinet. I have offered a crowbar first, for the sake of the records.',
  ],
  'cluster-shell': [
    'Parcel subdivision notice',
    'T. Orr · dispatch',
    'One shipment becomes three smaller consignments on arrival. Each has its own very short delivery window.\n\nThe lab insists this is unrelated to the dispatch software. The error messages have the same spelling mistake.',
  ],
  'skid-plate': [
    'Floor wear survey',
    'M. Vale · maintenance',
    'Catch the floor at a shallow angle and the ball settles into a roll. Debris becomes a suggestion.\n\nThe polished stripe leads from Development to the canteen. Nobody remembers making it. Everybody remembers moving their chair.',
  ],
  'relay-gate': [
    'Fixed-route authorisation',
    'E. Holt · safety office',
    'Locking the transit pair in place permits an additional transfer impulse. Moving either endpoint would invalidate the approved route.\n\nThis is one of the few restrictions still enforced by an actual physical switch. Leave it alone unless you intend to replace the entire assembly.',
  ],
  'short-circuit': [
    'Arc return experiment',
    'Dr. S. Anik · development',
    'We closed the circuit through the original target. The charge no longer needs a neighbour to complete its journey.\n\nThe prototype made a small, sharp noise, rather like a disappointed switch. The target made no further noises of any kind.',
  ],
  triphammer: [
    'Harness recoil log',
    'M. Vale · maintenance',
    'The impact spring throws you clear after a hard ram. Travel, fire, load it again. That is the rhythm.\n\nKeep doing the middle part. Leaning against a machine and wishing for another bounce is not a maintenance procedure, however often I have tried it.',
  ],
  crosscut: [
    'Saw recovery instruction',
    'T. Orr · dispatch',
    'Two cutting heads leave the impact in opposite directions. Recover both before reopening the aisle.\n\nThe form provides one box for recovered. I have divided it with a ruler. This has been rejected as an unauthorised alteration.',
  ],
  'coolant-rounds': [
    'Coolant diversion permit',
    'M. Vale · maintenance',
    'A small feed from the cooling loop keeps ordinary joints stiff enough to slow a chassis. The heavy frames soak it up differently.\n\nDo not confuse this with the hot return line. Both pipes are blue. The person who chose the colours has never been downstairs.',
  ],
  'deep-freeze': [
    'Cold-room trial',
    'Dr. S. Anik · development',
    'At saturation, the moving joints stopped together. When they thawed, the unit resisted a second freeze for a short interval.\n\nIt resumed the exact task it had been performing. No record of the pause appeared in its shift log. We are apparently measuring different kinds of time.',
  ],
  icebreaker: [
    'Brittle failure sample',
    'M. Vale · maintenance',
    'The frozen housing came apart like a dropped cup. Three hard pieces travelled well beyond the test mat.\n\nI used to leave the cup on top of that housing to keep my tea warm. It is strange what survives as a habit after the equipment changes.',
  ],
  'cold-snap': [
    'Cooling curve alternative',
    'Dr. S. Anik · development',
    'Instead of holding the frozen state, the regulator releases the accumulated cold as a sudden pressure change. Then it needs a moment to recover.\n\nThere is no elegant name for the sound. I wrote snap on the graph and nobody has improved it.',
  ],
  'cold-front': [
    'Vent-bench observation',
    'E. Holt · safety office',
    'The release chills adjacent exposed equipment. Subsequent impacts can release that chill in turn. A solid barrier prevents the transfer.\n\nFor once, the partitions have a documented safety benefit. Please stop removing them to improve sight lines.',
  ],
  suspension: [
    'Suspended-load waiver',
    'E. Holt · safety office',
    'The recoil arrives immediately. The load remains in the air until released. These events must be assessed separately.\n\nI stood among thirty motionless rounds while the technician checked the timer. The waiver was on a clipboard outside the room. I had not signed it.',
  ],
  crosshatch: [
    'Assembly jig trial',
    'Dr. S. Anik · development',
    'The stored pieces approach the chosen point from their separate positions. We originally hoped to assemble a casing without a jig.\n\nThey met too quickly. The casing is now a diagram in the report, which is considerably easier to store.',
  ],
  'thread-the-needle': [
    'Final inspection sequence',
    'M. Vale · maintenance',
    'The last round waits for the others to report a clean line. Every good hit gives it a little more confidence. A miss spoils the count.\n\nMy old apprentice used to work like that. Check, check, check, then one perfect cut. I wish I had told him that more often.',
  ],
  tripline: [
    'Unattended-tool notice',
    'E. Holt · safety office',
    'A suspended round assigned to proximity duty is considered active equipment, even when stationary. It expires if nothing suitable enters its view.\n\nThis is not permission to leave active equipment in corridors. That sentence was missing from the copy sent to Security.',
  ],
  'chain-release': [
    'Signal-chain notebook',
    'Dr. S. Anik · development',
    'One parked round detects a target. The adjacent rounds accept the same reference, provided each has a clear shot.\n\nAn independent check at every link. It is a modest safeguard. I am trying to introduce the same arrangement into management.',
  ],
  retrace: [
    'Recovery-path correction',
    'M. Vale · maintenance',
    'The new return recorder remembers the route, including the ugly banks you hoped nobody saw. Move a transit endpoint and the old directions stop being useful.\n\nI tested it with a chalk maze. It came back through every turn. I kept the chalk.',
  ],
  wallrunner: [
    'Grip-lining trial',
    'M. Vale · maintenance',
    'Recoil seats the lining against a wall. It holds just long enough to get your feet under you. Find another surface before asking the same patch to carry you again.\n\nThere are boot marks above the staff entrance now. I find them encouraging.',
  ],
  'air-brake': [
    'Harness release adjustment',
    'Dr. S. Anik · development',
    'Releasing the trigger in flight briefly damps the harness. The recovered impulse feeds the next airborne discharge.\n\nVale described it as taking a breath. I liked that better than the name on the specification, which was interrupted operator translation.',
  ],
  grapnel: [
    'Fall-arrest modification',
    'M. Vale · maintenance',
    'One airborne anchor. One good swing. Jump to let it go.\n\nThe original harness was supposed to stop us falling off the catwalk. I changed the winch so we could use the empty space under it. They should have repaired the catwalk when we asked.',
  ],
  convoy: [
    'Moving-store experiment',
    'T. Orr · dispatch',
    'The suspended stock follows the operator instead of remaining at the loading point. Fifteen pieces, no trolley, no manifest.\n\nI watched Vale lead them through the aisle in a neat little procession. It was the first delivery in weeks that appeared to know where it was going.',
  ],
  'thermal-shock': [
    'Mixed-service incident',
    'E. Holt · safety office',
    'Cold equipment was exposed to the hot-work attachment. The resulting steam displaced two loose crates and one observer.\n\nBoth departments maintain that their equipment performed within specification. The observer has requested a third department.',
  ],
  'corner-pocket': [
    'Bank correction test',
    'Dr. S. Anik · development',
    'The first surface strike supplies a new firing reference. Before that strike the round carries less useful energy; after it, the nearest exposed target becomes the destination.\n\nWe have taught a projectile to ask the room for directions. The room has been surprisingly helpful.',
  ],
  'scrap-feed': [
    'Emergency stores note',
    'M. Vale · maintenance',
    'The feed catches fragments from broken cover and holds enough for one extra blast. It cannot eat its own discharge. I tried; it made a noise I did not like.\n\nBring the factory’s material back to it. There seems to be plenty to spare.',
  ],
  resonator: [
    'Transit pulse anomaly',
    'Dr. S. Anik · development',
    'Two light pulses establish the pattern. The third produces a second discharge at the receiving aperture. No second emitter is installed there.\n\nI asked Vale to listen from the far room. She returned before I finished asking, carrying a scorched chair.',
  ],
  flywheel: [
    'Rotary stock test',
    'M. Vale · maintenance',
    'The ball gives up some of its wall travel to store energy in the final cutters. Longer rolls leave the teeth humming.\n\nDo not judge one by how slowly it is moving. The old line taught us that still-looking things can have a great deal left in them.',
  ],
  'storm-cell': [
    'Temporary power grid',
    'T. Orr · dispatch',
    'The little charges land, link, and hold a patch of floor between them. We can keep three patches working at once.\n\nFor a few seconds the loading bay has its own lights again. They are the wrong colour, and you should not walk between them, but I still look up.',
  ],
} satisfies Record<(typeof MODS)[number]['id'], Lore>;
