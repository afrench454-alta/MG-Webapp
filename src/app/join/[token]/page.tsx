import Link from "next/link";
import type { ReactNode } from "react";

import { acceptTeamInviteAction } from "@/features/console/data/team-actions";
import { previewTeamInvitation } from "@/features/console/data/team-repository";
import { productBrand } from "@/lib/brand";
import { getAuthenticatedActor } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { JoinAccountForm } from "./join-form";
import styles from "../../sign-in/sign-in.module.css";

export const dynamic = "force-dynamic";

function JoinShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="join-title">
        <p className={styles.brand}>{productBrand}</p>
        <h1 id="join-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <JoinShell title="Invite unavailable">
        <p className={styles.intro}>
          Sign-in is not configured in this environment.
        </p>
      </JoinShell>
    );
  }

  let preview = null;
  try {
    preview = await previewTeamInvitation(token);
  } catch {
    preview = null;
  }

  if (!preview) {
    return (
      <JoinShell title="Check this link">
        <p className={styles.intro}>
          This invite link is invalid. Ask an owner to send a new one.
        </p>
        <Link href="/sign-in" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
          Sign in
        </Link>
      </JoinShell>
    );
  }

  if (preview.status === "expired") {
    return (
      <JoinShell title="Invite expired">
        <p className={styles.intro}>
          This invite for {preview.email} has expired. Ask{" "}
          {preview.businessName} to send a new link.
        </p>
      </JoinShell>
    );
  }

  if (preview.status === "revoked") {
    return (
      <JoinShell title="Invite revoked">
        <p className={styles.intro}>
          This invite is no longer valid. Ask {preview.businessName} for a new
          one.
        </p>
      </JoinShell>
    );
  }

  const actor = await getAuthenticatedActor();
  if (actor) {
    if (preview.status === "accepted") {
      return (
        <JoinShell title={`Joined ${preview.businessName}`}>
          <p className={styles.intro}>
            You can open the console and work from this workspace.
          </p>
          <Link href="/" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
            Open console
          </Link>
        </JoinShell>
      );
    }

    const result = await acceptTeamInviteAction(token);
    return (
      <JoinShell
        title={result.ok ? `Joined ${result.businessName}` : "Check this link"}
      >
        {result.ok ? (
          <>
            <p className={styles.intro}>
              You can now be assigned to jobs in this workspace.
            </p>
            <Link href="/" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
              Open console
            </Link>
          </>
        ) : (
          <>
            <p className={styles.intro}>{result.message}</p>
            <p className={styles.intro}>
              Signed in as {actor.email || "another account"}. This invite is
              for {preview.email}.
            </p>
            <Link href="/sign-in" style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
              Sign in with the invited email
            </Link>
          </>
        )}
      </JoinShell>
    );
  }

  if (preview.status === "accepted") {
    return (
      <JoinShell title="Invite already used">
        <p className={styles.intro}>
          Sign in with {preview.email} to open {preview.businessName}.
        </p>
        <Link
          href={`/sign-in?next=${encodeURIComponent("/")}`}
          style={{ color: "var(--brand-strong)", fontWeight: 600 }}
        >
          Sign in
        </Link>
      </JoinShell>
    );
  }

  return (
    <JoinShell title="Join the team">
      <JoinAccountForm
        token={token}
        email={preview.email}
        businessName={preview.businessName}
        role={preview.role}
      />
    </JoinShell>
  );
}
