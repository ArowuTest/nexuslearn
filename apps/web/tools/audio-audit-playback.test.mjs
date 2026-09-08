import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessPlaybackCoverage } from '../src/lib/audio-playback-coverage.mjs';

test('a native ended event without played coverage is not completion', () => {
  assert.equal(assessPlaybackCoverage(10, []).completed, false);
  assert.equal(assessPlaybackCoverage(10, [[9, 10]]).completed, false);
});

test('full playback and pause/resume ranges provide coverage telemetry', () => {
  assert.deepEqual(assessPlaybackCoverage(10, [[0, 3], [3, 10]]), {
    coverage_version: 'played-ranges-v1', completed: true, duration_ms: 10000, played_ms: 10000, playback_rate: 1,
  });
});

test('overlapping replay cannot double count or fill an unplayed gap', () => {
  const ranges = [[7, 10], [0, 3], [1, 3], [7, 10]];
  assert.equal(assessPlaybackCoverage(10, ranges).played_ms, 6000);
  assert.equal(assessPlaybackCoverage(10, ranges).completed, false);
  assert.equal(ranges[0][0], 7, 'input ranges are not mutated');
});

test('codec rounding allowance is bounded by both 100ms and one percent', () => {
  assert.equal(assessPlaybackCoverage(2, [[0, 1.98]]).completed, true);
  assert.equal(assessPlaybackCoverage(2, [[0, 1.979]]).completed, false);
  assert.equal(assessPlaybackCoverage(120, [[0, 119.9]]).completed, true);
  assert.equal(assessPlaybackCoverage(120, [[0, 119.899]]).completed, false);
});

test('unknown duration, invalid ranges and altered playback rates fail closed', () => {
  for (const duration of [NaN, Infinity, 0, -1, 3601]) assert.equal(assessPlaybackCoverage(duration, []).completed, false);
  for (const ranges of [[[0, Infinity]], [[-1, 10]], [[4, 3]], [[0, 11]], [[0]], Array.from({ length: 1001 }, () => [0, 10])]) {
    assert.equal(assessPlaybackCoverage(10, ranges).completed, false);
  }
  for (const rate of [0.9, 2, NaN]) assert.equal(assessPlaybackCoverage(10, [[0, 10]], rate).completed, false);
});
