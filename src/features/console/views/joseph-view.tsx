"use client";

import "../console-joseph-next-stop.css";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import {
  type AskJosephAction,
  type JosephMessage,
  type RunJosephNextStopAction,
  stripJosephWake,
} from "../data/joseph-contract";
import {
  getJosephNextStopBriefAction,
  runJosephNextStopAction,
} from "../data/joseph-actions";
import {
  JOSEPH_DRAFT_INVOICE_CONFIRM,
  NEXT_STOP_ACTION_CHIPS,
  buildNextStopBrief,
  canConfirmDraftInvoice,
  localMessageDraft,
  nextStopOpsStatus,
  nextStopOpsTone,
  overlayForChip,
  type NextStopChipId,
  type NextStopOpsOverlay,
} from "../data/joseph-next-stop";
import type { Client, Invoice, Job, Quote } from "../domain";
import { Badge } from "../components/ui-elements";

type ChatLine = JosephMessage & { id: string };

export function JosephView({
  onAskJoseph,
  onRunNextStop,
  jobs = [],
  clients = [],
  invoices = [],
  quotes = [],
  actorId,
  actorRole,
}: {
  onAskJoseph?: AskJosephAction;
  onRunNextStop?: RunJosephNextStopAction;
  jobs?: Job[];
  clients?: Client[];
  invoices?: Invoice[];
  quotes?: Quote[];
  actorId?: string;
  actorRole?: "owner" | "co_owner" | "technician";
}) {
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [invoiceConfirm, setInvoiceConfirm] = useState(false);
  const [opsOverlay, setOpsOverlay] = useState<NextStopOpsOverlay | null>(null);
  const [loadedJobs, setLoadedJobs] = useState<Job[]>([]);
  const [loadedClients, setLoadedClients] = useState<Client[]>([]);
  const [loadedInvoices, setLoadedInvoices] = useState<Invoice[]>([]);
  const [loadedQuotes, setLoadedQuotes] = useState<Quote[]>([]);
  const [loadedActorId, setLoadedActorId] = useState<string | undefined>();
  const [loadedActorRole, setLoadedActorRole] = useState<
    "owner" | "co_owner" | "technician" | undefined
  >();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);

  const effectiveJobs = jobs.length ? jobs : loadedJobs;
  const effectiveClients = clients.length ? clients : loadedClients;
  const effectiveInvoices = invoices.length ? invoices : loadedInvoices;
  const effectiveQuotes = quotes.length ? quotes : loadedQuotes;
  const effectiveActorId = actorId ?? loadedActorId;
  const effectiveActorRole = actorRole ?? loadedActorRole;
  const runNextStop = onRunNextStop ?? runJosephNextStopAction;

  useEffect(() => {
    if (jobs.length || clients.length) return;
    let cancelled = false;
    void (async () => {
      const result = await getJosephNextStopBriefAction();
      if (cancelled || !result.ok) return;
      setLoadedJobs(result.jobs);
      setLoadedClients(result.clients);
      setLoadedInvoices(result.invoices);
      setLoadedQuotes(result.quotes);
      setLoadedActorId(result.actorId);
      setLoadedActorRole(result.actorRole);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobs.length, clients.length]);

  const brief = useMemo(
    () =>
      buildNextStopBrief({
        jobs: effectiveJobs,
        clients: effectiveClients,
        invoices: effectiveInvoices,
        quotes: effectiveQuotes,
        actorId: effectiveActorId,
        actorRole: effectiveActorRole,
        overlay: opsOverlay,
      }),
    [
      effectiveJobs,
      effectiveClients,
      effectiveInvoices,
      effectiveQuotes,
      effectiveActorId,
      effectiveActorRole,
      opsOverlay,
    ],
  );
  const opsStatus = brief
    ? nextStopOpsStatus(brief.jobStatus, opsOverlay)
    : null;

  const nextLineId = (role: JosephMessage["role"]) => {
    idRef.current += 1;
    return `${role}-${idRef.current}`;
  };

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending, invoiceConfirm]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`;
  }, [draft]);

  useEffect(() => {
    setOpsOverlay(null);
    setInvoiceConfirm(false);
  }, [brief?.jobId]);

  const appendExchange = (userText: string, reply: string) => {
    setMessages((current) => [
      ...current,
      { id: nextLineId("user"), role: "user", content: userText },
      { id: nextLineId("assistant"), role: "assistant", content: reply },
    ]);
  };

  const submitPrompt = async (raw: string) => {
    const content = stripJosephWake(raw);
    if (!content || pending) return;
    if (!onAskJoseph) {
      setDraft(content);
      inputRef.current?.focus();
      setError("Joseph is not connected on this deployment yet.");
      return;
    }

    const userLine: ChatLine = {
      id: nextLineId("user"),
      role: "user",
      content,
    };
    const history = [...messages, userLine].map(({ role, content: text }) => ({
      role,
      content: text,
    }));
    setDraft("");
    setError("");
    setMessages((current) => [...current, userLine]);
    setPending(true);
    try {
      const result = await onAskJoseph({ messages: history });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessages((current) => [
        ...current,
        {
          id: nextLineId("assistant"),
          role: "assistant",
          content: result.reply,
        },
      ]);
    } catch {
      setError("Joseph could not be reached. Try again.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const runChip = async (chip: NextStopChipId, confirm = false) => {
    if (pending) return;
    if (!brief) {
      setError("No next stop to act on.");
      return;
    }

    const chipLabel =
      NEXT_STOP_ACTION_CHIPS.find((item) => item.id === chip)?.label ?? chip;

    if (chip === "done-draft-invoice" && !confirm) {
      if (!canConfirmDraftInvoice(brief)) {
        setInvoiceConfirm(false);
        setError("This stop has no accepted quote to invoice from.");
        appendExchange(
          chipLabel,
          "This job has no linked accepted quote, so I cannot draft an invoice from the quote.",
        );
        return;
      }
      setError("");
      setInvoiceConfirm(true);
      return;
    }

    setInvoiceConfirm(false);
    setError("");

    if (!runNextStop) {
      if (chip === "on-my-way" || chip === "running-late") {
        appendExchange(
          chipLabel,
          `${localMessageDraft(chip, brief)}\n\nNot sent.`,
        );
        const next = overlayForChip(chip);
        if (next) setOpsOverlay(next);
        return;
      }
      setError("Joseph is not connected on this deployment yet.");
      return;
    }

    setPending(true);
    try {
      const result = await runNextStop({
        chip,
        jobId: brief.jobId,
        confirm,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      appendExchange(confirm ? JOSEPH_DRAFT_INVOICE_CONFIRM : chipLabel, result.reply);
      const next = overlayForChip(chip);
      if (next) setOpsOverlay(next);
    } catch {
      setError("Joseph could not finish that action.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    await submitPrompt(draft);
  };

  return (
    <section className="joseph-view" aria-labelledby="joseph-title">
      <header className="joseph-topbar">
        <span className="joseph-avatar" aria-hidden="true">
          J
        </span>
        <div>
          <h1 id="joseph-title">Joseph</h1>
          <p>Jobs, invoices, and clients. Confirm before anything is changed.</p>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            className="joseph-new"
            onClick={() => {
              setMessages([]);
              setDraft("");
              setError("");
              setInvoiceConfirm(false);
              inputRef.current?.focus();
            }}
          >
            New chat
          </button>
        ) : null}
      </header>

      <article className="joseph-brief" aria-live="polite">
        {brief ? (
          <>
            <div className="joseph-brief__header">
              <p className="eyebrow">Next stop</p>
              {opsStatus ? (
                <Badge tone={nextStopOpsTone(opsStatus)}>{opsStatus}</Badge>
              ) : null}
            </div>
            <h2>{brief.clientName}</h2>
            <p className="joseph-brief__address">{brief.address}</p>
            {brief.time || brief.date ? (
              <p className="joseph-brief__when">
                {[brief.time, brief.date].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {brief.notes ? <p className="joseph-brief__notes">{brief.notes}</p> : null}
            <p className="joseph-brief__balance">
              Balance {brief.balanceLabel}
              {brief.outstandingCount > 0
                ? ` · ${brief.outstandingCount} outstanding`
                : " · none outstanding"}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Next stop</p>
            <h2>No next stop</h2>
            <p>Nothing is scheduled or in progress right now.</p>
          </>
        )}
      </article>

      <div className="joseph-suggestions joseph-suggestions--actions">
        {NEXT_STOP_ACTION_CHIPS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={
              pending ||
              !brief ||
              (item.id === "done-draft-invoice" && opsStatus === "Done")
            }
            onClick={() => {
              void runChip(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {invoiceConfirm && brief ? (
        <div className="joseph-confirm" role="region" aria-label="Confirm draft invoice">
          <p>
            Complete {brief.clientName} at {brief.address} and draft the invoice from the
            linked quote.
          </p>
          <button
            type="button"
            className="button button--primary"
            disabled={pending}
            onClick={() => {
              void runChip("done-draft-invoice", true);
            }}
          >
            {JOSEPH_DRAFT_INVOICE_CONFIRM}
          </button>
        </div>
      ) : null}

      <div className="joseph-thread" ref={listRef} role="log" aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`joseph-row joseph-row--${message.role}`}
          >
            {message.role === "assistant" ? (
              <span className="joseph-avatar joseph-avatar--sm" aria-hidden="true">
                J
              </span>
            ) : null}
            <div className={`joseph-bubble joseph-bubble--${message.role}`}>
              <p>{message.content}</p>
            </div>
          </article>
        ))}

        {pending ? (
          <div className="joseph-row joseph-row--assistant">
            <span className="joseph-avatar joseph-avatar--sm" aria-hidden="true">
              J
            </span>
            <div className="joseph-bubble joseph-bubble--assistant joseph-bubble--pending">
              <span className="joseph-dots" aria-label="Joseph is looking that up">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="form-error joseph-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="joseph-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="joseph-input">
          Message Joseph
        </label>
        <textarea
          id="joseph-input"
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Message Joseph…"
          disabled={pending}
        />
        <button
          type="submit"
          className="joseph-send"
          disabled={pending || !draft.trim()}
          aria-label="Send message"
        >
          <SendHorizonal aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </form>
      <p className="joseph-hint">Enter to send · Shift+Enter for a new line</p>
    </section>
  );
}
