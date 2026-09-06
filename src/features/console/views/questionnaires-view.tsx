"use client";

import { ArrowUpRight, ClipboardList, Send } from "lucide-react";
import type { Questionnaire, QuestionnaireSubmission } from "../domain";
import { displayServiceCategory } from "../data/service-catalog";
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
  onSend: () => void;
  onPreview: (questionnaire: Questionnaire) => void;
  onOpenSubmission: (submission: QuestionnaireSubmission) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Client intake"
        title="Assessment Questionnaires"
        subtitle="Send a form, read the answers, then turn a submission into a job request."
      >
        <Button icon={Send} onClick={onSend}>
          Send Questionnaire
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
                Preview Form
              </Button>
              <Button variant="primary" icon={Send} onClick={onSend}>
                Send Link
              </Button>
            </div>
          </article>
        ))}
      </section>
      <section className="submissions-section">
        <h2>Recent Submissions</h2>
        {submissions.length ? (
          <div className="submission-list">
            {submissions.map((submission) => (
              <button
                type="button"
                key={submission.id}
                className="submission-row"
                onClick={() => onOpenSubmission(submission)}
              >
                <div className="submission-row__main">
                  <strong>{submission.respondent}</strong>
                  <span>{submission.email || "No email supplied"}</span>
                </div>
                <div className="submission-row__meta">
                  <Badge tone={submission.jobRequestId ? "success" : "sage"}>
                    {submission.jobRequestId ? "Request created" : "Needs action"}
                  </Badge>
                  <strong>{submission.questionnaire}</strong>
                  <span>Submitted {submission.submitted}</span>
                </div>
                <ClipboardList aria-hidden="true" size={16} />
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No submissions yet."
            action="Send the first questionnaire"
            onAction={onSend}
          />
        )}
      </section>
    </>
  );
}
