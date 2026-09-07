"use client";

import { useActionState } from "react";
import Link from "next/link";

import { joinWithPasswordAction, type JoinAccountState } from "./actions";
import styles from "../../sign-in/sign-in.module.css";

const initialState: JoinAccountState = {};

export function JoinAccountForm({
  token,
  email,
  businessName,
  role,
}: {
  token: string;
  email: string;
  businessName: string;
  role: string;
}) {
  const [state, formAction, pending] = useActionState(
    joinWithPasswordAction,
    initialState,
  );

  const passwordError = state.errors?.password?.[0];
  const confirmError = state.errors?.confirm?.[0];
  const signInHref = `/sign-in?next=${encodeURIComponent(`/join/${token}`)}`;

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="token" value={token} />
      <p className={styles.intro} style={{ margin: "0 0 4px" }}>
        Invited as {role} to {businessName}. Create a password for {email} to
        join.
      </p>
      <label className={styles.field}>
        <span>Email</span>
        <input
          type="email"
          value={email}
          readOnly
          autoComplete="username"
          aria-readonly="true"
        />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          aria-describedby={passwordError ? "join-password-error" : undefined}
          aria-invalid={passwordError ? true : undefined}
          autoComplete="new-password"
          name="password"
          type="password"
          required
          minLength={8}
          disabled={pending}
        />
        {passwordError ? (
          <small id="join-password-error">{passwordError}</small>
        ) : null}
      </label>
      <label className={styles.field}>
        <span>Confirm password</span>
        <input
          aria-describedby={confirmError ? "join-confirm-error" : undefined}
          aria-invalid={confirmError ? true : undefined}
          autoComplete="new-password"
          name="confirm"
          type="password"
          required
          minLength={8}
          disabled={pending}
        />
        {confirmError ? (
          <small id="join-confirm-error">{confirmError}</small>
        ) : null}
      </label>
      <p className={styles.status} aria-live="polite">
        {state.message}
      </p>
      <button type="submit" disabled={pending}>
        {pending ? "Joining…" : "Create account and join"}
      </button>
      <p className={styles.intro} style={{ margin: "4px 0 0", fontSize: 14 }}>
        Already have a password?{" "}
        <Link href={signInHref} style={{ color: "var(--brand-strong)", fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
