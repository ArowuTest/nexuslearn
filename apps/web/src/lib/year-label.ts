export const CURRICULUM_REGIONS = {
  england: {
    label: "England",
    range: "Years 1-7",
    groups: { 1: "Year 1", 2: "Year 2", 3: "Year 3", 4: "Year 4", 5: "Year 5", 6: "Year 6", 7: "Year 7" },
  },
  nigeria: {
    label: "Nigeria",
    range: "Primary 1-6 and JSS 1",
    groups: { 1: "Primary 1", 2: "Primary 2", 3: "Primary 3", 4: "Primary 4", 5: "Primary 5", 6: "Primary 6", 7: "JSS 1" },
  },
} as const;

export type CurriculumRegion = keyof typeof CURRICULUM_REGIONS;

export function curriculumRegion(): CurriculumRegion {
  const value = (process.env.NEXT_PUBLIC_CURRICULUM_REGION || process.env.CURRICULUM_REGION || "england").toLowerCase();
  return value === "nigeria" ? "nigeria" : "england";
}

export function yearLabel(year: number, region: CurriculumRegion = curriculumRegion()): string {
  if (!Number.isFinite(year) || year <= 0) return "Year not set";
  const groups: Record<number, string> = CURRICULUM_REGIONS[region].groups;
  return groups[year] || `Year ${year}`;
}

export function yearRangeLabel(region: CurriculumRegion = curriculumRegion()): string {
  return CURRICULUM_REGIONS[region].range;
}
