import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { Questionnaire, QuestionnaireSubmission } from "../domain";
import { formFieldSchema, publicQuestionnaireSchema } from "./questionnaire-contract";

const questionnaireRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  public_title: z.string(),
  introduction: z.string().nullable(),
  form_schema: z.object({ fields: z.array(formFieldSchema) }),
});

const responseRowSchema = z.object({
  id: z.uuid(),
  questionnaire_id: z.uuid(),
  respondent_name: z.string().nullable(),
  respondent_email: z.string().nullable(),
  respondent_phone: z.string().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  submitted_at: z.string(),
});

function questionnaireTone(index: number): Questionnaire["tone"] {
  return (["sage", "forest", "olive", "amber"] as const)[index % 4];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date(value));
}

export async function listQuestionnaires(
  context: BusinessContext,
): Promise<Questionnaire[]> {
  if (context.role === "technician") return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questionnaires")
    .select("id, name, public_title, introduction, form_schema")
    .eq("business_id", context.businessId)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error(error.message);
  return z
    .array(questionnaireRowSchema)
    .parse(data || [])
    .map((row, index) => ({
      id: row.id,
      category: row.name,
      title: row.public_title,
      description: row.introduction || "Client intake questionnaire",
      count: row.form_schema.fields.length,
      tone: questionnaireTone(index),
      fields: row.form_schema.fields,
    }));
}

export async function listQuestionnaireSubmissions(
  context: BusinessContext,
): Promise<QuestionnaireSubmission[]> {
  if (context.role === "technician") return [];
  const supabase = await createClient();
  const [responsesResult, questionnairesResult, requestsResult] =
    await Promise.all([
      supabase
        .from("questionnaire_responses")
        .select(
          "id, questionnaire_id, respondent_name, respondent_email, respondent_phone, answers, submitted_at",
        )
        .eq("business_id", context.businessId)
        .order("submitted_at", { ascending: false })
        .limit(50),
      supabase
        .from("questionnaires")
        .select("id, public_title")
        .eq("business_id", context.businessId),
      supabase
        .from("job_requests")
        .select("id, questionnaire_response_id")
        .eq("business_id", context.businessId)
        .not("questionnaire_response_id", "is", null),
    ]);
  if (responsesResult.error) throw new Error(responsesResult.error.message);
  if (questionnairesResult.error) {
    throw new Error(questionnairesResult.error.message);
  }
  if (requestsResult.error) throw new Error(requestsResult.error.message);

  const names = new Map(
    z
      .array(z.object({ id: z.uuid(), public_title: z.string() }))
      .parse(questionnairesResult.data || [])
      .map((row) => [row.id, row.public_title]),
  );
  const requestByResponse = new Map(
    z
      .array(
        z.object({
          id: z.uuid(),
          questionnaire_response_id: z.uuid().nullable(),
        }),
      )
      .parse(requestsResult.data || [])
      .filter((row) => row.questionnaire_response_id)
      .map((row) => [row.questionnaire_response_id as string, row.id]),
  );

  return z
    .array(responseRowSchema)
    .parse(responsesResult.data || [])
    .map((row) => ({
      id: row.id,
      questionnaireId: row.questionnaire_id,
      questionnaire: names.get(row.questionnaire_id) || "Questionnaire",
      respondent: row.respondent_name || "Anonymous response",
      email: row.respondent_email || "",
      phone: row.respondent_phone || "",
      submitted: formatDate(row.submitted_at),
      answers: row.answers,
      jobRequestId: requestByResponse.get(row.id),
    }));
}

export async function createQuestionnaireInvitation(
  context: BusinessContext,
  questionnaireId: string,
  rawToken: string,
  email: string,
  clientId?: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_questionnaire_invitation", {
    target_business_id: context.businessId,
    target_questionnaire_id: questionnaireId,
    raw_token: rawToken,
    target_email: email,
    target_client_id: clientId || null,
  });
  if (error) throw new Error(error.message);
}

export async function getPublicQuestionnaire(rawToken: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_questionnaire", {
    raw_token: rawToken,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  return publicQuestionnaireSchema.parse(data);
}

export async function submitPublicQuestionnaire(
  rawToken: string,
  answers: Record<string, string | string[]>,
  name: string,
  email: string,
  phone: string,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_questionnaire_response", {
    raw_token: rawToken,
    response_answers: answers,
    response_name: name || null,
    response_email: email || null,
    response_phone: phone || null,
  });
  if (error) throw new Error(error.message);
  return z.uuid().parse(data);
}
