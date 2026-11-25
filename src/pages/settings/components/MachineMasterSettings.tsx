import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  X,
  SlidersHorizontal,
  RotateCcw,
  Package,
  Factory,
  Flame,
  Droplets,
  Wind
} from 'lucide-react';
import { MachineItem, MachineProcessType } from '../../../types/machineMaster';
import { MachineMasterService } from '../../../services/machineMasterService';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Card } from '../../../components/ui/Card';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../../components/ui/TableMaximizeWrapper';

export type MachineSortField =
  | 'machineId'
  | 'name'
  | 'modelYear'
  | 'processType'
  | 'capacity'
  | 'status';

export type SortDirection = 'asc' | 'desc' | null;

interface MachineMasterSettingsProps {
  currentUserId: string;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

const MACHINE_SEARCH_COLUMNS = [
  { value: 'ALL', label: 'All Columns' },
  { value: 'machineId', label: 'Machine ID' },
  { value: 'name', label: 'Machine Name' },
  { value: 'modelYear', label: 'Model Year' },
  { value: 'processType', label: 'Machine Used For' },
  { value: 'capacity', label: 'Capacity' },
  { value: 'status', label: 'Status' }
];

const STANDARD_PROCESS_OPTIONS: { value: string; label: string; icon?: React.ReactNode }[] = [
  { value: 'Dyeing', label: 'Dyeing' },
  { value: 'Washing', label: 'Washing' },
  { value: 'Boiler', label: 'Boiler' },
  { value: 'Drying', label: 'Drying / Hydro' },
  { value: 'Finishing', label: 'Finishing' },
  { value: 'Other', label: 'Other Process' }
];

export const MachineMasterSettings: React.FC<MachineMasterSettingsProps> = ({
  currentUserId,
  onNotify
}) => {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Table Control States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<MachineSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedMachine, setSelectedMachine] = useState<MachineItem | null>(null);

  // Form Fields
  const [formMachineId, setFormMachineId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formModelYear, setFormModelYear] = useState<string>('');
  const [formProcessType, setFormProcessType] = useState<MachineProcessType>('Dyeing');
  const [formCapacity, setFormCapacity] = useState<string>('');
  const [formManufacturer, setFormManufacturer] = useState<string>('');
  const [formSerialNo, setFormSerialNo] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Realtime subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = MachineMasterService.subscribeMachines(
      (items) => {
        setMachines(items);
        setLoading(false);
      },
      (error) => {
        console.error('Machine Master subscription error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSort = (field: MachineSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortField(null);
      setSortDirection(null);
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection(null);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    searchColumn !== 'ALL' ||
    Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
    Boolean(sortField);

  // Filtering
  const filteredMachines = useMemo(() => {
    return machines.filter((item) => {
      // 1. Search Query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        if (searchColumn === 'ALL') {
          const matchAll =
            item.machineId.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            item.modelYear.toLowerCase().includes(q) ||
            item.processType.toLowerCase().includes(q) ||
            (item.capacity || '').toLowerCase().includes(q) ||
            item.status.toLowerCase().includes(q);
          if (!matchAll) return false;
        } else {
          let val = '';
          switch (searchColumn) {
            case 'machineId':
              val = item.machineId;
              break;
            case 'name':
              val = item.name;
              break;
            case 'modelYear':
              val = item.modelYear;
              break;
            case 'processType':
              val = item.processType;
              break;
            case 'capacity':
              val = item.capacity || '';
              break;
            case 'status':
              val = item.status;
              break;
          }
          if (!val.toLowerCase().includes(q)) return false;
        }
      }

      // 2. Inline Column Filters
      for (const [colKey, rawVal] of Object.entries(columnFilters)) {
        const needle = (rawVal || '').trim().toLowerCase();
        if (!needle) continue;

        let haystack = '';
        switch (colKey) {
          case 'machineId':
            haystack = item.machineId;
            break;
          case 'name':
            haystack = item.name;
            break;
          case 'modelYear':
            haystack = item.modelYear;
            break;
          case 'processType':
            haystack = item.processType;
            break;
          case 'capacity':
            haystack = item.capacity || '';
            break;
          case 'status':
            haystack = item.status;
            break;
        }

        if (!haystack.toLowerCase().includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [machines, searchQuery, searchColumn, columnFilters]);

  // 3-State Sorting
  const sortedMachines = useMemo(() => {
    if (!sortField || !sortDirection) {
      // Natural order: latest created/updated first
      return [...filteredMachines].sort((a, b) => {
        const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...filteredMachines].sort((a, b) => {
      switch (sortField) {
        case 'machineId':
          return a.machineId.localeCompare(b.machineId, undefined, { numeric: true, sensitivity: 'base' }) * mult;
        case 'name':
          return a.name.localeCompare(b.name) * mult;
        case 'modelYear':
          return a.modelYear.localeCompare(b.modelYear, undefined, { numeric: true, sensitivity: 'base' }) * mult;
        case 'processType':
          return a.processType.localeCompare(b.processType) * mult;
        case 'capacity':
          return (a.capacity || '').localeCompare(b.capacity || '') * mult;
        case 'status':
          return a.status.localeCompare(b.status) * mult;
        default:
          return 0;
      }
    });
  }, [filteredMachines, sortField, sortDirection]);

  const renderSortIcon = (field: MachineSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
    }
    return (
      <span className="p-0.5 rounded text-slate-400 group-hover:text-slate-600 transition-colors">
        <ArrowUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100" />
      </span>
    );
  };

  const getSortTooltip = (field: MachineSortField, label: string) => {
    if (sortField !== field || !sortDirection) {
      return `Click to sort ${label} ascending`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ascending. Click to sort descending`;
    }
    return `Currently sorted descending. Click to reset to normal order`;
  };

  const getSortColumnLabel = (field: MachineSortField) => {
    switch (field) {
      case 'machineId':
        return 'Machine ID';
      case 'name':
        return 'Machine Name';
      case 'modelYear':
        return 'Model Year';
      case 'processType':
        return 'Machine Used For';
      case 'capacity':
        return 'Capacity';
      case 'status':
        return 'Status';
      default:
        return field;
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormMachineId('');
    setFormName('');
    setFormModelYear(new Date().getFullYear().toString());
    setFormProcessType('Dyeing');
    setFormCapacity('');
    setFormManufacturer('');
    setFormSerialNo('');
    setFormStatus('active');
    setFormRemarks('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: MachineItem) => {
    setSelectedMachine(item);
    setFormMachineId(item.machineId);
    setFormName(item.name);
    setFormModelYear(item.modelYear);
    setFormProcessType(item.processType);
    setFormCapacity(item.capacity || '');
    setFormManufacturer(item.manufacturer || '');
    setFormSerialNo(item.serialNo || '');
    setFormStatus(item.status);
    setFormRemarks(item.remarks || '');
    setFormError('');
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (item: MachineItem) => {
    setSelectedMachine(item);
    setIsDeleteModalOpen(true);
  };

  // Submit Add
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formMachineId.trim()) {
      setFormError('Please enter a Unique Machine ID (e.g. MCH-001, DY-01).');
      return;
    }
    if (!formName.trim()) {
      setFormError('Please enter the Machine Name.');
      return;
    }
    if (!formModelYear.trim()) {
      setFormError('Please enter the Model Year (e.g. 2022).');
      return;
    }

    setIsSubmitting(true);
    try {
      const added = await MachineMasterService.addMachine(
        {
          machineId: formMachineId.trim(),
          name: formName.trim(),
          modelYear: formModelYear.trim(),
          processType: formProcessType,
          capacity: formCapacity.trim() || undefined,
          manufacturer: formManufacturer.trim() || undefined,
          serialNo: formSerialNo.trim() || undefined,
          status: formStatus,
          remarks: formRemarks.trim() || undefined,
          createdBy: currentUserId
        },
        currentUserId
      );

      onNotify?.('success', `Machine "${added.machineId} — ${added.name}" registered successfully.`);
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to register machine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) return;
    setFormError('');

    if (!formMachineId.trim()) {
      setFormError('Please enter a Unique Machine ID.');
      return;
    }
    if (!formName.trim()) {
      setFormError('Please enter the Machine Name.');
      return;
    }
    if (!formModelYear.trim()) {
      setFormError('Please enter the Model Year.');
      return;
    }

    setIsSubmitting(true);
    try {
      await MachineMasterService.updateMachine(
        selectedMachine.id,
        {
          machineId: formMachineId.trim(),
          name: formName.trim(),
          modelYear: formModelYear.trim(),
          processType: formProcessType,
          capacity: formCapacity.trim() || undefined,
          manufacturer: formManufacturer.trim() || undefined,
          serialNo: formSerialNo.trim() || undefined,
          status: formStatus,
          remarks: formRemarks.trim() || undefined
        },
        currentUserId
      );

      onNotify?.('success', `Machine "${formMachineId.trim()}" updated successfully.`);
      setIsEditModalOpen(false);
      setSelectedMachine(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update machine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!selectedMachine) return;
    setIsSubmitting(true);
    try {
      await MachineMasterService.deleteMachine(selectedMachine.id);
      onNotify?.('info', `Machine "${selectedMachine.machineId} — ${selectedMachine.name}" deleted.`);
      setIsDeleteModalOpen(false);
      setSelectedMachine(null);
    } catch (err: any) {
      console.error(err);
      onNotify?.('error', err.message || 'Failed to delete machine.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (item: MachineItem) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await MachineMasterService.updateMachine(
        item.id,
        { status: nextStatus },
        currentUserId
      );
      onNotify?.('info', `Machine "${item.machineId}" is now ${nextStatus === 'active' ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      onNotify?.('error', err.message || 'Failed to update machine status.');
    }
  };

  const getProcessBadge = (process: MachineProcessType) => {
    const p = String(process).toLowerCase();
    if (p.includes('dye')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <Droplets className="w-3 h-3 text-blue-600" />
          {process}
        </span>
      );
    }
    if (p.includes('wash')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
          <Droplets className="w-3 h-3 text-cyan-600" />
          {process}
        </span>
      );
    }
    if (p.includes('boiler')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Flame className="w-3 h-3 text-amber-600" />
          {process}
        </span>
      );
    }
    if (p.includes('dry') || p.includes('hydro')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
          <Wind className="w-3 h-3 text-purple-600" />
          {process}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
        <Factory className="w-3 h-3 text-slate-500" />
        {process}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Card & Toolbar */}
      <Card className="p-4 border border-slate-200 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Factory className="w-5 h-5 text-[#1F4E79]" />
                Machine Master Directory
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                {machines.length} registered
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Maintain unique machine IDs, model years, and operational processes (dyeing, washing, boiler, etc.).
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
            className="self-start md:self-auto"
          >
            Add New Machine
          </Button>
        </div>

        {/* Integrated Search Bar & Table Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-100">
          {/* Integrated Column Selector & Search Input */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px]">
            <div className="relative">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
              >
                {MACHINE_SEARCH_COLUMNS.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  searchColumn === 'ALL'
                    ? 'Search across all machine columns...'
                    : `Search by ${MACHINE_SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label || searchColumn}...`
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Toggle Inline Column Filters Button */}
          <button
            type="button"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 ${
              showColumnFilters || Object.values(columnFilters).some((v) => (v || '').trim() !== '')
                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Toggle column-wise search inputs on table header"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Column Filters</span>
            {Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
              <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length}
              </span>
            )}
          </button>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </Card>

      {/* Active Sort Banner */}
      {sortField && sortDirection && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/90 border border-blue-200 rounded-lg text-xs text-[#1F4E79]">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              Sorted by <strong className="font-bold underline">{getSortColumnLabel(sortField)}</strong> ({sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'})
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSortField(null);
              setSortDirection(null);
            }}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
            title="Reset to normal order"
          >
            Clear / Desort
          </button>
        </div>
      )}

      {/* Persistent Sticky Table Container */}
      <TableMaximizeWrapper
        title="Machine Master Directory"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {sortedMachines.length} Machines
          </span>
        }
      >
        {(isMaximized) => (
          <Card className={`overflow-hidden border border-slate-300 shadow-2xs bg-white ${isMaximized ? 'flex-1 flex flex-col min-h-0' : ''}`}>
            <div
              data-table-scroll="true"
              className={`overflow-x-auto relative overflow-y-auto ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
            >
              <table className="w-full text-left border-collapse text-xs border border-slate-200">
            <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
              <tr>
                {/* 1. Unique Machine ID */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'machineId' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('machineId')}
                  title={getSortTooltip('machineId', 'Machine ID')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Machine ID</span>
                    {renderSortIcon('machineId')}
                  </div>
                </th>

                {/* 2. Machine Name */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group min-w-[220px] sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'name' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('name')}
                  title={getSortTooltip('name', 'Machine Name')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Machine Name</span>
                    {renderSortIcon('name')}
                  </div>
                </th>

                {/* 3. Model Year */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group text-center whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'modelYear' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('modelYear')}
                  title={getSortTooltip('modelYear', 'Model Year')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Model Year</span>
                    {renderSortIcon('modelYear')}
                  </div>
                </th>

                {/* 4. Machine Used For (Process) */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'processType' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('processType')}
                  title={getSortTooltip('processType', 'Machine Used For')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Machine Used For</span>
                    {renderSortIcon('processType')}
                  </div>
                </th>

                {/* 5. Capacity */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'capacity' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('capacity')}
                  title={getSortTooltip('capacity', 'Capacity')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Capacity</span>
                    {renderSortIcon('capacity')}
                  </div>
                </th>

                {/* 6. Remarks / Details */}
                <th className="py-3 px-3.5 border-r border-b-2 border-slate-300 whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB]">
                  Remarks &amp; Model
                </th>

                {/* 7. Status */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                    sortField === 'status' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('status')}
                  title={getSortTooltip('status', 'Status')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 8. Actions */}
                <th className="py-3 px-3.5 border-b-2 border-slate-300 text-center whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] w-28 pr-12 min-w-[130px]">
                  Actions
                </th>
              </tr>

              {/* Inline Column Filter Inputs Row */}
              {showColumnFilters && (
                <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter ID..."
                      value={columnFilters.machineId || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, machineId: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter name..."
                      value={columnFilters.name || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, name: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter year..."
                      value={columnFilters.modelYear || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, modelYear: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter process..."
                      value={columnFilters.processType || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, processType: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter cap..."
                      value={columnFilters.capacity || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, capacity: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100" />
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                    <input
                      type="text"
                      placeholder="Filter status..."
                      value={columnFilters.status || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                    />
                  </th>
                  <th className="p-1.5 border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-center">
                    {Object.values(columnFilters).some((v) => (v || '').trim() !== '') && (
                      <button
                        type="button"
                        onClick={() => setColumnFilters({})}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded cursor-pointer"
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
                  <td colSpan={8} className="py-14 text-center text-xs text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#1F4E79]" />
                      <span>Loading Machine Master...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedMachines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-xs text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                        <Package className="w-8 h-8 stroke-[1.5]" />
                      </div>
                      <div className="text-sm font-bold text-slate-700">No Matching Machines Found</div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {hasActiveFilters
                          ? 'No machine records match your current search, column filters, or filters.'
                          : 'No machines have been registered yet. Click "Add New Machine" to register factory machines.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                      {!hasActiveFilters && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleOpenAdd}
                          icon={<Plus className="w-3.5 h-3.5" />}
                          className="mt-2"
                        >
                          Add First Machine
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedMachines.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-200 group"
                  >
                    {/* 1. Machine ID */}
                    <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {m.machineId}
                      </span>
                    </td>

                    {/* 2. Machine Name */}
                    <td className="py-3 px-3.5 border-r border-slate-200">
                      <span className="font-bold text-slate-900 text-xs block">
                        {m.name}
                      </span>
                      {m.manufacturer && (
                        <span className="text-[10px] text-slate-500 font-medium block">
                          Make: {m.manufacturer} {m.serialNo ? `(S/N: ${m.serialNo})` : ''}
                        </span>
                      )}
                    </td>

                    {/* 3. Model Year */}
                    <td className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap font-mono font-semibold text-slate-700">
                      {m.modelYear || '—'}
                    </td>

                    {/* 4. Machine Used For (Process) */}
                    <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap">
                      {getProcessBadge(m.processType)}
                    </td>

                    {/* 5. Capacity */}
                    <td className="py-3 px-3.5 border-r border-slate-200 whitespace-nowrap font-medium text-slate-700">
                      {m.capacity || '—'}
                    </td>

                    {/* 6. Remarks */}
                    <td className="py-3 px-3.5 border-r border-slate-200 max-w-xs truncate text-slate-500 text-[11px]">
                      {m.remarks || '—'}
                    </td>

                    {/* 7. Status */}
                    <td className="py-3 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                          m.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            m.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {m.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* 8. Actions */}
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 text-slate-600 hover:text-[#1F4E79] hover:bg-slate-100 rounded-md transition cursor-pointer"
                          title="Edit Machine Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(m)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Delete Machine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <TableTotalsFooter
              cells={[
                { colSpan: 8, label: `TOTAL (${sortedMachines.length} machines)` }
              ]}
            />
          </table>
        </div>
      </Card>
      )}
      </TableMaximizeWrapper>

      {/* Add Machine Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Machine"
        maxWidth="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Machine ID */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Unique Machine ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. MCH-001, DY-01, BLR-01"
                value={formMachineId}
                onChange={(e) => setFormMachineId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                required
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Must be unique across all machines in the factory.
              </span>
            </div>

            {/* Model Year */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Model Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 2022, 2024"
                value={formModelYear}
                onChange={(e) => setFormModelYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                required
              />
            </div>
          </div>

          {/* Machine Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Machine Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Soft Flow Dyeing Machine #1, Front Loading Washer"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Machine Used For (Process) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Used For (Process) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formProcessType}
                onChange={(e) => setFormProcessType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:border-[#1F4E79] cursor-pointer"
              >
                {STANDARD_PROCESS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Capacity (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 250 kg, 3 Ton/hr, 150 kg"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manufacturer / Make */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Manufacturer / Brand (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Fongs, Thermax, Texpa"
                value={formManufacturer}
                onChange={(e) => setFormManufacturer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              />
            </div>

            {/* Serial No */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Serial Number (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. FNG-2021-098"
                value={formSerialNo}
                onChange={(e) => setFormSerialNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Remarks &amp; Technical Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Steam pressure specifications, primary usage, maintenance schedule..."
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Registering...' : 'Register Machine'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Machine Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Machine — ${selectedMachine?.machineId || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Machine ID */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Unique Machine ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formMachineId}
                onChange={(e) => setFormMachineId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                required
              />
            </div>

            {/* Model Year */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Model Year <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formModelYear}
                onChange={(e) => setFormModelYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                required
              />
            </div>
          </div>

          {/* Machine Name */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Machine Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Machine Used For (Process) */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Machine Used For (Process) <span className="text-rose-500">*</span>
              </label>
              <select
                value={formProcessType}
                onChange={(e) => setFormProcessType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:border-[#1F4E79] cursor-pointer"
              >
                {STANDARD_PROCESS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Capacity */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Capacity (Optional)
              </label>
              <input
                type="text"
                value={formCapacity}
                onChange={(e) => setFormCapacity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Manufacturer / Make */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Manufacturer / Brand (Optional)
              </label>
              <input
                type="text"
                value={formManufacturer}
                onChange={(e) => setFormManufacturer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-hidden focus:border-[#1F4E79] cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Remarks &amp; Technical Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : undefined}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Delete Machine"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Are you sure you want to delete machine{' '}
            <strong className="text-slate-900">{selectedMachine?.machineId} — {selectedMachine?.name}</strong>?
          </p>
          <p className="text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            This machine will be removed from the active machine master catalogue.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Deleting...' : 'Delete Machine'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
