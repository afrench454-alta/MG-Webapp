"use client";

import { useMemo, useState } from "react";
import { Field } from "./ui-elements";

export type EntityPickerOption = {
  id: string;
  label: string;
  keywords?: string;
};

export function EntityPicker({
  label,
  required = false,
  hint,
  value,
  onChange,
  options,
  placeholder = "Choose...",
  filterPlaceholder = "Type to narrow the list",
  emptyLabel = "No matches",
  disabled = false,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange: (id: string) => void;
  options: EntityPickerOption[];
  placeholder?: string;
  filterPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!needle) return options;
    return options.filter((option) => {
      if (option.id === value) return true;
      const haystack = `${option.label} ${option.keywords ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [needle, options, value]);

  return (
    <Field
      label={label}
      required={required}
      hint={options.length > 8 || needle ? hint ?? filterPlaceholder : hint}
    >
      {options.length > 8 ? (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={filterPlaceholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={`Filter ${label.toLowerCase()}`}
        />
      ) : null}
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery("");
        }}
        required={required}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {visible.map((option) => (
          <option value={option.id} key={option.id}>
            {option.label}
          </option>
        ))}
        {value && !visible.some((option) => option.id === value) ? (
          <option value={value}>{emptyLabel}</option>
        ) : null}
        {needle && visible.length === 0 ? (
          <option value="" disabled>
            {emptyLabel}
          </option>
        ) : null}
      </select>
    </Field>
  );
}
