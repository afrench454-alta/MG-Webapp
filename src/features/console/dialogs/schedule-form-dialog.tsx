"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { JobRequest, TeamMember } from "../domain";
import { formatWorkLabel } from "../data/work-identity";
import { Button, Field } from "../components/ui-elements";

export function ScheduleFormDialog({
  requests,
  teamMembers = [],
  onClose,
  onSchedule,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  teamMembers?: TeamMember[];
  onClose: () => void;
  onSchedule: (payload: {
    jobRequestId: string;
    scheduledStart: string;
    profileIds?: string[];
  }) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [request, setRequest] = useState("");
  const [date, setDate] = useState("2026-08-11T09:00");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const selected = useMemo(
    () => requests.find((item) => item.id === request),
    [request, requests],
  );
  const assignable = teamMembers.filter((member) => member.isActive);

  const toggleAssignee = (profileId: string) =>
    setAssigneeIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        void onSchedule({
          jobRequestId: request,
          scheduledStart: new Date(`${date}:00+10:00`).toISOString(),
          profileIds: assigneeIds.length ? assigneeIds : undefined,
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
              {formatWorkLabel(item)}
            </option>
          ))}
        </select>
      </Field>
      {selected ? (
        <p className="muted-copy">
          {selected.address}
          {selected.scope ? ` · ${selected.scope}` : ""}
        </p>
      ) : null}
      <Field label="Date & time" required>
        <input
          type="datetime-local"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
          disabled={pending}
        />
      </Field>
      {assignable.length ? (
        <section className="assignment-section">
          <div>
            <p className="eyebrow">Assign team</p>
            <span>
              {assigneeIds.length
                ? `${assigneeIds.length} selected`
                : "Optional"}
            </span>
          </div>
          <div className="assignment-options">
            {assignable.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(member.id)}
                  onChange={() => toggleAssignee(member.id)}
                  disabled={pending}
                />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}
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
