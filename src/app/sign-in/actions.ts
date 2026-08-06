"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSafeReturnPath } from "@/lib/supabase/routing";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email("Enter a valid email address.").trim().max(320),
  password: z.string().min(1, "Enter your password.").max(1_024),
  next: z.string().max(2_048).optional(),
});

export type SignInState = Readonly<{
  message?: string;
  errors?: Readonly<{
    email?: readonly string[];
    password?: readonly string[];
  }>;
}>;

export async function signInAction(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return { message: "Supabase is not configured for this environment." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return {
      message: "Check the highlighted fields and try again.",
      errors: {
        email: errors.email,
        password: errors.password,
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { message: "The email or password is incorrect." };
  }

  redirect(getSafeReturnPath(parsed.data.next));
}
