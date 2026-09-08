// Pure function: also injected into a disposable Chromium page for PCM analysis.
export function measurePCM(channels, sampleRate) {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !channels[0].length || channels.some(c => c.length !== channels[0].length)) throw new Error("Invalid PCM shape");
  const length = channels[0].length;
  const blockSize = Math.max(1, Math.round(sampleRate * 0.02));
  let peak = 0, energy = 0, clipped = 0, invalid = 0, silentSamples = 0, leading = 0, trailing = 0, heard = false;
  for (let start = 0; start < length; start += blockSize) {
    const end = Math.min(length, start + blockSize);
    let blockEnergy = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i++) {
        const v = channel[i];
        if (!Number.isFinite(v)) { invalid++; continue; }
        peak = Math.max(peak, Math.abs(v));
        if (Math.abs(v) >= 0.999) clipped++;
        blockEnergy += v * v;
      }
    }
    energy += blockEnergy;
    if (Math.sqrt(blockEnergy / ((end - start) * channels.length)) < 0.00316227766) {
      silentSamples += end - start;
      trailing += end - start;
      if (!heard) leading += end - start;
    } else { heard = true; trailing = 0; }
  }
  const round = v => Math.round(v * 10000) / 10000;
  return {
    duration_seconds: round(length / sampleRate), sample_rate_hz: sampleRate, channels: channels.length,
    // Retain full precision for values used in threshold decisions.
    rms: Math.sqrt(energy / (length * channels.length)), peak,
    clipped_samples: clipped, clipped_fraction: clipped / (length * channels.length), non_finite_samples: invalid,
    silent_fraction: silentSamples / length, leading_silence_seconds: leading / sampleRate, trailing_silence_seconds: trailing / sampleRate,
  };
}

export { assessPace } from "../src/lib/audio-pace.mjs";
