"use client";

import { useState } from "react";
import Image from "next/image";
import type { Questionnaire } from "../domain";
import styles from "@/app/questionnaire/[token]/questionnaire.module.css";

export function PublicQuestionnairePreview({
  questionnaire,
  onClose,
}: {
  questionnaire: Questionnaire;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const fields = questionnaire.fields || [];

  if (submitted) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h1>Preview only</h1>
            <p>This is what a client sees after they submit.</p>
            <button className={styles.submitBtn} onClick={onClose} type="button">
              Close preview
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.brandBar}>
            <Image
              src="/mow-glow-logo.png"
              alt="Mow & Glow Property Services"
              width={140}
              height={140}
              unoptimized
            />
            <div className={styles.brandDetails}>
              <strong>Mow & Glow Property Services</strong>
              <span>Preview — answers are not saved</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                marginLeft: "auto",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "white",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Exit Preview
            </button>
          </div>
          <div className={styles.titleSection}>
            <p className={styles.badge}>Secure Questionnaire</p>
            <h1>{questionnaire.title}</h1>
            <span>{questionnaire.description}</span>
          </div>
        </header>
        <div className={styles.formWrapper}>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
            }}
          >
            <fieldset className={styles.fieldCard}>
              <legend className={styles.cardTitle}>Contact Information</legend>
              <div className={styles.identity}>
                <label className={styles.inputGroup}>
                  <span>Your name *</span>
                  <input required />
                </label>
                <label className={styles.inputGroup}>
                  <span>Phone *</span>
                  <input required />
                </label>
                <label className={styles.inputGroup}>
                  <span>Property address *</span>
                  <input required placeholder="Street, suburb" />
                </label>
              </div>
            </fieldset>
            {fields.map((field, index) => (
              <fieldset className={styles.fieldCard} key={field.id}>
                <legend className={styles.cardTitle}>
                  {index + 1}. {field.label}
                  {field.required ? " *" : ""}
                </legend>
                {field.type === "textarea" ? (
                  <textarea className={styles.textInput} rows={4} />
                ) : field.type === "text" ? (
                  <input className={styles.textInput} />
                ) : (
                  <div className={styles.options}>
                    {(field.options || []).map((option) => (
                      <label key={option} className={styles.optionCard}>
                        <input
                          className="sr-only"
                          type={field.type === "checkbox" ? "checkbox" : "radio"}
                          name={field.id}
                        />
                        <span
                          className={
                            field.type === "checkbox"
                              ? styles.checkboxControl
                              : styles.radioControl
                          }
                          aria-hidden="true"
                        />
                        <span className={styles.optionLabel}>{option}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            ))}
            <button className={styles.submitBtn} type="submit">
              Submit responses
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
