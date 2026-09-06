// Read-only browser audit. Uses local authored content and intercepted API responses.
// Does not grant approvals, change pupil records, or call external services.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('../..');
const out = path.join(root, '.agent/game-audit-2026-09-05');
await fs.mkdir(out, { recursive: true });
const packs = [];
for (const file of await fs.readdir(path.join(root, 'packages/content/packs'))) {
  if (file.endsWith('.json')) packs.push(JSON.parse(await fs.readFile(path.join(root, 'packages/content/packs', file), 'utf8')));
}
const formats = new Map();
for (const pack of packs) for (const question of pack.question_variants || []) {
  const entry = formats.get(question.format) || { pack, question, count: 0, years: new Set() };
  entry.count++;
  entry.years.add(pack.source_alignment.year);
  formats.set(question.format, entry);
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
// Fail closed if the local app accidentally points at a deployed API. The page
// handler below fulfils api.test requests; only the local UI may use the network.
await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:3011'
  ? route.continue() : route.abort('blockedbyclient'));
const page = await context.newPage();
page.setDefaultTimeout(7000);
page.setDefaultNavigationTimeout(25000);
const followup = Boolean(process.env.AUDIT_FOLLOWUP);
const evidence = { date: new Date().toISOString(), scope: 'Local authored fixtures; API intercepted; not a deployed-backend or child-pilot test', inventory: [], probes: {} };
let active, responseCorrect = true, failAttempt = false, requests = [];
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
function mission(sample, overrides = {}) {
  const { pack, question } = sample;
  const alignment = pack.source_alignment;
  return {
    student_id: 'audit-learner',
    activity: { id: 'audit-activity', objective_id: pack.pack_id, title: 'Learning adventure', prompt: 'Explore your next discovery.', interaction: {}, feedback: {}, animation_hooks: {}, status: 'published' },
    objective: { ...pack.objective, id: pack.pack_id, year: alignment.year, subject: alignment.subject, topic: alignment.topic, strand: alignment.strand },
    world: { key: 'audit-world', name: 'Discovery world', year_group: alignment.year, config: { accent: '#7fe7d7', companion: 'Nixi' }, enabled: true },
    world_state: { student_id: 'audit-learner', world_key: 'audit-world', state: { artefacts: [] } },
    questions: [{ ...question, objective_id: pack.pack_id, activity_id: 'audit-activity', status: 'published' }],
    runtime_adaptations: { animation_tier: 'standard', reduced_motion: false, celebration_intensity: 'balanced', reward_style: 'collecting', question_limit: 8, scaffold_level: 'standard', audio_support: false, reading_support: false, companion_style: 'friendly', reasons: [], ...overrides },
  };
}
await page.route('http://api.test/**', async route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/v1/learning/mission') return route.fulfill({ json: active });
  if (url.pathname === '/v1/learning/attempt') {
    requests.push(route.request().postDataJSON());
    if (failAttempt) return route.fulfill({ status: 503, json: { error: 'Simulated response failure' } });
    return route.fulfill({ json: { correct: responseCorrect, mastery_gain: responseCorrect ? 6 : 0, projected_score: 60, projected_band: 'Developing', next_review_days: 3, reward_hook: 'compass-fragment', feedback: responseCorrect ? 'Your discovery is saved.' : 'Look again and try another way.', explanation: active.questions[0].explanation || 'Review the evidence.' } });
  }
  return route.fulfill({ json: {} });
});
async function load(sample, overrides = {}) {
  active = mission(sample, overrides); requests = []; errors.length = 0; failAttempt = false; responseCorrect = true;
  await page.goto('http://127.0.0.1:3011/play/mission?studentId=audit-learner');
  await page.getByRole('region', { name: 'Mission question' }).or(page.getByText('Mission content unavailable', { exact: true })).waitFor({ timeout: 25000 });
  // Allow dynamically imported renderer families to mount before inspecting controls.
  await page.waitForLoadState('networkidle');
}
const task = () => page.getByRole('region', { name: 'Mission question' });
const studio = () => page.locator('[data-switch-region]');
async function capture(name, locator = task()) {
  await locator.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled', timeout: 15000 });
}
const shotFormats = new Set(['trace-path', 'sound-box-build', 'noun-phrase-builder', 'phoneme-count', 'fair-test-plan', 'particle-simulation', 'force-simulator', 'number-line', 'sentence-editor', 'array-build', 'ratio-table', 'fraction-wall']);
try {
  const selectedFormats = process.env.AUDIT_FORMATS?.split(',');
  for (const [format, sample] of followup ? [] : [...formats].filter(([format]) => !selectedFormats || selectedFormats.includes(format))) {
    try {
      await load(sample);
      const region = task();
      const available = await region.count() > 0;
      const buttons = available ? await studio().getByRole('button').evaluateAll(nodes => nodes.map(node => ({ label: node.getAttribute('aria-label') || node.textContent.trim(), disabled: node.disabled }))) : [];
      const submits = buttons.filter(button => /^(submit|send|go$)/i.test(button.label));
      const text = available ? await studio().innerText() : await page.locator('main').innerText();
      evidence.inventory.push({ format, count: sample.count, years: [...sample.years], sample: sample.question.id, status: sample.question.status, available, submits, controls: buttons.length, fallbackNotice: /activity format is not available yet/i.test(text), errors: [...errors] });
      if (available && shotFormats.has(format)) await capture(format);
    } catch (error) { evidence.inventory.push({ format, sample: sample.question.id, error: String(error) }); console.log('FORMAT ERROR', format, String(error).slice(0, 200)); }
    if (evidence.inventory.length % 25 === 0) console.log('AUDITED', evidence.inventory.length, 'of', formats.size);
  }
  async function probe(name, run) {
    if (process.env.AUDIT_PROBES && !process.env.AUDIT_PROBES.split(',').includes(name)) return;
    try { evidence.probes[name] = await run(); } catch (error) { evidence.probes[name] = { error: String(error) }; }
    console.log('PROBE', name, JSON.stringify(evidence.probes[name]));
  }
  if (!followup && !process.env.AUDIT_SURVEY_ONLY) {
  await probe('trace-unrelated-line', async () => {
    await load(formats.get('trace-path'));
    const trace = page.getByRole('img', { name: /Trace the lowercase/ });
    const box = await trace.boundingBox();
    await page.mouse.move(box.x + 10, box.y + 12); await page.mouse.down();
    await page.mouse.move(box.x + 90, box.y + 12, { steps: 14 }); await page.mouse.up();
    const enabled = await page.getByRole('button', { name: 'Send trace', exact: true }).isEnabled();
    if (enabled) await page.getByRole('button', { name: 'Send trace', exact: true }).click();
    return { arbitraryStraightLineAcceptedForSubmission: enabled, submitted: requests[0] };
  });
  await probe('trace-other-letter', async () => {
    const sample = structuredClone(formats.get('trace-path'));
    sample.question.body.letter = 'l'; sample.question.body.prompt = 'Trace lowercase l.';
    await load(sample); await capture('trace-letter-l');
    return { announcedLetter: await page.getByRole('img', { name: /Trace the lowercase/ }).getAttribute('aria-label'), guidePath: await page.locator('.letter-trace-path').getAttribute('d') };
  });
  await probe('sound-box-dead-end', async () => {
    await load(formats.get('sound-box-build'));
    for (const letter of ['d', 'o', 'g']) await page.getByRole('region', { name: 'Sound box builder' }).getByRole('button', { name: letter, exact: true }).click();
    await page.getByRole('button', { name: 'Use these boxes' }).click();
    await capture('sound-box-completed');
    return { submittedCount: requests.length, submitButtons: await studio().getByRole('button', { name: /^(submit|send)/i }).count(), visible: await page.getByRole('region', { name: 'Sound box builder' }).innerText() };
  });
  await probe('particle-evidence', async () => {
    await load(formats.get('particle-simulation'));
    const slider = page.getByRole('slider', { name: 'Particle energy' });
    const initial = await slider.inputValue();
    const particles = await page.locator('.particle-chamber').evaluateAll(nodes => nodes.map(node => ({ state: node.getAttribute('aria-label'), count: node.querySelectorAll('.particle-dot').length })));
    await page.getByRole('button', { name: active.questions[0].expected_answer.value, exact: true }).click();
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    return { initialEnergy: initial, particles, submittedWithoutMovingSlider: requests.length === 1, submitted: requests[0] };
  });
  await probe('switch-feedback-dead-end', async () => {
    await load(formats.get('timed-recall'), { switch_access: true });
    await page.getByRole('button', { name: 'Keyboard answer', exact: true }).click();
    await page.getByLabel('Keyboard answer', { exact: true }).selectOption(String(active.questions[0].expected_answer.value));
    await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await page.getByTestId('mission-reward-moment').waitFor();
    await capture('switch-feedback', page.getByTestId('mission-reward-moment'));
    return { continueVisible: await page.getByRole('button', { name: 'See my discoveries' }).isVisible(), switchScanCandidates: await page.locator('[data-switch-region] button:not(:disabled), [data-switch-region] [tabindex="0"]').count() };
  });
  await probe('failed-save-retry-identity', async () => {
    await load(formats.get('timed-recall'));
    await page.getByRole('button', { name: 'Keyboard answer', exact: true }).click();
    const answer = page.getByLabel('Keyboard answer', { exact: true });
    const expected = String(active.questions[0].expected_answer.value);
    failAttempt = true; await answer.selectOption(expected); await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('select[id^="keyboard-answer"]')?.value === '');
    const failureMessageVisible = await page.getByText('I could not save that answer. Please try again in a moment.', { exact: true }).isVisible();
    await capture('failed-save-answer-reset');
    const retained = await answer.inputValue();
    failAttempt = false; await answer.selectOption(expected); await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await page.getByTestId('mission-reward-moment').waitFor();
    return { retainedAnswer: retained, failureMessageVisible, requestIDs: requests.map(request => request.id) };
  });
  await probe('decimal-serialization', async () => {
    const sample = structuredClone(formats.get('timed-recall'));
    sample.question.body = { prompt: 'What is 1.5 plus 1?', input: 'number' }; sample.question.expected_answer = { value: 2.5 };
    await load(sample); await page.getByRole('button', { name: 'Keyboard answer', exact: true }).click();
    await page.getByLabel('Keyboard answer', { exact: true }).fill('2.5'); await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
    await page.getByTestId('mission-reward-moment').waitFor();
    return { typed: '2.5', submitted: requests[0] };
  });
  }
  if (followup) {
    await probe('authored-hints-and-retry', async () => {
      await load(formats.get('word-build'));
      await page.getByRole('button', { name: 'Keyboard answer', exact: true }).click();
      await page.getByLabel('Keyboard answer', { exact: true }).fill('zzz');
      responseCorrect = false;
      await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
      await page.getByTestId('mission-reward-moment').waitFor();
      await capture('retry-without-authored-hints');
      const visibleText = await task().innerText();
      const visibleHints = active.questions[0].hints.filter(hint => visibleText.includes(hint));
      responseCorrect = true;
      const expected = active.questions[0].expected_answer.value;
      await page.getByLabel('Keyboard answer', { exact: true }).fill(Array.isArray(expected) ? expected.join('') : String(expected));
      await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
      await page.getByRole('button', { name: 'See my discoveries' }).waitFor();
      return { authoredHints: active.questions[0].hints, visibleHints, secondAttemptHintUsed: requests[1]?.hint_used };
    });
    await probe('array-construction-evidence', async () => {
      const sample = structuredClone(formats.get('array-build'));
      sample.question.body = { prompt: 'Build three rows of four.', a: 3, b: 4, input: 'number' }; sample.question.expected_answer = { value: 12 };
      await load(sample);
      await page.getByRole('slider').nth(0).fill('2'); await page.getByRole('slider').nth(1).fill('6');
      await capture('array-wrong-structure');
      await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
      await page.getByTestId('mission-reward-moment').waitFor();
      return { requested: '3 rows of 4', constructed: '2 rows of 6', request: requests[0] };
    });
    await probe('unrelated-science-renderers', async () => {
      const findings = [];
      for (const format of ['explain-choice', 'food-chain-build', 'force-simulator', 'population-simulation', 'symbol-diagram-build']) {
        await load(formats.get(format)); await capture('context-' + format);
        findings.push({ format, prompt: active.questions[0].body.prompt, particlePanels: await page.locator('.particle-chamber').count(), forceLab: await page.getByRole('region', { name: 'Force model lab' }).count(), sliderCount: await studio().getByRole('slider').count(), text: await studio().innerText() });
      }
      return findings;
    });
    await probe('teaching-model-is-prose', async () => {
      const sample = formats.get('sound-box-build');
      active = mission(sample); active.activity.interaction.teaching_sequence = sample.pack.teaching_sequence;
      await page.goto('http://127.0.0.1:3011/play/mission?studentId=audit-learner');
      await page.getByText(sample.pack.teaching_sequence[0].child_prompt, { exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, 'teaching-model-prose.png'), fullPage: true, animations: 'disabled' });
      return { visualModel: sample.pack.teaching_sequence[0].visual_model, displayedAsText: await page.getByText(sample.pack.teaching_sequence[0].visual_model, { exact: true }).isVisible() };
    });
  }
  await page.setViewportSize(devices['Pixel 7'].viewport);
  await load(formats.get('sound-box-build'), { reduced_motion: true, animation_tier: 'static' });
  await page.screenshot({ path: path.join(out, 'mobile-mission.png'), fullPage: true, animations: 'disabled' });
  evidence.probes.mobile = await page.evaluate(() => ({ viewportHeight: innerHeight, pageHeight: document.documentElement.scrollHeight, taskTop: document.querySelector('[aria-label="Mission question"]').getBoundingClientRect().top, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }));
} finally {
  await fs.writeFile(path.join(out, process.env.AUDIT_PROBES ? 'focused-probe-evidence.json' : process.env.AUDIT_RERUN ? 'rerun-evidence.json' : followup ? 'followup-evidence.json' : process.env.AUDIT_SURVEY_ONLY ? 'retry-evidence.json' : 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log('EVIDENCE', out);
  await browser.close();
}
