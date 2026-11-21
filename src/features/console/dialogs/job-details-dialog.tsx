"use client";

import { randomId } from "@/lib/random-id";
import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CalendarOff,
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
import { findAssignmentConflicts } from "../data/schedule-planning";
import { formatSiteTitle } from "../data/work-identity";
import { Button, Field, IconButton } from "../components/ui-elements";

export function JobDetailsDialog({
  job,
  jobs = [],
  teamMembers,
  canAssign = true,
  canDelete = true,
  canWork = true,
  onClose,
  onUpdate,
  onAssign,
  onUploadPhoto,
  onDeletePhoto,
  onDelete,
  onAddNote,
  invoiceAction,
  quoteAction,
  pending,
  error,
}: {
  job: Job;
  jobs?: Job[];
  teamMembers: TeamMember[];
  canAssign?: boolean;
  canDelete?: boolean;
  canWork?: boolean;
  onClose: () => void;
  onUpdate: (job: Job) => void;
  onAssign: (profileIds: string[]) => void;
  onUploadPhoto: (file: File) => void;
  onDeletePhoto: (photo: JobPhoto) => void;
  onDelete: (job: Job) => void;
  onAddNote?: (noteId: string, body: string) => Promise<boolean>;
  invoiceAction?: { label: string; run: () => void };
  quoteAction?: { label: string; run: () => void };
  pending: boolean;
  error: string;
}) {
  const [fieldNote, setFieldNote] = useState("");
  const [noteId, setNoteId] = useState<string>();
  const assigneeIds = job.assigneeIds;
  const active = job.status !== "completed" && job.status !== "cancelled";
  const canStart = canWork && active && job.status !== "in-progress";
  const canHold = canWork && active && (canAssign || job.status === "in-progress") && job.status !== "on-hold";
  const canComplete = canWork && active && (canAssign || ["in-progress", "on-hold"].includes(job.status));

  const canReschedule = canAssign && active;

  const updateStatus = (status: JobStatus) =>
    onUpdate(
      status === "unscheduled"
        ? clearJobSchedule({ ...job, status: "unscheduled" })
        : { ...job, status },
    );

  const persistSchedule = (dateKey: string) => {
    if (!dateKey) {
      onUpdate(clearJobSchedule(job));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateKey)) return;
    if (dateKey === job.dateKey && job.status !== "unscheduled") return;
    onUpdate(applyJobSchedule(job, dateKey));
  };

  const toggleAssignee = (profileId: string) => {
    const next = assigneeIds.includes(profileId)
      ? assigneeIds.filter((id) => id !== profileId)
      : [...assigneeIds, profileId];
    onAssign(next);
  };

  const saveNote = async () => {
    if (!onAddNote || !fieldNote.trim()) return;
    const id = noteId ?? randomId();
    setNoteId(id);
    if (await onAddNote(id, fieldNote.trim())) {
      setFieldNote("");
      setNoteId(undefined);
    }
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
              <Button
                variant="secondary"
                type="button"
                icon={CalendarOff}
                onClick={() => onUpdate(clearJobSchedule(job))}
                disabled={pending}
              >
                Clear from calendar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="status-actions">
        {canStart ? <Button icon={PlayCircle} disabled={pending} onClick={() => updateStatus("in-progress")}>Start</Button> : null}
        {canHold ? <Button variant="secondary" icon={PauseCircle} disabled={pending} onClick={() => updateStatus("on-hold")}>Hold</Button> : null}
        {canComplete ? <Button variant="success" icon={CheckCircle2} disabled={pending} onClick={() => updateStatus("completed")}>Complete</Button> : null}
        {canAssign && active ? (
          <Button variant="secondary" disabled={pending} onClick={() => {
            if (window.confirm("Cancel this job? Its history will be kept.")) updateStatus("cancelled");
          }}>Cancel job</Button>
        ) : null}
        {invoiceAction ? <Button disabled={pending} onClick={invoiceAction.run}>{invoiceAction.label}</Button> : null}
        {quoteAction ? <Button variant="secondary" disabled={pending} onClick={quoteAction.run}>{quoteAction.label}</Button> : null}
      </div>
      {job.notes ? <p className="muted-copy">{job.notes}</p> : null}
      {job.fieldNotes?.length ? (
        <ul className="field-notes" aria-label="On-site notes">
          {job.fieldNotes.map((note) => <li key={note.id}><p>{note.body}</p><small>{note.author} · {note.created}</small></li>)}
        </ul>
      ) : null}
      {canWork && onAddNote ? (
        <>
          <Field label="On-site note">
            <textarea rows={3} value={fieldNote} onChange={(event) => { setFieldNote(event.target.value); setNoteId(undefined); }} disabled={pending} />
          </Field>
          <Button variant="secondary" type="button" disabled={!fieldNote.trim() || pending} onClick={() => void saveNote()}>Save note</Button>
        </>
      ) : null}
      {canAssign && active ? (
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
      {canAssign && active ? (
      <div className="recurrence-row">
        <RotateCcw aria-hidden="true" size={18} />
        <Field label="Recurring">
          <select
            value={job.recurrence || "One-off"}
            disabled={pending}
            onChange={(event) => {
              onUpdate({ ...job, recurrence: event.target.value });
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
        {canWork ? <label className="photo-upload">
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
        </label> : null}
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
                {canWork ? <IconButton
                  label={`Delete ${photo.name}`}
                  icon={Trash2}
                  tone="danger"
                  onClick={() => onDeletePhoto(photo)}
                  disabled={pending}
                /> : null}
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
        {canDelete && job.status === "scheduled" && !job.notes.trim() && !job.photos.length && !job.fieldNotes?.length ? (
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
