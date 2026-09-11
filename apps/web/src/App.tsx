import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { PricingPage } from '@/pages/public/PricingPage';
import { SignupPage } from '@/pages/public/SignupPage';
import { SignupSuccessPage } from '@/pages/public/SignupSuccessPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { OrganizationPage } from '@/pages/OrganizationPage';
import { BranchesPage } from '@/pages/BranchesPage';
import { DepartmentsPage } from '@/pages/DepartmentsPage';
import { UsersPage } from '@/pages/UsersPage';
import { RolesPage } from '@/pages/RolesPage';
import { PlatformDashboardPage } from '@/pages/platform/PlatformDashboardPage';
import { TenantsPage as PlatformTenantsPage } from '@/pages/platform/TenantsPage';
import { TenantDetailPage } from '@/pages/platform/TenantDetailPage';
import { PlansPage } from '@/pages/platform/PlansPage';
import { LabTestsPage } from '@/pages/laboratory/LabTestsPage';
import { LabOrdersPage } from '@/pages/laboratory/LabOrdersPage';
import { LabOrderDetailPage } from '@/pages/laboratory/LabOrderDetailPage';
import { BillableItemsPage } from '@/pages/billing/BillableItemsPage';
import { InvoicesPage } from '@/pages/billing/InvoicesPage';
import { InvoiceDetailPage } from '@/pages/billing/InvoiceDetailPage';
import { LocationsPage } from '@/pages/ipd/LocationsPage';
import { BedsPage } from '@/pages/ipd/BedsPage';
import { AdmissionsPage } from '@/pages/ipd/AdmissionsPage';
import { AdmissionDetailPage } from '@/pages/ipd/AdmissionDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PatientsPage } from '@/pages/PatientsPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { ConsultationPage } from '@/pages/ConsultationPage';
import { MedicinesPage } from '@/pages/pharmacy/MedicinesPage';
import { SuppliersPage } from '@/pages/pharmacy/SuppliersPage';
import { PurchasesPage } from '@/pages/pharmacy/PurchasesPage';
import { StockPage } from '@/pages/pharmacy/StockPage';


export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/signup/success" element={<SignupSuccessPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/organization" element={<OrganizationPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/pharmacy/medicines" element={<MedicinesPage />} />
          <Route path="/pharmacy/suppliers" element={<SuppliersPage />} />
          <Route path="/pharmacy/purchases" element={<PurchasesPage />} />
          <Route path="/pharmacy/stock" element={<StockPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/consultation/:encounterId" element={<ConsultationPage />} />
          <Route path="/roles" element={<RolesPage />} />
<Route path="/tenants"     element={<PlatformTenantsPage />} />
          <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="/plans"       element={<PlansPage />} />
          <Route path="/laboratory/tests" element={<LabTestsPage />} />
          <Route path="/laboratory/orders" element={<LabOrdersPage />} />
          <Route path="/laboratory/orders/:orderId" element={<LabOrderDetailPage />} />
          <Route path="/billing/items" element={<BillableItemsPage />} />
          <Route path="/billing/invoices" element={<InvoicesPage />} />
          <Route path="/billing/invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="/ipd/locations" element={<LocationsPage />} />
          <Route path="/ipd/beds" element={<BedsPage />} />
          <Route path="/ipd/admissions" element={<AdmissionsPage />} />
          <Route path="/ipd/admissions/:admissionId" element={<AdmissionDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}