import React, { useState, useMemo } from 'react';
import { OutwardEntry, OutwardFilterOptions, OutwardPagination } from '../../../types/outward';
import { Vendor } from '../../../types/vendor';
import { PurchaseOrder } from '../../../types/po';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import { Search, Filter, Plus, ArrowUp, ArrowDown, ArrowUpDown, Lock, Download, FileText, Layers, Check, ChevronRight, Package, ChevronDown, ChevronUp, X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { POLockStatus, POLockService } from '../../../services/poLockService';
import { InwardEntry } from '../../../types/inward';
import { DeliveryChallanPdfService } from '../../../services/deliveryChallanPdfService';
import { JoinedDcModal } from './JoinedDcModal';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../../components/ui/TableMaximizeWrapper';

export type OutwardSortField =
  | 'outwardNo'
  | 'outwardDate'
  | 'ourDcNo'
  | 'customerName'
  | 'poNumber'
  | 'poQty'
  | 'totalInward'
  | 'prevDispatched'
  | 'thisDispatch'
  | 'balanceAfter'
  | 'status';

export type SortDirection = 'asc' | 'desc' | null;

interface OutwardListProps {
  outwards: OutwardEntry[];
  vendors: Vendor[];
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  pagination: OutwardPagination;
  filters: OutwardFilterOptions;
  onFilterChange: (filters: OutwardFilterOptions) => void;
  onPageChange: (page: number) => void;
  onNewOutward: () => void;
  onSelectPoForOutward?: (po: PurchaseOrder) => void;
  onViewDetails: (outwardId: string) => void;
  onPrint: (outwardId: string) => void;
  onEdit: (outwardId: string) => void;
  onDelete: (outwardId: string) => void;
  onReverse: (outwardId: string) => void;
  canManage: boolean;
  isAdmin: boolean;
  isLoading?: boolean;
  lockedPOMap?: Record<string, POLockStatus>;
}

export const OutwardList: React.FC<OutwardListProps> = ({
  outwards,
  vendors,
  pos = [],
  inwards = [],
  pagination,
  filters,
  onFilterChange,
  onPageChange,
  onNewOutward,
  onSelectPoForOutward,
  onViewDetails,
  onPrint,
  onEdit,
  onDelete,
  onReverse,
  canManage,
  isAdmin,
  isLoading,
  lockedPOMap = {}
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickOutwardCards, setShowQuickOutwardCards] = useState(false);
  const [deleteTargetOutward, setDeleteTargetOutward] = useState<OutwardEntry | null>(null);

  // Floating hover popover state for Company and PO Number
  const [hoverCard, setHoverCard] = useState<{
    type: 'company' | 'po';
    row: OutwardEntry;
    top?: number;
    bottom?: number;
    left: number;
  } | null>(null);

  // 3-State Column Sorting (asc -> desc -> unsort/desort)
  const [sortField, setSortField] = useState<OutwardSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Column search & filter state
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const OUTWARD_SEARCH_COLUMNS = [
    { value: 'ALL', label: 'All Columns' },
    { value: 'outwardNo', label: 'Outward No' },
    { value: 'outwardDate', label: 'Dispatch Date' },
    { value: 'ourDcNo', label: 'Our DC Number' },
    { value: 'customerName', label: 'Customer' },
    { value: 'poNumber', label: 'PO & Style' },
    { value: 'poQty', label: 'PO Qty' },
    { value: 'totalInward', label: 'Total Inward' },
    { value: 'prevDispatched', label: 'Prev Dispatched' },
    { value: 'thisDispatch', label: 'This DC Dispatch' },
    { value: 'balanceAfter', label: 'Balance After' },
    { value: 'status', label: 'Status' }
  ];

  // Joined DC Selection States
  const [isJoiningMode, setIsJoiningMode] = useState(false);
  const [selectedOutwardIds, setSelectedOutwardIds] = useState<string[]>([]);
  const [isJoinedDcModalOpen, setIsJoinedDcModalOpen] = useState(false);

  // Selected Outward records
  const selectedOutwards = useMemo(() => {
    return outwards.filter((o) => {
      const id = o.outwardId || o.id;
      return selectedOutwardIds.includes(id);
    });
  }, [outwards, selectedOutwardIds]);

  // Target PO & Style constraint: All joined dispatches must share the same PO and Style
  const targetPoAndStyle = useMemo(() => {
    if (selectedOutwards.length === 0) return null;
    const first = selectedOutwards[0];
    const po = (first.poId || first.poNumberSnapshot || first.poNumber || '').trim().toLowerCase();
    const style = (first.styleNoSnapshot || first.styleNo || '').trim().toLowerCase();
    const displayPo = first.poNumberSnapshot || first.poNumber || first.poId || 'PO';
    const displayStyle = first.styleNoSnapshot || first.styleNo || 'Style';
    return { po, style, displayPo, displayStyle };
  }, [selectedOutwards]);

  const isRowSelectable = (row: OutwardEntry) => {
    if (!targetPoAndStyle) return true;
    const rowPo = (row.poId || row.poNumberSnapshot || row.poNumber || '').trim().toLowerCase();
    const rowStyle = (row.styleNoSnapshot || row.styleNo || '').trim().toLowerCase();
    return rowPo === targetPoAndStyle.po && rowStyle === targetPoAndStyle.style;
  };

  const handleToggleSelectRow = (rowId: string) => {
    setSelectedOutwardIds((prev) => {
      if (prev.includes(rowId)) {
        return prev.filter((id) => id !== rowId);
      } else {
        return [...prev, rowId];
      }
    });
  };

  const handleSort = (field: OutwardSortField) => {
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

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    type: 'company' | 'po',
    row: OutwardEntry
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const popoverWidth = 320;
    const popoverEstimatedHeight = 260;
    const showAbove = rect.bottom + popoverEstimatedHeight > window.innerHeight;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - popoverWidth - 16);

    if (showAbove) {
      setHoverCard({
        type,
        row,
        bottom: window.innerHeight - rect.top + 6,
        left
      });
    } else {
      setHoverCard({
        type,
        row,
        top: rect.bottom + 6,
        left
      });
    }
  };

  const handleMouseLeave = () => {
    setHoverCard(null);
  };

  const customers = vendors.filter((v) => v.vendorType === 'customer' || v.vendorType === 'both');

  const handleSearchChange = (val: string) => {
    onFilterChange({ ...filters, searchQuery: val });
  };

  const handleStatusChange = (val: string) => {
    onFilterChange({ ...filters, status: val as any });
  };

  const handleCustomerChange = (val: string) => {
    onFilterChange({ ...filters, customerId: val === 'all' ? undefined : val });
  };

  const handleClearFilters = () => {
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection(null);
    onFilterChange({
      searchQuery: '',
      status: 'all',
      customerId: undefined,
      dateFrom: undefined,
      dateTo: undefined
    });
  };

  const hasActiveFilters =
    Boolean(filters.searchQuery) ||
    (filters.status && filters.status !== 'all') ||
    Boolean(filters.customerId) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    searchColumn !== 'ALL' ||
    Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
    Boolean(sortField);

  // Helper to summarize quantities by unit
  const getQuantitySummaries = (row: OutwardEntry) => {
    const lines = row.lines || [];
    let pieceOrdered = 0;
    let pieceInward = 0;
    let piecePrevOutward = 0;
    let pieceDispatched = 0;
    let pieceRemaining = 0;

    let kgOrdered = 0;
    let kgInward = 0;
    let kgPrevOutward = 0;
    let kgDispatched = 0;
    let kgRemaining = 0;

    for (const l of lines) {
      const u = l.unit === 'kg' ? 'kg' : 'piece';
      const ord = Number(l.orderedQtySnapshot) || 0;
      const inw = Number(l.cumulativeInwardQtySnapshot) || 0;
      const prev = Number(l.previouslyDispatchedQtySnapshot) || 0;
      const disp = Number(l.dispatchQty) || 0;
      const rem =
        Number(l.remainingAfterDispatchSnapshot) !== undefined
          ? Number(l.remainingAfterDispatchSnapshot)
          : Math.max(0, inw - (prev + disp));

      if (u === 'kg') {
        kgOrdered += ord;
        kgInward += inw;
        kgPrevOutward += prev;
        kgDispatched += disp;
        kgRemaining += rem;
      } else {
        pieceOrdered += ord;
        pieceInward += inw;
        piecePrevOutward += prev;
        pieceDispatched += disp;
        pieceRemaining += rem;
      }
    }

    return {
      ordered: { piece: pieceOrdered, kg: Math.round(kgOrdered * 100) / 100 },
      inward: { piece: pieceInward, kg: Math.round(kgInward * 100) / 100 },
      prevOutward: { piece: piecePrevOutward, kg: Math.round(kgPrevOutward * 100) / 100 },
      dispatched: { piece: pieceDispatched, kg: Math.round(kgDispatched * 100) / 100 },
      remaining: { piece: pieceRemaining, kg: Math.round(kgRemaining * 100) / 100 }
    };
  };

  const renderUnitQty = (
    data: { piece: number; kg: number },
    colorClass: string = 'text-slate-700'
  ) => {
    const parts = [];
    if (data.piece > 0 || data.kg === 0) {
      parts.push(
        <span key="pc" className="font-medium">
          {data.piece.toLocaleString()}{' '}
          <span className="text-[10px] text-slate-400 font-normal">pcs</span>
        </span>
      );
    }
    if (data.kg > 0) {
      parts.push(
        <span key="kg" className="font-medium text-amber-700">
          {data.kg.toLocaleString()}{' '}
          <span className="text-[10px] text-amber-500 font-normal">kg</span>
        </span>
      );
    }
    return <div className={`flex flex-col items-end gap-0.5 text-xs ${colorClass}`}>{parts}</div>;
  };

  // Client-side filtering for column selector & inline column filters
  const filteredOutwards = useMemo(() => {
    return outwards.filter((row) => {
      const q = getQuantitySummaries(row);

      // 1. Column-specific search if searchColumn !== 'ALL'
      const query = (filters.searchQuery || '').trim().toLowerCase();
      if (query && searchColumn !== 'ALL') {
        let val = '';
        switch (searchColumn) {
          case 'outwardNo':
            val = row.outwardNo || row.entryId || '';
            break;
          case 'outwardDate':
            val = row.outwardDate || '';
            break;
          case 'ourDcNo':
            val = row.ourDcNo || '';
            break;
          case 'customerName':
            val = row.customerCompanyNameSnapshot || row.customerName || '';
            break;
          case 'poNumber':
            val = `${row.poNumberSnapshot || row.poNumber || ''} ${row.styleNoSnapshot || row.styleNo || ''}`;
            break;
          case 'poQty':
            val = `${q.ordered.piece} ${q.ordered.kg}`;
            break;
          case 'totalInward':
            val = `${q.inward.piece} ${q.inward.kg}`;
            break;
          case 'prevDispatched':
            val = `${q.prevOutward.piece} ${q.prevOutward.kg}`;
            break;
          case 'thisDispatch':
            val = `${q.dispatched.piece} ${q.dispatched.kg} ${row.totalQuantity || ''}`;
            break;
          case 'balanceAfter':
            val = `${q.remaining.piece} ${q.remaining.kg}`;
            break;
          case 'status':
            val = row.status || '';
            break;
        }
        if (!val.toLowerCase().includes(query)) return false;
      }

      // 2. Inline column filters
      for (const [colKey, rawVal] of Object.entries(columnFilters)) {
        const needle = (rawVal || '').trim().toLowerCase();
        if (!needle) continue;

        let haystack = '';
        switch (colKey) {
          case 'outwardNo':
            haystack = row.outwardNo || row.entryId || '';
            break;
          case 'outwardDate':
            haystack = row.outwardDate || '';
            break;
          case 'ourDcNo':
            haystack = row.ourDcNo || '';
            break;
          case 'customerName':
            haystack = row.customerCompanyNameSnapshot || row.customerName || '';
            break;
          case 'poNumber':
            haystack = `${row.poNumberSnapshot || row.poNumber || ''} ${row.styleNoSnapshot || row.styleNo || ''}`;
            break;
          case 'poQty':
            haystack = `${q.ordered.piece} ${q.ordered.kg}`;
            break;
          case 'totalInward':
            haystack = `${q.inward.piece} ${q.inward.kg}`;
            break;
          case 'prevDispatched':
            haystack = `${q.prevOutward.piece} ${q.prevOutward.kg}`;
            break;
          case 'thisDispatch':
            haystack = `${q.dispatched.piece} ${q.dispatched.kg} ${row.totalQuantity || ''}`;
            break;
          case 'balanceAfter':
            haystack = `${q.remaining.piece} ${q.remaining.kg}`;
            break;
          case 'status':
            haystack = row.status || '';
            break;
        }

        if (!haystack.toLowerCase().includes(needle)) {
          return false;
        }
      }

      return true;
    });
  }, [outwards, filters.searchQuery, searchColumn, columnFilters]);

  const sortedOutwards = useMemo(() => {
    if (!sortField || !sortDirection) {
      // Default: Most recent entry first based on timestamp
      return [...filteredOutwards].sort((a, b) => {
        const timeA = new Date((a as any).outwardTime || a.createdAt || a.updatedAt || a.outwardDate || 0).getTime();
        const timeB = new Date((b as any).outwardTime || b.createdAt || b.updatedAt || b.outwardDate || 0).getTime();
        return timeB - timeA;
      });
    }

    const mult = sortDirection === 'desc' ? -1 : 1;
    return [...filteredOutwards].sort((a, b) => {
      const qA = getQuantitySummaries(a);
      const qB = getQuantitySummaries(b);

      switch (sortField) {
        case 'outwardNo':
          return (
            (a.outwardNo || a.entryId || '').localeCompare(b.outwardNo || b.entryId || '', undefined, {
              numeric: true,
              sensitivity: 'base'
            }) * mult
          );
        case 'outwardDate': {
          const dateA = a.outwardDate ? new Date(a.outwardDate).getTime() : 0;
          const dateB = b.outwardDate ? new Date(b.outwardDate).getTime() : 0;
          return (dateA - dateB) * mult;
        }
        case 'ourDcNo':
          return (a.ourDcNo || '').localeCompare(b.ourDcNo || '', undefined, {
            numeric: true,
            sensitivity: 'base'
          }) * mult;
        case 'customerName': {
          const nameA = a.customerCompanyNameSnapshot || a.customerName || '';
          const nameB = b.customerCompanyNameSnapshot || b.customerName || '';
          return nameA.localeCompare(nameB) * mult;
        }
        case 'poNumber': {
          const poA = `${a.poNumberSnapshot || a.poNumber || ''} ${a.styleNoSnapshot || a.styleNo || ''}`;
          const poB = `${b.poNumberSnapshot || b.poNumber || ''} ${b.styleNoSnapshot || b.styleNo || ''}`;
          return poA.localeCompare(poB, undefined, { numeric: true, sensitivity: 'base' }) * mult;
        }
        case 'poQty': {
          const totA = qA.ordered.piece + qA.ordered.kg;
          const totB = qB.ordered.piece + qB.ordered.kg;
          return (totA - totB) * mult;
        }
        case 'totalInward': {
          const totA = qA.inward.piece + qA.inward.kg;
          const totB = qB.inward.piece + qB.inward.kg;
          return (totA - totB) * mult;
        }
        case 'prevDispatched': {
          const totA = qA.prevOutward.piece + qA.prevOutward.kg;
          const totB = qB.prevOutward.piece + qB.prevOutward.kg;
          return (totA - totB) * mult;
        }
        case 'thisDispatch': {
          const totA = qA.dispatched.piece + qA.dispatched.kg || Number(a.totalQuantity) || 0;
          const totB = qB.dispatched.piece + qB.dispatched.kg || Number(b.totalQuantity) || 0;
          return (totA - totB) * mult;
        }
        case 'balanceAfter': {
          const totA = qA.remaining.piece + qA.remaining.kg;
          const totB = qB.remaining.piece + qB.remaining.kg;
          return (totA - totB) * mult;
        }
        case 'status':
          return (a.status || '').localeCompare(b.status || '') * mult;
        default:
          return 0;
      }
    });
  }, [filteredOutwards, sortField, sortDirection]);

  // Grand totals for sticky footer
  const outwardTotals = useMemo(() => {
    return sortedOutwards.reduce(
      (acc, row) => {
        const q = getQuantitySummaries(row);
        acc.ordered.piece += q.ordered.piece;
        acc.ordered.kg += q.ordered.kg;
        acc.inward.piece += q.inward.piece;
        acc.inward.kg += q.inward.kg;
        acc.prevOutward.piece += q.prevOutward.piece;
        acc.prevOutward.kg += q.prevOutward.kg;
        acc.dispatched.piece += (q.dispatched.piece || (!q.dispatched.kg ? Number(row.totalQuantity) || 0 : 0));
        acc.dispatched.kg += q.dispatched.kg;
        acc.balance.piece += q.remaining.piece;
        acc.balance.kg += q.remaining.kg;
        return acc;
      },
      {
        ordered: { piece: 0, kg: 0 },
        inward: { piece: 0, kg: 0 },
        prevOutward: { piece: 0, kg: 0 },
        dispatched: { piece: 0, kg: 0 },
        balance: { piece: 0, kg: 0 }
      }
    );
  }, [sortedOutwards]);

  const renderSortIcon = (field: OutwardSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        return (
          <span className="p-0.5 rounded bg-blue-200/80 text-[#1F4E79] shadow-2xs">
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      }
      if (sortDirection === 'desc') {
        return (
          <span className="p-0.5 rounded bg-blue-200/80 text-[#1F4E79] shadow-2xs">
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

  const getSortTooltip = (field: OutwardSortField, label: string) => {
    if (sortField !== field || !sortDirection) {
      return `Click to sort ${label} ascending`;
    }
    if (sortDirection === 'asc') {
      return `Currently sorted ascending. Click to sort descending`;
    }
    return `Currently sorted descending. Click to desort`;
  };

  const getSortColumnLabel = (field: OutwardSortField) => {
    switch (field) {
      case 'outwardNo':
        return 'Outward No';
      case 'outwardDate':
        return 'Dispatch Date';
      case 'ourDcNo':
        return 'Our DC Number';
      case 'customerName':
        return 'Customer / Company';
      case 'poNumber':
        return 'PO & Style';
      case 'poQty':
        return 'PO Qty';
      case 'totalInward':
        return 'Total Inward';
      case 'prevDispatched':
        return 'Prev Dispatched';
      case 'thisDispatch':
        return 'This DC Dispatch';
      case 'balanceAfter':
        return 'Balance After';
      case 'status':
        return 'Status';
      default:
        return '';
    }
  };

  // Map vendor ID/Code to Vendor for display in cards
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => {
      if (v.id) map.set(v.id, v);
      if (v.vendorId) map.set(v.vendorId, v);
    });
    return map;
  }, [vendors]);

  // Combined list of POs: includes all POs from props plus any POs referenced in posted inward receipts
  const allPosWithInwardSources = useMemo(() => {
    const list = [...pos];
    const seenIds = new Set(list.map((p) => p.id).concat(list.map((p) => p.poId || '')));
    const seenNums = new Set(list.map((p) => p.poNumber?.trim().toLowerCase()).filter(Boolean));

    for (const inw of inwards || []) {
      if (inw.status !== 'posted') continue;
      const poNumKey = (inw.poNumber || inw.poNumberSnapshot || '').trim().toLowerCase();
      const poIdKey = inw.poId;
      if (poIdKey && !seenIds.has(poIdKey) && (!poNumKey || !seenNums.has(poNumKey))) {
        list.push({
          id: inw.poId,
          poId: inw.poId,
          poNumber: inw.poNumber || inw.poNumberSnapshot || 'PO-RECORD',
          customerId: inw.customerId || inw.customerVendorId || 'cust-default',
          customerVendorId: inw.customerVendorId || inw.customerId || 'cust-default',
          customerName: inw.customerName || inw.customerCompanyNameSnapshot || 'Customer Company',
          customerCompanyNameSnapshot: inw.customerCompanyNameSnapshot || inw.customerName || 'Customer Company',
          styleNo: inw.styleNo || inw.styleNoSnapshot || 'N/A',
          itemName: inw.itemName || inw.itemNameSnapshot || 'Garments',
          processCategory: inw.processCategory || inw.processCategorySnapshot || 'washing',
          status: 'partially_received',
          orderDate: inw.customerDate || inw.inwardDate,
          totalQuantity: inw.totalQuantity || 0,
          totalQtyByUnit: inw.totalQtyByUnit || { piece: inw.totalQuantity || 0, kg: 0 },
          lines: [],
          colourLines: [],
          schemaVersion: 1
        } as unknown as PurchaseOrder);
        seenIds.add(poIdKey);
        if (poNumKey) seenNums.add(poNumKey);
      }
    }
    return list;
  }, [pos, inwards]);

  // Compute PO stats for eligible Outward cards
  const eligiblePoCards = useMemo(() => {
    const postedInwards = (inwards || []).filter((inw) => (inw.status || '').toLowerCase() === 'posted');
    const postedOutwards = (outwards || []).filter((outw) => (outw.status || '').toLowerCase() === 'posted');

    return allPosWithInwardSources
      .filter((p) => {
        const s = (p.status || '').toLowerCase();
        return s !== 'cancelled' && s !== 'rejected';
      })
      .map((po) => {
        const poId = po.id || po.poId;
        const poNumber = (po.poNumber || '').trim().toLowerCase();

        const matchingInwards = postedInwards.filter(
          (inw) =>
            (poId && (inw.poId === poId || inw.id === poId)) ||
            (poNumber && (inw.poNumber || inw.poNumberSnapshot || '').trim().toLowerCase() === poNumber)
        );

        const matchingOutwards = postedOutwards.filter(
          (outw) =>
            (poId && (outw.poId === poId || outw.id === poId)) ||
            (poNumber && (outw.poNumber || outw.poNumberSnapshot || '').trim().toLowerCase() === poNumber)
        );

        const poLines = po.colourLines || po.lines || [];
        let orderedPieces = 0;
        let orderedKg = 0;

        if (po.totalQtyByUnit) {
          orderedPieces = Number(po.totalQtyByUnit.piece || 0);
          orderedKg = Number(po.totalQtyByUnit.kg || 0);
        } else if (poLines.length > 0) {
          poLines.forEach((l) => {
            const u = (l.unit || '').toLowerCase();
            const q = Number(l.quantity || 0);
            if (u === 'kg') orderedKg += q;
            else orderedPieces += q;
          });
        } else {
          orderedPieces = Number(po.totalQuantity || 0);
        }

        let receivedPieces = 0;
        let receivedKg = 0;

        matchingInwards.forEach((inw) => {
          if (inw.lines && inw.lines.length > 0) {
            inw.lines.forEach((l) => {
              const u = (l.unit || '').toLowerCase();
              const q = Number(l.receivedQty || 0);
              if (u === 'kg') receivedKg += q;
              else receivedPieces += q;
            });
          } else if (inw.totalQtyByUnit) {
            receivedPieces += Number(inw.totalQtyByUnit.piece || 0);
            receivedKg += Number(inw.totalQtyByUnit.kg || 0);
          } else {
            receivedPieces += Number(inw.totalQuantity || 0);
          }
        });

        let dispatchedPieces = 0;
        let dispatchedKg = 0;

        matchingOutwards.forEach((outw) => {
          if (outw.lines && outw.lines.length > 0) {
            outw.lines.forEach((l) => {
              const u = (l.unit || '').toLowerCase();
              const q = Number(l.dispatchQty || 0);
              if (u === 'kg') dispatchedKg += q;
              else dispatchedPieces += q;
            });
          } else if (outw.totalQtyByUnit) {
            dispatchedPieces += Number(outw.totalQtyByUnit.piece || 0);
            dispatchedKg += Number(outw.totalQtyByUnit.kg || 0);
          } else {
            dispatchedPieces += Number(outw.totalQuantity || 0);
          }
        });

        const availablePieces = Math.max(0, receivedPieces - dispatchedPieces);
        const availableKg = Math.max(0, receivedKg - dispatchedKg);
        const totalAvailable = availablePieces + availableKg;

        const vendor =
          vendorMap.get(po.customerId || '') ||
          vendorMap.get(po.customerVendorId || '');
        const customerName =
          vendor?.companyName ||
          po.customerName ||
          po.customerCompanyNameSnapshot ||
          'Customer';
        const vendorCode = vendor?.vendorId || po.customerCode || '';

        const processType = (po.processCategory || 'WASHING').toUpperCase();

        return {
          po,
          customerName,
          vendorCode,
          processType,
          orderedPieces,
          orderedKg,
          receivedPieces,
          receivedKg,
          dispatchedPieces,
          dispatchedKg,
          availablePieces,
          availableKg,
          totalAvailable,
          hasPostedInward: matchingInwards.length > 0
        };
      })
      .filter((stat) => stat.hasPostedInward && stat.totalAvailable > 0);
  }, [allPosWithInwardSources, inwards, outwards, vendorMap]);

  // Filter Quick Outward cards by the search input
  const filteredPoCards = useMemo(() => {
    if (!filters.searchQuery?.trim()) return eligiblePoCards;
    const q = filters.searchQuery.toLowerCase();
    return eligiblePoCards.filter((stat) => {
      const p = stat.po;
      return (
        (p.poNumber || '').toLowerCase().includes(q) ||
        (p.styleNo || p.styleNumber || '').toLowerCase().includes(q) ||
        (p.itemName || '').toLowerCase().includes(q) ||
        stat.customerName.toLowerCase().includes(q) ||
        stat.vendorCode.toLowerCase().includes(q)
      );
    });
  }, [eligiblePoCards, filters.searchQuery]);

  const formatCardQtyStr = (pcs: number, kg: number) => {
    if (pcs > 0 && kg > 0) return `${pcs} pcs + ${kg} kg`;
    if (kg > 0) return `${kg} kg`;
    return `${pcs} pcs`;
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          {/* Search bar with Column Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-2xs divide-x divide-slate-200 flex-1 min-w-[280px]">
            <div className="relative">
              <select
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 text-xs font-semibold text-slate-700 bg-transparent focus:outline-hidden cursor-pointer"
              >
                {OUTWARD_SEARCH_COLUMNS.map((col) => (
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
                    ? 'Search across all columns...'
                    : `Search by ${OUTWARD_SEARCH_COLUMNS.find((c) => c.value === searchColumn)?.label || searchColumn}...`
                }
                value={filters.searchQuery || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden"
              />
              {filters.searchQuery && (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
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
            className={`h-9 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${showColumnFilters || Object.values(columnFilters).some((v) => (v || '').trim() !== '')
              ? 'bg-slate-900 text-white border-slate-900 font-bold'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 shrink-0 text-xs py-1.5 h-auto"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </Button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Outward Button */}
          {canManage && (
            <Button
              variant={showQuickOutwardCards ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowQuickOutwardCards(!showQuickOutwardCards)}
              className={showQuickOutwardCards ? 'bg-black text-white hover:bg-slate-900 border-black' : 'border-slate-300 hover:border-slate-400 font-medium text-slate-700'}
            >
              {showQuickOutwardCards ? 'Show Table View' : 'Quick Outward'}
            </Button>
          )}

          {/* Download Joined DC Button */}
          <Button
            variant={isJoiningMode ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              if (isJoiningMode) {
                setIsJoiningMode(false);
                setSelectedOutwardIds([]);
              } else {
                setIsJoiningMode(true);
              }
            }}
            className={`flex items-center gap-1.5 shrink-0 text-xs py-1.5 h-auto font-semibold cursor-pointer ${isJoiningMode
              ? 'bg-black text-white hover:bg-slate-900 border-black'
              : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            title="Select multiple outward dispatches to combine into a single Delivery Challan"
          >
            <Layers className="w-3.5 h-3.5" />
            {isJoiningMode ? 'Exit Joined DC' : 'Download Joined DC'}
          </Button>

          {canManage && (
            <Button
              onClick={onNewOutward}
              size="sm"
              className="bg-black hover:bg-slate-900 text-white border-black flex items-center gap-1.5 shrink-0 text-xs py-1.5 h-auto shadow-2xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Outward Entry
            </Button>
          )}
        </div>
      </div>

      {/* Active Joined DC Selection Banner */}
      {isJoiningMode && (
        <div className="p-3.5 bg-white text-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs border border-blue-200 bg-linear-to-r from-blue-50/60 via-indigo-50/30 to-white animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs flex-wrap">
            <span className="text-slate-700 font-medium">
              Select dispatches with the <strong className="text-slate-900 font-bold">same PO &amp; Style</strong> to combine into one DC.
            </span>
            {targetPoAndStyle && (
              <span className="px-2.5 py-0.5 bg-blue-50 text-[#1F4E79] border border-blue-200 rounded text-[11px] font-bold">
                Target: {targetPoAndStyle.displayPo} • {targetPoAndStyle.displayStyle}
              </span>
            )}
            {selectedOutwardIds.length > 0 && (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-full text-xs">
                {selectedOutwardIds.length} Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsJoiningMode(false);
                setSelectedOutwardIds([]);
              }}
              className="bg-white text-slate-700 border-slate-300 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selectedOutwardIds.length === 0}
              onClick={() => setIsJoinedDcModalOpen(true)}
              className="bg-[#1F4E79] hover:bg-[#163a5c] text-white font-bold text-xs shadow-xs cursor-pointer border-[#1F4E79] disabled:opacity-50"
            >
              Configure &amp; Download Joined DC ({selectedOutwardIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Expanded Filters Drawer */}
      {showFilters && (
        <Card className="p-4 bg-slate-50/70 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Status
              </label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="all">All Statuses</option>
                <option value="posted">Posted</option>
                <option value="draft">Draft</option>
                <option value="reversed">Reversed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Customer Company
              </label>
              <select
                value={filters.customerId || 'all'}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Dispatch Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value || undefined })}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
              </input>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                Dispatch Date To
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value || undefined })}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-1.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
              </input>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
              Clear All
            </Button>
            <Button
              size="sm"
              onClick={() => setShowFilters(false)}
              className="bg-[#1F4E79] text-white text-xs"
            >
              Apply Filters
            </Button>
          </div>
        </Card>
      )}

      {/* Quick Outward Cards View (Shown instead of table when Quick Outward is toggled) */}
      {showQuickOutwardCards ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Ready for Outward Dispatch — Purchase Orders</h3>
              <p className="text-xs text-slate-500">
                {filteredPoCards.length} purchase orders with received inward stock ready to dispatch
              </p>
            </div>
            <button
              onClick={() => setShowQuickOutwardCards(false)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Switch back to table view
            </button>
          </div>

          {filteredPoCards.length === 0 ? (
            <Card className="p-12 text-center border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Eligible Purchase Orders Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {filters.searchQuery
                  ? 'No purchase orders match your current search.'
                  : 'There are currently no purchase orders with available received inward stock pending dispatch.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPoCards.map((stat) => {
                const {
                  po,
                  customerName,
                  vendorCode,
                  processType,
                  receivedPieces,
                  receivedKg,
                  dispatchedPieces,
                  dispatchedKg,
                  availablePieces,
                  availableKg
                } = stat;

                return (
                  <div
                    key={po.id || po.poId}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between text-xs"
                  >
                    <div>
                      {/* Top Header: PO No & Customer on Left, Ready Badge on Right */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
                            {po.poNumber}
                          </div>
                          <div className="text-slate-600 font-medium text-[11px] uppercase tracking-wide truncate">
                            {customerName} {vendorCode ? `(${vendorCode})` : ''}
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          Ready For Outward
                        </span>
                      </div>

                      {/* Item / Style / Process */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-slate-700 truncate">
                          <span className="font-bold text-slate-800">Item: {po.itemName || '—'}</span>
                          <span className="mx-1.5 text-slate-300">•</span>
                          <span className="font-medium text-slate-600">Style: {po.styleNo || po.styleNumber || '—'}</span>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 uppercase shrink-0">
                          {processType}
                        </span>
                      </div>

                      {/* Metrics Box (Received, Dispatched, Available) */}
                      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 grid grid-cols-3 text-center mb-3">
                        <div className="border-r border-slate-200/80 pr-2">
                          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                            Received
                          </div>
                          <div className="font-bold text-blue-600 text-xs">
                            {formatCardQtyStr(receivedPieces, receivedKg)}
                          </div>
                        </div>

                        <div className="border-r border-slate-200/80 px-2">
                          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                            Dispatched
                          </div>
                          <div className="font-bold text-slate-700 text-xs">
                            {formatCardQtyStr(dispatchedPieces, dispatchedKg)}
                          </div>
                        </div>

                        <div className="pl-2">
                          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                            Available
                          </div>
                          <div className="font-bold text-emerald-600 text-xs">
                            {formatCardQtyStr(availablePieces, availableKg)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer: Order Date & Dispatch Goods Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                      <div className="text-[11px] text-slate-500">
                        Order Date: <span className="font-medium text-slate-700">{formatDate(po.orderDate)}</span>
                      </div>

                      <button
                        onClick={() => (onSelectPoForOutward ? onSelectPoForOutward(po) : onNewOutward())}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F4E79] hover:text-blue-800 transition-colors group cursor-pointer"
                      >
                        <span>Dispatch Goods</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Main Table Card */
        <TableMaximizeWrapper
          title="Outward Dispatches"
          badge={
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1F4E79] border border-blue-200">
              {sortedOutwards.length} {sortedOutwards.length === 1 ? 'entry' : 'entries'}
            </span>
          }
        >
          {(isMaximized) => (
            <Card className={`border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0 ${isMaximized ? 'rounded-xl' : ''}`}>
              <div className="flex flex-col flex-1 min-h-0">
                {/* Active Sort / Desort Banner */}
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
                      title="Reset to default order"
                    >
                      Clear / Desort
                    </button>
                  </div>
                )}

                <div
                  data-table-scroll="true"
                  className={`overflow-x-auto overflow-y-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
                >
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold border-b-2 border-slate-300 uppercase tracking-wider text-[11px]">
                      <tr>
                        {/* Checkbox Column for Joined DC */}
                        {isJoiningMode && (
                          <th className="p-2.5 border border-slate-200 text-center w-12 bg-[#DCEBF8] whitespace-nowrap sticky top-0 z-20">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#163858]">Join</span>
                          </th>
                        )}

                        {/* 1. Outward No */}
                        <th
                          className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'outwardNo' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('outwardNo')}
                          title={getSortTooltip('outwardNo', 'Outward No')}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            <span>Outward No</span>
                            {renderSortIcon('outwardNo')}
                          </div>
                        </th>

                        {/* 2. Dispatch Date */}
                        <th
                          className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'outwardDate' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('outwardDate')}
                          title={getSortTooltip('outwardDate', 'Dispatch Date')}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            <span>Dispatch Date</span>
                            {renderSortIcon('outwardDate')}
                          </div>
                        </th>

                        {/* 3. Our DC Number */}
                        <th
                          className={`p-2.5 border border-slate-200 cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'ourDcNo' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('ourDcNo')}
                          title={getSortTooltip('ourDcNo', 'Our DC Number')}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            <span>Our DC Number</span>
                            {renderSortIcon('ourDcNo')}
                          </div>
                        </th>

                        {/* 4. Customer / Company */}
                        <th
                          className={`p-2.5 border border-slate-200 min-w-[240px] cursor-pointer select-none transition-colors group sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'customerName' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('customerName')}
                          title={getSortTooltip('customerName', 'Customer / Company')}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            <span>Customer / Company</span>
                            {renderSortIcon('customerName')}
                          </div>
                        </th>

                        {/* 5. Style No / PO No */}
                        <th
                          className={`p-2.5 border border-slate-200 min-w-[170px] cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'poNumber' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('poNumber')}
                          title={getSortTooltip('poNumber', 'Style No / PO No')}
                        >
                          <div className="flex items-center gap-1.5 justify-start">
                            <span>Style No / PO No</span>
                            {renderSortIcon('poNumber')}
                          </div>
                        </th>

                        {/* 6. PO Qty */}
                        <th
                          className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'poQty' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('poQty')}
                          title={getSortTooltip('poQty', 'PO Qty')}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>PO Qty</span>
                            {renderSortIcon('poQty')}
                          </div>
                        </th>

                        {/* 7. Total Inward */}
                        <th
                          className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'totalInward' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('totalInward')}
                          title={getSortTooltip('totalInward', 'Total Inward')}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>Total Inward</span>
                            {renderSortIcon('totalInward')}
                          </div>
                        </th>

                        {/* 8. Prev Dispatched */}
                        <th
                          className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'prevDispatched' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('prevDispatched')}
                          title={getSortTooltip('prevDispatched', 'Prev Dispatched')}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>Prev Dispatched</span>
                            {renderSortIcon('prevDispatched')}
                          </div>
                        </th>

                        {/* 9. This DC Dispatch */}
                        <th
                          className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap bg-blue-50/40 text-blue-900 sticky top-0 z-20 ${sortField === 'thisDispatch' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('thisDispatch')}
                          title={getSortTooltip('thisDispatch', 'This DC Dispatch')}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>This DC Dispatch</span>
                            {renderSortIcon('thisDispatch')}
                          </div>
                        </th>

                        {/* 10. Balance After */}
                        <th
                          className={`p-2.5 border border-slate-200 text-right cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'balanceAfter' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('balanceAfter')}
                          title={getSortTooltip('balanceAfter', 'Balance After')}
                        >
                          <div className="flex items-center gap-1.5 justify-end">
                            <span>Balance After</span>
                            {renderSortIcon('balanceAfter')}
                          </div>
                        </th>

                        {/* 11. Status */}
                        <th
                          className={`p-2.5 border border-slate-200 text-center cursor-pointer select-none transition-colors group whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] ${sortField === 'status' ? 'bg-[#DCEBF8] text-[#163858]' : 'hover:bg-slate-200/80'
                            }`}
                          onClick={() => handleSort('status')}
                          title={getSortTooltip('status', 'Status')}
                        >
                          <div className="flex items-center gap-1.5 justify-center">
                            <span>Status</span>
                            {renderSortIcon('status')}
                          </div>
                        </th>

                        {/* 12. Actions */}
                        <th className="p-2.5 border border-slate-200 text-center whitespace-nowrap sticky top-0 z-20 bg-[#EEF5FB] min-w-[130px] pr-12">Actions</th>
                      </tr>

                      {/* Inline Column Filter Inputs Row */}
                      {showColumnFilters && (
                        <tr className="bg-[#F5F9FD] border-b-2 border-slate-300">
                          {isJoiningMode && (
                            <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]" />
                          )}
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter outward..."
                              value={columnFilters.outwardNo || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, outwardNo: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter date..."
                              value={columnFilters.outwardDate || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, outwardDate: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter DC..."
                              value={columnFilters.ourDcNo || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, ourDcNo: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter customer..."
                              value={columnFilters.customerName || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, customerName: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter PO/style..."
                              value={columnFilters.poNumber || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, poNumber: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter PO qty..."
                              value={columnFilters.poQty || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, poQty: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter inward..."
                              value={columnFilters.totalInward || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, totalInward: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter prev..."
                              value={columnFilters.prevDispatched || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, prevDispatched: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter this DC..."
                              value={columnFilters.thisDispatch || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, thisDispatch: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter bal..."
                              value={columnFilters.balanceAfter || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, balanceAfter: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD]">
                            <input
                              type="text"
                              placeholder="Filter status..."
                              value={columnFilters.status || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 text-center"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-[#F5F9FD] text-center">
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
                    <tbody className="divide-y divide-slate-200">
                      {isLoading ? (
                        <tr>
                          <td colSpan={isJoiningMode ? 13 : 12} className="py-14 text-center text-xs text-slate-400 bg-white">
                            <p>Loading Outward dispatches...</p>
                          </td>
                        </tr>
                      ) : sortedOutwards.length === 0 ? (
                        <tr>
                          <td colSpan={isJoiningMode ? 13 : 12} className="py-14 text-center text-xs text-slate-400 bg-white">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <div className="p-3 rounded-full bg-slate-50 text-slate-400">
                                <Package className="w-8 h-8 stroke-[1.5]" />
                              </div>
                              <div className="text-sm font-bold text-slate-700">No Matching Outward Dispatches</div>
                              <p className="text-slate-400 text-xs leading-relaxed">
                                {hasActiveFilters
                                  ? 'No outward dispatches match your current search, column filters, or filters.'
                                  : 'No dispatches match the selected filter criteria or no outwards have been created yet.'}
                              </p>
                              {hasActiveFilters && (
                                <button
                                  type="button"
                                  onClick={handleClearFilters}
                                  className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reset All Filters</span>
                                </button>
                              )}
                              {!hasActiveFilters && canManage && (
                                <Button
                                  onClick={onNewOutward}
                                  size="sm"
                                  className="bg-[#1F4E79] hover:bg-[#163a5c] text-white border-[#1F4E79] text-xs mt-2 shadow-xs cursor-pointer"
                                >
                                  Create First Outward Entry
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        sortedOutwards.map((row) => {
                          const rowId = row.outwardId || row.id;
                          const q = getQuantitySummaries(row);
                          const isSelected = selectedOutwardIds.includes(rowId);
                          const isSelectable = isRowSelectable(row);

                          return (
                            <tr
                              key={rowId}
                              className={`${isJoiningMode && !isSelectable
                                ? 'opacity-40 bg-slate-50/50'
                                : isSelected
                                  ? 'bg-blue-50/60 font-semibold'
                                  : 'hover:bg-slate-50/60'
                                } transition-colors`}
                            >
                              {/* Checkbox for Joined DC */}
                              {isJoiningMode && (
                                <td className="p-2.5 border border-slate-200 text-center w-12">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={!isSelectable}
                                    onChange={() => handleToggleSelectRow(rowId)}
                                    title={
                                      !isSelectable
                                        ? `Disabled: Must match PO (${targetPoAndStyle?.displayPo}) and Style (${targetPoAndStyle?.displayStyle})`
                                        : isSelected
                                          ? 'Deselect this dispatch'
                                          : 'Select this dispatch to combine'
                                    }
                                    className={`w-4 h-4 rounded text-black focus:ring-black cursor-pointer ${!isSelectable ? 'opacity-30 cursor-not-allowed' : ''
                                      }`}
                                  />
                                </td>
                              )}

                              {/* 1. Outward No */}
                              <td className="p-2.5 border border-slate-200 whitespace-nowrap">
                                <button
                                  onClick={() => onViewDetails(row.outwardId || row.id)}
                                  className="font-bold text-[#1F4E79] hover:underline"
                                >
                                  {row.outwardNo}
                                </button>
                              </td>

                              {/* 2. Dispatch Date */}
                              <td className="p-2.5 border border-slate-200 whitespace-nowrap text-slate-600 font-medium">
                                {formatDate(row.outwardDate)}
                              </td>

                              {/* 3. Our DC Number (normal plain text, no box) */}
                              <td className="p-2.5 border border-slate-200 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{row.ourDcNo}</div>
                                {row.vehicleNumber && (
                                  <div className="text-[11px] text-slate-500 font-normal">
                                    Veh: {row.vehicleNumber}
                                  </div>
                                )}
                              </td>

                              {/* 4. Customer / Company (with Hover details) */}
                              <td className="p-2.5 border border-slate-200 min-w-[240px]">
                                <div
                                  onMouseEnter={(e) => handleMouseEnter(e, 'company', row)}
                                  onMouseLeave={handleMouseLeave}
                                  className="cursor-pointer group/comp inline-block"
                                >
                                  <div className="font-semibold text-slate-900 group-hover/comp:text-[#1F4E79] group-hover/comp:underline transition-colors">
                                    {row.customerCompanyNameSnapshot || row.customerName || 'Customer'}
                                  </div>
                                  {row.subcontractorNameSnapshot && (
                                    <div className="text-[11px] text-slate-500 font-normal">
                                      Sub: {row.subcontractorNameSnapshot}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 5. Style No & PO Number */}
                              <td className="p-2.5 border border-slate-200 whitespace-nowrap min-w-[170px]">
                                <div
                                  onMouseEnter={(e) => handleMouseEnter(e, 'po', row)}
                                  onMouseLeave={handleMouseLeave}
                                  className="cursor-pointer group/po inline-block"
                                >
                                  <div className="font-bold text-slate-900 group-hover/po:text-[#1F4E79] group-hover/po:underline transition-colors text-xs">
                                    {row.styleNoSnapshot || row.styleNo || '—'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {row.poNumberSnapshot || row.poNumber}
                                  </div>
                                </div>
                              </td>

                              {/* 6. PO Order Quantity */}
                              <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                                {renderUnitQty(q.ordered, 'text-slate-700')}
                              </td>

                              {/* 7. Total Inward Received */}
                              <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                                {renderUnitQty(q.inward, 'text-slate-600')}
                              </td>

                              {/* 8. Previous Dispatched Quantity */}
                              <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                                {renderUnitQty(q.prevOutward, 'text-slate-500')}
                              </td>

                              {/* 9. This DC Dispatch Quantity */}
                              <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap bg-blue-50/20">
                                {renderUnitQty(q.dispatched, 'text-blue-700 font-bold')}
                              </td>

                              {/* 10. Balance Quantity After Dispatch */}
                              <td className="p-2.5 border border-slate-200 text-right whitespace-nowrap">
                                {renderUnitQty(q.remaining, 'text-[#1F4E79]')}
                              </td>

                              {/* 11. Status */}
                              <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                                {row.status === 'posted' && <StatusChip status="Posted" variant="green" />}
                                {row.status === 'draft' && <StatusChip status="Draft" variant="slate" />}
                                {row.status === 'reversed' && <StatusChip status="Reversed" variant="rose" />}
                                {row.status === 'cancelled' && <StatusChip status="Cancelled" variant="rose" />}
                                {!['posted', 'draft', 'reversed', 'cancelled'].includes(row.status) && (
                                  <StatusChip status={row.status} variant="amber" />
                                )}
                              </td>

                              {/* 12. Actions: Clean text buttons matching Inward (View, Edit, Delete, Print) */}
                              <td className="p-2.5 border border-slate-200 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => onViewDetails(row.outwardId || row.id)}
                                    className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-[#1F4E79] bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                  >
                                    View
                                  </button>

                                  {canManage && (() => {
                                    const lockStatus = POLockService.isLocked(row, lockedPOMap);
                                    if (lockStatus) {
                                      return (
                                        <span
                                          title={lockStatus.reason}
                                          className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                        >
                                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                                          Edit
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => onEdit(row.outwardId || row.id)}
                                        className="px-2 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                                      >
                                        Edit
                                      </button>
                                    );
                                  })()}

                                  {isAdmin && (() => {
                                    const lockStatus = POLockService.isLocked(row, lockedPOMap);
                                    if (lockStatus) {
                                      return (
                                        <span
                                          title={lockStatus.reason}
                                          className="px-2 py-1 text-[11px] font-semibold text-slate-400 bg-slate-100 rounded cursor-not-allowed select-none inline-flex items-center gap-1"
                                        >
                                          <Lock className="w-2.5 h-2.5 text-slate-400" />
                                          Delete
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => setDeleteTargetOutward(row)}
                                        className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded transition-colors"
                                      >
                                        Delete
                                      </button>
                                    );
                                  })()}

                                  <button
                                    onClick={() => onPrint(row.outwardId || row.id)}
                                    title="Generate Delivery Challan"
                                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:text-black bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3 text-slate-600" />
                                    Generate Challan
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                    {/* Sticky Totals Footer */}
                    <TableTotalsFooter
                      cells={[
                        { colSpan: isJoiningMode ? 6 : 5, label: `TOTAL (${sortedOutwards.length} ${sortedOutwards.length === 1 ? 'entry' : 'entries'})` },
                        { pieces: outwardTotals.ordered.piece, kgs: outwardTotals.ordered.kg, isTotal: true },
                        { pieces: outwardTotals.inward.piece, kgs: outwardTotals.inward.kg, isTotal: true },
                        { pieces: outwardTotals.prevOutward.piece, kgs: outwardTotals.prevOutward.kg, isTotal: true },
                        { pieces: outwardTotals.dispatched.piece, kgs: outwardTotals.dispatched.kg, isTotal: true },
                        { pieces: outwardTotals.balance.piece, kgs: outwardTotals.balance.kg, isTotal: true },
                        { align: 'center' },
                        { align: 'center' }
                      ]}
                    />
                  </table>
                </div>

                {/* All Records Summary Bar - One Stretch */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-xs text-slate-500 bg-slate-50/70 shrink-0">
                  <div>
                    Showing all <strong className="text-slate-900 font-bold">{sortedOutwards.length}</strong> {sortedOutwards.length === 1 ? 'entry' : 'entries'} in one stretch
                    {sortedOutwards.length !== outwards.length && (
                      <span className="text-slate-400 font-normal ml-1.5">(filtered from {outwards.length} total)</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">Full view · Header stays at top</span>
                </div>
              </div>
            </Card>
          )}
        </TableMaximizeWrapper>
      )}

      {/* Hover Floating Details Card */}
      {hoverCard && (
        <div
          style={{
            position: 'fixed',
            top: hoverCard.top !== undefined ? `${hoverCard.top}px` : undefined,
            bottom: hoverCard.bottom !== undefined ? `${hoverCard.bottom}px` : undefined,
            left: `${hoverCard.left}px`,
            zIndex: 9999
          }}
          className="w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-xs space-y-3 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          {hoverCard.type === 'company' ? (() => {
            const row = hoverCard.row;
            const vendor = vendors.find(
              (v) =>
                v.vendorId === row.customerVendorId ||
                v.id === row.customerVendorId ||
                v.companyName === row.customerCompanyNameSnapshot ||
                v.companyName === row.customerName
            );

            const companyName =
              vendor?.companyName ||
              row.customerCompanyNameSnapshot ||
              row.customerName ||
              'Customer Company';

            // Address
            const addressParts = [
              vendor?.address?.addressLine1,
              vendor?.address?.addressLine2,
              vendor?.address?.city || vendor?.city,
              vendor?.address?.district,
              vendor?.address?.state || vendor?.state,
              vendor?.address?.pinCode || vendor?.pinCode
            ].filter(Boolean);
            const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : (vendor?.city ? `${vendor.city}, ${vendor.state || 'Tamil Nadu'}` : 'N/A');

            // Primary Contact Person & Contact No
            const primaryContact = vendor?.contacts?.find((c) => c.isPrimary && c.status !== 'inactive') || vendor?.contacts?.[0];
            const personName = vendor?.primaryContactName || primaryContact?.personName || 'N/A';
            const primaryContactNo = vendor?.primaryContactPhone || primaryContact?.contactNumber || vendor?.communication?.mobileNumber || vendor?.communication?.officePhone || vendor?.phone || 'N/A';

            // GST No
            const gstNo = vendor?.taxDetails?.gstin || vendor?.gstin || 'Unregistered / N/A';

            return (
              <div className="space-y-2.5">
                <div className="border-b border-slate-100 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Customer / Company Overview
                    </p>
                    {vendor?.vendorCode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                        {vendor.vendorCode}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                    {companyName}
                  </p>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-600">
                  {/* Address */}
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">Address</span>
                    <span className="font-medium text-slate-800 leading-relaxed block">{fullAddress}</span>
                  </div>

                  {/* Person Name & Primary Contact No */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Contact Person</span>
                      <span className="font-semibold text-slate-800">{personName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-medium">Primary Contact No.</span>
                      <span className="font-semibold text-slate-800">{primaryContactNo}</span>
                    </div>
                  </div>

                  {/* GST NO */}
                  <div className="pt-1 border-t border-slate-50">
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">GST No.</span>
                    <span className="font-mono font-bold text-slate-800">{gstNo}</span>
                  </div>

                  {/* Subcontractor (if present on this dispatch) */}
                  {row.subcontractorNameSnapshot && (
                    <div className="pt-1.5 border-t border-slate-100 flex justify-between">
                      <span className="text-slate-400">Subcontractor:</span>
                      <span className="font-semibold text-slate-800">
                        {row.subcontractorNameSnapshot}
                      </span>
                    </div>
                  )}

                  {/* Destination (if present on this dispatch) */}
                  {row.destination && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Destination:</span>
                      <span className="font-medium text-slate-800 text-right">
                        {row.destination}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <>
              <div className="border-b border-slate-100 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Purchase Order Overview
                </p>
                <p className="text-sm font-bold text-[#1F4E79] mt-0.5">
                  {hoverCard.row.poNumberSnapshot || hoverCard.row.poNumber}
                </p>
              </div>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">Style Number:</span>
                  <span className="font-semibold text-slate-800">
                    {hoverCard.row.styleNoSnapshot || hoverCard.row.styleNo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Item Name:</span>
                  <span className="font-medium text-slate-800">
                    {hoverCard.row.itemNameSnapshot || hoverCard.row.itemName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Process Category:</span>
                  <span className="font-semibold uppercase text-slate-800">
                    {hoverCard.row.processCategorySnapshot || hoverCard.row.processCategory}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTargetOutward}
        onClose={() => setDeleteTargetOutward(null)}
        title="Confirm Outward Dispatch Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 space-y-1">
            <p className="font-bold">Are you sure you want to delete this Outward Dispatch?</p>
            <p className="font-mono font-bold text-rose-700">
              {deleteTargetOutward?.outwardNo || deleteTargetOutward?.entryId}
            </p>
            <p className="text-[11px] text-rose-600">
              This action is restricted to Administrators only. Deleting this record will remove it
              from the system and re-calculate outward dispatch balances.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTargetOutward(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-rose-700 hover:bg-rose-800 text-white"
              onClick={() => {
                if (deleteTargetOutward) {
                  onDelete(deleteTargetOutward.outwardId || deleteTargetOutward.id);
                  setDeleteTargetOutward(null);
                }
              }}
            >
              Delete Outward Dispatch
            </Button>
          </div>
        </div>
      </Modal>

      {/* Joined Delivery Challan (Combined DC) Modal */}
      <JoinedDcModal
        isOpen={isJoinedDcModalOpen}
        onClose={() => {
          setIsJoinedDcModalOpen(false);
          setIsJoiningMode(false);
          setSelectedOutwardIds([]);
        }}
        selectedOutwards={selectedOutwards}
        inwards={inwards}
        vendors={vendors}
      />
    </div>
  );
};
