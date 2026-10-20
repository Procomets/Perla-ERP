import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Clock,
  Palette,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Layers,
  Receipt
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ColourItem } from '../../types/colourMaster';
import { ColourMasterService } from '../../services/colourMasterService';
import { ProcessItem } from '../../types/processMaster';
import { ProcessMasterService } from '../../services/processMasterService';
import { AttendanceService } from '../../services/attendanceService';
import { GeneralSettings as AttendanceSettings } from '../../types/attendance';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import { TaxAndIssuerSettings } from './components/TaxAndIssuerSettings';

export const GeneralSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.uid || 'user';
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation tab from query param or default to 'colours'
  const paramTab = searchParams.get('tab') as 'colours' | 'processes' | 'tax' | 'attendance' | null;
  const validTabs: Array<'colours' | 'processes' | 'tax' | 'attendance'> = ['colours', 'processes', 'tax', 'attendance'];
  const [activeTab, setActiveTab] = useState<'colours' | 'processes' | 'tax' | 'attendance'>(
    paramTab && validTabs.includes(paramTab) ? paramTab : 'colours'
  );

  const handleSelectTab = (tab: 'colours' | 'processes' | 'tax' | 'attendance') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Wash / Process Master State
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(true);
  const [processSearch, setProcessSearch] = useState<string>('');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal States for Process
  const [isAddProcessModalOpen, setIsAddProcessModalOpen] = useState<boolean>(false);
  const [isEditProcessModalOpen, setIsEditProcessModalOpen] = useState<boolean>(false);
  const [isDeleteProcessModalOpen, setIsDeleteProcessModalOpen] = useState<boolean>(false);
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);

  // Process Form Inputs
  const [newProcessName, setNewProcessName] = useState<string>('');
  const [newProcessCategory, setNewProcessCategory] = useState<string>('washing');
  const [editProcessName, setEditProcessName] = useState<string>('');
  const [editProcessCategory, setEditProcessCategory] = useState<string>('washing');
  const [processFormError, setProcessFormError] = useState<string>('');
  const [isProcessSubmitting, setIsProcessSubmitting] = useState<boolean>(false);

  // Colour Master State
  const [colours, setColours] = useState<ColourItem[]>([]);
  const [loadingColours, setLoadingColours] = useState<boolean>(true);
  const [colourSearch, setColourSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Users lookup map: uid -> displayName / name
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Modal States for Colour
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedColour, setSelectedColour] = useState<ColourItem | null>(null);

  // Form Inputs
  const [newColourName, setNewColourName] = useState<string>('');
  const [editColourName, setEditColourName] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Attendance Settings State
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>({
    isBlocked: false,
    accessStartTime: '09:00',
    accessEndTime: '18:00'
  });
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [savingAttendance, setSavingAttendance] = useState<boolean>(false);
  const [attendanceNotice, setAttendanceNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Toast / Feedback message
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // 1. Subscribe to Firestore colour_master
  useEffect(() => {
    const unsubscribe = ColourMasterService.subscribeColours(
      (items) => {
        setColours(items);
        setLoadingColours(false);
      },
      (err) => {
        console.error('Failed to load colours:', err);
        setLoadingColours(false);
        showNotification('error', 'Failed to connect to colour_master in Firestore.');
      }
    );

    return () => unsubscribe();
  }, []);

  // 1b. Subscribe to Firestore process_master
  useEffect(() => {
    const unsubscribe = ProcessMasterService.subscribeProcesses(
      (items) => {
        setProcesses(items);
        setLoadingProcesses(false);
      },
      (err) => {
        console.error('Failed to load processes:', err);
        setLoadingProcesses(false);
        showNotification('error', 'Failed to connect to process_master in Firestore.');
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Fetch users to map user IDs to actual user names
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const map: Record<string, string> = {};
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const name = data.name || data.displayName || (data.email ? data.email.split('@')[0] : 'User');
          map[docSnap.id] = name;
          if (data.email) {
            map[data.email] = name;
          }
        });
        setUsersMap(map);
      } catch (err) {
        console.warn('Could not fetch users collection for name resolution:', err);
      }
    };

    fetchUsers();
  }, []);

  // 3. Load attendance settings when attendance tab is selected
  useEffect(() => {
    if (activeTab === 'attendance') {
      let isMounted = true;
      AttendanceService.getGeneralSettings()
        .then((data) => {
          if (isMounted) {
            setAttendanceSettings(data);
            setLoadingAttendance(false);
          }
        })
        .catch((err) => {
          console.error(err);
          if (isMounted) setLoadingAttendance(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab]);

  // Resolver helper: Get human-readable user name from UID
  const getUserDisplayName = (uid: string) => {
    if (!uid) return 'System';
    if (usersMap[uid]) return usersMap[uid];
    if (user && (user.uid === uid || user.email === uid)) {
      return user.displayName || user.email?.split('@')[0] || 'Current User';
    }
    // Fallback: if not found in map, show formatted fallback instead of raw long UID
    return usersMap[uid] || 'Admin User';
  };

  // Format timestamp helper
  const formatDateTime = (ts: any) => {
    if (!ts) return '—';
    try {
      let date: Date | null = null;
      if (typeof ts?.toDate === 'function') {
        date = ts.toDate();
      } else if (ts?.seconds) {
        date = new Date(ts.seconds * 1000);
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        date = new Date(ts);
      } else if (ts instanceof Date) {
        date = ts;
      }
      if (date && !isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {
      // Fallback
    }
    return '—';
  };

  // Duplicate check for add modal
  const normalizedNew = newColourName.trim().toLowerCase();
  const duplicateExisting = normalizedNew
    ? colours.find((c) => c.normalizedName === normalizedNew || c.name.toLowerCase() === normalizedNew)
    : null;

  // Handle Add Colour
  const handleAddColour = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmed = newColourName.trim();
    if (!trimmed) {
      setFormError('Please enter a colour name.');
      return;
    }

    if (duplicateExisting) {
      setFormError(`Colour "${duplicateExisting.name}" already exists in Colour Master.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const added = await ColourMasterService.addColour(trimmed, currentUserId);
      showNotification('success', `Colour "${added.name}" added to Colour Master.`);
      setNewColourName('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to add colour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Colour
  const handleOpenEdit = (colour: ColourItem) => {
    setSelectedColour(colour);
    setEditColourName(colour.name);
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColour) return;
    setFormError('');

    const trimmed = editColourName.trim();
    if (!trimmed) {
      setFormError('Colour name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ColourMasterService.updateColour(
        selectedColour.id,
        { name: trimmed },
        currentUserId
      );
      showNotification('success', `Colour updated to "${trimmed}".`);
      setIsEditModalOpen(false);
      setSelectedColour(null);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to update colour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleActive = async (colour: ColourItem) => {
    const nextStatus = !colour.isActive;
    try {
      await ColourMasterService.updateColour(
        colour.id,
        { isActive: nextStatus },
        currentUserId
      );
      showNotification('info', `Colour "${colour.name}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to update status.');
    }
  };

  // Handle Delete Colour
  const handleOpenDelete = (colour: ColourItem) => {
    setSelectedColour(colour);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedColour) return;
    setIsSubmitting(true);
    try {
      await ColourMasterService.deleteColour(selectedColour.id);
      showNotification('success', `Colour "${selectedColour.name}" removed.`);
      setIsDeleteModalOpen(false);
      setSelectedColour(null);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to delete colour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Attendance Settings
  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAttendance(true);
    setAttendanceNotice(null);
    try {
      await AttendanceService.updateGeneralSettings(
        {
          isBlocked: attendanceSettings.isBlocked,
          accessStartTime: attendanceSettings.accessStartTime,
          accessEndTime: attendanceSettings.accessEndTime
        },
        user?.email || currentUserId
      );
      setAttendanceNotice({ type: 'success', text: 'Attendance timings updated successfully!' });
      showNotification('success', 'Attendance settings updated in Firebase.');
    } catch (err: any) {
      console.error(err);
      setAttendanceNotice({ type: 'error', text: 'Failed to update attendance settings.' });
      showNotification('error', 'Failed to save attendance settings.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Duplicate check for add process modal
  const normalizedNewProcess = newProcessName.trim().toLowerCase();
  const duplicateExistingProcess = normalizedNewProcess
    ? processes.find((p) => p.normalizedName === normalizedNewProcess || p.name.toLowerCase() === normalizedNewProcess)
    : null;

  // Handle Add Process
  const handleAddProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessFormError('');

    const trimmed = newProcessName.trim();
    if (!trimmed) {
      setProcessFormError('Please enter a process name.');
      return;
    }

    if (duplicateExistingProcess) {
      setProcessFormError(`Wash / Process "${duplicateExistingProcess.name}" already exists in Master.`);
      return;
    }

    setIsProcessSubmitting(true);
    try {
      const added = await ProcessMasterService.addProcess(trimmed, currentUserId, newProcessCategory);
      showNotification('success', `Wash / Process "${added.name}" added to Process Master.`);
      setNewProcessName('');
      setIsAddProcessModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setProcessFormError(err.message || 'Failed to add process.');
    } finally {
      setIsProcessSubmitting(false);
    }
  };

  // Handle Edit Process
  const handleOpenEditProcess = (proc: ProcessItem) => {
    setSelectedProcess(proc);
    setEditProcessName(proc.name);
    setEditProcessCategory(proc.category || 'washing');
    setProcessFormError('');
    setIsEditProcessModalOpen(true);
  };

  const handleSaveEditProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcess) return;
    setProcessFormError('');

    const trimmed = editProcessName.trim();
    if (!trimmed) {
      setProcessFormError('Process name cannot be empty.');
      return;
    }

    setIsProcessSubmitting(true);
    try {
      await ProcessMasterService.updateProcess(
        selectedProcess.id,
        { name: trimmed, category: editProcessCategory },
        currentUserId
      );
      showNotification('success', `Process updated to "${trimmed}".`);
      setIsEditProcessModalOpen(false);
      setSelectedProcess(null);
    } catch (err: any) {
      console.error(err);
      setProcessFormError(err.message || 'Failed to update process.');
    } finally {
      setIsProcessSubmitting(false);
    }
  };

  // Handle Toggle Active for Process
  const handleToggleProcessActive = async (proc: ProcessItem) => {
    const nextStatus = !proc.isActive;
    try {
      await ProcessMasterService.updateProcess(
        proc.id,
        { isActive: nextStatus },
        currentUserId
      );
      showNotification('info', `Process "${proc.name}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to update process status.');
    }
  };

  // Handle Delete Process
  const handleOpenDeleteProcess = (proc: ProcessItem) => {
    setSelectedProcess(proc);
    setIsDeleteProcessModalOpen(true);
  };

  const handleConfirmDeleteProcess = async () => {
    if (!selectedProcess) return;
    setIsProcessSubmitting(true);
    try {
      await ProcessMasterService.deleteProcess(selectedProcess.id);
      showNotification('success', `Process "${selectedProcess.name}" removed.`);
      setIsDeleteProcessModalOpen(false);
      setSelectedProcess(null);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to delete process.');
    } finally {
      setIsProcessSubmitting(false);
    }
  };

  // Filter processes
  const filteredProcesses = processes.filter((item) => {
    const matchesSearch =
      processSearch.trim() === '' ||
      item.name.toLowerCase().includes(processSearch.toLowerCase()) ||
      item.normalizedName.toLowerCase().includes(processSearch.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(processSearch.toLowerCase()));

    const matchesStatus =
      processStatusFilter === 'all' ||
      (processStatusFilter === 'active' && item.isActive) ||
      (processStatusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesStatus;
  });

  // Filter colours
  const filteredColours = colours.filter((item) => {
    const matchesSearch =
      colourSearch.trim() === '' ||
      item.name.toLowerCase().includes(colourSearch.toLowerCase()) ||
      item.normalizedName.toLowerCase().includes(colourSearch.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesStatus;
  });

  // Visual swatch helper
  const getSwatchColor = (normalized: string) => {
    const map: Record<string, string> = {
      red: '#EF4444',
      blue: '#3B82F6',
      'navy blue': '#1E3A8A',
      navy: '#1E3A8A',
      green: '#10B981',
      black: '#0F172A',
      white: '#F8FAFC',
      yellow: '#F59E0B',
      orange: '#F97316',
      purple: '#8B5CF6',
      pink: '#EC4899',
      gray: '#64748B',
      grey: '#64748B',
      charcoal: '#334155',
      olive: '#65A30D',
      maroon: '#881337',
      teal: '#14B8A6',
      indigo: '#6366F1',
      brown: '#78350F',
      beige: '#F5F5DC'
    };
    return map[normalized] || '#64748B';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
            {notification.type === 'info' && <ShieldCheck className="w-4 h-4 text-blue-600" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* 2-Column Layout with Sub Side Navbar */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Sub Side Navigation Bar - Fixed / Sticky */}
        <aside className="w-full md:w-60 shrink-0 bg-white rounded-xl border border-slate-200/90 p-3 shadow-2xs md:sticky md:top-6 self-start z-10">
           
          <nav className="space-y-1">
            <button
              onClick={() => handleSelectTab('colours')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'colours'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Palette className="w-4 h-4 shrink-0" />
              <span>Colour Master</span>
            </button>
            <button
              onClick={() => handleSelectTab('processes')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'processes'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Wash / Process</span>
            </button>
            <button
              onClick={() => handleSelectTab('tax')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'tax'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Tax &amp; Issue Settings</span>
            </button>
            <button
              onClick={() => handleSelectTab('attendance')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left cursor-pointer ${
                activeTab === 'attendance'
                  ? 'bg-[#252525] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Attendance Timing</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* ========================================================== */}
          {/* TAB 1: COLOUR MASTER */}
          {/* ========================================================== */}
          {activeTab === 'colours' && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h2 className="text-lg font-bold text-[#1F4E79]">Colour Master</h2>
                  <p className="text-xs text-slate-500">
                    Colour names configured here will be available in Purchase Orders (PO)
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setNewColourName('');
                    setFormError('');
                    setIsAddModalOpen(true);
                  }}
                >
                  Add Colour
                </Button>
              </div>
          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search colour name or normalized name..."
                value={colourSearch}
                onChange={(e) => setColourSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
              {(['all', 'active', 'inactive'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 rounded text-xs font-semibold capitalize transition cursor-pointer ${
                    statusFilter === filter
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Colours Table Card */}
          <Card className="overflow-hidden">
            {loadingColours ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw className="w-6 h-6 animate-spin text-[#1F4E79] mx-auto" />
                <p className="text-xs font-medium text-slate-500">Loading colours...</p>
              </div>
            ) : filteredColours.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Palette className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  {colours.length === 0 ? 'No colours registered yet' : 'No matching colours found'}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {colours.length === 0
                    ? 'Click "Add Colour" to save a colour name for use in Purchase Orders.'
                    : 'Try clearing your search query or switching the status filter.'}
                </p>
                {colours.length === 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setNewColourName('');
                      setFormError('');
                      setIsAddModalOpen(true);
                    }}
                  >
                    Add Colour
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Colour Details</th>
                      <th className="py-3 px-4">Normalized Key</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Info</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredColours.map((colour, idx) => {
                      const swatchColor = getSwatchColor(colour.normalizedName);
                      const creatorName = getUserDisplayName(colour.createdBy);
                      const updaterName = colour.updatedBy ? getUserDisplayName(colour.updatedBy) : null;

                      return (
                        <tr key={colour.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Row Index */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Colour Name & Swatch */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className="w-6 h-6 rounded-lg border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center"
                                style={{ backgroundColor: swatchColor }}
                                title={colour.name}
                              />
                              <div>
                                <span className="font-bold text-slate-900 text-[13px]">{colour.name}</span>
                                {colour.updatedAt && (
                                  <span className="block text-[10px] text-slate-400">
                                    Updated: {formatDateTime(colour.updatedAt)}
                                    {updaterName ? ` by ${updaterName}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Normalized Name */}
                          <td className="py-3.5 px-4">
                            <code className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200/60">
                              {colour.normalizedName}
                            </code>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleActive(colour)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                                colour.isActive
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title="Click to toggle status"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  colour.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {colour.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          {/* Created Info with Real User Name */}
                          <td className="py-3.5 px-4 text-slate-600">
                            <div>
                              <span className="font-medium text-slate-800">
                                {formatDateTime(colour.createdAt)}
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                By: <strong className="text-slate-700 font-semibold">{creatorName}</strong>
                              </p>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(colour)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                title="Edit Name"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenDelete(colour)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete Colour"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: WASH / PROCESS MASTER */}
      {/* ========================================================== */}
      {activeTab === 'processes' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
            <div>
              <h2 className="text-lg font-bold text-[#1F4E79]">Wash / Process Master</h2>
              <p className="text-xs text-slate-500">
                Wash and chemical processes configured here will be available in Purchase Orders (PO) dropdowns
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => {
                setNewProcessName('');
                setNewProcessCategory('washing');
                setProcessFormError('');
                setIsAddProcessModalOpen(true);
              }}
            >
              Add Wash / Process
            </Button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search processes..."
                value={processSearch}
                onChange={(e) => setProcessSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              {(['all', 'active', 'inactive'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setProcessStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                    processStatusFilter === filter
                      ? 'bg-[#1F4E79] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Process Master Table */}
          <Card className="overflow-hidden border border-slate-200/80 p-0 shadow-2xs">
            {loadingProcesses ? (
              <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-[#1F4E79]" />
                <span>Loading processes from Firestore...</span>
              </div>
            ) : filteredProcesses.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No processes found</p>
                <p className="text-[11px] text-slate-400">
                  {processSearch ? 'Try a different search query or filter.' : 'Click "Add Wash / Process" above to create your first process.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Process Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Info</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredProcesses.map((proc, idx) => {
                      const creatorName = getUserDisplayName(proc.createdBy);
                      const updaterName = proc.updatedBy ? getUserDisplayName(proc.updatedBy) : null;

                      return (
                        <tr key={proc.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Row Index */}
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 text-center">
                            {idx + 1}
                          </td>

                          {/* Process Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="p-1.5 rounded-lg bg-blue-50 text-[#1F4E79] shrink-0">
                                <Sparkles className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 text-[13px]">{proc.name}</span>
                                {proc.updatedAt && (
                                  <span className="block text-[10px] text-slate-400">
                                    Updated: {formatDateTime(proc.updatedAt)}
                                    {updaterName ? ` by ${updaterName}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize bg-slate-100 text-slate-700 border border-slate-200/60">
                              {proc.category || (proc.name.toLowerCase().includes('dye') ? 'Dyeing' : 'Washing')}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleToggleProcessActive(proc)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                                proc.isActive
                                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                              }`}
                              title="Click to toggle status"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  proc.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              {proc.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          {/* Created Info */}
                          <td className="py-3.5 px-4 text-slate-600">
                            <div>
                              <span className="font-medium text-slate-800">
                                {formatDateTime(proc.createdAt)}
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                By: <strong className="text-slate-700 font-semibold">{creatorName}</strong>
                              </p>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditProcess(proc)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                                title="Edit Process"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenDeleteProcess(proc)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete Process"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: ATTENDANCE & SHIFT TIMINGS */}
      {/* ========================================================== */}
      {activeTab === 'attendance' && (
        <Card className="p-6 max-w-3xl">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Attendance Entry Window & Access Policy</h3>
              <p className="text-xs text-slate-500">
                Shift window timings and emergency lockout configuration
              </p>
            </div>
          </div>

          {loadingAttendance ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1F4E79]" />
              Loading attendance settings...
            </div>
          ) : (
            <form onSubmit={handleSaveAttendance} className="mt-5 space-y-5">
              {attendanceNotice && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    attendanceNotice.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {attendanceNotice.text}
                </div>
              )}

              {/* Lock Switch */}
              <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    Emergency Shift Lockout
                  </span>
                  <p className="text-[11px] text-slate-500 max-w-md">
                    When active, standard non-admin employees and supervisors are immediately blocked from marking attendance.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendanceSettings.isBlocked}
                    onChange={(e) =>
                      setAttendanceSettings((prev) => ({ ...prev, isBlocked: e.target.checked }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
                </label>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Shift Entry Open Time
                  </label>
                  <input
                    type="time"
                    value={attendanceSettings.accessStartTime}
                    onChange={(e) =>
                      setAttendanceSettings((prev) => ({ ...prev, accessStartTime: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                    required
                  />
                  <p className="text-[11px] text-slate-400">e.g. 09:00 AM</p>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Shift Entry Close Time
                  </label>
                  <input
                    type="time"
                    value={attendanceSettings.accessEndTime}
                    onChange={(e) =>
                      setAttendanceSettings((prev) => ({ ...prev, accessEndTime: e.target.value }))
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
                    required
                  />
                  <p className="text-[11px] text-slate-400">e.g. 18:00 (6:00 PM)</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={savingAttendance ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  disabled={savingAttendance}
                >
                  {savingAttendance ? 'Saving...' : 'Save Attendance Policy'}
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* ========================================================== */}
      {/* TAB 4: TAX & ISSUE SETTINGS */}
      {/* ========================================================== */}
      {activeTab === 'tax' && (
        <TaxAndIssuerSettings onNotify={showNotification} />
      )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* MODAL 1: ADD NEW COLOUR */}
      {/* ========================================================== */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setNewColourName('');
          setFormError('');
        }}
        title="Add Colour to Colour Master"
        maxWidth="md"
      >
        <form onSubmit={handleAddColour} className="space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-3">
              Add a new fabric/thread colour name. This will be stored in{' '}
              <code className="text-[#1F4E79] font-mono">generalSettings &gt; colour_master</code> and made
              available in Purchase Orders.
            </p>
          </div>

          <Input
            label="Colour Name *"
            placeholder="e.g. Red, Navy blue, Olive Green"
            value={newColourName}
            onChange={(e) => {
              setNewColourName(e.target.value);
              setFormError('');
            }}
            autoFocus
            required
          />

          {/* Real-time normalized preview */}
          {newColourName.trim() && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Normalized Name:</span>
                <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {normalizedNew}
                </code>
              </div>
              {duplicateExisting && (
                <p className="text-rose-600 font-semibold text-[11px] pt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Warning: Colour "{duplicateExisting.name}" is already in the master.
                </p>
              )}
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsAddModalOpen(false);
                setNewColourName('');
                setFormError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              disabled={isSubmitting || !newColourName.trim() || !!duplicateExisting}
            >
              {isSubmitting ? 'Saving...' : 'Add Colour'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 2: EDIT COLOUR NAME */}
      {/* ========================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedColour(null);
          setFormError('');
        }}
        title="Edit Colour Master Name"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Colour Name *"
            value={editColourName}
            onChange={(e) => {
              setEditColourName(e.target.value);
              setFormError('');
            }}
            autoFocus
            required
          />

          {editColourName.trim() && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Normalized Name:</span>
                <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {editColourName.trim().toLowerCase()}
                </code>
              </div>
            </div>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedColour(null);
                setFormError('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              disabled={isSubmitting || !editColourName.trim()}
            >
              {isSubmitting ? 'Updating...' : 'Update Colour'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 3: DELETE CONFIRMATION */}
      {/* ========================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedColour(null);
        }}
        title="Confirm Colour Removal"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to remove colour{' '}
            <strong className="text-slate-900 font-bold">"{selectedColour?.name}"</strong> from Colour Master?
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Tip: Instead of deleting, you can toggle it to Inactive so historical PO records remain consistent.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setSelectedColour(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              onClick={handleConfirmDelete}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 4: ADD WASH / PROCESS */}
      {/* ========================================================== */}
      <Modal
        isOpen={isAddProcessModalOpen}
        onClose={() => {
          setIsAddProcessModalOpen(false);
          setNewProcessName('');
          setProcessFormError('');
        }}
        title="Add Wash / Process to Master"
        maxWidth="md"
      >
        <form onSubmit={handleAddProcess} className="space-y-4">
          <Input
            label="Wash / Process Name *"
            placeholder="e.g. Acid Wash, Silicon Wash, Enzyme Wash..."
            value={newProcessName}
            onChange={(e) => {
              setNewProcessName(e.target.value);
              setProcessFormError('');
            }}
            autoFocus
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <select
              value={newProcessCategory}
              onChange={(e) => setNewProcessCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
            >
              <option value="washing">Washing</option>
              <option value="dyeing">Dyeing</option>
              <option value="finishing">Finishing</option>
              <option value="other">Other</option>
            </select>
          </div>

          {newProcessName.trim() && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Normalized Name:</span>
                <code className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {newProcessName.trim().toLowerCase()}
                </code>
              </div>
              {duplicateExistingProcess && (
                <p className="text-rose-600 font-semibold text-[11px] pt-1">
                  ⚠️ Warning: This process already exists in Process Master.
                </p>
              )}
            </div>
          )}

          {processFormError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{processFormError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsAddProcessModalOpen(false);
                setNewProcessName('');
                setProcessFormError('');
              }}
              disabled={isProcessSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isProcessSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              disabled={isProcessSubmitting || !newProcessName.trim() || !!duplicateExistingProcess}
            >
              {isProcessSubmitting ? 'Saving...' : 'Save Process'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 5: EDIT WASH / PROCESS */}
      {/* ========================================================== */}
      <Modal
        isOpen={isEditProcessModalOpen}
        onClose={() => {
          setIsEditProcessModalOpen(false);
          setSelectedProcess(null);
          setProcessFormError('');
        }}
        title="Edit Wash / Process Name"
        maxWidth="md"
      >
        <form onSubmit={handleSaveEditProcess} className="space-y-4">
          <Input
            label="Wash / Process Name *"
            value={editProcessName}
            onChange={(e) => {
              setEditProcessName(e.target.value);
              setProcessFormError('');
            }}
            autoFocus
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Category</label>
            <select
              value={editProcessCategory}
              onChange={(e) => setEditProcessCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
            >
              <option value="washing">Washing</option>
              <option value="dyeing">Dyeing</option>
              <option value="finishing">Finishing</option>
              <option value="other">Other</option>
            </select>
          </div>

          {processFormError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{processFormError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                setIsEditProcessModalOpen(false);
                setSelectedProcess(null);
                setProcessFormError('');
              }}
              disabled={isProcessSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={isProcessSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              disabled={isProcessSubmitting || !editProcessName.trim()}
            >
              {isProcessSubmitting ? 'Updating...' : 'Update Process'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================== */}
      {/* MODAL 6: DELETE WASH / PROCESS CONFIRMATION */}
      {/* ========================================================== */}
      <Modal
        isOpen={isDeleteProcessModalOpen}
        onClose={() => {
          setIsDeleteProcessModalOpen(false);
          setSelectedProcess(null);
        }}
        title="Confirm Process Removal"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to remove process{' '}
            <strong className="text-slate-900 font-bold">"{selectedProcess?.name}"</strong> from Process Master?
          </p>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Tip: You can deactivate it instead of deleting so historical purchase orders remain intact.
            </span>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsDeleteProcessModalOpen(false);
                setSelectedProcess(null);
              }}
              disabled={isProcessSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={isProcessSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              onClick={handleConfirmDeleteProcess}
              disabled={isProcessSubmitting}
            >
              {isProcessSubmitting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
