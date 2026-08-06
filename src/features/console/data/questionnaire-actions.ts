"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireBusinessContext } from "@/lib/supabase/business";

import { publicQuestionnaireSubmissionSchema, sendQuestionnaireSchema, type SendQuestionnaireResult, type SubmitQuestionnaireResult } from "./questionnaire-contract";
import { createQuestionnaireInvitation, submitPublicQuestionnaire } from "./questionnaire-repository";

export async function sendQuestionnaireAction(input: unknown): Promise<SendQuestionnaireResult> { const parsed = sendQuestionnaireSchema.safeParse(input); if (!parsed.success) return { ok: false, message: "Check the recipient and questionnaire details." }; try { const token = randomBytes(32).toString("base64url"); await createQuestionnaireInvitation(await requireBusinessContext(["owner", "co_owner"]), parsed.data.questionnaireId, token, parsed.data.email); revalidatePath("/"); return { ok: true, path: `/questionnaire/${token}`, recipient: parsed.data.recipient, email: parsed.data.email }; } catch (error) { console.error("Questionnaire invitation failed", error); return { ok: false, message: "The secure questionnaire link could not be created." }; } }

export async function submitQuestionnaireAction(input: unknown): Promise<SubmitQuestionnaireResult> { const parsed = publicQuestionnaireSubmissionSchema.safeParse(input); if (!parsed.success) return { ok: false, message: "Complete the required questionnaire fields and try again." }; try { const responseId = await submitPublicQuestionnaire(parsed.data.token, parsed.data.answers, parsed.data.name, parsed.data.email, parsed.data.phone); return { ok: true, responseId }; } catch { return { ok: false, message: "This questionnaire link is invalid, expired, or has already been submitted." }; } }
