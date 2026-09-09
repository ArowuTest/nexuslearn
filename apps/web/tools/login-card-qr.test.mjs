import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import publicQR from "qrcode";
import symbols from "qrcode/lib/core/qrcode.js";

test("the card symbol-only entry stays pinned and uses the public generator", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.qrcode, "1.5.4");
  assert.equal(symbols.create, publicQR.create);
  const component = readFileSync(new URL("../src/components/role-workspaces/SchoolWorkspacePrimitives.tsx", import.meta.url), "utf8");
  assert.match(component, /from "qrcode\/lib\/core\/qrcode"/);
});

for (const query of ["pupil=oak-01&code=LOCAL-123", "pupil=qa-school-year-7-learner-with-a-long-reference&qr=local-disposable-qr-secret", "pupil=year-1&code=HOME-ABCDEFGHIJKLMNOPQRSTUVWXYZ&qr=local-only"]) {
  test(`symbol-only card preserves the public QR matrix for ${query.split("&")[0]}`, () => {
    const url = `https://nexuslearn.example.test/login?${query}`;
    const actual = symbols.create(url, { errorCorrectionLevel: "M" });
    const expected = publicQR.create(url, { errorCorrectionLevel: "M" });
    assert.equal(actual.modules.size, expected.modules.size);
    assert.deepEqual(actual.modules.data, expected.modules.data);
  });
}
