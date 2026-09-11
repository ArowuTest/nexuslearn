import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(await readFile(new URL("../src/components/role-workspaces/useSchoolDirectories.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, require: () => ({}) };
vm.runInNewContext(source, context);
const { schoolDirectoryPage, schoolDirectoryOverview } = context.exports;
const pupil = { external_ref: "one", display_name: "One", year_group: 3 };
const page = changes => ({ school_urn: "school-a", kind: "students", items: [pupil], ...changes });
const overview = changes => ({ school: { urn: "school-a" }, current_user: { school_urn: "school-a" }, classes: [], groups: [], students: [pupil], directory: { version: 1, counts: { classes: 23, groups: 100, students: 2000 } }, ...changes });

test("legacy class years can be explicitly unset without admitting unset pupil years", () => {
  const item = { id: "class-a", name: "Mixed class", year_group: 0, student_count: 2 };
  const result = schoolDirectoryPage("classes", page({ kind: "classes", items: [item] }), "school-a");
  assert.equal(result.items[0].year_group, 0);
  assert.equal(context.exports.classYearLabel(0), "Year not set");
  assert.equal(context.exports.classYearLabel(3), "Year 3");
  assert.throws(() => schoolDirectoryPage("students", page({ items: [{ ...pupil, year_group: 0 }] }), "school-a"), /could not be verified/);
});

test("directory responses retain only safe pupil summary fields", () => {
  const result = schoolDirectoryPage("students", page({ items: [{ ...pupil, credential: "private", notes: "private" }] }), "school-a");
  assert.deepEqual(JSON.parse(JSON.stringify(result.items)), [pupil]);
});

test("directory rejects foreign school, wrong kind, duplicate identities and oversized pages", () => {
  for (const value of [page({ school_urn: "school-b" }), page({ kind: "classes" }), page({ items: [pupil, pupil] }), page({ items: Array.from({ length: 21 }, (_, i) => ({ ...pupil, external_ref: `p${i}` })) })]) {
    assert.throws(() => schoolDirectoryPage("students", value, "school-a"), /could not be verified/);
  }
});

test("directory refuses invalid rows and cursor cycles instead of offering unsafe next navigation", () => {
  for (const items of [[{ ...pupil, year_group: 8 }], [{ ...pupil, external_ref: "" }], null]) {
    assert.throws(() => schoolDirectoryPage("students", page({ items }), "school-a"), /could not be verified/);
  }
  assert.throws(() => schoolDirectoryPage("students", page({ next_cursor: "seen" }), "school-a", ["", "seen"]), /could not be verified/);
});

test("overview uses backend totals rather than the currently loaded page length", () => {
  const result = schoolDirectoryOverview(overview());
  assert.equal(result.counts.students, 2000);
  assert.equal(result.views.students.items.length, 1);
  assert.equal(result.counts.classes, 23);
});

test("legacy overview is explicit compatibility but malformed directory claims fail closed", () => {
  assert.equal(schoolDirectoryOverview({ classes: [] }), null);
  for (const value of [overview({ directory: null }), overview({ directory: { version: 2 } }), overview({ directory: { version: 1, counts: { classes: -1, groups: 0, students: 0 } } }), overview({ current_user: { school_urn: "school-b" } })]) {
    assert.throws(() => schoolDirectoryOverview(value), /could not be verified/);
  }
});
