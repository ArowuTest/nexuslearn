"use client";

import { deferClientWorkspace } from "@/components/deferClientWorkspace";

const AdminConsole = deferClientWorkspace(
  () => import("@/components/admin/AdminConsole"),
  <p role="status">Loading the admin workspace…</p>,
);

export default function AdminPage() {
  return <AdminConsole />;
}
