import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { SamplePoOutward } from '../../../types/samplePo';
import { Vendor } from '../../../types/vendor';
import { SamplePoPdfService } from '../../../services/samplePoPdfService';
import { PdfExportButton, ExcelExportButton } from '../../../components/ui/ExportButtons';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../../components/ui/TableMaximizeWrapper';

export interface FlattenedSampleOutwardLine {
  id: string;
  outwardId: string;
  entryNumber: string;
  outwardDcDate: string;
  outwardDcNumber: string;
  inwardEntryNumber: string;
  vendorName: string;
  customerDcDate: string;
  customerDcNumber: string;
  styleNo: string;
  itemName: string;
  washType: string;
  quantity: number;
  unit: string;
  status: string;
}

interface SampleOutwardReportProps {
  sampleOutwards: SamplePoOutward[];
  vendors: Vendor[];
  onBack: () => void;
}

type OutwardReportSortField =
  | 'entryNumber'
  | 'outwardDcDate'
  | 'outwardDcNumber'
  | 'inwardEntryNumber'
  | 'vendorName'
  | 'customerDcDate'
  | 'customerDcNumber'
  | 'styleNo'
  | 'itemName'
  | 'washType'
  | 'quantity'
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

export const SampleOutwardReport: React.FC<SampleOutwardReportProps> = ({
  sampleOutwards,
  vendors,
  onBack
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('table');
  const [expandedOutwards, setExpandedOutwards] = useState<Record<string, boolean>>({});

  // Split-Row Table Controls
  const [tableSearchColumn, setTableSearchColumn] = useState<string>('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    entryNumber: '',
    outwardDcDate: '',
    outwardDcNumber: '',
    inwardEntryNumber: '',
    vendorName: '',
    customerDcDate: '',
    customerDcNumber: '',
    styleNo: '',
    itemName: '',
    washType: '',
    status: ''
  });
  const [sortField, setSortField] = useState<OutwardReportSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  const vendorOptions = useMemo(() => {
    const map = new Map<string, string>();
    sampleOutwards.forEach((o) => {
      if (o.vendorId && o.vendorName) map.set(o.vendorId, o.vendorName);
    });
    vendors.forEach((v) => {
      const id = v.vendorId || v.id;
      const name = v.companyName || (v as any).name;
      if (id && name && !map.has(id)) map.set(id, name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sampleOutwards, vendors]);

  const filteredOutwards = useMemo(() => {
    return sampleOutwards.filter((o) => {
      if (selectedVendorId !== 'all' && o.vendorId !== selectedVendorId) {
        return false;
      }
      if (startDate && (o.outwardDcDate || '') < startDate) {
        return false;
      }
      if (endDate && (o.outwardDcDate || '') > endDate) {
        return false;
      }
      const st = (o.status || 'active').toLowerCase();
      if (statusFilter !== 'all' && st !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesHeader =
          (o.entryNumber || '').toLowerCase().includes(q) ||
          (o.outwardDcNumber || '').toLowerCase().includes(q) ||
          (o.inwardEntryNumber || '').toLowerCase().includes(q) ||
          (o.customerDcNumber || '').toLowerCase().includes(q) ||
          (o.vendorName || '').toLowerCase().includes(q) ||
          (o.remarks || '').toLowerCase().includes(q);
        const matchesItem = (o.items || []).some(
          (it) =>
            (it.itemName || '').toLowerCase().includes(q) ||
            (it.styleNo || '').toLowerCase().includes(q) ||
            (it.washType || '').toLowerCase().includes(q)
        );
        if (!matchesHeader && !matchesItem) return false;
      }
      return true;
    });
  }, [sampleOutwards, selectedVendorId, startDate, endDate, statusFilter, searchQuery]);

  const flattenedLines = useMemo<FlattenedSampleOutwardLine[]>(() => {
    const rows: FlattenedSampleOutwardLine[] = [];
    filteredOutwards.forEach((o) => {
      const statusText =
        (o.status || 'Active').charAt(0).toUpperCase() + (o.status || 'active').slice(1).toLowerCase();
      if (o.items && o.items.length > 0) {
        o.items.forEach((it, idx) => {
          rows.push({
            id: `${o.id}-${it.id || idx}`,
            outwardId: o.id,
            entryNumber: o.entryNumber,
            outwardDcDate: it.outwardDcDate || o.outwardDcDate || '',
            outwardDcNumber: it.outwardDcNumber || o.outwardDcNumber || '—',
            inwardEntryNumber: o.inwardEntryNumber || '—',
            vendorName: o.vendorName || '—',
            customerDcDate: it.customerDcDate || o.customerDcDate || '',
            customerDcNumber: it.customerDcNumber || o.customerDcNumber || '—',
            styleNo: it.styleNo || '—',
            itemName: it.itemName || '—',
            washType: it.washType || '—',
            quantity: Number(it.quantity || 0),
            unit: it.unit || 'PCS',
            status: statusText
          });
        });
      } else {
        rows.push({
          id: `${o.id}-empty`,
          outwardId: o.id,
          entryNumber: o.entryNumber,
          outwardDcDate: o.outwardDcDate || '',
          outwardDcNumber: o.outwardDcNumber || '—',
          inwardEntryNumber: o.inwardEntryNumber || '—',
          vendorName: o.vendorName || '—',
          customerDcDate: o.customerDcDate || '',
          customerDcNumber: o.customerDcNumber || '—',
          styleNo: '—',
          itemName: '—',
          washType: '—',
          quantity: Number(o.totalQuantity || 0),
          unit: 'PCS',
          status: statusText
        });
      }
    });
    return rows;
  }, [filteredOutwards]);

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
          row.outwardDcNumber.toLowerCase().includes(q) ||
          row.inwardEntryNumber.toLowerCase().includes(q) ||
          row.vendorName.toLowerCase().includes(q) ||
          row.customerDcNumber.toLowerCase().includes(q) ||
          row.styleNo.toLowerCase().includes(q) ||
          row.itemName.toLowerCase().includes(q) ||
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

  const rowSpanMap = useMemo(() => {
    const map = new Map<number, { isFirst: boolean; span: number; outwardIndex: number }>();
    let counter = 0;
    let i = 0;
    while (i < filteredAndSortedLines.length) {
      const currentId = filteredAndSortedLines[i].outwardId;
      let j = i + 1;
      while (j < filteredAndSortedLines.length && filteredAndSortedLines[j].outwardId === currentId) {
        j++;
      }
      const span = j - i;
      counter++;
      for (let k = i; k < j; k++) {
        map.set(k, { isFirst: k === i, span, outwardIndex: counter });
      }
      i = j;
    }
    return map;
  }, [filteredAndSortedLines]);

  const handleSort = (field: OutwardReportSortField) => {
    const isNumericOrDate =
      field === 'quantity' || field === 'outwardDcDate' || field === 'customerDcDate';
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

  const renderSortIcon = (field: OutwardReportSortField) => {
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

  const toggleExpand = (id: string) => {
    setExpandedOutwards((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false
    }));
  };

  const totalDispatched = useMemo(() => {
    return filteredAndSortedLines.reduce((sum, r) => sum + r.quantity, 0);
  }, [filteredAndSortedLines]);

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sample Outward Report');

      sheet.columns = [
        { header: '#', key: 'sNo', width: 8 },
        { header: 'Outward No', key: 'entryNumber', width: 20 },
        { header: 'Outward Date', key: 'outwardDcDate', width: 15 },
        { header: 'Outward DC', key: 'outwardDcNumber', width: 15 },
        { header: 'Inward PO No', key: 'inwardEntryNumber', width: 20 },
        { header: 'Company Name', key: 'vendorName', width: 32 },
        { header: 'Cust DC Date', key: 'customerDcDate', width: 15 },
        { header: 'Cust DC No.', key: 'customerDcNumber', width: 15 },
        { header: 'Style No.', key: 'styleNo', width: 16 },
        { header: 'Item', key: 'itemName', width: 22 },
        { header: 'Wash Process', key: 'washType', width: 24 },
        { header: 'Dispatch Qty', key: 'quantity', width: 14 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Status', key: 'status', width: 14 }
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
          sNo: meta?.isFirst ? meta.outwardIndex : '',
          entryNumber: meta?.isFirst ? row.entryNumber : '',
          outwardDcDate: meta?.isFirst ? row.outwardDcDate : '',
          outwardDcNumber: meta?.isFirst ? row.outwardDcNumber : '',
          inwardEntryNumber: meta?.isFirst ? row.inwardEntryNumber : '',
          vendorName: meta?.isFirst ? row.vendorName : '',
          customerDcDate: row.customerDcDate,
          customerDcNumber: row.customerDcNumber,
          styleNo: row.styleNo,
          itemName: row.itemName,
          washType: row.washType,
          quantity: row.quantity,
          unit: row.unit,
          status: meta?.isFirst ? row.status : ''
        });
        excelRow.alignment = { vertical: 'middle' };
      });

      rowSpanMap.forEach((meta, idx) => {
        if (meta.isFirst && meta.span > 1) {
          const startExcelRow = idx + 2;
          const endExcelRow = startExcelRow + meta.span - 1;
          [1, 2, 3, 4, 5, 6, 14].forEach((colIdx) => {
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
      a.download = `Perla_Sample_Outward_Report_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export Sample Outward report:', e);
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
            title="Back to Sample Outward (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Sample Outward Detailed Report
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF5FB] text-[#1F4E79] border border-blue-200">
                {filteredOutwards.length} Outwards • {flattenedLines.length} Lines
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detailed line-by-line dispatch breakdown split by Sample Outward number
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PdfExportButton
            onClick={() =>
              SamplePoPdfService.downloadSampleOutwardFilteredReportPdf(
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
            title="Export filtered split-row Sample Outward report to Excel"
          />
        </div>
      </div>

      {/* 2. Report Filters & View Mode Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Company / Customer
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Companies</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

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
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
              Quick Search
            </label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Outward No, DC, PO, Item..."
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
              Grouped by Sample Outward
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
      {filteredOutwards.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Sample Outwards Found</h3>
          <p className="text-xs text-slate-500">
            No sample outward dispatches match your selected filters.
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-4">
          {filteredOutwards.map((o) => {
            const isExpanded = expandedOutwards[o.id] !== false;
            const items = o.items || [];
            const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || o.totalQuantity || 0;

            return (
              <div key={o.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div
                  onClick={() => toggleExpand(o.id)}
                  className="p-3.5 bg-slate-50/90 hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                    <span className="font-mono font-bold text-sm text-[#1F4E79]">{o.entryNumber}</span>
                    <span className="text-xs text-slate-500 font-medium">
                      Outward DC: <strong className="text-slate-800 font-mono">#{o.outwardDcNumber || '—'}</strong>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Date: <strong className="text-slate-800">{formatDisplayDate(o.outwardDcDate)}</strong>
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Inward PO: <strong className="text-[#1F4E79] font-mono">{o.inwardEntryNumber || '—'}</strong>
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Company:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {o.vendorName || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200">
                      {o.status || 'active'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10.5px] border-b border-blue-100">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Cust DC Date</th>
                            <th className="py-2 px-3">Cust DC No.</th>
                            <th className="py-2 px-3">Style No.</th>
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3">Wash Process</th>
                            <th className="py-2 px-3 text-right">Dispatch Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                                {formatDisplayDate(it.customerDcDate || o.customerDcDate)}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                DC #{it.customerDcNumber || o.customerDcNumber || '—'}
                              </td>
                              <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                                {it.styleNo || '—'}
                              </td>
                              <td className="py-2 px-3 font-bold text-slate-900">{it.itemName || '—'}</td>
                              <td className="py-2 px-3 text-slate-700">{it.washType || '—'}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                                {it.quantity} {it.unit || 'PCS'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                          <tr>
                            <td colSpan={6} className="py-2 px-3 text-right uppercase text-[10px] text-slate-600">
                              Outward Subtotal ({items.length} {items.length === 1 ? 'Line' : 'Lines'})
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-[#1F4E79]">
                              {totalQty} PCS
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
        <TableMaximizeWrapper
          title="Sample Outward Split-Row Report"
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {filteredAndSortedLines.length} Split Rows
            </span>
          }
        >
          {(isMaximized) => (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="p-3.5 pr-14 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px] max-w-lg">
                  <div className="relative">
                    <select
                      value={tableSearchColumn}
                      onChange={(e) => setTableSearchColumn(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Columns</option>
                      <option value="entryNumber">Outward No</option>
                      <option value="outwardDcNumber">Outward DC</option>
                      <option value="inwardEntryNumber">Inward PO No</option>
                      <option value="vendorName">Company Name</option>
                      <option value="customerDcNumber">Cust DC No.</option>
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

              <div
                data-table-scroll="true"
                className={`overflow-x-auto overflow-y-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[600px]'}`}
              >
                <table className="w-full text-left text-xs border-collapse min-w-[1350px]">
                  <thead className="sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300 select-none">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center whitespace-nowrap">#</th>
                      <th
                        onClick={() => handleSort('entryNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Outward No</span>
                          {renderSortIcon('entryNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('outwardDcDate')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[115px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Outward Date</span>
                          {renderSortIcon('outwardDcDate')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('outwardDcNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[115px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Outward DC</span>
                          {renderSortIcon('outwardDcNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('inwardEntryNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Inward PO No</span>
                          {renderSortIcon('inwardEntryNumber')}
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
                          <span>Cust DC Date</span>
                          {renderSortIcon('customerDcDate')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('customerDcNumber')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[110px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Cust DC No.</span>
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
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[125px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Item</span>
                          {renderSortIcon('itemName')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('washType')}
                        className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[135px]"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Wash Process</span>
                          {renderSortIcon('washType')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('quantity')}
                        className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[110px]"
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Dispatch Qty</span>
                          {renderSortIcon('quantity')}
                        </div>
                      </th>
                      <th
                        onClick={() => handleSort('status')}
                        className="py-3 px-3 pr-12 text-center cursor-pointer hover:bg-[#DCE9F5] group whitespace-nowrap min-w-[110px]"
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
                            placeholder="Outward..."
                            value={columnFilters.entryNumber}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, entryNumber: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Date..."
                            value={columnFilters.outwardDcDate}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, outwardDcDate: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="DC..."
                            value={columnFilters.outwardDcNumber}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, outwardDcNumber: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="PO..."
                            value={columnFilters.inwardEntryNumber}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, inwardEntryNumber: e.target.value }))}
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
                            placeholder="Date..."
                            value={columnFilters.customerDcDate}
                            onChange={(e) => setColumnFilters((p) => ({ ...p, customerDcDate: e.target.value }))}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                          />
                        </th>
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Cust DC..."
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
                        <th className="p-1.5"></th>
                        <th className="p-1.5 pr-12 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setColumnFilters({
                                entryNumber: '',
                                outwardDcDate: '',
                                outwardDcNumber: '',
                                inwardEntryNumber: '',
                                vendorName: '',
                                customerDcDate: '',
                                customerDcNumber: '',
                                styleNo: '',
                                itemName: '',
                                washType: '',
                                status: ''
                              })
                            }
                            className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </th>
                      </tr>
                    )}
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAndSortedLines.map((row, idx) => {
                      const meta = rowSpanMap.get(idx) || { isFirst: true, span: 1, outwardIndex: idx + 1 };
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/90 transition-colors">
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold align-middle border-r border-slate-100 whitespace-nowrap"
                            >
                              {meta.outwardIndex}
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
                              className="py-2.5 px-3 text-slate-600 whitespace-nowrap align-middle border-r border-slate-100"
                            >
                              {formatDisplayDate(row.outwardDcDate)}
                            </td>
                          )}
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap align-middle border-r border-slate-100"
                            >
                              DC #{row.outwardDcNumber}
                            </td>
                          )}
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 font-mono font-semibold text-[#1F4E79] whitespace-nowrap align-middle border-r border-slate-100"
                            >
                              {row.inwardEntryNumber}
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
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap align-middle">
                            {row.quantity} {row.unit}
                          </td>
                          {meta.isFirst && (
                            <td
                              rowSpan={meta.span}
                              className="py-2.5 px-3 pr-12 text-center whitespace-nowrap align-middle border-l border-slate-100"
                            >
                              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
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
                      { colSpan: 11, label: `Total (${filteredAndSortedLines.length} Split Lines)`, isTotal: true },
                      { quantity: totalDispatched, unit: 'piece', isTotal: true },
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
                  Perla ERP • Sample Outward Detailed Report
                </div>
              </div>
            </div>
          )}
        </TableMaximizeWrapper>
      )}
    </div>
  );
};
