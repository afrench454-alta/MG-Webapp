import type { Metadata } from "next";

import { productBrand, signInIntro } from "@/lib/brand";
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
        <p className={styles.brand}>{productBrand}</p>
        <h1 id="sign-in-title">Console</h1>
        <p className={styles.intro}>{signInIntro}</p>
        <SignInForm
          nextPath={getSafeReturnPath(params.next)}
          configured={isSupabaseConfigured()}
        />
      </section>
    </main>
  );
}
