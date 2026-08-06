import type { Metadata } from "next";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSafeReturnPath } from "@/lib/supabase/routing";

import { SignInForm } from "./sign-in-form";
import styles from "./sign-in.module.css";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="sign-in-title">
        <p className={styles.brand}>FieldCentral</p>
        <h1 id="sign-in-title">Pro Console</h1>
        <p className={styles.intro}>
          Sign in to manage clients, field work, quotes, and invoices.
        </p>
        <SignInForm
          nextPath={getSafeReturnPath(params.next)}
          configured={isSupabaseConfigured()}
        />
      </section>
    </main>
  );
}
