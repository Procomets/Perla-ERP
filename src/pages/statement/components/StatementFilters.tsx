import React from 'react';
import { SearchableSelect, SelectOption, SelectOptionGroup } from '../../inward/components/SearchableSelect';
import { Vendor } from '../../../types/vendor';
import { Button } from '../../../components/ui/Button';
import { RotateCcw, Download, RefreshCw, Filter } from 'lucide-react';

interface StatementFiltersProps {
  companies: Vendor[];
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;

  purchaseOrders: { id: string; poNumber: string; styleNo: string; itemName: string }[];
  selectedPoId: string;
  onSelectPo: (poId: string, styleNo?: string) => void;

  styles?: string[];
  selectedStyleNo?: string;
  onSelectStyle?: (styleNo: string) => void;

  items?: string[];
  selectedItemName?: string;
  onSelectItem?: (itemName: string) => void;

  onReset: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  isLoading: boolean;
  hasData: boolean;
}

export const StatementFilters: React.FC<StatementFiltersProps> = ({
  companies,
  selectedCompanyId,
  onSelectCompany,
  purchaseOrders,
  selectedPoId,
  onSelectPo,
  onSelectStyle,
  onReset,
  onRefresh,
  onExportCsv,
  isLoading,
  hasData
}) => {
  // Format Company options
  const companyOptionGroups: SelectOptionGroup[] = [
    {
      options: companies.map((c) => ({
        id: c.id || c.vendorId || '',
        primaryText: c.companyName,
        secondaryText: c.vendorCode ? `Code: ${c.vendorCode}` : undefined,
        badge: c.vendorType === 'both' ? 'Customer & Supplier' : 'Customer',
        badgeVariant: 'blue',
        meta: c
      }))
    }
  ];

  // Format Style No / PO No options
  const poOptionGroups: SelectOptionGroup[] = [
    {
      options: [
        {
          id: 'all',
          primaryText: 'All Styles / PO Numbers',
          secondaryText: 'View reconciliation across all orders'
        },
        ...purchaseOrders.map((p) => ({
          id: p.id,
          primaryText: `${p.styleNo ? `Style: ${p.styleNo}  •  ` : ''}${p.poNumber}`,
          secondaryText: p.itemName ? `Item: ${p.itemName}` : undefined,
          badge: p.styleNo ? `Style #${p.styleNo}` : undefined,
          badgeVariant: 'blue' as const,
          meta: p
        }))
      ]
    }
  ];

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Reconciliation Scope & Selectors
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={isLoading || !selectedCompanyId}
            className="text-xs flex items-center gap-1.5"
            title="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading || !selectedCompanyId}
            className="text-xs flex items-center gap-1.5"
            title="Reload live statement data from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onExportCsv}
            disabled={isLoading || !hasData}
            className="text-xs flex items-center gap-1.5 bg-black hover:bg-neutral-800 text-white border-black"
            title="Export statement to Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export Statement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Company Name */}
        <div>
          <SearchableSelect
            label="Company Name"
            required
            value={selectedCompanyId}
            placeholder="Select customer company..."
            searchPlaceholder="Search by company name or code..."
            groups={companyOptionGroups}
            onSelect={(opt) => onSelectCompany(opt.id)}
            helperText="Customer / Company from Vendor Master"
          />
        </div>

        {/* 2. Style No / PO No. */}
        <div>
          <SearchableSelect
            label="Style No/PO No."
            value={selectedPoId}
            placeholder="All Styles / Purchase Orders"
            searchPlaceholder="Search by Style No or PO Number..."
            groups={poOptionGroups}
            onSelect={(opt) => {
              const matched = purchaseOrders.find((p) => p.id === opt.id);
              onSelectPo(opt.id, matched?.styleNo);
              if (onSelectStyle) {
                onSelectStyle(matched?.styleNo || 'all');
              }
            }}
            disabled={!selectedCompanyId || purchaseOrders.length === 0}
            helperText={
              !selectedCompanyId
                ? 'Select company first'
                : purchaseOrders.length === 0
                ? 'No orders found for company'
                : `${purchaseOrders.length} order(s) available`
            }
          />
        </div>
      </div>
    </div>
  );
};
