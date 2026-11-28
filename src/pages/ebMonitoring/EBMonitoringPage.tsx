      import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EBReadingRecord, CreateEBReadingPayload, UpdateEBReadingPayload } from '../../types/ebMonitoring';
import { EBMonitoringService } from '../../services/ebMonitoringService';
import { EBSettingsService } from '../../services/ebSettingsService';
import { isUserAdmin } from '../../utils/permissions';
import { Modal } from '../../components/ui/Modal';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../components/ui/TableMaximizeWrapper';
import { formatDate, formatCurrency } from '../../utils/formatters';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
  Clock,
  Zap,
  Lock,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import ExcelJS from 'exceljs';

// Helper to convert time strings safely to HH:mm for <input type="time" />
const toTimeInputFormat = (timeStr?: string | null): string => {
  if (!timeStr) return '06:00';
  const trimmed = timeStr.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    return trimmed;
  }
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const modifier = (match12[3] || '').toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return trimmed;
};

// Helper to format time into 12-hour AM/PM display string
const formatTimeDisplay = (timeStr?: string | null): string => {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return trimmed;
};

export const EBMonitoringPage: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const userIsAdmin = Boolean(isAdmin || isUserAdmin(user));

  // Electricity Unit Price (Stored in General Settings, Admin Editable Only)
  const [currentUnitPrice, setCurrentUnitPrice] = useState<number>(
    EBSettingsService.getCache().unitPrice ?? 9.5
  );
  const [unitPriceInput, setUnitPriceInput] = useState<string>(
    String(EBSettingsService.getCache().unitPrice ?? 9.5)
  );
  const [isSavingUnitPrice, setIsSavingUnitPrice] = useState<boolean>(false);
  const [priceSavedNotice, setPriceSavedNotice] = useState<boolean>(false);

  // Subscribe to real-time changes of EB settings from General Settings / Firestore
  useEffect(() => {
    const unsubscribe = EBSettingsService.subscribeSettings((settings) => {
      setCurrentUnitPrice(settings.unitPrice);
      setUnitPriceInput(String(settings.unitPrice));
    });
    return () => unsubscribe();
  }, []);

  const handleSaveCurrentUnitPrice = async () => {
    if (!userIsAdmin) return;
    const val = parseFloat(unitPriceInput);
    if (isNaN(val) || val < 0) return;
    if (val === currentUnitPrice) return;

    setIsSavingUnitPrice(true);
    try {
      await EBSettingsService.updateSettings(val, {
        uid: user?.uid || 'admin',
        displayName: user?.displayName || user?.email || 'Admin',
        email: user?.email
      });
      setPriceSavedNotice(true);
      setTimeout(() => setPriceSavedNotice(false), 2500);
    } catch (err) {
      console.error('Failed to update EB unit price:', err);
    } finally {
      setIsSavingUnitPrice(false);
    }
  };

  // Data State
  const [readings, setReadings] = useState<EBReadingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters & Table Controls State
  const [selectedUnit, setSelectedUnit] = useState<'PTP' | 'NTP'>('PTP');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<{
    date?: string;
    openingReading?: string;
    openingTime?: string;
    closingReading?: string;
    closingTime?: string;
    totalUnits?: string;
    spendingAmountPerUnit?: string;
    totalCost?: string;
    readingTakenBy?: string;
  }>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  // 3-state sorting handler
  const handleSort = (field: string, isNumericOrDate = false) => {
    const firstDir: 'asc' | 'desc' = isNumericOrDate ? 'desc' : 'asc';
    const secondDir: 'asc' | 'desc' = isNumericOrDate ? 'asc' : 'desc';
    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection(firstDir);
    } else if (sortDirection === firstDir) {
      setSortDirection(secondDir);
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const renderSortIcon = (field: string) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center shrink-0 ml-1 transition-colors ${
          isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60'
        }`}
      >
        {isCurrent ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    );
  };

  const handleColumnFilterChange = (field: keyof typeof columnFilters, val: string) => {
    setColumnFilters((prev) => ({ ...prev, [field]: val }));
  };

  const activeColumnFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length;
  }, [columnFilters]);

  const hasAnyFilter = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchColumn !== 'ALL' ||
      startDate !== '' ||
      endDate !== '' ||
      activeColumnFilterCount > 0 ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, startDate, endDate, activeColumnFilterCount, sortField, sortDirection]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setStartDate('');
    setEndDate('');
    setColumnFilters({});
    setSortField(null);
    setSortDirection('normal');
  };

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formUnitType, setFormUnitType] = useState<'NTP' | 'PTP'>('PTP');
  const [formOpeningReading, setFormOpeningReading] = useState<number | ''>('');
  const [formOpeningTime, setFormOpeningTime] = useState('06:00');
  const [formClosingReading, setFormClosingReading] = useState<number | ''>('');
  const [formClosingTime, setFormClosingTime] = useState('22:00');
  const [formSpendingAmountPerUnit, setFormSpendingAmountPerUnit] = useState<number | ''>(9.5);
  const [formReadingTakenBy, setFormReadingTakenBy] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch readings
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await EBMonitoringService.getReadings();
      setReadings(data);
    } catch (err) {
      console.error('Failed to load EB readings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered readings with multi-column search, column filters, and 3-state sorting
  const filteredReadings = useMemo(() => {
    // Only show readings for the selected unit (PTP or NTP)
    let result = readings.filter((r) => (r.unitType || 'PTP') === selectedUnit);

    if (startDate) {
      result = result.filter((r) => r.date >= startDate);
    }

    if (endDate) {
      result = result.filter((r) => r.date <= endDate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        if (searchColumn === 'date') return (r.date || '').toLowerCase().includes(q) || formatDate(r.date).toLowerCase().includes(q);
        if (searchColumn === 'openingReading') return String(r.openingReading ?? '').includes(q);
        if (searchColumn === 'closingReading') return String(r.closingReading ?? '').includes(q);
        if (searchColumn === 'totalUnits') return String(r.totalUnits ?? '').includes(q);
        if (searchColumn === 'totalCost') return String(r.totalCost ?? '').includes(q);
        if (searchColumn === 'readingTakenBy') return (r.readingTakenBy || '').toLowerCase().includes(q);
        if (searchColumn === 'remarks') return (r.remarks || '').toLowerCase().includes(q);
        // ALL
        return (
          (r.readingNumber || '').toLowerCase().includes(q) ||
          (r.date || '').toLowerCase().includes(q) ||
          formatDate(r.date).toLowerCase().includes(q) ||
          (r.readingTakenBy || '').toLowerCase().includes(q) ||
          (r.remarks || '').toLowerCase().includes(q) ||
          String(r.openingReading ?? '').includes(q) ||
          String(r.closingReading ?? '').includes(q) ||
          String(r.totalUnits ?? '').includes(q) ||
          String(r.totalCost ?? '').includes(q)
        );
      });
    }

    // Column Filters
    if (columnFilters.date?.trim()) {
      const f = columnFilters.date.trim().toLowerCase();
      result = result.filter((r) => (r.date || '').toLowerCase().includes(f) || formatDate(r.date).toLowerCase().includes(f));
    }
    if (columnFilters.openingReading?.trim()) {
      const f = columnFilters.openingReading.trim();
      result = result.filter((r) => String(r.openingReading ?? '').includes(f));
    }
    if (columnFilters.openingTime?.trim()) {
      const f = columnFilters.openingTime.trim().toLowerCase();
      result = result.filter((r) => (r.openingTime || '').toLowerCase().includes(f));
    }
    if (columnFilters.closingReading?.trim()) {
      const f = columnFilters.closingReading.trim();
      result = result.filter((r) => String(r.closingReading ?? '').includes(f));
    }
    if (columnFilters.closingTime?.trim()) {
      const f = columnFilters.closingTime.trim().toLowerCase();
      result = result.filter((r) => (r.closingTime || '').toLowerCase().includes(f));
    }
    if (columnFilters.totalUnits?.trim()) {
      const f = columnFilters.totalUnits.trim();
      result = result.filter((r) => String(r.totalUnits ?? '').includes(f));
    }
    if (columnFilters.spendingAmountPerUnit?.trim()) {
      const f = columnFilters.spendingAmountPerUnit.trim();
      result = result.filter((r) => String(r.spendingAmountPerUnit ?? '').includes(f));
    }
    if (columnFilters.totalCost?.trim()) {
      const f = columnFilters.totalCost.trim();
      result = result.filter((r) => String(r.totalCost ?? '').includes(f));
    }
    if (columnFilters.readingTakenBy?.trim()) {
      const f = columnFilters.readingTakenBy.trim().toLowerCase();
      result = result.filter((r) => (r.readingTakenBy || '').toLowerCase().includes(f));
    }

    // 3-State Sorting
    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        let valA: any = (a as any)[sortField];
        let valB: any = (b as any)[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [readings, selectedUnit, startDate, endDate, searchQuery, searchColumn, columnFilters, sortField, sortDirection]);

  // Dynamic Totals for Table Footer
  const ebTotals = useMemo(() => {
    let units = 0;
    let cost = 0;
    filteredReadings.forEach((r) => {
      units += Number(r.totalUnits) || 0;
      cost += Number(r.totalCost) || 0;
    });
    return { units, cost };
  }, [filteredReadings]);

  // Overall KPI Metrics (Dynamically calculated based on applied filters)
  const metrics = useMemo(() => {
    const totalDays = filteredReadings.length;
    let totalUnits = 0;
    let totalCost = 0;

    filteredReadings.forEach((r) => {
      totalUnits += Number(r.totalUnits || 0);
      totalCost += Number(r.totalCost || 0);
    });

    const avgUnitsPerDay = totalDays > 0 ? Math.round((totalUnits / totalDays) * 100) / 100 : 0;
    const avgCostPerDay = totalDays > 0 ? Math.round((totalCost / totalDays) * 100) / 100 : 0;

    return {
      totalDays,
      totalUnits,
      totalCost,
      avgUnitsPerDay,
      avgCostPerDay
    };
  }, [filteredReadings]);

  // State to track auto-collected previous closing reading metadata
  const [previousClosingInfo, setPreviousClosingInfo] = useState<{
    value: number;
    date: string;
    closingTime?: string;
    readingNumber?: string;
  } | null>(null);

  // Helper to find preceding reading for a given target date and unit (NTP / PTP)
  const findPrecedingReading = (
    targetDate: string,
    recordList: EBReadingRecord[],
    targetUnit: 'NTP' | 'PTP' = 'PTP'
  ) => {
    if (!recordList || recordList.length === 0) return null;
    const filteredByUnit = recordList.filter((r) => (r.unitType || 'PTP') === targetUnit);
    if (filteredByUnit.length === 0) return null;
    const sorted = [...filteredByUnit].sort(
      (a, b) =>
        (b.date || '').localeCompare(a.date || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    // Find first record strictly before or on targetDate
    const before = sorted.find((r) => r.date < targetDate);
    if (before) return before;
    return sorted[0];
  };

  // Live auto calculations in the form
  const liveTotalUnits = useMemo(() => {
    const op = Number(formOpeningReading || 0);
    const cl = Number(formClosingReading || 0);
    if (formClosingReading === '' || formOpeningReading === '') return 0;
    return Math.max(0, Math.round((cl - op) * 100) / 100);
  }, [formOpeningReading, formClosingReading]);

  const liveTotalCost = useMemo(() => {
    const rate = Number(formSpendingAmountPerUnit || 0);
    return Math.round(liveTotalUnits * rate * 100) / 100;
  }, [liveTotalUnits, formSpendingAmountPerUnit]);

  // Check if a reading already exists for the selected date and unit (only 1 reading per day allowed)
  const existingReadingForFormDate = useMemo(() => {
    if (!isModalOpen || !formDate) return null;
    return (
      readings.find(
        (r) =>
          r.date === formDate &&
          (r.unitType || 'PTP') === formUnitType &&
          (!isEditMode || r.id !== editingId)
      ) || null
    );
  }, [isModalOpen, readings, formDate, formUnitType, isEditMode, editingId]);

  // Open Add Modal: Auto-populate opening reading & opening time from previous day's closing entry,
  // user name from logged-in user profile in the background, current time as closing time,
  // and unit rate from General Settings
  const handleOpenAddModal = async () => {
    setIsEditMode(false);
    setEditingId(null);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    setFormDate(todayStr);
    setFormUnitType(selectedUnit);
    setFormClosingReading('');
    setFormClosingTime(currentTime); // Auto-populated with current time
    setFormRemarks('');
    setFormError(null);

    // 1. Automatically collect person name from logged-in user profile in the background
    const autoUserName =
      user?.displayName ||
      (user?.email ? user.email.split('@')[0] : '') ||
      'Operator';
    setFormReadingTakenBy(autoUserName);

    // 2. Fetch fresh electricity unit rate from General Settings
    try {
      const genSettings = await EBSettingsService.getSettings();
      const rateFromSettings = Number(genSettings?.unitPrice ?? currentUnitPrice ?? 9.5);
      setFormSpendingAmountPerUnit(rateFromSettings > 0 ? rateFromSettings : 9.5);
    } catch {
      setFormSpendingAmountPerUnit(currentUnitPrice > 0 ? currentUnitPrice : 9.5);
    }

    // 3. Automatically collect starting reading & opening time from previous closing entry for selectedUnit
    let latest: EBReadingRecord | null = null;
    if (readings.length > 0) {
      latest = findPrecedingReading(todayStr, readings, selectedUnit);
    }
    if (!latest) {
      try {
        latest = await EBMonitoringService.getLatestReading(selectedUnit);
      } catch {
        latest = null;
      }
    }

    if (latest && typeof latest.closingReading === 'number') {
      setFormOpeningReading(latest.closingReading);
      setFormOpeningTime(toTimeInputFormat(latest.closingTime || '06:00'));
      setPreviousClosingInfo({
        value: latest.closingReading,
        date: latest.date,
        closingTime: latest.closingTime,
        readingNumber: latest.readingNumber
      });
    } else {
      setFormOpeningReading('');
      setFormOpeningTime('06:00');
      setPreviousClosingInfo(null);
    }

    setIsModalOpen(true);
  };

  // Unit / Plant change handler to re-sync preceding closing reading for that unit
  const handleUnitTypeChange = async (newUnit: 'NTP' | 'PTP') => {
    setFormUnitType(newUnit);
    if (!isEditMode) {
      let preceding: EBReadingRecord | null = findPrecedingReading(formDate, readings, newUnit);
      if (!preceding) {
        try {
          preceding = await EBMonitoringService.getLatestReading(newUnit);
        } catch {
          preceding = null;
        }
      }
      if (preceding && typeof preceding.closingReading === 'number') {
        setFormOpeningReading(preceding.closingReading);
        if (preceding.closingTime) {
          setFormOpeningTime(toTimeInputFormat(preceding.closingTime));
        }
        setPreviousClosingInfo({
          value: preceding.closingReading,
          date: preceding.date,
          closingTime: preceding.closingTime,
          readingNumber: preceding.readingNumber
        });
      } else {
        setFormOpeningReading('');
        setFormOpeningTime('06:00');
        setPreviousClosingInfo(null);
      }
    }
  };

  // Date change handler to re-sync preceding closing reading if date is changed
  const handleDateChange = async (newDate: string) => {
    setFormDate(newDate);
    if (!isEditMode) {
      let preceding: EBReadingRecord | null = findPrecedingReading(newDate, readings, formUnitType);
      if (!preceding) {
        try {
          preceding = await EBMonitoringService.getLatestReading(formUnitType);
        } catch {
          preceding = null;
        }
      }
      if (preceding && typeof preceding.closingReading === 'number') {
        setFormOpeningReading(preceding.closingReading);
        if (preceding.closingTime) {
          setFormOpeningTime(toTimeInputFormat(preceding.closingTime));
        }
        setPreviousClosingInfo({
          value: preceding.closingReading,
          date: preceding.date,
          closingTime: preceding.closingTime,
          readingNumber: preceding.readingNumber
        });
      } else {
        setFormOpeningReading('');
        setFormOpeningTime('06:00');
        setPreviousClosingInfo(null);
      }
    }
  };

  // Manual re-sync helper for previous closing reading
  const handleResyncPreviousClosing = async () => {
    let latest: EBReadingRecord | null = findPrecedingReading(formDate, readings, formUnitType);
    if (!latest) {
      try {
        latest = await EBMonitoringService.getLatestReading(formUnitType);
      } catch {
        latest = null;
      }
    }
    if (latest && typeof latest.closingReading === 'number') {
      setFormOpeningReading(latest.closingReading);
      if (latest.closingTime) {
        setFormOpeningTime(toTimeInputFormat(latest.closingTime));
      }
      setPreviousClosingInfo({
        value: latest.closingReading,
        date: latest.date,
        closingTime: latest.closingTime,
        readingNumber: latest.readingNumber
      });
    } else {
      setFormOpeningReading('');
      setFormOpeningTime('06:00');
      setPreviousClosingInfo(null);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: EBReadingRecord) => {
    setIsEditMode(true);
    setEditingId(record.id);
    setFormDate(record.date);
    setFormUnitType(record.unitType || 'PTP');
    setFormOpeningReading(record.openingReading);
    setFormOpeningTime(record.openingTime || '06:00');
    setFormClosingReading(record.closingReading);
    setFormClosingTime(record.closingTime || '22:00');
    setFormSpendingAmountPerUnit(record.spendingAmountPerUnit || currentUnitPrice || 9.5);
    setFormReadingTakenBy(record.readingTakenBy || '');
    setFormRemarks(record.remarks || '');
    setPreviousClosingInfo(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add or Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (existingReadingForFormDate) {
      setFormError(
        `An EB daily reading for ${formUnitType} on ${formatDate(formDate)} already exists (${existingReadingForFormDate.readingNumber}). Only one reading per day is allowed.`
      );
      return;
    }

    const op = Number(formOpeningReading);
    const cl = Number(formClosingReading);

    if (formOpeningReading === '' || isNaN(op) || op < 0) {
      setFormError('Please enter a valid opening reading in kW.');
      return;
    }

    if (formClosingReading === '' || isNaN(cl) || cl < 0) {
      setFormError('Please enter a valid closing reading in kW.');
      return;
    }

    if (cl < op) {
      setFormError(`Closing reading (${cl} kW) cannot be less than opening reading (${op} kW).`);
      return;
    }

    const rate = Number(formSpendingAmountPerUnit);
    if (isNaN(rate) || rate <= 0) {
      setFormError('Please enter a valid spending amount per unit (₹).');
      return;
    }

    if (!formReadingTakenBy.trim()) {
      setFormError('Please enter the name of the person who took the reading.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload: CreateEBReadingPayload = {
        date: formDate,
        unitType: formUnitType,
        openingReading: op,
        openingTime: formOpeningTime || '06:00',
        closingReading: cl,
        closingTime: formClosingTime || '22:00',
        spendingAmountPerUnit: rate,
        readingTakenBy: formReadingTakenBy.trim(),
        remarks: formRemarks.trim() || undefined
      };

      if (isEditMode && editingId) {
        const updated = await EBMonitoringService.updateReading(editingId, payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User'
        });
        setReadings((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await EBMonitoringService.createReading(payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User'
        });
        setReadings((prev) => [created, ...prev]);
      }

      setIsModalOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error('Error saving EB reading:', err);
      setFormError(err?.message || 'Failed to save EB reading.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Reading
  const handleDeleteReading = async (record: EBReadingRecord) => {
    const confirm = window.confirm(
      `Are you sure you want to delete EB reading for date ${formatDate(record.date)} (${record.totalUnits} kW)?`
    );
    if (!confirm) return;

    try {
      await EBMonitoringService.deleteReading(record.id);
      setReadings((prev) => prev.filter((r) => r.id !== record.id));
    } catch (err: any) {
      alert(`Error deleting EB reading: ${err?.message || 'Operation failed'}`);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('EB Readings');

      worksheet.columns = [
        { header: 'S.No.', key: 'sNo', width: 8 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Unit / Plant', key: 'unitType', width: 14 },
        { header: 'Opening Reading (kW)', key: 'openingReading', width: 22 },
        { header: 'Time (Opening)', key: 'openingTime', width: 16 },
        { header: 'Closing Reading (kW)', key: 'closingReading', width: 22 },
        { header: 'Time (Closing)', key: 'closingTime', width: 16 },
        { header: 'Total Units Per Day (kW)', key: 'totalUnits', width: 24 },
        { header: 'Spending Amount Per Unit (₹)', key: 'rate', width: 26 },
        { header: 'Total Cost of the Day (₹)', key: 'totalCost', width: 24 },
        { header: 'Reading Taken By', key: 'readingTakenBy', width: 22 },
        { header: 'Remarks', key: 'remarks', width: 25 }
      ];

      filteredReadings.forEach((r, idx) => {
        worksheet.addRow({
          sNo: idx + 1,
          date: r.date,
          unitType: r.unitType || 'PTP',
          openingReading: r.openingReading,
          openingTime: r.openingTime || '—',
          closingReading: r.closingReading,
          closingTime: r.closingTime || '—',
          totalUnits: r.totalUnits,
          rate: r.spendingAmountPerUnit,
          totalCost: r.totalCost,
          readingTakenBy: r.readingTakenBy || '—',
          remarks: r.remarks || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `Perla_EB_Readings_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting EB Excel:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header - Minimal & Airy */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">EB Monitoring</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily meter readings, unit consumption (kW), and power cost tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Current Unit Price Field (Stored in General Settings, Admin Editable Only) */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Unit Price:
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-600 font-mono">₹</span>
                {userIsAdmin ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPriceInput}
                    onChange={(e) => setUnitPriceInput(e.target.value)}
                    onBlur={handleSaveCurrentUnitPrice}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCurrentUnitPrice()}
                    disabled={isSavingUnitPrice}
                    style={{
                      width: `${Math.max(2, String(unitPriceInput ?? '').length) + 1.2}ch`,
                      minWidth: '2.4rem',
                    }}
                    className="h-7 bg-slate-200/90 hover:bg-slate-200 focus:bg-slate-200 border border-slate-300 rounded px-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 transition-all text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    title="Current price for 1 unit (stored in General Settings). Click Save or press Enter to update."
                  />
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-900 px-2 py-0.5 bg-slate-200/90 rounded border border-slate-300">
                    {Number(currentUnitPrice).toFixed(2)}
                  </span>
                )}
                <span className="text-[11px] font-medium text-slate-500">/ kW</span>
              </div>
            </div>

            {/* Save Status / Button for Admin */}
            {userIsAdmin ? (
              <div className="flex items-center pl-1 border-l border-slate-200">
                {isSavingUnitPrice ? (
                  <span className="text-[10px] text-slate-500 font-semibold px-1">Saving...</span>
                ) : priceSavedNotice ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                    Saved
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveCurrentUnitPrice}
                    disabled={
                      parseFloat(unitPriceInput) === currentUnitPrice ||
                      isNaN(parseFloat(unitPriceInput))
                    }
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                      parseFloat(unitPriceInput) !== currentUnitPrice &&
                      !isNaN(parseFloat(unitPriceInput))
                        ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                        : 'text-slate-400 hover:text-slate-600 bg-slate-100'
                    }`}
                    title="Save current unit price to General Settings"
                  >
                    Save
                  </button>
                )}
              </div>
            ) : (
              <div
                className="flex items-center pl-1 border-l border-slate-200"
                title="Editable only by Admin"
              >
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Admin
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add EB Reading</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Units */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Units Consumed
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.totalUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-bold text-slate-500">kW</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {metrics.totalDays}{' '}
            {startDate || endDate || searchQuery ? 'filtered' : 'recorded'}{' '}
            {metrics.totalDays === 1 ? 'day' : 'days'}
          </div>
        </div>

        {/* Card 2: Total Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Energy Cost
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.totalCost)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {startDate || endDate || searchQuery
              ? 'Power spending for filtered period'
              : 'Total power spending to date'}
          </div>
        </div>

        {/* Card 3: Avg Units Per Day */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Average Units / Day
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.avgUnitsPerDay.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-bold text-slate-500">kW</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Daily energy consumption pace</div>
        </div>

        {/* Card 4: Avg Cost Per Day */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Average Cost / Day
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.avgCostPerDay)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Daily electricity operational cost</div>
        </div>
      </div>

      {/* Main Grid Table Card */}
      <TableMaximizeWrapper
        title="Electricity (EB) Daily Monitoring"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredReadings.length} Readings
          </span>
        }
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Left: Search Bar & Column Filters Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Plant / Unit Filter: PTP vs NTP (Black and Gray) */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-300 shadow-2xs gap-1">
              <button
                type="button"
                onClick={() => setSelectedUnit('PTP')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedUnit === 'PTP'
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-black hover:bg-slate-200/70'
                }`}
              >
                <span>PTP</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-semibold ${
                    selectedUnit === 'PTP' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {readings.filter((r) => (r.unitType || 'PTP') === 'PTP').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUnit('NTP')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedUnit === 'NTP'
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-transparent text-slate-600 hover:text-black hover:bg-slate-200/70'
                }`}
              >
                <span>NTP</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-semibold ${
                    selectedUnit === 'NTP' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {readings.filter((r) => r.unitType === 'NTP').length}
                </span>
              </button>
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 w-full sm:w-auto">
              <div className="relative bg-slate-50 border-r border-slate-200 shrink-0">
                <select
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  className="h-9 pl-3 pr-7 bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none"
                  title="Select column to search in"
                >
                  <option value="ALL">All Columns</option>
                  <option value="date">Date</option>
                  <option value="openingReading">Opening Reading</option>
                  <option value="closingReading">Closing Reading</option>
                  <option value="totalUnits">Total Units</option>
                  <option value="totalCost">Total Cost</option>
                  <option value="readingTakenBy">Reading Taken By</option>
                  <option value="remarks">Remarks</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[200px] flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder={searchColumn === 'ALL' ? 'Search all columns...' : `Search ${searchColumn}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Column Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowColumnFilters((prev) => !prev)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                showColumnFilters || activeColumnFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1F4E79]'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title="Toggle inline column filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Column Filters</span>
              {activeColumnFilterCount > 0 && (
                <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeColumnFilterCount}
                </span>
              )}
            </button>

            {/* Reset All Filters button */}
            {hasAnyFilter && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="h-9 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Reset All Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Right: Date Range & Export */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ml-auto cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Grid Table with Sticky Headers & Column Filter Inputs */}
        <div data-table-scroll="true" className="max-h-[620px] overflow-auto relative border border-slate-300 rounded-b-2xl">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <tr className="bg-[#EEF5FB] border-b-2 border-slate-300 text-[#1F4E79] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 border-r border-slate-300 text-center w-12 sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]">S.No.</th>
                <th
                  onClick={() => handleSort('date', true)}
                  className="py-3 px-3.5 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between">
                    <span>Date</span>
                    {renderSortIcon('date')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('openingReading', true)}
                  className="py-3 px-3.5 border-r border-slate-300 text-right cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-end">
                    <span>Opening Reading</span>
                    {renderSortIcon('openingReading')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('openingTime')}
                  className="py-3 px-3 border-r border-slate-300 text-center cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center">
                    <span>Time</span>
                    {renderSortIcon('openingTime')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('closingReading', true)}
                  className="py-3 px-3.5 border-r border-slate-300 text-right cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-end">
                    <span>Closing Reading</span>
                    {renderSortIcon('closingReading')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('closingTime')}
                  className="py-3 px-3 border-r border-slate-300 text-center cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center">
                    <span>Time</span>
                    {renderSortIcon('closingTime')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalUnits', true)}
                  className="py-3 px-3.5 border-r border-slate-300 text-right cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-end">
                    <span>Total Units Per Day</span>
                    {renderSortIcon('totalUnits')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('spendingAmountPerUnit', true)}
                  className="py-3 px-3.5 border-r border-slate-300 text-right cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-end">
                    <span>Spending Amount / Unit</span>
                    {renderSortIcon('spendingAmountPerUnit')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalCost', true)}
                  className="py-3 px-3.5 border-r border-slate-300 text-right cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-end">
                    <span>Total Cost of the Day</span>
                    {renderSortIcon('totalCost')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('readingTakenBy')}
                  className="py-3 px-3.5 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between">
                    <span>Reading Taken By</span>
                    {renderSortIcon('readingTakenBy')}
                  </div>
                </th>
                <th className="py-3 px-3.5 text-left sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] min-w-[130px] pr-12">Actions</th>
              </tr>

              {/* Inline Column Filter Inputs Row */}
              {showColumnFilters && (
                <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center font-normal text-slate-400 text-[10px]">
                    #
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter date..."
                      value={columnFilters.date || ''}
                      onChange={(e) => handleColumnFilterChange('date', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter opening..."
                      value={columnFilters.openingReading || ''}
                      onChange={(e) => handleColumnFilterChange('openingReading', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Time..."
                      value={columnFilters.openingTime || ''}
                      onChange={(e) => handleColumnFilterChange('openingTime', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter closing..."
                      value={columnFilters.closingReading || ''}
                      onChange={(e) => handleColumnFilterChange('closingReading', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Time..."
                      value={columnFilters.closingTime || ''}
                      onChange={(e) => handleColumnFilterChange('closingTime', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter units..."
                      value={columnFilters.totalUnits || ''}
                      onChange={(e) => handleColumnFilterChange('totalUnits', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter rate..."
                      value={columnFilters.spendingAmountPerUnit || ''}
                      onChange={(e) => handleColumnFilterChange('spendingAmountPerUnit', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-right">
                    <input
                      type="text"
                      placeholder="Filter cost..."
                      value={columnFilters.totalCost || ''}
                      onChange={(e) => handleColumnFilterChange('totalCost', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-right font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter person..."
                      value={columnFilters.readingTakenBy || ''}
                      onChange={(e) => handleColumnFilterChange('readingTakenBy', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1 sticky top-[41px] z-20 bg-slate-100 text-center min-w-[130px] pr-12">
                    {activeColumnFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setColumnFilters({})}
                        className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-white border border-rose-200 rounded cursor-pointer"
                        title="Clear column filters"
                      >
                        Clear
                      </button>
                    )}
                  </th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading EB readings...
                  </td>
                </tr>
              ) : filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-slate-700 text-sm">No matching {selectedUnit} EB readings found</p>
                      <p className="text-slate-400 text-xs">
                        {hasAnyFilter
                          ? `No ${selectedUnit} records match the active search or column filters.`
                          : `No ${selectedUnit} EB readings recorded yet. Click "+ Add EB Reading" to record the first daily meter reading.`}
                      </p>
                      {hasAnyFilter && (
                        <button
                          type="button"
                          onClick={handleResetAllFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReadings.map((reading, index) => (
                  <tr
                    key={reading.id}
                    className="hover:bg-slate-50/70 transition-colors border-b border-slate-200"
                  >
                    {/* S.No. */}
                    <td className="py-3 px-3 border-r border-slate-200 align-middle text-center font-mono font-medium text-slate-500">
                      {index + 1}
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle whitespace-nowrap text-slate-700 font-semibold">
                      {formatDate(reading.date)}
                    </td>

                    {/* Opening Reading */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono text-slate-800">
                      {(Number(reading.openingReading) || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2
                      })}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">kW</span>
                    </td>

                    {/* Opening Time */}
                    <td className="py-3 px-3 border-r border-slate-200 align-middle text-center font-mono text-slate-600 whitespace-nowrap">
                      {reading.openingTime || '—'}
                    </td>

                    {/* Closing Reading */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono font-semibold text-slate-900">
                      {(Number(reading.closingReading) || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2
                      })}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">kW</span>
                    </td>

                    {/* Closing Time */}
                    <td className="py-3 px-3 border-r border-slate-200 align-middle text-center font-mono text-slate-600 whitespace-nowrap">
                      {reading.closingTime || '—'}
                    </td>

                    {/* Total Units Per Day */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono font-bold text-slate-900">
                      {(Number(reading.totalUnits) || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2
                      })}{' '}
                      <span className="text-[10px] text-slate-500 font-normal">kW</span>
                    </td>

                    {/* Spending Amount Per Unit */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono text-slate-800">
                      ₹{(Number(reading.spendingAmountPerUnit) || 0).toFixed(2)}
                      <span className="text-[10px] text-slate-400 font-normal">/kW</span>
                    </td>

                    {/* Total Cost of the Day */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle text-right font-mono font-bold text-slate-900">
                      {formatCurrency(Number(reading.totalCost) || 0)}
                    </td>

                    {/* Reading Taken By */}
                    <td className="py-3 px-3.5 border-r border-slate-200 align-middle font-medium text-slate-800">
                      {reading.readingTakenBy || '—'}
                      {reading.remarks && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                          {reading.remarks}
                        </div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3.5 align-middle text-left whitespace-nowrap">
                      <div className="flex items-center justify-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(reading)}
                          className="px-2.5 py-1 rounded text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                          title="Edit reading"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteReading(reading)}
                          className="px-2.5 py-1 rounded text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                          title="Delete reading"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <TableTotalsFooter
              cells={[
                { colSpan: 6, label: `TOTAL (${filteredReadings.length} readings)` },
                {
                  value: `${ebTotals.units.toLocaleString('en-IN', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 2
                  })} kW`,
                  isTotal: true
                },
                { align: 'center' },
                { currency: ebTotals.cost, isTotal: true },
                { align: 'center' },
                { align: 'center' }
              ]}
            />
          </table>
        </div>

        {/* Informative Table Controls Footer - All data in one stretch */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing all <strong>{filteredReadings.length}</strong> records in one stretch
            {filteredReadings.length !== readings.length && ` (filtered from ${readings.length} total)`}
          </span>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="text-xs font-semibold text-[#1F4E79] hover:underline cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      </div>
      </TableMaximizeWrapper>

      {/* MODAL: Add / Edit EB Daily Reading */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formSubmitting && setIsModalOpen(false)}
        title={isEditMode ? 'Edit EB Daily Reading' : 'New EB Daily Reading'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          {formError && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 shadow-2xs">
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* Section 1: Reading Date & Plant / Unit Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reading Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => handleDateChange(e.target.value)}
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Plant / Unit <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 h-11 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleUnitTypeChange('NTP')}
                  className={`h-full rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    formUnitType === 'NTP'
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-transparent text-slate-600 hover:bg-white/60'
                  }`}
                >
                  NTP
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitTypeChange('PTP')}
                  className={`h-full rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                    formUnitType === 'PTP'
                      ? 'bg-black text-white shadow-xs'
                      : 'bg-transparent text-slate-600 hover:bg-white/60'
                  }`}
                >
                  PTP
                </button>
              </div>
            </div>

            {existingReadingForFormDate && (
              <div className="col-span-1 sm:col-span-2 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Daily Reading Already Recorded: </span>
                  An EB reading for <strong>{formUnitType}</strong> on <strong>{formatDate(formDate)}</strong> has already been entered (<strong>{existingReadingForFormDate.readingNumber}</strong>). Only one reading per day is permitted per unit.
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Meter Readings (Opening & Closing) */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Meter Readings & Timing
              </span>
              {previousClosingInfo && !isEditMode && (
                <button
                  type="button"
                  onClick={handleResyncPreviousClosing}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                  title="Re-sync with latest recorded closing reading"
                >
                  Re-sync Previous Closing
                </button>
              )}
            </div>

            {/* Opening Reading & Opening Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Opening Reading (kW) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formOpeningReading}
                    onChange={(e) =>
                      setFormOpeningReading(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    required
                    className="flex-1 h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                  />
                  <span className="w-14 h-11 flex items-center justify-center bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 font-mono">
                    kW
                  </span>
                </div>
                {previousClosingInfo ? (
                  <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">
                    Auto-collected from previous closing: {previousClosingInfo.value} kW ({formatDate(previousClosingInfo.date)})
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] text-slate-400">
                    Initial starting meter reading (no prior closing recorded)
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Opening Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formOpeningTime}
                  onChange={(e) => setFormOpeningTime(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                {previousClosingInfo?.closingTime ? (
                  <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">
                    Auto-collected from recent closing: {formatTimeDisplay(previousClosingInfo.closingTime)}
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] text-slate-400">Opening shift time (e.g. 06:00 AM)</div>
                )}
              </div>
            </div>

            {/* Closing Reading & Closing Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-200/50">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Closing Reading (kW) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formClosingReading}
                    onChange={(e) =>
                      setFormClosingReading(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                    required
                    className="flex-1 h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                  />
                  <span className="w-14 h-11 flex items-center justify-center bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 font-mono">
                    kW
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  End of day meter reading (must be ≥ opening reading)
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Closing Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formClosingTime}
                  onChange={(e) => setFormClosingTime(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <div className="mt-1.5 text-[11px] text-slate-400">Current closing time (auto-set to current time)</div>
              </div>
            </div>
          </div>

          {/* Section 3: Spending Amount Per Unit */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Spending Amount Per Unit (₹ / kW) <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2 max-w-sm">
              <span className="w-11 h-11 flex items-center justify-center bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-600 font-mono">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formSpendingAmountPerUnit}
                onChange={(e) =>
                  setFormSpendingAmountPerUnit(
                    e.target.value === '' ? '' : parseFloat(e.target.value)
                  )
                }
                placeholder="9.50"
                required
                className="flex-1 h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
              <span className="w-16 h-11 flex items-center justify-center bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 font-mono">
                / kW
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">
              Fetched from General Settings (₹{Number(formSpendingAmountPerUnit || 0).toFixed(2)} / kW)
            </div>
          </div>

          {/* Section 4: Live Auto Calculation Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/60">
              <div className="sm:pr-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Total Units Consumed Per Day
                </span>
                <div className="text-2xl font-black text-white mt-1 font-mono flex items-baseline gap-1.5">
                  {liveTotalUnits.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  <span className="text-xs font-bold text-amber-400">kW</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {formClosingReading !== '' && formOpeningReading !== ''
                    ? `${formClosingReading} kW (Close) − ${formOpeningReading} kW (Open)`
                    : 'Enter closing reading to compute consumption'}
                </span>
              </div>

              <div className="sm:pl-4 pt-3 sm:pt-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Total Cost of the Day
                </span>
                <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">
                  {formatCurrency(liveTotalCost)}
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {liveTotalUnits > 0
                    ? `${liveTotalUnits} kW × ₹${Number(formSpendingAmountPerUnit || 0).toFixed(2)}/kW`
                    : `Calculated at ₹${Number(formSpendingAmountPerUnit || 0).toFixed(2)}/kW`}
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Remarks / Notes */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Remarks / Operational Notes
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="Optional notes regarding power cut, generator backup, or shift variations..."
              className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
            <button
              type="button"
              disabled={formSubmitting}
              onClick={() => setIsModalOpen(false)}
              className="h-10 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting || Boolean(existingReadingForFormDate)}
              className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : existingReadingForFormDate ? (
                <span>Reading Already Exists</span>
              ) : (
                <span>{isEditMode ? 'Update Reading' : 'Save Reading'}</span>
              )}
            </button>
          </div>
        </form>

        <LoadingOverlay
          isOpen={formSubmitting}
          title={isEditMode ? 'Updating EB Reading...' : 'Recording EB Meter Reading...'}
          message="Calculating peak/normal power units, applying slab rates, and saving EB log..."
        />
      </Modal>
    </div>
  );
};
