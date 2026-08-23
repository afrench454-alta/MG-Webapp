"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, PauseCircle, PlayCircle, RotateCcw, Trash2 } from "lucide-react";
import type { Job, JobPhoto, JobStatus, TeamMember } from "../domain";
import { Button, Field, IconButton } from "../components/ui-elements";

export function JobDetailsDialog({
  job,
  teamMembers,
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
  teamMembers: TeamMember[];
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

  const updateStatus = (status: JobStatus) =>
    onUpdate({ ...job, status, notes, recurrence });

  const toggleAssignee = (profileId: string) => {
    const next = assigneeIds.includes(profileId)
      ? assigneeIds.filter((id) => id !== profileId)
      : [...assigneeIds, profileId];
    setAssigneeIds(next);
    onAssign(next);
  };

  return (
    <div className="job-detail">
      <div className="job-facts">
        <div>
          <p className="eyebrow">Address</p>
          <span>{job.address}</span>
        </div>
        <div>
          <p className="eyebrow">Scheduled</p>
          <span>{job.date}</span>
        </div>
        <div className="job-facts__scope">
          <p className="eyebrow">Scope</p>
          <span>{job.scope}</span>
        </div>
      </div>
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
          {teamMembers.map((member) => (
            <label key={member.id}>
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
                </small>
              </span>
            </label>
          ))}
        </div>
      </section>
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
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => onDelete(job)}
        >
          Delete job
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
