import { z } from "zod";

import type { QuestionnaireSubmission } from "../domain";

export const sendQuestionnaireSchema = z.object({
  questionnaireId: z.uuid(),
  recipient: z.string().trim().min(1).max(160),
  email: z.email().max(320),
});

export const publicQuestionnaireSubmissionSchema = z.object({
  token: z.string().min(32).max(512),
  name: z.string().trim().max(160),
  email: z.union([z.literal(""), z.email().max(320)]),
  phone: z.string().trim().max(80),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

type ActionFailure = Readonly<{ ok: false; message: string }>;
export type SendQuestionnaireResult = Readonly<{ ok: true; path: string; recipient: string; email: string }> | ActionFailure;
export type SubmitQuestionnaireResult = Readonly<{ ok: true; responseId: string }> | ActionFailure;
export type SendQuestionnaireAction = (input: z.infer<typeof sendQuestionnaireSchema>) => Promise<SendQuestionnaireResult>;
export type QuestionnaireSubmissionList = QuestionnaireSubmission[];

