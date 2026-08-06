const FALLBACK_PATH = "/";
const AUTH_ONLY_PATHS = ["/sign-in", "/auth/callback"] as const;
const PUBLIC_PATH_PREFIXES = ["/questionnaire/"] as const;

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((path) => pathname.startsWith(path));
}

/** Prevents callback and form parameters from becoming open redirects. */
export function getSafeReturnPath(
  candidate: string | null | undefined,
  fallback = FALLBACK_PATH,
): string {
  if (
    !candidate ||
    candidate.length > 2_048 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const base = new URL("https://fieldcentral.invalid");
    const parsed = new URL(candidate, base);

    if (parsed.origin !== base.origin || isAuthOnlyPath(parsed.pathname)) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
