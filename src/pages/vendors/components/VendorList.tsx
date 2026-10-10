import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  Edit,
  UserPlus,
  GitFork,
  CheckCircle2,
  XCircle,
  History,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Building,
  RotateCcw
} from 'lucide-react';
import { Vendor, VendorFilterOptions, VendorPagination } from '../../../types/vendor';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';

interface VendorListProps {
  vendors: Vendor[];
  pagination: VendorPagination;
  filters: VendorFilterOptions;
  onFilterChange: (newFilters: VendorFilterOptions) => void;
  onPageChange: (newPage: number) => void;
  onViewVendor: (vendorId: string) => void;
  onEditVendor: (vendorId: string) => void;
  onAddContact: (vendorId: string) => void;
  onViewSubcompanies: (vendorId: string) => void;
  onToggleStatus: (vendorId: string, currentStatus: 'active' | 'inactive') => void;
  onViewHistory: (vendorId: string) => void;
  onAddNewVendor: () => void;
}

export const VendorList: React.FC<VendorListProps> = ({
  vendors,
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onViewVendor,
  onEditVendor,
  onAddContact,
  onViewSubcompanies,
  onToggleStatus,
  onViewHistory,
  onAddNewVendor
}) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const indianStates = [
    'Tamil Nadu',
    'Gujarat',
    'Maharashtra',
    'Karnataka',
    'Andhra Pradesh',
    'Telangana',
    'Punjab',
    'Rajasthan',
    'Kerala',
    'West Bengal',
    'Delhi'
  ];

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, searchQuery: e.target.value });
  };

  const handleResetFilters = () => {
    onFilterChange({
      searchQuery: '',
      vendorType: 'all',
      status: 'all',
      state: '',
      gstStatus: 'all',
      hasSubcompany: 'all',
      missingDetails: false
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Search & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Company Name, Vendor Code (VND-...), GSTIN, Phone, Email, or Primary Contact..."
              value={filters.searchQuery || ''}
              onChange={handleSearchInput}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              icon={<SlidersHorizontal className="w-4 h-4 text-slate-600" />}
            >
              {showAdvancedFilters ? 'Hide Filters' : 'Filters'}
            </Button>

            <Button variant="primary" onClick={onAddNewVendor}>
              + Add Vendor
            </Button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor Type</label>
              <select
                value={filters.vendorType || 'all'}
                onChange={(e) => onFilterChange({ ...filters, vendorType: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value="all">All Types (Customer & Supplier)</option>
                <option value="customer">Customer Only</option>
                <option value="supplier">Supplier Only</option>
                <option value="both">Both (Customer & Supplier)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => onFilterChange({ ...filters, status: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <select
                value={filters.state || ''}
                onChange={(e) => onFilterChange({ ...filters, state: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value="">All States</option>
                {indianStates.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST Registration</label>
              <select
                value={filters.gstStatus || 'all'}
                onChange={(e) => onFilterChange({ ...filters, gstStatus: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value="all">All GST Statuses</option>
                <option value="registered">Registered</option>
                <option value="unregistered">Unregistered</option>
                <option value="composition">Composition Scheme</option>
                <option value="not_applicable">Not Applicable</option>
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-4 flex justify-between items-center pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(filters.missingDetails)}
                  onChange={(e) => onFilterChange({ ...filters, missingDetails: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Show only records missing required details (GSTIN, contact info)</span>
              </label>

              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Vendor Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                <th className="p-3.5">Vendor Code</th>
                <th className="p-3.5">Company Name</th>
                <th className="p-3.5">Vendor Type</th>
                <th className="p-3.5">Primary Contact</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">State</th>
                <th className="p-3.5">GSTIN</th>
                <th className="p-3.5">Subcompanies</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building className="w-10 h-10 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-700">No Vendor records match your criteria</p>
                      <p className="text-xs text-slate-500">Try adjusting your search terms or filters.</p>
                      <Button variant="outline" size="sm" onClick={handleResetFilters} className="mt-2">
                        Reset Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.vendorId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Vendor Code */}
                    <td className="p-3.5 font-bold font-mono text-[#1F4E79] whitespace-nowrap">
                      {vendor.vendorCode || vendor.vendorId}
                    </td>

                    {/* Company Name */}
                    <td className="p-3.5 font-semibold text-slate-900 max-w-[200px] truncate">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{vendor.companyName}</span>
                        {vendor.vendorCategory !== 'main_company' && (
                          <span className="text-[10px] text-slate-500 capitalize">
                            Category: {vendor.vendorCategory.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Vendor Type */}
                    <td className="p-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          vendor.vendorType === 'customer'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : vendor.vendorType === 'supplier'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}
                      >
                        {vendor.vendorType}
                      </span>
                    </td>

                    {/* Primary Contact */}
                    <td className="p-3.5 text-slate-700 font-medium">
                      {vendor.primaryContactName || (
                        <span className="text-rose-500 italic">Missing Contact</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="p-3.5 text-slate-600 font-mono">
                      {vendor.primaryContactPhone || vendor.communication.mobileNumber || vendor.communication.officePhone || '-'}
                    </td>

                    {/* Email */}
                    <td className="p-3.5 text-slate-600 max-w-[150px] truncate">
                      {vendor.primaryContactEmail || vendor.communication.officialEmail || '-'}
                    </td>

                    {/* State */}
                    <td className="p-3.5 text-slate-700">{vendor.address.state}</td>

                    {/* GSTIN */}
                    <td className="p-3.5 font-mono text-slate-700">
                      {vendor.taxDetails.gstin ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                          {vendor.taxDetails.gstin}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          {vendor.taxDetails.gstRegistrationStatus === 'unregistered'
                            ? 'Unregistered'
                            : 'None'}
                        </span>
                      )}
                    </td>

                    {/* Subcompanies Count */}
                    <td className="p-3.5 text-center">
                      {(vendor.subcompanyCount && vendor.subcompanyCount > 0) || vendor.parentVendorId ? (
                        <button
                          onClick={() => onViewSubcompanies(vendor.vendorId)}
                          className="inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200 text-[11px] cursor-pointer"
                        >
                          <GitFork className="w-3 h-3" />
                          <span>{vendor.subcompanyCount || 1} Linked</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 whitespace-nowrap">
                      <StatusChip status={vendor.status === 'active' ? 'Active' : 'Inactive'} />
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="View Details"
                          onClick={() => onViewVendor(vendor.vendorId)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          title="Edit Vendor"
                          onClick={() => onEditVendor(vendor.vendorId)}
                          className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          title="Add Contact"
                          onClick={() => onAddContact(vendor.vendorId)}
                          className="p-1.5 hover:bg-purple-50 text-purple-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>

                        <button
                          title={vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                          onClick={() => onToggleStatus(vendor.vendorId, vendor.status)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            vendor.status === 'active'
                              ? 'hover:bg-rose-50 text-rose-600'
                              : 'hover:bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {vendor.status === 'active' ? (
                            <XCircle className="w-4 h-4" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          title="View Activity History"
                          onClick={() => onViewHistory(vendor.vendorId)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-800">{vendors.length}</span> of{' '}
            <span className="font-bold text-slate-800">{pagination.totalRecords}</span> vendors
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(pagination.page - 1)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => onPageChange(pagination.page + 1)}
                className="p-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
