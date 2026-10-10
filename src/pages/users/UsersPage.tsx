import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, setDoc, doc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, firebaseConfig } from '../../config/firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, updatePassword, deleteUser, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { Plus, User as UserIcon, Mail, Shield, CheckCircle, XCircle, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
import { UserRole } from '../../types/user';
import { useAuth } from '../../context/AuthContext';

interface UserData {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  password?: string;
  createdAt: any;
}

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserOldPassword, setEditingUserOldPassword] = useState<string | undefined>();
  
  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Supervisor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: UserData[] = [];
      querySnapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() } as UserData);
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
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const openCreateModal = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('Supervisor');
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserData) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setName(user.displayName || '');
    setEmail(user.email || '');
    setPassword(user.password || '');
    setConfirmPassword(user.password || '');
    setRole((user.role.charAt(0).toUpperCase() + user.role.slice(1)) as UserRole);
    setIsActive(user.isActive !== false);
    setEditingUserOldPassword(user.password);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleDeleteUser = async (user: UserData) => {
    if (window.confirm(`Are you sure you want to completely delete ${user.displayName}?`)) {
      try {
        if (user.password) {
          // Initialize secondary app to delete from Auth safely
          const secondaryApp = initializeApp(firebaseConfig, 'DeleteApp_' + Date.now());
          const secondaryAuth = getAuth(secondaryApp);
          try {
            // Set persistence to none so it doesn't affect the main app session
            await setPersistence(secondaryAuth, inMemoryPersistence);
            await signInWithEmailAndPassword(secondaryAuth, user.email, user.password);
            
            if (secondaryAuth.currentUser) {
              await deleteUser(secondaryAuth.currentUser);
            }
          } catch (authErr: any) {
            console.error("Auth Deletion Error:", authErr);
            throw new Error(`Could not delete from Authentication: ${authErr.message}`);
          } finally {
            if (secondaryAuth.currentUser) {
              await secondaryAuth.signOut();
            }
            await deleteApp(secondaryApp);
          }
        } else {
          alert("Warning: This user was created before passwords were saved. They cannot be automatically deleted from the Firebase Authentication tab. Please delete them manually there.");
        }

        // Delete from Firestore
        await deleteDoc(doc(db, 'users', user.id));
        fetchUsers();
        alert("User deleted successfully.");
      } catch (err: any) {
        console.error("Error deleting user:", err);
        alert("Error deleting user: " + err.message);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      setFormLoading(false);
      return;
    }

    try {
      if (!isEditMode) {
        // Create User
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp_' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          await updateProfile(userCredential.user, { displayName: name });
          
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            displayName: name,
            role: role.toLowerCase(),
            email: email,
            password: password,
            isActive: isActive,
            createdAt: serverTimestamp()
          });

          await secondaryAuth.signOut();
        } finally {
          await deleteApp(secondaryApp);
        }
      } else {
        // Edit User
        if (!editingUserId) throw new Error("Missing user ID");

        // Try to update Auth password if changed and old password is known
        if (password && password !== editingUserOldPassword) {
          if (!editingUserOldPassword) {
             throw new Error("Cannot securely update authentication password because the original password was not stored. Please delete and recreate the user.");
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
          role: role.toLowerCase(),
          password: password,
          isActive: isActive
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60">
        <div>
          <h2 className="text-xl font-bold text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage system access and roles</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#F8F9FA] text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                          {user.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="font-medium text-slate-900">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span>{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <Shield className="w-4 h-4 text-slate-400" />
                        <span className="capitalize">{user.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {user.password ? (visiblePasswords[user.id] ? user.password : '••••••••') : 'N/A'}
                        </span>
                        {user.password && (
                          <button
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {visiblePasswords[user.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/50">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-3">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit User"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className={`transition-colors ${currentUser?.uid === user.id ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-red-600'}`}
                          title={currentUser?.uid === user.id ? "You cannot delete your own account" : "Delete User"}
                          disabled={currentUser?.uid === user.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">{isEditMode ? 'Edit User' : 'Register New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              {formError && (
                <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-colors"
                    placeholder="Enter full name"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">System Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-colors"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Supervisor">Supervisor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isEditMode}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-60"
                    placeholder="name@domain.com"
                  />
                  {isEditMode && <p className="text-[10px] text-slate-400 mt-1">Email cannot be changed after creation.</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white focus:ring-0 rounded-xl px-4 py-2.5 text-sm transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {isEditMode && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Account Status</label>
                    <div className="flex items-center space-x-3 mt-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={isActive}
                          onChange={() => setIsActive(true)}
                          className="text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-sm text-slate-700">Active</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!isActive}
                          onChange={() => setIsActive(false)}
                          className="text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-sm text-slate-700">Inactive</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 px-4 py-2.5 text-white bg-slate-900 hover:bg-slate-800 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {formLoading ? 'Processing...' : (isEditMode ? 'Save Changes' : 'Create User')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
