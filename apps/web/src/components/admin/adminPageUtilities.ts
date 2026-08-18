type ContentVersionShape = {
  content_type: string;
  content_key: string;
  payload?: Record<string, unknown>;
};

type IdentifiedRecord = Record<string, unknown> & { id: string };
type KeyedRecord = Record<string, unknown> & { key: string };

type ConfigurationShape = {
  worlds?: KeyedRecord[];
  activities?: IdentifiedRecord[];
  questions?: IdentifiedRecord[];
  reward_rules?: IdentifiedRecord[];
};

export function parseJSON<T>(value: string, fallback: string, label: string): T {
  try {
    return JSON.parse(value || fallback) as T;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

export function requireText(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
}

export function requireRange(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
}

export function requireObject(value: Record<string, unknown>, label: string) {
  if (!value || Object.keys(value).length === 0) throw new Error(`${label} is required.`);
}

export function requireStringArray(value: unknown[], label: string, requireItem = false) {
  if (!Array.isArray(value) || (requireItem && value.length === 0) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a JSON array of text values${requireItem ? " with at least one item" : ""}.`);
  }
}

export function requireNumberArray(value: unknown[], label: string, requireItem = false) {
  if (!Array.isArray(value) || (requireItem && value.length === 0) || value.some((item) => typeof item !== "number" || item < 1)) {
    throw new Error(`${label} must be a JSON array of positive numbers${requireItem ? " with at least one item" : ""}.`);
  }
}

export function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function safeDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}

export function currentPayloadForVersion(
  version: ContentVersionShape,
  config: ConfigurationShape | null,
  objectives: IdentifiedRecord[],
): Record<string, unknown> | null {
  let payload: unknown;
  switch (version.content_type) {
    case "curriculum_objective": payload = objectives.find((objective) => objective.id === version.content_key); break;
    case "world": payload = config?.worlds?.find((world) => world.key === version.content_key); break;
    case "activity": payload = config?.activities?.find((activity) => activity.id === version.content_key); break;
    case "question": payload = config?.questions?.find((question) => question.id === version.content_key); break;
    case "reward_rule": payload = config?.reward_rules?.find((rule) => rule.id === version.content_key); break;
    default: return null;
  }
  return payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
}

export function contentVersionDiffFields(version: ContentVersionShape, current: Record<string, unknown> | null) {
  if (!current || !version.payload) return [];
  return deepDiffPaths(version.payload, current);
}

function deepDiffPaths(left: unknown, right: unknown, path = ""): string[] {
  if (stableJSON(left) === stableJSON(right)) return [];
  if (Array.isArray(left) || Array.isArray(right)) return [path || "(root)"];
  if (left && right && typeof left === "object" && typeof right === "object") {
    const ignored = new Set(["created_at", "updated_at", "published_at"]);
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    return [...keys]
      .filter((key) => !ignored.has(key))
      .flatMap((key) => deepDiffPaths(leftRecord[key], rightRecord[key], path ? `${path}.${key}` : key))
      .sort();
  }
  return [path || "(root)"];
}

export function nextContentStatus(status: string) {
  return ({ draft: "review", review: "pilot", pilot: "approved", approved: "published", published: "live" } as Record<string, string>)[status] ?? "";
}

function stableJSON(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJSON(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function readinessBadgeClass(status: string) {
  return status === "ready" ? "bg-[#dff7e7] text-[#17633a]"
    : status === "pilot" ? "bg-[#e8e2ff] text-[#4e33a4]"
      : status === "draft" ? "bg-[#fff4d5] text-[#725100]"
        : status === "blocked" ? "bg-[#ffe8e8] text-[#8b2b2b]"
          : "bg-[#f6f3ea] text-[#1d1a3e]/62";
}

export function rendererBadgeClass(format: { runtime_failures: number; current_runtime: string }) {
  if (format.runtime_failures > 0) return "bg-[#ffe8e8] text-[#8b2b2b]";
  if (format.current_runtime.includes("ready")) return "bg-[#dff7e7] text-[#17633a]";
  if (format.current_runtime === "preview_only") return "bg-[#fff4d5] text-[#725100]";
  return "bg-[#e8e2ff] text-[#4e33a4]";
}

export function assetBadgeClass(status: string) {
  return status === "production" ? "bg-[#dff7e7] text-[#17633a]"
    : status === "pilot" ? "bg-[#e8e2ff] text-[#4e33a4]"
      : status === "prototype" ? "bg-[#dff4ff] text-[#155d64]"
        : status === "planned" ? "bg-[#fff4d5] text-[#725100]"
          : "bg-[#f6f3ea] text-[#1d1a3e]/62";
}

export function pilotLaneBadgeClass(status: string) {
  return status === "required" ? "bg-[#ffe8e8] text-[#8b2b2b]"
    : status === "conditional" ? "bg-[#fff4d5] text-[#725100]"
      : status === "sample" ? "bg-[#dff4ff] text-[#155d64]"
        : "bg-[#f6f3ea] text-[#1d1a3e]/62";
}

export function releaseBadgeClass(channel: string) {
  return channel === "release" ? "bg-[#dff7e7] text-[#17633a]"
    : channel === "pilot" ? "bg-[#e8e2ff] text-[#4e33a4]"
      : channel === "review" ? "bg-[#dff4ff] text-[#155d64]"
        : channel === "authoring" ? "bg-[#fff4d5] text-[#725100]"
          : "bg-[#f6f3ea] text-[#1d1a3e]/62";
}
