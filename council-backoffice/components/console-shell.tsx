import {
  Activity,
  BadgePoundSterling,
  BellRing,
  BookOpenCheck,
  Building2,
  CircleGauge,
  ClipboardList,
  Megaphone,
  RadioTower,
  ScrollText,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { signOutCouncil, switchCouncil } from "@/app/actions";
import { councilMemberships } from "@/lib/auth";
import { councilRoleCan } from "@/lib/permissions";
import type { CouncilStaffSession } from "@/lib/types";
import { NavLink } from "./nav-link";

const primaryNavigation = [
  { href: "/", label: "Overview", icon: CircleGauge },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/disruptions", label: "Disruptions", icon: TriangleAlert },
  { href: "/guidance", label: "Recycling guidance", icon: BookOpenCheck },
  { href: "/reports", label: "Missed collections", icon: ClipboardList },
  { href: "/partners", label: "Partner services", icon: BadgePoundSterling },
  { href: "/analytics", label: "Evidence & analytics", icon: Activity },
] as const;

const governanceNavigation = [
  { href: "/audit", label: "Audit trail", icon: ScrollText },
  { href: "/settings", label: "Council settings", icon: Settings },
] as const;

export async function ConsoleShell({
  session,
  children,
}: {
  session: CouncilStaffSession;
  children: React.ReactNode;
}) {
  const memberships = await councilMemberships(session.userId);
  return (
    <div className="console-frame">
      <aside className="console-sidebar">
        <div className="console-brand">
          <span className="brand-mark"><RadioTower aria-hidden="true" size={20} /></span>
          <span>
            <strong>What Bin</strong>
            <small>Council Console</small>
          </span>
        </div>

        <div className="tenant-card">
          <div className="tenant-kicker">
            <Building2 aria-hidden="true" size={15} />
            Active authority
          </div>
          {memberships.length > 1 ? (
            <form action={switchCouncil}>
              <label className="sr-only" htmlFor="organisationId">Active council</label>
              <select
                defaultValue={session.organisation.id}
                id="organisationId"
                name="organisationId"
              >
                {memberships.map((membership) => (
                  <option key={membership.organisation_id} value={membership.organisation_id}>
                    {membership.organisation_name}
                  </option>
                ))}
              </select>
              <button className="tenant-switch-button" type="submit">Switch</button>
            </form>
          ) : (
            <strong>{session.organisation.name}</strong>
          )}
          <span className="tenant-plan">{session.organisation.planTier} · {session.organisation.status}</span>
        </div>

        <nav aria-label="Council operations" className="console-nav">
          <span className="nav-section-label">Resident operations</span>
          {primaryNavigation
            .filter((item) => (
              item.href !== "/analytics" || councilRoleCan(session.role, "analytics:view")
            ))
            .map((item) => <NavLink key={item.href} {...item} />)}
          <span className="nav-section-label nav-section-spaced">Governance</span>
          {governanceNavigation
            .filter((item) => (
              item.href !== "/audit" || councilRoleCan(session.role, "audit:view")
            ))
            .map((item) => <NavLink key={item.href} {...item} />)}
        </nav>

        <div className="sidebar-footer">
          <div className="role-pill">
            <ShieldCheck aria-hidden="true" size={16} />
            {session.role}
          </div>
          <span className="sidebar-email">{session.email ?? "Council staff account"}</span>
          <form action={signOutCouncil}>
            <button className="text-button" type="submit">Sign out</button>
          </form>
        </div>
      </aside>

      <div className="console-main">
        <header className="mobile-bar">
          <div className="mobile-brand">
            <span className="brand-mark"><RadioTower aria-hidden="true" size={18} /></span>
            <span>What Bin Council Console</span>
          </div>
          <span className="mobile-authority">{session.organisation.name}</span>
        </header>
        <main className="console-content">{children}</main>
      </div>

      <nav aria-label="Mobile council navigation" className="mobile-nav">
        <NavLink href="/" icon={CircleGauge} label="Overview" />
        <NavLink href="/announcements" icon={BellRing} label="Messages" />
        <NavLink href="/disruptions" icon={TriangleAlert} label="Alerts" />
        <NavLink href="/reports" icon={ClipboardList} label="Reports" />
        <NavLink href="/settings" icon={Settings} label="Settings" />
      </nav>
    </div>
  );
}
