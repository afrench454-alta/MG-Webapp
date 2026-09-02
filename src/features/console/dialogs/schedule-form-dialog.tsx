"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { JobRequest } from "../domain";
import { displayServiceCategory } from "../data/service-catalog";
import { Button, Field } from "../components/ui-elements";

export function ScheduleFormDialog({
  requests,
  onClose,
  onSchedule,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  onClose: () => void;
  onSchedule: (payload: {
    jobRequestId: string;
    scheduledStart: string;
  }) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [request, setRequest] = useState("");
  const [date, setDate] = useState("2026-08-11T09:00");

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void onSchedule({
          jobRequestId: request,
          scheduledStart: new Date(`${date}:00+10:00`).toISOString(),
        });
      }}
      aria-busy={pending}
    >
      <Field label="Job request" required>
        <select
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          required
          disabled={pending}
        >
          <option value="">Choose...</option>
          {requests.map((item) => (
            <option value={item.id} key={item.id}>
              {item.client} · {displayServiceCategory(item.category)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Date & time" required>
        <input
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          disabled={pending}
        />
      </Field>
      <div className="conflict-note">
        <Check aria-hidden="true" size={17} /> No schedule conflicts detected.
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
        <Button type="submit" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule"}
        </Button>
      </div>
    </form>
  );
}
