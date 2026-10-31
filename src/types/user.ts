export type UserRole = 'Admin' | 'Manager' | 'Supervisor' | string;

export type ModuleId =
  | 'dashboard'
  | 'po'
  | 'inward'
  | 'outward'
  | 'statement'
  | 'invoices'
  | 'chemical'
  | 'warehouse'
  | 'purchases'
  | 'employees'
  | 'attendance'
  | 'salary'
  | 'eb'
  | 'transport'
  | 'vendors'
  | 'items'
  | 'users'
  | 'settings';

export interface ModulePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export type ModulePermissionsMap = Record<string, ModulePermission>;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  designation?: string;
  active: boolean;
  permittedModules: string[];
  permissions?: ModulePermissionsMap;
  createdAt: string;
}
