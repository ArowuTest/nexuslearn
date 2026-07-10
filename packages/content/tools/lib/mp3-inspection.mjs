const bitrateTables = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

export function inspectMP3Buffer(buffer) {
  const bytes = buffer.length;
  const id3 = bytes >= 10 && buffer.subarray(0, 3).toString("ascii") === "ID3";
  const audioStart = id3 ? 10 + synchsafe(buffer.subarray(6, 10)) : 0;
  const firstFrame = findFrame(buffer, audioStart, Math.min(bytes - 4, audioStart + 64 * 1024));
  if (firstFrame < 0) return result({ bytes, id3, reason: "no valid MPEG audio frame found" });

  let offset = firstFrame;
  let frames = 0;
  let durationSeconds = 0;
  let sampleRate = 0;
  let bitrateTotal = 0;
  let truncated = false;

  while (offset + 4 <= bytes) {
    const header = parseFrameHeader(buffer, offset);
    if (!header) break;
    if (offset + header.frameLength > bytes) {
      truncated = true;
      break;
    }
    frames += 1;
    durationSeconds += header.samplesPerFrame / header.sampleRate;
    sampleRate = sampleRate || header.sampleRate;
    bitrateTotal += header.bitrateKbps;
    offset += header.frameLength;
  }

  const trailing = bytes - offset;
  const recognisedTail = trailing === 0
    || (trailing === 128 && buffer.subarray(offset, offset + 3).toString("ascii") === "TAG")
    || trailing < 16;
  const technicalPass = bytes >= 2_000
    && frames >= 3
    && durationSeconds >= 0.1
    && !truncated
    && recognisedTail;
  let reason = "";
  if (truncated) reason = "truncated MPEG audio frame";
  else if (frames < 3) reason = "fewer than three complete MPEG audio frames";
  else if (durationSeconds < 0.1) reason = "audio duration is too short";
  else if (!recognisedTail) reason = String(trailing) + " unparsed trailing bytes";

  return result({
    bytes,
    id3,
    frameSync: firstFrame >= 0,
    frames,
    durationSeconds,
    sampleRate,
    averageBitrateKbps: frames ? bitrateTotal / frames : 0,
    truncated,
    trailingBytes: trailing,
    technicalPass,
    reason,
  });
}

function result(values) {
  return {
    bytes: values.bytes ?? 0,
    mp3_signature: Boolean(values.id3 || values.frameSync),
    frame_count: values.frames ?? 0,
    duration_seconds: round(values.durationSeconds ?? 0, 3),
    sample_rate_hz: values.sampleRate ?? 0,
    average_bitrate_kbps: round(values.averageBitrateKbps ?? 0, 1),
    truncated: Boolean(values.truncated),
    trailing_bytes: values.trailingBytes ?? 0,
    technical_pass: Boolean(values.technicalPass),
    technical_reason: values.reason ?? "",
  };
}

function synchsafe(bytes) {
  if (bytes.length !== 4 || [...bytes].some((value) => value > 0x7f)) return 0;
  return ((bytes[0] << 21) | (bytes[1] << 14) | (bytes[2] << 7) | bytes[3]) >>> 0;
}

function findFrame(buffer, start, end) {
  for (let offset = Math.max(0, start); offset <= end; offset += 1) {
    const first = parseFrameHeader(buffer, offset);
    if (!first || offset + first.frameLength + 4 > buffer.length) continue;
    if (parseFrameHeader(buffer, offset + first.frameLength)) return offset;
  }
  return -1;
}

function parseFrameHeader(buffer, offset) {
  if (offset + 4 > buffer.length || buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (buffer[offset + 1] >> 3) & 0x03;
  const layerBits = (buffer[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (buffer[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (buffer[offset + 2] >> 2) & 0x03;
  const padding = (buffer[offset + 2] >> 1) & 0x01;
  if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;

  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = 4 - layerBits;
  const tableVersion = version === 1 ? 1 : 2;
  const bitrateKbps = bitrateTables[String(tableVersion) + "-" + String(layer)]?.[bitrateIndex] ?? 0;
  const baseSampleRates = [44100, 48000, 32000];
  const sampleRate = Math.round(baseSampleRates[sampleRateIndex] / (version === 1 ? 1 : version === 2 ? 2 : 4));
  if (!bitrateKbps || !sampleRate) return null;

  let frameLength;
  let samplesPerFrame;
  if (layer === 1) {
    frameLength = Math.floor((12_000 * bitrateKbps) / sampleRate + padding) * 4;
    samplesPerFrame = 384;
  } else if (layer === 2) {
    frameLength = Math.floor((144_000 * bitrateKbps) / sampleRate) + padding;
    samplesPerFrame = 1152;
  } else {
    frameLength = Math.floor(((version === 1 ? 144_000 : 72_000) * bitrateKbps) / sampleRate) + padding;
    samplesPerFrame = version === 1 ? 1152 : 576;
  }
  if (frameLength < 24) return null;
  return { version, layer, bitrateKbps, sampleRate, frameLength, samplesPerFrame };
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
