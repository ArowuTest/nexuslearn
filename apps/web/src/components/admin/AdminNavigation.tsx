"use client";

import { useRef, type KeyboardEvent } from "react";
import { ADMIN_NAVIGATION_GROUPS, type AdminSectionId } from "./adminSectionModel";

type AdminNavigationProps = {
  activeSection: AdminSectionId;
  visibleSections: readonly AdminSectionId[];
  onSelect: (section: AdminSectionId) => void;
};

export default function AdminNavigation({ activeSection, visibleSections, onSelect }: AdminNavigationProps) {
  const buttonRefs = useRef(new Map<AdminSectionId, HTMLButtonElement>());
  const orderedSections = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items)
    .filter((section) => visibleSections.includes(section));

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, section: AdminSectionId) {
    const currentIndex = orderedSections.indexOf(section);
    let nextIndex = currentIndex;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (currentIndex + 1) % orderedSections.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + orderedSections.length) % orderedSections.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = orderedSections.length - 1;
    else return;

    event.preventDefault();
    buttonRefs.current.get(orderedSections[nextIndex])?.focus();
  }

  return (
    <nav className="space-y-5" aria-label="Admin sections">
      {ADMIN_NAVIGATION_GROUPS.map((group) => {
        const groupSections = group.items.filter((section) => visibleSections.includes(section));
        if (groupSections.length === 0) return null;
        const groupID = `admin-nav-${group.label.replaceAll("&", "and").replaceAll(" ", "-").toLowerCase()}`;
        return (
          <section key={group.label} aria-labelledby={groupID}>
            <h2 id={groupID} className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#565267]">
              {group.label}
            </h2>
            <div className="grid gap-1">
              {groupSections.map((section) => {
                const active = activeSection === section;
                return (
                  <button
                    key={section}
                    ref={(node) => {
                      if (node) buttonRefs.current.set(section, node);
                      else buttonRefs.current.delete(section);
                    }}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    tabIndex={active ? 0 : -1}
                    onClick={() => onSelect(section)}
                    onKeyDown={(event) => moveFocus(event, section)}
                    className={`min-h-11 rounded-xl px-3 py-2 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7357c9] ${active ? "bg-[#7357c9] text-white" : "text-[#1d1a3e] hover:bg-[#f1edff]"}`}
                  >
                    {section}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
