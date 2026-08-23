"use client";

import { Button, Field } from "../components/ui-elements";

export function EstimatorDialog({
  onClose,
  onEstimate,
}: {
  onClose: () => void;
  onEstimate: () => void;
}) {
  return (
    <form
      className="estimator-form"
      onSubmit={(event) => {
        event.preventDefault();
        onEstimate();
      }}
    >
      <div className="form-grid form-grid--two">
        <Field label="Service">
          <select defaultValue="standard">
            <option value="standard">Standard / General Clean</option>
            <option value="bond">Bond Clean / End of Lease</option>
            <option value="yard">Yard Cleanup</option>
            <option value="maintenance">Property Maintenance</option>
          </select>
        </Field>
        <Field label="Address (optional)">
          <input />
        </Field>
      </div>
      <Field label="Scope description">
        <textarea
          rows={4}
          placeholder="Describe the job in plain English. e.g. Standard clean of 3-bed 2-bath. Inside oven and interior windows too."
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
