"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgePoundSterling,
  BellRing,
  BookOpenCheck,
  Building2,
  CircleGauge,
  ClipboardList,
  Megaphone,
  MessageSquareText,
  ScrollText,
  Settings,
  TriangleAlert,
} from "lucide-react";

const navigationIcons = {
  activity: Activity,
  "badge-pound": BadgePoundSterling,
  bell: BellRing,
  book: BookOpenCheck,
  building: Building2,
  gauge: CircleGauge,
  clipboard: ClipboardList,
  megaphone: Megaphone,
  messages: MessageSquareText,
  scroll: ScrollText,
  settings: Settings,
  warning: TriangleAlert,
} as const;

export type NavIconName = keyof typeof navigationIcons;

export function NavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: NavIconName;
  label: string;
}) {
  const pathname = usePathname();
  const active = href === "/"
    ? pathname === "/"
    : href === "/crm"
      ? pathname.startsWith("/crm") && !pathname.startsWith("/crm/messages")
      : pathname.startsWith(href);
  const Icon = navigationIcons[icon];
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`nav-link${active ? " nav-link-active" : ""}`}
      href={href}
      prefetch={false}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}
