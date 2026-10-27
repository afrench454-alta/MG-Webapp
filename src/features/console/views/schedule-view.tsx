"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { Job } from "../domain";
import { displayServiceCategory } from "../data/service-catalog";
import {
  brisbaneDateKey,
  currentMonthStart,
  formatCalendarEvent,
  formatSiteTitle,
} from "../data/work-identity";
import { Button, EmptyState, IconButton, PageHeader } from "../components/ui-elements";
import { Dialog } from "../components/dialog";

export function ScheduleView({
  jobs,
  canSchedule = true,
  onSchedule,
  onJob,
}: {
  jobs: Job[];
  canSchedule?: boolean;
  onSchedule: () => void;
  onJob: (job: Job) => void;
}) {
  const [month, setMonth] = useState(() => currentMonthStart());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const todayKey = useMemo(() => brisbaneDateKey(), []);
  const todayAgendaRef = useRef<HTMLButtonElement | null>(null);

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

  /** Upcoming-from-today first; earlier days of the month follow so today stays near the top. */
  const agendaJobs = useMemo(() => {
    const dayOf = (dateKey: string) => dateKey.slice(0, 10);
    const monthJobs = jobs.filter((job) => job.dateKey.startsWith(monthPrefix));
    const sorted = [...monthJobs].sort((a, b) =>
      a.dateKey.localeCompare(b.dateKey),
    );
    const upcoming = sorted.filter((job) => dayOf(job.dateKey) >= todayKey);
    const past = sorted.filter((job) => dayOf(job.dateKey) < todayKey);
    return [...upcoming, ...past];
  }, [jobs, monthPrefix, todayKey]);

  const firstTodayOrUpcomingId = useMemo(() => {
    const dayOf = (dateKey: string) => dateKey.slice(0, 10);
    const todayJob = agendaJobs.find((job) => dayOf(job.dateKey) === todayKey);
    if (todayJob) return todayJob.id;
    return agendaJobs.find((job) => dayOf(job.dateKey) > todayKey)?.id ?? null;
  }, [agendaJobs, todayKey]);

  useEffect(() => {
    todayAgendaRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [monthPrefix, firstTodayOrUpcomingId]);

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
        {canSchedule ? (
          <Button onClick={onSchedule}>Schedule a job</Button>
        ) : null}
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
            const isToday = Boolean(day && dateKey === todayKey);
            return (
              <div
                className={`calendar-day ${day ? "" : "calendar-day--empty"} ${dayJobs.length ? "calendar-day--busy" : ""} ${isToday ? "calendar-day--today" : ""}`}
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
        {agendaJobs.map((job) => {
          const isAnchor = job.id === firstTodayOrUpcomingId;
          return (
            <button
              key={job.id}
              ref={isAnchor ? todayAgendaRef : undefined}
              type="button"
              onClick={() => onJob(job)}
              data-agenda-day={job.dateKey.slice(0, 10)}
            >
              <span>
                {job.date}
                {job.time ? ` · ${job.time}` : ""}
              </span>
              <strong>{job.client}</strong>
              <small>{job.address}</small>
            </button>
          );
        })}
        {!agendaJobs.length ? (
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
                  setSelectedDateKey(null);
                  onSchedule();
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
                        setSelectedDateKey(null);
                        onSchedule();
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
