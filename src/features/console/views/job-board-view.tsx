"use client";

import { useState } from "react";
import { JobCard, type JobCardActions } from "../components/job-card";
import { Badge, FilterGroup, PageHeader } from "../components/ui-elements";
import { liveInvoicedJobIds } from "../data/form-options";
import { statusColumns, type Invoice, type Job, type JobStatus, type TeamMember } from "../domain";

export function JobBoardView({
  jobs, invoices = [], teamMembers = [], preferMine = false, phone = false, ...actions
}: JobCardActions & {
  jobs: Job[];
  invoices?: Invoice[];
  teamMembers?: TeamMember[];
  preferMine?: boolean;
  phone?: boolean;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [board, setBoard] = useState<"active" | "done">("active");
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const [assignee, setAssignee] = useState(preferMine && actions.currentMemberId ? "mine" : "all");
  const invoicedJobIds = liveInvoicedJobIds(invoices);
  const terminal = (jobStatus: JobStatus) => jobStatus === "completed" || jobStatus === "cancelled";
  const belongsTo = (job: Job, filter: string) =>
    filter === "all" || (filter === "unassigned"
      ? !job.assigneeIds.length
      : job.assigneeIds.includes(filter === "mine" ? actions.currentMemberId ?? "" : filter));
  const filtered = jobs.filter((job) => belongsTo(job, assignee));
  const doneCount = filtered.filter((job) => terminal(job.status)).length;
  const assigneeOptions = [
    { id: "all", label: "All" },
    ...(actions.currentMemberId ? [{ id: "mine", label: "My jobs" }] : []),
    { id: "unassigned", label: "Unassigned" },
    ...teamMembers.filter((member) => member.isActive && member.id !== actions.currentMemberId)
      .map((member) => ({ id: member.id, label: member.name })),
  ].map((option) => ({ ...option, count: jobs.filter((job) => belongsTo(job, option.id)).length }));

  return (
    <>
      <PageHeader eyebrow="" title={phone ? "Jobs" : "Job Board"}>
        {phone ? (
          <label className="job-status-filter">
            <span>Job status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as JobStatus | "all")}>
              <option value="all">All</option>
              {statusColumns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}
            </select>
          </label>
        ) : (
          <FilterGroup label="Board view" value={board} onChange={setBoard} options={[
            { id: "active", label: "Active", count: filtered.length - doneCount },
            { id: "done", label: "Done", count: doneCount },
          ]} />
        )}
      </PageHeader>
      {phone ? (
        <label className="job-status-filter">
          <span>Assigned to</span>
          <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      ) : assigneeOptions.length > 2 ? (
        <section className="list-filters" aria-label="Assigned team filter">
          <FilterGroup label="Assigned to" value={assignee} onChange={setAssignee} options={assigneeOptions} />
        </section>
      ) : null}
      {phone ? (
        <section className="field-job-list" aria-label="Jobs list">
          {filtered.some((job) => status === "all" || status === job.status)
            ? filtered.filter((job) => status === "all" || status === job.status).map((job) => (
                <JobCard key={job.id} job={job} invoiced={invoicedJobIds.has(job.id)} {...actions} />
              ))
            : <p>No jobs match these filters.</p>}
        </section>
      ) : (
        <section className={`job-board job-board--${board}`} aria-label="Job board">
          {statusColumns.filter((column) => terminal(column.id) === (board === "done")).map((column) => {
            const columnJobs = filtered.filter((job) => job.status === column.id);
            return (
              <div
                className={`job-column job-column--${column.id}${dragging ? " job-column--droppable" : ""}`}
                key={column.id}
                onDragOver={(event) => { if (dragging && !terminal(column.id)) event.preventDefault(); }}
                onDrop={() => { if (dragging && !terminal(column.id)) actions.onMove(dragging, column.id); }}
              >
                <div className="job-column__header"><h2>{column.label}</h2><Badge>{columnJobs.length}</Badge></div>
                {columnJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    invoiced={invoicedJobIds.has(job.id)}
                    dragging={dragging === job.id}
                    onDragStart={actions.canManage && !terminal(job.status) ? () => setDragging(job.id) : undefined}
                    onDragEnd={() => setDragging(null)}
                    {...actions}
                  />
                ))}
                {!columnJobs.length ? <div className="job-column__empty">No jobs</div> : null}
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
