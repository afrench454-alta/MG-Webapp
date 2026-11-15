import type { ConsoleRoute } from "../domain";

const routeNames = {
  today: true, dashboard: true, joseph: true, clients: true, requests: true,
  questionnaires: true, quotes: true, schedule: true, jobs: true,
  invoices: true, settings: true,
} satisfies Record<ConsoleRoute, true>;

export function consoleLocation(params: URLSearchParams) {
  const name = params.get("view");
  const view = name && Object.hasOwn(routeNames, name) ? name as ConsoleRoute : null;
  const id = params.get("record");
  return { view, record: view && id && /^[\w-]{1,120}$/.test(id) ? id : null };
}

export function writeConsoleLocation(view: ConsoleRoute, record?: string, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  if (record) url.searchParams.set("record", record);
  else url.searchParams.delete("record");
  if (url.href !== window.location.href) {
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }
}
