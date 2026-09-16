import {
  LayoutDashboard, Heart, Calendar, BedDouble, Hotel, Building,
  Building2, GitBranch, Network, Users, Shield, Pill, Package,
  Receipt, Truck, ShoppingCart, Boxes, FlaskConical, ScrollText,
  BadgeDollarSign, BookMarked,
} from 'lucide-react';

export interface NavItem { to: string; label: string; icon: any; }
export interface NavGroup { title?: string; items: NavItem[]; }

export const hospitalNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { to: '/patients',     label: 'Patients',     icon: Heart },
      { to: '/appointments', label: 'Appointments', icon: Calendar },
    ],
  },
  {
    title: 'Inpatient',
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
      { to: '/pharmacy/queue',     label: 'Queue',     icon: Package },
      { to: '/pharmacy/medicines', label: 'Medicines', icon: Pill },
      { to: '/pharmacy/stock',     label: 'Stock',     icon: Boxes },
      { to: '/pharmacy/suppliers', label: 'Suppliers', icon: Truck },
      { to: '/pharmacy/purchases', label: 'Purchases', icon: ShoppingCart },
      { to: '/pharmacy/invoices',  label: 'Invoices',  icon: Receipt },
    ],
  },
  {
    title: 'Laboratory',
    items: [
      { to: '/laboratory/orders',   label: 'Lab Orders',   icon: ScrollText },
      { to: '/laboratory/tests',    label: 'Tests',        icon: FlaskConical },
      { to: '/laboratory/invoices', label: 'Lab Invoices', icon: Receipt },
    ],
  },
  {
    title: 'Billing',
    items: [
      { to: '/billing/invoices', label: 'Invoices',       icon: Receipt },
      { to: '/settings/pricing', label: 'Pricing',        icon: BadgeDollarSign },
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

/** 5-item mobile tab bar */
export const mobileTabs = [
  { to: '/dashboard',    label: 'Home',     icon: LayoutDashboard },
  { to: '/patients',     label: 'Patients', icon: Heart },
  { to: '/appointments', label: 'Visits',   icon: Calendar },
  { to: '/pharmacy/queue', label: 'Rx',     icon: Package },
];