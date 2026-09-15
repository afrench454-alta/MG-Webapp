"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";
import {
  JOSEPH_SUGGESTIONS,
  type AskJosephAction,
  type JosephMessage,
  stripJosephWake,
} from "../data/joseph-contract";

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);

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

  const send = async (event: FormEvent) => {
    event.preventDefault();
    await submitPrompt(draft);
  };

  const empty = messages.length === 0 && !pending;

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
              inputRef.current?.focus();
            }}
          >
            New chat
          </button>
        ) : null}
      </header>

      <div className="joseph-thread" ref={listRef} role="log" aria-live="polite">
        {empty ? (
          <div className="joseph-empty">
            <span className="joseph-avatar joseph-avatar--lg" aria-hidden="true">
              J
            </span>
            <h2>How can I help?</h2>
            <p>
              Type below, or tap a suggestion. Joseph looks things up and waits for
              you to confirm before changing a job or invoice.
            </p>
            <div className="joseph-suggestions">
              {JOSEPH_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    void submitPrompt(item.prompt);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
