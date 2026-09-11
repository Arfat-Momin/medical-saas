import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@medical/shared';

export function OrganizationPage() {
  const { data, isLoading, isError } = useOrganization();
  const update = useUpdateOrganization();
  const { can } = usePermissions();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? '',
        legalName: data.legal_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        pincode: data.pincode ?? '',
      });
    }
  }, [data]);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size={28} /></div>;
  if (isError || !form) return <Alert tone="error">Failed to load organization.</Alert>;

  const canEdit = can(PERMISSIONS.ORG_MANAGE);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    await update.mutateAsync({
      name: form.name,
      legalName: form.legalName || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const onChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Organization"
        subtitle="Profile of your hospital or clinic"
      />

      <Card>
        <CardHeader title="Organization details" subtitle="Visible to all users in your tenant" />
        <CardBody>
          <form onSubmit={onSave} className="space-y-4">
            {saved && <Alert tone="success">Changes saved.</Alert>}
            {update.isError && <Alert tone="error">Failed to save changes.</Alert>}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Name" value={form.name} onChange={onChange('name')} disabled={!canEdit} required />
              <Input label="Legal name" value={form.legalName} onChange={onChange('legalName')} disabled={!canEdit} />
              <Input label="Email" type="email" value={form.email} onChange={onChange('email')} disabled={!canEdit} />
              <Input label="Phone" value={form.phone} onChange={onChange('phone')} disabled={!canEdit} />
              <Input label="Address" value={form.address} onChange={onChange('address')} disabled={!canEdit} className="md:col-span-2" />
              <Input label="City" value={form.city} onChange={onChange('city')} disabled={!canEdit} />
              <Input label="State" value={form.state} onChange={onChange('state')} disabled={!canEdit} />
              <Input label="Pincode" value={form.pincode} onChange={onChange('pincode')} disabled={!canEdit} />
            </div>

            {canEdit && (
              <div className="flex justify-end">
                <Button type="submit" loading={update.isPending}>Save changes</Button>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </>
  );
}