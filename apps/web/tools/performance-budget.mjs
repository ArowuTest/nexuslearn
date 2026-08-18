import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const nextRoot = path.resolve(process.cwd(), ".next");
const staticRoot = path.join(nextRoot, "static");
const serverAppRoot = path.join(nextRoot, "server", "app");
const limits = {
  // Aggregate output catches runaway dependency growth, but it is not a user
  // payload: route isolation and lazy chunks mean no browser downloads every
  // file together. The route ceiling measures the strict initial uncompressed
  // JavaScript for one rendered route, including shared framework chunks.
  aggregateJavaScript: 1_400_000,
  largestRouteJavaScript: 750_000,
  largestJavaScript: 250_000,
  totalCSS: 120_000,
  individualPublicAsset: 600_000,
};

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }));
  return nested.flat();
}

async function sizes(files) {
  return Promise.all(files.map(async (file) => ({ file, size: (await stat(file)).size })));
}

const staticFiles = await sizes(await filesUnder(staticRoot));
const publicFiles = await sizes(await filesUnder(path.resolve(process.cwd(), "public")));
const javascript = staticFiles.filter(({ file }) => file.endsWith(".js"));
const css = staticFiles.filter(({ file }) => file.endsWith(".css"));
const totalJavaScript = javascript.reduce((sum, item) => sum + item.size, 0);
const largestJavaScript = Math.max(0, ...javascript.map((item) => item.size));
const totalCSS = css.reduce((sum, item) => sum + item.size, 0);
const largestPublicAsset = Math.max(0, ...publicFiles.map((item) => item.size));
const javascriptByBuildPath = new Map(javascript.map(({ file, size }) => [
  path.relative(nextRoot, file).split(path.sep).join("/"),
  size,
]));
const buildManifest = JSON.parse(await readFile(path.join(nextRoot, "build-manifest.json"), "utf8"));
const sharedRouteFiles = [...new Set([
  ...(buildManifest.rootMainFiles ?? []),
  ...(buildManifest.polyfillFiles ?? []),
])];
const routeEvidenceFiles = (await filesUnder(serverAppRoot)).filter((file) =>
  file.endsWith(".html") || file.endsWith("page_client-reference-manifest.js"),
);
const staticHTMLEvidenceFiles = routeEvidenceFiles.filter((file) => file.endsWith(".html"));
const clientManifestEvidenceFiles = routeEvidenceFiles.filter((file) => file.endsWith("page_client-reference-manifest.js"));
if (staticHTMLEvidenceFiles.length === 0) {
  throw new Error("performance-budget could not find emitted static HTML route evidence under .next/server/app");
}
const routeJavaScript = await Promise.all(routeEvidenceFiles.map(async (file) => {
  const raw = await readFile(file, "utf8");
  const isStaticHTML = file.endsWith(".html");
  const matches = isStaticHTML
    ? [...raw.matchAll(/\/_next\/(static\/chunks\/[^"'\s]+\.js)/g)].map((match) => match[1])
    : [...raw.matchAll(/["'](static\/chunks\/[^"']+\.js)["']/g)].map((match) => match[1]);
  if (isStaticHTML && matches.length === 0) {
    throw new Error(`performance-budget could not extract JavaScript route evidence from emitted static HTML ${path.relative(serverAppRoot, file)}`);
  }
  const buildPaths = new Set(isStaticHTML ? matches : [...sharedRouteFiles, ...matches]);
  const missingBuildPaths = [...buildPaths].filter((buildPath) => !javascriptByBuildPath.has(buildPath));
  if (missingBuildPaths.length > 0) {
    throw new Error(
      `performance-budget ${path.relative(serverAppRoot, file)} references ${missingBuildPaths.join(", ")} not present in .next/static`,
    );
  }
  const bytes = [...buildPaths].reduce((sum, buildPath) => sum + javascriptByBuildPath.get(buildPath), 0);
  return { file, bytes };
}));
if (routeJavaScript.length === 0) {
  throw new Error("performance-budget could not find built route evidence under .next/server/app");
}
const largestRoute = routeJavaScript.reduce((largest, route) => route.bytes > largest.bytes ? route : largest);

const measurements = {
  aggregateJavaScript: totalJavaScript,
  largestRouteJavaScript: largestRoute.bytes,
  largestJavaScript,
  totalCSS,
  largestPublicAsset,
};
const failures = [];
for (const [key, value] of Object.entries(measurements)) {
  const limitKey = key === "largestPublicAsset" ? "individualPublicAsset" : key;
  const limit = limits[limitKey];
  if (value > limit) failures.push(`${key} ${value} exceeds ${limit}`);
}

console.log(
  `performance-budget js_total=${totalJavaScript} js_route_max=${largestRoute.bytes} route=${path.relative(serverAppRoot, largestRoute.file)} route_evidence=${routeEvidenceFiles.length} static_html=${staticHTMLEvidenceFiles.length} manifests=${clientManifestEvidenceFiles.length} js_max=${largestJavaScript} css_total=${totalCSS} public_max=${largestPublicAsset}`,
);
if (failures.length) {
  for (const failure of failures) console.error(`performance-budget failure: ${failure}`);
  process.exit(1);
}
