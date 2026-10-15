import React, { useState } from 'react';
import { OutwardEntry, OutwardFilterOptions, OutwardPagination } from '../../../types/outward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import { Search, Filter, Plus } from 'lucide-react';

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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="p-2.5 border border-slate-200 whitespace-nowrap">Outward No</th>
                    <th className="p-2.5 border border-slate-200 whitespace-nowrap">Dispatch Date</th>
                    <th className="p-2.5 border border-slate-200 whitespace-nowrap">Our DC Number</th>
                    <th className="p-2.5 border border-slate-200 min-w-[240px]">Customer / Company</th>
                    <th className="p-2.5 border border-slate-200 whitespace-nowrap min-w-[170px]">PO & Style</th>
                    <th className="p-2.5 border border-slate-200 text-right whitespace-nowrap">PO Qty</th>
                    <th className="p-2.5 border border-slate-200 text-right whitespace-nowrap">Total Inward</th>
                    <th className="p-2.5 border border-slate-200 text-right whitespace-nowrap">Prev Dispatched</th>
                    <th className="p-2.5 border border-slate-200 text-right whitespace-nowrap bg-blue-50/40 text-blue-900">This DC Dispatch</th>
                    <th className="p-2.5 border border-slate-200 text-right whitespace-nowrap">Balance After</th>
                    <th className="p-2.5 border border-slate-200 text-center whitespace-nowrap">Status</th>
                    <th className="p-2.5 border border-slate-200 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {outwards.map((row) => {
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

                        {/* 12. Actions: Clean text buttons */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onViewDetails(row.outwardId || row.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              View
                            </button>

                            {canManage && row.status === 'draft' && (
                              <button
                                onClick={() => onEdit(row.outwardId || row.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              >
                                Edit
                              </button>
                            )}

                            {isAdmin && row.status === 'draft' && (
                              <button
                                onClick={() => setDeleteTargetOutward(row)}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                              >
                                Delete
                              </button>
                            )}

                            {canManage && row.status === 'posted' && (
                              <button
                                onClick={() => onReverse(row.outwardId || row.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded transition-colors"
                              >
                                Reverse
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

      {/* Delete Draft Confirmation Modal */}
      {deleteTargetOutward && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteTargetOutward(null)}
          title="Delete Draft Outward Dispatch"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to delete draft outward{' '}
              <strong className="text-slate-900">{deleteTargetOutward.outwardNo}</strong>? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTargetOutward(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => {
                  onDelete(deleteTargetOutward.outwardId || deleteTargetOutward.id);
                  setDeleteTargetOutward(null);
                }}
              >
                Delete Draft
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
