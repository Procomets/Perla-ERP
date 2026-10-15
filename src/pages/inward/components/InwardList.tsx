import React, { useState } from 'react';
import { InwardEntry, InwardFilterOptions, InwardPagination } from '../../../types/inward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import { Search, Filter, Plus } from 'lucide-react';

interface InwardListProps {
  inwards: InwardEntry[];
  vendors: Vendor[];
  pos?: PurchaseOrder[];
  pagination: InwardPagination;
  filters: InwardFilterOptions;
  onFilterChange: (filters: InwardFilterOptions) => void;
  onPageChange: (page: number) => void;
  onNewInward: () => void;
  onViewDetails: (inwardId: string) => void;
  onPrint: (inwardId: string) => void;
  onEdit: (inwardId: string) => void;
  onDelete: (inwardId: string) => void;
  canManage: boolean;
  isAdmin: boolean;
  isLoading?: boolean;
}

export const InwardList: React.FC<InwardListProps> = ({
  inwards,
  vendors,
  pos = [],
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onNewInward,
  onViewDetails,
  onPrint,
  onEdit,
  onDelete,
  canManage,
  isAdmin,
  isLoading
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [deleteTargetInward, setDeleteTargetInward] = useState<InwardEntry | null>(null);

  // Floating hover popover state for Company and PO Number
  const [hoverCard, setHoverCard] = useState<{
    type: 'company' | 'po';
    row: InwardEntry;
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    type: 'company' | 'po',
    row: InwardEntry
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

  // List of active customers
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
      startDate: undefined,
      endDate: undefined
    });
  };

  // Helper to summarize quantities by unit
  const getQuantitySummaries = (row: InwardEntry) => {
    const lines = row.lines || [];
    let pieceOrdered = 0;
    let piecePrev = 0;
    let pieceReceived = 0;
    let pieceBalance = 0;

    let kgOrdered = 0;
    let kgPrev = 0;
    let kgReceived = 0;
    let kgBalance = 0;

    for (const l of lines) {
      const u = l.unit === 'kg' ? 'kg' : 'piece';
      const ord = Number(l.orderedQtySnapshot) || 0;
      const prev = Number(l.previouslyReceivedQtySnapshot) || 0;
      const rec = Number(l.receivedQty) || 0;
      const bal = Number(l.balanceAfterReceiptSnapshot) !== undefined ? Number(l.balanceAfterReceiptSnapshot) : Math.max(0, ord - (prev + rec));

      if (u === 'kg') {
        kgOrdered += ord;
        kgPrev += prev;
        kgReceived += rec;
        kgBalance += bal;
      } else {
        pieceOrdered += ord;
        piecePrev += prev;
        pieceReceived += rec;
        pieceBalance += bal;
      }
    }

    // Fallback if header totals exist
    if (pieceReceived === 0 && row.totalQtyByUnit?.piece) {
      pieceReceived = row.totalQtyByUnit.piece;
    }
    if (kgReceived === 0 && row.totalQtyByUnit?.kg) {
      kgReceived = row.totalQtyByUnit.kg;
    }

    return {
      ordered: { piece: pieceOrdered, kg: kgOrdered },
      prev: { piece: piecePrev, kg: kgPrev },
      received: { piece: pieceReceived, kg: kgReceived },
      balance: { piece: pieceBalance, kg: kgBalance }
    };
  };

  const renderUnitQty = (values: { piece: number; kg: number }, highlightClass: string = 'text-slate-800') => {
    const parts: string[] = [];
    if (values.piece > 0) parts.push(`${values.piece.toLocaleString()} pcs`);
    if (values.kg > 0) parts.push(`${values.kg.toLocaleString()} kg`);
    if (parts.length === 0) return <span className="text-slate-400">0</span>;

    return (
      <div className={`space-y-0.5 font-semibold ${highlightClass}`}>
        {parts.map((p, idx) => (
          <div key={idx}>{p}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Action and Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Inward No, DC No, PO, Style, or Customer..."
              value={filters.searchQuery || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent bg-slate-50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Filter className="w-3.5 h-3.5" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters {showFilters ? '(Hide)' : ''}
            </Button>

            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={onNewInward}
              >
                New Inward Receipt
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Bar */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-1.5 bg-white text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer</label>
              <select
                value={filters.customerId || 'all'}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-1.5 bg-white text-xs"
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value || undefined })}
                className="w-full border border-slate-300 rounded-md p-1.5 bg-white text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">To Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value || undefined })}
                  className="w-full border border-slate-300 rounded-md p-1.5 bg-white text-xs"
                />
                <button
                  onClick={handleClearFilters}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 whitespace-nowrap"
                  title="Clear all filters"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid Table Container */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-xs">Loading inward receipts from Firebase...</p>
          </div>
        ) : inwards.length === 0 ? (
          <div className="p-12 text-center">
            <h4 className="text-sm font-semibold text-slate-700">No inward receipts found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filters.searchQuery || filters.status !== 'all' || filters.customerId
                ? 'Try adjusting your search or active filters.'
                : 'Click "New Inward Receipt" to record the first customer fabric or garment delivery.'}
            </p>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={onNewInward}
                className="mt-4"
              >
                Create Inward Receipt
              </Button>
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300">
                  <tr>
                    <th className="p-2.5 border border-slate-300">Inward Number</th>
                    <th className="p-2.5 border border-slate-300 text-center whitespace-nowrap">Receipt Date</th>
                    <th className="p-2.5 border border-slate-300">Customer DC Number</th>
                    <th className="p-2.5 border border-slate-300 min-w-[260px] w-72">Customer / Company</th>
                    <th className="p-2.5 border border-slate-300 min-w-[170px]">PO Number</th>
                    <th className="p-2.5 border border-slate-300 text-right">PO Order Qty</th>
                    <th className="p-2.5 border border-slate-300 text-right">Previous Received Qty</th>
                    <th className="p-2.5 border border-slate-300 text-right bg-blue-50/50">Received Qty</th>
                    <th className="p-2.5 border border-slate-300 text-right">Balance Qty</th>
                    <th className="p-2.5 border border-slate-300 text-center">Status</th>
                    <th className="p-2.5 border border-slate-300 text-center w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {inwards.map((row) => {
                    const q = getQuantitySummaries(row);

                    return (
                      <tr key={row.inwardId || row.id} className="hover:bg-slate-50 transition-colors">
                        {/* 1. Inward Number ALONE (no icon, no ID underneath) */}
                        <td className="p-2.5 border border-slate-200 font-bold text-[#1F4E79] whitespace-nowrap">
                          <button
                            onClick={() => onViewDetails(row.inwardId || row.id)}
                            className="hover:underline text-left"
                            title="View inward details"
                          >
                            {row.inwardNo || row.entryId || 'INW/PENDING'}
                          </button>
                        </td>

                        {/* 2. Receipt Date (Second Column) */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap text-slate-700 font-medium">
                          {formatDate(row.inwardDate || row.customerDate)}
                        </td>

                        {/* 3. Customer DC Number (normal plain text, no box) */}
                        <td className="p-2.5 border border-slate-200 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{row.customerDcNo}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            DC Date: {formatDate(row.customerDate)}
                          </div>
                        </td>

                        {/* 4. Customer / Company (Increased Width + Hover Details) */}
                        <td className="p-2.5 border border-slate-200 min-w-[260px]">
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

                        {/* 5. PO Number & Style (Hover Details) */}
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

                        {/* 7. Previous Received Quantity */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.prev, 'text-slate-500')}
                        </td>

                        {/* 8. Received Quantity in This DC */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap bg-blue-50/20">
                          {renderUnitQty(q.received, 'text-emerald-700')}
                        </td>

                        {/* 9. Balance Quantity After Receipt */}
                        <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                          {renderUnitQty(q.balance, 'text-[#1F4E79]')}
                        </td>

                        {/* 10. Status */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                          {row.status === 'posted' && <StatusChip status="Posted" variant="green" />}
                          {row.status === 'draft' && <StatusChip status="Draft" variant="slate" />}
                          {row.status === 'reversed' && <StatusChip status="Reversed" variant="rose" />}
                          {row.status === 'cancelled' && <StatusChip status="Cancelled" variant="rose" />}
                          {!['posted', 'draft', 'reversed', 'cancelled'].includes(row.status) && (
                            <StatusChip status={row.status} variant="amber" />
                          )}
                        </td>

                        {/* 11. Actions: Clean Text Buttons, No Icons, Edit & Admin-only Delete */}
                        <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onViewDetails(row.inwardId || row.id)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            >
                              View
                            </button>

                            {canManage && (
                              <button
                                onClick={() => onEdit(row.inwardId || row.id)}
                                className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                              >
                                Edit
                              </button>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => setDeleteTargetInward(row)}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                              >
                                Delete
                              </button>
                            )}

                            <button
                              onClick={() => onPrint(row.inwardId || row.id)}
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

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 bg-slate-50">
              <div>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.totalRecords)} of{' '}
                {pagination.totalRecords} entries
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

      {/* Admin Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetInward}
        onClose={() => setDeleteTargetInward(null)}
        title="Confirm Inward Receipt Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
            <p className="font-bold">Are you sure you want to delete this Inward Receipt?</p>
            <p className="font-mono font-bold text-rose-700">
              {deleteTargetInward?.inwardNo || deleteTargetInward?.entryId}
            </p>
            <p className="text-[11px] text-rose-600">
              This action is restricted to Administrators only. Deleting this record will remove it
              from the system and re-calculate PO receipt balances.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setDeleteTargetInward(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (deleteTargetInward) {
                  onDelete(deleteTargetInward.inwardId || deleteTargetInward.id);
                  setDeleteTargetInward(null);
                }
              }}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              Delete Inward Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Hover Popover for Company / PO */}
      {hoverCard && (
        <div
          className="fixed z-50 w-80 bg-white border border-slate-300 rounded-xl shadow-2xl p-4 text-xs pointer-events-none transition-all"
          style={{
            top: hoverCard.top !== undefined ? `${hoverCard.top}px` : undefined,
            bottom: hoverCard.bottom !== undefined ? `${hoverCard.bottom}px` : undefined,
            left: `${hoverCard.left}px`,
          }}
        >
          {hoverCard.type === 'company' && (() => {
            const row = hoverCard.row;
            const vendor = vendors.find(
              (v) =>
                v.vendorId === row.customerVendorId ||
                v.id === row.customerVendorId ||
                v.companyName === row.customerCompanyNameSnapshot ||
                v.companyName === row.customerName
            );
            const subVendor = vendors.find(
              (v) =>
                v.vendorId === row.subcontractorVendorId ||
                v.vendorId === row.subContractorId ||
                v.companyName === row.subcontractorNameSnapshot
            );

            const companyName =
              vendor?.companyName ||
              row.customerCompanyNameSnapshot ||
              row.customerName ||
              'Customer Company';
            const vendorCode = vendor?.vendorCode || (row as any).customerCode || 'N/A';
            const category = vendor?.vendorCategory
              ? vendor.vendorCategory.replace('_', ' ')
              : 'Main Company';
            const type = vendor?.vendorType || 'Customer';
            const gstin = vendor?.taxDetails?.gstin || vendor?.gstin || 'Unregistered';
            const pan = vendor?.taxDetails?.pan || vendor?.pan || 'N/A';
            const location =
              [vendor?.address?.city, vendor?.address?.state].filter(Boolean).join(', ') ||
              'Tamil Nadu';
            const phone =
              vendor?.communication?.mobileNumber ||
              vendor?.communication?.officePhone ||
              'N/A';
            const email = vendor?.communication?.officialEmail || vendor?.email || 'N/A';
            const paymentTerms = vendor?.financialDetails?.paymentTerms
              ? String(vendor.financialDetails.paymentTerms).replace('_', ' ')
              : 'Standard';

            return (
              <div className="space-y-2.5">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#1F4E79] tracking-wider">
                      Company Profile
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                      {vendorCode}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-0.5 leading-snug">
                    {companyName}
                  </h4>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {type} · {category}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">GSTIN</span>
                    <span className="font-semibold text-slate-800">{gstin}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">PAN</span>
                    <span className="font-semibold text-slate-800">{pan}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">City / State</span>
                    <span className="font-medium text-slate-700">{location}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Payment Terms</span>
                    <span className="font-medium text-slate-700 capitalize">{paymentTerms}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Phone</span>
                    <span className="font-medium text-slate-700">{phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Email</span>
                    <span className="font-medium text-slate-700 truncate block" title={email}>{email}</span>
                  </div>
                </div>

                {row.subcontractorNameSnapshot && (
                  <div className="pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded text-[11px]">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                      Subcontractor / Subcompany Unit
                    </span>
                    <span className="font-bold text-slate-800">
                      {row.subcontractorNameSnapshot}
                    </span>
                    {subVendor?.vendorCode && (
                      <span className="text-slate-500 ml-1">
                        ({subVendor.vendorCode})
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {hoverCard.type === 'po' && (() => {
            const row = hoverCard.row;
            const po = (pos || []).find(
              (p) =>
                p.poId === row.poId ||
                p.id === row.poId ||
                p.poNumber === row.poNumberSnapshot ||
                p.poNumber === row.poNumber
            );

            const poNumber = po?.poNumber || row.poNumberSnapshot || row.poNumber;
            const styleNo = po?.styleNo || row.styleNoSnapshot || 'N/A';
            const itemName = po?.itemName || row.itemNameSnapshot || 'Garments / Fabric';
            const process = po?.processCategory || row.processCategorySnapshot || 'Washing';
            const orderDate = formatDate(po?.orderDate || row.customerDate);
            const deliveryDate = po?.deliveryDate ? formatDate(po.deliveryDate) : 'As per schedule';
            const status = po?.status || 'Approved';

            let totalQtyText = '';
            if (po?.totalQtyByUnit?.piece) totalQtyText += `${po.totalQtyByUnit.piece.toLocaleString()} pcs `;
            if (po?.totalQtyByUnit?.kg) totalQtyText += `${po.totalQtyByUnit.kg.toLocaleString()} kg`;
            if (!totalQtyText && po?.totalQuantity) totalQtyText = `${po.totalQuantity.toLocaleString()} units`;
            if (!totalQtyText) totalQtyText = 'Per PO Line items';

            return (
              <div className="space-y-2.5">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-[#1F4E79] tracking-wider">
                      Purchase Order
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-[#1F4E79] border border-blue-200/60">
                      {status}
                    </span>
                  </div>
                  <h4 className="font-bold text-[#1F4E79] text-sm mt-0.5 leading-snug">
                    {poNumber}
                  </h4>
                  <p className="text-[11px] text-slate-600 font-medium">
                    Style: <span className="font-bold text-slate-800">{styleNo}</span> · {itemName}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Process Category</span>
                    <span className="font-semibold text-slate-800 capitalize">{process}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Total Order Qty</span>
                    <span className="font-bold text-emerald-700">{totalQtyText}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Order Date</span>
                    <span className="font-medium text-slate-700">{orderDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Expected Delivery</span>
                    <span className="font-medium text-slate-700">{deliveryDate}</span>
                  </div>
                  {po?.customerReferenceNo && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Customer Ref No</span>
                      <span className="font-medium text-slate-800">{po.customerReferenceNo}</span>
                    </div>
                  )}
                </div>

                {po?.colourLines && po.colourLines.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">
                      Ordered Colour Breakdown
                    </span>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {po.colourLines.slice(0, 4).map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                          <span className="font-medium truncate mr-2">{c.colourName}</span>
                          <span className="font-bold whitespace-nowrap">
                            {c.quantity.toLocaleString()} {c.unit}
                          </span>
                        </div>
                      ))}
                      {po.colourLines.length > 4 && (
                        <div className="text-[9px] text-slate-400 italic text-center">
                          +{po.colourLines.length - 4} more colours in PO
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
