import { NavLink } from 'react-router-dom';
import {
  Building2, LayoutDashboard, GitBranch, Users, Shield, Network,
  ScrollText, Heart, Calendar, Pill, ShoppingCart, Boxes, Truck,
  FlaskConical, Receipt, BadgeDollarSign, BedDouble, Hotel, Building,
  Package,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/cn';

interface NavItem  { to: string; label: string; icon: any }
interface NavGroup { title?: string; items: NavItem[] }

const hospitalNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
      { to: '/patients',    label: 'Patients',    icon: Heart },
      { to: '/appointments',label: 'Appointments',icon: Calendar },
    ],
  },
  {
    title: 'IPD',
    items: [
      { to: '/ipd/admissions', label: 'Admissions', icon: BedDouble },
      { to: '/ipd/beds',       label: 'Beds',       icon: Hotel },
      { to: '/ipd/locations',  label: 'Locations',  icon: Building },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/organization',label: 'Organization',icon: Building2 },
      { to: '/branches',    label: 'Branches',    icon: GitBranch },
      { to: '/departments', label: 'Departments', icon: Network },
      { to: '/users',       label: 'Users',       icon: Users },
      { to: '/roles',       label: 'Roles',       icon: Shield },
    ],
  },
  {
    title: 'Pharmacy',
    items: [
      { to: '/pharmacy/medicines', label: 'Medicines', icon: Pill },
      { to: '/pharmacy/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/pharmacy/purchases', label: 'Purchases', icon: ShoppingCart },
      { to: '/pharmacy/stock',     label: 'Stock',     icon: Boxes },
    ],
  },
  {
    title: 'Laboratory',
    items: [
      { to: '/laboratory/tests',  label: 'Tests',      icon: FlaskConical },
      { to: '/laboratory/orders', label: 'Lab Orders', icon: ScrollText },
    ],
  },
  {
    title: 'Billing',
    items: [
      { to: '/billing/items',    label: 'Billable Items', icon: BadgeDollarSign },
      { to: '/billing/invoices', label: 'Invoices',       icon: Receipt },
    ],
  },
];

const platformNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/tenants',   label: 'Tenants',   icon: Building2 },
      { to: '/plans',     label: 'Plans',     icon: Package },
    ],
  },
];

export function Sidebar() {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false);
  const groups = isPlatformAdmin ? platformNav : hospitalNav;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">M</div>
        <span className="font-semibold text-slate-900">Medical SaaS</span>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/dashboard'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-400">v0.1.0</div>
    </aside>
  );
}
