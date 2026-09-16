export const productBrand = "Mow & Glow";
export const productName = "Mow & Glow Console";
export const signInIntro =
  "Sign in to manage clients, field work, quotes, and invoices.";
export const DEFAULT_OWNER_NAME = "Jodie";
export const TEAM_INBOX = "team@mowglowpropertyservices.com.au";

export const OPERATOR_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  "team@mowglowpropertyservices.com.au": "Jodie",
  "ashtonfrench454@gmail.com": "Ashton",
};

function titleCaseToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function knownOperatorName(email?: string | null): string | null {
  const key = email?.trim().toLowerCase();
  if (!key) return null;
  return OPERATOR_DISPLAY_NAMES[key] ?? null;
}

export function displayNameFromIdentity(
  name?: string | null,
  email?: string | null,
): string {
  const trimmedName = name?.trim();
  const known = knownOperatorName(email);
  const local = email?.split("@", 1)[0]?.trim().toLowerCase();
  if (trimmedName) {
    if (known && local && trimmedName.toLowerCase() === local) return known;
    return trimmedName;
  }
  if (known) return known;

  if (!local) return "there";

  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

export function formatMemberDisplayName(
  name?: string | null,
  email?: string | null,
  role?: string | null,
): string {
  const named = displayNameFromIdentity(name, email);
  if (named !== "there") return named;
  if (role === "Owner" || role === "owner") return DEFAULT_OWNER_NAME;
  return "Team member";
}

export function gdayGreeting(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] || "there";
  return `G'day, ${first}`;
}

export function brisbaneDateLabel(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Australia/Brisbane",
  }).format(date);
}
