"use client";

import { useState } from "react";
import { Button, Field } from "../components/ui-elements";
import {
  detailsForCategory,
  serviceCatalog,
  summarizeServiceCategory,
  type ServiceCategory,
} from "../data/service-catalog";

export function EstimatorDialog({
  onClose,
  onEstimate,
}: {
  onClose: () => void;
  onEstimate: () => void;
}) {
  const [category, setCategory] = useState<ServiceCategory>("Cleaning Services");
  const [detail, setDetail] = useState("");
  const details = detailsForCategory(category);

  return (
    <form
      className="estimator-form"
      onSubmit={(event) => {
        event.preventDefault();
        onEstimate();
      }}
    >
      <div className="form-grid form-grid--two">
        <Field
          label="Service"
          hint={summarizeServiceCategory(category) || undefined}
        >
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as ServiceCategory);
              setDetail("");
            }}
          >
            {serviceCatalog.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service type" hint="Optional">
          <select
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          >
            <option value="">Any / not specified</option>
            {details.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Address (optional)">
        <input />
      </Field>
      <Field label="Scope description">
        <textarea
          rows={4}
          placeholder="Describe the job in plain English. e.g. General clean of 3-bed 2-bath. Inside oven and interior windows too."
        />
      </Field>
      <Button type="submit" className="estimator-submit">
        Estimate with Gemini 3.1 Pro
      </Button>
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </form>
  );
}
