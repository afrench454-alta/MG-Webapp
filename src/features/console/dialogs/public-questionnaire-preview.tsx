"use client";

import Image from "next/image";
import type { Questionnaire } from "../domain";
import { QuestionnaireForm } from "@/app/questionnaire/[token]/questionnaire-form";
import styles from "@/app/questionnaire/[token]/questionnaire.module.css";

export function PublicQuestionnairePreview({
  questionnaire,
  onClose,
}: {
  questionnaire: Questionnaire;
  onClose: () => void;
}) {
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
        <QuestionnaireForm questionnaire={{
          form_schema: { fields: questionnaire.fields },
          completion_message: "Preview complete. Your answers were not saved.",
        }} />
      </section>
    </div>
  );
}
