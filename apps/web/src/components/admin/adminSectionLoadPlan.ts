import type { AdminSectionId } from "./adminSectionModel";

export type AdminAccountRole = "platform_admin" | "content_editor" | "content_reviewer";

export type AdminSectionLoadPlan = {
  configSection?: string;
  objectives?: boolean;
  parentInvitations?: boolean;
  reportWorkspace?: "readiness" | "releases";
};

const PLATFORM_CONFIG_SECTIONS: Partial<Record<AdminSectionId, string>> = {
  Overview: "overview",
  Access: "access",
  Schools: "schools",
  Groups: "groups",
  Parents: "parents",
  Learners: "learners",
  Progress: "progress",
  Worlds: "worlds",
  Activities: "activities",
  Questions: "questions",
  Rewards: "rewards",
  Flags: "flags",
};

export function adminSectionLoadPlan(role: AdminAccountRole, section: AdminSectionId): AdminSectionLoadPlan {
  if (role === "content_editor") {
    if (section === "Activities" || section === "Questions") {
      return { configSection: section.toLowerCase() };
    }
    return section === "Objectives" ? { objectives: true } : {};
  }

  if (role === "content_reviewer") {
    if (section === "Readiness") return { reportWorkspace: "readiness" };
    if (section === "Releases") return { reportWorkspace: "releases" };
    return {};
  }

  return {
    configSection: PLATFORM_CONFIG_SECTIONS[section],
    objectives: section === "Objectives",
    parentInvitations: section === "Parents",
    reportWorkspace: section === "Readiness" ? "readiness" : section === "Releases" ? "releases" : undefined,
  };
}
