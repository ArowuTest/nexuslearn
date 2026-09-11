import assert from "node:assert/strict";
import { test } from "node:test";
import nextConfig from "../next.config.mjs";

function configuration() {
  return { optimization: { splitChunks: { minSize: 20_000, chunks: () => true, cacheGroups: { framework: { priority: 40 }, lib: { priority: 30 } } } } };
}

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

test("adult authentication lifecycle is shared only by its exact production browser module", () => {
  const config = nextConfig.webpack(configuration(), { isServer: false, dev: false });
  const group = config.optimization.splitChunks.cacheGroups.sharedAccountAuthentication;
  assert.ok(group, "the same lifecycle must not be copied into all three adult routes");
  assert.equal(group.name, "nexuslearn-account-authentication");
  assert.equal(group.minChunks, 2);
  assert.equal(group.enforce, true);
  assert.equal(group.reuseExistingChunk, true);
  for (const resource of ["/repo/src/components/role-workspaces/useAccountAuthentication.ts", "C:\\repo\\src\\components\\role-workspaces\\useAccountAuthentication.ts"]) {
    assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => resource }), true);
    for (const layer of ["rsc", "ssr", undefined]) assert.equal(group.test({ layer, nameForCondition: () => resource }), false);
  }
  for (const resource of ["/repo/src/lib/api.ts", "/repo/src/components/role-workspaces/useAccountAuthenticationExtra.ts", "/repo/src/components/admin/useAccountAuthentication.ts"]) {
    assert.equal(group.test({ layer: "app-pages-browser", nameForCondition: () => resource }), false);
  }
});
