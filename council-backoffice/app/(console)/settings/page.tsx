import { Building2, LockKeyhole, RadioTower } from "lucide-react";

import { saveOrganisationBrandAction } from "@/app/actions";
import { FeedbackBanner } from "@/components/feedback-banner";
import { OperationalDrawer } from "@/components/operational-drawer";
import { OperationalReadiness } from "@/components/operational-readiness";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireCouncilSession } from "@/lib/auth";
import { humanise } from "@/lib/format";
import { councilRoleCan } from "@/lib/permissions";

export default async function CouncilSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireCouncilSession("dashboard:view");
  const canManage = councilRoleCan(session.role, "organisation:manage");
  const params = await searchParams;
  const brandingComplete = Boolean(session.organisation.brandName && session.organisation.primaryColour && session.organisation.secondaryColour);
  const identityEditor = canManage ? (
    <OperationalDrawer description="These values are resident-facing and organisation-scoped. Review the current preview and contrast before saving." title="Edit Council Identity" triggerLabel="Edit Council Identity" triggerStyle="primary" wide>
      <form action={saveOrganisationBrandAction} className="stack-form">
        <div className="field-grid">
          <div className="field"><label htmlFor="brandName">Display name</label><input defaultValue={session.organisation.brandName} id="brandName" name="brandName" /></div>
          <div className="field"><label htmlFor="sponsorshipLabel">Resident sponsorship label</label><input defaultValue={session.organisation.sponsorshipLabel} id="sponsorshipLabel" name="sponsorshipLabel" placeholder={`Supported by ${session.organisation.name}`} /></div>
          <div className="field"><label htmlFor="primaryColour">Primary colour <span>{session.organisation.primaryColour}</span></label><input defaultValue={session.organisation.primaryColour} id="primaryColour" name="primaryColour" required type="color" /></div>
          <div className="field"><label htmlFor="secondaryColour">Secondary colour <span>{session.organisation.secondaryColour}</span></label><input defaultValue={session.organisation.secondaryColour} id="secondaryColour" name="secondaryColour" required type="color" /></div>
        </div>
        <div aria-label="Current resident identity preview" className="brand-preview">
          <span className="brand-preview-primary" style={{ backgroundColor: session.organisation.primaryColour }} />
          <span className="brand-preview-secondary" style={{ backgroundColor: session.organisation.secondaryColour }} />
          <div><strong>{session.organisation.brandName ?? session.organisation.name}</strong><small>{session.organisation.sponsorshipLabel ?? "No sponsorship label configured"}</small></div>
        </div>
        <p className="help-text">The preview shows the currently saved values. The save action validates both colours as six-digit hex values.</p>
        <button className="primary-button" type="submit">Save Council Identity</button>
      </form>
    </OperationalDrawer>
  ) : undefined;

  return (
    <>
      <PageHeader action={identityEditor} eyebrow="Authority workspace" title="Council Settings" description="Review tenant identity, resident-facing branding and the explicit availability of security and integration controls." />
      <FeedbackBanner error={params.error} saved={params.saved} />
      <section className="overview-grid space-bottom-lg">
        <article className="panel">
          <div className="panel-heading"><h2>Organisation</h2><Building2 aria-hidden="true" color="#007AFF" size={23} /></div>
          <div className="connection-list">
            <div className="connection-row"><span>Council</span><strong>{session.organisation.name}</strong></div>
            <div className="connection-row"><span>Provider ID</span><strong>{session.organisation.providerId}</strong></div>
            <div className="connection-row"><span>Plan</span><strong>{humanise(session.organisation.planTier)}</strong></div>
            <div className="connection-row"><span>Status</span><StatusPill status={session.organisation.status} /></div>
            <div className="connection-row"><span>Your role</span><strong className="role-capitalise">{session.platformAdmin ? "Platform superadmin" : session.role}</strong></div>
          </div>
        </article>
        <aside className="panel">
          <div className="panel-heading"><h2>Resident Identity</h2><RadioTower aria-hidden="true" color="#007AFF" size={23} /></div>
          <div className="brand-preview settings-brand-preview">
            <span className="brand-preview-primary" style={{ backgroundColor: session.organisation.primaryColour }} />
            <span className="brand-preview-secondary" style={{ backgroundColor: session.organisation.secondaryColour }} />
            <div><strong>{session.organisation.brandName ?? session.organisation.name}</strong><small>{session.organisation.sponsorshipLabel ?? "No sponsorship label configured"}</small></div>
          </div>
          {!canManage ? <p className="form-intro">Only the organisation owner can change resident-facing council identity.</p> : null}
        </aside>
      </section>
      <OperationalReadiness
        caption={`Configuration controls currently available or absent for ${session.organisation.name}. Unavailable rows are product prerequisites, not inferred live state.`}
        rows={[
          { area: "Tenant identity", currentState: `${session.organisation.name} · ${session.organisation.providerId} · ${humanise(session.organisation.status)}`, status: "available", nextStep: "Keep provider identity changes in the platform-controlled onboarding process." },
          { area: "Resident branding", currentState: brandingComplete ? `Saved as ${session.organisation.brandName}; ${session.organisation.primaryColour} and ${session.organisation.secondaryColour}` : "One or more resident identity fields are not configured", status: brandingComplete ? "available" : "partial", nextStep: brandingComplete ? "Review contrast and resident screenshots before each material change." : "The organisation owner must complete and verify the resident identity." },
          { area: "Staff invitations and role changes", currentState: "No council self-service invitation or role-management workflow exists", status: "unavailable", nextStep: "Add tenant-scoped invitations, expiry, acceptance, role-change audit and revocation APIs." },
          { area: "Session revocation", currentState: "No console action exists to revoke a selected staff session", status: "unavailable", nextStep: "Add staff-session inventory and scoped revocation without affecting unrelated shared-account products." },
          { area: "Single sign-on", currentState: "No council SSO or identity-provider configuration is represented", status: "prerequisite-required", nextStep: "Define domain verification, IdP metadata, recovery and break-glass support contracts." },
          { area: "Retention policy", currentState: "No tenant retention schedule or deletion-job status is represented", status: "unavailable", nextStep: "Define record-class schedules, legal holds, jobs, evidence and authorised overrides." },
          { area: "Integration credentials", currentState: "No secret inventory or rotation status is exposed in this workspace", status: "unavailable", nextStep: "Add metadata-only credential health and rotation APIs; never return secret values to the browser." },
        ]}
        title="Settings and Security Readiness"
      />
      <div className="truth-note space-top-lg"><LockKeyhole aria-hidden="true" size={17} /> Content access is server-side, staff roles are tenant-scoped and writes are audited. This statement does not imply that the unavailable administration controls above already exist.</div>
    </>
  );
}
