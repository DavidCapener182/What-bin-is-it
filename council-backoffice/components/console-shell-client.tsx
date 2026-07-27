"use client";

import { Building2, RadioTower, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

import { signOutCouncil, switchCouncil } from "@/app/actions";
import { councilRoleCan } from "@/lib/permissions";
import type { CouncilStaffSession } from "@/lib/types";
import { NavLink } from "./nav-link";

const primaryNavigation = [
  { href: "/", label: "Overview", icon: "gauge" },
  { href: "/announcements", label: "Announcements", icon: "megaphone" },
  { href: "/disruptions", label: "Disruptions", icon: "warning" },
  { href: "/guidance", label: "Recycling guidance", icon: "book" },
  { href: "/reports", label: "Missed collections", icon: "clipboard" },
  { href: "/partners", label: "Partner services", icon: "badge-pound" },
  { href: "/crm/messages", label: "Resident messages", icon: "messages" },
  { href: "/analytics", label: "Evidence & analytics", icon: "activity" },
] as const;

const platformNavigation = [
  { href: "/", label: "Platform overview", icon: "gauge" },
  { href: "/crm", label: "Relationship CRM", icon: "building" },
  { href: "/crm/messages", label: "Resident inbox", icon: "messages" },
] as const;

const governanceNavigation = [
  { href: "/audit", label: "Audit trail", icon: "scroll" },
  { href: "/settings", label: "Council settings", icon: "settings" },
] as const;

export function ConsoleShellClient({
  session,
  memberships,
  children,
}: {
  session: CouncilStaffSession;
  memberships: Array<{ organisationId: string; organisationName: string }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const platformSurface = session.platformAdmin && (
    pathname === "/" || pathname.startsWith("/crm")
  );
  const councilSurface = !platformSurface;

  return (
    <div className="console-frame">
      <aside className="console-sidebar">
        <div className="console-brand">
          <span className="brand-mark"><RadioTower aria-hidden="true" size={20} /></span>
          <span>
            <strong>What Bin</strong>
            <small>{platformSurface ? "Platform Console" : "Council Console"}</small>
          </span>
        </div>

        {councilSurface ? (
          <div className="tenant-card">
            <div className="tenant-kicker">
              <Building2 aria-hidden="true" size={15} />
              {session.platformAdmin ? "Selected council portal" : "Active authority"}
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
                    <option key={membership.organisationId} value={membership.organisationId}>
                      {membership.organisationName}
                    </option>
                  ))}
                </select>
                {session.platformAdmin ? <input name="returnTo" type="hidden" value="/council" /> : null}
                <button className="tenant-switch-button" type="submit">Switch council</button>
              </form>
            ) : (
              <strong>{session.organisation.name}</strong>
            )}
            <span className="tenant-plan">{session.organisation.planTier} · {session.organisation.status}</span>
          </div>
        ) : null}

        <nav aria-label={platformSurface ? "Platform navigation" : "Council operations"} className="console-nav">
          {session.platformAdmin ? (
            <>
              <span className="nav-section-label">Platform</span>
              {platformNavigation.map((item) => <NavLink key={item.href} {...item} />)}
            </>
          ) : null}
          {councilSurface ? (
            <>
              <span className={`nav-section-label${session.platformAdmin ? " nav-section-spaced" : ""}`}>
                {session.platformAdmin ? `Council portal · ${session.organisation.name}` : "Resident operations"}
              </span>
              {primaryNavigation
                .filter((item) => (
                  (item.href !== "/analytics" || councilRoleCan(session.role, "analytics:view"))
                  && (item.href !== "/crm/messages" || councilRoleCan(session.role, "support:view"))
                ))
                .map((item) => (
                  <NavLink
                    href={session.platformAdmin && item.href === "/" ? "/council" : item.href}
                    icon={item.icon}
                    key={item.href}
                    label={session.platformAdmin && item.href === "/" ? "Council overview" : item.label}
                  />
                ))}
              <span className="nav-section-label nav-section-spaced">Governance</span>
              {governanceNavigation
                .filter((item) => (
                  item.href !== "/audit" || councilRoleCan(session.role, "audit:view")
                ))
                .map((item) => <NavLink key={item.href} {...item} />)}
            </>
          ) : null}
        </nav>

        <div className="sidebar-footer">
          <div className="role-pill">
            <ShieldCheck aria-hidden="true" size={16} />
            {session.platformAdmin ? "Platform superadmin" : session.role}
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
            <span>{platformSurface ? "What Bin Platform" : "What Bin Council Console"}</span>
          </div>
          <span className="mobile-authority">{platformSurface ? "All councils" : session.organisation.name}</span>
        </header>
        <main className="console-content">{children}</main>
      </div>

      <nav
        aria-label={platformSurface ? "Mobile platform navigation" : "Mobile council navigation"}
        className={`mobile-nav${platformSurface ? " platform-mobile-nav" : ""}`}
      >
        <NavLink href="/" icon="gauge" label={platformSurface ? "Platform" : "Overview"} />
        {platformSurface ? (
          <>
            <NavLink href="/crm" icon="building" label="CRM" />
            <NavLink href="/crm/messages" icon="messages" label="Inbox" />
          </>
        ) : (
          <>
            {councilRoleCan(session.role, "support:view")
              ? <NavLink href="/crm/messages" icon="messages" label="Inbox" />
              : session.platformAdmin
                ? <NavLink href="/council" icon="building" label="Council" />
                : <NavLink href="/announcements" icon="bell" label="Messages" />}
            <NavLink href="/disruptions" icon="warning" label="Alerts" />
            <NavLink href="/reports" icon="clipboard" label="Reports" />
            <NavLink href="/settings" icon="settings" label="Settings" />
          </>
        )}
      </nav>
    </div>
  );
}
