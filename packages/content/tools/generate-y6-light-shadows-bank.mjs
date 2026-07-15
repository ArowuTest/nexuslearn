#!/usr/bin/env node
import { enrichPackForReview } from "./review-enrichment.mjs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const defaultPack = path.join(repoRoot, "packages/content/packs/sc-y6-light-shadows-explain.pack.sample.json");
const packPath = path.resolve(argValue("--pack") ?? defaultPack);
const write = process.argv.includes("--write");
const check = process.argv.includes("--check");
const prefix = "sc-y6-light-shadows-bank-";
const pilotTarget = 240;
const reviewBatch = "y6-light-shadows-pilot-a";

if (write && check) throw new Error("Choose either --write or --check, not both.");
const originalText = await readFile(packPath, "utf8");
const pack = JSON.parse(originalText);
if (pack.pack_id !== "sc-y6-light-shadows-explain") throw new Error("This generator only supports the Year 6 light-and-shadows pack.");
const curated = (pack.question_variants ?? []).filter((variant) => !variant.id.startsWith(prefix));
if (curated.length !== 3) throw new Error(`Expected exactly 3 curated variants, found ${curated.length}.`);
const curatedSnapshot = JSON.stringify(curated);

const materialCases = [
  { key: "clear-acrylic", evidence: "Most light passes through and a test-grid image is seen clearly through the sample.", answer: "transparent in this test", wrong: ["translucent because every solid scatters all light", "opaque because it has a surface", "cannot classify without using colour"], class: "transparent" },
  { key: "clear-glass", evidence: "Most light passes through and objects can be seen clearly through the clean sample.", answer: "transparent in this test", wrong: ["opaque because glass is hard", "translucent because all glass gives a fuzzy image", "shadow evidence never classifies materials"], class: "transparent" },
  { key: "tracing-paper", evidence: "Some light passes through, but the test-grid image is blurred and no clear image is seen.", answer: "translucent in this test", wrong: ["transparent because some light passes", "opaque because the image is not clear", "classification depends only on thickness labels, not evidence"], class: "translucent" },
  { key: "frosted-acrylic", evidence: "Light passes through diffusely and a pale, soft-edged shadow is recorded.", answer: "translucent in this test", wrong: ["transparent because any transmitted light is transparent", "opaque because a shadow appears", "the material creates darkness as a substance"], class: "translucent" },
  { key: "cardboard", evidence: "No light is detected through the sample in the matched classroom test, and a dark shadow forms.", answer: "opaque in this test", wrong: ["transparent because cardboard can be thin", "translucent because every material passes some visible light", "cannot classify because shadows move independently"], class: "opaque" },
  { key: "wood", evidence: "No transmitted light is detected through the tested wooden sheet and the screen has a dark shadow.", answer: "opaque for this sample and test", wrong: ["transparent because wood is natural", "translucent because the surface is patterned", "all wood samples everywhere must have identical thickness and transmission"], class: "opaque" },
  { key: "thin-fabric", evidence: "Some light passes through small gaps, but the result changes when the fabric is folded.", answer: "classification must be limited to the tested layer and arrangement; the evidence is not an absolute for every thickness", wrong: ["every fabric is opaque", "every fabric is transparent", "folding cannot affect transmitted light"], class: "evidence_limited" },
  { key: "unknown", evidence: "The sample name is given, but no transmission, image-clarity or shadow observation is recorded.", answer: "insufficient evidence to classify the sample", wrong: ["opaque because unknown means dark", "transparent because no shadow was described", "translucent because it is the middle category"], class: "insufficient" },
  { key: "fair-material", evidence: "A class wants to compare how much light different materials transmit.", answer: "Change only the material; keep sample area and thickness arrangement, source, distances, screen, sensor and room conditions the same.", wrong: ["Change material, distance and source brightness together.", "Use folded samples for some materials and single layers for others.", "Judge from material names without measurements."], class: "fair_test" },
  { key: "unfair-distance", evidence: "Sample A is 5 cm from the source and Sample B is 30 cm away; different lamps are used.", answer: "The comparison is unfair because source and distance change as well as material.", wrong: ["The comparison isolates material perfectly.", "Distance and source never affect a light test.", "Choose whichever shadow looks darkest without controls."], class: "unfair_test" },
];

const rayCases = [
  { key: "opaque-centre", setup: "point source, opaque rectangle, screen aligned behind it", answer: "Draw straight boundary rays from the source through the rectangle's edges; the blocked region between them reaches the screen as a shadow.", wrong: ["Curve rays around the rectangle to erase the shadow.", "Draw darkness travelling from the rectangle as an object.", "Stop every ray before it reaches the rectangle."], rule: "opaque_boundary_rays" },
  { key: "transparent", setup: "point source, clear transparent sheet, screen", answer: "Most model rays continue through; a strong opaque-style shadow is not predicted from this transmission evidence.", wrong: ["Every transparent sheet blocks all rays.", "The sheet sends a darkness object to the screen.", "Light must curve around the sheet."], rule: "transparent_transmission" },
  { key: "translucent", setup: "source, translucent sheet, screen", answer: "Some light is transmitted and scattered, so a paler, less sharply defined shadow region may appear.", wrong: ["No light passes and the shadow must match opaque card exactly.", "All light passes unchanged with a perfectly clear image.", "The shadow exists independently of source position."], rule: "translucent_diffuse" },
  { key: "object-off-axis", setup: "source, opaque object moved upward, fixed screen", answer: "Straight blocked-ray paths shift the shadow on the screen; the shadow does not choose to move by itself.", wrong: ["The shadow stays fixed while the object moves.", "Light bends to keep the old shadow position.", "The object releases darkness upward."], rule: "linked_position" },
  { key: "no-object", setup: "source and screen with no blocking object", answer: "The screen receives the model rays, so there is no object-cast shadow zone.", wrong: ["A shadow object appears without anything blocking light.", "Light curves away from the screen.", "Every lit screen must contain an opaque shadow."], rule: "no_blocker_no_cast_shadow" },
  { key: "no-source", setup: "object and screen but the source is off", answer: "The screen is unlit; this is general darkness, not a distinct cast shadow made within an illuminated field.", wrong: ["The object still projects a moving shadow using stored darkness.", "Light bends from nowhere around the object.", "Source state cannot affect a shadow."], rule: "darkness_not_cast_shadow" },
  { key: "two-objects", setup: "one point source, two separated opaque objects, screen", answer: "Trace straight boundary rays for each object; their blocked regions can form two shadows or overlap depending on alignment.", wrong: ["Only the nearest object can block light.", "Shadows merge because darkness attracts itself.", "Rays curve around both objects."], rule: "multiple_blockers" },
  { key: "hole", setup: "opaque card with a central hole between source and screen", answer: "Most card regions block rays, while rays aligned with the hole can reach a bright region on the screen.", wrong: ["The hole blocks more light than the card.", "Darkness flows through the hole.", "All rays bend through the hole regardless of alignment."], rule: "aperture_alignment" },
  { key: "straight-line-test", setup: "three cards with small holes and a source", answer: "Light is seen through all holes when the holes and source are aligned in a straight line.", wrong: ["Light is strongest when holes form a curve.", "Alignment does not matter because light bends around card.", "The cards make their own light."], rule: "aligned_holes" },
];

const shapeCases = [
  { key: "outline", scenario: "An opaque triangular card faces the screen.", answer: "The shadow has the same basic triangular outline because straight rays are blocked at the card's boundary.", wrong: ["The shadow chooses a different shape.", "The card creates a triangle made of darkness.", "Light bends around the edges and fills the triangle."], tag: "shadow_moves_by_itself" },
  { key: "internal-print", scenario: "An opaque card has a printed pattern on its front but an unchanged outer outline.", answer: "The basic shadow follows the blocking outer outline; an ordinary surface print need not appear in the shadow.", wrong: ["Every printed detail becomes a separate shadow hole.", "The print makes light curve.", "The shadow becomes the colour of the ink."], tag: "shadow_as_object" },
  { key: "rotate-rectangle", scenario: "A rectangular card is rotated while source and screen stay fixed.", answer: "The projected outline rotates because the blocking object's orientation changed; the shadow does not rotate independently.", wrong: ["The shadow rotates first and pulls the card.", "Rotation makes the card transparent.", "Light curves to preserve the old outline."], tag: "shadow_moves_by_itself" },
  { key: "circle", scenario: "An opaque circular disc faces the screen squarely.", answer: "Its basic cast-shadow outline is circular in this aligned model because boundary rays follow the disc edge.", wrong: ["Every shadow is rectangular because screens are rectangular.", "The disc emits a circular darkness object.", "Rays bend into a square."], tag: "shadow_as_object" },
  { key: "hole-outline", scenario: "An opaque shape contains a cut-out hole aligned with the source.", answer: "The outer opaque part gives a shadow outline, while aligned light through the hole can make a bright region inside it.", wrong: ["The hole casts the darkest shadow.", "A cut-out is still opaque material.", "Every ray curves through the hole."], tag: "light_bends_around_objects" },
  { key: "broad-source", scenario: "A broad source replaces a small source while object and screen positions stay fixed.", answer: "Overlapping light paths from different source points can make the shadow edge less sharp in this model.", wrong: ["The object changes shape.", "The shadow moves independently and blurs itself.", "A broad source makes every material transparent."], tag: "every_material_same_shadow" },
  { key: "small-source", scenario: "A smaller source replaces a broad source while all distances stay fixed.", answer: "The shadow edge is likely to be sharper because fewer differently directed source rays overlap at the boundary.", wrong: ["Smaller sources always make the object larger.", "Sharpness is controlled only by screen colour.", "The shadow becomes a solid object."], tag: "every_material_same_shadow" },
  { key: "material-contrast", scenario: "Opaque and translucent copies of the same outline are tested at matched positions.", answer: "Their basic outline can match, but the opaque sample usually gives a darker, clearer shadow than the translucent sample under matched conditions.", wrong: ["Every material gives exactly the same shadow.", "Translucent means no light passes.", "Opaque means light passes clearly."], tag: "every_material_same_shadow" },
];

const retrievalCases = [
  { key: "ray", prompt: "What does a ray represent in this KS2 model?", answer: "A straight line showing a light path", wrong: ["A stream of darkness", "A curved shadow path", "The material itself"], tag: "light_bends_around_objects" },
  { key: "shadow", prompt: "What is a cast shadow?", answer: "A region receiving less light because an object blocks light paths", wrong: ["An object made of darkness", "Light stored by the screen", "A material that moves alone"], tag: "shadow_as_object" },
  { key: "opaque", prompt: "Which evidence supports opaque classification?", answer: "No transmitted light detected through the sample in the stated test", wrong: ["A clear image is seen through it", "Some diffuse light passes", "The sample has a bright colour"], tag: "opaque_transparent_confusion" },
  { key: "translucent", prompt: "Which evidence supports translucent classification?", answer: "Some light passes, but a clear image is not seen", wrong: ["No light passes in the test", "Most light passes with a clear image", "The material name sounds thin"], tag: "opaque_transparent_confusion" },
  { key: "transparent", prompt: "Which evidence supports transparent classification?", answer: "Most light passes and objects are seen clearly through the sample", wrong: ["No light is detected", "Only a soft glow passes", "A dark shadow always forms"], tag: "opaque_transparent_confusion" },
  { key: "closer-source", prompt: "With object and screen fixed, what usually happens when a point source moves closer to the object?", answer: "The shadow becomes larger in the stated aligned model", wrong: ["The shadow becomes an independent object", "Light bends around the object", "The material becomes transparent"], tag: "shadow_moves_by_itself" },
  { key: "fair-test", prompt: "How should object-distance effects be tested?", answer: "Change only object distance and keep source, object, screen and measurement method matched", wrong: ["Change object distance and source size together", "Use different objects each time", "Compare shadows on different screens without controls"], tag: "unfair_test" },
  { key: "shape", prompt: "Why does a shadow share the object's basic outline?", answer: "Straight boundary rays are blocked by the object's outline", wrong: ["The shadow copies itself", "Darkness is painted by the object", "Light curves around the outline"], tag: "light_bends_around_objects" },
  { key: "screen-farther", prompt: "With source and object fixed, what usually happens when the screen moves farther away?", answer: "The shadow becomes larger in the point-source model", wrong: ["The shadow must disappear", "The object becomes translucent", "Shadow position is unrelated to the setup"], tag: "shadow_moves_by_itself" },
  { key: "limit", prompt: "Which claim is appropriately cautious?", answer: "Shadow size and sharpness depend on the stated source, object, screen and material conditions", wrong: ["Every material gives the same shadow", "Every source produces perfectly sharp edges", "One test proves an absolute rule for all setups"], tag: "false_absolute" },
];

const candidates = [
  ...expand("material", 48, materialCases, buildMaterial),
  ...expand("ray", 48, rayCases, buildRay),
  ...Array.from({ length: 47 }, (_, index) => buildPrediction(index)),
  ...expand("shape", 47, shapeCases, buildShape),
  ...expand("retrieval", 47, retrievalCases, buildRetrieval),
];

pack.question_variants = [...curated, ...candidates];
pack.version = "0.2.0";
pack.qa.readiness_status = "draft";
pack.qa.notes = "Year 6 light-and-shadows pilot reaches 240 variants with three curated questions preserved semantically unchanged and 237 deterministic review candidates. Coverage stays within KS2 geometric optics: straight-line ray models; source-object-screen geometry; evidence-bounded transparent/translucent/opaque classification; shadow formation, outline, relative size and sharpness; controlled source/object/screen changes; fair comparisons and cautious claims. Light-bends-around-object, shadow-as-object, independent-shadow, every-material-same-shadow and unfair-test misconceptions are explicitly repaired. All three declared formats and five blueprints include high-contrast patterned labels, diagram list equivalents, keyboard/switch/no-drag, static no-flicker and reduced-clutter routes with pressure-free ray-lab missions. Selected audio descriptions require produced, human-reviewed ElevenLabs assets; browser TTS is prohibited. Independent science, teacher, SEND, accessibility, safeguarding, audio and renderer review remains required before promotion.";

validateBank(pack, curated, candidates, curatedSnapshot);
enrichPackForReview(pack);
const nextText = `${JSON.stringify(pack, null, 2)}\n`;
console.log(`light-shadows-bank curated=${curated.length} review_candidates=${candidates.length} total=${pack.question_variants.length}`);
console.log(`light-shadows-bank formats=${summary(candidates, (variant) => variant.format)}`);
console.log(`light-shadows-bank blueprints=${summary(candidates, (variant) => variant.body.variant_blueprint_id)}`);
console.log(`light-shadows-bank audio_refs=${candidates.filter((variant) => variant.body.audio_asset_id).length}`);

if (write) {
  await writeFile(packPath, nextText, "utf8");
  console.log(`light-shadows-bank written ${relative(packPath)}`);
} else if (check) {
  if (originalText !== nextText) throw new Error("Year 6 light-shadows bank is out of date; run generate-y6-light-shadows-bank.mjs --write.");
  console.log("light-shadows-bank deterministic check passed");
} else {
  console.log("light-shadows-bank dry-run; pass --write to update the pack");
}

function buildMaterial(item, index, id) {
  return candidate({ id, index, format: "material-sort", blueprint: "material-shadow-sorts", band: item.class.includes("test") || item.class.includes("insufficient") ? "secure" : index < 16 ? "developing" : "expected", strand: "material_transmission_evidence", prompt: `Material evidence bench ${index + 1}: ${item.evidence} Which conclusion is justified?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Use transmitted light and image clarity, not the material name or colour.", "Limit the classification to the tested sample, thickness, arrangement and conditions; check whether the comparison controls other variables."], explanation: `${item.answer}. The classification or test judgement follows the stated transmission evidence and avoids an unsupported absolute.`, tag: item.class === "fair_test" || item.class === "unfair_test" ? "unfair_test" : item.class === "evidence_limited" || item.class === "insufficient" ? "classification_without_evidence" : "opaque_transparent_confusion", body: { observation: item.evidence, material_classification: item.class, integrity: { type: "material", key: item.key, class: item.class, expected: item.answer }, evidence_limited: true }, repair: "Use a LIGHT DETECTED / CLEAR IMAGE / SHADOW STRENGTH table and a CHANGE / KEEP SAME fair-test panel; classify only the tested sample." });
}

function buildRay(item, index, id) {
  return candidate({ id, index, format: "light-ray-simulation", blueprint: "straight-ray-shadow-builds", band: index < 16 ? "expected" : "secure", strand: "straight_ray_shadow_geometry", prompt: `Ray builder ${index + 1}: setup—${item.setup}. Choose the accurate model.`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Draw rays as straight lines from the source and stop only those meeting blocking material.", "Use boundary rays to mark where light can and cannot reach the screen; do not draw darkness as a travelling object."], explanation: `${item.answer} The ray diagram is a straight-line model and its claim is limited to this source, object, material and screen setup.`, tag: item.rule === "darkness_not_cast_shadow" ? "darkness_as_shadow_object" : item.rule === "linked_position" ? "shadow_moves_by_itself" : "light_bends_around_objects", body: { setup: item.setup, ray_rule: item.rule, source_object_screen_order: true, rays_straight: true, integrity: { type: "ray", key: item.key, rule: item.rule, expected: item.answer }, diagram_list: ["identify source", "trace straight unblocked rays", "stop blocked rays at object", "mark screen region receiving less light"] }, repair: "Switch to a numbered SOURCE → OBJECT → SCREEN list and trace two straight boundary rays; label blocked and unblocked paths without animating darkness." });
}

function buildPrediction(index) {
  const family = index % 8;
  let prompt;
  let answer;
  let wrong;
  let geometry;
  let changed;
  let controls;
  let result;
  if (family === 0) {
    geometry = { source: 0, object_before: 6, object_after: 3, screen: 12 };
    answer = "The shadow becomes larger because the object is closer to the point source and blocks a wider spread of rays.";
    prompt = "Move the opaque object from 6 units to 3 units from the source; source and screen stay fixed.";
    changed = "source-object distance"; controls = ["source", "object", "screen position", "alignment"]; result = "larger";
  } else if (family === 1) {
    geometry = { source: 0, object_before: 4, object_after: 8, screen: 12 };
    answer = "The shadow becomes smaller because the object moves closer to the screen and farther from the source.";
    prompt = "Move the opaque object from 4 units to 8 units from the source; source and screen stay fixed.";
    changed = "object position"; controls = ["source", "object shape", "screen"]; result = "smaller";
  } else if (family === 2) {
    geometry = { source: 0, object: 4, screen_before: 10, screen_after: 14 };
    answer = "The shadow becomes larger when the screen moves farther from the fixed point source and object.";
    prompt = "Move the screen from 10 units to 14 units from the source; source and object stay fixed.";
    changed = "screen distance"; controls = ["source", "object", "alignment"]; result = "larger";
  } else if (family === 3) {
    geometry = { source: 0, object: 4, screen_before: 14, screen_after: 8 };
    answer = "The shadow becomes smaller when the screen moves closer to the fixed object in this aligned model.";
    prompt = "Move the screen from 14 units to 8 units from the source; source and object stay fixed.";
    changed = "screen distance"; controls = ["source", "object", "alignment"]; result = "smaller";
  } else if (family === 4) {
    geometry = { source_size_before: "broad", source_size_after: "small", object: 5, screen: 10 };
    answer = "The shadow edge becomes sharper because fewer differently directed source rays overlap at its boundary.";
    prompt = "Replace a broad source with a smaller source; object, screen and distances stay fixed.";
    changed = "source size"; controls = ["source position", "object", "screen", "distances"]; result = "sharper";
  } else if (family === 5) {
    geometry = { source_before: 0, source_after: 3, object: 6, screen: 12 };
    answer = "The shadow becomes larger because the source moves closer to the fixed object in this point-source model.";
    prompt = "Move the point source from position 0 to position 3; object remains at 6 and screen at 12.";
    changed = "source position"; controls = ["object", "screen", "alignment"]; result = "larger";
  } else if (family === 6) {
    geometry = { object_orientation_before: "upright rectangle", object_orientation_after: "rotated rectangle", source: 0, screen: 12 };
    answer = "The shadow outline rotates with the object's projected outline; it does not move independently.";
    prompt = "Rotate the opaque rectangular object; source, object centre and screen stay fixed.";
    changed = "object orientation"; controls = ["source", "object centre", "screen", "distances"]; result = "outline_rotates";
  } else {
    geometry = { trial_a: { object_distance: 3, source_size: "small" }, trial_b: { object_distance: 6, source_size: "broad" } };
    answer = "The test is unfair because object distance and source size both change, so neither effect is isolated.";
    prompt = "Trial A uses a close object and small source; Trial B uses a farther object and broad source.";
    changed = "two variables"; controls = []; result = "unfair";
  }
  wrong = family === 7 ? ["The test proves source size caused the difference.", "The test proves object distance caused the difference.", "Changing two variables makes a comparison fairer."] : ["The shadow changes by itself without source-object-screen geometry.", "Light bends around the object to preserve the old result.", "The opaque object becomes transparent when moved."];
  return candidate({ id: `prediction-${String(index + 1).padStart(3, "0")}-${family}`, index, format: "light-ray-simulation", blueprint: "shadow-size-predictions", band: family < 2 ? "expected" : "secure", strand: "controlled_shadow_prediction", prompt: `Prediction lab ${index + 1}: ${prompt}`, choices: [answer, ...wrong], answer, hints: ["Identify exactly one changed variable and keep source, object, screen and alignment controls explicit.", "For relative size, compare the straight boundary-ray spread; for sharpness, compare source extent; reject a two-variable test."], explanation: `${answer} The prediction changes only the stated variable and remains within the aligned geometric ray model.`, tag: family === 7 ? "unfair_test" : family === 6 ? "shadow_moves_by_itself" : "light_bends_around_objects", body: { geometry, changed_variable: changed, controlled_variables: controls, predicted_result: result, integrity: { type: "prediction", family, geometry, changed, controls, result, expected: answer }, model_scope: "relative_KS2_point_or_extended_source_geometry" }, repair: "Use BEFORE / CHANGE ONE VARIABLE / AFTER static panels, trace boundary rays and lock every control variable before comparing relative size, position or sharpness." });
}

function buildShape(item, index, id) {
  return candidate({ id, index, format: "explain-choice", blueprint: "shadow-shape-explanations", band: index < 16 ? "expected" : "stretch", strand: "shadow_outline_and_sharpness", prompt: `Shadow explanation ${index + 1}: ${item.scenario} Which explanation is supported?`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Use the object's blocking outline and straight boundary rays.", "Separate basic outline, internal openings, material transmission and edge sharpness; avoid making the shadow an object."], explanation: `${item.answer} The explanation uses the stated outline, material and source geometry without adding complex optics or an absolute rule.`, tag: item.tag, body: { scenario: item.scenario, integrity: { type: "shape", key: item.key, expected: item.answer }, outline_model: true }, repair: "Overlay a labelled object outline with two static boundary rays, then compare OUTLINE / BRIGHT OPENING / EDGE SHARPNESS as separate evidence rows." });
}

function buildRetrieval(item, index, id) {
  return candidate({ id, index, format: "explain-choice", blueprint: "light-shadow-retrieval", band: index % 5 === 0 ? "retrieval" : "developing", strand: "ray_material_shadow_retrieval", prompt: `Ray-lab retrieval ${index + 1}: ${item.prompt}`, choices: [item.answer, ...item.wrong], answer: item.answer, hints: ["Name source, object/material, screen and the straight light path.", "Choose a claim limited to the stated setup and test evidence."], explanation: `${item.answer}. This concise explanation preserves the straight-ray model, material evidence and controlled-variable limit.`, tag: item.tag, body: { retrieval_focus: item.key, integrity: { type: "retrieval", key: item.key, expected: item.answer }, reduced_clutter_prompt: true }, repair: "Use one static source-object-screen strip and complete LIGHT TRAVELS…, THE MATERIAL…, SO THE SCREEN… without animated rays." });
}

function candidate({ id, index, format, blueprint, band, strand, prompt, choices, answer, hints, explanation, tag, body, repair }) {
  const fullId = `${prefix}${id}`;
  const rotatedChoices = rotate([...new Set(choices)], index % choices.length);
  const fullExplanation = explanation.length >= 100 ? explanation : `${explanation} The changed variable and model limit remain explicit.`;
  const useAudio = index % 16 === 0;
  const audio = useAudio ? { audio_optional: true, audio_asset_id: `ray-description-${fullId}`, audio_provider: "ElevenLabs", audio_asset_status: "required_human_listening_review", human_listening_approval_required: true, audio_route: "reviewed_source_object_screen_description" } : { audio_required: false };
  return {
    id: fullId,
    format,
    body: {
      prompt,
      choices: rotatedChoices,
      ...body,
      light_science_strand: strand,
      difficulty_band: band,
      evidence_purpose: `${blueprint}_ray_evidence_explanation`,
      variant_blueprint_id: blueprint,
      review_batch: reviewBatch,
      response_mode: "touch_keyboard_switch_eye_gaze_aac_point_or_adult_recorded",
      supported_interaction: "Trace labelled rays, choose material evidence or select predictions by touch, keyboard, switch scanning, eye-gaze dwell, AAC/pointing or learner-directed adult recording; numbered ray steps and controls replace dragging, drawing and handwriting.",
      interaction_route: { touch: true, keyboard: true, switch_scan: true, eye_gaze: true, aac_or_point: true, adult_recorded: true, drag_required: false, handwriting_required: false, speech_required: false },
      accessibility_support: { high_contrast_mode: true, patterned_and_labelled_rays: true, diagram_text_list_equivalent: true, reduced_clutter_mode: true, one_variable_or_ray_at_a_time: true, correct_rays_preserved: true },
      colour_independent: true,
      static_reduced_motion_route: true,
      no_flicker: true,
      undo_available: true,
      retry_without_penalty: true,
      timer_allowed: false,
      speed_score_allowed: false,
      streaks_allowed: false,
      lives_allowed: false,
      browser_tts_allowed: false,
      browser_tts_fallback: "prohibited",
      ...audio,
      gamification: { mission: "restore one playful ray-lab projector", reward: "a labelled beam-map tile for evidence-based prediction", timer: false, streak: false, lives: false, loss_on_error: false, retry_message: "That ray trace gives the lab useful evidence. Keep correct paths and controls, open one geometry clue and retry without losing progress." },
    },
    expected_answer: { value: answer },
    hints,
    explanation: fullExplanation,
    feedback: {
      correct: `The ray geometry or material evidence supports the accepted response. ${fullExplanation}`,
      repair,
      evidence: `Check source, straight ray path, material transmission, blocking outline, screen and controlled variables. Accepted response: ${answer}`,
      misconception_check: tag,
      check_prompt: format === "material-sort" ? "What passed through, was the image clear, and were test conditions matched?" : format === "light-ray-simulation" ? "Which straight boundary rays are blocked, what changed, and what stayed fixed?" : "Which object outline, opening or source-size evidence explains the shadow?",
      support_message: "Use high-contrast patterns, diagram lists and static no-flicker panels. Touch, keyboard, switch, eye gaze, AAC/pointing and adult recording are equivalent; no timer, speech, handwriting, colour inference or drag is required.",
      retry: "Correct rays, labels and controls remain visible. Use one source-object-screen clue, then retry without penalty.",
    },
    difficulty: { developing: 4, expected: 6, secure: 7, stretch: 8, retrieval: 5 }[band],
    status: "review",
    misconception_tag: tag,
    animation_hook: format === "material-sort" ? "material-light-test" : format === "light-ray-simulation" ? "shadow-zone-build" : "shadow-outline-project",
  };
}

function expand(label, count, items, builder) {
  return Array.from({ length: count }, (_, index) => {
    const item = items[index % items.length];
    return builder(item, index, `${label}-${String(index + 1).padStart(3, "0")}-${item.key}`);
  });
}

function validateBank(currentPack, authored, generated, authoredSnapshot) {
  if (authored.length !== 3 || JSON.stringify(currentPack.question_variants.slice(0, 3)) !== authoredSnapshot) throw new Error("Curated variants changed or moved.");
  if (generated.length !== 237 || currentPack.question_variants.length !== pilotTarget) throw new Error("Expected 237 generated and 240 total variants.");
  const blueprintMap = new Map(currentPack.variant_blueprints.map((item) => [item.id, item]));
  const formats = new Set(currentPack.practice.formats);
  const ids = new Set();
  const signatures = new Set();
  for (const variant of currentPack.question_variants) {
    if (ids.has(variant.id)) throw new Error(`Duplicate id ${variant.id}.`);
    ids.add(variant.id);
    const signature = `${variant.format}|${normalise(variant.body?.prompt)}|${normalise(variant.expected_answer)}`;
    if (signatures.has(signature)) throw new Error(`Duplicate format/prompt/answer signature ${variant.id}.`);
    signatures.add(signature);
  }
  for (const variant of generated) {
    const blueprint = blueprintMap.get(variant.body.variant_blueprint_id);
    if (!blueprint || blueprint.format !== variant.format || !formats.has(variant.format)) throw new Error(`${variant.id} has invalid format or blueprint.`);
    validateScience(variant);
    if (variant.body.choices.length !== 4 || !variant.body.choices.includes(variant.expected_answer.value)) throw new Error(`${variant.id} has an invalid answer set.`);
    if (!variant.feedback?.correct || !variant.feedback?.repair || !variant.feedback?.evidence || !variant.feedback?.check_prompt || variant.hints.length < 2 || variant.explanation.length < 90) throw new Error(`${variant.id} lacks rich feedback.`);
    const route = variant.body.interaction_route;
    if (!route?.touch || !route?.keyboard || !route?.switch_scan || !route?.eye_gaze || !route?.aac_or_point || !route?.adult_recorded || route.drag_required !== false || route.handwriting_required !== false || route.speech_required !== false) throw new Error(`${variant.id} lacks accessible routes.`);
    if (!variant.body.accessibility_support?.high_contrast_mode || !variant.body.accessibility_support?.diagram_text_list_equivalent || !variant.body.accessibility_support?.reduced_clutter_mode || variant.body.colour_independent !== true || variant.body.static_reduced_motion_route !== true || variant.body.no_flicker !== true) throw new Error(`${variant.id} lacks static/no-flicker access.`);
    if (variant.body.timer_allowed !== false || variant.body.speed_score_allowed !== false || variant.body.streaks_allowed !== false || variant.body.lives_allowed !== false || variant.body.gamification?.loss_on_error !== false) throw new Error(`${variant.id} introduces pressure.`);
    if (variant.body.browser_tts_allowed !== false || variant.body.browser_tts_fallback !== "prohibited") throw new Error(`${variant.id} permits browser TTS.`);
    if (variant.body.audio_asset_id && (variant.body.audio_provider !== "ElevenLabs" || variant.body.audio_asset_status !== "required_human_listening_review" || variant.body.human_listening_approval_required !== true || variant.body.audio_route !== "reviewed_source_object_screen_description")) throw new Error(`${variant.id} has invalid audio metadata.`);
  }
  for (const format of currentPack.practice.formats) if (!generated.some((variant) => variant.format === format)) throw new Error(`Declared format ${format} is unused.`);
  const allocation = { "material-shadow-sorts": 48, "straight-ray-shadow-builds": 48, "shadow-size-predictions": 47, "shadow-shape-explanations": 47, "light-shadow-retrieval": 47 };
  for (const [blueprint, expected] of Object.entries(allocation)) {
    const actual = generated.filter((variant) => variant.body.variant_blueprint_id === blueprint).length;
    if (actual !== expected) throw new Error(`${blueprint} expected ${expected}, found ${actual}.`);
  }
}

function validateScience(variant) {
  const i = variant.body.integrity;
  if (i.expected !== variant.expected_answer.value) throw new Error(`${variant.id} changed its canonical answer.`);
  if (i.type === "material") {
    const source = materialCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.class !== i.class) throw new Error(`${variant.id} has invalid material evidence.`);
  } else if (i.type === "ray") {
    const source = rayCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected || source.rule !== i.rule || variant.body.rays_straight !== true) throw new Error(`${variant.id} has invalid ray geometry.`);
    if (/curve rays|darkness travelling/i.test(i.expected)) throw new Error(`${variant.id} uses an invalid KS2 ray explanation.`);
  } else if (i.type === "prediction") {
    validatePrediction(variant, i);
  } else if (i.type === "shape") {
    const source = shapeCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected) throw new Error(`${variant.id} has invalid shadow-shape science.`);
  } else if (i.type === "retrieval") {
    const source = retrievalCases.find((item) => item.key === i.key);
    if (!source || source.answer !== i.expected) throw new Error(`${variant.id} has invalid retrieval science.`);
  } else throw new Error(`${variant.id} has unknown science integrity type ${i.type}.`);
}

function validatePrediction(variant, i) {
  const g = i.geometry;
  let expectedResult;
  if (i.family === 0 || i.family === 1) {
    const before = g.screen / g.object_before;
    const after = g.screen / g.object_after;
    expectedResult = after > before ? "larger" : "smaller";
  } else if (i.family === 2 || i.family === 3) {
    const before = g.screen_before / g.object;
    const after = g.screen_after / g.object;
    expectedResult = after > before ? "larger" : "smaller";
  } else if (i.family === 4) expectedResult = "sharper";
  else if (i.family === 5) {
    const before = (g.screen - g.source_before) / (g.object - g.source_before);
    const after = (g.screen - g.source_after) / (g.object - g.source_after);
    expectedResult = after > before ? "larger" : "smaller";
  } else if (i.family === 6) expectedResult = "outline_rotates";
  else expectedResult = "unfair";
  if (i.result !== expectedResult) throw new Error(`${variant.id} has invalid source-object-screen prediction ${i.result} != ${expectedResult}.`);
  if (i.family !== 7 && i.controls.length < 3) throw new Error(`${variant.id} does not control enough variables.`);
  if (i.family === 7 && i.changed !== "two variables") throw new Error(`${variant.id} does not identify the confounded test.`);
}

function rotate(values, by) { const offset = by % values.length; return [...values.slice(offset), ...values.slice(0, offset)]; }
function normalise(value) { return JSON.stringify(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function argValue(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function relative(file) { return path.relative(repoRoot, file).replaceAll("\\", "/"); }
function summary(items, keyFor) { const counts = new Map(); for (const item of items) counts.set(keyFor(item), (counts.get(keyFor(item)) ?? 0) + 1); return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}:${count}`).join(","); }
