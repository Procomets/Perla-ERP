import React, { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import {
  PurchaseOrder,
  POFilterOptions,
  POPagination,
  QuantityUnit
} from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import {
  formatCurrency,
  formatQuantity,
  formatDate
} from '../../../utils/formatters';

interface POListProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
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
  onPrintPO: (poId: string) => void;
  onAddNewPO: () => void;
  canManage: boolean; // Admin or Manager
}

export const POList: React.FC<POListProps> = ({
  pos,
  vendors,
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onViewPO,
  onEditPO,
  onSubmitPO,
  onApprovePO,
  onRejectPO,
  onCancelPO,
  onPrintPO,
  onAddNewPO,
  canManage
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Eligible customer vendors
  const eligibleCustomers = vendors.filter(
    (v) =>
      v.vendorType === 'customer' ||
      v.vendorType === 'both' ||
      v.roles?.includes('Customer') ||
      v.roles?.includes('Both')
  );

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

  const renderQuantityDisplay = (po: PurchaseOrder) => {
    const pcs = po.totalQtyByUnit?.piece || 0;
    const kgs = po.totalQtyByUnit?.kg || 0;

    if (pcs > 0 && kgs > 0) {
      return (
        <div>
          <div className="font-semibold text-slate-800">
            {formatQuantity(pcs, 'piece')}
          </div>
          <div className="text-[11px] text-slate-500">
            {formatQuantity(kgs, 'kg')}
          </div>
        </div>
      );
    }

    if (kgs > 0) {
      return (
        <span className="font-semibold text-slate-800">
          {formatQuantity(kgs, 'kg')}
        </span>
      );
    }

    const total = pcs > 0 ? pcs : po.totalQuantity || 0;
    const unit = po.colourLines[0]?.unit || 'piece';
    return (
      <span className="font-semibold text-slate-800">
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

            {/* Status Filter */}
            <select
              value={filters.status || 'all'}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  status: e.target.value as any
                })
              }
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-hidden focus:border-[#1F4E79]"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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

      {/* Purchase Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Process</th>
                <th className="py-3 px-4">Style & Item</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Total Qty</th>
                <th className="py-3 px-4 text-right">Value (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
                pos.map((po) => {
                  const statusLower = po.status.toLowerCase();
                  const isDraft =
                    statusLower === 'draft';
                  const isSubmitted =
                    statusLower === 'submitted';
                  const isApproved =
                    statusLower === 'approved';
                  const isCancelled =
                    statusLower === 'cancelled';

                  return (
                    <tr
                      key={po.id || po.poId}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onViewPO(po.id || po.poId)}
                    >
                      {/* PO Number */}
                      <td className="py-3.5 px-4 font-bold text-[#1F4E79] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{po.poNumber}</span>
                          {po.revision && po.revision > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              R{po.revision}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[200px] truncate">
                        <div>
                          <div className="truncate">{po.customerName}</div>
                          {po.customerCode && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {po.customerCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Process Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                            po.processCategory.toLowerCase() === 'washing'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}
                        >
                          {po.processCategory}
                        </span>
                      </td>

                      {/* Style & Item */}
                      <td className="py-3.5 px-4 max-w-[180px] truncate">
                        <div className="font-semibold text-slate-800 truncate">
                          {po.styleNo || po.styleNumber}
                        </div>
                        <div className="text-slate-500 text-[11px] truncate">
                          {po.itemName}
                        </div>
                      </td>

                      {/* Order Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        {formatDate(po.orderDate)}
                      </td>

                      {/* Total Qty */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderQuantityDisplay(po)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-black text-slate-900 whitespace-nowrap">
                        {formatCurrency(po.totalAmount)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <StatusChip status={po.status} />
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* View details */}
                          <button
                            type="button"
                            onClick={() => onViewPO(po.id || po.poId)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-[#1F4E79] hover:bg-[#EEF5FB] transition-colors cursor-pointer"
                            title="View PO Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print */}
                          <button
                            type="button"
                            onClick={() => onPrintPO(po.id || po.poId)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Print Work Order"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Edit Draft */}
                          {canManage && isDraft && (
                            <button
                              type="button"
                              onClick={() => onEditPO(po.id || po.poId)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Draft"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}

                          {/* Submit Draft */}
                          {canManage && isDraft && (
                            <button
                              type="button"
                              onClick={() => onSubmitPO(po.id || po.poId)}
                              className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Submit for Approval"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* Approve (if submitted or draft) */}
                          {canManage && (isSubmitted || isDraft) && (
                            <button
                              type="button"
                              onClick={() => onApprovePO(po.id || po.poId)}
                              className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Approve PO"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reject (if submitted) */}
                          {canManage && isSubmitted && (
                            <button
                              type="button"
                              onClick={() => onRejectPO(po.id || po.poId)}
                              className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Reject PO"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel PO */}
                          {canManage && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => onCancelPO(po.id || po.poId)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Cancel PO"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
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
    </div>
  );
};
