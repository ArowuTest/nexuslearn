import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/app/api/version/route.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function responseFor(env) {
  const exports = {};
  runInNewContext(code, { exports, process: { env }, Response });
  return await exports.GET().json();
}

test('build metadata exposes only a valid provider revision and fixed service fields', async () => {
  assert.deepEqual(await responseFor({
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40), PRIVATE_API_KEY: 'not-a-real-secret', GITHUB_SHA: 'b'.repeat(40),
  }), {
    service: 'nexuslearn-web', git_revision: 'a'.repeat(40), git_revision_source: 'vercel-build',
  });
});

test('missing or malformed provider metadata cannot become a release identity', async () => {
  for (const revision of [undefined, '', 'main', 'a'.repeat(39), 'A'.repeat(40), 'a'.repeat(40) + '\n', 'unexpected-provider-value']) {
    assert.deepEqual(await responseFor({ VERCEL_GIT_COMMIT_SHA: revision, GITHUB_SHA: 'b'.repeat(40) }), {
      service: 'nexuslearn-web', git_revision: 'unknown', git_revision_source: 'unknown',
    });
  }
});
