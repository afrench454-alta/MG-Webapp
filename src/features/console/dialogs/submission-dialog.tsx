"use client";

import type { Client, Questionnaire, QuestionnaireSubmission } from "../domain";
import { formatSubmissionScope } from "../data/work-identity";
import { TEAM_INBOX } from "@/lib/brand";
import { Badge, Button } from "../components/ui-elements";

export function SubmissionDialog({
  submission,
  questionnaire,
  clients,
  onClose,
  onCreateRequest,
  onAddClient,
}: {
  submission: QuestionnaireSubmission;
  questionnaire?: Questionnaire;
  clients: Client[];
  onClose: () => void;
  onCreateRequest: () => void;
  onAddClient: () => void;
}) {
  const fields = questionnaire?.fields || [];
  const matchingClient = clients.find(
    (client) =>
      submission.email &&
      client.email.toLowerCase() === submission.email.toLowerCase(),
  );
  const siteAddress =
    typeof submission.answers._site_address === "string"
      ? submission.answers._site_address
      : "";
  const scope = formatSubmissionScope(submission.answers, fields);
  const teamMail = {
    to: TEAM_INBOX,
    subject: encodeURIComponent(
      `New intake: ${submission.respondent} · ${submission.questionnaire}`,
    ),
    body: encodeURIComponent(
      [
        `Intake form: ${submission.questionnaire}`,
        `From: ${submission.respondent}`,
        submission.email ? `Email: ${submission.email}` : "",
        submission.phone ? `Phone: ${submission.phone}` : "",
        siteAddress ? `Property: ${siteAddress}` : "",
        `Submitted: ${submission.submitted}`,
        "",
        scope || "No answers stored.",
      ]
        .filter((line) => line !== "")
        .join("\n"),
    ),
  };

  return (
    <div className="form-stack">
      <div className="job-facts">
        <div>
          <p className="eyebrow">From</p>
          <span>{submission.respondent}</span>
        </div>
        <div>
          <p className="eyebrow">Contact</p>
          <span>{submission.email || submission.phone || "No contact"}</span>
        </div>
        <div>
          <p className="eyebrow">Submitted</p>
          <span>{submission.submitted}</span>
        </div>
        <div>
          <p className="eyebrow">Template</p>
          <span>{submission.questionnaire}</span>
        </div>
      </div>
      {siteAddress ? (
        <p className="location-line">{siteAddress}</p>
      ) : null}
      <dl className="answer-list">
        {fields.map((field) => {
          const value = submission.answers[field.id];
          const text = Array.isArray(value)
            ? value.filter(Boolean).join(", ")
            : value;
          if (!text) return null;
          return (
            <div key={field.id}>
              <dt>{field.label}</dt>
              <dd>{text}</dd>
            </div>
          );
        })}
        {!fields.length ? (
          <p className="muted-copy">
            {formatSubmissionScope(submission.answers, []) ||
              "No answers were stored with this submission."}
          </p>
        ) : null}
      </dl>
      {submission.jobRequestId ? (
        <Badge tone="success">Already turned into a job request</Badge>
      ) : matchingClient ? (
        <p className="muted-copy">
          Matches existing client {matchingClient.name}. Create a job request
          next.
        </p>
      ) : (
        <p className="muted-copy">
          No matching client yet. Add them, then create the job request from
          these answers.
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" type="button" onClick={onClose}>
          Close
        </Button>
        <a
          className="button button--secondary"
          href={`mailto:${teamMail.to}?subject=${teamMail.subject}&body=${teamMail.body}`}
        >
          Email {TEAM_INBOX}
        </a>
        {!matchingClient && !submission.jobRequestId ? (
          <Button type="button" onClick={onAddClient}>
            Add as client
          </Button>
        ) : null}
        {!submission.jobRequestId ? (
          <Button type="button" onClick={onCreateRequest} disabled={!matchingClient}>
            Create job request
          </Button>
        ) : null}
      </div>
    </div>
  );
}
