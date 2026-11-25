import React, { useState, useMemo } from 'react';
import { InwardEntry } from '../../../types/inward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { formatDate } from '../../../utils/formatters';
import { InwardReportPdfService } from '../../../services/inwardReportPdfService';
import { InwardReportExcelService } from '../../../services/inwardReportExcelService';
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
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  SlidersHorizontal,
  ArrowUpDown,
  X
} from 'lucide-react';
import { useTableControls, TableColumnConfig } from '../../../hooks/useTableControls';
import { TableMaximizeWrapper } from '../../../components/ui/TableMaximizeWrapper';

export interface FlattenedInwardLine {
  id: string;
  inwardId: string;
  inwardNo: string;
  inwardDate: string;
  customerDcNo: string;
  customerName: string;
  subcontractorName: string;
  styleNo: string;
  poNumber: string;
  colourName: string;
  process: string;
  receivedQty: number;
  balanceAfterReceipt: number;
  unit: string;
  status: string;
}

const INWARD_REPORT_TABLE_COLUMNS: TableColumnConfig<FlattenedInwardLine>[] = [
  { key: 'inwardNo', label: 'Inward #', type: 'text', getValue: (r) => r.inwardNo },
  { key: 'inwardDate', label: 'Date', type: 'date', getValue: (r) => r.inwardDate },
  { key: 'customerDcNo', label: 'Customer DC', type: 'text', getValue: (r) => r.customerDcNo },
  { key: 'customerName', label: 'Customer Name', type: 'text', getValue: (r) => r.customerName },
  { key: 'subcontractorName', label: 'Contractor Unit', type: 'text', getValue: (r) => r.subcontractorName },
  { key: 'styleNo', label: 'Style No', type: 'text', getValue: (r) => r.styleNo },
  { key: 'poNumber', label: 'PO Number', type: 'text', getValue: (r) => r.poNumber },
  { key: 'colourName', label: 'Colour Name', type: 'text', getValue: (r) => r.colourName },
  { key: 'process', label: 'Wash / Process', type: 'text', getValue: (r) => r.process },
  { key: 'receivedQty', label: 'Inward Qty', type: 'number', getValue: (r) => r.receivedQty },
  { key: 'balanceAfterReceipt', label: 'PO Balance', type: 'number', getValue: (r) => r.balanceAfterReceipt },
  { key: 'unit', label: 'Unit', type: 'text', getValue: (r) => r.unit },
  { key: 'status', label: 'Status', type: 'text', getValue: (r) => r.status },
];

interface InwardReportProps {
  inwards: InwardEntry[];
  vendors: Vendor[];
  pos?: PurchaseOrder[];
  onBack: () => void;
  onViewInward?: (inwardId: string) => void;
}

export const InwardReport: React.FC<InwardReportProps> = ({
  inwards,
  vendors,
  pos,
  onBack,
  onViewInward
}) => {
  // --- Filter States ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [processCategory, setProcessCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcelColours, setIsExportingExcelColours] = useState<boolean>(false);
  const [isExportingExcelInward, setIsExportingExcelInward] = useState<boolean>(false);

  // Expanded Inward Cards state (for grouped view)
  const [expandedInwards, setExpandedInwards] = useState<Record<string, boolean>>({});

  // 1. Filter Vendors to Customers
  const customerList = useMemo(() => {
    return vendors.filter((v) => {
      const type = (v.vendorType || '').toLowerCase();
      const isSub = v.vendorCategory === 'subcompany' || !!v.parentVendorId;
      return (type === 'customer' || type === 'both') && !isSub;
    });
  }, [vendors]);

  // 2. Filter Vendors to Subcontractors / Contractors
  const subcontractorList = useMemo(() => {
    return vendors.filter((v) => {
      const category = (v.vendorCategory || '').toLowerCase();
      const type = (v.vendorType || '').toLowerCase();
      return category === 'subcontractor' || category === 'subcompany' || !!v.parentVendorId || type === 'supplier';
    });
  }, [vendors]);

  // Selected Vendor object
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
  }, [vendors, selectedCustomerId]);

  const selectedSubcontractor = useMemo(() => {
    if (selectedSubcontractorId === 'all') return null;
    return vendors.find((v) => (v.vendorId || v.id) === selectedSubcontractorId);
  }, [vendors, selectedSubcontractorId]);

  // Status options
  const statusOptions = [
    { key: 'all', label: 'All Statuses' },
    { key: 'posted', label: 'Posted' },
    { key: 'draft', label: 'Draft' },
    { key: 'reversed', label: 'Reversed' },
    { key: 'cancelled', label: 'Cancelled' }
  ];

  // --- Filtering Logic ---
  const filteredInwards = useMemo(() => {
    return inwards.filter((inward) => {
      // 1. Customer Filter
      if (selectedCustomerId !== 'all') {
        const custId = inward.customerVendorId || inward.customerId;
        const matchesId = custId === selectedCustomerId;
        const matchesName =
          selectedCustomer &&
          (inward.customerCompanyNameSnapshot || inward.customerName || '')
            .trim()
            .toLowerCase() === selectedCustomer.companyName.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 2. Subcontractor Filter
      if (selectedSubcontractorId !== 'all') {
        const subId = inward.subcontractorVendorId || inward.subContractorId;
        const matchesId = subId === selectedSubcontractorId;
        const matchesName =
          selectedSubcontractor &&
          (inward.subcontractorNameSnapshot || inward.subContractorName || '')
            .trim()
            .toLowerCase() === selectedSubcontractor.companyName.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 3. Process Category Filter
      if (processCategory !== 'all') {
        const proc = inward.processCategorySnapshot || inward.processCategory;
        if (proc !== processCategory) return false;
      }

      // 4. Status Filter
      if (status !== 'all') {
        if ((inward.status || '').toLowerCase() !== status.toLowerCase()) return false;
      }

      // 5. Date Range Filter (Inward Date)
      const inwDate = inward.inwardDate || inward.customerDate;
      if (startDate && inwDate) {
        if (inwDate < startDate) return false;
      }
      if (endDate && inwDate) {
        if (inwDate > endDate) return false;
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inwardNo = (inward.inwardNo || '').toLowerCase();
        const dcNo = (inward.customerDcNo || '').toLowerCase();
        const poNo = (inward.poNumberSnapshot || inward.poNumber || '').toLowerCase();
        const styleNo = (inward.styleNoSnapshot || inward.styleNo || '').toLowerCase();
        const itemName = (inward.itemNameSnapshot || inward.itemName || '').toLowerCase();
        const customerName = (inward.customerCompanyNameSnapshot || inward.customerName || '').toLowerCase();
        const subName = (inward.subcontractorNameSnapshot || inward.subContractorName || '').toLowerCase();

        // Check colour lines
        const linesMatch = (inward.lines || []).some((l) => {
          const colName = (l.colourNameSnapshot || l.colour || '').toLowerCase();
          const wash = (l.washTypeSnapshot || l.processType || '').toLowerCase();
          return colName.includes(query) || wash.includes(query);
        });

        const matches =
          inwardNo.includes(query) ||
          dcNo.includes(query) ||
          poNo.includes(query) ||
          styleNo.includes(query) ||
          itemName.includes(query) ||
          customerName.includes(query) ||
          subName.includes(query) ||
          linesMatch;

        if (!matches) return false;
      }

      return true;
    });
  }, [
    inwards,
    selectedCustomerId,
    selectedCustomer,
    selectedSubcontractorId,
    selectedSubcontractor,
    processCategory,
    status,
    startDate,
    endDate,
    searchQuery
  ]);

  // --- Flattened Lines & Table Controls for View Mode 2 ---
  const flattenedInwardRows: FlattenedInwardLine[] = useMemo(() => {
    return filteredInwards.flatMap((inward) => {
      const lines = inward.lines && inward.lines.length > 0 ? inward.lines : [null];
      return lines.map((l, lIdx) => ({
        id: `${inward.id || inward.inwardId}_${l?.inwardLineId || l?.lineId || lIdx}`,
        inwardId: inward.id || inward.inwardId,
        inwardNo: inward.inwardNo || 'INW/PENDING',
        inwardDate: inward.inwardDate || '',
        customerDcNo: inward.customerDcNo || '—',
        customerName: inward.customerCompanyNameSnapshot || inward.customerName || '—',
        subcontractorName: inward.subcontractorNameSnapshot || '—',
        styleNo: inward.styleNoSnapshot || inward.styleNo || '—',
        poNumber: inward.poNumberSnapshot || inward.poNumber || '—',
        colourName: l ? l.colourNameSnapshot || l.colour || '—' : '—',
        process: l ? l.washTypeSnapshot || l.processType || '—' : '—',
        receivedQty: l ? Number(l.receivedQty) || 0 : Number(inward.totalQuantity) || 0,
        balanceAfterReceipt: l ? Number(l.balanceAfterReceiptSnapshot) || 0 : 0,
        unit: l ? (l.unit || 'PCS').toUpperCase() : (inward.totalQtyByUnit?.kg ? 'KG' : 'PCS'),
        status: (inward.status || 'Draft').toUpperCase(),
      }));
    });
  }, [filteredInwards]);

  const inwardTableControls = useTableControls<FlattenedInwardLine>(flattenedInwardRows, {
    columns: INWARD_REPORT_TABLE_COLUMNS,
    defaultSortField: 'inwardDate',
    defaultSortDirection: 'desc',
  });

  // Effective inwards matching active table controls (column filters, search query, sorting)
  const effectiveInwards: InwardEntry[] = useMemo(() => {
    const hasTableFilters =
      inwardTableControls.searchQuery.trim() !== '' ||
      inwardTableControls.searchColumn !== 'ALL' ||
      Object.values(inwardTableControls.columnFilters).some((v) => (v || '').trim() !== '');

    if (!hasTableFilters && viewMode === 'grouped') {
      return filteredInwards;
    }

    const inwardMap = new Map<string, InwardEntry>();
    filteredInwards.forEach((inw) => {
      const key = inw.id || inw.inwardId;
      if (key) inwardMap.set(key, inw);
    });

    const orderedInwardIds: string[] = [];
    const rowsByInwardId = new Map<string, typeof inwardTableControls.processedData>();

    inwardTableControls.processedData.forEach((row) => {
      if (!rowsByInwardId.has(row.inwardId)) {
        rowsByInwardId.set(row.inwardId, []);
        orderedInwardIds.push(row.inwardId);
      }
      rowsByInwardId.get(row.inwardId)!.push(row);
    });

    const result: InwardEntry[] = [];

    orderedInwardIds.forEach((inwId) => {
      const origInw = inwardMap.get(inwId);
      if (!origInw) return;

      const matchingRows = rowsByInwardId.get(inwId) || [];
      const matchingRowIdSet = new Set(matchingRows.map((r) => r.id));

      const origLines = origInw.lines || [];
      let filteredLines: typeof origLines = [];

      if (origLines.length === 0) {
        filteredLines = [];
      } else {
        filteredLines = origLines.filter((l, lIdx) => {
          const rowId = `${inwId}_${l.inwardLineId || l.lineId || lIdx}`;
          return matchingRowIdSet.has(rowId);
        });
      }

      if (origLines.length > 0 && filteredLines.length === 0) {
        return;
      }

      const totalReceived = filteredLines.reduce((sum, l) => sum + (Number(l.receivedQty) || 0), 0);
      const pieceQty = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() !== 'kg')
        .reduce((sum, l) => sum + (Number(l.receivedQty) || 0), 0);
      const kgQty = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() === 'kg')
        .reduce((sum, l) => sum + (Number(l.receivedQty) || 0), 0);

      result.push({
        ...origInw,
        lines: filteredLines,
        totalQuantity: origLines.length > 0 ? totalReceived : origInw.totalQuantity,
        totalQtyByUnit: {
          piece: pieceQty,
          kg: kgQty
        }
      });
    });

    return result;
  }, [
    filteredInwards,
    inwardTableControls.processedData,
    inwardTableControls.searchQuery,
    inwardTableControls.searchColumn,
    inwardTableControls.columnFilters,
    viewMode
  ]);

  // --- Summary Metrics Calculations ---
  const metrics = useMemo(() => {
    let totalQty = 0;
    let totalColours = 0;
    const styleSet = new Set<string>();
    const contractorSet = new Set<string>();
    const customerSet = new Set<string>();

    effectiveInwards.forEach((inward) => {
      totalQty += Number(inward.totalQuantity) || 0;

      const style = inward.styleNoSnapshot || inward.styleNo;
      if (style) styleSet.add(style.trim().toLowerCase());

      const cust = inward.customerCompanyNameSnapshot || inward.customerName;
      if (cust) customerSet.add(cust.trim().toLowerCase());

      const sub = inward.subcontractorNameSnapshot || inward.subContractorName;
      if (sub) contractorSet.add(sub.trim().toLowerCase());

      const lines = inward.lines || [];
      totalColours += lines.length;
    });

    return {
      totalInwards: effectiveInwards.length,
      totalQty,
      totalColours,
      uniqueStylesCount: styleSet.size,
      uniqueCustomersCount: customerSet.size,
      uniqueContractorsCount: contractorSet.size
    };
  }, [effectiveInwards]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedCustomerId !== 'all' ||
    selectedSubcontractorId !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    processCategory !== 'all' ||
    status !== 'all' ||
    searchQuery.trim() !== '';

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCustomerId('all');
    setSelectedSubcontractorId('all');
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

  // Toggle Inward Accordion
  const toggleInwardExpand = (inwardId: string) => {
    setExpandedInwards((prev) => ({
      ...prev,
      [inwardId]: prev[inwardId] === undefined ? false : !prev[inwardId]
    }));
  };

  // Expand / Collapse All
  const handleToggleAll = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    filteredInwards.forEach((inward) => {
      newState[inward.id || inward.inwardId] = expand;
    });
    setExpandedInwards(newState);
  };

  // --- Export Handlers ---
  const handleDownloadPdf = () => {
    if (effectiveInwards.length === 0) {
      alert('No inward receipts to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      InwardReportPdfService.downloadInwardReportPdf({
        inwards: effectiveInwards,
        customerName: selectedCustomer?.companyName || (inwardTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        subcontractorName: selectedSubcontractor?.companyName || (inwardTableControls.columnFilters['subcontractorName'] || (selectedSubcontractorId === 'all' ? 'All Contractors' : 'Selected Contractor')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (inwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (inwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting Inward PDF report:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenPdfPreview = () => {
    if (effectiveInwards.length === 0) {
      alert('No inward receipts to preview.');
      return;
    }
    try {
      InwardReportPdfService.openInwardReportPdf({
        inwards: effectiveInwards,
        customerName: selectedCustomer?.companyName || (inwardTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        subcontractorName: selectedSubcontractor?.companyName || (inwardTableControls.columnFilters['subcontractorName'] || (selectedSubcontractorId === 'all' ? 'All Contractors' : 'Selected Contractor')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (inwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (inwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error opening Inward PDF preview:', err);
      alert('Failed to preview PDF report.');
    }
  };

  const handleDownloadExcelWithColours = async () => {
    if (effectiveInwards.length === 0) {
      alert('No inward receipts to export.');
      return;
    }
    setIsExportingExcelColours(true);
    try {
      await InwardReportExcelService.exportWithColours({
        inwards: effectiveInwards,
        customerName: selectedCustomer?.companyName || (inwardTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        subcontractorName: selectedSubcontractor?.companyName || (inwardTableControls.columnFilters['subcontractorName'] || (selectedSubcontractorId === 'all' ? 'All Contractors' : 'Selected Contractor')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (inwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (inwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting Inward Excel report with colours:', err);
      alert('Failed to generate Excel report.');
    } finally {
      setIsExportingExcelColours(false);
    }
  };

  const handleDownloadExcelInwardOnly = async () => {
    if (effectiveInwards.length === 0) {
      alert('No inward receipts to export.');
      return;
    }
    setIsExportingExcelInward(true);
    try {
      await InwardReportExcelService.exportInwardSummary({
        inwards: effectiveInwards,
        customerName: selectedCustomer?.companyName || (inwardTableControls.columnFilters['customerName'] || (selectedCustomerId === 'all' ? 'All Customers' : 'Selected Customer')),
        subcontractorName: selectedSubcontractor?.companyName || (inwardTableControls.columnFilters['subcontractorName'] || (selectedSubcontractorId === 'all' ? 'All Contractors' : 'Selected Contractor')),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (inwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (inwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Error exporting Inward summary Excel report:', err);
      alert('Failed to generate Excel report.');
    } finally {
      setIsExportingExcelInward(false);
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
            data-back-button="true"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            title="Back to Inward Receipts (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Inward Report Generation</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EEF5FB] text-[#1F4E79] border border-blue-200">
                {effectiveInwards.length !== filteredInwards.length
                  ? `${effectiveInwards.length} of ${filteredInwards.length} Receipts`
                  : `${filteredInwards.length} Receipts`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter by customer, contractor, date range, process, or status to inspect colour breakdown and receipts
            </p>
          </div>
        </div>

        {/* Action Export Buttons - Simple solid tone without icons as requested */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Print / Preview PDF */}
          <PreviewButton
            onClick={handleOpenPdfPreview}
            disabled={effectiveInwards.length === 0}
            hideIcon={true}
            title="Preview and Print PDF"
          />

          {/* Download PDF - Solid dark red */}
          <PdfExportButton
            onClick={handleDownloadPdf}
            disabled={effectiveInwards.length === 0}
            loading={isExportingPdf}
            hideIcon={true}
            title="Download PDF Report"
          />

          {/* Download Excel With Colours - Solid dark emerald green */}
          <ExcelExportButton
            onClick={handleDownloadExcelWithColours}
            disabled={effectiveInwards.length === 0}
            loading={isExportingExcelColours}
            label="Excel (With Colours)"
            hideIcon={true}
            title="Export Excel with all Colour Lines"
          />

          {/* Download Excel Inward Info Only - Solid dark blue */}
          <ExcelSummaryExportButton
            onClick={handleDownloadExcelInwardOnly}
            disabled={effectiveInwards.length === 0}
            loading={isExportingExcelInward}
            label="Excel (Inward Info Only)"
            hideIcon={true}
            title="Export Inward Header & Summary Info Only (No Colour Lines)"
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

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-rose-200"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Customer Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Customer Company
            </label>
            <div className="relative">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-2.5 pr-8 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              >
                <option value="all">All Customers ({customerList.length})</option>
                {customerList.map((c) => (
                  <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                    {c.companyName} {c.vendorCode ? `(${c.vendorCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcontractor Unit Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Subcontractor Unit
            </label>
            <div className="relative">
              <select
                value={selectedSubcontractorId}
                onChange={(e) => setSelectedSubcontractorId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-2.5 pr-8 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              >
                <option value="all">All Subcontractors / Contractors ({subcontractorList.length})</option>
                {subcontractorList.map((s) => (
                  <option key={s.vendorId || s.id} value={s.vendorId || s.id}>
                    {s.companyName} {s.vendorCode ? `(${s.vendorCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Process Category Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Process Category
            </label>
            <select
              value={processCategory}
              onChange={(e) => setProcessCategory(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-2.5 pr-8 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
            >
              <option value="all">All Processes (Washing & Dyeing)</option>
              <option value="washing">Washing</option>
              <option value="dyeing">Dyeing</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Receipt Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-2 px-2.5 pr-8 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
            >
              {statusOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row: Date Filters & Search */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
          {/* Date Range Inputs */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Start Date (From)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                End Date (To)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              />
            </div>
          </div>

          {/* Date Quick Presets */}
          <div className="lg:col-span-3 flex items-end gap-1 pb-0.5">
            <button
              type="button"
              onClick={() => handlePresetDate('this_month')}
              className="px-2 py-1.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('last_30_days')}
              className="px-2 py-1.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('this_year')}
              className="px-2 py-1.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
            >
              This Year
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => handlePresetDate('clear')}
                className="px-2 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Search Inward Details
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Inward #, DC #, PO #, Style, Colour..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg py-1.5 pl-8 pr-2.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* --- 3. Summary Metric Banner --- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Inward Receipts
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {metrics.totalInwards.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500">Matching criteria</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Total Received Qty
          </span>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {metrics.totalQty.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Pieces / Kgs Inwarded</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Colour Lines
          </span>
          <div className="text-xl font-bold text-[#1F4E79] mt-1">
            {metrics.totalColours.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500">Distinct colour lots</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Unique Styles
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {metrics.uniqueStylesCount.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500">Active styles received</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
            Contractor Units
          </span>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {metrics.uniqueContractorsCount.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500">Fulfillment sources</span>
        </div>
      </div>

      {/* --- 4. View Mode Selector & Content Header --- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Inward Receipts & Colour-wise Breakdown
          </h2>
          <span className="text-xs text-slate-400">
            ({filteredInwards.length} records)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {viewMode === 'grouped' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="px-2 py-1 text-[11px] font-medium hover:bg-slate-100 rounded transition-colors cursor-pointer text-slate-700"
              >
                Expand All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="px-2 py-1 text-[11px] font-medium hover:bg-slate-100 rounded transition-colors cursor-pointer text-slate-700"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Grouped Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Comprehensive Table
            </button>
          </div>
        </div>
      </div>

      {/* --- 5. Inward Receipts Data Display --- */}
      {filteredInwards.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Inward Receipts Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No inward records match your current filter selection. Try adjusting or clearing your filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-3 py-1.5 text-xs font-semibold text-[#1F4E79] bg-[#EEF5FB] hover:bg-[#dbeafe] rounded-lg transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* --- VIEW MODE 1: Grouped Inward Receipt Accordion Cards --- */
        <div className="space-y-3">
          {filteredInwards.map((inward) => {
            const inwId = inward.id || inward.inwardId;
            const isExpanded = expandedInwards[inwId] !== false; // Default expanded
            const lines = inward.lines || [];
            const statusLower = (inward.status || 'draft').toLowerCase();

            return (
              <div
                key={inwId}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-150"
              >
                {/* Inward Receipt Header Row */}
                <div
                  onClick={() => toggleInwardExpand(inwId)}
                  className="p-4 bg-slate-50/50 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 mt-0.5 sm:mt-0 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-[#1F4E79]">
                          {inward.inwardNo || 'INW/PENDING'}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600">
                          {formatDate(inward.inwardDate)}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          DC: <span className="font-mono font-bold">{inward.customerDcNo || '—'}</span>
                          {inward.customerDate && ` (${formatDate(inward.customerDate)})`}
                        </span>

                        {/* Status Chip */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            statusLower === 'posted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : statusLower === 'reversed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : statusLower === 'cancelled'
                              ? 'bg-slate-100 text-slate-600 border border-slate-300'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {inward.status || 'Draft'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                        <span className="font-semibold text-slate-800">
                          {inward.customerCompanyNameSnapshot || inward.customerName || 'Customer'}
                        </span>
                        {inward.subcontractorNameSnapshot && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500">
                              Contractor: <strong className="text-slate-700">{inward.subcontractorNameSnapshot}</strong>
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">|</span>
                        <span>
                          PO: <strong className="font-mono text-[#1F4E79]">{inward.poNumberSnapshot || inward.poNumber || '—'}</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                          Style: <strong className="text-slate-900 font-bold">{inward.styleNoSnapshot || inward.styleNo || '—'}</strong>
                        </span>
                        {inward.itemNameSnapshot && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-slate-500 italic">{inward.itemNameSnapshot}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Header Stats & Action */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Received Qty
                      </span>
                      <span className="text-sm font-bold text-emerald-700">
                        {Number(inward.totalQuantity || 0).toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] font-normal text-slate-500">
                          {inward.totalQtyByUnit?.kg ? 'KG' : 'PCS'}
                        </span>
                      </span>
                    </div>

                    {onViewInward && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewInward(inwId);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-[#1F4E79] bg-white hover:bg-[#EEF5FB] border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="View Inward Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Colour-wise Breakdown Table */}
                {isExpanded && (
                  <div className="p-4 bg-white overflow-x-auto">
                    {lines.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No specific colour lines recorded for this inward receipt. Total received: {inward.totalQuantity}
                      </p>
                    ) : (
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/75">
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Colour Name</th>
                            <th className="py-2 px-3">Wash / Process</th>
                            <th className="py-2 px-3 text-right">PO Ordered</th>
                            <th className="py-2 px-3 text-right">Prev Inward</th>
                            <th className="py-2 px-3 text-right text-emerald-700 font-bold">Inward Qty</th>
                            <th className="py-2 px-3 text-right">PO Balance</th>
                            <th className="py-2 px-3 text-center">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lines.map((line, idx) => {
                            const lineOrdered = Number(line.orderedQtySnapshot) || 0;
                            const linePrev = Number(line.previouslyReceivedQtySnapshot) || 0;
                            const lineInw = Number(line.receivedQty) || 0;
                            const lineBal = Number(line.balanceAfterReceiptSnapshot) || 0;

                            return (
                              <tr key={line.inwardLineId || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  {line.colourNameSnapshot || line.colour || '—'}
                                  {line.colourCodeSnapshot && (
                                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                                      ({line.colourCodeSnapshot})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {line.washTypeSnapshot || line.processType || '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600">
                                  {lineOrdered > 0 ? lineOrdered.toLocaleString('en-IN') : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-500">
                                  {linePrev.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                                  {lineInw.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700 font-medium">
                                  {lineBal.toLocaleString('en-IN')}
                                </td>
                                <td className="py-2 px-3 text-center uppercase text-[10px] text-slate-500 font-medium">
                                  {line.unit || 'PCS'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/50">
                            <td colSpan={3} className="py-2 px-3 text-slate-700 text-right uppercase text-[11px]">
                              Total Receipt Qty:
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {lines.reduce((acc, l) => acc + (Number(l.orderedQtySnapshot) || 0), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">
                              {lines.reduce((acc, l) => acc + (Number(l.previouslyReceivedQtySnapshot) || 0), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-700 bg-emerald-100/50">
                              {lines.reduce((acc, l) => acc + (Number(l.receivedQty) || 0), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                              {lines.reduce((acc, l) => acc + (Number(l.balanceAfterReceiptSnapshot) || 0), 0).toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-3 text-center text-[10px] text-slate-500">
                              {inward.totalQtyByUnit?.kg ? 'KG' : 'PCS'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* --- VIEW MODE 2: Comprehensive Dense Data Table with Table Controls --- */
        <TableMaximizeWrapper
          title="Inward Receipt Detailed Report"
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {inwardTableControls.filteredCount} Lines
            </span>
          }
        >
          {(isMaximized) => (
            <div className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col ${isMaximized ? 'flex-1 min-h-0' : ''}`}>
              {/* Table Controls Bar */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar with Column Selector */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px] max-w-lg">
                  <div className="relative">
                    <select
                      value={inwardTableControls.searchColumn}
                      onChange={(e) => inwardTableControls.setSearchColumn(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Columns</option>
                      {INWARD_REPORT_TABLE_COLUMNS.map((col) => (
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
                        inwardTableControls.searchColumn === 'ALL'
                          ? 'Inward #, DC #, Style, PO, Colour...'
                          : `Search by ${INWARD_REPORT_TABLE_COLUMNS.find((c) => c.key === inwardTableControls.searchColumn)?.label}...`
                      }
                      value={inwardTableControls.searchQuery}
                      onChange={(e) => inwardTableControls.setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
                    />
                    {inwardTableControls.searchQuery && (
                      <button
                        type="button"
                        onClick={() => inwardTableControls.setSearchQuery('')}
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
                    onClick={() => inwardTableControls.setShowColumnFilters(!inwardTableControls.showColumnFilters)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                      inwardTableControls.showColumnFilters || Object.values(inwardTableControls.columnFilters).some((v) => (v || '').trim() !== '')
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Toggle column-wise search inputs on table header"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Column Filters</span>
                    {Object.values(inwardTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
                      <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {Object.values(inwardTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length}
                      </span>
                    )}
                  </button>

                  {inwardTableControls.isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={inwardTableControls.handleResetFilters}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                      title="Reset table search, column filters, and sorting"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container with Sticky Headers */}
              <div
                data-table-scroll="true"
                className={`overflow-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
              >
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300">
                    <tr className="border-b-2 border-slate-300 bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider">
                      <th
                        onClick={() => inwardTableControls.handleSort('inwardNo')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'inwardNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Inward #</span>
                          {inwardTableControls.renderSortIcon('inwardNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('inwardDate')}
                        className={`py-2.5 px-3 text-center border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'inwardDate' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Date</span>
                          {inwardTableControls.renderSortIcon('inwardDate')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('customerDcNo')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'customerDcNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Customer DC</span>
                          {inwardTableControls.renderSortIcon('customerDcNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('customerName')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'customerName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Customer Name</span>
                          {inwardTableControls.renderSortIcon('customerName')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('subcontractorName')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'subcontractorName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Contractor Unit</span>
                          {inwardTableControls.renderSortIcon('subcontractorName')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('styleNo')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'styleNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Style / PO</span>
                          {inwardTableControls.renderSortIcon('styleNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('colourName')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'colourName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Colour Name</span>
                          {inwardTableControls.renderSortIcon('colourName')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('process')}
                        className={`py-2.5 px-3 border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'process' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Wash / Process</span>
                          {inwardTableControls.renderSortIcon('process')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('receivedQty')}
                        className={`py-2.5 px-3 text-right border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'receivedQty' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Inward Qty</span>
                          {inwardTableControls.renderSortIcon('receivedQty')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('balanceAfterReceipt')}
                        className={`py-2.5 px-3 text-right border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'balanceAfterReceipt' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>PO Balance</span>
                          {inwardTableControls.renderSortIcon('balanceAfterReceipt')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('unit')}
                        className={`py-2.5 px-3 text-center border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'unit' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Unit</span>
                          {inwardTableControls.renderSortIcon('unit')}
                        </div>
                      </th>
                      <th
                        onClick={() => inwardTableControls.handleSort('status')}
                        className={`py-2.5 px-3 text-center border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          inwardTableControls.sortField === 'status' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          {inwardTableControls.renderSortIcon('status')}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center align-middle pr-12 min-w-[130px]">Action</th>
                    </tr>

                {/* Inline Column Filter Row */}
                {inwardTableControls.showColumnFilters && (
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter #"
                        value={inwardTableControls.columnFilters['inwardNo'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            inwardNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter date"
                        value={inwardTableControls.columnFilters['inwardDate'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            inwardDate: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter DC"
                        value={inwardTableControls.columnFilters['customerDcNo'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            customerDcNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter customer"
                        value={inwardTableControls.columnFilters['customerName'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            customerName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter contractor"
                        value={inwardTableControls.columnFilters['subcontractorName'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            subcontractorName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter style"
                        value={inwardTableControls.columnFilters['styleNo'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            styleNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter colour"
                        value={inwardTableControls.columnFilters['colourName'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            colourName: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter process"
                        value={inwardTableControls.columnFilters['process'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            process: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter qty"
                        value={inwardTableControls.columnFilters['receivedQty'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            receivedQty: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter bal"
                        value={inwardTableControls.columnFilters['balanceAfterReceipt'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            balanceAfterReceipt: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={inwardTableControls.columnFilters['unit'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            unit: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Status"
                        value={inwardTableControls.columnFilters['status'] || ''}
                        onChange={(e) =>
                          inwardTableControls.setColumnFilters({
                            ...inwardTableControls.columnFilters,
                            status: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                      />
                    </th>
                    <th className="p-1 text-center">
                      {Object.values(inwardTableControls.columnFilters).some((v) => (v || '').trim() !== '') ? (
                        <button
                          type="button"
                          onClick={() => inwardTableControls.setColumnFilters({})}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : null}
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inwardTableControls.processedData.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center bg-white">
                      <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No matching lines found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your live search query or column filters.
                      </p>
                      {inwardTableControls.isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={inwardTableControls.handleResetFilters}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1F4E79] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Reset Table Controls
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  inwardTableControls.processedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-[#1F4E79] border-r border-slate-200">
                        {row.inwardNo}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200 whitespace-nowrap">
                        {row.inwardDate ? formatDate(row.inwardDate) : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-700 border-r border-slate-200">
                        {row.customerDcNo}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        {row.customerName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-200">
                        {row.subcontractorName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <span className="font-bold text-slate-900 block">{row.styleNo}</span>
                        <span className="text-[10px] font-mono text-slate-500">PO: {row.poNumber}</span>
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-slate-200">
                        {row.colourName}
                      </td>
                      <td className="py-2 px-3 text-slate-600 border-r border-slate-200">
                        {row.process}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 border-r border-slate-200">
                        {row.receivedQty.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                        {row.balanceAfterReceipt > 0 ? row.balanceAfterReceipt.toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="py-2 px-3 text-center text-[10px] text-slate-500 uppercase border-r border-slate-200">
                        {row.unit}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-200">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            row.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : row.status === 'REVERSED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {onViewInward && (
                          <button
                            type="button"
                            onClick={() => onViewInward(row.inwardId)}
                            className="text-xs text-[#1F4E79] hover:underline font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <tr>
                  <td colSpan={8} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-700 border-r border-slate-200">
                    Grand Total ({inwardTableControls.filteredCount} Lines):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-700 font-bold border-r border-slate-200">
                    {inwardTableControls.processedData.reduce((acc, r) => acc + r.receivedQty, 0).toLocaleString('en-IN')}
                  </td>
                  <td colSpan={4} className="py-2.5 px-3 text-slate-400"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* All-In-One-Stretch Informative Summary Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing all <strong>{inwardTableControls.filteredCount}</strong> records in one stretch
              {inwardTableControls.filteredCount !== inwardTableControls.totalCount && (
                <span> (filtered from {inwardTableControls.totalCount} total colour lines)</span>
              )}
            </span>
            <span className="font-semibold text-slate-700">
              Total Inward in View: {inwardTableControls.processedData.reduce((acc, r) => acc + r.receivedQty, 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        )}
      </TableMaximizeWrapper>
      )}
    </div>
  );
};
