"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function NavLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`nav-link${active ? " nav-link-active" : ""}`}
      href={href}
    >
      <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
}
