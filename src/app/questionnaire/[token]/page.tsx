import { notFound } from "next/navigation";

import { getPublicQuestionnaire } from "@/features/console/data/questionnaire-repository";

import { QuestionnaireForm } from "./questionnaire-form";
import styles from "./questionnaire.module.css";

export const dynamic = "force-dynamic";

export default async function PublicQuestionnairePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await getPublicQuestionnaire(token);
  if (!payload) notFound();
  return <main className={styles.page}><section className={styles.card}><header><p>{payload.business?.name || "FieldCentral Pro"}</p><h1>{payload.already_submitted ? "Questionnaire already submitted" : payload.questionnaire?.title}</h1><span>{payload.already_submitted ? "This secure link has already been used." : payload.questionnaire?.introduction}</span></header>{payload.already_submitted ? null : <QuestionnaireForm token={token} payload={payload} />}</section></main>;
}

