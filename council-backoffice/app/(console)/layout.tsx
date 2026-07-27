import { ConsoleShell } from "@/components/console-shell";
import { requireCouncilSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireCouncilSession("dashboard:view");
  return <ConsoleShell session={session}>{children}</ConsoleShell>;
}
