"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Menu, Sparkles } from "lucide-react";
import "./console.css";
import {
  businessProfile as defaultBusinessProfile,
  clientsSeed,
  initialJobRequests,
  initialJobs,
  initialQuotes,
  invoiceSeed as invoice,
  markRequestScheduled,
  questionnaires,
  questionnaireSubmissionsSeed,
  teamMembersSeed,
} from "./domain";
import type {
  BusinessProfile,
  Client,
  ConsoleRoute,
  Invoice,
  Job,
  JobPhoto,
  JobRequest,
  JobRequestDraft,
  JobStatus,
  LineItem,
  Questionnaire,
  QuestionnaireSubmission,
  Quote,
  TeamInvitation,
  TeamMember,
} from "./domain";
import type {
  ArchiveClientAction,
  SaveClientAction,
} from "./data/client-contract";
import type {
  DeleteJobRequestAction,
  SaveJobRequestAction,
} from "./data/job-request-contract";
import type {
  DeleteInvoiceAction,
  DeleteJobAction,
  DeleteJobPhotoAction,
  DeleteQuoteAction,
  FinalizeInvoiceAction,
  VoidInvoiceAction,
  MarkInvoiceSentAction,
  SaveInvoiceAction,
  SaveQuoteAction,
  ScheduleJobAction,
  UpdateInvoicePaymentAction,
  UpdateJobAction,
  UpdateJobAssignmentsAction,
  UpdateQuoteStatusAction,
  UploadJobPhotoAction,
} from "./data/operations-contract";
import type { SendQuestionnaireAction } from "./data/questionnaire-contract";
import type { EstimateJobAction } from "./data/estimator-contract";
import type { AskJosephAction } from "./data/joseph-contract";
import { asJobRecurrence, buildNextDemoJob, clearJobSchedule, applyJobSchedule, describeJobUpdate, scheduledStartPayload, formatBrisbaneSchedule } from "./data/job-recurrence";
import type {
  InviteTeamAction,
  RevokeTeamInviteAction,
  UpdateBusinessProfileAction,
  UpdateTeamMemberAction,
} from "./data/team-contract";

import { Dialog } from "./components/dialog";
import { Sidebar } from "./components/sidebar";
import { MobileDock } from "./components/mobile-dock";
import { DashboardView } from "./views/dashboard-view";
import { ClientsView } from "./views/clients-view";
import { RequestsView } from "./views/requests-view";
import { QuestionnairesView } from "./views/questionnaires-view";
import { QuotesView } from "./views/quotes-view";
import { ScheduleView } from "./views/schedule-view";
import { JobBoardView } from "./views/job-board-view";
import { JosephView } from "./views/joseph-view";
import { InvoicesView } from "./views/invoices-view";
import { SettingsView } from "./views/settings-view";

import { ClientFormDialog } from "./dialogs/client-form-dialog";
import { QuoteFormDialog, type QuoteDraft } from "./dialogs/quote-form-dialog";
import { InvoiceFormDialog, type InvoiceDraft } from "./dialogs/invoice-form-dialog";
import { JobDetailsDialog } from "./dialogs/job-details-dialog";
import { DocumentViewDialog } from "./dialogs/document-view-dialog";
import { EstimatorDialog } from "./dialogs/estimator-dialog";
import { ScheduleFormDialog } from "./dialogs/schedule-form-dialog";
import { SendQuestionnaireDialog } from "./dialogs/send-questionnaire-dialog";
import { RequestFormDialog } from "./dialogs/request-form-dialog";
import { PublicQuestionnairePreview } from "./dialogs/public-questionnaire-preview";
import { SubmissionDialog } from "./dialogs/submission-dialog";
import {
  ConfirmDeleteClientDialog,
  ConfirmRecordDeleteDialog,
} from "./dialogs/confirm-delete-dialog";
import {
  OperationsRuleError,
  assertInvoiceCanBeDeleted,
  assertJobCanBeDeleted,
} from "./data/operations-rules";
import {
  applyInvoicePayment,
  finalizeInvoiceRecord,
  markInvoiceSent,
  voidInvoice,
} from "./data/invoice-lifecycle";
import {
  canCreateInvoiceFromQuote,
  draftInvoiceFromQuote,
  draftInvoiceFromRecord,
  liveInvoiceForQuote,
} from "./data/quote-invoice";
import { formatServiceTitle, isServiceCategory, parseServiceTitle } from "./data/service-catalog";
import { formatJobDisplayName, formatSiteTitle, formatSubmissionScope, defaultDateTimeLocal } from "./data/work-identity";

export type DialogState =
  | { type: "estimator"; jobRequestId?: string }
  | { type: "client"; client?: Client; returnTo?: DialogState }
  | { type: "delete-client"; client: Client }
  | { type: "delete-request"; request: JobRequest }
  | { type: "delete-quote"; quote: Quote }
  | { type: "delete-job"; job: Job }
  | { type: "delete-invoice"; record: Invoice }
  | { type: "quote-form"; prefill?: Partial<QuoteDraft> }
  | { type: "invoice-form"; quote?: Quote; invoice?: Invoice }
  | { type: "send-questionnaire"; questionnaireId?: string }
  | { type: "public-questionnaire"; questionnaire: Questionnaire }
  | { type: "submission"; submission: QuestionnaireSubmission }
  | { type: "schedule" }
  | { type: "job"; job: Job }
  | { type: "quote-document"; quote: Quote }
  | { type: "invoice-document"; record: Invoice }
  | { type: "request"; prefill?: JobRequestDraft };

export type ConsoleAppProps = {
  initialClients?: Client[];
  initialJobRequests?: JobRequest[];
  initialQuestionnaires?: Questionnaire[];
  initialQuestionnaireSubmissions?: QuestionnaireSubmission[];
  initialQuotes?: Quote[];
  initialJobs?: Job[];
  teamMembers?: TeamMember[];
  teamInvitations?: TeamInvitation[];
  businessDetails?: BusinessProfile;
  initialInvoices?: Invoice[];
  dataMode?: "demo" | "live";
  signedInEmail?: string;
  actorId?: string;
  actorRole?: "owner" | "co_owner" | "technician";
  canManageClients?: boolean;
  canManageRequests?: boolean;
  onSaveClient?: SaveClientAction;
  onArchiveClient?: ArchiveClientAction;
  onSaveJobRequest?: SaveJobRequestAction;
  onDeleteJobRequest?: DeleteJobRequestAction;
  onSaveQuote?: SaveQuoteAction;
  onUpdateQuoteStatus?: UpdateQuoteStatusAction;
  onDeleteQuote?: DeleteQuoteAction;
  onScheduleJob?: ScheduleJobAction;
  onUpdateJob?: UpdateJobAction;
  onUpdateJobAssignments?: UpdateJobAssignmentsAction;
  onUploadJobPhoto?: UploadJobPhotoAction;
  onDeleteJobPhoto?: DeleteJobPhotoAction;
  onDeleteJob?: DeleteJobAction;
  onSaveInvoice?: SaveInvoiceAction;
  onUpdateInvoicePayment?: UpdateInvoicePaymentAction;
  onFinalizeInvoice?: FinalizeInvoiceAction;
  onMarkInvoiceSent?: MarkInvoiceSentAction;
  onVoidInvoice?: VoidInvoiceAction;
  onDeleteInvoice?: DeleteInvoiceAction;
  onSendQuestionnaire?: SendQuestionnaireAction;
  onEstimateJob?: EstimateJobAction;
  onAskJoseph?: AskJosephAction;
  onInviteTeamMember?: InviteTeamAction;
  onRevokeTeamInvite?: RevokeTeamInviteAction;
  onUpdateTeamMember?: UpdateTeamMemberAction;
  onUpdateBusinessProfile?: UpdateBusinessProfileAction;
  onSignOut?: () => Promise<void>;
};

export function ConsoleApp({
  initialClients,
  initialJobRequests: providedJobRequests,
  initialQuestionnaires: providedQuestionnaires,
  initialQuestionnaireSubmissions: providedQuestionnaireSubmissions,
  initialQuotes: providedQuotes,
  initialJobs: providedJobs,
  teamMembers: providedTeamMembers,
  teamInvitations: providedInvitations,
  businessDetails,
  initialInvoices: providedInvoices,
  dataMode = "demo",
  signedInEmail = "ops@fieldcentral.local",
  actorId,
  actorRole = "owner",
  canManageClients = true,
  canManageRequests = true,
  onSaveClient,
  onArchiveClient,
  onSaveJobRequest,
  onDeleteJobRequest,
  onSaveQuote,
  onUpdateQuoteStatus,
  onDeleteQuote,
  onScheduleJob,
  onUpdateJob,
  onUpdateJobAssignments,
  onUploadJobPhoto,
  onDeleteJobPhoto,
  onDeleteJob,
  onSaveInvoice,
  onUpdateInvoicePayment,
  onFinalizeInvoice,
  onMarkInvoiceSent,
  onVoidInvoice,
  onDeleteInvoice,
  onSendQuestionnaire,
  onEstimateJob,
  onAskJoseph,
  onInviteTeamMember,
  onRevokeTeamInvite,
  onUpdateTeamMember,
  onUpdateBusinessProfile,
  onSignOut,
}: ConsoleAppProps = {}) {
  const [active, setActive] = useState<ConsoleRoute>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [clients, setClients] = useState<Client[]>(() =>
    structuredClone(initialClients ?? clientsSeed),
  );
  const [jobRequests, setJobRequests] = useState<JobRequest[]>(() =>
    structuredClone(providedJobRequests ?? initialJobRequests),
  );
  const [questionnaireItems] = useState<Questionnaire[]>(() =>
    structuredClone(providedQuestionnaires ?? questionnaires),
  );
  const [questionnaireSubmissions, setQuestionnaireSubmissions] = useState<
    QuestionnaireSubmission[]
  >(() =>
    structuredClone(providedQuestionnaireSubmissions ?? questionnaireSubmissionsSeed),
  );
  const [quotes, setQuotes] = useState<Quote[]>(() =>
    structuredClone(providedQuotes ?? initialQuotes),
  );
  const [jobs, setJobs] = useState<Job[]>(() =>
    structuredClone(providedJobs ?? initialJobs),
  );
  const [invoiceRecords, setInvoiceRecords] = useState<Invoice[]>(() =>
    structuredClone(providedInvoices ?? [invoice]),
  );
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() =>
    structuredClone(providedTeamMembers ?? teamMembersSeed),
  );
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>(() =>
    structuredClone(providedInvitations ?? []),
  );
  const [businessDetailsState, setBusinessDetailsState] = useState<BusinessProfile>(
    () => structuredClone(businessDetails ?? defaultBusinessProfile),
  );
  const [toast, setToast] = useState("");
  const [clientMutationPending, setClientMutationPending] = useState(false);
  const [clientMutationError, setClientMutationError] = useState("");
  const [requestMutationPending, setRequestMutationPending] = useState(false);
  const [requestMutationError, setRequestMutationError] = useState("");
  const [operationMutationPending, setOperationMutationPending] = useState(false);
  const [operationMutationError, setOperationMutationError] = useState("");
  const isTechnician = actorRole === "technician";
  const canOperateOffice = canManageClients && !isTechnician;
  const officeRoutes: ConsoleRoute[] = [
    "clients",
    "questionnaires",
    "quotes",
    "invoices",
    "settings",
  ];
  const currentRoute =
    !canOperateOffice && officeRoutes.includes(active) ? "dashboard" : active;

  useEffect(() => {
    if (dataMode !== "demo") return;
    const params = new URLSearchParams(window.location.search);
    const previewType = params.get("documentPreview");
    const requestedId = params.get("documentId");
    const requestedRows = Number(params.get("documentRows"));
    const previewItems = (items: LineItem[]) => {
      if (!Number.isInteger(requestedRows) || requestedRows <= items.length)
        return items;
      return Array.from(
        { length: Math.min(requestedRows, 40) },
        (_, index) => {
          const source = items[index % items.length];
          return {
            ...source,
            description: `${source.description} ${index + 1}`,
          };
        },
      );
    };
    let previewRoute: ConsoleRoute | null = null;
    let previewDialog: DialogState | null = null;

    if (previewType === "quote") {
      const quote =
        initialQuotes.find((item) => item.id === requestedId) ??
        initialQuotes[0];
      if (quote) {
        const preview = structuredClone(quote);
        preview.items = previewItems(preview.items);
        previewRoute = "quotes";
        previewDialog = { type: "quote-document", quote: preview };
      }
    }

    if (previewType === "invoice") {
      const preview = structuredClone(invoice);
      preview.items = previewItems(preview.items);
      previewRoute = "invoices";
      previewDialog = { type: "invoice-document", record: preview };
    }

    if (!previewRoute || !previewDialog) return;
    const nextRoute = previewRoute;
    const nextDialog = previewDialog;
    const timer = window.setTimeout(() => {
      setActive(nextRoute);
      setDialog(nextDialog);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dataMode]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const closeDialog = () => {
    if (
      clientMutationPending ||
      requestMutationPending ||
      operationMutationPending
    )
      return;
    setDialog(null);
    setClientMutationError("");
    setOperationMutationError("");
  };

  const upsertClient = (saved: Client) => {
    setClients((current) =>
      current.some((client) => client.id === saved.id)
        ? current.map((client) => (client.id === saved.id ? saved : client))
        : [...current, saved],
    );
  };

  const closeClientDialog = () => {
    setDialog((current) =>
      current?.type === "client" && current.returnTo ? current.returnTo : null,
    );
  };

  const persistClient = async (saved: Client) => {
    setClientMutationError("");

    if (dataMode === "demo") {
      upsertClient(saved);
      closeClientDialog();
      showToast("Client saved.");
      return;
    }

    if (!onSaveClient) {
      setClientMutationError("Live client saving is not available.");
      return;
    }

    setClientMutationPending(true);
    try {
      const result = await onSaveClient(saved);
      if (!result.ok) {
        setClientMutationError(result.message);
        return;
      }
      upsertClient(result.client);
      closeClientDialog();
      showToast("Client saved.");
    } catch {
      setClientMutationError("The client could not be saved. Try again.");
    } finally {
      setClientMutationPending(false);
    }
  };

  const removeClient = async (client: Client) => {
    setClientMutationError("");

    if (dataMode === "demo") {
      setClients((current) =>
        current.filter((item) => item.id !== client.id),
      );
      setDialog(null);
      showToast("Client deleted.");
      return;
    }

    if (!onArchiveClient) {
      setClientMutationError("Live client archiving is not available.");
      return;
    }

    setClientMutationPending(true);
    try {
      const result = await onArchiveClient(client.id);
      if (!result.ok) {
        setClientMutationError(result.message);
        return;
      }
      setClients((current) =>
        current.filter((item) => item.id !== result.clientId),
      );
      setDialog(null);
      showToast("Client archived.");
    } catch {
      setClientMutationError("The client could not be archived. Try again.");
    } finally {
      setClientMutationPending(false);
    }
  };

  const persistJobRequest = async (draft: JobRequestDraft) => {
    setRequestMutationError("");

    const selectedClient = clients.find(
      (client) => client.id === draft.clientId,
    );
    const selectedProperty = selectedClient?.properties.find(
      (property, index) =>
        (property.id || `${draft.clientId}-property-${index}`) ===
        draft.propertyId,
    );

    if (dataMode === "demo") {
      const createdId = `request-${Date.now()}`;
      setJobRequests((current) => [
        {
          id: createdId,
          clientId: selectedClient?.id,
          propertyId: selectedProperty?.id,
          client: selectedClient?.name || "Unassigned client",
          address: selectedProperty?.address || "No service address",
          category: formatServiceTitle(draft.category, draft.serviceDetail),
          scope: draft.scope,
          status: "New",
          created: "05 Aug 2026",
        },
        ...current,
      ]);
      if (draft.questionnaireResponseId) {
        setQuestionnaireSubmissions((current) =>
          current.map((submission) =>
            submission.id === draft.questionnaireResponseId
              ? { ...submission, jobRequestId: createdId }
              : submission,
          ),
        );
      }
      setDialog(null);
      showToast("Job request created.");
      return;
    }

    if (!onSaveJobRequest) {
      setRequestMutationError("Live job request saving is not available.");
      return;
    }

    setRequestMutationPending(true);
    try {
      const result = await onSaveJobRequest(draft);
      if (!result.ok) {
        setRequestMutationError(result.message);
        return;
      }
      setJobRequests((current) => [result.request, ...current]);
      if (draft.questionnaireResponseId) {
        setQuestionnaireSubmissions((current) =>
          current.map((submission) =>
            submission.id === draft.questionnaireResponseId
              ? { ...submission, jobRequestId: result.request.id }
              : submission,
          ),
        );
      }
      setDialog(null);
      showToast("Job request created.");
    } catch {
      setRequestMutationError(
        "The job request could not be saved. Try again.",
      );
    } finally {
      setRequestMutationPending(false);
    }
  };

  const removeJobRequest = async (request: JobRequest) => {
    setRequestMutationError("");

    if (dataMode === "demo") {
      setJobRequests((current) =>
        current.filter((item) => item.id !== request.id),
      );
      setDialog(null);
      showToast("Job request deleted.");
      return;
    }

    if (!onDeleteJobRequest) {
      setRequestMutationError("Live job request deletion is not available.");
      return;
    }

    setRequestMutationPending(true);
    try {
      const result = await onDeleteJobRequest(request.id);
      if (!result.ok) {
        setRequestMutationError(result.message);
        return;
      }
      setJobRequests((current) =>
        current.filter((item) => item.id !== result.requestId),
      );
      setDialog(null);
      showToast("Job request deleted.");
    } catch {
      setRequestMutationError(
        "The job request could not be deleted. Try again.",
      );
    } finally {
      setRequestMutationPending(false);
    }
  };

  const removeQuote = async (quote: Quote) => {
    if (dataMode === "live") {
      if (!onDeleteQuote) {
        setOperationMutationError("Live quote deletion is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onDeleteQuote(quote.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
    }
    setQuotes((current) => current.filter((item) => item.id !== quote.id));
    setDialog(null);
    showToast("Quote deleted.");
  };

  const removeJob = async (job: Job) => {
    try {
      assertJobCanBeDeleted(job);
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The job could not be deleted.",
      );
      return;
    }

    if (dataMode === "live") {
      if (!onDeleteJob) {
        setOperationMutationError("Live job deletion is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onDeleteJob(job.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
    }
    setJobs((current) => current.filter((item) => item.id !== job.id));
    setDialog(null);
    showToast("Job deleted.");
  };

  const removeInvoice = async (record: Invoice) => {
    try {
      assertInvoiceCanBeDeleted(record);
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The invoice could not be deleted.",
      );
      return;
    }

    if (dataMode === "live") {
      if (!onDeleteInvoice) {
        setOperationMutationError("Live invoice deletion is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onDeleteInvoice(record.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
    }
    setInvoiceRecords((current) =>
      current.filter((item) => item.id !== record.id),
    );
    setDialog(null);
    showToast("Invoice deleted.");
  };

  const updateJob = async (updated: Job) => {
    const previous = jobs.find((job) => job.id === updated.id);
    if (dataMode === "live") {
      if (!onUpdateJob) {
        setOperationMutationError("Live job updates are not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onUpdateJob({
        id: updated.id,
        status: updated.status,
        notes: updated.notes,
        recurrence: asJobRecurrence(updated.recurrence),
        scheduledStart: scheduledStartPayload(updated),
      });
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      updated = result.job;
      setJobs((current) => {
        const replaced = current.map((job) => (job.id === updated.id ? updated : job));
        if (result.nextJob && !replaced.some((job) => job.id === result.nextJob?.id)) {
          return [...replaced, result.nextJob];
        }
        return replaced;
      });
      setDialog({ type: "job", job: updated });
      showToast(
        result.nextJob
          ? `Job completed. Next ${updated.recurrence.toLowerCase()} visit booked for ${result.nextJob.date}.`
          : describeJobUpdate(previous, updated),
      );
      return;
    }
    const becameComplete =
      updated.status === "completed" && previous?.status !== "completed";
    const nextJob = becameComplete
      ? buildNextDemoJob(updated, `job-${Date.now()}`)
      : null;
    setJobs((current) => {
      const replaced = current.map((job) => (job.id === updated.id ? updated : job));
      if (nextJob && !replaced.some((job) => job.id === nextJob.id)) {
        return [...replaced, nextJob];
      }
      return replaced;
    });
    setDialog({ type: "job", job: updated });
    showToast(
      nextJob
        ? `Job completed. Next ${updated.recurrence.toLowerCase()} visit booked for ${nextJob.date}.`
        : describeJobUpdate(previous, updated),
    );
  };

  const assignJob = async (job: Job, profileIds: string[]) => {
    setOperationMutationError("");
    if (dataMode === "demo") {
      const updated = {
        ...job,
        assigneeIds: profileIds,
        assignees: profileIds.map(
          (id) =>
            teamMembers.find((member) => member.id === id)?.name ||
            "Team member",
        ),
      };
      setJobs((current) =>
        current.map((item) => (item.id === job.id ? updated : item)),
      );
      setDialog({ type: "job", job: updated });
      return;
    }
    if (!onUpdateJobAssignments) {
      setOperationMutationError("Live job assignments are not available.");
      return;
    }
    setOperationMutationPending(true);
      let result;
      try {
        result = await onUpdateJobAssignments({
      jobId: job.id,
      profileIds,
    });
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
      setOperationMutationError(result.message);
      return;
    }
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? result.job : item)),
    );
    setDialog({ type: "job", job: result.job });
    showToast("Job assignments saved.");
  };

  const uploadPhoto = async (job: Job, file: File) => {
    setOperationMutationError("");
    if (dataMode === "demo") {
      const photo: JobPhoto = {
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
        caption: "",
        created: "Today",
      };
      const updated = { ...job, photos: [photo, ...job.photos] };
      setJobs((current) =>
        current.map((item) => (item.id === job.id ? updated : item)),
      );
      setDialog({ type: "job", job: updated });
      return;
    }
    if (!onUploadJobPhoto) {
      setOperationMutationError("Live photo uploads are not available.");
      return;
    }
    const formData = new FormData();
    formData.set("jobId", job.id);
    formData.set("photo", file);
    formData.set("caption", "");
    setOperationMutationPending(true);
      let result;
      try {
        result = await onUploadJobPhoto(formData);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
      setOperationMutationError(result.message);
      return;
    }
    const updated = { ...job, photos: [result.photo, ...job.photos] };
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? updated : item)),
    );
    setDialog({ type: "job", job: updated });
    showToast("Job photo uploaded.");
  };

  const removePhoto = async (job: Job, photo: JobPhoto) => {
    setOperationMutationError("");
    if (dataMode === "live") {
      if (!onDeleteJobPhoto) {
        setOperationMutationError("Live photo deletion is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onDeleteJobPhoto(job.id, photo.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
    }
    const updated = {
      ...job,
      photos: job.photos.filter((item) => item.id !== photo.id),
    };
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? updated : item)),
    );
    setDialog({ type: "job", job: updated });
    showToast("Job photo deleted.");
  };

  const moveJob = (id: string, status: JobStatus) => {
    const target = jobs.find((job) => job.id === id);
    if (!target) {
      setJobs((current) =>
        current.map((job) => (job.id === id ? { ...job, status } : job)),
      );
      showToast(`Job moved to ${status.replace("-", " ")}.`);
      return;
    }
    if (status === "unscheduled") {
      void updateJob(clearJobSchedule({ ...target, status: "unscheduled" }));
      return;
    }
    if (status === "scheduled" && !target.dateKey) {
      void updateJob(applyJobSchedule(target, defaultDateTimeLocal(), "scheduled"));
      return;
    }
    void updateJob({ ...target, status });
  };

  const updateQuoteStatus = async (
    quoteId: string,
    status: Quote["status"],
  ) => {
    if (dataMode === "live") {
      if (!onUpdateQuoteStatus) {
        setOperationMutationError("Live quote updates are not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onUpdateQuoteStatus(quoteId, status);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      setQuotes((current) =>
        current.map((quote) =>
          quote.id === quoteId ? result.quote : quote,
        ),
      );
      setDialog((current) =>
        current?.type === "quote-document"
          ? { ...current, quote: result.quote }
          : current,
      );
      showToast(`Quote marked ${status.toLowerCase()}.`);
      return;
    }
    setQuotes((current) =>
      current.map((quote) =>
        quote.id === quoteId ? { ...quote, status } : quote,
      ),
    );
    setDialog((current) =>
      current?.type === "quote-document"
        ? { ...current, quote: { ...current.quote, status } }
        : current,
    );
    showToast(`Quote marked ${status.toLowerCase()}.`);
  };

  const updateInvoicePaymentStatus = async (
    invoiceId: string,
    status: Invoice["paymentStatus"],
  ) => {
    setOperationMutationError("");
    if (dataMode === "live") {
      if (!onUpdateInvoicePayment) {
        setOperationMutationError("Live invoice updates are not available.");
        return;
      }
      setOperationMutationError("");
      setOperationMutationPending(true);
      let result;
      try {
        result = await onUpdateInvoicePayment(invoiceId, status);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      setInvoiceRecords((current) =>
        current.map((record) =>
          record.id === invoiceId ? result.invoice : record,
        ),
      );
      setDialog((current) =>
        current?.type === "invoice-document" &&
        current.record.id === invoiceId
          ? { ...current, record: result.invoice }
          : current,
      );
      showToast(`Invoice payment status set to ${status.toLowerCase()}.`);
      return;
    }
    try {
      setInvoiceRecords((current) =>
        current.map((record) =>
          record.id === invoiceId ? applyInvoicePayment(record, status) : record,
        ),
      );
      setDialog((current) => {
        if (current?.type === "invoice-document" && current.record.id === invoiceId) {
          return { ...current, record: applyInvoicePayment(current.record, status) };
        }
        return current;
      });
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The invoice payment could not be updated.",
      );
      return;
    }
    showToast(`Invoice payment status set to ${status.toLowerCase()}.`);
  };

  const persistQuote = async (draft: QuoteDraft) => {
    if (dataMode === "demo") {
      setQuotes((current) => {
        if (draft.id) {
          return current.map((quote) =>
            quote.id === draft.id
              ? {
                  ...quote,
                  jobRequestId: draft.jobRequestId,
                  scope: draft.scope,
                  items: draft.items,
                  clientNotes: draft.clientNotes,
                  internalNotes: draft.internalNotes,
                }
              : quote,
          );
        }
        const demoDocId = `QT-2026-${1000 + current.length + 1}`;
        return [
          {
            id: demoDocId,
            documentNumber: demoDocId,
            client: "Northside Studio",
            address: "7 McCauley Drive, Booie",
            issued: "05 Aug 2026",
            expires: "19 Aug 2026",
            validDays: 14,
            status: "Draft",
            discount: 0,
            taxRate: 0,
            ...draft,
          },
          ...current,
        ];
      });
      setDialog(null);
      setActive("quotes");
      showToast(draft.id ? "Draft quote updated." : "Quote saved as draft.");
      return;
    }
    if (!onSaveQuote) {
      setOperationMutationError("Live quote saving is not available.");
      return;
    }
    setOperationMutationPending(true);
    const result = await onSaveQuote({
      ...draft,
      items: draft.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
    });
    setOperationMutationPending(false);
    if (!result.ok) {
      setOperationMutationError(result.message);
      return;
    }
    setQuotes((current) => {
      const exists = current.some((quote) => quote.id === result.quote.id);
      return exists
        ? current.map((quote) =>
            quote.id === result.quote.id ? result.quote : quote,
          )
        : [result.quote, ...current];
    });
    setDialog(null);
    setActive("quotes");
    showToast(draft.id ? "Draft quote updated." : "Quote saved as draft.");
  };

  const persistInvoice = async (draft: InvoiceDraft) => {
    if (dataMode === "demo") {
      const client = clients.find((item) => item.id === draft.clientId);
      const property = client?.properties.find((item) => item.id === draft.propertyId);
      const dueDays = Number(draft.dueDays) || 0;
      const issuedAt = new Date();
      const dueAt = new Date(issuedAt);
      dueAt.setDate(dueAt.getDate() + dueDays);
      const formatDisplay = (value: Date) =>
        new Intl.DateTimeFormat("en-AU", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Australia/Brisbane",
        }).format(value);
      const formatIso = (value: Date) =>
        new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(value);
      setInvoiceRecords((current) => {
        if (draft.id) {
          return current.map((record) =>
            record.id === draft.id
              ? {
                  ...record,
                  clientId: draft.clientId,
                  serviceAddressId: draft.propertyId,
                  extraPropertyIds: draft.extraPropertyIds,
                  jobId: draft.jobId,
                  quoteId: draft.quoteId,
                  client: client?.name || record.client,
                  address: property?.address || record.address,
                  notes: draft.notes,
                  items: draft.items,
                }
              : record,
          );
        }
        const demoDocId = `INV-2026-${2000 + current.length + 1}`;
        return [
          {
            id: demoDocId,
            documentNumber: demoDocId,
            clientId: draft.clientId,
            serviceAddressId: draft.propertyId,
            extraPropertyIds: draft.extraPropertyIds,
            jobId: draft.jobId,
            quoteId: draft.quoteId,
            client: client?.name || "Client",
            address: property?.address || "No billing address",
            issued: formatDisplay(issuedAt),
            due: formatDisplay(dueAt),
            dueDate: formatIso(dueAt),
            documentStatus: "Draft",
            paymentStatus: "Unpaid",
            notes: draft.notes,
            discount: 0,
            taxRate: 0,
            items: draft.items,
          },
          ...current,
        ];
      });
      setDialog(null);
      setActive("invoices");
      showToast(draft.id ? "Draft invoice updated." : "Invoice saved as draft.");
      return;
    }
    if (!onSaveInvoice) {
      setOperationMutationError("Live invoice saving is not available.");
      return;
    }
    setOperationMutationPending(true);
    const result = await onSaveInvoice({
      ...draft,
      dueDays: Number(draft.dueDays),
      items: draft.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
    });
    setOperationMutationPending(false);
    if (!result.ok) {
      setOperationMutationError(result.message);
      return;
    }
    setInvoiceRecords((current) => {
      const exists = current.some((record) => record.id === result.invoice.id);
      return exists
        ? current.map((record) =>
            record.id === result.invoice.id ? result.invoice : record,
          )
        : [result.invoice, ...current];
    });
    setDialog(null);
    setActive("invoices");
    showToast(draft.id ? "Draft invoice updated." : "Invoice saved as draft.");
  };

  const persistScheduledJob = async (draft: {
    jobRequestId: string;
    scheduledStart: string;
    profileIds?: string[];
  }) => {
    if (dataMode === "demo") {
      const request = jobRequests.find((item) => item.id === draft.jobRequestId);
      if (request) {
        const schedule = formatBrisbaneSchedule(draft.scheduledStart);
        const assigned = (draft.profileIds || []).map((id) => {
          const member = teamMembers.find((item) => item.id === id);
          return member?.name || "Team member";
        });
        const job: Job = {
          id: `job-${Date.now()}`,
          displayName: formatJobDisplayName({
            client: request.client,
            address: request.address,
            category: request.category,
            date: schedule.date,
          }),
          client: request.client,
          property: request.address,
          address: request.address,
          category: request.category,
          scope: request.scope,
          date: schedule.date,
          time: schedule.time,
          dateKey: schedule.dateKey,
          clientId: request.clientId,
          serviceAddressId: request.propertyId,
          jobRequestId: request.id,
          status: "scheduled",
          notes: "",
          recurrence: "One-off",
          assigneeIds: draft.profileIds || [],
          assignees: assigned,
          photos: [],
        };
        setJobs((current) => [...current, job]);
        setJobRequests((current) =>
          current.map((item) =>
            item.id === request.id
              ? markRequestScheduled(item, schedule.date)
              : item,
          ),
        );
      }
      setDialog(null);
      showToast("Job scheduled.");
      return;
    }
    if (!onScheduleJob) {
      setOperationMutationError("Live job scheduling is not available.");
      return;
    }
    setOperationMutationPending(true);
      let result;
      try {
        result = await onScheduleJob(draft);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
      setOperationMutationError(result.message);
      return;
    }
    setJobs((current) => [...current, result.job]);
    setJobRequests((current) =>
      current.map((item) =>
        item.id === draft.jobRequestId
          ? markRequestScheduled(
              item,
              formatBrisbaneSchedule(draft.scheduledStart).date,
            )
          : item,
      ),
    );
    setDialog(null);
    showToast("Job scheduled.");
  };

  const finalizeInvoice = async (record: Invoice) => {
    if (dataMode === "live") {
      if (!onFinalizeInvoice) {
        setOperationMutationError("Live invoice finalizing is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onFinalizeInvoice(record.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      setInvoiceRecords((current) =>
        current.map((item) =>
          item.id === record.id ? result.invoice : item,
        ),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: result.invoice }
          : current,
      );
      showToast("Invoice issued.");
      return;
    }
    try {
      const issued = finalizeInvoiceRecord(record);
      setInvoiceRecords((current) =>
        current.map((item) => (item.id === issued.id ? issued : item)),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: issued }
          : current,
      );
      showToast("Invoice issued.");
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The invoice could not be finalized.",
      );
    }
  };

  const markInvoiceSentRecord = async (record: Invoice) => {
    if (dataMode === "live") {
      if (!onMarkInvoiceSent) {
        setOperationMutationError("Live invoice updates are not available.");
        return;
      }
      setOperationMutationError("");
      setOperationMutationPending(true);
      let result;
      try {
        result = await onMarkInvoiceSent(record.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      setInvoiceRecords((current) =>
        current.map((item) => (item.id === record.id ? result.invoice : item)),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: result.invoice }
          : current,
      );
      showToast("Invoice marked sent.");
      return;
    }
    try {
      const sent = markInvoiceSent(record);
      setInvoiceRecords((current) =>
        current.map((item) => (item.id === sent.id ? sent : item)),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: sent }
          : current,
      );
      showToast("Invoice marked sent.");
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The invoice could not be marked sent.",
      );
    }
  };

  const voidIssuedInvoiceRecord = async (record: Invoice) => {
    if (dataMode === "live") {
      if (!onVoidInvoice) {
        setOperationMutationError("Live invoice voiding is not available.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onVoidInvoice(record.id);
      } catch {
        setOperationMutationError("A network error occurred. Please try again.");
        setOperationMutationPending(false);
        return;
      }
      setOperationMutationPending(false);
      if (!result.ok) {
        setOperationMutationError(result.message);
        return;
      }
      setInvoiceRecords((current) =>
        current.map((item) => (item.id === record.id ? result.invoice : item)),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: result.invoice }
          : current,
      );
      showToast("Invoice voided.");
      return;
    }
    try {
      const voided = voidInvoice(record);
      setInvoiceRecords((current) =>
        current.map((item) => (item.id === voided.id ? voided : item)),
      );
      setDialog((current) =>
        current?.type === "invoice-document" && current.record.id === record.id
          ? { ...current, record: voided }
          : current,
      );
      showToast("Invoice voided.");
    } catch (error) {
      setOperationMutationError(
        error instanceof OperationsRuleError
          ? error.message
          : "The invoice could not be voided.",
      );
    }
  };

  const renderView = () => {
    switch (currentRoute) {
      case "clients":
        return (
          <ClientsView
            clients={clients}
            onCreate={() => {
              setClientMutationError("");
              setDialog({ type: "client" });
            }}
            onEdit={(client) => {
              setClientMutationError("");
              setDialog({ type: "client", client });
            }}
            onDelete={(client) => {
              setClientMutationError("");
              setDialog({ type: "delete-client", client });
            }}
            canManage={canManageClients}
            archiveMode={dataMode === "live"}
          />
        );
      case "requests":
        return (
          <RequestsView
            requests={jobRequests}
            onCreate={() => {
              setRequestMutationError("");
              setDialog({ type: "request" });
            }}
            onQuote={(request) =>
              setDialog({
                type: "quote-form",
                prefill: {
                  jobRequestId: request.id,
                  scope: request.scope,
                },
              })
            }
            onEstimate={(request) =>
              setDialog({ type: "estimator", jobRequestId: request.id })
            }
            onDelete={(request) => {
              setRequestMutationError("");
              setDialog({ type: "delete-request", request });
            }}
            canManage={canManageRequests}
          />
        );
      case "questionnaires":
        return (
          <QuestionnairesView
            items={questionnaireItems}
            submissions={questionnaireSubmissions}
            onSend={(questionnaire) =>
              setDialog({
                type: "send-questionnaire",
                questionnaireId: questionnaire?.id,
              })
            }
            onPreview={(questionnaire) =>
              setDialog({ type: "public-questionnaire", questionnaire })
            }
            onOpenSubmission={(submission) =>
              setDialog({ type: "submission", submission })
            }
          />
        );
      case "quotes":
        return (
          <QuotesView
            quotes={quotes}
            invoices={invoiceRecords}
            onNew={() => setDialog({ type: "quote-form" })}
            onView={(quote) => setDialog({ type: "quote-document", quote })}
            onEdit={(quote) =>
              setDialog({
                type: "quote-form",
                prefill: {
                  id: quote.id,
                  jobRequestId: quote.jobRequestId || "",
                  scope: quote.scope,
                  items: quote.items,
                  clientNotes: quote.clientNotes,
                  internalNotes: quote.internalNotes || "",
                },
              })
            }
            onEstimate={() => setDialog({ type: "estimator" })}
            onCreateInvoice={(quote) => setDialog({ type: "invoice-form", quote })}
            onViewInvoice={(record) => setDialog({ type: "invoice-document", record })}
            onDelete={(quote) => setDialog({ type: "delete-quote", quote })}
          />
        );
      case "schedule":
        return (
          <ScheduleView
            jobs={jobs}
            canSchedule={canOperateOffice}
            onSchedule={() => setDialog({ type: "schedule" })}
            onJob={(job) => setDialog({ type: "job", job })}
          />
        );
      case "jobs":
        return (
          <JobBoardView
            jobs={jobs}
            teamMembers={teamMembers}
            currentMemberId={actorId}
            preferMine={isTechnician}
            canDelete={canOperateOffice}
            onJob={(job) => setDialog({ type: "job", job })}
            onMove={moveJob}
            onDelete={(job) => setDialog({ type: "delete-job", job })}
          />
        );
      case "joseph":
        return <JosephView onAskJoseph={onAskJoseph} />;
      case "invoices":
        return (
          <InvoicesView
            records={invoiceRecords}
            pending={operationMutationPending}
            onNew={() => setDialog({ type: "invoice-form" })}
            onView={(record) =>
              setDialog({ type: "invoice-document", record })
            }
            onEdit={(record) =>
              setDialog({ type: "invoice-form", invoice: record })
            }
            onPaymentStatusChange={updateInvoicePaymentStatus}
            onFinalize={finalizeInvoice}
            onMarkSent={markInvoiceSentRecord}
            onVoid={voidIssuedInvoiceRecord}
            onDelete={(record) =>
              setDialog({ type: "delete-invoice", record })
            }
          />
        );
      case "settings":
        return (
          <SettingsView
            profile={businessDetailsState}
            teamMembers={teamMembers}
            invitations={teamInvitations}
            canManage={canManageClients}
            currentEmail={signedInEmail}
            onSaveProfile={async (input) => {
              if (onUpdateBusinessProfile) {
                const result = await onUpdateBusinessProfile(input);
                if (result.ok) {
                  setBusinessDetailsState(result.profile);
                  showToast("Business details saved.");
                }
                return result;
              }
              const profile = { ...businessDetailsState, ...input };
              setBusinessDetailsState(profile);
              showToast("Business details saved.");
              return { ok: true, profile };
            }}
            onInvite={async (input) => {
              if (onInviteTeamMember) {
                const result = await onInviteTeamMember(input);
                if (result.ok) {
                  setTeamInvitations((current) => [
                    {
                      id: result.id,
                      email: result.email,
                      role: result.role,
                      status: "Pending",
                      created: "Today",
                      expires: "in 14 days",
                    },
                    ...current,
                  ]);
                }
                return result;
              }
              const id = crypto.randomUUID();
              const token = `${id.replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`;
              setTeamInvitations((current) => [
                {
                  id,
                  email: input.email,
                  role: input.role,
                  status: "Pending",
                  created: "Today",
                  expires: "in 14 days",
                },
                ...current,
              ]);
              return {
                ok: true,
                id,
                path: `/join/${token}`,
                email: input.email,
                role: input.role,
              };
            }}
            onRevoke={async (id) => {
              if (onRevokeTeamInvite) {
                const result = await onRevokeTeamInvite(id);
                if (result.ok) {
                  setTeamInvitations((current) =>
                    current.filter((invite) => invite.id !== id),
                  );
                }
                return result;
              }
              setTeamInvitations((current) =>
                current.filter((invite) => invite.id !== id),
              );
              return { ok: true, id };
            }}
            onUpdateMember={async (input) => {
              if (onUpdateTeamMember) {
                const result = await onUpdateTeamMember(input);
                if (result.ok) {
                  setTeamMembers((current) =>
                    current.map((member) =>
                      member.id === result.member.id ? result.member : member,
                    ),
                  );
                  showToast("Team member updated.");
                }
                return result;
              }
              const member = teamMembers.find((item) => item.id === input.profileId);
              if (!member) {
                return { ok: false, message: "That team member was not found." };
              }
              const updated = {
                ...member,
                name: input.name || member.name,
                role: input.role || member.role,
                isActive:
                  typeof input.isActive === "boolean"
                    ? input.isActive
                    : member.isActive,
              };
              setTeamMembers((current) =>
                current.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              );
              return { ok: true, member: updated };
            }}
          />
        );
      default:
        return (
          <DashboardView
            jobs={jobs}
            clients={clients}
            jobRequests={jobRequests}
            quotes={quotes}
            invoices={invoiceRecords}
            signedInEmail={signedInEmail}
            currentMemberId={actorId}
            teamMembers={teamMembers}
            canManage={canOperateOffice}
            onNavigate={setActive}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={currentRoute}
        onNavigate={setActive}
        onEstimate={() => setDialog({ type: "estimator" })}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        signedInEmail={signedInEmail}
        onSignOut={onSignOut}
        canManage={canOperateOffice}
      />
      {mobileOpen ? (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div className="app-main">
        <header className="mobile-header">
          <button
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <div>
            <small>Mow & Glow</small>
            <strong>Console</strong>
          </div>
        </header>
        <main className={currentRoute === "joseph" ? "workspace workspace--chat" : "workspace"}>
          {operationMutationError ? (
            <div className="workspace-alert" role="alert">
              <p>{operationMutationError}</p>
              <button
                type="button"
                onClick={() => setOperationMutationError("")}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {renderView()}
        </main>
        <MobileDock
          active={currentRoute}
          menuOpen={mobileOpen}
          canManage={canOperateOffice}
          onNavigate={(route) => {
            setActive(route);
            setMobileOpen(false);
          }}
          onMore={() => setMobileOpen((open) => !open)}
        />
      </div>

      {dialog?.type === "estimator" ? (
        <Dialog
          title="AI Scope & Quote Estimator"
          titleIcon={Sparkles}
          onClose={closeDialog}
        >
          <EstimatorDialog
            requests={jobRequests}
            initialRequestId={dialog.jobRequestId}
            onClose={closeDialog}
            onEstimate={onEstimateJob}
            onUseQuote={(payload) => {
              setDialog({
                type: "quote-form",
                prefill: {
                  jobRequestId: payload.jobRequestId || "",
                  scope: payload.scope,
                  items: payload.items,
                  clientNotes: "Please contact us if you wish to amend any items on this quote.",
                  internalNotes: "",
                },
              });
            }}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "client" ? (
        <Dialog
          title={
            dialog.client &&
            clients.some((client) => client.id === dialog.client?.id)
              ? "Edit Client"
              : "New Client"
          }
          onClose={closeDialog}
          wide
        >
          <ClientFormDialog
            client={dialog.client}
            onClose={closeDialog}
            onSave={persistClient}
            pending={clientMutationPending}
            error={clientMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "delete-client" ? (
        <Dialog
          title={dataMode === "live" ? "Archive client" : "Confirm deletion"}
          onClose={closeDialog}
        >
          <ConfirmDeleteClientDialog
            client={dialog.client}
            onCancel={closeDialog}
            onConfirm={() => removeClient(dialog.client)}
            archiveMode={dataMode === "live"}
            pending={clientMutationPending}
            error={clientMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "delete-request" ? (
        <Dialog title="Delete job request" onClose={closeDialog}>
          <ConfirmRecordDeleteDialog
            label={`request for ${formatSiteTitle(dialog.request)}`}
            kind="job request"
            onCancel={closeDialog}
            onConfirm={() => removeJobRequest(dialog.request)}
            pending={requestMutationPending}
            error={requestMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "delete-quote" ? (
        <Dialog title="Delete quote" onClose={closeDialog}>
          <ConfirmRecordDeleteDialog
            label={dialog.quote.documentNumber || dialog.quote.id}
            kind="quote"
            onCancel={closeDialog}
            onConfirm={() => removeQuote(dialog.quote)}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "delete-job" ? (
        <Dialog title="Delete job" onClose={closeDialog}>
          <ConfirmRecordDeleteDialog
            label={dialog.job.displayName}
            kind="job"
            onCancel={closeDialog}
            onConfirm={() => removeJob(dialog.job)}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "delete-invoice" ? (
        <Dialog title="Delete invoice" onClose={closeDialog}>
          <ConfirmRecordDeleteDialog
            label={dialog.record.documentNumber || dialog.record.id}
            kind="invoice"
            onCancel={closeDialog}
            onConfirm={() => removeInvoice(dialog.record)}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "quote-form" ? (
        <Dialog
          title={dialog.prefill?.id ? "Edit Quote" : "New Quote"}
          onClose={closeDialog}
          wide
        >
          <QuoteFormDialog
            key={dialog.prefill?.id || dialog.prefill?.jobRequestId || "new-quote"}
            requests={jobRequests}
            prefill={dialog.prefill}
            onClose={closeDialog}
            onSave={persistQuote}
            onEstimate={onEstimateJob}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "invoice-form" ? (
        <Dialog
          title={
            dialog.invoice
              ? "Edit Invoice"
              : dialog.quote
                ? "Invoice from quote"
                : "New Invoice"
          }
          onClose={closeDialog}
          wide
        >
          <InvoiceFormDialog
            key={dialog.invoice?.id || dialog.quote?.id || "new-invoice"}
            clients={clients}
            jobs={jobs}
            prefill={
              dialog.invoice
                ? draftInvoiceFromRecord(dialog.invoice)
                : dialog.quote
                  ? draftInvoiceFromQuote(dialog.quote, clients, jobs)
                  : undefined
            }
            sourceQuote={dialog.quote}
            onClose={closeDialog}
            onSave={persistInvoice}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "send-questionnaire" ? (
        <Dialog title="Send Questionnaire" onClose={closeDialog}>
          <SendQuestionnaireDialog
            items={questionnaireItems}
            clients={clients}
            initialQuestionnaireId={dialog.questionnaireId}
            onClose={closeDialog}
            onSend={onSendQuestionnaire}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "public-questionnaire" ? (
        <div className="full-screen-layer">
          <PublicQuestionnairePreview
            questionnaire={dialog.questionnaire}
            onClose={closeDialog}
          />
        </div>
      ) : null}

      {dialog?.type === "schedule" ? (
        <Dialog title="Schedule Job" onClose={closeDialog}>
          <ScheduleFormDialog
            requests={jobRequests}
            jobs={jobs}
            teamMembers={teamMembers}
            onClose={closeDialog}
            onSchedule={persistScheduledJob}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "job" ? (
        <Dialog title={dialog.job.displayName} onClose={closeDialog} wide>
          <JobDetailsDialog
            job={dialog.job}
            jobs={jobs}
            teamMembers={teamMembers}
            canAssign={canOperateOffice}
            canDelete={canOperateOffice}
            onClose={closeDialog}
            onUpdate={updateJob}
            onAssign={(profileIds) => void assignJob(dialog.job, profileIds)}
            onUploadPhoto={(file) => void uploadPhoto(dialog.job, file)}
            onDeletePhoto={(photo) => void removePhoto(dialog.job, photo)}
            onDelete={(job) => setDialog({ type: "delete-job", job })}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "quote-document" ? (
        <Dialog
          title={`Quote ${dialog.quote.documentNumber || dialog.quote.id}`}
          onClose={closeDialog}
          wide
          document
        >
          <DocumentViewDialog
            type="quote"
            record={dialog.quote}
            profile={businessDetailsState}
            onClose={closeDialog}
            onStatusChange={(status) =>
              updateQuoteStatus(dialog.quote.id, status as Quote["status"])
            }
            onCreateInvoice={
              canCreateInvoiceFromQuote(dialog.quote) &&
              !liveInvoiceForQuote(dialog.quote, invoiceRecords)
                ? () => setDialog({ type: "invoice-form", quote: dialog.quote })
                : undefined
            }
            onViewInvoice={
              liveInvoiceForQuote(dialog.quote, invoiceRecords)
                ? () => {
                    const existing = liveInvoiceForQuote(
                      dialog.quote,
                      invoiceRecords,
                    );
                    if (existing) {
                      setDialog({ type: "invoice-document", record: existing });
                    }
                  }
                : undefined
            }
            onEdit={
              dialog.quote.status === "Draft"
                ? () =>
                    setDialog({
                      type: "quote-form",
                      prefill: {
                        id: dialog.quote.id,
                        jobRequestId: dialog.quote.jobRequestId || "",
                        scope: dialog.quote.scope,
                        items: dialog.quote.items,
                        clientNotes: dialog.quote.clientNotes,
                        internalNotes: dialog.quote.internalNotes || "",
                      },
                    })
                : undefined
            }
          />
        </Dialog>
      ) : null}

      {dialog?.type === "invoice-document" ? (
        <Dialog
          title={`Invoice ${dialog.record.documentNumber || dialog.record.id}`}
          onClose={closeDialog}
          wide
          document
        >
          <DocumentViewDialog
            type="invoice"
            record={dialog.record}
            profile={businessDetailsState}
            onClose={closeDialog}
            onStatusChange={(status) =>
              updateInvoicePaymentStatus(
                dialog.record.id,
                status as Invoice["paymentStatus"],
              )
            }
            onFinalize={() => void finalizeInvoice(dialog.record)}
            onMarkSent={() => void markInvoiceSentRecord(dialog.record)}
            onVoid={() => void voidIssuedInvoiceRecord(dialog.record)}
            onEdit={
              dialog.record.documentStatus === "Draft"
                ? () =>
                    setDialog({
                      type: "invoice-form",
                      invoice: dialog.record,
                    })
                : undefined
            }
          />
        </Dialog>
      ) : null}

      {dialog?.type === "request" ? (
        <Dialog title="New Job Request" onClose={closeDialog}>
          <RequestFormDialog
            key={
              dialog.prefill?.questionnaireResponseId ||
              dialog.prefill?.scope ||
              "new-request"
            }
            clients={clients}
            prefill={dialog.prefill}
            onClose={closeDialog}
            onSave={persistJobRequest}
            pending={requestMutationPending}
            error={requestMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "submission" ? (
        <Dialog title="Questionnaire answers" onClose={closeDialog} wide>
          <SubmissionDialog
            submission={dialog.submission}
            questionnaire={questionnaireItems.find(
              (item) => item.id === dialog.submission.questionnaireId,
            ) || questionnaireItems.find((item) => item.title === dialog.submission.questionnaire)}
            clients={clients}
            onClose={closeDialog}
            onAddClient={() =>
              setDialog({
                type: "client",
                client: {
                  id: "",
                  name: dialog.submission.respondent,
                  status: "Lead",
                  phone: dialog.submission.phone || "",
                  email: dialog.submission.email,
                  preferred: "Email",
                  properties: [
                    {
                      name: "Property",
                      address:
                        typeof dialog.submission.answers._site_address === "string"
                          ? dialog.submission.answers._site_address
                          : "",
                      cadence: "One-off",
                    },
                  ],
                  notes: `From questionnaire: ${dialog.submission.questionnaire}`,
                },
                returnTo: {
                  type: "submission",
                  submission: dialog.submission,
                },
              })
            }
            onCreateRequest={() => {
              const matching = clients.find(
                (client) =>
                  Boolean(dialog.submission.email) &&
                  client.email.toLowerCase() ===
                    dialog.submission.email.toLowerCase(),
              );
              const parsed = parseServiceTitle(
                questionnaireItems.find(
                  (item) => item.id === dialog.submission.questionnaireId,
                )?.category || dialog.submission.questionnaire,
              );
              const category = isServiceCategory(parsed.category)
                ? parsed.category
                : "Cleaning Services";
              const questionnaire = questionnaireItems.find(
                (item) => item.id === dialog.submission.questionnaireId,
              );
              const siteAddress =
                typeof dialog.submission.answers._site_address === "string"
                  ? dialog.submission.answers._site_address.trim().toLowerCase()
                  : "";
              const matchedProperty =
                matching?.properties.find(
                  (property) =>
                    siteAddress &&
                    property.address.trim().toLowerCase() === siteAddress,
                ) || matching?.properties[0];
              setDialog({
                type: "request",
                prefill: {
                  clientId: matching?.id || "",
                  propertyId: matchedProperty?.id || "",
                  category,
                  serviceDetail: parsed.detail,
                  scope: formatSubmissionScope(
                    dialog.submission.answers,
                    questionnaire?.fields || [],
                  ) || dialog.submission.questionnaire,
                  questionnaireResponseId: dialog.submission.id,
                },
              });
            }}
          />
        </Dialog>
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <CheckCircle2 aria-hidden="true" size={18} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
