"use client";

import { CalendarPlus } from "lucide-react";
import { JobCard, type JobCardActions } from "../components/job-card";
import { Button, PageHeader } from "../components/ui-elements";
import { brisbaneDateLabel } from "@/lib/brand";
import { brisbaneDateKey } from "../data/work-identity";
import type { Job } from "../domain";

export function TodayView({
  jobs, onSchedule, onAllJobs, ...actions
}: JobCardActions & {
  jobs: Job[];
  onSchedule?: () => void;
  onAllJobs: () => void;
}) {
  const today = brisbaneDateKey();
  const visible = jobs.filter((job) => actions.canManage || job.assigneeIds.includes(actions.currentMemberId ?? ""));
  const todaysJobs = visible
    .filter((job) => job.dateKey.slice(0, 10) === today && job.status !== "cancelled")
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey));
  const upcoming = visible
    .filter((job) => job.dateKey.slice(0, 10) > today && job.status !== "completed" && job.status !== "cancelled")
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(0, 7);

  return (
    <>
      <PageHeader eyebrow="" title="Today" subtitle={brisbaneDateLabel()}>
        {onSchedule ? <Button icon={CalendarPlus} onClick={onSchedule}>Schedule job</Button> : null}
      </PageHeader>
      <section aria-label="Today's scheduled jobs" className="field-job-list">
        {todaysJobs.length ? todaysJobs.map((job) => <JobCard key={job.id} job={job} {...actions} />) : <p>No jobs scheduled today.</p>}
      </section>
      <section className="field-job-list" aria-labelledby="upcoming-work">
        <h2 id="upcoming-work">Upcoming jobs</h2>
        {upcoming.length ? upcoming.map((job) => <JobCard key={job.id} job={job} {...actions} />) : <p>No upcoming jobs.</p>}
      </section>
      <Button variant="secondary" onClick={onAllJobs}>View all jobs</Button>
    </>
  );
}
