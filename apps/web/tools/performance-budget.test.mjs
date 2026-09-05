import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./performance-budget.mjs", import.meta.url));

test("performance gate fails every missing HTML and manifest chunk reference", async (t) => {
  for (const source of ["html", "manifest"]) {
    await t.test(source, async () => {
      const root = await budgetFixture({
        htmlChunks: source === "html" ? ["static/chunks/missing-html.js"] : ["static/chunks/present.js"],
        manifestChunks: source === "manifest" ? ["static/chunks/missing-manifest.js"] : ["static/chunks/present.js"],
      });
      try {
        const result = runBudget(root);
        assert.equal(result.status, 1, `${source} missing reference unexpectedly passed: ${result.stdout}`);
        assert.match(result.stderr, new RegExp(`missing-${source}\\.js`));
        assert.match(result.stderr, /not present in \.next\/static/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  }
});

test("performance gate requires static HTML evidence and reports evidence counts", async () => {
  const withoutHTML = await budgetFixture({ htmlChunks: null, manifestChunks: ["static/chunks/present.js"] });
  try {
    const missing = runBudget(withoutHTML);
    assert.equal(missing.status, 1, missing.stdout);
    assert.match(missing.stderr, /could not find emitted static HTML route evidence/);
  } finally {
    await rm(withoutHTML, { recursive: true, force: true });
  }

  const valid = await budgetFixture({
    htmlChunks: ["static/chunks/present.js"],
    manifestChunks: ["static/chunks/present.js"],
  });
  try {
    const result = runBudget(valid);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /route_evidence=2/);
    assert.match(result.stdout, /static_html=1/);
    assert.match(result.stdout, /manifests=1/);
  } finally {
    await rm(valid, { recursive: true, force: true });
  }
});

test("performance gate enforces the approved 1,402,000-byte aggregate ceiling", async () => {
  const chunks = Array.from({ length: 6 }, (_, index) => `static/chunks/aggregate-${index}.js`);
  const root = await budgetFixture({
    htmlChunks: [chunks[0]],
    manifestChunks: [chunks[0]],
    chunkSizes: Object.fromEntries(chunks.map((chunk) => [chunk, 240_000])),
  });
  try {
    const result = runBudget(root);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /aggregateJavaScript 1440000 exceeds 1402000/);
    assert.doesNotMatch(result.stderr, /largestJavaScript/);
    assert.doesNotMatch(result.stderr, /largestRouteJavaScript/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function budgetFixture({ htmlChunks, manifestChunks, chunkSizes = {} }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexuslearn-performance-budget-"));
  const nextRoot = path.join(root, ".next");
  const staticChunks = path.join(nextRoot, "static", "chunks");
  const routeRoot = path.join(nextRoot, "server", "app", "example");
  await mkdir(staticChunks, { recursive: true });
  await mkdir(routeRoot, { recursive: true });
  await mkdir(path.join(root, "public"), { recursive: true });
  const sizes = Object.keys(chunkSizes).length > 0 ? chunkSizes : { "static/chunks/present.js": 100 };
  for (const [buildPath, size] of Object.entries(sizes)) {
    const target = path.join(nextRoot, ...buildPath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.alloc(size, 32));
  }
  await writeFile(path.join(nextRoot, "build-manifest.json"), JSON.stringify({ rootMainFiles: [], polyfillFiles: [] }));
  if (htmlChunks) {
    const scripts = htmlChunks.map((chunk) => `<script src="/_next/${chunk}"></script>`).join("");
    await writeFile(path.join(routeRoot, "page.html"), `<!doctype html><html><body>${scripts}</body></html>`);
  }
  if (manifestChunks) {
    await writeFile(
      path.join(routeRoot, "page_client-reference-manifest.js"),
      `self.__RSC_MANIFEST=${JSON.stringify({ chunks: manifestChunks })}`,
    );
  }
  return root;
}

function runBudget(cwd) {
  return spawnSync(process.execPath, [scriptPath], { cwd, encoding: "utf8" });
}
