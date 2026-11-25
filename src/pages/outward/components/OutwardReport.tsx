import React, { useState, useMemo } from 'react';
import { OutwardEntry } from '../../../types/outward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { formatDate } from '../../../utils/formatters';
import { OutwardReportPdfService } from '../../../services/outwardReportPdfService';
import { OutwardReportExcelService } from '../../../services/outwardReportExcelService';
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
  Truck,
  SlidersHorizontal,
  ArrowUpDown,
  X
} from 'lucide-react';
import { useTableControls, TableColumnConfig } from '../../../hooks/useTableControls';
import { TableMaximizeWrapper } from '../../../components/ui/TableMaximizeWrapper';

export interface FlattenedOutwardLine {
  id: string;
  outwardId: string;
  outwardNo: string;
  outwardDate: string;
  ourDcNo: string;
  customerName: string;
  subcontractorName: string;
  styleNo: string;
  poNumber: string;
  colourName: string;
  process: string;
  inwardQty: number;
  dispatchQty: number;
  remainingQty: number;
  unit: string;
  vehicleNumber: string;
  status: string;
}

const OUTWARD_REPORT_TABLE_COLUMNS: TableColumnConfig<FlattenedOutwardLine>[] = [
  { key: 'outwardNo', label: 'Outward #', type: 'text', getValue: (r) => r.outwardNo },
  { key: 'outwardDate', label: 'Date', type: 'date', getValue: (r) => r.outwardDate },
  { key: 'ourDcNo', label: 'Our DC #', type: 'text', getValue: (r) => r.ourDcNo },
  { key: 'customerName', label: 'Customer Name', type: 'text', getValue: (r) => r.customerName },
  { key: 'subcontractorName', label: 'Subcontractor Unit', type: 'text', getValue: (r) => r.subcontractorName },
  { key: 'styleNo', label: 'Style No', type: 'text', getValue: (r) => r.styleNo },
  { key: 'poNumber', label: 'PO Number', type: 'text', getValue: (r) => r.poNumber },
  { key: 'colourName', label: 'Colour Name', type: 'text', getValue: (r) => r.colourName },
  { key: 'process', label: 'Process', type: 'text', getValue: (r) => r.process },
  { key: 'inwardQty', label: 'Inward Qty', type: 'number', getValue: (r) => r.inwardQty },
  { key: 'dispatchQty', label: 'Dispatched', type: 'number', getValue: (r) => r.dispatchQty },
  { key: 'remainingQty', label: 'Remaining', type: 'number', getValue: (r) => r.remainingQty },
  { key: 'unit', label: 'Unit', type: 'text', getValue: (r) => r.unit },
  { key: 'vehicleNumber', label: 'Vehicle #', type: 'text', getValue: (r) => r.vehicleNumber },
  { key: 'status', label: 'Status', type: 'text', getValue: (r) => r.status },
];

interface OutwardReportProps {
  outwards: OutwardEntry[];
  vendors: Vendor[];
  pos?: PurchaseOrder[];
  onBack: () => void;
  onViewOutward?: (outwardId: string) => void;
}

export const OutwardReport: React.FC<OutwardReportProps> = ({
  outwards,
  vendors,
  pos,
  onBack,
  onViewOutward
}) => {
  // --- Filter States ---
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>('all');
  const [selectedTransporterId, setSelectedTransporterId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [processCategory, setProcessCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcelColours, setIsExportingExcelColours] = useState<boolean>(false);
  const [isExportingExcelSummary, setIsExportingExcelSummary] = useState<boolean>(false);

  // Expanded Outward Cards state (for grouped view)
  const [expandedOutwards, setExpandedOutwards] = useState<Record<string, boolean>>({});

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

  // 3. Filter Vendors to Transporters
  const transporterList = useMemo(() => {
    return vendors.filter((v) => {
      return (
        (v as any).vendorCategory === 'transport' ||
        v.vendorType === 'supplier' ||
        v.companyName.toLowerCase().includes('transport') ||
        v.companyName.toLowerCase().includes('logistics')
      );
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

  const selectedTransporter = useMemo(() => {
    if (selectedTransporterId === 'all') return null;
    return vendors.find((v) => (v.vendorId || v.id) === selectedTransporterId);
  }, [vendors, selectedTransporterId]);

  // Status options
  const statusOptions = [
    { key: 'all', label: 'All Statuses' },
    { key: 'posted', label: 'Posted' },
    { key: 'draft', label: 'Draft' },
    { key: 'reversed', label: 'Reversed' },
    { key: 'cancelled', label: 'Cancelled' }
  ];

  // --- Filtering Logic ---
  const filteredOutwards = useMemo(() => {
    return outwards.filter((outw) => {
      // 1. Customer Filter
      if (selectedCustomerId !== 'all') {
        const custId = outw.customerVendorId || outw.customerId;
        const matchesId = custId === selectedCustomerId;
        const matchesName =
          selectedCustomer &&
          (outw.customerCompanyNameSnapshot || outw.customerName || '')
            .trim()
            .toLowerCase() === selectedCustomer.companyName.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 2. Subcontractor Filter
      if (selectedSubcontractorId !== 'all') {
        const subId = outw.subcontractorVendorId || outw.subContractorId;
        const matchesId = subId === selectedSubcontractorId;
        const matchesName =
          selectedSubcontractor &&
          (outw.subcontractorNameSnapshot || outw.subContractorName || '')
            .trim()
            .toLowerCase() === selectedSubcontractor.companyName.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 3. Transporter Filter
      if (selectedTransporterId !== 'all') {
        if (selectedTransporterId === 'in_house') {
          if (outw.transporterVendorId) return false;
        } else {
          if (outw.transporterVendorId !== selectedTransporterId) return false;
        }
      }

      // 4. Process Category Filter
      if (processCategory !== 'all') {
        const proc = outw.processCategorySnapshot || outw.processCategory;
        if (proc !== processCategory) return false;
      }

      // 5. Status Filter
      if (status !== 'all') {
        if ((outw.status || '').toLowerCase() !== status.toLowerCase()) return false;
      }

      // 6. Date Range Filter
      const outwDate = outw.outwardDate;
      if (startDate && outwDate) {
        if (outwDate < startDate) return false;
      }
      if (endDate && outwDate) {
        if (outwDate > endDate) return false;
      }

      // 7. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const outwardNo = (outw.outwardNo || '').toLowerCase();
        const dcNo = (outw.ourDcNo || '').toLowerCase();
        const poNo = (outw.poNumberSnapshot || outw.poNumber || '').toLowerCase();
        const styleNo = (outw.styleNoSnapshot || outw.styleNo || '').toLowerCase();
        const itemName = (outw.itemNameSnapshot || outw.itemName || '').toLowerCase();
        const customerName = (outw.customerCompanyNameSnapshot || outw.customerName || '').toLowerCase();
        const subName = (outw.subcontractorNameSnapshot || outw.subContractorName || '').toLowerCase();
        const vehNo = (outw.vehicleNumber || outw.vehicleNo || '').toLowerCase();
        const driver = (outw.driverName || '').toLowerCase();
        const dest = (outw.destination || '').toLowerCase();

        // Check colour lines
        const linesMatch = (outw.lines || []).some((l) => {
          const colName = (l.colourNameSnapshot || l.colour || '').toLowerCase();
          const wash = (l.washTypeSnapshot || l.processType || '').toLowerCase();
          return colName.includes(query) || wash.includes(query);
        });

        const matches =
          outwardNo.includes(query) ||
          dcNo.includes(query) ||
          poNo.includes(query) ||
          styleNo.includes(query) ||
          itemName.includes(query) ||
          customerName.includes(query) ||
          subName.includes(query) ||
          vehNo.includes(query) ||
          driver.includes(query) ||
          dest.includes(query) ||
          linesMatch;

        if (!matches) return false;
      }

      return true;
    });
  }, [
    outwards,
    selectedCustomerId,
    selectedCustomer,
    selectedSubcontractorId,
    selectedSubcontractor,
    selectedTransporterId,
    processCategory,
    status,
    startDate,
    endDate,
    searchQuery
  ]);

  // --- Flattened Lines & Table Controls for View Mode 2 ---
  const flattenedOutwardRows: FlattenedOutwardLine[] = useMemo(() => {
    return filteredOutwards.flatMap((outw) => {
      const lines = outw.lines && outw.lines.length > 0 ? outw.lines : [null];
      return lines.map((l, lIdx) => ({
        id: `${outw.id || outw.outwardId}_${l?.outwardLineId || l?.lineId || lIdx}`,
        outwardId: outw.id || outw.outwardId,
        outwardNo: outw.outwardNo,
        outwardDate: outw.outwardDate || '',
        ourDcNo: outw.ourDcNo || '—',
        customerName: outw.customerCompanyNameSnapshot || outw.customerName || '—',
        subcontractorName: outw.subcontractorNameSnapshot || outw.subContractorName || '—',
        styleNo: outw.styleNoSnapshot || outw.styleNo || '—',
        poNumber: outw.poNumberSnapshot || outw.poNumber || '—',
        colourName: l ? l.colourNameSnapshot || l.colour || '—' : '—',
        process: l ? l.washTypeSnapshot || l.processType || l.process || 'Wash' : '—',
        inwardQty: l ? Number(l.cumulativeInwardQtySnapshot) || 0 : 0,
        dispatchQty: l ? Number(l.dispatchQty) || 0 : 0,
        remainingQty: l ? Number(l.remainingAfterDispatchSnapshot) || 0 : 0,
        unit: l ? (l.unit === 'kg' ? 'KG' : 'PCS') : 'PCS',
        vehicleNumber: outw.vehicleNumber || '—',
        status: (outw.status || 'Posted').toUpperCase(),
      }));
    });
  }, [filteredOutwards]);

  const outwardTableControls = useTableControls<FlattenedOutwardLine>(flattenedOutwardRows, {
    columns: OUTWARD_REPORT_TABLE_COLUMNS,
    defaultSortField: 'outwardDate',
    defaultSortDirection: 'desc',
  });

  // Effective outwards matching active table controls (column filters, search query, sorting)
  const effectiveOutwards: OutwardEntry[] = useMemo(() => {
    const hasTableFilters =
      outwardTableControls.searchQuery.trim() !== '' ||
      outwardTableControls.searchColumn !== 'ALL' ||
      Object.values(outwardTableControls.columnFilters).some((v) => (v || '').trim() !== '');

    if (!hasTableFilters && viewMode === 'grouped') {
      return filteredOutwards;
    }

    const outwardMap = new Map<string, OutwardEntry>();
    filteredOutwards.forEach((outw) => {
      const key = outw.id || outw.outwardId;
      if (key) outwardMap.set(key, outw);
    });

    const orderedOutwardIds: string[] = [];
    const rowsByOutwardId = new Map<string, typeof outwardTableControls.processedData>();

    outwardTableControls.processedData.forEach((row) => {
      if (!rowsByOutwardId.has(row.outwardId)) {
        rowsByOutwardId.set(row.outwardId, []);
        orderedOutwardIds.push(row.outwardId);
      }
      rowsByOutwardId.get(row.outwardId)!.push(row);
    });

    const result: OutwardEntry[] = [];

    orderedOutwardIds.forEach((outwId) => {
      const origOutw = outwardMap.get(outwId);
      if (!origOutw) return;

      const matchingRows = rowsByOutwardId.get(outwId) || [];
      const matchingRowIdSet = new Set(matchingRows.map((r) => r.id));

      const origLines = origOutw.lines || [];
      let filteredLines: typeof origLines = [];

      if (origLines.length === 0) {
        filteredLines = [];
      } else {
        filteredLines = origLines.filter((l, lIdx) => {
          const rowId = `${outwId}_${l.outwardLineId || l.lineId || lIdx}`;
          return matchingRowIdSet.has(rowId);
        });
      }

      if (origLines.length > 0 && filteredLines.length === 0) {
        return;
      }

      const totalPieces = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() !== 'kg')
        .reduce((sum, l) => sum + (Number(l.dispatchQty) || 0), 0);

      const totalKg = filteredLines
        .filter((l) => (l.unit || '').toLowerCase() === 'kg')
        .reduce((sum, l) => sum + (Number(l.dispatchQty) || 0), 0);

      result.push({
        ...origOutw,
        lines: filteredLines,
        totalQtyByUnit: {
          piece: totalPieces,
          kg: totalKg
        }
      });
    });

    return result;
  }, [
    filteredOutwards,
    outwardTableControls.processedData,
    outwardTableControls.searchQuery,
    outwardTableControls.searchColumn,
    outwardTableControls.columnFilters,
    viewMode
  ]);

  // --- Summary Metrics Calculations ---
  const metrics = useMemo(() => {
    let totalPieces = 0;
    let totalKg = 0;
    let totalColourLines = 0;
    let totalInward = 0;
    let totalRemaining = 0;
    const styleSet = new Set<string>();
    const contractorSet = new Set<string>();
    const customerSet = new Set<string>();

    effectiveOutwards.forEach((outw) => {
      totalPieces += Number(outw.totalQtyByUnit?.piece) || 0;
      totalKg += Number(outw.totalQtyByUnit?.kg) || 0;

      const style = outw.styleNoSnapshot || outw.styleNo;
      if (style) styleSet.add(style.trim().toLowerCase());

      const cust = outw.customerCompanyNameSnapshot || outw.customerName;
      if (cust) customerSet.add(cust.trim().toLowerCase());

      const sub = outw.subcontractorNameSnapshot || outw.subContractorName;
      if (sub) contractorSet.add(sub.trim().toLowerCase());

      const lines = outw.lines || [];
      totalColourLines += lines.length;
      lines.forEach((l) => {
        totalInward += Number(l.cumulativeInwardQtySnapshot) || 0;
        totalRemaining += Number(l.remainingAfterDispatchSnapshot) || 0;
      });
    });

    return {
      totalOutwards: effectiveOutwards.length,
      totalPieces,
      totalKg,
      totalColourLines,
      totalInward,
      totalRemaining,
      uniqueStylesCount: styleSet.size,
      uniqueCustomersCount: customerSet.size,
      uniqueContractorsCount: contractorSet.size
    };
  }, [effectiveOutwards]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedCustomerId !== 'all' ||
    selectedSubcontractorId !== 'all' ||
    selectedTransporterId !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    processCategory !== 'all' ||
    status !== 'all' ||
    searchQuery.trim() !== '';

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCustomerId('all');
    setSelectedSubcontractorId('all');
    setSelectedTransporterId('all');
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

  // Toggle Outward Accordion
  const toggleOutwardExpand = (outwardId: string) => {
    setExpandedOutwards((prev) => ({
      ...prev,
      [outwardId]: prev[outwardId] === undefined ? false : !prev[outwardId]
    }));
  };

  // Expand / Collapse All
  const handleToggleAll = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    filteredOutwards.forEach((outw) => {
      newState[outw.id || outw.outwardId] = expand;
    });
    setExpandedOutwards(newState);
  };

  // --- Export Handlers ---
  const handleDownloadPdf = () => {
    if (effectiveOutwards.length === 0) {
      alert('No outward dispatch records to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      OutwardReportPdfService.downloadPdf({
        outwards: effectiveOutwards,
        customerName: selectedCustomer ? selectedCustomer.companyName : (outwardTableControls.columnFilters['customerName'] || undefined),
        subcontractorName: selectedSubcontractor ? selectedSubcontractor.companyName : (outwardTableControls.columnFilters['subcontractorName'] || undefined),
        transporterName: selectedTransporter ? selectedTransporter.companyName : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (outwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (outwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF export. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenPdfPreview = () => {
    if (effectiveOutwards.length === 0) {
      alert('No outward dispatch records to preview.');
      return;
    }
    try {
      OutwardReportPdfService.openPdfPreview({
        outwards: effectiveOutwards,
        customerName: selectedCustomer ? selectedCustomer.companyName : (outwardTableControls.columnFilters['customerName'] || undefined),
        subcontractorName: selectedSubcontractor ? selectedSubcontractor.companyName : (outwardTableControls.columnFilters['subcontractorName'] || undefined),
        transporterName: selectedTransporter ? selectedTransporter.companyName : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (outwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (outwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Failed to preview PDF:', err);
      alert('Failed to open PDF preview.');
    }
  };

  const handleDownloadExcelColours = async () => {
    if (effectiveOutwards.length === 0) {
      alert('No outward dispatch records to export.');
      return;
    }
    setIsExportingExcelColours(true);
    try {
      await OutwardReportExcelService.exportWithColours({
        outwards: effectiveOutwards,
        customerName: selectedCustomer ? selectedCustomer.companyName : (outwardTableControls.columnFilters['customerName'] || undefined),
        subcontractorName: selectedSubcontractor ? selectedSubcontractor.companyName : (outwardTableControls.columnFilters['subcontractorName'] || undefined),
        transporterName: selectedTransporter ? selectedTransporter.companyName : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (outwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (outwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Failed to generate Excel with colours:', err);
      alert('Failed to export Excel report. Please try again.');
    } finally {
      setIsExportingExcelColours(false);
    }
  };

  const handleDownloadExcelSummary = async () => {
    if (effectiveOutwards.length === 0) {
      alert('No outward dispatch records to export.');
      return;
    }
    setIsExportingExcelSummary(true);
    try {
      await OutwardReportExcelService.exportSummaryOnly({
        outwards: effectiveOutwards,
        customerName: selectedCustomer ? selectedCustomer.companyName : (outwardTableControls.columnFilters['customerName'] || undefined),
        subcontractorName: selectedSubcontractor ? selectedSubcontractor.companyName : (outwardTableControls.columnFilters['subcontractorName'] || undefined),
        transporterName: selectedTransporter ? selectedTransporter.companyName : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        processCategory: processCategory !== 'all' ? processCategory : (outwardTableControls.columnFilters['process'] || undefined),
        status: status !== 'all' ? status : (outwardTableControls.columnFilters['status'] || undefined)
      });
    } catch (err) {
      console.error('Failed to generate Excel summary:', err);
      alert('Failed to export Excel summary report.');
    } finally {
      setIsExportingExcelSummary(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Back Button and Export Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            data-back-button="true"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Outward Dispatches (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
              <span>Outward Dispatch Report Generation</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                {effectiveOutwards.length !== filteredOutwards.length
                  ? `${effectiveOutwards.length} of ${filteredOutwards.length} records`
                  : `${filteredOutwards.length} records`}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter, inspect, and export outward deliveries with colour-wise breakdown & logistics
            </p>
          </div>
        </div>

        {/* Export Buttons Group */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <PreviewButton
            onClick={handleOpenPdfPreview}
            disabled={effectiveOutwards.length === 0}
            label="Preview PDF"
            title="Preview and Print PDF"
          />

          <PdfExportButton
            onClick={handleDownloadPdf}
            loading={isExportingPdf}
            disabled={effectiveOutwards.length === 0}
            label="Download PDF"
            title="Download PDF Report"
          />

          <ExcelExportButton
            onClick={handleDownloadExcelColours}
            loading={isExportingExcelColours}
            disabled={effectiveOutwards.length === 0}
            label="Excel (With Colours)"
            title="Export Excel with all Colour Lines"
          />

          <ExcelSummaryExportButton
            onClick={handleDownloadExcelSummary}
            loading={isExportingExcelSummary}
            disabled={effectiveOutwards.length === 0}
            label="Excel (Outward Summary)"
            title="Export Outward Header & Summary Info Only (No Colour Lines)"
          />
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Total Dispatches
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalOutwards.toLocaleString()}</span>
            <span className="text-xs text-slate-500">records</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {metrics.uniqueCustomersCount} companies</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Pieces Dispatched
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalPieces.toLocaleString()}</span>
            <span className="text-xs text-slate-500 font-semibold">pcs</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.uniqueStylesCount} unique styles</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Fabric Weight
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.totalKg.toLocaleString()}</span>
            <span className="text-xs text-slate-500 font-semibold">kg</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Weight-based lots</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
            Active Contractors
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{metrics.uniqueContractorsCount}</span>
            <span className="text-xs text-slate-500">subcontractors</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{metrics.totalColourLines} colour entries</p>
        </div>
      </div>

      {/* 3. Comprehensive Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1F4E79]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Report Filters</h2>
            {hasActiveFilters && (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Active filters applied
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
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
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
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

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Customer Selection */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Customer / Company</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Customer Companies ({customerList.length})</option>
              {customerList.map((c) => (
                <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Subcontractor / Subcompany */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Contractor / Subcontractor</label>
            <select
              value={selectedSubcontractorId}
              onChange={(e) => setSelectedSubcontractorId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Subcontractors / Contractors ({subcontractorList.length})</option>
              {subcontractorList.map((s) => (
                <option key={s.vendorId || s.id} value={s.vendorId || s.id}>
                  {s.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Transporter / Vendor */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Logistics / Transporter</label>
            <select
              value={selectedTransporterId}
              onChange={(e) => setSelectedTransporterId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Transporters / Logistics</option>
              <option value="in_house">In-House Logistics</option>
              {transporterList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Process Category */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Process Category</label>
            <select
              value={processCategory}
              onChange={(e) => setProcessCategory(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="all">All Processes (Washing & Dyeing)</option>
              <option value="washing">Washing</option>
              <option value="dyeing">Dyeing</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Dispatch Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              {statusOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Live Search</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Outward #, DC #, Style, PO, Colour..."
                className="w-full bg-white border border-slate-200 rounded-lg pl-8.5 pr-2.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>
          </div>
        </div>

        {/* Date Presets Quick Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
          <span className="text-slate-400 text-[11px] font-medium mr-1">Date Presets:</span>
          <button
            type="button"
            onClick={() => handlePresetDate('this_month')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => handlePresetDate('last_30_days')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => handlePresetDate('this_year')}
            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
          >
            This Year
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => handlePresetDate('clear')}
              className="px-2.5 py-1 rounded-md text-rose-600 hover:bg-rose-50 text-[11px] font-semibold transition-colors cursor-pointer ml-1"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* 4. Results List View */}
      {filteredOutwards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Outward Dispatches Match Filter Criteria</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Try adjusting or resetting your company, date range, or process category filters to see more results.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset All Filters
            </button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        // ==========================================
        // VIEW MODE 1: GROUPED ACCORDION CARDS
        // ==========================================
        <div className="space-y-4">
          {/* Group controls */}
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{filteredOutwards.length}</strong> outward dispatches
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                Expand All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {filteredOutwards.map((outw, idx) => {
            const outwKey = outw.id || outw.outwardId;
            const isExpanded = expandedOutwards[outwKey] !== false; // expanded by default
            const lines = outw.lines || [];

            return (
              <div
                key={outwKey || idx}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-150 hover:border-slate-300"
              >
                {/* Outward Card Header */}
                <div
                  onClick={() => toggleOutwardExpand(outwKey)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/60 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
                >
                  <div className="flex items-start sm:items-center gap-3 flex-1">
                    <button
                      type="button"
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors mt-0.5 sm:mt-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 font-mono">{outw.outwardNo}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            outw.status === 'posted'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : outw.status === 'draft'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : outw.status === 'reversed'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {outw.status}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-semibold text-slate-600">
                          {outw.outwardDate ? formatDate(outw.outwardDate) : '—'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>
                          DC: <strong className="text-slate-800 font-mono">{outw.ourDcNo || '—'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Customer:{' '}
                          <strong className="text-slate-800">
                            {outw.customerCompanyNameSnapshot || outw.customerName || '—'}
                          </strong>
                        </span>
                        {outw.subcontractorNameSnapshot && (
                          <>
                            <span>•</span>
                            <span>
                              Contractor:{' '}
                              <strong className="text-indigo-700">{outw.subcontractorNameSnapshot}</strong>
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          Vehicle: <strong className="text-slate-800">{outw.vehicleNumber || '—'}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">
                        {(outw.totalQtyByUnit?.piece || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">pcs</span>
                        {Number(outw.totalQtyByUnit?.kg) > 0 && (
                          <span className="text-amber-800 ml-1.5 font-bold">
                            / {Number(outw.totalQtyByUnit?.kg).toLocaleString()} kg
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Style: {outw.styleNoSnapshot || outw.styleNo || '—'}
                      </span>
                    </div>

                    {onViewOutward && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOutward(outw.id || outw.outwardId);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                        title="View Full Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Colour Lines Table */}
                {isExpanded && (
                  <div className="p-4 sm:p-5">
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full min-w-max text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                            <th className="py-2.5 px-3 text-center border-r border-slate-200 w-12 whitespace-nowrap align-middle">S.No</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap align-middle">Colour Name</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap align-middle">Process / Wash</th>
                            <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap align-middle">PO Ordered</th>
                            <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap align-middle">Total Inward</th>
                            <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap align-middle">Prev Dispatched</th>
                            <th className="py-2.5 px-3 text-right bg-blue-50 text-[#1F4E79] font-bold border-r border-slate-200 whitespace-nowrap align-middle">
                              Dispatched Qty
                            </th>
                            <th className="py-2.5 px-3 text-right border-r border-slate-200 whitespace-nowrap align-middle">Remaining</th>
                            <th className="py-2.5 px-3 text-center w-16 whitespace-nowrap align-middle">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {lines.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-4 px-3 text-center text-xs text-slate-400">
                                No colour lines recorded on this outward dispatch.
                              </td>
                            </tr>
                          ) : (
                            lines.map((l, lIdx) => (
                              <tr key={l.outwardLineId || l.lineId || lIdx} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-3 text-center font-medium text-slate-400 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {lIdx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {l.colourNameSnapshot || l.colour || '—'}
                                  {l.colourCodeSnapshot && (
                                    <span className="ml-1 text-[10px] text-slate-400 font-normal">
                                      ({l.colourCodeSnapshot})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {l.washTypeSnapshot || l.processType || l.process || 'Standard Wash'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {(Number(l.orderedQtySnapshot) || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {(Number(l.cumulativeInwardQtySnapshot) || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-500 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {(Number(l.previouslyDispatchedQtySnapshot) || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1F4E79] bg-blue-50/40 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {(Number(l.dispatchQty) || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap align-middle">
                                  {(Number(l.remainingAfterDispatchSnapshot) || 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium uppercase text-[10px] text-slate-500 whitespace-nowrap align-middle">
                                  {l.unit || 'piece'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {lines.length > 0 && (
                          <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs">
                            <tr>
                              <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-600 border-r border-slate-200">
                                Total:
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                                {lines.reduce((acc, l) => acc + (Number(l.orderedQtySnapshot) || 0), 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-600 border-r border-slate-200">
                                {lines.reduce((acc, l) => acc + (Number(l.cumulativeInwardQtySnapshot) || 0), 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-500 border-r border-slate-200">
                                {lines.reduce((acc, l) => acc + (Number(l.previouslyDispatchedQtySnapshot) || 0), 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1F4E79] bg-blue-100/50 border-r border-slate-200">
                                {lines.reduce((acc, l) => acc + (Number(l.dispatchQty) || 0), 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-200">
                                {lines.reduce((acc, l) => acc + (Number(l.remainingAfterDispatchSnapshot) || 0), 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3 text-center uppercase text-[10px] text-slate-500">
                                {outw.totalQtyByUnit?.kg ? 'KG' : 'PCS'}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Logistics & Dispatch Notes Footer */}
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          Vehicle: <strong className="text-slate-800">{outw.vehicleNumber || '—'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Driver: <strong className="text-slate-800">{outw.driverName || '—'}</strong>
                        </span>
                        {outw.destination && (
                          <>
                            <span>•</span>
                            <span>
                              Destination: <strong className="text-slate-800">{outw.destination}</strong>
                            </span>
                          </>
                        )}
                        {outw.transporterNameSnapshot && (
                          <>
                            <span>•</span>
                            <span>
                              Logistics: <strong className="text-slate-800">{outw.transporterNameSnapshot}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      {outw.remarks && (
                        <div className="text-[11px] text-slate-500 italic">
                          Notes: {outw.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // ==========================================
        // VIEW MODE 2: COMPREHENSIVE FLATTENED TABLE WITH TABLE CONTROLS
        // ==========================================
        <TableMaximizeWrapper
          title="Outward Dispatch Detailed Report"
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {outwardTableControls.filteredCount} Lines
            </span>
          }
        >
          {(isMaximized) => (
            <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col ${isMaximized ? 'flex-1 min-h-0' : ''}`}>
              {/* Table Controls Bar */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                {/* Search Bar with Column Selector */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px] max-w-lg">
                  <div className="relative">
                    <select
                      value={outwardTableControls.searchColumn}
                      onChange={(e) => outwardTableControls.setSearchColumn(e.target.value)}
                      className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Columns</option>
                      {OUTWARD_REPORT_TABLE_COLUMNS.map((col) => (
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
                        outwardTableControls.searchColumn === 'ALL'
                          ? 'Outward #, DC #, Style, PO, Colour...'
                          : `Search by ${OUTWARD_REPORT_TABLE_COLUMNS.find((c) => c.key === outwardTableControls.searchColumn)?.label}...`
                      }
                      value={outwardTableControls.searchQuery}
                      onChange={(e) => outwardTableControls.setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
                    />
                    {outwardTableControls.searchQuery && (
                      <button
                        type="button"
                        onClick={() => outwardTableControls.setSearchQuery('')}
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
                    onClick={() => outwardTableControls.setShowColumnFilters(!outwardTableControls.showColumnFilters)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                      outwardTableControls.showColumnFilters || Object.values(outwardTableControls.columnFilters).some((v) => (v || '').trim() !== '')
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    title="Toggle column-wise search inputs on table header"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Column Filters</span>
                    {Object.values(outwardTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
                      <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {Object.values(outwardTableControls.columnFilters).filter((v) => (v || '').trim() !== '').length}
                      </span>
                    )}
                  </button>

                  {outwardTableControls.isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={outwardTableControls.handleResetFilters}
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
                <table className="w-full min-w-max text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300">
                    <tr className="border-b-2 border-slate-300 bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider">
                      <th
                        onClick={() => outwardTableControls.handleSort('outwardNo')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'outwardNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Outward #</span>
                          {outwardTableControls.renderSortIcon('outwardNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('outwardDate')}
                        className={`py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'outwardDate' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Date</span>
                          {outwardTableControls.renderSortIcon('outwardDate')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('ourDcNo')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'ourDcNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Our DC #</span>
                          {outwardTableControls.renderSortIcon('ourDcNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('customerName')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'customerName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Customer Name</span>
                          {outwardTableControls.renderSortIcon('customerName')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('subcontractorName')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'subcontractorName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Subcontractor Unit</span>
                          {outwardTableControls.renderSortIcon('subcontractorName')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('styleNo')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'styleNo' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Style No</span>
                          {outwardTableControls.renderSortIcon('styleNo')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('poNumber')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'poNumber' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>PO Number</span>
                          {outwardTableControls.renderSortIcon('poNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('colourName')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'colourName' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Colour Name</span>
                          {outwardTableControls.renderSortIcon('colourName')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('process')}
                        className={`py-2.5 px-3 text-left whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'process' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span>Process</span>
                          {outwardTableControls.renderSortIcon('process')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('inwardQty')}
                        className={`py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'inwardQty' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Inward Qty</span>
                          {outwardTableControls.renderSortIcon('inwardQty')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('dispatchQty')}
                        className={`py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'dispatchQty' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Dispatched</span>
                          {outwardTableControls.renderSortIcon('dispatchQty')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('remainingQty')}
                        className={`py-2.5 px-3 text-right whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'remainingQty' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Remaining</span>
                          {outwardTableControls.renderSortIcon('remainingQty')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('unit')}
                        className={`py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'unit' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Unit</span>
                          {outwardTableControls.renderSortIcon('unit')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('vehicleNumber')}
                        className={`py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-300 align-middle cursor-pointer select-none group transition-colors ${
                          outwardTableControls.sortField === 'vehicleNumber' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Vehicle #</span>
                          {outwardTableControls.renderSortIcon('vehicleNumber')}
                        </div>
                      </th>
                      <th
                        onClick={() => outwardTableControls.handleSort('status')}
                        className={`py-2.5 px-3 text-center whitespace-nowrap align-middle cursor-pointer select-none group transition-colors pr-12 min-w-[130px] ${
                          outwardTableControls.sortField === 'status' ? 'bg-[#DCE9F5]' : 'hover:bg-[#DCE9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Status</span>
                          {outwardTableControls.renderSortIcon('status')}
                        </div>
                      </th>
                    </tr>

                {/* Inline Column Filter Row */}
                {outwardTableControls.showColumnFilters && (
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter #"
                        value={outwardTableControls.columnFilters['outwardNo'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            outwardNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter date"
                        value={outwardTableControls.columnFilters['outwardDate'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            outwardDate: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter DC"
                        value={outwardTableControls.columnFilters['ourDcNo'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            ourDcNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter customer"
                        value={outwardTableControls.columnFilters['customerName'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
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
                        value={outwardTableControls.columnFilters['subcontractorName'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
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
                        value={outwardTableControls.columnFilters['styleNo'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            styleNo: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter PO"
                        value={outwardTableControls.columnFilters['poNumber'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            poNumber: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter colour"
                        value={outwardTableControls.columnFilters['colourName'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
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
                        value={outwardTableControls.columnFilters['process'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
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
                        value={outwardTableControls.columnFilters['inwardQty'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            inwardQty: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter disp"
                        value={outwardTableControls.columnFilters['dispatchQty'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            dispatchQty: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Filter rem"
                        value={outwardTableControls.columnFilters['remainingQty'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            remainingQty: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-right"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Unit"
                        value={outwardTableControls.columnFilters['unit'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            unit: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                      />
                    </th>
                    <th className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        placeholder="Veh #"
                        value={outwardTableControls.columnFilters['vehicleNumber'] || ''}
                        onChange={(e) =>
                          outwardTableControls.setColumnFilters({
                            ...outwardTableControls.columnFilters,
                            vehicleNumber: e.target.value
                          })
                        }
                        className="w-full text-[11px] px-1.5 py-1 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#1F4E79] text-center"
                      />
                    </th>
                    <th className="p-1 text-center">
                      {Object.values(outwardTableControls.columnFilters).some((v) => (v || '').trim() !== '') ? (
                        <button
                          type="button"
                          onClick={() => outwardTableControls.setColumnFilters({})}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
                        >
                          Clear
                        </button>
                      ) : (
                        <input
                          type="text"
                          placeholder="Status"
                          value={outwardTableControls.columnFilters['status'] || ''}
                          onChange={(e) =>
                            outwardTableControls.setColumnFilters({
                              ...outwardTableControls.columnFilters,
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
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {outwardTableControls.processedData.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center bg-white">
                      <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No matching lines found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your live search query or column filters.
                      </p>
                      {outwardTableControls.isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={outwardTableControls.handleResetFilters}
                          className="mt-3 px-3 py-1.5 text-xs font-semibold text-[#1F4E79] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Reset Table Controls
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  outwardTableControls.processedData.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-left font-bold font-mono text-[#1F4E79] border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.outwardNo}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.outwardDate ? formatDate(row.outwardDate) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-left font-semibold text-slate-800 font-mono border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.ourDcNo}
                      </td>
                      <td className="py-2.5 px-3 text-left font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-left text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.subcontractorName}
                      </td>
                      <td className="py-2.5 px-3 text-left font-bold text-slate-900 font-mono border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.styleNo}
                      </td>
                      <td className="py-2.5 px-3 text-left text-slate-600 font-mono border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.poNumber}
                      </td>
                      <td className="py-2.5 px-3 text-left font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.colourName}
                      </td>
                      <td className="py-2.5 px-3 text-left text-slate-600 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.process}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.inwardQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1F4E79] bg-blue-50/50 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.dispatchQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.remainingQty.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium uppercase text-[10px] text-slate-500 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap align-middle">
                        {row.vehicleNumber}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap align-middle">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                            row.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : row.status === 'DRAFT'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : row.status === 'REVERSED'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 text-xs">
                <tr>
                  <td colSpan={9} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] border-r border-slate-200 text-slate-700 align-middle">
                    Grand Total ({outwardTableControls.filteredCount} Lines):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-800 border-r border-slate-200 align-middle">
                    {outwardTableControls.processedData.reduce((acc, r) => acc + r.inwardQty, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-[#1F4E79] bg-blue-100/60 border-r border-slate-200 align-middle">
                    {outwardTableControls.processedData.reduce((acc, r) => acc + r.dispatchQty, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 border-r border-slate-200 align-middle">
                    {outwardTableControls.processedData.reduce((acc, r) => acc + r.remainingQty, 0).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-center uppercase text-[10px] text-slate-600 border-r border-slate-200 align-middle">
                    PCS / KG
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center align-middle"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* All-In-One-Stretch Informative Summary Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing all <strong>{outwardTableControls.filteredCount}</strong> records in one stretch
              {outwardTableControls.filteredCount !== outwardTableControls.totalCount && (
                <span> (filtered from {outwardTableControls.totalCount} total colour lines)</span>
              )}
            </span>
            <span className="font-semibold text-slate-700">
              Total Dispatched in View: {outwardTableControls.processedData.reduce((acc, r) => acc + r.dispatchQty, 0).toLocaleString('en-IN')} pcs
            </span>
          </div>
        </div>
        )}
      </TableMaximizeWrapper>
      )}
    </div>
  );
};
