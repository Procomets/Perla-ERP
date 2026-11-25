import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MasterItem,
  ItemCategoryRecord,
  UnitOfMeasure,
  ItemType
} from '../../types/item';
import { ItemService } from '../../services/itemService';
import { ItemCategoryMasterService } from '../../services/itemCategoryMasterService';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../components/ui/TableMaximizeWrapper';
import { ItemModal } from './components/ItemModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import {
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Archive,
  Layers,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  X,
  RefreshCw
} from 'lucide-react';

export const ItemMasterPage: React.FC = () => {
  const { user, isDemoMode } = useAuth();
  const userRole = (user as any)?.role || 'Admin';
  const isAdminOrManager = userRole === 'Admin' || userRole === 'admin' || userRole === 'Manager' || userRole === 'manager';

  const currentUser = {
    uid: user?.uid || 'admin-uid',
    displayName: (user as any)?.displayName || (user as any)?.name || 'Authorized Staff'
  };

  // Core Data State
  const [items, setItems] = useState<MasterItem[]>([]);
  const [categories, setCategories] = useState<ItemCategoryRecord[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');

  // Inline Column Filters
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<{
    itemCode?: string;
    itemName?: string;
    categoryName?: string;
    baseUnit?: string;
    minStock?: string;
    status?: string;
  }>({});

  // 3-state Column Sorting
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | 'normal'>('normal');

  const handleSort = (field: string, isNumeric = false) => {
    const firstDir: 'asc' | 'desc' = isNumeric ? 'desc' : 'asc';
    const secondDir: 'asc' | 'desc' = isNumeric ? 'asc' : 'desc';
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

  const renderSortIcon = (field: string) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center shrink-0 ml-1 transition-colors ${isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60'
          }`}
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

  const handleColumnFilterChange = (field: keyof typeof columnFilters, val: string) => {
    setColumnFilters((prev) => ({ ...prev, [field]: val }));
  };

  const activeColumnFilterCount = useMemo(() => {
    return Object.values(columnFilters).filter((v) => (v || '').trim() !== '').length;
  }, [columnFilters]);

  const hasAnyFilter = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchColumn !== 'ALL' ||
      categoryFilter !== 'all' ||
      statusFilter !== 'all' ||
      activeColumnFilterCount > 0 ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, categoryFilter, statusFilter, activeColumnFilterCount, sortField, sortDirection]);

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setCategoryFilter('all');
    setStatusFilter('all');
    setColumnFilters({});
    setSortField(null);
    setSortDirection('normal');
  };

  // Modals State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemModalDefaultCategoryId, setItemModalDefaultCategoryId] = useState<string | undefined>(undefined);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<MasterItem | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState<MasterItem | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load items, units and categories from General Settings
  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, unitRes, catsRes] = await Promise.all([
        ItemService.getItems({}, { page: 1, pageSize: 1000 }, isDemoMode),
        ItemService.getUnitsOfMeasure(isDemoMode),
        ItemCategoryMasterService.getCategories()
      ]);
      setItems(itemsRes.items || []);
      setUnits(unitRes || []);
      if (catsRes && catsRes.length > 0) {
        setCategories(
          catsRes.map((c) => ({
            id: c.id,
            categoryId: c.categoryId || c.id,
            categoryName: c.categoryName || c.name,
            categoryCode: c.categoryCode,
            description: c.description,
            status: c.isActive ? 'active' : 'inactive',
            itemCount: 0,
            createdAt: typeof c.createdAt === 'string' ? c.createdAt : '',
            updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : ''
          }))
        );
      }
    } catch (err) {
      console.warn('Failed to load item master data:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Real-time subscribe to Item Category Master updates from General Settings
  useEffect(() => {
    const unsubscribe = ItemCategoryMasterService.subscribeCategories((cats) => {
      if (cats && cats.length > 0) {
        setCategories(
          cats.map((c) => ({
            id: c.id,
            categoryId: c.categoryId || c.id,
            categoryName: c.categoryName || c.name,
            categoryCode: c.categoryCode,
            description: c.description,
            status: c.isActive ? 'active' : 'inactive',
            itemCount: 0,
            createdAt: typeof c.createdAt === 'string' ? c.createdAt : '',
            updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : ''
          }))
        );
      }
    });

    return () => unsubscribe();
  }, []);

  // Derived counts
  const totalActiveCount = useMemo(
    () => items.filter((i) => i.status === 'active').length,
    [items]
  );
  const inactiveCount = useMemo(
    () => items.filter((i) => i.status === 'inactive').length,
    [items]
  );
  const activeCategoriesCount = useMemo(
    () => categories.filter((c) => c.status === 'active').length,
    [categories]
  );
  const lowStockCount = useMemo(
    () => items.filter((i) => (i.currentStock || 0) <= (i.minimumStockLevel || 0) && i.status === 'active').length,
    [items]
  );

  // Filtered Items for Single Table View
  const filteredItems = useMemo(() => {
    let list = [...items];

    if (statusFilter === 'active') {
      list = list.filter((i) => i.status === 'active');
    } else if (statusFilter === 'inactive') {
      list = list.filter((i) => i.status === 'inactive');
    }

    if (categoryFilter !== 'all') {
      list = list.filter((i) => {
        const cat = categories.find((c) => c.categoryId === categoryFilter || c.id === categoryFilter);
        return (
          i.categoryId === categoryFilter ||
          (cat && i.categoryName?.toLowerCase() === cat.categoryName?.toLowerCase())
        );
      });
    }

    // Integrated Search Bar with Column Dropdown
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      if (searchColumn === 'ALL') {
        list = list.filter(
          (it) =>
            it.itemName?.toLowerCase().includes(q) ||
            it.itemCode?.toLowerCase().includes(q) ||
            it.categoryName?.toLowerCase().includes(q) ||
            it.description?.toLowerCase().includes(q) ||
            it.baseUnit?.toLowerCase().includes(q)
        );
      } else {
        list = list.filter((it) => {
          const val = String((it as any)[searchColumn] || '').toLowerCase();
          return val.includes(q);
        });
      }
    }

    // Column Filters
    if (columnFilters.itemCode) {
      const q = columnFilters.itemCode.toLowerCase();
      list = list.filter((i) => (i.itemCode || '').toLowerCase().includes(q));
    }
    if (columnFilters.itemName) {
      const q = columnFilters.itemName.toLowerCase();
      list = list.filter((i) =>
        (i.itemName || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      );
    }
    if (columnFilters.categoryName) {
      const q = columnFilters.categoryName.toLowerCase();
      list = list.filter((i) => (i.categoryName || '').toLowerCase().includes(q));
    }
    if (columnFilters.baseUnit) {
      const q = columnFilters.baseUnit.toLowerCase();
      list = list.filter((i) => (i.baseUnit || '').toLowerCase().includes(q));
    }
    if (columnFilters.minStock) {
      const q = columnFilters.minStock.toLowerCase();
      list = list.filter((i) => String(i.minimumStockLevel ?? '').toLowerCase().includes(q));
    }
    if (columnFilters.status) {
      const q = columnFilters.status.toLowerCase();
      list = list.filter((i) => (i.status || '').toLowerCase().includes(q));
    }

    // 3-state Sorting
    if (sortField && sortDirection !== 'normal') {
      list.sort((a, b) => {
        if (sortField === 'minimumStockLevel') {
          const numA = Number(a.minimumStockLevel ?? 0);
          const numB = Number(b.minimumStockLevel ?? 0);
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const strA = String((a as any)[sortField] || '').toLowerCase();
        const strB = String((b as any)[sortField] || '').toLowerCase();
        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [items, statusFilter, categoryFilter, categories, searchQuery, searchColumn, columnFilters, sortField, sortDirection]);

  // Modal Handlers
  const handleAddNewItem = () => {
    setSelectedItemForEdit(null);
    setItemModalDefaultCategoryId(categoryFilter !== 'all' ? categoryFilter : undefined);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: MasterItem) => {
    setSelectedItemForEdit(item);
    setItemModalDefaultCategoryId(item.categoryId);
    setIsItemModalOpen(true);
  };

  const handleViewItem = (item: MasterItem) => {
    setSelectedItemForView(item);
    setIsDetailsModalOpen(true);
  };

  const handleItemSaved = (saved: MasterItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    showToast('success', `Master Item '${saved.itemName}' (${saved.itemCode}) saved successfully.`);
  };

  const handleDeactivate = async (item: MasterItem) => {
    if (!window.confirm(`Are you sure you want to deactivate '${item.itemName}' (${item.itemCode})?`)) return;
    try {
      const updated = await ItemService.deactivateItem(item.id, 'Deactivated from Item Master table', currentUser, isDemoMode);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      showToast('success', `Item '${item.itemCode}' has been deactivated.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to deactivate item.');
    }
  };

  const handleReactivate = async (item: MasterItem) => {
    if (!window.confirm(`Reactivate '${item.itemName}' (${item.itemCode}) back to the active catalogue?`)) return;
    try {
      const updated = await ItemService.reactivateItem(item.id, currentUser, isDemoMode);
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      showToast('success', `Item '${item.itemCode}' restored to active catalogue.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to reactivate item.');
    }
  };

  const handleDeleteItem = async (item: MasterItem) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${item.itemName}' (${item.itemCode})? This action cannot be undone.`)) return;
    try {
      await ItemService.deleteItem(item.id, isDemoMode);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      showToast('success', `Item '${item.itemCode}' deleted successfully.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete item.');
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
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header - Minimal & Airy */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Chemical &amp; Item Master</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Catalog of processing chemicals, dyes, auxiliary agents, firewood, and warehouse materials
          </p>
        </div>
      </div>

      {/* Top Banner KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Total Active</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalActiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Master items registered</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Item Categories</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{activeCategoriesCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">From General Settings</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">At or below alert level</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Inactive Items</span>
            <Archive className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{inactiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Retired from catalogue</div>
        </div>
      </div>

      {/* Main Container: Controls & Single Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Integrated Search Bar with Column Dropdown */}
          <div className="flex items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1 flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  searchColumn === 'ALL'
                    ? 'Search all fields (name, code, category, UOM)...'
                    : `Search by ${searchColumn}...`
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Column Selector */}
            <select
              value={searchColumn}
              onChange={(e) => setSearchColumn(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900 shrink-0 cursor-pointer"
              title="Target search column"
            >
              <option value="ALL">All Columns</option>
              <option value="itemCode">Item Code</option>
              <option value="itemName">Item Name</option>
              <option value="categoryName">Category</option>
              <option value="baseUnit">Base UOM</option>
              <option value="description">Description</option>
            </select>
          </div>

          {/* Secondary Controls & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Column Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setShowColumnFilters((prev) => !prev)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${showColumnFilters || activeColumnFilterCount > 0
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
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

            {/* Dynamic Category Filter Dropdown */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all">All Categories ({items.length})</option>
              {categories.map((c) => {
                const catId = c.categoryId || c.id;
                const count = items.filter(
                  (it) => it.categoryId === catId || it.categoryName?.toLowerCase() === c.categoryName.toLowerCase()
                ).length;
                return (
                  <option key={catId} value={catId}>
                    {c.categoryName} ({count})
                  </option>
                );
              })}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-2.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="active">Active Only</option>
              <option value="all">All Statuses</option>
              <option value="inactive">Inactive / Retired</option>
            </select>

            {/* Reset All Filters Button */}
            {hasAnyFilter && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1"
                title="Reset all filters and sorting"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {/* Right: Add Item Button */}
            {isAdminOrManager && (
              <button
                type="button"
                onClick={handleAddNewItem}
                className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition ml-auto cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Chemical Item</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Single Sticky Table View */}
      <TableMaximizeWrapper
          title="Chemical & Material Master Directory"
          badge={
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
              {filteredItems.length} Items
            </span>
          }
        >
          {(isMaximized) => (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
              <div
                data-table-scroll="true"
                className={`overflow-auto relative ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[11px] border-b-2 border-slate-300">
                    <tr className="border-b border-slate-300 text-[#1F4E79] bg-[#EEF5FB] font-bold uppercase tracking-wider text-[11px]">
                      {/* Item Code */}
                      <th
                        onClick={() => handleSort('itemCode')}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Item Code</span>
                          {renderSortIcon('itemCode')}
                        </div>
                      </th>

                      {/* Full Item / Material Name */}
                      <th
                        onClick={() => handleSort('itemName')}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Full Item / Material Name</span>
                          {renderSortIcon('itemName')}
                        </div>
                      </th>

                      {/* Category */}
                      <th
                        onClick={() => handleSort('categoryName')}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Category</span>
                          {renderSortIcon('categoryName')}
                        </div>
                      </th>

                      {/* Base UOM */}
                      <th
                        onClick={() => handleSort('baseUnit')}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Base UOM</span>
                          {renderSortIcon('baseUnit')}
                        </div>
                      </th>

                      {/* Min Stock */}
                      <th
                        onClick={() => handleSort('minimumStockLevel', true)}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Min Stock</span>
                          {renderSortIcon('minimumStockLevel')}
                        </div>
                      </th>

                      {/* Status */}
                      <th
                        onClick={() => handleSort('status')}
                        className="p-3.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span>Status</span>
                          {renderSortIcon('status')}
                        </div>
                      </th>

                      {/* Actions */}
                      <th className="p-3.5 pr-12 whitespace-nowrap text-right min-w-[130px] bg-[#EEF5FB]">Actions</th>
                    </tr>

                    {/* Sticky Inline Column Filters Row */}
                    {showColumnFilters && (
                      <tr className="sticky top-[41px] z-20 bg-slate-100/95 backdrop-blur-xs border-b border-slate-200 shadow-xs">
                        {/* Item Code */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter code..."
                            value={columnFilters.itemCode || ''}
                            onChange={(e) => handleColumnFilterChange('itemCode', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Item Name */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter name..."
                            value={columnFilters.itemName || ''}
                            onChange={(e) => handleColumnFilterChange('itemName', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Category */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter category..."
                            value={columnFilters.categoryName || ''}
                            onChange={(e) => handleColumnFilterChange('categoryName', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Base UOM */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter UOM..."
                            value={columnFilters.baseUnit || ''}
                            onChange={(e) => handleColumnFilterChange('baseUnit', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Min Stock */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter stock..."
                            value={columnFilters.minStock || ''}
                            onChange={(e) => handleColumnFilterChange('minStock', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Status */}
                        <th className="p-1.5">
                          <input
                            type="text"
                            placeholder="Filter status..."
                            value={columnFilters.status || ''}
                            onChange={(e) => handleColumnFilterChange('status', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </th>

                        {/* Actions Clear */}
                        <th className="p-1.5 text-right">
                          {activeColumnFilterCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setColumnFilters({})}
                              className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer underline"
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
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-xs text-slate-400">
                          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                          Loading master catalogue items...
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-xs text-slate-500">
                          <div className="max-w-xs mx-auto space-y-2">
                            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-slate-700">No master items found</p>
                            <p className="text-slate-400 text-[11px]">
                              Try adjusting your search criteria, category filters, or inline column filters.
                            </p>
                            {hasAnyFilter && (
                              <button
                                type="button"
                                onClick={handleResetAllFilters}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reset All Filters</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Item Code */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-bold text-[#1F4E79] font-mono text-xs">{item.itemCode}</span>
                          </td>

                          {/* Item Name */}
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block text-xs">{item.itemName}</span>
                            {item.description && (
                              <span className="text-[11px] text-slate-400 line-clamp-1">{item.description}</span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="text-xs text-slate-700 font-medium">
                              {item.categoryName || 'General'}
                            </span>
                          </td>

                          {/* Base UOM */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-800 text-xs uppercase">
                              {item.baseUnit}
                            </span>
                          </td>

                          {/* Min Stock */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="text-xs text-slate-600 font-mono">
                              {item.minimumStockLevel !== undefined ? item.minimumStockLevel : 0} {item.baseUnit}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="p-3.5 whitespace-nowrap">
                            <StatusChip
                              status={item.status === 'active' ? 'Active' : 'Inactive'}
                              variant={item.status === 'active' ? 'green' : 'slate'}
                            />
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleViewItem(item)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-[#1F4E79] transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                                title="View Details"
                              >
                                View
                              </button>

                              <button
                                onClick={() => handleEditItem(item)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#1F4E79] hover:text-white transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                                title="Edit Item"
                              >
                                Edit
                              </button>

                              {item.status === 'active' ? (
                                <button
                                  onClick={() => handleDeactivate(item)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200 shadow-2xs cursor-pointer"
                                  title="Deactivate Item"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(item)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs cursor-pointer"
                                  title="Reactivate Item"
                                >
                                  Reactivate
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
                                title="Delete Item"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <TableTotalsFooter
                    cells={[
                      { colSpan: 6, label: `Total (${filteredItems.length} Items)`, isTotal: true },
                      { content: '—', align: 'right', className: 'pr-12' }
                    ]}
                  />
                </table>
              </div>

              {/* Table Records Summary Footer */}
              <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
                <span>
                  Showing all <strong className="text-slate-800">{filteredItems.length}</strong> records in one stretch
                  {filteredItems.length !== items.length && (
                    <span className="text-slate-400 ml-1">(filtered from {items.length} total)</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400">
                  Total Active: {totalActiveCount} · Inactive: {inactiveCount} · Categories: {activeCategoriesCount}
                </span>
              </div>
            </div>
          )}
        </TableMaximizeWrapper>

        {/* Item Modal (Create / Edit) */}
        <ItemModal
          isOpen={isItemModalOpen}
          onClose={() => setIsItemModalOpen(false)}
          onSaved={handleItemSaved}
          initialItem={selectedItemForEdit}
          defaultCategoryId={itemModalDefaultCategoryId}
          categories={categories}
          units={units}
          currentUser={currentUser}
        />

        {/* Item Details Modal */}
        <ItemDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          item={selectedItemForView}
          onEdit={handleEditItem}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          isAdminOrManager={isAdminOrManager}
        />
      </div>
      );
};
