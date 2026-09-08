/**
 * Native played ranges are playback telemetry, never proof of attention.
 * Merge ranges so seeking/replaying cannot count the same audio twice.
 * Allow only codec rounding (at most 100ms AND 1%); keep API validation aligned.
 * @param {number} seconds
 * @param {Array<[number, number]>} ranges
 * @param {number} rate
 */
export function assessPlaybackCoverage(seconds, ranges, rate = 1) {
  const evidence = {
    coverage_version: 'played-ranges-v1', completed: false,
    duration_ms: 0, played_ms: 0, playback_rate: rate,
  };
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600 || rate !== 1) return evidence;
  evidence.duration_ms = Math.round(seconds * 1000);
  if (!Array.isArray(ranges) || ranges.length > 1000 || ranges.some(range => !Array.isArray(range)
    || range.length !== 2 || !range.every(Number.isFinite) || range[0] < 0 || range[1] < range[0] || range[1] > seconds)) return evidence;
  let end = 0, covered = 0;
  for (const [start, next] of [...ranges].sort((a, b) => a[0] - b[0])) {
    covered += Math.max(0, next - Math.max(start, end));
    end = Math.max(end, next);
  }
  evidence.played_ms = Math.min(evidence.duration_ms, Math.round(covered * 1000));
  evidence.completed = evidence.played_ms > 0
    && evidence.duration_ms - evidence.played_ms <= Math.min(100, Math.floor(evidence.duration_ms / 100));
  return evidence;
}
