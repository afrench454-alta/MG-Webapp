"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarOff,
  CalendarPlus,
  Camera,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { Job, JobPhoto, JobStatus, TeamMember } from "../domain";
import {
  displayServiceCategory,
  displayServiceDetail,
} from "../data/service-catalog";
import { applyJobSchedule, clearJobSchedule } from "../data/job-recurrence";
import { downloadIcs, jobsToIcs } from "../data/calendar-ics";
import { findAssignmentConflicts } from "../data/schedule-planning";
import { formatSiteTitle } from "../data/work-identity";
import { Button, Field, IconButton } from "../components/ui-elements";

export function JobDetailsDialog({
  job,
  jobs = [],
  teamMembers,
  canAssign = true,
  canDelete = true,
  onClose,
  onUpdate,
  onAssign,
  onUploadPhoto,
  onDeletePhoto,
  onDelete,
  pending,
  error,
}: {
  job: Job;
  jobs?: Job[];
  teamMembers: TeamMember[];
  canAssign?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onUpdate: (job: Job) => void;
  onAssign: (profileIds: string[]) => void;
  onUploadPhoto: (file: File) => void;
  onDeletePhoto: (photo: JobPhoto) => void;
  onDelete: (job: Job) => void;
  pending: boolean;
  error: string;
}) {
  const [notes, setNotes] = useState(job.notes || "");
  const [recurrence, setRecurrence] = useState(job.recurrence || "One-off");
  const [assigneeIds, setAssigneeIds] = useState(job.assigneeIds || []);

  const canReschedule =
    canAssign && job.status !== "completed" && job.status !== "cancelled";

  const snapshot = { ...job, notes, recurrence };

  const updateStatus = (status: JobStatus) =>
    onUpdate(
      status === "unscheduled"
        ? clearJobSchedule({ ...snapshot, status: "unscheduled" })
        : { ...snapshot, status },
    );

  const persistSchedule = (dateKey: string) => {
    if (!dateKey) {
      onUpdate(clearJobSchedule(snapshot));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateKey)) return;
    if (dateKey === job.dateKey && job.status !== "unscheduled") return;
    onUpdate(applyJobSchedule(snapshot, dateKey));
  };

  const toggleAssignee = (profileId: string) => {
    const next = assigneeIds.includes(profileId)
      ? assigneeIds.filter((id) => id !== profileId)
      : [...assigneeIds, profileId];
    setAssigneeIds(next);
    onAssign(next);
  };

  const serviceType = displayServiceDetail(job.category);
  const conflicts = findAssignmentConflicts({
    jobs,
    scheduledStart: job.dateKey,
    profileIds: assigneeIds,
    ignoreJobId: job.id,
    members: teamMembers,
  });

  return (
    <div className="job-detail">
      <div className="job-facts">
        <div>
          <p className="eyebrow">Client & property</p>
          <span>{formatSiteTitle(job)}</span>
        </div>
        <div>
          <p className="eyebrow">Address</p>
          <span>{job.address}</span>
        </div>
        {canReschedule ? null : (
          <div>
            <p className="eyebrow">Scheduled</p>
            <span>
              {job.date}
              {job.time ? ` · ${job.time}` : ""}
            </span>
          </div>
        )}
        <div>
          <p className="eyebrow">Service</p>
          <span>
            {displayServiceCategory(job.category)}
            {serviceType ? ` · ${serviceType}` : ""}
          </span>
        </div>
        <div className="job-facts__scope">
          <p className="eyebrow">Scope</p>
          <span>{job.scope}</span>
        </div>
      </div>
      {canReschedule ? (
        <div className="job-schedule">
          <div className="job-schedule__controls">
            <Field
              label="Date & time"
              hint="Move the visit to another day without deleting the job."
            >
              <input
                type="datetime-local"
                value={job.dateKey}
                onChange={(event) => persistSchedule(event.target.value)}
                disabled={pending}
              />
            </Field>
            {job.dateKey ? (
              <>
              <Button
                variant="secondary"
                type="button"
                icon={CalendarPlus}
                onClick={() =>
                  downloadIcs(
                    `mow-glow-${job.id.slice(0, 8)}.ics`,
                    jobsToIcs([job]),
                  )
                }
                disabled={pending}
              >
                Add to calendar
              </Button>
              <Button
                variant="secondary"
                type="button"
                icon={CalendarOff}
                onClick={() => onUpdate(clearJobSchedule(snapshot))}
                disabled={pending}
              >
                Clear from calendar
              </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="status-actions">
        <Button icon={PlayCircle} onClick={() => updateStatus("in-progress")}>
          Start
        </Button>
        <Button
          variant="secondary"
          icon={PauseCircle}
          onClick={() => updateStatus("on-hold")}
        >
          Hold
        </Button>
        <Button
          variant="success"
          icon={CheckCircle2}
          onClick={() => updateStatus("completed")}
        >
          Complete
        </Button>
      </div>
      <Field label="On-site notes">
        <textarea
          rows={6}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => onUpdate({ ...job, notes, recurrence })}
        />
      </Field>
      {canAssign ? (
      <section className="assignment-section">
        <div>
          <p className="eyebrow">Assigned team</p>
          <span>
            {assigneeIds.length
              ? `${assigneeIds.length} team member${assigneeIds.length === 1 ? "" : "s"}`
              : "Unassigned"}
          </span>
        </div>
        <div className="assignment-options">
          {teamMembers.filter((member) => member.isActive).map((member) => {
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
                  {member.email ? ` · ${member.email}` : ""}
                  {busy ? " · already booked" : ""}
                </small>
              </span>
            </label>
            );
          })}
        </div>
        {conflicts.length ? (
          <div className="conflict-note conflict-note--warn" role="status">
            <AlertTriangle aria-hidden="true" size={17} />
            <div>
              {conflicts.map((conflict) => (
                <p key={conflict.profileId}>
                  {conflict.name} is already on {conflict.otherLabel} at this time.
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      ) : (
        <p className="muted-copy">
          {assigneeIds.length
            ? `Assigned to ${job.assignees.join(", ") || "team"}.`
            : "This job is unassigned."}
        </p>
      )}
      {canAssign ? (
      <div className="recurrence-row">
        <RotateCcw aria-hidden="true" size={18} />
        <Field label="Recurring">
          <select
            value={recurrence}
            onChange={(event) => {
              setRecurrence(event.target.value);
              onUpdate({ ...job, notes, recurrence: event.target.value });
            }}
          >
            <option>One-off</option>
            <option>Weekly</option>
            <option>Fortnightly</option>
            <option>Four-weekly</option>
            <option>Monthly</option>
          </select>
        </Field>
        <p>Next job is created when this one is completed.</p>
      </div>
      ) : null}
      <div className="photo-section">
        <div>
          <p className="eyebrow">Photos</p>
          <em>
            {job.photos.length
              ? `${job.photos.length} uploaded`
              : "No photos yet."}
          </em>
        </div>
        <label className="photo-upload">
          <Camera aria-hidden="true" size={19} />{" "}
          {pending ? "Uploading…" : "Add photo"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUploadPhoto(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {job.photos.length ? (
        <div className="photo-grid">
          {job.photos.map((photo) => (
            <article key={photo.id}>
              <a href={photo.url} target="_blank" rel="noreferrer">
                <Image
                  src={photo.url}
                  alt={photo.caption || photo.name}
                  width={220}
                  height={150}
                  unoptimized
                />
              </a>
              <div>
                <span>{photo.caption || photo.name}</span>
                <IconButton
                  label={`Delete ${photo.name}`}
                  icon={Trash2}
                  tone="danger"
                  onClick={() => onDeletePhoto(photo)}
                  disabled={pending}
                />
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions dialog-actions--split">
        {canDelete ? (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => onDelete(job)}
          >
            Delete job
          </Button>
        ) : (
          <span />
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
