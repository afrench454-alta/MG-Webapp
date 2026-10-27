import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { ConsoleApp } from "@/features/console/console-app";
import "@/features/console/console-desktop-nav.css";
import "@/features/console/console-phone.css";
import { archiveClientAction, commitClientImportAction, previewClientImportAction, saveClientAction } from "@/features/console/data/client-actions";
import { listClients } from "@/features/console/data/client-repository";
import { deleteJobRequestAction, saveJobRequestAction } from "@/features/console/data/job-request-actions";
import { listJobRequests } from "@/features/console/data/job-request-repository";
import { deleteInvoiceAction, deleteJobAction, deleteJobPhotoAction, deleteQuoteAction, finalizeInvoiceAction, markInvoiceSentAction, saveInvoiceAction, saveQuoteAction, scheduleJobAction, updateInvoicePaymentAction, updateJobAction, updateJobAssignmentsAction, updateQuoteStatusAction, uploadJobPhotoAction, voidInvoiceAction } from "@/features/console/data/operations-actions";
import { listInvoices, listJobs, listQuotes } from "@/features/console/data/operations-repository";
import { estimateJobAction } from "@/features/console/data/estimator-actions";
import { askJosephAction } from "@/features/console/data/joseph-actions";
import { sendQuestionnaireAction } from "@/features/console/data/questionnaire-actions";
import { listQuestionnaires, listQuestionnaireSubmissions } from "@/features/console/data/questionnaire-repository";
import {
  inviteTeamMemberAction,
  revokeTeamInviteAction,
  updateBusinessProfileAction,
  updateTeamMemberAction,
} from "@/features/console/data/team-actions";
import {
  getBusinessProfile,
  listTeamInvitations,
  listTeamMembers,
} from "@/features/console/data/team-repository";
import { businessProfile as defaultBusinessProfile } from "@/features/console/domain";
import { getBusinessContext } from "@/lib/supabase/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

type LoadResult<T> = { ok: true; data: T } | { ok: false; data: T; label: string };

async function loadHomeSlice<T>(label: string, task: Promise<T>, fallback: T): Promise<LoadResult<T>> {
  try {
    const data = await task;
    return { ok: true, data };
  } catch (error) {
    console.error(`Console home failed to load ${label}`, error);
    return { ok: false, data: fallback, label };
  }
}

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <ConsoleApp />;
  }

  const context = await getBusinessContext();
  if (!context) redirect("/sign-in");

  const results = await Promise.all([
    loadHomeSlice("clients", listClients(context), []),
    loadHomeSlice("job requests", listJobRequests(context), []),
    loadHomeSlice("questionnaires", listQuestionnaires(context), []),
    loadHomeSlice("questionnaire submissions", listQuestionnaireSubmissions(context), []),
    loadHomeSlice("quotes", listQuotes(context), []),
    loadHomeSlice("jobs", listJobs(context), []),
    loadHomeSlice("team members", listTeamMembers(context, { includeInactive: true }), []),
    loadHomeSlice("team invitations", listTeamInvitations(context), []),
    loadHomeSlice("business profile", getBusinessProfile(context), defaultBusinessProfile),
    loadHomeSlice("invoices", listInvoices(context), []),
  ]);

  const failedLabels = results.filter((r) => !r.ok).map((r) => (r as { label: string }).label);
  const dataLoadError = failedLabels.length > 0
    ? `Some dashboard data could not be loaded (${failedLabels.join(", ")}). Please refresh or try again later.`
    : undefined;

  const clients = results[0].data as typeof results[0]["data"];
  const jobRequests = results[1].data as typeof results[1]["data"];
  const questionnaires = results[2].data as typeof results[2]["data"];
  const questionnaireSubmissions = results[3].data as typeof results[3]["data"];
  const quotes = results[4].data as typeof results[4]["data"];
  const jobs = results[5].data as typeof results[5]["data"];
  const teamMembers = results[6].data as typeof results[6]["data"];
  const invitations = results[7].data as typeof results[7]["data"];
  const businessDetails = results[8].data as typeof results[8]["data"];
  const invoices = results[9].data as typeof results[9]["data"];

  return (
    <ConsoleApp
      initialClients={clients}
      initialJobRequests={jobRequests}
      initialQuestionnaires={questionnaires}
      initialQuestionnaireSubmissions={questionnaireSubmissions}
      initialQuotes={quotes}
      initialJobs={jobs}
      teamMembers={teamMembers}
      teamInvitations={invitations}
      businessDetails={businessDetails}
      initialInvoices={invoices}
      dataMode="live"
      dataLoadError={dataLoadError}
      signedInEmail={context.actorEmail || "Signed-in operator"}
      actorId={context.actorId}
      actorRole={context.role}
      canManageClients={context.role !== "technician"}
      canManageRequests={context.role !== "technician"}
      onSaveClient={saveClientAction}
      onArchiveClient={archiveClientAction}
      onPreviewClientImport={previewClientImportAction}
      onCommitClientImport={commitClientImportAction}
      onSaveJobRequest={saveJobRequestAction}
      onDeleteJobRequest={deleteJobRequestAction}
      onSaveQuote={saveQuoteAction}
      onUpdateQuoteStatus={updateQuoteStatusAction}
      onDeleteQuote={deleteQuoteAction}
      onScheduleJob={scheduleJobAction}
      onUpdateJob={updateJobAction}
      onUpdateJobAssignments={updateJobAssignmentsAction}
      onUploadJobPhoto={uploadJobPhotoAction}
      onDeleteJobPhoto={deleteJobPhotoAction}
      onDeleteJob={deleteJobAction}
      onSaveInvoice={saveInvoiceAction}
      onUpdateInvoicePayment={updateInvoicePaymentAction}
      onFinalizeInvoice={finalizeInvoiceAction}
      onMarkInvoiceSent={markInvoiceSentAction}
      onVoidInvoice={voidInvoiceAction}
      onDeleteInvoice={deleteInvoiceAction}
      onSendQuestionnaire={sendQuestionnaireAction}
      onEstimateJob={estimateJobAction}
      onAskJoseph={askJosephAction}
      onInviteTeamMember={inviteTeamMemberAction}
      onRevokeTeamInvite={revokeTeamInviteAction}
      onUpdateTeamMember={updateTeamMemberAction}
      onUpdateBusinessProfile={updateBusinessProfileAction}
      onSignOut={signOutAction}
    />
  );
}
