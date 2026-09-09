import { expect, test } from "@playwright/test";

test("shared studio styles preserve the existing game appearance and SEND modes", async ({ page }) => {
  await page.goto("/login");
  const checks = await page.evaluate(() => {
    const styles = [
      ["p", "font-display text-center text-xs uppercase tracking-[0.14em] text-[var(--world-accent)]", "studio-step-label"],
      ["section", "mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-white/10 p-5", "studio-workspace-panel"],
      ["button", "btn-pop mt-4 min-h-14 w-full bg-sun px-4 py-3 text-lg text-ink disabled:opacity-50", "btn-pop studio-check-answer"],
    ];
    const properties = ["fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "backgroundColor", "borderColor", "borderWidth", "borderStyle", "borderRadius", "padding", "margin", "textAlign", "textTransform", "letterSpacing", "minHeight", "width", "maxWidth", "boxShadow", "transform", "transitionDuration", "opacity", "userSelect"];
    const result = [];
    for (const mode of ["", "high-contrast", "large-targets", "reduced-motion", "reading-reduced", "high-contrast large-targets reduced-motion"]) {
      const host = document.createElement("div");
      host.className = mode;
      host.style.cssText = "position:absolute;left:-10000px;width:280px;--world-accent:#8be28f";
      document.body.append(host);
      for (const [tag, original, shared] of styles) for (const disabled of tag === "button" ? [false, true] : [false]) {
        const values = [original, shared].map(classes => {
          const probe = document.createElement(tag);
          probe.className = classes;
          probe.textContent = "Check my learning";
          if (disabled) probe.setAttribute("disabled", "");
          host.append(probe);
          const computed = getComputedStyle(probe);
          const measured = Object.fromEntries(properties.map(property => [property, computed[property as keyof CSSStyleDeclaration]]));
          probe.remove();
          return measured;
        });
        result.push({ mode, shared, disabled, expected: values[0], actual: values[1] });
      }
      host.remove();
    }
    return result;
  });
  for (const check of checks) expect(check.actual, `${check.shared} / ${check.mode || "standard"} / disabled=${check.disabled}`).toEqual(check.expected);
});
