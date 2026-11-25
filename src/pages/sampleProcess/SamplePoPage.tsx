import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Plus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  X,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Package,
  Layers,
  Shirt,
  AlertTriangle,
  Building2,
  Calendar,
  Save,
  ChevronRight,
  Info,
  Truck,
  Printer
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../utils/permissions';
import { Vendor } from '../../types/vendor';
import {
  SamplePoInward,
  SamplePoItem,
  SamplePoDispatchStatus,
  SamplePoStatus,
  SamplePoOutward
} from '../../types/samplePo';
import { SamplePoService } from '../../services/samplePoService';
import { SamplePoPdfService } from '../../services/samplePoPdfService';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ExcelExportButton } from '../../components/ui/ExportButtons';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../components/ui/TableMaximizeWrapper';
import { SampleOutwardTab } from './components/SampleOutwardTab';

interface SamplePoPageProps {
  vendors?: Vendor[];
}

type SortField =
  | 'entryNumber'
  | 'customerDcNumber'
  | 'customerDcDate'
  | 'vendorName'
  | 'totalQuantity'
  | 'dispatchStatus'
  | 'status'
  | 'createdAt';

type SortDirection = 'asc' | 'desc' | 'normal';

const COMMON_WASH_TYPES = [
  'Optical White Wash',
  'Normal Wash',
  'Softener Silicone Wash',
  'Enzyme Heavy Wash',
  'Enzyme Bio Wash',
  'Bleach & Neutralization',
  'Stone Wash',
  'Acid Wash',
  'Garment Dyeing / Tint Wash',
  'Raw Wash / Rinse Wash'
];

const COMMON_UNITS = ['PCS', 'KG', 'MTR', 'NOS'];

function formatVendorAddress(addr?: any): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  return [addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.pinCode]
    .filter(Boolean)
    .join(', ');
}

function getVendorName(v?: Vendor): string {
  if (!v) return '';
  return v.companyName || (v as any).name || '';
}

function getVendorGst(v?: Vendor): string {
  if (!v) return '';
  return v.taxDetails?.gstin || v.gstin || '';
}

function getVendorId(v?: Vendor): string {
  if (!v) return '';
  return v.vendorId || v.id || '';
}

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
  } catch { }
  return dateStr;
}

export const SamplePoPage: React.FC<SamplePoPageProps> = ({ vendors = [] }) => {
  const { user, isDemoMode, isAdmin } = useAuth();
  const userIsAdmin = Boolean(isAdmin || isUserAdmin(user));

  // Top Level Tab: Inward vs Outward
  const [activeProcessTab, setActiveProcessTab] = useState<'inward' | 'outward'>('inward');
  const [sampleOutwards, setSampleOutwards] = useState<SamplePoOutward[]>(() => SamplePoService.getOutwardCache());
  const [outwardPreSelectedInward, setOutwardPreSelectedInward] = useState<SamplePoInward | null>(null);

  // Data State
  const [samplePos, setSamplePos] = useState<SamplePoInward[]>(() => SamplePoService.getCache());
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Table Controls State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [columnFilters, setColumnFilters] = useState<{
    entryNumber: string;
    customerDcNumber: string;
    customerDcDate: string;
    vendorName: string;
    itemSummary: string;
    totalQuantity: string;
    dispatchStatus: string;
    status: string;
  }>({
    entryNumber: '',
    customerDcNumber: '',
    customerDcDate: '',
    vendorName: '',
    itemSummary: '',
    totalQuantity: '',
    dispatchStatus: '',
    status: ''
  });

  // 3-State Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('normal');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Expanded Row for Details
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState<boolean>(false);
  const [editingPo, setEditingPo] = useState<SamplePoInward | null>(null);
  const [deleteConfirmPo, setDeleteConfirmPo] = useState<SamplePoInward | null>(null);
  const [viewDetailsPo, setViewDetailsPo] = useState<SamplePoInward | null>(null);

  // Form State for Add / Edit
  const [formState, setFormState] = useState<{
    entryNumber: string;
    customerDcNumber: string;
    customerDcDate: string;
    vendorId: string;
    vendorName: string;
    vendorAddress: string;
    vendorGst: string;
    isManualVendor: boolean;
    dispatchStatus: SamplePoDispatchStatus;
    status: SamplePoStatus;
    remarks: string;
    items: SamplePoItem[];
  }>({
    entryNumber: '',
    customerDcNumber: '',
    customerDcDate: new Date().toISOString().split('T')[0],
    vendorId: '',
    vendorName: '',
    vendorAddress: '',
    vendorGst: '',
    isManualVendor: false,
    dispatchStatus: 'pending',
    status: 'active',
    remarks: '',
    items: [
      {
        id: `[#${Math.random().toString(16).substring(2, 7)}]`,
        itemName: '',
        styleNo: '',
        washType: '',
        quantity: 0,
        unit: 'PCS',
        customerDcNumber: '',
        customerDcDate: new Date().toISOString().split('T')[0],
        dispatchedQuantity: 0
      }
    ]
  });

  // Subscribe to real-time updates
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = SamplePoService.subscribeSamplePos(
      (data) => {
        if (isMounted) {
          setSamplePos(data);
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Real-time fallback for Sample POs:', err);
        SamplePoService.getSamplePos(isDemoMode).then((data) => {
          if (isMounted) {
            setSamplePos(data);
            setLoading(false);
          }
        });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemoMode]);

  // Subscribe to real-time Sample Outwards
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = SamplePoService.subscribeSampleOutwards(
      (data) => {
        if (isMounted) {
          setSampleOutwards(data);
        }
      },
      (err) => {
        console.warn('Real-time fallback for Sample Outwards:', err);
        SamplePoService.getSampleOutwards(isDemoMode).then((data) => {
          if (isMounted) setSampleOutwards(data);
        });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemoMode]);

  // Handle 3-state sorting cycle: Default Direction -> Opposite Direction -> Normal (Unsorted)
  const handleSort = (field: SortField) => {
    const isNumericOrDate = field === 'totalQuantity' || field === 'customerDcDate' || field === 'createdAt';
    const firstDirection: SortDirection = isNumericOrDate ? 'desc' : 'asc';
    const secondDirection: SortDirection = isNumericOrDate ? 'asc' : 'desc';

    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection(firstDirection);
    } else if (sortDirection === firstDirection) {
      setSortDirection(secondDirection);
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const renderSortIcon = (field: SortField) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center transition-colors shrink-0 ml-1 ${isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60 group-hover:opacity-100'
          }`}
        title={
          sortField === field && sortDirection === 'asc'
            ? 'Sorted ascending (click to sort descending or reset)'
            : sortField === field && sortDirection === 'desc'
              ? 'Sorted descending (click to reset to unsorted)'
              : 'Click to sort'
        }
      >
        {isCurrent ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    );
  };

  // Active column filters count
  const activeColumnFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length;
  }, [columnFilters]);

  // Master reset check
  const hasAnyFilter = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchColumn !== 'ALL' ||
      activeColumnFilterCount > 0 ||
      Boolean(dateFrom) ||
      Boolean(dateTo) ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, activeColumnFilterCount, dateFrom, dateTo, sortField, sortDirection]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setDateFrom('');
    setDateTo('');
    setColumnFilters({
      entryNumber: '',
      customerDcNumber: '',
      customerDcDate: '',
      vendorName: '',
      itemSummary: '',
      totalQuantity: '',
      dispatchStatus: '',
      status: ''
    });
    setSortField(null);
    setSortDirection('normal');
    setCurrentPage(1);
  };

  // Filtered & Sorted Data
  const filteredAndSortedPos = useMemo(() => {
    let result = [...samplePos];

    // Global / Column-wise Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((po) => {
        const entryNo = (po.entryNumber || '').toLowerCase();
        const dcNo = (po.customerDcNumber || '').toLowerCase();
        const dcDate = (po.customerDcDate || '').toLowerCase();
        const lineDcs = (po.items || []).map((i) => (i.customerDcNumber || '').toLowerCase()).join(' ');
        const lineDates = (po.items || []).map((i) => (i.customerDcDate || '').toLowerCase()).join(' ');
        const vendor = (po.vendorName || '').toLowerCase();
        const remarks = (po.remarks || '').toLowerCase();
        const dispatchStat = (po.dispatchStatus || '').toLowerCase();
        const stat = (po.status || '').toLowerCase();
        const itemsText = (po.items || [])
          .map((i) => `${i.itemName} ${i.styleNo} ${i.washType} ${i.quantity} ${i.unit} ${i.customerDcNumber} ${i.customerDcDate}`)
          .join(' ')
          .toLowerCase();

        if (searchColumn === 'entryNumber') return entryNo.includes(q);
        if (searchColumn === 'customerDcNumber') return dcNo.includes(q) || lineDcs.includes(q);
        if (searchColumn === 'vendorName') return vendor.includes(q);
        if (searchColumn === 'items') return itemsText.includes(q);
        if (searchColumn === 'dispatchStatus') return dispatchStat.includes(q);
        if (searchColumn === 'status') return stat.includes(q);
        if (searchColumn === 'remarks') return remarks.includes(q);

        // ALL columns
        return (
          entryNo.includes(q) ||
          dcNo.includes(q) ||
          lineDcs.includes(q) ||
          dcDate.includes(q) ||
          lineDates.includes(q) ||
          vendor.includes(q) ||
          itemsText.includes(q) ||
          dispatchStat.includes(q) ||
          stat.includes(q) ||
          remarks.includes(q)
        );
      });
    }

    // Column Filters
    if (columnFilters.entryNumber.trim()) {
      const val = columnFilters.entryNumber.trim().toLowerCase();
      result = result.filter((po) => (po.entryNumber || '').toLowerCase().includes(val));
    }
    if (columnFilters.customerDcNumber.trim()) {
      const val = columnFilters.customerDcNumber.trim().toLowerCase();
      result = result.filter(
        (po) =>
          (po.customerDcNumber || '').toLowerCase().includes(val) ||
          (po.items || []).some((i) => (i.customerDcNumber || '').toLowerCase().includes(val))
      );
    }
    if (columnFilters.customerDcDate.trim()) {
      const val = columnFilters.customerDcDate.trim().toLowerCase();
      result = result.filter(
        (po) =>
          (po.customerDcDate || '').toLowerCase().includes(val) ||
          (po.items || []).some((i) => (i.customerDcDate || '').toLowerCase().includes(val))
      );
    }
    if (columnFilters.vendorName.trim()) {
      const val = columnFilters.vendorName.trim().toLowerCase();
      result = result.filter((po) => (po.vendorName || '').toLowerCase().includes(val));
    }
    if (columnFilters.itemSummary.trim()) {
      const val = columnFilters.itemSummary.trim().toLowerCase();
      result = result.filter((po) =>
        (po.items || [])
          .map((i) => `${i.itemName} ${i.styleNo} ${i.washType}`)
          .join(' ')
          .toLowerCase()
          .includes(val)
      );
    }
    if (columnFilters.totalQuantity.trim()) {
      const val = parseFloat(columnFilters.totalQuantity.trim());
      if (!isNaN(val)) {
        result = result.filter((po) => po.totalQuantity >= val);
      }
    }
    if (columnFilters.dispatchStatus.trim()) {
      const val = columnFilters.dispatchStatus.trim().toLowerCase();
      result = result.filter((po) => (po.dispatchStatus || '').toLowerCase().includes(val));
    }
    if (columnFilters.status.trim()) {
      const val = columnFilters.status.trim().toLowerCase();
      result = result.filter((po) => (po.status || '').toLowerCase().includes(val));
    }

    // Date Range Filter (based on customerDcDate)
    if (dateFrom) {
      result = result.filter((po) => (po.customerDcDate || '') >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((po) => (po.customerDcDate || '') <= dateTo);
    }

    // 3-State Sorting
    if (sortField && sortDirection !== 'normal') {
      result.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (sortDirection === 'asc') {
          return valA > valB ? 1 : -1;
        } else {
          return valA < valB ? 1 : -1;
        }
      });
    }

    return result;
  }, [samplePos, searchQuery, searchColumn, columnFilters, dateFrom, dateTo, sortField, sortDirection]);

  // Paginated Slices
  const totalRecords = filteredAndSortedPos.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedPos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPos.slice(start, start + pageSize);
  }, [filteredAndSortedPos, currentPage, pageSize]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    const totalPos = samplePos.length;
    const totalQty = samplePos.reduce((sum, po) => sum + (po.totalQuantity || 0), 0);
    const totalDispatched = samplePos.reduce((sum, po) => sum + (po.totalDispatchedQuantity || 0), 0);
    const pendingDispatches = samplePos.filter(
      (po) => (po.dispatchStatus || '').toLowerCase() === 'pending'
    ).length;
    const activeSamples = samplePos.filter((po) => (po.status || '').toLowerCase() === 'active').length;

    return {
      totalPos,
      totalQty,
      totalDispatched,
      pendingDispatches,
      activeSamples
    };
  }, [samplePos]);

  // Open Add Modal
  const handleOpenAddModal = async () => {
    setEditingPo(null);
    let nextEntry = 'SMP-INW-2026-0006';
    try {
      nextEntry = await SamplePoService.generateNextEntryNumber();
    } catch { }

    const today = new Date().toISOString().split('T')[0];
    const firstVendor = vendors[0];
    setFormState({
      entryNumber: nextEntry,
      customerDcNumber: '',
      customerDcDate: today,
      vendorId: getVendorId(firstVendor),
      vendorName: getVendorName(firstVendor),
      vendorAddress: formatVendorAddress(firstVendor?.address),
      vendorGst: getVendorGst(firstVendor),
      isManualVendor: false,
      dispatchStatus: 'pending',
      status: 'active',
      remarks: '',
      items: [
        {
          id: `[#${Math.random().toString(16).substring(2, 7)}]`,
          itemName: '',
          styleNo: '',
          washType: '',
          quantity: 0,
          unit: 'PCS',
          customerDcNumber: '',
          customerDcDate: today,
          dispatchedQuantity: 0
        }
      ]
    });
    setIsAddEditModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (po: SamplePoInward) => {
    setEditingPo(po);
    const today = new Date().toISOString().split('T')[0];
    const fallbackDc = po.customerDcNumber || '';
    const fallbackDate = po.customerDcDate || today;

    setFormState({
      entryNumber: po.entryNumber || '',
      customerDcNumber: fallbackDc,
      customerDcDate: fallbackDate,
      vendorId: po.vendorId || '',
      vendorName: po.vendorName || '',
      vendorAddress: po.vendorAddress || '',
      vendorGst: po.vendorGst || '',
      isManualVendor: Boolean(po.isManualVendor),
      dispatchStatus: (po.dispatchStatus as SamplePoDispatchStatus) || 'pending',
      status: (po.status as SamplePoStatus) || 'active',
      remarks: po.remarks || '',
      items: (po.items && po.items.length > 0)
        ? po.items.map((it) => ({
          ...it,
          customerDcNumber: it.customerDcNumber || fallbackDc,
          customerDcDate: it.customerDcDate || fallbackDate
        }))
        : [
          {
            id: `[#${Math.random().toString(16).substring(2, 7)}]`,
            itemName: '',
            styleNo: '',
            washType: '',
            quantity: 0,
            unit: 'PCS',
            customerDcNumber: fallbackDc,
            customerDcDate: fallbackDate,
            dispatchedQuantity: 0
          }
        ]
    });
    setIsAddEditModalOpen(true);
  };

  // Add Item Line
  const handleAddItemLine = () => {
    setFormState((prev) => {
      const lastItem = prev.items[prev.items.length - 1];
      const defaultDcNo = lastItem?.customerDcNumber || prev.customerDcNumber || '';
      const defaultDcDate = lastItem?.customerDcDate || prev.customerDcDate || new Date().toISOString().split('T')[0];

      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: `[#${Math.random().toString(16).substring(2, 7)}]`,
            itemName: '',
            styleNo: '',
            washType: '',
            quantity: 0,
            unit: 'PCS',
            customerDcNumber: defaultDcNo,
            customerDcDate: defaultDcDate,
            dispatchedQuantity: 0
          }
        ]
      };
    });
  };

  // Remove Item Line
  const handleRemoveItemLine = (idx: number) => {
    setFormState((prev) => {
      const updated = prev.items.filter((_, i) => i !== idx);
      return {
        ...prev,
        items: updated.length > 0 ? updated : prev.items
      };
    });
  };

  // Update Item Line
  const handleUpdateItemLine = (idx: number, field: keyof SamplePoItem, val: any) => {
    setFormState((prev) => {
      const nextItems = [...prev.items];
      nextItems[idx] = {
        ...nextItems[idx],
        [field]: field === 'quantity' || field === 'dispatchedQuantity' ? Number(val || 0) : val
      };
      return { ...prev, items: nextItems };
    });
  };

  // Save Add / Edit
  const handleSavePo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.vendorName.trim()) {
      setNotice({ type: 'error', text: 'Customer / Vendor Name is required.' });
      return;
    }
    if (!formState.items || formState.items.length === 0) {
      setNotice({ type: 'error', text: 'At least one sample item line is required.' });
      return;
    }

    // Validate that each line item has Customer DC Number and Date
    const missingDc = formState.items.find((it) => !it.customerDcNumber || !it.customerDcNumber.trim());
    if (missingDc) {
      setNotice({ type: 'error', text: 'Every line item must have a Customer DC Number.' });
      return;
    }
    const missingDate = formState.items.find((it) => !it.customerDcDate || !it.customerDcDate.trim());
    if (missingDate) {
      setNotice({ type: 'error', text: 'Every line item must have a Customer DC Date.' });
      return;
    }

    const invalidItem = formState.items.find((it) => !it.itemName.trim() || it.quantity <= 0);
    if (invalidItem) {
      setNotice({ type: 'error', text: 'Every item line must have a valid Item Name and Quantity greater than 0.' });
      return;
    }

    setActionLoading(true);
    setNotice(null);

    try {
      const currentUser = {
        uid: user?.uid || 'user-uid',
        displayName: user?.displayName || user?.email || 'Pranav'
      };

      const primaryDc = formState.items[0]?.customerDcNumber || formState.customerDcNumber || '';
      const primaryDate = formState.items[0]?.customerDcDate || formState.customerDcDate || '';

      if (editingPo) {
        await SamplePoService.updateSamplePo(
          editingPo.id,
          {
            customerDcNumber: primaryDc,
            customerDcDate: primaryDate,
            vendorId: formState.vendorId,
            vendorName: formState.vendorName,
            vendorAddress: formState.vendorAddress,
            vendorGst: formState.vendorGst,
            isManualVendor: formState.isManualVendor,
            dispatchStatus: formState.dispatchStatus,
            status: formState.status,
            remarks: formState.remarks,
            items: formState.items
          },
          currentUser,
          isDemoMode
        );
        setNotice({ type: 'success', text: `Sample PO ${editingPo.entryNumber} updated successfully.` });
      } else {
        const created = await SamplePoService.createSamplePo(
          {
            entryNumber: formState.entryNumber,
            customerDcNumber: primaryDc,
            customerDcDate: primaryDate,
            vendorId: formState.vendorId,
            vendorName: formState.vendorName,
            vendorAddress: formState.vendorAddress,
            vendorGst: formState.vendorGst,
            isManualVendor: formState.isManualVendor,
            dispatchStatus: formState.dispatchStatus,
            status: formState.status,
            remarks: formState.remarks,
            items: formState.items
          },
          currentUser,
          isDemoMode
        );
        setNotice({ type: 'success', text: `Sample PO ${created.entryNumber} created successfully.` });
      }

      setIsAddEditModalOpen(false);
    } catch (err: any) {
      console.error('Error saving Sample PO:', err);
      setNotice({ type: 'error', text: err?.message || 'Failed to save Sample PO.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Action
  const handleDeletePo = async () => {
    if (!deleteConfirmPo) return;
    setActionLoading(true);
    try {
      await SamplePoService.deleteSamplePo(deleteConfirmPo.id, isDemoMode);
      setNotice({ type: 'success', text: `Sample PO ${deleteConfirmPo.entryNumber} deleted successfully.` });
      setDeleteConfirmPo(null);
    } catch (err: any) {
      console.error('Error deleting Sample PO:', err);
      setNotice({ type: 'error', text: err?.message || 'Failed to delete Sample PO.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Export to Excel using ExcelJS
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sample PO Inwards');

      sheet.columns = [
        { header: 'Entry Number', key: 'entryNumber', width: 20 },
        { header: 'Customer DC No', key: 'customerDcNumber', width: 16 },
        { header: 'Customer DC Date', key: 'customerDcDate', width: 16 },
        { header: 'Customer / Vendor', key: 'vendorName', width: 34 },
        { header: 'Item Name', key: 'itemName', width: 22 },
        { header: 'Style No', key: 'styleNo', width: 16 },
        { header: 'Wash Type', key: 'washType', width: 24 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Dispatched Qty', key: 'dispatchedQuantity', width: 16 },
        { header: 'Dispatch Status', key: 'dispatchStatus', width: 16 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Remarks', key: 'remarks', width: 24 },
        { header: 'Created By', key: 'createdByName', width: 18 }
      ];

      // Header style
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };

      // Populate flat rows (one row per item line)
      filteredAndSortedPos.forEach((po) => {
        if (po.items && po.items.length > 0) {
          po.items.forEach((item) => {
            sheet.addRow({
              entryNumber: po.entryNumber,
              customerDcNumber: item.customerDcNumber || po.customerDcNumber,
              customerDcDate: item.customerDcDate || po.customerDcDate,
              vendorName: po.vendorName,
              itemName: item.itemName,
              styleNo: item.styleNo,
              washType: item.washType,
              quantity: item.quantity,
              unit: item.unit,
              dispatchedQuantity: item.dispatchedQuantity || 0,
              dispatchStatus: po.dispatchStatus,
              status: po.status,
              remarks: po.remarks || '',
              createdByName: po.createdByName || ''
            });
          });
        } else {
          sheet.addRow({
            entryNumber: po.entryNumber,
            customerDcNumber: po.customerDcNumber,
            customerDcDate: po.customerDcDate,
            vendorName: po.vendorName,
            itemName: '—',
            styleNo: '—',
            washType: '—',
            quantity: po.totalQuantity,
            unit: 'PCS',
            dispatchedQuantity: po.totalDispatchedQuantity || 0,
            dispatchStatus: po.dispatchStatus,
            status: po.status,
            remarks: po.remarks || '',
            createdByName: po.createdByName || ''
          });
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Perla_Sample_PO_Inwards_${today}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export Sample POs to Excel:', e);
      setNotice({ type: 'error', text: 'Failed to generate Excel export.' });
    }
  };

  const getDispatchBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );
    }
    if (s === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" />
          Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
        <Clock className="w-3 h-3 text-blue-600" />
        Pending
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Cancelled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
        Active
      </span>
    );
  };

  const currentTotalCalculated = useMemo(() => {
    return formState.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [formState.items]);

  const sampleTotals = useMemo(() => {
    return filteredAndSortedPos.reduce(
      (sum, p) => sum + (p.totalQuantity || 0),
      0
    );
  }, [filteredAndSortedPos]);

  return (
    <div className="space-y-5">
      {/* Top Navigation Switcher: Sample Inward vs Sample Outward */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveProcessTab('inward');
              setOutwardPreSelectedInward(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeProcessTab === 'inward'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Sample Inward</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeProcessTab === 'inward'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {samplePos.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveProcessTab('outward')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeProcessTab === 'outward'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Sample Outward (Dispatch)</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeProcessTab === 'outward'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {sampleOutwards.length}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-medium">
          {activeProcessTab === 'inward'
            ? 'Manage sample inward entries & item specifications'
            : 'Track outbound dispatches and challan delivery data'}
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs border ${notice.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Render Active View */}
      {activeProcessTab === 'outward' ? (
        <SampleOutwardTab
          sampleOutwards={sampleOutwards}
          samplePos={samplePos}
          vendors={vendors}
          user={user}
          isDemoMode={isDemoMode}
          onRefresh={() => {
            SamplePoService.getSampleOutwards(isDemoMode).then(setSampleOutwards);
            SamplePoService.getSamplePos(isDemoMode).then(setSamplePos);
          }}
          onNotice={(n) => setNotice(n)}
          preSelectedInward={outwardPreSelectedInward}
          onClearPreSelectedInward={() => setOutwardPreSelectedInward(null)}
        />
      ) : (
        <>
          {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sample POs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Sample POs
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalPos}
            </span>
            <span className="text-xs text-slate-500 font-medium">Inward Records</span>
          </div>
        </div>

        {/* Total Sample Quantity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Sample Qty
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.totalQty.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">Pieces / Units</span>
          </div>
        </div>

        {/* Pending Dispatches */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pending Dispatches
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.pendingDispatches}
            </span>
            <span className="text-xs text-amber-600 font-semibold">Awaiting Dispatch</span>
          </div>
        </div>

        {/* Active Samples */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Samples
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {metrics.activeSamples}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">Processing</span>
          </div>
        </div>
      </div>

      {/* Main Table Card with All Table Controls */}
      <TableMaximizeWrapper
        title="Sample Purchase Orders & Processing"
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredAndSortedPos.length} Sample POs
          </span>
        }
      >
        {(isMaximized) => (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Controls Bar Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              {/* Left: Column-Wise Search + Column Filters Toggle + Master Reset */}
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search Pill */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 w-full sm:w-auto">
                  <div className="relative bg-slate-50 border-r border-slate-200 shrink-0">
                    <select
                      value={searchColumn}
                      onChange={(e) => setSearchColumn(e.target.value)}
                      className="h-9 pl-3 pr-7 bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none"
                      title="Select column to search in"
                    >
                      <option value="ALL">All Columns</option>
                      <option value="entryNumber">Entry No</option>
                      <option value="customerDcNumber">Customer DC No</option>
                      <option value="vendorName">Customer / Vendor</option>
                      <option value="items">Items & Styles</option>
                      <option value="dispatchStatus">Dispatch Status</option>
                      <option value="status">Status</option>
                      <option value="remarks">Remarks</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  <div className="relative flex-1 min-w-[200px] flex items-center">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={searchColumn === 'ALL' ? 'Search all columns...' : `Search ${searchColumn}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Column Filters Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowColumnFilters((prev) => !prev)}
                  className={`h-9 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${showColumnFilters || activeColumnFilterCount > 0
                    ? 'bg-blue-50 border-blue-300 text-[#1F4E79]'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  title="Toggle inline column filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Column Filters</span>
                  {activeColumnFilterCount > 0 && (
                    <span className="bg-slate-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {activeColumnFilterCount}
                    </span>
                  )}
                </button>

                {/* Date Range Filters */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-9 text-xs shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Start Date:
                  </span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                    title="Filter by start date"
                  />
                  <span className="text-slate-300">|</span>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    End Date:
                  </span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold cursor-pointer"
                    title="Filter by end date"
                  />
                  {(dateFrom || dateTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer ml-1"
                      title="Clear date range"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Master Reset Button */}
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="h-9 px-2.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    title="Reset All Filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Right: Export Excel, Download PDF & Add Sample PO */}
              <div className="flex items-center gap-2">
                <ExcelExportButton
                  onClick={handleExportExcel}
                  label="Export Excel"
                  title="Export filtered records to Excel spreadsheet"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => SamplePoPdfService.downloadSamplePoTableReportPdf(filteredAndSortedPos, dateFrom, dateTo)}
                  icon={<Printer className="w-4 h-4 text-rose-600" />}
                  className="h-9 font-bold border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                  title="Download entire table as PDF report"
                >
                  Download PDF
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenAddModal}
                  className="h-9 font-bold cursor-pointer"
                >
                  Add Sample PO
                </Button>
              </div>
            </div>

            {/* Table View */}
            <div
              data-table-scroll="true"
              className={`overflow-x-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'} overflow-y-auto`}
            >
              <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
                <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
                  <tr className="bg-[#EEF5FB] text-[#1F4E79] border-b border-slate-300 font-bold uppercase text-[11px] tracking-wider select-none">
                    <th className="py-3 px-3 w-12 text-center whitespace-nowrap">S.No</th>
                    <th
                      onClick={() => handleSort('entryNumber')}
                      className="py-3 px-3 cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[150px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between">
                        <span>Entry Number</span>
                        {renderSortIcon('entryNumber')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customerDcNumber')}
                      className="py-3 px-3 cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[130px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between">
                        <span>Customer DC No</span>
                        {renderSortIcon('customerDcNumber')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customerDcDate')}
                      className="py-3 px-3 cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[130px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-between">
                        <span>Customer DC Date</span>
                        {renderSortIcon('customerDcDate')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('vendorName')}
                      className="py-3 px-3 cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[200px]"
                    >
                      <div className="flex items-center justify-between">
                        <span>Customer / Vendor</span>
                        {renderSortIcon('vendorName')}
                      </div>
                    </th>
                    <th className="py-3 px-3 min-w-[220px]">
                      <span>Items &amp; Styles</span>
                    </th>
                    <th
                      onClick={() => handleSort('totalQuantity')}
                      className="py-3 px-3 text-right cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[100px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-end">
                        <span>Total Qty</span>
                        {renderSortIcon('totalQuantity')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('dispatchStatus')}
                      className="py-3 px-3 text-center cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[120px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center">
                        <span>Dispatch</span>
                        {renderSortIcon('dispatchStatus')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      className="py-3 px-3 text-center cursor-pointer group hover:bg-[#DCE9F5] transition-colors min-w-[90px] whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center">
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </div>
                    </th>
                    <th className="py-3 px-3 pr-12 text-center whitespace-nowrap min-w-[220px]">Actions</th>
                  </tr>

                  {/* Inline Column Filters Row */}
                  {showColumnFilters && (
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                      <th className="p-1.5 text-center text-[10px] text-slate-400 font-normal">
                        #
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Filter Entry..."
                          value={columnFilters.entryNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, entryNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Filter DC No..."
                          value={columnFilters.customerDcNumber}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, customerDcNumber: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Filter DC Date..."
                          value={columnFilters.customerDcDate}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, customerDcDate: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Filter Customer..."
                          value={columnFilters.vendorName}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, vendorName: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Filter Items / Styles..."
                          value={columnFilters.itemSummary}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, itemSummary: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="number"
                          placeholder="Min Qty"
                          value={columnFilters.totalQuantity}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, totalQuantity: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Pending / Partial..."
                          value={columnFilters.dispatchStatus}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, dispatchStatus: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5">
                        <input
                          type="text"
                          placeholder="Active..."
                          value={columnFilters.status}
                          onChange={(e) =>
                            setColumnFilters((prev) => ({ ...prev, status: e.target.value }))
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800 placeholder-slate-400 text-center focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </th>
                      <th className="p-1.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setColumnFilters({
                              entryNumber: '',
                              customerDcNumber: '',
                              customerDcDate: '',
                              vendorName: '',
                              itemSummary: '',
                              totalQuantity: '',
                              dispatchStatus: '',
                              status: ''
                            })
                          }
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#1F4E79]" />
                          <span>Loading Sample POs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedPos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <div className="max-w-xs mx-auto space-y-2">
                          <Package className="w-8 h-8 text-slate-300 mx-auto" />
                          <p className="font-bold text-slate-700">No Sample POs Found</p>
                          <p className="text-xs text-slate-400">
                            {hasAnyFilter
                              ? 'No records match the active search or column filters.'
                              : 'No sample inward work orders recorded yet. Click "+ Add Sample PO" to begin.'}
                          </p>
                          {hasAnyFilter && (
                            <button
                              type="button"
                              onClick={handleResetAllFilters}
                              className="mt-2 text-xs text-[#1F4E79] font-bold underline cursor-pointer"
                            >
                              Clear All Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedPos.map((po, idx) => {
                      const sNo = idx + 1;
                      const isExpanded = expandedId === po.id;
                      const itemsCount = po.items?.length || 0;
                      const firstItem = po.items?.[0];

                      return (
                        <React.Fragment key={po.id}>
                          <tr
                            className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''
                              }`}
                          >
                            <td className="py-3 px-3 text-center text-slate-400 font-mono font-bold align-middle whitespace-nowrap">
                              {sNo}
                            </td>
                            <td className="py-3 px-3 align-middle whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : po.id)}
                                className="font-bold font-mono text-[#1F4E79] hover:underline inline-flex items-center gap-1.5 text-left cursor-pointer text-xs"
                              >
                                <ChevronRight
                                  className={`w-3.5 h-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-[#1F4E79]' : 'text-slate-400'
                                    }`}
                                />
                                <span>{po.entryNumber}</span>
                              </button>
                            </td>
                            {/* Separate Customer DC No */}
                            <td className="py-3 px-3 align-middle whitespace-nowrap font-mono font-bold text-slate-900">
                              {(() => {
                                const dcs = Array.from(
                                  new Set(
                                    (po.items || [])
                                      .map((i) => i.customerDcNumber)
                                      .filter(Boolean)
                                  )
                                );
                                const primaryDc = dcs.length > 0 ? dcs[0] : (po.customerDcNumber || '—');
                                const moreCount = dcs.length > 1 ? dcs.length - 1 : 0;
                                return (
                                  <div className="flex items-center gap-1">
                                    <span>{primaryDc !== '—' ? `DC #${primaryDc}` : '—'}</span>
                                    {moreCount > 0 && (
                                      <span
                                        className="text-[10px] font-sans font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800"
                                        title={`All DCs: ${dcs.map((d) => `#${d}`).join(', ')}`}
                                      >
                                        +{moreCount} more
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            {/* Separate Customer DC Date */}
                            <td className="py-3 px-3 align-middle whitespace-nowrap text-slate-600">
                              {(() => {
                                const primaryDate = (po.items && po.items[0]?.customerDcDate) || po.customerDcDate;
                                return formatDisplayDate(primaryDate);
                              })()}
                            </td>
                            <td className="py-3 px-3 align-middle">
                              <div className="font-bold text-slate-900 leading-snug line-clamp-1 max-w-[220px]" title={po.vendorName}>
                                {po.vendorName || '—'}
                              </div>
                            </td>
                            <td className="py-3 px-3 align-middle">
                              {itemsCount > 0 ? (
                                <div>
                                  <div className="flex items-center gap-1.5 flex-nowrap">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10.5px] whitespace-nowrap shrink-0">
                                      {itemsCount} {itemsCount === 1 ? 'Item' : 'Items'}:
                                    </span>
                                    <span className="font-semibold text-slate-900 truncate max-w-[190px]" title={`${firstItem?.itemName} (${firstItem?.styleNo || '—'})`}>
                                      {firstItem?.itemName} <span className="font-mono text-slate-500 font-normal">({firstItem?.styleNo || '—'})</span>
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium truncate max-w-[250px] mt-0.5">
                                    Wash: <span className="text-slate-700 font-semibold">{firstItem?.washType || '—'}</span>
                                    {itemsCount > 1 && (
                                      <span className="text-[#1F4E79] font-bold ml-1">+{itemsCount - 1} more</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No lines</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right align-middle whitespace-nowrap">
                              <span className="font-black font-mono text-slate-900 text-sm block">
                                {po.totalQuantity.toLocaleString()}
                              </span>
                              <span className="text-[10.5px] text-slate-500 font-bold block uppercase tracking-wider">
                                {firstItem?.unit || 'PCS'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                              {getDispatchBadge(po.dispatchStatus)}
                            </td>
                            <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                              {getStatusBadge(po.status)}
                            </td>
                            <td className="py-3 px-3 text-center align-middle whitespace-nowrap pr-12">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Create Outward / Dispatch Action in words */}
                                {(po.dispatchStatus || '').toLowerCase() !== 'completed' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOutwardPreSelectedInward(po);
                                      setActiveProcessTab('outward');
                                    }}
                                    className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition cursor-pointer"
                                    title="Create Sample Outward (Dispatch) for this PO"
                                  >
                                    Dispatch
                                  </button>
                                )}

                                {/* View Details in words */}
                                <button
                                  type="button"
                                  onClick={() => setViewDetailsPo(po)}
                                  className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs transition cursor-pointer"
                                  title="View full sample details"
                                >
                                  View
                                </button>

                                {/* Edit Action in words */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(po)}
                                  className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-xs transition cursor-pointer"
                                  title="Edit Sample PO"
                                >
                                  Edit
                                </button>

                                {/* Delete Action in words */}
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmPo(po)}
                                  className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition cursor-pointer"
                                  title="Delete Sample PO"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Line Items Detail Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 border-b border-slate-200">
                              <td colSpan={9} className="p-4 pl-12">
                                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Layers className="w-4 h-4 text-[#1F4E79]" />
                                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                        Sample Line Items Breakdown ({po.items?.length || 0})
                                      </h4>
                                    </div>
                                    {po.remarks && (
                                      <span className="text-xs text-slate-500 italic">
                                        Remarks: "{po.remarks}"
                                      </span>
                                    )}
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border border-slate-100 rounded-lg">
                                      <thead>
                                        <tr className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px]">
                                          <th className="py-1.5 px-2.5">#</th>
                                          <th className="py-1.5 px-2.5">Customer DC No</th>
                                          <th className="py-1.5 px-2.5">Customer DC Date</th>
                                          <th className="py-1.5 px-2.5">Item Name</th>
                                          <th className="py-1.5 px-2.5">Style No</th>
                                          <th className="py-1.5 px-2.5">Wash / Process Type</th>
                                          <th className="py-1.5 px-2.5 text-right">Quantity</th>
                                          <th className="py-1.5 px-2.5 text-right">Dispatched</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {(po.items || []).map((it, iIdx) => (
                                          <tr key={it.id || iIdx} className="hover:bg-slate-50/50">
                                            <td className="py-1.5 px-2.5 text-slate-400 font-mono">
                                              {iIdx + 1}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-bold font-mono text-slate-900">
                                              DC #{it.customerDcNumber || po.customerDcNumber || '—'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-slate-600">
                                              {formatDisplayDate(it.customerDcDate || po.customerDcDate)}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-bold text-slate-800">
                                              {it.itemName}
                                            </td>
                                            <td className="py-1.5 px-2.5 font-mono font-semibold text-slate-700">
                                              {it.styleNo || '—'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-slate-700 font-medium">
                                              {it.washType || '—'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-black font-mono text-slate-900">
                                              {it.quantity} {it.unit || 'PCS'}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-mono text-slate-600">
                                              {it.dispatchedQuantity || 0} {it.unit || 'PCS'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                <TableTotalsFooter
                  cells={[
                    { colSpan: 6, label: `Total (${filteredAndSortedPos.length} Sample Orders)`, isTotal: true },
                    { quantity: sampleTotals, unit: 'piece', isTotal: true },
                    { content: '—', align: 'center' },
                    { content: '—', align: 'center' },
                    { content: '—', align: 'center', className: 'pr-12' }
                  ]}
                />
              </table>
            </div>

            {/* Single Stretch Display Summary Note */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <div>
                Showing all <strong>{filteredAndSortedPos.length}</strong> records in one stretch
                {filteredAndSortedPos.length !== samplePos.length && (
                  <span className="text-slate-400 ml-1">
                    (filtered from {samplePos.length} total)
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Perla ERP • Sample Inward Management
              </div>
            </div>
          </div>
        )}
      </TableMaximizeWrapper>
      </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT SAMPLE PO */}
      {/* ========================================================================= */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddEditModalOpen(false)}
          title={editingPo ? `Edit Sample PO: ${editingPo.entryNumber}` : 'Record New Sample PO Inward'}
          maxWidth="5xl"
        >
          <form onSubmit={handleSavePo} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1 text-xs">
            {/* Header Meta Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#1F4E79]" />
                <span>Challan &amp; Customer Information</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Entry Number */}
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Entry Number
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formState.entryNumber}
                    className="w-full bg-slate-100 border border-slate-200 rounded p-2 text-xs font-mono font-bold text-slate-600"
                  />
                </div>

                {/* Customer / Vendor Selection */}
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Customer / Vendor <span className="text-rose-500">*</span>
                  </label>
                  {!formState.isManualVendor && vendors.length > 0 ? (
                    <select
                      value={formState.vendorId}
                      onChange={(e) => {
                        const vid = e.target.value;
                        const v = vendors.find((vend) => (vend.vendorId || vend.id) === vid);
                        if (v) {
                          setFormState({
                            ...formState,
                            vendorId: getVendorId(v),
                            vendorName: getVendorName(v),
                            vendorAddress: formatVendorAddress(v.address),
                            vendorGst: getVendorGst(v)
                          });
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                    >
                      <option value="">Select Customer from Vendor Master...</option>
                      {vendors.map((v) => {
                        const vid = getVendorId(v);
                        const vname = getVendorName(v);
                        return (
                          <option key={vid} value={vid}>
                            {vname}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={formState.vendorName}
                      onChange={(e) => setFormState({ ...formState, vendorName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        isManualVendor: !prev.isManualVendor,
                        vendorId: prev.isManualVendor ? getVendorId(vendors[0]) : ''
                      }))
                    }
                    className="text-[10px] text-[#1F4E79] underline mt-1 block cursor-pointer"
                  >
                    {formState.isManualVendor ? '← Select from Master List' : '+ Enter Customer Manually'}
                  </button>
                </div>

                {/* Dispatch Status */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Dispatch Status
                  </label>
                  <select
                    value={formState.dispatchStatus}
                    onChange={(e) =>
                      setFormState({ ...formState, dispatchStatus: e.target.value as SamplePoDispatchStatus })
                    }
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Status */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState({ ...formState, status: e.target.value as SamplePoStatus })
                    }
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                  >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items Card */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                  <Shirt className="w-3.5 h-3.5 text-[#1F4E79]" />
                  <span>Sample Line Items ({formState.items.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddItemLine}
                  className="px-2.5 py-1 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg bg-white">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2 min-w-[110px]">
                        Customer DC No <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-2 min-w-[130px]">
                        Customer DC Date <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-2 min-w-[140px]">
                        Item Name <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-2 min-w-[100px]">Style No</th>
                      <th className="py-2 px-2 min-w-[130px]">Wash / Process</th>
                      <th className="py-2 px-2 text-right w-20">
                        Qty <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2 px-2 w-20">Unit</th>
                      <th className="py-2 px-2 text-center w-10">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formState.items.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-2 text-center text-slate-400 font-mono font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            required
                            value={line.customerDcNumber}
                            onChange={(e) => handleUpdateItemLine(idx, 'customerDcNumber', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold font-mono"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="date"
                            required
                            value={line.customerDcDate || ''}
                            onChange={(e) => handleUpdateItemLine(idx, 'customerDcDate', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            required
                            value={line.itemName}
                            onChange={(e) => handleUpdateItemLine(idx, 'itemName', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={line.styleNo}
                            onChange={(e) => handleUpdateItemLine(idx, 'styleNo', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            list={`wash-list-${idx}`}
                            type="text"
                            value={line.washType}
                            onChange={(e) => handleUpdateItemLine(idx, 'washType', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                          />
                          <datalist id={`wash-list-${idx}`}>
                            {COMMON_WASH_TYPES.map((w) => (
                              <option key={w} value={w} />
                            ))}
                          </datalist>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={line.quantity || ''}
                            onChange={(e) => handleUpdateItemLine(idx, 'quantity', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-black font-mono text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={line.unit || 'PCS'}
                            onChange={(e) => handleUpdateItemLine(idx, 'unit', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold"
                          >
                            {COMMON_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {formState.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemLine(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                              title="Delete line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t border-slate-200">
                      <td colSpan={6} className="py-2 px-2 text-right uppercase text-[10.5px] text-slate-700">
                        Total Quantity:
                      </td>
                      <td className="py-2 px-2 text-right font-black font-mono text-slate-900 text-sm">
                        {currentTotalCalculated.toLocaleString()}
                      </td>
                      <td colSpan={2} className="py-2 px-2 text-slate-500 font-semibold">
                        {formState.items[0]?.unit || 'PCS'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Remarks / Special Instructions
              </label>
              <textarea
                rows={2}
                value={formState.remarks}
                onChange={(e) => setFormState({ ...formState, remarks: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                All records save directly to Firestore collection: <code className="font-mono font-bold">sample_po_inwards</code>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddEditModalOpen(false)}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Saving...' : editingPo ? 'Update Sample PO' : 'Save Sample PO'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW DETAILS MODAL */}
      {/* ========================================================================= */}
      {viewDetailsPo && (
        <Modal
          isOpen={true}
          onClose={() => setViewDetailsPo(null)}
          title={`Sample PO Details: ${viewDetailsPo.entryNumber}`}
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Summary Grid */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Entry No</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{viewDetailsPo.entryNumber}</span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Customer DC</span>
                <span className="font-bold text-slate-800">
                  DC #{viewDetailsPo.customerDcNumber || viewDetailsPo.items?.[0]?.customerDcNumber || '—'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Date: {viewDetailsPo.customerDcDate || viewDetailsPo.items?.[0]?.customerDcDate || '—'}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Total Qty</span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {viewDetailsPo.totalQuantity.toLocaleString()} {viewDetailsPo.items?.[0]?.unit || 'PCS'}
                </span>
              </div>
              <div>
                <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Dispatch Status</span>
                <div className="mt-0.5">{getDispatchBadge(viewDetailsPo.dispatchStatus)}</div>
              </div>
            </div>

            {/* Vendor Info */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Customer / Vendor</span>
              <p className="font-bold text-slate-900 text-sm">{viewDetailsPo.vendorName}</p>
              {viewDetailsPo.vendorGst && (
                <p className="text-[11px] text-slate-500 font-mono">GST: {viewDetailsPo.vendorGst}</p>
              )}
              {viewDetailsPo.vendorAddress && (
                <p className="text-[11px] text-slate-500">{viewDetailsPo.vendorAddress}</p>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <h5 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                Line Items Breakdown
              </h5>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold text-[10.5px]">
                      <th className="p-2">#</th>
                      <th className="p-2">Customer DC No</th>
                      <th className="p-2">Customer DC Date</th>
                      <th className="p-2">Item Name</th>
                      <th className="p-2">Style No</th>
                      <th className="p-2">Wash Type</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2 text-right">Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewDetailsPo.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold text-slate-900">
                          DC #{it.customerDcNumber || viewDetailsPo.customerDcNumber || '—'}
                        </td>
                        <td className="p-2 text-slate-600">
                          {formatDisplayDate(it.customerDcDate || viewDetailsPo.customerDcDate)}
                        </td>
                        <td className="p-2 font-bold text-slate-900">{it.itemName}</td>
                        <td className="p-2 font-mono">{it.styleNo || '—'}</td>
                        <td className="p-2">{it.washType || '—'}</td>
                        <td className="p-2 text-right font-bold font-mono">
                          {it.quantity} {it.unit}
                        </td>
                        <td className="p-2 text-right font-mono text-slate-500">
                          {it.dispatchedQuantity || 0} {it.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Remarks & Auditing */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex justify-between items-center">
              <div>
                {viewDetailsPo.remarks && (
                  <p>
                    <strong>Remarks:</strong> {viewDetailsPo.remarks}
                  </p>
                )}
                <p className="text-slate-400 mt-0.5">
                  Created by: {viewDetailsPo.createdByName || 'Staff'} • Status: {viewDetailsPo.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => SamplePoPdfService.downloadSingleSamplePoPdf(viewDetailsPo)}
                  icon={<Printer className="w-4 h-4 text-rose-600" />}
                >
                  Download as PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = viewDetailsPo;
                    setViewDetailsPo(null);
                    handleOpenEditModal(target);
                  }}
                >
                  Edit Sample PO
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteConfirmPo && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmPo(null)}
          title="Confirm Deletion"
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Are you sure you want to permanently delete Sample PO{' '}
              <strong className="text-slate-900 font-mono font-bold">
                {deleteConfirmPo.entryNumber}
              </strong>
              ?
            </p>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px]">
              This action will remove the record and all {deleteConfirmPo.items?.length || 0} line items
              from the system.
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmPo(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeletePo}
                disabled={actionLoading}
                icon={actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
