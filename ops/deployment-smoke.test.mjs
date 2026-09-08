import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentProblems, collectDeployment, waitForDeployment } from './deployment-smoke.mjs';

const sha = 'a'.repeat(40);
function healthy() {
  return {
    health: { status: 200, body: { status: 'ok' } },
    version: { status: 200, body: {
      git_revision: sha, git_revision_source: 'go-vcs', git_revision_state: 'clean',
      grading_contract: 'canonical-v1', pupil_question_contract: 'render-v1',
      attempt_submission_contract: 'typed-versioned-v1', attempt_evidence_contract: 'submitted-v1',
      assistance_policy_contract: 'assistance-policy-v1', feedback_contract: 'task-repair-v1',
      marking_policy_contract: 'authored-v1', pupil_audio_contract: 'aliases-v1', required_listening_contract: 'ledger-v1',
    } },
    webVersion: { status: 200, body: { service: 'nexuslearn-web', git_revision: sha, git_revision_source: 'vercel-build' } },
    pupilToday: { status: 200 },
    family: { status: 200 }, privateReport: { status: 404 },
    publicAudio: { status: 200, body: { items: [{ asset_id: 'clip', file: '/audio/clip.mp3' }] } },
    parentEvidence: { status: 401 },
  };
}

test('exact clean revision and all existing boundaries are required', () => {
  assert.deepEqual(deploymentProblems(healthy(), sha), []);
  const old = healthy(); old.version.body.git_revision = 'b'.repeat(40);
  assert.match(deploymentProblems(old, sha).join(' '), /revision/);
});

test('legacy contract-only backend cannot pass', () => {
  const old = healthy(); delete old.version.body.git_revision;
  assert.ok(deploymentProblems(old, sha).length);
});

test('a current API cannot hide a stale frontend or a missing pupil entry page', () => {
  const stale = healthy(); stale.webVersion.body.git_revision = 'b'.repeat(40);
  assert.match(deploymentProblems(stale, sha).join(' '), /Frontend revision/);
  const missing = healthy(); missing.pupilToday.status = 404;
  assert.match(deploymentProblems(missing, sha).join(' '), /Pupil route/);
});

test('frontend identity must be available, valid and from the Vercel build', () => {
  for (const identity of [null, {}, { service: 'another-app', git_revision: sha, git_revision_source: 'vercel-build' },
    { service: 'nexuslearn-web', git_revision: sha, git_revision_source: 'unknown' }]) {
    const snapshot = healthy(); snapshot.webVersion.body = identity;
    assert.ok(deploymentProblems(snapshot, sha).some(problem => /Frontend/.test(problem)));
  }
});

for (const state of ['modified', 'conflict', 'unknown', 'invalid', undefined]) {
  test(`unverifiable ${state} revision fails closed`, () => {
    const snapshot = healthy(); snapshot.version.body.git_revision_state = state;
    assert.ok(deploymentProblems(snapshot, sha).length);
  });
}

test('validated Render fallback is distinguished from embedded clean identity', () => {
  const snapshot = healthy();
  Object.assign(snapshot.version.body, { git_revision_source: 'render', git_revision_state: 'reported' });
  assert.deepEqual(deploymentProblems(snapshot, sha), []);
  snapshot.version.body.git_revision_source = 'arbitrary';
  assert.ok(deploymentProblems(snapshot, sha).length);
});

test('malformed expected SHA is rejected rather than interpolated into commands', () => {
  for (const expected of ['', undefined, 'main', sha.slice(0, 7), `${sha}\n`]) {
    assert.throws(() => deploymentProblems(healthy(), expected), /40-character/);
  }
});

test('HTTP failures, redirects, malformed JSON and exposed private surfaces cannot pass', () => {
  for (const key of Object.keys(healthy())) {
    const snapshot = healthy(); snapshot[key].status = 302;
    assert.ok(deploymentProblems(snapshot, sha).length, key);
  }
  for (const key of ['health', 'version', 'webVersion', 'publicAudio']) {
    const snapshot = healthy(); snapshot[key].body = null;
    assert.ok(deploymentProblems(snapshot, sha).length, key);
  }
  const exposed = healthy(); exposed.privateReport.status = 200; exposed.parentEvidence.status = 200;
  assert.equal(deploymentProblems(exposed, sha).length, 2);
  const wrongContract = healthy(); wrongContract.version.body.marking_policy_contract = 'old';
  assert.match(deploymentProblems(wrongContract, sha).join(' '), /marking_policy_contract/);
});

test('collector does not follow redirects or forward credentials and bounds every request', async () => {
  const calls = [];
  const snapshot = await collectDeployment(async (url, options) => {
    calls.push({ url, options });
    return { status: 200, json: async () => { throw new Error('malformed response'); }, body: { cancel: async () => {} } };
  });
  assert.equal(calls.length, 8);
  assert.ok(calls.some(call => call.url === 'https://nexuslearn-woad.vercel.app/api/version'));
  assert.ok(calls.some(call => call.url === 'https://nexuslearn-woad.vercel.app/play/today'));
  for (const { url, options } of calls) {
    assert.match(url, /^https:\/\/nexuslearn(?:-api\.onrender\.com|-woad\.vercel\.app)\//);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(snapshot.version.body, null);
});

test('bounded polling waits for the target rather than passing an older deployment', async () => {
  let calls = 0; let sleeps = 0;
  const result = await waitForDeployment(sha, {
    attempts: 3, collect: async () => {
      calls += 1; const snapshot = healthy();
      if (calls < 3) snapshot.version.body.git_revision = 'b'.repeat(40);
      return snapshot;
    }, sleep: async () => { sleeps += 1; }, log: () => {},
  });
  assert.equal(result.version.body.git_revision, sha);
  assert.equal(calls, 3); assert.equal(sleeps, 2);
});

test('a superseded run fails explicitly; it never silently verifies the newer commit', async () => {
  let sleeps = 0;
  await assert.rejects(waitForDeployment(sha, {
    attempts: 2, collect: async () => { const snapshot = healthy(); snapshot.version.body.git_revision = 'b'.repeat(40); return snapshot; },
    sleep: async () => { sleeps += 1; }, log: () => {},
  }), /not verified/);
  assert.equal(sleeps, 1);
});

test('polling waits for the frontend even when the backend has already caught up', async () => {
  let calls = 0; let sleeps = 0;
  await waitForDeployment(sha, {
    attempts: 3, collect: async () => {
      calls += 1; const snapshot = healthy();
      if (calls < 3) snapshot.webVersion.body.git_revision = 'b'.repeat(40);
      return snapshot;
    }, sleep: async () => { sleeps += 1; }, log: () => {},
  });
  assert.equal(calls, 3); assert.equal(sleeps, 2);
});
