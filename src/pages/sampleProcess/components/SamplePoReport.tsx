import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  RotateCcw,
  Layers,
  Calendar,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { SamplePoInward } from '../../../types/samplePo';
import { Vendor } from '../../../types/vendor';
import { SamplePoPdfService } from '../../../services/samplePoPdfService';
import { PdfExportButton, ExcelExportButton } from '../../../components/ui/ExportButtons';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../../components/ui/TableMaximizeWrapper';

export interface FlattenedSamplePoLine {
  id: string;
  poId: string;
  entryNumber: string;
  customerDcNumber: string;
  customerDcDate: string;
  vendorName: string;
  itemName: string;
  styleNo: string;
  washType: string;
  quantity: number;
  dispatchedQuantity: number;
  balanceQuantity: number;
  unit: string;
  status: string;
}

interface SamplePoReportProps {
  samplePos: SamplePoInward[];
  vendors: Vendor[];
  onBack: () => void;
  onViewPo?: (po: SamplePoInward) => void;
}

type ReportSortField =
  | 'entryNumber'
  | 'customerDcNumber'
  | 'customerDcDate'
  | 'vendorName'
  | 'itemName'
  | 'styleNo'
  | 'washType'
  | 'quantity'
  | 'dispatchedQuantity'
  | 'balanceQuantity'
  | 'status';

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

export const SamplePoReport: React.FC<SamplePoReportProps> = ({
  samplePos,
  vendors,
  onBack,
  onViewPo
}) => {
  // Filter States
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('table');
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});

  // Split-Row Table Controls
  const [tableSearchColumn, setTableSearchColumn] = useState<string>('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    entryNumber: '',
    customerDcNumber: '',
    customerDcDate: '',
    vendorName: '',
    itemName: '',
    styleNo: '',
    washType: '',
    status: ''
  });
  const [sortField, setSortField] = useState<ReportSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  // Unique vendor options from samplePos & vendors
  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    samplePos.forEach((p) => {
      if (p.vendorId && p.vendorName) map.set(p.vendorId, p.vendorName);
    });
    vendors.forEach((v) => {
      const id = v.vendorId || v.id;
      const name = v.companyName || (v as any).name;
      if (id && name && !map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [samplePos, vendors]);

  // Filter Sample POs
  const filteredPOs = useMemo(() => {
    return samplePos.filter((po) => {
      if (selectedVendorId !== 'all' && po.vendorId !== selectedVendorId) {
        return false;
      }

      if (startDate && (po.customerDcDate || '') < startDate) {
        return false;
      }
      if (endDate && (po.customerDcDate || '') > endDate) {
        return false;
      }

      const effectiveStatus =
        (po.status || '').toLowerCase() === 'cancelled'
          ? 'cancelled'
          : (po.dispatchStatus || 'pending').toLowerCase();

      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesHeader =
          (po.entryNumber || '').toLowerCase().includes(q) ||
          (po.customerDcNumber || '').toLowerCase().includes(q) ||
          (po.vendorName || '').toLowerCase().includes(q) ||
          (po.remarks || '').toLowerCase().includes(q);
        const matchesItem = (po.items || []).some(
          (it) =>
            (it.itemName || '').toLowerCase().includes(q) ||
            (it.styleNo || '').toLowerCase().includes(q) ||
            (it.washType || '').toLowerCase().includes(q) ||
            (it.customerDcNumber || '').toLowerCase().includes(q)
        );
        if (!matchesHeader && !matchesItem) return false;
      }

      return true;
    });
  }, [samplePos, selectedVendorId, startDate, endDate, statusFilter, searchQuery]);

  // Flatten POs into Split Rows based on PO No
  const flattenedLines = useMemo<FlattenedSamplePoLine[]>(() => {
    const rows: FlattenedSamplePoLine[] = [];
    filteredPOs.forEach((po) => {
      const effectiveStatus =
        (po.status || '').toLowerCase() === 'cancelled'
          ? 'Cancelled'
          : (po.dispatchStatus || 'Pending').charAt(0).toUpperCase() +
            (po.dispatchStatus || 'pending').slice(1).toLowerCase();

      if (po.items && po.items.length > 0) {
        po.items.forEach((it, idx) => {
          const qty = Number(it.quantity || 0);
          const disp = Number(it.dispatchedQuantity || 0);
          rows.push({
            id: `${po.id}-${it.id || idx}`,
            poId: po.id,
            entryNumber: po.entryNumber,
            customerDcNumber: it.customerDcNumber || po.customerDcNumber || '—',
            customerDcDate: it.customerDcDate || po.customerDcDate || '',
            vendorName: po.vendorName || '—',
            itemName: it.itemName || '—',
            styleNo: it.styleNo || '—',
            washType: it.washType || '—',
            quantity: qty,
            dispatchedQuantity: disp,
            balanceQuantity: Math.max(0, qty - disp),
            unit: it.unit || 'PCS',
            status: effectiveStatus
          });
        });
      } else {
        const qty = Number(po.totalQuantity || 0);
        const disp = Number(po.totalDispatchedQuantity || 0);
        rows.push({
          id: `${po.id}-empty`,
          poId: po.id,
          entryNumber: po.entryNumber,
          customerDcNumber: po.customerDcNumber || '—',
          customerDcDate: po.customerDcDate || '',
          vendorName: po.vendorName || '—',
          itemName: '—',
          styleNo: '—',
          washType: '—',
          quantity: qty,
          dispatchedQuantity: disp,
          balanceQuantity: Math.max(0, qty - disp),
          unit: 'PCS',
          status: effectiveStatus
        });
      }
    });
    return rows;
  }, [filteredPOs]);

  // Apply Split-Row Table search, column filters, and 3-state sorting
  const filteredAndSortedLines = useMemo(() => {
    let result = [...flattenedLines];

    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.trim().toLowerCase();
      result = result.filter((row) => {
        if (tableSearchColumn !== 'ALL') {
          const val = String((row as any)[tableSearchColumn] || '').toLowerCase();
          return val.includes(q);
        }
        return (
          row.entryNumber.toLowerCase().includes(q) ||
          row.customerDcNumber.toLowerCase().includes(q) ||
          row.vendorName.toLowerCase().includes(q) ||
          row.itemName.toLowerCase().includes(q) ||
          row.styleNo.toLowerCase().includes(q) ||
          row.washType.toLowerCase().includes(q) ||
          row.status.toLowerCase().includes(q)
        );
      });
    }

    Object.entries(columnFilters).forEach(([key, val]) => {
      if (val && val.trim()) {
        const q = val.trim().toLowerCase();
        result = result.filter((row) =>
          String((row as any)[key] || '')
            .toLowerCase()
            .includes(q)
        );
      }
    });

    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;
        return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : valA < valB ? 1 : -1;
      });
    }

    return result;
  }, [flattenedLines, tableSearchQuery, tableSearchColumn, columnFilters, sortField, sortDirection]);

  const handleSort = (field: ReportSortField) => {
    const isNumericOrDate =
      field === 'quantity' ||
      field === 'dispatchedQuantity' ||
      field === 'balanceQuantity' ||
      field === 'customerDcDate';
    const firstDir = isNumericOrDate ? 'desc' : 'asc';
    const secondDir = isNumericOrDate ? 'asc' : 'desc';

    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection(firstDir);
    } else if (sortDirection === firstDir) {
      setSortDirection(secondDir);
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const renderSortIcon = (field: ReportSortField) => {
    if (sortField !== field || sortDirection === 'normal') {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 ml-1 inline-block opacity-60 group-hover:opacity-100" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#1F4E79] ml-1 inline-block" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#1F4E79] ml-1 inline-block" />
    );
  };

  const hasActiveFilters =
    selectedVendorId !== 'all' ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    statusFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedVendorId('all');
    setStartDate('');
    setEndDate('');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const togglePOExpand = (poId: string) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [poId]: prev[poId] === false ? true : false
    }));
  };

  // Summary Totals for Split-Row Table
  const tableTotals = useMemo(() => {
    return filteredAndSortedLines.reduce(
      (acc, r) => ({
        quantity: acc.quantity + r.quantity,
        dispatched: acc.dispatched + r.dispatchedQuantity,
        balance: acc.balance + r.balanceQuantity
      }),
      { quantity: 0, dispatched: 0, balance: 0 }
    );
  }, [filteredAndSortedLines]);

  // Compute dynamic rowSpan for consecutive rows belonging to the same PO
  const rowSpanMap = useMemo(() => {
    const map = new Map<number, { isFirst: boolean; span: number; poIndex: number }>();
    let poCounter = 0;
    let i = 0;
    while (i < filteredAndSortedLines.length) {
      const currentPoId = filteredAndSortedLines[i].poId;
      let j = i + 1;
      while (j < filteredAndSortedLines.length && filteredAndSortedLines[j].poId === currentPoId) {
        j++;
      }
      const span = j - i;
      poCounter++;
      for (let k = i; k < j; k++) {
        map.set(k, { isFirst: k === i, span, poIndex: poCounter });
      }
      i = j;
    }
    return map;
  }, [filteredAndSortedLines]);

  // Excel Export (Split Rows Detailed with PO cell merging)
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sample PO Detailed Report');

      sheet.columns = [
        { header: '#', key: 'sNo', width: 8 },
        { header: 'PO No', key: 'entryNumber', width: 20 },
        { header: 'Company Name', key: 'vendorName', width: 32 },
        { header: 'DC Date', key: 'customerDcDate', width: 16 },
        { header: 'DC No.', key: 'customerDcNumber', width: 16 },
        { header: 'Style No.', key: 'styleNo', width: 16 },
        { header: 'Item', key: 'itemName', width: 22 },
        { header: 'Wash Process', key: 'washType', width: 24 },
        { header: 'Inward', key: 'quantity', width: 14 },
        { header: 'Dispatch', key: 'dispatchedQuantity', width: 14 },
        { header: 'Balance', key: 'balanceQuantity', width: 14 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Status', key: 'status', width: 16 }
      ];

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };

      filteredAndSortedLines.forEach((row, idx) => {
        const meta = rowSpanMap.get(idx);
        const excelRow = sheet.addRow({
          sNo: meta?.isFirst ? meta.poIndex : '',
          entryNumber: meta?.isFirst ? row.entryNumber : '',
          vendorName: meta?.isFirst ? row.vendorName : '',
          customerDcDate: row.customerDcDate,
          customerDcNumber: row.customerDcNumber,
          styleNo: row.styleNo,
          itemName: row.itemName,
          washType: row.washType,
          quantity: row.quantity,
          dispatchedQuantity: row.dispatchedQuantity,
          balanceQuantity: row.balanceQuantity,
          unit: row.unit,
          status: meta?.isFirst ? row.status : ''
        });
        excelRow.alignment = { vertical: 'middle' };
      });

      // Merge PO-level columns (1: #, 2: PO No, 3: Company Name, 13: Status) across span
      rowSpanMap.forEach((meta, idx) => {
        if (meta.isFirst && meta.span > 1) {
          const startExcelRow = idx + 2; // +1 header, +1 1-based index
          const endExcelRow = startExcelRow + meta.span - 1;
          [1, 2, 3, 13].forEach((colIdx) => {
            sheet.mergeCells(startExcelRow, colIdx, endExcelRow, colIdx);
          });
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Perla_Sample_PO_Detailed_Report_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export Sample PO report:', e);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            data-back-button="true"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            title="Back to Sample PO / Inward (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Sample PO / Inward Detailed Report
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF5FB] text-[#1F4E79] border border-blue-200">
                {filteredPOs.length} POs • {flattenedLines.length} Lines
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed line-by-line breakdown split by Sample PO number
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PdfExportButton
            onClick={() =>
              SamplePoPdfService.downloadSamplePoFilteredReportPdf(
                filteredAndSortedLines,
                startDate,
                endDate
              )
            }
            disabled={filteredAndSortedLines.length === 0}
            title="Download filtered report as PDF"
          />

          <ExcelExportButton
            onClick={handleExportExcel}
            disabled={filteredAndSortedLines.length === 0}
            label="Export Excel"
            title="Export filtered split-row Sample PO report to Excel"
          />
        </div>
      </div>

      {/* 2. Report Filters & View Mode Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Customer / Vendor */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Customer / Vendor
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Customers / Vendors</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Quick Search */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Quick Search
            </label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="PO No, DC No, Item, Style..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-7 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Reset */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grouped by Sample PO
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Split-Row Table
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Report Body */}
      {filteredPOs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Sample POs Found</h3>
          <p className="text-xs text-slate-500">
            No sample purchase orders match your selected filters.
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        /* --- VIEW 1: GROUPED BY SAMPLE PO (Split Rows per PO) --- */
        <div className="space-y-4">
          {filteredPOs.map((po) => {
            const isExpanded = expandedPOs[po.id] !== false; // default expanded
            const items = po.items || [];
            const poTotalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || po.totalQuantity || 0;
            const poTotalDisp = items.reduce((sum, it) => sum + Number(it.dispatchedQuantity || 0), 0) || po.totalDispatchedQuantity || 0;
            const poBalance = Math.max(0, poTotalQty - poTotalDisp);

            const isCancelled = (po.status || '').toLowerCase() === 'cancelled';
            const effectiveStatus = isCancelled ? 'cancelled' : (po.dispatchStatus || 'pending').toLowerCase();

            return (
              <div
                key={po.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
              >
                {/* PO Header Bar */}
                <div
                  onClick={() => togglePOExpand(po.id)}
                  className="p-3.5 bg-slate-50/90 hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>

                    <span className="font-mono font-bold text-sm text-[#1F4E79]">
                      {po.entryNumber}
                    </span>

                    <span className="text-xs text-slate-500 font-medium">
                      DC: <strong className="text-slate-800 font-mono">#{po.customerDcNumber || '—'}</strong>
                    </span>

                    <span className="text-xs text-slate-500 font-medium">
                      Date: <strong className="text-slate-800">{formatDisplayDate(po.customerDcDate)}</strong>
                    </span>

                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {po.vendorName || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border ${
                        effectiveStatus === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : effectiveStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : effectiveStatus === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {effectiveStatus}
                    </span>
                  </div>
                </div>

                {/* Split Line Items Table for this PO */}
                {isExpanded && (
                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10.5px] border-b border-blue-100">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Customer DC No</th>
                            <th className="py-2 px-3">Customer DC Date</th>
                            <th className="py-2 px-3">Item Name</th>
                            <th className="py-2 px-3">Style No</th>
                            <th className="py-2 px-3">Wash / Process</th>
                            <th className="py-2 px-3 text-right">Inward Qty</th>
                            <th className="py-2 px-3 text-right">Dispatched</th>
                            <th className="py-2 px-3 text-right">Balance Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {items.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-4 text-center text-slate-400 italic">
                                No item lines recorded
                              </td>
                            </tr>
                          ) : (
                            items.map((it, idx) => {
                              const qty = Number(it.quantity || 0);
                              const disp = Number(it.dispatchedQuantity || 0);
                              const bal = Math.max(0, qty - disp);
                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                  <td className="py-2 px-3 text-center text-slate-400 font-mono">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                    DC #{it.customerDcNumber || po.customerDcNumber || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {formatDisplayDate(it.customerDcDate || po.customerDcDate)}
                                  </td>
                                  <td className="py-2 px-3 font-bold text-slate-900">
                                    {it.itemName || '—'}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                                    {it.styleNo || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-slate-700">
                                    {it.washType || '—'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                    {qty} {it.unit || 'PCS'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-600">
                                    {disp} {it.unit || 'PCS'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                                    {bal} {it.unit || 'PCS'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={6} className="py-2 px-3 text-right uppercase text-[10px] text-slate-600">
                              PO Subtotal ({items.length} {items.length === 1 ? 'Line' : 'Lines'})
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-900">
                              {poTotalQty} PCS
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {poTotalDisp} PCS
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#1F4E79]">
                              {poBalance} PCS
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* --- VIEW 2: SPLIT-ROW CONSOLIDATED TABLE WITH ALL ERP CONTROLS --- */
        <TableMaximizeWrapper
          title="Sample PO / Inward Split-Row Report"
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {filteredAndSortedLines.length} Split Rows
            </span>
          }
        >
          {(isMaximized) => (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
              {/* Table Controls Bar */}
              <div className="p-3.5 pr-14 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px] max-w-lg">
                  <div className="relative">
                    <select
                      value={tableSearchColumn}
                      onChange={(e) => setTableSearchColumn(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Columns</option>
                      <option value="entryNumber">PO No</option>
                      <option value="vendorName">Company Name</option>
                      <option value="customerDcDate">DC Date</option>
                      <option value="customerDcNumber">DC No.</option>
                      <option value="styleNo">Style No.</option>
                      <option value="itemName">Item</option>
                      <option value="washType">Wash Process</option>
                      <option value="status">Status</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="relative flex-1 flex items-center">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search split rows..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                    />
                    {tableSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTableSearchQuery('')}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowColumnFilters((prev) => !prev)}
                  className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    showColumnFilters
                      ? 'bg-blue-50 border-blue-300 text-[#1F4E79]'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Column Filters</span>
                </button>
              </div>

              {/* Split-Row Table */}
              <div
                data-table-scroll="true"
                className={`overflow-x-auto overflow-y-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[600px]'}`}
              >
                <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
                  <thead className="sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300 select-none">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center whitespace-nowrap">#</th>
                      <th
                        onClick={() => handleSort('entryNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>PO No</span>
                          {renderSortIcon('entryNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('vendorName')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[180px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Company Name</span>
                          {renderSortIcon('vendorName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('customerDcDate')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[115px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>DC Date</span>
                          {renderSortIcon('customerDcDate')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('customerDcNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[110px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>DC No.</span>
                          {renderSortIcon('customerDcNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('styleNo')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[100px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Style No.</span>
                          {renderSortIcon('styleNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('itemName')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[130px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Item</span>
                          {renderSortIcon('itemName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('washType')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Wash Process</span>
                          {renderSortIcon('washType')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('quantity')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[95px]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Inward</span>
                          {renderSortIcon('quantity')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('dispatchedQuantity')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[95px]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Dispatch</span>
                          {renderSortIcon('dispatchedQuantity')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('balanceQuantity')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[95px]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Balance</span>
                          {renderSortIcon('balanceQuantity')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="py-3 px-3 pr-12 text-center cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          {renderSortIcon('status')}
                        </div>
                      </th>
                    </tr>

                    {showColumnFilters && (
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                        <th className="p-1.5 text-center text-[10px] text-slate-400">#</th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter PO..."
                            value={columnFilters.entryNumber}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, entryNumber: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Company..."
                            value={columnFilters.vendorName}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, vendorName: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="DC Date..."
                            value={columnFilters.customerDcDate}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, customerDcDate: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="DC No..."
                            value={columnFilters.customerDcNumber}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, customerDcNumber: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Style..."
                            value={columnFilters.styleNo}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, styleNo: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Item..."
                            value={columnFilters.itemName}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, itemName: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Wash..."
                            value={columnFilters.washType}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, washType: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th colSpan={3} className="p-1.5"></th>
                        <th className="p-1.5 pr-12">
                          <input
                            type="text"
                            placeholder="Status..."
                            value={columnFilters.status}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, status: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal text-center"
                          />
                        </th>
                      </tr>
                    )}
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAndSortedLines.map((row, idx) => {
                      const meta = rowSpanMap.get(idx) || { isFirst: true, span: 1, poIndex: idx + 1 };
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/90 transition-colors">
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold align-middle border-r border-slate-100 whitespace-nowrap"
                            >
                              {meta.poIndex}
                            </td>
                          )}
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 font-mono font-bold text-[#1F4E79] whitespace-nowrap align-middle border-r border-slate-100"
                            >
                              {row.entryNumber}
                            </td>
                          )}
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 font-bold text-slate-900 align-middle border-r border-slate-100"
                            >
                              {row.vendorName}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap align-middle">
                            {formatDisplayDate(row.customerDcDate)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap align-middle">
                            DC #{row.customerDcNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap align-middle">
                            {row.styleNo}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap align-middle">
                            {row.itemName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap align-middle">
                            {row.washType}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-middle">
                            {row.quantity} {row.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap align-middle">
                            {row.dispatchedQuantity} {row.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700 whitespace-nowrap align-middle">
                            {row.balanceQuantity} {row.unit}
                          </td>
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 pr-12 text-center whitespace-nowrap align-middle border-l border-slate-100"
                            >
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">
                                {row.status}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>

                  <TableTotalsFooter
                    cells={[
                      { colSpan: 8, label: `Total (${filteredAndSortedLines.length} Split Lines)`, isTotal: true },
                      { quantity: tableTotals.quantity, unit: 'piece', isTotal: true },
                      { quantity: tableTotals.dispatched, unit: 'piece', isTotal: true },
                      { quantity: tableTotals.balance, unit: 'piece', isTotal: true },
                      { content: '—', align: 'center', className: 'pr-12' }
                    ]}
                  />
                </table>
              </div>

              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                <div>
                  Showing all <strong>{filteredAndSortedLines.length}</strong> split-row records in one stretch
                </div>
                <div className="text-[11px] text-slate-400">
                  Perla ERP • Sample PO Detailed Report
                </div>
              </div>
            </div>
          )}
        </TableMaximizeWrapper>
      )}
    </div>
  );
};
