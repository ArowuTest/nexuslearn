import { yearGroupLabel as formatYearGroup } from "./year-labels.mjs";

export type CurriculumRegion = "england" | "nigeria";

export function curriculumRegion(value = process.env.NEXT_PUBLIC_CURRICULUM_REGION || process.env.CURRICULUM_REGION || ""): CurriculumRegion {
  return value.trim().toLowerCase() === "nigeria" ? "nigeria" : "england";
}

const activeRegion = curriculumRegion();

export function yearGroupLabel(year: number, region: CurriculumRegion = activeRegion): string {
  return formatYearGroup(year, region);
}
