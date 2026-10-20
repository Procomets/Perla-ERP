import React, { useState, useMemo } from 'react';
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
  Lock
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
  canManage: boolean; // Admin or Manager
  isAdmin?: boolean; // Admin only
  lockedPOMap?: Record<string, POLockStatus>;
}

export type POSortField =
  | 'poNumber'
  | 'customerName'
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
  canManage,
  isAdmin,
  lockedPOMap = {}
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);

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

  const handleResetFilters = () => {
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
    Boolean(filters.endDate);

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

  const sortedPOs = useMemo(() => {
    if (!sortField || !sortDirection) {
      // Default: Most recent entry first based on timestamp (createdAt / updatedAt / orderDate)
      return [...pos].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || a.orderDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || b.orderDate || 0).getTime();
        return timeB - timeA;
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...pos].sort((a, b) => {
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
  }, [pos, sortField, sortDirection]);

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
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PO Number, Customer, Style No, Item..."
              value={filters.searchQuery || ''}
              onChange={(e) =>
                onFilterChange({ ...filters, searchQuery: e.target.value })
              }
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79] transition-all"
            />
          </div>

          {/* Quick Filter Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Process Category Filter */}
            <select
              value={filters.processCategory || 'all'}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  processCategory: e.target.value as any
                })
              }
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#1F4E79]"
            >
              <option value="all">All Processes</option>
              <option value="washing">Washing</option>
              <option value="dyeing">Dyeing</option>
            </select>

            {/* Dynamic Status Filter */}
            <select
              value={(filters.status || 'all').toLowerCase()}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  status: e.target.value as any
                })
              }
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#1F4E79]"
            >
              <option value="all">All Statuses</option>
              {dynamicStatusOptions.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>

            {/* Customer Filter */}
            <select
              value={filters.customerId || ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  customerId: e.target.value || undefined
                })
              }
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#1F4E79] max-w-[160px] truncate"
            >
              <option value="">All Customers</option>
              {eligibleCustomers.map((c) => (
                <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>

            {/* Advanced Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-[#EEF5FB] border-[#BDD7EE] text-[#1F4E79]'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
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

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">
                Order Date From
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    startDate: e.target.value || undefined
                  })
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">
                Order Date To
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) =>
                  onFilterChange({
                    ...filters,
                    endDate: e.target.value || undefined
                  })
                }
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
              />
            </div>
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
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 uppercase tracking-wider font-bold text-[11px] border-b-2 border-slate-300">
                {/* 1. PO Number - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'poNumber' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('poNumber')}
                  title={getSortTooltip('poNumber', 'PO Number')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>PO Number</span>
                    {renderSortIcon('poNumber')}
                  </div>
                </th>

                {/* 2. Customer - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'customerName' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('customerName')}
                  title={getSortTooltip('customerName', 'Customer')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Customer</span>
                    {renderSortIcon('customerName')}
                  </div>
                </th>

                {/* 3. Process - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'processCategory' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('processCategory')}
                  title={getSortTooltip('processCategory', 'Process Category')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Process</span>
                    {renderSortIcon('processCategory')}
                  </div>
                </th>

                {/* 4. Style & Item - Left */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-left cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'styleNo' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('styleNo')}
                  title={getSortTooltip('styleNo', 'Style & Item')}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span>Style & Item</span>
                    {renderSortIcon('styleNo')}
                  </div>
                </th>

                {/* 5. Order Date - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'orderDate' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('orderDate')}
                  title={getSortTooltip('orderDate', 'Order Date')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Order Date</span>
                    {renderSortIcon('orderDate')}
                  </div>
                </th>

                {/* 6. Total Qty - Right */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'totalQuantity' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('totalQuantity')}
                  title={getSortTooltip('totalQuantity', 'Total Quantity')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Total Qty</span>
                    {renderSortIcon('totalQuantity')}
                  </div>
                </th>

                {/* 7. Value - Right */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'totalAmount' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('totalAmount')}
                  title={getSortTooltip('totalAmount', 'Value')}
                >
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Value (₹)</span>
                    {renderSortIcon('totalAmount')}
                  </div>
                </th>

                {/* 8. Status - Center */}
                <th
                  className={`py-3 px-3.5 border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap ${
                    sortField === 'status' ? 'bg-[#EEF5FB] text-[#1F4E79]' : 'hover:bg-slate-200/80'
                  }`}
                  onClick={() => handleSort('status')}
                  title={getSortTooltip('status', 'Status')}
                >
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 9. Actions - Left */}
                <th className="py-3 px-3.5 border-b-2 border-slate-300 text-left whitespace-nowrap bg-slate-100/90 text-slate-700">
                  <div className="flex items-center justify-start">
                    <span>Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedPOs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 border-b border-slate-200">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                        <Layers className="w-6 h-6" />
                      </div>
                      <div className="font-medium text-slate-600">
                        No purchase orders found
                      </div>
                      <p className="text-slate-400 max-w-sm text-xs">
                        {hasActiveFilters
                          ? 'Try clearing active search or filters to see more orders.'
                          : 'Create your first Purchase Order to begin recording customer processing orders.'}
                      </p>
                      {canManage && (
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
                      className="even:bg-slate-50/60 hover:bg-blue-50/50 transition-colors group cursor-pointer border-b border-slate-200"
                      onClick={() => onViewPO(po.id || po.poId)}
                    >
                      {/* PO Number - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 font-bold whitespace-nowrap align-middle text-left">
                        <div className="flex items-center gap-1.5">
                          {po.poNumber === 'PO/PENDING' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              PO/PENDING
                            </span>
                          ) : (
                            <span className="text-[#1F4E79] font-mono">{po.poNumber}</span>
                          )}
                          {po.revision && po.revision > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              R{po.revision}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer - Left */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 font-medium text-slate-900 max-w-[200px] truncate align-middle text-left">
                        <div>
                          <div className="truncate font-semibold">{po.customerName}</div>
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

                      {/* Order Date - Center */}
                      <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-600 text-center align-middle font-medium">
                        {formatDate(po.orderDate)}
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

                              {/* 2. Edit - If inward is entered, ONLY admin can edit */}
                              {canManage && !isCancelled && (() => {
                                const lockStatus = POLockService.isLocked(po, lockedPOMap);
                                if (lockStatus) {
                                  return (
                                    <span
                                      title={lockStatus.reason}
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      Edit
                                    </span>
                                  );
                                }
                                if (hasInward && !isAdmin) {
                                  return (
                                    <button
                                      type="button"
                                      disabled
                                      title="Inward has been entered for this PO. Only Admin can edit."
                                      className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded cursor-not-allowed opacity-60 inline-flex items-center gap-1"
                                    >
                                      <Lock className="w-3 h-3 text-slate-400" />
                                      Edit
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={() => onEditPO(po.id || po.poId)}
                                    className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                  >
                                    Edit
                                  </button>
                                );
                              })()}

                              {/* 3. Delete (Admin only - Not permitted if inward entered or locked) */}
                              {isAdmin && onDeletePO && (() => {
                                const lockStatus = POLockService.isLocked(po, lockedPOMap);
                                if (lockStatus) {
                                  return (
                                    <span
                                      title={lockStatus.reason}
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
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing{' '}
            <strong className="text-slate-800">
              {pos.length > 0
                ? (pagination.page - 1) * pagination.pageSize + 1
                : 0}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.totalRecords
              )}
            </strong>{' '}
            of{' '}
            <strong className="text-slate-800">
              {pagination.totalRecords}
            </strong>{' '}
            records
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-700 bg-slate-50 rounded-md border border-slate-200">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Popup Card */}
      {poToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
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
