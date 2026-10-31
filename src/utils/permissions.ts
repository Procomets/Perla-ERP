import { ModuleId, ModulePermission, ModulePermissionsMap, UserProfile } from '../types/user';

export interface ModuleConfig {
  id: ModuleId;
  label: string;
  category: 'Overview' | 'Operations' | 'Production' | 'Human Resources' | 'Expenses' | 'Masters & Settings';
  description: string;
}

export const ERP_MODULES: ModuleConfig[] = [
  { id: 'dashboard', label: 'Dashboard', category: 'Overview', description: 'Executive dashboard, KPI cards, and operational charts' },
  { id: 'po', label: 'Purchase Orders', category: 'Operations', description: 'PO creation, styles, colour lines, and customer orders' },
  { id: 'inward', label: 'Inward Receipts', category: 'Operations', description: 'Incoming customer grey fabric batch tracking' },
  { id: 'outward', label: 'Outward Dispatches', category: 'Operations', description: 'Finished processed goods dispatch & delivery challans' },
  { id: 'statement', label: 'Statement & Approval', category: 'Operations', description: 'Inward vs outward fabric reconciliation ledger' },
  { id: 'invoices', label: 'Invoice Generation', category: 'Operations', description: 'GST tax invoices, billing, and official documents' },
  { id: 'chemical', label: 'Chemical Entry', category: 'Production', description: 'Shopfloor chemical recipe consumption & batch logs' },
  { id: 'warehouse', label: 'Warehouse & Stock', category: 'Production', description: 'Real-time stock ledger for chemicals, dyes, and firewood' },
  { id: 'purchases', label: 'Purchases (Raw/Wood)', category: 'Production', description: 'Supplier material receipts and weighbridge entries' },
  { id: 'employees', label: 'Employee Master', category: 'Human Resources', description: 'Worker directory, wage profiles, and documents' },
  { id: 'attendance', label: 'Attendance', category: 'Human Resources', description: 'Daily worker shifts and overtime hours tracker' },
  { id: 'salary', label: 'Salary Sheet', category: 'Human Resources', description: 'Payroll computation, advances, and payment payouts' },
  { id: 'eb', label: 'EB / Electricity Entry', category: 'Expenses', description: 'Factory utility meter logs and power cost tracking' },
  { id: 'transport', label: 'Transport Expenses', category: 'Expenses', description: 'Logistics freight expenses tied to dispatches' },
  { id: 'vendors', label: 'Vendor Master', category: 'Masters & Settings', description: 'Directory of customers, mills, suppliers, and subcontractors' },
  { id: 'items', label: 'Item / Chemical Master', category: 'Masters & Settings', description: 'Chemicals, auxiliaries, dyes, and item master' },
  { id: 'users', label: 'User Management', category: 'Masters & Settings', description: 'System accessibility, designations, and permissions' },
  { id: 'settings', label: 'General Settings', category: 'Masters & Settings', description: 'Company tax settings, colours, and system defaults' }
];

export const COMMON_DESIGNATIONS = [
  'Admin',
  'Managing Director',
  'General Manager',
  'Production Manager',
  'Shift Supervisor',
  'Quality Inspector',
  'Accountant',
  'Store Keeper',
  'Data Entry Operator',
  'Other'
];

/**
 * Checks if the user is considered an Administrator (full access to everything)
 */
export const isUserAdmin = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  const roleLower = (user.role || '').toLowerCase();
  const designationLower = (user.designation || '').toLowerCase();
  
  if (roleLower === 'admin' || designationLower === 'admin' || designationLower === 'managing director') {
    return true;
  }
  
  if (Array.isArray(user.permittedModules) && user.permittedModules.includes('*')) {
    return true;
  }
  
  return false;
};

/**
 * Checks if user has a specific action permission for a module
 */
export const hasModulePermission = (
  user: UserProfile | null | undefined,
  moduleId: string,
  action: 'view' | 'edit' | 'delete' = 'view'
): boolean => {
  if (!user) return false;
  
  // Administrators have unrestricted access to all modules and actions
  if (isUserAdmin(user)) {
    return true;
  }

  // If user is marked inactive, deny access
  if (user.active === false) {
    return false;
  }

  // Check granular permissions dictionary if present
  if (user.permissions && user.permissions[moduleId]) {
    const perm = user.permissions[moduleId];
    if (action === 'view') return Boolean(perm.view);
    if (action === 'edit') return Boolean(perm.edit);
    if (action === 'delete') return Boolean(perm.delete);
  }

  // Fallback for legacy user documents with permittedModules array
  if (Array.isArray(user.permittedModules)) {
    if (user.permittedModules.includes('*') || user.permittedModules.includes(moduleId)) {
      if (action === 'view') return true;
      // Legacy manager had edit access to operational modules
      if (action === 'edit' && user.role?.toLowerCase() === 'manager') return true;
      return false;
    }
  }

  return false;
};

/**
 * Finds the first accessible module for the given user (for redirect after login)
 */
export const getFirstAccessibleModule = (user: UserProfile | null | undefined): string => {
  if (!user) return 'dashboard';
  if (isUserAdmin(user)) return 'dashboard';

  for (const mod of ERP_MODULES) {
    if (hasModulePermission(user, mod.id, 'view')) {
      return mod.id;
    }
  }

  return 'dashboard';
};

/**
 * Creates preset permission sets for user onboarding / quick assignment
 */
export const createDefaultPermissions = (
  preset: 'admin' | 'manager' | 'supervisor' | 'accountant' | 'store_keeper' | 'view_only' | 'none'
): ModulePermissionsMap => {
  const map: ModulePermissionsMap = {};

  ERP_MODULES.forEach((mod) => {
    switch (preset) {
      case 'admin':
        map[mod.id] = { view: true, edit: true, delete: true };
        break;

      case 'manager': {
        const isMaster = mod.id === 'users' || mod.id === 'settings';
        map[mod.id] = {
          view: true,
          edit: !isMaster,
          delete: !isMaster && (mod.id === 'po' || mod.id === 'inward' || mod.id === 'outward')
        };
        break;
      }

      case 'supervisor': {
        const isSupervisorModule = ['chemical', 'inward', 'outward', 'warehouse', 'attendance', 'eb'].includes(mod.id);
        map[mod.id] = {
          view: isSupervisorModule,
          edit: ['chemical', 'inward', 'outward', 'attendance', 'eb'].includes(mod.id),
          delete: false
        };
        break;
      }

      case 'accountant': {
        const isAccountantModule = ['statement', 'invoices', 'purchases', 'salary', 'eb', 'transport', 'vendors'].includes(mod.id);
        map[mod.id] = {
          view: isAccountantModule,
          edit: ['statement', 'invoices', 'purchases', 'salary', 'eb', 'transport'].includes(mod.id),
          delete: false
        };
        break;
      }

      case 'store_keeper': {
        const isStoreModule = ['warehouse', 'purchases', 'chemical', 'items'].includes(mod.id);
        map[mod.id] = {
          view: isStoreModule,
          edit: ['warehouse', 'purchases', 'chemical'].includes(mod.id),
          delete: false
        };
        break;
      }

      case 'view_only':
        map[mod.id] = {
          view: mod.id !== 'users' && mod.id !== 'settings',
          edit: false,
          delete: false
        };
        break;

      case 'none':
      default:
        map[mod.id] = { view: false, edit: false, delete: false };
        break;
    }
  });

  return map;
};
