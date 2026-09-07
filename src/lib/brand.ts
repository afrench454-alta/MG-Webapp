export const productBrand = "Mow & Glow";
export const productName = "Mow & Glow Console";
export const signInIntro =
  "Sign in to manage clients, field work, quotes, and invoices.";
export const DEFAULT_OWNER_NAME = "Jodie";

function titleCaseToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function displayNameFromIdentity(
  name?: string | null,
  email?: string | null,
): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const local = email?.split("@", 1)[0]?.trim();
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
