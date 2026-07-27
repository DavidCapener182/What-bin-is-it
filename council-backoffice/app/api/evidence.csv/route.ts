import { councilRoleCan } from "@/lib/permissions";
import { requireCouncilSession } from "@/lib/auth";
import { dashboardMetrics } from "@/lib/data";

function cell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET() {
  const session = await requireCouncilSession("analytics:view");
  if (!councilRoleCan(session.role, "analytics:export")) {
    return new Response("This role cannot export council evidence.", { status: 403 });
  }
  const overview = await dashboardMetrics(session);
  const rows = [
    ["council", "provider_id", "period_days", "metric", "value", "definition", "state"],
    ...overview.metrics.map((metric) => [
      session.organisation.name,
      session.organisation.providerId,
      overview.dataPeriodDays,
      metric.label,
      metric.value,
      metric.detail,
      metric.state,
    ]),
  ];
  const csv = `${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="what-bin-${session.organisation.slug}-evidence-${date}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
