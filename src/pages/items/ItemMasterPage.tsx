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
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import { ItemModal } from './components/ItemModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import {
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Archive,
  Layers
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');

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

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.itemName?.toLowerCase().includes(q) ||
          it.itemCode?.toLowerCase().includes(q) ||
          it.categoryName?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q) ||
          it.baseUnit?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [items, statusFilter, categoryFilter, categories, searchQuery]);

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

  // Table Columns
  const columns: Column<MasterItem>[] = [
    {
      header: 'Item Code',
      accessor: (row) => (
        <div>
          <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
        </div>
      )
    },
    {
      header: 'Full Item / Material Name',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.itemName}</span>
          {row.description && (
            <span className="text-[11px] text-slate-400 line-clamp-1">{row.description}</span>
          )}
        </div>
      )
    },
    {
      header: 'Category',
      accessor: (row) => (
        <span className="text-xs text-slate-700 font-medium">
          {row.categoryName || 'General'}
        </span>
      )
    },
    {
      header: 'Base UOM',
      accessor: (row) => (
        <span className="font-mono font-bold text-slate-800 text-xs uppercase">
          {row.baseUnit}
        </span>
      )
    },
    {
      header: 'Min Stock',
      accessor: (row) => (
        <span className="text-xs text-slate-600 font-mono">
          {row.minimumStockLevel !== undefined ? row.minimumStockLevel : 0} {row.baseUnit}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusChip
          status={row.status === 'active' ? 'Active' : 'Inactive'}
          variant={row.status === 'active' ? 'green' : 'slate'}
        />
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          {/* View Details */}
          <button
            onClick={() => handleViewItem(row)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-[#1F4E79] transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="View Details"
          >
            View
          </button>

          {/* Edit */}
          <button
            onClick={() => handleEditItem(row)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#1F4E79] hover:text-white transition-colors border border-slate-200 shadow-2xs cursor-pointer"
            title="Edit Item"
          >
            Edit
          </button>

          {/* Deactivate / Reactivate */}
          {row.status === 'active' ? (
            <button
              onClick={() => handleDeactivate(row)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200 shadow-2xs cursor-pointer"
              title="Deactivate Item"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => handleReactivate(row)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs cursor-pointer"
              title="Reactivate Item"
            >
              Reactivate
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => handleDeleteItem(row)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs cursor-pointer"
            title="Delete Item"
          >
            Delete
          </button>
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
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toast.message}</span>
        </div>
      )}

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
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Controls Toolbar: Search, Category Filter from General Settings, Status Filter, and Add Item */}
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          {/* Left: Search & Filters aligned horizontally */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, code, UOM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-white border border-slate-300 rounded-lg pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              />
            </div>

            {/* Dynamic Category Filter Dropdown (From General Settings) */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
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
              className="h-9 bg-white border border-slate-300 rounded-lg px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F4E79]"
            >
              <option value="active">Active Only</option>
              <option value="all">All Statuses</option>
              <option value="inactive">Inactive / Retired</option>
            </select>
          </div>

          {/* Right: Add Item Button */}
          {isAdminOrManager && (
            <div className="flex items-center shrink-0">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={handleAddNewItem}
              >
                Add Item
              </Button>
            </div>
          )}
        </div>

        {/* Single Table View */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading master catalogue items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No master items found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Try clearing your search query or category filters.'
                  : 'Get started by creating your first master catalogue item.'}
              </p>
              {isAdminOrManager && (
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={handleAddNewItem}
                  >
                    Add Master Item
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Table columns={columns} data={filteredItems} keyExtractor={(row) => row.id} />
          )}
        </div>
      </div>

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
