"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, Plus } from "lucide-react";
import type { Job } from "../domain";
import { downloadIcs, jobsToIcs } from "../data/calendar-ics";
import { WEEKDAY_LABELS, monthCells, padMonthDay } from "../data/calendar-grid";
import { displayServiceCategory } from "../data/service-catalog";
import {
  brisbaneTodayKey,
  currentMonthStart,
  formatCalendarEvent,
  formatSiteTitle,
} from "../data/work-identity";
import { Button, EmptyState, IconButton, PageHeader } from "../components/ui-elements";
import { Dialog } from "../components/dialog";

export function ScheduleView({
  jobs,
  canSchedule = true,
  organizerEmail,
  onSchedule,
  onJob,
}: {
  jobs: Job[];
  canSchedule?: boolean;
  organizerEmail?: string;
  onSchedule: (dateKey?: string) => void;
  onJob: (job: Job) => void;
}) {
  const [month, setMonth] = useState(() => currentMonthStart());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const calendarCells = monthCells(year, monthIndex);
  const todayKey = brisbaneTodayKey();

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

  const exportMonth = () => {
    downloadIcs(
      `mow-glow-${monthPrefix.slice(0, 7)}.ics`,
      jobsToIcs(visibleJobs, organizerEmail),
    );
  };

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Calendar">
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
        <Button
          variant="secondary"
          icon={Download}
          onClick={exportMonth}
          disabled={!visibleJobs.length}
        >
          Export .ics
        </Button>
        {canSchedule ? (
          <Button onClick={() => onSchedule()}>Schedule a job</Button>
        ) : null}
      </PageHeader>
      <div className="calendar-wrap">
        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarCells.map((day, index) => {
            const dayJobs = day ? jobsByDay.get(day) || [] : [];
            const dateKey = day ? padMonthDay(year, monthIndex, day) : "";
            const isToday = Boolean(dateKey) && dateKey === todayKey;
            return (
              <div
                className={`calendar-day ${day ? "" : "calendar-day--empty"} ${dayJobs.length ? "calendar-day--busy" : ""} ${isToday ? "calendar-day--today" : ""}`}
                key={`${monthPrefix}${index}`}
              >
                {day ? (
                  <button
                    className="calendar-day__open"
                    type="button"
                    aria-label={`Open ${day} ${monthLabel}${dayJobs.length ? `, ${dayJobs.length} jobs` : ", no jobs"}${isToday ? ", today" : ""}`}
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
                  {dayJobs.slice(0, 2).map((job) => {
                    const event = formatCalendarEvent(job);
                    return (
                      <button
                        className={`calendar-event calendar-event--${job.status}`}
                        key={job.id}
                        title={job.displayName}
                        onClick={() => onJob(job)}
                      >
                        <span>{event.primary}</span>
                        <small>{event.secondary}</small>
                      </button>
                    );
                  })}
                  {dayJobs.length > 2 ? (
                    <button
                      className="calendar-day__more"
                      type="button"
                      onClick={() => setSelectedDateKey(dateKey)}
                    >
                      +{dayJobs.length - 2} more
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
            <span>
              {job.date}
              {job.time ? ` · ${job.time}` : ""}
            </span>
            <strong>{job.client}</strong>
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
              {canSchedule ? (
              <Button
                icon={Plus}
                onClick={() => {
                  const day = selectedDateKey;
                  setSelectedDateKey(null);
                  onSchedule(day);
                }}
              >
                Schedule another job
              </Button>
              ) : null}
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
                      <strong>{formatSiteTitle(job)}</strong>
                      <span>{job.address}</span>
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
                action={canSchedule ? "Schedule a job" : undefined}
                onAction={
                  canSchedule
                    ? () => {
                        const day = selectedDateKey;
                        setSelectedDateKey(null);
                        onSchedule(day);
                      }
                    : undefined
                }
              />
            )}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
