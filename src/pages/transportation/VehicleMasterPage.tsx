import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  VehicleRecord,
  CreateVehiclePayload,
  UpdateVehiclePayload,
  VehicleStatus,
  VehicleFuelType
} from '../../types/vehicle';
import { VehicleService } from '../../services/vehicleService';
import { DailyExpenseMonitorSection } from './DailyExpenseMonitorSection';
import { Modal } from '../../components/ui/Modal';
import { LoadingOverlay } from '../../components/ui/LoadingOverlay';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../components/ui/TableMaximizeWrapper';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  ShieldAlert,
  Fuel,
  Zap,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw
} from 'lucide-react';
import ExcelJS from 'exceljs';

// Pre-seeded vehicle matching user screenshot if database is empty
const INITIAL_DEMO_VEHICLE: VehicleRecord = {
  id: 'veh_demo_01',
  vehicleNo: 'TN87H9298',
  typeOfVehicle: 'NEW TIPPER 12 WHEEL',
  modelMake: 'TATA',
  fuelType: 'Diesel',
  mileage: '4.5',
  purchaseYear: 2026,
  fcDueDate: '2028-08-04',
  insuranceDueDate: '2027-03-02',
  ownerType: 'Own',
  status: 'Active',
  driverName: 'K. Murugan',
  driverPhone: '98401 23456',
  remarks: 'Primary heavy factory tipper for raw material handling',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  createdBy: 'system',
  createdByName: 'Admin'
};

type SortField =
  | 'vehicleNo'
  | 'typeOfVehicle'
  | 'modelMake'
  | 'fuelType'
  | 'mileage'
  | 'purchaseYear'
  | 'fcDueDate'
  | 'insuranceDueDate';
type SortDirection = 'asc' | 'desc';

export const VehicleMasterPage: React.FC = () => {
  const { user } = useAuth();

  // Active Section Tab: 'daily_monitor' (Daily Expense & Vehicle Monitor) or 'vehicles' (Vehicle Master)
  const [activeSection, setActiveSection] = useState<'daily_monitor' | 'vehicles'>('daily_monitor');

  // Data State
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(() => {
    const cached = VehicleService.getCache();
    return cached.length > 0 ? cached : [INITIAL_DEMO_VEHICLE];
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Sorting & Table Controls State
  const [sortField, setSortField] = useState<string | null>('vehicleNo');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('asc');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<{
    vehicleNo?: string;
    typeOfVehicle?: string;
    modelMake?: string;
    fuelType?: string;
    mileage?: string;
    purchaseYear?: string;
    fcDueDate?: string;
    insuranceDueDate?: string;
    status?: string;
  }>({});

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
      statusFilter !== 'all' ||
      typeFilter !== 'all' ||
      fuelFilter !== 'all' ||
      activeColumnFilterCount > 0 ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, statusFilter, typeFilter, fuelFilter, activeColumnFilterCount, sortField, sortDirection]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setStatusFilter('all');
    setTypeFilter('all');
    setFuelFilter('all');
    setColumnFilters({});
    setSortField(null);
    setSortDirection('normal');
  };

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formVehicleNo, setFormVehicleNo] = useState('');
  const [formTypeOfVehicle, setFormTypeOfVehicle] = useState('');
  const [formModelMake, setFormModelMake] = useState('TATA');
  const [formFuelType, setFormFuelType] = useState<VehicleFuelType>('Diesel');
  const [formMileage, setFormMileage] = useState<string>('4.5');
  const [formPurchaseYear, setFormPurchaseYear] = useState<number | string>(
    new Date().getFullYear()
  );
  const [formFcDueDate, setFormFcDueDate] = useState('');
  const [formInsuranceDueDate, setFormInsuranceDueDate] = useState('');
  const [formOwnerType, setFormOwnerType] = useState<'Own' | 'Attached' | 'Market'>('Own');
  const [formDriverName, setFormDriverName] = useState('');
  const [formDriverPhone, setFormDriverPhone] = useState('');
  const [formStatus, setFormStatus] = useState<VehicleStatus>('Active');
  const [formRemarks, setFormRemarks] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load data from Firestore / Cache
  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await VehicleService.getVehicles();
      if (data.length > 0) {
        setVehicles(data);
      } else {
        // Pre-seed initial demo if nothing exists in cache/firestore
        setVehicles([INITIAL_DEMO_VEHICLE]);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered & Sorted Vehicles
  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];

    if (statusFilter !== 'all') {
      result = result.filter((v) => v.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      result = result.filter(
        (v) => (v.typeOfVehicle || '').toLowerCase() === typeFilter.toLowerCase()
      );
    }

    if (fuelFilter !== 'all') {
      result = result.filter(
        (v) => (v.fuelType || 'Diesel').toLowerCase() === fuelFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((v) => {
        if (searchColumn === 'vehicleNo') return (v.vehicleNo || '').toLowerCase().includes(q);
        if (searchColumn === 'typeOfVehicle') return (v.typeOfVehicle || '').toLowerCase().includes(q);
        if (searchColumn === 'modelMake') return (v.modelMake || '').toLowerCase().includes(q);
        if (searchColumn === 'fuelType') return (v.fuelType || '').toLowerCase().includes(q);
        if (searchColumn === 'mileage') return String(v.mileage || '').toLowerCase().includes(q);
        if (searchColumn === 'purchaseYear') return String(v.purchaseYear).includes(q);
        if (searchColumn === 'status') return (v.status || '').toLowerCase().includes(q);
        if (searchColumn === 'driverName') return (v.driverName || '').toLowerCase().includes(q);
        // ALL
        return (
          (v.vehicleNo || '').toLowerCase().includes(q) ||
          (v.typeOfVehicle || '').toLowerCase().includes(q) ||
          (v.modelMake || '').toLowerCase().includes(q) ||
          (v.fuelType || '').toLowerCase().includes(q) ||
          String(v.mileage || '').toLowerCase().includes(q) ||
          String(v.purchaseYear).includes(q) ||
          (v.driverName || '').toLowerCase().includes(q) ||
          (v.driverPhone || '').includes(q) ||
          (v.remarks || '').toLowerCase().includes(q)
        );
      });
    }

    // Column Filters
    if (columnFilters.vehicleNo?.trim()) {
      const f = columnFilters.vehicleNo.trim().toLowerCase();
      result = result.filter((v) => (v.vehicleNo || '').toLowerCase().includes(f));
    }
    if (columnFilters.typeOfVehicle?.trim()) {
      const f = columnFilters.typeOfVehicle.trim().toLowerCase();
      result = result.filter((v) => (v.typeOfVehicle || '').toLowerCase().includes(f));
    }
    if (columnFilters.modelMake?.trim()) {
      const f = columnFilters.modelMake.trim().toLowerCase();
      result = result.filter((v) => (v.modelMake || '').toLowerCase().includes(f));
    }
    if (columnFilters.fuelType?.trim()) {
      const f = columnFilters.fuelType.trim().toLowerCase();
      result = result.filter((v) => (v.fuelType || '').toLowerCase().includes(f));
    }
    if (columnFilters.mileage?.trim()) {
      const f = columnFilters.mileage.trim().toLowerCase();
      result = result.filter((v) => String(v.mileage || '').toLowerCase().includes(f));
    }
    if (columnFilters.purchaseYear?.trim()) {
      const f = columnFilters.purchaseYear.trim();
      result = result.filter((v) => String(v.purchaseYear).includes(f));
    }
    if (columnFilters.fcDueDate?.trim()) {
      const f = columnFilters.fcDueDate.trim().toLowerCase();
      result = result.filter((v) => (v.fcDueDate || '').toLowerCase().includes(f) || VehicleService.formatDisplayDate(v.fcDueDate).toLowerCase().includes(f));
    }
    if (columnFilters.insuranceDueDate?.trim()) {
      const f = columnFilters.insuranceDueDate.trim().toLowerCase();
      result = result.filter((v) => (v.insuranceDueDate || '').toLowerCase().includes(f) || VehicleService.formatDisplayDate(v.insuranceDueDate).toLowerCase().includes(f));
    }
    if (columnFilters.status?.trim()) {
      const f = columnFilters.status.trim().toLowerCase();
      result = result.filter((v) => (v.status || '').toLowerCase().includes(f));
    }

    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        if (sortField === 'mileage') {
          const numA = parseFloat(String(a.mileage || 0)) || 0;
          const numB = parseFloat(String(b.mileage || 0)) || 0;
          if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
          if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }

        let valA: any = (a as any)[sortField] || '';
        let valB: any = (b as any)[sortField] || '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [vehicles, statusFilter, typeFilter, fuelFilter, searchQuery, searchColumn, columnFilters, sortField, sortDirection]);

  // Overall Fleet Metrics
  const metrics = useMemo(() => {
    const totalVehicles = vehicles.length;
    let activeVehicles = 0;
    let fcDueCount = 0;
    let insDueCount = 0;

    vehicles.forEach((v) => {
      if (v.status === 'Active') activeVehicles++;

      const fcStatus = VehicleService.getDueStatus(v.fcDueDate);
      if (fcStatus.status === 'expired' || fcStatus.status === 'due-soon') {
        fcDueCount++;
      }

      const insStatus = VehicleService.getDueStatus(v.insuranceDueDate);
      if (insStatus.status === 'expired' || insStatus.status === 'due-soon') {
        insDueCount++;
      }
    });

    return {
      totalVehicles,
      activeVehicles,
      fcDueCount,
      insDueCount
    };
  }, [vehicles]);

  // Unique Vehicle Types for Filter Dropdown
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.typeOfVehicle) set.add(v.typeOfVehicle.toUpperCase());
    });
    return Array.from(set).sort();
  }, [vehicles]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormVehicleNo('');
    setFormTypeOfVehicle('NEW TIPPER 12 WHEEL');
    setFormModelMake('TATA');
    setFormFuelType('Diesel');
    setFormMileage('4.5');
    setFormPurchaseYear(new Date().getFullYear());
    setFormFcDueDate('');
    setFormInsuranceDueDate('');
    setFormOwnerType('Own');
    setFormDriverName('');
    setFormDriverPhone('');
    setFormStatus('Active');
    setFormRemarks('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (vehicle: VehicleRecord) => {
    setIsEditMode(true);
    setEditingId(vehicle.id);
    setFormVehicleNo(vehicle.vehicleNo);
    setFormTypeOfVehicle(vehicle.typeOfVehicle);
    setFormModelMake(vehicle.modelMake);
    setFormFuelType(vehicle.fuelType || 'Diesel');
    setFormMileage(
      vehicle.mileage !== undefined && vehicle.mileage !== null ? String(vehicle.mileage) : ''
    );
    setFormPurchaseYear(vehicle.purchaseYear);
    setFormFcDueDate(vehicle.fcDueDate || '');
    setFormInsuranceDueDate(vehicle.insuranceDueDate || '');
    setFormOwnerType(vehicle.ownerType || 'Own');
    setFormDriverName(vehicle.driverName || '');
    setFormDriverPhone(vehicle.driverPhone || '');
    setFormStatus(vehicle.status || 'Active');
    setFormRemarks(vehicle.remarks || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Add or Edit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanNo = formVehicleNo.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanNo) {
      setFormError('Please enter a valid vehicle number (e.g. TN87H9298).');
      return;
    }

    if (!formTypeOfVehicle.trim()) {
      setFormError('Please enter the type of vehicle (e.g. NEW TIPPER 12 WHEEL).');
      return;
    }

    if (!formModelMake.trim()) {
      setFormError('Please enter the vehicle model / make (e.g. TATA).');
      return;
    }

    if (!formPurchaseYear) {
      setFormError('Please enter the purchase year.');
      return;
    }

    if (!formFcDueDate) {
      setFormError('Please specify the FC (Fitness Certificate) due date.');
      return;
    }

    if (!formInsuranceDueDate) {
      setFormError('Please specify the Insurance due date.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const payload: CreateVehiclePayload = {
        vehicleNo: cleanNo,
        typeOfVehicle: formTypeOfVehicle.trim().toUpperCase(),
        modelMake: formModelMake.trim().toUpperCase(),
        fuelType: formFuelType,
        mileage: formMileage.trim() || undefined,
        purchaseYear: formPurchaseYear,
        fcDueDate: formFcDueDate,
        insuranceDueDate: formInsuranceDueDate,
        ownerType: formOwnerType,
        driverName: formDriverName.trim() || undefined,
        driverPhone: formDriverPhone.trim() || undefined,
        status: formStatus,
        remarks: formRemarks.trim() || undefined
      };

      if (isEditMode && editingId) {
        const updated = await VehicleService.updateVehicle(editingId, payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User'
        });
        setVehicles((prev) => prev.map((v) => (v.id === editingId ? updated : v)));
      } else {
        const created = await VehicleService.createVehicle(payload, {
          uid: user?.uid || 'user-1',
          displayName: user?.displayName || user?.email || 'Authorized User'
        });
        setVehicles((prev) => [created, ...prev.filter((v) => v.id !== created.id)]);
      }

      setIsModalOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error('Error saving vehicle:', err);
      setFormError(err?.message || 'Failed to save vehicle.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Vehicle
  const handleDeleteVehicle = async (vehicle: VehicleRecord) => {
    const confirm = window.confirm(
      `Are you sure you want to remove vehicle "${vehicle.vehicleNo}" (${vehicle.typeOfVehicle}) from Vehicle Master?`
    );
    if (!confirm) return;

    try {
      await VehicleService.deleteVehicle(vehicle.id);
      setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
    } catch (err: any) {
      alert(`Error deleting vehicle: ${err?.message || 'Operation failed'}`);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Vehicle Master');

      worksheet.columns = [
        { header: 'S.No.', key: 'sNo', width: 8 },
        { header: 'VEHICLE NO', key: 'vehicleNo', width: 18 },
        { header: 'TYPE OF VEHICLE', key: 'typeOfVehicle', width: 26 },
        { header: 'MODEL / MAKE', key: 'modelMake', width: 18 },
        { header: 'FUEL TYPE', key: 'fuelType', width: 14 },
        { header: 'MILEAGE', key: 'mileage', width: 16 },
        { header: 'PURCHASE YEAR', key: 'purchaseYear', width: 16 },
        { header: 'FC DUE DATE', key: 'fcDueDate', width: 16 },
        { header: 'INS. DUE DATE', key: 'insuranceDueDate', width: 16 },
        { header: 'OWNERSHIP', key: 'ownerType', width: 14 },
        { header: 'DRIVER NAME', key: 'driverName', width: 20 },
        { header: 'DRIVER PHONE', key: 'driverPhone', width: 18 },
        { header: 'STATUS', key: 'status', width: 14 },
        { header: 'REMARKS', key: 'remarks', width: 28 }
      ];

      filteredVehicles.forEach((v, idx) => {
        worksheet.addRow({
          sNo: idx + 1,
          vehicleNo: v.vehicleNo,
          typeOfVehicle: v.typeOfVehicle,
          modelMake: v.modelMake,
          fuelType: v.fuelType || 'Diesel',
          mileage:
            v.mileage !== undefined && v.mileage !== null && String(v.mileage).trim() !== ''
              ? `${v.mileage} ${v.fuelType === 'Electric' ? 'km/charge' : 'km/L'}`
              : '—',
          purchaseYear: v.purchaseYear,
          fcDueDate: VehicleService.formatDisplayDate(v.fcDueDate),
          insuranceDueDate: VehicleService.formatDisplayDate(v.insuranceDueDate),
          ownerType: v.ownerType || 'Own',
          driverName: v.driverName || '—',
          driverPhone: v.driverPhone || '—',
          status: v.status,
          remarks: v.remarks || ''
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
      a.download = `Perla_Vehicle_Master_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting vehicles Excel:', err);
    }
  };

  // Render section selection tabs row (Daily Expense & Vehicle Monitor vs Vehicle Master)
  const tabsRow = (
    <div className="flex items-center gap-8 border-b border-slate-200/90 px-1 pt-1">
      <button
        onClick={() => setActiveSection('daily_monitor')}
        className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
          activeSection === 'daily_monitor'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >
      
        <span>Daily Expense &amp; Vehicle Monitor</span>
      </button>

      <button
        onClick={() => setActiveSection('vehicles')}
        className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
          activeSection === 'vehicles'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
        }`}
      >

             <span>Vehicle Master</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {activeSection === 'daily_monitor' ? (
        <DailyExpenseMonitorSection vehicles={vehicles} tabsSlot={tabsRow} />
      ) : (
        <>
          {/* Top Header - Minimal & Airy */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vehicle Master</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Register factory transport vehicles, track mileage, purchase history, and renewal due dates
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                title="Reload fleet records"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Reload</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                title="Export Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

      {/* Fleet KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Fleet */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Fleet Vehicles
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {metrics.totalVehicles}
          </div>
          <div className="text-xs text-slate-400 mt-1">Vehicles registered in system</div>
        </div>

        {/* Card 2: Active Vehicles */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Active in Service
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {metrics.activeVehicles}
          </div>
          <div className="text-xs text-slate-400 mt-1">Available for factory transportation</div>
        </div>

        {/* Card 3: FC Renewals Due */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span>FC Renewals Due</span>
            {metrics.fcDueCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <div
            className={`text-2xl font-bold mt-2 font-mono ${
              metrics.fcDueCount > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {metrics.fcDueCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">Fitness certificate renewal alert</div>
        </div>

        {/* Card 4: Insurance Renewals Due */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span>Insurance Renewals Due</span>
            {metrics.insDueCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <div
            className={`text-2xl font-bold mt-2 font-mono ${
              metrics.insDueCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {metrics.insDueCount}
          </div>
          <div className="text-xs text-slate-400 mt-1">Due within 30 days or expired</div>
        </div>
      </div>

      {/* SECTION TABS ROW: Positioned below KPI cards and above table */}
      {tabsRow}

      {/* Main Grid Table Card */}
      <TableMaximizeWrapper
        title="Vehicle Master & Fleet Management"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredVehicles.length} Vehicles
          </span>
        }
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Left: Search with Column Selector & Column Filters Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 w-full sm:w-auto">
              <div className="relative bg-slate-50 border-r border-slate-200 shrink-0">
                <select
                  value={searchColumn}
                  onChange={(e) => setSearchColumn(e.target.value)}
                  className="h-9 pl-3 pr-7 bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none"
                  title="Select column to search in"
                >
                  <option value="ALL">All Columns</option>
                  <option value="vehicleNo">Vehicle No</option>
                  <option value="typeOfVehicle">Type</option>
                  <option value="modelMake">Model / Make</option>
                  <option value="fuelType">Fuel Type</option>
                  <option value="mileage">Mileage</option>
                  <option value="purchaseYear">Year</option>
                  <option value="status">Status</option>
                  <option value="driverName">Driver</option>
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

          {/* Dropdown Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            {availableTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Vehicle Types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Fuel Type Filter */}
            <select
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Fuel Types</option>
              <option value="Diesel">Diesel</option>
              <option value="Petrol">Petrol</option>
              <option value="Electric">Electric</option>
              <option value="CNG">CNG</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition ml-auto cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Vehicle</span>
            </button>
          </div>
        </div>

        {/* Grid Table with Sticky Headers & Inline Column Filters */}
        <div data-table-scroll="true" className="max-h-[620px] overflow-auto relative border border-slate-300 rounded-b-2xl">
          <table className="w-full text-left text-xs border-collapse border border-slate-300">
            <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <tr className="bg-[#EEF5FB] border-b-2 border-slate-300 text-[#1F4E79] font-bold uppercase tracking-wider text-[11px]">
                {/* VEHICLE NO */}
                <th
                  onClick={() => handleSort('vehicleNo')}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>VEHICLE NO</span>
                    {renderSortIcon('vehicleNo')}
                  </div>
                </th>

                {/* TYPE OF VEHICLE */}
                <th
                  onClick={() => handleSort('typeOfVehicle')}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>TYPE OF VEHICLE</span>
                    {renderSortIcon('typeOfVehicle')}
                  </div>
                </th>

                {/* MODEL / MAKE */}
                <th
                  onClick={() => handleSort('modelMake')}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>MODEL / MAKE</span>
                    {renderSortIcon('modelMake')}
                  </div>
                </th>

                {/* FUEL TYPE */}
                <th
                  onClick={() => handleSort('fuelType')}
                  className="py-3 px-3.5 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap text-center sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>FUEL TYPE</span>
                    {renderSortIcon('fuelType')}
                  </div>
                </th>

                {/* MILEAGE */}
                <th
                  onClick={() => handleSort('mileage', true)}
                  className="py-3 px-3.5 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap text-center sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>MILEAGE</span>
                    {renderSortIcon('mileage')}
                  </div>
                </th>

                {/* PURCHASE YEAR */}
                <th
                  onClick={() => handleSort('purchaseYear', true)}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap text-center sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>PURCHASE YEAR</span>
                    {renderSortIcon('purchaseYear')}
                  </div>
                </th>

                {/* FC DUE DATE */}
                <th
                  onClick={() => handleSort('fcDueDate', true)}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>FC DUE DATE</span>
                    {renderSortIcon('fcDueDate')}
                  </div>
                </th>

                {/* INS. DUE DATE */}
                <th
                  onClick={() => handleSort('insuranceDueDate', true)}
                  className="py-3 px-4 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>INS. DUE DATE</span>
                    {renderSortIcon('insuranceDueDate')}
                  </div>
                </th>

                {/* STATUS */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3.5 border-r border-slate-300 cursor-pointer select-none hover:bg-[#DCE9F5] transition whitespace-nowrap text-center sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79]"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>STATUS</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* ACTION */}
                <th className="py-3 px-3.5 text-left whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] min-w-[130px] pr-12">
                  ACTIONS
                </th>
              </tr>

              {/* Inline Column Filter Inputs Row */}
              {showColumnFilters && (
                <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter vehicle no..."
                      value={columnFilters.vehicleNo || ''}
                      onChange={(e) => handleColumnFilterChange('vehicleNo', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter type..."
                      value={columnFilters.typeOfVehicle || ''}
                      onChange={(e) => handleColumnFilterChange('typeOfVehicle', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter model..."
                      value={columnFilters.modelMake || ''}
                      onChange={(e) => handleColumnFilterChange('modelMake', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Filter fuel..."
                      value={columnFilters.fuelType || ''}
                      onChange={(e) => handleColumnFilterChange('fuelType', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Mileage..."
                      value={columnFilters.mileage || ''}
                      onChange={(e) => handleColumnFilterChange('mileage', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Year..."
                      value={columnFilters.purchaseYear || ''}
                      onChange={(e) => handleColumnFilterChange('purchaseYear', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="FC due..."
                      value={columnFilters.fcDueDate || ''}
                      onChange={(e) => handleColumnFilterChange('fcDueDate', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Ins. due..."
                      value={columnFilters.insuranceDueDate || ''}
                      onChange={(e) => handleColumnFilterChange('insuranceDueDate', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal font-mono"
                    />
                  </th>
                  <th className="p-1 border-r border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center">
                    <input
                      type="text"
                      placeholder="Status..."
                      value={columnFilters.status || ''}
                      onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                      className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 font-normal text-center"
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
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading Vehicle Master...
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-400">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-slate-700 text-sm">No vehicles found</p>
                      <p className="text-slate-400 text-xs">
                        {hasAnyFilter
                          ? 'No vehicles match your active search or filter criteria.'
                          : 'No fleet vehicles registered yet. Click "+ Add Vehicle" to add one.'}
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
                filteredVehicles.map((vehicle) => {
                  const fcStatus = VehicleService.getDueStatus(vehicle.fcDueDate);
                  const insStatus = VehicleService.getDueStatus(vehicle.insuranceDueDate);

                  return (
                    <tr
                      key={vehicle.id}
                      className="hover:bg-slate-50/70 transition-colors border-b border-slate-200"
                    >
                      {/* VEHICLE NO */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap font-mono font-bold text-slate-900 tracking-wide">
                        {vehicle.vehicleNo}
                      </td>

                      {/* TYPE OF VEHICLE */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap text-slate-800 font-semibold uppercase">
                        {vehicle.typeOfVehicle}
                      </td>

                      {/* MODEL / MAKE */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap text-slate-700 font-semibold uppercase">
                        {vehicle.modelMake}
                      </td>

                      {/* FUEL TYPE (Electric, Petrol, Diesel, CNG) */}
                      <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            vehicle.fuelType === 'Electric'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : vehicle.fuelType === 'Petrol'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : vehicle.fuelType === 'CNG'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {vehicle.fuelType || 'Diesel'}
                        </span>
                      </td>

                      {/* MILEAGE */}
                      <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-center whitespace-nowrap font-mono text-slate-800 font-semibold">
                        {vehicle.mileage !== undefined &&
                        vehicle.mileage !== null &&
                        String(vehicle.mileage).trim() !== '' ? (
                          <span className="inline-flex items-baseline gap-1">
                            <span>{vehicle.mileage}</span>
                            <span className="text-[10px] font-sans font-normal text-slate-500">
                              {vehicle.fuelType === 'Electric' ? 'km/chg' : 'km/L'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* PURCHASE YEAR */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle text-center font-mono text-slate-800 font-semibold">
                        {vehicle.purchaseYear}
                      </td>

                      {/* FC DUE DATE (DD-MM-YYYY format matching screenshot) */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{VehicleService.formatDisplayDate(vehicle.fcDueDate)}</span>
                          {fcStatus.status === 'expired' && (
                            <span
                              title={fcStatus.label}
                              className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[9px] font-bold rounded"
                            >
                              Expired
                            </span>
                          )}
                          {fcStatus.status === 'due-soon' && (
                            <span
                              title={fcStatus.label}
                              className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded"
                            >
                              Due Soon
                            </span>
                          )}
                        </div>
                      </td>

                      {/* INS. DUE DATE (DD-MM-YYYY format matching screenshot) */}
                      <td className="py-3.5 px-4 border-r border-slate-200 align-middle whitespace-nowrap font-mono font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span>{VehicleService.formatDisplayDate(vehicle.insuranceDueDate)}</span>
                          {insStatus.status === 'expired' && (
                            <span
                              title={insStatus.label}
                              className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[9px] font-bold rounded"
                            >
                              Expired
                            </span>
                          )}
                          {insStatus.status === 'due-soon' && (
                            <span
                              title={insStatus.label}
                              className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded"
                            >
                              Due Soon
                            </span>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-3.5 border-r border-slate-200 align-middle text-center whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            vehicle.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : vehicle.status === 'Under Maintenance'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {vehicle.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-3.5 align-middle text-left whitespace-nowrap">
                        <div className="flex items-center justify-start gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(vehicle)}
                            className="px-2.5 py-1 rounded text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                            title="Edit vehicle details"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle)}
                            className="px-2.5 py-1 rounded text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                            title="Remove vehicle from master"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <TableTotalsFooter
              cells={[
                { colSpan: 10, label: `TOTAL (${filteredVehicles.length} vehicles)` }
              ]}
            />
          </table>
        </div>

        {/* Informative Table Controls Footer - All data in one stretch */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing all <strong>{filteredVehicles.length}</strong> vehicles in one stretch
            {filteredVehicles.length !== vehicles.length && ` (filtered from ${vehicles.length} total)`}
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

      {/* MODAL: Add / Edit Vehicle */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !formSubmitting && setIsModalOpen(false)}
        title={isEditMode ? 'Edit Vehicle Details' : 'Add New Vehicle to Master'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          {formError && (
            <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          {/* Section 1: Core Vehicle Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Vehicle Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Vehicle No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formVehicleNo}
                onChange={(e) => setFormVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. TN87H9298"
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs uppercase"
              />
              <div className="text-[11px] text-slate-400 mt-1">
                Official registration number (e.g. TN87H9298)
              </div>
            </div>

            {/* Type of Vehicle */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Type of Vehicle <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="vehicle-type-suggestions"
                value={formTypeOfVehicle}
                onChange={(e) => setFormTypeOfVehicle(e.target.value.toUpperCase())}
                placeholder="e.g. NEW TIPPER 12 WHEEL"
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs uppercase"
              />
              <datalist id="vehicle-type-suggestions">
                <option value="NEW TIPPER 12 WHEEL" />
                <option value="TATA ACE" />
                <option value="EICHER 14FT" />
                <option value="CONTAINER TRUCK 20FT" />
                <option value="CONTAINER TRUCK 40FT" />
                <option value="TRACTOR TRAILER" />
                <option value="MINI TRUCK" />
                <option value="BOLERO PICKUP" />
              </datalist>
            </div>

            {/* Model / Make */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Model / Make <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                list="vehicle-make-suggestions"
                value={formModelMake}
                onChange={(e) => setFormModelMake(e.target.value.toUpperCase())}
                placeholder="e.g. TATA"
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs uppercase"
              />
              <datalist id="vehicle-make-suggestions">
                <option value="TATA" />
                <option value="ASHOK LEYLAND" />
                <option value="MAHINDRA" />
                <option value="EICHER" />
                <option value="BHARATBENZ" />
                <option value="FORCE MOTORS" />
              </datalist>
            </div>

            {/* Purchase Year */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Purchase Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1990"
                max={new Date().getFullYear() + 1}
                value={formPurchaseYear}
                onChange={(e) => setFormPurchaseYear(e.target.value)}
                placeholder="2026"
                required
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
            </div>

            {/* Fuel Type (Electric, Petrol, Diesel, CNG) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Fuel Type <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Diesel', 'Petrol', 'Electric', 'CNG'] as VehicleFuelType[]).map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setFormFuelType(ft)}
                    className={`h-11 rounded-xl text-xs font-bold transition flex items-center justify-center border cursor-pointer ${
                      formFuelType === ft
                        ? ft === 'Electric'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : ft === 'Petrol'
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : ft === 'CNG'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {ft}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Vehicle power engine: Electric, Petrol, Diesel, or CNG
              </div>
            </div>

            {/* Mileage / Fuel Efficiency */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mileage / Efficiency
              </label>
              <div className="relative flex">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formMileage}
                  onChange={(e) => setFormMileage(e.target.value)}
                  placeholder={formFuelType === 'Electric' ? 'e.g. 150' : 'e.g. 4.5'}
                  className="w-full h-11 bg-white border border-slate-300 rounded-l-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <span className="inline-flex items-center px-3.5 rounded-r-xl border border-l-0 border-slate-300 bg-slate-100 text-slate-600 text-xs font-semibold whitespace-nowrap">
                  {formFuelType === 'Electric' ? 'km / charge' : 'km / L'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {formFuelType === 'Electric'
                  ? 'Estimated distance per full battery charge'
                  : 'Average fuel efficiency in kilometres per litre'}
              </div>
            </div>
          </div>

          {/* Section 2: Statutory Compliance Due Dates */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/70 pb-3">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Statutory Due Dates &amp; Compliance</span>
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* FC Due Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  FC Due Date (Fitness Certificate) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formFcDueDate}
                  onChange={(e) => setFormFcDueDate(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Format in table: DD-MM-YYYY (e.g. 04-08-2028)
                </div>
              </div>

              {/* Insurance Due Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  INS. Due Date (Insurance) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formInsuranceDueDate}
                  onChange={(e) => setFormInsuranceDueDate(e.target.value)}
                  required
                  className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Format in table: DD-MM-YYYY (e.g. 02-03-2027)
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Driver & Operational Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as VehicleStatus)}
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              >
                <option value="Active">Active</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ownership Type
              </label>
              <select
                value={formOwnerType}
                onChange={(e) => setFormOwnerType(e.target.value as any)}
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              >
                <option value="Own">Own Vehicle</option>
                <option value="Attached">Attached / Contract</option>
                <option value="Market">Market Vehicle</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Driver Name (Optional)
              </label>
              <input
                type="text"
                value={formDriverName}
                onChange={(e) => setFormDriverName(e.target.value)}
                placeholder="Driver name"
                className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#1F4E79] focus:outline-none transition shadow-2xs"
              />
            </div>
          </div>

          {/* Section 4: Remarks */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Remarks / Notes
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="Optional notes regarding vehicle permit, tyre conditions, or route assignment..."
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
              disabled={formSubmitting}
              className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{isEditMode ? 'Update Vehicle' : 'Save Vehicle'}</span>
                </>
              )}
            </button>
          </div>
        </form>

        <LoadingOverlay
          isOpen={formSubmitting}
          title={isEditMode ? 'Updating Vehicle Details...' : 'Registering Vehicle Master...'}
          message="Saving vehicle registration, maintenance cycle, and transport logs..."
        />
      </Modal>
        </>
      )}
    </div>
  );
};
