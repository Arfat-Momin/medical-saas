import {
  LayoutDashboard, Heart, Calendar, BedDouble, Hotel, Building,
  Building2, GitBranch, Network, Users, Shield, Pill, Package,
  Receipt, Truck, ShoppingCart, Boxes, FlaskConical, ScrollText,
  BadgeDollarSign, BookMarked, CreditCard, BookOpen, Lock,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: any;
  /** If set, this nav item is only shown when the user has this permission. */
  permission?: string;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
  /** If set, the whole group is only shown when the user has this permission. */
  permission?: string;
}

export const hospitalNav: NavGroup[] = [
  {
    items: [
      { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
      { to: '/patients',     label: 'Patients',     icon: Heart,     permission: 'patient:read' },
      { to: '/appointments', label: 'Appointments', icon: Calendar,  permission: 'appointment:read' },
    ],
  },
  {
    title: 'Inpatient',
    permission: 'ipd:read',
    items: [
      { to: '/ipd/admissions', label: 'Admissions',  icon: BedDouble },
      { to: '/ipd/beds',       label: 'Beds',        icon: Hotel },
      { to: '/ipd/locations',  label: 'Locations',   icon: Building,      permission: 'ipd:manage' },
      { to: '/ipd/pricing',    label: 'IPD Pricing', icon: BadgeDollarSign, permission: 'billing:manage' },
    ],
  },
  {
    title: 'Organization',
    permission: 'org:manage',
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
    permission: 'pharmacy:read',
    items: [
      { to: '/pharmacy/queue',     label: 'Queue',     icon: Package },
      { to: '/pharmacy/medicines', label: 'Medicines', icon: Pill },
      { to: '/pharmacy/stock',     label: 'Stock',     icon: Boxes,      permission: 'pharmacy:stock' },
      { to: '/pharmacy/suppliers', label: 'Suppliers', icon: Truck,      permission: 'pharmacy:stock' },
      { to: '/pharmacy/purchases', label: 'Purchases', icon: ShoppingCart, permission: 'pharmacy:stock' },
      { to: '/pharmacy/invoices',  label: 'Invoices',  icon: Receipt,    permission: 'billing:read' },
    ],
  },
  {
    title: 'Laboratory',
    permission: 'lab:read',
    items: [
      { to: '/laboratory/orders',   label: 'Lab Orders',   icon: ScrollText },
      { to: '/laboratory/tests',    label: 'Tests',        icon: FlaskConical },
      { to: '/laboratory/invoices', label: 'Lab Invoices', icon: Receipt,   permission: 'billing:read' },
    ],
  },
  {
    title: 'Billing',
    permission: 'billing:read',
    items: [
      { to: '/billing/invoices',      label: 'Invoices', icon: Receipt },
      { to: '/settings/pricing',      label: 'Pricing',  icon: BadgeDollarSign, permission: 'billing:manage' },
      { to: '/settings/subscription', label: 'My Plan',  icon: CreditCard,      permission: 'org:manage' },
    ],
  },
  {
    title: 'Finance',
    permission: 'finance:read',
    items: [
      { to: '/finance/accounts',     label: 'Accounts Book', icon: BookOpen },
      { to: '/finance/cash-closing', label: 'Cash Closing',  icon: Lock,         permission: 'finance:manage' },
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

/**
 * Filter nav groups and items by the user's permissions.
 * Groups without a `permission` are always shown.
 * Items without a `permission` are always shown (if their group is visible).
 */
export function filterNavByPermissions(groups: NavGroup[], permissions: string[]): NavGroup[] {
  const has = (p: string | undefined) => !p || permissions.includes(p);
  return groups
    .filter((g) => has(g.permission))
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => has(item.permission)),
    }))
    .filter((g) => g.items.length > 0);
}

/** 5-item mobile tab bar */
export const mobileTabs = [
  { to: '/dashboard',    label: 'Home',     icon: LayoutDashboard },
  { to: '/patients',     label: 'Patients', icon: Heart },
  { to: '/appointments', label: 'Visits',   icon: Calendar },
  { to: '/pharmacy/queue', label: 'Rx',     icon: Package },
];