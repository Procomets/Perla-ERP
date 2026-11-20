import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../utils/permissions';
import {
  VehicleDailyEntry,
  CreateVehicleDailyEntryPayload,
  VehicleFuelType,
  VehicleRecord
} from '../../types/vehicle';
import {
  VehicleMonitoringService,
  DEFAULT_FUEL_RATES
} from '../../services/vehicleMonitoringService';
import { VehicleService } from '../../services/vehicleService';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency } from '../../utils/formatters';
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Clock,
  Gauge,
  Fuel,
  Zap,
  ArrowUpDown
} from 'lucide-react';
import ExcelJS from 'exceljs';

interface DailyExpenseMonitorSectionProps {
  vehicles: VehicleRecord[];
}

export const DailyExpenseMonitorSection: React.FC<DailyExpenseMonitorSectionProps> = ({
  vehicles
}) => {
  const { user, isAdmin } = useAuth();
  const userIsAdmin = Boolean(isAdmin || isUserAdmin(user));

  // Entries State
  const [entries, setEntries] = useState<VehicleDailyEntry[]>(() =>
    VehicleMonitoringService.getCache()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicleNoFilter, setVehicleNoFilter] = useState('all');
  const [fuelTypeFilter, setFuelTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<
    'date' | 'vehicleNo' | 'totalDistance' | 'amountSpent' | 'driverName'
  >('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formVehicleNo, setFormVehicleNo] = useState('');
  const [formFuelType, setFormFuelType] = useState<VehicleFuelType>('Diesel');
  const [formMileage, setFormMileage] = useState<number>(4.5);
  const [formStartKm, setFormStartKm] = useState<number | ''>('');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndKm, setFormEndKm] = useState<number | ''>('');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formFuelRate, setFormFuelRate] = useState<number>(DEFAULT_FUEL_RATES.Diesel);
  const [formDriverName, setFormDriverName] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Previous entry metadata for selected vehicle
  const [precedingInfo, setPrecedingInfo] = useState<{
    endKm: number;
    endTime: string;
    date: string;
  } | null>(null);

  // Load entries from Firestore / Cache
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await VehicleMonitoringService.getEntries();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load vehicle daily entries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Sorted Entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    if (vehicleNoFilter !== 'all') {
      result = result.filter(
        (e) => (e.vehicleNo || '').toLowerCase() === vehicleNoFilter.toLowerCase()
      );
    }

    if (fuelTypeFilter !== 'all') {
      result = result.filter(
        (e) => (e.fuelType || 'Diesel').toLowerCase() === fuelTypeFilter.toLowerCase()
      );
    }

    if (startDate) {
      result = result.filter((e) => e.date >= startDate);
    }

    if (endDate) {
      result = result.filter((e) => e.date <= endDate);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((e) => {
        return (
          (e.entryId || '').toLowerCase().includes(q) ||
          (e.vehicleNo || '').toLowerCase().includes(q) ||
          (e.driverName || '').toLowerCase().includes(q) ||
          (e.typeOfVehicle || '').toLowerCase().includes(q) ||
          (e.modelMake || '').toLowerCase().includes(q) ||
          (e.fuelType || '').toLowerCase().includes(q) ||
          (e.date || '').includes(q) ||
          String(e.totalDistance).includes(q) ||
          String(e.amountSpent).includes(q) ||
          (e.remarks || '').toLowerCase().includes(q)
        );
      });
    }

    result.sort((a, b) => {
      let valA: any = a[sortField] ?? '';
      let valB: any = b[sortField] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, vehicleNoFilter, fuelTypeFilter, startDate, endDate, searchQuery, sortField, sortDirection]);

  // Overall KPI Metrics (Dynamically reflects active filter)
  const metrics = useMemo(() => {
    const totalEntriesCount = filteredEntries.length;
    let totalDistanceCovered = 0;
    let totalAmountSpent = 0;
    let totalFuelConsumed = 0;

    filteredEntries.forEach((e) => {
      totalDistanceCovered += Number(e.totalDistance || 0);
      totalAmountSpent += Number(e.amountSpent || 0);
      totalFuelConsumed += Number(e.fuelConsumed || 0);
    });

    const avgCostPerKm =
      totalDistanceCovered > 0
        ? Math.round((totalAmountSpent / totalDistanceCovered) * 100) / 100
        : 0;

    return {
      totalEntriesCount,
      totalDistanceCovered,
      totalAmountSpent,
      totalFuelConsumed,
      avgCostPerKm
    };
  }, [filteredEntries]);

  // Sort Toggle
  const handleSort = (field: 'date' | 'vehicleNo' | 'totalDistance' | 'amountSpent' | 'driverName') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Live Auto Calculations in Form
  const liveTotalDistance = useMemo(() => {
    const s = Number(formStartKm || 0);
    const e = Number(formEndKm || 0);
    if (formStartKm === '' || formEndKm === '' || isNaN(s) || isNaN(e)) return 0;
    return Math.max(0, Math.round((e - s) * 100) / 100);
  }, [formStartKm, formEndKm]);

  const liveTimeDifference = useMemo(() => {
    return VehicleMonitoringService.calculateTimeDiff(formStartTime, formEndTime);
  }, [formStartTime, formEndTime]);

  const liveFuelConsumed = useMemo(() => {
    const m = Number(formMileage || 0);
    if (m <= 0 || liveTotalDistance <= 0) return 0;
    return Math.round((liveTotalDistance / m) * 100) / 100;
  }, [liveTotalDistance, formMileage]);

  const liveAmountSpent = useMemo(() => {
    const rate = Number(formFuelRate || 0);
    return Math.round(liveFuelConsumed * rate * 100) / 100;
  }, [liveFuelConsumed, formFuelRate]);

  // Select Vehicle handler in Modal
  const handleSelectVehicle = (vehicleNumber: string) => {
    setFormVehicleNo(vehicleNumber);
    const found = vehicles.find(
      (v) => v.vehicleNo.toUpperCase() === vehicleNumber.toUpperCase()
    );

    if (found) {
      const fuel = found.fuelType || 'Diesel';
      setFormFuelType(fuel);
      const m = parseFloat(String(found.mileage || 4.5)) || 4.5;
      setFormMileage(m);
      setFormFuelRate(DEFAULT_FUEL_RATES[fuel] || 92.0);

      // Check preceding log for this vehicle
      const preceding = VehicleMonitoringService.getPrecedingVehicleEntry(
        vehicleNumber,
        formDate,
        entries
      );

      if (preceding && typeof preceding.endKm === 'number') {
        setFormStartKm(preceding.endKm);
        setFormStartTime(preceding.endTime || '08:00');
        setPrecedingInfo({
          endKm: preceding.endKm,
          endTime: preceding.endTime,
          date: preceding.date
        });
      } else {
        setPrecedingInfo(null);
      }
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    setFormDate(todayStr);
    setFormEndKm('');
    setFormEndTime(currentTime); // Auto-populated with current time
    setFormRemarks('');
    setFormError(null);

    // 1. Automatically fetch driver name from logged-in user profile
    const autoDriver =
      user?.displayName ||
      (user?.email ? user.email.split('@')[0] : '') ||
      'Driver';
    setFormDriverName(autoDriver);

    // 2. Select first available vehicle by default
    if (vehicles.length > 0) {
      const first = vehicles[0];
      setFormVehicleNo(first.vehicleNo);
      const fuel = first.fuelType || 'Diesel';
      setFormFuelType(fuel);
      const m = parseFloat(String(first.mileage || 4.5)) || 4.5;
      setFormMileage(m);
      setFormFuelRate(DEFAULT_FUEL_RATES[fuel] || 92.0);

      // Check previous closing trip for this vehicle
      const preceding = VehicleMonitoringService.getPrecedingVehicleEntry(
        first.vehicleNo,
        todayStr,
        entries
      );

      if (preceding && typeof preceding.endKm === 'number') {
        setFormStartKm(preceding.endKm);
        setFormStartTime(preceding.endTime || '08:00');
        setPrecedingInfo({
          endKm: preceding.endKm,
          endTime: preceding.endTime,
          date: preceding.date
        });
      } else {
        setFormStartKm('');
        setFormStartTime('08:00');
        setPrecedingInfo(null);
      }
    } else {
      setFormVehicleNo('');
      setFormStartKm('');
      setFormStartTime('08:00');
      setPrecedingInfo(null);
    }

    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (entry: VehicleDailyEntry) => {
    setIsEditMode(true);
    setEditingId(entry.id);
    setFormDate(entry.date);
    setFormVehicleNo(entry.vehicleNo);
    setFormFuelType(entry.fuelType || 'Diesel');
    setFormMileage(entry.mileage || 4.5);
    setFormStartKm(entry.startKm);
    setFormStartTime(entry.startTime || '08:00');
    setFormEndKm(entry.endKm);
    setFormEndTime(entry.endTime || '17:00');
    setFormFuelRate(entry.fuelRate || DEFAULT_FUEL_RATES[entry.fuelType] || 92.0);
    setFormDriverName(entry.driverName || '');
    setFormRemarks(entry.remarks || '');
    setPrecedingInfo(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formVehicleNo) {
      setFormError('Please select a vehicle from the dropdown menu.');
      return;
    }

    const start = Number(formStartKm);
    const end = Number(formEndKm);

    if (formStartKm === '' || isNaN(start) || start < 0) {
      setFormError('Please enter a valid starting kilometer reading.');
      return;
    }

    if (formEndKm === '' || isNaN(end) || end < 0) {
      setFormError('Please enter a valid ending kilometer reading.');
      return;
    }

    if (end < start) {
      setFormError(`End kilometer reading (${end} km) cannot be less than start reading (${start} km).`);
      return;
    }

    if (!formDriverName.trim()) {
      setFormError('Please enter or verify the driver name.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    const vehicleObj = vehicles.find(
      (v) => v.vehicleNo.toUpperCase() === formVehicleNo.toUpperCase()
    );

    const timeDiff = VehicleMonitoringService.calculateTimeDiff(formStartTime, formEndTime);
    const totalDist = Math.max(0, Math.round((end - start) * 100) / 100);
    const m = formMileage > 0 ? formMileage : 4.5;
    const consumed = Math.round((totalDist / m) * 100) / 100;
    const spent = Math.round(consumed * formFuelRate * 100) / 100;

    try {
      const payload: CreateVehicleDailyEntryPayload = {
        date: formDate,
        vehicleNo: formVehicleNo.trim().toUpperCase(),
        vehicleId: vehicleObj?.id,
        typeOfVehicle: vehicleObj?.typeOfVehicle,
        modelMake: vehicleObj?.modelMake,
        fuelType: formFuelType,
        mileage: m,
        startKm: start,
        startTime: formStartTime,
        endKm: end,
        endTime: formEndTime,
        totalDistance: totalDist,
        timeTakenMinutes: timeDiff.minutes,
        timeTakenFormatted: timeDiff.formatted,
        fuelRate: formFuelRate,
        fuelConsumed: consumed,
        amountSpent: spent,
        driverName: formDriverName.trim(),
        remarks: formRemarks.trim() || undefined
      };

      if (isEditMode && editingId) {
        const updated = await VehicleMonitoringService.updateEntry(editingId, payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User',
          email: user?.email
        });
        setEntries((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const created = await VehicleMonitoringService.createEntry(payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User',
          email: user?.email
        });
        setEntries((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      }

      setIsModalOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error('Error saving vehicle daily entry:', err);
      setFormError(err?.message || 'Failed to save vehicle daily entry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (entry: VehicleDailyEntry) => {
    const confirm = window.confirm(
      `Are you sure you want to delete daily entry "${entry.entryId}" for vehicle ${entry.vehicleNo}?`
    );
    if (!confirm) return;

    try {
      await VehicleMonitoringService.deleteEntry(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err: any) {
      alert(`Error deleting entry: ${err?.message || 'Operation failed'}`);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Daily Vehicle Expenses');

      worksheet.columns = [
        { header: 'S.No.', key: 'sNo', width: 8 },
        { header: 'ENTRY ID', key: 'entryId', width: 16 },
        { header: 'DATE', key: 'date', width: 14 },
        { header: 'VEHICLE NO', key: 'vehicleNo', width: 16 },
        { header: 'TYPE / MAKE', key: 'vehicleType', width: 22 },
        { header: 'FUEL TYPE', key: 'fuelType', width: 12 },
        { header: 'START KM', key: 'startKm', width: 14 },
        { header: 'START TIME', key: 'startTime', width: 14 },
        { header: 'END KM', key: 'endKm', width: 14 },
        { header: 'END TIME', key: 'endTime', width: 14 },
        { header: 'TOTAL DISTANCE (km)', key: 'totalDistance', width: 20 },
        { header: 'TIME TAKEN', key: 'timeTaken', width: 14 },
        { header: 'MILEAGE', key: 'mileage', width: 14 },
        { header: 'FUEL RATE (₹)', key: 'fuelRate', width: 14 },
        { header: 'AMOUNT SPENT (₹)', key: 'amountSpent', width: 18 },
        { header: 'DRIVER NAME', key: 'driverName', width: 20 },
        { header: 'REMARKS', key: 'remarks', width: 26 }
      ];

      filteredEntries.forEach((e, idx) => {
        worksheet.addRow({
          sNo: idx + 1,
          entryId: e.entryId,
          date: formatDate(e.date),
          vehicleNo: e.vehicleNo,
          vehicleType: `${e.typeOfVehicle || ''} ${e.modelMake ? `(${e.modelMake})` : ''}`.trim(),
          fuelType: e.fuelType,
          startKm: e.startKm,
          startTime: VehicleMonitoringService.format12HourTime(e.startTime),
          endKm: e.endKm,
          endTime: VehicleMonitoringService.format12HourTime(e.endTime),
          totalDistance: e.totalDistance,
          timeTaken: e.timeTakenFormatted,
          mileage: `${e.mileage} ${e.fuelType === 'Electric' ? 'km/chg' : 'km/L'}`,
          fuelRate: e.fuelRate ?? DEFAULT_FUEL_RATES[e.fuelType],
          amountSpent: e.amountSpent,
          driverName: e.driverName,
          remarks: e.remarks || ''
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
      a.download = `Perla_Vehicle_Daily_Expenses_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting daily vehicle entries to Excel:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Daily Expense &amp; Vehicle Monitor</h2>
          <div className="text-xs text-slate-500 mt-0.5">
            Track daily trip kilometer readings, timings, fuel consumption, and operational expenses
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-9 px-3 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Reload log records"
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
            <span>Add Daily Entry</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Distance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Distance Covered
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.totalDistanceCovered.toLocaleString('en-IN', { maximumFractionDigits: 1 })}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">km</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {metrics.totalEntriesCount}{' '}
            {startDate || endDate || searchQuery || vehicleNoFilter !== 'all'
              ? 'filtered'
              : 'recorded'}{' '}
            {metrics.totalEntriesCount === 1 ? 'trip' : 'trips'}
          </div>
        </div>

        {/* Card 2: Total Amount Spent */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Fuel Expense
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(metrics.totalAmountSpent)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Calculated based on fleet mileage efficiency
          </div>
        </div>

        {/* Card 3: Est. Fuel Consumed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Estimated Fuel Used
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.totalFuelConsumed.toLocaleString('en-IN', { maximumFractionDigits: 1 })}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">Litres / Units</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Total fleet fuel consumption</div>
        </div>

        {/* Card 4: Average Cost per km */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Average Expense / km
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ₹{metrics.avgCostPerKm.toFixed(2)}{' '}
            <span className="text-xs font-bold text-slate-500 font-sans">/ km</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Operational running cost pace</div>
        </div>
      </div>

      {/* Main Grid Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entry #, vehicle, driver, date..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Vehicle No Filter */}
            {vehicles.length > 0 && (
              <select
                value={vehicleNoFilter}
                onChange={(e) => setVehicleNoFilter(e.target.value)}
                className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.vehicleNo}>
                    {v.vehicleNo} ({v.modelMake || v.typeOfVehicle})
                  </option>
                ))}
              </select>
            )}

            {/* Fuel Type Filter */}
            <select
              value={fuelTypeFilter}
              onChange={(e) => setFuelTypeFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Fuel Types</option>
              <option value="Diesel">Diesel</option>
              <option value="Petrol">Petrol</option>
              <option value="Electric">Electric</option>
              <option value="CNG">CNG</option>
            </select>

            {/* Date Range */}
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

            {(searchQuery || vehicleNoFilter !== 'all' || fuelTypeFilter !== 'all' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVehicleNoFilter('all');
                  setFuelTypeFilter('all');
                  setStartDate('');
                  setEndDate('');
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

        {/* Grid Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                {/* S.NO */}
                <th className="py-3 px-3 border-r border-slate-200 text-center whitespace-nowrap w-12">
                  S.NO
                </th>

                {/* DATE */}
                <th
                  onClick={() => handleSort('date')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* VEHICLE NO & FUEL */}
                <th
                  onClick={() => handleSort('vehicleNo')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>VEHICLE NO</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* START KM & TIME */}
                <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                  START KM &amp; TIME
                </th>

                {/* END KM & TIME */}
                <th className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                  END KM &amp; TIME
                </th>

                {/* TOTAL DISTANCE */}
                <th
                  onClick={() => handleSort('totalDistance')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>DISTANCE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* TIME TAKEN */}
                <th className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                  TIME TAKEN
                </th>

                {/* MILEAGE */}
                <th className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                  MILEAGE
                </th>

                {/* AMOUNT SPENT */}
                <th
                  onClick={() => handleSort('amountSpent')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>AMOUNT SPENT</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* DRIVER NAME */}
                <th
                  onClick={() => handleSort('driverName')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>DRIVER NAME</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* ACTIONS */}
                <th className="py-3 px-3.5 text-center whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading Daily Expense &amp; Vehicle Monitor...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-400 italic">
                    No daily vehicle entries found. Click "+ Add Daily Entry" to record a new trip.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, idx) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/70 transition-colors border-b border-slate-200"
                  >
                    {/* S.NO */}
                    <td className="py-3.5 px-3 border-r border-slate-200 align-middle text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>

                    {/* DATE */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle whitespace-nowrap font-medium text-slate-800">
                      <div>{formatDate(entry.date)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{entry.entryId}</div>
                    </td>

                    {/* VEHICLE NO & FUEL BADGE */}
                    <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 tracking-wide">
                          {entry.vehicleNo}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.2 rounded-full text-[9px] font-bold ${
                            entry.fuelType === 'Electric'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : entry.fuelType === 'Petrol'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : entry.fuelType === 'CNG'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {entry.fuelType}
                        </span>
                      </div>
                      {entry.typeOfVehicle && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                          {entry.typeOfVehicle}
                        </div>
                      )}
                    </td>

                    {/* START KM & TIME */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle whitespace-nowrap font-mono">
                      <span className="font-bold text-slate-800">
                        {entry.startKm.toLocaleString('en-IN')} km
                      </span>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {VehicleMonitoringService.format12HourTime(entry.startTime)}
                      </div>
                    </td>

                    {/* END KM & TIME */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle whitespace-nowrap font-mono">
                      <span className="font-bold text-slate-800">
                        {entry.endKm.toLocaleString('en-IN')} km
                      </span>
                      <div className="text-[10px] text-slate-500 font-sans">
                        {VehicleMonitoringService.format12HourTime(entry.endTime)}
                      </div>
                    </td>

                    {/* TOTAL DISTANCE */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      {entry.totalDistance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}{' '}
                      <span className="text-[10px] font-sans font-normal text-slate-400">km</span>
                    </td>

                    {/* TIME TAKEN */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-center whitespace-nowrap font-mono font-semibold text-slate-700">
                      {entry.timeTakenFormatted || '—'}
                    </td>

                    {/* MILEAGE */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-center whitespace-nowrap font-mono text-slate-700">
                      <span>{entry.mileage}</span>{' '}
                      <span className="text-[10px] text-slate-400 font-sans">
                        {entry.fuelType === 'Electric' ? 'km/chg' : 'km/L'}
                      </span>
                    </td>

                    {/* AMOUNT SPENT */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-right whitespace-nowrap font-mono font-bold text-slate-900">
                      {formatCurrency(entry.amountSpent)}
                    </td>

                    {/* DRIVER NAME */}
                    <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle font-medium text-slate-800">
                      <div>{entry.driverName}</div>
                      {entry.remarks && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px] mt-0.5">
                          {entry.remarks}
                        </div>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3.5 px-3.5 align-middle text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(entry)}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
                          title="Edit daily entry"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry)}
                          className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
                          title="Delete entry"
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

      {/* MODAL: Add / Edit Daily Entry */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formSubmitting && setIsModalOpen(false)}
        title={isEditMode ? 'Edit Daily Expense & Trip Entry' : 'New Vehicle Trip & Expense Entry'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          {formError && (
            <div className="p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 shadow-2xs">
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* Section 1: Date & Vehicle Dropdown Menu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Trip Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
            </div>

            {/* Vehicle Dropdown Menu (showing if vehicle is petrol, diesel, electric, etc.) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vehicle No <span className="text-rose-500">*</span>
              </label>
              <select
                value={formVehicleNo}
                onChange={(e) => handleSelectVehicle(e.target.value)}
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs font-mono"
              >
                <option value="">-- Select Fleet Vehicle --</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.vehicleNo}>
                    {v.vehicleNo} • {v.modelMake || v.typeOfVehicle} ({v.fuelType || 'Diesel'} •{' '}
                    {v.mileage || '4.5'}{' '}
                    {v.fuelType === 'Electric' ? 'km/charge' : 'km/L'})
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-slate-400 mt-1">
                Selects vehicle specs, fuel engine, and mileage efficiency
              </div>
            </div>
          </div>

          {/* Section 2: Kilometer Readings & Timings */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/70 pb-3">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>Odometer Readings &amp; Shift Timings</span>
            </span>

            {/* Start Km & Start Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Start Kilometer Reading <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formStartKm}
                    onChange={(e) =>
                      setFormStartKm(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.0"
                    required
                    className="flex-1 h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                  />
                  <span className="w-14 h-11 flex items-center justify-center bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 font-mono">
                    km
                  </span>
                </div>
                {precedingInfo ? (
                  <div className="mt-1.5 text-[11px] text-emerald-700 font-medium">
                    Auto-collected from recent trip: {precedingInfo.endKm} km ({formatDate(precedingInfo.date)})
                  </div>
                ) : (
                  <div className="mt-1.5 text-[11px] text-slate-400">Starting meter reading</div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <div className="mt-1.5 text-[11px] text-slate-400">Trip departure time</div>
              </div>
            </div>

            {/* End Km & End Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-200/50">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  End Kilometer Reading <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={formEndKm}
                    onChange={(e) =>
                      setFormEndKm(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="0.0"
                    required
                    className="flex-1 h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                  />
                  <span className="w-14 h-11 flex items-center justify-center bg-slate-200/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 font-mono">
                    km
                  </span>
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400">
                  Ending meter reading (must be ≥ start km)
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <div className="mt-1.5 text-[11px] text-slate-400">Trip arrival / shift end time</div>
              </div>
            </div>
          </div>

          {/* Section 3: Live Auto Calculations & Expense based on Mileage */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-emerald-400" />
                <span>Calculated Trip Consumption &amp; Expense</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Mileage: {formMileage} {formFuelType === 'Electric' ? 'km/charge' : 'km/L'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Distance Covered
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {liveTotalDistance} <span className="text-xs font-normal text-slate-400">km</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Time Taken
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {liveTimeDifference.formatted}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Est. Fuel Consumed
                </div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {liveFuelConsumed}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    {formFuelType === 'Electric' ? 'units' : 'L'}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Amount Spent
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                  {formatCurrency(liveAmountSpent)}
                </div>
              </div>
            </div>

            {/* Custom Fuel Price Override if needed */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Fuel Engine: <strong className="text-slate-200">{formFuelType}</strong> • Fuel Rate:{' '}
                <strong className="text-slate-200 font-mono">₹{formFuelRate.toFixed(2)}</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Formula: ({liveTotalDistance} km ÷ {formMileage}) × ₹{formFuelRate}
              </span>
            </div>
          </div>

          {/* Section 4: Driver Name (Auto-fetched, Admin can edit) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Driver Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formDriverName}
                onChange={(e) => setFormDriverName(e.target.value)}
                disabled={!userIsAdmin}
                required
                className={`w-full h-11 border rounded-xl px-3.5 text-xs font-semibold ${
                  userIsAdmin
                    ? 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-[#1F4E79]'
                    : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                }`}
              />
              <div className="text-[11px] text-slate-400 mt-1">
                {userIsAdmin
                  ? 'Auto-collected from user profile (Admin can edit)'
                  : 'Auto-collected from user profile (Editable only by Admin)'}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Remarks / Route Notes (Optional)
              </label>
              <input
                type="text"
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                placeholder="e.g. Warehouse delivery, factory pickup..."
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Modal Footer (No 'Stored in Firebase' label) */}
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
              disabled={formSubmitting}
              className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {formSubmitting
                ? 'Saving...'
                : isEditMode
                ? 'Update Daily Entry'
                : 'Save Daily Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
