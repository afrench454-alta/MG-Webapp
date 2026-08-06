import "server-only";

import { z } from "zod";

import type { BusinessContext } from "@/lib/supabase/business";
import { createClient } from "@/lib/supabase/server";

import type { Questionnaire, QuestionnaireSubmission } from "../domain";

const formFieldSchema = z.object({ id: z.string(), label: z.string(), type: z.enum(["text", "textarea", "radio", "checkbox"]), required: z.boolean().optional(), options: z.array(z.string()).optional() });
export const publicQuestionnaireSchema = z.object({ already_submitted: z.boolean(), expires_at: z.string().optional(), business: z.object({ name: z.string(), logo_storage_path: z.string().nullable().optional() }).optional(), questionnaire: z.object({ id: z.uuid(), title: z.string(), introduction: z.string().nullable(), completion_message: z.string().nullable(), version: z.number(), form_schema: z.object({ fields: z.array(formFieldSchema) }) }).optional() });
const questionnaireRowSchema = z.object({ id: z.uuid(), name: z.string(), public_title: z.string(), introduction: z.string().nullable(), form_schema: z.object({ fields: z.array(formFieldSchema) }) });
const responseRowSchema = z.object({ id: z.uuid(), questionnaire_id: z.uuid(), respondent_name: z.string().nullable(), respondent_email: z.string().nullable(), submitted_at: z.string() });

function questionnaireTone(index: number): Questionnaire["tone"] { return (["sage", "forest", "olive", "amber"] as const)[index % 4]; }
function formatDate(value: string): string { return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Australia/Brisbane" }).format(new Date(value)); }

export async function listQuestionnaires(context: BusinessContext): Promise<Questionnaire[]> { if (context.role === "technician") return []; const supabase = await createClient(); const { data, error } = await supabase.from("questionnaires").select("id, name, public_title, introduction, form_schema").eq("business_id", context.businessId).eq("status", "active").order("created_at"); if (error) throw new Error(error.message); return z.array(questionnaireRowSchema).parse(data || []).map((row, index) => ({ id: row.id, category: row.name, title: row.public_title, description: row.introduction || "Client intake questionnaire", count: row.form_schema.fields.length, tone: questionnaireTone(index) })); }

export async function listQuestionnaireSubmissions(context: BusinessContext): Promise<QuestionnaireSubmission[]> { if (context.role === "technician") return []; const supabase = await createClient(); const [responsesResult, questionnairesResult] = await Promise.all([supabase.from("questionnaire_responses").select("id, questionnaire_id, respondent_name, respondent_email, submitted_at").eq("business_id", context.businessId).order("submitted_at", { ascending: false }).limit(50), supabase.from("questionnaires").select("id, public_title").eq("business_id", context.businessId)]); if (responsesResult.error) throw new Error(responsesResult.error.message); if (questionnairesResult.error) throw new Error(questionnairesResult.error.message); const names = new Map(z.array(z.object({ id: z.uuid(), public_title: z.string() })).parse(questionnairesResult.data || []).map((row) => [row.id, row.public_title])); return z.array(responseRowSchema).parse(responsesResult.data || []).map((row) => ({ id: row.id, questionnaire: names.get(row.questionnaire_id) || "Questionnaire", respondent: row.respondent_name || "Anonymous response", email: row.respondent_email || "", submitted: formatDate(row.submitted_at) })); }

export async function createQuestionnaireInvitation(context: BusinessContext, questionnaireId: string, rawToken: string, email: string): Promise<void> { const supabase = await createClient(); const { error } = await supabase.rpc("create_questionnaire_invitation", { target_business_id: context.businessId, target_questionnaire_id: questionnaireId, raw_token: rawToken, target_email: email, target_client_id: null }); if (error) throw new Error(error.message); }

export async function getPublicQuestionnaire(rawToken: string) { const supabase = await createClient(); const { data, error } = await supabase.rpc("get_public_questionnaire", { raw_token: rawToken }); if (error) throw new Error(error.message); if (!data) return null; return publicQuestionnaireSchema.parse(data); }

export async function submitPublicQuestionnaire(rawToken: string, answers: Record<string, string | string[]>, name: string, email: string, phone: string): Promise<string> { const supabase = await createClient(); const { data, error } = await supabase.rpc("submit_questionnaire_response", { raw_token: rawToken, response_answers: answers, response_name: name || null, response_email: email || null, response_phone: phone || null }); if (error) throw new Error(error.message); return z.uuid().parse(data); }

