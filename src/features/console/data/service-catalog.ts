export const serviceCategories = [
  "Cleaning Services",
  "Yard Services",
  "Property Maintenance",
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export type ServiceOption = {
  id: ServiceCategory;
  label: ServiceCategory;
  details: string[];
};

export const serviceCatalog: ServiceOption[] = [
  {
    id: "Cleaning Services",
    label: "Cleaning Services",
    details: ["Bond Clean", "General Clean", "End of Lease", "Deep Clean"],
  },
  {
    id: "Yard Services",
    label: "Yard Services",
    details: ["Mowing & Edging", "Yard Cleanup", "Garden Maintenance"],
  },
  {
    id: "Property Maintenance",
    label: "Property Maintenance",
    details: ["Repairs", "Handyman", "General Maintenance"],
  },
];

const legacyServiceMap: Record<string, { category: ServiceCategory; detail?: string }> = {
  "Standard / General Clean": { category: "Cleaning Services", detail: "General Clean" },
  "Bond Clean / End of Lease": { category: "Cleaning Services", detail: "Bond Clean" },
  "Yard Cleanup": { category: "Yard Services", detail: "Yard Cleanup" },
  "Property Maintenance": { category: "Property Maintenance" },
};

export function isServiceCategory(value: string): value is ServiceCategory {
  return (serviceCategories as readonly string[]).includes(value);
}

export function parseServiceTitle(title: string): {
  category: string;
  detail?: string;
} {
  const trimmed = title.trim();
  const legacy = legacyServiceMap[trimmed];
  if (legacy) return legacy;
  const separator = " · ";
  const index = trimmed.indexOf(separator);
  if (index === -1) return { category: trimmed };
  return {
    category: trimmed.slice(0, index),
    detail: trimmed.slice(index + separator.length) || undefined,
  };
}

export function formatServiceTitle(category: string, detail?: string): string {
  const trimmed = detail?.trim();
  return trimmed ? `${category} · ${trimmed}` : category;
}

export function displayServiceCategory(title: string): string {
  return parseServiceTitle(title).category;
}

export function displayServiceDetail(title: string): string | undefined {
  return parseServiceTitle(title).detail;
}

export function detailsForCategory(category: string): string[] {
  return serviceCatalog.find((item) => item.id === category)?.details ?? [];
}

export function summarizeServiceCategory(category: string): string {
  return detailsForCategory(category).join(" + ");
}
