"use client";

import { useActionState } from "react";

import { signInAction, type SignInState } from "./actions";
import styles from "./sign-in.module.css";

const initialState: SignInState = {};

export function SignInForm({
  nextPath,
  configured,
}: {
  nextPath: string;
  configured: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  const emailError = state.errors?.email?.[0];
  const passwordError = state.errors?.password?.[0];
  const statusMessage = configured
    ? state.message
    : "Supabase is not configured. The root route remains available in demo mode.";

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="next" value={nextPath} />
      <label className={styles.field}>
        <span>Email</span>
        <input
          aria-describedby={emailError ? "sign-in-email-error" : undefined}
          aria-invalid={emailError ? true : undefined}
          autoComplete="email"
          name="email"
          type="email"
          required
          disabled={!configured || pending}
        />
        {emailError ? (
          <small id="sign-in-email-error">{emailError}</small>
        ) : null}
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input
          aria-describedby={passwordError ? "sign-in-password-error" : undefined}
          aria-invalid={passwordError ? true : undefined}
          autoComplete="current-password"
          name="password"
          type="password"
          required
          disabled={!configured || pending}
        />
        {passwordError ? (
          <small id="sign-in-password-error">{passwordError}</small>
        ) : null}
      </label>
      <p className={styles.status} aria-live="polite">
        {statusMessage}
      </p>
      <button type="submit" disabled={!configured || pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
