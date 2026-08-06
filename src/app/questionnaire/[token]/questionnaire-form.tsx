"use client";

import { useState } from "react";

import { submitQuestionnaireAction } from "@/features/console/data/questionnaire-actions";
import type { publicQuestionnaireSchema } from "@/features/console/data/questionnaire-repository";
import type { z } from "zod";

import styles from "./questionnaire.module.css";

type Payload = z.infer<typeof publicQuestionnaireSchema>;

export function QuestionnaireForm({ token, payload }: { token: string; payload: Payload }) {
  const questionnaire = payload.questionnaire!;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [identity, setIdentity] = useState({ name: "", email: "", phone: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggle = (fieldId: string, option: string) => setAnswers((current) => { const selected = Array.isArray(current[fieldId]) ? current[fieldId] as string[] : []; return { ...current, [fieldId]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] }; });

  if (submitted) return <div className={styles.success}><h1>Responses received</h1><p>{questionnaire.completion_message || "Thanks — the team can now prepare the next step."}</p></div>;

  return (
    <form className={styles.form} onSubmit={async (event) => { event.preventDefault(); setError(""); const missing = questionnaire.form_schema.fields.some((field) => field.required && (!answers[field.id] || answers[field.id].length === 0)); if (missing) { setError("Complete each required question."); return; } setPending(true); const result = await submitQuestionnaireAction({ token, ...identity, answers }); setPending(false); if (!result.ok) { setError(result.message); return; } setSubmitted(true); }}>
      <div className={styles.identity}>
        <label><span>Your name</span><input value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} required /></label>
        <label><span>Email</span><input type="email" value={identity.email} onChange={(event) => setIdentity((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>Phone</span><input value={identity.phone} onChange={(event) => setIdentity((current) => ({ ...current, phone: event.target.value }))} /></label>
      </div>
      {questionnaire.form_schema.fields.map((field, index) => (
        <fieldset className={styles.field} key={field.id}>
          <legend>{index + 1}. {field.label}{field.required ? <span> *</span> : null}</legend>
          {field.type === "text" ? <input value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} /> : null}
          {field.type === "textarea" ? <textarea rows={4} value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} /> : null}
          {field.type === "radio" ? <div className={styles.options}>{(field.options || []).map((option) => <label key={option}><input type="radio" name={field.id} checked={answers[field.id] === option} onChange={() => setAnswers((current) => ({ ...current, [field.id]: option }))} /> {option}</label>)}</div> : null}
          {field.type === "checkbox" ? <div className={styles.options}>{(field.options || []).map((option) => <label key={option}><input type="checkbox" checked={Array.isArray(answers[field.id]) && answers[field.id].includes(option)} onChange={() => toggle(field.id, option)} /> {option}</label>)}</div> : null}
        </fieldset>
      ))}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit responses"}</button>
    </form>
  );
}

