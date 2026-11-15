"use client";

import "../console-joseph-next-stop.css";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import {
  type AskJosephAction,
  type JosephMessage,
  type JosephProposal,
  type RunJosephNextStopAction,
  stripJosephWake,
} from "../data/joseph-contract";
import {
  approveJosephAction,
  getJosephNextStopBriefAction,
  runJosephNextStopAction,
} from "../data/joseph-actions";
import {
  NEXT_STOP_ACTION_CHIPS,
  buildNextStopBrief,
  canConfirmDraftInvoice,
  localMessageDraft,
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
  const [review, setReview] = useState<{
    proposal: JosephProposal;
    chip?: NextStopChipId;
    messageDraft?: string;
  } | null>(null);
  const [opsOverlay, setOpsOverlay] = useState<NextStopOpsOverlay | null>(null);
  const [seenBriefJobId, setSeenBriefJobId] = useState<string | undefined>();
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
  const reviewRef = useRef<HTMLHeadingElement>(null);
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
  const opsStatus = brief?.opsStatus ?? null;
  const briefJobId = brief?.jobId;
  if (briefJobId !== seenBriefJobId) {
    setSeenBriefJobId(briefJobId);
    setOpsOverlay(null);
    setReview(null);
  }

  const nextLineId = (role: JosephMessage["role"]) => {
    idRef.current += 1;
    return `${role}-${idRef.current}`;
  };

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`;
  }, [draft]);

  useEffect(() => {
    if (review) reviewRef.current?.focus();
  }, [review]);

  const appendExchange = (userText: string, reply: string) => {
    setMessages((current) => [
      ...current,
      { id: nextLineId("user"), role: "user", content: userText },
      { id: nextLineId("assistant"), role: "assistant", content: reply },
    ]);
  };

  const refreshBrief = async () => {
    if (jobs.length) return;
    const result = await getJosephNextStopBriefAction();
    if (!result.ok) return;
    setLoadedJobs(result.jobs);
    setLoadedClients(result.clients);
    setLoadedInvoices(result.invoices);
    setLoadedQuotes(result.quotes);
    setLoadedActorId(result.actorId);
    setLoadedActorRole(result.actorRole);
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
    setReview(null);
    setError("");
    setMessages((current) => [...current, userLine]);
    setPending(true);
    try {
      const result = await onAskJoseph({ messages: history });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.proposal) setReview({ proposal: result.proposal });
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
    }
  };

  const runChip = async (chip: NextStopChipId) => {
    if (!brief || pending) return;
    setReview(null);
    setError("");

    if (chip === "done-draft-invoice" && !canConfirmDraftInvoice(brief)) {
      setError("This stop has no accepted quote to invoice from.");
      return;
    }

    setPending(true);
    try {
      const result = await runNextStop({ chip, jobId: brief.jobId });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (result.proposal) {
        const messageDraft = chip === "done-draft-invoice" ? undefined : localMessageDraft(chip, brief);
        setReview({ proposal: result.proposal, chip, messageDraft });
      }
    } catch {
      setError("Joseph could not prepare that action.");
    } finally {
      setPending(false);
    }
  };

  const approve = async () => {
    if (pending || !review) return;
    setPending(true);
    setReview(null);
    setError("");
    try {
      const result = await approveJosephAction({ token: review.proposal.token });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const reply = review.messageDraft
        ? `${result.reply}\n\n${review.messageDraft}\n\nNot sent.`
        : result.reply;
      appendExchange(review.proposal.title, reply);
      if (review.chip) setOpsOverlay(overlayForChip(review.chip));
      await refreshBrief();
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
              setReview(null);
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
            {brief.scopeLine ? <p className="joseph-brief__scope">{brief.scopeLine}</p> : null}
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
              (effectiveActorRole === "technician" && item.id !== "on-my-way") ||
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

      {review ? (
        <section className="joseph-confirm" aria-labelledby="joseph-review-title">
          <div>
            <h2 id="joseph-review-title" tabIndex={-1} ref={reviewRef}>{review.proposal.title}</h2>
            <ul>
              {review.proposal.details.map((detail, index) => <li key={index}>{detail}</li>)}
            </ul>
          </div>
          <div className="joseph-confirm__actions">
            <button
              type="button"
              className="button button--primary"
              disabled={pending}
              onClick={() => void approve()}
            >
              Confirm change
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                setReview(null);
                inputRef.current?.focus();
              }}
            >
              Cancel
            </button>
          </div>
        </section>
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
