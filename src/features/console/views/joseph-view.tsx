"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import { PageHeader } from "../components/ui-elements";
import type { AskJosephAction, JosephMessage } from "../data/joseph-contract";
import { stripJosephWake } from "../data/joseph-contract";

type ChatLine = JosephMessage & { id: string };

export function JosephView({
  onAskJoseph,
}: {
  onAskJoseph?: AskJosephAction;
}) {
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = stripJosephWake(draft);
    if (!content || pending) return;
    if (!onAskJoseph) {
      setError("Joseph is not connected on this deployment yet.");
      return;
    }

    const userLine: ChatLine = {
      id: `user-${Date.now()}`,
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
          id: `assistant-${Date.now()}`,
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

  return (
    <section className="joseph-view" aria-labelledby="joseph-title">
      <PageHeader
        eyebrow="Field assistant"
        title="Joseph"
        subtitle="Ask about jobs, invoices, and clients. Say confirm before Joseph changes anything."
      />
      <div className="joseph-thread" ref={listRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="joseph-empty">
            Try “What invoices are outstanding?” or “Hey Joseph, which jobs are on today?”
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`joseph-bubble joseph-bubble--${message.role}`}
          >
            <p>{message.content}</p>
          </article>
        ))}
        {pending ? (
          <p className="joseph-pending">Joseph is looking that up…</p>
        ) : null}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="joseph-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="joseph-input">
          Message Joseph
        </label>
        <textarea
          id="joseph-input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask Joseph…"
          disabled={pending}
        />
        <button type="submit" className="button button--primary" disabled={pending || !draft.trim()}>
          <SendHorizonal aria-hidden="true" size={18} />
          Send
        </button>
      </form>
    </section>
  );
}
