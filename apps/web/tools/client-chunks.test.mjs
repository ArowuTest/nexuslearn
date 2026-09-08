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
