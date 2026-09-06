"use client";

import { useMemo, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { statusColumns, type Job, type JobStatus } from "../domain";
import {
  displayServiceCategory,
  displayServiceDetail,
} from "../data/service-catalog";
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
  onJob,
  onMove,
  onDelete,
}: {
  jobs: Job[];
  onJob: (job: Job) => void;
  onMove: (id: string, status: JobStatus) => void;
  onDelete: (job: Job) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [board, setBoard] = useState<"active" | "done">("active");
  const doneCount = jobs.filter(
    (job) => job.status === "completed" || job.status === "cancelled",
  ).length;
  const visibleColumns = useMemo(
    () =>
      statusColumns.filter((column) =>
        board === "done"
          ? column.id === "completed" || column.id === "cancelled"
          : activeColumnIds.includes(column.id),
      ),
    [board],
  );

  return (
    <>
      <PageHeader
        eyebrow="Execution"
        title="Job Board"
        subtitle="Active work only. Completed and cancelled jobs live on the Done board."
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
      <section
        className={`job-board job-board--${board}`}
        aria-label="Job board"
      >
        {visibleColumns.map((column) => {
          const columnJobs = jobs.filter((job) => job.status === column.id);
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
                        <small>{job.date}</small>
                      </span>
                      <strong>{job.client}</strong>
                      <span className="job-card__property">{job.address}</span>
                      {serviceType ? (
                        <span className="job-card__detail">{serviceType}</span>
                      ) : null}
                      <small>
                        {job.assignees.length
                          ? job.assignees.join(", ")
                          : "Unassigned"}
                      </small>
                    </button>
                    <IconButton
                      className="job-card__delete"
                      label={`Delete job for ${job.client} on ${job.date}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => onDelete(job)}
                    />
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
