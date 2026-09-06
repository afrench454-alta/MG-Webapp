import { formatSiteTitle } from "./work-identity";

export type SchedulableJob = {
  id: string;
  dateKey: string;
  assigneeIds: string[];
  client: string;
  address?: string | null;
  property?: string | null;
  status?: string;
};

export type AssignmentConflict = {
  profileId: string;
  name: string;
  otherLabel: string;
};

function slotKey(value: string): string {
  return value.slice(0, 16);
}

function isOpenJob(job: SchedulableJob): boolean {
  return job.status !== "cancelled" && job.status !== "completed";
}

export function findAssignmentConflicts(input: {
  jobs: SchedulableJob[];
  scheduledStart: string;
  profileIds: string[];
  ignoreJobId?: string;
  members: Array<{ id: string; name: string }>;
}): AssignmentConflict[] {
  const slot = slotKey(input.scheduledStart);
  if (!slot || !input.profileIds.length) return [];

  const open = input.jobs.filter(
    (job) => isOpenJob(job) && job.id !== input.ignoreJobId,
  );
  const names = new Map(input.members.map((member) => [member.id, member.name]));
  const conflicts: AssignmentConflict[] = [];

  for (const profileId of input.profileIds) {
    const clash = open.find(
      (job) =>
        job.assigneeIds.includes(profileId) && slotKey(job.dateKey) === slot,
    );
    if (!clash) continue;
    conflicts.push({
      profileId,
      name: names.get(profileId) || "Team member",
      otherLabel: formatSiteTitle(clash),
    });
  }

  return conflicts;
}

export function findSiteConflict(input: {
  jobs: SchedulableJob[];
  scheduledStart: string;
  address?: string | null;
  ignoreJobId?: string;
}): string | null {
  const slot = slotKey(input.scheduledStart);
  const place = input.address?.trim().toLowerCase();
  if (!slot || !place) return null;

  const clash = input.jobs.find(
    (job) =>
      isOpenJob(job) &&
      job.id !== input.ignoreJobId &&
      slotKey(job.dateKey) === slot &&
      (job.address || "").trim().toLowerCase() === place,
  );
  return clash ? formatSiteTitle(clash) : null;
}
