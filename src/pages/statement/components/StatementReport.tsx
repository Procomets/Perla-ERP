import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../../types/inwardOutward';
import { POService } from '../../../services/poService';
import { InwardService } from '../../../services/inwardService';
import { OutwardService } from '../../../services/outwardService';
import { VendorService } from '../../../services/vendorService';
import { useAuth } from '../../../context/AuthContext';
import { StatementReportPdfService } from '../../../services/statementReportPdfService';
import { StatementReportExcelService } from '../../../services/statementReportExcelService';
import { PdfExportButton, ExcelExportButton } from '../../../components/ui/ExportButtons';
import { useTableControls, TableColumnConfig } from '../../../hooks/useTableControls';
import {
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  FileDown,
  Scale,
  Package,
  Boxes
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export interface StatementReportColourLine {
  id: string;
  poId: string;
  poLineId: string;
  colourName: string;
  process: string;
  unit: string;
  orderQty: number;
  receivedQty: number; // Inward Qty
  dispatchQty: number; // Outward Qty
  dispatchBalance: number; // receivedQty - dispatchQty
  receiveBalance: number; // orderQty - receivedQty
  isAllThreeEqual: boolean;
  isReconciled: boolean;
}

export interface StatementReportGroup {
  id: string;
  poId: string;
  poNumber: string;
  customerPoNumber?: string | null;
  styleNo: string;
  itemName: string;
  companyId: string;
  companyName: string;
  orderDate?: string;
  status: string;
  lines: StatementReportColourLine[];
  totalOrderQty: number;
  totalReceivedQty: number;
  totalDispatchQty: number;
  totalDispatchBalance: number;
  totalReceiveBalance: number;
  colourCount: number;
  isAllThreeEqual: boolean;
  isReconciled: boolean;
}

export interface FlattenedStatementRow {
  id: string;
  poId: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  companyName: string;
  colourName: string;
  process: string;
  unit: string;
  orderQty: number;
  receivedQty: number;
  dispatchQty: number;
  dispatchBalance: number;
  receiveBalance: number;
  status: string;
  isAllThreeEqual: boolean;
}

const STATEMENT_TABLE_COLUMNS: TableColumnConfig<FlattenedStatementRow>[] = [
  { key: 'companyName', label: 'Company Name', type: 'text', getValue: (r) => r.companyName },
  { key: 'styleNo', label: 'Style No', type: 'text', getValue: (r) => r.styleNo },
  { key: 'poNumber', label: 'PO Number', type: 'text', getValue: (r) => r.poNumber },
  { key: 'colourName', label: 'Colour', type: 'text', getValue: (r) => r.colourName },
  { key: 'process', label: 'Wash / Process', type: 'text', getValue: (r) => r.process },
  { key: 'orderQty', label: 'Order Qty', type: 'number', getValue: (r) => r.orderQty },
  { key: 'receivedQty', label: 'Received Qty (Inward)', type: 'number', getValue: (r) => r.receivedQty },
  { key: 'dispatchQty', label: 'Dispatch Qty (Outward)', type: 'number', getValue: (r) => r.dispatchQty },
  { key: 'dispatchBalance', label: 'Dispatch Balance', type: 'number', getValue: (r) => r.dispatchBalance },
  { key: 'receiveBalance', label: 'Receive Balance', type: 'number', getValue: (r) => r.receiveBalance },
  { key: 'status', label: 'Status', type: 'text', getValue: (r) => r.status }
];

interface StatementReportProps {
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  vendors?: Vendor[];
  onBack?: () => void;
}

export const StatementReport: React.FC<StatementReportProps> = ({
  pos: initialPOs,
  inwards: initialInwards,
  outwards: initialOutwards,
  vendors: initialVendors,
  onBack
}) => {
  const { isDemoMode } = useAuth();

  // Data states
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs || []);
  const [inwards, setInwards] = useState<InwardEntry[]>(initialInwards || []);
  const [outwards, setOutwards] = useState<OutwardEntry[]>(initialOutwards || []);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors || []);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(
    !initialPOs || initialPOs.length === 0 || !initialInwards || !initialOutwards || !initialVendors
  );

  // Filter states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedStyleNo, setSelectedStyleNo] = useState<string>('all');
  const [selectedPoNumber, setSelectedPoNumber] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'reconciled' | 'pending_inward' | 'pending_dispatch'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

  // Expanded PO Accordion State (for grouped view)
  const [expandedPOs, setExpandedPOs] = useState<Record<string, boolean>>({});

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Load live data if not provided via props
  const reloadData = async () => {
    setIsLoadingData(true);
    try {
      const [poRes, inwRes, outRes, vRes] = await Promise.all([
        POService.getPurchaseOrders({}, { page: 1, pageSize: 1000 }, isDemoMode),
        InwardService.getInwardEntries({}, { page: 1, pageSize: 1000 }, isDemoMode),
        OutwardService.getOutwardEntries({}, { page: 1, pageSize: 1000 }, isDemoMode),
        VendorService.getVendors({}, { page: 1, pageSize: 1000 }, isDemoMode)
      ]);
      setPos(poRes.pos || []);
      setInwards(inwRes.inwards || []);
      setOutwards(outRes.outwards || []);
      setVendors(vRes.vendors || []);
    } catch (err) {
      console.error('Failed to reload statement report data:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (!initialPOs || initialPOs.length === 0 || !initialInwards || !initialOutwards || !initialVendors) {
      reloadData();
    }
  }, [isDemoMode]);

  // Vendor Lookup Maps
  const vendorMap = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((v) => {
      if (v.id) map.set(v.id, v.companyName);
      if (v.vendorId) map.set(v.vendorId, v.companyName);
    });
    return map;
  }, [vendors]);

  const customerList = useMemo(() => {
    return vendors.filter((v) => {
      const type = (v.vendorType || '').toLowerCase();
      const isSub = v.vendorCategory === 'subcompany' || !!v.parentVendorId;
      return (type === 'customer' || type === 'both') && !isSub;
    });
  }, [vendors]);

  // Reconcile and calculate quantities for all POs and their colours
  const allReconciliationGroups: StatementReportGroup[] = useMemo(() => {
    // Only count posted inwards and outwards
    const postedInwards = inwards.filter(
      (inw) => (inw.status || '').toLowerCase() === 'posted' || !inw.status
    );
    const postedOutwards = outwards.filter(
      (out) => (out.status || '').toLowerCase() === 'posted' || !out.status
    );

    return pos.map((po) => {
      const poKeyId = po.id;
      const poKeyNum = (po.poNumber || '').trim().toLowerCase();
      const custId = po.customerId || po.customerVendorId || '';
      const companyName =
        po.customerCompanyNameSnapshot ||
        po.customerName ||
        vendorMap.get(custId) ||
        'Direct Customer';

      // Find all matching inward entries for this PO
      const matchingInwards = postedInwards.filter((inEntry) => {
        const inPoId = inEntry.poId;
        const inPoNum = (inEntry.poNumberSnapshot || inEntry.poNumber || '').trim().toLowerCase();
        return (poKeyId && inPoId === poKeyId) || (poKeyNum && inPoNum === poKeyNum);
      });

      // Find all matching outward entries for this PO
      const matchingOutwards = postedOutwards.filter((outEntry) => {
        const outPoId = outEntry.poId;
        const outPoNum = (outEntry.poNumberSnapshot || outEntry.poNumber || '').trim().toLowerCase();
        return (poKeyId && outPoId === poKeyId) || (poKeyNum && outPoNum === poKeyNum);
      });

      const lines: StatementReportColourLine[] = [];
      const poColours = po.colourLines || po.lines || (po as any).colourDetails || [];

      poColours.forEach((col: any, idx: number) => {
        const lineId = col.id || col.lineId || `line_${idx}`;
        const lineColour = col.colourName || col.colour || col.name || `Colour #${idx + 1}`;
        const colourLower = lineColour.trim().toLowerCase();
        const process = col.washProcess || col.washType || col.process || (po as any).processCategory || 'Standard Wash';
        const unit = (col.unit || col.rateBasis || 'piece').toLowerCase().includes('kg') ? 'kg' : 'piece';
        const orderQty = Number(col.quantity || col.qty || col.orderQty) || 0;

        // Cumulative Inward for this colour line
        let receivedQty = 0;
        matchingInwards.forEach((inEntry) => {
          if (inEntry.lines && inEntry.lines.length > 0) {
            inEntry.lines.forEach((l: any) => {
              const matchesLine = lineId && (l.poLineId === lineId || l.lineId === lineId);
              const matchesName = (l.colourNameSnapshot || l.colour || '').trim().toLowerCase() === colourLower;
              if (matchesLine || matchesName) {
                receivedQty += Number(l.receivedQty || l.quantity) || 0;
              }
            });
          } else {
            receivedQty += Number(inEntry.totalQuantity) || 0;
          }
        });

        // Cumulative Outward for this colour line
        let dispatchQty = 0;
        matchingOutwards.forEach((outEntry) => {
          if (outEntry.lines && outEntry.lines.length > 0) {
            outEntry.lines.forEach((l: any) => {
              const matchesLine = lineId && (l.poLineId === lineId || l.lineId === lineId);
              const matchesName = (l.colourNameSnapshot || l.colour || '').trim().toLowerCase() === colourLower;
              if (matchesLine || matchesName) {
                dispatchQty += Number(l.dispatchQty || l.quantity) || 0;
              }
            });
          } else {
            dispatchQty += Number(outEntry.totalQuantity) || 0;
          }
        });

        const dispatchBalance = receivedQty - dispatchQty; // Inward - Outward
        const receiveBalance = orderQty - receivedQty; // Order - Inward
        const isAllThreeEqual = orderQty === receivedQty && receivedQty === dispatchQty && orderQty > 0;
        const isReconciled = isAllThreeEqual;

        lines.push({
          id: `${po.id}_${lineId}`,
          poId: po.id,
          poLineId: lineId,
          colourName: lineColour,
          process,
          unit,
          orderQty,
          receivedQty,
          dispatchQty,
          dispatchBalance,
          receiveBalance,
          isAllThreeEqual,
          isReconciled
        });
      });

      const totalOrderQty = lines.reduce((sum, l) => sum + l.orderQty, 0);
      const totalReceivedQty = lines.reduce((sum, l) => sum + l.receivedQty, 0);
      const totalDispatchQty = lines.reduce((sum, l) => sum + l.dispatchQty, 0);
      const totalDispatchBalance = totalReceivedQty - totalDispatchQty;
      const totalReceiveBalance = totalOrderQty - totalReceivedQty;
      const isAllThreeEqual = totalOrderQty === totalReceivedQty && totalReceivedQty === totalDispatchQty && totalOrderQty > 0;
      const isReconciled = isAllThreeEqual;

      return {
        id: po.id,
        poId: po.id,
        poNumber: po.poNumber || 'N/A',
        customerPoNumber: po.customerPoNumber || null,
        styleNo: po.styleNo || (po as any).styleNumber || 'N/A',
        itemName: po.itemName || (po as any).itemDescription || 'Garments',
        companyId: custId,
        companyName,
        orderDate: po.orderDate || (po as any).date || '',
        status: po.status || 'Active',
        lines,
        totalOrderQty,
        totalReceivedQty,
        totalDispatchQty,
        totalDispatchBalance,
        totalReceiveBalance,
        colourCount: lines.length,
        isAllThreeEqual,
        isReconciled
      };
    });
  }, [pos, inwards, outwards, vendorMap]);

  // Extract unique styles and PO numbers for dropdown filters
  const uniqueStyles = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => {
      const s = p.styleNo || (p as any).styleNumber;
      if (s) set.add(s.trim());
    });
    return Array.from(set).sort();
  }, [pos]);

  const uniquePoNumbers = useMemo(() => {
    const set = new Set<string>();
    pos.forEach((p) => {
      if (p.poNumber) set.add(p.poNumber.trim());
    });
    return Array.from(set).sort();
  }, [pos]);

  // 1. Basic Filters Application
  const filteredGroups = useMemo(() => {
    return allReconciliationGroups.filter((group) => {
      // Customer Filter
      if (selectedCustomerId !== 'all') {
        const matchesId = group.companyId === selectedCustomerId;
        const custObj = vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
        const matchesName =
          custObj && group.companyName.trim().toLowerCase() === custObj.companyName.trim().toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // Style Filter
      if (selectedStyleNo !== 'all') {
        if (group.styleNo.trim().toLowerCase() !== selectedStyleNo.trim().toLowerCase()) {
          return false;
        }
      }

      // PO Number Filter
      if (selectedPoNumber !== 'all') {
        if (group.poNumber.trim().toLowerCase() !== selectedPoNumber.trim().toLowerCase()) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter === 'reconciled') {
        if (!group.isAllThreeEqual) return false;
      } else if (statusFilter === 'pending_inward') {
        if (group.totalReceiveBalance <= 0) return false;
      } else if (statusFilter === 'pending_dispatch') {
        if (group.totalDispatchBalance <= 0) return false;
      }

      // Date Range Filter
      if (startDate && group.orderDate) {
        if (group.orderDate < startDate) return false;
      }
      if (endDate && group.orderDate) {
        if (group.orderDate > endDate) return false;
      }

      return true;
    });
  }, [allReconciliationGroups, selectedCustomerId, selectedStyleNo, selectedPoNumber, statusFilter, startDate, endDate, vendors]);

  // 2. Flattened rows for Table View & useTableControls
  const flattenedRows: FlattenedStatementRow[] = useMemo(() => {
    return filteredGroups.flatMap((group) => {
      if (group.lines.length === 0) {
        return [
          {
            id: group.id,
            poId: group.poId,
            poNumber: group.poNumber,
            styleNo: group.styleNo,
            itemName: group.itemName,
            companyName: group.companyName,
            colourName: 'Standard',
            process: 'Standard Wash',
            unit: 'piece',
            orderQty: group.totalOrderQty,
            receivedQty: group.totalReceivedQty,
            dispatchQty: group.totalDispatchQty,
            dispatchBalance: group.totalDispatchBalance,
            receiveBalance: group.totalReceiveBalance,
            status: group.isAllThreeEqual ? 'Reconciled' : 'In Progress',
            isAllThreeEqual: group.isAllThreeEqual
          }
        ];
      }

      return group.lines.map((l) => ({
        id: l.id,
        poId: group.poId,
        poNumber: group.poNumber,
        styleNo: group.styleNo,
        itemName: group.itemName,
        companyName: group.companyName,
        colourName: l.colourName,
        process: l.process,
        unit: l.unit,
        orderQty: l.orderQty,
        receivedQty: l.receivedQty,
        dispatchQty: l.dispatchQty,
        dispatchBalance: l.dispatchBalance,
        receiveBalance: l.receiveBalance,
        status: l.isAllThreeEqual ? 'Reconciled' : 'In Progress',
        isAllThreeEqual: l.isAllThreeEqual
      }));
    });
  }, [filteredGroups]);

  // Hook for Full Table Controls (Search, Sort, Inline Column Filters, Reset)
  const tableControls = useTableControls<FlattenedStatementRow>(flattenedRows, {
    columns: STATEMENT_TABLE_COLUMNS,
    defaultSortField: null,
    defaultSortDirection: 'normal'
  });

  // Effective Groups taking tableControls search into account
  const effectiveGroups = useMemo(() => {
    const search = tableControls.searchQuery.trim().toLowerCase();
    const hasColFilters = Object.values(tableControls.columnFilters).some((v) => (v || '').trim() !== '');

    if (!search && !hasColFilters && tableControls.searchColumn === 'ALL') {
      return filteredGroups;
    }

    const matchingRowIds = new Set(tableControls.processedData.map((r) => r.id));
    const matchingPoIds = new Set(tableControls.processedData.map((r) => r.poId));

    return filteredGroups
      .filter((g) => matchingPoIds.has(g.poId))
      .map((g) => {
        const filteredLines = g.lines.filter((l) => matchingRowIds.has(l.id));
        return {
          ...g,
          lines: filteredLines.length > 0 ? filteredLines : g.lines
        };
      });
  }, [filteredGroups, tableControls.processedData, tableControls.searchQuery, tableControls.searchColumn, tableControls.columnFilters]);

  // High-Level Metrics
  const summaryMetrics = useMemo(() => {
    const totalOrders = effectiveGroups.length;
    let totalOrdered = 0;
    let totalInward = 0;
    let totalDispatched = 0;
    let reconciledCount = 0;

    effectiveGroups.forEach((g) => {
      totalOrdered += g.totalOrderQty;
      totalInward += g.totalReceivedQty;
      totalDispatched += g.totalDispatchQty;
      if (g.isAllThreeEqual) reconciledCount++;
    });

    const dispatchBalance = totalInward - totalDispatched;
    const receiveBalance = totalOrdered - totalInward;

    return {
      totalOrders,
      totalOrdered,
      totalInward,
      totalDispatched,
      dispatchBalance,
      receiveBalance,
      reconciledCount
    };
  }, [effectiveGroups]);

  // Preset Date Handlers
  const handleDatePreset = (preset: 'all_time' | 'this_month' | 'last_30_days' | 'this_year') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === 'last_30_days') {
      const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setStartDate(past30);
      setEndDate(todayStr);
    } else if (preset === 'this_year') {
      const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Reset all filters
  const handleMasterReset = () => {
    setSelectedCustomerId('all');
    setSelectedStyleNo('all');
    setSelectedPoNumber('all');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    tableControls.handleResetFilters();
  };

  const hasAnyActiveFilters =
    selectedCustomerId !== 'all' ||
    selectedStyleNo !== 'all' ||
    selectedPoNumber !== 'all' ||
    statusFilter !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    tableControls.isAnyFilterActive;

  // Accordion Expand/Collapse Helpers
  const togglePoExpand = (poId: string) => {
    setExpandedPOs((prev) => ({
      ...prev,
      [poId]: prev[poId] === undefined ? true : !prev[poId] // default open on first click
    }));
  };

  const setAllAccordion = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    effectiveGroups.forEach((g) => {
      newState[g.poId] = expand;
    });
    setExpandedPOs(newState);
  };

  // Export Handlers
  const handleExportPdf = () => {
    if (effectiveGroups.length === 0) {
      alert('No records available to export.');
      return;
    }
    setIsExportingPdf(true);
    try {
      const selectedCustomer = vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
      StatementReportPdfService.downloadStatementReportPdf({
        items: effectiveGroups.map((g) => ({
          companyName: g.companyName,
          poNumber: g.poNumber,
          styleNo: g.styleNo,
          itemName: g.itemName,
          lines: g.lines.map((l) => ({
            colourName: l.colourName,
            process: l.process,
            unit: l.unit,
            orderQty: l.orderQty,
            receivedQty: l.receivedQty,
            dispatchQty: l.dispatchQty,
            dispatchBalance: l.dispatchBalance,
            receiveBalance: l.receiveBalance,
            isAllThreeEqual: l.isAllThreeEqual
          })),
          totalOrderQty: g.totalOrderQty,
          totalReceivedQty: g.totalReceivedQty,
          totalDispatchQty: g.totalDispatchQty,
          totalDispatchBalance: g.totalDispatchBalance,
          totalReceiveBalance: g.totalReceiveBalance,
          isAllThreeEqual: g.isAllThreeEqual
        })),
        customerName: selectedCustomer?.companyName,
        styleNo: selectedStyleNo !== 'all' ? selectedStyleNo : undefined,
        poNumber: selectedPoNumber !== 'all' ? selectedPoNumber : undefined,
        statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
    } catch (err) {
      console.error('Failed to generate Statement PDF:', err);
      alert('Failed to generate Statement PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (effectiveGroups.length === 0) {
      alert('No records available to export.');
      return;
    }
    setIsExportingExcel(true);
    try {
      const selectedCustomer = vendors.find((v) => (v.vendorId || v.id) === selectedCustomerId);
      await StatementReportExcelService.exportToExcel({
        items: effectiveGroups.map((g) => ({
          companyName: g.companyName,
          poNumber: g.poNumber,
          styleNo: g.styleNo,
          itemName: g.itemName,
          lines: g.lines.map((l) => ({
            colourName: l.colourName,
            process: l.process,
            unit: l.unit,
            orderQty: l.orderQty,
            receivedQty: l.receivedQty,
            dispatchQty: l.dispatchQty,
            dispatchBalance: l.dispatchBalance,
            receiveBalance: l.receiveBalance,
            isAllThreeEqual: l.isAllThreeEqual
          })),
          totalOrderQty: g.totalOrderQty,
          totalReceivedQty: g.totalReceivedQty,
          totalDispatchQty: g.totalDispatchQty,
          totalDispatchBalance: g.totalDispatchBalance,
          totalReceiveBalance: g.totalReceiveBalance,
          isAllThreeEqual: g.isAllThreeEqual
        })),
        customerName: selectedCustomer?.companyName,
        styleNo: selectedStyleNo !== 'all' ? selectedStyleNo : undefined,
        poNumber: selectedPoNumber !== 'all' ? selectedPoNumber : undefined,
        statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
    } catch (err) {
      console.error('Failed to export Statement Excel:', err);
      alert('Failed to export Statement Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Purchase Orders</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{summaryMetrics.totalOrders}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Orders in scope</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ordered Qty</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{summaryMetrics.totalOrdered.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total PO commitments</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Received Inward</div>
          <div className="text-xl font-bold text-blue-700 mt-1">{summaryMetrics.totalInward.toLocaleString()}</div>
          <div className="text-[10px] text-blue-500 mt-0.5">Factory receipts</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Dispatched Outward</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{summaryMetrics.totalDispatched.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-500 mt-0.5">Finished dispatches</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Dispatch Balance</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{summaryMetrics.dispatchBalance.toLocaleString()}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Inward pending delivery</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Reconciled Orders</div>
          <div className="text-xl font-bold text-emerald-800 mt-1 flex items-center gap-1.5">
            <span>{summaryMetrics.reconciledCount}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">All 3 quantities equal</div>
        </div>
      </div>

      {/* 2. Basic Filters & Export Actions Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        {/* Top Filter Controls Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1F4E79]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Report Criteria & Filters
            </span>
            {hasAnyActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F4E79]">
                Filtered
              </span>
            )}
          </div>

          {/* Action Buttons: Reset, Refresh, Export PDF, Export Excel */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMasterReset}
              disabled={!hasAnyActiveFilters}
              className="text-xs flex items-center gap-1.5"
              title="Reset all criteria and table filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={reloadData}
              disabled={isLoadingData}
              className="text-xs flex items-center gap-1.5"
              title="Reload live database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <PdfExportButton
              size="sm"
              onClick={handleExportPdf}
              loading={isExportingPdf}
              disabled={effectiveGroups.length === 0}
              label="Download PDF"
            />

            <ExcelExportButton
              size="sm"
              onClick={handleExportExcel}
              loading={isExportingExcel}
              disabled={effectiveGroups.length === 0}
              label="Export Excel"
            />
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Customer Dropdown */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Customer / Company
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Companies</option>
              {customerList.map((c) => (
                <option key={c.id || c.vendorId} value={c.id || c.vendorId}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Style No Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Style Number
            </label>
            <select
              value={selectedStyleNo}
              onChange={(e) => setSelectedStyleNo(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Styles</option>
              {uniqueStyles.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* PO Number Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Purchase Order
            </label>
            <select
              value={selectedPoNumber}
              onChange={(e) => setSelectedPoNumber(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All PO Numbers</option>
              {uniquePoNumbers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Reconciliation Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="reconciled">Fully Reconciled (Equal)</option>
              <option value="pending_inward">Pending Inward (Receive Bal &gt; 0)</option>
              <option value="pending_dispatch">Pending Dispatch (Dispatch Bal &gt; 0)</option>
            </select>
          </div>
        </div>

        {/* Date Presets and Pickers */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Date Presets:</span>
            <button
              type="button"
              onClick={() => handleDatePreset('all_time')}
              className={`px-2.5 py-1 text-xs rounded-md border font-medium cursor-pointer transition ${!startDate && !endDate
                ? 'bg-[#1F4E79] text-white border-[#1F4E79]'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('this_month')}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('last_30_days')}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset('this_year')}
              className="px-2.5 py-1 text-xs rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-medium cursor-pointer"
            >
              This Year
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Table Header Controls (Search, View Mode Switcher, Column Filters Toggle) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar with Column Picker */}
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <select
              value={tableControls.searchColumn}
              onChange={(e) => tableControls.setSearchColumn(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-700 shrink-0 cursor-pointer"
            >
              <option value="ALL">All Columns</option>
              <option value="companyName">Company</option>
              <option value="styleNo">Style No</option>
              <option value="poNumber">PO Number</option>
              <option value="colourName">Colour</option>
              <option value="process">Wash / Process</option>
            </select>

            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableControls.searchQuery}
                onChange={(e) => tableControls.setSearchQuery(e.target.value)}
                placeholder="Search by company, style, PO #, colour, process..."
                className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              />
              {tableControls.searchQuery && (
                <button
                  type="button"
                  onClick={() => tableControls.setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Column Filters Toggle Button - Placed Next to Search Bar */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (viewMode !== 'table') {
                  setViewMode('table');
                }
                tableControls.setShowColumnFilters(!tableControls.showColumnFilters);
              }}
              className={`text-xs flex items-center gap-1.5 whitespace-nowrap py-2 ${
                tableControls.showColumnFilters
                  ? 'bg-blue-50 text-[#1F4E79] border-blue-300 font-bold'
                  : 'text-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Column Filters
              {Object.values(tableControls.columnFilters).filter((v) => (v || '').trim() !== '').length > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              )}
            </Button>
          </div>

          {/* Right controls: View mode */}
          <div className="flex items-center gap-2 flex-wrap justify-between md:justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#1F4E79]" />
                <span>Grouped (Subrows)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Boxes className="w-3.5 h-3.5 text-[#1F4E79]" />
                <span>Detailed Table</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table Representation */}
      {isLoadingData ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="w-8 h-8 border-3 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-semibold">
            Reconciling purchase orders, inward receipts, and outward dispatches...
          </p>
        </div>
      ) : effectiveGroups.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Orders Found Matching Criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search query, customer filter, or date presets to see reconciliation records.
          </p>
          <Button variant="outline" size="sm" onClick={handleMasterReset} className="text-xs mt-2">
            Reset Filters
          </Button>
        </div>
      ) : viewMode === 'grouped' ? (
        /* ================= VIEW 1: GROUPED ACCORDION WITH SUBROWS ================= */
        <div className="space-y-4">
          {/* Group controls */}
          <div className="flex justify-between items-center text-xs text-slate-500 px-1">
            <span>
              Showing <strong>{effectiveGroups.length}</strong> purchase orders
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAllAccordion(true)}
                className="hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                Expand All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setAllAccordion(false)}
                className="hover:text-slate-900 font-semibold underline cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {effectiveGroups.map((group) => {
            const isExpanded = expandedPOs[group.poId] !== false; // default open
            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* PO Main Row Header */}
                <div
                  onClick={() => togglePoExpand(group.poId)}
                  className="p-3.5 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 cursor-pointer flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 transition"
                >
                  {/* Left: Company & Style & PO Info */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">{group.companyName}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#1F4E79] text-white">
                          PO #{group.poNumber}
                        </span>
                        {group.styleNo && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-800">
                            Style: {group.styleNo}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {group.lines.length} Colours
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Item: <span className="font-semibold text-slate-700">{group.itemName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subrows: Colours Table for this PO */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse border border-slate-300">
                      <thead
                        className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px] tracking-wider border-b border-slate-300"
                        style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                      >
                        <tr>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 pl-6 border border-slate-300 text-left whitespace-nowrap">Colour Name</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-left whitespace-nowrap">Wash / Process</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap">Order Qty</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap">Received Qty (Inward)</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap">Dispatch Qty</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap">Dispatch Balance</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-right whitespace-nowrap">Receive Balance</th>
                          <th style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }} className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Reconciliation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {group.lines.map((line) => (
                          <tr
                            key={line.id}
                            className={`hover:bg-blue-50/40 transition-colors ${
                              line.isAllThreeEqual ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 pl-6 border border-slate-200 font-bold text-slate-800 text-left whitespace-nowrap flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#1F4E79]"></span>
                              <span>{line.colourName}</span>
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-slate-600 font-medium text-left whitespace-nowrap">
                              {line.process}
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-center uppercase font-bold text-[10px] text-slate-500 whitespace-nowrap">
                              {line.unit}
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                              {line.orderQty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-right font-bold text-blue-700 tabular-nums whitespace-nowrap">
                              {line.receivedQty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                              {line.dispatchQty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-right font-bold tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  line.dispatchBalance === 0
                                    ? 'text-emerald-700 font-bold'
                                    : 'text-amber-700 font-bold'
                                }
                              >
                                {line.dispatchBalance.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-right font-bold tabular-nums whitespace-nowrap">
                              <span
                                className={
                                  line.receiveBalance === 0
                                    ? 'text-emerald-700 font-bold'
                                    : 'text-orange-700 font-bold'
                                }
                              >
                                {line.receiveBalance.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 border border-slate-200 text-center whitespace-nowrap">
                              {line.isAllThreeEqual ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Equal ({line.orderQty} / {line.receivedQty} / {line.dispatchQty})
                                </span>
                              ) : line.dispatchBalance === 0 && line.receiveBalance === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Completed
                                </span>
                              ) : line.dispatchBalance > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending Dispatch ({line.dispatchBalance})
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                  Pending Inward ({line.receiveBalance})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= VIEW 2: DETAILED FLAT TABLE WITH SORTING & FILTERS ================= */
        <div className="bg-white rounded-xl border border-slate-300 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead
                className="select-none bg-[#EEF5FB] text-[#1F4E79] font-bold text-[11px] uppercase tracking-wider border-b-2 border-slate-300"
                style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
              >
                {/* Row 1: Header Titles with 3-State Sort */}
                <tr
                  className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[11px] tracking-wider border-b border-slate-300"
                  style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                >
                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('companyName')}
                    className="p-2.5 border border-slate-300 text-left min-w-[170px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-start gap-1.5">
                      <span>Company Name</span>
                      {tableControls.renderSortIcon('companyName')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('styleNo')}
                    className="p-2.5 border border-slate-300 text-left min-w-[130px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-start gap-1.5">
                      <span>Style No</span>
                      {tableControls.renderSortIcon('styleNo')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('poNumber')}
                    className="p-2.5 border border-slate-300 text-center min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>PO Number</span>
                      {tableControls.renderSortIcon('poNumber')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('colourName')}
                    className="p-2.5 border border-slate-300 text-left min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-start gap-1.5">
                      <span>Colour</span>
                      {tableControls.renderSortIcon('colourName')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('process')}
                    className="p-2.5 border border-slate-300 text-left min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-start gap-1.5">
                      <span>Wash / Process</span>
                      {tableControls.renderSortIcon('process')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('orderQty')}
                    className="p-2.5 border border-slate-300 text-right min-w-[95px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Order Qty</span>
                      {tableControls.renderSortIcon('orderQty')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('receivedQty')}
                    className="p-2.5 border border-slate-300 text-right min-w-[110px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Received Qty</span>
                      {tableControls.renderSortIcon('receivedQty')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('dispatchQty')}
                    className="p-2.5 border border-slate-300 text-right min-w-[105px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Dispatch Qty</span>
                      {tableControls.renderSortIcon('dispatchQty')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('dispatchBalance')}
                    className="p-2.5 border border-slate-300 text-right min-w-[105px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Dispatch Bal</span>
                      {tableControls.renderSortIcon('dispatchBalance')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    onClick={() => tableControls.handleSort('receiveBalance')}
                    className="p-2.5 border border-slate-300 text-right min-w-[105px] whitespace-nowrap cursor-pointer hover:bg-[#DCEBF8] transition"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Receive Bal</span>
                      {tableControls.renderSortIcon('receiveBalance')}
                    </div>
                  </th>

                  <th
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    className="p-2.5 border border-slate-300 text-center min-w-[140px] whitespace-nowrap"
                  >
                    Status
                  </th>
                </tr>

                {/* Row 2: In-Table Column Filter Row inside <thead> */}
                {tableControls.showColumnFilters && (
                  <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                    {/* 1. Company Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Filter company..."
                          value={tableControls.columnFilters['companyName'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              companyName: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                        />
                        {tableControls.columnFilters['companyName'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['companyName'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 2. Style No Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Filter style..."
                          value={tableControls.columnFilters['styleNo'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              styleNo: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                        />
                        {tableControls.columnFilters['styleNo'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['styleNo'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 3. PO Number Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Filter PO..."
                          value={tableControls.columnFilters['poNumber'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              poNumber: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                        />
                        {tableControls.columnFilters['poNumber'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['poNumber'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 4. Colour Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Filter colour..."
                          value={tableControls.columnFilters['colourName'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              colourName: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                        />
                        {tableControls.columnFilters['colourName'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['colourName'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 5. Wash / Process Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Filter process..."
                          value={tableControls.columnFilters['process'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              process: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-left"
                        />
                        {tableControls.columnFilters['process'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['process'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 6. Order Qty Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Qty..."
                          value={tableControls.columnFilters['orderQty'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              orderQty: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right tabular-nums"
                        />
                        {tableControls.columnFilters['orderQty'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['orderQty'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 7. Received Qty (Inward) Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Inward..."
                          value={tableControls.columnFilters['receivedQty'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              receivedQty: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right tabular-nums"
                        />
                        {tableControls.columnFilters['receivedQty'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['receivedQty'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 8. Dispatch Qty Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Dispatch..."
                          value={tableControls.columnFilters['dispatchQty'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              dispatchQty: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right tabular-nums"
                        />
                        {tableControls.columnFilters['dispatchQty'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['dispatchQty'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 9. Dispatch Balance Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Disp Bal..."
                          value={tableControls.columnFilters['dispatchBalance'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              dispatchBalance: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right tabular-nums"
                        />
                        {tableControls.columnFilters['dispatchBalance'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['dispatchBalance'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 10. Receive Balance Filter */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Recv Bal..."
                          value={tableControls.columnFilters['receiveBalance'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              receiveBalance: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-right tabular-nums"
                        />
                        {tableControls.columnFilters['receiveBalance'] && (
                          <button
                            type="button"
                            onClick={() =>
                              tableControls.setColumnFilters((prev) => {
                                const next = { ...prev };
                                delete next['receiveBalance'];
                                return next;
                              })
                            }
                            className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Clear filter"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>

                    {/* 11. Status Filter & Master Clear Action */}
                    <th className="p-1.5 border border-slate-300 bg-slate-100 font-normal text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          placeholder="Status..."
                          value={tableControls.columnFilters['status'] || ''}
                          onChange={(e) =>
                            tableControls.setColumnFilters((prev) => ({
                              ...prev,
                              status: e.target.value
                            }))
                          }
                          className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                        />
                        {Object.values(tableControls.columnFilters).some((v) => (v || '').trim() !== '') && (
                          <button
                            type="button"
                            onClick={() => tableControls.setColumnFilters({})}
                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded cursor-pointer transition shrink-0"
                            title="Clear all column filters"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-200">
                {tableControls.processedData.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-blue-50/40 transition-colors ${
                      row.isAllThreeEqual ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <td className="p-2.5 border border-slate-200 font-semibold text-slate-900 text-left whitespace-nowrap">
                      {row.companyName}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-slate-700 font-medium text-left whitespace-nowrap">
                      {row.styleNo}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {row.poNumber}
                      </span>
                    </td>
                    <td className="p-2.5 border border-slate-200 font-bold text-slate-800 text-left whitespace-nowrap">
                      {row.colourName}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-slate-600 text-left whitespace-nowrap">
                      {row.process}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                      {row.orderQty.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-bold text-blue-700 tabular-nums whitespace-nowrap">
                      {row.receivedQty.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                      {row.dispatchQty.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-bold tabular-nums whitespace-nowrap">
                      <span className={row.dispatchBalance === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                        {row.dispatchBalance.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-bold tabular-nums whitespace-nowrap">
                      <span className={row.receiveBalance === 0 ? 'text-emerald-700' : 'text-orange-700'}>
                        {row.receiveBalance.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                      {row.isAllThreeEqual ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Equal ({row.orderQty} / {row.receivedQty} / {row.dispatchQty})
                        </span>
                      ) : row.dispatchBalance === 0 && row.receiveBalance === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Completed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          In Progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Grand Total Footer */}
              <tfoot
                className="bg-[#EEF5FB] font-bold border-t-2 border-slate-400 text-[#1F4E79]"
                style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
              >
                <tr>
                  <td
                    colSpan={5}
                    style={{ backgroundColor: '#EEF5FB', color: '#1F4E79' }}
                    className="p-2.5 border border-slate-300 text-center uppercase tracking-wider text-xs whitespace-nowrap"
                  >
                    Grand Totals ({tableControls.processedData.length} Lines)
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-right text-slate-900 tabular-nums whitespace-nowrap"
                  >
                    {tableControls.processedData.reduce((s, r) => s + r.orderQty, 0).toLocaleString()}
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-right text-blue-700 tabular-nums whitespace-nowrap"
                  >
                    {tableControls.processedData.reduce((s, r) => s + r.receivedQty, 0).toLocaleString()}
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-right text-emerald-700 tabular-nums whitespace-nowrap"
                  >
                    {tableControls.processedData.reduce((s, r) => s + r.dispatchQty, 0).toLocaleString()}
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-right text-amber-700 tabular-nums whitespace-nowrap"
                  >
                    {tableControls.processedData.reduce((s, r) => s + r.dispatchBalance, 0).toLocaleString()}
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-right text-orange-700 tabular-nums whitespace-nowrap"
                  >
                    {tableControls.processedData.reduce((s, r) => s + r.receiveBalance, 0).toLocaleString()}
                  </td>
                  <td
                    style={{ backgroundColor: '#EEF5FB' }}
                    className="p-2.5 border border-slate-300 text-center whitespace-nowrap"
                  >
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800">
                      Summary
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
