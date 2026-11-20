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
import { Modal } from '../../components/ui/Modal';
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
  Zap
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

  // Data State
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(() => {
    const cached = VehicleService.getCache();
    return cached.length > 0 ? cached : [INITIAL_DEMO_VEHICLE];
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('vehicleNo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');

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

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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

    result.sort((a, b) => {
      if (sortField === 'mileage') {
        const numA = parseFloat(String(a.mileage || 0)) || 0;
        const numB = parseFloat(String(b.mileage || 0)) || 0;
        if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
        if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      let valA: any = a[sortField] || '';
      let valB: any = b[sortField] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [vehicles, statusFilter, typeFilter, fuelFilter, searchQuery, sortField, sortDirection]);

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

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vehicle Master</h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="h-9 px-3 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
            title="Reload fleet records"
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
            <span>Add Vehicle</span>
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
              placeholder="Search vehicle no, model, type..."
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

            {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || fuelFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setFuelFilter('all');
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

        {/* Grid Table matching exact user requested attributes from screenshot */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                {/* VEHICLE NO */}
                <th
                  onClick={() => handleSort('vehicleNo')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>VEHICLE NO</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* TYPE OF VEHICLE */}
                <th
                  onClick={() => handleSort('typeOfVehicle')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>TYPE OF VEHICLE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* MODEL / MAKE */}
                <th
                  onClick={() => handleSort('modelMake')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>MODEL / MAKE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* FUEL TYPE */}
                <th
                  onClick={() => handleSort('fuelType')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>FUEL TYPE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* MILEAGE */}
                <th
                  onClick={() => handleSort('mileage')}
                  className="py-3 px-3.5 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>MILEAGE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* PURCHASE YEAR */}
                <th
                  onClick={() => handleSort('purchaseYear')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap text-center"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>PURCHASE YEAR</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* FC DUE DATE */}
                <th
                  onClick={() => handleSort('fcDueDate')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>FC DUE DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* INS. DUE DATE */}
                <th
                  onClick={() => handleSort('insuranceDueDate')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer select-none hover:bg-slate-100 transition whitespace-nowrap"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>INS. DUE DATE</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                {/* STATUS */}
                <th className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                  STATUS
                </th>

                {/* ACTION */}
                <th className="py-3 px-3.5 text-center whitespace-nowrap">
                  ACTIONS
                </th>
              </tr>
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
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-400 italic">
                    No vehicles found. Click "+ Add Vehicle" to add a new fleet vehicle.
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
                      <td className="py-3.5 px-3.5 align-middle text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(vehicle)}
                            className="px-2 py-1 rounded text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer flex items-center gap-1"
                            title="Edit vehicle details"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle)}
                            className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer flex items-center gap-1"
                            title="Remove vehicle from master"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 hidden sm:inline-flex items-center gap-1.5">
              Stored securely in Firebase Firestore
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
                className="h-10 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {formSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Firebase...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isEditMode ? 'Update Vehicle' : 'Save Vehicle'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
