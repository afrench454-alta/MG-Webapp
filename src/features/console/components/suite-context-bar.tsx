"use client";

import type { ConsoleRoute } from "../domain";

type SuiteDescriptor = {
  id: string;
  suiteTitle: string;
  description: string;
  routes: Array<{
    id: ConsoleRoute;
    label: string;
    count?: number;
    managersOnly?: boolean;
  }>;
};

export function SuiteContextBar({
  active,
  canManage,
  counts,
  onNavigate,
}: {
  active: ConsoleRoute;
  canManage: boolean;
  counts: {
    clients: number;
    requests: number;
    questionnaires: number;
    quotes: number;
    schedule: number;
    jobs: number;
    invoices: number;
    team: number;
  };
  onNavigate: (route: ConsoleRoute) => void;
}) {
  const suites: SuiteDescriptor[] = [
    {
      id: "field-operations",
      suiteTitle: "Field Operations Suite",
      description: "Live dispatch, daily schedule, Joseph field assistant & active crew board",
      routes: [
        { id: "dashboard", label: "Operations Hub" },
        { id: "joseph", label: "Joseph Assistant" },
        { id: "schedule", label: "Schedule", count: counts.schedule },
        { id: "jobs", label: "Job Board", count: counts.jobs },
      ],
    },
    {
      id: "client-hub",
      suiteTitle: "Client & Property Hub",
      description: "Managed residential & acreage properties, contacts & service cadences",
      routes: [
        {
          id: "clients",
          label: "Client Directory",
          count: counts.clients,
          managersOnly: true,
        },
        { id: "requests", label: "Job Requests", count: counts.requests },
      ],
    },
    {
      id: "customer-intake",
      suiteTitle: "Customer Intake & Triage",
      description: "Service requests, public questionnaires & incoming site submissions",
      routes: [
        { id: "requests", label: "Job Requests", count: counts.requests },
        {
          id: "questionnaires",
          label: "Intake Forms",
          count: counts.questionnaires,
          managersOnly: true,
        },
      ],
    },
    {
      id: "financials",
      suiteTitle: "Financials & Billing Suite",
      description: "Quotes, GST invoices, payment status & billing lifecycle",
      routes: [
        {
          id: "quotes",
          label: "Quotes",
          count: counts.quotes,
          managersOnly: true,
        },
        {
          id: "invoices",
          label: "Invoices",
          count: counts.invoices,
          managersOnly: true,
        },
      ],
    },
    {
      id: "settings",
      suiteTitle: "Team & Business Administration",
      description: "Business profile, client JSON import, crew roles & invitations",
      routes: [
        {
          id: "settings",
          label: "Team & Business",
          count: counts.team,
          managersOnly: true,
        },
      ],
    },
  ];

  const activeSuite =
    suites.find((suite) => {
      if (active === "requests") return suite.id === "customer-intake";
      return suite.routes.some((route) => route.id === active);
    }) ?? suites[0];

  const visibleRoutes = activeSuite.routes.filter(
    (route) => canManage || !route.managersOnly,
  );

  return (
    <div className="suite-context-bar" role="region" aria-label="Workspace suite context">
      <div className="suite-context-bar__meta">
        <span className="suite-context-bar__eyebrow">{activeSuite.suiteTitle}</span>
        <p className="suite-context-bar__desc">{activeSuite.description}</p>
      </div>
      <div className="suite-context-bar__pills">
        {visibleRoutes.map((route) => {
          const isCurrent = route.id === active;
          return (
            <button
              key={route.id}
              type="button"
              className={`suite-context-bar__pill ${isCurrent ? "is-active" : ""}`}
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => onNavigate(route.id)}
            >
              <span>{route.label}</span>
              {typeof route.count === "number" ? (
                <small>{route.count}</small>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
