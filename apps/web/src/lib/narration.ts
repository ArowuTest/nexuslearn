"use client";

import { useEffect, useState } from "react";

type NarrationManifestItem = {
  id?: string;
  file?: string;
  technical_pass?: boolean;
  production_status?: string;
};

type NarrationManifest = {
  items?: NarrationManifestItem[];
};

const RELEASED_STATUSES = new Set(["human_listening_approved", "approved", "production_approved", "released"]);

export type NarrationAssetIndex = ReadonlyMap<string, string>;

let narrationAssetsPromise: Promise<NarrationAssetIndex> | null = null;

function isReleased(item: NarrationManifestItem) {
  return item.technical_pass === true && RELEASED_STATUSES.has(String(item.production_status ?? ""));
}

export function useNarrationAssets(): NarrationAssetIndex {
  const [assets, setAssets] = useState<NarrationAssetIndex>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    narrationAssetsPromise ??= fetch("/content/narration-manifest.json", { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() as Promise<NarrationManifest> : null))
      .then((manifest) => {
        const next = new Map<string, string>();
        for (const item of manifest?.items ?? []) {
          if (item.id && item.file && isReleased(item)) next.set(item.id, item.file);
        }
        return next;
      })
      .catch(() => new Map<string, string>());
    narrationAssetsPromise
      .then((next) => {
        if (!cancelled) setAssets(next);
      })
      .catch(() => {
        // Audio is an enhancement; text, visual and AAC routes remain available.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assets;
}

export function resolveNarrationAsset(value: unknown, assets: NarrationAssetIndex) {
  if (typeof value !== "string" || !value.trim()) return "";
  const candidate = value.trim();
  if (candidate.startsWith("/")) return candidate;
  return assets.get(candidate) ?? "";
}

export function resolveNarrationFields(body: Record<string, unknown>, assets: NarrationAssetIndex) {
  for (const key of ["prompt_audio_url", "audio_url", "narration_url", "audio_asset_id", "audio_ref", "whole_audio_asset_id"]) {
    const resolved = resolveNarrationAsset(body[key], assets);
    if (resolved) return resolved;
  }
  return "";
}

export function resolveNarrationAssetMap(value: unknown, assets: NarrationAssetIndex) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, candidate]) => [key, resolveNarrationAsset(candidate, assets)] as const)
      .filter(([, resolved]) => Boolean(resolved)),
  );
}
