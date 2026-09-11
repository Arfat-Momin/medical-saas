import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/auth.store';

export function TenantsPage() {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);

  if (!isPlatformAdmin) {
    return <div className="text-sm text-red-600">Access denied.</div>;
  }

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle="Registered hospitals & clinics on the platform"
      />

      <Card>
        <CardHeader title="Coming in Module 9" subtitle="Platform Admin console" />
        <CardBody>
          <div className="space-y-2 text-sm text-slate-600">
            <p>This screen will display:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Tenant list with plan, status, expiry date</li>
              <li>Subscription lifecycle: Trial  Active  Grace  Suspended</li>
              <li>Razorpay payment history (subscriptions only)</li>
              <li>Renewal &amp; expiry dashboard</li>
              <li><strong>Zero access to clinical, financial or operational data</strong></li>
            </ul>
            <p className="pt-2 text-xs text-slate-500">
              <Badge tone="purple">Super Admin</Badge>{' '}
              RLS policies already enforce isolation - this UI just surfaces the platform tables.
            </p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}