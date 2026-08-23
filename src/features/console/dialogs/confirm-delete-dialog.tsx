"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import type { Client } from "../domain";
import { Button } from "../components/ui-elements";

export function ConfirmDeleteClientDialog({
  client,
  onCancel,
  onConfirm,
  archiveMode,
  pending = false,
  error = "",
}: {
  client: Client;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  archiveMode: boolean;
  pending?: boolean;
  error?: string;
}) {
  return (
    <div className="confirm-delete" aria-busy={pending}>
      <div className="warning-icon">
        <AlertCircle aria-hidden="true" size={24} />
      </div>
      <h3>
        {archiveMode ? "Archive" : "Delete"} {client.name}?
      </h3>
      <p>
        {archiveMode
          ? "This removes the client from active work while preserving job, quote, and invoice history."
          : "This prototype removes the client from local state only. Production uses recoverable archive behaviour."}
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => void onConfirm()}
          disabled={pending}
        >
          {pending
            ? "Archiving…"
            : archiveMode
              ? "Archive client"
              : "Delete client"}
        </Button>
      </div>
    </div>
  );
}

export function ConfirmRecordDeleteDialog({
  label,
  kind,
  onCancel,
  onConfirm,
  pending = false,
  error = "",
}: {
  label: string;
  kind: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  return (
    <div className="confirm-delete" aria-busy={pending}>
      <div className="warning-icon">
        <AlertCircle aria-hidden="true" size={24} />
      </div>
      <h3>Delete {label}?</h3>
      <p>
        This permanently removes the {kind} from this workspace. This action
        cannot be undone.
      </p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => void onConfirm()}
          disabled={pending}
        >
          {pending ? "Deleting…" : `Delete ${kind}`}
        </Button>
      </div>
    </div>
  );
}
