import { redirect } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { ConsoleApp } from "@/features/console/console-app";
import { archiveClientAction, saveClientAction } from "@/features/console/data/client-actions";
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
import { getBusinessContext } from "@/lib/supabase/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <ConsoleApp />;
  }

  const context = await getBusinessContext();
  if (!context) redirect("/sign-in");

  const [clients, jobRequests, questionnaires, questionnaireSubmissions, quotes, jobs, teamMembers, invitations, businessDetails, invoices] = await Promise.all([
    listClients(context),
    listJobRequests(context),
    listQuestionnaires(context),
    listQuestionnaireSubmissions(context),
    listQuotes(context),
    listJobs(context),
    listTeamMembers(context, { includeInactive: true }),
    listTeamInvitations(context),
    getBusinessProfile(context),
    listInvoices(context),
  ]);

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
      signedInEmail={context.actorEmail || "Signed-in operator"}
      actorId={context.actorId}
      actorRole={context.role}
      canManageClients={context.role !== "technician"}
      canManageRequests={context.role !== "technician"}
      onSaveClient={saveClientAction}
      onArchiveClient={archiveClientAction}
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
