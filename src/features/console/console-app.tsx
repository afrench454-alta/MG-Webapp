"use client";

import { randomId } from "@/lib/random-id";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
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
  CommitClientImportAction,
  PreviewClientImportAction,
  SaveClientAction,
} from "./data/client-contract";
import type {
  DeleteJobRequestAction,
  SaveJobRequestAction,
  SetJobRequestClosedAction,
} from "./data/job-request-contract";
import type {
  AddJobNoteAction,
  DeleteInvoiceAction,
  DeleteJobAction,
  DeleteJobPhotoAction,
  DeleteQuoteAction,
  FinalizeInvoiceAction,
  InvoicePaymentInput,
  VoidInvoiceAction,
  MarkInvoiceSentAction,
  SaveInvoiceAction,
  SaveQuoteAction,
  ReviseQuoteAction,
  ScheduleJobAction,
  ScheduleJobInput,
  UpdateInvoicePaymentAction,
  UpdateJobAction,
  UpdateJobAssignmentsAction,
  UpdateQuoteStatusAction,
  UploadJobPhotoAction,
} from "./data/operations-contract";
import type { SendQuestionnaireAction } from "./data/questionnaire-contract";
import type { EstimateJobAction } from "./data/estimator-contract";
import type { AskJosephAction } from "./data/joseph-contract";
import { asJobRecurrence, buildNextDemoJob, clearJobSchedule, describeJobUpdate, scheduledStartPayload, formatBrisbaneSchedule } from "./data/job-recurrence";
import { parseClientImportText, planClientImport } from "./data/client-import";
import type {
  InviteTeamAction,
  RevokeTeamInviteAction,
  UpdateBusinessProfileAction,
  UpdateTeamMemberAction,
} from "./data/team-contract";

import { Dialog } from "./components/dialog";
import { Button } from "./components/ui-elements";
import { Sidebar } from "./components/sidebar";
import { MobileDock } from "./components/mobile-dock";
import { usePhoneLayout } from "./components/phone-shell";
import { consoleLocation, writeConsoleLocation } from "./data/console-location";
import { DashboardView } from "./views/dashboard-view";
import { ClientsView } from "./views/clients-view";
import { RequestsView } from "./views/requests-view";
import { QuestionnairesView } from "./views/questionnaires-view";
import { QuotesView } from "./views/quotes-view";
import { ScheduleView } from "./views/schedule-view";
import { JobBoardView } from "./views/job-board-view";
import { TodayView } from "./views/today-view";
import { JosephView } from "./views/joseph-view";
import { InvoicesView } from "./views/invoices-view";
import { TopCommandBar } from "./components/top-command-bar";
import { AlertsDrawer } from "./components/alerts-drawer";
import { operationalAlerts } from "./data/operational-alerts";
import { SettingsView } from "./views/settings-view";
import { isLiveInvoice, isLiveQuote } from "./data/list-filters";

import { ClientFormDialog } from "./dialogs/client-form-dialog";
import { QuoteFormDialog, type QuoteDraft } from "./dialogs/quote-form-dialog";
import { InvoiceFormDialog, invoiceDraftActionInput, type InvoiceDraft } from "./dialogs/invoice-form-dialog";
import { InvoicePaymentDialog } from "./dialogs/invoice-payment-dialog";
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
  applyInvoicePaymentEntry,
  finalizeInvoiceRecord,
  markInvoiceSent,
  voidInvoice,
} from "./data/invoice-lifecycle";
import { resolveDemoInlineClient } from "./data/inline-client";
import { demoWorkCustomer } from "./data/demo-work";
import {
  canCreateInvoiceFromQuote,
  draftInvoiceFromJob,
  draftInvoiceFromQuote,
  draftInvoiceFromRecord,
  draftInvoiceFromRequest,
  draftReplacementInvoice,
  invoiceConflict,
  jobForQuote,
  liveInvoiceForQuote,
} from "./data/quote-invoice";
import { formatServiceTitle, isServiceCategory, parseServiceTitle } from "./data/service-catalog";
import { brisbaneDateKey, formatJobDisplayName, formatSiteTitle, formatSubmissionScope } from "./data/work-identity";

export type DialogState =
  | { type: "estimator"; jobRequestId?: string }
  | { type: "client"; client?: Client; returnTo?: DialogState }
  | { type: "delete-client"; client: Client }
  | { type: "delete-request"; request: JobRequest }
  | { type: "close-request"; request: JobRequest }
  | { type: "request-visits"; request: JobRequest }
  | { type: "delete-quote"; quote: Quote }
  | { type: "delete-job"; job: Job }
  | { type: "delete-invoice"; record: Invoice }
  | { type: "quote-form"; prefill?: Partial<QuoteDraft> }
  | { type: "invoice-form"; quote?: Quote; invoice?: Invoice; job?: Job; request?: JobRequest; replacement?: Invoice }
  | { type: "invoice-payment"; record: Invoice }
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
  sessionDemo?: "populated" | "field";
  dataLoadError?: string;
  signedInEmail?: string;
  actorId?: string;
  actorRole?: "owner" | "co_owner" | "technician";
  canManageClients?: boolean;
  canManageRequests?: boolean;
  onSaveClient?: SaveClientAction;
  onArchiveClient?: ArchiveClientAction;
  onPreviewClientImport?: PreviewClientImportAction;
  onCommitClientImport?: CommitClientImportAction;
  onSaveJobRequest?: SaveJobRequestAction;
  onSetJobRequestClosed?: SetJobRequestClosedAction;
  onDeleteJobRequest?: DeleteJobRequestAction;
  onSaveQuote?: SaveQuoteAction;
  onReviseQuote?: ReviseQuoteAction;
  onUpdateQuoteStatus?: UpdateQuoteStatusAction;
  onDeleteQuote?: DeleteQuoteAction;
  onScheduleJob?: ScheduleJobAction;
  onUpdateJob?: UpdateJobAction;
  onAddJobNote?: AddJobNoteAction;
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
  sessionDemo,
  dataLoadError,
  signedInEmail = "ops@fieldcentral.local",
  actorId,
  actorRole = "owner",
  canManageClients = true,
  canManageRequests = true,
  onSaveClient,
  onArchiveClient,
  onPreviewClientImport,
  onCommitClientImport,
  onSaveJobRequest,
  onSetJobRequestClosed,
  onDeleteJobRequest,
  onSaveQuote,
  onReviseQuote,
  onUpdateQuoteStatus,
  onDeleteQuote,
  onScheduleJob,
  onUpdateJob,
  onAddJobNote,
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
  const phoneLayout = usePhoneLayout();
  const [active, setActiveView] = useState<ConsoleRoute | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(undefined);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [demoLoaded, setDemoLoaded] = useState(!sessionDemo);
  const draftDirty = useRef(false);
  const currentLocation = useRef("");
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
    active && (canOperateOffice || !officeRoutes.includes(active))
      ? active
      : phoneLayout ? "today" : "dashboard";
  const demoKey = sessionDemo ? `mow-glow-demo-v1:${sessionDemo}:${brisbaneDateKey()}` : "";
  const guardedDraft = Boolean(dialog && ["client", "request", "quote-form", "invoice-form", "invoice-payment", "schedule"].includes(dialog.type));

  const restoreDemo = useEffectEvent(() => {
    try {
      const stored = window.sessionStorage.getItem(demoKey);
      if (stored) {
        const value = JSON.parse(stored) as { clients: Client[]; jobs: Job[]; requests: JobRequest[]; quotes: Quote[]; invoices: Invoice[] };
        setClients(value.clients);
        setJobs(value.jobs);
        setJobRequests(value.requests);
        setQuotes(value.quotes);
        setInvoiceRecords(value.invoices);
      }
    } catch {
      // Use the supplied fixture when browser storage is unavailable.
    }
    setDemoLoaded(true);
  });

  useEffect(() => {
    if (demoKey) queueMicrotask(() => restoreDemo());
  }, [demoKey]);

  useEffect(() => {
    if (!demoKey || !demoLoaded) return;
    try {
      window.sessionStorage.setItem(demoKey, JSON.stringify({
        clients, requests: jobRequests, jobs, quotes, invoices: invoiceRecords,
      }));
    } catch {
      // Keep the current demo visit usable without browser storage.
    }
  }, [clients, demoKey, demoLoaded, invoiceRecords, jobRequests, jobs, quotes]);

  useEffect(() => {
    draftDirty.current = false;
  }, [dialog?.type]);

  const setActive = (route: ConsoleRoute) => {
    setActiveView(route);
    setDialog(null);
    writeConsoleLocation(route);
  };

  const openRecord = (route: ConsoleRoute, id: string, details?: DialogState) => {
    setActiveView(route);
    if (details) setDialog(details);
    writeConsoleLocation(route, id);
  };

  const restoreLocation = useEffectEvent(() => {
    if (guardedDraft && draftDirty.current && !window.confirm("Discard your unsaved changes?")) {
      if (currentLocation.current) window.history.pushState(null, "", currentLocation.current);
      return;
    }
    currentLocation.current = window.location.href;
    const { view, record } = consoleLocation(new URLSearchParams(window.location.search));
    setActiveView(view);
    setDialog(null);
    if (!view || !record || (!canOperateOffice && officeRoutes.includes(view))) return;
    if (view === "jobs" || view === "today" || view === "schedule") {
      const job = jobs.find((candidate) => candidate.id === record);
      if (job) setDialog({ type: "job", job });
    } else if (view === "clients") {
      const client = clients.find((candidate) => candidate.id === record);
      if (client) setSelectedClientId(client.id);
    } else if (view === "quotes") {
      const quote = quotes.find((candidate) => candidate.id === record);
      if (quote) setDialog({ type: "quote-document", quote });
    } else if (view === "invoices") {
      const invoice = invoiceRecords.find((candidate) => candidate.id === record);
      if (invoice) setDialog({ type: "invoice-document", record: invoice });
    } else if (view === "questionnaires") {
      const submission = questionnaireSubmissions.find((candidate) => candidate.id === record);
      if (submission) setDialog({ type: "submission", submission });
    }
  });

  useEffect(() => {
    if (!demoLoaded) return;
    const onPopState = () => restoreLocation();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftDirty.current) event.preventDefault();
    };
    const timer = window.setTimeout(onPopState, 0);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [demoLoaded]);

  useEffect(() => {
    if (dataMode !== "demo") return;
    const params = new URLSearchParams(window.location.search);
    if (consoleLocation(params).view) return;
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
      setActiveView(nextRoute);
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
    if (guardedDraft && draftDirty.current && !window.confirm("Discard your unsaved changes?")) return;
    draftDirty.current = false;
    setDialog(null);
    if (consoleLocation(new URLSearchParams(window.location.search)).record) {
      writeConsoleLocation(currentRoute, undefined, true);
      currentLocation.current = window.location.href;
    }
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
      upsertClient({ ...saved, properties: saved.properties.map((site) => ({ ...site, id: site.id || randomId() })) });
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

    let selectedClient = clients.find(
      (client) => client.id === draft.clientId,
    );
    let selectedProperty = selectedClient?.properties.find(
      (property, index) =>
        (property.id || `${draft.clientId}-property-${index}`) ===
        draft.propertyId,
    );

    if (dataMode === "demo") {
      if (draft.inlineClient) {
        try {
          const resolved = resolveDemoInlineClient(draft.inlineClient, clients);
          selectedClient = resolved.client;
          selectedProperty = resolved.property;
        } catch (error) {
          setRequestMutationError(error instanceof Error ? error.message : "Could not add the client.");
          return;
        }
      }
      if (!selectedClient || !selectedProperty) {
        setRequestMutationError("Choose a client and service address.");
        return;
      }
      const createdId = randomId();
      if (draft.inlineClient) upsertClient(selectedClient);
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
          created: brisbaneDateKey(),
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
      if (result.client) upsertClient(result.client);
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

  const setRequestClosed = async (request: JobRequest, closed: boolean) => {
    setRequestMutationError("");
    if (!canManageRequests) return;
    if (dataMode === "live" && !onSetJobRequestClosed) {
      setRequestMutationError("Live request updates are unavailable.");
      return;
    }
    try {
      setRequestMutationPending(true);
      if (dataMode === "live" && onSetJobRequestClosed) {
        const result = await onSetJobRequestClosed({ id: request.id, closed });
        if (!result.ok) {
          setRequestMutationError(result.message);
          return;
        }
        setJobRequests((current) => current.map((item) => item.id === request.id ? result.request : item));
      } else if (closed && request.status !== "Closed" && request.status !== "Rejected") {
        const previousStatus = request.status;
        setJobRequests((current) => current.map((item) => item.id === request.id ? {
          ...item, status: "Closed", previousStatus,
        } : item));
      } else if (!closed && request.status === "Closed") {
        const stage = request.previousStatus ?? (jobs.some((job) => job.jobRequestId === request.id && job.status === "scheduled") ? "Scheduled" : "Qualified");
        setJobRequests((current) => current.map((item) => item.id === request.id ? {
          ...item, status: stage, previousStatus: null,
        } : item));
      }
      setDialog(null);
      showToast(closed ? "Job request closed." : "Job request reopened.");
    } catch {
      setRequestMutationError("The request could not be updated. Try again.");
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
    let changedJob: Job | undefined;
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
      changedJob = result.job;
    }
    setQuotes((current) => current.filter((item) => item.id !== quote.id));
    setJobs((current) => current.map((job) => changedJob?.id === job.id
      ? changedJob : job.quoteId === quote.id ? { ...job, quoteId: null } : job));
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
        updatedAt: previous?.updatedAt,
        status: updated.status,
        notes: updated.notes,
        recurrence: asJobRecurrence(updated.recurrence),
        scheduledStart: previous?.dateKey !== updated.dateKey ? scheduledStartPayload(updated) : undefined,
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
      setDialog((current) => current?.type === "job" && current.job.id === updated.id ? { type: "job", job: updated } : current);
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
      ? buildNextDemoJob(updated, randomId())
      : null;
    setJobs((current) => {
      const replaced = current.map((job) => (job.id === updated.id ? updated : job));
      if (nextJob && !replaced.some((job) => job.id === nextJob.id)) {
        return [...replaced, nextJob];
      }
      return replaced;
    });
    setDialog((current) => current?.type === "job" && current.job.id === updated.id ? { type: "job", job: updated } : current);
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
        id: randomId(),
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
    if (!target || operationMutationPending || target.status === status ||
      target.status === "completed" || target.status === "cancelled") return;
    if (status === "unscheduled") {
      void updateJob(clearJobSchedule({ ...target, status: "unscheduled" }));
      return;
    }
    if (status === "scheduled" && !target.dateKey) {
      openRecord(currentRoute, target.id, { type: "job", job: target });
      return;
    }
    void updateJob({ ...target, status });
  };

  const addJobNote = async (job: Job, noteId: string, body: string) => {
    setOperationMutationError("");
    try {
      setOperationMutationPending(true);
      let updated = job;
      if (dataMode === "live") {
        if (!onAddJobNote) throw new Error("Live job notes are unavailable.");
        const result = await onAddJobNote({ jobId: job.id, noteId, body });
        if (!result.ok) throw new Error(result.message);
        updated = result.job;
      } else if (!job.fieldNotes?.some((note) => note.id === noteId)) {
        updated = { ...job, fieldNotes: [...job.fieldNotes ?? [], {
          id: noteId, body, author: teamMembers.find((member) => member.id === actorId)?.name || "Operator",
          created: brisbaneDateKey(),
        }] };
      }
      setJobs((current) => current.map((item) => item.id === job.id ? updated : item));
      setDialog({ type: "job", job: updated });
      showToast("Note saved.");
      return true;
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "The note could not be saved.");
      return false;
    } finally {
      setOperationMutationPending(false);
    }
  };

  const quoteJobAction = (job: Job) => {
    if (!canOperateOffice) return;
    const quote = quotes.find((item) => item.id === job.quoteId);
    if (quote) return {
      label: "View quote",
      run: () => openRecord("quotes", quote.id, { type: "quote-document", quote }),
    };
    if (job.status === "cancelled") return;
    if (!job.jobRequestId && (!job.clientId || invoiceRecords.some((invoice) => invoice.jobId === job.id))) return;
    return {
      label: "Create quote",
      run: () => setDialog({ type: "quote-form", prefill: {
        directJobId: job.jobRequestId ? undefined : job.id,
        jobRequestId: job.jobRequestId ?? undefined,
        clientId: job.jobRequestId ? undefined : job.clientId,
        propertyId: job.jobRequestId ? undefined : job.serviceAddressId ?? undefined,
        scope: job.scope,
      } }),
    };
  };

  const viewInvoice = (record: Invoice) => openRecord("invoices", record.id, { type: "invoice-document", record });
  const findInvoiceForJob = (job: Job) => invoiceConflict({
    jobId: job.id, requestId: job.jobRequestId ?? undefined, quoteId: job.quoteId ?? undefined,
  }, invoiceRecords);
  const invoiceJob = (job: Job) => {
    if (!canOperateOffice || job.status !== "completed") return;
    const existing = findInvoiceForJob(job);
    if (existing) viewInvoice(existing);
    else setDialog({ type: "invoice-form", job });
  };

  const requestInvoiceAction = (request: JobRequest) => {
    if (request.status === "Rejected") return;
    const existing = invoiceRecords.find((record) =>
      record.documentStatus !== "Void" && !record.jobId && record.requestId === request.id);
    if (existing) return { label: "View invoice", run: () => viewInvoice(existing) };
    const visits = jobs.filter((job) => job.jobRequestId === request.id && job.status !== "cancelled");
    if (visits.length) return {
      label: "View visits", run: () => setDialog({ type: "request-visits", request }),
    };
    return { label: "Create invoice", run: () => setDialog({ type: "invoice-form", request }) };
  };

  const updateQuoteStatus = async (quote: Quote, status: Quote["status"]) => {
    const quoteId = quote.id;
    if (dataMode === "live") {
      if (!onUpdateQuoteStatus) {
        setOperationMutationError("Live quote updates are not available.");
        return;
      }
      if (!quote.updatedAt) {
        setOperationMutationError("Reload the page and review the quote before changing its status.");
        return;
      }
      setOperationMutationPending(true);
      let result;
      try {
        result = await onUpdateQuoteStatus({ id: quoteId, status, expectedUpdatedAt: quote.updatedAt });
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

  const persistInvoicePayment = async (input: InvoicePaymentInput) => {
    setOperationMutationError("");
    const invoice = invoiceRecords.find((record) => record.id === input.invoiceId);
    if (!canOperateOffice || !invoice || operationMutationPending) return;
    try {
      setOperationMutationPending(true);
      let saved: Invoice;
      if (dataMode === "live") {
        if (!onUpdateInvoicePayment) throw new Error("Live payment recording is unavailable.");
        const result = await onUpdateInvoicePayment(input);
        if (!result.ok) throw new Error(result.message);
        saved = result.invoice;
      } else {
        saved = applyInvoicePaymentEntry(invoice, input);
      }
      setInvoiceRecords((current) => current.map((record) => record.id === saved.id ? saved : record));
      setDialog({ type: "invoice-document", record: saved });
      showToast(input.kind === "receipt" ? "Payment recorded." : "Payment correction recorded.");
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "The payment could not be saved. Try again.");
    } finally {
      setOperationMutationPending(false);
    }
  };
  const persistQuote = async (draft: QuoteDraft) => {
    setOperationMutationError("");
    if (operationMutationPending) return;
    try {
      setOperationMutationPending(true);
      let quote: Quote;
      let changedJob: Job | undefined;
      if (dataMode === "demo") {
        const job = draft.directJobId ? jobs.find((item) => item.id === draft.directJobId) : undefined;
        if (draft.directJobId && (!job || job.jobRequestId || job.status === "cancelled" || job.quoteId)) {
          throw new Error("Choose an available direct job without a quote.");
        }
        if (job && invoiceRecords.some((invoice) => invoice.jobId === job.id)) {
          throw new Error("This job already has invoice history.");
        }
        const source = job ? { clientId: job.clientId, propertyId: job.serviceAddressId ?? undefined } : draft;
        const { request, client, property, createdClient } = demoWorkCustomer(source, clients, jobRequests);
        if (!client) throw new Error("Choose a client or job request.");
        const stored = quotes.find((record) => record.id === draft.id);
        if (draft.id && stored?.status !== "Draft") throw new Error("Only draft quotes can be edited.");
        const issueDate = draft.issueDate ?? brisbaneDateKey();
        const validUntil = draft.validUntil;
        const id = draft.id ?? randomId();
        quote = {
          ...stored, ...draft, id, documentNumber: stored?.documentNumber,
          clientId: client.id, client: client.name, address: property?.address ?? "",
          serviceAddressId: property?.id, jobRequestId: request?.id,
          status: "Draft", issueDate, validUntil,
          issued: issueDate, expires: validUntil ?? "", validDays: validUntil
            ? Math.round((Date.parse(validUntil) - Date.parse(issueDate)) / 86_400_000) : 0,
          updatedAt: new Date().toISOString(),
        };
        if (createdClient) upsertClient(createdClient);
        if (job) changedJob = { ...job, quoteId: quote.id };
      } else {
        if (!onSaveQuote) throw new Error("Live quote saving is unavailable.");
        const result = await onSaveQuote({
          ...draft,
          items: draft.items.map((item) => ({ ...item, quantity: Number(item.quantity), rate: Number(item.rate) })),
        });
        if (!result.ok) throw new Error(result.message);
        if (result.client) upsertClient(result.client);
        quote = result.quote;
        changedJob = result.job;
      }
      setQuotes((current) => [quote, ...current.filter((item) => item.id !== quote.id)]);
      if (changedJob) {
        const linked = changedJob;
        setJobs((current) => current.map((job) => job.id === linked.id ? linked : job));
      }
      setActive("quotes");
      showToast(draft.id ? "Draft quote updated." : "Quote saved as draft.");
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "The quote could not be saved.");
    } finally {
      setOperationMutationPending(false);
    }
  };

  const reviseQuote = async (quote: Quote) => {
    setOperationMutationError("");
    try {
      setOperationMutationPending(true);
      let revision: Quote;
      if (dataMode === "live") {
        if (!onReviseQuote) throw new Error("Live quote revisions are unavailable.");
        const result = await onReviseQuote(quote.id);
        if (!result.ok) throw new Error(result.message);
        revision = result.quote;
      } else {
        revision = {
          ...quote, id: randomId(), documentNumber: undefined, status: "Draft",
          revisionOfQuoteId: quote.id, issuerSnapshot: undefined, updatedAt: new Date().toISOString(),
        };
      }
      setQuotes((current) => [revision, ...current.filter((item) => item.id !== revision.id)]);
      openRecord("quotes", revision.id, { type: "quote-document", quote: revision });
      showToast("Quote revision saved as a draft.");
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "Could not create a revision.");
    } finally {
      setOperationMutationPending(false);
    }
  };
  const persistInvoice = async (draft: InvoiceDraft) => {
    setOperationMutationError("");
    if (!canOperateOffice || operationMutationPending) return;
    try {
      setOperationMutationPending(true);
      let saved: Invoice;
      if (dataMode === "demo") {
        const prior = invoiceRecords.find((record) => record.id === draft.id);
        const existing = invoiceConflict(draft, invoiceRecords);
        if (existing) {
          viewInvoice(existing);
          return;
        }
        if (draft.id && (!prior || prior.documentStatus !== "Draft" || (prior.draftVersion ?? 1) !== draft.expectedVersion)) {
          throw new Error("This draft has changed. Open the latest version before editing.");
        }
        if (draft.requestId && !draft.jobId && !draft.quoteId &&
          jobs.some((job) => job.jobRequestId === draft.requestId && job.status !== "cancelled")) {
          throw new Error("Choose a completed visit from the request.");
        }
        const { client, property, createdClient } = demoWorkCustomer(draft, clients, jobRequests);
        if (!client) throw new Error("Choose a client or add a new one.");
        const extraProperties = client.properties.filter((item) => item.id && draft.extraPropertyIds?.includes(item.id));
        const date = draft.issueDate ?? brisbaneDateKey();
        const id = prior?.id ?? randomId();
        saved = {
          ...prior,
          id, documentNumber: prior?.documentNumber, clientId: client.id,
          serviceAddressId: property?.id, extraPropertyIds: draft.extraPropertyIds,
          jobId: draft.jobId, quoteId: draft.quoteId, requestId: draft.requestId,
          client: client.name, address: property?.address ?? "",
          issued: date, issueDate: date, due: draft.dueDate ?? "", dueDate: draft.dueDate || null,
          serviceDate: draft.serviceDate, draftVersion: (prior?.draftVersion ?? (prior ? 1 : 0)) + 1,
          documentStatus: "Draft", paymentStatus: "Unpaid",
          notes: draft.notes, internalNotes: draft.internalNotes, terms: draft.terms,
          paymentInstructions: draft.paymentInstructions, billingName: draft.billingName, billingAddress: draft.billingAddress,
          recipientName: draft.recipientName, recipientEmail: draft.recipientEmail, reference: draft.reference,
          scope: draft.scope?.split("\n").filter(Boolean), items: draft.items,
          serviceAddresses: [property, ...extraProperties].flatMap((site) => site ? [site.address] : []),
          replacesInvoiceId: draft.replacesInvoiceId ?? prior?.replacesInvoiceId,
          correctionReason: draft.correctionReason ?? prior?.correctionReason,
        };
        if (createdClient) upsertClient(createdClient);
      } else {
        if (!onSaveInvoice) throw new Error("Live invoice saving is unavailable.");
        const result = await onSaveInvoice(invoiceDraftActionInput(draft));
        if (!result.ok) throw new Error(result.message);
        if (result.client) upsertClient(result.client);
        saved = result.invoice;
      }
      setInvoiceRecords((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
      setActive("invoices");
      showToast(draft.id ? "Draft invoice updated." : "Invoice saved as draft.");
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "The invoice could not be saved.");
    } finally {
      setOperationMutationPending(false);
    }
  };
  const persistScheduledJob = async (draft: ScheduleJobInput) => {
    setOperationMutationError("");
    if (operationMutationPending) return;
    try {
      setOperationMutationPending(true);
      let job: Job;
      if (dataMode === "demo") {
        const { request, client, property, createdClient } = demoWorkCustomer(draft, clients, jobRequests);
        const category = request?.category ?? draft.category;
        if (!client || !property || !category) throw new Error("Choose a client, service address and service.");
        const schedule = formatBrisbaneSchedule(draft.scheduledStart);
        job = {
          id: randomId(),
          displayName: formatJobDisplayName({ client: client.name, address: property.address, category, date: schedule.date }),
          client: client.name, property: property.name, address: property.address, category,
          scope: request?.scope ?? draft.scope ?? "", ...schedule,
          clientId: client.id, serviceAddressId: property.id, jobRequestId: request?.id,
          status: "scheduled", notes: "", recurrence: "One-off", photos: [],
          assigneeIds: draft.profileIds ?? [],
          assignees: teamMembers.filter((member) => draft.profileIds?.includes(member.id)).map((member) => member.name),
        };
        if (createdClient) upsertClient(createdClient);
      } else {
        if (!onScheduleJob) throw new Error("Live job scheduling is unavailable.");
        const result = await onScheduleJob(draft);
        if (!result.ok) throw new Error(result.message);
        if (result.client) upsertClient(result.client);
        job = result.job;
      }
      setJobs((current) => [...current.filter((item) => item.id !== job.id), job]);
      if (draft.jobRequestId) {
        setJobRequests((current) => current.map((item) => item.id === draft.jobRequestId
          ? markRequestScheduled(item, job.date) : item));
      }
      setDialog(null);
      showToast("Job scheduled.");
    } catch (error) {
      setOperationMutationError(error instanceof Error ? error.message : "The job could not be scheduled.");
    } finally {
      setOperationMutationPending(false);
    }
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
        result = await onFinalizeInvoice(record.id, record.draftVersion ?? 1);
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
      const issued = finalizeInvoiceRecord(record, businessDetailsState);
      const original = invoiceRecords.find((item) => item.id === issued.replacesInvoiceId);
      if (issued.replacesInvoiceId && !original) throw new OperationsRuleError("The original invoice is unavailable.");
      const retired = original ? voidInvoice(original) : undefined;
      setInvoiceRecords((current) =>
        current.map((item) => item.id === issued.id ? issued : item.id === retired?.id ? retired : item),
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
      case "today":
        return (
          <TodayView
            jobs={jobs}
            canManage={canOperateOffice}
            currentMemberId={actorId}
            onJob={(job) => openRecord("today", job.id, { type: "job", job })}
            onMove={moveJob}
            onDraftInvoiceForJob={canOperateOffice ? invoiceJob : undefined}
            onSchedule={canOperateOffice ? () => setDialog({ type: "schedule" }) : undefined}
            onAllJobs={() => setActive("jobs")}
          />
        );
      case "clients":
        return (
          <ClientsView
            clients={clients}
            jobs={jobs}
            jobRequests={jobRequests}
            quotes={quotes}
            invoices={invoiceRecords}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
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
            onNewRequestForClient={(client) => {
              setRequestMutationError("");
              setDialog({
                type: "request",
                prefill: {
                  clientId: client.id,
                  propertyId: client.properties[0]?.id || "",
                  category: "Yard Services",
                  serviceDetail: "",
                  scope: "",
                },
              });
            }}
            onNewQuoteForClient={(client) => {
              const matchingReq = jobRequests.find(
                (req) =>
                  req.clientId === client.id ||
                  req.client.toLowerCase() === client.name.toLowerCase(),
              );
              setDialog({
                type: "quote-form",
                prefill: {
                  jobRequestId: matchingReq?.id || "",
                  scope: matchingReq?.scope || "",
                },
              });
            }}
            onOpenJob={(job) => setDialog({ type: "job", job })}
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
            onSetClosed={(request, closed) => {
              if (closed) {
                setRequestMutationError("");
                setDialog({ type: "close-request", request });
              } else void setRequestClosed(request, false);
            }}
            stageError={requestMutationError}
            invoiceAction={canOperateOffice ? requestInvoiceAction : undefined}
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
            jobs={jobs}
            invoices={invoiceRecords}
            onNew={() => setDialog({ type: "quote-form" })}
            onView={(quote) => openRecord("quotes", quote.id, { type: "quote-document", quote })}
            onEdit={(quote) =>
              setDialog({
                type: "quote-form",
                prefill: {
                  id: quote.id,
                  jobRequestId: quote.jobRequestId ?? undefined,
                  clientId: quote.jobRequestId ? undefined : quote.clientId,
                  propertyId: quote.jobRequestId ? undefined : quote.serviceAddressId ?? undefined,
                  issueDate: quote.issueDate,
                  validUntil: quote.validUntil,
                  updatedAt: quote.updatedAt,
                  reference: quote.reference,
                  terms: quote.terms,
                  scope: quote.scope,
                  items: quote.items,
                  clientNotes: quote.clientNotes,
                  internalNotes: quote.internalNotes || "",
                },
              })
            }
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
            onJob={(job) => openRecord("schedule", job.id, { type: "job", job })}
          />
        );
      case "jobs":
        return (
          <JobBoardView
            jobs={jobs}
            teamMembers={teamMembers}
            currentMemberId={actorId}
            preferMine={isTechnician}
            canManage={canOperateOffice}
            phone={phoneLayout}
            invoices={canOperateOffice ? invoiceRecords : []}
            onJob={(job) => openRecord("jobs", job.id, { type: "job", job })}
            onMove={moveJob}
            onDraftInvoiceForJob={canOperateOffice ? invoiceJob : undefined}
            onViewInvoiceForJob={canOperateOffice ? invoiceJob : undefined}
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
            onView={viewInvoice}
            onEdit={(record) =>
              setDialog({ type: "invoice-form", invoice: record })
            }
            onRecordPayment={(record) => setDialog({ type: "invoice-payment", record })}
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
              const id = randomId();
              const token = `${id.replace(/-/g, "")}${randomId().replace(/-/g, "")}`;
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
            onPreviewClientImport={async (input) => {
              if (onPreviewClientImport) return onPreviewClientImport(input);
              const extracted = parseClientImportText(input.jsonText);
              if (!extracted.ok) return extracted;
              return { ok: true, plan: planClientImport(extracted.records, clients) };
            }}
            onCommitClientImport={async (input) => {
              if (onCommitClientImport) {
                const imported = await onCommitClientImport(input);
                if (imported.ok && imported.created.length) {
                  setClients((current) => [...imported.created, ...current]);
                  showToast(
                    `Imported ${imported.created.length} client${imported.created.length === 1 ? "" : "s"}.`,
                  );
                }
                return imported;
              }
              const extracted = parseClientImportText(input.jsonText);
              if (!extracted.ok) return extracted;
              const plan = planClientImport(extracted.records, clients);
              const created = plan.rows.flatMap((row) => {
                if (row.decision !== "create" || !row.payload) return [];
                const payload = row.payload;
                return [
                  {
                    id: `client-${Date.now()}-${row.index}`,
                    name: payload.name,
                    status: payload.status,
                    phone: payload.phone,
                    email: payload.email,
                    preferred: payload.preferred,
                    properties: payload.properties,
                    notes: payload.notes,
                  },
                ];
              });
              if (created.length) {
                setClients((current) => [...created, ...current]);
                showToast(
                  `Imported ${created.length} client${created.length === 1 ? "" : "s"}.`,
                );
              }
              return { ok: true, created, skipped: plan.skipCount, failed: [] };
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
            submissions={questionnaireSubmissions}
            signedInEmail={signedInEmail}
            currentMemberId={actorId}
            teamMembers={teamMembers}
            canManage={canOperateOffice}
            onNavigate={setActive}
            onOpenJob={(job) => setDialog({ type: "job", job })}
            onOpenQuote={(quote) => setDialog({ type: "quote-document", quote })}
            onOpenInvoice={(record) =>
              setDialog({ type: "invoice-document", record })
            }
            onScheduleJob={() => setDialog({ type: "schedule" })}
            onNewQuote={() => setDialog({ type: "quote-form" })}
            onNewInvoice={() => setDialog({ type: "invoice-form" })}
            onOpenEstimator={() => setDialog({ type: "estimator" })}
          />
        );
    }
  };

  const openRequestsCount = jobRequests.filter(
    (req) => !["Closed", "Rejected"].includes(req.status),
  ).length;
  const activeJobsCount = jobs.filter(
    (job) => job.status !== "completed" && job.status !== "cancelled",
  ).length;
  const liveQuotesList = quotes.filter(isLiveQuote);
  const liveInvoicesList = invoiceRecords.filter(isLiveInvoice);
  const alerts = operationalAlerts({
    canManage: canOperateOffice, actorId, jobs, requests: jobRequests, quotes,
    invoices: invoiceRecords, submissions: questionnaireSubmissions,
  });


  return (
    <div className="app-shell" onChangeCapture={() => {
      if (guardedDraft) { draftDirty.current = true; currentLocation.current = window.location.href; }
    }}>
      {dataLoadError ? (
        <div className="mx-4 mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {dataLoadError}
        </div>
      ) : null}
      <Sidebar
        active={currentRoute}
        onNavigate={setActive}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        signedInEmail={signedInEmail}
        onSignOut={onSignOut}
        canManage={canOperateOffice}
        counts={{
          clients: clients.length,
          requests: openRequestsCount,
          questionnaires: questionnaireSubmissions.filter(
            (sub) => !sub.jobRequestId,
          ).length,
          quotes: liveQuotesList.filter((q) =>
            ["Draft", "Sent"].includes(q.status),
          ).length,
          schedule: jobs.filter((j) => j.status === "scheduled").length,
          jobs: activeJobsCount,
          invoices: liveInvoicesList.filter(
            (inv) =>
              inv.paymentStatus !== "Paid" && inv.paymentStatus !== "Refunded",
          ).length,
        }}
      />
      {mobileOpen ? (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div className={phoneLayout ? "app-main app-main--field" : "app-main"}>
        <TopCommandBar
          businessDetails={businessDetailsState}
          clients={clients}
          jobs={jobs}
          jobRequests={jobRequests}
          quotes={quotes}
          invoices={invoiceRecords}
          alertCount={alerts.filter((item) => item.urgent).length}
          alertsOpen={alertsOpen}
          canManage={canOperateOffice}
          onOpenMobileNav={() => setMobileOpen(true)}
          onToggleAlerts={() => setAlertsOpen((open) => !open)}
          onNavigate={setActive}
          onSelectClient={(client) => {
            setSelectedClientId(client.id);
            openRecord("clients", client.id);
          }}
          onSelectJob={(job) => openRecord("jobs", job.id, { type: "job", job })}
          onSelectQuote={(quote) => openRecord("quotes", quote.id, { type: "quote-document", quote })}
          onSelectInvoice={(record) =>
            openRecord("invoices", record.id, { type: "invoice-document", record })
          }
          onNewClient={() => {
            setClientMutationError("");
            setDialog({ type: "client" });
          }}
          onNewRequest={() => {
            setRequestMutationError("");
            setDialog({ type: "request" });
          }}
          onNewQuote={() => setDialog({ type: "quote-form" })}
          onNewInvoice={() => setDialog({ type: "invoice-form" })}
          onScheduleJob={() => setDialog({ type: "schedule" })}
        />
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
          onNavigate={(route) => {
            setActive(route);
            setMobileOpen(false);
          }}
          onMore={() => setMobileOpen((open) => !open)}
        />
      </div>

      <AlertsDrawer
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        items={alerts}
        onOpen={({ target }) => {
          setAlertsOpen(false);
          switch (target.type) {
            case "job": openRecord("jobs", target.record.id, { type: "job", job: target.record }); break;
            case "invoice": openRecord("invoices", target.record.id, { type: "invoice-document", record: target.record }); break;
            case "quote": openRecord("quotes", target.record.id, { type: "quote-document", quote: target.record }); break;
            case "request": setActive("requests"); break;
            case "submission": openRecord("questionnaires", target.record.id, { type: "submission", submission: target.record }); break;
          }
        }}
      />

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

      {dialog?.type === "close-request" ? (
        <Dialog title="Close job request" onClose={closeDialog}>
          <p>Close the request for {formatSiteTitle(dialog.request)}? You can reopen it from Closed.</p>
          {requestMutationError ? <p role="alert">{requestMutationError}</p> : null}
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={closeDialog}>Back</Button>
            <Button type="button" disabled={requestMutationPending} onClick={() => void setRequestClosed(dialog.request, true)}>Close request</Button>
          </div>
        </Dialog>
      ) : null}

      {dialog?.type === "request-visits" ? (
        <Dialog title="Visits for this request" onClose={closeDialog}>
          <div className="field-job-list">
            {jobs.filter((job) => job.jobRequestId === dialog.request.id && job.status !== "cancelled").map((job) => (
              <div key={job.id}>
                <p>{job.displayName} · {job.status.replaceAll("-", " ")}</p>
                <Button type="button" variant="secondary" onClick={() => openRecord("jobs", job.id, { type: "job", job })}>Open visit</Button>
                {job.status === "completed" ? (
                  <Button type="button" onClick={() => invoiceJob(job)}>{findInvoiceForJob(job) ? "View invoice" : "Create invoice"}</Button>
                ) : null}
              </div>
            ))}
          </div>
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
            key={dialog.prefill?.id || dialog.prefill?.directJobId || dialog.prefill?.jobRequestId || "new-quote"}
            requests={jobRequests}
            clients={clients}
            quotes={quotes}
            invoices={invoiceRecords}
            prefill={dialog.prefill}
            linkedJob={jobs.find((job) => job.id === dialog.prefill?.directJobId) ??
              quotes.filter((quote) => quote.id === dialog.prefill?.id && !quote.jobRequestId)
                .map((quote) => jobForQuote(quote, jobs, quotes))[0]}
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
            dialog.replacement
              ? "Replacement invoice"
              : dialog.invoice
              ? "Edit Invoice"
              : dialog.quote
                ? "Invoice from quote"
                : "New Invoice"
          }
          onClose={closeDialog}
          wide
        >
          <InvoiceFormDialog
            key={dialog.invoice?.id || dialog.quote?.id || dialog.job?.id || dialog.request?.id || dialog.replacement?.id || "new-invoice"}
            clients={clients}
            jobs={jobs}
            requests={jobRequests}
            quotes={quotes}
            invoices={invoiceRecords}
            prefill={
              dialog.replacement
                ? draftReplacementInvoice(dialog.replacement)
                : dialog.invoice
                ? draftInvoiceFromRecord(dialog.invoice)
                : dialog.quote
                  ? draftInvoiceFromQuote(dialog.quote, clients, jobs, quotes)
                  : dialog.job
                    ? draftInvoiceFromJob(dialog.job)
                    : dialog.request ? draftInvoiceFromRequest(dialog.request) : undefined
            }
            sourceQuote={dialog.quote}
            onViewExisting={viewInvoice}
            onClose={closeDialog}
            onSave={persistInvoice}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "invoice-payment" ? (
        <Dialog title="Record payment" onClose={closeDialog}>
          <InvoicePaymentDialog record={dialog.record} pending={operationMutationPending}
            error={operationMutationError} onClose={closeDialog} onSave={persistInvoicePayment} />
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
        <Dialog title="Schedule Job" onClose={closeDialog} wide>
          <ScheduleFormDialog
            requests={jobRequests}
            clients={clients}
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
            key={dialog.job.id}
            job={dialog.job}
            jobs={jobs}
            teamMembers={teamMembers}
            canAssign={canOperateOffice}
            canDelete={canOperateOffice}
            canWork={canOperateOffice || Boolean(actorId && dialog.job.assigneeIds.includes(actorId))}
            onClose={closeDialog}
            onUpdate={updateJob}
            onAssign={(profileIds) => void assignJob(dialog.job, profileIds)}
            onUploadPhoto={(file) => void uploadPhoto(dialog.job, file)}
            onDeletePhoto={(photo) => void removePhoto(dialog.job, photo)}
            onDelete={(job) => setDialog({ type: "delete-job", job })}
            onAddNote={(noteId, body) => addJobNote(dialog.job, noteId, body)}
            invoiceAction={canOperateOffice && dialog.job.status === "completed" ? {
              label: findInvoiceForJob(dialog.job) ? "View invoice" : "Create invoice",
              run: () => invoiceJob(dialog.job),
            } : undefined}
            quoteAction={quoteJobAction(dialog.job)}
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
              updateQuoteStatus(dialog.quote, status as Quote["status"])
            }
            onRevise={["Sent", "Accepted"].includes(dialog.quote.status) ? () => void reviseQuote(dialog.quote) : undefined}
            onCreateInvoice={
              canCreateInvoiceFromQuote(dialog.quote, jobs, quotes) &&
              !liveInvoiceForQuote(dialog.quote, invoiceRecords, jobs, quotes)
                ? () => setDialog({ type: "invoice-form", quote: dialog.quote })
                : undefined
            }
            onViewInvoice={
              liveInvoiceForQuote(dialog.quote, invoiceRecords, jobs, quotes)
                ? () => {
                    const existing = liveInvoiceForQuote(
                      dialog.quote,
                      invoiceRecords,
                      jobs,
                      quotes,
                    );
                    if (existing) {
                      viewInvoice(existing);
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
                        jobRequestId: dialog.quote.jobRequestId ?? undefined,
                        clientId: dialog.quote.jobRequestId ? undefined : dialog.quote.clientId,
                        propertyId: dialog.quote.jobRequestId ? undefined : dialog.quote.serviceAddressId ?? undefined,
                        issueDate: dialog.quote.issueDate,
                        validUntil: dialog.quote.validUntil,
                        updatedAt: dialog.quote.updatedAt,
                        reference: dialog.quote.reference,
                        terms: dialog.quote.terms,
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
            onRecordPayment={() => setDialog({ type: "invoice-payment", record: dialog.record })}
            onReplace={() => setDialog({ type: "invoice-form", replacement: dialog.record })}
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
