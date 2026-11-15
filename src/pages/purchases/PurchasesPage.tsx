import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  RawMaterialPurchase,
  PurchaseLineItem,
  PurchaseStatus,
  PurchaseType,
  PurchaseFilterOptions
} from '../../types/purchase';
import { RawMaterialPurchaseService } from '../../services/rawMaterialPurchaseService';
import { ItemService } from '../../services/itemService';
import { VendorService } from '../../services/vendorService';
import { MasterItem } from '../../types/item';
import { Vendor } from '../../types/vendor';
import { Card } from '../../components/ui/Card';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Truck,
  Printer,
  FileText,
  AlertCircle,
  RefreshCw,
  Building2,
  Trash2
} from 'lucide-react';

interface MaterialLineInput {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  quantity: number | '';
  unit: string;
  rate: number | '';
  amount: number;
  remarks: string;
}

export const PurchasesPage: React.FC = () => {
  const { user } = useAuth();

  // Purchases List & Masters
  const [purchases, setPurchases] = useState<RawMaterialPurchase[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | PurchaseType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<RawMaterialPurchase | null>(null);

  // Form State (New / Edit Purchase)
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('Raw Material');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorId, setVendorId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formLines, setFormLines] = useState<MaterialLineInput[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const currentUser = {
    uid: user?.uid || 'user-1',
    name: user?.displayName || user?.email || 'Supervisor'
  };

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [purchasesRes, itemsRes, vendorsRes] = await Promise.all([
        RawMaterialPurchaseService.getPurchases(),
        ItemService.getItems(undefined, { page: 1, pageSize: 250 }),
        VendorService.getVendors({}, { page: 1, pageSize: 250 })
      ]);

      setPurchases(purchasesRes);
      setMasterItems(itemsRes.items || []);
      setVendors(vendorsRes.vendors || []);
    } catch (err: any) {
      console.error('Error loading purchase data:', err);
      showToast('error', err.message || 'Failed to load purchase records from Firebase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Purchases
  const filteredPurchases = purchases.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.purchaseNumber.toLowerCase().includes(q) ||
      p.vendorName.toLowerCase().includes(q) ||
      p.supplierInvoiceNo.toLowerCase().includes(q) ||
      p.lines?.some((l) => l.itemName.toLowerCase().includes(q) || l.itemCode.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || p.purchaseType === typeFilter;
    const matchesStart = !startDate || p.purchaseDate >= startDate;
    const matchesEnd = !endDate || p.purchaseDate <= endDate;

    return matchesSearch && matchesStatus && matchesType && matchesStart && matchesEnd;
  });

  // KPI Calculations
  const totalCount = purchases.length;
  const totalSpend = purchases.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
  const draftCount = purchases.filter((p) => p.status === 'Draft').length;
  const confirmedCount = purchases.filter((p) => p.status === 'Confirmed').length;
  const receivedCount = purchases.filter((p) => p.status === 'Received').length;

  // Form Line Add / Remove / Change Handlers
  const handleAddLine = () => {
    if (masterItems.length === 0) {
      showToast('error', 'No items found in Item Master. Please create items first.');
      return;
    }
    const defaultItem = masterItems[0];
    const newLine: MaterialLineInput = {
      lineId: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      itemId: defaultItem.id,
      itemCode: defaultItem.itemCode || '',
      itemName: defaultItem.itemName || '',
      categoryName: defaultItem.categoryName || '',
      quantity: '',
      unit: defaultItem.baseUnit || 'kg',
      rate: defaultItem.defaultPurchaseRate !== undefined ? defaultItem.defaultPurchaseRate : '',
      amount: 0,
      remarks: ''
    };
    setFormLines((prev) => [...prev, newLine]);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, selectedItemId: string) => {
    const targetItem = masterItems.find((m) => m.id === selectedItemId);
    if (!targetItem) return;

    setFormLines((prev) => {
      const copy = [...prev];
      const cur = copy[index];
      const qty = Number(cur.quantity) || 0;
      const rate = targetItem.defaultPurchaseRate !== undefined ? targetItem.defaultPurchaseRate : (Number(cur.rate) || 0);
      copy[index] = {
        ...cur,
        itemId: targetItem.id,
        itemCode: targetItem.itemCode || '',
        itemName: targetItem.itemName || '',
        categoryName: targetItem.categoryName || '',
        unit: targetItem.baseUnit || 'kg',
        rate: rate > 0 ? rate : '',
        amount: Math.round(qty * rate * 100) / 100
      };
      return copy;
    });
  };

  const handleLineFieldChange = (
    index: number,
    field: 'quantity' | 'rate' | 'remarks',
    val: any
  ) => {
    setFormLines((prev) => {
      const copy = [...prev];
      const line = { ...copy[index] };

      if (field === 'quantity') {
        line.quantity = val === '' ? '' : Number(val);
      } else if (field === 'rate') {
        line.rate = val === '' ? '' : Number(val);
      } else {
        line.remarks = val;
      }

      const q = Number(line.quantity) || 0;
      const r = Number(line.rate) || 0;
      line.amount = Math.round(q * r * 100) / 100;

      copy[index] = line;
      return copy;
    });
  };

  // Calculated totals for form
  const formTotalQuantity = formLines.reduce(
    (acc, curr) => acc + (Number(curr.quantity) || 0),
    0
  );
  const formGrandTotal = formLines.reduce((acc, curr) => acc + curr.amount, 0);

  // Open Create Purchase Modal
  const handleOpenCreateModal = () => {
    setIsEditMode(false);
    setEditingPurchaseId(null);
    setPurchaseType('Raw Material');
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setVendorId(vendors.length > 0 ? (vendors[0].vendorId || vendors[0].id || '') : '');
    setSupplierInvoiceNo('');
    setSupplierInvoiceDate(new Date().toISOString().split('T')[0]);
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setRemarks('');

    if (masterItems.length > 0) {
      const first = masterItems[0];
      setFormLines([
        {
          lineId: `line_${Date.now()}`,
          itemId: first.id,
          itemCode: first.itemCode || '',
          itemName: first.itemName || '',
          categoryName: first.categoryName || '',
          quantity: '',
          unit: first.baseUnit || 'kg',
          rate: first.defaultPurchaseRate || '',
          amount: 0,
          remarks: ''
        }
      ]);
    } else {
      setFormLines([]);
    }

    setIsEntryModalOpen(true);
  };

  // Open Edit Draft Purchase Modal
  const handleOpenEditModal = (purchase: RawMaterialPurchase) => {
    if (purchase.status !== 'Draft') {
      showToast('error', `Cannot edit purchase in '${purchase.status}' status. Only Draft purchases can be edited.`);
      return;
    }

    setIsEditMode(true);
    setEditingPurchaseId(purchase.id);
    setPurchaseType(purchase.purchaseType || 'Raw Material');
    setPurchaseDate(purchase.purchaseDate);
    setVendorId(purchase.vendorId);
    setSupplierInvoiceNo(purchase.supplierInvoiceNo);
    setSupplierInvoiceDate(purchase.supplierInvoiceDate || purchase.purchaseDate);
    setVehicleNo(purchase.vehicleNo || '');
    setDriverName(purchase.driverName || '');
    setDriverPhone(purchase.driverPhone || '');
    setRemarks(purchase.remarks || '');

    setFormLines(
      purchase.lines.map((l) => ({
        lineId: l.lineId,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        categoryName: l.categoryName || '',
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        amount: l.amount,
        remarks: l.remarks || ''
      }))
    );

    setIsEntryModalOpen(true);
  };

  // Save Purchase (Draft or Confirmed)
  const handleSavePurchase = async (intendedStatus: PurchaseStatus) => {
    if (!vendorId) {
      showToast('error', 'Please select a supplier from Vendor Master.');
      return;
    }
    const selectedVendor = vendors.find((v) => (v.vendorId || v.id) === vendorId);
    if (!selectedVendor) {
      showToast('error', 'Invalid supplier selected.');
      return;
    }
    if (!supplierInvoiceNo.trim()) {
      showToast('error', 'Supplier invoice / DC number is required.');
      return;
    }
    if (formLines.length === 0) {
      showToast('error', 'Please add at least one material line item.');
      return;
    }

    for (let i = 0; i < formLines.length; i++) {
      const line = formLines[i];
      const q = Number(line.quantity);
      if (!q || q <= 0) {
        showToast('error', `Please enter a valid quantity greater than 0 for line #${i + 1} (${line.itemName}).`);
        return;
      }
      const r = Number(line.rate);
      if (r < 0 || isNaN(r)) {
        showToast('error', `Please enter a valid rate for line #${i + 1} (${line.itemName}).`);
        return;
      }
    }

    setFormSubmitting(true);
    try {
      const cleanLines = formLines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        categoryName: l.categoryName,
        quantity: Number(l.quantity),
        unit: l.unit,
        rate: Number(l.rate) || 0,
        remarks: l.remarks
      }));

      if (isEditMode && editingPurchaseId) {
        await RawMaterialPurchaseService.updatePurchase(
          editingPurchaseId,
          {
            purchaseType,
            purchaseDate,
            vendorId,
            vendorName: selectedVendor.companyName,
            vendorCode: selectedVendor.vendorCode,
            supplierInvoiceNo: supplierInvoiceNo.trim(),
            supplierInvoiceDate,
            vehicleNo: vehicleNo.trim(),
            driverName: driverName.trim(),
            driverPhone: driverPhone.trim(),
            remarks: remarks.trim(),
            lines: cleanLines.map((l, idx) => ({
              lineId: `line_${idx + 1}`,
              ...l,
              amount: Math.round(l.quantity * l.rate * 100) / 100
            }))
          },
          currentUser
        );
        showToast('success', 'Purchase entry updated successfully.');
      } else {
        const created = await RawMaterialPurchaseService.createPurchase(
          {
            purchaseType,
            purchaseDate,
            vendorId,
            vendorName: selectedVendor.companyName,
            vendorCode: selectedVendor.vendorCode,
            supplierInvoiceNo: supplierInvoiceNo.trim(),
            supplierInvoiceDate,
            vehicleNo: vehicleNo.trim(),
            driverName: driverName.trim(),
            driverPhone: driverPhone.trim(),
            remarks: remarks.trim(),
            status: intendedStatus,
            lines: cleanLines
          },
          currentUser
        );
        showToast('success', `Purchase entry ${created.purchaseNumber} created as ${intendedStatus}.`);
      }

      setIsEntryModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      showToast('error', err.message || 'Failed to save purchase entry.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm Purchase Action
  const handleConfirmPurchase = async (purchase: RawMaterialPurchase) => {
    try {
      await RawMaterialPurchaseService.confirmPurchase(purchase.id, currentUser);
      showToast('success', `Purchase ${purchase.purchaseNumber} is now Confirmed and ready for warehouse inward.`);
      await loadData(true);
      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase((prev) => (prev ? { ...prev, status: 'Confirmed' } : null));
      }
    } catch (err: any) {
      console.error('Error confirming purchase:', err);
      showToast('error', err.message || 'Failed to confirm purchase.');
    }
  };

  // Receive and Inward Goods into Warehouse
  const handleReceiveGoods = async (purchase: RawMaterialPurchase) => {
    if (!window.confirm(`Receive and inward ${purchase.totalQuantity} units from ${purchase.vendorName} into warehouse stock?`)) {
      return;
    }

    try {
      const res = await RawMaterialPurchaseService.receivePurchase(purchase.id, currentUser);
      showToast('success', `Purchase ${purchase.purchaseNumber} received! Added ${res.inwardCount} material lines into warehouse stock.`);
      await loadData(true);
      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase(res.purchase);
      }
    } catch (err: any) {
      console.error('Error receiving goods:', err);
      showToast('error', err.message || 'Failed to receive materials into warehouse stock.');
    }
  };

  // Cancel Purchase Action
  const handleCancelPurchase = async (purchase: RawMaterialPurchase) => {
    const reason = window.prompt('Please enter reason for cancellation:');
    if (!reason || !reason.trim()) return;

    try {
      await RawMaterialPurchaseService.cancelPurchase(purchase.id, reason.trim(), currentUser);
      showToast('success', `Purchase ${purchase.purchaseNumber} has been cancelled.`);
      await loadData(true);
      if (selectedPurchase?.id === purchase.id) {
        setSelectedPurchase((prev) => (prev ? { ...prev, status: 'Cancelled' } : null));
      }
    } catch (err: any) {
      console.error('Error cancelling purchase:', err);
      showToast('error', err.message || 'Failed to cancel purchase.');
    }
  };

  // Open Details Modal
  const handleOpenDetails = (purchase: RawMaterialPurchase) => {
    setSelectedPurchase(purchase);
    setIsDetailsModalOpen(true);
  };

  // Open Print Modal
  const handleOpenPrint = (purchase: RawMaterialPurchase) => {
    setSelectedPurchase(purchase);
    setIsPrintModalOpen(true);
  };

  // Table Columns
  const purchaseColumns: Column<RawMaterialPurchase>[] = [
    {
      header: 'Purchase No',
      accessor: (row) => (
        <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.purchaseNumber}</span>
      )
    },
    {
      header: 'Date',
      accessor: (row) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDate(row.purchaseDate)}</span>
    },
    {
      header: 'Supplier / Vendor',
      accessor: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{row.vendorName}</div>
          <div className="text-[11px] text-slate-400">Inv: {row.supplierInvoiceNo}</div>
        </div>
      )
    },
    {
      header: 'Material Line Items',
      accessor: (row) => (
        <div className="max-w-[280px]">
          <div className="text-xs text-slate-800 line-clamp-1">
            {row.lines?.map((l) => `${l.itemName} (${l.quantity} ${l.unit})`).join(', ')}
          </div>
          <div className="text-[11px] text-slate-400">
            {row.lines?.length || 0} line item(s) • Type: {row.purchaseType}
          </div>
        </div>
      )
    },
    {
      header: 'Total Qty',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.totalQuantity}</span>
      )
    },
    {
      header: 'Grand Total',
      accessor: (row) => (
        <span className="font-bold text-xs text-slate-900">{formatCurrency(row.grandTotal)}</span>
      )
    },
    {
      header: 'Status',
      accessor: (row) => {
        let variant: 'amber' | 'blue' | 'green' | 'rose' = 'amber';
        if (row.status === 'Confirmed') variant = 'blue';
        if (row.status === 'Received') variant = 'green';
        if (row.status === 'Cancelled') variant = 'rose';
        return <StatusChip status={row.status} variant={variant} />;
      }
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            onClick={() => handleOpenDetails(row)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#1F4E79] hover:text-white transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="View Details"
          >
            View
          </button>

          {row.status === 'Draft' && (
            <>
              <button
                onClick={() => handleOpenEditModal(row)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-200 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                title="Edit Draft"
              >
                Edit
              </button>
              <button
                onClick={() => handleConfirmPurchase(row)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 shadow-2xs cursor-pointer"
                title="Confirm Purchase"
              >
                Confirm
              </button>
              <button
                onClick={() => handleCancelPurchase(row)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
                title="Cancel"
              >
                Cancel
              </button>
            </>
          )}

          {row.status === 'Confirmed' && (
            <>
              <button
                onClick={() => handleReceiveGoods(row)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs cursor-pointer"
                title="Receive Goods into Warehouse Stock"
              >
                Receive & Inward
              </button>
              <button
                onClick={() => handleCancelPurchase(row)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
                title="Cancel"
              >
                Cancel
              </button>
            </>
          )}

          {row.status === 'Received' && (
            <button
              onClick={() => handleOpenPrint(row)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-200 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
              title="Print Goods Receipt Voucher"
            >
              Print
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/25'
              : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/25'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-white" />
          ) : (
            <XCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Banner KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Total Purchases</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Purchases recorded</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Total Value</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{formatCurrency(totalSpend)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Gross purchase volume</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Pending Inward</span>
            <AlertCircle className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-700">{confirmedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Confirmed, awaiting receipt</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Received & Inwarded</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{receivedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Added to warehouse stock</div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Header & Actions */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 border border-slate-200 p-1 rounded-xl bg-slate-50 text-xs font-semibold">
            {(['ALL', 'Draft', 'Confirmed', 'Received', 'Cancelled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#1F4E79] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {st === 'ALL' ? 'All Purchases' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F4E79] hover:bg-[#163a5c] transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Purchase Entry
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1F4E79]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search purchase no, supplier, invoice no, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="ALL">All Types</option>
              <option value="Raw Material">Raw Material</option>
              <option value="Chemical">Chemical</option>
              <option value="Firewood">Firewood</option>
              <option value="Packaging">Packaging</option>
              <option value="General">General</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700"
            />
          </div>
        </div>

        {/* Purchases Table */}
        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1F4E79] mb-2" />
              Loading purchase entries from Firebase...
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No purchase entries found matching the selected criteria.
            </div>
          ) : (
            <Table
              columns={purchaseColumns}
              data={filteredPurchases}
              keyExtractor={(row) => row.id}
            />
          )}
        </div>
      </div>

      {/* MODAL 1: PURCHASE ENTRY (CREATE / EDIT) */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title={isEditMode ? 'Edit Draft Purchase Entry' : 'New Raw Material Purchase Entry'}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purchase Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value as any)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="Raw Material">Raw Material Purchase</option>
                <option value="Chemical">Chemical Purchase</option>
                <option value="Firewood">Firewood / Fuel Purchase</option>
                <option value="Packaging">Packaging Materials</option>
                <option value="General">General Consumables</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Purchase Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Supplier / Vendor <span className="text-rose-500">*</span>
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="">-- Choose From Vendor Master --</option>
                {vendors.map((v) => (
                  <option key={v.vendorId || v.id} value={v.vendorId || v.id}>
                    {v.companyName} {v.vendorCode ? `(${v.vendorCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier Invoice / DC No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-901, DC-WOOD-44"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Date</label>
              <input
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle No</label>
              <input
                type="text"
                placeholder="e.g. TN-22-BY-8901"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Driver Name & Phone</label>
              <input
                type="text"
                placeholder="e.g. S. Kumar (9876543210)"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>
          </div>

          {/* Multiple Material Entries Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Materials & Line Items ({formLines.length})
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-[#1F4E79] bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
              >
                + Add Material Line
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-2.5">Material / Item</th>
                    <th className="p-2.5 w-24">Unit</th>
                    <th className="p-2.5 w-28">Quantity</th>
                    <th className="p-2.5 w-32">Rate (₹)</th>
                    <th className="p-2.5 w-32 text-right">Amount (₹)</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {formLines.map((line, idx) => (
                    <tr key={line.lineId}>
                      <td className="p-2.5">
                        <select
                          value={line.itemId}
                          onChange={(e) => handleLineItemChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        >
                          {masterItems.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.itemName} ({m.itemCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-slate-700 uppercase">{line.unit}</td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="0"
                          value={line.quantity === '' ? '' : line.quantity}
                          onChange={(e) => handleLineFieldChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={line.rate === '' ? '' : line.rate}
                          onChange={(e) => handleLineFieldChange(idx, 'rate', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                        />
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                        {formatCurrency(line.amount)}
                      </td>
                      <td className="p-2.5 text-center">
                        {formLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            title="Remove Line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Summary */}
              <div className="p-3 bg-slate-100/60 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">
                  Total Items: <span className="text-slate-900 font-bold">{formLines.length}</span> | Total Quantity:{' '}
                  <span className="text-slate-900 font-bold">{formTotalQuantity}</span>
                </span>
                <span className="text-sm font-black text-[#1F4E79]">
                  Grand Total: {formatCurrency(formGrandTotal)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks & Observations (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Weighbridge gross/tare recorded, quality verified..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEntryModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={() => handleSavePurchase('Draft')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition shadow-2xs cursor-pointer"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={() => handleSavePurchase('Confirmed')}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F4E79] hover:bg-[#163a5c] transition shadow-2xs cursor-pointer"
            >
              {formSubmitting ? 'Saving...' : 'Save & Confirm Purchase'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: PURCHASE DETAILS & STATUS WORKFLOW */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Purchase Details — ${selectedPurchase?.purchaseNumber || ''}`}
        maxWidth="4xl"
      >
        {selectedPurchase && (
          <div className="space-y-4 text-xs">
            {/* Header Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-500">Purchase No:</span>
                <div className="font-bold text-[#1F4E79] font-mono">{selectedPurchase.purchaseNumber}</div>
              </div>
              <div>
                <span className="text-slate-500">Purchase Date:</span>
                <div className="font-semibold text-slate-800">{formatDate(selectedPurchase.purchaseDate)}</div>
              </div>
              <div>
                <span className="text-slate-500">Supplier:</span>
                <div className="font-bold text-slate-900">{selectedPurchase.vendorName}</div>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>
                <div className="mt-0.5">
                  <StatusChip status={selectedPurchase.status} />
                </div>
              </div>

              <div>
                <span className="text-slate-500">Supplier Invoice No:</span>
                <div className="font-mono font-semibold text-slate-800">{selectedPurchase.supplierInvoiceNo}</div>
              </div>
              <div>
                <span className="text-slate-500">Vehicle No:</span>
                <div className="font-mono text-slate-800">{selectedPurchase.vehicleNo || '-'}</div>
              </div>
              <div>
                <span className="text-slate-500">Total Quantity:</span>
                <div className="font-bold text-slate-900">{selectedPurchase.totalQuantity}</div>
              </div>
              <div>
                <span className="text-slate-500">Grand Total:</span>
                <div className="font-bold text-emerald-700 text-sm">{formatCurrency(selectedPurchase.grandTotal)}</div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="font-bold text-slate-800 uppercase tracking-wider mb-2">Material Line Breakdown</div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="p-2.5">Item Code</th>
                      <th className="p-2.5">Material Name</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5">Rate (₹)</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {selectedPurchase.lines?.map((line) => (
                      <tr key={line.lineId}>
                        <td className="p-2.5 font-mono font-bold text-[#1F4E79]">{line.itemCode}</td>
                        <td className="p-2.5 font-bold text-slate-900">{line.itemName}</td>
                        <td className="p-2.5 text-slate-700">{line.categoryName || 'General'}</td>
                        <td className="p-2.5 font-mono">
                          {line.quantity} {line.unit}
                        </td>
                        <td className="p-2.5 font-mono">{formatCurrency(line.rate)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedPurchase.remarks && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700">Remarks:</span> {selectedPurchase.remarks}
              </div>
            )}

            {/* Workflow Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenPrint(selectedPurchase)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Voucher
                </button>
              </div>

              <div className="flex items-center gap-2">
                {selectedPurchase.status === 'Draft' && (
                  <>
                    <button
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleOpenEditModal(selectedPurchase);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleConfirmPurchase(selectedPurchase)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                    >
                      Confirm Purchase
                    </button>
                    <button
                      onClick={() => handleCancelPurchase(selectedPurchase)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {selectedPurchase.status === 'Confirmed' && (
                  <>
                    <button
                      onClick={() => handleReceiveGoods(selectedPurchase)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Receive & Inward Goods
                    </button>
                    <button
                      onClick={() => handleCancelPurchase(selectedPurchase)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {selectedPurchase.status === 'Received' && (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Stock Inward Completed
                  </span>
                )}

                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: PRINTABLE GOODS RECEIPT / PURCHASE VOUCHER */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title="Print Goods Receipt Voucher"
        maxWidth="4xl"
      >
        {selectedPurchase && (
          <div className="space-y-4">
            <div id="printable-purchase-voucher" className="p-6 bg-white border border-slate-300 rounded-xl space-y-4 text-xs font-sans">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-lg font-black text-slate-900">PERLA TEXTILES PROCESSORS</h1>
                  <p className="text-[11px] text-slate-500">Fabric Processing, Bleaching, Dyeing & Finishing Mills</p>
                  <p className="text-[10px] text-slate-400">Tirupur, Tamil Nadu • GSTIN: 33AAAAA0000A1Z5</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-[#1F4E79] uppercase tracking-wide">
                    GOODS RECEIPT / PURCHASE VOUCHER
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-xs mt-1">{selectedPurchase.purchaseNumber}</div>
                  <div className="text-[11px] text-slate-500">Date: {formatDate(selectedPurchase.purchaseDate)}</div>
                </div>
              </div>

              {/* Vendor & Delivery Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Supplier / Vendor</div>
                  <div className="font-bold text-slate-900 text-xs">{selectedPurchase.vendorName}</div>
                  <div className="text-[11px] text-slate-500">Code: {selectedPurchase.vendorCode || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Invoice & Delivery Info</div>
                  <div className="text-slate-800">
                    Invoice / DC No: <strong>{selectedPurchase.supplierInvoiceNo}</strong>
                  </div>
                  <div className="text-slate-800">
                    Vehicle No: <strong>{selectedPurchase.vehicleNo || 'Direct Transport'}</strong>
                  </div>
                  <div className="text-slate-800">
                    Driver: <strong>{selectedPurchase.driverName || '-'}</strong>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold text-slate-700 uppercase">
                    <th className="p-2 border-r border-slate-300">#</th>
                    <th className="p-2 border-r border-slate-300">Item Code</th>
                    <th className="p-2 border-r border-slate-300">Description / Material</th>
                    <th className="p-2 border-r border-slate-300 text-right">Quantity</th>
                    <th className="p-2 border-r border-slate-300 text-right">Rate (₹)</th>
                    <th className="p-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPurchase.lines?.map((line, idx) => (
                    <tr key={line.lineId}>
                      <td className="p-2 border-r border-slate-300 text-slate-500">{idx + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-800">{line.itemCode}</td>
                      <td className="p-2 border-r border-slate-300 font-bold text-slate-900">{line.itemName}</td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">{formatCurrency(line.rate)}</td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">{formatCurrency(line.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <td colSpan={3} className="p-2 text-right uppercase">
                      Total:
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-mono">
                      {selectedPurchase.totalQuantity}
                    </td>
                    <td className="p-2 border-r border-slate-300"></td>
                    <td className="p-2 text-right font-mono font-black text-slate-900">
                      {formatCurrency(selectedPurchase.grandTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-10 grid grid-cols-3 gap-4 text-center text-slate-600 text-[11px]">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">Storekeeper / Receiver</div>
                  <div className="text-[10px] text-slate-400">{selectedPurchase.receivedByName || selectedPurchase.createdByName}</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">Quality & Weighbridge Incharge</div>
                  <div className="text-[10px] text-slate-400">Verified</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">Authorized Signatory</div>
                  <div className="text-[10px] text-slate-400">Perla Textiles Processors</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F4E79] hover:bg-[#163a5c] transition cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </button>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
