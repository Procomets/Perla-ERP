import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { WarehouseItemStock, StockTransaction, StockHealthStatus } from '../../types/warehouse';
import { WarehouseService } from '../../services/warehouseService';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency } from '../../utils/formatters';
import {
  Warehouse,
  Package,
  ArrowDownLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  IndianRupee
} from 'lucide-react';
import ExcelJS from 'exceljs';

export const WarehousePage: React.FC = () => {
  const { user } = useAuth();

  // Active Tab: 'overview' (Stock Overview) or 'inward' (Inward Receipts)
  const [activeTab, setActiveTab] = useState<'overview' | 'inward'>('overview');

  // Live Data directly from Firebase
  const [stockItems, setStockItems] = useState<WarehouseItemStock[]>([]);
  const [inwardTransactions, setInwardTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<StockHealthStatus | 'ALL'>('ALL');

  // Inward Modal
  const [isInwardModalOpen, setIsInwardModalOpen] = useState(false);
  const [inwardItemId, setInwardItemId] = useState('');
  const [inwardQuantity, setInwardQuantity] = useState<number | ''>('');
  const [inwardSource, setInwardSource] = useState<'MANUAL_INWARD' | 'PURCHASE_RECEIPT' | 'FIREWOOD_PURCHASE' | 'RETURN'>('MANUAL_INWARD');
  const [inwardReferenceNo, setInwardReferenceNo] = useState('');
  const [inwardReceivedFrom, setInwardReceivedFrom] = useState('');
  const [inwardDate, setInwardDate] = useState(new Date().toISOString().split('T')[0]);
  const [inwardRemarks, setInwardRemarks] = useState('');
  const [inwardSubmitting, setInwardSubmitting] = useState(false);

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
      // Purge any legacy mock cache from localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('perla_warehouse_stock');
          if (raw && (raw.includes('itm-') || raw.includes('item-chm-') || raw.includes('"itemName":""'))) {
            localStorage.removeItem('perla_warehouse_stock');
          }
        } catch {
          // ignore
        }
      }

      const [stocksRes, txsRes] = await Promise.all([
        WarehouseService.getStockItems(),
        WarehouseService.getStockTransactions({ type: 'INWARD' })
      ]);

      // Retain strictly valid active items from Item Master (must have name and code, never dummy)
      const cleanStocks = stocksRes.filter((it) => {
        const name = (it.itemName || '').trim();
        const code = (it.itemCode || '').trim();
        const isDummy =
          it.id?.startsWith('itm-') ||
          it.itemId?.startsWith('itm-') ||
          it.id?.startsWith('item-chm-') ||
          it.id?.startsWith('item-fwd-') ||
          it.id?.startsWith('item-raw-');
        return Boolean(name) && Boolean(code) && !isDummy;
      });

      setStockItems(cleanStocks);
      setInwardTransactions(txsRes.filter((t) => t.type === 'INWARD'));
    } catch (err: any) {
      console.error('Error loading warehouse data:', err);
      showToast('error', err.message || 'Failed to load live warehouse items from Firebase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Valid Active Items from Item Master
  const validItems = useMemo(
    () => stockItems.filter((i) => Boolean(i.itemName?.trim()) && !i.id?.startsWith('itm-')),
    [stockItems]
  );

  // Top 5 KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];

  const totalStockVolume = useMemo(
    () => validItems.reduce((acc, curr) => acc + (curr.availableStock || 0), 0),
    [validItems]
  );

  const primaryUnit = useMemo(() => {
    if (validItems.length === 0) return 'kg';
    return validItems[0].baseUnit || 'kg';
  }, [validItems]);

  const healthyStockCount = useMemo(
    () => validItems.filter((i) => (i.healthStatus || 'Healthy') === 'Healthy').length,
    [validItems]
  );

  const lowStockCount = useMemo(
    () => validItems.filter((i) => i.healthStatus === 'Low Stock').length,
    [validItems]
  );

  const criticalCount = useMemo(
    () => validItems.filter((i) => i.healthStatus === 'Critical').length,
    [validItems]
  );

  const outOfStockCount = useMemo(
    () => validItems.filter((i) => i.healthStatus === 'Out Of Stock').length,
    [validItems]
  );

  // Total low stock count for KPI card 2 (low stock + critical)
  const totalLowAlertCount = lowStockCount + criticalCount;

  // Received Today Count
  const receivedTodayCount = useMemo(() => {
    return inwardTransactions
      .filter((tx) => tx.date === todayStr)
      .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  }, [inwardTransactions, todayStr]);

  // Total Inventory Value
  const totalInventoryValue = useMemo(() => {
    return validItems.reduce((acc, curr) => {
      const rate = curr.averageRate || 0;
      return acc + (curr.availableStock || 0) * rate;
    }, 0);
  }, [validItems]);

  const formatInventoryValueBadge = (val: number): string => {
    if (!val || val === 0) return '₹0.00';
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)}Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    return formatCurrency(val);
  };

  // Filtered Items for Stock Overview Grid
  const filteredStockItems = useMemo(() => {
    return validItems.filter((item) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q);

      const matchesStatus =
        activeStatusFilter === 'ALL' || item.healthStatus === activeStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [validItems, searchQuery, activeStatusFilter]);

  // Filtered Inward Receipts
  const filteredInwardTransactions = useMemo(() => {
    return inwardTransactions.filter((tx) => {
      const q = searchQuery.trim().toLowerCase();
      return (
        !q ||
        tx.itemName.toLowerCase().includes(q) ||
        tx.itemCode.toLowerCase().includes(q) ||
        tx.referenceNumber.toLowerCase().includes(q) ||
        (tx.receivedFrom && tx.receivedFrom.toLowerCase().includes(q))
      );
    });
  }, [inwardTransactions, searchQuery]);

  // Export to Excel using exceljs
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Warehouse Stock');

      // Title & Header info
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'PERLA TEXTILES PROCESSORS - WAREHOUSE MANAGEMENT OVERVIEW';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' }
      };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 32;

      worksheet.addRow([]);

      const headers = [
        'Item Code',
        'Material / Item Name',
        'Category',
        'Current Stock',
        'Base Unit',
        'Min. Alert Stock',
        'Health Status',
        'Avg. Cost (₹)',
        'Last Received'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 24;
      headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2D3748' }
      };

      filteredStockItems.forEach((it) => {
        const row = worksheet.addRow([
          it.itemCode,
          it.itemName,
          it.categoryName || 'General',
          it.availableStock,
          it.baseUnit,
          it.minimumStockLevel,
          it.healthStatus || 'Healthy',
          it.averageRate && it.averageRate > 0 ? it.averageRate : '—',
          it.lastInwardDate ? formatDate(it.lastInwardDate) : '—'
        ]);
        row.font = { name: 'Arial', size: 10 };
      });

      worksheet.columns.forEach((col) => {
        let maxLen = 12;
        col.eachCell?.({ includeEmpty: false }, (cell) => {
          const val = cell.value ? String(cell.value) : '';
          if (val.length > maxLen) maxLen = val.length;
        });
        col.width = Math.min(35, maxLen + 3);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Perla_Warehouse_Stock_${new Date().toISOString().split('T')[0]}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);

      showToast('success', 'Excel file exported successfully.');
    } catch (err: any) {
      console.error('Excel export error:', err);
      showToast('error', 'Failed to generate Excel file.');
    }
  };

  // Open Inward Entry Modal
  const handleOpenInwardModal = () => {
    if (validItems.length > 0) {
      setInwardItemId(validItems[0].itemId);
    } else {
      setInwardItemId('');
    }
    setInwardQuantity('');
    setInwardSource('MANUAL_INWARD');
    setInwardReferenceNo('');
    setInwardReceivedFrom('');
    setInwardDate(new Date().toISOString().split('T')[0]);
    setInwardRemarks('');
    setIsInwardModalOpen(true);
  };

  // Submit Inward Entry to Firebase
  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inwardItemId) {
      showToast('error', 'Please select an item for stock inward.');
      return;
    }
    const targetItem = validItems.find((s) => s.itemId === inwardItemId);
    const qty = Number(inwardQuantity);
    if (!qty || qty <= 0) {
      showToast('error', 'Please enter a valid inward quantity greater than 0.');
      return;
    }
    if (!inwardReferenceNo.trim()) {
      showToast('error', 'Reference / DC number is required.');
      return;
    }

    setInwardSubmitting(true);
    try {
      await WarehouseService.inwardMaterial(
        {
          itemId: inwardItemId,
          quantity: qty,
          source: inwardSource,
          referenceNumber: inwardReferenceNo.trim(),
          receivedFrom: inwardReceivedFrom.trim(),
          date: inwardDate || new Date().toISOString().split('T')[0],
          remarks: inwardRemarks.trim()
        },
        currentUser
      );

      showToast('success', `Successfully inwarded ${qty} ${targetItem?.baseUnit || ''} of ${targetItem?.itemName || 'material'}. Stock updated.`);
      setIsInwardModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('Inward error:', err);
      showToast('error', err.message || 'Failed to record inward in Firebase.');
    } finally {
      setInwardSubmitting(false);
    }
  };

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

      {/* HEADER SECTION: Title, Subtitle, and Refresh Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1F4E79] shadow-2xs">
            <Warehouse className="w-5 h-5 text-[#1F4E79]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Warehouse Management</h1>
            <p className="text-xs text-slate-400 font-normal mt-0.5">
              Raw material inventory · Inward receipts · Stock monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition shadow-2xs cursor-pointer"
            title="Refresh Data from Firebase"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#1F4E79]' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 5 KPI STRIP CARDS (Matching user's reference screenshot) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/60">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
              Inventory
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {totalStockVolume.toLocaleString('en-IN', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              })}{' '}
              <span className="text-sm font-bold text-slate-500">{primaryUnit}</span>
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Total Stock</div>
          </div>
        </div>

        {/* Card 2: Low Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100/60">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-100">
              Materials
            </span>
          </div>
          <div>
            <div className={`text-xl sm:text-2xl font-black tracking-tight ${totalLowAlertCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {totalLowAlertCount}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Low Stock</div>
          </div>
        </div>

        {/* Card 3: Healthy Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
              Materials
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              {healthyStockCount}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Healthy Stock</div>
          </div>
        </div>

        {/* Card 4: Received Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100/60">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-600 border border-purple-100">
              Materials
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-700 tracking-tight">
              {receivedTodayCount > 0 ? receivedTodayCount.toLocaleString('en-IN') : '0'}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Received Today</div>
          </div>
        </div>

        {/* Card 5: Inventory Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2 hover:shadow-xs transition">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100/60">
              <IndianRupee className="w-4 h-4" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-600 border border-teal-100">
              Inventory
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-teal-700 tracking-tight">
              {formatInventoryValueBadge(totalInventoryValue)}
            </div>
            <div className="text-xs text-slate-400 font-medium mt-0.5">Inventory Value</div>
          </div>
        </div>
      </div>

      {/* TABS ROW: Stock Overview & Inward Receipts */}
      <div className="flex items-center gap-8 border-b border-slate-200/90 px-1 pt-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === 'overview'
              ? 'border-[#1F4E79] text-[#1F4E79]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Stock Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('inward')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${
            activeTab === 'inward'
              ? 'border-[#1F4E79] text-[#1F4E79]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Inward Receipts</span>
        </button>
      </div>

      {/* SUB-HEADER / CONTROLS & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
          />
        </div>

        {/* Health Status Filter Pills (Active only on Stock Overview tab) */}
        {activeTab === 'overview' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Healthy Pill */}
            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Healthy' ? 'ALL' : 'Healthy')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeStatusFilter === 'Healthy'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0] hover:bg-[#d1fae5]'
              }`}
            >
              Healthy: {healthyStockCount}
            </button>

            {/* Low Stock Pill */}
            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Low Stock' ? 'ALL' : 'Low Stock')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeStatusFilter === 'Low Stock'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                  : 'bg-[#fffbeb] text-[#b45309] border-[#fde68a] hover:bg-[#fef3c7]'
              }`}
            >
              Low Stock: {lowStockCount}
            </button>

            {/* Critical Stock Pill */}
            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Critical' ? 'ALL' : 'Critical')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeStatusFilter === 'Critical'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : 'bg-[#fff1f2] text-[#e11d48] border-[#fecdd3] hover:bg-[#ffe4e6]'
              }`}
            >
              Critical Stock: {criticalCount}
            </button>

            {/* Out Of Stock Pill */}
            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Out Of Stock' ? 'ALL' : 'Out Of Stock')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                activeStatusFilter === 'Out Of Stock'
                  ? 'bg-red-700 text-white border-red-700 shadow-2xs'
                  : 'bg-[#fef2f2] text-[#b91c1c] border-[#fca5a5] hover:bg-[#fee2e2]'
              }`}
            >
              Out Of Stock: {outOfStockCount}
            </button>
          </div>
        )}

        {/* Right Actions: Export Excel & Add Inward */}
        <div className="flex items-center gap-2 ml-auto">
          {activeTab === 'overview' && (
            <button
              onClick={handleExportExcel}
              className="bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            onClick={handleOpenInwardModal}
            className="bg-[#1F4E79] hover:bg-[#163a5c] text-white font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inward Material</span>
          </button>
        </div>
      </div>

      {/* TAB 1: STOCK OVERVIEW (CARDS GRID MATCHING USER SCREENSHOT) */}
      {activeTab === 'overview' && (
        <div className="pt-1">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1F4E79] mb-2" />
              Loading active materials from Item Master...
            </div>
          ) : filteredStockItems.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-200 rounded-2xl p-8 space-y-2">
              <Package className="w-8 h-8 mx-auto text-slate-300" />
              <div className="font-bold text-slate-700 text-sm">No Active Materials Found in Item Master</div>
              <p className="text-slate-400 max-w-sm mx-auto">
                Only active items registered in your Item & Chemical Master will appear here. Add new materials in the Item Master to manage stock.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredStockItems.map((item) => {
                const health = item.healthStatus || 'Healthy';
                const curStock = item.availableStock || 0;
                const minStock = item.minimumStockLevel || 0;

                // Color themes matching reference screenshot
                let cardBg = 'bg-[#f0fdf4] border-[#bbf7d0]'; // Healthy
                let progressBg = 'bg-emerald-500';
                let currentTextColor = 'text-emerald-700';
                let healthBadge = 'bg-[#dcfce7] text-[#15803d] border-[#86efac]/60';

                if (health === 'Low Stock') {
                  cardBg = 'bg-[#fffbeb] border-[#fde68a]';
                  progressBg = 'bg-amber-500';
                  currentTextColor = 'text-amber-600';
                  healthBadge = 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]/60';
                } else if (health === 'Critical') {
                  cardBg = 'bg-[#fff1f2] border-[#fecdd3]';
                  progressBg = 'bg-rose-500';
                  currentTextColor = 'text-rose-600';
                  healthBadge = 'bg-[#ffe4e6] text-[#e11d48] border-[#fecdd3]/60';
                } else if (health === 'Out Of Stock') {
                  cardBg = 'bg-[#fef2f2] border-[#fca5a5]';
                  progressBg = 'bg-red-500';
                  currentTextColor = 'text-red-700';
                  healthBadge = 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]/60';
                }

                // Progress ratio: filled up to 100%
                const progressRatio =
                  minStock > 0
                    ? Math.min(100, Math.max(curStock > 0 ? 6 : 0, Math.round((curStock / minStock) * 100)))
                    : curStock > 0 ? 100 : 0;

                return (
                  <div
                    key={item.itemId}
                    className={`rounded-2xl border p-4 shadow-2xs transition-all hover:shadow-xs space-y-2 ${cardBg}`}
                  >
                    {/* Top Row: Code Badge, Material Name, Health Chip */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Item Code Badge */}
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe] shrink-0 uppercase">
                          {item.itemCode || 'ITEM'}
                        </span>
                        {/* Material Name */}
                        <span
                          className="font-bold text-slate-900 text-sm leading-snug line-clamp-1"
                          title={item.itemName}
                        >
                          {item.itemName}
                        </span>
                      </div>

                      {/* Health Status Pill */}
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${healthBadge}`}
                      >
                        {health}
                      </span>
                    </div>

                    {/* Colored Progress Bar */}
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-3 mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${progressBg}`}
                        style={{ width: `${progressRatio}%` }}
                      />
                    </div>

                    {/* 3-Column Stats Row: Current Stock, Min Stock, Avg Cost */}
                    <div className="grid grid-cols-3 gap-2 text-left pt-1">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          CURRENT STOCK
                        </div>
                        <div className={`text-base font-black ${currentTextColor}`}>
                          {curStock.toLocaleString('en-IN', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1
                          })}{' '}
                          {item.baseUnit}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          MIN. STOCK
                        </div>
                        <div className="text-sm font-semibold text-slate-800">
                          {minStock.toLocaleString('en-IN')} {item.baseUnit}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          AVG. COST
                        </div>
                        <div className="text-sm font-semibold text-slate-800">
                          {item.averageRate && item.averageRate > 0
                            ? `₹${item.averageRate.toFixed(2)}`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Line: Last Received Date */}
                    <div className="text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-200/50">
                      Last received: {item.lastInwardDate ? formatDate(item.lastInwardDate) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INWARD RECEIPTS */}
      {activeTab === 'inward' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inward Receipts Ledger</h3>
              <p className="text-xs text-slate-500">Materials received into the warehouse from purchases and deliveries</p>
            </div>
            <button
              onClick={handleOpenInwardModal}
              className="bg-[#1F4E79] hover:bg-[#163a5c] text-white font-semibold px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Inward Entry</span>
            </button>
          </div>

          <div className="p-4 overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#1F4E79] mb-2" />
                Loading inward transactions...
              </div>
            ) : filteredInwardTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No inward receipts recorded in Firebase yet.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-3">TX No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference No</th>
                    <th className="p-3">Material / Item</th>
                    <th className="p-3">Received Qty</th>
                    <th className="p-3">Updated Balance</th>
                    <th className="p-3">Received From</th>
                    <th className="p-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInwardTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-800">{tx.transactionNumber}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="p-3 font-mono font-medium text-[#1F4E79]">{tx.referenceNumber}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{tx.itemName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{tx.itemCode}</div>
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        +{tx.quantity} {tx.baseUnit}
                      </td>
                      <td className="p-3 font-mono font-semibold text-slate-800">
                        {tx.newStock} {tx.baseUnit}
                      </td>
                      <td className="p-3 text-slate-700">{tx.receivedFrom || '—'}</td>
                      <td className="p-3 text-slate-500">{tx.createdByName || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: INWARD MATERIAL ENTRY */}
      <Modal
        isOpen={isInwardModalOpen}
        onClose={() => setIsInwardModalOpen(false)}
        title="Stock Inward Entry (Add Received Materials)"
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitInward} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Material / Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={inwardItemId}
              onChange={(e) => setInwardItemId(e.target.value)}
              required
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value="">-- Choose Item From Master --</option>
              {validItems.map((s) => (
                <option key={s.itemId} value={s.itemId}>
                  {s.itemName} ({s.itemCode}) — Current Balance: {s.availableStock} {s.baseUnit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Inward Source <span className="text-rose-500">*</span>
              </label>
              <select
                value={inwardSource}
                onChange={(e) => setInwardSource(e.target.value as any)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              >
                <option value="MANUAL_INWARD">Manual Inward Receipt</option>
                <option value="PURCHASE_RECEIPT">Raw Material Purchase Receipt</option>
                <option value="FIREWOOD_PURCHASE">Firewood Fuel Delivery</option>
                <option value="RETURN">Shopfloor Return / Excess Stock</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reference No (DC / Invoice No) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. PUR-2026-0001, DC-WOOD-90"
                value={inwardReferenceNo}
                onChange={(e) => setInwardReferenceNo(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Received Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0"
                value={inwardQuantity === '' ? '' : inwardQuantity}
                onChange={(e) => setInwardQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={inwardDate}
                onChange={(e) => setInwardDate(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Received From (Supplier / Delivery Person)</label>
            <input
              type="text"
              placeholder="e.g. Sree Kumar Chemicals, Direct Delivery"
              value={inwardReceivedFrom}
              onChange={(e) => setInwardReceivedFrom(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Remarks (Optional)</label>
            <textarea
              rows={2}
              placeholder="e.g. Weighbridge slip verified, packaging intact"
              value={inwardRemarks}
              onChange={(e) => setInwardRemarks(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsInwardModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inwardSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#1F4E79] hover:bg-[#163a5c] transition shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {inwardSubmitting ? 'Recording Inward...' : 'Confirm Inward & Add to Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
