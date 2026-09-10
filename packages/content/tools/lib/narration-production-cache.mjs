import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { canonicalJSONStringify } from "./variant-audio-catalog.mjs";
import { inspectMP3Buffer } from "./mp3-inspection.mjs";

const hash = value => crypto.createHash("sha256").update(value).digest("hex");

export async function withProductionLock(root, run) {
  await fs.mkdir(root, { recursive: true });
  const lock = path.join(root, "run.lock");
  try { await fs.mkdir(lock); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("Narration production lock exists; verify no producer is running and inspect staged work before removing a stale lock");
    throw error;
  }
  try {
    await fs.writeFile(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    return await run();
  } finally {
    await fs.unlink(path.join(lock, "owner.json")).catch(error => { if (error.code !== "ENOENT") throw error; });
    await fs.rmdir(lock);
  }
}

export async function atomicWrite(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data, { flag: "wx" });
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}

export function productionCheckpoint(root, item) {
  const identity = {
    id: item.id, text_sha256: item.text_sha256, voice_id: item.voice_id,
    model_id: item.model_id, voice_settings: item.voice_settings,
    relative_file: item.relative_file, file: item.file, output_format: "mp3_44100_128",
  };
  const key = hash(canonicalJSONStringify(identity));
  const directory = path.join(root, key);
  return { key, identity, directory, audio: path.join(directory, "response.mp3"), receipt: path.join(directory, "receipt.json") };
}

export async function readProductionCheckpoint(checkpoint) {
  try { await fs.access(checkpoint.directory); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  // An incomplete/corrupt checkpoint may represent a paid response. Never hide
  // that evidence by silently generating again or trusting its claimed hash.
  try {
    const receipt = JSON.parse(await fs.readFile(checkpoint.receipt, "utf8"));
    const audio = await fs.readFile(checkpoint.audio);
    const check = { ...inspectMP3Buffer(audio), sha256: hash(audio) };
    if (receipt.version !== 1 || receipt.request_sha256 !== checkpoint.key
      || canonicalJSONStringify(receipt.request) !== canonicalJSONStringify(checkpoint.identity)
      || !Number.isFinite(Date.parse(receipt.generated_at)) || !check.technical_pass
      || receipt.sha256 !== check.sha256 || receipt.bytes !== check.bytes) {
      throw new Error("checkpoint identity or audio verification failed");
    }
    return { ...check, generated_at: receipt.generated_at };
  } catch {
    throw new Error(`Narration checkpoint ${checkpoint.key} is incomplete or invalid; inspect it before retrying a paid request`);
  }
}

export async function writeProductionCheckpoint(checkpoint, audio, check) {
  await atomicWrite(checkpoint.audio, audio);
  await atomicWrite(checkpoint.receipt, `${JSON.stringify({
    version: 1, request_sha256: checkpoint.key, request: checkpoint.identity,
    generated_at: check.generated_at, sha256: check.sha256, bytes: check.bytes,
  }, null, 2)}\n`);
}

export async function removeProductionCheckpoint(checkpoint) {
  await fs.unlink(checkpoint.receipt);
  await fs.unlink(checkpoint.audio);
  await fs.rmdir(checkpoint.directory);
}
