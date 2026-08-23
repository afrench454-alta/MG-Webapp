"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Questionnaire } from "../domain";
import { Button, Field } from "../components/ui-elements";

export function PublicQuestionnairePreview({
  questionnaire,
  onClose,
}: {
  questionnaire: Questionnaire;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="public-form-page">
        <div className="public-form-success">
          <CheckCircle2 aria-hidden="true" size={44} />
          <p className="eyebrow">FieldCentral Pro</p>
          <h1>Responses received</h1>
          <p>Thanks - the team can now prepare an accurate quote.</p>
          <Button onClick={onClose}>Close preview</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="public-form-page">
      <form
        className="public-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="public-form__header">
          <p className="eyebrow">FieldCentral Pro</p>
          <h1>
            {questionnaire?.title ||
              "Bond Clean / End of Lease Questionnaire"}
          </h1>
          <p>
            Please answer the questions below so we can prepare an accurate
            quote.
          </p>
          <button type="button" onClick={onClose}>
            Exit preview
          </button>
        </div>
        <div className="progress-row">
          <span>Step 1 of 1</span>
          <div>
            <i />
          </div>
        </div>
        <fieldset>
          <legend>
            1. Property type & bedrooms/bathrooms <span>*</span>
          </legend>
          {[
            "1 Bed / 1 Bath Unit",
            "2 Bed / 2 Bath Unit",
            "3 Bed / 2 Bath House",
            "4+ Bed Home",
          ].map((option) => (
            <label key={option}>
              <input name="property" type="radio" required /> {option}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>
            2. Carpet steam clean required? <span>*</span>
          </legend>
          {[
            "Yes - all rooms",
            "Yes - bedrooms only",
            "No carpets",
            "Unsure",
          ].map((option) => (
            <label key={option}>
              <input name="carpet" type="radio" required /> {option}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>
            3. Oven & rangehood condition <span>*</span>
          </legend>
          {["Standard", "Heavy grease", "Double oven heavy"].map((option) => (
            <label key={option}>
              <input name="oven" type="radio" required /> {option}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>4. Window cleaning scope</legend>
          {[
            "Inside glass & tracks",
            "Outside ground level",
            "Outside high level",
            "Flyscreens & sills",
          ].map((option) => (
            <label key={option}>
              <input type="checkbox" /> {option}
            </label>
          ))}
        </fieldset>
        <Field label="5. Special stains, wall scuffs or pest treatment?">
          <textarea rows={4} />
        </Field>
        <p className="privacy-note">
          Your responses are used only to prepare this service estimate.
        </p>
        <Button type="submit">Submit responses</Button>
      </form>
    </div>
  );
}
