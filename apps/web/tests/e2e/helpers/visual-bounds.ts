import type { Locator } from "@playwright/test";

export async function alignVisualBounds(region: Locator) {
  await region.waitFor({ state: "visible" });
  await region.evaluate(async element => {
    await document.fonts.ready;
    // A fractional origin can add an extra raster row despite identical layout.
    // Expand by less than one CSS pixel and align the origin; never crop content
    // or impose a historical height that could hide a displaced submit button.
    element.style.minHeight = "";
    element.style.transform = "";
    const box = element.getBoundingClientRect();
    element.style.minHeight = `${Math.ceil(box.height)}px`;
    element.style.transform = `translateY(${Math.ceil(box.top) - box.top}px)`;
  });
}
