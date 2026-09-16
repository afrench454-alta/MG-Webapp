"use client";

import { ArrowUpRight, ClipboardList, MapPin, Send } from "lucide-react";
import type { Questionnaire, QuestionnaireSubmission } from "../domain";
import { displayServiceCategory } from "../data/service-catalog";
import { submissionSiteAddress } from "../data/work-identity";
import { Badge, Button, EmptyState, PageHeader } from "../components/ui-elements";

export function QuestionnairesView({
  items,
  submissions,
  onSend,
  onPreview,
  onOpenSubmission,
}: {
  items: Questionnaire[];
  submissions: QuestionnaireSubmission[];
  onSend: (questionnaire?: Questionnaire) => void;
  onPreview: (questionnaire: Questionnaire) => void;
  onOpenSubmission: (submission: QuestionnaireSubmission) => void;
}) {
  const pending = submissions.filter((item) => !item.jobRequestId);
  const converted = submissions.filter((item) => item.jobRequestId);

  return (
    <>
      <PageHeader
        eyebrow="Client intake"
        title="Intake forms"
        subtitle="Send a form to a new or existing client, then turn the answers into a job request for that property."
      >
        <Button icon={Send} onClick={() => onSend()}>
          Send form
        </Button>
      </PageHeader>
      <section className="questionnaire-grid">
        {items.map((item) => (
          <article className="questionnaire-card" key={item.id}>
            <header>
              <Badge tone={item.tone}>{displayServiceCategory(item.category)}</Badge>
              <h2>{item.title}</h2>
            </header>
            <p>{item.description}</p>
            <span className="question-count">{item.count} questions</span>
            <div className="questionnaire-card__actions">
              <Button variant="secondary" icon={ArrowUpRight} onClick={() => onPreview(item)}>
                Preview
              </Button>
              <Button variant="primary" icon={Send} onClick={() => onSend(item)}>
                Send link
              </Button>
            </div>
          </article>
        ))}
      </section>
      <section className="submissions-section">
        <h2>Answers to action</h2>
        {pending.length ? (
          <div className="submission-list">
            {pending.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                onOpen={onOpenSubmission}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No new answers waiting."
            action="Send the first form"
            onAction={() => onSend()}
          />
        )}
      </section>
      {converted.length ? (
        <section className="submissions-section">
          <h2>Turned into requests</h2>
          <div className="submission-list">
            {converted.map((submission) => (
              <SubmissionRow
                key={submission.id}
                submission={submission}
                onOpen={onOpenSubmission}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SubmissionRow({
  submission,
  onOpen,
}: {
  submission: QuestionnaireSubmission;
  onOpen: (submission: QuestionnaireSubmission) => void;
}) {
  const site = submissionSiteAddress(submission.answers);
  return (
    <button
      type="button"
      className="submission-row"
      onClick={() => onOpen(submission)}
    >
      <div className="submission-row__main">
        <strong>{submission.respondent}</strong>
        <span>{submission.email || "No email supplied"}</span>
        {site ? (
          <span className="location-line">
            <MapPin aria-hidden="true" size={14} /> {site}
          </span>
        ) : null}
      </div>
      <div className="submission-row__meta">
        <Badge tone={submission.jobRequestId ? "success" : "sage"}>
          {submission.jobRequestId ? "Request created" : "Needs a request"}
        </Badge>
        <strong>{submission.questionnaire}</strong>
        <span>Submitted {submission.submitted}</span>
      </div>
      <ClipboardList aria-hidden="true" size={16} />
    </button>
  );
}
