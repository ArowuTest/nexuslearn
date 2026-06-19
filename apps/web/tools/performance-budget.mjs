import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.cwd(), ".next", "static");
const limits = {
  totalJavaScript: 1_200_000,
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

const staticFiles = await sizes(await filesUnder(root));
const publicFiles = await sizes(await filesUnder(path.resolve(process.cwd(), "public")));
const javascript = staticFiles.filter(({ file }) => file.endsWith(".js"));
const css = staticFiles.filter(({ file }) => file.endsWith(".css"));
const totalJavaScript = javascript.reduce((sum, item) => sum + item.size, 0);
const largestJavaScript = Math.max(0, ...javascript.map((item) => item.size));
const totalCSS = css.reduce((sum, item) => sum + item.size, 0);
const largestPublicAsset = Math.max(0, ...publicFiles.map((item) => item.size));

const measurements = {
  totalJavaScript,
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
  `performance-budget js_total=${totalJavaScript} js_max=${largestJavaScript} css_total=${totalCSS} public_max=${largestPublicAsset}`,
);
if (failures.length) {
  for (const failure of failures) console.error(`performance-budget failure: ${failure}`);
  process.exit(1);
}
