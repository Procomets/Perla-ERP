import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { formatDate, formatCurrency } from '../../../utils/formatters';
import { POReportPdfService } from '../../../services/poReportPdfService';
import { POReportExcelService } from '../../../services/poReportExcelService';
import {
  PdfExportButton,
  ExcelExportButton,
  ExcelSummaryExportButton,
  PreviewButton
} from '../../../components/ui/ExportButtons';
import {
  ArrowLeft,
  RotateCcw,
  Search,
  Filter,
  Layers,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  Package,
  SlidersHorizontal,
  ArrowUpDown,
  X
} from 'lucide-react';
import { useTableControls, TableColumnConfig } from '../../../hooks/useTableControls';

export interface FlattenedPOLine {
  id: string;
  poId: string;
  poNumber: string;
  orderDate: string;
  customerName: string;
  customerPoNumber: string;
  styleNo: string;
  itemName: string;
  processCategory: string;
  colourName: string;
  processType: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  status: string;
}

const PO_REPORT_TABLE_COLUMNS: TableColumnConfig<FlattenedPOLine>[] = [
  { key: 'poNumber', label: 'PO Number', type: 'text', getValue: (r) => r.poNumber },
  { key: 'orderDate', label: 'Date', type: 'date', getValue: (r) => r.orderDate },
  { key: 'customerName', label: 'Customer', type: 'text', getValue: (r) => r.customerName },
  { key: 'customerPoNumber', label: 'Customer PO', type: 'text', getValue: (r) => r.customerPoNumber },
  { key: 'styleNo', label: 'Style No', type: 'text', getValue: (r) => r.styleNo },
  { key: 'itemName', label: 'Item Description', type: 'text', getValue: (r) => r.itemName },
  { key: 'processCategory', label: 'Process', type: 'text', getValue: (r) => r.processCategory },
  { key: 'colourName', label: 'Colour Name', type: 'text', getValue: (r) => r.colourName },
  { key: 'processType', label: 'Wash / Treatment', type: 'text', getValue: (r) => r.processType },
  { key: 'quantity', label: 'Qty', type: 'number', getValue: (r) => r.quantity },
  { key: 'unit', label: 'Unit', type: 'text', getValue: (r) => r.unit },
  { key: 'rate', label: 'Rate (₹)', type: 'number', getValue: (r) => r.rate },
  { key: 'amount', label: 'Amount (₹)', type: 'number', getValue: (r) => r.amount },
  { key: 'status', label: 'Status', type: 'text', getValue: (r) => r.status },
];

interface POReportProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  onBack: () => void;
  onViewPO?: (poId: string) => void;
}

export const POReport: React.FC<POReportProps> = ({
  pos,
  vendors,
  onBack,
  onViewPO
}) => {
  // --- Filter States ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [processCategory, setProcessCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcelColours, setIsExportingExcelColours] = useState<boolean>(false);
  const [isExportingExcelPO, setIsExportingExcelPO] = useState<boolean>(false);

  // Expanded PO Cards state (for grouped view)
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});

  // Filter Vendors to only Customer / Main companies
  const customerList = useMemo(() => {
    return vendors.filter((v) => {
      const type = (v.vendorType || '').toLowerCase();
      const isSub = v.vendorCategory === 'subcompany' || !!v.parentVendorId;
      return (type === 'customer' || type === 'both') && !isSub;
    });
  }, [vendors]);

  // Selected Vendor object
  const selectedVendor = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
  }, [vendors, selectedCustomerId]);

  // Dynamic list of all statuses present in data plus standard PO lifecycle statuses
  const dynamicStatusOptions = useMemo(() => {
    const statusMap = new Map<string, string>();

    // Standard PO lifecycle statuses
    const standardStatuses = [
      { key: 'draft', label: 'Draft' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'approved', label: 'Approved' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'partially_received', label: 'Partially Received' },
      { key: 'fully_received', label: 'Fully Received' },
      { key: 'completed', label: 'Completed' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'cancelled', label: 'Cancelled' }
    ];

    standardStatuses.forEach(({ key, label }) => {
      statusMap.set(key.toLowerCase(), label);
    });

    // Dynamically collect any statuses appearing in the PO data
    pos.forEach((p) => {
      if (p.status) {
        const raw = String(p.status).trim();
        const key = raw.toLowerCase();
        if (!statusMap.has(key)) {
          const formatted = raw
            .replace(/[_-]/g, ' ')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
          statusMap.set(key, formatted);
        }
      }
    });

    return Array.from(statusMap.entries()).map(([value, label]) => ({
      value,
      label
    }));
  }, [pos]);

  // Dynamic list of process categories
  const dynamicProcessOptions = useMemo(() => {
    const procMap = new Map<string, string>();
    procMap.set('washing', 'Washing');
    procMap.set('dyeing', 'Dyeing');

    pos.forEach((p) => {
      if (p.processCategory) {
        const raw = String(p.processCategory).trim();
        const key = raw.toLowerCase();
        if (!procMap.has(key)) {
          const formatted = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
          procMap.set(key, formatted);
        }
      }
    });

    return Array.from(procMap.entries()).map(([value, label]) => ({
      value,
      label
    }));
  }, [pos]);

  // --- Filtering Logic ---
  const filteredPOs = useMemo(() => {
    return pos.filter((po) => {
      // 1. Customer Filter
      if (selectedCustomerId !== 'all') {
        const poCustId = po.customerId || po.customerVendorId;
        const matchesId = poCustId === selectedCustomerId;
        const matchesName =
          selectedVendor &&
          (po.customerName?.toLowerCase() === selectedVendor.companyName?.toLowerCase() ||
            po.customerCompanyNameSnapshot?.toLowerCase() === selectedVendor.companyName?.toLowerCase());

        if (!matchesId && !matchesName) return false;
      }

      // 2. Start Date Filter
      if (startDate && po.orderDate) {
        const poDate = new Date(po.orderDate).getTime();
        const filterStart = new Date(`${startDate}T00:00:00`).getTime();
        if (poDate < filterStart) return false;
      }

      // 3. End Date Filter
      if (endDate && po.orderDate) {
        const poDate = new Date(po.orderDate).getTime();
        const filterEnd = new Date(`${endDate}T23:59:59`).getTime();
        if (poDate > filterEnd) return false;
      }

      // 4. Process Category Filter
      if (processCategory !== 'all') {
        if ((po.processCategory || '').toLowerCase() !== processCategory.toLowerCase()) {
          return false;
        }
      }

      // 5. Status Filter
      if (status !== 'all') {
        const poStatusClean = (po.status || '').toLowerCase().trim();
        const filterStatusClean = status.toLowerCase().trim();
        if (poStatusClean !== filterStatusClean) {
          const poNorm = poStatusClean.replace(/[_-]/g, ' ');
          const filterNorm = filterStatusClean.replace(/[_-]/g, ' ');
          if (poNorm !== filterNorm) {
            return false;
          }
        }
      }

      // 6. Search Query (PO Number, Style No, Item Name, or Colour)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const poNumMatch = (po.poNumber || '').toLowerCase().includes(q);
        const styleMatch = (po.styleNo || po.styleNumber || '').toLowerCase().includes(q);
        const itemMatch = (po.itemName || '').toLowerCase().includes(q);
        const custMatch = (po.customerCompanyNameSnapshot || po.customerName || '').toLowerCase().includes(q);
        const custPoMatch = (po.customerPoNumber || '').toLowerCase().includes(q);

        const lines = po.colourLines || po.lines || [];
        const colourMatch = lines.some(
          (l) => (l.colourName || '').toLowerCase().includes(q) || (l.processType || '').toLowerCase().includes(q)
        );

        if (!poNumMatch && !styleMatch && !itemMatch && !custMatch && !custPoMatch && !colourMatch) {
          return false;
        }
      }

      return true;
    });
  }, [pos, selectedCustomerId, selectedVendor, startDate, endDate, processCategory, status, searchQuery]);

  // --- Flattened Lines & Table Controls for View Mode 2 ---
  const flattenedPORows: FlattenedPOLine[] = useMemo(() => {
    return filteredPOs.flatMap((po) => {
      const lines = po.colourLines || po.lines || [];
      const poNum = po.poNumber || 'PO/PENDING';
      const poDate = po.orderDate || '';
      const custName = po.customerCompanyNameSnapshot || po.customerName || '—';
      const custPo = po.customerPoNumber || '—';
      const style = po.styleNo || po.styleNumber || '—';
      const item = po.itemName || '—';
      const pCat = (po.processCategory || 'washing').toUpperCase();
      const st = (po.status || 'draft').toUpperCase();

      if (lines.length === 0) {
        return [
          {
            id: `${po.id || po.poId}_empty`,
            poId: po.id || po.poId,
            poNumber: poNum,
            orderDate: poDate,
            customerName: custName,
            customerPoNumber: custPo,
            styleNo: style,
            itemName: item,
            processCategory: pCat,
            colourName: '—',
            processType: '—',
            quantity: Number(po.totalQuantity) || 0,
            unit: 'PCS',
            rate: 0,
            amount: Number(po.totalAmount) || 0,
            status: st,
          },
        ];
      }

      return lines.map((l, lIdx) => {
        const lineQty = Number(l.quantity) || 0;
        const lineRate = Number(l.rate) || 0;
        const lineAmt = Number(l.amount ?? l.lineAmount ?? (lineQty * lineRate)) || 0;
        return {
          id: `${po.id || po.poId}_line_${l.lineId || lIdx}`,
          poId: po.id || po.poId,
          poNumber: poNum,
          orderDate: poDate,
          customerName: custName,
          customerPoNumber: custPo,
          styleNo: style,
          itemName: item,
          processCategory: pCat,
          colourName: l.colourName || '—',
          processType: l.processType || '—',
          quantity: lineQty,
          unit: (l.unit || 'PCS').toUpperCase(),
          rate: lineRate,
          amount: lineAmt,
          status: st,
        };
      });
    });
  }, [filteredPOs]);

  const poTableControls = useTableControls<FlattenedPOLine>(flattenedPORows, {
    columns: PO_REPORT_TABLE_COLUMNS,
    defaultSortField: 'orderDate',
    defaultSortDirection: 'desc',
  });

  // Effective purchase orders matching active table controls (column filters, search query, sorting)
  const effectivePOs: PurchaseOrder[] = useMemo(() => {
    const hasTableFilters =
      poTableControls.searchQuery.trim() !== '' ||
      poTableControls.searchColumn !== 'ALL' ||
      Object.values(poTableControls.columnFilters).some((v) => (v || '').trim() !== '');

    if (!hasTableFilters && viewMode === 'grouped') {
      return filteredPOs;
    }

    const poMap = new Map<string, PurchaseOrder>();
    filteredPOs.forEach((po) => {
      const key = po.id || po.poId;
      if (key) poMap.set(key, po);
    });

    const orderedPoIds: string[] = [];
    const rowsByPoId = new Map<string, typeof poTableControls.processedData>();

    poTableControls.processedData.forEach((row) => {
      if (!rowsByPoId.has(row.poId)) {
        rowsByPoId.set(row.poId, []);
        orderedPoIds.push(row.poId);
      }
      rowsByPoId.get(row.poId)!.push(row);
    });

    const result: PurchaseOrder[] = [];

    orderedPoIds.forEach((poId) => {
      const origPo = poMap.get(poId);
      if (!origPo) return;

      const matchingRows = rowsByPoId.get(poId) || [];
      const matchingRowIdSet = new Set(matchingRows.map((r) => r.id));

      const origLines = origPo.colourLines || origPo.lines || [];
      let filteredLines: typeof origLines = [];

      if (origLines.length === 0) {
        filteredLines = [];
      } else {
        filteredLines = origLines.filter((l, lIdx) => {
          const rowId = `${poId}_line_${l.lineId || lIdx}`;
          return matchingRowIdSet.has(rowId);
        });
      }

      if (origLines.length > 0 && filteredLines.length === 0) {
        return;
      }

      const totalQty = filteredLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
      const totalAmount = filteredLines.reduce((sum, l) => {
        const qty = Number(l.quantity) || 0;
        const rate = Number(l.rate) || 0;
        return sum + (Number(l.amount ?? l.lineAmount ?? (qty * rate)) || 0);
      }, 0);

      const pieceQty = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() !== 'kg')
        .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
      const kgQty = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() === 'kg')
        .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

      result.push({
        ...origPo,
        colourLines: filteredLines,
        lines: filteredLines,
        totalQuantity: origLines.length > 0 ? totalQty : origPo.totalQuantity,
        totalAmount: origLines.length > 0 ? totalAmount : origPo.totalAmount,
        totalQtyByUnit: {
          piece: pieceQty,
          kg: kgQty
        }
      });
    });

    return result;
  }, [
    filteredPOs,
    poTableControls.processedData,
    poTableControls.searchQuery,
    poTableControls.searchColumn,
    poTableControls.columnFilters,
    viewMode
  ]);

  // --- Summary Metrics Calculations ---
  const metrics = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    let totalColours = 0;
    const styleSet = new Set<string>();

    effectivePOs.forEach((po) => {
      const style = po.styleNo || po.styleNumber;
      if (style) styleSet.add(style.trim().toLowerCase());

      const lines = po.colourLines || po.lines || [];
      if (lines.length > 0) {
        lines.forEach((l) => {
          totalQty += Number(l.quantity) || 0;
          totalAmount += Number(l.amount ?? l.lineAmount ?? (l.quantity * l.rate)) || 0;
          totalColours++;
        });
      } else {
        totalQty += Number(po.totalQuantity) || 0;
        totalAmount += Number(po.totalAmount) || 0;
      }
    });

    return {
      totalPOs: effectivePOs.length,
      totalQty,
      totalAmount,
      totalColours,
      uniqueStylesCount: styleSet.size
    };
  }, [effectivePOs]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedCustomerId !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    processCategory !== 'all' ||
    status !== 'all' ||
    searchQuery.trim() !== '';

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCustomerId('all');
    setStartDate('');
    setEndDate('');
    setProcessCategory('all');
    setStatus('all');
    setSearchQuery('');
  };

  // Date Preset Handlers
  const handlePresetDate = (type: 'this_month' | 'last_30_days' | 'this_year' | 'clear') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (type === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (type === 'last_30_days') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past30);
      setEndDate(todayStr);
    } else if (type === 'this_year') {
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDayOfYear);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Toggle PO Accordion
  const togglePOExpand = (poId: string) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [poId]: prev[poId] === undefined ? false : !prev[poId]
    }));
  };

  // Expand / Collapse All
  const handleToggleAll = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    filteredPOs.forEach((po) => {
      newState[po.id || po.poId] = expand;
    });
    setExpandedPOs(newState);
  };

  // --- Export Handlers ---
  const handleDownloadPdf = () => {
    if (effectivePOs.length === 0) {
      alert('No purchase orders to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      POReportPdfService.downloadPoReportPdf({
        pos: effectivePOs,
        customerName: selectedVendor?.companyName || (poTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (poTableControls.columnFilters['processCategory'] || poTableControls.columnFilters['processType'] || undefined),
        status: status !== 'all' ? status : (poTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting PDF report:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenPdfPreview = () => {
    if (effectivePOs.length === 0) {
      alert('No purchase orders to preview.');
      return;
    }
    try {
      POReportPdfService.openPoReportPdf({
        pos: effectivePOs,
        customerName: selectedVendor?.companyName || (poTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (poTableControls.columnFilters['processCategory'] || poTableControls.columnFilters['processType'] || undefined),
        status: status !== 'all' ? status : (poTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error opening PDF preview:', err);
      alert('Failed to preview PDF report.');
    }
  };

  const handleDownloadExcelWithColours = async () => {
    if (effectivePOs.length === 0) {
      alert('No purchase orders to export.');
      return;
    }
    setIsExportingExcelColours(true);
    try {
      await POReportExcelService.exportWithColours({
        pos: effectivePOs,
        customerName: selectedVendor?.companyName || (poTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (poTableControls.columnFilters['processCategory'] || poTableControls.columnFilters['processType'] || undefined),
        status: status !== 'all' ? status : (poTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting Excel report with colours:', err);
      alert('Failed to generate Excel report.');
    } finally {
      setIsExportingExcelColours(false);
    }
  };

  const handleDownloadExcelPOOnly = async () => {
    if (effectivePOs.length === 0) {
      alert('No purchase orders to export.');
      return;
    }
    setIsExportingExcelPO(true);
    try {
      await POReportExcelService.exportPOOnly({
        pos: effectivePOs,
        customerName: selectedVendor?.companyName || (poTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (poTableControls.columnFilters['processCategory'] || poTableControls.columnFilters['processType'] || undefined),
        status: status !== 'all' ? status : (poTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting PO summary Excel report:', err);
      alert('Failed to generate Excel report.');
    } finally {
      setIsExportingExcelPO(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* --- 1. Top Navigation & Action Header --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            title="Back to Purchase Orders"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Purchase Order Report Generation</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF5FB] text-[#1F4E79] border border-blue-200">
                {effectivePOs.length !== filteredPOs.length
                  ? `${effectivePOs.length} of ${filteredPOs.length} POs`
                  : `${filteredPOs.length} POs`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by customer, date range, process, or status to inspect style and colour details
            </p>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print / Preview PDF */}
          <PreviewButton
            onClick={handleOpenPdfPreview}
            disabled={effectivePOs.length === 0}
            title="Preview and Print PDF"
          />

          {/* Download PDF - Gradient Rose/Red */}
          <PdfExportButton
            onClick={handleDownloadPdf}
            disabled={effectivePOs.length === 0}
            loading={isExportingPdf}
            title="Download PDF Report"
          />

          {/* Download Excel With Colours - Gradient Emerald/Teal */}
          <ExcelExportButton
            onClick={handleDownloadExcelWithColours}
            disabled={effectivePOs.length === 0}
            loading={isExportingExcelColours}
            label="Excel (With Colours)"
            title="Export Excel with all Colour Lines"
          />

          {/* Download Excel PO Info Only - Gradient Blue/Indigo */}
          <ExcelSummaryExportButton
            onClick={handleDownloadExcelPOOnly}
            disabled={effectivePOs.length === 0}
            loading={isExportingExcelPO}
            label="Excel (PO Info Only)"
            title="Export PO Header & Summary Info Only (No Colour Lines)"
          />
        </div>
      </div>

      {/* --- 2. Filter Panel --- */}
      <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1F4E79]" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Report Filters</span>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handlePresetDate('this_month')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('last_30_days')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('this_year')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              This Year
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('clear')}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer transition-colors"
            >
              All Dates
            </button>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
          {/* Customer Dropdown */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-[#1F4E79]" />
              <span>Customer Company</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
            >
              <option value="all">All Customers ({customerList.length})</option>
              {customerList.map((c) => (
                <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                  {c.companyName} {c.vendorCode ? `(${c.vendorCode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>End Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs"
            />
          </div>

          {/* Process Category */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-700">Process Category</label>
            <select
              value={processCategory}
              onChange={(e) => setProcessCategory(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
            >
              <option value="all">All Processes</option>
              {dynamicProcessOptions.map((pr) => (
                <option key={pr.value} value={pr.value}>
                  {pr.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Status, Search & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {/* Status Select */}
            <div className="flex items-center gap-1.5 min-w-[170px]">
              <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Status:</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-8 px-2.5 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-medium focus:outline-hidden focus:border-[#1F4E79] shadow-2xs cursor-pointer"
              >
                <option value="all">All Statuses</option>
                {dynamicStatusOptions.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword Search */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search style no, item, colour, PO no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-slate-50 focus:bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-normal focus:outline-hidden focus:border-[#1F4E79] transition-all"
              />
            </div>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* --- 3. Summary Metric Cards --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total POs */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Purchase Orders
          </p>
          <div className="mt-2 text-xl font-bold text-slate-900">{metrics.totalPOs}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Matching current filters</div>
        </div>

        {/* Unique Styles */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Unique Styles
          </p>
          <div className="mt-2 text-xl font-bold text-slate-900">{metrics.uniqueStylesCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{metrics.totalColours} colour lines</div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Quantity
          </p>
          <div className="mt-2 text-xl font-bold text-emerald-700">
            {metrics.totalQty.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-semibold text-emerald-600">Pcs</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Order piece volume</div>
        </div>

        {/* Total Value */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total Value
          </p>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalAmount)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Gross order value</div>
        </div>
      </div>

      {/* --- 4. View Switcher & Accordion Controls --- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'grouped'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Grouped by PO
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Consolidated Table
          </button>
        </div>

        {viewMode === 'grouped' && filteredPOs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleAll(true)}
              className="text-xs text-[#1F4E79] hover:underline font-semibold cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => handleToggleAll(false)}
              className="text-xs text-slate-500 hover:underline font-semibold cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* --- 5. Report Content --- */}
      {filteredPOs.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Purchase Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No purchase orders match your selected customer, date range, or filter criteria. Try adjusting your filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-2xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* --- VIEW 1: GROUPED BY PO --- */
        <div className="space-y-4">
          {filteredPOs.map((po) => {
            const poId = po.id || po.poId;
            const isExpanded = expandedPOs[poId] !== false; // default expanded
            const lines = po.colourLines || po.lines || [];
            const isApproved = po.status?.toLowerCase() === 'approved';
            const isCancelled = po.status?.toLowerCase() === 'cancelled';

            const poTotalQty = lines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0) || Number(po.totalQuantity) || 0;
            const poTotalAmt = lines.reduce((acc, l) => acc + (Number(l.amount ?? l.lineAmount ?? (l.quantity * l.rate)) || 0), 0) || Number(po.totalAmount) || 0;

            return (
              <div
                key={poId}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* PO Header Bar */}
                <div
                  onClick={() => togglePOExpand(poId)}
                  className="p-3.5 bg-slate-50/80 hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer flex flex-wrap items-center justify-between gap-3 select-none"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Expand Chevron */}
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>

                    {/* PO Number */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-[#1F4E79]">
                        {po.poNumber || 'PO/PENDING'}
                      </span>
                      {po.revision && po.revision > 1 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          R{po.revision}
                        </span>
                      )}
                    </div>

                    {/* Order Date */}
                    <span className="text-xs text-slate-500 font-medium">
                      Date: <strong className="text-slate-800">{formatDate(po.orderDate)}</strong>
                    </span>

                    {/* Customer */}
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-500">Customer:</span>
                      <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {po.customerCompanyNameSnapshot || po.customerName}
                      </span>
                    </div>

                    {/* Customer PO Number */}
                    {po.customerPoNumber && (
                      <span className="text-xs text-slate-500 font-medium">
                        Cust PO: <strong className="text-slate-700">{po.customerPoNumber}</strong>
                        {po.customerPoDate && ` (${formatDate(po.customerPoDate)})`}
                      </span>
                    )}
                  </div>

                  {/* Right: Process, Status, Metrics & Details Link */}
                  <div className="flex items-center gap-3">
                    {/* Process Category Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        po.processCategory === 'dyeing'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-blue-50 text-[#1F4E79] border border-blue-200'
                      }`}
                    >
                      {po.processCategory || 'washing'}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isCancelled
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {po.status || 'draft'}
                    </span>

                    {/* Total Summary */}
                    <div className="text-right pl-2 border-l border-slate-200">
                      <div className="text-xs font-bold text-slate-900">
                        {poTotalQty.toLocaleString('en-IN')} Pcs
                      </div>
                      <div className="text-[11px] font-semibold text-[#1F4E79]">
                        {formatCurrency(poTotalAmt)}
                      </div>
                    </div>

                    {/* View PO Link */}
                    {onViewPO && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewPO(poId);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-white hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
                        title="View PO Details"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Body */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {/* Style & Item Info Strip */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Style Number: </span>
                          <strong className="text-slate-900 font-mono text-xs">{po.styleNo || po.styleNumber || '-'}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Item Description: </span>
                          <strong className="text-slate-800 text-xs">{po.itemName || '-'}</strong>
                        </div>
                      </div>
                      {po.customerInstructions && (
                        <div className="text-[11px] text-slate-500 italic max-w-sm truncate">
                          Instructions: {po.customerInstructions}
                        </div>
                      )}
                    </div>

                    {/* Colour Breakdown Table */}
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Colour Name</th>
                            <th className="py-2 px-3">Wash / Process</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                            <th className="py-2 px-3 text-center">Unit</th>
                            <th className="py-2 px-3 text-right">Rate (₹)</th>
                            <th className="py-2 px-3 text-right">Amount (₹)</th>
                            <th className="py-2 px-3">Remarks / Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-4 text-center text-xs text-slate-400 italic">
                                No colour breakdown rows specified for this PO.
                              </td>
                            </tr>
                          ) : (
                            lines.map((l, lIdx) => {
                              const lineQty = Number(l.quantity) || 0;
                              const lineRate = Number(l.rate) || 0;
                              const lineAmt = Number(l.amount ?? l.lineAmount ?? (lineQty * lineRate)) || 0;

                              return (
                                <tr key={l.lineId || lIdx} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2 px-3 text-center text-slate-400 font-medium">{lIdx + 1}</td>
                                  <td className="py-2 px-3 font-semibold text-slate-800">{l.colourName || '-'}</td>
                                  <td className="py-2 px-3 text-slate-600">{l.processType || '-'}</td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                                    {lineQty.toLocaleString('en-IN')}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-600 font-medium uppercase">
                                    {l.unit || 'PCS'}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-700">
                                    {lineRate > 0 ? lineRate.toFixed(2) : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-slate-900">
                                    {lineAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 text-[11px]">{l.remarks || l.notes || '-'}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                            <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider text-[11px]">
                              PO Subtotal
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900">
                              {poTotalQty.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-center uppercase">PCS</td>
                            <td className="py-2 px-3"></td>
                            <td className="py-2 px-3 text-right text-[#1F4E79]">
                              {formatCurrency(poTotalAmt)}
                            </td>
                            <td className="py-2 px-3"></td>
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
        /* --- VIEW 2: CONSOLIDATED DETAILED TABLE WITH TABLE CONTROLS --- */
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          {/* Table Controls Bar */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            {/* Search Bar with Column Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px] max-w-lg">
              <div className="relative">
                <select
                  value={poTableControls.searchColumn}
                  onChange={(e) => poTableControls.setSearchColumn(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Columns</option>
                  {PO_REPORT_TABLE_COLUMNS.map((col) => (
                    <option key={col.key} value={col.key}>
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
                    poTableControls.searchColumn === 'ALL'
                      ? 'PO #, Style, Customer, Item, Colour...'
                      : `Search by ${PO_REPORT_TABLE_COLUMNS.find((c) => c.key === poTableControls.searchColumn)?.label}...`
                  }
                  value={poTableControls.searchQuery}
                  onChange={(e) => poTableControls.setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
                />
                {poTableControls.searchQuery && (
                  <button
                    type="button"
                    onClick={() => poTableControls.setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Controls: Toggle Inline Column Filters Button & Reset */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => poTableControls.setShowColumnFilters(!poTableControls.showColumnFilters)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                  poTableControls.showColumnFilters || Object.values(poTableControls.columnFilters).some((v) => (v || '').trim() !== '')
                    ? 'bg-slate-900 text-white border-slate-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Toggle column-wise search inputs on table header"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Column Filters</span>
                {Object.values(poTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
                  <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {Object.values(poTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length}
                  </span>
                )}
              </button>

              {poTableControls.isAnyFilterActive && (
                <button
                  type="button"
                  onClick={poTableControls.handleResetFilters}
                  className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Reset table search, column filters, and sorting"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table Container with Sticky Headers */}
          <div className="max-h-[620px] overflow-auto relative">
            <table className="w-full min-w-max text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <tr className="bg-[#1F4E79] text-white font-bold text-[11px] uppercase tracking-wider">
                  <th
                    onClick={() => poTableControls.handleSort('poNumber')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>PO Number</span>
                      {poTableControls.renderSortIcon('poNumber')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('orderDate')}
                    className="py-2.5 px-3 border-r border-white/20 text-center whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Date</span>
                      {poTableControls.renderSortIcon('orderDate')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('customerName')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Customer</span>
                      {poTableControls.renderSortIcon('customerName')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('customerPoNumber')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Cust PO</span>
                      {poTableControls.renderSortIcon('customerPoNumber')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('styleNo')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Style No</span>
                      {poTableControls.renderSortIcon('styleNo')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('itemName')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Item Description</span>
                      {poTableControls.renderSortIcon('itemName')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('processCategory')}
                    className="py-2.5 px-3 border-r border-white/20 text-center whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Process</span>
                      {poTableControls.renderSortIcon('processCategory')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('colourName')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Colour Name</span>
                      {poTableControls.renderSortIcon('colourName')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('processType')}
                    className="py-2.5 px-3 border-r border-white/20 text-left whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Wash / Treatment</span>
                      {poTableControls.renderSortIcon('processType')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('quantity')}
                    className="py-2.5 px-3 border-r border-white/20 text-right whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Qty</span>
                      {poTableControls.renderSortIcon('quantity')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('unit')}
                    className="py-2.5 px-3 border-r border-white/20 text-center whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Unit</span>
                      {poTableControls.renderSortIcon('unit')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('rate')}
                    className="py-2.5 px-3 border-r border-white/20 text-right whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Rate (₹)</span>
                      {poTableControls.renderSortIcon('rate')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('amount')}
                    className="py-2.5 px-3 border-r border-white/20 text-right whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Amount (₹)</span>
                      {poTableControls.renderSortIcon('amount')}
                    </div>
                  </th>
                  <th
                    onClick={() => poTableControls.handleSort('status')}
                    className="py-2.5 px-3 text-center whitespace-nowrap align-middle cursor-pointer select-none group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {poTableControls.renderSortIcon('status')}
                    </div>
                  </th>
                </tr>

                {/* Inline Column Filter Row */}
                {poTableControls.showColumnFilters && (
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter PO #"
                        value={poTableControls.columnFilters['poNumber'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            poNumber: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter date"
                        value={poTableControls.columnFilters['orderDate'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            orderDate: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter customer"
                        value={poTableControls.columnFilters['customerName'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            customerName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter Cust PO"
                        value={poTableControls.columnFilters['customerPoNumber'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            customerPoNumber: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter style"
                        value={poTableControls.columnFilters['styleNo'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            styleNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter item"
                        value={poTableControls.columnFilters['itemName'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            itemName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter process"
                        value={poTableControls.columnFilters['processCategory'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            processCategory: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter colour"
                        value={poTableControls.columnFilters['colourName'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            colourName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter wash"
                        value={poTableControls.columnFilters['processType'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            processType: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter qty"
                        value={poTableControls.columnFilters['quantity'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            quantity: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={poTableControls.columnFilters['unit'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            unit: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter rate"
                        value={poTableControls.columnFilters['rate'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            rate: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter amt"
                        value={poTableControls.columnFilters['amount'] || ''}
                        onChange={(e) =>
                          poTableControls.setColumnFilters({
                            ...poTableControls.columnFilters,
                            amount: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 text-center">
                      {Object.values(poTableControls.columnFilters).some((v) => (v || '').trim() !== '') ? (
                        <button
                          type="button"
                          onClick={() => poTableControls.setColumnFilters({})}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : (
                        <input
                          type="text"
                          placeholder="Status"
                          value={poTableControls.columnFilters['status'] || ''}
                          onChange={(e) =>
                            poTableControls.setColumnFilters({
                              ...poTableControls.columnFilters,
                              status: e.target.value
                            })
                          }
                          className="w-full text-[11px] px-1 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                        />
                      )}
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200">
                {poTableControls.processedData.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center bg-white">
                      <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No matching lines found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your live search query or column filters.
                      </p>
                      {poTableControls.isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={poTableControls.handleResetFilters}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1F4E79] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Reset Table Controls
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  poTableControls.processedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-[#1F4E79]">
                        {row.poNumber}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center whitespace-nowrap text-slate-600">
                        {row.orderDate ? formatDate(row.orderDate) : '—'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                        {row.customerName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">{row.customerPoNumber}</td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                        {row.styleNo}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-700">{row.itemName}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-700">
                        {row.processCategory}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                        {row.colourName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">{row.processType}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                        {row.quantity.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-600 uppercase">
                        {row.unit}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700">
                        {row.rate > 0 ? row.rate.toFixed(2) : '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                        {row.amount > 0 ? row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <tr>
                  <td colSpan={9} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] border-r border-slate-200 text-slate-700">
                    Grand Total ({poTableControls.filteredCount} Lines):
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-900 border-r border-slate-200">
                    {poTableControls.processedData.reduce((acc, r) => acc + r.quantity, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-center border-r border-slate-200 uppercase">PCS</td>
                  <td className="py-2.5 px-3 border-r border-slate-200"></td>
                  <td className="py-2.5 px-3 text-right text-[#1F4E79] border-r border-slate-200">
                    {formatCurrency(poTableControls.processedData.reduce((acc, r) => acc + r.amount, 0))}
                  </td>
                  <td className="py-2.5 px-3 text-center"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* All-In-One-Stretch Informative Summary Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing all <strong>{poTableControls.filteredCount}</strong> records in one stretch
              {poTableControls.filteredCount !== poTableControls.totalCount && (
                <span> (filtered from {poTableControls.totalCount} total colour lines)</span>
              )}
            </span>
            <span className="font-semibold text-slate-700">
              Total Qty in View: {poTableControls.processedData.reduce((acc, r) => acc + r.quantity, 0).toLocaleString('en-IN')} Pcs | Amount: {formatCurrency(poTableControls.processedData.reduce((acc, r) => acc + r.amount, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
