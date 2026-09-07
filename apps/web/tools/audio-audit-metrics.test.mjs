import test from "node:test";
import assert from "node:assert/strict";
import { measurePCM, assessPace } from "./audio-audit-metrics.mjs";

test("decoded silence is not real audible speech", () => {
  const result = measurePCM([new Float32Array(1000)], 1000);
  assert.equal(result.silent_fraction, 1);
  assert.equal(result.peak, 0);
  assert.equal(result.duration_seconds, 1);
});
test("signal metrics preserve leading and trailing silence", () => {
  const samples = new Float32Array(1000);
  samples.fill(0.1, 200, 800);
  const result = measurePCM([samples], 1000);
  assert.equal(result.leading_silence_seconds, 0.2);
  assert.equal(result.trailing_silence_seconds, 0.2);
  assert.equal(result.silent_fraction, 0.4);
  assert.ok(result.rms > 0.07 && result.rms < 0.08);
});
test("clipping and non-finite data are visible", () => {
  const result = measurePCM([Float32Array.from([1, -1, 0.1, NaN])], 1000);
  assert.equal(result.clipped_samples, 2);
  assert.equal(result.non_finite_samples, 1);
});
test("short vocabulary cannot be given a confident pace verdict", () => {
  assert.equal(assessPace("A denominator.", 0.5, 1).status, "short_script_listen");
});
test("early-year fast script is flagged, never auto-approved", () => {
  const fast = assessPace("This is a complete teaching instruction with exactly ten words", 3, 1);
  assert.equal(fast.status, "pace_review_fast");
  assert.equal(assessPace("This is a complete teaching instruction with exactly ten words", 5, 1).status, "within_screening_range_not_approval");
});
test("invalid durations cannot produce pace approval", () => {
  assert.equal(assessPace("Read this instruction now.", 0, 3).status, "unmeasurable");
});

test("quiet signal and near-threshold clipping are not rounded into different classifications", () => {
  assert.ok(measurePCM([Float32Array.from([0.00002])], 1000).peak > 0.00001);
  const samples = new Float32Array(10000);
  samples.fill(1, 0, 11);
  assert.ok(measurePCM([samples], 1000).clipped_fraction > 0.001);
});

test("invalid PCM shape fails and a valid second channel is measured", () => {
  assert.throws(() => measurePCM([], 44100));
  assert.throws(() => measurePCM([new Float32Array(1), new Float32Array(2)], 44100));
  assert.throws(() => measurePCM([new Float32Array(1)], NaN));
  assert.equal(measurePCM([new Float32Array(100), new Float32Array(100).fill(0.5)], 1000).peak, 0.5);
});
