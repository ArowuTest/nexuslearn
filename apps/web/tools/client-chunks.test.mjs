import assert from "node:assert/strict";
import { test } from "node:test";
import nextConfig from "../next.config.mjs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

function configuration() {
  return { optimization: { splitChunks: { minSize: 20_000, chunks: () => true, cacheGroups: { framework: { priority: 40 }, lib: { priority: 30 } } } } };
}

test("deferred admin workspaces keep the server fallback without importing private client modules", async () => {
  const input = await readFile(new URL("../src/components/deferClientWorkspace.tsx", import.meta.url), "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  assert.ok(input, "client-only workspace loading needs one small React boundary");
  const loaded = { exports: {}, require: createRequire(import.meta.url) };
  vm.runInNewContext(ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, loaded);
  let imports = 0;
  const Workspace = loaded.exports.deferClientWorkspace(async () => { imports++; return { default: () => React.createElement("p", null, "Private workspace") }; }, React.createElement("p", { role: "status" }, "Loading review workspace"));
  const markup = renderToStaticMarkup(React.createElement(Workspace));
  assert.match(markup, /role="status">Loading review workspace/);
  assert.doesNotMatch(markup, /Private workspace/);
  assert.equal(imports, 0, "server rendering must not invoke the browser-only loader");
});

test("client API sharing preserves default groups and excludes development and server builds", () => {
  for (const options of [{ isServer: true, dev: false }, { isServer: false, dev: true }]) {
    const config = configuration();
    const before = config.optimization.splitChunks;
    assert.equal(nextConfig.webpack(config, options), config);
    assert.equal(config.optimization.splitChunks, before);
    assert.equal(Object.keys(before.cacheGroups).length, 2);
  }
  const config = configuration();
  const { framework, lib } = config.optimization.splitChunks.cacheGroups;
  nextConfig.webpack(config, { isServer: false, dev: false });
  assert.equal(config.optimization.splitChunks.minSize, 20_000);
  assert.equal(config.optimization.splitChunks.cacheGroups.framework, framework);
  assert.equal(config.optimization.splitChunks.cacheGroups.lib, lib);
});

test("shared admin summaries preserve card order, escaping, empty values and existing markup", async () => {
  const input = await readFile(new URL("../src/components/admin/AdminEditorPrimitives.tsx", import.meta.url), "utf8");
  const loaded = { exports: {}, require: createRequire(import.meta.url) };
  vm.runInNewContext(ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, loaded);
  assert.equal(typeof loaded.exports.InfoValues, "function");
  const items = [["Count", 0], ["Status", ""], ["Private <label>", "A & B"], ["Count", 9]];
  const before = renderToStaticMarkup(React.createElement(React.Fragment, null, ...items.map(([label, value], key) => React.createElement(loaded.exports.Info, { key, label, value: String(value) }))));
  assert.equal(renderToStaticMarkup(React.createElement(loaded.exports.InfoValues, { items })), before);
});

test("only the exact browser API module enters the new cache group", () => {
  const config = nextConfig.webpack(configuration(), { isServer: false, dev: false });
  const group = config.optimization.splitChunks.cacheGroups.pupilSharedAPI;
  assert.equal(group.minChunks, 2);
  assert.equal(group.reuseExistingChunk, true);
  const sampleModule = (resource, layer = "app-pages-browser") => ({ layer, nameForCondition: () => resource });
  assert.ok(group.test(sampleModule("/repo/apps/web/src/lib/api.ts")));
  assert.ok(group.test(sampleModule("C:\\repo\\apps\\web\\src\\lib\\api.ts")));
  assert.equal(group.test(sampleModule("/repo/apps/web/src/lib/admin-api.ts")), false);
  assert.equal(group.test(sampleModule("/repo/apps/web/src/lib/api.ts", "rsc")), false);
  assert.equal(group.test(sampleModule("/repo/apps/web/src/lib/api.ts", "ssr")), false);
  assert.equal(group.test({}), false);
});

test("shared UI widgets keep distinct exact-source production browser boundaries", () => {
  const config = nextConfig.webpack(configuration(), { isServer: false, dev: false });
  const names = new Set();
  for (const [key, component] of [["sharedMockBuilder", "MockAssessmentBuilder"], ["sharedProgressSnapshot", "ProgressSnapshot"], ["sharedDino", "Dino"], ["sharedWorkspaceNavigation", "role-workspaces/WorkspaceNavigation"], ["sharedMockObjectiveGuidance", "MockObjectiveGuidance"], ["sharedAttemptEvidence", "AttemptEvidencePanel"], ["sharedMockHistory", "MockAssessmentHistory"], ["sharedChildJourney", "ChildJourneyChrome"]]) {
    const group = config.optimization.splitChunks.cacheGroups[key];
    assert.ok(group, `${component} must not be duplicated in role bundles`);
    assert.equal(group.minChunks, 2);
    assert.equal(group.enforce, true);
    assert.equal(group.reuseExistingChunk, true);
    assert.equal(names.has(group.name), false, "unrelated widget payloads must not be joined");
    names.add(group.name);
    for (const resource of [`/repo/apps/web/src/components/${component}.tsx`, `C:\\repo\\apps\\web\\src\\components\\${component}.tsx`]) {
      const sample = { layer: "app-pages-browser", nameForCondition: () => resource };
      assert.equal(group.test(sample), true);
      for (const layer of ["rsc", "ssr", undefined]) assert.equal(group.test({ ...sample, layer }), false);
    }
    for (const resource of ["/repo/apps/web/src/lib/api.ts", `/repo/apps/web/src/components/${component}Extra.tsx`, `/repo/apps/web/src/components/admin/${component}.tsx`]) assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => resource }), false);
    assert.equal(group.test({}), false);
  }
});

for (const [key, component, name] of [
  ["sharedAccountAuthentication", "useAccountAuthentication", "nexuslearn-account-authentication"],
  ["sharedAccountWorkspace", "useAccountWorkspace", "nexuslearn-account-workspace"],
  ["sharedEngagementOptions", "engagementProfileOptions", "nexuslearn-engagement-options"],
]) test(`${component} lifecycle is shared only by its exact production browser module`, () => {
  const config = nextConfig.webpack(configuration(), { isServer: false, dev: false });
  const group = config.optimization.splitChunks.cacheGroups[key];
  assert.ok(group, "the same lifecycle must not be copied into all three adult routes");
  assert.equal(group.name, name);
  assert.equal(group.minChunks, 2);
  assert.equal(group.enforce, true);
  assert.equal(group.reuseExistingChunk, true);
  for (const resource of [`/repo/src/components/role-workspaces/${component}.ts`, `C:\\repo\\src\\components\\role-workspaces\\${component}.ts`]) {
    assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => resource }), true);
    for (const layer of ["rsc", "ssr", undefined]) assert.equal(group.test({ layer, nameForCondition: () => resource }), false);
  }
  for (const resource of ["/repo/src/lib/api.ts", `/repo/src/components/role-workspaces/${component}Extra.ts`, `/repo/src/components/admin/${component}.ts`]) {
    assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => resource }), false);
  }
});

test("picture-login symbols use one exact browser chunk across child and adult cards", () => {
  const config = nextConfig.webpack(configuration(), { isServer: false, dev: false });
  const group = config.optimization.splitChunks.cacheGroups.sharedLoginPicture;
  assert.ok(group, "measured picture-login module must not be copied three times");
  assert.equal(group.minChunks, 2);
  assert.equal(group.name, "nexuslearn-login-picture");
  assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => "/repo/src/components/LoginPicture.tsx" }), true);
  assert.equal(group.test({ layer: "ssr", nameForCondition: () => "/repo/src/components/LoginPicture.tsx" }), false);
  assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => "/repo/src/components/LoginPictureExtra.tsx" }), false);
});
