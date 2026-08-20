import type { ReactNode } from "react";

import { StatusPill } from "./status-pill";

export type OperationalReadinessRow = {
  area: string;
  currentState: string;
  nextStep: string;
  status: "available" | "partial" | "prerequisite-required" | "unavailable";
};

export function OperationalReadiness({
  action,
  caption,
  rows,
  title,
}: {
  action?: ReactNode;
  caption: string;
  rows: readonly OperationalReadinessRow[];
  title: string;
}) {
  return (
    <section aria-labelledby="operational-readiness-title" className="operational-table-panel">
      <div className="operational-table-heading">
        <div>
          <span className="section-kicker">Readiness Checklist</span>
          <h2 id="operational-readiness-title">{title}</h2>
        </div>
        {action}
      </div>
      <div className="operational-table-scroll">
        <table className="operational-table operational-readiness-table">
          <caption>{caption}</caption>
          <thead><tr><th scope="col">Area</th><th scope="col">Current State</th><th scope="col">Status</th><th scope="col">Required Next Step</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.area}>
                <th className="queue-primary-cell" data-label="Area" scope="row">{row.area}</th>
                <td data-label="Current State">{row.currentState}</td>
                <td data-label="Status"><StatusPill status={row.status} /></td>
                <td data-label="Required Next Step">{row.nextStep}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
