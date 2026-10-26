"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  MapPin,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { Job, JobRequest, TeamMember } from "../domain";
import {
  findAssignmentConflicts,
  findSiteConflict,
} from "../data/schedule-planning";
import { displayServiceCategory } from "../data/service-catalog";
import {
  defaultDateTimeLocal,
  formatSiteTitle,
  formatWorkLabel,
} from "../data/work-identity";
import { Badge, Button, Field } from "../components/ui-elements";

export function ScheduleFormDialog({
  requests,
  jobs = [],
  teamMembers = [],
  initialRequestId,
  onClose,
  onSchedule,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  jobs?: Job[];
  teamMembers?: TeamMember[];
  initialRequestId?: string;
  onClose: () => void;
  onSchedule: (payload: {
    jobRequestId: string;
    scheduledStart: string;
    profileIds?: string[];
  }) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [request, setRequest] = useState(initialRequestId || "");
  const [date, setDate] = useState(() => defaultDateTimeLocal());
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const selected = useMemo(
    () => requests.find((item) => item.id === request),
    [request, requests],
  );
  const assignable = teamMembers.filter((member) => member.isActive);
  const conflicts = findAssignmentConflicts({
    jobs,
    scheduledStart: date,
    profileIds: assigneeIds,
    members: assignable,
  });
  const siteClash = selected
    ? findSiteConflict({
        jobs,
        scheduledStart: date,
        address: selected.address,
      })
    : null;

  const toggleAssignee = (profileId: string) =>
    setAssigneeIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );

  return (
    <form
      className="form-stack schedule-dispatch-form"
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
      <div className="schedule-dispatch-grid">
        <div className="schedule-dispatch-col">
          <div className="schedule-dispatch-section-head">
            <Wrench aria-hidden="true" size={16} />
            <span>1. Job Request & Site Scope</span>
          </div>
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
            <div className="schedule-site-preview">
              <div className="schedule-site-preview__top">
                <strong>{formatSiteTitle(selected)}</strong>
                <Badge tone="olive">
                  {displayServiceCategory(selected.category)}
                </Badge>
              </div>
              <p className="schedule-site-preview__address">
                <MapPin aria-hidden="true" size={14} />
                <span>{selected.address}</span>
              </p>
              {selected.scope ? (
                <p className="schedule-site-preview__scope">{selected.scope}</p>
              ) : null}
              <small className="muted-copy">
                {selected.address}
                {selected.scope ? ` · ${selected.scope}` : ""}
              </small>
            </div>
          ) : (
            <div className="schedule-site-placeholder">
              <p>
                Select an open job request to preview the client property,
                service category, and scope before dispatching a crew.
              </p>
            </div>
          )}
        </div>

        <div className="schedule-dispatch-col">
          <div className="schedule-dispatch-section-head">
            <CalendarClock aria-hidden="true" size={16} />
            <span>2. Dispatch Window & Crew Assignment</span>
          </div>
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
              <div className="assignment-section__header">
                <p className="eyebrow">
                  <UserCheck aria-hidden="true" size={13} /> Assign team
                </p>
                <span>
                  {assigneeIds.length
                    ? `${assigneeIds.length} selected`
                    : "Optional"}
                </span>
              </div>
              <div className="assignment-options">
                {assignable.map((member) => {
                  const busy = conflicts.some(
                    (conflict) => conflict.profileId === member.id,
                  );
                  return (
                    <label
                      key={member.id}
                      className={busy ? "assignment-options__busy" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(member.id)}
                        onChange={() => toggleAssignee(member.id)}
                        disabled={pending}
                      />
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.role}
                          {busy ? " · already booked" : ""}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {conflicts.length || siteClash ? (
        <div className="conflict-note conflict-note--warn" role="status">
          <AlertTriangle aria-hidden="true" size={17} />
          <div>
            {conflicts.map((conflict) => (
              <p key={conflict.profileId}>
                {conflict.name} is already on {conflict.otherLabel} at this time.
              </p>
            ))}
            {siteClash ? (
              <p>This property already has a job at this time ({siteClash}).</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="conflict-note">
          <Check aria-hidden="true" size={17} /> No schedule conflicts detected.
        </div>
      )}
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
