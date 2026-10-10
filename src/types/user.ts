export type UserRole = 'Admin' | 'Manager' | 'Supervisor';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  permittedModules: string[];
  createdAt: string;
}
