export const ADMIN_SECTION_IDS = [
  "Overview",
  "Access",
  "Schools",
  "Learners",
  "Progress",
  "Groups",
  "Parents",
  "Objectives",
  "Activities",
  "Questions",
  "Reviews",
  "Readiness",
  "Releases",
  "Worlds",
  "Rewards",
  "Flags",
  "Audit",
] as const;

export type AdminSectionId = (typeof ADMIN_SECTION_IDS)[number];

export type AdminNavigationGroup = {
  label: string;
  items: readonly AdminSectionId[];
};

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  { label: "Overview", items: ["Overview"] },
  { label: "Organisations", items: ["Access", "Schools", "Groups", "Parents"] },
  { label: "Learners & Progress", items: ["Learners", "Progress"] },
  { label: "Curriculum & Review", items: ["Objectives", "Activities", "Questions", "Reviews"] },
  { label: "Audio & Assets", items: ["Readiness"] },
  { label: "Releases", items: ["Releases"] },
  { label: "Engagement", items: ["Worlds", "Rewards"] },
  { label: "System & Audit", items: ["Flags", "Audit"] },
] as const;

const SECTION_QUERY_LOOKUP = new Map(
  ADMIN_SECTION_IDS.map((section) => [section.toLowerCase(), section]),
);

export function adminSectionFromQuery(value: string | null, fallback: AdminSectionId): AdminSectionId {
  if (!value) return fallback;
  return SECTION_QUERY_LOOKUP.get(value.trim().toLowerCase()) ?? fallback;
}

export function visibleAdminSections(role: string | null): AdminSectionId[] {
  if (role === "content_reviewer") return ["Reviews", "Readiness", "Releases"];
  if (role === "content_editor") {
    return ["Overview", "Objectives", "Activities", "Questions"];
  }
  return [...ADMIN_SECTION_IDS];
}
