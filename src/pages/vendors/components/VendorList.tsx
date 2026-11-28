import React, { useState, useMemo } from 'react';
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
  SlidersHorizontal,
  Building,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';
import { Vendor, VendorFilterOptions, VendorPagination } from '../../../types/vendor';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../../components/ui/TableMaximizeWrapper';

interface VendorListProps {
  vendors: Vendor[];
  parentCompanies?: string[];
  pagination: VendorPagination;
  filters: VendorFilterOptions;
  onFilterChange: (newFilters: VendorFilterOptions) => void;
  onPageChange: (newPage: number) => void;
  onViewVendor: (vendorId: string) => void;
  onEditVendor: (vendorId: string) => void;
  onAddContact: (vendorId: string) => void;
  onViewSubcompanies?: (vendorId: string) => void;
  onToggleStatus: (vendorId: string, currentStatus: 'active' | 'inactive') => void;
  onViewHistory: (vendorId: string) => void;
  onAddNewVendor: () => void;
}

export const VendorList: React.FC<VendorListProps> = ({
  vendors,
  parentCompanies = [],
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
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<{
    vendorCode?: string;
    companyName?: string;
    vendorType?: string;
    primaryContactName?: string;
    phone?: string;
    email?: string;
    state?: string;
    gstin?: string;
    parentVendorName?: string;
    status?: string;
  }>({});

  // 3-state Sorting
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  const handleSort = (field: string) => {
    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const renderSortIcon = (field: string) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center shrink-0 ml-1 transition-colors ${
          isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60'
        }`}
      >
        {isCurrent ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    );
  };

  const handleColumnFilterChange = (field: keyof typeof columnFilters, val: string) => {
    setColumnFilters((prev) => ({ ...prev, [field]: val }));
  };

  const activeColumnFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length;
  }, [columnFilters]);

  // Map for resolving parent vendor name from ID if not directly pre-populated
  const vendorNameMap = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((v) => {
      if (v.vendorId) map.set(v.vendorId, v.companyName);
      if (v.id) map.set(v.id, v.companyName);
    });
    return map;
  }, [vendors]);

  // Distinct parent companies from prop or derived from current vendors
  const availableParentCompanies = useMemo(() => {
    if (parentCompanies && parentCompanies.length > 0) {
      return parentCompanies;
    }
    const set = new Set<string>();
    vendors.forEach((v) => {
      const p =
        v.parentVendorName ||
        (v.parentVendorId ? vendorNameMap.get(v.parentVendorId) : null);
      if (p && p.trim().length > 0) set.add(p.trim());
    });
    return Array.from(set).sort();
  }, [parentCompanies, vendors, vendorNameMap]);

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
      parentCompanyName: 'all',
      missingDetails: false
    });
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection('normal');
  };

  const filteredVendors = useMemo(() => {
    let result = [...vendors];

    // Column Filters
    if (columnFilters.vendorCode) {
      const q = columnFilters.vendorCode.toLowerCase();
      result = result.filter((v) => (v.vendorCode || v.vendorId || '').toLowerCase().includes(q));
    }
    if (columnFilters.companyName) {
      const q = columnFilters.companyName.toLowerCase();
      result = result.filter((v) => (v.companyName || '').toLowerCase().includes(q));
    }
    if (columnFilters.vendorType) {
      const q = columnFilters.vendorType.toLowerCase();
      result = result.filter((v) => (v.vendorType || '').toLowerCase().includes(q));
    }
    if (columnFilters.primaryContactName) {
      const q = columnFilters.primaryContactName.toLowerCase();
      result = result.filter((v) => (v.primaryContactName || '').toLowerCase().includes(q));
    }
    if (columnFilters.phone) {
      const q = columnFilters.phone.toLowerCase();
      result = result.filter((v) => (v.phone || '').toLowerCase().includes(q));
    }
    if (columnFilters.email) {
      const q = columnFilters.email.toLowerCase();
      result = result.filter((v) => (v.email || '').toLowerCase().includes(q));
    }
    if (columnFilters.state) {
      const q = columnFilters.state.toLowerCase();
      result = result.filter((v) => (v.state || '').toLowerCase().includes(q));
    }
    if (columnFilters.gstin) {
      const q = columnFilters.gstin.toLowerCase();
      result = result.filter((v) => (v.gstin || '').toLowerCase().includes(q));
    }
    if (columnFilters.parentVendorName) {
      const q = columnFilters.parentVendorName.toLowerCase();
      result = result.filter((v) => {
        const p = v.parentVendorName || (v.parentVendorId ? vendorNameMap.get(v.parentVendorId) : '') || '';
        return p.toLowerCase().includes(q);
      });
    }
    if (columnFilters.status) {
      const q = columnFilters.status.toLowerCase();
      result = result.filter((v) => (v.status || '').toLowerCase().includes(q));
    }

    // Integrated search bar with column selector
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      if (searchColumn === 'ALL') {
        result = result.filter(
          (v) =>
            (v.companyName || '').toLowerCase().includes(q) ||
            (v.vendorCode || v.vendorId || '').toLowerCase().includes(q) ||
            (v.vendorType || '').toLowerCase().includes(q) ||
            (v.primaryContactName || '').toLowerCase().includes(q) ||
            (v.phone || '').toLowerCase().includes(q) ||
            (v.email || '').toLowerCase().includes(q) ||
            (v.state || '').toLowerCase().includes(q) ||
            (v.gstin || '').toLowerCase().includes(q)
        );
      } else {
        result = result.filter((v) => {
          const val = String((v as any)[searchColumn] || '').toLowerCase();
          return val.includes(q);
        });
      }
    }

    // Sorting
    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        let valA = String((a as any)[sortField] || '').toLowerCase();
        let valB = String((b as any)[sortField] || '').toLowerCase();
        if (sortField === 'parentVendorName') {
          valA = (a.parentVendorName || (a.parentVendorId ? vendorNameMap.get(a.parentVendorId) : '') || '').toLowerCase();
          valB = (b.parentVendorName || (b.parentVendorId ? vendorNameMap.get(b.parentVendorId) : '') || '').toLowerCase();
        }
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default: newest first
      result.sort((a, b) => {
        const timeA = new Date(a.createdAt || (a as any).updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || (b as any).updatedAt || 0).getTime();
        return timeB - timeA;
      });
    }

    return result;
  }, [vendors, columnFilters, filters.searchQuery, searchColumn, sortField, sortDirection, vendorNameMap]);

  const hasAnyFilter = useMemo(() => {
    return (
      Boolean(filters.searchQuery?.trim()) ||
      searchColumn !== 'ALL' ||
      activeColumnFilterCount > 0 ||
      filters.vendorType !== 'all' ||
      filters.status !== 'all' ||
      Boolean(filters.state) ||
      filters.gstStatus !== 'all' ||
      (Boolean(filters.parentCompanyName) && filters.parentCompanyName !== 'all') ||
      Boolean(filters.missingDetails) ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [filters, searchColumn, activeColumnFilterCount, sortField, sortDirection]);

  return (
    <div className="space-y-4">
      {/* Top Search & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Integrated Search Bar with Column Dropdown */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  searchColumn === 'ALL'
                    ? 'Search all fields (Company, Code, GSTIN, Phone, Email)...'
                    : `Search by ${searchColumn}...`
                }
                value={filters.searchQuery || ''}
                onChange={handleSearchInput}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Column Selector */}
            <select
              value={searchColumn}
              onChange={(e) => setSearchColumn(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 shrink-0 cursor-pointer"
              title="Target search column"
            >
              <option value="ALL">All Columns</option>
              <option value="companyName">Company Name</option>
              <option value="vendorCode">Vendor Code</option>
              <option value="vendorType">Vendor Type</option>
              <option value="primaryContactName">Primary Contact</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="state">State</option>
              <option value="gstin">GSTIN</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Inline Column Filters Toggle */}
            <button
              type="button"
              onClick={() => setShowColumnFilters((prev) => !prev)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                showColumnFilters || activeColumnFilterCount > 0
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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

            {/* Advanced Filters Drawer Button */}
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              icon={<Filter className="w-4 h-4 text-slate-600" />}
            >
              {showAdvancedFilters ? 'Hide Advanced' : 'Advanced'}
              {(filters.vendorType !== 'all' ||
                filters.status !== 'all' ||
                filters.state ||
                filters.gstStatus !== 'all' ||
                (filters.parentCompanyName && filters.parentCompanyName !== 'all') ||
                filters.missingDetails) && (
                <span className="w-2 h-2 rounded-full bg-blue-600 ml-1.5 inline-block" />
              )}
            </Button>

            {/* Reset All Filters Button */}
            {hasAnyFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                title="Reset all filters and sorting"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <Button variant="primary" onClick={onAddNewVendor}>
              + Add Vendor
            </Button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50/70 p-3 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Company</label>
              <select
                value={filters.parentCompanyName || 'all'}
                onChange={(e) => onFilterChange({ ...filters, parentCompanyName: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Parent Companies</option>
                <option value="none">Main Companies Only (-)</option>
                <option value="has_parent">Linked to Any Parent</option>
                {availableParentCompanies.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

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

            <div className="sm:col-span-2 md:col-span-3 lg:col-span-5 flex justify-between items-center pt-2">
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

        {/* Active Filter Pill Badge */}
        {filters.parentCompanyName && filters.parentCompanyName !== 'all' && (
          <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-xl">
            <span className="font-semibold text-slate-600">Active Parent Filter:</span>
            <span className="bg-white px-2 py-0.5 rounded-md border border-blue-200 font-bold text-[#1F4E79]">
              {filters.parentCompanyName === 'none'
                ? 'Main Companies Only (-)'
                : filters.parentCompanyName === 'has_parent'
                ? 'Linked to Any Parent'
                : filters.parentCompanyName}
            </span>
            <button
              onClick={() => onFilterChange({ ...filters, parentCompanyName: 'all' })}
              className="text-rose-600 hover:text-rose-800 ml-auto font-semibold hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Vendor Data Table */}
      <TableMaximizeWrapper
        title="Vendor Master & Customer Directory"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredVendors.length} Companies
          </span>
        }
      >
        {(isMaximized) => (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
            <div
              data-table-scroll="true"
              className={`overflow-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
                  <tr className="border-b border-slate-300 text-[#1F4E79] bg-[#EEF5FB] font-bold uppercase tracking-wider text-[11px]">
                {/* Vendor Code */}
                <th
                  onClick={() => handleSort('vendorCode')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Vendor Code</span>
                    {renderSortIcon('vendorCode')}
                  </div>
                </th>

                {/* Company Name */}
                <th
                  onClick={() => handleSort('companyName')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Company Name</span>
                    {renderSortIcon('companyName')}
                  </div>
                </th>

                {/* Vendor Type */}
                <th
                  onClick={() => handleSort('vendorType')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Vendor Type</span>
                    {renderSortIcon('vendorType')}
                  </div>
                </th>

                {/* Primary Contact */}
                <th
                  onClick={() => handleSort('primaryContactName')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Primary Contact</span>
                    {renderSortIcon('primaryContactName')}
                  </div>
                </th>

                {/* Phone */}
                <th
                  onClick={() => handleSort('phone')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Phone</span>
                    {renderSortIcon('phone')}
                  </div>
                </th>

                {/* Email */}
                <th
                  onClick={() => handleSort('email')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Email</span>
                    {renderSortIcon('email')}
                  </div>
                </th>

                {/* State */}
                <th
                  onClick={() => handleSort('state')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>State</span>
                    {renderSortIcon('state')}
                  </div>
                </th>

                {/* GSTIN */}
                <th
                  onClick={() => handleSort('gstin')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>GSTIN</span>
                    {renderSortIcon('gstin')}
                  </div>
                </th>

                {/* Parent Company */}
                <th
                  onClick={() => handleSort('parentVendorName')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Parent Company</span>
                    {renderSortIcon('parentVendorName')}
                  </div>
                </th>

                {/* Status */}
                <th
                  onClick={() => handleSort('status')}
                  className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Status</span>
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* Actions */}
                <th className="p-3.5 pr-12 whitespace-nowrap text-left bg-[#EEF5FB] min-w-[260px]">Actions</th>
              </tr>

              {/* Sticky Inline Column Filters Row */}
              {showColumnFilters && (
                <tr className="sticky top-[41px] z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-xs">
                  {/* Vendor Code */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter code..."
                      value={columnFilters.vendorCode || ''}
                      onChange={(e) => handleColumnFilterChange('vendorCode', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Company Name */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter company..."
                      value={columnFilters.companyName || ''}
                      onChange={(e) => handleColumnFilterChange('companyName', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Vendor Type */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter type..."
                      value={columnFilters.vendorType || ''}
                      onChange={(e) => handleColumnFilterChange('vendorType', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Primary Contact */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter contact..."
                      value={columnFilters.primaryContactName || ''}
                      onChange={(e) => handleColumnFilterChange('primaryContactName', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Phone */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter phone..."
                      value={columnFilters.phone || ''}
                      onChange={(e) => handleColumnFilterChange('phone', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Email */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter email..."
                      value={columnFilters.email || ''}
                      onChange={(e) => handleColumnFilterChange('email', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* State */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter state..."
                      value={columnFilters.state || ''}
                      onChange={(e) => handleColumnFilterChange('state', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* GSTIN */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter GSTIN..."
                      value={columnFilters.gstin || ''}
                      onChange={(e) => handleColumnFilterChange('gstin', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Parent Company */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter parent..."
                      value={columnFilters.parentVendorName || ''}
                      onChange={(e) => handleColumnFilterChange('parentVendorName', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Status */}
                  <th className="p-1.5">
                    <input
                      type="text"
                      placeholder="Filter status..."
                      value={columnFilters.status || ''}
                      onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                      className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </th>

                  {/* Actions Clear */}
                  <th className="p-1.5 text-right">
                    {activeColumnFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setColumnFilters({})}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
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
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building className="w-10 h-10 text-slate-300" />
                      <p className="font-semibold text-sm text-slate-700">No vendor records match your criteria</p>
                      <p className="text-xs text-slate-500">Try adjusting your search terms or filters.</p>
                      {hasAnyFilter && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor.vendorId} className="hover:bg-slate-50/80 transition-colors">
                    {/* Vendor Code */}
                    <td className="p-3.5 font-bold font-mono text-[#1F4E79] whitespace-nowrap">
                      {vendor.vendorCode || vendor.vendorId}
                    </td>

                    {/* Company Name */}
                    <td className="p-3.5 font-semibold text-slate-900 whitespace-nowrap">
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
                    <td className="p-3.5 text-slate-700 font-medium whitespace-nowrap">
                      {vendor.primaryContactName || (
                        <span className="text-rose-500 italic">Missing Contact</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="p-3.5 text-slate-600 font-mono whitespace-nowrap">
                      {vendor.primaryContactPhone || vendor.communication?.mobileNumber || vendor.communication?.officePhone || '-'}
                    </td>

                    {/* Email */}
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {vendor.primaryContactEmail || vendor.communication?.officialEmail || '-'}
                    </td>

                    {/* State */}
                    <td className="p-3.5 text-slate-700 whitespace-nowrap">{vendor.address?.state}</td>

                    {/* GSTIN */}
                    <td className="p-3.5 font-mono text-slate-700 whitespace-nowrap">
                      {vendor.taxDetails?.gstin ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                          {vendor.taxDetails.gstin}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          {vendor.taxDetails?.gstRegistrationStatus === 'unregistered'
                            ? 'Unregistered'
                            : 'None'}
                        </span>
                      )}
                    </td>

                    {/* Parent Company Name */}
                    <td className="p-3.5 whitespace-nowrap">
                      {vendor.vendorCategory === 'main_company' || !vendor.parentVendorId ? (
                        <span className="text-slate-400 font-medium">-</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onViewVendor(vendor.parentVendorId!)}
                          className="text-left font-semibold text-[#1F4E79] hover:underline hover:text-blue-700 cursor-pointer"
                          title="View Parent Company"
                        >
                          {vendor.parentVendorName ||
                            vendorNameMap.get(vendor.parentVendorId) ||
                            vendor.parentVendorId}
                        </button>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 whitespace-nowrap">
                      <StatusChip status={vendor.status === 'active' ? 'Active' : 'Inactive'} />
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-left whitespace-nowrap">
                      <div className="flex items-center justify-start gap-1.5">
                        <button
                          title="View Details"
                          onClick={() => onViewVendor(vendor.vendorId)}
                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                          View
                        </button>

                        <button
                          title="Edit Vendor"
                          onClick={() => onEditVendor(vendor.vendorId)}
                          className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Edit
                        </button>

                        <button
                          title="Add Contact"
                          onClick={() => onAddContact(vendor.vendorId)}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Add Contact
                        </button>

                        <button
                          title={vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                          onClick={() => onToggleStatus(vendor.vendorId, vendor.status)}
                          className={`px-2.5 py-1 rounded font-bold text-xs transition-colors cursor-pointer ${
                            vendor.status === 'active'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          title="View Activity History"
                          onClick={() => onViewHistory(vendor.vendorId)}
                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <TableTotalsFooter
              cells={[
                { colSpan: 10, label: `Total (${filteredVendors.length} Companies / Vendors)`, isTotal: true },
                { content: '—', align: 'right', className: 'pr-12' }
              ]}
            />
          </table>
        </div>

        {/* Table Records Summary Footer */}
        <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>
            Showing all <strong className="text-slate-800">{filteredVendors.length}</strong> records in one stretch
            {filteredVendors.length !== vendors.length && (
              <span className="text-slate-400 ml-1">(filtered from {vendors.length} total)</span>
            )}
          </span>
          <span className="text-[11px] text-slate-400">
            Active: {vendors.filter((v) => v.status === 'active').length} · Inactive: {vendors.filter((v) => v.status === 'inactive').length}
          </span>
        </div>
      </div>
        )}
      </TableMaximizeWrapper>
    </div>
  );
};
