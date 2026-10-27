"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, GripVertical, MapPin, Play, ReceiptText, Trash2 } from "lucide-react";
import { statusColumns, type Invoice, type Job, type JobStatus, type TeamMember } from "../domain";
import { liveInvoicedJobIds } from "../data/form-options";
import { stripJobOpsSentinel } from "../data/joseph-next-stop";
import {
  displayServiceCategory,
  displayServiceDetail,
} from "../data/service-catalog";
import { formatSiteTitle, formatWhen } from "../data/work-identity";
import {
  Badge,
  FilterGroup,
  IconButton,
  PageHeader,
} from "../components/ui-elements";

const activeColumnIds: JobStatus[] = [
  "unscheduled",
  "scheduled",
  "in-progress",
  "on-hold",
];

export function JobBoardView({
  jobs,
  invoices = [],
  teamMembers = [],
  currentMemberId,
  preferMine = false,
  canDelete = true,
  onJob,
  onMove,
  onDelete,
  onDraftInvoiceForJob,
}: {
  jobs: Job[];
  invoices?: Invoice[];
  teamMembers?: TeamMember[];
  currentMemberId?: string;
  preferMine?: boolean;
  canDelete?: boolean;
  onJob: (job: Job) => void;
  onMove: (id: string, status: JobStatus) => void;
  onDelete: (job: Job) => void;
  onDraftInvoiceForJob?: (job: Job) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [board, setBoard] = useState<"active" | "done">("active");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(
    preferMine && currentMemberId ? "mine" : "all",
  );
  const invoicedJobIds = useMemo(() => liveInvoicedJobIds(invoices), [invoices]);
  const doneCount = jobs.filter(
    (job) => job.status === "completed" || job.status === "cancelled",
  ).length;

  const filteredJobs = useMemo(() => {
    if (assigneeFilter === "all") return jobs;
    if (assigneeFilter === "unassigned") {
      return jobs.filter((job) => !job.assigneeIds.length);
    }
    if (assigneeFilter === "mine" && currentMemberId) {
      return jobs.filter((job) => job.assigneeIds.includes(currentMemberId));
    }
    return jobs.filter((job) => job.assigneeIds.includes(assigneeFilter));
  }, [jobs, assigneeFilter, currentMemberId]);

  const visibleColumns = useMemo(
    () =>
      statusColumns.filter((column) =>
        board === "done"
          ? column.id === "completed" || column.id === "cancelled"
          : activeColumnIds.includes(column.id),
      ),
    [board],
  );

  const assigneeOptions = [
    { id: "all", label: "All", count: jobs.length },
    ...(currentMemberId
      ? [
          {
            id: "mine",
            label: "My jobs",
            count: jobs.filter((job) =>
              job.assigneeIds.includes(currentMemberId),
            ).length,
          },
        ]
      : []),
    {
      id: "unassigned",
      label: "Unassigned",
      count: jobs.filter((job) => !job.assigneeIds.length).length,
    },
    ...teamMembers
      .filter((member) => member.isActive && member.id !== currentMemberId)
      .map((member) => ({
        id: member.id,
        label: member.name,
        count: jobs.filter((job) => job.assigneeIds.includes(member.id)).length,
      })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Execution"
        title="Job Board"
        subtitle="Cards show the client and property so two same-day cleans stay distinct."
      >
        <FilterGroup
          label="Board view"
          value={board}
          onChange={setBoard}
          options={[
            { id: "active", label: "Active", count: jobs.length - doneCount },
            { id: "done", label: "Done", count: doneCount },
          ]}
        />
      </PageHeader>
      {assigneeOptions.length > 2 ? (
        <section className="list-filters" aria-label="Assigned team filter">
          <FilterGroup
            label="Assigned to"
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={assigneeOptions}
          />
        </section>
      ) : null}
      <section
        className={`job-board job-board--${board}`}
        aria-label="Job board"
      >
        {visibleColumns.map((column) => {
          const columnJobs = filteredJobs.filter((job) => job.status === column.id);
          return (
            <div
              className={`job-column job-column--${column.id}${
                dragging ? " job-column--droppable" : ""
              }`}
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && onMove(dragging, column.id)}
            >
              <div className="job-column__header">
                <h2>{column.label}</h2>
                <Badge>{columnJobs.length}</Badge>
              </div>
              {columnJobs.map((job) => {
                const serviceType = displayServiceDetail(job.category);
                const cleanNotes = stripJobOpsSentinel(job.notes);
                const scopePreview = job.scope || cleanNotes;
                const isReadyToInvoice =
                  job.status === "completed" && !invoicedJobIds.has(job.id);
                const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  job.address,
                )}`;
                return (
                  <article
                    className={`job-card${
                      dragging === job.id ? " job-card--dragging" : ""
                    }`}
                    key={job.id}
                    draggable
                    onDragStart={() => setDragging(job.id)}
                    onDragEnd={() => setDragging(null)}
                  >
                    <span className="drag-handle">
                      <GripVertical aria-hidden="true" size={15} />
                    </span>
                    <button
                      className="job-card__open"
                      type="button"
                      onClick={() => onJob(job)}
                    >
                      <span className="job-card__meta">
                        <Badge tone="sage">
                          {displayServiceCategory(job.category)}
                        </Badge>
                        {isReadyToInvoice ? (
                          <Badge tone="amber">Ready to Invoice</Badge>
                        ) : null}
                      </span>
                      <strong>{job.client}</strong>
                      <span className="job-card__property">{job.address}</span>
                      <span className="job-card__when tabular-nums">
                        {formatWhen(job) || job.date || "Unscheduled"}
                      </span>
                      {serviceType ? (
                        <span className="job-card__detail">{serviceType}</span>
                      ) : null}
                      {scopePreview ? (
                        <span className="job-card__scope-preview">
                          {scopePreview}
                        </span>
                      ) : null}
                      <small>
                        {job.assignees.length
                          ? job.assignees.join(", ")
                          : "Unassigned"}
                      </small>
                    </button>

                    <div className="job-card__field-footer">
                      <a
                        className="job-card__map-link"
                        href={mapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MapPin size={13} aria-hidden="true" />
                        <span>Navigate</span>
                      </a>

                      {job.status === "scheduled" ||
                      job.status === "unscheduled" ||
                      job.status === "on-hold" ? (
                        <button
                          type="button"
                          className="button button--primary job-card__action-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMove(job.id, "in-progress");
                          }}
                        >
                          <Play size={14} aria-hidden="true" />
                          <span>Start Job</span>
                        </button>
                      ) : job.status === "in-progress" ? (
                        <button
                          type="button"
                          className="button button--primary job-card__action-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onMove(job.id, "completed");
                          }}
                        >
                          <CheckCircle2 size={14} aria-hidden="true" />
                          <span>Complete</span>
                        </button>
                      ) : isReadyToInvoice && onDraftInvoiceForJob ? (
                        <button
                          type="button"
                          className="button button--primary job-card__action-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDraftInvoiceForJob(job);
                          }}
                        >
                          <ReceiptText size={14} aria-hidden="true" />
                          <span>Draft Invoice</span>
                        </button>
                      ) : null}
                    </div>

                    {canDelete ? (
                    <IconButton
                      className="job-card__delete"
                      label={`Delete job for ${formatSiteTitle(job)} on ${job.date}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => onDelete(job)}
                    />
                    ) : null}
                  </article>
                );
              })}
              {!columnJobs.length ? (
                <div className="job-column__empty">Drop a job here</div>
              ) : null}
            </div>
          );
        })}
      </section>
    </>
  );
}
