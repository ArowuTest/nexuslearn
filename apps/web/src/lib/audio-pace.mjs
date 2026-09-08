/**
 * Shared by the offline PCM audit and the authenticated review player.
 * Screening heuristics only: not a curriculum/SEND standard or listening verdict.
 * @param {string | null | undefined} text
 * @param {number | undefined} seconds
 * @param {number} year
 */
export function assessPace(text, seconds, year) {
  const words = String(text ?? "").match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
  if (!Number.isFinite(seconds) || seconds <= 0 || !words) return { words, wpm: null, status: "unmeasurable" };
  const wpm = Math.round(words * 600 / seconds) / 10;
  const upper = year === 1 ? 160 : year === 2 ? 170 : 190;
  return { words, wpm, screening_upper_wpm: upper, status: words < 8 ? "short_script_listen" : wpm > upper ? "pace_review_fast" : wpm < 70 ? "pace_review_slow" : "within_screening_range_not_approval" };
}
