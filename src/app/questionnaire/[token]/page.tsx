import { notFound } from "next/navigation";

import { getPublicQuestionnaire } from "@/features/console/data/questionnaire-repository";

import { QuestionnaireForm } from "./questionnaire-form";
import styles from "./questionnaire.module.css";

export const dynamic = "force-dynamic";

import Image from "next/image";

export default async function PublicQuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await getPublicQuestionnaire(token);
  if (!payload) notFound();
  
  return (
    <main className={styles.page}>
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
              <strong>{payload.business?.name || "Mow & Glow Property Services"}</strong>
              <span>ABN: 15 219 585 352</span>
              <span>Phone: (+61) 400 856 532</span>
            </div>
          </div>
          <div className={styles.titleSection}>
            <p className={styles.badge}>Secure Questionnaire</p>
            <h1>{payload.already_submitted ? "Questionnaire already submitted" : payload.questionnaire?.title}</h1>
            <span>{payload.already_submitted ? "This secure link has already been used." : payload.questionnaire?.introduction}</span>
            {!payload.already_submitted && (
              <p className={styles.estimatedTime}>Estimated time: 3 mins</p>
            )}
          </div>
        </header>
        {payload.already_submitted ? null : <QuestionnaireForm token={token} payload={payload} />}
      </section>
    </main>
  );
}

