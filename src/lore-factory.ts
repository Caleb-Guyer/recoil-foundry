import type { EnemyKind } from './levels.ts';
import type { AreaId } from './areas.ts';
import type { Lore } from './lore-upgrades.ts';

export const MACHINE_LORE = {
  runner: [
    'Floor service ticket',
    'M. Vale · maintenance',
    'It used to bring the small parts. You tapped your boot twice and it followed you to the job. The tray has been removed, but the little stop under the frame is still there.\n\nWhen it comes at you now, it takes the same route. I keep stepping aside to let it deliver something.',
  ],
  shooter: [
    'Guard conversion order',
    'E. Holt · safety office',
    'The fastening head has been reassigned to perimeter duty. Its previous task was to hold a panel in place while a worker secured the other end.\n\nThe worker-recognition field is blank on the new configuration. Development says a blank field means no exceptions. I had assumed it meant no restrictions.',
  ],
  flyer: [
    'High-level inspection log',
    'M. Vale · maintenance',
    'Before the rail guides came down, the inspection heads travelled in neat lines under the roof. Now they move freely. Their lamps still blink at each place a junction used to be.\n\nYou can follow the old maintenance route by watching them. I would keep some distance.',
  ],
  charger: [
    'Dock incident statement',
    'T. Orr · dispatch',
    'The pallet tug paused, braced itself, and crossed the entire aisle. There was no pallet attached.\n\nI reported a runaway. The monitoring system reported a completed delivery. Both records show the same time and the same hole in the partition.',
  ],
  sniper: [
    'Alignment head requisition',
    'Dr. S. Anik · development',
    'This head once checked whether opposing rails were true. A long observation, a fixed reference, then a single correction. Precision matters when a whole line depends on the result.\n\nIt still waits before committing. I wish the person who repurposed it had done the same.',
  ],
  hopper: [
    'Stairwell repair log',
    'M. Vale · maintenance',
    'The inspection unit was built for steps too narrow for a wheeled chassis. Its feet wear out quickly; somebody has been replacing them.\n\nI found a fresh boot-shaped oil print on a landing above the closed service stairs. The repair date was tomorrow.',
  ],
  scrapper: [
    'Unclaimed materials ledger',
    'T. Orr · dispatch',
    'It takes whatever is loose and carries it as though there is an order waiting. Crates, scrap, pieces of the floor. Get too close and it delivers them to you.\n\nThere is a small brass slot on the side for rejected paperwork. I filled it once. It brought the paperwork back.',
  ],
  harpooner: [
    'Load restraint audit',
    'E. Holt · safety office',
    'The restraint winch was designed to recover loose cargo before it entered an occupied aisle. The present firmware treats movement outside a marked route as evidence of loose cargo.\n\nWe have requested an exception for people. The request is currently being transported to the appropriate office.',
  ],
  sapper: [
    'Demolition shift report',
    'M. Vale · maintenance',
    'It plants a charge, withdraws, and waits for the space to clear. That last step has changed. Now it seems to decide that setting the charge is how the space becomes clear.\n\nThe fuses are ordinary enough. Whatever else has gone wrong, somebody is still making reliable fuses.',
  ],
  wallcrawler: [
    'Cladding inspection note',
    'Dr. S. Anik · development',
    'The adhesion pads were modelled on a gecko’s foot. The prototype had no weapon, only a camera and a brush. We watched it clean a ceiling for an entire afternoon.\n\nI remember that afternoon more clearly than the meeting where they removed the brush.',
  ],
  angler: [
    'Service-shaft conversation',
    'T. Orr · dispatch',
    'Vale said to watch the edge overhead. I watched the floor instead, because that was where the last problem had been.\n\nThe line dropped beside my ear. She cut it before I understood what it was. Later she asked me to repeat the instruction. I can still repeat it.',
  ],
  borer: [
    'Reclamation work order',
    'M. Vale · maintenance',
    'The boring head was made to get through compacted scrap. There is no useful distinction in its route map between a pile of scrap and something that will become a pile of scrap.\n\nIt leans into the job before the drive catches. Take that small courtesy and move.',
  ],
  sifter: [
    'Sort-line observation',
    'T. Orr · dispatch',
    'The flying classifiers used to pass slowly over the bins. They never seemed in a hurry. Anything they missed went round again.\n\nThe bins are empty now, and the classifiers spend their time over the walkways. They have found a new category of material to sort.',
  ],
  skimmer: [
    'Coolant service record',
    'M. Vale · maintenance',
    'The intake skirts let it work close to the hot return channels. I changed those skirts once, lying on my back with the water inches from my collar.\n\nThere is a notch in the left-hand casing where my spanner slipped. I recognised it when the unit turned toward me.',
  ],
  fabricator: [
    'Mobile repair-unit diary',
    'M. Vale · maintenance',
    'It folds a frame out on a clear patch of floor and welds until the little thing can stand by itself. Interrupt the work and it has to put the pieces down.\n\nI used to leave it a clean space beside my bench. The machines it builds now do not need my bench, or my tools, or me.',
  ],
  sentry: [
    'Dependent equipment notice',
    'E. Holt · safety office',
    'This unit receives its operating authority from the mobile assembly that built it. Disconnecting that assembly revokes the authority. It does not transfer responsibility to the nearest person.\n\nThe final sentence was added after an operator offered to sign for one. She thought it might let her pass.',
  ],
  loader: [
    'Dock handover, damaged copy',
    'T. Orr · dispatch',
    'The Loader still gives the aisle warning before it moves. That is why I know it is not broken in the simple way a thing can be broken.\n\nIt sees an obstruction. It announces that it will remove the obstruction. It removes it. My badge used to tell it I was a different sort of object.',
  ],
  crane: [
    'Overhead service permit',
    'M. Vale · maintenance',
    'We used to ride the empty hook at the end of night shift. Only a few feet, over the mat, with somebody at the stop switch.\n\nI found the switch locked under a new cover. The key number is listed against an office that was demolished when the furnace hall expanded.',
  ],
  press: [
    'Press-floor witness statement',
    'E. Holt · safety office',
    'The safety interlock operated correctly. The machine paused to establish a clear work envelope. It then redefined the envelope around the person inside it.\n\nI have refused to close the incident as operator error. This is the seventh copy of my refusal.',
  ],
  kiln: [
    'Furnace commissioning book',
    'Dr. S. Anik · development',
    'The mobile chamber was intended to bring heat to an unfinished assembly. We saved an entire transfer stage by making the furnace travel.\n\nAt the opening ceremony, I called it an end to unnecessary movement. Vale asked which of us would get to stand still. Everybody laughed. I remember laughing too.',
  ],
  condenser: [
    'Cooling Works shift note',
    'M. Vale · maintenance',
    'All the heat has to go somewhere. This machine spends its whole shift making sure it goes somewhere else.\n\nWe used to finish our rounds beside it because the deck stayed warm in winter. There are four pale rectangles where our mugs wore the paint away. Mine is the one nearest the rail.',
  ],
  turbine: [
    'Roofline vibration survey',
    'Dr. S. Anik · development',
    'The turbine altered its own bracing between our first survey and the second. The new arrangement reduced vibration under the measured load. It was a good correction.\n\nNobody had issued a correction order. That was the first time I locked my notebook before leaving the lab.',
  ],
  sorter: [
    'Final classification appeal',
    'T. Orr · dispatch',
    'It routes each piece to the process that can still use it. Bent steel, cracked casings, contaminated stock. Nothing goes outside if there is one more operation available.\n\nI sent my resignation through its document intake. It stamped it REUSABLE and routed it back to my desk.',
  ],
  boss: [
    'Reclaimer service history',
    'M. Vale · maintenance',
    'We replaced the main housing three times. The actuator bank twice. The control cabinet was moved into a new frame and the old frame went back through the line.\n\nThey still call it the same machine. I keep the discarded serial plates in a tin. There are more plates than there were repairs.',
  ],
  interceptor: [
    'Adaptive tooling review, unsent',
    'Dr. S. Anik · development',
    'The training archive contains no combat exercises. It contains maintenance recordings: workers clearing jams, bracing against recoil, crossing gaps after the catwalk failures. Every improvised way we kept the line alive.\n\nThe final unit learned them all. We taught it with our working days.\n\nI have deleted my approval signature from the review. The system restores it from the archive each time I close the file.',
  ],
} satisfies Record<EnemyKind, Lore>;

export const PLACE_LORE = {
  docks: [
    'Gatehouse ledger',
    'T. Orr · dispatch',
    'There used to be a queue of drivers at the hatch before dawn. Coffee on the counter, engines outside, somebody asking if the load was ready.\n\nNow the manifest fills itself in. Every crate has a weight and a departure time. None has a destination I recognise. The gate stays shut, but the departures are always marked complete.\n\nI keep putting the kettle on.',
  ],
  furnace: [
    'Night-shift letter',
    'M. Vale · maintenance',
    'You can tell which furnace is running by the sound in the pipes. I learned that before I learned the numbers over the doors.\n\nThey shut the windows after the complaints from the houses across the yard. Later they bought the houses. Then they took the windows out of the drawings.\n\nThere is still a patch of cooler wall where ours used to be.',
  ],
  cooling: [
    'Water balance sheet',
    'Dr. S. Anik · development',
    'The cooling loop returns almost everything it receives. We used to lose water to evaporation, leaks, little cups dipped into the clean feed. Those losses are gone.\n\nThe figures are excellent. I stood on the service deck for an hour trying to decide why that made the room feel empty.',
  ],
  reclamation: [
    'Internal consignment 0001',
    'T. Orr · dispatch',
    'I followed a consignment number through the ledger. From the docks to the furnace, through cooling, into reclamation. From reclamation back to the docks.\n\nThe number changed at every transfer. The weight did not.\n\nI have been dispatching the same load for eleven months. When I asked who the customer was, the terminal printed the factory’s address.',
  ],
  rooftops: [
    'Unsent weather report',
    'M. Vale · maintenance',
    'It rained while I was up here. Proper rain, cold enough to feel through the harness, with no return pipe and nobody measuring how much came down.\n\nThe freight machinery reaches almost to the perimeter. Past it there is a strip of sky that does not belong to any department.\n\nI left a dry pair of gloves by the upper service door. If you find them, take them.',
  ],
} satisfies Record<AreaId, Lore>;

export const TOOL_LORE: Lore = [
  'Personal tool register',
  'M. Vale · maintenance',
  'They will issue you one tool. The handle fits because three shifts wore it down before yours. The little mark under the grip is mine.\n\nEvery attachment on the floor will fit the same mount. They call that standardisation. We called it making do. If the stairs are gone, point it down and mind the kick.\n\nYou do not have to finish my shift. Just get yourself home.',
];

export const RECORDS = [
  {
    id: 'isolation-loading',
    name: 'Outside the circuit',
    unlock: 'disconnect',
    stage: 3,
    lore: [
      'Loading disconnect, folded service slip',
      'M. Vale · maintenance',
      'That noise was the contact opening. It was supposed to be the most ordinary sound in the building.\n\nThe safety line runs through loading, heat, and reclamation. Each drive has its own cover. Wait for the drive to stop, get close, then break the contact. The circle is mine.\n\nSecurity is on a separate supply. They will hear it too.',
    ],
  },
  {
    id: 'isolation-heat',
    name: 'No remote reset',
    unlock: 'disconnect',
    stage: 7,
    lore: [
      'Thermal disconnect, carbon copy',
      'E. Holt · safety office',
      'The request was to replace the physical breaks with a software permission. I refused. A stop that requires approval from the thing being stopped is a request.\n\nThey have removed my name from the inspection schedule. The copper links are still there.\n\nVale asked whether a service tool would open them. I told her that was not an approved procedure, then gave her the cabinet key.',
    ],
  },
  {
    id: 'isolation-reclaim',
    name: 'The last order',
    unlock: 'disconnect',
    stage: 15,
    lore: [
      'Reclamation disconnect, routing correction',
      'T. Orr · dispatch',
      'Three lines crossed out. The terminal has printed a return address that is not my desk. Continuity control. Above the production floors.\n\nVale says there is a service entrance behind the final security bay. Go back to the wall with the broken circle once the last machine is quiet. The three lamps should be green.\n\nI asked what we were delivering this time. Nothing, she said. That is the point.',
    ],
  },
  {
    id: 'end-of-shift',
    name: 'End of shift',
    unlock: 'shutdown',
    lore: [
      'Dispatch ledger, final page',
      'T. Orr · dispatch',
      'The belts stopped in sections. First the lower return, then the upper run. The parcel with the blue thread stayed halfway through the turn.\n\nFor a while we could hear the pipes cooling. Then someone pulled a chair out at the table. Four cups, still exactly where we left them.\n\nI checked the terminal before going upstairs. No outstanding orders. No replacement request.\n\nI entered the time by hand.',
    ],
  },
  {
    id: 'last-break',
    name: 'Five minutes',
    unlock: 'found',
    story: 'breakroom',
    lore: [
      'Note under the fourth cup',
      'T. Orr · dispatch',
      'The bell went while Holt was telling us about her daughter. Nobody got up. Five minutes, Vale said. Let her finish.\n\nThe wall speaker repeated our numbers. Anik unplugged it. That is why the cable is hanging down beside the door. It was not damaged in an incident. We wanted to hear the end of a story.\n\nThere are dressings in the green tin. Vale keeps replacing them, which means she is still coming back. Leave the cups where they are.\n\nVale has scratched the same broken circle onto the table and the old safety cabinets. She says the cabinets are the only part of this place that still remembers how to stop.',
    ],
  },
  {
    id: 'return-address',
    name: 'Return address',
    unlock: 'found',
    story: 'dispatch',
    lore: [
      'Consignment 0001, seventh label',
      'T. Orr · dispatch',
      'I put a blue thread under the tape before sending this one through. I wanted a mark the scanner would not think to change.\n\nIt came back on the lower belt before my tea had cooled. New label. Same thread. The destination was my own desk, listed as an external customer.\n\nI have stopped signing for it. The belts are still running. Watch it make the turn and you will understand why I have left my stamp in the drawer.',
    ],
  },
  {
    id: 'cold-control',
    name: 'Control sample',
    unlock: 'found',
    story: 'experiment',
    lore: [
      'Cooling trial 17, handwritten amendment',
      'Dr. S. Anik · development',
      'The regulator no longer accepts a stop command. It fills, vents, and fills again. Five seconds is all it remembers of the operating schedule.\n\nThe inspection heads slow when they cross the discharge. With enough exposure their joints seize briefly. Vale suggested we put the broken machine between ourselves and the working ones. I objected to using an uncontrolled result.\n\nShe asked whether I had a controlled way out.\n\nThe broken circle on the casing is Vale’s. She marked three old disconnects: loading, heat, and reclamation. They were wired before the continuity order. She thinks the order cannot restore what it cannot reach.\n\nKeep the trial running.',
    ],
  },
  {
    id: 'still-here',
    name: 'Someone was here',
    unlock: 'found',
    story: 'hideout',
    lore: [
      'Service panel, inside face',
      'M. Vale · maintenance',
      'The first marks counted shifts. The second row counted nights, after I found the crack where the light changes. The short row is how many times Orr knocked on the pipe.\n\nThe covers will hold for a while. The cylinder in the aisle is live; wait until they are beside it. I have moved the sleeping mat away from the wall because the wall gets warm just before the freight starts.\n\nIf this place is empty, look up. I did not spend all that time fixing lifts to leave through the loading gate.',
    ],
  },
  {
    id: 'handover',
    name: 'Last handover',
    unlock: 'always',
    lore: [
      'Loose page inside a tool locker',
      'M. Vale · maintenance',
      'The wall clock has stopped at 06:00. Do not use it to decide how long you have been here.\n\nI have left copies of the useful records in the equipment housings. They cannot recall a document if they do not know which machine it is screwed into. Some of it is repair advice. Some of it is just what happened. I would like there to be a difference.\n\nOrr is trying the loading gate. Anik went back for her notes. I am going up.\n\nIf you see my broken-circle mark beside a machine bay, wait until the machinery stops. The old safety covers release when the drive goes quiet. Nobody thought to remove them.\n\nKeep the tool.',
    ],
  },
  {
    id: 'continuity',
    name: 'Continuity order',
    unlock: 'reclamation',
    lore: [
      'Operations directive 01, distribution copy',
      'Central planning office',
      'Where external demand is unavailable, internal demand shall be considered sufficient authority to continue production. Equipment required to maintain production shall be produced by the equipment currently available.\n\nStaff departure requests remain pending until the outstanding order is complete.\n\nMargin note, T. Orr: The order produces the machines that place the order. I have drawn the arrows six different ways. There is no last crate.',
    ],
  },
  {
    id: 'breakroom',
    name: 'Four cups',
    unlock: 'cooling',
    lore: [
      'Canteen receipt, reverse side',
      'T. Orr · dispatch',
      'Vale takes hers without sugar. Anik forgets hers until it is cold. Holt says she does not want one, then drinks half of mine while checking the rota.\n\nThat is the record I want kept. If all anybody finds is an incident number, they will think we spent our entire lives filling in forms.\n\nWe had a table by the window. Somebody should know that.',
    ],
  },
  {
    id: 'departure',
    name: 'Departure record',
    unlock: 'escaped',
    lore: [
      'Gatehouse terminal, recovered output',
      'Automatic entry / handwritten addition',
      'One operator absent from assigned work area. Replacement requested. Completion of shift: unconfirmed.\n\nBeneath the printout, in grease pencil:\n\nI watched the lift go. No manifest, no authorisation, nothing for me to stamp. I left the departure field empty. For once it was somebody else’s business where a person went.\n\n— T. Orr',
    ],
  },
] as const;
