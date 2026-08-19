"use client";

import { useEffect, useRef } from "react";
import type { AdminSectionId } from "./adminSectionModel";
import type { AdminAccountRole } from "./adminSectionLoadPlan";

type UseAdminSectionLoaderOptions = {
  enabled: boolean;
  role: AdminAccountRole | null;
  section: AdminSectionId;
  load: (section: AdminSectionId, role: AdminAccountRole) => Promise<void>;
};

export function useAdminSectionLoader({ enabled, role, section, load }: UseAdminSectionLoaderOptions) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled || !role) return;
    void loadRef.current(section, role);
  }, [enabled, role, section]);
}
