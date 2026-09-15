"use client";

import { useId, useRef, useState } from "react";
import { FileJson2, Upload } from "lucide-react";
import { Badge, Button } from "../components/ui-elements";
import type {
  ClientImportCommitResult,
  ClientImportPreviewResult,
  CommitClientImportAction,
  PreviewClientImportAction,
} from "../data/client-contract";
import type { ClientImportPlan } from "../data/client-import";
import { CLIENT_IMPORT_LIMITS } from "../data/client-import";

export function ClientImportPanel({
  canManage,
  onPreview,
  onCommit,
}: {
  canManage: boolean;
  onPreview: PreviewClientImportAction;
  onCommit: CommitClientImportAction;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [pending, setPending] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ClientImportPlan | null>(null);
  const [result, setResult] = useState<ClientImportCommitResult | null>(null);

  const reset = () => {
    setFileName("");
    setJsonText("");
    setPlan(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const readFile = async (file: File) => {
    setError("");
    setPlan(null);
    setResult(null);
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setError("Choose a .json clients export.");
      return;
    }
    if (file.size > CLIENT_IMPORT_LIMITS.maxChars) {
      setError("That file is too large. Use a JSON export under 400 KB.");
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setJsonText(text);
  };

  const preview = async () => {
    if (!jsonText) {
      setError("Choose a clients JSON file first.");
      return;
    }
    setPending("preview");
    setError("");
    setResult(null);
    const response: ClientImportPreviewResult = await onPreview({ jsonText });
    setPending(null);
    if (!response.ok) {
      setPlan(null);
      setError(response.message);
      return;
    }
    setPlan(response.plan);
  };

  const commit = async () => {
    if (!jsonText || !plan || plan.createCount === 0) return;
    setPending("commit");
    setError("");
    const response = await onCommit({ jsonText });
    setPending(null);
    setResult(response);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setPlan(null);
  };

  return (
    <article className="panel client-import-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Directory</p>
          <h2>Import clients</h2>
        </div>
      </div>
      <p className="muted-copy">
        Upload a clients JSON export. Nothing is saved until you confirm. Matches
        on phone, name, or unique email are skipped so existing clients are not doubled.
      </p>
      <div
        className="client-import-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
      >
        <FileJson2 aria-hidden="true" size={22} />
        <div>
          <strong>{fileName || "Drop a .json export here"}</strong>
          <span>or choose a file. Maximum {CLIENT_IMPORT_LIMITS.maxRows} clients.</span>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={!canManage || pending !== null}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!canManage || pending !== null}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
      </div>
      <div className="dialog-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={reset}
          disabled={pending !== null || (!jsonText && !plan && !result)}
        >
          Clear
        </Button>
        <Button
          type="button"
          icon={Upload}
          onClick={() => void preview()}
          disabled={!canManage || !jsonText || pending !== null}
        >
          {pending === "preview" ? "Checking…" : "Preview import"}
        </Button>
      </div>
      {plan ? (
        <div className="client-import-summary" aria-live="polite">
          <Badge tone="success">{plan.createCount} new</Badge>
          <Badge tone="olive">{plan.skipCount} already logged</Badge>
          <Badge tone={plan.invalidCount ? "red" : "neutral"}>
            {plan.invalidCount} invalid
          </Badge>
          <Button
            type="button"
            onClick={() => void commit()}
            disabled={!canManage || plan.createCount === 0 || pending !== null}
          >
            {pending === "commit"
              ? "Importing…"
              : `Import ${plan.createCount} new client${plan.createCount === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}
      {plan ? (
        <div className="client-import-table-wrap">
          <table className="client-import-table">
            <caption className="sr-only">Import preview</caption>
            <thead>
              <tr>
                <th>Client</th>
                <th>Phone</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={`${row.index}-${row.name}`}>
                  <td>{row.name}</td>
                  <td>{row.phone || "—"}</td>
                  <td>
                    <span className={`client-import-tag client-import-tag--${row.decision}`}>
                      {row.decision}
                    </span>
                    <span className="muted-copy"> {row.reason}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {result && result.ok ? (
        <p className="muted-copy" role="status">
          Imported {result.created.length} client
          {result.created.length === 1 ? "" : "s"}. {result.skipped} skipped.
          {result.failed.length
            ? ` ${result.failed.length} failed: ${result.failed.map((item) => item.name).join(", ")}.`
            : ""}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!canManage ? (
        <p className="muted-copy">Only owners and co-owners can import clients.</p>
      ) : null}
    </article>
  );
}
