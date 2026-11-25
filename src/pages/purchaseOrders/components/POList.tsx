import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  Printer,
  Ban,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Layers,
  Calendar,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  FileSpreadsheet
} from 'lucide-react';
import { POLockStatus, POLockService } from '../../../services/poLockService';
import {
  PurchaseOrder,
  POFilterOptions,
  POPagination,
  QuantityUnit
} from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry } from '../../../types/inwardOutward';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import {
  TableMaximizeWrapper,
  TableMaximizeButton,
  TableTotalsFooter
} from '../../../components/ui/TableMaximizeWrapper';
import {
  formatCurrency,
  formatQuantity,
  formatDate
} from '../../../utils/formatters';
import { hasInwardForPO } from '../../../utils/calculations';

interface POListProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  inwards?: InwardEntry[];
  pagination: POPagination;
  filters: POFilterOptions;
  onFilterChange: (filters: POFilterOptions) => void;
  onPageChange: (page: number) => void;
  onViewPO: (poId: string) => void;
  onEditPO: (poId: string) => void;
  onSubmitPO: (poId: string) => void;
  onApprovePO: (poId: string) => void;
  onRejectPO: (poId: string) => void;
  onCancelPO: (poId: string) => void;
  onRevokeApprovalPO?: (poId: string, reason?: string) => void;
  onDeletePO?: (poId: string) => void;
  onPrintPO: (poId: string) => void;
  onAddNewPO: () => void;
  onOpenReport?: () => void;
  canManage: boolean; // Admin or Manager
  isAdmin?: boolean; // Admin only
  lockedPOMap?: Record<string, POLockStatus>;
}

export type POSortField =
  | 'poNumber'
  | 'customerName'
  | 'customerPoNumber'
  | 'processCategory'
  | 'styleNo'
  | 'orderDate'
  | 'totalQuantity'
  | 'totalAmount'
  | 'status';

export type SortDirection = 'asc' | 'desc' | null;

export const POList: React.FC<POListProps> = ({
  pos,
  vendors,
  inwards = [],
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onViewPO,
  onEditPO,
  onSubmitPO,
  onApprovePO,
  onRevokeApprovalPO,
  onRejectPO,
  onCancelPO,
  onDeletePO,
  onPrintPO,
  onAddNewPO,
  onOpenReport,
  canManage,
  isAdmin,
  lockedPOMap = {}
}) => {
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [isTableMaximized, setIsTableMaximized] = useState(false);

  // Active drawer filter count (Processes, Statuses, Customers, Dates)
  const activeDrawerFilterCount = useMemo(() => {
    let count = 0;
    if (filters.processCategory && filters.processCategory !== 'all') count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.customerId) count++;
    if (filters.startDate) count++;
    if (filters.endDate) count++;
    return count;
  }, [filters]);

  // Column search & filter state
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Eligible customer vendors (Main company customers only)
  const eligibleCustomers = vendors.filter(
    (v) =>
      (!v.vendorCategory || v.vendorCategory === 'main_company') &&
      (v.vendorType === 'customer' ||
        v.vendorType === 'both' ||
        v.roles?.includes('Customer') ||
        v.roles?.includes('Both'))
  );

  // Dynamic list of all statuses present in data plus standard PO lifecycle statuses
  const dynamicStatusOptions = useMemo(() => {
    const statusMap = new Map<string, string>();

    // Standard PO statuses
    const standardStatuses = [
      { key: 'draft', label: 'Draft' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'approved', label: 'Approved' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'partially_received', label: 'Partially Received' },
      { key: 'fully_received', label: 'Fully Received' },
      { key: 'completed', label: 'Completed' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'cancelled', label: 'Cancelled' }
    ];

    standardStatuses.forEach(({ key, label }) => {
      statusMap.set(key.toLowerCase(), label);
    });

    // Dynamically collect any statuses appearing in the PO data
    pos.forEach((p) => {
      if (p.status) {
        const raw = String(p.status).trim();
        const key = raw.toLowerCase();
        if (!statusMap.has(key)) {
          const formatted = raw
            .replace(/_/g, ' ')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
          statusMap.set(key, formatted);
        }
      }
    });

    return Array.from(statusMap.entries()).map(([value, label]) => ({
      value,
      label
    }));
  }, [pos]);

  const PO_SEARCH_COLUMNS = [
    { value: 'ALL', label: 'All Columns' },
    { value: 'poNumber', label: 'PO Number' },
    { value: 'orderDate', label: 'Order Date' },
    { value: 'customerName', label: 'Customer' },
    { value: 'customerPoNumber', label: 'Cust PO No' },
    { value: 'processCategory', label: 'Process' },
    { value: 'styleNo', label: 'Style & Item' },
    { value: 'totalQuantity', label: 'Total Qty' },
    { value: 'totalAmount', label: 'Value (₹)' },
    { value: 'status', label: 'Status' }
  ];

  // 3-State Column Sorting (asc -> desc -> unsort)
  const [sortField, setSortField] = useState<POSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: POSortField) => {
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
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection(null);
    onFilterChange({
      searchQuery: '',
      customerId: undefined,
      processCategory: 'all',
      status: 'all',
      startDate: undefined,
      endDate: undefined
    });
  };

  const hasActiveFilters =
    Boolean(filters.searchQuery) ||
    Boolean(filters.customerId) ||
    (filters.processCategory && filters.processCategory !== 'all') ||
    (filters.status && filters.status !== 'all') ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    searchColumn !== 'ALL' ||
    Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
    Boolean(sortField);

  // Client-side filtering for column selector & inline column filters
  const filteredPOs = useMemo(() => {
    return pos.filter((po) => {
      // 1. Column-specific search if searchColumn !== 'ALL' or global search
      const query = (filters.searchQuery || '').trim().toLowerCase();
      if (query) {
        if (searchColumn !== 'ALL') {
          let val = '';
          switch (searchColumn) {
            case 'poNumber':
              val = `${po.poNumber || ''} ${po.revision ? `r${po.revision}` : ''}`;
              break;
            case 'orderDate':
              val = `${po.orderDate || ''} ${formatDate(po.orderDate) || ''}`;
              break;
            case 'customerName':
              val = `${po.customerName || ''} ${(po as any).customerCompanyNameSnapshot || ''} ${po.customerCode || ''} ${po.subcontractorName || ''} ${po.subcompanyName || ''}`;
              break;
            case 'customerPoNumber':
              val = `${po.customerPoNumber || ''} ${po.customerPoDate || ''} ${formatDate(po.customerPoDate) || ''}`;
              break;
            case 'processCategory':
              val = po.processCategory || '';
              break;
            case 'styleNo':
              val = `${po.styleNo || po.styleNumber || ''} ${po.itemName || ''} ${(po.colourLines || []).map((l: any) => `${l.colourName || ''} ${l.processType || ''}`).join(' ')}`;
              break;
            case 'totalQuantity':
              val = `${po.totalQuantity ?? ''} ${po.totalQtyByUnit?.piece ?? ''} ${po.totalQtyByUnit?.kg ?? ''}`;
              break;
            case 'totalAmount':
              val = `${po.totalAmount ?? ''} ${formatCurrency(po.totalAmount) || ''}`;
              break;
            case 'status':
              val = po.status || '';
              break;
          }
          if (!val.toLowerCase().includes(query)) return false;
        } else {
          // searchColumn === 'ALL'
          const allText = `${po.poNumber || ''} ${po.customerName || ''} ${(po as any).customerCompanyNameSnapshot || ''} ${po.customerCode || ''} ${po.customerPoNumber || ''} ${po.processCategory || ''} ${po.styleNo || po.styleNumber || ''} ${po.itemName || ''} ${po.status || ''} ${(po.colourLines || []).map((l: any) => `${l.colourName || ''} ${l.processType || ''}`).join(' ')}`.toLowerCase();
          if (!allText.includes(query)) return false;
        }
      }

      // 2. Inline column filters
      for (const [colKey, rawVal] of Object.entries(columnFilters)) {
        const needle = (rawVal || '').trim().toLowerCase();
        if (!needle) continue;

        let haystack = '';
        switch (colKey) {
          case 'poNumber':
            haystack = `${po.poNumber || ''} ${po.revision ? `r${po.revision}` : ''} ${po.id || ''}`;
            break;
          case 'orderDate':
            haystack = `${po.orderDate || ''} ${formatDate(po.orderDate) || ''}`;
            break;
          case 'customerName':
            haystack = `${po.customerName || ''} ${(po as any).customerCompanyNameSnapshot || ''} ${(po as any).customer?.companyName || ''} ${po.customerCode || ''} ${po.subcontractorName || ''} ${po.subcompanyName || ''}`;
            break;
          case 'customerPoNumber':
            haystack = `${po.customerPoNumber || ''} ${po.customerPoDate || ''} ${formatDate(po.customerPoDate) || ''}`;
            break;
          case 'processCategory':
            haystack = po.processCategory || '';
            break;
          case 'styleNo':
            haystack = `${po.styleNo || po.styleNumber || ''} ${po.itemName || ''} ${(po.colourLines || []).map((l: any) => `${l.colourName || ''} ${l.processType || ''}`).join(' ')}`;
            break;
          case 'totalQuantity':
            haystack = `${po.totalQuantity ?? ''} ${po.totalQtyByUnit?.piece ?? ''} ${po.totalQtyByUnit?.kg ?? ''}`;
            break;
          case 'totalAmount':
            haystack = `${po.totalAmount ?? ''} ${formatCurrency(po.totalAmount) || ''}`;
            break;
          case 'status':
            haystack = po.status || '';
            break;
          default:
            haystack = String((po as any)[colKey] || '');
        }

        if (!haystack.toLowerCase().includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [pos, filters.searchQuery, searchColumn, columnFilters]);

  const sortedPOs = useMemo(() => {
    if (!sortField || !sortDirection) {
      // Default: Most recent entry first based on timestamp (createdAt / updatedAt / orderDate)
      return [...filteredPOs].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || a.orderDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || b.orderDate || 0).getTime();
        return timeB - timeA;
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...filteredPOs].sort((a, b) => {
      switch (sortField) {
        case 'poNumber':
          return (
            (a.poNumber || '').localeCompare(b.poNumber || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            }) * mult
          );
        case 'customerName':
          return (
            (a.customerName || '').localeCompare(b.customerName || '') * mult
          );
        case 'customerPoNumber':
          return (
            (a.customerPoNumber || '').localeCompare(b.customerPoNumber || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            }) * mult
          );
        case 'processCategory':
          return (
            (a.processCategory || '').localeCompare(b.processCategory || '') * mult
          );
        case 'styleNo': {
          const aStyle = `${a.styleNo || a.styleNumber || ''} ${a.itemName || ''}`;
          const bStyle = `${b.styleNo || b.styleNumber || ''} ${b.itemName || ''}`;
          return aStyle.localeCompare(bStyle) * mult;
        }
        case 'orderDate': {
          const aDate = a.orderDate ? new Date(a.orderDate).getTime() : 0;
          const bDate = b.orderDate ? new Date(b.orderDate).getTime() : 0;
          return (aDate - bDate) * mult;
        }
        case 'totalQuantity':
          return (
            ((Number(a.totalQuantity) || 0) - (Number(b.totalQuantity) || 0)) * mult
          );
        case 'totalAmount':
          return (
            ((Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0)) * mult
          );
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * mult;
        default:
          return 0;
      }
    });
  }, [filteredPOs, sortField, sortDirection]);

  const getPoQuantities = (po: PurchaseOrder): { piece: number; kg: number } => {
    let piece = Number(po.totalQtyByUnit?.piece) || 0;
    let kg = Number(po.totalQtyByUnit?.kg) || 0;

    if (piece === 0 && kg === 0) {
      const lines = po.colourLines || po.lines || [];
      if (lines.length > 0) {
        for (const l of lines) {
          const q = Number(l.quantity) || 0;
          if (l.unit === 'kg') {
            kg += q;
          } else {
            piece += q;
          }
        }
      } else {
        const q = Number(po.totalQuantity) || 0;
        const fallbackUnit = po.colourLines?.[0]?.unit || 'piece';
        if (fallbackUnit === 'kg') {
          kg += q;
        } else {
          piece += q;
        }
      }
    }

    return { piece, kg };
  };

  // Totals for sticky table footer
  const { totalPcsSum, totalKgSum, totalValueSum } = useMemo(() => {
    return sortedPOs.reduce(
      (acc, po) => {
        const { piece, kg } = getPoQuantities(po);
        acc.totalPcsSum += piece;
        acc.totalKgSum += kg;
        acc.totalValueSum += Number(po.totalAmount) || 0;
        return acc;
      },
      { totalPcsSum: 0, totalKgSum: 0, totalValueSum: 0 }
    );
  }, [sortedPOs]);

  const renderSortIcon = (field: POSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
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

  const getSortTooltip = (field: POSortField, label: string) => {
    if (sortField !== field || !sortDirection) {
      return `Click to sort ${label} ascending`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ascending. Click to sort descending`;
    }
    return `Currently sorted descending. Click to unsort`;
  };

  const getSortColumnLabel = (field: POSortField) => {
    switch (field) {
      case 'poNumber':
        return 'PO Number';
      case 'customerName':
        return 'Customer';
      case 'customerPoNumber':
        return 'Cust PO No';
      case 'processCategory':
        return 'Process';
      case 'styleNo':
        return 'Style & Item';
      case 'orderDate':
        return 'Order Date';
      case 'totalQuantity':
        return 'Total Qty';
      case 'totalAmount':
        return 'Value (₹)';
      case 'status':
        return 'Status';
      default:
        return field;
    }
  };

  const renderQuantityDisplay = (po: PurchaseOrder) => {
    const pcs = po.totalQtyByUnit?.piece || 0;
    const kgs = po.totalQtyByUnit?.kg || 0;

    if (pcs > 0 && kgs > 0) {
      return (
        <div className="text-right">
          <div className="font-semibold text-slate-800">
            {formatQuantity(pcs, 'piece')}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {formatQuantity(kgs, 'kg')}
          </div>
        </div>
      );
    }

    if (kgs > 0) {
      return (
        <span className="font-semibold text-slate-800 font-mono">
          {formatQuantity(kgs, 'kg')}
        </span>
      );
    }

    const total = pcs > 0 ? pcs : po.totalQuantity || 0;
    const unit = po.colourLines[0]?.unit || 'piece';
    return (
      <span className="font-semibold text-slate-800 font-mono">
        {formatQuantity(total, unit)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar with Column Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px]">
            <div className="relative">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
              >
                {PO_SEARCH_COLUMNS.map((col) => (
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
                    ? 'Search across all columns...'
                    : `Search by ${PO_SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label || searchColumn}...`
                }
                value={filters.searchQuery || ''}
                onChange={(e) =>
                  onFilterChange({ ...filters, searchQuery: e.target.value })
                }
                className="w-full pl-9 pr-8 py-2 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Controls: Column Filters, Single Filter Button, Reset, New PO */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Inline Column Filters Button */}
            <button
              type="button"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
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

            {/* Single Filter Button */}
            <button
              type="button"
              onClick={() => setShowFilterDrawer((prev) => !prev)}
              className={`h-9 px-3 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                showFilterDrawer || activeDrawerFilterCount > 0
                  ? 'bg-blue-50 border-blue-300 text-[#1F4E79] font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Toggle filters (Processes, Statuses, Customers, Dates)"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeDrawerFilterCount > 0 && (
                <span className="bg-[#1F4E79] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {activeDrawerFilterCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Reset Filters"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* New PO Button */}
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={onAddNewPO}
              >
                Create PO
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filters Drawer */}
        {showFilterDrawer && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-end gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Process Category Filter */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Process</label>
              <select
                value={filters.processCategory || 'all'}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    processCategory: e.target.value as any
                  })
                }
                className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
              >
                <option value="all">All Processes</option>
                <option value="washing">Washing</option>
                <option value="dyeing">Dyeing</option>
              </select>
            </div>

            {/* Dynamic Status Filter */}
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={(filters.status || 'all').toLowerCase()}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    status: e.target.value as any
                  })
                }
                className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {dynamicStatusOptions.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Filter */}
            <div className="flex flex-col gap-1 min-w-[180px] max-w-[240px]">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</label>
              <select
                value={filters.customerId || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    customerId: e.target.value || undefined
                  })
                }
                className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer truncate"
              >
                <option value="">All Customers</option>
                {eligibleCustomers.map((c) => (
                  <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date From</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    startDate: e.target.value || undefined
                  })
                }
                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
              />
            </div>

            {/* Date To */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date To</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    endDate: e.target.value || undefined
                  })
                }
                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
              />
            </div>

            {activeDrawerFilterCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    processCategory: 'all',
                    status: 'all',
                    customerId: undefined,
                    startDate: undefined,
                    endDate: undefined
                  })
                }
                className="h-9 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Clear these filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Sort Banner (if sorted) */}
      {sortField && sortDirection && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-[#1F4E79]">
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
          >
            Clear Sort
          </button>
        </div>
      )}

      {/* Purchase Orders Table - Actual Grid with Vertical & Horizontal Borders */}
      <TableMaximizeWrapper
        title="Purchase Orders"
        badge={
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1F4E79] border border-blue-200">
            {sortedPOs.length} {sortedPOs.length === 1 ? 'order' : 'orders'}
          </span>
        }
        isMaximized={isTableMaximized}
        onToggleMaximize={setIsTableMaximized}
        extraHeaderActions={
          <button
            type="button"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              showColumnFilters || Object.values(columnFilters).some((v) => (v || '').trim() !== '')
                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Toggle column-wise search inputs on table header"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Column Filters</span>
            {Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
              <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length}
              </span>
            )}
          </button>
        }
      >
        {(isMaximized) => (
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
            <div
              data-table-scroll="true"
              className={`overflow-x-auto overflow-y-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
            >
              <table className="w-full border-collapse text-xs border border-slate-200">
            <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <tr className="bg-[#EEF5FB] text-[#1F4E79] uppercase tracking-wider font-bold text-[11px] border-b-2 border-slate-300">
                {/* 1. PO Number - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'poNumber' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('poNumber')}
                  title={getSortTooltip('poNumber', 'PO Number')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>PO Number</span>
                    {renderSortIcon('poNumber')}
                  </div>
                </th>

                {/* 2. Order Date - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'orderDate' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('orderDate')}
                  title={getSortTooltip('orderDate', 'Order Date')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Order Date</span>
                    {renderSortIcon('orderDate')}
                  </div>
                </th>

                {/* 3. Customer - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'customerName' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('customerName')}
                  title={getSortTooltip('customerName', 'Customer')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Customer</span>
                    {renderSortIcon('customerName')}
                  </div>
                </th>

                {/* 4. Cust PO - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'customerPoNumber' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('customerPoNumber')}
                  title={getSortTooltip('customerPoNumber', 'Customer PO')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Cust PO</span>
                    {renderSortIcon('customerPoNumber')}
                  </div>
                </th>

                {/* 5. Process - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'processCategory' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('processCategory')}
                  title={getSortTooltip('processCategory', 'Process Category')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Process</span>
                    {renderSortIcon('processCategory')}
                  </div>
                </th>

                {/* 6. Style & Item - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'styleNo' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('styleNo')}
                  title={getSortTooltip('styleNo', 'Style & Item')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Style & Item</span>
                    {renderSortIcon('styleNo')}
                  </div>
                </th>

                {/* 7. Total Qty - Right */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'totalQuantity' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('totalQuantity')}
                  title={getSortTooltip('totalQuantity', 'Total Quantity')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Total Qty</span>
                    {renderSortIcon('totalQuantity')}
                  </div>
                </th>

                {/* 8. Total Amount (Value) - Right */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'totalAmount' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('totalAmount')}
                  title={getSortTooltip('totalAmount', 'Value')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Value (₹)</span>
                    {renderSortIcon('totalAmount')}
                  </div>
                </th>

                {/* 9. Status - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 ${
                    sortField === 'status' ? 'bg-[#DCE9F5] text-[#1F4E79]' : 'bg-[#EEF5FB] text-[#1F4E79] hover:bg-[#DCE9F5]'
                  }`}
                  onClick={() => handleSort('status')}
                  title={getSortTooltip('status', 'Status')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 10. Actions - Left */}
                <th className="py-3 px-3.5 border-b-2 border-slate-300 text-left whitespace-nowrap bg-[#EEF5FB] text-[#1F4E79] sticky top-0 z-20 min-w-[130px] pr-12">
                  <div className="flex items-center justify-start">
                    <span>Actions</span>
                  </div>
                </th>
              </tr>

              {/* Inline Column Filter Inputs Row */}
              {showColumnFilters && (
                <tr className="bg-[#F5F9FD] border-b-2 border-slate-300">
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter PO..."
                      value={columnFilters.poNumber || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, poNumber: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter date..."
                      value={columnFilters.orderDate || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, orderDate: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter customer..."
                      value={columnFilters.customerName || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, customerName: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter cust PO..."
                      value={columnFilters.customerPoNumber || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, customerPoNumber: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter process..."
                      value={columnFilters.processCategory || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, processCategory: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter style/item..."
                      value={columnFilters.styleNo || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, styleNo: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter qty..."
                      value={columnFilters.totalQuantity || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, totalQuantity: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter amt..."
                      value={columnFilters.totalAmount || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, totalAmount: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                    />
                  </th>
                  <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD]">
                    <input
                      type="text"
                      placeholder="Filter status..."
                      value={columnFilters.status || ''}
                      onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                      className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                    />
                  </th>
                  <th className="p-1.5 border-b-2 border-slate-300 sticky top-[41px] z-20 bg-[#F5F9FD] text-center">
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
              {sortedPOs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-xs text-slate-400 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                        <Layers className="w-8 h-8 stroke-[1.5]" />
                      </div>
                      <div className="text-sm font-bold text-slate-700">No Matching Purchase Orders</div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {hasActiveFilters
                           ? 'No purchase orders match your current search, column filters, or filters.'
                          : 'Create your first Purchase Order to begin recording customer processing orders.'}
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
                      {!hasActiveFilters && canManage && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<Plus className="w-3.5 h-3.5" />}
                          onClick={onAddNewPO}
                          className="mt-2"
                        >
                          Create Purchase Order
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedPOs.map((po) => {
                  const statusLower = po.status.toLowerCase();
                  const isDraft =
                    statusLower === 'draft' || statusLower === 'submitted';
                  const isApproved =
                    statusLower === 'approved';
                  const isCancelled =
                    statusLower === 'cancelled' || statusLower === 'rejected';
                  const hasInward = hasInwardForPO(po, inwards);

                  return (
                    <tr
                      key={po.id || po.poId}
                      className="even:bg-slate-50/60 hover:bg-slate-100/70 transition-colors group border-b border-slate-200"
                    >
                      {/* PO Number - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 font-bold whitespace-nowrap align-middle text-left">
                        <div className="flex items-center gap-1.5">
                          {po.poNumber === 'PO/PENDING' ? (
                            <button
                              type="button"
                              onClick={() => onViewPO(po.id || po.poId)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:underline cursor-pointer"
                              title="View PO Details"
                            >
                              PO/PENDING
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onViewPO(po.id || po.poId)}
                              className="text-[#1F4E79] font-mono hover:underline cursor-pointer text-left"
                              title="View PO Details"
                            >
                              {po.poNumber}
                            </button>
                          )}
                          {po.revision && po.revision > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              R{po.revision}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Order Date - Center */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-600 text-center align-middle font-medium">
                        {formatDate(po.orderDate)}
                      </td>

                      {/* Customer - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 font-medium text-slate-900 max-w-[200px] truncate align-middle text-left">
                        <div>
                          <div className="truncate font-semibold text-slate-900">
                            {po.customerName}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {po.customerCode && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {po.customerCode}
                              </span>
                            )}
                            {(po.subcontractorName || po.subcompanyName) && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-normal truncate max-w-[150px]">
                                {po.subcontractorType === 'subcompany' ? 'Sub' : 'Subcon'}: {po.subcontractorName || po.subcompanyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Customer PO Number & Date - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap align-middle text-left">
                        {po.customerPoNumber ? (
                          <div>
                            <div className="font-mono font-semibold text-slate-800 text-xs">
                              {po.customerPoNumber}
                            </div>
                            {po.customerPoDate && (
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {formatDate(po.customerPoDate)}
                              </div>
                            )}
                          </div>
                        ) : po.customerPoDate ? (
                          <div className="text-[11px] text-slate-500 font-medium">
                            {formatDate(po.customerPoDate)}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">-</span>
                        )}
                      </td>

                      {/* Process Category - Center */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-center align-middle">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                            po.processCategory.toLowerCase() === 'washing'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {po.processCategory}
                        </span>
                      </td>

                      {/* Style & Item - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 max-w-[180px] truncate align-middle text-left">
                        <div className="font-semibold text-slate-800 truncate">
                          {po.styleNo || po.styleNumber}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {po.itemName}
                        </div>
                      </td>

                      {/* Total Qty - Right */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-right align-middle font-medium">
                        {renderQuantityDisplay(po)}
                      </td>

                      {/* Total Amount - Right */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 text-right font-black text-slate-900 whitespace-nowrap align-middle font-mono">
                        {formatCurrency(po.totalAmount)}
                      </td>

                      {/* Status - Center */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 text-center whitespace-nowrap align-middle">
                        <StatusChip status={po.status} />
                      </td>

                      {/* Actions - Left */}
                      <td
                        className="py-2.5 px-3.5 text-left whitespace-nowrap align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-start gap-1.5">
                          {isDraft ? (
                            <>
                              {/* DRAFT Status: ONLY Accept and Reject buttons */}
                              <button
                                type="button"
                                onClick={() => onApprovePO(po.id || po.poId)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectPO(po.id || po.poId)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <>
                              {/* 1. View */}
                              <button
                                type="button"
                                onClick={() => onViewPO(po.id || po.poId)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                              >
                                View
                              </button>

                              {/* 2. Edit - Available until all colour lines are invoiced completely */}
                              {canManage && !isCancelled && (() => {
                                const lockStatus = POLockService.isLocked(po, lockedPOMap);
                                if (lockStatus?.isFullyLocked) {
                                  return (
                                    <span
                                      title={lockStatus.reason || 'All colour lines have been invoiced completely. PO entry cannot be edited.'}
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      Edit
                                    </span>
                                  );
                                }
                                const poStatus = POLockService.getPOStatus(po, lockedPOMap);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => onEditPO(po.id || po.poId)}
                                    title={
                                      poStatus && poStatus.invoicedLinesCount > 0
                                        ? `${poStatus.invoicedLinesCount} of ${poStatus.totalLines} colour line(s) invoiced. Uninvoiced lines can be edited.`
                                        : undefined
                                    }
                                    className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors inline-flex items-center gap-1"
                                  >
                                    Edit
                                    {poStatus && poStatus.invoicedLinesCount > 0 && (
                                      <span className="text-[9px] bg-emerald-200/80 text-emerald-900 px-1 py-0.2 rounded-full font-bold">
                                        {poStatus.invoicedLinesCount}/{poStatus.totalLines}
                                      </span>
                                    )}
                                  </button>
                                );
                              })()}

                              {/* 3. Delete (Admin only - Not permitted if inward entered or locked) */}
                              {isAdmin && onDeletePO && (() => {
                                const poStatus = POLockService.getPOStatus(po, lockedPOMap);
                                if (poStatus && (poStatus.isFullyLocked || poStatus.approvedLinesCount > 0)) {
                                  return (
                                    <span
                                      title={poStatus.reason || 'Cannot delete: Colour lines have been moved to invoice generation.'}
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      Delete
                                    </span>
                                  );
                                }
                                if (hasInward) {
                                  return (
                                    <span
                                      title="Cannot delete: Inward has already been entered for this PO"
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      Delete
                                    </span>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setPoToDelete(po)}
                                    className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                );
                              })()}

                              {/* 4. Print */}
                              <button
                                type="button"
                                onClick={() => onPrintPO(po.id || po.poId)}
                                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
                              >
                                Print
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Sticky Totals Footer - Modular Component */}
            <TableTotalsFooter
              cells={[
                { colSpan: 6, label: `Total (${sortedPOs.length} ${sortedPOs.length === 1 ? 'order' : 'orders'})` },
                { pieces: totalPcsSum, kgs: totalKgSum, isTotal: true },
                { currency: totalValueSum, isTotal: true },
                { align: 'center' },
                { align: 'center' }
              ]}
            />
          </table>
        </div>

        {/* All Records Summary Bar - One Stretch */}
        <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span>
              Showing all <strong className="text-slate-900 font-bold">{sortedPOs.length}</strong> {sortedPOs.length === 1 ? 'record' : 'records'} in one stretch
            </span>
            {sortedPOs.length !== pos.length && (
              <span className="text-slate-400 font-normal">
                (filtered from {pos.length} total)
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Full view · Header stays at top
          </span>
        </div>
      </div>
        )}
      </TableMaximizeWrapper>

      {/* Delete Confirmation Popup Card - z-[120] to render over maximized modal */}
      {poToDelete && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPoToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Permanently?
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {poToDelete.poNumber}
                </p>
              </div>
            </div>

            {poToDelete && hasInwardForPO(poToDelete, inwards) ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Cannot Delete Purchase Order</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Inward entries have already been recorded for <strong className="font-bold text-amber-950">{poToDelete.poNumber}</strong>. Purchase Orders with inward records cannot be deleted.
                </p>
              </div>
            ) : (
              <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-3 space-y-1 text-xs text-rose-800">
                <div className="flex items-center gap-1.5 font-semibold text-rose-900">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>Confirm Permanent Deletion</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  This action will permanently delete purchase order <strong className="font-bold text-rose-950">{poToDelete.poNumber}</strong> ({poToDelete.customerName}) from the database. This action cannot be undone.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPoToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={Boolean(poToDelete && hasInwardForPO(poToDelete, inwards))}
                onClick={() => {
                  if (onDeletePO && poToDelete) {
                    if (hasInwardForPO(poToDelete, inwards)) {
                      alert('Cannot delete: Inward entries have already been entered for this PO.');
                      return;
                    }
                    const idToDelete = poToDelete.id || poToDelete.poId;
                    setPoToDelete(null);
                    onDeletePO(idToDelete);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold shadow-xs"
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
