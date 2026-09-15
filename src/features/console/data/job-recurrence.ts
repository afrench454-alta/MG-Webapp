import { formatJobDisplayName } from "./work-identity";
import type { Job } from "../domain";

export const JOB_RECURRENCE_VALUES = [
  "One-off",
  "Weekly",
  "Fortnightly",
  "Four-weekly",
  "Monthly",
] as const;

export type JobRecurrence = (typeof JOB_RECURRENCE_VALUES)[number];

const BRISBANE_OFFSET = "+10:00";
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export function asJobRecurrence(value: string): JobRecurrence {
  return JOB_RECURRENCE_VALUES.find((item) => item === value) ?? "One-off";
}

export function isRepeatingRecurrence(value: string): boolean {
  return asJobRecurrence(value) !== "One-off";
}

export function recurrenceToDb(value: string): {
  frequency: "weekly" | "monthly";
  intervalCount: number;
} {
  const recurrence = asJobRecurrence(value);
  if (recurrence === "Monthly") return { frequency: "monthly", intervalCount: 1 };
  if (recurrence === "Fortnightly") return { frequency: "weekly", intervalCount: 2 };
  if (recurrence === "Four-weekly") return { frequency: "weekly", intervalCount: 4 };
  return { frequency: "weekly", intervalCount: 1 };
}

/** Interpret a Brisbane local `YYYY-MM-DDTHH:MM` key as an instant. */
export function dateKeyToIso(dateKey: string): string | null {
  const match = dateKey.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (!match) return null;
  const iso = `${match[1]}:00${BRISBANE_OFFSET}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function formatBrisbaneSchedule(iso: string): {
  date: string;
  time: string;
  dateKey: string;
} {
  const instant = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  const dateKey = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  return {
    date: new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Australia/Brisbane",
    }).format(instant),
    time: new Intl.DateTimeFormat("en-AU", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Brisbane",
    }).format(instant),
    dateKey,
  };
}

export function nextScheduledIso(
  scheduledStartIso: string,
  recurrence: string,
): string | null {
  const label = asJobRecurrence(recurrence);
  if (label === "One-off") return null;
  const start = new Date(scheduledStartIso);
  if (Number.isNaN(start.getTime())) return null;
  const next = new Date(start.getTime());
  if (label === "Weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (label === "Fortnightly") next.setUTCDate(next.getUTCDate() + 14);
  else if (label === "Four-weekly") next.setUTCDate(next.getUTCDate() + 28);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next.toISOString();
}

function withDisplayName(job: Job): Job {
  return {
    ...job,
    displayName: formatJobDisplayName({
      client: job.client,
      address: job.address,
      property: job.property,
      category: job.category,
      date: job.date,
    }),
  };
}

/** Park the job on the board without deleting it or its notes/team. */
export function clearJobSchedule(job: Job): Job {
  const parked =
    job.status === "completed" || job.status === "cancelled"
      ? job.status
      : "unscheduled";
  return withDisplayName({
    ...job,
    date: "Unscheduled",
    time: "",
    dateKey: "",
    status: parked,
  });
}

export function applyJobSchedule(
  job: Job,
  dateKey: string,
  status?: Job["status"],
): Job {
  const iso = dateKeyToIso(dateKey);
  if (!iso) return clearJobSchedule(job);
  const schedule = formatBrisbaneSchedule(iso);
  const nextStatus =
    status ?? (job.status === "unscheduled" ? "scheduled" : job.status);
  return withDisplayName({
    ...job,
    ...schedule,
    status: nextStatus,
  });
}

export function scheduledStartPayload(
  job: Pick<Job, "status" | "dateKey">,
): string | null {
  if (job.status === "unscheduled") return null;
  return dateKeyToIso(job.dateKey);
}

export function scheduleWindow(iso: string): {
  scheduledStart: string;
  scheduledEnd: string;
} {
  const start = new Date(iso);
  return {
    scheduledStart: start.toISOString(),
    scheduledEnd: new Date(start.getTime() + DEFAULT_DURATION_MS).toISOString(),
  };
}

export function describeJobUpdate(previous: Job | undefined, next: Job): string {
  if (!previous) {
    return `Job moved to ${next.status.replace("-", " ")}.`;
  }
  if (next.status === "unscheduled" && previous.status !== "unscheduled") {
    return "Job cleared from the calendar.";
  }
  if (previous.dateKey !== next.dateKey && next.dateKey) {
    return `Job moved to ${next.date}${next.time ? ` · ${next.time}` : ""}.`;
  }
  if (previous.status !== next.status) {
    return `Job moved to ${next.status.replace("-", " ")}.`;
  }
  return "Job saved.";
}

export function buildNextDemoJob(job: Job, nextId: string): Job | null {
  if (job.status !== "completed" || !isRepeatingRecurrence(job.recurrence)) {
    return null;
  }
  const currentIso = dateKeyToIso(job.dateKey);
  if (!currentIso) return null;
  const nextIso = nextScheduledIso(currentIso, job.recurrence);
  if (!nextIso) return null;
  const schedule = formatBrisbaneSchedule(nextIso);
  return {
    ...job,
    id: nextId,
    status: "scheduled",
    date: schedule.date,
    time: schedule.time,
    dateKey: schedule.dateKey,
    photos: [],
    displayName: formatJobDisplayName({
      client: job.client,
      address: job.address,
      property: job.property,
      category: job.category,
      date: schedule.date,
    }),
  };
}
