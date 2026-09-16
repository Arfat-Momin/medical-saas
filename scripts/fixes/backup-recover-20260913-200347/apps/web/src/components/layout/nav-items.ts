import {
  Building2, LayoutDashboard, GitBranch, Users, Shield, Network,
  ScrollText, Heart, Calendar, Pill, ShoppingCart, Boxes, Truck,
  FlaskConical, Receipt, BadgeDollarSign, BedDouble, Hotel, Building,
  Package,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: any;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const hospitalNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { to: '/patients',     label: 'Patients',     icon: Heart },
      { to: '/appointments', label: 'Appointments', icon: Calendar },
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
      { to: '/organization', label: 'Organization', icon: Building2 },
      { to: '/branches',     label: 'Branches',     icon: GitBranch },
      { to: '/departments',  label: 'Departments',  icon: Network },
      { to: '/users',        label: 'Users',        icon: Users },
      { to: '/roles',        label: 'Roles',        icon: Shield },
    ],
  },
  {
    title: 'Pharmacy',
    items: [
      { to: '/pharmacy/medicines', label: 'Medicines', icon: Pill },
      { to: '/pharmacy/queue',     label: 'Queue',     icon: Package },
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

export const platformNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/tenants',   label: 'Tenants',   icon: Building2 },
      { to: '/plans',     label: 'Plans',     icon: Package },
    ],
  },
];

export function getNavFor(isPlatformAdmin: boolean): NavGroup[] {
  return isPlatformAdmin ? platformNav : hospitalNav;
}
