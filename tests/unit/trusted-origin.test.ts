import test from "node:test";
import assert from "node:assert/strict";
import { reportOnlyContentPolicy } from "../../src/lib/content-security-policy";
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
  assert.equal(trustedOrigin(headers({ host: "localhost evil" }), env), "");
  const injected = {
    get(name: string) {
      if (name === "host") return "localhost\nevil";
      return null;
    },
  } as Headers;
  assert.equal(trustedOrigin(injected, env), "");
});

test("the CSP candidate scopes signed photo sources to the configured Supabase origin", () => {
  const policy = reportOnlyContentPolicy("https://fixtures.supabase.example/storage/path", false);
  assert.match(policy, /img-src 'self' data: blob: https:\/\/fixtures\.supabase\.example\/storage\/v1\/object\/sign\//);
  assert.match(policy, /connect-src 'self' https:\/\/fixtures\.supabase\.example(?:;|$)/);
  assert.match(policy, /form-action 'self'(?:;|$)/);
  assert.match(policy, /frame-ancestors 'none'(?:;|$)/);
  assert.doesNotMatch(policy, /unsafe-eval|https:\/\/\*|script-src[^;]+unsafe-inline/);
});

test("CSP omits malformed or missing service origins", () => {
  assert.equal(reportOnlyContentPolicy("javascript:alert(1)", false), reportOnlyContentPolicy(undefined, false));
});
