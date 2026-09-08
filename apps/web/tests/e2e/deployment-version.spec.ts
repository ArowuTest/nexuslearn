import { expect, test } from '@playwright/test';

test('public frontend identity reports only the immutable build revision', async ({ request }) => {
  const response = await request.get('/api/version');
  expect(response.status()).toBe(200);
  const expected = process.env.WEB_EXPECTED_BUILD_SHA;
  expect(await response.json()).toEqual({
    service: 'nexuslearn-web',
    git_revision: expected || 'unknown',
    git_revision_source: expected ? 'vercel-build' : 'unknown',
  });
});
