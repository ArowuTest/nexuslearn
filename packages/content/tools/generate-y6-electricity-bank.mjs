#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y6-electricity.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y6-electricity-bank-";
const pilotTarget = 260;
const reviewBatch = "cross-year-wave";

if (write && check) throw new Error("Choose either --write or --check, not both.");

const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y6-electricity") throw new Error("This generator only supports the Year 6 electricity pack.");

const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 5) throw new Error(`Expected exactly 5 curated variants, found ${curated.length}. Refusing to overwrite possible authored work.`);

const missions = [
  { key: "aurora", station: "Aurora research station", zone: "observation dome", goal: "restore the night-sky beacon" },
  { key: "reef", station: "Blue Reef laboratory", zone: "submersible bay", goal: "reconnect the habitat monitor" },
  { key: "forest", station: "Canopy field base", zone: "wildlife hide", goal: "power the non-invasive sensor" },
  { key: "museum", station: "Discovery museum", zone: "engineering gallery", goal: "debug the interactive exhibit" },
  { key: "lunar", station: "Lunar model base", zone: "communications module", goal: "repair the simulator signal" },
];

const symbolItems = [
  { key: "cell", component: "cell", symbol: "one long line beside one short parallel line", distractors: ["a circle with a cross", "a circle containing M", "an open switch gap"], note: "The unequal parallel lines represent one cell." },
  { key: "battery", component: "battery of cells", symbol: "two or more pairs of long and short parallel lines", distractors: ["one circle with a cross", "one straight wire only", "two open switches"], note: "Repeated long-short pairs represent more than one cell." },
  { key: "lamp", component: "lamp or bulb", symbol: "a circle with a cross inside", distractors: ["one long and one short line", "a circle containing M", "a straight line with a gap"], note: "The circle-and-cross is the recognised school-level lamp symbol." },
  { key: "motor", component: "motor", symbol: "a circle containing the letter M", distractors: ["a circle with a cross", "several long-short line pairs", "two switch contacts joined by a lever"], note: "M inside a circle distinguishes a motor in the diagram." },
  { key: "open-switch", component: "open switch", symbol: "two contacts with a raised lever leaving a gap", distractors: ["two contacts joined with no gap", "a circle with a cross", "one long and one short line"], note: "The visible gap shows that the conducting path is open." },
  { key: "closed-switch", component: "closed switch", symbol: "two contacts joined by a lever with no gap", distractors: ["two contacts separated by a raised lever", "a circle containing M", "several cell pairs"], note: "The joined contacts show a complete conducting path through the switch." },
  { key: "wire", component: "connecting wire", symbol: "a straight line joining component symbols", distractors: ["a realistic coiled cable drawing", "a circle with a cross", "a long-short cell pair"], note: "Circuit diagrams use simple lines to show electrical connections." },
  { key: "buzzer", component: "buzzer", symbol: "the agreed school buzzer symbol shown in the task key", distractors: ["the cell symbol", "the lamp symbol", "a realistic photograph of a buzzer"], note: "The task key fixes the reviewed local buzzer convention; a realistic picture is not a circuit symbol." },
  { key: "complete-diagram", component: "one-cell, switch and lamp series circuit", symbol: "cell, closed-switch and lamp symbols joined in one unbroken loop", distractors: ["the same symbols in separate unconnected groups", "a realistic drawing with no connections", "a loop with an open switch while the lamp is labelled on"], note: "The symbols and their one-loop connections must both match the pictorial circuit." },
  { key: "layout-equivalence", component: "the same series circuit redrawn in a rectangle", symbol: "the diagram with the same components in the same one-loop connections", distractors: ["only the diagram with objects in identical screen positions", "any diagram using the same colours", "a diagram missing the return wire"], note: "Diagram shape can change while component connections remain equivalent." },
];

const componentItems = [
  { key: "lamp-open", component: "lamp", state: "open", output: "off", answer: "The open switch leaves a gap, so the lamp is off.", wrong: ["The switch uses up the electricity.", "The lamp is off because cells only work near switches.", "An open switch makes the voltage stronger."] },
  { key: "lamp-closed", component: "lamp", state: "closed", output: "on", answer: "The closed switch completes the loop, so the suitable lamp can light.", wrong: ["The switch creates electricity.", "The lamp lights because the switch is physically closer.", "Closing the switch removes the cell."] },
  { key: "buzzer-open", component: "buzzer", state: "open", output: "silent", answer: "The open switch breaks the path, so the suitable buzzer is silent.", wrong: ["The buzzer has used up all electricity.", "Open switches make sound too weak to hear but keep the loop complete.", "The cells are too far away."] },
  { key: "buzzer-closed", component: "buzzer", state: "closed", output: "sounding", answer: "The closed switch makes a complete loop, so the suitable buzzer can sound.", wrong: ["The buzzer sounds because the switch stores sound.", "A closed switch adds another cell.", "The wires no longer matter."] },
  { key: "motor-open", component: "motor", state: "open", output: "stopped", answer: "The motor stops because the open switch makes the series circuit incomplete.", wrong: ["The switch absorbs the motor's movement.", "An open switch doubles the voltage.", "The motor must be broken."] },
  { key: "motor-closed", component: "motor", state: "closed", output: "turning", answer: "The suitable motor can turn because the closed switch completes the circuit.", wrong: ["The motor turns because closed means higher temperature.", "The switch replaces the wires.", "The motor creates the cell voltage."] },
  { key: "two-components-open", component: "lamp and buzzer in one series loop", state: "open", output: "both off", answer: "Both components are off because one open switch interrupts the only loop.", wrong: ["Only the component after the switch is affected.", "The first component uses all the electricity.", "The open switch powers whichever component is nearest."] },
  { key: "two-components-closed", component: "lamp and buzzer in one series loop", state: "closed", output: "both operating", answer: "Both suitable components can operate when the switch closes the single complete loop.", wrong: ["Only the first component can receive electricity.", "The buzzer passes unused electricity to the lamp.", "The switch chooses one component at random."] },
  { key: "switch-not-dimmer", component: "lamp", state: "closed then open", output: "on then off", answer: "A simple switch changes whether the path is complete; it does not act as a brightness dial.", wrong: ["Opening the switch makes the lamp slightly dimmer while current crosses the gap.", "The switch changes the bulb into a buzzer.", "The switch increases cell voltage each time it moves."] },
];

const voltageItems = [
  { key: "one-two-lamp", component: "rated lamp", first: "1 x 1.5 V cell", second: "2 matching 1.5 V cells in series", result: "The lamp is likely to be brighter with two cells in the safe simulator.", distractors: ["The lamp must be darker with two cells.", "The open switch explains the change although both are closed.", "Any number of any cells is always safe."] },
  { key: "two-three-lamp", component: "rated lamp", first: "2 matching 1.5 V cells", second: "3 matching 1.5 V cells", result: "The lamp may be brighter with three suitable cells, within the simulator's rated range.", distractors: ["Brightness cannot be compared when only cell number changes.", "Three cells always make every real bulb safe.", "The lamp must be broken in the two-cell circuit."] },
  { key: "one-two-buzzer", component: "rated buzzer", first: "1 x 1.5 V cell", second: "2 matching 1.5 V cells in series", result: "The buzzer is likely to be louder with two suitable cells in the safe simulator.", distractors: ["The buzzer must become silent.", "The switch creates the extra voltage.", "Use a mains socket to make the difference clearer."] },
  { key: "one-two-motor", component: "rated motor", first: "1 x 1.5 V cell", second: "2 matching 1.5 V cells in series", result: "The motor may turn faster with two suitable cells in the safe simulator.", distractors: ["The motor must reverse direction.", "Adding a cell opens the switch.", "Unknown battery packs are valid substitutes."] },
  { key: "same-total", component: "rated lamp", first: "2 cells supplying 3 V in total", second: "a teacher-approved 3 V supply in the simulator", result: "Similar output is a reasonable prediction because the total stated voltage is the same and other variables match.", distractors: ["The circuit with more drawn objects must be brighter.", "Voltage labels never matter.", "The real mains supply should be tested as a third comparison."] },
  { key: "lower-voltage", component: "rated lamp", first: "3 V total", second: "1.5 V total", result: "The lamp is likely to be dimmer at 1.5 V when the same suitable component and loop are used.", distractors: ["The lamp is certainly broken at 1.5 V.", "Lower voltage always makes the lamp louder.", "Move the cell closer instead."] },
  { key: "cell-direction", component: "rated lamp", first: "two matching cells aligned in series", second: "one cell reversed against the other in the simulator", result: "The reversed-cell model does not provide the same combined voltage as two correctly aligned cells.", distractors: ["Cell direction never matters in a diagram.", "The reversed cell safely triples the voltage.", "Test by holding bare wires on an unknown cell."] },
  { key: "not-unlimited", component: "rated buzzer", first: "two approved low-voltage cells", second: "unlimited extra cells", result: "Reject unlimited cells: use only the simulator's rated range or teacher-approved low-voltage setup.", distractors: ["More cells are always better and safer.", "Replace the cells with a mains plug.", "Try an unknown power pack briefly."] },
  { key: "voltage-evidence", component: "rated lamp", first: "Circuit A: 1.5 V, dim", second: "Circuit B: 3 V, brighter", result: "The evidence links greater supplied voltage with greater brightness in these matched simulator circuits.", distractors: ["The evidence proves every lamp at every voltage is safe.", "Brightness caused the voltage to increase.", "There is no changed variable."] },
];

const seriesItems = [
  { key: "one-loop", setup: "one cell, one closed switch and two lamps", answer: "All components are connected end-to-end in one complete loop.", wrong: ["Each lamp is drawn without a return path.", "The components must be in the same screen position.", "A wire may stop before reaching the cell."] },
  { key: "one-open-all-off", setup: "two lamps and one open switch in a series circuit", answer: "Both lamps are off because the gap interrupts the only path.", wrong: ["Only the lamp drawn after the switch is off.", "The first lamp stores all electricity.", "The open switch powers the nearest lamp."] },
  { key: "add-lamp", setup: "one cell and one lamp, then the same circuit with a second matching lamp in series", answer: "In the matched simulator, two lamps may be dimmer than one lamp with the same cells.", wrong: ["The second lamp creates extra cell voltage.", "The first lamp must use all electricity, leaving none.", "The number of components cannot affect output."] },
  { key: "remove-lamp", setup: "two matching lamps, then one lamp, with the same suitable cells", answer: "The remaining lamp may be brighter in the simulator when one series component is removed and the loop is reclosed.", wrong: ["Removing a lamp always leaves an unavoidable gap.", "The remaining lamp becomes a cell.", "The switch must be open."] },
  { key: "order", setup: "a cell, lamp and buzzer connected in one series loop, then redrawn in a different order", answer: "If the same components remain in one complete series loop, rearranging their drawing order does not create a new circuit type.", wrong: ["The first component always receives all electricity.", "Diagram order changes a lamp into a buzzer.", "Only rectangular diagrams work."] },
  { key: "trace", setup: "cell -> closed switch -> motor -> lamp -> return to cell", answer: "The trace returns to the starting cell without crossing a gap, so it is one complete series loop.", wrong: ["The path ends at the motor.", "A complete path does not need to return to the cell.", "The lamp uses the return wire."] },
  { key: "missing-return", setup: "cell -> lamp -> buzzer, with no wire back to the cell", answer: "The circuit is incomplete because the path does not return to the other cell terminal.", wrong: ["It is complete because three components are shown.", "The buzzer supplies the missing electricity.", "Move the symbols closer without adding a connection."] },
  { key: "two-switches", setup: "one series loop with two switches, one closed and one open", answer: "The components are off because either open switch is enough to break the only loop.", wrong: ["One closed switch cancels one open switch.", "Only the cell between switches works.", "The switches add their states to make half power."] },
  { key: "same-current-misconception", setup: "two lamps in one complete series circuit", answer: "Electricity is not used up by the first lamp; explain outputs from the complete circuit and its components.", wrong: ["The first lamp consumes everything before the second.", "The second lamp works only by storing yesterday's electricity.", "Swap their colours to share electricity."] },
];

const diagnosisItems = [
  { key: "open-switch", clue: "lamp off; cell suitable; switch open; wires connected", answer: "Close the switch in the simulator because the open switch is the evidenced gap.", wrong: ["Add unlimited cells.", "Assume the lamp is broken without testing the switch.", "Connect to mains electricity."] },
  { key: "loose-wire", clue: "buzzer silent; switch closed; one simulator wire not connected", answer: "Reconnect the indicated simulator wire to complete the loop.", wrong: ["The buzzer used up the electricity.", "Hold real bare wires together by hand.", "Add an unknown battery pack."] },
  { key: "fewer-cells", clue: "same lamp is dim with one cell and brighter with two suitable cells", answer: "The dim output is explained by the lower cell number in this matched comparison, not proof of a broken lamp.", wrong: ["A dim lamp is always broken.", "The switch must be open in both circuits.", "Use a wall socket to test brightness."] },
  { key: "reversed-cell", clue: "two-cell simulator circuit is unexpectedly dim; one cell symbol faces against the other", answer: "Check and correct the cell alignment in the simulator before changing another variable.", wrong: ["Cell orientation cannot matter.", "Touch the terminals to test them.", "Replace both with an unknown source."] },
  { key: "extra-component", clue: "one lamp becomes dimmer after a second matching lamp is added in series; cells unchanged", answer: "The added series component is the changed variable linked to the lower brightness.", wrong: ["The first lamp has suddenly broken.", "The switch created another lamp.", "Distance from the cell is the only cause."] },
  { key: "wrong-symbol", clue: "pictorial circuit has a motor, but the diagram uses a lamp symbol", answer: "Replace the lamp symbol with the recognised motor symbol while keeping the same connections.", wrong: ["Change the real motor into a lamp.", "Keep any symbol because diagrams are decorative.", "Delete the return wire."] },
  { key: "closed-no-cell", clue: "lamp and closed switch form a loop, but no cell is shown", answer: "The diagram lacks a source cell, so matching the switch state alone cannot make the lamp operate.", wrong: ["The closed switch is the power source.", "The lamp creates its own voltage.", "Add a mains plug symbol."] },
  { key: "table-confound", clue: "Circuit A has one cell and one lamp; Circuit B has two cells and two different lamps", answer: "The comparison changes more than one variable, so it cannot isolate the effect of cell number.", wrong: ["The table proves two cells caused every difference.", "Different lamps are always identical.", "Repeat using unknown batteries."] },
  { key: "silent-rated", clue: "buzzer silent; approved cells; switch closed; diagram shows a gap before the buzzer", answer: "Use the visible gap as evidence of an incomplete circuit before claiming the buzzer is faulty.", wrong: ["Silent always means broken.", "Add cells until something happens.", "Bypass adult-approved equipment."] },
];

const fairItems = [
  { key: "cell-number", question: "How does the number of matching cells affect lamp brightness?", change: "number of approved matching cells", measure: "lamp brightness", keep: "same rated lamp, wires, switch state and simulator", answer: "Change only cell number, measure brightness, and keep the lamp, wires and closed switch the same." },
  { key: "voltage", question: "How does stated supply voltage affect a rated motor's speed?", change: "approved simulator voltage within the rated range", measure: "motor speed reading", keep: "same motor, loop, switch and measurement method", answer: "Vary only the safe simulator voltage and compare the same motor's speed reading." },
  { key: "buzzer-cells", question: "How does cell number affect buzzer loudness?", change: "number of matching approved cells", measure: "simulator loudness meter", keep: "same rated buzzer, circuit and closed switch", answer: "Change only matching cell number and read the same loudness meter for the same buzzer." },
  { key: "lamp-count", question: "How does adding a matching lamp in series affect brightness?", change: "one or two matching lamps", measure: "brightness of a named lamp", keep: "same approved cells, wire model and closed switch", answer: "Change only the number of matching series lamps and compare the named lamp with all other variables fixed." },
  { key: "switch-state", question: "What is the effect of switch position on a buzzer?", change: "open or closed switch", measure: "buzzer sounding or silent", keep: "same buzzer, cells, wires and loop", answer: "Change only switch state and record whether the same buzzer sounds in the same circuit." },
  { key: "repeat", question: "How can the team make brightness findings more dependable?", change: "repeat the same approved settings", measure: "brightness each time", keep: "the complete setup and method", answer: "Repeat each safe simulator setting, record every result and check for consistency." },
  { key: "order-control", question: "Does symbol position on the page alter a series circuit's output?", change: "diagram layout only", measure: "whether connections and predicted output stay equivalent", keep: "same components and one-loop connections", answer: "Redraw only the layout while preserving every component and connection, then compare the equivalent diagrams." },
  { key: "record-table", question: "Which results table supports a fair cell investigation?", change: "cell number in one clear column", measure: "brightness in one clear column", keep: "columns confirming same bulb and closed switch", answer: "Use a table that records cell number and brightness while confirming the bulb and switch state stayed the same." },
  { key: "unsafe-proposal", question: "Should an unknown home battery pack be added as a test level?", change: "unsafe unknown source", measure: "none", keep: "safety gate", answer: "Reject the unknown source and use only the safe simulator or teacher-approved low-voltage equipment." },
];

const misconceptionItems = [
  { key: "electricity-used-up", claim: "The first lamp uses all the electricity, so the second gets none.", answer: "Reject: trace the complete series loop; component outputs depend on the whole suitable circuit, not electricity being used up in order.", tag: "electricity_used_up_first" },
  { key: "more-always-safe", claim: "Adding more cells always improves a circuit and is always safe.", answer: "Reject: use only the simulator's rated range or teacher-approved low-voltage cells; more is not automatically suitable or safe.", tag: "more_cells_always_safe" },
  { key: "mains-test", claim: "A mains socket is a useful comparison for a school circuit.", answer: "Reject: mains electricity is never used in these investigations; use the safe simulator or teacher-approved low-voltage equipment.", tag: "unsafe_mains_comparison" },
  { key: "dim-broken", claim: "A dim lamp must be broken.", answer: "Reject: first use evidence about cell number, component count, switch state and circuit completeness in the simulator.", tag: "dim_means_broken" },
  { key: "switch-strength", claim: "An open switch makes electricity weaker but still lets it cross the gap.", answer: "Reject: an open switch makes the path incomplete, so the component is off or silent.", tag: "switch_changes_strength" },
  { key: "symbol-picture", claim: "A good circuit symbol should look like a realistic photograph of the component.", answer: "Reject: recognised circuit symbols are agreed simple marks that show components and connections clearly.", tag: "symbol_looks_like_object" },
  { key: "nearest-cell", claim: "The component nearest the cell gets the most electricity.", answer: "Reject: physical distance on a simple series diagram does not decide output; inspect the complete circuit and its variables.", tag: "distance_controls_output" },
  { key: "any-battery", claim: "Any battery pack is fine if the test is quick.", answer: "Reject: never test unknown power sources; use only the simulator or equipment selected and supervised by the teacher.", tag: "unknown_power_is_safe" },
  { key: "unsafe-fix", claim: "A learner should hold loose real wires together to find the fault.", answer: "Reject: diagnose and reconnect only inside the simulator, or let the teacher manage approved low-voltage equipment.", tag: "unsafe_manual_repair" },
];

const candidates = [
  ...expand("symbols", 38, symbolItems, buildSymbol),
  ...expand("component-effects", 37, componentItems, buildComponentEffect),
  ...expand("voltage-cells", 37, voltageItems, buildVoltage),
  ...expand("series-circuits", 36, seriesItems, buildSeries),
  ...expand("diagnosis", 36, diagnosisItems, buildDiagnosis),
  ...expand("fair-investigations", 36, fairItems, buildFairInvestigation),
  ...expand("misconceptions-safety", 35, misconceptionItems, buildMisconception),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Cross-year review bank reaches the 260-item pilot target with five preserved curated variants and 255 deterministic candidates covering circuit symbols and diagrams, component effects, voltage and cell reasoning, series circuits, diagnosis, fair investigations, misconceptions and electrical safety. Every generated investigation is simulator-led, rejects mains and unknown power sources, and includes SEND multimodal routes, supported non-drag interactions, rich evidence feedback and mission-based progress without speed or loss pressure. Independent science, teacher, accessibility, safeguarding, local symbol-convention and renderer review remains required before promotion.";

validateBank(pack, curated, candidates);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`electricity-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`electricity-bank strands=${summary(candidates, (variant) => variant.body.science_strand)}`);
console.log(`electricity-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`electricity-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`electricity-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 electricity bank is out of date; run generate-y6-electricity-bank.mjs --write.");
  console.log("electricity-bank deterministic check passed");
} else {
  console.log("electricity-bank dry-run; pass --write to update the pack");
}

function buildSymbol(item, mission, index, id) {
  const diagramBlueprint = index % 2 === 0 ? "symbols-and-components-match" : "pictorial-to-symbol-series-diagrams";
  return candidate({ id, format: "symbol-diagram-build", blueprint: diagramBlueprint, band: diagramBlueprint === "symbols-and-components-match" ? "intro" : "secure", strand: "circuit_symbols_diagrams", mission, prompt: `Symbol scanner ${index + 1} at the ${mission.zone}: choose the recognised representation for ${item.component}.`, body: { component: item.component, diagram_task: diagramBlueprint === "pictorial-to-symbol-series-diagrams" ? `Place the selected symbol in the one-loop diagram to ${mission.goal}.` : "Match the labelled component to its symbol.", choices: [item.symbol, ...item.distractors] }, answer: item.symbol, hints: ["Use agreed circuit marks, not the real object's colour or appearance.", `Check the mission symbol key. ${item.note}`], explanation: `${item.note} Circuit diagrams communicate which components are present and how they connect; decorative appearance and exact page position do not replace recognised symbols.`, tag: "symbol_looks_like_object", feedback: "Compare the pictorial component, the labelled symbol key and the text-only component list before rebuilding the same connections." });
}

function buildComponentEffect(item, mission, index, id) {
  return candidate({ id, format: "evidence-explain-choice", blueprint: "switch-state-output-reasons", band: "developing", strand: "component_effects", mission, prompt: `Control-deck mission ${index + 1}: a safe series circuit has a suitable ${item.component} and the switch is ${item.state}. The observed output is ${item.output}. Which explanation fits?`, body: { component: item.component, switch_state: item.state, observed_output: item.output, choices: [item.answer, ...item.wrong] }, answer: item.answer, hints: ["Trace from one cell terminal around the whole loop and back.", "Decide whether the switch makes a gap; do not describe it as a strength dial."], explanation: `${item.answer} The observation is explained by circuit completeness and the stated suitable components, not by distance, stored electricity or the switch creating voltage.`, tag: "switch_changes_strength", feedback: "Freeze the circuit, toggle only the switch, and compare the complete-path text trace with the visual loop." });
}

function buildVoltage(item, mission, index, id) {
  return candidate({ id, format: "circuit-variable-lab", blueprint: "cell-number-brightness-investigations", band: "expected", strand: "voltage_cell_reasoning", mission, prompt: `Voltage lab ${index + 1}: compare ${item.first} with ${item.second} using the same ${item.component} in the safe rated simulator. Which prediction or conclusion is justified?`, body: { circuit_a: item.first, circuit_b: item.second, component: item.component, changed_variable: "cell number or stated supplied voltage", choices: [item.result, ...item.distractors] }, answer: item.result, hints: ["Name the changed cell or voltage variable and check that the component and switch state match.", "Use cautious evidence language such as likely or may, and stay inside the rated simulator range."], explanation: `${item.result} This conclusion is limited to the matched safe simulator circuits; it does not justify unlimited cells, unknown batteries or mains electricity.`, tag: item.key === "not-unlimited" ? "more_cells_always_safe" : "voltage_not_linked_to_output", feedback: "Return both circuits to identical settings, change one approved voltage variable, then inspect the output meters side by side." });
}

function buildSeries(item, mission, index, id) {
  return candidate({ id, format: "symbol-diagram-build", blueprint: "pictorial-to-symbol-series-diagrams", band: "secure", strand: "series_circuits", mission, prompt: `One-loop navigator ${index + 1}: the mission setup is ${item.setup}. Which statement correctly reads or represents this series circuit?`, body: { setup: item.setup, loop_type: "simple series", choices: [item.answer, ...item.wrong], text_trace_available: true }, answer: item.answer, hints: ["Trace one continuous path from one cell terminal through every component and back.", "Check connections and gaps; component screen position does not show where electricity is 'used up'."], explanation: `${item.answer} A simple series circuit has one path, so any gap interrupts the loop and every diagram must preserve the stated components and connections.`, tag: item.key === "same-current-misconception" ? "electricity_used_up_first" : "series_path_not_traced", feedback: "Use numbered connection points or a physical loop card instead of dragging, then read the circuit as an ordered text trace." });
}

function buildDiagnosis(item, mission, index, id) {
  return candidate({ id, format: "evidence-explain-choice", blueprint: "debug-dim-dark-silent-components", band: "stretch", strand: "circuit_diagnosis", mission, prompt: `Fault-finder mission ${index + 1}: the simulator clue reads '${item.clue}'. Which diagnosis or next simulator action uses the evidence safely?`, body: { observation: item.clue, diagnosis_mode: "simulator_only", choices: [item.answer, ...item.wrong] }, answer: item.answer, hints: ["Use the visible clue before assuming a component is broken.", "Change or inspect one simulator feature at a time; never propose hands-on work with unknown or mains power."], explanation: `${item.answer} This response follows the stated evidence, keeps the diagnosis inside the simulator and avoids changing several variables before the cause is identified.`, tag: item.key === "fewer-cells" ? "dim_means_broken" : "unsupported_fault_claim", feedback: "Highlight the observation, list possible causes, cross out causes contradicted by the diagram, then run one safe simulator check." });
}

function buildFairInvestigation(item, mission, index, id) {
  const distractors = [
    `Change ${item.change} and several other components together, then guess ${item.measure}.`,
    "Use a different circuit each time without recording which variables changed.",
    "Include an unknown battery or mains electricity to widen the range.",
  ];
  return candidate({ id, format: "component-output-table", blueprint: "component-output-evidence-explanations", band: "secure", strand: "fair_investigations", mission, prompt: `Investigation planner ${index + 1}: ${item.question} Which plan is fair, measurable and electrically safe?`, body: { question: item.question, change: item.change, measure: item.measure, keep_same: item.keep, table_columns: ["test", "changed variable", "kept same", "observation"], choices: [item.answer, ...distractors] }, answer: item.answer, hints: [`Change: ${item.change}. Measure: ${item.measure}.`, `Keep the comparison fair by holding constant: ${item.keep}.`], explanation: `${item.answer} A fair investigation changes one planned variable, measures one relevant output, records repeated observations where useful and uses only approved simulator settings.`, tag: item.key === "unsafe-proposal" ? "unknown_power_is_safe" : "changes_multiple_variables", feedback: "Build a CHANGE-MEASURE-KEEP SAME table, then pass the simulator safety gate before collecting evidence stamps." });
}

function buildMisconception(item, mission, index, id) {
  const choices = [item.answer, "Accept the claim because it uses an electricity word.", "Test the claim using mains electricity for a stronger result.", "Accept it without tracing the circuit or checking evidence."];
  return candidate({ id, format: "component-output-table", blueprint: "electricity-retrieval-mix", band: "retrieval", strand: "misconceptions_safety", mission, prompt: `Safety-and-science briefing ${index + 1}: a crew member claims, '${item.claim}' Which response repairs the idea safely?`, body: { claim: item.claim, retrieval_mix: ["vocabulary", "safety", "symbols", "switches", "component output"], choices }, answer: item.answer, hints: ["Separate the scientific claim from the safety decision.", "Use a diagram, output table or safe simulator result as evidence; mains and unknown sources are never options."], explanation: `${item.answer} The correction gives a circuit-based reason and keeps investigation within the simulator or teacher-approved low-voltage equipment.`, tag: item.tag, feedback: "Choose a visual diagram, spoken explanation, text trace or component cards to test the claim, then record one evidence-backed safety rule." });
}

function candidate({ id, format, blueprint, band, strand, mission, prompt, body, answer, hints, explanation, tag, feedback }) {
  const fullId = `${prefix}${id}`;
  const choices = rotate([...new Set(body.choices)], fullId.length % body.choices.length);
  return {
    id: fullId,
    format,
    body: {
      prompt,
      ...body,
      choices,
      science_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${strand}_safe_evidence_reasoning`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      safety_context: "simulator_or_teacher_approved_low_voltage_only",
      simulator_only_learner_actions: true,
      mains_electricity_allowed: false,
      unknown_power_sources_allowed: false,
      adult_manages_physical_equipment: true,
      response_mode: "tap_keyboard_switch_oral_or_partner_record",
      interaction_support: { keyboard: true, switch_scan: true, touch: true, oral_or_partner_response: true, precision_drag_required: false, component_add_remove_buttons: true, undo_available: true },
      multimodal_routes: {
        visual: "labelled colour-independent circuit diagram and output meter",
        text: "ordered component-and-connection list with state and observation",
        audio_or_adult_read: "neutral prompt, circuit state and table reading without revealing the answer",
        tactile_or_manipulative: "teacher-managed unpowered symbol cards or loop board; no learner handling of powered unknown equipment",
        reduced_load: "one variable, one loop and one evidence row visible at a time",
      },
      static_alternative: "numbered_symbols_connections_and_results_table",
      audio_replay: true,
      colour_required: false,
      timer_allowed: false,
      speed_score_allowed: false,
      leaderboard_allowed: false,
      mission: {
        station: mission.station,
        zone: mission.zone,
        goal: mission.goal,
        reward: "restore one functional station module and add one evidence patch to the crew log",
        evidence_to_unlock: "name the changed variable or circuit clue and justify the conclusion",
        loss_on_error: false,
        streak_pressure: false,
        retry_message: "The circuit has given the crew a useful clue. Freeze the model, inspect one variable, and try another evidence route.",
      },
    },
    expected_answer: { value: answer },
    hints,
    explanation,
    feedback: {
      correct: `Mission evidence secured. ${explanation}`,
      investigate_again: feedback,
      misconception_repair: `That option may match '${tag}'. ${hints[1]}`,
      safety_reminder: "Use only the simulator or teacher-approved low-voltage equipment. Never use mains electricity, unknown power sources or learner-led real-circuit repairs.",
    },
    difficulty: { intro: 2, developing: 4, expected: 5, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "symbol-diagram-build" ? "symbol-pictorial-morph" : format === "circuit-variable-lab" ? "cell-count-brightness-meter" : format === "component-output-table" ? "evidence-row-highlight" : "circuit-debug-clue",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    const mission = missions[Math.floor(index / items.length) % missions.length];
    return builder(item, mission, index, `${label}-${item.key}-${mission.key}`);
  });
}

function validateBank(currentPack, authored, generated) {
  if (authored.length !== 5) throw new Error(`Expected five curated variants, found ${authored.length}.`);
  if (generated.length !== pilotTarget - authored.length || currentPack.question_variants.length !== pilotTarget) throw new Error(`Expected ${pilotTarget} total variants with ${pilotTarget - authored.length} generated.`);
  const blueprintMap = new Map(currentPack.variant_blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  const strands = new Set();
  const actualFormats = new Set();
  const actualBlueprints = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate variant id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer?.value)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate prompt/answer/format signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || blueprint.difficulty_band !== variant.body.difficulty_band) throw new Error(`${variant.id} does not match its blueprint format and band.`);
    if (!formats.has(variant.format) || variant.status !== "review") throw new Error(`${variant.id} has unsupported format or status.`);
    if (variant.body.safety_context !== "simulator_or_teacher_approved_low_voltage_only" || !variant.body.simulator_only_learner_actions || variant.body.mains_electricity_allowed !== false || variant.body.unknown_power_sources_allowed !== false || !variant.body.adult_manages_physical_equipment) throw new Error(`${variant.id} violates electrical safety policy.`);
    if (!variant.body.interaction_support?.keyboard || !variant.body.interaction_support?.switch_scan || !variant.body.interaction_support?.oral_or_partner_response || variant.body.interaction_support?.precision_drag_required !== false) throw new Error(`${variant.id} lacks supported interactions.`);
    if (!variant.body.multimodal_routes?.visual || !variant.body.multimodal_routes?.text || !variant.body.multimodal_routes?.audio_or_adult_read || !variant.body.multimodal_routes?.tactile_or_manipulative || !variant.body.multimodal_routes?.reduced_load) throw new Error(`${variant.id} lacks SEND multimodal routes.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.leaderboard_allowed !== false || variant.body.mission?.loss_on_error !== false || variant.body.mission?.streak_pressure !== false || !variant.body.mission?.evidence_to_unlock) throw new Error(`${variant.id} has unsuitable mission gamification.`);
    if (!variant.feedback?.correct || !variant.feedback?.investigate_again || !variant.feedback?.misconception_repair || !variant.feedback?.safety_reminder || variant.hints.length < 2 || variant.explanation.length < 100) throw new Error(`${variant.id} lacks rich feedback.`);
    if (!Array.isArray(variant.body.choices) || variant.body.choices.length < 4 || new Set(variant.body.choices).size !== variant.body.choices.length || variant.body.choices.filter((choice) => choice === variant.expected_answer.value).length !== 1) throw new Error(`${variant.id} has invalid choices.`);
    strands.add(variant.body.science_strand);
    actualFormats.add(variant.format);
    actualBlueprints.add(variant.body.variant_blueprint_id);
  }
  requireCoverage("strands", ["circuit_symbols_diagrams", "component_effects", "voltage_cell_reasoning", "series_circuits", "circuit_diagnosis", "fair_investigations", "misconceptions_safety"], strands);
  requireCoverage("formats", [...formats], actualFormats);
  requireCoverage("blueprints", [...blueprintMap.keys()], actualBlueprints);
}

function requireCoverage(label, required, actual) { const missing = required.filter((item) => !actual.has(item)); if (missing.length) throw new Error(`Generated bank is missing ${label}: ${missing.join(", ")}.`); }
function rotate(items, amount) { const offset = amount % items.length; return items.slice(offset).concat(items.slice(0, offset)); }
function normalise(value) { return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim(); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
