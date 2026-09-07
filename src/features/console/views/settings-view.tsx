"use client";

import { useState } from "react";
import { Mail, Save, UserPlus } from "lucide-react";
import type { BusinessProfile, TeamInvitation, TeamMember } from "../domain";
import type {
  InviteTeamAction,
  RevokeTeamInviteAction,
  UpdateBusinessProfileAction,
  UpdateTeamMemberAction,
} from "../data/team-contract";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
} from "../components/ui-elements";

export function SettingsView({
  profile,
  teamMembers,
  invitations,
  canManage,
  currentEmail,
  onSaveProfile,
  onInvite,
  onRevoke,
  onUpdateMember,
}: {
  profile: BusinessProfile;
  teamMembers: TeamMember[];
  invitations: TeamInvitation[];
  canManage: boolean;
  currentEmail: string;
  onSaveProfile?: UpdateBusinessProfileAction;
  onInvite?: InviteTeamAction;
  onRevoke?: RevokeTeamInviteAction;
  onUpdateMember?: UpdateTeamMemberAction;
}) {
  const [details, setDetails] = useState(profile);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Co-owner" | "Worker">(
    "Worker",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [share, setShare] = useState<{ url: string; email: string } | null>(
    null,
  );

  const copyShareUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("The invite link could not be copied. Select it instead.");
    }
  };

  const updateMember = async (input: {
    profileId: string;
    name?: string;
    role?: "Co-owner" | "Worker";
    isActive?: boolean;
  }) => {
    if (!onUpdateMember) return;
    setError("");
    setPending(true);
    const result = await onUpdateMember(input);
    setPending(false);
    if (!result.ok) setError(result.message);
  };

  const saveProfile = async () => {
    if (!onSaveProfile) return;
    setError("");
    setPending(true);
    const result = await onSaveProfile(details);
    setPending(false);
    if (!result.ok) setError(result.message);
  };

  const sendInvite = async () => {
    if (!onInvite) return;
    setError("");
    setPending(true);
    const result = await onInvite({ email: inviteEmail, role: inviteRole });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setInviteEmail("");
    setShare({
      url: `${window.location.origin}${result.path}`,
      email: result.email,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Team & business"
        subtitle="Assign work to real people, and keep invoice details in one place."
      />
      <section className="settings-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Business details</p>
              <h2>Shown on quotes and invoices</h2>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
          >
            <Field label="Business name" required>
              <input
                value={details.name}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                disabled={!canManage || pending}
              />
            </Field>
            <div className="form-grid form-grid--two">
              <Field label="ABN">
                <input
                  value={details.abn}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      abn: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
              <Field label="Phone">
                <input
                  value={details.phone}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
            </div>
            <div className="form-grid form-grid--two">
              <Field label="Email">
                <input
                  type="email"
                  value={details.email}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
              <Field label="Website">
                <input
                  value={details.website}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      website: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
            </div>
            <div className="form-grid form-grid--two">
              <Field label="Payment to">
                <input
                  value={details.paymentTo}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      paymentTo: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
              <Field label="BSB">
                <input
                  value={details.bsb}
                  onChange={(event) =>
                    setDetails((current) => ({
                      ...current,
                      bsb: event.target.value,
                    }))
                  }
                  disabled={!canManage || pending}
                />
              </Field>
            </div>
            <Field label="Account number">
              <input
                value={details.accountNumber}
                onChange={(event) =>
                  setDetails((current) => ({
                    ...current,
                    accountNumber: event.target.value,
                  }))
                }
                disabled={!canManage || pending}
              />
            </Field>
            {canManage ? (
              <div className="dialog-actions">
                <Button icon={Save} type="submit" disabled={pending}>
                  {pending ? "Saving…" : "Save business details"}
                </Button>
              </div>
            ) : (
              <p className="muted-copy">Only owners can change these details.</p>
            )}
          </form>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Team</p>
              <h2>Who can be assigned to jobs</h2>
            </div>
          </div>
          <div className="team-list">
            {teamMembers.map((member) => (
              <article
                key={member.id}
                className={`team-row${member.isActive ? "" : " team-row--inactive"}`}
              >
                <div>
                  {canManage ? (
                    <input
                      key={member.name}
                      className="team-row__name"
                      defaultValue={member.name}
                      aria-label={`${member.role} name`}
                      maxLength={80}
                      disabled={pending}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (!next) {
                          event.target.value = member.name;
                          return;
                        }
                        if (next === member.name) return;
                        void updateMember({
                          profileId: member.id,
                          name: next,
                        });
                      }}
                    />
                  ) : (
                    <strong>{member.name}</strong>
                  )}
                  <span>{member.email || "No email"}</span>
                </div>
                <Badge tone={member.role === "Worker" ? "olive" : "forest"}>
                  {member.role}
                </Badge>
                {canManage && member.role !== "Owner" ? (
                  <div className="team-row__actions">
                    <select
                      value={member.role}
                      disabled={pending}
                      onChange={(event) =>
                        void updateMember({
                          profileId: member.id,
                          role: event.target.value as "Co-owner" | "Worker",
                        })
                      }
                    >
                      <option>Co-owner</option>
                      <option>Worker</option>
                    </select>
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void updateMember({
                          profileId: member.id,
                          isActive: !member.isActive,
                        })
                      }
                    >
                      {member.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                ) : member.email === currentEmail || member.role === "Owner" ? (
                  <span className="muted-copy">
                    {member.email === currentEmail ? "You" : "Owner"}
                  </span>
                ) : null}
              </article>
            ))}
            {!teamMembers.length ? (
              <EmptyState title="No team members yet." />
            ) : null}
          </div>

          {canManage ? (
            <form
              className="form-stack invite-form"
              onSubmit={(event) => {
                event.preventDefault();
                void sendInvite();
              }}
            >
              <p className="eyebrow">Invite someone</p>
              <div className="form-grid form-grid--two">
                <Field label="Email" required>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                    disabled={pending}
                    placeholder="worker@example.com"
                  />
                </Field>
                <Field label="Role">
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(
                        event.target.value as "Co-owner" | "Worker",
                      )
                    }
                    disabled={pending}
                  >
                    <option>Worker</option>
                    <option>Co-owner</option>
                  </select>
                </Field>
              </div>
              <p className="muted-copy">
                Workers see assigned jobs, mark them complete, and upload photos.
                Co-owners can also quote, invoice, and manage the roster.
              </p>
              <Button icon={UserPlus} type="submit" disabled={pending}>
                {pending ? "Creating invite…" : "Create invite link"}
              </Button>
            </form>
          ) : null}

          {share ? (
            <div className="link-preview">
              <Mail aria-hidden="true" size={20} />
              <div>
                <strong>Invite ready for {share.email}</strong>
                <span>{share.url}</span>
              </div>
              <Button
                variant="secondary"
                type="button"
                onClick={() => void copyShareUrl(share.url)}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : null}

          {invitations.length ? (
            <div className="invite-list">
              <p className="eyebrow">Pending invites</p>
              {invitations.map((invite) => (
                <article key={invite.id} className="team-row">
                  <div>
                    <strong>{invite.email}</strong>
                    <span>
                      {invite.role} · expires {invite.expires}
                    </span>
                  </div>
                  {canManage ? (
                    <Button
                      variant="secondary"
                      type="button"
                      disabled={pending}
                      onClick={() => void onRevoke?.(invite.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </article>
      </section>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
