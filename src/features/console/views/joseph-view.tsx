"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Mic, SendHorizonal } from "lucide-react";
import {
  JOSEPH_SUGGESTIONS,
  type AskJosephAction,
  type JosephConfirmTool,
  type JosephMessage,
  stripJosephWake,
} from "../data/joseph-contract";

type ChatLine = JosephMessage & {
  id: string;
  actions?: string[];
  confirm?: JosephConfirmTool;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  results: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string };
  }>;
};

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function speakReply(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-AU";
  utterance.rate = 1.02;
  window.speechSynthesis.speak(utterance);
}

export function JosephView({
  onAskJoseph,
}: {
  onAskJoseph?: AskJosephAction;
}) {
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speakNextRef = useRef(false);

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
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const applyResult = (
    result: Awaited<ReturnType<NonNullable<AskJosephAction>>>,
    speak: boolean,
  ) => {
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessages((current) => [
      ...current.map((line) =>
        line.confirm ? { ...line, confirm: undefined } : line,
      ),
      {
        id: nextLineId("assistant"),
        role: "assistant",
        content: result.reply,
        actions: result.actions,
        confirm: result.confirm,
      },
    ]);
    if (speak && result.reply) speakReply(result.reply);
  };

  const submitPrompt = async (raw: string, fromVoice = false) => {
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
    setMessages((current) => [
      ...current.map((line) =>
        line.confirm ? { ...line, confirm: undefined } : line,
      ),
      userLine,
    ]);
    setPending(true);
    speakNextRef.current = fromVoice;
    try {
      const result = await onAskJoseph({ messages: history });
      applyResult(result, fromVoice);
    } catch {
      setError("Joseph could not be reached. Try again.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const confirmWrite = async (confirm: JosephConfirmTool) => {
    if (!onAskJoseph || pending) return;
    const userLine: ChatLine = {
      id: nextLineId("user"),
      role: "user",
      content: "Confirm",
    };
    const history = [...messages, userLine].map(({ role, content: text }) => ({
      role,
      content: text,
    }));
    setError("");
    setMessages((current) => [
      ...current.map((line) =>
        line.confirm ? { ...line, confirm: undefined } : line,
      ),
      userLine,
    ]);
    setPending(true);
    try {
      const result = await onAskJoseph({ messages: history, confirmedTool: confirm });
      applyResult(result, speakNextRef.current);
    } catch {
      setError("Joseph could not confirm that. Try again.");
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const cancelWrite = () => {
    setMessages((current) =>
      current.map((line) =>
        line.confirm ? { ...line, confirm: undefined } : line,
      ),
    );
  };

  const toggleVoice = () => {
    if (pending) return;
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setError("Voice works in Chrome or the installed Android app. Type if the mic is missing.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    const recognition = new Ctor();
    recognition.lang = "en-AU";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalText = "";
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (transcript) parts.push(transcript);
        if (result?.isFinal && transcript) finalText = transcript;
      }
      setDraft(parts.join(" "));
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setError("Allow the microphone once, then tap the mic and speak.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError("Could not hear that. Tap the mic and try again.");
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const spoken = stripJosephWake(finalText || draft);
      if (spoken) {
        void submitPrompt(spoken, true);
      }
    };
    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start the microphone. Tap and try again.");
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    await submitPrompt(draft);
  };

  const empty = messages.length === 0 && !pending;
  const pendingConfirm = [...messages].reverse().find((line) => line.confirm)?.confirm;

  return (
    <section className="joseph-view" aria-labelledby="joseph-title">
      <header className="joseph-topbar">
        <span className="joseph-avatar" aria-hidden="true">
          J
        </span>
        <div>
          <h1 id="joseph-title">Joseph</h1>
          <p>Talk or type. Confirm before anything is changed.</p>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            className="joseph-new"
            onClick={() => {
              recognitionRef.current?.abort();
              if (typeof window !== "undefined") window.speechSynthesis?.cancel();
              setListening(false);
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
              Tap the mic and speak, or type. Joseph looks things up and waits
              for you to confirm before changing a job or invoice.
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
              {message.actions && message.actions.length > 0 ? (
                <ul className="joseph-actions">
                  {message.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              ) : null}
              {message.confirm && !pending ? (
                <div className="joseph-confirm">
                  <button
                    type="button"
                    className="joseph-confirm-yes"
                    onClick={() => {
                      void confirmWrite(message.confirm as JosephConfirmTool);
                    }}
                  >
                    Confirm
                  </button>
                  <button type="button" className="joseph-confirm-no" onClick={cancelWrite}>
                    Cancel
                  </button>
                </div>
              ) : null}
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

      {pendingConfirm && !pending ? (
        <p className="joseph-hint" role="status">
          Tap Confirm to make that change, or Cancel to leave it.
        </p>
      ) : null}

      <form className="joseph-composer" onSubmit={send}>
        <label className="sr-only" htmlFor="joseph-input">
          Message Joseph
        </label>
        <button
            type="button"
            className={listening ? "joseph-mic joseph-mic--hot" : "joseph-mic"}
            onClick={toggleVoice}
            disabled={pending}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Talk to Joseph"}
          >
            <Mic aria-hidden="true" size={18} strokeWidth={2} />
          </button>
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
          placeholder={listening ? "Listening…" : "Message Joseph, or tap the mic…"}
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
      <p className="joseph-hint">Tap the mic and speak · Enter to send</p>
    </section>
  );
}
