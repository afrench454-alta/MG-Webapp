"use client";

import { useState } from "react";

import { submitQuestionnaireAction } from "@/features/console/data/questionnaire-actions";
import type { publicQuestionnaireSchema, formFieldSchema } from "@/features/console/data/questionnaire-contract";
import type { z } from "zod";

import styles from "./questionnaire.module.css";

type Payload = z.infer<typeof publicQuestionnaireSchema>;

export function QuestionnaireForm({ token, payload }: { token: string; payload: Payload }) {
  const questionnaire = payload.questionnaire!;
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [identity, setIdentity] = useState({ name: "", email: "", phone: "", address: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggle = (fieldId: string, option: string) => setAnswers((current) => { const selected = Array.isArray(current[fieldId]) ? current[fieldId] as string[] : []; return { ...current, [fieldId]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] }; });

  const totalRequired = questionnaire.form_schema.fields.filter((f: z.infer<typeof formFieldSchema>) => f.required).length;
  const answeredRequired = questionnaire.form_schema.fields.filter((f: z.infer<typeof formFieldSchema>) => f.required && answers[f.id] && answers[f.id].length > 0).length;
  const progressPercent = totalRequired === 0 ? 100 : Math.round((answeredRequired / totalRequired) * 100);

  if (submitted) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>✓</div>
        <h1>Responses received</h1>
        <p>{questionnaire.completion_message || "Thanks — the team can now prepare the next step."}</p>
        <div className={styles.successDetails}>
          <strong>Reference ID:</strong> {token.substring(0, 8).toUpperCase()}
        </div>
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
        const missing = questionnaire.form_schema.fields.some((field: z.infer<typeof formFieldSchema>) => field.required && (!answers[field.id] || answers[field.id].length === 0));
        if (missing) { setError("Complete each required question."); return; }
        setPending(true);
        const result = await submitQuestionnaireAction({ token, name, email, phone, answers: { ...answers, _site_address: address } });
        setPending(false);
        if (!result.ok) { setError(result.message); return; }
        setSubmitted(true);
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

        {questionnaire.form_schema.fields.map((field: z.infer<typeof formFieldSchema>, index: number) => {
          const isError = error && field.required && (!answers[field.id] || answers[field.id].length === 0);
          return (
            <fieldset className={`${styles.fieldCard} ${isError ? styles.fieldError : ""}`} key={field.id} aria-invalid={isError ? "true" : "false"} aria-labelledby={`intake-q-${field.id}`}>
              <h2 id={`intake-q-${field.id}`} className={styles.cardTitle}>
                {index + 1}. {field.label}
                {field.required ? <span className={styles.asterisk} aria-hidden="true"> *</span> : null}
              </h2>
              {field.type === "text" ? <input className={styles.textInput} value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} aria-required={field.required} /> : null}
              {field.type === "textarea" ? <textarea className={styles.textInput} rows={4} value={(answers[field.id] as string) || ""} onChange={(event) => setAnswers((current) => ({ ...current, [field.id]: event.target.value }))} aria-required={field.required} /> : null}
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
        <button className={styles.submitBtn} type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit responses"}</button>
      </form>
    </div>
  );
}
