import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { WarehouseItemStock, StockHealthStatus } from '../../types/warehouse';
import {
  RawMaterialPurchase,
  PurchaseLineItem,
  PurchaseType,
  PurchaseStatus,
  WeighbridgeDetails
} from '../../types/purchase';
import { Vendor } from '../../types/vendor';
import { WarehouseService } from '../../services/warehouseService';
import { RawMaterialPurchaseService } from '../../services/rawMaterialPurchaseService';
import { VendorService } from '../../services/vendorService';
import { Modal } from '../../components/ui/Modal';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../components/ui/TableMaximizeWrapper';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { SearchableSelect, SelectOption, SelectOptionGroup } from '../inward/components/SearchableSelect';
import {
  Package,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  IndianRupee,
  Calendar,
  Truck,
  Building2,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  SlidersHorizontal,
  Check,
  X
} from 'lucide-react';
import ExcelJS from 'exceljs';

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
}

interface SearchableItemSelectProps {
  value: string;
  items: WarehouseItemStock[];
  onSelect: (item: WarehouseItemStock) => void;
  disabled?: boolean;
}

const SearchableItemSelect: React.FC<SearchableItemSelectProps> = ({
  value,
  items,
  onSelect,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedItem = items.find((it) => it.itemId === value);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        it.itemName.toLowerCase().includes(q) ||
        it.itemCode.toLowerCase().includes(q) ||
        (it.categoryName || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  return (
    <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="w-full h-10 bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-left flex items-center justify-between gap-1.5 transition focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer disabled:opacity-50"
      >
        {selectedItem ? (
          <div className="flex items-center gap-1.5 truncate">
            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700 shrink-0">
              {selectedItem.itemCode}
            </span>
            <span className="font-semibold text-slate-900 truncate">
              {selectedItem.itemName}
            </span>
            {selectedItem.categoryName && (
              <span className="text-[10px] text-slate-400 shrink-0 hidden md:inline">
                ({selectedItem.categoryName})
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 font-normal">-- Choose Item from Master --</span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-full min-w-[320px] max-w-[480px] bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material name, code, category..."
                className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
            {filteredItems.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 italic">
                No active materials found matching "{searchQuery}".
              </div>
            ) : (
              filteredItems.map((it) => {
                const isSelected = it.itemId === value;
                return (
                  <div
                    key={it.itemId}
                    onClick={() => {
                      onSelect(it);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-2 text-xs ${isSelected ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-200/70 text-slate-800 shrink-0">
                        {it.itemCode}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-slate-900 truncate">{it.itemName}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {it.categoryName || 'General'} · Stock: {(it.availableStock || 0).toLocaleString('en-IN')}{' '}
                          {it.baseUnit}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-100 rounded">
                        {it.baseUnit}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-slate-900" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface WarehousePageProps {
  initialTab?: 'overview' | 'purchases';
}

export const WarehousePage: React.FC<WarehousePageProps> = ({ initialTab = 'overview' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'overview' (Stock Overview) or 'purchases' (Raw Material Purchase)
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases'>(initialTab);
  const [purchaseSubTab, setPurchaseSubTab] = useState<'general' | 'firewood'>('general');

  // Purchases Ledger Filters & Sorting Controls
  const [purchaseVendorFilter, setPurchaseVendorFilter] = useState<string>('ALL');
  const [purchaseStartDate, setPurchaseStartDate] = useState<string>('');
  const [purchaseEndDate, setPurchaseEndDate] = useState<string>('');
  const [purchaseSearchColumn, setPurchaseSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Live Data directly from Firebase
  const [stockItems, setStockItems] = useState<WarehouseItemStock[]>([]);
  const [purchases, setPurchases] = useState<RawMaterialPurchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState<StockHealthStatus | 'ALL'>('ALL');

  // Purchase Entry Modal State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
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

  // Weighbridge State (Firewood purchases)
  const [wbSlipNo, setWbSlipNo] = useState('');
  const [wbVehicleNo, setWbVehicleNo] = useState('');
  const [wbName, setWbName] = useState('');
  const [wbCharges, setWbCharges] = useState<number | ''>('');
  const [wbGrossWeightKg, setWbGrossWeightKg] = useState<number | ''>('');
  const [wbGrossWeightTime, setWbGrossWeightTime] = useState('');
  const [wbTareWeightKg, setWbTareWeightKg] = useState<number | ''>('');
  const [wbTareWeightTime, setWbTareWeightTime] = useState('');
  const [wbMaterialVariety, setWbMaterialVariety] = useState('');
  const [wbRemarks, setWbRemarks] = useState('');

  // Weighbridge only works with Firewood purchase entry
  const isFirewood = purchaseType === 'Firewood';

  // Auto-calculated Nett Weight (kg and Tonnes)
  const wbNettWeightKg = useMemo(() => {
    const gross = Number(wbGrossWeightKg) || 0;
    const tare = Number(wbTareWeightKg) || 0;
    if (gross > 0 && tare > 0) {
      return Math.max(0, gross - tare);
    }
    return gross > 0 ? gross : 0;
  }, [wbGrossWeightKg, wbTareWeightKg]);

  const wbNettWeightTonnes = useMemo(() => {
    return Math.round((wbNettWeightKg / 1000) * 1000) / 1000;
  }, [wbNettWeightKg]);

  // Apply calculated nett weight to firewood material line item quantity
  const handleApplyNettWeightToLine = () => {
    if (wbNettWeightKg <= 0) {
      showToast('error', 'Please enter Gross Weight and Tare Weight first.');
      return;
    }
    setFormLines((prev) => {
      if (prev.length === 0) return prev;
      const fwIdx = prev.findIndex((l) => {
        const cat = (l.categoryName || '').toLowerCase();
        const name = (l.itemName || '').toLowerCase();
        const code = (l.itemCode || '').toUpperCase();
        return cat.includes('firewood') || name.includes('firewood') || code.startsWith('RWD');
      });
      const targetIdx = fwIdx >= 0 ? fwIdx : 0;
      return prev.map((l, idx) => {
        if (idx !== targetIdx) return l;
        const isTonUnit = ['t', 'ton', 'tonnes', 'tonne'].includes((l.unit || '').trim().toLowerCase());
        const appliedQty = isTonUnit ? wbNettWeightTonnes : wbNettWeightKg;
        const rate = Number(l.rate) || 0;
        return {
          ...l,
          quantity: appliedQty,
          amount: Math.round(appliedQty * rate * 100) / 100
        };
      });
    });
    showToast('success', `Nett weight applied: ${wbNettWeightKg.toLocaleString('en-IN')} kg (${wbNettWeightTonnes} T)`);
  };

  // View Purchase Modal State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<RawMaterialPurchase | null>(null);

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

      const [stocksRes, purchasesRes, vendorsRes] = await Promise.all([
        WarehouseService.getStockItems(),
        RawMaterialPurchaseService.getPurchases(),
        VendorService.getVendors({}, { page: 1, pageSize: 500 }, false)
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
      setPurchases(purchasesRes);
      setVendors(vendorsRes.vendors || []);
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

  // Filter strictly to suppliers and vendors who are both customer and supplier (vendorType === 'supplier' || 'both')
  const supplierVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (v.status === 'inactive') return false;
      const type = (v.vendorType || (v as any).type || '').toString().toLowerCase().trim();
      return type === 'supplier' || type === 'both';
    });
  }, [vendors]);

  // Option groups for SearchableSelect Supplier dropdown
  const supplierOptionGroups: SelectOptionGroup[] = useMemo(() => {
    return [
      {
        title: 'Suppliers & Vendors (Supplier / Both)',
        options: supplierVendors.map((v) => ({
          id: v.vendorId || v.id || '',
          primaryText: v.companyName,
          secondaryText: `Code: ${v.vendorCode || v.vendorId || '—'}${v.address?.city ? ` · ${v.address.city}` : ''}`,
          badge: v.vendorType === 'both' ? 'Customer & Supplier' : 'Supplier',
          badgeVariant: v.vendorType === 'both' ? 'blue' : 'slate'
        }))
      }
    ];
  }, [supplierVendors]);

  // Option groups for SearchableSelect Purchase Type dropdown
  const purchaseTypeOptionGroups: SelectOptionGroup[] = useMemo(() => {
    return [
      {
        title: 'Purchase Types',
        options: [
          { id: 'Raw Material', primaryText: 'Raw Material Purchase' },
          { id: 'Firewood', primaryText: 'Firewood Purchase' },
          { id: 'Chemical', primaryText: 'Chemical Purchase' },
          { id: 'Packaging', primaryText: 'Packaging Purchase' },
          { id: 'General', primaryText: 'General Purchase' }
        ]
      }
    ];
  }, []);

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

  const totalLowAlertCount = lowStockCount + criticalCount;

  // Received Today Count from Purchases
  const receivedTodayCount = useMemo(() => {
    return purchases
      .filter((p) => (p.purchaseDate === todayStr || p.receivedDate === todayStr) && p.status === 'Received')
      .reduce((acc, curr) => acc + (curr.totalQuantity || 0), 0);
  }, [purchases, todayStr]);

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

  // Helper to identify Firewood purchases
  const isFirewoodPurchase = (p: RawMaterialPurchase): boolean => {
    if (p.purchaseType === 'Firewood') return true;
    return (p.lines || []).some((l) => {
      const cat = (l.categoryName || '').toLowerCase();
      const name = (l.itemName || '').toLowerCase();
      const code = (l.itemCode || '').toUpperCase();
      return cat.includes('firewood') || name.includes('firewood') || code.startsWith('RWD');
    });
  };

  // Unique suppliers list for Purchases filter dropdown
  const purchaseVendorsList = useMemo(() => {
    const map = new Map<string, string>();
    purchases.forEach((p) => {
      if (p.vendorId && p.vendorName) {
        map.set(p.vendorId, p.vendorName);
      } else if (p.vendorName) {
        map.set(p.vendorName, p.vendorName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [purchases]);

  const isAnyPurchaseFilterActive = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      purchaseSearchColumn !== 'ALL' ||
      Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
      purchaseVendorFilter !== 'ALL' ||
      purchaseStartDate !== '' ||
      purchaseEndDate !== '' ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [
    searchQuery,
    purchaseSearchColumn,
    columnFilters,
    purchaseVendorFilter,
    purchaseStartDate,
    purchaseEndDate,
    sortField,
    sortDirection
  ]);

  const handleResetPurchaseFilters = () => {
    setSearchQuery('');
    setPurchaseSearchColumn('ALL');
    setColumnFilters({});
    setPurchaseVendorFilter('ALL');
    setPurchaseStartDate('');
    setPurchaseEndDate('');
    setSortField(null);
    setSortDirection('normal');
  };

  // 3-state Column Sorting: Default Direction -> Opposite Direction -> Normal (Unsorted)
  const handleSort = (field: string) => {
    const isNumericOrDate = [
      'purchaseDate',
      'grossWeightKg',
      'tareWeightKg',
      'nettWeightKg',
      'rate',
      'grandTotal',
      'wbCharges',
      'quantity'
    ].includes(field);

    const firstDirection: 'asc' | 'desc' = isNumericOrDate ? 'desc' : 'asc';
    const secondDirection: 'asc' | 'desc' = isNumericOrDate ? 'asc' : 'desc';

    if (sortField !== field || sortDirection === 'normal') {
      // Step 1: Normal -> First Direction
      setSortField(field);
      setSortDirection(firstDirection);
    } else if (sortDirection === firstDirection) {
      // Step 2: First Direction -> Second Direction
      setSortDirection(secondDirection);
    } else {
      // Step 3: Second Direction -> Normal (Unsorted / Default order)
      setSortField(null);
      setSortDirection('normal');
    }
  };

  const renderSortIcon = (field: string) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center transition-colors shrink-0 ml-1 ${isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60 group-hover:opacity-100'
          }`}
        title={
          sortField === field && sortDirection === 'asc'
            ? 'Sorted ascending (click to sort descending or reset to normal)'
            : sortField === field && sortDirection === 'desc'
              ? 'Sorted descending (click to reset to normal)'
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

  const getColumnDisplayName = (col: string): string => {
    switch (col) {
      case 'purchaseNumber': return 'Purchase No';
      case 'purchaseDate': return 'Date';
      case 'vendorName': return 'Supplier';
      case 'vehicleNo': return 'Vehicle No';
      case 'wbSlipNo': return 'WB Slip No';
      case 'weighbridgeName': return 'WB Center';
      case 'materialVariety': return 'Material Variety';
      case 'supplierInvoiceNo': return 'Invoice No';
      case 'itemName': return 'Material / Item';
      case 'status': return 'Status';
      default: return 'All Columns';
    }
  };

  // Filtered Purchases Ledger (General & Firewood with active filters & column-wise search)
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      // 1. Search Query (respecting purchaseSearchColumn selector)
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        if (purchaseSearchColumn === 'ALL') {
          const matchesAll =
            (p.purchaseNumber || '').toLowerCase().includes(q) ||
            (p.purchaseDate || '').toLowerCase().includes(q) ||
            formatDate(p.purchaseDate).toLowerCase().includes(q) ||
            (p.vendorName || '').toLowerCase().includes(q) ||
            (p.supplierInvoiceNo || '').toLowerCase().includes(q) ||
            (p.vehicleNo || '').toLowerCase().includes(q) ||
            (p.weighbridge?.slipNo || '').toLowerCase().includes(q) ||
            (p.weighbridge?.vehicleNo || '').toLowerCase().includes(q) ||
            (p.weighbridge?.weighbridgeName || '').toLowerCase().includes(q) ||
            (p.weighbridge?.materialVariety || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q) ||
            p.lines?.some((l) => (l.itemName || '').toLowerCase().includes(q) || (l.itemCode || '').toLowerCase().includes(q));
          if (!matchesAll) return false;
        } else if (purchaseSearchColumn === 'purchaseNumber') {
          if (!(p.purchaseNumber || '').toLowerCase().includes(q)) return false;
        } else if (purchaseSearchColumn === 'purchaseDate') {
          const dStr = p.purchaseDate || '';
          const formatted = formatDate(p.purchaseDate).toLowerCase();
          if (!dStr.toLowerCase().includes(q) && !formatted.includes(q)) return false;
        } else if (purchaseSearchColumn === 'vendorName') {
          if (!(p.vendorName || '').toLowerCase().includes(q) && !(p.vendorCode || '').toLowerCase().includes(q)) return false;
        } else if (purchaseSearchColumn === 'vehicleNo') {
          const veh = (p.weighbridge?.vehicleNo || p.vehicleNo || '').toLowerCase();
          if (!veh.includes(q)) return false;
        } else if (purchaseSearchColumn === 'wbSlipNo') {
          const slip = (p.weighbridge?.slipNo || '').toLowerCase();
          if (!slip.includes(q)) return false;
        } else if (purchaseSearchColumn === 'weighbridgeName') {
          const center = (p.weighbridge?.weighbridgeName || '').toLowerCase();
          if (!center.includes(q)) return false;
        } else if (purchaseSearchColumn === 'materialVariety') {
          const mat = (p.weighbridge?.materialVariety || p.lines?.[0]?.itemName || '').toLowerCase();
          if (!mat.includes(q)) return false;
        } else if (purchaseSearchColumn === 'supplierInvoiceNo') {
          if (!(p.supplierInvoiceNo || '').toLowerCase().includes(q)) return false;
        } else if (purchaseSearchColumn === 'itemName') {
          const hasItem = p.lines?.some((l) => (l.itemName || '').toLowerCase().includes(q) || (l.itemCode || '').toLowerCase().includes(q));
          if (!hasItem) return false;
        } else if (purchaseSearchColumn === 'status') {
          if (!(p.status || '').toLowerCase().includes(q)) return false;
        }
      }

      // 2. Individual Column Filters
      for (const [colKey, colVal] of Object.entries(columnFilters)) {
        const val = (colVal || '').trim().toLowerCase();
        if (!val) continue;

        if (colKey === 'purchaseNumber') {
          if (!(p.purchaseNumber || '').toLowerCase().includes(val)) return false;
        } else if (colKey === 'purchaseDate') {
          const dStr = p.purchaseDate || '';
          const formatted = formatDate(p.purchaseDate).toLowerCase();
          if (!dStr.toLowerCase().includes(val) && !formatted.includes(val)) return false;
        } else if (colKey === 'vendorName') {
          if (!(p.vendorName || '').toLowerCase().includes(val) && !(p.vendorCode || '').toLowerCase().includes(val)) return false;
        } else if (colKey === 'wbSlipNo') {
          const slip = (p.weighbridge?.slipNo || '').toLowerCase();
          const center = (p.weighbridge?.weighbridgeName || '').toLowerCase();
          if (!slip.includes(val) && !center.includes(val)) return false;
        } else if (colKey === 'vehicleNo') {
          const veh = (p.weighbridge?.vehicleNo || p.vehicleNo || '').toLowerCase();
          if (!veh.includes(val)) return false;
        } else if (colKey === 'materialVariety') {
          const mat = (p.weighbridge?.materialVariety || p.lines?.[0]?.itemName || '').toLowerCase();
          if (!mat.includes(val)) return false;
        } else if (colKey === 'grossWeightKg') {
          const gross = (p.weighbridge?.grossWeightKg?.toString() || '');
          if (!gross.includes(val)) return false;
        } else if (colKey === 'tareWeightKg') {
          const tare = (p.weighbridge?.tareWeightKg?.toString() || '');
          if (!tare.includes(val)) return false;
        } else if (colKey === 'nettWeightKg') {
          const nett = (p.weighbridge?.nettWeightKg?.toString() || p.lines?.[0]?.quantity?.toString() || '');
          if (!nett.includes(val)) return false;
        } else if (colKey === 'rate') {
          const r = (p.lines?.[0]?.rate?.toString() || '');
          if (!r.includes(val)) return false;
        } else if (colKey === 'grandTotal') {
          const tot = (p.grandTotal?.toString() || '');
          if (!tot.includes(val)) return false;
        } else if (colKey === 'wbCharges') {
          const chg = (p.weighbridge?.weighbridgeCharges?.toString() || '');
          if (!chg.includes(val)) return false;
        } else if (colKey === 'status') {
          if (!(p.status || '').toLowerCase().includes(val)) return false;
        } else if (colKey === 'supplierInvoiceNo') {
          const inv = (p.supplierInvoiceNo || '').toLowerCase();
          if (!inv.includes(val)) return false;
        } else if (colKey === 'itemName') {
          const hasItem = p.lines?.some((l) => (l.itemName || '').toLowerCase().includes(val) || (l.itemCode || '').toLowerCase().includes(val));
          if (!hasItem) return false;
        } else if (colKey === 'quantity') {
          const qty = p.lines?.map(l => l.quantity?.toString()).join(' ') || '';
          if (!qty.includes(val)) return false;
        }
      }

      // 3. Vendor filter
      if (
        purchaseVendorFilter !== 'ALL' &&
        p.vendorId !== purchaseVendorFilter &&
        p.vendorName !== purchaseVendorFilter
      ) {
        return false;
      }

      // 4. Date Range Filter
      if (purchaseStartDate && p.purchaseDate < purchaseStartDate) {
        return false;
      }
      if (purchaseEndDate && p.purchaseDate > purchaseEndDate) {
        return false;
      }

      return true;
    });
  }, [
    purchases,
    searchQuery,
    purchaseSearchColumn,
    columnFilters,
    purchaseVendorFilter,
    purchaseStartDate,
    purchaseEndDate
  ]);

  // Sorted Purchases Ledger (General & Firewood)
  const sortedPurchases = useMemo(() => {
    if (!sortField || sortDirection === 'normal') {
      return filteredPurchases;
    }
    return [...filteredPurchases].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'purchaseNumber':
          valA = a.purchaseNumber || '';
          valB = b.purchaseNumber || '';
          break;
        case 'purchaseDate':
          valA = a.purchaseDate || '';
          valB = b.purchaseDate || '';
          break;
        case 'vendorName':
          valA = a.vendorName || '';
          valB = b.vendorName || '';
          break;
        case 'wbSlipNo':
          valA = a.weighbridge?.slipNo || '';
          valB = b.weighbridge?.slipNo || '';
          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
            return sortDirection === 'asc' ? numA - numB : numB - numA;
          }
          break;
        case 'vehicleNo':
          valA = a.weighbridge?.vehicleNo || a.vehicleNo || '';
          valB = b.weighbridge?.vehicleNo || b.vehicleNo || '';
          break;
        case 'materialVariety':
          valA = a.weighbridge?.materialVariety || a.lines?.[0]?.itemName || '';
          valB = b.weighbridge?.materialVariety || b.lines?.[0]?.itemName || '';
          break;
        case 'grossWeightKg':
          valA = Number(a.weighbridge?.grossWeightKg) || 0;
          valB = Number(b.weighbridge?.grossWeightKg) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'tareWeightKg':
          valA = Number(a.weighbridge?.tareWeightKg) || 0;
          valB = Number(b.weighbridge?.tareWeightKg) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'nettWeightKg':
          valA = Number(a.weighbridge?.nettWeightKg) || Number(a.lines?.[0]?.quantity) || 0;
          valB = Number(b.weighbridge?.nettWeightKg) || Number(b.lines?.[0]?.quantity) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'rate':
          valA = Number(a.lines?.[0]?.rate) || 0;
          valB = Number(b.lines?.[0]?.rate) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'grandTotal':
          valA = Number(a.grandTotal) || 0;
          valB = Number(b.grandTotal) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'wbCharges':
          valA = Number(a.weighbridge?.weighbridgeCharges) || 0;
          valB = Number(b.weighbridge?.weighbridgeCharges) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'supplierInvoiceNo':
          valA = a.supplierInvoiceNo || '';
          valB = b.supplierInvoiceNo || '';
          break;
        case 'itemName':
          valA = a.lines?.[0]?.itemName || '';
          valB = b.lines?.[0]?.itemName || '';
          break;
        case 'quantity':
          valA = Number(a.lines?.[0]?.quantity) || 0;
          valB = Number(b.lines?.[0]?.quantity) || 0;
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        default:
          valA = a.purchaseDate || '';
          valB = b.purchaseDate || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
  }, [filteredPurchases, sortField, sortDirection]);

  // Separate sorted & filtered purchases for the two tables
  const filteredGeneralPurchases = useMemo(() => {
    return sortedPurchases.filter((p) => !isFirewoodPurchase(p));
  }, [sortedPurchases]);

  const filteredFirewoodPurchases = useMemo(() => {
    return sortedPurchases.filter((p) => isFirewoodPurchase(p));
  }, [sortedPurchases]);

  const generalPurchasesCount = useMemo(() => {
    return purchases.filter((p) => !isFirewoodPurchase(p)).length;
  }, [purchases]);

  const firewoodPurchasesCount = useMemo(() => {
    return purchases.filter((p) => isFirewoodPurchase(p)).length;
  }, [purchases]);

  // Dynamic Totals for Table 1 (General Purchases)
  const generalTotals = useMemo(() => {
    let totalQty = 0;
    let totalAmt = 0;
    filteredGeneralPurchases.forEach((p: any) => {
      totalAmt += Number(p.grandTotal) || 0;
      (p.items || []).forEach((it: any) => {
        totalQty += Number(it.quantity) || 0;
      });
    });
    return { totalQty, totalAmt };
  }, [filteredGeneralPurchases]);

  // Dynamic Totals for Table 2 (Firewood Purchases)
  const firewoodTotals = useMemo(() => {
    let gross = 0;
    let tare = 0;
    let nett = 0;
    let totalAmt = 0;
    let charges = 0;
    filteredFirewoodPurchases.forEach((p: any) => {
      totalAmt += Number(p.grandTotal) || 0;
      const wb = p.weighbridgeDetails;
      if (wb) {
        gross += Number(wb.grossWeightKg) || 0;
        tare += Number(wb.tareWeightKg) || 0;
        nett += Number(wb.nettWeightKg) || 0;
        charges += Number(wb.weighbridgeCharges) || 0;
      }
    });
    return { gross, tare, nett, totalAmt, charges };
  }, [filteredFirewoodPurchases]);

  // Export to Excel using exceljs
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Warehouse Stock');

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

  // Open New Purchase Entry Modal
  const handleOpenNewPurchase = (defaultType?: PurchaseType) => {
    setIsEditMode(false);
    setEditingPurchaseId(null);
    const typeToSet: PurchaseType = defaultType || (purchaseSubTab === 'firewood' ? 'Firewood' : 'Raw Material');
    setPurchaseType(typeToSet);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setVendorId('');
    setSupplierInvoiceNo('');
    setSupplierInvoiceDate(new Date().toISOString().split('T')[0]);
    setVehicleNo('');
    setDriverName('');
    setDriverPhone('');
    setRemarks('');
    setWbSlipNo('');
    setWbVehicleNo('');
    setWbName('');
    setWbCharges('');
    setWbGrossWeightKg('');
    setWbGrossWeightTime('');
    setWbTareWeightKg('');
    setWbTareWeightTime('');
    setWbMaterialVariety('');
    setWbRemarks('');

    if (validItems.length > 0) {
      const fwItem = typeToSet === 'Firewood'
        ? validItems.find((i) => (i.categoryName || '').toLowerCase().includes('firewood') || (i.itemName || '').toLowerCase().includes('firewood') || (i.itemCode || '').toUpperCase().startsWith('RWD'))
        : null;
      const first = fwItem || validItems[0];
      setFormLines([
        {
          lineId: `line_1_${Date.now()}`,
          itemId: first.itemId,
          itemCode: first.itemCode,
          itemName: first.itemName,
          categoryName: first.categoryName || '',
          quantity: '',
          unit: first.baseUnit || (typeToSet === 'Firewood' ? 'T' : 'kg'),
          rate: first.averageRate && first.averageRate > 0 ? first.averageRate : '',
          amount: 0
        }
      ]);
    } else {
      setFormLines([]);
    }
    setIsPurchaseModalOpen(true);
  };

  // Open Edit Purchase Modal
  const handleOpenEditPurchase = (p: RawMaterialPurchase) => {
    setIsEditMode(true);
    setEditingPurchaseId(p.id);
    const resolvedType: PurchaseType = (p.purchaseType === 'Firewood' || isFirewoodPurchase(p)) ? 'Firewood' : (p.purchaseType || 'Raw Material');
    setPurchaseType(resolvedType);
    setPurchaseDate(p.purchaseDate || new Date().toISOString().split('T')[0]);
    setVendorId(p.vendorId || '');
    setSupplierInvoiceNo(p.supplierInvoiceNo || '');
    setSupplierInvoiceDate(p.supplierInvoiceDate || p.purchaseDate || new Date().toISOString().split('T')[0]);
    setVehicleNo(p.vehicleNo || '');
    setDriverName(p.driverName || '');
    setDriverPhone(p.driverPhone || '');
    setRemarks(p.remarks || '');
    setWbSlipNo(p.weighbridge?.slipNo || '');
    setWbVehicleNo(p.weighbridge?.vehicleNo || p.vehicleNo || '');
    setWbName(p.weighbridge?.weighbridgeName || '');
    setWbCharges(p.weighbridge?.weighbridgeCharges !== undefined ? p.weighbridge.weighbridgeCharges : '');
    setWbGrossWeightKg(p.weighbridge?.grossWeightKg !== undefined ? p.weighbridge.grossWeightKg : '');
    setWbGrossWeightTime(p.weighbridge?.grossWeightTime || '');
    setWbTareWeightKg(p.weighbridge?.tareWeightKg !== undefined ? p.weighbridge.tareWeightKg : '');
    setWbTareWeightTime(p.weighbridge?.tareWeightTime || '');
    setWbMaterialVariety(p.weighbridge?.materialVariety || '');
    setWbRemarks(p.weighbridge?.remarks || '');
    setFormLines(
      (p.lines || []).map((l, idx) => ({
        lineId: l.lineId || `line_${idx}_${Date.now()}`,
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        categoryName: l.categoryName || '',
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        amount: l.amount || (l.quantity * l.rate)
      }))
    );
    setIsPurchaseModalOpen(true);
  };

  // Open View Purchase Modal
  const handleOpenViewPurchase = (p: RawMaterialPurchase) => {
    setViewingPurchase(p);
    setIsViewModalOpen(true);
  };

  // Delete Purchase Entry
  const handleDeletePurchase = async (p: RawMaterialPurchase) => {
    const confirmMsg = p.stockInwardCompleted
      ? `Are you sure you want to delete purchase "${p.purchaseNumber}"?\n\nThe raw material quantities will be deducted back from warehouse stock automatically.`
      : `Are you sure you want to delete purchase "${p.purchaseNumber}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await RawMaterialPurchaseService.deletePurchase(p.id, currentUser);
      showToast('success', `Purchase ${p.purchaseNumber} deleted and warehouse stock adjusted.`);
      await loadData(true);
    } catch (err: any) {
      console.error('Delete purchase error:', err);
      showToast('error', err.message || 'Failed to delete purchase.');
    }
  };

  // Material Line Handlers
  const handleAddMaterialLine = () => {
    if (validItems.length === 0) {
      showToast('error', 'No active items available in Item Master.');
      return;
    }
    const first = validItems[0];
    setFormLines((prev) => [
      ...prev,
      {
        lineId: `line_${prev.length + 1}_${Date.now()}`,
        itemId: first.itemId,
        itemCode: first.itemCode,
        itemName: first.itemName,
        categoryName: first.categoryName || '',
        quantity: '',
        unit: first.baseUnit || 'kg',
        rate: first.averageRate && first.averageRate > 0 ? first.averageRate : '',
        amount: 0
      }
    ]);
  };

  const handleRemoveMaterialLine = (index: number) => {
    if (formLines.length <= 1) {
      showToast('error', 'At least one material line item is required.');
      return;
    }
    setFormLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, itemId: string) => {
    const it = validItems.find((s) => s.itemId === itemId);
    if (!it) return;
    setFormLines((prev) => {
      const copy = [...prev];
      const qty = Number(copy[index].quantity) || 0;
      const rate = copy[index].rate !== '' ? Number(copy[index].rate) : (it.averageRate || 0);
      copy[index] = {
        ...copy[index],
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        categoryName: it.categoryName || '',
        unit: it.baseUnit || 'kg',
        rate: copy[index].rate !== '' ? copy[index].rate : (it.averageRate || ''),
        amount: Math.round(qty * rate * 100) / 100
      };
      return copy;
    });
  };

  const handleLineQtyChange = (index: number, val: string) => {
    const qty = val === '' ? '' : Number(val);
    setFormLines((prev) => {
      const copy = [...prev];
      const numericQty = val === '' ? 0 : Number(val);
      const numericRate = copy[index].rate === '' ? 0 : Number(copy[index].rate);
      copy[index] = {
        ...copy[index],
        quantity: qty,
        amount: Math.round(numericQty * numericRate * 100) / 100
      };
      return copy;
    });
  };

  const handleLineRateChange = (index: number, val: string) => {
    const rate = val === '' ? '' : Number(val);
    setFormLines((prev) => {
      const copy = [...prev];
      const numericQty = copy[index].quantity === '' ? 0 : Number(copy[index].quantity);
      const numericRate = val === '' ? 0 : Number(val);
      copy[index] = {
        ...copy[index],
        rate: rate,
        amount: Math.round(numericQty * numericRate * 100) / 100
      };
      return copy;
    });
  };

  const formTotalQuantity = useMemo(() => {
    return formLines.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [formLines]);

  const formGrandTotal = useMemo(() => {
    return formLines.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  }, [formLines]);

  // Save Purchase (Draft or Confirm & Inward to Warehouse)
  const handleSavePurchase = async (statusToSave: 'Draft' | 'Confirmed') => {
    if (!vendorId) {
      showToast('error', 'Please select a supplier / vendor.');
      return;
    }
    const selectedVendor = vendors.find((v) => (v.id === vendorId || v.vendorId === vendorId));
    if (!selectedVendor) {
      showToast('error', 'Selected supplier not found.');
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
      const l = formLines[i];
      if (!l.itemId) {
        showToast('error', `Please select an item for line #${i + 1}.`);
        return;
      }
      const q = Number(l.quantity);
      if (!q || q <= 0) {
        showToast('error', `Please enter a valid quantity for line #${i + 1}.`);
        return;
      }
    }

    setFormSubmitting(true);
    try {
      const linesPayload = formLines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        categoryName: l.categoryName,
        quantity: Number(l.quantity) || 0,
        unit: l.unit || 'kg',
        rate: Number(l.rate) || 0,
        amount: Math.round((Number(l.quantity) || 0) * (Number(l.rate) || 0) * 100) / 100
      }));

      const finalVehicleNo = (vehicleNo.trim() || wbVehicleNo.trim());

      const weighbridgePayload: WeighbridgeDetails | undefined = isFirewood
        ? {
          slipNo: wbSlipNo.trim(),
          vehicleNo: finalVehicleNo,
          weighbridgeName: wbName.trim(),
          weighbridgeCharges: wbCharges === '' ? 0 : Number(wbCharges),
          grossWeightKg: wbGrossWeightKg === '' ? 0 : Number(wbGrossWeightKg),
          grossWeightTime: wbGrossWeightTime.trim(),
          tareWeightKg: wbTareWeightKg === '' ? 0 : Number(wbTareWeightKg),
          tareWeightTime: wbTareWeightTime.trim(),
          nettWeightKg: Number(wbNettWeightKg) || 0,
          nettWeightTonnes: Number(wbNettWeightTonnes) || 0,
          materialVariety: wbMaterialVariety.trim(),
          remarks: wbRemarks.trim()
        }
        : undefined;

      if (isEditMode && editingPurchaseId) {
        await RawMaterialPurchaseService.updatePurchase(
          editingPurchaseId,
          {
            purchaseType,
            purchaseDate,
            vendorId: selectedVendor.vendorId || selectedVendor.id || '',
            vendorName: selectedVendor.companyName,
            vendorCode: selectedVendor.vendorCode,
            supplierInvoiceNo: supplierInvoiceNo.trim(),
            supplierInvoiceDate,
            vehicleNo: finalVehicleNo,
            driverName: driverName.trim(),
            driverPhone: driverPhone.trim(),
            weighbridge: weighbridgePayload,
            remarks: remarks.trim(),
            lines: linesPayload as any
          },
          currentUser
        );

        if (statusToSave === 'Confirmed') {
          await RawMaterialPurchaseService.receivePurchase(editingPurchaseId, currentUser, purchaseDate);
        }

        showToast('success', 'Purchase entry updated successfully.');
      } else {
        const created = await RawMaterialPurchaseService.createPurchase(
          {
            purchaseType,
            purchaseDate,
            vendorId: selectedVendor.vendorId || selectedVendor.id || '',
            vendorName: selectedVendor.companyName,
            vendorCode: selectedVendor.vendorCode,
            supplierInvoiceNo: supplierInvoiceNo.trim(),
            supplierInvoiceDate,
            vehicleNo: finalVehicleNo,
            driverName: driverName.trim(),
            driverPhone: driverPhone.trim(),
            weighbridge: weighbridgePayload,
            remarks: remarks.trim(),
            status: statusToSave === 'Confirmed' ? 'Confirmed' : 'Draft',
            lines: linesPayload
          },
          currentUser
        );

        // If confirmed, immediately receive into warehouse stock
        if (statusToSave === 'Confirmed') {
          await RawMaterialPurchaseService.receivePurchase(created.id, currentUser, purchaseDate);
          showToast('success', `Purchase confirmed! Raw materials added to warehouse stock.`);
        } else {
          showToast('success', `Purchase ${created.purchaseNumber} saved as draft.`);
        }
      }

      setIsPurchaseModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      showToast('error', err.message || 'Failed to save purchase.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold ${toast.type === 'success'
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

      {/* HEADER SECTION: Title, Subtitle, and White Reload Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {activeTab === 'purchases' ? 'Raw Material Purchase' : 'Warehouse Management'}
          </h1>
          <p className="text-xs text-slate-400 font-normal mt-0.5">
            {activeTab === 'purchases'
              ? 'Supplier deliveries and raw material purchases linked to warehouse inventory'
              : 'Raw material inventory · Inward receipts · Stock monitoring'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reload button in white color */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Data from Firebase"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-slate-900' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP 5 KPI CARDS (Clean Minimal Monochrome UI - No Colors) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-slate-300 transition">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Stock
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalStockVolume.toLocaleString('en-IN', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1
            })}{' '}
            <span className="text-xs font-bold text-slate-500 uppercase">{primaryUnit}</span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Available physical stock</div>
        </div>

        {/* Card 2: Low Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-slate-300 transition">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Low Stock
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalLowAlertCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Below minimum alert level</div>
        </div>

        {/* Card 3: Healthy Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-slate-300 transition">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Healthy Stock
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {healthyStockCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Sufficient stock balance</div>
        </div>

        {/* Card 4: Received Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-slate-300 transition">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Received Today
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {receivedTodayCount > 0 ? receivedTodayCount.toLocaleString('en-IN') : '0'}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Inward entries today</div>
        </div>

        {/* Card 5: Inventory Value */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1.5 hover:border-slate-300 transition">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Inventory Value
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatInventoryValueBadge(totalInventoryValue)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">Valuation at avg. cost</div>
        </div>
      </div>

      {/* TABS ROW: Stock Overview & Raw Material Purchase */}
      <div className="flex items-center gap-8 border-b border-slate-200/90 px-1 pt-1">
        <button
          onClick={() => {
            setActiveTab('overview');
            navigate('/erp/warehouse', { replace: true });
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${activeTab === 'overview'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Package className="w-4 h-4" />
          <span>Stock Overview</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('purchases');
            navigate('/erp/purchases', { replace: true });
          }}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition cursor-pointer border-b-2 ${activeTab === 'purchases'
            ? 'border-slate-900 text-slate-900'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Raw Material Purchase</span>
        </button>
      </div>

      {/* SUB-HEADER / CONTROLS & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Search Input (with column-wise selector for purchases) */}
        <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs focus-within:ring-1 focus-within:ring-slate-900 focus-within:border-slate-900 w-full sm:w-auto">
          {activeTab === 'purchases' && (
            <div className="relative bg-slate-50 border-r border-slate-200 shrink-0">
              <select
                value={purchaseSearchColumn}
                onChange={(e) => setPurchaseSearchColumn(e.target.value)}
                className="h-9 pl-3 pr-7 bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer appearance-none"
                title="Select column to search in"
              >
                <option value="ALL">All Columns</option>
                <option value="purchaseNumber">Purchase No</option>
                <option value="purchaseDate">Date</option>
                <option value="vendorName">Supplier / Vendor</option>
                <option value="vehicleNo">Vehicle No</option>
                {purchaseSubTab === 'firewood' ? (
                  <>
                    <option value="wbSlipNo">WB Slip No</option>
                    <option value="weighbridgeName">WB Center</option>
                    <option value="materialVariety">Material Variety</option>
                  </>
                ) : (
                  <>
                    <option value="supplierInvoiceNo">Invoice No</option>
                    <option value="itemName">Material / Item</option>
                  </>
                )}
                <option value="status">Status</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <div className="relative flex-1 flex items-center min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'overview'
                  ? 'Search materials...'
                  : purchaseSearchColumn === 'ALL'
                    ? 'Search across all columns...'
                    : `Search by ${getColumnDisplayName(purchaseSearchColumn)}...`
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-7 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 transition"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Health Status Filter Pills (Active only on Stock Overview tab) */}
        {activeTab === 'overview' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Healthy' ? 'ALL' : 'Healthy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${activeStatusFilter === 'Healthy'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              Healthy: {healthyStockCount}
            </button>

            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Low Stock' ? 'ALL' : 'Low Stock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${activeStatusFilter === 'Low Stock'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              Low Stock: {lowStockCount}
            </button>

            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Critical' ? 'ALL' : 'Critical')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${activeStatusFilter === 'Critical'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              Critical Stock: {criticalCount}
            </button>

            <button
              onClick={() => setActiveStatusFilter(activeStatusFilter === 'Out Of Stock' ? 'ALL' : 'Out Of Stock')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${activeStatusFilter === 'Out Of Stock'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
            >
              Out Of Stock: {outOfStockCount}
            </button>
          </div>
        )}

        {/* Purchases Ledger Filters & Controls (Active on Purchases Tab) */}
        {activeTab === 'purchases' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Vendor Filter Dropdown */}
            <select
              value={purchaseVendorFilter}
              onChange={(e) => setPurchaseVendorFilter(e.target.value)}
              className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-[170px] truncate cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Suppliers</option>
              {purchaseVendorsList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>

            {/* Date Range: From & To */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-9 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">From</span>
              <input
                type="date"
                value={purchaseStartDate}
                onChange={(e) => setPurchaseStartDate(e.target.value)}
                className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent"
              />
              <span className="text-slate-300">|</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">To</span>
              <input
                type="date"
                value={purchaseEndDate}
                onChange={(e) => setPurchaseEndDate(e.target.value)}
                className="text-xs text-slate-700 font-medium focus:outline-none bg-transparent"
              />
            </div>

            {/* Toggle Inline Column Filters Button */}
            <button
              type="button"
              onClick={() => setShowColumnFilters(!showColumnFilters)}
              className={`h-9 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${showColumnFilters || Object.values(columnFilters).some((v) => (v || '').trim() !== '')
                ? 'bg-slate-900 text-white border-slate-900 font-bold'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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

            {/* Clear Filters Button */}
            {isAnyPurchaseFilterActive && (
              <button
                type="button"
                onClick={handleResetPurchaseFilters}
                className="h-9 px-3 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                title="Reset all search, column filters & date range"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Right Actions: Export Excel & Add Purchase Entry (All Black Buttons) */}
        <div className="flex items-center gap-2 ml-auto">
          {activeTab === 'overview' && (
            <button
              onClick={handleExportExcel}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs transition shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            onClick={() => handleOpenNewPurchase()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 text-xs transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {activeTab === 'purchases' && purchaseSubTab === 'firewood'
                ? 'New Firewood Purchase'
                : 'New Purchase Entry'}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: STOCK OVERVIEW (CARDS GRID: 3 CARDS PER ROW) */}
      {activeTab === 'overview' && (
        <div className="pt-1">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-900 mb-2" />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStockItems.map((item) => {
                const health = item.healthStatus || 'Healthy';
                const curStock = item.availableStock || 0;
                const minStock = item.minimumStockLevel || 0;

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
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe] shrink-0 uppercase">
                          {item.itemCode || 'ITEM'}
                        </span>
                        <span
                          className="font-bold text-slate-900 text-sm leading-snug line-clamp-1"
                          title={item.itemName}
                        >
                          {item.itemName}
                        </span>
                      </div>

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

      {/* TAB 2: RAW MATERIAL PURCHASES */}
      {activeTab === 'purchases' && (
        <TableMaximizeWrapper
          title={purchaseSubTab === 'firewood' ? 'Firewood Purchases Ledger' : 'Raw Material Purchases Ledger'}
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {purchaseSubTab === 'firewood' ? filteredFirewoodPurchases.length : filteredGeneralPurchases.length} Purchases
            </span>
          }
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {purchaseSubTab === 'firewood' ? 'Firewood Purchases Ledger' : 'Raw Material Purchases Ledger'}
                </h3>
                <p className="text-xs text-slate-500">
                  {purchaseSubTab === 'firewood'
                    ? 'Recorded firewood consignments with weighbridge slip verification and gross/tare weights'
                    : 'Recorded supplier deliveries and raw material purchases linked to warehouse inventory'}
                </p>
              </div>

              {/* Sub-tab Switcher: Raw Material Purchases vs Firewood (Weighbridge) */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPurchaseSubTab('general')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${purchaseSubTab === 'general'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <span>Raw Material Purchases</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${purchaseSubTab === 'general'
                      ? 'bg-slate-100 text-slate-800'
                      : 'bg-slate-200/70 text-slate-600'
                      }`}
                  >
                    {generalPurchasesCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPurchaseSubTab('firewood')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${purchaseSubTab === 'firewood'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  <span>Firewood (Weighbridge)</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${purchaseSubTab === 'firewood'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-slate-200/70 text-slate-600'
                      }`}
                  >
                    {firewoodPurchasesCount}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-900 mb-2" />
                  Loading purchase entries...
                </div>
              ) : purchaseSubTab === 'general' ? (
                /* TABLE 1: GENERAL RAW MATERIAL & CHEMICAL PURCHASES */
                <div data-table-scroll="true" className="border border-slate-300 rounded-xl overflow-auto max-h-[620px] shadow-2xs relative">
                  <table className="w-full text-left border-collapse text-xs border border-slate-300">
                    <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                      <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px] tracking-wider border-b-2 border-slate-300">
                        <th
                          onClick={() => handleSort('purchaseNumber')}
                          className="p-3 border border-slate-300 text-left whitespace-nowrap min-w-[125px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Purchase No</span>
                            {renderSortIcon('purchaseNumber')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('purchaseDate')}
                          className="p-3 border border-slate-300 text-left whitespace-nowrap min-w-[105px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Date</span>
                            {renderSortIcon('purchaseDate')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('vendorName')}
                          className="p-3 border border-slate-300 text-left min-w-[140px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Supplier / Vendor</span>
                            {renderSortIcon('vendorName')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('supplierInvoiceNo')}
                          className="p-3 border border-slate-300 text-left min-w-[130px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Invoice & Vehicle</span>
                            {renderSortIcon('supplierInvoiceNo')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('itemName')}
                          className="p-3 border border-slate-300 text-left min-w-[140px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Material / Item</span>
                            {renderSortIcon('itemName')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('quantity')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[100px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Quantity</span>
                            {renderSortIcon('quantity')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('grandTotal')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[110px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Amount (₹)</span>
                            {renderSortIcon('grandTotal')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="p-3 border border-slate-300 text-center whitespace-nowrap min-w-[95px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-center">
                            <span>Status</span>
                            {renderSortIcon('status')}
                          </div>
                        </th>
                        <th className="p-3 border border-slate-300 text-center whitespace-nowrap min-w-[140px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] pr-12">
                          Actions
                        </th>
                      </tr>

                      {showColumnFilters && (
                        <tr className="bg-slate-100/90 border-b-2 border-slate-300">
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter no..."
                              value={columnFilters.purchaseNumber || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, purchaseNumber: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter date..."
                              value={columnFilters.purchaseDate || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, purchaseDate: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter supplier..."
                              value={columnFilters.vendorName || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, vendorName: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter inv / veh..."
                              value={columnFilters.supplierInvoiceNo || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, supplierInvoiceNo: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter material..."
                              value={columnFilters.itemName || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, itemName: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter qty..."
                              value={columnFilters.quantity || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, quantity: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter amt..."
                              value={columnFilters.grandTotal || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, grandTotal: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100">
                            <input
                              type="text"
                              placeholder="Filter status..."
                              value={columnFilters.status || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-center"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center min-w-[140px] pr-12">
                            {Object.values(columnFilters).some(v => (v || '').trim() !== '') && (
                              <button
                                type="button"
                                onClick={() => setColumnFilters({})}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded"
                                title="Clear column filters"
                              >
                                Clear
                              </button>
                            )}
                          </th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="bg-white">
                      {filteredGeneralPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-14 text-center text-xs text-slate-400 bg-white">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <Package className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                              <div className="text-sm font-bold text-slate-700">No Matching Purchase Entries</div>
                              <p className="text-slate-400 text-xs leading-relaxed">
                                No raw material purchases match your current search, column filters, or date range.
                              </p>
                              {isAnyPurchaseFilterActive && (
                                <button
                                  type="button"
                                  onClick={handleResetPurchaseFilters}
                                  className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reset All Filters</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredGeneralPurchases.map((p) => {
                          const lines = p.lines && p.lines.length > 0 ? p.lines : null;
                          if (!lines) {
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap">
                                  <div className="font-mono font-bold text-slate-900 tracking-tight">{p.purchaseNumber}</div>
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap">
                                  <div className="text-slate-700 font-medium text-xs">{formatDate(p.purchaseDate)}</div>
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-left">
                                  <div className="font-bold text-slate-900 leading-tight">{p.vendorName}</div>
                                  {p.vendorCode && (
                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.vendorCode}</div>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-left">
                                  <div className="font-medium text-slate-800">Inv: {p.supplierInvoiceNo || '—'}</div>
                                  {p.vehicleNo && (
                                    <div className="mt-1">
                                      <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70 inline-block">
                                        Veh: {p.vehicleNo}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-left text-slate-400 italic">No items</td>
                                <td className="p-3 border border-slate-200 align-middle text-right text-slate-400 whitespace-nowrap font-bold">—</td>
                                <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap font-black text-slate-900">
                                  {formatCurrency(p.grandTotal)}
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${p.status === 'Received'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : p.status === 'Confirmed'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : p.status === 'Draft'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-rose-50 text-rose-700 border-rose-200'
                                      }`}
                                  >
                                    {p.status}
                                  </span>
                                </td>
                                <td className="p-3 border border-slate-200 align-middle text-center whitespace-nowrap">
                                  <div className="inline-flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => handleOpenViewPurchase(p)}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditPurchase(p)}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePurchase(p)}
                                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <React.Fragment key={p.id}>
                              {lines.map((line, idx) => (
                                <tr key={`${p.id}_line_${line.lineId || idx}`} className="hover:bg-slate-50/70 transition-colors">
                                  {idx === 0 && (
                                    <>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap bg-white">
                                        <div className="font-mono font-bold text-slate-900 tracking-tight">{p.purchaseNumber}</div>
                                        {lines.length > 1 && (
                                          <div className="text-[11px] font-black text-slate-900 mt-1.5 pt-1 border-t border-slate-100">
                                            Total: {formatCurrency(p.grandTotal)}
                                          </div>
                                        )}
                                      </td>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap bg-white">
                                        <div className="text-slate-700 font-medium text-xs">{formatDate(p.purchaseDate)}</div>
                                      </td>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 align-middle text-left bg-white">
                                        <div className="font-bold text-slate-900 leading-tight">{p.vendorName}</div>
                                        {p.vendorCode && (
                                          <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.vendorCode}</div>
                                        )}
                                      </td>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 align-middle text-left bg-white">
                                        <div className="font-medium text-slate-800">Inv: {p.supplierInvoiceNo || '—'}</div>
                                        {p.vehicleNo && (
                                          <div className="mt-1">
                                            <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/70 inline-block">
                                              Veh: {p.vehicleNo}
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                    </>
                                  )}

                                  {/* Separate Item Row: Material, Quantity, and Amount */}
                                  <td className="p-3 border border-slate-200 align-middle text-left">
                                    <div className="font-semibold text-slate-900 leading-tight">{line.itemName}</div>
                                    {line.itemCode && (
                                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{line.itemCode}</div>
                                    )}
                                  </td>
                                  <td className="p-3 border border-slate-200 align-middle text-right font-bold text-slate-800 whitespace-nowrap">
                                    {Number(line.quantity).toLocaleString('en-IN')} {line.unit}
                                  </td>
                                  <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap">
                                    <div className="font-black text-slate-900">
                                      {formatCurrency(line.amount || (line.quantity * line.rate))}
                                    </div>
                                    {line.rate && Number(line.rate) > 0 ? (
                                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                        @ ₹{Number(line.rate).toFixed(2)}/{line.unit}
                                      </div>
                                    ) : null}
                                  </td>

                                  {idx === 0 && (
                                    <>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 text-center align-middle whitespace-nowrap bg-white">
                                        <span
                                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${p.status === 'Received'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : p.status === 'Confirmed'
                                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                                              : p.status === 'Draft'
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}
                                        >
                                          {p.status}
                                        </span>
                                      </td>
                                      <td rowSpan={lines.length} className="p-3 border border-slate-200 text-center align-middle whitespace-nowrap bg-white">
                                        <div className="inline-flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleOpenViewPurchase(p)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                          >
                                            View
                                          </button>
                                          <button
                                            onClick={() => handleOpenEditPurchase(p)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeletePurchase(p)}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                    <TableTotalsFooter
                      cells={[
                        { colSpan: 5, label: `TOTAL (${filteredGeneralPurchases.length} purchases)` },
                        { value: generalTotals.totalQty.toLocaleString('en-IN'), isTotal: true },
                        { currency: generalTotals.totalAmt, isTotal: true },
                        { align: 'center' },
                        { align: 'center' }
                      ]}
                    />
                  </table>
                </div>
              ) : (
                /* TABLE 2: FIREWOOD PURCHASES (WITH FULL WEIGHBRIDGE DETAILS) */
                <div data-table-scroll="true" className="border border-slate-300 rounded-xl overflow-auto max-h-[620px] shadow-2xs relative">
                  <table className="w-full text-left border-collapse text-xs border border-slate-300">
                    <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                      <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px] tracking-wider border-b-2 border-slate-300">
                        <th
                          onClick={() => handleSort('purchaseNumber')}
                          className="p-3 border border-slate-300 text-left whitespace-nowrap min-w-[125px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Purchase No</span>
                            {renderSortIcon('purchaseNumber')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('purchaseDate')}
                          className="p-3 border border-slate-300 text-left whitespace-nowrap min-w-[105px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Date</span>
                            {renderSortIcon('purchaseDate')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('vendorName')}
                          className="p-3 border border-slate-300 text-left min-w-[130px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Supplier / Vendor</span>
                            {renderSortIcon('vendorName')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('wbSlipNo')}
                          className="p-3 border border-slate-300 text-left min-w-[130px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>WB Slip No & Center</span>
                            {renderSortIcon('wbSlipNo')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('vehicleNo')}
                          className="p-3 border border-slate-300 text-center whitespace-nowrap min-w-[100px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-center">
                            <span>Vehicle No</span>
                            {renderSortIcon('vehicleNo')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('materialVariety')}
                          className="p-3 border border-slate-300 text-left min-w-[130px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span>Material Variety</span>
                            {renderSortIcon('materialVariety')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('grossWeightKg')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[105px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Gross Wt</span>
                            {renderSortIcon('grossWeightKg')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('tareWeightKg')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[105px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Tare Wt</span>
                            {renderSortIcon('tareWeightKg')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('nettWeightKg')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[115px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Nett Wt (Qty)</span>
                            {renderSortIcon('nettWeightKg')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('rate')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[95px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Rate</span>
                            {renderSortIcon('rate')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('grandTotal')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[105px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>Amount (₹)</span>
                            {renderSortIcon('grandTotal')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('wbCharges')}
                          className="p-3 border border-slate-300 text-right whitespace-nowrap min-w-[95px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            <span>WB Charges</span>
                            {renderSortIcon('wbCharges')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('status')}
                          className="p-3 border border-slate-300 text-center whitespace-nowrap min-w-[95px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] cursor-pointer select-none group hover:bg-[#DCE9F5] transition-colors"
                        >
                          <div className="flex items-center gap-1 justify-center">
                            <span>Status</span>
                            {renderSortIcon('status')}
                          </div>
                        </th>
                        <th className="p-3 border border-slate-300 text-center whitespace-nowrap min-w-[140px] sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] pr-12">
                          Actions
                        </th>
                      </tr>

                      {showColumnFilters && (
                        <tr className="bg-amber-100/90 border-b-2 border-amber-300">
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter no..."
                              value={columnFilters.purchaseNumber || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, purchaseNumber: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter date..."
                              value={columnFilters.purchaseDate || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, purchaseDate: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter supplier..."
                              value={columnFilters.vendorName || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, vendorName: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter slip/center..."
                              value={columnFilters.wbSlipNo || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, wbSlipNo: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter vehicle..."
                              value={columnFilters.vehicleNo || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, vehicleNo: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-center"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter variety..."
                              value={columnFilters.materialVariety || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, materialVariety: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter gross..."
                              value={columnFilters.grossWeightKg || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, grossWeightKg: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter tare..."
                              value={columnFilters.tareWeightKg || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, tareWeightKg: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter nett..."
                              value={columnFilters.nettWeightKg || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, nettWeightKg: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter rate..."
                              value={columnFilters.rate || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, rate: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter amt..."
                              value={columnFilters.grandTotal || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, grandTotal: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter charges..."
                              value={columnFilters.wbCharges || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, wbCharges: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-right"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-amber-100">
                            <input
                              type="text"
                              placeholder="Filter status..."
                              value={columnFilters.status || ''}
                              onChange={(e) => setColumnFilters({ ...columnFilters, status: e.target.value })}
                              className="w-full h-7 px-2 text-[11px] font-normal bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-900 text-center"
                            />
                          </th>
                          <th className="p-1.5 border border-slate-200 sticky top-[41px] z-20 bg-slate-100 text-center min-w-[140px] pr-12">
                            {Object.values(columnFilters).some(v => (v || '').trim() !== '') && (
                              <button
                                type="button"
                                onClick={() => setColumnFilters({})}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded"
                                title="Clear column filters"
                              >
                                Clear
                              </button>
                            )}
                          </th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="bg-white">
                      {filteredFirewoodPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-14 text-center text-xs text-slate-400 bg-white">
                            <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                              <Truck className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                              <div className="text-sm font-bold text-slate-700">No Matching Firewood Deliveries</div>
                              <p className="text-slate-400 text-xs leading-relaxed">
                                No firewood consignments match your current search, weighbridge slip, or column filters.
                              </p>
                              {isAnyPurchaseFilterActive && (
                                <button
                                  type="button"
                                  onClick={handleResetPurchaseFilters}
                                  className="mt-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reset All Filters</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredFirewoodPurchases.map((p) => {
                          const firstLine = p.lines?.[0];
                          const wb = p.weighbridge;
                          return (
                            <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                              <td className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap">
                                <div className="font-mono font-bold text-slate-900 tracking-tight">{p.purchaseNumber}</div>
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-left whitespace-nowrap">
                                <div className="text-slate-700 font-medium text-xs">{formatDate(p.purchaseDate)}</div>
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-left">
                                <div className="font-bold text-slate-900 leading-tight">{p.vendorName}</div>
                                {p.vendorCode && (
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{p.vendorCode}</div>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-left">
                                {wb?.slipNo ? (
                                  <div className="font-mono font-bold text-amber-950">
                                    Slip #{wb.slipNo}
                                  </div>
                                ) : (
                                  <div className="text-slate-400 font-medium italic text-[11px]">
                                    No slip recorded
                                  </div>
                                )}
                                {wb?.weighbridgeName ? (
                                  <div className="text-[11px] text-slate-600 font-medium truncate max-w-[160px] mt-0.5">
                                    {wb.weighbridgeName}
                                  </div>
                                ) : p.supplierInvoiceNo ? (
                                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Inv: {p.supplierInvoiceNo}</div>
                                ) : null}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-center whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 text-xs inline-block">
                                  {wb?.vehicleNo || p.vehicleNo || '—'}
                                </span>
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-left">
                                <div className="font-semibold text-slate-900 leading-tight">
                                  {wb?.materialVariety || firstLine?.itemName || 'Firewood'}
                                </div>
                                {firstLine?.itemCode && (
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">{firstLine.itemCode}</div>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap">
                                {wb?.grossWeightKg ? (
                                  <>
                                    <div className="font-mono font-bold text-slate-900">
                                      {Number(wb.grossWeightKg).toLocaleString('en-IN')} kg
                                    </div>
                                    {wb?.grossWeightTime && (
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{wb.grossWeightTime}</div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap">
                                {wb?.tareWeightKg ? (
                                  <>
                                    <div className="font-mono font-bold text-slate-900">
                                      {Number(wb.tareWeightKg).toLocaleString('en-IN')} kg
                                    </div>
                                    {wb?.tareWeightTime && (
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{wb.tareWeightTime}</div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap">
                                <div className="font-mono font-black text-amber-950 text-xs">
                                  {wb?.nettWeightKg
                                    ? `${Number(wb.nettWeightKg).toLocaleString('en-IN')} kg`
                                    : firstLine
                                      ? `${Number(firstLine.quantity).toLocaleString('en-IN')} ${firstLine.unit}`
                                      : '—'}
                                </div>
                                {wb?.nettWeightTonnes ? (
                                  <div className="text-[10px] font-mono text-slate-500 font-bold mt-0.5">
                                    ({wb.nettWeightTonnes} T)
                                  </div>
                                ) : null}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap text-slate-700 font-medium">
                                {firstLine?.rate && Number(firstLine.rate) > 0 ? (
                                  <span>₹{Number(firstLine.rate).toFixed(2)}/{firstLine.unit}</span>
                                ) : (
                                  <span className="text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap font-black text-slate-900">
                                {formatCurrency(p.grandTotal)}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-right whitespace-nowrap font-semibold text-slate-700">
                                {wb?.weighbridgeCharges !== undefined && wb?.weighbridgeCharges !== 0 ? (
                                  `₹${wb.weighbridgeCharges}`
                                ) : (
                                  <span className="text-slate-300 font-bold">—</span>
                                )}
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${p.status === 'Received'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : p.status === 'Confirmed'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : p.status === 'Draft'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td className="p-3 border border-slate-200 align-middle text-center whitespace-nowrap">
                                <div className="inline-flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenViewPurchase(p)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditPurchase(p)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeletePurchase(p)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <TableTotalsFooter
                      cells={[
                        { colSpan: 6, label: `TOTAL (${filteredFirewoodPurchases.length} consignments)` },
                        { value: `${firewoodTotals.gross.toLocaleString('en-IN')} kg`, isTotal: true },
                        { value: `${firewoodTotals.tare.toLocaleString('en-IN')} kg`, isTotal: true },
                        { value: `${firewoodTotals.nett.toLocaleString('en-IN')} kg`, isTotal: true },
                        { align: 'center' },
                        { currency: firewoodTotals.totalAmt, isTotal: true },
                        { currency: firewoodTotals.charges, isTotal: true },
                        { align: 'center' },
                        { align: 'center' }
                      ]}
                    />
                  </table>
                </div>
              )}
            </div>
          </div>
        </TableMaximizeWrapper>
      )}

      {/* MODAL: NEW / EDIT RAW MATERIAL PURCHASE ENTRY */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title={isEditMode ? 'Edit Raw Material Purchase Entry' : 'New Raw Material Purchase Entry'}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Top Row: Select Supplier / Vendor (Searchable, wide), Purchase Type (Searchable), Purchase Date */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Select Supplier / Vendor <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                value={vendorId}
                placeholder="-- Choose Supplier / Vendor --"
                searchPlaceholder="Search supplier company name, code, city..."
                groups={supplierOptionGroups}
                onSelect={(opt) => setVendorId(opt.id)}
                formatTriggerLabel={(opt) => (
                  <span className="truncate font-semibold text-slate-900 text-xs flex items-center justify-between w-full">
                    <span className="truncate">{opt.primaryText}</span>
                    {opt.badge && (
                      <span
                        className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${opt.badge === 'Customer & Supplier'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                          }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </span>
                )}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Purchase Type <span className="text-rose-500">*</span>
              </label>
              <SearchableSelect
                value={purchaseType}
                placeholder="Select Purchase Type..."
                searchPlaceholder="Search purchase type..."
                groups={purchaseTypeOptionGroups}
                onSelect={(opt) => setPurchaseType(opt.id as PurchaseType)}
                dropdownWidth="trigger"
                showSearch={false}
                formatTriggerLabel={(opt) => (
                  <span className="truncate font-semibold text-slate-900 text-xs">
                    {opt.primaryText}
                  </span>
                )}
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Purchase Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Second Row: Supplier Invoice / DC No, Invoice Date, Vehicle No, Driver Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 truncate">
                Supplier Invoice / DC No <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. INV-901, DC-WOOD-44"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                required
                className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 truncate">Invoice Date</label>
              <input
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 truncate">Vehicle No</label>
              <input
                type="text"
                placeholder="e.g. TN-22-BY-8901"
                value={vehicleNo}
                onChange={(e) => {
                  const val = e.target.value;
                  setVehicleNo(val);
                  if (!wbVehicleNo || wbVehicleNo === vehicleNo) {
                    setWbVehicleNo(val);
                  }
                }}
                className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 truncate">Driver Name & Phone</label>
              <input
                type="text"
                placeholder="e.g. S. Kumar (9876543210)"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="w-full h-10 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* WEIGHBRIDGE DETAILS SECTION (Only for Firewood purchase entry) */}
          {isFirewood && (
            <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-3.5 transition-all">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-amber-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                      Weighbridge Details
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
                      Firewood Consignment
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Record gross, tare & nett weight directly from the physical weighbridge receipt slip
                  </p>
                </div>

                {wbNettWeightKg > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyNettWeightToLine}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                    title="Copy calculated Nett Weight into the firewood line item quantity"
                  >
                    <span>Apply Nett Weight to Material Qty</span>
                    <span className="bg-emerald-700/60 px-1.5 py-0.5 rounded text-[10px]">
                      {wbNettWeightKg.toLocaleString('en-IN')} kg ({wbNettWeightTonnes} T)
                    </span>
                  </button>
                )}
              </div>

              {/* Row 1: Slip No, Weighbridge Center, Charges, Material Variety */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Serial / Slip No.
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2375"
                    value={wbSlipNo}
                    onChange={(e) => setWbSlipNo(e.target.value)}
                    className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs text-slate-800 placeholder-slate-400 font-mono font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Weighbridge Name / Center
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. JBS Electronic Weighbridge"
                    value={wbName}
                    onChange={(e) => setWbName(e.target.value)}
                    className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Wt. Charges (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 200"
                      value={wbCharges}
                      onChange={(e) => setWbCharges(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-9 bg-white border border-amber-200 rounded-lg pl-7 pr-3 text-xs text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Material Variety
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Savukku Kottai"
                    value={wbMaterialVariety}
                    onChange={(e) => setWbMaterialVariety(e.target.value)}
                    className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Row 2: Gross Weight (kg & Time), Tare Weight (kg & Time) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gross Wt
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      placeholder="e.g. 17560"
                      value={wbGrossWeightKg}
                      onChange={(e) => setWbGrossWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-9 bg-white border border-amber-200 rounded-l-lg px-3 text-xs text-slate-800 font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="inline-flex items-center px-2.5 text-xs font-bold text-slate-600 bg-amber-100 border border-l-0 border-amber-200 rounded-r-lg">
                      kg
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gross Wt Date & Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24/10/2026 04:46"
                    value={wbGrossWeightTime}
                    onChange={(e) => setWbGrossWeightTime(e.target.value)}
                    className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tare Wt
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      placeholder="e.g. 7800"
                      value={wbTareWeightKg}
                      onChange={(e) => setWbTareWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full h-9 bg-white border border-amber-200 rounded-l-lg px-3 text-xs text-slate-800 font-mono font-bold placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <span className="inline-flex items-center px-2.5 text-xs font-bold text-slate-600 bg-amber-100 border border-l-0 border-amber-200 rounded-r-lg">
                      kg
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tare Wt Date & Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24/10/2026 07:24"
                    value={wbTareWeightTime}
                    onChange={(e) => setWbTareWeightTime(e.target.value)}
                    className="w-full h-9 bg-white border border-amber-200 rounded-lg px-3 text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Row 3: Auto-Calculated Nett Weight Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/95 rounded-xl border border-amber-200 text-xs shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-slate-600">
                    <span className="font-semibold text-slate-500 text-[11px]">Gross Wt:</span>{' '}
                    <span className="font-bold text-slate-900 font-mono">
                      {wbGrossWeightKg !== '' ? `${Number(wbGrossWeightKg).toLocaleString('en-IN')} kg` : '—'}
                    </span>
                  </div>
                  <span className="text-slate-300 font-bold">−</span>
                  <div className="text-slate-600">
                    <span className="font-semibold text-slate-500 text-[11px]">Tare Wt:</span>{' '}
                    <span className="font-bold text-slate-900 font-mono">
                      {wbTareWeightKg !== '' ? `${Number(wbTareWeightKg).toLocaleString('en-IN')} kg` : '—'}
                    </span>
                  </div>
                  <span className="text-slate-300 font-bold">=</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 uppercase text-[10px]">Nett Weight:</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-950 font-black text-sm font-mono border border-amber-300">
                      {wbNettWeightKg.toLocaleString('en-IN')} kg
                    </span>
                    <span className="text-xs font-bold text-slate-600 font-mono">
                      ({wbNettWeightTonnes} Tonnes)
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 italic">
                  * Auto-calculated (Gross − Tare). Click "Apply Nett Weight" to sync with material quantity.
                </div>
              </div>
            </div>
          )}

          {/* Section: MATERIALS & LINE ITEMS */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                MATERIALS & LINE ITEMS ({formLines.length})
              </span>
              <button
                type="button"
                onClick={handleAddMaterialLine}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 transition cursor-pointer"
              >
                + Add Material Line
              </button>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="p-2.5">MATERIAL / ITEM</th>
                    <th className="p-2.5 w-16">UNIT</th>
                    <th className="p-2.5 w-24">QUANTITY</th>
                    <th className="p-2.5 w-24">RATE (₹)</th>
                    <th className="p-2.5 w-28 text-right">AMOUNT (₹)</th>
                    {formLines.length > 1 && <th className="p-2.5 w-8"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formLines.map((line, idx) => (
                    <tr key={line.lineId || idx} className="hover:bg-slate-50/40">
                      <td className="p-2">
                        <select
                          value={line.itemId}
                          onChange={(e) => handleLineItemChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        >
                          <option value="">-- Choose Item from Master --</option>
                          {validItems.map((s) => (
                            <option key={s.itemId} value={s.itemId}>
                              {s.itemName} ({s.itemCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 font-bold text-slate-600 text-center uppercase">
                        {line.unit || 'kg'}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="0"
                          value={line.quantity === '' ? '' : line.quantity}
                          onChange={(e) => handleLineQtyChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={line.rate === '' ? '' : line.rate}
                          onChange={(e) => handleLineRateChange(idx, e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </td>
                      <td className="p-2 text-right font-black text-slate-900">
                        {formatCurrency(line.amount || 0)}
                      </td>
                      {formLines.length > 1 && (
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterialLine(idx)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold p-1 cursor-pointer"
                            title="Remove Line"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Bottom Bar */}
              <div className="bg-slate-50/80 p-3 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">
                  Total Items: {formLines.length} | Total Quantity: {formTotalQuantity.toLocaleString('en-IN')}
                </span>
                <span className="font-black text-slate-900 text-sm">
                  Grand Total: {formatCurrency(formGrandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Remarks & Observations (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Weighbridge gross/tare recorded, quality verified..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsPurchaseModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={() => handleSavePurchase('Draft')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={formSubmitting}
              onClick={() => handleSavePurchase('Confirmed')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {formSubmitting ? 'Recording Purchase...' : 'Save & Confirm Purchase'}
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: VIEW PURCHASE DETAILS */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={viewingPurchase ? `Purchase Details: ${viewingPurchase.purchaseNumber}` : 'Purchase Details'}
        maxWidth="lg"
      >
        {viewingPurchase && (
          <div className="space-y-4 text-xs">
            {/* Header info strip */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Purchase Date</div>
                <div className="font-bold text-slate-900">{formatDate(viewingPurchase.purchaseDate)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
                <div className="font-bold text-slate-900">{viewingPurchase.status}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Invoice / DC No</div>
                <div className="font-bold text-slate-900">{viewingPurchase.supplierInvoiceNo || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Vehicle No</div>
                <div className="font-bold text-slate-900">{viewingPurchase.vehicleNo || '—'}</div>
              </div>
            </div>

            {/* Weighbridge Details Card (if recorded for Firewood) */}
            {viewingPurchase.purchaseType === 'Firewood' && viewingPurchase.weighbridge && (
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/90 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/80">
                  <div className="font-bold text-amber-950 text-xs">
                    <span>Weighbridge Receipt Slip</span>
                  </div>
                  {viewingPurchase.weighbridge.slipNo && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                      Slip #{viewingPurchase.weighbridge.slipNo}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">Weighbridge Center</span>
                    <span className="font-bold text-slate-800">{viewingPurchase.weighbridge.weighbridgeName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">Vehicle No</span>
                    <span className="font-bold text-slate-800">{viewingPurchase.weighbridge.vehicleNo || viewingPurchase.vehicleNo || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">Wt. Charges</span>
                    <span className="font-bold text-slate-800">
                      {viewingPurchase.weighbridge.weighbridgeCharges ? `₹${viewingPurchase.weighbridge.weighbridgeCharges}` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-semibold">Material Variety</span>
                    <span className="font-bold text-slate-800">{viewingPurchase.weighbridge.materialVariety || '—'}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Gross Wt:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {viewingPurchase.weighbridge.grossWeightKg?.toLocaleString('en-IN') || 0} kg
                    </span>
                    {viewingPurchase.weighbridge.grossWeightTime && (
                      <span className="text-[10px] text-slate-400 font-mono">({viewingPurchase.weighbridge.grossWeightTime})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Tare Wt:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {viewingPurchase.weighbridge.tareWeightKg?.toLocaleString('en-IN') || 0} kg
                    </span>
                    {viewingPurchase.weighbridge.tareWeightTime && (
                      <span className="text-[10px] text-slate-400 font-mono">({viewingPurchase.weighbridge.tareWeightTime})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-amber-200">
                    <span className="font-bold text-amber-900 text-[11px] uppercase">Nett Wt:</span>
                    <span className="px-2 py-0.5 rounded font-black text-xs font-mono bg-amber-100 text-amber-950 border border-amber-300">
                      {viewingPurchase.weighbridge.nettWeightKg?.toLocaleString('en-IN') || 0} kg
                    </span>
                    {viewingPurchase.weighbridge.nettWeightTonnes ? (
                      <span className="text-[11px] font-bold text-slate-600 font-mono">
                        ({viewingPurchase.weighbridge.nettWeightTonnes} T)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Supplier Info */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Supplier / Vendor</div>
              <div className="text-sm font-bold text-slate-900">{viewingPurchase.vendorName}</div>
              {viewingPurchase.vendorCode && (
                <div className="text-[11px] font-mono text-slate-500">Code: {viewingPurchase.vendorCode}</div>
              )}
            </div>

            {/* Materials Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="p-2.5 bg-slate-50 font-bold text-slate-700 text-xs border-b border-slate-200 uppercase">
                Purchased Materials
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] uppercase text-slate-500 font-bold">
                    <th className="p-2.5">Material</th>
                    <th className="p-2.5">Code</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingPurchase.lines?.map((line, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-bold text-slate-900">{line.itemName}</td>
                      <td className="p-2.5 font-mono text-slate-500">{line.itemCode}</td>
                      <td className="p-2.5 text-right font-semibold text-slate-900">
                        {line.quantity} {line.unit}
                      </td>
                      <td className="p-2.5 text-right text-slate-700">₹{Number(line.rate || 0).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-black text-slate-900">
                        {formatCurrency(line.amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold">
                <span>Total Quantity: {viewingPurchase.totalQuantity.toLocaleString('en-IN')}</span>
                <span className="text-sm text-slate-900">
                  Grand Total: {formatCurrency(viewingPurchase.grandTotal)}
                </span>
              </div>
            </div>

            {viewingPurchase.remarks && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Remarks</div>
                <div className="text-slate-700">{viewingPurchase.remarks}</div>
              </div>
            )}

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>Recorded By: {viewingPurchase.createdByName || 'System'}</span>
              <span>Stock Status: {viewingPurchase.stockInwardCompleted ? 'Added to Warehouse Stock' : 'Pending Inward'}</span>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer"
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
