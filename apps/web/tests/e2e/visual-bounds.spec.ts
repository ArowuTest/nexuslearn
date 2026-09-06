import { expect, test } from "@playwright/test";
import { alignVisualBounds } from "./helpers/visual-bounds";

test("full-region screenshots keep stable bounds at fractional vertical origins", async ({ page }) => {
  for (const top of [8, 8.25, 8.5, 8.75]) {
    await page.setContent(`<section style="position:absolute;top:${top}px;left:8px;width:200px;height:80.5px;box-sizing:border-box;background:white"><button style="position:absolute;bottom:0">Send answer</button></section>`);
    const region = page.locator("section");
    await alignVisualBounds(region);
    const png = await region.screenshot({ scale: "css" });
    // PNG IHDR dimensions: inspect bytes without cropping/resizing any pixels.
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual({ width: 200, height: 81 });
    await expect(region.getByRole("button", { name: "Send answer" })).toBeVisible();
    const box = await region.boundingBox();
    const button = await region.getByRole("button").boundingBox();
    expect(button!.y + button!.height).toBeLessThanOrEqual(box!.y + box!.height);
  }
});
