"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { Job } from "../domain";
import { displayServiceCategory } from "../data/service-catalog";
import { Button, EmptyState, IconButton, PageHeader } from "../components/ui-elements";
import { Dialog } from "../components/dialog";

export function ScheduleView({
  jobs,
  onSchedule,
  onJob,
}: {
  jobs: Job[];
  onSchedule: () => void;
  onJob: (job: Job) => void;
}) {
  const [month, setMonth] = useState(() => new Date(2026, 7, 1));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingDays = new Date(year, monthIndex, 1).getDay();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - leadingDays + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
  const monthLabel = new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
  }).format(month);

  const visibleJobs = jobs.filter((job) => job.dateKey.startsWith(monthPrefix));
  const jobsByDay = new Map<number, Job[]>();
  for (const job of visibleJobs) {
    const day = Number(job.dateKey.slice(8, 10));
    jobsByDay.set(day, [...(jobsByDay.get(day) || []), job]);
  }
  jobsByDay.forEach((dayJobs) =>
    dayJobs.sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
  );

  const selectedJobs = selectedDateKey
    ? jobs
        .filter((job) => job.dateKey.startsWith(selectedDateKey))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    : [];

  const selectedDayLabel = selectedDateKey
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Australia/Brisbane",
      }).format(new Date(`${selectedDateKey}T00:00:00+10:00`))
    : "";

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Schedule">
        <div className="month-switcher">
          <IconButton
            label="Previous month"
            icon={ArrowLeft}
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
          />
          <strong>{monthLabel}</strong>
          <IconButton
            label="Next month"
            icon={ArrowRight}
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
          />
        </div>
        <Button onClick={onSchedule}>Schedule a job</Button>
      </PageHeader>
      <div className="calendar-wrap">
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarCells.map((day, index) => {
            const dayJobs = day ? jobsByDay.get(day) || [] : [];
            const dateKey = day
              ? `${monthPrefix}${String(day).padStart(2, "0")}`
              : "";
            return (
              <div
                className={`calendar-day ${day ? "" : "calendar-day--empty"} ${dayJobs.length ? "calendar-day--busy" : ""}`}
                key={`${monthPrefix}${index}`}
              >
                {day ? (
                  <button
                    className="calendar-day__open"
                    type="button"
                    aria-label={`Open ${day} ${monthLabel}${dayJobs.length ? `, ${dayJobs.length} jobs` : ", no jobs"}`}
                    onClick={() => setSelectedDateKey(dateKey)}
                  >
                    <span>{day}</span>
                    {dayJobs.length ? (
                      <strong className="calendar-day__count">
                        {dayJobs.length}
                      </strong>
                    ) : null}
                  </button>
                ) : null}
                <div className="calendar-day__events">
                  {dayJobs.slice(0, 1).map((job) => (
                    <button
                      className={`calendar-event calendar-event--${job.status}`}
                      key={job.id}
                      title={job.displayName}
                      onClick={() => onJob(job)}
                    >
                      <span>
                        {job.time} · {job.client}
                      </span>
                      <small>{job.address}</small>
                    </button>
                  ))}
                  {dayJobs.length > 1 ? (
                    <button
                      className="calendar-day__more"
                      type="button"
                      onClick={() => setSelectedDateKey(dateKey)}
                    >
                      +{dayJobs.length - 1} more
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mobile-agenda">
        {visibleJobs.map((job) => (
          <button key={job.id} onClick={() => onJob(job)}>
            <span>{job.date}</span>
            <strong>{job.displayName}</strong>
            <small>{job.address}</small>
          </button>
        ))}
        {!visibleJobs.length ? (
          <div className="empty-state">
            <p>No jobs scheduled for {monthLabel}.</p>
          </div>
        ) : null}
      </div>
      {selectedDateKey ? (
        <Dialog
          title={selectedDayLabel}
          onClose={() => setSelectedDateKey(null)}
          wide
        >
          <div className="day-agenda">
            <div className="day-agenda__header">
              <div>
                <p className="eyebrow">Daily schedule</p>
                <strong>
                  {selectedJobs.length} job
                  {selectedJobs.length === 1 ? "" : "s"}
                </strong>
              </div>
              <Button
                icon={Plus}
                onClick={() => {
                  setSelectedDateKey(null);
                  onSchedule();
                }}
              >
                Schedule another job
              </Button>
            </div>
            {selectedJobs.length ? (
              <div className="day-agenda__list">
                {selectedJobs.map((job, index) => (
                  <button
                    type="button"
                    key={job.id}
                    onClick={() => {
                      setSelectedDateKey(null);
                      onJob(job);
                    }}
                  >
                    <time>{job.time || "Time TBC"}</time>
                    <span className="day-agenda__line" aria-hidden="true">
                      <i />
                      {index < selectedJobs.length - 1 ? <b /> : null}
                    </span>
                    <div>
                      <strong>{job.client}</strong>
                      <span>
                        {job.property} · {job.address}
                      </span>
                      <small>
                        {displayServiceCategory(job.category)} · {job.status.replace("-", " ")}
                        {job.assignees.length
                          ? ` · ${job.assignees.join(", ")}`
                          : " · Unassigned"}
                      </small>
                    </div>
                    <ArrowRight aria-hidden="true" size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No jobs scheduled for this day."
                action="Schedule a job"
                onAction={() => {
                  setSelectedDateKey(null);
                  onSchedule();
                }}
              />
            )}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
