import React from 'react';
import { Card } from '../../../components/ui/Card';
import { InvoiceMetrics, InvoiceFilterOptions } from '../../../types/invoice';
import { Vendor } from '../../../types/vendor';
import { Search, RotateCcw } from 'lucide-react';

interface InvoiceDashboardMetricsProps {
  metrics?: InvoiceMetrics;
  filters: InvoiceFilterOptions;
  companies: Vendor[];
  onFilterChange: (filters: Partial<InvoiceFilterOptions>) => void;
  onResetFilters: () => void;
}

export const InvoiceDashboardMetrics: React.FC<InvoiceDashboardMetricsProps> = ({
  filters,
  companies,
  onFilterChange,
  onResetFilters
}) => {
  return (
    <div className="space-y-4">

      {/* Filter Ribbon */}
      <Card className="p-4 border border-slate-200 bg-white">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Invoice No, Customer, PO, Style..."
              value={filters.searchQuery || ''}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Company Dropdown */}
            <select
              value={filters.companyId || ''}
              onChange={(e) => onFilterChange({ companyId: e.target.value || undefined })}
              className="py-2 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4E79]/20 bg-white text-slate-700"
            >
              <option value="">All Companies / Customers</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>

            {/* Status Tabs */}
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5 text-xs font-medium">
              {(['all', 'finalized', 'draft', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onFilterChange({ status: st })}
                  className={`px-3 py-1.5 rounded-md capitalize transition-colors ${
                    (filters.status || 'all') === st
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={onResetFilters}
              title="Reset Filters"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
