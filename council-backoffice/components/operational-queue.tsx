import { Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  operationalQueueHref,
  operationalQueueSavedQuery,
  type OperationalQueueState,
} from "@/lib/operational-queue";
import { SavedViewControls } from "./saved-view-controls";

export type OperationalQueueColumn = {
  align?: "left" | "right";
  label: string;
  sortKey?: string;
};

export function OperationalQueue<T>({
  action,
  caption,
  children,
  columns,
  emptyState,
  filterLabel,
  filterOptions = [],
  fixedParams = {},
  pathname,
  searchLabel = "Search records",
  sourceLimit,
  state,
  statusOptions = [],
  title,
  viewKey,
}: {
  action?: ReactNode;
  caption: string;
  children: ReactNode;
  columns: OperationalQueueColumn[];
  emptyState: ReactNode;
  filterLabel?: string;
  filterOptions?: Array<{ label: string; value: string }>;
  fixedParams?: Record<string, string>;
  pathname: string;
  searchLabel?: string;
  sourceLimit?: number;
  state: OperationalQueueState<T>;
  statusOptions?: Array<{ label: string; value: string }>;
  title: string;
  viewKey: string;
}) {
  const firstResult = state.total ? (state.page - 1) * state.pageSize + 1 : 0;
  const lastResult = Math.min(state.page * state.pageSize, state.total);
  const sourceBoundReached = sourceLimit !== undefined && state.unfilteredTotal >= sourceLimit;
  const fixedQuery = new URLSearchParams(fixedParams).toString();
  const resetHref = fixedQuery ? `${pathname}?${fixedQuery}` : pathname;

  return (
    <section aria-labelledby={`${viewKey}-title`} className="operational-table-panel">
      <div className="operational-table-heading">
        <div>
          <span className="section-kicker">Operational Queue</span>
          <h2 id={`${viewKey}-title`}>{title}</h2>
        </div>
        {action}
      </div>

      <form className="operational-filter-bar" method="get" role="search">
        <div className="field operational-search-field">
          <label className="sr-only" htmlFor={`${viewKey}-q`}>{searchLabel}</label>
          <Search aria-hidden="true" size={18} />
          <input
            autoComplete="off"
            defaultValue={state.query}
            id={`${viewKey}-q`}
            name="q"
            placeholder={`${searchLabel}…`}
            type="search"
          />
        </div>
        {statusOptions.length ? (
          <div className="field">
            <label className="sr-only" htmlFor={`${viewKey}-status`}>Filter by status</label>
            <select defaultValue={state.status} id={`${viewKey}-status`} name="status">
              <option value="">All statuses</option>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ) : null}
        {filterOptions.length ? (
          <div className="field">
            <label className="sr-only" htmlFor={`${viewKey}-filter`}>{filterLabel ?? "Additional filter"}</label>
            <select defaultValue={state.filter} id={`${viewKey}-filter`} name="filter">
              <option value="">{filterLabel ? `All ${filterLabel.toLocaleLowerCase("en-GB")}` : "All types"}</option>
              {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        ) : null}
        {state.sort ? <input name="sort" type="hidden" value={state.sort} /> : null}
        {state.sort && state.direction === "desc" ? <input name="direction" type="hidden" value="desc" /> : null}
        {Object.entries(fixedParams).map(([key, value]) => <input key={key} name={key} type="hidden" value={value} />)}
        <div className="field queue-page-size">
          <label className="sr-only" htmlFor={`${viewKey}-per-page`}>Rows per page</label>
          <select defaultValue={state.pageSize} id={`${viewKey}-per-page`} name="perPage">
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}
          </select>
        </div>
        <button className="primary-button button-small" type="submit">Apply Filters</button>
        <Link className="secondary-button button-small" href={resetHref}>Reset</Link>
      </form>

      <div className="operational-view-bar">
        <p aria-live="polite">
          {state.total
            ? `Showing ${firstResult}–${lastResult} of ${state.total} matching record${state.total === 1 ? "" : "s"}`
            : `No records match this view`}
          {state.total !== state.unfilteredTotal ? ` · ${state.unfilteredTotal} loaded` : ""}
        </p>
        <SavedViewControls
          currentQuery={operationalQueueSavedQuery(state, fixedParams)}
          pathname={pathname}
          viewKey={viewKey}
        />
      </div>

      {sourceBoundReached ? (
        <p className="queue-source-warning" role="note">
          This view has reached its {sourceLimit}-record server safety limit. The table never implies that older records were searched; narrow the view or use the relevant evidence export.
        </p>
      ) : null}

      {state.total ? (
        <div className="operational-table-scroll">
          <table className="operational-table">
            <caption>{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => {
                  const active = column.sortKey && state.sort === column.sortKey;
                  const nextDirection = active && state.direction === "asc" ? "desc" : "asc";
                  return (
                    <th
                      aria-sort={active ? (state.direction === "asc" ? "ascending" : "descending") : undefined}
                      className={column.align === "right" ? "queue-cell-numeric" : undefined}
                      key={column.label}
                      scope="col"
                    >
                      {column.sortKey ? (
                        <Link href={operationalQueueHref(pathname, state, {
                          direction: nextDirection,
                          page: 1,
                          sort: column.sortKey,
                        }, fixedParams)}>
                          {column.label}<span aria-hidden="true">{active ? (state.direction === "asc" ? " ↑" : " ↓") : " ↕"}</span>
                        </Link>
                      ) : column.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      ) : emptyState}

      {state.pageCount > 1 ? (
        <nav aria-label={`${title} pages`} className="queue-pagination">
          {state.page > 1 ? (
            <Link className="secondary-button button-small" href={operationalQueueHref(pathname, state, { page: state.page - 1 }, fixedParams)} rel="prev">Previous</Link>
          ) : <span />}
          <span>Page {state.page} of {state.pageCount}</span>
          {state.page < state.pageCount ? (
            <Link className="secondary-button button-small" href={operationalQueueHref(pathname, state, { page: state.page + 1 }, fixedParams)} rel="next">Next</Link>
          ) : <span />}
        </nav>
      ) : null}
    </section>
  );
}
