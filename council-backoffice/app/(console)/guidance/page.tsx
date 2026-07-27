import { BookOpenCheck } from "lucide-react";

import { saveGuidanceAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { listGuidance } from "@/lib/data";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function GuidancePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canWrite = councilRoleCan(session.role, "guidance:write");
  const [items, params] = await Promise.all([listGuidance(session), searchParams]);
  return (
    <>
      <PageHeader eyebrow="Local recycling rules" title="Recycling guidance" description="Override generic UK advice with authority-approved answers. Published guidance is returned before any relevant sponsored partner." />
      <FeedbackBanner {...params} />
      <div className={canWrite ? "split-layout" : ""}>
        {canWrite ? <section className="panel form-panel sticky-panel">
          <h2>Add or update an answer</h2><p className="form-intro">Using the same item key updates the existing council answer without requiring an app release.</p>
          <form action={saveGuidanceAction} className="stack-form">
            <div className="field-grid">
              <div className="field"><label htmlFor="itemKey">Item key</label><input id="itemKey" name="itemKey" placeholder="fluorescent-tubes" required /></div>
              <div className="field"><label htmlFor="itemName">Item name</label><input id="itemName" maxLength={120} name="itemName" required /></div>
              <div className="field field-span"><label htmlFor="searchTerms">Search terms, one per line</label><textarea id="searchTerms" name="searchTerms" placeholder={"tube light\nstrip light"} /></div>
              <div className="field"><label htmlFor="destination">Destination</label><select id="destination" name="destination">{["general", "recycling", "garden", "food", "other", "service", "check"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div>
              <div className="field"><label htmlFor="status">Status</label><select id="status" name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div>
              <div className="field field-span"><label htmlFor="heading">Short resident answer</label><input id="heading" maxLength={160} name="heading" required /></div>
              <div className="field field-span"><label htmlFor="detail">Preparation and exclusions</label><textarea id="detail" maxLength={400} name="detail" required /></div>
              <div className="field field-span"><label htmlFor="serviceUrl">Official service link</label><input id="serviceUrl" name="serviceUrl" type="url" /></div>
            </div>
            <button className="primary-button" type="submit">Save council guidance</button>
          </form>
        </section> : null}
        <section className="data-list">
          {items.length ? items.map((item) => <article className="data-card" key={item.id}>
            <div className="data-card-top"><div><h2>{item.itemName}</h2><div className="data-meta"><span>{item.itemKey}</span><span>{humanise(item.destination)}</span></div></div><StatusPill status={item.status} /></div>
            <p><strong>{item.heading}</strong><br />{item.detail}</p>
            {item.searchTerms.length ? <div className="tag-list">{item.searchTerms.map((term) => <span className="tag" key={term}>{term}</span>)}</div> : null}
          </article>) : <div className="empty-state"><BookOpenCheck aria-hidden="true" size={32} /><h2>No local guidance yet</h2><p>The resident app will continue to show its cautious UK guide until council-approved answers are published.</p></div>}
        </section>
      </div>
    </>
  );
}
