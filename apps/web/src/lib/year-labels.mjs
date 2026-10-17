// Year numbers stay 1-7. A region only changes the words on screen.
// Keep these labels equal to packages/content/curriculum/regions.json.

export function yearGroupLabel(year, region = "england") {
  const value = Number(year);
  if (!value) return "Year not set";
  if (String(region).trim().toLowerCase() !== "nigeria") return `Year ${value}`;
  if (value >= 1 && value <= 6) return `Primary ${value}`;
  if (value === 7) return "JSS 1";
  return `Year ${value}`;
}
