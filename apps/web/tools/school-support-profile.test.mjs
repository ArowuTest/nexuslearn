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
  student_external_ref: "ava", version: 17, declared_support_needs: ["dyslexia"], learning_approaches: ["reduced_motion"],
  celebration_intensity: "quiet", audio_support: true, reading_support: true,
  session_length: "short", sensory_load: "low", attention_support: "chunked", communication_support: "audio_visual",
  processing_support: "extra_time", confidence_support: "gentle", companion_style: "calm", reward_style: "story",
  interests: ["dinosaurs"], notes: "Keep saved supports.", updated_at: "2026-09-14T12:00:00Z",
});

async function transport() {
  const input = await readFile(new URL("../src/components/role-workspaces/schoolSupportTransport.ts", import.meta.url), "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  assert.ok(input, "support transport must own stable headers and stale-request cancellation");
  const loaded = { exports: {}, AbortController, require: id => { assert.equal(id, "./schoolSupportProfile"); return context.exports; } };
  vm.runInNewContext(ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, loaded);
  return loaded.exports.createSupportTransport;
}

test("support transport sends complete versioned PUTs with stable keys and no-store reads", async () => {
  const create = await transport();
  const owner = create();
  const calls = [];
  const request = async (path, options) => {
    calls.push({ path, options });
    return { status: 200, body: options.method === "PUT" ? { ...valid(), version: 23, save_result: { applied_version: 23, changed: true, replayed: true } } : valid() };
  };
  assert.equal((await owner.run(request, "ava")).type, "loaded");
  const attempt = { key: "one-key", body: JSON.stringify(valid()) };
  assert.equal((await owner.run(request, "ava", attempt)).type, "saved");
  assert.equal(calls[0].path, "/v1/school/students/ava/engagement");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[1].options.method, "PUT");
  assert.equal(calls[1].options.headers["Idempotency-Key"], "one-key");
  assert.equal(calls[1].options.body, attempt.body);
  assert.equal(calls[1].options.signal.aborted, false);
});

test("cancelled and out-of-order support requests cannot publish private results or errors", async () => {
  const create = await transport();
  const owner = create();
  let release, signal;
  const old = owner.run((_path, options) => { signal = options.signal; return new Promise(resolve => { release = resolve; }); }, "ava");
  owner.cancel();
  assert.equal(signal.aborted, true);
  const next = await owner.run(async () => ({ status: 200, body: { ...valid(), student_external_ref: "ben", notes: "Ben only" } }), "ben");
  assert.equal(next.profile.notes, "Ben only");
  release({ status: 409, body: { code: "support_profile_conflict", error: "Private", current_profile: valid(), previously_saved: true } });
  assert.equal(await old, null);
  let reject;
  const staleError = owner.run(() => new Promise((_resolve, fail) => { reject = fail; }), "ava");
  await owner.run(async () => ({ status: 200, body: valid() }), "ava");
  reject(new Error("stale private error"));
  assert.equal(await staleError, null);
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

test("only nonnegative safe integer versions can authorise an editable loaded profile", () => {
  for (const version of [undefined, null, "17", -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => verify({ ...valid(), version }, "ava"), /could not be verified/, String(version));
  }
  for (const version of [0, 17, Number.MAX_SAFE_INTEGER]) assert.equal(verify({ ...valid(), version }, "ava").version, version);
});

test("a save needs an exact version receipt, not an echo or a contradictory acknowledgement", () => {
  assert.equal(typeof context.exports.verifiedSupportSave, "function", "save receipt validation is required");
  const receipt = { applied_version: 23, changed: true, replayed: false };
  const response = { ...valid(), version: 23, save_result: receipt };
  const save = value => context.exports.verifiedSupportSave(value, "ava", 17);
  for (const value of [valid(), { ...response, save_result: null },
    ...[{ applied_version: 22 }, { changed: "true" }, { replayed: null }, { changed: false }].map(update => ({ ...response, save_result: { ...receipt, ...update } })),
    { ...response, version: 17, save_result: { ...receipt, applied_version: 17 } },
    { ...response, student_external_ref: "ben" },
  ]) assert.throws(() => save(value), /could not be verified/);
  assert.equal(save(response).profile.version, 23);
  assert.equal(save(response).profile.save_result, undefined);
  assert.equal(save({ ...valid(), save_result: { applied_version: 17, changed: false, replayed: true } }).replayed, true);
});

test("only complete same-pupil conflict profiles with an explicit replay flag are trusted", () => {
  assert.equal(typeof context.exports.verifiedSupportConflict, "function", "conflict validation is required");
  const conflict = { code: "support_profile_conflict", error: "Changed elsewhere", current_profile: { ...valid(), version: 23 }, previously_saved: false };
  for (const update of [{ code: "idempotency_key_conflict" }, { error: null }, { previously_saved: undefined },
    { current_profile: { ...valid(), student_external_ref: "ben" } }, { current_profile: { ...valid(), version: "23" } }, { current_profile: {} },
  ]) assert.throws(() => context.exports.verifiedSupportConflict({ ...conflict, ...update }, "ava"), /could not be verified/);
  assert.equal(context.exports.verifiedSupportConflict(conflict, "ava").current.version, 23);
});

test("a missing profile version cannot acknowledge a persisted unchanged save", () => {
  const missing = { ...valid(), version: 0, save_result: { applied_version: 0, changed: false, replayed: false } };
  assert.throws(() => context.exports.verifiedSupportSave(missing, "ava", 0), /could not be verified/);
});

test("uncertain retries reuse only the exact complete payload and never forward metadata", () => {
  assert.equal(typeof context.exports.prepareSupportSave, "function", "stable support attempts are required");
  let keys = 0;
  const prepare = (draft, interests, previous = null) => context.exports.prepareSupportSave(draft, interests, previous, () => `key-${++keys}`);
  const draft = { ...valid(), save_result: { changed: true }, credential: "private metadata" };
  const first = prepare(draft, "dinosaurs, space");
  const body = JSON.parse(first.body);
  const expected = { ...valid(), interests: ["dinosaurs", "space"] }; delete expected.updated_at;
  assert.deepEqual(body, expected);
  assert.equal(first.key, "key-1");
  assert.equal(prepare(draft, "dinosaurs, space", first).key, "key-1");
  assert.equal(prepare({ ...draft, notes: "Edited note" }, "dinosaurs, space", first).key, "key-2");
  assert.equal(prepare({ ...draft, version: 23 }, "dinosaurs, space", first).key, "key-3");
  assert.equal(first.body, JSON.stringify(body), "a later attempt must not mutate the retained request");
});

test("conflict refresh and deliberate rebase retain the whole draft; discard requires confirmation", () => {
  assert.equal(typeof context.exports.supportEditorState, "function", "independent support draft state is required");
  const change = context.exports.supportEditorState;
  let state = change(null, { type: "loaded", profile: verify(valid(), "ava") });
  state = change(state, { type: "edit", patch: { notes: "My draft", audio_support: false, learning_approaches: ["simple_text"] }, interests: "space,  trains" });
  const draft = JSON.parse(JSON.stringify(state.draft));
  state = change(state, { type: "conflict", current: null, previouslySaved: false });
  assert.deepEqual(JSON.parse(JSON.stringify(state.draft)), draft);
  assert.equal(change(state, { type: "rebase" }), state, "an unverified comparison cannot unlock saving");
  const current = verify({ ...valid(), version: 29, notes: "Latest saved" }, "ava");
  state = change(state, { type: "loaded", profile: current });
  assert.equal(state.base.version, 17);
  assert.equal(state.review.current.version, 29);
  assert.equal(state.interests, "space,  trains");
  assert.equal(change(state, { type: "discard" }), state, "a click without visible confirmation cannot discard");
  const rebased = change(state, { type: "rebase" });
  assert.equal(rebased.base.version, 29);
  assert.deepEqual(JSON.parse(JSON.stringify(rebased.draft)), { ...draft, version: 29 });
  assert.equal(rebased.interests, "space,  trains");
  assert.equal(rebased.review, null);
  assert.equal(rebased.pending, null, "rebase must not enqueue a save");
  const discarded = change(change(state, { type: "confirm" }), { type: "discard" });
  assert.equal(discarded.draft.notes, "Latest saved");
  assert.equal(discarded.interests, "dinosaurs");
  assert.equal(discarded.pending, null);
});

test("ordinary and post-rebase reloads retain dirty drafts until deliberate review or discard", () => {
  const change = context.exports.supportEditorState;
  for (const rebase of [false, true]) {
    let state = change(null, { type: "loaded", profile: valid() });
    state = change(state, { type: "edit", patch: { notes: "Retain after reload", audio_support: false }, interests: "space,  trains" });
    if (rebase) {
      state = change(state, { type: "conflict", current: { ...valid(), version: 29 }, previouslySaved: false });
      state = change(state, { type: "rebase" });
    }
    const draft = state.draft;
    const base = state.base;
    state = change(state, { type: "loading" });
    assert.ok(state.review, "a dirty reload must enter comparison mode before its response");
    assert.equal(state.review.current, null);
    assert.equal(change(state, { type: "rebase" }), state);
    state = change(state, { type: "loaded", profile: { ...valid(), version: 35, notes: "Newer saved note" } });
    assert.equal(state.draft, draft);
    assert.equal(state.base, base);
    assert.equal(state.interests, "space,  trains");
    assert.equal(state.review.current.version, 35);
    assert.equal(change(state, { type: "discard" }), state);
    const confirmed = change(change(state, { type: "confirm" }), { type: "discard" });
    assert.equal(confirmed.draft.notes, "Newer saved note");
  }
});

test("reload preserves an uncertain unchanged attempt and same-version review retains its retry key", () => {
  const change = context.exports.supportEditorState;
  let state = change(null, { type: "loaded", profile: valid() });
  const attempt = context.exports.prepareSupportSave(state.draft, state.interests, null, () => "uncertain-key");
  state = change(state, { type: "pending", attempt });
  state = change(state, { type: "loading" });
  state = change(state, { type: "loaded", profile: valid() });
  assert.equal(state.pending, attempt);
  assert.ok(state.review, "even an unchanged uncertain attempt needs a deliberate choice");
  state = change(state, { type: "rebase" });
  assert.equal(state.pending, attempt, "the exact same version/payload remains the same logical retry");
  assert.equal(context.exports.prepareSupportSave(state.draft, state.interests, state.pending, () => "unexpected-key").key, "uncertain-key");
});

test("explicitly rejected attempts cannot reuse their key after same-version comparison", () => {
  const change = context.exports.supportEditorState;
  let state = change(null, { type: "loaded", profile: valid() });
  state = change(state, { type: "edit", patch: { notes: "Retain the rejected draft" } });
  const attempt = context.exports.prepareSupportSave(state.draft, state.interests, null, () => "rejected-key");
  state = change(state, { type: "pending", attempt });
  const outcome = context.exports.supportResponse(409, { code: "idempotency_key_conflict", error: "Rejected key" }, "ava", 17);
  state = change(state, outcome);
  state = change(state, { type: "loaded", profile: valid() });
  state = change(state, { type: "rebase" });
  assert.equal(state.draft.notes, "Retain the rejected draft");
  assert.equal(context.exports.prepareSupportSave(state.draft, state.interests, state.pending, () => "replacement-key").key, "replacement-key");
});

test("clean reloads can refresh normally but raw interest edits are never silently discarded", () => {
  const change = context.exports.supportEditorState;
  let state = change(null, { type: "loaded", profile: valid() });
  state = change(state, { type: "loading" });
  assert.equal(state.ready, false);
  assert.equal(state.review, null);
  state = change(state, { type: "loaded", profile: { ...valid(), version: 29 } });
  assert.equal(state.ready, true);
  assert.equal(state.draft.version, 29);
  state = change(state, { type: "edit", interests: "dinosaurs, " });
  state = change(state, { type: "loaded", profile: { ...valid(), version: 35 } });
  assert.equal(state.interests, "dinosaurs, ");
  assert.equal(state.base.version, 29);
  assert.equal(state.review.current.version, 35);
});

test("support HTTP outcomes fail closed without exposing unverified error or profile fields", () => {
  assert.equal(typeof context.exports.supportResponse, "function", "support-specific HTTP outcomes are required");
  const response = (status, body, version = 17) => context.exports.supportResponse(status, body, "ava", version);
  const conflict = { code: "support_profile_conflict", error: "server-only detail", previously_saved: true, current_profile: { ...valid(), version: 29 } };
  assert.equal(response(409, conflict).previouslySaved, true);
  for (const body of [{ ...conflict, current_profile: { ...valid(), student_external_ref: "ben", notes: "FOREIGN PRIVATE" } },
    { ...conflict, code: "idempotency_key_conflict" }, null, { error: "FOREIGN PRIVATE" }]) {
    const result = response(409, body);
    assert.equal(result.type, "conflict");
    assert.equal(result.current, null);
    assert.equal(JSON.stringify(result).includes("FOREIGN PRIVATE"), false);
  }
  assert.equal(response(428, { code: "support_version_required" }).locked, true);
  for (const status of [401, 403]) assert.equal(response(status, conflict).type, "denied");
  for (const status of [201, 400, 500, 503]) assert.equal(response(status, valid()).type, "failure");
  assert.equal(response(200, valid()).type, "failure", "an echo is an uncertain failure");
  assert.equal(context.exports.supportResponse(200, valid(), "ava").type, "loaded");
});

test("a non-200 read cannot promote a conflict-shaped body into a verified draft base", () => {
  const body = { code: "support_profile_conflict", error: "Changed", previously_saved: false, current_profile: { ...valid(), notes: "UNVERIFIED READ" } };
  for (const status of [409, 428]) {
    const result = context.exports.supportResponse(status, body, "ava");
    assert.equal(result.type, "failure");
    assert.equal(JSON.stringify(result).includes("UNVERIFIED READ"), false);
  }
});

test("refresh, second conflict, and reset never resurrect pending keys or foreign private state", () => {
  assert.equal(typeof context.exports.supportEditorState, "function", "support state transitions are required");
  const change = context.exports.supportEditorState;
  let state = change(null, { type: "loaded", profile: valid() });
  state = change(state, { type: "edit", patch: { notes: "Local private draft" }, interests: "space" });
  state = change(state, { type: "pending", attempt: { body: "fixed payload", key: "old-key" } });
  state = change(state, { type: "conflict", current: { ...valid(), version: 29 }, previouslySaved: true });
  state = change(state, { type: "confirm" });
  state = change(state, { type: "loading" });
  assert.equal(state.review.current, null);
  assert.equal(state.confirm, false);
  assert.equal(state.draft.notes, "Local private draft");
  state = change(state, { type: "loaded", profile: { ...valid(), version: 31 } });
  assert.equal(state.review.previouslySaved, true);
  state = change(state, { type: "rebase" });
  assert.equal(state.pending, null);
  state = change(state, { type: "conflict", current: { ...valid(), version: 42 }, previouslySaved: false });
  assert.equal(state.draft.notes, "Local private draft");
  assert.equal(state.base.version, 31);
  const cleared = change(state, { type: "reset", pupil: "ben" });
  assert.equal(cleared.base, null);
  assert.equal(cleared.review, null);
  assert.equal(cleared.pending, null);
  assert.equal(cleared.ready, false);
  assert.equal(cleared.draft.notes, "");
  assert.equal(cleared.interests, "");
});

test("review compares every differing editable field using human labels, not metadata", () => {
  assert.equal(typeof context.exports.supportDifferences, "function", "complete support comparisons are required");
  const saved = valid();
  const draft = { ...saved, notes: "My draft", declared_support_needs: ["eal"], audio_support: false, sensory_load: "high", version: 999, credential: "NEVER DISPLAY" };
  const differences = JSON.parse(JSON.stringify(context.exports.supportDifferences(saved, draft, "space, trains")));
  assert.deepEqual(differences, [
    ["Declared support needs", "Dyslexia", "English as an additional language"],
    ["Sensory load", "Low", "High"],
    ["Audio support", "On", "Off"],
    ["Interests", "dinosaurs", "space, trains"],
    ["Operational notes", "Keep saved supports.", "My draft"],
  ]);
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
