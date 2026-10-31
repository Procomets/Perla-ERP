import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, firebaseConfig } from '../../config/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  updatePassword,
  deleteUser,
  setPersistence,
  inMemoryPersistence
} from 'firebase/auth';
import {
  Plus,
  Mail,
  Shield,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Lock,
  Search,
  CheckSquare,
  Square,
  Sliders,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { UserRole, ModuleId, ModulePermissionsMap } from '../../types/user';
import { useAuth } from '../../context/AuthContext';
import {
  ERP_MODULES,
  COMMON_DESIGNATIONS,
  createDefaultPermissions,
  isUserAdmin
} from '../../utils/permissions';

interface UserData {
  id: string;
  displayName: string;
  email: string;
  role: string;
  designation?: string;
  isActive: boolean;
  password?: string;
  permissions?: ModulePermissionsMap;
  permittedModules?: string[];
  createdAt: any;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserOldPassword, setEditingUserOldPassword] = useState<string | undefined>();

  // Form Fields
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('Shift Supervisor');
  const [customDesignation, setCustomDesignation] = useState('');
  const [isCustomDesignation, setIsCustomDesignation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [permissions, setPermissions] = useState<ModulePermissionsMap>(
    () => createDefaultPermissions('supervisor')
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [expandedUserPerms, setExpandedUserPerms] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: UserData[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedUsers.push({ id: docSnap.id, ...docSnap.data() } as UserData);
      });
      setUsers(fetchedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleDesignationChange = (val: string) => {
    if (val === 'Other') {
      setIsCustomDesignation(true);
      setDesignation('Other');
    } else {
      setIsCustomDesignation(false);
      setDesignation(val);
      if (val === 'Admin') {
        setPermissions(createDefaultPermissions('admin'));
      } else if (val.includes('Manager')) {
        setPermissions(createDefaultPermissions('manager'));
      } else if (val.includes('Supervisor')) {
        setPermissions(createDefaultPermissions('supervisor'));
      } else if (val === 'Accountant') {
        setPermissions(createDefaultPermissions('accountant'));
      } else if (val === 'Store Keeper') {
        setPermissions(createDefaultPermissions('store_keeper'));
      }
    }
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDesignation('Shift Supervisor');
    setCustomDesignation('');
    setIsCustomDesignation(false);
    setIsActive(true);
    setPermissions(createDefaultPermissions('supervisor'));
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (targetUser: UserData) => {
    setIsEditMode(true);
    setEditingUserId(targetUser.id);
    setName(targetUser.displayName || '');
    setEmail(targetUser.email || '');
    setPassword(targetUser.password || '');
    setConfirmPassword(targetUser.password || '');
    setIsActive(targetUser.isActive !== false);
    setEditingUserOldPassword(targetUser.password);
    setFormError(null);

    const userDesig = targetUser.designation || targetUser.role || 'Supervisor';
    const isStandard = COMMON_DESIGNATIONS.includes(userDesig);
    if (isStandard) {
      setDesignation(userDesig);
      setIsCustomDesignation(false);
      setCustomDesignation('');
    } else {
      setDesignation('Other');
      setIsCustomDesignation(true);
      setCustomDesignation(userDesig);
    }

    // Populate permissions from document, or fallback based on legacy role
    if (targetUser.permissions && Object.keys(targetUser.permissions).length > 0) {
      setPermissions(targetUser.permissions);
    } else if (targetUser.role?.toLowerCase() === 'admin' || userDesig.toLowerCase() === 'admin') {
      setPermissions(createDefaultPermissions('admin'));
    } else if (targetUser.role?.toLowerCase() === 'manager') {
      setPermissions(createDefaultPermissions('manager'));
    } else {
      // Build from permittedModules
      const map: ModulePermissionsMap = createDefaultPermissions('none');
      if (Array.isArray(targetUser.permittedModules)) {
        ERP_MODULES.forEach((mod) => {
          if (targetUser.permittedModules?.includes('*') || targetUser.permittedModules?.includes(mod.id)) {
            map[mod.id] = { view: true, edit: false, delete: false };
          }
        });
      }
      setPermissions(map);
    }

    setIsModalOpen(true);
  };

  const handleDeleteUser = async (targetUser: UserData) => {
    if (!window.confirm(`Are you sure you want to completely delete ${targetUser.displayName}?`)) {
      return;
    }
    try {
      if (targetUser.password) {
        const secondaryApp = initializeApp(firebaseConfig, 'DeleteApp_' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        try {
          await setPersistence(secondaryAuth, inMemoryPersistence);
          await signInWithEmailAndPassword(secondaryAuth, targetUser.email, targetUser.password);
          if (secondaryAuth.currentUser) {
            await deleteUser(secondaryAuth.currentUser);
          }
        } catch (authErr: any) {
          console.warn('Auth Deletion Warning:', authErr);
        } finally {
          if (secondaryAuth.currentUser) {
            await secondaryAuth.signOut();
          }
          await deleteApp(secondaryApp);
        }
      }

      await deleteDoc(doc(db, 'users', targetUser.id));
      fetchUsers();
      alert('User deleted successfully.');
    } catch (err: any) {
      console.error('Error deleting user:', err);
      alert('Error deleting user: ' + err.message);
    }
  };

  const updatePermission = (
    moduleId: ModuleId,
    type: 'view' | 'edit' | 'delete',
    value: boolean
  ) => {
    setPermissions((prev) => {
      const current = prev[moduleId] || { view: false, edit: false, delete: false };
      const updated = { ...current };

      if (type === 'view') {
        updated.view = value;
        // If view is turned off, edit and delete must also be off
        if (!value) {
          updated.edit = false;
          updated.delete = false;
        }
      } else if (type === 'edit') {
        updated.edit = value;
        // If edit is turned on, view must be on
        if (value) {
          updated.view = true;
        } else {
          updated.delete = false;
        }
      } else if (type === 'delete') {
        updated.delete = value;
        // If delete is turned on, edit and view must be on
        if (value) {
          updated.view = true;
          updated.edit = true;
        }
      }

      return {
        ...prev,
        [moduleId]: updated
      };
    });
  };

  const toggleRowAll = (moduleId: ModuleId) => {
    setPermissions((prev) => {
      const current = prev[moduleId] || { view: false, edit: false, delete: false };
      const allActive = current.view && current.edit && current.delete;
      return {
        ...prev,
        [moduleId]: {
          view: !allActive,
          edit: !allActive,
          delete: !allActive
        }
      };
    });
  };

  const applyPreset = (preset: 'admin' | 'manager' | 'supervisor' | 'accountant' | 'store_keeper' | 'view_only' | 'none') => {
    setPermissions(createDefaultPermissions(preset));
  };

  const effectiveDesignation = isCustomDesignation ? (customDesignation.trim() || 'Custom') : designation;
  const isTargetAdmin = effectiveDesignation.toLowerCase() === 'admin' || effectiveDesignation.toLowerCase() === 'managing director';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      setFormLoading(false);
      return;
    }

    const finalDesignation = isCustomDesignation ? customDesignation.trim() || 'Specialist' : designation;
    const finalRole: UserRole = isTargetAdmin ? 'Admin' : (finalDesignation.toLowerCase().includes('manager') ? 'Manager' : 'Supervisor');
    const finalPermissions = isTargetAdmin ? createDefaultPermissions('admin') : permissions;
    const permittedModules = isTargetAdmin
      ? ['*']
      : Object.keys(finalPermissions).filter((modId) => finalPermissions[modId]?.view);

    try {
      if (!isEditMode) {
        // Create User in Firebase Auth
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp_' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          await updateProfile(userCredential.user, { displayName: name });

          await setDoc(doc(db, 'users', userCredential.user.uid), {
            displayName: name,
            designation: finalDesignation,
            role: finalRole.toLowerCase(),
            email: email,
            password: password,
            isActive: isActive,
            permissions: finalPermissions,
            permittedModules: permittedModules,
            createdAt: serverTimestamp()
          });

          await secondaryAuth.signOut();
        } finally {
          await deleteApp(secondaryApp);
        }
      } else {
        // Edit User
        if (!editingUserId) throw new Error('Missing user ID');

        if (password && password !== editingUserOldPassword) {
          if (!editingUserOldPassword) {
            throw new Error('Cannot securely update authentication password because the original password was not stored.');
          }
          const secondaryApp = initializeApp(firebaseConfig, 'EditApp_' + Date.now());
          const secondaryAuth = getAuth(secondaryApp);
          try {
            await signInWithEmailAndPassword(secondaryAuth, email, editingUserOldPassword);
            if (secondaryAuth.currentUser) {
              await updatePassword(secondaryAuth.currentUser, password);
            }
            await secondaryAuth.signOut();
          } finally {
            await deleteApp(secondaryApp);
          }
        }

        // Update Firestore Document
        await updateDoc(doc(db, 'users', editingUserId), {
          displayName: name,
          designation: finalDesignation,
          role: finalRole.toLowerCase(),
          password: password,
          isActive: isActive,
          permissions: finalPermissions,
          permittedModules: permittedModules,
          updatedAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('A user with this email address already exists.');
      } else {
        setFormError(err.message || (isEditMode ? 'Failed to update user' : 'Failed to create user'));
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Group modules by category for clean UI rendering
  const modulesByCategory = useMemo(() => {
    const grouped: Record<string, typeof ERP_MODULES> = {};
    ERP_MODULES.forEach((mod) => {
      if (!grouped[mod.category]) {
        grouped[mod.category] = [];
      }
      grouped[mod.category].push(mod);
    });
    return grouped;
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900">User Access & Designation Management</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {users.length} Users
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assign designations and customize granular access (View, Edit, Delete) for each ERP module.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-xs text-xs font-semibold shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or designation..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400 transition"
          />
        </div>
        <div className="text-xs text-slate-500">
          Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> accounts
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-[#F8F9FA] text-slate-500 uppercase font-bold text-[11px] border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Designation</th>
                <th className="px-5 py-3.5">Module Accessibility</th>
                <th className="px-5 py-3.5">Password</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((targetUser) => {
                  const isUserAnAdmin =
                    targetUser.role?.toLowerCase() === 'admin' ||
                    targetUser.designation?.toLowerCase() === 'admin' ||
                    (targetUser.permittedModules && targetUser.permittedModules.includes('*'));

                  const accessibleModulesCount = isUserAnAdmin
                    ? ERP_MODULES.length
                    : targetUser.permissions
                    ? Object.values(targetUser.permissions).filter((p) => p?.view).length
                    : targetUser.permittedModules?.length || 0;

                  const isExpanded = expandedUserPerms === targetUser.id;

                  return (
                    <React.Fragment key={targetUser.id}>
                      <tr className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold border border-slate-200 shrink-0">
                              {targetUser.displayName?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate">
                                {targetUser.displayName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[11px] text-slate-600">
                          <div className="flex items-center space-x-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{targetUser.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-tight ${
                              isUserAnAdmin
                                ? 'bg-black text-white'
                                : (targetUser.designation || targetUser.role)?.toLowerCase().includes('manager')
                                ? 'bg-blue-100 text-blue-900'
                                : (targetUser.designation || targetUser.role)?.toLowerCase().includes('supervisor')
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {targetUser.designation || targetUser.role || 'User'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {isUserAnAdmin ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                                <Shield className="w-3 h-3 text-emerald-600" />
                                All Modules (Full Access)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedUserPerms(isExpanded ? null : targetUser.id)
                                }
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium transition cursor-pointer"
                                title="Click to view module access breakdown"
                              >
                                <span>{accessibleModulesCount} of {ERP_MODULES.length} Modules</span>
                                <span className="text-[10px] text-slate-400">
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              {targetUser.password
                                ? visiblePasswords[targetUser.id]
                                  ? targetUser.password
                                  : '••••••••'
                                : 'N/A'}
                            </span>
                            {targetUser.password && (
                              <button
                                onClick={() => togglePasswordVisibility(targetUser.id)}
                                className="text-slate-400 hover:text-slate-600 transition p-1"
                                title="Toggle password visibility"
                              >
                                {visiblePasswords[targetUser.id] ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {targetUser.isActive ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(targetUser)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                              title="Edit User & Permissions"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(targetUser)}
                              className={`p-1.5 rounded-lg transition ${
                                currentUser?.uid === targetUser.id
                                  ? 'text-slate-200 cursor-not-allowed'
                                  : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={
                                currentUser?.uid === targetUser.id
                                  ? 'You cannot delete your own account'
                                  : 'Delete User'
                              }
                              disabled={currentUser?.uid === targetUser.id}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Module Permissions Row */}
                      {isExpanded && !isUserAnAdmin && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={7} className="px-6 py-3">
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5" />
                                <span>Accessible Modules for {targetUser.displayName}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {ERP_MODULES.map((mod) => {
                                  const perm = targetUser.permissions?.[mod.id];
                                  const hasView = perm?.view;
                                  if (!hasView) return null;
                                  return (
                                    <div
                                      key={mod.id}
                                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] shadow-2xs"
                                    >
                                      <span className="font-semibold text-slate-800">{mod.label}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        ({perm?.view && 'V'}
                                        {perm?.edit && ', E'}
                                        {perm?.delete && ', D'})
                                      </span>
                                    </div>
                                  );
                                })}
                                {accessibleModulesCount === 0 && (
                                  <span className="text-xs text-slate-400 italic">
                                    No modules granted yet. Click edit to assign permissions.
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEditMode ? 'Edit User & Module Permissions' : 'Register New User & Assign Permissions'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure account credentials, designation, and granular module access.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {formError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <form id="user-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Section 1: User Credentials & Designation */}
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    1. Account & Designation Profile
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs transition-colors"
                        placeholder="e.g. Ramesh Kumar"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">
                        Designation <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={isCustomDesignation ? 'Other' : designation}
                        onChange={(e) => handleDesignationChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs transition-colors"
                      >
                        {COMMON_DESIGNATIONS.map((desig) => (
                          <option key={desig} value={desig}>
                            {desig}
                          </option>
                        ))}
                      </select>
                      {isCustomDesignation && (
                        <input
                          type="text"
                          value={customDesignation}
                          onChange={(e) => setCustomDesignation(e.target.value)}
                          placeholder="Type custom designation (e.g. Yarn Master, Fabric Auditor)"
                          required
                          className="mt-2 w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isEditMode}
                        className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs transition-colors disabled:opacity-60 disabled:bg-slate-100"
                        placeholder="user@perlatextiles.com"
                      />
                      {isEditMode && (
                        <p className="text-[10px] text-slate-400 mt-1">Email cannot be changed once registered.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">
                          Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full bg-white border border-slate-200 focus:border-slate-900 focus:ring-0 rounded-lg px-3 py-2 text-xs transition-colors"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  </div>

                  {isEditMode && (
                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">Account Status:</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={isActive}
                          onChange={() => setIsActive(true)}
                          className="text-slate-900 focus:ring-0"
                        />
                        <span>Active</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          checked={!isActive}
                          onChange={() => setIsActive(false)}
                          className="text-slate-900 focus:ring-0"
                        />
                        <span>Inactive</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Section 2: Module Permissions */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        2. Module Permissions (View, Edit, Delete)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Select which modules will appear in this user's sidebar and specify edit/delete rights.
                      </p>
                    </div>

                    {!isTargetAdmin && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase font-bold mr-1">Presets:</span>
                        <button
                          type="button"
                          onClick={() => applyPreset('admin')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          All Access
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('manager')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          Manager
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('supervisor')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          Supervisor
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('accountant')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          Accountant
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('view_only')}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold transition"
                        >
                          View Only
                        </button>
                        <button
                          type="button"
                          onClick={() => applyPreset('none')}
                          className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-semibold transition"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* If Admin Designation */}
                  {isTargetAdmin ? (
                    <div className="bg-slate-900 text-white rounded-xl p-4 space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        <span>Administrator Has Unrestricted Full Access</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        Users designated as <strong>{effectiveDesignation}</strong> automatically receive full access to view, edit, and delete across all ERP modules.
                      </p>
                    </div>
                  ) : (
                    /* Permissions Matrix */
                    <div className="space-y-4">
                      {Object.entries(modulesByCategory).map(([category, catModules]) => (
                        <div
                          key={category}
                          className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                        >
                          <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                              {category}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {catModules.length} Modules
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 bg-white">
                            {catModules.map((mod) => {
                              const perm = permissions[mod.id] || {
                                view: false,
                                edit: false,
                                delete: false
                              };
                              const allChecked = perm.view && perm.edit && perm.delete;

                              return (
                                <div
                                  key={mod.id}
                                  className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                    perm.view ? 'bg-blue-50/20' : 'bg-white'
                                  }`}
                                >
                                  <div className="min-w-0 max-w-sm">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-slate-900">
                                        {mod.label}
                                      </span>
                                      {perm.view && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded">
                                          Visible
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                      {mod.description}
                                    </p>
                                  </div>

                                  {/* View, Edit, Delete Toggles */}
                                  <div className="flex items-center gap-4 shrink-0">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(perm.view)}
                                        onChange={(e) =>
                                          updatePermission(mod.id, 'view', e.target.checked)
                                        }
                                        className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                                      />
                                      <span
                                        className={`text-xs font-semibold ${
                                          perm.view ? 'text-slate-900' : 'text-slate-400'
                                        }`}
                                      >
                                        View
                                      </span>
                                    </label>

                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(perm.edit)}
                                        onChange={(e) =>
                                          updatePermission(mod.id, 'edit', e.target.checked)
                                        }
                                        className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                                      />
                                      <span
                                        className={`text-xs font-semibold ${
                                          perm.edit ? 'text-slate-900' : 'text-slate-400'
                                        }`}
                                      >
                                        Edit
                                      </span>
                                    </label>

                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(perm.delete)}
                                        onChange={(e) =>
                                          updatePermission(mod.id, 'delete', e.target.checked)
                                        }
                                        className="rounded text-slate-900 focus:ring-0 w-3.5 h-3.5"
                                      />
                                      <span
                                        className={`text-xs font-semibold ${
                                          perm.delete ? 'text-slate-900' : 'text-slate-400'
                                        }`}
                                      >
                                        Delete
                                      </span>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => toggleRowAll(mod.id)}
                                      className="text-[10px] text-slate-400 hover:text-slate-700 underline underline-offset-2 ml-1"
                                    >
                                      {allChecked ? 'Uncheck' : 'All'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={formLoading}
                className="px-5 py-2 text-white bg-slate-900 hover:bg-slate-800 rounded-xl text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {formLoading ? 'Saving...' : isEditMode ? 'Update User & Permissions' : 'Create User & Assign Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
