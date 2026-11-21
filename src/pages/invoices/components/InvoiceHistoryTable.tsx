import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Invoice } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  FileText,
  Download,
  Printer,
  Eye,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Pencil,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  X,
  SlidersHorizontal,
  RotateCcw,
  Package
} from 'lucide-react';

export type InvoiceSortField =
  | 'invoiceNo'
  | 'invoiceDate'
  | 'customerName'
  | 'poNumber'
  | 'taxableSubtotal'
  | 'gstTotal'
  | 'grandTotal'
  | 'status';

export type SortDirection = 'asc' | 'desc' | null;

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  isAdmin: boolean;
  onPageChange: (newPage: number) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onPrintPdf: (invoice: Invoice) => void;
  onOpenCancel?: (invoice: Invoice) => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const InvoiceHistoryTable: React.FC<InvoiceHistoryTableProps> = ({
  invoices,
  totalCount,
  currentPage,
  pageSize,
  loading,
  isAdmin,
  onPageChange,
  onViewInvoice,
  onDownloadPdf,
  onPrintPdf,
  onOpenCancel,
  onEditInvoice
}) => {
  // Search & column filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // 3-State Column Sorting (asc -> desc -> unsort/normal)
  const [sortField, setSortField] = useState<InvoiceSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const INVOICE_SEARCH_COLUMNS = [
    { value: 'ALL', label: 'All Columns' },
    { value: 'invoiceNo', label: 'Invoice No' },
    { value: 'invoiceDate', label: 'Date' },
    { value: 'customerName', label: 'Customer' },
    { value: 'poNumber', label: 'PO & Style' },
    { value: 'taxableSubtotal', label: 'Taxable Subtotal' },
    { value: 'gstTotal', label: 'GST Total' },
    { value: 'grandTotal', label: 'Grand Total' },
    { value: 'status', label: 'Status' }
  ];

  const handleSort = (field: InvoiceSortField) => {
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
    setSearchQuery('');
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection(null);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    searchColumn !== 'ALL' ||
    Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
    Boolean(sortField);

  // Client-side filtering for column selector & inline column filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const gstTotal = (inv.totalCgst || 0) + (inv.totalSgst || 0) + (inv.totalIgst || 0);

      // 1. Search Query
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        if (searchColumn === 'ALL') {
          const matchAll =
            (inv.invoiceNo || inv.invoiceNumber || inv.id || '').toLowerCase().includes(query) ||
            (inv.invoiceDate || '').toLowerCase().includes(query) ||
            (inv.customerSnapshot?.companyName || '').toLowerCase().includes(query) ||
            (inv.customerSnapshot?.gstin || '').toLowerCase().includes(query) ||
            (inv.poNumber || '').toLowerCase().includes(query) ||
            (inv.styleNo || '').toLowerCase().includes(query) ||
            (inv.status || '').toLowerCase().includes(query);
          if (!matchAll) return false;
        } else {
          let val = '';
          switch (searchColumn) {
            case 'invoiceNo':
              val = inv.invoiceNo || inv.invoiceNumber || inv.id || '';
              break;
            case 'invoiceDate':
              val = inv.invoiceDate || '';
              break;
            case 'customerName':
              val = `${inv.customerSnapshot?.companyName || ''} ${inv.customerSnapshot?.gstin || ''}`;
              break;
            case 'poNumber':
              val = `${inv.poNumber || ''} ${inv.styleNo || ''}`;
              break;
            case 'taxableSubtotal':
              val = String(inv.subtotal || inv.taxableAmount || 0);
              break;
            case 'gstTotal':
              val = String(gstTotal);
              break;
            case 'grandTotal':
              val = String(inv.finalTotal || inv.grandTotal || 0);
              break;
            case 'status':
              val = inv.status || '';
              break;
          }
          if (!val.toLowerCase().includes(query)) return false;
        }
      }

      // 2. Inline Column Filters
      for (const [colKey, rawVal] of Object.entries(columnFilters)) {
        const needle = (rawVal || '').trim().toLowerCase();
        if (!needle) continue;

        let haystack = '';
        switch (colKey) {
          case 'invoiceNo':
            haystack = inv.invoiceNo || inv.invoiceNumber || inv.id || '';
            break;
          case 'invoiceDate':
            haystack = inv.invoiceDate || '';
            break;
          case 'customerName':
            haystack = `${inv.customerSnapshot?.companyName || ''} ${inv.customerSnapshot?.gstin || ''}`;
            break;
          case 'poNumber':
            haystack = `${inv.poNumber || ''} ${inv.styleNo || ''}`;
            break;
          case 'taxableSubtotal':
            haystack = String(inv.subtotal || inv.taxableAmount || 0);
            break;
          case 'gstTotal':
            haystack = String(gstTotal);
            break;
          case 'grandTotal':
            haystack = String(inv.finalTotal || inv.grandTotal || 0);
            break;
          case 'status':
            haystack = inv.status || '';
            break;
        }

        if (!haystack.toLowerCase().includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, searchColumn, columnFilters]);

  const sortedInvoices = useMemo(() => {
    if (!sortField || !sortDirection) {
      // Default: Most recent entry first
      return [...filteredInvoices].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || a.invoiceDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || b.invoiceDate || 0).getTime();
        return timeB - timeA;
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...filteredInvoices].sort((a, b) => {
      const gstA = (a.totalCgst || 0) + (a.totalSgst || 0) + (a.totalIgst || 0);
      const gstB = (b.totalCgst || 0) + (b.totalSgst || 0) + (b.totalIgst || 0);

      switch (sortField) {
        case 'invoiceNo':
          return (
            (a.invoiceNo || a.invoiceNumber || a.id || '').localeCompare(
              b.invoiceNo || b.invoiceNumber || b.id || '',
              undefined,
              { numeric: true, sensitivity: 'base' }
            ) * mult
          );
        case 'invoiceDate': {
          const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
          const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
          return (dateA - dateB) * mult;
        }
        case 'customerName': {
          const nameA = a.customerSnapshot?.companyName || '';
          const nameB = b.customerSnapshot?.companyName || '';
          return nameA.localeCompare(nameB) * mult;
        }
        case 'poNumber': {
          const poA = `${a.poNumber || ''} ${a.styleNo || ''}`;
          const poB = `${b.poNumber || ''} ${b.styleNo || ''}`;
          return poA.localeCompare(poB, undefined, { numeric: true, sensitivity: 'base' }) * mult;
        }
        case 'taxableSubtotal': {
          const amtA = Number(a.subtotal || a.taxableAmount || 0);
          const amtB = Number(b.subtotal || b.taxableAmount || 0);
          return (amtA - amtB) * mult;
        }
        case 'gstTotal':
          return (gstA - gstB) * mult;
        case 'grandTotal': {
          const totA = Number(a.finalTotal || a.grandTotal || 0);
          const totB = Number(b.finalTotal || b.grandTotal || 0);
          return (totA - totB) * mult;
        }
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * mult;
        default:
          return 0;
      }
    });
  }, [filteredInvoices, sortField, sortDirection]);

  const renderSortIcon = (field: InvoiceSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-100 text-[#1F4E79] shadow-2xs">
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
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

  const getSortTooltip = (field: InvoiceSortField, label: string) => {
    if (sortField !== field || !sortDirection) {
      return `Click to sort ${label} ascending`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ascending. Click to sort descending`;
    }
    return `Currently sorted descending. Click to reset to normal order`;
  };

  const getSortColumnLabel = (field: InvoiceSortField) => {
    switch (field) {
      case 'invoiceNo':
        return 'Invoice No';
      case 'invoiceDate':
        return 'Date';
      case 'customerName':
        return 'Customer';
      case 'poNumber':
        return 'PO & Style';
      case 'taxableSubtotal':
        return 'Taxable Subtotal';
      case 'gstTotal':
        return 'GST Total';
      case 'grandTotal':
        return 'Grand Total';
      case 'status':
        return 'Status';
      default:
        return field;
    }
  };

  const renderStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'finalized') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Finalized
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Draft
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <AlertOctagon className="w-3 h-3" /> Cancelled
        </span>
      );
    }
    return <StatusChip status={status} />;
  };

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-2xs">
      {/* Table Toolbar Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1F4E79]" />
              Generated Tax Invoices &amp; Records
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Full audit log of finalized, draft, and cancelled invoices. Click any invoice to view, print, or download PDF.
            </p>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 self-start md:self-auto">
            {sortedInvoices.length} of {totalCount} total invoice{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search Bar with Column Selector & Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Integrated Column Selector & Search Bar */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px]">
            <div className="relative">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
              >
                {INVOICE_SEARCH_COLUMNS.map((col) => (
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
                    ? 'Search across all invoice columns...'
                    : `Search by ${INVOICE_SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label || searchColumn}...`
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Toggle Inline Column Filters Button */}
          <button
            type="button"
            onClick={() => setShowColumnFilters(!showColumnFilters)}
            className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 ${
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

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Sort Banner */}
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
            title="Reset to normal order"
          >
            Clear / Desort
          </button>
        </div>
      )}

      {/* Persistent Sticky Table Container */}
      <div className="overflow-x-auto max-h-[620px] overflow-y-auto relative">
        <table className="w-full text-left border-collapse text-xs min-w-[1200px] border border-slate-200">
          <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
            <tr>
              {/* 1. Invoice No */}
              <th
                className={`py-3 px-4 min-w-[170px] border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'invoiceNo' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('invoiceNo')}
                title={getSortTooltip('invoiceNo', 'Invoice No')}
              >
                <div className="flex items-center gap-1.5 justify-start">
                  <span>Invoice No</span>
                  {renderSortIcon('invoiceNo')}
                </div>
              </th>

              {/* 2. Date */}
              <th
                className={`py-3 px-3 min-w-[120px] border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'invoiceDate' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('invoiceDate')}
                title={getSortTooltip('invoiceDate', 'Invoice Date')}
              >
                <div className="flex items-center gap-1.5 justify-start">
                  <span>Date</span>
                  {renderSortIcon('invoiceDate')}
                </div>
              </th>

              {/* 3. Customer / Company */}
              <th
                className={`py-3 px-3 min-w-[220px] border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group sticky top-0 z-20 bg-[#EEF5FB] ${
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

              {/* 4. PO & Style */}
              <th
                className={`py-3 px-3 min-w-[180px] border-r border-b-2 border-slate-300 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'poNumber' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('poNumber')}
                title={getSortTooltip('poNumber', 'PO & Style')}
              >
                <div className="flex items-center gap-1.5 justify-start">
                  <span>PO &amp; Style</span>
                  {renderSortIcon('poNumber')}
                </div>
              </th>

              {/* 5. Taxable Subtotal */}
              <th
                className={`py-3 px-3 min-w-[120px] border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'taxableSubtotal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('taxableSubtotal')}
                title={getSortTooltip('taxableSubtotal', 'Taxable Subtotal')}
              >
                <div className="flex items-center gap-1.5 justify-end">
                  <span>Taxable Subtotal</span>
                  {renderSortIcon('taxableSubtotal')}
                </div>
              </th>

              {/* 6. GST Total */}
              <th
                className={`py-3 px-3 min-w-[100px] border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'gstTotal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('gstTotal')}
                title={getSortTooltip('gstTotal', 'GST Total')}
              >
                <div className="flex items-center gap-1.5 justify-end">
                  <span>GST Total</span>
                  {renderSortIcon('gstTotal')}
                </div>
              </th>

              {/* 7. Grand Total */}
              <th
                className={`py-3 px-3 min-w-[120px] border-r border-b-2 border-slate-300 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
                  sortField === 'grandTotal' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                }`}
                onClick={() => handleSort('grandTotal')}
                title={getSortTooltip('grandTotal', 'Grand Total')}
              >
                <div className="flex items-center gap-1.5 justify-end">
                  <span>Grand Total</span>
                  {renderSortIcon('grandTotal')}
                </div>
              </th>

              {/* 8. Status */}
              <th
                className={`py-3 px-3 min-w-[110px] border-r border-b-2 border-slate-300 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${
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

              {/* 9. Actions */}
              <th className="py-3 px-4 min-w-[180px] border-b-2 border-slate-300 text-center whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB]">
                Actions
              </th>
            </tr>

            {/* Inline Column Filter Inputs Row */}
            {showColumnFilters && (
              <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter invoice..."
                    value={columnFilters.invoiceNo || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, invoiceNo: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter date..."
                    value={columnFilters.invoiceDate || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, invoiceDate: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter customer..."
                    value={columnFilters.customerName || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, customerName: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter PO/style..."
                    value={columnFilters.poNumber || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, poNumber: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter subtotal..."
                    value={columnFilters.taxableSubtotal || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, taxableSubtotal: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter GST..."
                    value={columnFilters.gstTotal || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, gstTotal: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter total..."
                    value={columnFilters.grandTotal || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, grandTotal: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                  />
                </th>
                <th className="p-1.5 border-r border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100">
                  <input
                    type="text"
                    placeholder="Filter status..."
                    value={columnFilters.status || ''}
                    onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                    className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                  />
                </th>
                <th className="p-1.5 border-b-2 border-slate-300 sticky top-[41px] z-20 bg-slate-100 text-center">
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

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-14 text-center text-slate-500 text-sm bg-white">
                  <div className="w-8 h-8 border-2 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Loading invoices...
                </td>
              </tr>
            ) : sortedInvoices.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-14 text-center text-xs text-slate-400 bg-white">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                      <Package className="w-8 h-8 stroke-[1.5]" />
                    </div>
                    <div className="text-sm font-bold text-slate-700">No Matching Invoices</div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      {hasActiveFilters
                        ? 'No invoices match your current search, column filters, or filters.'
                        : 'No tax invoices have been generated yet.'}
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
                  </div>
                </td>
              </tr>
            ) : (
              sortedInvoices.map((inv) => {
                const gstTotal = (inv.totalCgst || 0) + (inv.totalSgst || 0) + (inv.totalIgst || 0);
                const isCancelled = inv.status.toLowerCase() === 'cancelled';
                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCancelled ? 'bg-rose-50/20 opacity-75' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap border-r border-slate-200">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {inv.invoiceNo || inv.invoiceNumber || inv.id}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">FY: {inv.financialYear || '2026-27'}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap font-medium border-r border-slate-200">
                      {formatDate(inv.invoiceDate)}
                    </td>
                    <td className="py-3.5 px-3 border-r border-slate-200">
                      <span className="font-bold text-slate-900 text-xs block">
                        {inv.customerSnapshot?.companyName || 'Customer'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        GSTIN: {inv.customerSnapshot?.gstin || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap border-r border-slate-200">
                      <span className="font-mono font-bold text-slate-900 text-xs block">{inv.poNumber}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Style: {inv.styleNo}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap border-r border-slate-200">
                      {formatCurrency(inv.subtotal || inv.taxableAmount || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap border-r border-slate-200">
                      {formatCurrency(gstTotal)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap text-xs border-r border-slate-200">
                      {formatCurrency(inv.finalTotal || inv.grandTotal || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-center whitespace-nowrap border-r border-slate-200">
                      {renderStatus(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownloadPdf(inv)}
                          className="text-xs font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50 h-auto py-1 px-2.5"
                        >
                          Download
                        </Button>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv)}
                          title="View Invoice Details"
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintPdf(inv)}
                          title="Print Tax Invoice"
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onEditInvoice?.(inv)}
                            title="Edit Invoice Data (Admin Only)"
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
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

      {/* All Records Summary Bar - One Stretch */}
      <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/70">
        <div>
          Showing all <strong className="text-slate-900 font-bold">{sortedInvoices.length}</strong> {sortedInvoices.length === 1 ? 'record' : 'records'} in one stretch
          {sortedInvoices.length !== invoices.length && (
            <span className="text-slate-400 font-normal ml-1.5">(filtered from {invoices.length} total)</span>
          )}
        </div>
        <span className="text-[11px] text-slate-400 font-medium">Full view · Header stays at top</span>
      </div>
    </Card>
  );
};
