import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(await readFile(new URL("../src/components/role-workspaces/schoolSupportProfile.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const optionsSource = ts.transpileModule(await readFile(new URL("../src/components/role-workspaces/engagementProfileOptions.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const options = { exports: {} };
vm.runInNewContext(optionsSource, options);
const context = { exports: {}, require: id => {
  assert.equal(id, "./engagementProfileOptions");
  return options.exports;
} };
vm.runInNewContext(source, context);
const { verifiedEngagementProfile: verify } = context.exports;
const valid = () => ({
  student_external_ref: "ava", declared_support_needs: ["dyslexia"], learning_approaches: ["reduced_motion"],
  celebration_intensity: "quiet", audio_support: true, reading_support: true,
  session_length: "short", sensory_load: "low", attention_support: "chunked", communication_support: "audio_visual",
  processing_support: "extra_time", confidence_support: "gentle", companion_style: "calm", reward_style: "story",
  interests: ["dinosaurs"], notes: "Keep saved supports.", updated_at: "2026-09-14T12:00:00Z",
});

test("family and school share fresh default values without changing their explicit approach choices", () => {
  assert.equal(typeof context.exports.engagementDefaults, "function", "shared defaults are required");
  const defaults = context.exports.engagementDefaults();
  assert.equal(defaults.student_external_ref, undefined);
  assert.deepEqual([...defaults.learning_approaches], []);
  defaults.interests.push("temporary");
  assert.deepEqual([...context.exports.engagementDefaults().interests], []);
  assert.deepEqual([...context.exports.learningApproaches].slice(0, 5), ["simple_text", "high_contrast", "large_targets", "simplified_controls", "switch_access"]);
  assert.deepEqual([...options.exports.familyApproachOptions].slice(0, 4).map(([key]) => key), ["predictable_routine", "short_bursts", "visual_steps", "audio_read_aloud"]);
  assert.equal(options.exports.supportNeedOptions.find(([key]) => key === "eal")[1], "English as an additional language");
  assert.equal(options.exports.familyApproachOptions.find(([key]) => key === "audio_read_aloud")[1], "Read aloud");
});

test("a verified support profile preserves every saved value without forwarding extra metadata or aliases", () => {
  const original = valid();
  const result = verify({ ...original, credential: "must-not-be-forwarded" }, "ava");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), original);
  result.interests.push("new interest");
  result.learning_approaches.push("simple_text");
  assert.deepEqual(original.interests, ["dinosaurs"]);
  assert.deepEqual(original.learning_approaches, ["reduced_motion"]);
});

test("support profile identity and all required fields fail closed", () => {
  for (const value of [null, [], {}, { ...valid(), student_external_ref: "ben" }, ...Object.keys(valid()).filter(key => key !== "updated_at").map(key => { const row = valid(); delete row[key]; return row; })]) {
    assert.throws(() => verify(value, "ava"), /could not be verified/);
  }
  assert.throws(() => verify(valid(), ""), /could not be verified/);
});

test("unsupported choices, malformed support arrays, flags and dates cannot become an editable profile", () => {
  for (const update of [
    { session_length: "unbounded" }, { celebration_intensity: "flashing" }, { sensory_load: "unknown" },
    { attention_support: 3 }, { communication_support: "unknown" }, { processing_support: "unknown" },
    { confidence_support: "unknown" }, { companion_style: "unknown" }, { reward_style: "unknown" },
    { declared_support_needs: null }, { declared_support_needs: ["unsupported"] },
    { learning_approaches: ["unsupported"] }, { interests: [false] }, { interests: [" "] },
    { audio_support: "true" }, { reading_support: null }, { notes: {} }, { updated_at: "invalid" },
  ]) assert.throws(() => verify({ ...valid(), ...update }, "ava"), /could not be verified/);
});

test("new pupil defaults may omit a timestamp without inventing missing saved settings", () => {
  const row = valid(); delete row.updated_at;
  assert.deepEqual(JSON.parse(JSON.stringify(verify(row, "ava"))), row);
  assert.equal(verify({ ...row, updated_at: "" }, "ava").updated_at, "");
});

test("editor choices remain in parity with the actual Go support contract", async () => {
  const backend = await readFile(new URL("../../api/internal/learning/configuration.go", import.meta.url), "utf8");
  const fields = { session_length: "SessionLength", sensory_load: "SensoryLoad", attention_support: "AttentionSupport", communication_support: "CommunicationSupport", processing_support: "ProcessingSupport", confidence_support: "ConfidenceSupport", celebration_intensity: "CelebrationIntensity", companion_style: "CompanionStyle", reward_style: "RewardStyle" };
  for (const [key, field] of Object.entries(fields)) {
    const match = backend.match(new RegExp(`switch profile\\.${field} \\{\\s*case ([^:]+):`));
    assert.ok(match, `backend ${field} contract must be explicit`);
    const allowed = [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
    assert.deepEqual([...context.exports.supportChoices[key]].sort(), allowed.sort());
    for (const value of allowed) assert.equal(verify({ ...valid(), [key]: value }, "ava")[key], value);
  }
  for (const [fn, name, field] of [["validateSupportNeedList", "supportNeeds", "declared_support_needs"], ["validateLearningApproachList", "learningApproaches", "learning_approaches"]]) {
    const match = backend.match(new RegExp(`func ${fn}[^]*?map\\[string\\]bool\\{([^]*?)\\n\\t\\}`));
    assert.ok(match, `backend ${fn} choices must be explicit`);
    const allowed = [...match[1].matchAll(/"([^"]+)": true/g)].map(item => item[1]);
    assert.deepEqual([...context.exports[name]].sort(), allowed.sort());
    for (const value of allowed) assert.equal(verify({ ...valid(), [field]: [value] }, "ava")[field][0], value);
  }
});
