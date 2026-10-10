import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { UserProfile, UserRole } from '../types/user';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  loginAsDemoRole: (role: UserRole) => void;
  logout: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Default demo user profile
  const [user, setUser] = useState<UserProfile | null>({
    uid: 'demo-admin-uid',
    email: 'admin@perlatextiles.com',
    displayName: 'Thiru M. (Admin)',
    role: 'Admin',
    active: true,
    permittedModules: ['*'],
    createdAt: new Date().toISOString()
  });

  const [activeRole, setActiveRoleState] = useState<UserRole>('Admin');

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
          
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            if (userData.displayName) displayName = userData.displayName;
            else if (userData.name) displayName = userData.name;
            
            if (userData.role) {
              // Capitalize the first letter in case it is stored as 'admin' instead of 'Admin'
              dbRole = (userData.role.charAt(0).toUpperCase() + userData.role.slice(1)) as UserRole;
            }
          }
          
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || 'user@perlatextiles.com',
            displayName: displayName,
            role: dbRole,
            active: true,
            permittedModules: ['*'],
            createdAt: new Date().toISOString()
          });
          setActiveRoleState(dbRole);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser({
            uid: fbUser.uid,
            email: fbUser.email || 'user@perlatextiles.com',
            displayName: fbUser.displayName || 'Authorized User',
            role: activeRole,
            active: true,
            permittedModules: ['*'],
            createdAt: new Date().toISOString()
          });
        }
      } else {
        // Only clear state if there's no demo mode user
        if (!isDemoMode) {
          setUser(null);
          setFirebaseUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeRole, isDemoMode]);

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    if (user) {
      setUser({ ...user, role });
    }
  };

  const loginAsDemoRole = (role: UserRole) => {
    setIsDemoMode(true);
    setActiveRoleState(role);
    setUser({
      uid: `demo-${role.toLowerCase()}-uid`,
      email: `${role.toLowerCase()}@perlatextiles.com`,
      displayName: `Perla ${role} User`,
      role,
      active: true,
      permittedModules: role === 'Admin' ? ['*'] : role === 'Manager' ? ['po', 'inward', 'outward', 'statement', 'invoice', 'attendance', 'stock', 'chemical', 'vendor', 'expenses'] : ['chemical', 'eb'],
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

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        activeRole,
        setActiveRole,
        loginAsDemoRole,
        logout,
        isDemoMode
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
