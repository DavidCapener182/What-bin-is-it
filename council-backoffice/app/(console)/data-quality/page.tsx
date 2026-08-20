import { ClipboardList } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listDataQualityReports } from "@/lib/data-quality";
import {
  dataQualityReportStatus,
  dataQualityReportStatuses,
} from "@/lib/data-quality-pagination";
import { formatDateTime, humanise } from "@/lib/format";

export default async function DataQualityQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string }>;
}) {
  const session = await requireCouncilSession("support:view");
  const params = await searchParams;
  const status = dataQualityReportStatus(params.status);
  const { reports, nextCursor } = await listDataQualityReports(session, {
    cursor: params.cursor,
    status,
  });
  const firstPageHref = status ? `/data-quality?status=${status}` : "/data-quality";
  return (
    <>
      <PageHeader
        eyebrow={session.platformAdmin ? "Platform operations" : "Resident operations"}
        title="Data-quality queue"
        description={session.platformAdmin
          ? "Read-only private reports across councils. Address, postcode, property, place-label and raw installation fields do not exist in this queue."
          : `Read-only private reports scoped to ${session.organisation.name}. Address, postcode, property, place-label and raw installation fields are excluded.`}
      />
      <form action="/data-quality" className="correspondence-filters data-quality-filters" method="get">
        <div className="field">
          <label htmlFor="status">Report status</label>
          <select defaultValue={status ?? ""} id="status" name="status">
            <option value="">All statuses</option>
            {dataQualityReportStatuses.map((value) => (
              <option key={value} value={value}>{humanise(value)}</option>
            ))}
          </select>
        </div>
        <button className="primary-button" type="submit">Filter queue</button>
      </form>
      {reports.length ? (
        <section aria-label="Private data-quality reports" className="data-list">
          {reports.map((report) => (
            <article className="data-card" key={report.trackingReference}>
              <div className="data-card-top">
                <div>
                  <h2>{humanise(report.issue)}</h2>
                  <div className="data-meta">
                    <span>{report.trackingReference}</span>
                    <span>{formatDateTime(report.createdAt)}</span>
                    <span>{report.councilName ?? "No council selected"}</span>
                    {report.councilProviderId ? <span>{report.councilProviderId}</span> : null}
                  </div>
                </div>
                <StatusPill status={report.status} />
              </div>
              <p>{report.detail}</p>
              {report.expectedValue ? <p><strong>Expected:</strong> {report.expectedValue}</p> : null}
              <div className="tag-list">
                <span className="tag">App {report.appVersion}</span>
                <span className="tag">{report.online ? "Online" : "Offline when prepared"}</span>
                {report.displayedCollectionDate ? <span className="tag">Displayed {report.displayedCollectionDate}</span> : null}
                {report.lastVerifiedAt ? <span className="tag">Verified {formatDateTime(report.lastVerifiedAt)}</span> : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-state">
          <ClipboardList aria-hidden="true" size={32} />
          <h2>No data-quality reports</h2>
          <p>No unexpired private reports are available in this authenticated scope.</p>
        </div>
      )}
      {(params.cursor || nextCursor) ? (
        <nav aria-label="Data-quality queue pages" className="queue-pagination">
          {params.cursor ? <Link className="secondary-button" href={firstPageHref}>Newest reports</Link> : <span />}
          {nextCursor ? (
            <Link
              className="primary-button"
              href={{ pathname: "/data-quality", query: { cursor: nextCursor, ...(status ? { status } : {}) } }}
            >
              Older reports
            </Link>
          ) : <span className="help-text">End of this queue</span>}
        </nav>
      ) : null}
      <div className="truth-note space-top-lg">This queue is intentionally read-only. A tracking reference proves receipt, not that a council collection date or service has been corrected.</div>
    </>
  );
}
