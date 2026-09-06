import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptTeamInviteAction } from "@/features/console/data/team-actions";
import { getAuthenticatedActor } from "@/lib/supabase/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <main className="join-page">
        <section>
          <h1>Invite unavailable</h1>
          <p>Sign-in is not configured in this environment.</p>
        </section>
      </main>
    );
  }

  const actor = await getAuthenticatedActor();
  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  const result = await acceptTeamInviteAction(token);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7f8f3",
        fontFamily: "IBM Plex Sans, Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(440px, 100%)",
          padding: 28,
          borderRadius: 18,
          background: "#fff",
          boxShadow: "0 1px 6px rgba(34, 52, 39, 0.07)",
        }}
      >
        {result.ok ? (
          <>
            <p style={{ margin: 0, color: "#5c744c", fontWeight: 700 }}>
              You are in
            </p>
            <h1 style={{ margin: "8px 0 12px", fontSize: 28 }}>
              Joined {result.businessName}
            </h1>
            <p style={{ color: "#5c6a6e" }}>
              You can now be assigned to jobs in this workspace.
            </p>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                marginTop: 12,
                padding: "10px 16px",
                borderRadius: 10,
                background: "#4d624d",
                color: "#fff",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Open console
            </Link>
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: "#9e362d", fontWeight: 700 }}>
              Invite could not be accepted
            </p>
            <h1 style={{ margin: "8px 0 12px", fontSize: 28 }}>
              Check this link
            </h1>
            <p style={{ color: "#5c6a6e" }}>{result.message}</p>
            <Link href="/" style={{ color: "#4d624d", fontWeight: 600 }}>
              Back to console
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
