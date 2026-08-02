import { Activity, ShieldCheck } from "lucide-react";

import { createPlatformIncidentAction, updatePlatformIncidentAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requirePlatformAdminSession } from "@/lib/auth";
import { humanise } from "@/lib/format";
import { listPlatformIncidents } from "@/lib/platform-status";

export default async function StatusAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requirePlatformAdminSession();
  const [incidents, params] = await Promise.all([listPlatformIncidents(), searchParams]);
  return <>
    <PageHeader eyebrow="Operations workspace" title="Service status" description="Publish evidence-based incidents for residents and procurement teams. No component is called operational merely because monitoring is absent." />
    <FeedbackBanner {...params} />
    <div className="split-layout">
      <section className="panel form-panel sticky-panel">
        <h2>Record an incident</h2>
        <form action={createPlatformIncidentAction} className="stack-form">
          <div className="field-grid"><div className="field"><label htmlFor="component">Component</label><select id="component" name="component">{["resident-app", "council-gateway", "push", "accounts", "council-console", "partner-feeds"].map((value) => <option key={value} value={value}>{humanise(value)}</option>)}</select></div><div className="field"><label htmlFor="status">Status</label><select id="status" name="status"><option value="investigating">Investigating</option><option value="identified">Identified</option><option value="monitoring">Monitoring</option></select></div></div>
          <div className="field"><label htmlFor="title">Public title</label><input id="title" maxLength={160} name="title" required /></div>
          <div className="field"><label htmlFor="detail">Public detail</label><textarea id="detail" maxLength={1000} name="detail" required /></div>
          <div className="field"><label htmlFor="councilProviderIds">Affected council provider IDs</label><textarea id="councilProviderIds" name="councilProviderIds" placeholder="Leave blank for platform-wide" /></div>
          <div className="field"><label htmlFor="startsAt">Started</label><input id="startsAt" name="startsAt" required type="datetime-local" /></div>
          <button className="primary-button" type="submit">Publish incident</button>
        </form>
      </section>
      <section className="data-list">
        {incidents.length ? incidents.map((incident) => <article className="data-card" key={incident.id}><div className="data-card-top"><div><h2>{incident.title}</h2><div className="data-meta"><span>{humanise(incident.component)}</span><span>{new Date(incident.startsAt).toLocaleString("en-GB")}</span></div></div><StatusPill status={incident.status} /></div><p>{incident.detail}</p><div className="tag-list">{incident.councilProviderIds.length ? incident.councilProviderIds.map((id) => <span className="tag" key={id}>{id}</span>) : <span className="tag">Platform-wide</span>}</div>{incident.status !== "resolved" ? <form action={updatePlatformIncidentAction} className="inline-form"><input name="id" type="hidden" value={incident.id} /><button className="secondary-button button-small" name="status" value="monitoring">Monitoring</button><button className="primary-button button-small" name="status" value="resolved">Resolve</button></form> : null}</article>) : <div className="empty-state"><ShieldCheck aria-hidden="true" size={32} /><h2>No recorded incidents</h2><p>This means no incident has been published. It is not a substitute for active monitoring.</p></div>}
      </section>
    </div>
    <div className="truth-note space-top-lg"><Activity aria-hidden="true" size={17} /> The public page distinguishes “no active recorded incident” from a verified uptime claim.</div>
  </>;
}
