/**
 * Build a trusted origin for email confirmation redirects.
 * Prefer the canonical NEXT_PUBLIC_APP_URL when set.
 * Fall back to request headers only for local development hosts.
 */
type AppOriginEnv = {
  NEXT_PUBLIC_APP_URL?: string;
};

export function trustedOrigin(
  headerList: Headers,
  env: AppOriginEnv = { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL },
): string {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // invalid configured URL; fall through
    }
  }

  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  if (!host || host.includes("\n") || host.includes("/") || host.includes(" ")) return "";
  const isLocal =
    host.startsWith("localhost:") ||
    host === "localhost" ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".localhost");
  if (!isLocal) return "";

  const proto = headerList.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${proto}://${host}`;
}
