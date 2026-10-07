export const PRIVILEGES = [
  'viewDashboard',
  'viewInventory',
  'createItem',
  'editItem',
  'deleteItem',
  'viewMovements',
  'adjustStock',
  'stockIn',
  'stockOut',
  'transferStock',
  'generateReceipt',
  'viewReceipts',
  'viewProformas',
  'generateProforma',
  'validateProforma',
  'viewActivities',
  'viewAudit',
  'manageExpenses',
  'viewStores',
  'manageStores',
  'manageUsers',
  'manageRoles',
  'viewReports',
  'exportInventory',
  'manageSettings',
  'backupSystem',
  'resetSystemData',
  'manageProfile',
  'viewPostedNotes',
  'postPostedNotes',
] as const;

export type Privilege = typeof PRIVILEGES[number];
export type RolePermissions = Record<Privilege, boolean>;

export const PRIVILEGE_LABELS: Record<Privilege,string> = {
  viewDashboard:'View dashboard',
  viewInventory:'View inventory',
  createItem:'Create items',
  editItem:'Edit items',
  deleteItem:'Delete items',
  viewMovements:'View stock movements',
  adjustStock:'Adjust stock',
  stockIn:'Stock in',
  stockOut:'Stock out',
  transferStock:'Transfer stock',
  generateReceipt:'Generate receipts',
  viewReceipts:'View receipt history',
  viewProformas:'View proforma history',
  generateProforma:'Create proforma invoices',
  validateProforma:'Validate proformas and convert them to receipts',
  viewActivities:'View activities / expenses',
  viewAudit:'View system audit',
  manageExpenses:'Create/delete activities / expenses',
  viewStores:'View stores',
  manageStores:'Create/manage stores',
  manageUsers:'Create/edit/enable/disable users',
  manageRoles:'Create/manage roles and privileges',
  viewReports:'View reports',
  exportInventory:'Export inventory',
  manageSettings:'Manage system settings',
  backupSystem:'Create full system backups',
  resetSystemData:'Reset operational system data',
  manageProfile:'Manage own profile and password',
  viewPostedNotes:'View posted notes',
  postPostedNotes:'Post notes for everyone',
};

export const ALL_PRIVILEGES = Object.fromEntries(PRIVILEGES.map(p => [p, true])) as RolePermissions;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<RolePermissions>> = {
  Admin: { ...ALL_PRIVILEGES },
  'Store Manager': {
    manageProfile:true,
    viewDashboard:true, viewInventory:true, createItem:true, editItem:true,
    viewMovements:true, adjustStock:true, stockIn:true, stockOut:true, transferStock:true,
    generateReceipt:true, viewReceipts:true, viewProformas:true, generateProforma:true, validateProforma:true, viewActivities:true, manageExpenses:true,
    viewStores:true, manageStores:true, viewReports:true, exportInventory:true, viewPostedNotes:true, postPostedNotes:true,
  },
  'Inventory Clerk': {
    manageProfile:true,
    viewDashboard:true, viewInventory:true, viewMovements:true,
    adjustStock:true, stockIn:true, stockOut:true, transferStock:true, generateReceipt:true, viewReceipts:true, viewProformas:true, generateProforma:true, validateProforma:true, viewPostedNotes:true, postPostedNotes:true,
  },
  Auditor: {
    manageProfile:true,
    viewDashboard:true, viewInventory:true, viewMovements:true, viewReceipts:true,
    viewActivities:true, viewAudit:true, viewReports:true, exportInventory:true, viewProformas:true, viewPostedNotes:true, postPostedNotes:false,
  },
};

export const SETTINGS_PRIVILEGES = ['manageProfile','manageSettings','backupSystem','resetSystemData'] as const;
export type SettingsPrivilege = typeof SETTINGS_PRIVILEGES[number];

export function normalizePermissions(input: Record<string, boolean>|undefined): RolePermissions {
  const result = {} as RolePermissions;
  for (const p of PRIVILEGES) result[p] = input?.[p] === true;
  return result;
}

export function hasAnySettingsPermission(permissions: RolePermissions|Record<string, boolean>|undefined): boolean {
  return SETTINGS_PRIVILEGES.some(p => permissions?.[p] === true);
}

export function canSeeSettingsSection(permissions: RolePermissions|Record<string, boolean>|undefined, section: keyof typeof SETTINGS_SECTION_PRIVILEGES): boolean {
  const required = SETTINGS_SECTION_PRIVILEGES[section];
  return permissions?.[required] === true;
}

export function rolePermissions(role: string, input?: Record<string, boolean>): RolePermissions {
  if (role === 'Admin') return { ...ALL_PRIVILEGES };
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || {};
  return normalizePermissions({ ...defaults, ...(input || {}) });
}

/**
 * Canonical API contract. Authentication-only endpoints are deliberately absent.
 * Every protected application API operation maps to exactly one privilege.
 */
export const ROUTE_PRIVILEGES: Record<string, Record<string, Privilege|readonly Privilege[]>> = {
  // Bootstrap is an authenticated data aggregator. Its payload is filtered by each privilege;
  // requiring viewDashboard here would incorrectly block users who only have another view privilege.

  '/api/audit': { GET:'viewAudit' },
  '/api/users': { POST:'manageUsers', PATCH:'manageUsers' },
  '/api/roles': { POST:'manageRoles', PATCH:'manageRoles', DELETE:'manageRoles' },
  '/api/items': { POST:'createItem', PATCH:'editItem', DELETE:'deleteItem' },
  '/api/movements': { POST:'adjustStock' },
  '/api/receipts': { POST:'generateReceipt' },
  '/api/receipts/[id]/signature': { PATCH:'generateReceipt' },
  '/api/proformas': { POST:'generateProforma', PATCH:'validateProforma' },
  '/api/activities': { GET:'viewActivities', POST:'manageExpenses', DELETE:'manageExpenses' },
  '/api/stores': { POST:'manageStores' },
  '/api/reports': { GET:'viewReports' },
  // Settings GET is an any-of authorization endpoint; the route itself checks
  // manageProfile OR manageSettings OR backupSystem OR resetSystemData.
  '/api/settings': { GET:['manageProfile','manageSettings','backupSystem','resetSystemData'], PATCH:'manageSettings' },
  '/api/export': { GET:'exportInventory' },
  '/api/posted-notes': { GET:'viewPostedNotes', POST:'postPostedNotes' },
  '/api/backup': { GET:'backupSystem' },
  '/api/system/reset': { POST:'resetSystemData' },
  '/api/profile': { PATCH:'manageProfile', POST:'manageProfile' },
};

export function privilegesForRoute(pathname: string, method: string): Privilege[] {
  const value=ROUTE_PRIVILEGES[pathname]?.[method.toUpperCase()];
  if(!value) return [];
  return Array.isArray(value) ? [...value] as Privilege[] : [value as Privilege];
}

export function privilegeForRoute(pathname: string, method: string): Privilege|undefined {
  return privilegesForRoute(pathname,method)[0];
}

/** Exact Settings visibility: each section is independently controlled. */
export const SETTINGS_SECTION_PRIVILEGES = {
  profile: 'manageProfile',
  system: 'manageSettings',
  backup: 'backupSystem',
  reset: 'resetSystemData',
} as const;
