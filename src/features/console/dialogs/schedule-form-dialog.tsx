"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  MapPin,
  UserCheck,
  Wrench,
} from "lucide-react";
import type { Client, Job, JobRequest, TeamMember } from "../domain";
import type { InlineClientInput } from "../data/inline-client";
import type { ScheduleJobInput } from "../data/operations-contract";
import {
  findAssignmentConflicts,
  findSiteConflict,
} from "../data/schedule-planning";
import { displayServiceCategory, serviceCatalog } from "../data/service-catalog";
import {
  defaultDateTimeLocal,
  formatSiteTitle,
  formatWorkLabel,
} from "../data/work-identity";
import { Badge, Button, Field } from "../components/ui-elements";
import { InlineClientFields } from "../components/inline-client-fields";

export function ScheduleFormDialog({
  requests,
  clients = [],
  jobs = [],
  teamMembers = [],
  initialRequestId,
  onClose,
  onSchedule,
  pending = false,
  error = "",
}: {
  requests: JobRequest[];
  clients?: Client[];
  jobs?: Job[];
  teamMembers?: TeamMember[];
  initialRequestId?: string;
  onClose: () => void;
  onSchedule: (payload: ScheduleJobInput) => void | Promise<void>;
  pending?: boolean;
  error?: string;
}) {
  const [request, setRequest] = useState(initialRequestId || "");
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [inlineClient, setInlineClient] = useState<InlineClientInput>();
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("");
  const [date, setDate] = useState(() => defaultDateTimeLocal());
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const selected = useMemo(
    () => requests.find((item) => item.id === request && item.status !== "Closed" && item.status !== "Rejected"),
    [request, requests],
  );
  const bookableRequests = requests.filter((item) => item.clientId && item.propertyId && item.status !== "Closed" && item.status !== "Rejected");
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedAddress = selected?.address ?? inlineClient?.siteAddress ?? selectedClient?.properties.find((property) => property.id === propertyId)?.address;
  const selectClient = (client: Client | undefined) => {
    setClientId(client?.id ?? "");
    setPropertyId(client?.properties.length === 1 ? client.properties[0].id ?? "" : "");
    setInlineClient(undefined);
  };
  const assignable = teamMembers.filter((member) => member.isActive);
  const conflicts = findAssignmentConflicts({
    jobs,
    scheduledStart: date,
    profileIds: assigneeIds,
    members: assignable,
  });
  const siteClash = selectedAddress
    ? findSiteConflict({
        jobs,
        scheduledStart: date,
        address: selectedAddress,
      })
    : null;

  const toggleAssignee = (profileId: string) =>
    setAssigneeIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );

  return (
    <form
      className="form-stack schedule-dispatch-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected && (!category || (inlineClient ? !inlineClient.siteAddress?.trim() : !propertyId))) return;
        void onSchedule({
          jobRequestId: selected?.id,
          clientId: selected || inlineClient ? undefined : clientId,
          propertyId: selected || inlineClient ? undefined : propertyId,
          inlineClient: selected ? undefined : inlineClient,
          category: selected ? undefined : category,
          scope: selected ? undefined : scope,
          scheduledStart: new Date(`${date}:00+10:00`).toISOString(),
          profileIds: assigneeIds.length ? assigneeIds : undefined,
        });
      }}
      aria-busy={pending}
    >
      <div className="schedule-dispatch-grid">
        <div className="schedule-dispatch-col">
          <div className="schedule-dispatch-section-head">
            <Wrench aria-hidden="true" size={16} />
            <span>Work and site</span>
          </div>
          {bookableRequests.length ? (
          <Field label="Job Request">
            <select
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              disabled={pending}
            >
              <option value="">No job request</option>
              {bookableRequests.map((item) => (
                <option value={item.id} key={item.id}>
                  {formatWorkLabel(item)}
                </option>
              ))}
            </select>
          </Field>
          ) : null}

          {selected ? (
            <div className="schedule-site-preview">
              <div className="schedule-site-preview__top">
                <strong>{formatSiteTitle(selected)}</strong>
                <Badge tone="olive">
                  {displayServiceCategory(selected.category)}
                </Badge>
              </div>
              <p className="schedule-site-preview__address">
                <MapPin aria-hidden="true" size={14} />
                <span>{selected.address}</span>
              </p>
              {selected.scope ? (
                <p className="schedule-site-preview__scope">{selected.scope}</p>
              ) : null}
            </div>
          ) : (
            <fieldset className="form-stack" disabled={pending}>
              {!inlineClient ? (
                <>
                  <Field label="Client" required>
                    <select value={clientId} required onChange={(event) => selectClient(clients.find((client) => client.id === event.target.value))}>
                      <option value="">Choose a client</option>
                      {clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Service address" required>
                    <select value={propertyId} required onChange={(event) => setPropertyId(event.target.value)}>
                      <option value="">Choose a service address</option>
                      {selectedClient?.properties.filter((property) => property.id).map((property) => (
                        <option value={property.id} key={property.id}>{property.address}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}
              <InlineClientFields value={inlineClient} onChange={setInlineClient} requireSite clients={clients} onSelectExisting={selectClient} />
              <Field label="Service" required>
                <select value={category} onChange={(event) => setCategory(event.target.value)} required>
                  <option value="">Choose a service</option>
                  {serviceCatalog.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Work details">
                <textarea rows={3} value={scope} onChange={(event) => setScope(event.target.value)} />
              </Field>
            </fieldset>
          )}
        </div>

        <div className="schedule-dispatch-col">
          <div className="schedule-dispatch-section-head">
            <CalendarClock aria-hidden="true" size={16} />
            <span>Date and team</span>
          </div>
          <Field label="Date & time" required>
            <input
              type="datetime-local"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={pending}
            />
          </Field>

          {assignable.length ? (
            <section className="assignment-section">
              <div className="assignment-section__header">
                <p className="eyebrow">
                  <UserCheck aria-hidden="true" size={13} /> Assign team
                </p>
                <span>
                  {assigneeIds.length
                    ? `${assigneeIds.length} selected`
                    : "Optional"}
                </span>
              </div>
              <div className="assignment-options">
                {assignable.map((member) => {
                  const busy = conflicts.some(
                    (conflict) => conflict.profileId === member.id,
                  );
                  return (
                    <label
                      key={member.id}
                      className={busy ? "assignment-options__busy" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={assigneeIds.includes(member.id)}
                        onChange={() => toggleAssignee(member.id)}
                        disabled={pending}
                      />
                      <span>
                        <strong>{member.name}</strong>
                        <small>
                          {member.role}
                          {busy ? " · already booked" : ""}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {conflicts.length || siteClash ? (
        <div className="conflict-note conflict-note--warn" role="status">
          <AlertTriangle aria-hidden="true" size={17} />
          <div>
            {conflicts.map((conflict) => (
              <p key={conflict.profileId}>
                {conflict.name} is already on {conflict.otherLabel} at this time.
              </p>
            ))}
            {siteClash ? (
              <p>This property already has a job at this time ({siteClash}).</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="conflict-note">
          <Check aria-hidden="true" size={17} /> No schedule conflicts detected.
        </div>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="secondary"
          type="button"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Scheduling…" : "Schedule"}
        </Button>
      </div>
    </form>
  );
}
