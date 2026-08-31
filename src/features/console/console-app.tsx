"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Menu, Sparkles } from "lucide-react";
import "./console.css";
import {
  clientsSeed,
  initialJobRequests,
  initialJobs,
  initialQuotes,
  invoiceSeed as invoice,
  questionnaires,
} from "./domain";
import type {
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

import { Dialog } from "./components/dialog";
import { Sidebar } from "./components/sidebar";
import { DashboardView } from "./views/dashboard-view";
import { ClientsView } from "./views/clients-view";
import { RequestsView } from "./views/requests-view";
import { QuestionnairesView } from "./views/questionnaires-view";
import { QuotesView } from "./views/quotes-view";
import { ScheduleView } from "./views/schedule-view";
import { JobBoardView } from "./views/job-board-view";
import { InvoicesView } from "./views/invoices-view";

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
  liveInvoiceForQuote,
} from "./data/quote-invoice";

export type DialogState =
  | { type: "estimator" }
  | { type: "client"; client?: Client }
  | { type: "delete-client"; client: Client }
  | { type: "delete-request"; request: JobRequest }
  | { type: "delete-quote"; quote: Quote }
  | { type: "delete-job"; job: Job }
  | { type: "delete-invoice"; record: Invoice }
  | { type: "quote-form" }
  | { type: "invoice-form"; quote?: Quote }
  | { type: "send-questionnaire" }
  | { type: "public-questionnaire"; questionnaire: Questionnaire }
  | { type: "schedule" }
  | { type: "job"; job: Job }
  | { type: "quote-document"; quote: Quote }
  | { type: "invoice-document"; record: Invoice }
  | { type: "request" };

export type ConsoleAppProps = {
  initialClients?: Client[];
  initialJobRequests?: JobRequest[];
  initialQuestionnaires?: Questionnaire[];
  initialQuestionnaireSubmissions?: QuestionnaireSubmission[];
  initialQuotes?: Quote[];
  initialJobs?: Job[];
  teamMembers?: TeamMember[];
  initialInvoices?: Invoice[];
  dataMode?: "demo" | "live";
  signedInEmail?: string;
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
  onSignOut?: () => Promise<void>;
};

export function ConsoleApp({
  initialClients,
  initialJobRequests: providedJobRequests,
  initialQuestionnaires: providedQuestionnaires,
  initialQuestionnaireSubmissions: providedQuestionnaireSubmissions,
  initialQuotes: providedQuotes,
  initialJobs: providedJobs,
  teamMembers = [],
  initialInvoices: providedInvoices,
  dataMode = "demo",
  signedInEmail = "ops@fieldcentral.local",
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
  const [questionnaireSubmissions] = useState<QuestionnaireSubmission[]>(() =>
    structuredClone(providedQuestionnaireSubmissions ?? []),
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
  const [toast, setToast] = useState("");
  const [clientMutationPending, setClientMutationPending] = useState(false);
  const [clientMutationError, setClientMutationError] = useState("");
  const [requestMutationPending, setRequestMutationPending] = useState(false);
  const [requestMutationError, setRequestMutationError] = useState("");
  const [operationMutationPending, setOperationMutationPending] = useState(false);
  const [operationMutationError, setOperationMutationError] = useState("");

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

  const persistClient = async (saved: Client) => {
    setClientMutationError("");

    if (dataMode === "demo") {
      upsertClient(saved);
      setDialog(null);
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
      setDialog(null);
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
      setJobRequests((current) => [
        {
          id: `request-${current.length + 1}`,
          clientId: selectedClient?.id,
          propertyId: selectedProperty?.id,
          client: selectedClient?.name || "Unassigned client",
          address: selectedProperty?.address || "No service address",
          category: draft.category,
          scope: draft.scope,
          status: "New",
          created: "05 Aug 2026",
        },
        ...current,
      ]);
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
        recurrence: updated.recurrence as
          | "One-off"
          | "Weekly"
          | "Fortnightly"
          | "Four-weekly"
          | "Monthly",
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
    }
    setJobs((current) =>
      current.map((job) => (job.id === updated.id ? updated : job)),
    );
    setDialog({ type: "job", job: updated });
    showToast(`Job moved to ${updated.status.replace("-", " ")}.`);
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
    if (target) {
      void updateJob({ ...target, status });
      return;
    }
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, status } : job)),
    );
    showToast(`Job moved to ${status.replace("-", " ")}.`);
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
      showToast("Quote saved as draft.");
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
    setQuotes((current) => [result.quote, ...current]);
    setDialog(null);
    setActive("quotes");
    showToast("Quote saved as draft.");
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
        const demoDocId = `INV-2026-${2000 + current.length + 1}`;
        return [
          {
            id: demoDocId,
            documentNumber: demoDocId,
            clientId: draft.clientId,
            serviceAddressId: draft.propertyId,
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
      showToast("Invoice saved as draft.");
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
    setInvoiceRecords((current) => [result.invoice, ...current]);
    setDialog(null);
    setActive("invoices");
    showToast("Invoice saved as draft.");
  };

  const persistScheduledJob = async (draft: {
    jobRequestId: string;
    scheduledStart: string;
  }) => {
    if (dataMode === "demo") {
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
    switch (active) {
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
            onQuote={() => setDialog({ type: "quote-form" })}
            onEstimate={() => setDialog({ type: "estimator" })}
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
            onSend={() => setDialog({ type: "send-questionnaire" })}
            onPreview={(questionnaire) =>
              setDialog({ type: "public-questionnaire", questionnaire })
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
            onSchedule={() => setDialog({ type: "schedule" })}
            onJob={(job) => setDialog({ type: "job", job })}
          />
        );
      case "jobs":
        return (
          <JobBoardView
            jobs={jobs}
            onJob={(job) => setDialog({ type: "job", job })}
            onMove={moveJob}
            onDelete={(job) => setDialog({ type: "delete-job", job })}
          />
        );
      case "invoices":
        return (
          <InvoicesView
            records={invoiceRecords}
            pending={operationMutationPending}
            onNew={() => setDialog({ type: "invoice-form" })}
            onView={(record) =>
              setDialog({ type: "invoice-document", record })
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
      default:
        return (
          <DashboardView
            jobs={jobs}
            clients={clients}
            jobRequests={jobRequests}
            quotes={quotes}
            invoices={invoiceRecords}
            signedInEmail={signedInEmail}
            onNavigate={setActive}
          />
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onNavigate={setActive}
        onEstimate={() => setDialog({ type: "estimator" })}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        signedInEmail={signedInEmail}
        onSignOut={onSignOut}
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
        <main className="workspace">
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
      </div>

      {dialog?.type === "estimator" ? (
        <Dialog
          title="AI Scope & Quote Estimator"
          titleIcon={Sparkles}
          onClose={closeDialog}
        >
          <EstimatorDialog
            onClose={closeDialog}
            onEstimate={() => {
              closeDialog();
              showToast("Estimate drafted for review.");
            }}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "client" ? (
        <Dialog
          title={dialog.client ? "Edit Client" : "New Client"}
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
            label={`request for ${dialog.request.client}`}
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
        <Dialog title="New Quote" onClose={closeDialog} wide>
          <QuoteFormDialog
            requests={jobRequests}
            onClose={closeDialog}
            onSave={persistQuote}
            pending={operationMutationPending}
            error={operationMutationError}
          />
        </Dialog>
      ) : null}

      {dialog?.type === "invoice-form" ? (
        <Dialog
          title={dialog.quote ? "Invoice from quote" : "New Invoice"}
          onClose={closeDialog}
          wide
        >
          <InvoiceFormDialog
            key={dialog.quote?.id || "new-invoice"}
            clients={clients}
            jobs={jobs}
            prefill={
              dialog.quote
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
            teamMembers={teamMembers}
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
          />
        </Dialog>
      ) : null}

      {dialog?.type === "request" ? (
        <Dialog title="New Job Request" onClose={closeDialog}>
          <RequestFormDialog
            clients={clients}
            onClose={closeDialog}
            onSave={persistJobRequest}
            pending={requestMutationPending}
            error={requestMutationError}
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
