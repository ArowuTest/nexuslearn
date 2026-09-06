import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('../..');
const packs = [];
for (const file of await fs.readdir(path.join(root, 'packages/content/packs'))) if (file.endsWith('.json')) {
  packs.push(JSON.parse(await fs.readFile(path.join(root, 'packages/content/packs', file), 'utf8')));
}
const formatSource = await fs.readFile('src/components/learning-studio/formats.ts', 'utf8');
const registered = new Set([...formatSource.matchAll(/export const \w+_FORMATS = \[([\s\S]*?)\] as const;/g)].flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1])));
const variants = packs.flatMap(pack => (pack.question_variants || []).map(question => ({ ...question, pack: pack.pack_id, year: pack.source_alignment.year, subject: pack.source_alignment.subject })));
const count = predicate => variants.filter(predicate).length;
const formatRows = [...new Set(variants.map(q => q.format))].sort().map(format => ({ format, dedicated: registered.has(format), count: count(q => q.format === format), years: [...new Set(variants.filter(q => q.format === format).map(q => q.year))].sort() }));
const evidence = {
  date: new Date().toISOString(), packs: packs.length, variants: variants.length,
  rawPackStatuses: Object.fromEntries([...new Set(variants.map(q => q.status))].map(status => [status, count(q => q.status === status)])),
  registeredFormats: registered.size, authoredFormats: formatRows.length,
  registeredAndAuthored: formatRows.filter(row => row.dedicated).length,
  formats: formatRows,
  decimalAnswers: variants.filter(q => typeof q.expected_answer?.value === 'number' && !Number.isInteger(q.expected_answer.value)).map(q => ({ id: q.id, year: q.year, format: q.format, expected: q.expected_answer.value })),
  traceLetters: [...new Set(variants.filter(q => q.format === 'trace-path').map(q => q.body.letter))],
  machineStyleCorrectFeedback: count(q => (q.feedback?.correct || '').startsWith('After the response is checked')),
  interpretation: 'Raw authored pack inventory. These statuses are not the deployed database, imported AI-review evidence, or release approval totals. A generic renderer may be appropriate; format-name counts do not establish playable or educational quality.',
};
await fs.mkdir(path.join(root, '.agent/game-audit-2026-09-05'), { recursive: true });
await fs.writeFile(path.join(root, '.agent/game-audit-2026-09-05/static-evidence.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ packs: evidence.packs, variants: evidence.variants, authoredFormats: evidence.authoredFormats, registeredFormats: evidence.registeredFormats, registeredAndAuthored: evidence.registeredAndAuthored, decimalAnswers: evidence.decimalAnswers.length, machineStyleCorrectFeedback: evidence.machineStyleCorrectFeedback }));
