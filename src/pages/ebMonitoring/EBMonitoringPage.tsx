import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EBReadingRecord, CreateEBReadingPayload, UpdateEBReadingPayload } from '../../types/ebMonitoring';
import { EBMonitoringService } from '../../services/ebMonitoringService';
import { EBSettingsService } from '../../services/ebSettingsService';
import { isUserAdmin } from '../../utils/permissions';
import { Modal } from '../../components/ui/Modal';
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
  Clock,
  Zap,
  Lock
} from 'lucide-react';
import ExcelJS from 'exceljs';

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

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Filtered readings
  const filteredReadings = useMemo(() => {
    let result = [...readings];

    if (startDate) {
      result = result.filter((r) => r.date >= startDate);
    }

    if (endDate) {
      result = result.filter((r) => r.date <= endDate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        return (
          (r.readingNumber || '').toLowerCase().includes(q) ||
          (r.date || '').toLowerCase().includes(q) ||
          (r.readingTakenBy || '').toLowerCase().includes(q) ||
          (r.remarks || '').toLowerCase().includes(q) ||
          String(r.openingReading).includes(q) ||
          String(r.closingReading).includes(q) ||
          String(r.totalUnits).includes(q)
        );
      });
    }

    return result;
  }, [readings, startDate, endDate, searchQuery]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    const totalDays = readings.length;
    let totalUnits = 0;
    let totalCost = 0;

    readings.forEach((r) => {
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
  }, [readings]);

  // State to track auto-collected previous closing reading metadata
  const [previousClosingInfo, setPreviousClosingInfo] = useState<{
    value: number;
    date: string;
    readingNumber?: string;
  } | null>(null);

  // Helper to find preceding reading for a given target date
  const findPrecedingReading = (targetDate: string, recordList: EBReadingRecord[]) => {
    if (!recordList || recordList.length === 0) return null;
    const sorted = [...recordList].sort(
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

  // Open Add Modal: Auto-populate opening reading from previous day's closing reading,
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
    setFormOpeningTime('06:00');
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

    // 3. Automatically collect starting reading from previous closing entry
    let latest: EBReadingRecord | null = null;
    if (readings.length > 0) {
      latest = findPrecedingReading(todayStr, readings);
    } else {
      try {
        latest = await EBMonitoringService.getLatestReading();
      } catch {
        latest = null;
      }
    }

    if (latest && typeof latest.closingReading === 'number') {
      setFormOpeningReading(latest.closingReading);
      setPreviousClosingInfo({
        value: latest.closingReading,
        date: latest.date,
        readingNumber: latest.readingNumber
      });
    } else {
      setFormOpeningReading('');
      setPreviousClosingInfo(null);
    }

    setIsModalOpen(true);
  };

  // Date change handler to re-sync preceding closing reading if date is changed
  const handleDateChange = (newDate: string) => {
    setFormDate(newDate);
    if (!isEditMode && readings.length > 0) {
      const preceding = findPrecedingReading(newDate, readings);
      if (preceding && typeof preceding.closingReading === 'number') {
        setFormOpeningReading(preceding.closingReading);
        setPreviousClosingInfo({
          value: preceding.closingReading,
          date: preceding.date,
          readingNumber: preceding.readingNumber
        });
      }
    }
  };

  // Manual re-sync helper for previous closing reading
  const handleResyncPreviousClosing = async () => {
    let latest: EBReadingRecord | null = null;
    if (readings.length > 0) {
      latest = findPrecedingReading(formDate, readings);
    } else {
      latest = await EBMonitoringService.getLatestReading();
    }
    if (latest && typeof latest.closingReading === 'number') {
      setFormOpeningReading(latest.closingReading);
      setPreviousClosingInfo({
        value: latest.closingReading,
        date: latest.date,
        readingNumber: latest.readingNumber
      });
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (record: EBReadingRecord) => {
    setIsEditMode(true);
    setEditingId(record.id);
    setFormDate(record.date);
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
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">EB Monitoring</h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Current Unit Price Field (Stored in General Settings, Admin Editable Only) */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
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
            className="h-9 px-3 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="h-9 px-3.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
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
          <div className="text-xs text-slate-400 mt-1">Across {metrics.totalDays} recorded days</div>
        </div>

        {/* Card 2: Total Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Energy Cost
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.totalCost)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total power spending to date</div>
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Left: Search Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search date, reading, person name..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
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

            {(startDate || endDate || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearchQuery('');
                }}
                className="h-8 px-2 text-xs font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer"
              >
                Clear
              </button>
            )}

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

        {/* Grid Table matching exact user requested attributes */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 border-r border-slate-200 text-center w-12">S.No.</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Date</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-right">Opening Reading</th>
                <th className="py-3 px-3 border-r border-slate-200 text-center">Time</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-right">Closing Reading</th>
                <th className="py-3 px-3 border-r border-slate-200 text-center">Time</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-right">Total Units Per Day</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-right">Spending Amount Per Unit</th>
                <th className="py-3 px-3.5 border-r border-slate-200 text-right">Total Cost of the Day</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Reading Taken By</th>
                <th className="py-3 px-3.5 text-center">Action</th>
              </tr>
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
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-400 italic">
                    No EB readings recorded yet. Click "+ Add EB Reading" to record the first daily meter reading.
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
                    <td className="py-3 px-3.5 align-middle text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(reading)}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
                          title="Edit reading"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteReading(reading)}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
                          title="Delete reading"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
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

          {/* Section 1: Reading Date (Person name collected automatically in the background) */}
          <div className="max-w-xs">
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
                <div className="mt-1.5 text-[11px] text-slate-400">Opening shift time (e.g. 06:00 AM)</div>
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 hidden sm:inline-block">
              Stored in Firebase Firestore
            </span>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                disabled={formSubmitting}
                className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {formSubmitting
                  ? 'Saving to Firebase...'
                  : isEditMode
                  ? 'Update Reading'
                  : 'Save Reading'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
