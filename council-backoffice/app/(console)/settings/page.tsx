import { Building2, LockKeyhole, RadioTower } from "lucide-react";

import { saveOrganisationBrandAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { PageHeader } from "@/components/page-header";
import { requireCouncilSession } from "@/lib/auth";
import { councilRoleCan } from "@/lib/permissions";

export default async function CouncilSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const params = await searchParams;
  return (
    <>
      <PageHeader eyebrow="Authority workspace" title="Council settings" description="Identity, resident-facing sponsorship and integration readiness for this council tenant." />
      <FeedbackBanner {...params} />
      <section className="overview-grid">
        <article className="panel">
          <div className="panel-heading"><h2>Organisation</h2><Building2 aria-hidden="true" color="#007AFF" size={23} /></div>
          <div className="connection-list">
            <div className="connection-row"><span>Council</span><strong>{session.organisation.name}</strong></div>
            <div className="connection-row"><span>Provider ID</span><strong>{session.organisation.providerId}</strong></div>
            <div className="connection-row"><span>Plan</span><strong>{session.organisation.planTier}</strong></div>
            <div className="connection-row"><span>Status</span><strong>{session.organisation.status}</strong></div>
            <div className="connection-row"><span>Your role</span><strong className="role-capitalise">{session.platformAdmin ? "Platform superadmin" : session.role}</strong></div>
          </div>
        </article>
        <aside className="panel">
          <div className="panel-heading"><h2>Security boundary</h2><LockKeyhole aria-hidden="true" color="#34C759" size={23} /></div>
          <p className="form-intro">This workspace has no route or navigation entry inside the resident app. Content access is server-side, staff roles are tenant-scoped and every write is audited.</p>
          <div className="truth-note">Staff invitations are provisioned by a platform administrator. Council staff cannot assign themselves to another authority.</div>
        </aside>
      </section>
      <section className="panel form-panel space-top-lg">
        <div className="panel-heading"><h2>Resident-facing council identity</h2><RadioTower aria-hidden="true" color="#007AFF" size={23} /></div>
        {canManage ? <form action={saveOrganisationBrandAction} className="stack-form">
          <div className="field-grid">
            <div className="field"><label htmlFor="brandName">Display name</label><input defaultValue={session.organisation.brandName} id="brandName" name="brandName" /></div>
            <div className="field"><label htmlFor="sponsorshipLabel">Resident sponsorship label</label><input defaultValue={session.organisation.sponsorshipLabel} id="sponsorshipLabel" name="sponsorshipLabel" placeholder={`Supported by ${session.organisation.name}`} /></div>
            <div className="field"><label htmlFor="primaryColour">Primary colour</label><input defaultValue={session.organisation.primaryColour} id="primaryColour" name="primaryColour" pattern="^#[0-9A-Fa-f]{6}$" required /></div>
            <div className="field"><label htmlFor="secondaryColour">Secondary colour</label><input defaultValue={session.organisation.secondaryColour} id="secondaryColour" name="secondaryColour" pattern="^#[0-9A-Fa-f]{6}$" required /></div>
          </div>
          <button className="primary-button" type="submit">Save council identity</button>
        </form> : <p className="form-intro">Only an organisation owner can change resident-facing council identity.</p>}
      </section>
    </>
  );
}
