import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const contracts = {
  grading_contract: 'canonical-v1', pupil_question_contract: 'render-v1',
  attempt_submission_contract: 'typed-versioned-v1', attempt_evidence_contract: 'submitted-v1',
  assistance_policy_contract: 'assistance-policy-v1', feedback_contract: 'task-repair-v1',
  marking_policy_contract: 'authored-v1', pupil_audio_contract: 'aliases-v1', required_listening_contract: 'ledger-v1',
};
const api = 'https://nexuslearn-api.onrender.com';
const web = 'https://nexuslearn-woad.vercel.app';

function validateExpected(expected) {
  if (typeof expected !== 'string' || !/^[a-f0-9]{40}$/.test(expected) || expected.length !== 40) {
    throw new Error('An exact lowercase 40-character SMOKE_EXPECTED_SHA is required.');
  }
}

export function deploymentProblems(snapshot, expected) {
  validateExpected(expected);
  const problems = [];
  if (snapshot.health?.status !== 200 || snapshot.health?.body?.status !== 'ok') problems.push('API health is not ready');
  const version = snapshot.version?.body;
  if (snapshot.version?.status !== 200 || !version) problems.push('API version response is unavailable');
  if (version?.git_revision !== expected) problems.push(`API revision does not match target ${expected}`);
  const verifiedSource = (version?.git_revision_source === 'go-vcs' && version?.git_revision_state === 'clean')
    || (version?.git_revision_source === 'render' && version?.git_revision_state === 'reported');
  if (!verifiedSource) problems.push('API revision source/state is not verifiable');
  for (const [key, value] of Object.entries(contracts)) {
    if (version?.[key] !== value) problems.push(`API ${key} is not ${value}`);
  }
  const frontend = snapshot.webVersion?.body;
  if (snapshot.webVersion?.status !== 200 || frontend?.service !== 'nexuslearn-web') problems.push('Frontend version response is unavailable');
  if (frontend?.git_revision !== expected) problems.push(`Frontend revision does not match target ${expected}`);
  if (frontend?.git_revision_source !== 'vercel-build') problems.push('Frontend revision source is not a Vercel build');
  if (snapshot.pupilToday?.status !== 200) problems.push('Pupil route is not ready');
  if (snapshot.family?.status !== 200) problems.push('Family page is not ready');
  if (snapshot.privateReport?.status !== 404) problems.push('Private review report must return 404');
  if (snapshot.publicAudio?.status !== 200 || !Array.isArray(snapshot.publicAudio?.body?.items) || snapshot.publicAudio.body.items.length === 0) {
    problems.push('Public narration manifest is not ready');
  }
  if (snapshot.parentEvidence?.status !== 401) problems.push('Unauthenticated parent evidence must return 401');
  return problems;
}

export async function collectDeployment(fetcher = fetch) {
  const requests = [
    ['health', `${api}/healthz`, true], ['version', `${api}/v1/version`, true],
    ['webVersion', `${web}/api/version`, true], ['pupilToday', `${web}/play/today`, false],
    ['family', `${web}/family`, false],
    ['privateReport', `${web}/content/pilot-review-evidence-template.json`, false],
    ['publicAudio', `${web}/content/narration-manifest.json`, true],
    ['parentEvidence', `${api}/v1/parent/children/smoke-test/evidence`, false],
  ];
  return Object.fromEntries(await Promise.all(requests.map(async ([key, url, json]) => {
    try {
      const response = await fetcher(url, {
        redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': 'NexusLearn-deployment-smoke', 'Cache-Control': 'no-cache' },
      });
      const body = json ? await response.json().catch(() => null) : null;
      if (!json) await response.body?.cancel();
      return [key, { status: response.status, body }];
    } catch {
      // Only fixed surface names enter logs; never echo arbitrary response bodies.
      return [key, { status: 0, body: null }];
    }
  })));
}

export async function waitForDeployment(expected, { attempts = 30, collect = collectDeployment, sleep: pause = sleep, log = console.log } = {}) {
  validateExpected(expected);
  let problems = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const snapshot = await collect();
    problems = deploymentProblems(snapshot, expected);
    if (!problems.length) {
      log(`Verified backend and frontend revision ${expected} (${snapshot.version.body.git_revision_source}, ${snapshot.webVersion.body.git_revision_source}) and deployed access boundaries.`);
      return snapshot;
    }
    log(`Deployment not ready (${attempt}/${attempts}): ${problems.join('; ')}`);
    if (attempt < attempts) await pause(30_000);
  }
  throw new Error(`Target ${expected} not verified: ${problems.join('; ')}. If main advanced, inspect the latest run; this run does not verify another revision.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  waitForDeployment(process.env.SMOKE_EXPECTED_SHA).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
