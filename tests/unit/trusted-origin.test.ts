import test from "node:test";
import assert from "node:assert/strict";
import { trustedOrigin } from "../../src/lib/trusted-origin";

function headers(map: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(map)) h.set(k, v);
  return h;
}

test("trustedOrigin prefers NEXT_PUBLIC_APP_URL", () => {
  const env = { NEXT_PUBLIC_APP_URL: "https://app.example.com" };
  const result = trustedOrigin(headers({ host: "evil.com" }), env);
  assert.equal(result, "https://app.example.com");
});

test("trustedOrigin rejects non-local hosts when no canonical URL", () => {
  const env = {};
  const result = trustedOrigin(headers({ host: "evil.com", "x-forwarded-proto": "https" }), env);
  assert.equal(result, "");
});

test("trustedOrigin allows localhost fallback", () => {
  const env = {};
  const result = trustedOrigin(
    headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
    env,
  );
  assert.equal(result, "http://localhost:3000");
});

test("trustedOrigin rejects malformed hosts", () => {
  const env = {};
  assert.equal(trustedOrigin(headers({ host: "localhost/evil" }), env), "");
  assert.equal(trustedOrigin(headers({ host: "localhost\n" }), env), "");
});
