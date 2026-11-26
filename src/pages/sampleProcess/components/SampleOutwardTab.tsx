import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  X,
  RefreshCw,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Truck,
  Shirt,
  Building2,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ExcelExportButton } from '../../../components/ui/ExportButtons';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../../components/ui/TableMaximizeWrapper';
import { SamplePoOutward, SamplePoInward } from '../../../types/samplePo';
import { Vendor } from '../../../types/vendor';
import { SamplePoService } from '../../../services/samplePoService';
import { SamplePoPdfService } from '../../../services/samplePoPdfService';
import { SampleOutwardModal } from './SampleOutwardModal';
import { SampleOutwardDetailsModal } from './SampleOutwardDetailsModal';

interface SampleOutwardTabProps {
  sampleOutwards: SamplePoOutward[];
  samplePos: SamplePoInward[];
  vendors: Vendor[];
  user: any;
  isDemoMode: boolean;
  onRefresh: () => void;
  onNotice: (notice: { type: 'success' | 'error'; text: string }) => void;
  preSelectedInward?: SamplePoInward | null;
  onClearPreSelectedInward?: () => void;
}

type OutwardSortField =
  | 'entryNumber'
  | 'outwardDcNumber'
  | 'outwardDcDate'
  | 'inwardEntryNumber'
  | 'vendorName'
  | 'customerDcNumber'
  | 'totalQuantity'
  | 'status'
  | 'createdAt';

type SortDirection = 'asc' | 'desc' | 'normal';

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

export const SampleOutwardTab: React.FC<SampleOutwardTabProps> = ({
  sampleOutwards,
  samplePos,
  vendors,
  user,
  isDemoMode,
  onRefresh,
  onNotice,
  preSelectedInward = null,
  onClearPreSelectedInward
}) => {
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(Boolean(preSelectedInward));
  const [viewDetailsOutward, setViewDetailsOutward] = useState<SamplePoOutward | null>(null);
  const [deleteConfirmOutward, setDeleteConfirmOutward] = useState<SamplePoOutward | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Table Controls State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<{
    entryNumber: string;
    outwardDcNumber: string;
    inwardEntryNumber: string;
    vendorName: string;
    customerDcNumber: string;
    status: string;
  }>({
    entryNumber: '',
    outwardDcNumber: '',
    inwardEntryNumber: '',
    vendorName: '',
    customerDcNumber: '',
    status: ''
  });

  // Date Range Filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 3-State Sorting
  const [sortField, setSortField] = useState<OutwardSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('normal');

  // Handle Sort Cycle: Normal -> Asc/Desc -> Desc/Asc -> Normal
  const handleSort = (field: OutwardSortField) => {
    const isNumericOrDate =
      field === 'totalQuantity' ||
      field === 'outwardDcDate' ||
      field === 'createdAt';
    const firstDirection: SortDirection = isNumericOrDate ? 'desc' : 'asc';
    const secondDirection: SortDirection = isNumericOrDate ? 'asc' : 'desc';

    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection(firstDirection);
    } else if (sortDirection === firstDirection) {
      setSortDirection(secondDirection);
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const getSortIcon = (field: OutwardSortField) => {
    if (sortField !== field || sortDirection === 'normal') {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-3.5 h-3.5 text-[#1F4E79] font-bold" />;
    }
    return <ChevronDown className="w-3.5 h-3.5 text-[#1F4E79] font-bold" />;
  };

  // Active filters count
  const activeColumnFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((val) => val.trim().length > 0).length;
  }, [columnFilters]);

  const hasAnyFilter = useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      activeColumnFilterCount > 0 ||
      Boolean(dateFrom) ||
      Boolean(dateTo) ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, activeColumnFilterCount, dateFrom, dateTo, sortField, sortDirection]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setColumnFilters({
      entryNumber: '',
      outwardDcNumber: '',
      inwardEntryNumber: '',
      vendorName: '',
      customerDcNumber: '',
      status: ''
    });
    setDateFrom('');
    setDateTo('');
    setSortField(null);
    setSortDirection('normal');
    setShowColumnFilters(false);
  };

  // Filtered & Sorted Outwards
  const filteredAndSortedOutwards = useMemo(() => {
    let result = [...sampleOutwards];

    // Global / Column Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((item) => {
        if (searchColumn === 'entryNumber') {
          return (item.entryNumber || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'outwardDcNumber') {
          return (item.outwardDcNumber || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'inwardEntryNumber') {
          return (item.inwardEntryNumber || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'vendorName') {
          return (item.vendorName || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'customerDcNumber') {
          return (item.customerDcNumber || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'status') {
          return (item.status || '').toLowerCase().includes(q);
        }
        if (searchColumn === 'remarks') {
          return (item.remarks || '').toLowerCase().includes(q);
        }
        // ALL COLUMNS
        const inItems = (item.items || []).some(
          (it) =>
            (it.itemName || '').toLowerCase().includes(q) ||
            (it.styleNo || '').toLowerCase().includes(q) ||
            (it.washType || '').toLowerCase().includes(q)
        );
        return (
          (item.entryNumber || '').toLowerCase().includes(q) ||
          (item.outwardDcNumber || '').toLowerCase().includes(q) ||
          (item.inwardEntryNumber || '').toLowerCase().includes(q) ||
          (item.vendorName || '').toLowerCase().includes(q) ||
          (item.customerDcNumber || '').toLowerCase().includes(q) ||
          (item.remarks || '').toLowerCase().includes(q) ||
          (item.status || '').toLowerCase().includes(q) ||
          inItems
        );
      });
    }

    // Column Filters
    if (columnFilters.entryNumber.trim()) {
      const val = columnFilters.entryNumber.trim().toLowerCase();
      result = result.filter((it) => (it.entryNumber || '').toLowerCase().includes(val));
    }
    if (columnFilters.outwardDcNumber.trim()) {
      const val = columnFilters.outwardDcNumber.trim().toLowerCase();
      result = result.filter((it) => (it.outwardDcNumber || '').toLowerCase().includes(val));
    }
    if (columnFilters.inwardEntryNumber.trim()) {
      const val = columnFilters.inwardEntryNumber.trim().toLowerCase();
      result = result.filter((it) => (it.inwardEntryNumber || '').toLowerCase().includes(val));
    }
    if (columnFilters.vendorName.trim()) {
      const val = columnFilters.vendorName.trim().toLowerCase();
      result = result.filter((it) => (it.vendorName || '').toLowerCase().includes(val));
    }
    if (columnFilters.customerDcNumber.trim()) {
      const val = columnFilters.customerDcNumber.trim().toLowerCase();
      result = result.filter((it) => (it.customerDcNumber || '').toLowerCase().includes(val));
    }
    if (columnFilters.status.trim()) {
      const val = columnFilters.status.trim().toLowerCase();
      result = result.filter((it) => (it.status || '').toLowerCase().includes(val));
    }

    // Date Range Filter (based on outwardDcDate)
    if (dateFrom) {
      result = result.filter((it) => (it.outwardDcDate || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((it) => (it.outwardDcDate || '') <= dateTo);
    }

    // 3-State Sorting
    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (sortDirection === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
    }

    return result;
  }, [sampleOutwards, searchQuery, searchColumn, columnFilters, dateFrom, dateTo, sortField, sortDirection]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalOutwards = sampleOutwards.length;
    const totalQty = sampleOutwards.reduce((sum, o) => sum + (o.totalQuantity || 0), 0);
    const uniqueVendors = new Set(sampleOutwards.map((o) => o.vendorName).filter(Boolean)).size;
    const activeDispatches = sampleOutwards.filter((o) => (o.status || '').toLowerCase() === 'active').length;

    return {
      totalOutwards,
      totalQty,
      uniqueVendors,
      activeDispatches
    };
  }, [sampleOutwards]);

  // Total Quantity sum of filtered rows
  const filteredTotalQuantity = useMemo(() => {
    return filteredAndSortedOutwards.reduce((sum, o) => sum + (o.totalQuantity || 0), 0);
  }, [filteredAndSortedOutwards]);

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sample Outwards');

      sheet.columns = [
        { header: 'Outward No', key: 'entryNumber', width: 20 },
        { header: 'Outward DC No', key: 'outwardDcNumber', width: 16 },
        { header: 'Outward DC Date', key: 'outwardDcDate', width: 16 },
        { header: 'Inward PO No', key: 'inwardEntryNumber', width: 20 },
        { header: 'Customer / Company', key: 'vendorName', width: 34 },
        { header: 'Customer DC No', key: 'customerDcNumber', width: 16 },
        { header: 'Customer DC Date', key: 'customerDcDate', width: 16 },
        { header: 'Item Name', key: 'itemName', width: 22 },
        { header: 'Style No', key: 'styleNo', width: 16 },
        { header: 'Wash Type', key: 'washType', width: 24 },
        { header: 'Dispatched Qty', key: 'quantity', width: 16 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Remarks', key: 'remarks', width: 24 },
        { header: 'Created By', key: 'createdByName', width: 18 }
      ];

      // Header styling
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };

      filteredAndSortedOutwards.forEach((outward) => {
        if (outward.items && outward.items.length > 0) {
          outward.items.forEach((item) => {
            sheet.addRow({
              entryNumber: outward.entryNumber,
              outwardDcNumber: outward.outwardDcNumber,
              outwardDcDate: outward.outwardDcDate,
              inwardEntryNumber: outward.inwardEntryNumber,
              vendorName: outward.vendorName,
              customerDcNumber: item.customerDcNumber || outward.customerDcNumber,
              customerDcDate: item.customerDcDate || outward.customerDcDate,
              itemName: item.itemName,
              styleNo: item.styleNo,
              washType: item.washType,
              quantity: item.quantity,
              unit: item.unit || 'PCS',
              status: outward.status,
              remarks: outward.remarks || '',
              createdByName: outward.createdByName || ''
            });
          });
        } else {
          sheet.addRow({
            entryNumber: outward.entryNumber,
            outwardDcNumber: outward.outwardDcNumber,
            outwardDcDate: outward.outwardDcDate,
            inwardEntryNumber: outward.inwardEntryNumber,
            vendorName: outward.vendorName,
            customerDcNumber: outward.customerDcNumber,
            customerDcDate: outward.customerDcDate,
            itemName: '—',
            styleNo: '—',
            washType: '—',
            quantity: outward.totalQuantity,
            unit: 'PCS',
            status: outward.status,
            remarks: outward.remarks || '',
            createdByName: outward.createdByName || ''
          });
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Perla_Sample_Outwards_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export Sample Outwards to Excel:', e);
      onNotice({ type: 'error', text: 'Failed to generate Excel export.' });
    }
  };

  // Delete Outward Handler
  const handleDeleteOutward = async () => {
    if (!deleteConfirmOutward) return;
    try {
      setActionLoading(true);
      await SamplePoService.deleteSampleOutward(deleteConfirmOutward.id, isDemoMode);
      onNotice({
        type: 'success',
        text: `Sample Outward ${deleteConfirmOutward.entryNumber} deleted and inward balance restored.`
      });
      setDeleteConfirmOutward(null);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to delete outward:', err);
      onNotice({ type: 'error', text: err?.message || 'Failed to delete Sample Outward.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outwards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Outwards
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalOutwards}
            </span>
            <span className="text-xs text-slate-500 font-medium">Dispatches</span>
          </div>
        </div>

        {/* Total Dispatched Quantity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Dispatched Qty
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalQty.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">Pieces / Units</span>
          </div>
        </div>

        {/* Distinct Companies */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Customers Served
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.uniqueVendors}
            </span>
            <span className="text-xs text-slate-500 font-medium">Companies</span>
          </div>
        </div>

        {/* Active Dispatches */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Dispatches
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.activeDispatches}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Main Table Card with All ERP Table Controls */}
      <TableMaximizeWrapper
        title="Sample Outward (Dispatch Records)"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredAndSortedOutwards.length} Dispatches
          </span>
        }
      >
        {(isMaximized) => (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Controls Bar Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              {/* Left: Column-Wise Search + Column Filters Toggle + Date Range + Master Reset */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search Pill */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 w-full sm:w-auto">
                  <div className="relative bg-slate-50 border-r border-slate-200 shrink-0">
                    <select
                      value={searchColumn}
                      onChange={(e) => setSearchColumn(e.target.value)}
                      className="h-9 pl-3 pr-7 bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none"
                      title="Select column to search in"
                    >
                      <option value="ALL">All Columns</option>
                      <option value="entryNumber">Outward No</option>
                      <option value="outwardDcNumber">Outward DC No</option>
                      <option value="inwardEntryNumber">Inward PO No</option>
                      <option value="vendorName">Customer / Company</option>
                      <option value="customerDcNumber">Customer DC No</option>
                      <option value="status">Status</option>
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

                {/* Date Range Filters */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-9 text-xs shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Start Date:
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                    title="Filter by start date"
                  />
                  <span className="text-slate-300">|</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    End Date:
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                    title="Filter by end date"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer ml-1"
                      title="Clear date range"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Master Reset Button */}
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

              {/* Right: Add Outward */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-9 font-bold cursor-pointer"
                >
                  New Sample Outward
                </Button>
              </div>
            </div>

            {/* Table Viewport */}
            <div
              data-table-scroll="true"
              className="overflow-x-auto overflow-y-auto flex-1 min-h-0 relative"
            >
              <table className="w-full text-left text-xs border-collapse min-w-[1150px]">
                {/* Standard Blue Table Header with Sticky Positioning */}
                <thead className="sticky top-0 z-10 bg-[#EEF5FB] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <tr className="border-b border-blue-100 text-[#1F4E79] font-bold uppercase text-[10.5px] tracking-wider select-none">
                    <th className="py-3 px-3 text-center w-12 whitespace-nowrap">S.No.</th>

                    <th
                      onClick={() => handleSort('entryNumber')}
                      className="py-3 px-3 min-w-[150px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Outward No</span>
                        {getSortIcon('entryNumber')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('outwardDcNumber')}
                      className="py-3 px-3 min-w-[125px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Outward DC No</span>
                        {getSortIcon('outwardDcNumber')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('outwardDcDate')}
                      className="py-3 px-3 min-w-[120px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Outward Date</span>
                        {getSortIcon('outwardDcDate')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('inwardEntryNumber')}
                      className="py-3 px-3 min-w-[150px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Inward PO No</span>
                        {getSortIcon('inwardEntryNumber')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('vendorName')}
                      className="py-3 px-3 min-w-[180px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Company Name</span>
                        {getSortIcon('vendorName')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('customerDcNumber')}
                      className="py-3 px-3 min-w-[125px] cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Customer DC No</span>
                        {getSortIcon('customerDcNumber')}
                      </div>
                    </th>

                    <th className="py-3 px-3 min-w-[125px] whitespace-nowrap">
                      <span>Customer DC Date</span>
                    </th>

                    <th
                      onClick={() => handleSort('totalQuantity')}
                      className="py-3 px-3 min-w-[120px] text-right cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Dispatched Qty</span>
                        {getSortIcon('totalQuantity')}
                      </div>
                    </th>

                    <th
                      onClick={() => handleSort('status')}
                      className="py-3 px-3 min-w-[100px] text-center cursor-pointer hover:bg-blue-100/50 transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        {getSortIcon('status')}
                      </div>
                    </th>

                    <th className="py-3 px-3 text-center min-w-[210px] pr-12 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>

                  {/* Inline Column Filters Row */}
                  {showColumnFilters && (
                    <tr className="bg-blue-50/70 border-b border-blue-200 text-xs">
                      <th className="p-1.5 text-center text-[10px] text-slate-400">#</th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Outward..."
                          value={columnFilters.entryNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, entryNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="DC No..."
                          value={columnFilters.outwardDcNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, outwardDcNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5"></th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="PO No..."
                          value={columnFilters.inwardEntryNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, inwardEntryNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Company..."
                          value={columnFilters.vendorName}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, vendorName: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Cust DC..."
                          value={columnFilters.customerDcNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, customerDcNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5"></th>
                      <th className="p-1.5"></th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Status..."
                          value={columnFilters.status}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, status: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal text-center focus:outline-none"
                        />
                      </th>
                      <th className="p-1.5 pr-12 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setColumnFilters({
                              entryNumber: '',
                              outwardDcNumber: '',
                              inwardEntryNumber: '',
                              vendorName: '',
                              customerDcNumber: '',
                              status: ''
                            })
                          }
                          className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </th>
                    </tr>
                  )}
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAndSortedOutwards.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <Truck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold">No Sample Outwards Found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {hasAnyFilter
                            ? 'Try clearing some search filters.'
                            : 'Click "+ New Sample Outward" to record your first dispatch.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedOutwards.map((outward, idx) => {
                      const items = outward.items && outward.items.length > 0 ? outward.items : [null];
                      const rowSpan = items.length;

                      return (
                        <React.Fragment key={outward.id}>
                          {items.map((item, itemIdx) => {
                            const isFirst = itemIdx === 0;
                            const isLast = itemIdx === items.length - 1;
                            return (
                              <tr
                                key={`${outward.id}-${item?.id || itemIdx}`}
                                className={`hover:bg-slate-50/90 transition-colors ${
                                  isLast ? 'border-b border-slate-200' : 'border-b border-slate-100'
                                }`}
                              >
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 text-center text-slate-400 font-mono font-bold align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {idx + 1}
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 font-mono font-bold text-[#1F4E79] align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {outward.entryNumber}
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 font-mono font-bold text-slate-900 align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {outward.outwardDcNumber ? `DC #${outward.outwardDcNumber}` : '—'}
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 text-slate-600 align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {formatDisplayDate(outward.outwardDcDate)}
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 font-mono font-semibold text-[#1F4E79] align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {outward.inwardEntryNumber || '—'}
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 font-bold text-slate-900 align-middle border-r border-slate-100 whitespace-nowrap"
                                  >
                                    {outward.vendorName}
                                  </td>
                                )}
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900 align-middle whitespace-nowrap">
                                  {(item?.customerDcNumber || outward.customerDcNumber)
                                    ? `DC #${item?.customerDcNumber || outward.customerDcNumber}`
                                    : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 align-middle whitespace-nowrap">
                                  {formatDisplayDate(item?.customerDcDate || outward.customerDcDate)}
                                </td>
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 text-right font-mono font-bold text-blue-700 align-middle border-l border-slate-100 whitespace-nowrap"
                                  >
                                    {outward.totalQuantity} PCS
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 text-center align-middle border-l border-slate-100 whitespace-nowrap"
                                  >
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      {outward.status}
                                    </span>
                                  </td>
                                )}
                                {isFirst && (
                                  <td
                                    rowSpan={rowSpan}
                                    className="py-3 px-3 text-center pr-12 align-middle border-l border-slate-100 whitespace-nowrap"
                                  >
                                    <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={() => setViewDetailsOutward(outward)}
                                        className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
                                        title="View Outward Details"
                                      >
                                        View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => SamplePoPdfService.downloadSingleSampleOutwardPdf(outward)}
                                        className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition cursor-pointer"
                                        title="Download Sample Outward as PDF"
                                      >
                                        Download
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmOutward(outward)}
                                        className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                                        title="Delete Outward"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* Sticky Totals Footer */}
                {filteredAndSortedOutwards.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-slate-100 shadow-[0_-2px_4px_rgba(0,0,0,0.06)] border-t-2 border-slate-300 text-xs">
                    <tr>
                      <td
                        colSpan={8}
                        className="py-2.5 px-3 font-extrabold uppercase text-[#1F4E79] bg-[#EEF5FB] text-left"
                      >
                        TOTAL ({filteredAndSortedOutwards.length} DISPATCHES)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#1F4E79] bg-blue-100/60 whitespace-nowrap">
                        {filteredTotalQuantity.toLocaleString()} PCS
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 bg-[#EEF5FB] text-slate-400 text-center pr-12">
                        —
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Single Stretch Display Summary Note */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <div>
                Showing all <strong>{filteredAndSortedOutwards.length}</strong> records in one stretch
                {filteredAndSortedOutwards.length !== sampleOutwards.length && (
                  <span className="text-slate-400 ml-1">
                    (filtered from {sampleOutwards.length} total)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Perla ERP • Sample Dispatch Management
              </div>
            </div>
          </div>
        )}
      </TableMaximizeWrapper>

      {/* MODAL 1: ADD SAMPLE OUTWARD */}
      {isAddModalOpen && (
        <SampleOutwardModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            if (onClearPreSelectedInward) onClearPreSelectedInward();
          }}
          onSuccess={(entryNumber) => {
            onNotice({
              type: 'success',
              text: `Sample Outward ${entryNumber} created successfully.`
            });
            onRefresh();
          }}
          samplePos={samplePos}
          vendors={vendors}
          user={user}
          isDemoMode={isDemoMode}
          initialInward={preSelectedInward}
        />
      )}

      {/* MODAL 2: VIEW DETAILS */}
      {viewDetailsOutward && (
        <SampleOutwardDetailsModal
          outward={viewDetailsOutward}
          onClose={() => setViewDetailsOutward(null)}
        />
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deleteConfirmOutward && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmOutward(null)}
          title="Confirm Deletion of Sample Outward"
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Are you sure you want to permanently delete Sample Outward{' '}
              <strong className="text-slate-900 font-mono font-bold">
                {deleteConfirmOutward.entryNumber}
              </strong>
              ?
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
              <div className="font-bold">Inward Balance Restoration:</div>
              <div>
                Deleting this dispatch will automatically roll back the {deleteConfirmOutward.totalQuantity}{' '}
                dispatched pieces on Sample Inward{' '}
                <strong className="font-mono">{deleteConfirmOutward.inwardEntryNumber}</strong>,
                returning them to available balance.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmOutward(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteOutward}
                disabled={actionLoading}
                icon={
                  actionLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )
                }
              >
                {actionLoading ? 'Deleting...' : 'Delete & Restore Balance'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
