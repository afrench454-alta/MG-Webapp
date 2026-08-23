"use client";

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { statusColumns, type Job, type JobStatus } from "../domain";
import { Badge, IconButton, PageHeader } from "../components/ui-elements";

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

  return (
    <>
      <PageHeader
        eyebrow="Execution"
        title="Job Board"
        subtitle="Track jobs from scheduled to completed. Select a card to add photos and notes."
      />
      <section className="job-board" aria-label="Job board">
        {statusColumns.map((column) => {
          const columnJobs = jobs.filter((job) => job.status === column.id);
          return (
            <div
              className="job-column"
              key={column.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dragging && onMove(dragging, column.id)}
            >
              <div className="job-column__header">
                <h2>{column.label}</h2>
                <Badge>{columnJobs.length}</Badge>
              </div>
              {columnJobs.map((job) => (
                <article
                  className="job-card"
                  key={job.id}
                  draggable
                  onDragStart={() => setDragging(job.id)}
                  onDragEnd={() => setDragging(null)}
                >
                  <button
                    className="job-card__open"
                    type="button"
                    onClick={() => onJob(job)}
                  >
                    <span className="drag-handle">
                      <GripVertical aria-hidden="true" size={15} />
                    </span>
                    <Badge tone="sage">{job.category}</Badge>
                    <strong>{job.displayName}</strong>
                    <p>{job.scope}</p>
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
              ))}
              {!columnJobs.length ? (
                <div className="job-column__empty">
                  Drop or move a job here
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </>
  );
}
