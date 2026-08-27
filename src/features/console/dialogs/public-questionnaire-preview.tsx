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

  if (submitted) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <h1>Responses received</h1>
            <p>Thanks — the team can now prepare the next step.</p>
            <div className={styles.successDetails}>
              <strong>Reference ID:</strong> DEMO-123
            </div>
            <button className={styles.submitBtn} onClick={onClose} style={{ marginTop: "24px" }}>
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
              <span>ABN: 15 219 585 352</span>
              <span>Phone: (+61) 400 856 532</span>
            </div>
            <button onClick={onClose} style={{ marginLeft: "auto", background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}>
              Exit Preview
            </button>
          </div>
          <div className={styles.titleSection}>
            <p className={styles.badge}>Secure Questionnaire</p>
            <h1>{questionnaire?.title || "End of Lease Questionnaire"}</h1>
            <span>Please answer the questions below so we can prepare an accurate quote.</span>
            <p className={styles.estimatedTime}>Estimated time: 3 mins</p>
          </div>
        </header>

        <div className={styles.formWrapper}>
          <div className={styles.progressContainer}>
            <div className={styles.progressHeader}>
              <span>Completion Progress</span>
              <span>0 of 3 required answered</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "0%" }} />
            </div>
          </div>

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
                  <span>Your name <span aria-hidden="true" className={styles.asterisk}>*</span></span>
                  <input required aria-required="true" />
                </label>
                <label className={styles.inputGroup}>
                  <span>Phone <span aria-hidden="true" className={styles.asterisk}>*</span></span>
                  <input required aria-required="true" />
                  <span className={styles.hint}>Best number to reach you</span>
                </label>
                <label className={styles.inputGroup}>
                  <span>Email</span>
                  <input type="email" />
                </label>
              </div>
            </fieldset>

            <fieldset className={styles.fieldCard}>
              <legend className={styles.cardTitle}>
                1. Property type & bedrooms/bathrooms <span className={styles.asterisk} aria-hidden="true"> *</span>
              </legend>
              <div className={styles.options} role="radiogroup" aria-required="true">
                {[
                  "1 Bed / 1 Bath Unit",
                  "2 Bed / 2 Bath Unit",
                  "3 Bed / 2 Bath House",
                  "4+ Bed Home",
                ].map((option) => (
                  <label key={option} className={styles.optionCard}>
                    <input className="sr-only" name="property" type="radio" required />
                    <span className={styles.radioControl} aria-hidden="true"></span>
                    <span className={styles.optionLabel}>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            
            <fieldset className={styles.fieldCard}>
              <legend className={styles.cardTitle}>
                2. Carpet steam clean required? <span className={styles.asterisk} aria-hidden="true"> *</span>
              </legend>
              <div className={styles.options} role="radiogroup" aria-required="true">
                {[
                  "Yes - all rooms",
                  "Yes - bedrooms only",
                  "No carpets",
                  "Unsure",
                ].map((option) => (
                  <label key={option} className={styles.optionCard}>
                    <input className="sr-only" name="carpet" type="radio" required />
                    <span className={styles.radioControl} aria-hidden="true"></span>
                    <span className={styles.optionLabel}>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.fieldCard}>
              <legend className={styles.cardTitle}>
                3. Window cleaning scope
              </legend>
              <div className={styles.options}>
                {[
                  "Inside glass & tracks",
                  "Outside ground level",
                  "Outside high level",
                  "Flyscreens & sills",
                ].map((option) => (
                  <label key={option} className={styles.optionCard}>
                    <input className="sr-only" type="checkbox" />
                    <span className={styles.checkboxControl} aria-hidden="true"></span>
                    <span className={styles.optionLabel}>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            
            <fieldset className={styles.fieldCard}>
              <legend className={styles.cardTitle}>
                4. Special stains, wall scuffs or pest treatment?
              </legend>
              <textarea className={styles.textInput} rows={4} />
            </fieldset>

            <button className={styles.submitBtn} type="submit">Submit responses</button>
          </form>
        </div>
      </section>
    </div>
  );
}
