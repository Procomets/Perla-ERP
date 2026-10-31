import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole, ModulePermissionsMap } from '../types/user';
import { isUserAdmin, hasModulePermission, createDefaultPermissions } from '../utils/permissions';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  activeRole: UserRole;
  designation: string;
  isAdmin: boolean;
  setActiveRole: (role: UserRole) => void;
  loginAsDemoRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  isDemoMode: boolean;
  canAccess: (moduleId: string, action?: 'view' | 'edit' | 'delete') => boolean;
  canView: (moduleId: string) => boolean;
  canEdit: (moduleId: string) => boolean;
  canDelete: (moduleId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Default demo user profile (Admin by default)
  const [user, setUser] = useState<UserProfile | null>({
    uid: 'demo-admin-uid',
    email: 'admin@perlatextiles.com',
    displayName: 'Thiru M. (Admin)',
    role: 'Admin',
    designation: 'Admin',
    active: true,
    permittedModules: ['*'],
    permissions: createDefaultPermissions('admin'),
    createdAt: new Date().toISOString()
  });

  const [activeRole, setActiveRoleState] = useState<UserRole>('Admin');

  const isDemoModeRef = React.useRef(isDemoMode);
  isDemoModeRef.current = isDemoMode;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        setIsDemoMode(false);
        
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          let displayName = fbUser.displayName || 'Authorized User';
          let dbRole = activeRole;
          let designation = 'Supervisor';
          let permissions: ModulePermissionsMap | undefined = undefined;
          let permittedModules: string[] = ['*'];
          let isActive = true;
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.displayName) displayName = userData.displayName;
            else if (userData.name) displayName = userData.name;
            
            if (userData.role) {
              dbRole = (userData.role.charAt(0).toUpperCase() + userData.role.slice(1)) as UserRole;
            }
            if (userData.designation) {
              designation = userData.designation;
            } else {
              designation = dbRole;
            }
            if (userData.isActive !== undefined) {
              isActive = userData.isActive;
            } else if (userData.active !== undefined) {
              isActive = userData.active;
            }
            if (userData.permissions) {
              permissions = userData.permissions;
            }
            if (Array.isArray(userData.permittedModules)) {
              permittedModules = userData.permittedModules;
            } else if (permissions) {
              const activePerms = permissions;
              permittedModules = Object.keys(activePerms).filter((k) => activePerms[k]?.view);
            }
          }

          const userProfile: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || 'user@perlatextiles.com',
            displayName: displayName,
            role: dbRole,
            designation: designation,
            active: isActive,
            permittedModules: permittedModules,
            permissions: permissions,
            createdAt: new Date().toISOString()
          };
          
          setUser(userProfile);
          setActiveRoleState(dbRole);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || 'user@perlatextiles.com',
            displayName: fbUser.displayName || 'Authorized User',
            role: activeRole,
            designation: activeRole,
            active: true,
            permittedModules: ['*'],
            createdAt: new Date().toISOString()
          });
        }
      } else {
        if (!isDemoModeRef.current) {
          setUser(null);
          setFirebaseUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    if (user) {
      setUser({ ...user, role, designation: role });
    }
  };

  const loginAsDemoRole = (role: UserRole) => {
    setIsDemoMode(true);
    setActiveRoleState(role);
    const rolePreset = role === 'Admin' ? 'admin' : role === 'Manager' ? 'manager' : 'supervisor';
    setUser({
      uid: `demo-${role.toLowerCase()}-uid`,
      email: `${role.toLowerCase()}@perlatextiles.com`,
      displayName: `Perla ${role} User`,
      role,
      designation: role,
      active: true,
      permittedModules: role === 'Admin' ? ['*'] : role === 'Manager' ? ['po', 'inward', 'outward', 'statement', 'invoice', 'attendance', 'warehouse', 'chemical', 'vendors', 'purchases', 'salary', 'eb', 'transport', 'items', 'settings'] : ['chemical', 'inward', 'outward', 'warehouse', 'attendance', 'eb'],
      permissions: createDefaultPermissions(rolePreset),
      createdAt: new Date().toISOString()
    });
  };

  const logout = async () => {
    if (firebaseUser) {
      await signOut(auth);
    }
    setUser(null);
    setFirebaseUser(null);
  };

  const isAdmin = useMemo(() => isUserAdmin(user), [user]);
  const designation = useMemo(() => user?.designation || user?.role || 'Admin', [user]);

  const canAccess = (moduleId: string, action: 'view' | 'edit' | 'delete' = 'view') => {
    return hasModulePermission(user, moduleId, action);
  };

  const canView = (moduleId: string) => hasModulePermission(user, moduleId, 'view');
  const canEdit = (moduleId: string) => hasModulePermission(user, moduleId, 'edit');
  const canDelete = (moduleId: string) => hasModulePermission(user, moduleId, 'delete');

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        activeRole,
        designation,
        isAdmin,
        setActiveRole,
        loginAsDemoRole,
        logout,
        isDemoMode,
        canAccess,
        canView,
        canEdit,
        canDelete
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
