"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { joinWithPasswordSchema } from "@/features/console/data/team-contract";
import { previewTeamInvitation } from "@/features/console/data/team-repository";

export type JoinAccountState = Readonly<{
  message?: string;
  errors?: Readonly<{
    password?: readonly string[];
    confirm?: readonly string[];
  }>;
}>;

function requestOrigin(headerList: Headers): string {
  const host = headerList.get("x-forwarded-host") || headerList.get("host");
  if (!host || host.includes("\n") || host.includes("/")) return "";
  const proto = headerList.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

function alreadyRegistered(error: { message?: string; code?: string } | null, identities?: Array<unknown> | null) {
  if (identities && identities.length === 0) return true;
  const message = error?.message || "";
  return /already registered|already been registered|user already exists/i.test(
    message,
  );
}

export async function joinWithPasswordAction(
  _previousState: JoinAccountState,
  formData: FormData,
): Promise<JoinAccountState> {
  if (!isSupabaseConfigured()) {
    return { message: "Sign-in is not configured in this environment." };
  }

  const parsed = joinWithPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      message: "Check the highlighted fields and try again.",
      errors: {
        password: errors.password,
        confirm: errors.confirm,
      },
    };
  }

  let preview;
  try {
    preview = await previewTeamInvitation(parsed.data.token);
  } catch {
    return { message: "This invite could not be checked. Try again." };
  }

  if (!preview) {
    return { message: "This invite link is invalid." };
  }
  if (preview.status === "expired") {
    return { message: "This invite link has expired. Ask for a new one." };
  }
  if (preview.status === "revoked") {
    return { message: "This invite link has been revoked." };
  }
  if (preview.status === "accepted") {
    return {
      message: "This invite was already used. Sign in with your password.",
    };
  }

  const supabase = await createClient();
  const origin = requestOrigin(await headers());
  const nextPath = `/join/${parsed.data.token}`;
  const emailRedirectTo = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    : undefined;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: preview.email,
    password: parsed.data.password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  let session = signUpData.session;
  const identities =
    (signUpData.user as { identities?: unknown[] } | null)?.identities ?? null;

  if (signUpError || alreadyRegistered(signUpError, identities)) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: preview.email,
        password: parsed.data.password,
      });
    if (signInError || !signInData.session) {
      if (signUpError && !alreadyRegistered(signUpError, identities)) {
        return { message: "The account could not be created. Try a different password." };
      }
      return {
        message:
          "This email already has an account. Use that password, or ask the owner to send a new invite after a password reset.",
      };
    }
    session = signInData.session;
  }

  if (!session) {
    return {
      message:
        "Account created. Check your email to confirm, then open this invite link again.",
    };
  }

  const { error: acceptError } = await supabase.rpc("accept_team_invitation", {
    raw_token: parsed.data.token,
  });
  if (acceptError) {
    const cleaned = acceptError.message
      .replace(/^.*error:\s*/i, "")
      .split("\n")[0]
      ?.trim();
    return {
      message:
        cleaned && cleaned.length < 240
          ? cleaned
          : "Signed in, but this invite could not be accepted.",
    };
  }

  revalidatePath("/");
  redirect("/");
}
