import { AppShell } from '@/components/app-shell';
import { RouteHead } from '@/components/route-head';
import { ReportsScreen } from '@/features/reports/reports-screen';

export default function ReportsRoute() {
  return (
    <AppShell activeRoute="/activity">
      <RouteHead title="Missed Collection Reports" description="Track missed bin collection reports and council references." path="/reports" private />
      <ReportsScreen />
    </AppShell>
  );
}
