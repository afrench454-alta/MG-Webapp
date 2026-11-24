"use client";

import { useState } from "react";

import { submitQuestionnaireAction } from "@/features/console/data/questionnaire-actions";
import type { publicQuestionnaireSchema, formFieldSchema } from "@/features/console/data/questionnaire-contract";
import type { z } from "zod";

import styles from "./questionnaire.module.css";

type Questionnaire = NonNullable<z.infer<typeof publicQuestionnaireSchema>["questionnaire"]>;
type FormProps = { questionnaire: Pick<Questionnaire, "form_schema" | "completion_message">; token?: string };

function EstimateNotice() {
  return (
    <aside className={styles.estimateNotice} aria-label="Estimate and fixed quotes">
      <p>This job request is for an estimate only.</p>
      <p>For a detailed, fixed quote, contact us to book a property viewing and consultation.</p>
    </aside>
  );
}

export function QuestionnaireForm({ token, questionnaire }: FormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [identity, setIdentity] = useState({ name: "", email: "", phone: "", address: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggle = (fieldId: string, option: string) => setAnswers((current) => { const selected = Array.isArray(current[fieldId]) ? current[fieldId] as string[] : []; return { ...current, [fieldId]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] }; });

  const visibleFields = questionnaire.form_schema.fields.filter((field) => {
    if (!field.showWhen) return true;
    const selected = answers[field.showWhen.fieldId];
    return Array.isArray(selected) && selected.includes(field.showWhen.option);
  });
  const hasAnswer = (field: z.infer<typeof formFieldSchema>) => {
    const value = answers[field.id];
    return typeof value === "string" ? Boolean(value.trim()) : Boolean(value?.length);
  };
  const totalRequired = visibleFields.filter((field) => field.required).length;
  const answeredRequired = visibleFields.filter((field) => field.required && hasAnswer(field)).length;
  const progressPercent = totalRequired === 0 ? 100 : Math.round((answeredRequired / totalRequired) * 100);

  if (submitted) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>✓</div>
        <h1>Responses received</h1>
        <p>{questionnaire.completion_message || "Thanks — the team can now prepare the next step."}</p>
        <EstimateNotice />
        {token ? <div className={styles.successDetails}>
          <strong>Reference ID:</strong> {token.substring(0, 8).toUpperCase()}
        </div> : null}
      </div>
    );
  }

  return (
    <div className={styles.formWrapper}>
      <div className={styles.progressContainer}>
        <div className={styles.progressHeader}>
          <span>Completion Progress</span>
          <span>{answeredRequired} of {totalRequired} required answered</span>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <form className={styles.form} onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const name = identity.name.trim();
        const address = identity.address.trim();
        const phone = identity.phone.trim();
        const email = identity.email.trim();
        if (!name) { setError("Enter your name."); return; }
        if (!address) { setError("Enter the property address."); return; }
        if (!phone && !email) { setError("Provide a phone number or email — at least one."); return; }
        const missing = visibleFields.find((field) => field.required && !hasAnswer(field));
        if (missing) { setError(`Complete the required question: ${missing.label}.`); return; }
        const visibleAnswers: Record<string, string | string[]> = {};
        for (const field of visibleFields) {
          const value = answers[field.id];
          if (value !== undefined) visibleAnswers[field.id] = typeof value === "string" ? value.trim() : value;
        }
        if (!token) { setSubmitted(true); return; }
        setPending(true);
        try {
          const result = await submitQuestionnaireAction({ token, name, email, phone, answers: { ...visibleAnswers, _site_address: address } });
          if (!result.ok) { setError(result.message); return; }
          setSubmitted(true);
        } catch {
          setError("Could not submit your responses. Please try again.");
        } finally {
          setPending(false);
        }
      }}>
        
        <fieldset className={styles.fieldCard} aria-labelledby="intake-contact-title">
          <h2 id="intake-contact-title" className={styles.cardTitle}>Contact Information</h2>
          <div className={styles.identity}>
            <label className={styles.inputGroup}>
              <span>Your name <span aria-hidden="true" className={styles.asterisk}>*</span></span>
              <input value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} required aria-required="true" autoComplete="name" />
            </label>
            <label className={styles.inputGroup}>
              <span>Phone</span>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="04xx xxx xxx" value={identity.phone} onChange={(event) => setIdentity((current) => ({ ...current, phone: event.target.value }))} />
              <span className={styles.hint}>Phone or email — at least one</span>
            </label>
            <label className={styles.inputGroup}>
              <span>Email</span>
              <input type="email" autoComplete="email" value={identity.email} onChange={(event) => setIdentity((current) => ({ ...current, email: event.target.value }))} />
              <span className={styles.hint}>Phone or email — at least one</span>
            </label>
            <label className={styles.inputGroup}>
              <span>Property address <span aria-hidden="true" className={styles.asterisk}>*</span></span>
              <input value={identity.address} onChange={(event) => setIdentity((current) => ({ ...current, address: event.target.value }))} required aria-required="true" placeholder="Street, suburb" autoComplete="street-address" />
            </label>
          </div>
        </fieldset>

        {visibleFields.map((field: z.infer<typeof formFieldSchema>, index: number) => {
          const isError = error && field.required && !hasAnswer(field);
          return (
            <fieldset className={`${styles.fieldCard} ${isError ? styles.fieldError : ""}`} key={field.id} aria-invalid={isError ? "true" : "false"} aria-labelledby={`intake-q-${field.id}`}>
              <h2 id={`intake-q-${field.id}`} className={styles.cardTitle}>
                {index + 1}. {field.label}
                {field.required ? <span className={styles.asterisk} aria-hidden="true"> *</span> : null}
              </h2>
              {field.type === "text" ? <input className={styles.textInput} aria-labelledby={`intake-q-${field.id}`} required={field.required} value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} aria-required={field.required} /> : null}
              {field.type === "textarea" ? <textarea className={styles.textInput} rows={4} aria-labelledby={`intake-q-${field.id}`} required={field.required} value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} aria-required={field.required} /> : null}
              {field.type === "radio" ? <div className={styles.options} role="radiogroup" aria-required={field.required}>{(field.options || []).map((option: string) => {
                const isChecked = answers[field.id] === option;
                return (
                  <label key={option} className={`${styles.optionCard} ${isChecked ? styles.optionChecked : ""}`}>
                    <input className="sr-only" type="radio" name={field.id} checked={isChecked} onChange={() => setAnswers((current) => ({ ...current, [field.id]: option }))} /> 
                    <span className={styles.radioControl} aria-hidden="true"></span>
                    <span className={styles.optionLabel}>{option}</span>
                  </label>
                );
              })}</div> : null}
              {field.type === "checkbox" ? <div className={styles.options}>{(field.options || []).map((option: string) => {
                const isChecked = Array.isArray(answers[field.id]) && answers[field.id].includes(option);
                return (
                  <label key={option} className={`${styles.optionCard} ${isChecked ? styles.optionChecked : ""}`}>
                    <input className="sr-only" type="checkbox" checked={isChecked} onChange={() => toggle(field.id, option)} /> 
                    <span className={styles.checkboxControl} aria-hidden="true"></span>
                    <span className={styles.optionLabel}>{option}</span>
                  </label>
                );
              })}</div> : null}
            </fieldset>
          );
        })}
        {error ? <div className={styles.errorAlert} role="alert"><p>{error}</p></div> : null}
        <EstimateNotice />
        <button className={styles.submitBtn} type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit responses"}</button>
      </form>
    </div>
  );
}
