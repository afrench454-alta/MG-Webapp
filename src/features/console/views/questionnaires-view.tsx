"use client";

import { ArrowUpRight, Send } from "lucide-react";
import type { Questionnaire, QuestionnaireSubmission } from "../domain";
import { Badge, Button, EmptyState, PageHeader } from "../components/ui-elements";

export function QuestionnairesView({
  items,
  submissions,
  onSend,
  onPreview,
}: {
  items: Questionnaire[];
  submissions: QuestionnaireSubmission[];
  onSend: () => void;
  onPreview: (questionnaire: Questionnaire) => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Client intake"
        title="Assessment Questionnaires"
        subtitle="Standard clean, bond clean, yard and maintenance - send a fillable form."
      >
        <Button icon={Send} onClick={onSend}>
          Send Questionnaire
        </Button>
      </PageHeader>
      <section className="questionnaire-grid">
        {items.map((item) => (
          <button
            className="questionnaire-card"
            key={item.id}
            onClick={() => onPreview(item)}
          >
            <Badge tone={item.tone}>{item.category}</Badge>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <span className="question-count">{item.count} questions</span>
            <span className="card-link">
              Preview form <ArrowUpRight aria-hidden="true" size={15} />
            </span>
          </button>
        ))}
      </section>
      <section className="submissions-section">
        <h2>Submissions</h2>
        {submissions.length ? (
          <div className="submission-list">
            {submissions.map((submission) => (
              <article key={submission.id}>
                <div>
                  <strong>{submission.respondent}</strong>
                  <span>{submission.email || "No email supplied"}</span>
                </div>
                <div>
                  <strong>{submission.questionnaire}</strong>
                  <span>Submitted {submission.submitted}</span>
                </div>
              </article>
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
