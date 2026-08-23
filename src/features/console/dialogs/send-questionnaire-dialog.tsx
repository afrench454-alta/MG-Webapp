"use client";

import { useState } from "react";
import { FileCheck2, FileText, Mail, Send } from "lucide-react";
import type { Questionnaire } from "../domain";
import type { SendQuestionnaireAction } from "../data/questionnaire-contract";
import { Button, Field } from "../components/ui-elements";

export function SendQuestionnaireDialog({
  items,
  onClose,
  onSend,
}: {
  items: Questionnaire[];
  onClose: () => void;
  onSend?: SendQuestionnaireAction;
}) {
  const [template, setTemplate] = useState(items[0]?.id || "");
  const [recipient, setRecipient] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [share, setShare] = useState<{
    url: string;
    recipient: string;
    email: string;
  } | null>(null);

  if (share) {
    const subject = encodeURIComponent("Your property service questionnaire");
    const body = encodeURIComponent(
      `Hi ${share.recipient},\n\nPlease complete this secure questionnaire:\n${share.url}\n\nThis link is valid for 30 days and can be submitted once.`,
    );
    return (
      <div className="form-stack">
        <div className="link-preview">
          <FileCheck2 aria-hidden="true" size={20} />
          <div>
            <strong>Secure link ready</strong>
            <span>{share.url}</span>
          </div>
        </div>
        <div className="dialog-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => void navigator.clipboard.writeText(share.url)}
          >
            Copy link
          </Button>
          <a
            className="button button--primary"
            href={`mailto:${encodeURIComponent(share.email)}?subject=${subject}&body=${body}`}
          >
            <Mail aria-hidden="true" size={18} />
            <span>Open email</span>
          </a>
          <Button variant="secondary" type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="form-stack"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (!onSend) {
          setError("Live questionnaire sharing is not available.");
          return;
        }
        setPending(true);
        const result = await onSend({
          questionnaireId: template,
          recipient,
          email,
        });
        setPending(false);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setShare({
          ...result,
          url: `${window.location.origin}${result.path}`,
        });
      }}
    >
      <Field label="Template" required>
        <select
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          disabled={pending}
        >
          {items.map((item) => (
            <option value={item.id} key={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid form-grid--two">
        <Field label="Recipient name" required>
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            required
            disabled={pending}
          />
        </Field>
        <Field label="Recipient email" required>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={pending}
          />
        </Field>
      </div>
      <div className="link-preview">
        <FileText aria-hidden="true" size={20} />
        <div>
          <strong>Secure public link</strong>
          <span>Valid for 30 days · One submission</span>
        </div>
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          icon={Send}
          type="submit"
          disabled={pending || !items.length}
        >
          {pending ? "Creating…" : "Create secure link"}
        </Button>
      </div>
    </form>
  );
}
