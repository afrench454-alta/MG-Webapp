import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv, isSupabaseConfigured } from "./env";
import { getSafeReturnPath, isAuthOnlyPath, isPublicPath } from "./routing";

function redirectWithCookies(url: URL, source: NextResponse): NextResponse {
  const response = NextResponse.redirect(url);

  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((headerName) => {
    const value = source.headers.get(headerName);
    if (value) response.headers.set(headerName, value);
  });

  return response;
}

/** Refreshes Supabase cookies and applies an optimistic route boundary. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headersToSet).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  // getClaims verifies the JWT signature. getSession must not be used as an
  // authorization check in server code because its cookie data is untrusted.
  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && data?.claims?.sub ? data.claims.sub : null;
  const { pathname, search } = request.nextUrl;
  const isAuthRoute = isAuthOnlyPath(pathname);

  if (!userId && !isAuthRoute && !isPublicPath(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("next", `${pathname}${search}`);

    return redirectWithCookies(signInUrl, response);
  }

  if (userId && pathname === "/sign-in") {
    const destination = getSafeReturnPath(
      request.nextUrl.searchParams.get("next"),
    );

    return redirectWithCookies(new URL(destination, request.url), response);
  }

  return response;
}
