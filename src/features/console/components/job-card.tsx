"use client";

import { CalendarDays, CheckCircle2, GripVertical, MapPin, Play, ReceiptText, Trash2 } from "lucide-react";
import { statusColumns, type Job, type JobStatus } from "../domain";
import { stripJobOpsSentinel } from "../data/joseph-next-stop";
import { displayServiceCategory, displayServiceDetail } from "../data/service-catalog";
import { formatSiteTitle, formatWhen } from "../data/work-identity";
import { Badge, IconButton } from "./ui-elements";

export type JobCardActions = {
  canManage: boolean;
  currentMemberId?: string;
  onJob: (job: Job) => void;
  onMove: (id: string, status: JobStatus) => void;
  onDelete?: (job: Job) => void;
  onDraftInvoiceForJob?: (job: Job) => void;
  onViewInvoiceForJob?: (job: Job) => void;
};

export function JobCard({
  job, canManage, currentMemberId, onJob, onMove, onDelete,
  onDraftInvoiceForJob, onViewInvoiceForJob, invoiced,
  onDragStart, onDragEnd, dragging,
}: JobCardActions & {
  job: Job;
  invoiced?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const canWork = canManage || Boolean(currentMemberId && job.assigneeIds.includes(currentMemberId));
  const active = job.status !== "completed" && job.status !== "cancelled";
  const start = canWork && active && job.status !== "in-progress";
  const complete = canWork && active && (canManage || ["in-progress", "on-hold"].includes(job.status));
  const invoice = canManage && job.status === "completed";
  const scope = job.scope || stripJobOpsSentinel(job.notes);
  const service = displayServiceDetail(job.category);

  return (
    <article
      className={`job-card${dragging ? " job-card--dragging" : ""}`}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {onDragStart ? <span className="drag-handle"><GripVertical aria-hidden="true" size={15} /></span> : null}
      <button type="button" className="job-card__open" onClick={() => onJob(job)}>
        <span className="job-card__meta">
          <Badge tone="sage">{displayServiceCategory(job.category)}</Badge>
          <Badge>{statusColumns.find((column) => column.id === job.status)?.label}</Badge>
        </span>
        <strong>{job.client}</strong>
        <span className="job-card__property">{job.address}</span>
        <span className="job-card__when tabular-nums">{formatWhen(job) || job.date || "Unscheduled"}</span>
        {service ? <span className="job-card__detail">{service}</span> : null}
        {scope ? <span className="job-card__scope-preview">{scope}</span> : null}
        <small>{job.assignees.length ? job.assignees.join(", ") : "Unassigned"}</small>
      </button>

      <div className="job-card__field-footer">
        {job.address ? (
          <a className="job-card__map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer">
            <MapPin size={14} aria-hidden="true" /> Navigate
          </a>
        ) : null}
        {canManage && active ? (
          <button type="button" className="button button--secondary job-card__action-btn" onClick={() => onJob(job)}>
            <CalendarDays size={14} aria-hidden="true" /> {job.dateKey ? "Reschedule" : "Schedule"}
          </button>
        ) : null}
        {start ? (
          <button type="button" className="button button--primary job-card__action-btn" onClick={() => onMove(job.id, "in-progress")}>
            <Play size={14} aria-hidden="true" /> Start
          </button>
        ) : null}
        {complete ? (
          <button type="button" className="button button--primary job-card__action-btn" onClick={() => onMove(job.id, "completed")}>
            <CheckCircle2 size={14} aria-hidden="true" /> Complete
          </button>
        ) : null}
        {invoice && invoiced && onViewInvoiceForJob ? (
          <button type="button" className="button button--primary job-card__action-btn" onClick={() => onViewInvoiceForJob(job)}>
            <ReceiptText size={14} aria-hidden="true" /> View invoice
          </button>
        ) : null}
        {invoice && !invoiced && onDraftInvoiceForJob ? (
          <button type="button" className="button button--primary job-card__action-btn" onClick={() => onDraftInvoiceForJob(job)}>
            <ReceiptText size={14} aria-hidden="true" /> Create invoice
          </button>
        ) : null}
      </div>
      {canManage && job.status === "scheduled" && !job.notes.trim() && !job.photos.length && onDelete ? (
        <IconButton className="job-card__delete" label={`Delete job for ${formatSiteTitle(job)}`} icon={Trash2} tone="danger" onClick={() => onDelete(job)} />
      ) : null}
    </article>
  );
}
