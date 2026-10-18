import React, { useState, useMemo } from 'react';
import { OutwardEntry, OutwardFilterOptions, OutwardPagination } from '../../../types/outward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import { Search, Filter, Plus, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export type OutwardSortField =
  | 'outwardNo'
  | 'outwardDate'
  | 'ourDcNo'
  | 'customerName'
  | 'poNumber'
  | 'poQty'
  | 'totalInward'
  | 'prevDispatched'
  | 'thisDispatch'
  | 'balanceAfter'
  | 'status';

export type SortDirection = 'asc' | 'desc' | null;

interface OutwardListProps {
  outwards: OutwardEntry[];
  vendors: Vendor[];
  pos?: PurchaseOrder[];
  pagination: OutwardPagination;
  filters: OutwardFilterOptions;
  onFilterChange: (filters: OutwardFilterOptions) => void;
  onPageChange: (page: number) => void;
  onNewOutward: () => void;
  onViewDetails: (outwardId: string) => void;
  onPrint: (outwardId: string) => void;
  onEdit: (outwardId: string) => void;
  onDelete: (outwardId: string) => void;
  onReverse: (outwardId: string) => void;
  canManage: boolean;
  isAdmin: boolean;
  isLoading?: boolean;
}

export const OutwardList: React.FC<OutwardListProps> = ({
  outwards,
  vendors,
  pos = [],
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onNewOutward,
  onViewDetails,
  onPrint,
  onEdit,
  onDelete,
  onReverse,
  canManage,
  isAdmin,
  isLoading
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTargetOutward, setDeleteTargetOutward] = useState<OutwardEntry | null>(null);

  // Floating hover popover state for Company and PO Number
  const [hoverCard, setHoverCard] = useState<{
    type: 'company' | 'po';
    row: OutwardEntry;
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);

  // 3-State Column Sorting (asc -> desc -> unsort/desort)
  const [sortField, setSortField] = useState<OutwardSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: OutwardSortField) => {
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

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    type: 'company' | 'po',
    row: OutwardEntry
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverEstimatedHeight = 260;
    const showAbove = rect.bottom + popoverEstimatedHeight > window.innerHeight;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - popoverWidth - 16);

    if (showAbove) {
      setHoverCard({
        type,
        row,
        bottom: window.innerHeight - rect.top + 6,
        left
      });
    } else {
      setHoverCard({
        type,
        row,
        top: rect.bottom + 6,
        left
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverCard(null);
  };

  const customers = vendors.filter((v) => v.vendorType === 'customer' || v.vendorType === 'both');

  const handleSearchChange = (val: string) => {
    onFilterChange({ ...filters, searchQuery: val });
  };

  const handleStatusChange = (val: string) => {
    onFilterChange({ ...filters, status: val as any });
  };

  const handleCustomerChange = (val: string) => {
    onFilterChange({ ...filters, customerId: val === 'all' ? undefined : val });
  };

  const handleClearFilters = () => {
    onFilterChange({
      searchQuery: '',
      status: 'all',
      customerId: undefined,
      dateFrom: undefined,
      dateTo: undefined
    });
  };

  // Helper to summarize quantities by unit
  const getQuantitySummaries = (row: OutwardEntry) => {
    const lines = row.lines || [];
    let pieceOrdered = 0;
    let pieceInward = 0;
    let piecePrevOutward = 0;
    let pieceDispatched = 0;
    let pieceRemaining = 0;

    let kgOrdered = 0;
    let kgInward = 0;
    let kgPrevOutward = 0;
    let kgDispatched = 0;
    let kgRemaining = 0;

    for (const l of lines) {
      const u = l.unit === 'kg' ? 'kg' : 'piece';
      const ord = Number(l.orderedQtySnapshot) || 0;
      const inw = Number(l.cumulativeInwardQtySnapshot) || 0;
      const prev = Number(l.previouslyDispatchedQtySnapshot) || 0;
      const disp = Number(l.dispatchQty) || 0;
      const rem =
        Number(l.remainingAfterDispatchSnapshot) !== undefined
          ? Number(l.remainingAfterDispatchSnapshot)
          : Math.max(0, inw - (prev + disp));

      if (u === 'kg') {
        kgOrdered += ord;
        kgInward += inw;
        kgPrevOutward += prev;
        kgDispatched += disp;
        kgRemaining += rem;
      } else {
        pieceOrdered += ord;
        pieceInward += inw;
        piecePrevOutward += prev;
        pieceDispatched += disp;
        pieceRemaining += rem;
      }
    }

    return {
      ordered: { piece: pieceOrdered, kg: Math.round(kgOrdered * 100) / 100 },
      inward: { piece: pieceInward, kg: Math.round(kgInward * 100) / 100 },
      prevOutward: { piece: piecePrevOutward, kg: Math.round(kgPrevOutward * 100) / 100 },
      dispatched: { piece: pieceDispatched, kg: Math.round(kgDispatched * 100) / 100 },
      remaining: { piece: pieceRemaining, kg: Math.round(kgRemaining * 100) / 100 }
    };
  };

  const renderUnitQty = (
    data: { piece: number; kg: number },
    colorClass: string = 'text-slate-700'
  ) => {
    const parts = [];
    if (data.piece > 0 || data.kg === 0) {
      parts.push(
        <span key="pc" className="font-medium">
          {data.piece.toLocaleString()}{' '}
          <span className="text-[10px] text-slate-400 font-normal">pcs</span>
        </span>
      );
    }
    if (data.kg > 0) {
      parts.push(
        <span key="kg" className="font-medium text-amber-700">
          {data.kg.toLocaleString()}{' '}
          <span className="text-[10px] text-amber-500 font-normal">kg</span>
        </span>
      );
    }
    return <div className={`flex flex-col items-end gap-0.5 text-xs ${colorClass}`}>{parts}</div>;
  };

  const sortedOutwards = useMemo(() => {
    if (!sortField || !sortDirection) {
      return outwards;
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...outwards].sort((a, b) => {
      const qA = getQuantitySummaries(a);
      const qB = getQuantitySummaries(b);

      switch (sortField) {
        case 'outwardNo':
          return (
            (a.outwardNo || a.entryId || '').localeCompare(b.outwardNo || b.entryId || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            }) * mult
          );
        case 'outwardDate': {
          const dateA = a.outwardDate ? new Date(a.outwardDate).getTime() : 0;
          const dateB = b.outwardDate ? new Date(b.outwardDate).getTime() : 0;
          return (dateA - dateB) * mult;
        }
        case 'ourDcNo':
          return (a.ourDcNo || '').localeCompare(b.ourDcNo || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          }) * mult;
        case 'customerName': {
          const nameA = a.customerCompanyNameSnapshot || a.customerName || '';
          const nameB = b.customerCompanyNameSnapshot || b.customerName || '';
          return nameA.localeCompare(nameB) * mult;
        }
        case 'poNumber': {
          const poA = `${a.poNumberSnapshot || a.poNumber || ''} ${a.styleNoSnapshot || a.styleNo || ''}`;
          const poB = `${b.poNumberSnapshot || b.poNumber || ''} ${b.styleNoSnapshot || b.styleNo || ''}`;
          return poA.localeCompare(poB, undefined, { numeric: true, sensitivity: 'base' }) * mult;
        }
        case 'poQty': {
          const totA = qA.ordered.piece + qA.ordered.kg;
          const totB = qB.ordered.piece + qB.ordered.kg;
          return (totA - totB) * mult;
        }
        case 'totalInward': {
          const totA = qA.inward.piece + qA.inward.kg;
          const totB = qB.inward.piece + qB.inward.kg;
          return (totA - totB) * mult;
        }
        case 'prevDispatched': {
          const totA = qA.prevOutward.piece + qA.prevOutward.kg;
          const totB = qB.prevOutward.piece + qB.prevOutward.kg;
          return (totA - totB) * mult;
        }
        case 'thisDispatch': {
          const totA = qA.dispatched.piece + qA.dispatched.kg || Number(a.totalQuantity) || 0;
          const totB = qB.dispatched.piece + qB.dispatched.kg || Number(b.totalQuantity) || 0;
          return (totA - totB) * mult;
        }
        case 'balanceAfter': {
          const totA = qA.remaining.piece + qA.remaining.kg;
          const totB = qB.remaining.piece + qB.remaining.kg;
          return (totA - totB) * mult;
        }
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * mult;
        default:
          return 0;
      }
    });
  }, [outwards, sortField, sortDirection]);

  const renderSortIcon = (field: OutwardSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-200/80 text-[#1F4E79] shadow-2xs">
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-200/80 text-[#1F4E79] shadow-2xs">
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

  const getSortTooltip = (field: OutwardSortField, label: string) => {
    if (sortField !== field || !sortDirection) {
      return `Click to sort ${label} ascending`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ascending. Click to sort descending`;
    }
    return `Currently sorted descending. Click to desort`;
  };

  const getSortColumnLabel = (field: OutwardSortField) => {
    switch (field) {
      case 'outwardNo':
        return 'Outward No';
      case 'outwardDate':
        return 'Dispatch Date';
      case 'ourDcNo':
        return 'Our DC Number';
      case 'customerName':
        return 'Customer / Company';
      case 'poNumber':
        return 'PO & Style';
      case 'poQty':
        return 'PO Qty';
      case 'totalInward':
        return 'Total Inward';
      case 'prevDispatched':
        return 'Prev Dispatched';
      case 'thisDispatch':
        return 'This DC Dispatch';
      case 'balanceAfter':
        return 'Balance After';
      case 'status':
        return 'Status';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Outward No, Our DC No, PO, Style, Customer..."
              value={filters.searchQuery || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 shrink-0 text-xs py-1.5 h-auto"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </Button>
        </div>

        {canManage && (
          <Button
            onClick={onNewOutward}
            size="sm"
            className="bg-[#1F4E79] hover:bg-[#163858] text-white flex items-center gap-1.5 shrink-0 text-xs py-1.5 h-auto shadow-2xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            New Outward Entry
          </Button>
        )}
      </div>

      {/* Expanded Filters Drawer */}
      {showFilters && (
        <Card className="p-4 bg-slate-50/70 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Status
              </label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="all">All Statuses</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Customer Company
              </label>
              <select
                value={filters.customerId || 'all'}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Dispatch Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value || undefined })}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
              </input>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Dispatch Date To
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value || undefined })}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
              </input>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
              Clear All
            </Button>
            <Button
              size="sm"
              onClick={() => setShowFilters(false)}
              className="bg-[#1F4E79] text-white text-xs"
            >
              Apply Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Main Table Card */}
      <Card className="border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading Outward dispatches...</div>
        ) : outwards.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">No Outward Dispatches Found</p>
            <p className="text-xs text-slate-400">
              No dispatches match the selected filter criteria or no outwards have been created yet.
            </p>
            {canManage && (
              <Button
                onClick={onNewOutward}
                size="sm"
                className="bg-[#1F4E79] text-white text-xs mt-2"
              >
                Create First Outward Entry
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Active Sort / Desort Banner */}
            {sortField && sortDirection && (
              <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50/90 border-b border-blue-200 text-xs text-[#1F4E79]">
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
                  title="Reset to default order"
                >
                  Clear / Desort
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold border-b-2 border-slate-300 uppercase tracking-wider text-[11px]">
                    {/* 1. Outward No */}
                    <th
                      className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'outwardNo' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('outwardNo')}
                      title={getSortTooltip('outwardNo', 'Outward No')}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>Outward No</span>
                        {renderSortIcon('outwardNo')}
                      </div>
                    </th>

                    {/* 2. Dispatch Date */}
                    <th
                      className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'outwardDate' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('outwardDate')}
                      title={getSortTooltip('outwardDate', 'Dispatch Date')}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>Dispatch Date</span>
                        {renderSortIcon('outwardDate')}
                      </div>
                    </th>

                    {/* 3. Our DC Number */}
                    <th
                      className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'ourDcNo' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('ourDcNo')}
                      title={getSortTooltip('ourDcNo', 'Our DC Number')}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>Our DC Number</span>
                        {renderSortIcon('ourDcNo')}
                      </div>
                    </th>

                    {/* 4. Customer / Company */}
                    <th
                      className={`p-2.5 border border-slate-200 min-w-[240px] cursor-pointer select-none transition-colors group ${
                        sortField === 'customerName' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('customerName')}
                      title={getSortTooltip('customerName', 'Customer / Company')}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>Customer / Company</span>
                        {renderSortIcon('customerName')}
                      </div>
                    </th>

                    {/* 5. PO & Style */}
                    <th
                      className={`p-2.5 border border-slate-200 min-w-[170px] cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'poNumber' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('poNumber')}
                      title={getSortTooltip('poNumber', 'PO & Style')}
                    >
                      <div className="flex items-center gap-1.5 justify-start">
                        <span>PO & Style</span>
                        {renderSortIcon('poNumber')}
                      </div>
                    </th>

                    {/* 6. PO Qty */}
                    <th
                      className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'poQty' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('poQty')}
                      title={getSortTooltip('poQty', 'PO Qty')}
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>PO Qty</span>
                        {renderSortIcon('poQty')}
                      </div>
                    </th>

                    {/* 7. Total Inward */}
                    <th
                      className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'totalInward' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('totalInward')}
                      title={getSortTooltip('totalInward', 'Total Inward')}
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>Total Inward</span>
                        {renderSortIcon('totalInward')}
                      </div>
                    </th>

                    {/* 8. Prev Dispatched */}
                    <th
                      className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'prevDispatched' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('prevDispatched')}
                      title={getSortTooltip('prevDispatched', 'Prev Dispatched')}
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>Prev Dispatched</span>
                        {renderSortIcon('prevDispatched')}
                      </div>
                    </th>

                    {/* 9. This DC Dispatch */}
                    <th
                      className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap bg-blue-50/40 text-blue-900 ${
                        sortField === 'thisDispatch' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('thisDispatch')}
                      title={getSortTooltip('thisDispatch', 'This DC Dispatch')}
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>This DC Dispatch</span>
                        {renderSortIcon('thisDispatch')}
                      </div>
                    </th>

                    {/* 10. Balance After */}
                    <th
                      className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap ${
                        sortField === 'balanceAfter' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                      }`}
                      onClick={() => handleSort('balanceAfter')}
                      title={getSortTooltip('balanceAfter', 'Balance After')}
                    >
                      <div className="flex items-center gap-1.5 justify-end">
                        <span>Balance After</span>
                        {renderSortIcon('balanceAfter')}
                      </div>
                    </th>

                    {/* 11. Status */}
                    <th
                      className={`p-2.5 border border-slate-200 text-center cursor-pointer select-none transition-colors group whitespace-nowrap ${
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

                    {/* 12. Actions */}
                    <th className="p-2.5 border border-slate-200 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sortedOutwards.map((row) => {
                    const q = getQuantitySummaries(row);

                    return (
                      <tr key={row.outwardId || row.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* 1. Outward No */}
                        <td className="p-2.5 border border-slate-200 whitespace-nowrap">
                          <button
                            onClick={() => onViewDetails(row.outwardId || row.id)}
                            className="font-bold text-[#1F4E79] hover:underline"
                          >
                            {row.outwardNo}
                          </button>
                        </td>

                        {/* 2. Dispatch Date */}
                        <td className="p-2.5 border border-slate-200 whitespace-nowrap text-slate-600 font-medium">
                          {formatDate(row.outwardDate)}
                        </td>

                        {/* 3. Our DC Number (normal plain text, no box) */}
                        <td className="p-2.5 border border-slate-200 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{row.ourDcNo}</div>
                          {row.vehicleNumber && (
                            <div className="text-[11px] text-slate-500 font-normal">
                              Veh: {row.vehicleNumber}
                            </div>
                          )}
                        </td>

                        {/* 4. Customer / Company (with Hover details) */}
                        <td className="p-2.5 border border-slate-200 min-w-[240px]">
                          <div
                            onMouseEnter={(e) => handleMouseEnter(e, 'company', row)}
                            onMouseLeave={handleMouseLeave}
                            className="cursor-pointer group/comp inline-block"
                          >
                            <div className="font-semibold text-slate-900 group-hover/comp:text-[#1F4E79] group-hover/comp:underline transition-colors">
                              {row.customerCompanyNameSnapshot || row.customerName || 'Customer'}
                            </div>
                            {row.subcontractorNameSnapshot && (
                              <div className="text-[11px] text-slate-500 font-normal">
                                Sub: {row.subcontractorNameSnapshot}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 5. PO Number & Style */}
                        <td className="p-2.5 border border-slate-200 whitespace-nowrap min-w-[170px]">
                          <div
                            onMouseEnter={(e) => handleMouseEnter(e, 'po', row)}
                            onMouseLeave={handleMouseLeave}
                            className="cursor-pointer group/po inline-block"
                          >
                            <div className="font-bold text-[#1F4E79] group-hover/po:underline transition-colors">
                              {row.poNumberSnapshot || row.poNumber}
                            </div>
                            <div className="text-[11px] text-slate-500 font-normal">
                              Style: {row.styleNoSnapshot || row.styleNo}
                            </div>
                          </div>
                        </td>

                        {/* 6. PO Order Quantity */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.ordered, 'text-slate-700')}
                        </td>

                        {/* 7. Total Inward Received */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.inward, 'text-slate-600')}
                        </td>

                        {/* 8. Previous Dispatched Quantity */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.prevOutward, 'text-slate-500')}
                        </td>

                        {/* 9. This DC Dispatch Quantity */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap bg-blue-50/20">
                          {renderUnitQty(q.dispatched, 'text-blue-700 font-bold')}
                        </td>

                        {/* 10. Balance Quantity After Dispatch */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.remaining, 'text-[#1F4E79]')}
                        </td>

                        {/* 11. Status */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                          {row.status === 'posted' && <StatusChip status="Posted" variant="green" />}
                          {row.status === 'draft' && <StatusChip status="Draft" variant="slate" />}
                          {row.status === 'reversed' && <StatusChip status="Reversed" variant="rose" />}
                          {row.status === 'cancelled' && <StatusChip status="Cancelled" variant="rose" />}
                          {!['posted', 'draft', 'reversed', 'cancelled'].includes(row.status) && (
                            <StatusChip status={row.status} variant="amber" />
                          )}
                        </td>

                        {/* 12. Actions: Clean text buttons matching Inward (View, Edit, Delete, Print) */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onViewDetails(row.outwardId || row.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              View
                            </button>

                            {canManage && (
                              <button
                                onClick={() => onEdit(row.outwardId || row.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              >
                                Edit
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => setDeleteTargetOutward(row)}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                              >
                                Delete
                              </button>
                            )}

                            <button
                              onClick={() => onPrint(row.outwardId || row.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded transition-colors"
                            >
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 bg-slate-50">
              <div>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of{' '}
                {pagination.totalCount} entries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => onPageChange(pagination.page - 1)}
                >
                  Previous
                </Button>
                <span className="px-2 font-medium text-slate-700">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => onPageChange(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Hover Floating Details Card */}
      {hoverCard && (
        <div
          style={{
            position: 'fixed',
            top: hoverCard.top !== undefined ? `${hoverCard.top}px` : undefined,
            bottom: hoverCard.bottom !== undefined ? `${hoverCard.bottom}px` : undefined,
            left: `${hoverCard.left}px`,
            zIndex: 9999
          }}
          className="w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-xs space-y-3 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          {hoverCard.type === 'company' ? (
            <>
              <div className="border-b border-slate-100 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Customer / Company Overview
                </p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {hoverCard.row.customerCompanyNameSnapshot || hoverCard.row.customerName}
                </p>
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer ID:</span>
                  <span className="font-semibold text-slate-800">
                    {hoverCard.row.customerVendorId || hoverCard.row.customerId}
                  </span>
                </div>
                {hoverCard.row.subcontractorNameSnapshot && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subcontractor:</span>
                    <span className="font-semibold text-slate-800">
                      {hoverCard.row.subcontractorNameSnapshot}
                    </span>
                  </div>
                )}
                {hoverCard.row.destination && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="font-medium text-slate-800 text-right">
                      {hoverCard.row.destination}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="border-b border-slate-100 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Purchase Order Overview
                </p>
                <p className="text-sm font-bold text-[#1F4E79] mt-0.5">
                  {hoverCard.row.poNumberSnapshot || hoverCard.row.poNumber}
                </p>
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Style Number:</span>
                  <span className="font-semibold text-slate-800">
                    {hoverCard.row.styleNoSnapshot || hoverCard.row.styleNo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Item Name:</span>
                  <span className="font-medium text-slate-800">
                    {hoverCard.row.itemNameSnapshot || hoverCard.row.itemName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Process Category:</span>
                  <span className="font-semibold uppercase text-slate-800">
                    {hoverCard.row.processCategorySnapshot || hoverCard.row.processCategory}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetOutward}
        onClose={() => setDeleteTargetOutward(null)}
        title="Confirm Outward Dispatch Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
            <p className="font-bold">Are you sure you want to delete this Outward Dispatch?</p>
            <p className="font-mono font-bold text-rose-700">
              {deleteTargetOutward?.outwardNo || deleteTargetOutward?.entryId}
            </p>
            <p className="text-[11px] text-rose-600">
              This action is restricted to Administrators only. Deleting this record will remove it
              from the system and re-calculate outward dispatch balances.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTargetOutward(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-rose-700 hover:bg-rose-800 text-white"
              onClick={() => {
                if (deleteTargetOutward) {
                  onDelete(deleteTargetOutward.outwardId || deleteTargetOutward.id);
                  setDeleteTargetOutward(null);
                }
              }}
            >
              Delete Outward Dispatch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
