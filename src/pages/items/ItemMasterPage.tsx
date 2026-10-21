import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MasterItem,
  ItemCategoryRecord,
  UnitOfMeasure,
  ItemType
} from '../../types/item';
import { ItemService } from '../../services/itemService';
import { useAuth } from '../../context/AuthContext';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import { ItemModal } from './components/ItemModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import {
  FlaskConical,
  Flame,
  Search,
  Plus,
  Eye,
  Edit2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Package,
  Trash2,
  Archive
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
  const [typeFilter, setTypeFilter] = useState<'all' | 'chemical' | 'firewood'>('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'inactive'>('active');

  // Modals State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemModalDefaultType, setItemModalDefaultType] = useState<ItemType>('chemical');
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<MasterItem | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState<MasterItem | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Load items, categories and units
  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes, unitRes] = await Promise.all([
        ItemService.getItems({}, { page: 1, pageSize: 1000 }, isDemoMode),
        ItemService.getCategories(isDemoMode),
        ItemService.getUnitsOfMeasure(isDemoMode)
      ]);
      setItems(itemsRes.items || []);
      setCategories(catRes || []);
      setUnits(unitRes || []);
    } catch (err) {
      console.warn('Failed to load item master data:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Derived counts
  const chemicalItemsCount = useMemo(
    () => items.filter((i) => i.itemType === 'chemical' && i.status === 'active').length,
    [items]
  );
  const firewoodItemsCount = useMemo(
    () => items.filter((i) => i.itemType === 'firewood' && i.status === 'active').length,
    [items]
  );
  const totalActiveCount = useMemo(
    () => items.filter((i) => i.status === 'active').length,
    [items]
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

    if (typeFilter !== 'all') {
      list = list.filter((i) => i.itemType === typeFilter);
    }

    if (lowStockFilter) {
      list = list.filter((i) => (i.currentStock || 0) <= (i.minimumStockLevel || 0));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.itemName?.toLowerCase().includes(q) ||
          it.itemCode?.toLowerCase().includes(q) ||
          it.categoryName?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [items, statusFilter, typeFilter, lowStockFilter, searchQuery]);

  // Modal Handlers
  const handleAddNewItem = (type: ItemType = 'chemical') => {
    setSelectedItemForEdit(null);
    setItemModalDefaultType(type === 'firewood' ? 'firewood' : 'chemical');
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: MasterItem) => {
    setSelectedItemForEdit(item);
    setItemModalDefaultType(item.itemType);
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
      header: 'Classification',
      accessor: (row) => {
        const isWood = row.itemType === 'firewood';
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isWood
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            {isWood ? <Flame className="w-3.5 h-3.5 text-amber-600" /> : <FlaskConical className="w-3.5 h-3.5 text-indigo-600" />}
            <span>{isWood ? 'Raw Wood' : 'Chemical'}</span>
          </span>
        );
      }
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
      header: 'Current Stock',
      accessor: (row) => {
        const isLow = (row.currentStock || 0) <= (row.minimumStockLevel || 0);
        return (
          <span
            className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
              isLow ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {row.currentStock || 0} {row.baseUnit}
          </span>
        );
      }
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
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Edit */}
          <button
            onClick={() => handleEditItem(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-[#1F4E79] hover:text-white transition-colors border border-slate-200 shadow-2xs"
            title="Edit Item"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          {/* Deactivate / Reactivate */}
          {row.status === 'active' ? (
            <button
              onClick={() => handleDeactivate(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200 shadow-2xs"
              title="Deactivate Item"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Deactivate</span>
            </button>
          ) : (
            <button
              onClick={() => handleReactivate(row)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs"
              title="Reactivate Item"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reactivate</span>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={() => handleDeleteItem(row)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 shadow-2xs"
            title="Delete Item"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
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
              ? 'bg-emerald-900 text-white border-emerald-700'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
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
            <span>Chemicals</span>
            <FlaskConical className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{chemicalItemsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Processing chemicals & dyes</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Raw Wood</span>
            <Flame className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{firewoodItemsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Boiler fuel supplies</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">At or below min stock</div>
        </div>
      </div>

      {/* Main Container: Controls & Single Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Controls Toolbar: Search, Filters, and Single Add Item Button */}
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          {/* Left: Search & Filters aligned horizontally */}
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-white border border-slate-300 rounded-lg pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              />
            </div>

            {/* Classification Filter Buttons */}
            <div className="inline-flex h-9 items-center rounded-lg border border-slate-300 p-0.5 bg-white">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`h-full px-3 rounded-md text-xs font-semibold transition-colors flex items-center ${
                  typeFilter === 'all'
                    ? 'bg-[#1F4E79] text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('chemical')}
                className={`h-full px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  typeFilter === 'chemical'
                    ? 'bg-indigo-700 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Chemicals ({chemicalItemsCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('firewood')}
                className={`h-full px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  typeFilter === 'firewood'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Raw Wood ({firewoodItemsCount})</span>
              </button>
            </div>

            {/* Low Stock Filter */}
            <button
              type="button"
              onClick={() => setLowStockFilter(!lowStockFilter)}
              className={`h-9 flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                lowStockFilter
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs font-bold'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Low Stock</span>
            </button>

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

          {/* Right: Single Add Item Button */}
          {isAdminOrManager && (
            <div className="flex items-center shrink-0">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => handleAddNewItem(typeFilter === 'firewood' ? 'firewood' : 'chemical')}
              >
                Add Item
              </Button>
            </div>
          )}
        </div>

        {/* Single Table View */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading master items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No master items found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery || typeFilter !== 'all' || lowStockFilter
                  ? 'Try clearing your search query or filters.'
                  : 'Get started by creating your first Chemical or Raw Wood item.'}
              </p>
              {isAdminOrManager && (
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => handleAddNewItem(typeFilter === 'firewood' ? 'firewood' : 'chemical')}
                  >
                    Add {typeFilter === 'firewood' ? 'Raw Wood' : 'Chemical'}
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
        defaultType={itemModalDefaultType}
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
