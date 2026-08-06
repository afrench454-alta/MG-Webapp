import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSafeReturnPath } from "@/lib/supabase/routing";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextPath = getSafeReturnPath(url.searchParams.get("next"));

  if (isSupabaseConfigured() && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }
  }

  const signInUrl = new URL("/sign-in", url.origin);
  signInUrl.searchParams.set("error", "callback");
  return NextResponse.redirect(signInUrl);
}
