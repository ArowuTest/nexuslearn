import assert from "node:assert/strict";
import { test } from "node:test";
import { loginCardURL } from "../../src/components/role-workspaces/loginCardURL.mjs";

const credential = { student_external_ref: "ava y3", login_code: "654321", qr_secret_hash: "card-secret" };

test("login cards prefer a valid configured application origin", () => {
  assert.equal(
    loginCardURL(credential, "http://127.0.0.1:3145", "https://learn.nexus.example/path?ignored=yes"),
    "https://learn.nexus.example/login?pupil=ava+y3&code=654321&card=card-secret",
  );
});

test("login cards reject unsafe configured origins and use the current application origin", () => {
  const fallback = "http://127.0.0.1:3145/login?pupil=ava+y3&code=654321&card=card-secret";
  assert.equal(loginCardURL(credential, "http://127.0.0.1:3145", "javascript:alert(1)"), fallback);
  assert.equal(loginCardURL(credential, "http://127.0.0.1:3145", "https://user:secret@learn.nexus.example"), fallback);
});

test("login cards fail closed until an absolute application origin is available", () => {
  assert.equal(loginCardURL(credential, "", undefined), "");
  assert.equal(loginCardURL(credential, "/relative", undefined), "");
});
