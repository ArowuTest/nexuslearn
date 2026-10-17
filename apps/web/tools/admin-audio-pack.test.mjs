import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(await readFile(new URL("../src/lib/admin-audio.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const history = { last: "" };
const context = {
  exports: {},
  URL,
  URLSearchParams,
  window: {
    location: { href: "https://school.example/admin?audio_pack=old-pack&audio_search=blend" },
    history: { replaceState(_state, _title, next) { history.last = next; } },
  },
};
vm.runInNewContext(source, context);
const { audioFiltersFromSearch, audioQueueQuery, syncAudioFiltersToURL, DEFAULT_AUDIO_FILTERS } = context.exports;

test("one pack filter is read, sent and cleared", () => {
  const filters = audioFiltersFromSearch("?audio_pack=ma-y4-number-multiplication-12x12&audio_search=blend");
  assert.equal(filters.pack, "ma-y4-number-multiplication-12x12");
  const query = audioQueueQuery(filters, 0);
  assert.equal(query.get("pack"), "ma-y4-number-multiplication-12x12");
  assert.equal(query.get("search"), "blend");
  assert.equal(audioQueueQuery({ ...DEFAULT_AUDIO_FILTERS, pack: "  " }, 0).get("pack"), null);
  syncAudioFiltersToURL({ ...filters, pack: "" });
  assert.equal(history.last.includes("audio_pack"), false);
  assert.match(history.last, /audio_search=blend/);
});
