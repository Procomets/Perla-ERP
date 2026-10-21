import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MasterItem,
  ItemCategoryRecord,
  UnitOfMeasure,
  ItemType,
  ItemFilterOptions
} from '../../types/item';
import { Vendor } from '../../types/vendor';
import { ItemService } from '../../services/itemService';
import { VendorService } from '../../services/vendorService';
import { useAuth } from '../../context/AuthContext';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency } from '../../utils/formatters';
import { ItemModal } from './components/ItemModal';
import { ItemDetailsModal } from './components/ItemDetailsModal';
import { CategoryModal } from './components/CategoryModal';
import { UnitModal } from './components/UnitModal';
import { ChemicalMasterView } from './components/ChemicalMasterView';
import { FirewoodMasterView } from './components/FirewoodMasterView';
import { RawMaterialMasterView } from './components/RawMaterialMasterView';
import { CategoriesView } from './components/CategoriesView';
import { UnitsView } from './components/UnitsView';
import { AuditHistoryView } from './components/AuditHistoryView';
import {
  Package,
  FlaskConical,
  Flame,
  Boxes,
  Tag,
  Scale,
  History,
  Archive,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  RotateCcw,
  AlertTriangle,
  Warehouse,
  CheckCircle2
} from 'lucide-react';

interface ItemMasterPageProps {
  items?: any;
  onAddItem?: any;
}

export const ItemMasterPage: React.FC<ItemMasterPageProps> = () => {
  const { user, isDemoMode } = useAuth();
  const userRole = (user as any)?.role || 'Admin';
  const isAdminOrManager = userRole === 'Admin' || userRole === 'admin' || userRole === 'Manager' || userRole === 'manager';

  const currentUser = {
    uid: user?.uid || 'admin-uid',
    displayName: (user as any)?.displayName || (user as any)?.name || 'Authorized Staff'
  };

  // Active Tab:
  // 'chemical' | 'firewood' | 'categories' | 'units' | 'inactive' | 'history'
  const [activeTab, setActiveTab] = useState<string>('chemical');

  // Core Data State
  const [items, setItems] = useState<MasterItem[]>([]);
  const [categories, setCategories] = useState<ItemCategoryRecord[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState<ItemType | 'all'>('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemModalDefaultType, setItemModalDefaultType] = useState<ItemType>('chemical');
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<MasterItem | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedItemForView, setSelectedItemForView] = useState<MasterItem | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = useState<ItemCategoryRecord | null>(null);

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<UnitOfMeasure | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial load
  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true);
      const [itemsRes, catRes, unitRes, vendorRes] = await Promise.all([
        ItemService.getItems({}, { page: 1, pageSize: 500 }, isDemoMode),
        ItemService.getCategories(isDemoMode),
        ItemService.getUnitsOfMeasure(isDemoMode),
        VendorService.getVendors({}, { page: 1, pageSize: 200 }, isDemoMode)
      ]);
      setItems(itemsRes.items || []);
      setCategories(catRes || []);
      setUnits(unitRes || []);
      setVendors(vendorRes.vendors || []);
    } catch (err) {
      console.warn('Failed to load item master data:', err);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Derived filtered items for General tab
  const filteredGeneralItems = useMemo(() => {
    let list = items.filter((i) => i.status === 'active');

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (it) =>
          it.itemName?.toLowerCase().includes(q) ||
          it.itemCode?.toLowerCase().includes(q) ||
          it.categoryName?.toLowerCase().includes(q) ||
          it.preferredSupplierName?.toLowerCase().includes(q)
      );
    }

    if (selectedCategory !== 'all') {
      list = list.filter((it) => it.categoryId === selectedCategory);
    }

    if (selectedType !== 'all') {
      list = list.filter((it) => it.itemType === selectedType);
    }

    if (lowStockFilter) {
      list = list.filter((it) => (it.currentStock || 0) <= (it.reorderLevel || 0));
    }

    return list;
  }, [items, searchQuery, selectedCategory, selectedType, lowStockFilter]);

  // Subset arrays
  const chemicalItems = useMemo(
    () => items.filter((i) => i.itemType === 'chemical' && i.status === 'active'),
    [items]
  );
  const firewoodItems = useMemo(
    () => items.filter((i) => i.itemType === 'firewood' && i.status === 'active'),
    [items]
  );
  const rawMaterialItems = useMemo(
    () => items.filter((i) => (i.itemType === 'raw_material' || i.itemType === 'packing') && i.status === 'active'),
    [items]
  );
  const inactiveItems = useMemo(() => items.filter((i) => i.status === 'inactive'), [items]);

  // Quick Open Modal Helpers
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
    const reason = window.prompt(`Confirm deactivation for '${item.itemName}' (${item.itemCode}). Enter reason (optional):`);
    if (reason === null) return;
    try {
      const updated = await ItemService.deactivateItem(item.id, reason, currentUser, isDemoMode);
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

  const handleToggleCategory = async (cat: ItemCategoryRecord) => {
    const newStatus = cat.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await ItemService.updateCategory(cat.id, { status: newStatus }, isDemoMode);
      setCategories((prev) => prev.map((c) => (c.id === cat.id ? updated : c)));
      showToast('success', `Category '${cat.categoryName}' marked as ${newStatus}.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update category status.');
    }
  };

  const handleDeleteCategory = async (cat: ItemCategoryRecord) => {
    try {
      await ItemService.deleteCategory(cat.id, isDemoMode);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id && c.categoryId !== cat.categoryId));
      showToast('success', `Category '${cat.categoryName}' deleted successfully.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete category.');
    }
  };

  const handleToggleUnit = async (uom: UnitOfMeasure) => {
    const newStatus = uom.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await ItemService.updateUnitOfMeasure(uom.id, { status: newStatus }, isDemoMode);
      setUnits((prev) => prev.map((u) => (u.id === uom.id ? updated : u)));
      showToast('success', `Unit '${uom.unitName}' marked as ${newStatus}.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update unit status.');
    }
  };

  const handleDeleteUnit = async (uom: UnitOfMeasure) => {
    try {
      await ItemService.deleteUnitOfMeasure(uom.id, isDemoMode);
      setUnits((prev) => prev.filter((u) => u.id !== uom.id && u.unitId !== uom.unitId));
      showToast('success', `Unit '${uom.unitName}' deleted successfully.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete unit.');
    }
  };

  // General Items Table Columns
  const generalColumns: Column<MasterItem>[] = [
    {
      header: 'Item Code',
      accessor: (row) => (
        <div>
          <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
          <span className="text-[11px] text-slate-400 block">{row.categoryName}</span>
        </div>
      )
    },
    {
      header: 'Item Name',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.itemName}</span>
          {row.description && <span className="text-[11px] text-slate-400 line-clamp-1">{row.description}</span>}
        </div>
      )
    },
    {
      header: 'Classification',
      accessor: (row) => {
        const typeLabels: Record<ItemType, { label: string; icon: any; color: string }> = {
          chemical: { label: 'Chemical', icon: FlaskConical, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
          firewood: { label: 'Firewood', icon: Flame, color: 'text-amber-700 bg-amber-50 border-amber-200' },
          raw_material: { label: 'Raw Material', icon: Boxes, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
          packing: { label: 'Packaging', icon: Package, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          consumable: { label: 'Consumable', icon: Package, color: 'text-slate-700 bg-slate-50 border-slate-200' },
          maintenance: { label: 'Maintenance', icon: Package, color: 'text-slate-700 bg-slate-50 border-slate-200' },
          general: { label: 'General', icon: Package, color: 'text-slate-700 bg-slate-50 border-slate-200' },
          other: { label: 'Other', icon: Package, color: 'text-slate-700 bg-slate-50 border-slate-200' }
        };
        const config = typeLabels[row.itemType] || typeLabels.general;
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold border ${config.color}`}>
            <Icon className="w-3 h-3" />
            <span>{config.label}</span>
          </span>
        );
      }
    },
    {
      header: 'Base UOM',
      accessor: (row) => <span className="font-bold text-slate-800 text-xs">{row.baseUnit}</span>
    },
    {
      header: 'Standard Rate',
      accessor: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.defaultPurchaseRate ? formatCurrency(row.defaultPurchaseRate) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Warehouse Stock',
      accessor: (row) => {
        const isLow = (row.currentStock || 0) <= (row.reorderLevel || 0);
        return (
          <div>
            <span className={`text-xs font-black ${isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
              {row.currentStock || 0} {row.baseUnit}
            </span>
            <span className="text-[11px] text-slate-400 block">Reorder: {row.reorderLevel}</span>
          </div>
        );
      }
    },
    {
      header: 'Preferred Supplier',
      accessor: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.preferredSupplierName || 'Direct Vendor'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleViewItem(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition-colors"
            title="View Specifications"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdminOrManager && (
            <button
              onClick={() => handleEditItem(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit Specifications"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  // Inactive Items Table Columns
  const inactiveColumns: Column<MasterItem>[] = [
    {
      header: 'Item Code',
      accessor: (row) => (
        <span className="font-bold text-slate-500 font-mono text-xs">{row.itemCode}</span>
      )
    },
    {
      header: 'Item Name',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-700 block text-xs">{row.itemName}</span>
          <span className="text-[11px] text-slate-400">{row.categoryName}</span>
        </div>
      )
    },
    {
      header: 'Base UOM',
      accessor: (row) => <span className="text-xs text-slate-500">{row.baseUnit}</span>
    },
    {
      header: 'Deactivation Reason',
      accessor: (row) => (
        <span className="text-xs text-rose-600 font-medium italic">
          {row.remarks || 'Retired from active catalogue'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleReactivate(row)}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            Reactivate Item
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
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

      {/* Top Banner & KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Active Master Items</span>
            <Package className="w-4 h-4 text-[#1F4E79]" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {items.filter((i) => i.status === 'active').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across all factory operations</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Chemical Master</span>
            <FlaskConical className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{chemicalItems.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Processing dyes & auxiliaries</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Raw Wood / Firewood</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-600">{firewoodItems.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Weighbridge thermal fuels</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Reorder Alerts</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">
            {items.filter((i) => (i.currentStock || 0) <= (i.reorderLevel || 0) && i.status === 'active').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Items needing replenishment</div>
        </div>
      </div>

      {/* Main Tab Bar & Action Controls */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-200 gap-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'chemical', label: 'Chemical Master', icon: FlaskConical, count: chemicalItems.length },
              { id: 'firewood', label: 'Raw Wood', icon: Flame, count: firewoodItems.length },
              { id: 'categories', label: 'Categories', icon: Tag, count: categories.length },
              { id: 'units', label: 'Units (UOM)', icon: Scale, count: units.length },
              { id: 'inactive', label: 'Inactive / Retired', icon: Archive, count: inactiveItems.length },
              { id: 'history', label: 'Audit Trail', icon: History }
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#EEF5FB] text-[#1F4E79] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                  {t.count !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive ? 'bg-[#1F4E79] text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Creation Buttons */}
          {isAdminOrManager && (
            <div className="flex items-center gap-2 shrink-0">
              {activeTab === 'firewood' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => handleAddNewItem('firewood')}
                >
                  New Raw Wood
                </Button>
              ) : activeTab === 'categories' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedCategoryForEdit(null);
                    setIsCategoryModalOpen(true);
                  }}
                >
                  New Category
                </Button>
              ) : activeTab === 'units' ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setSelectedUnitForEdit(null);
                    setIsUnitModalOpen(true);
                  }}
                >
                  New Unit of Measure
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => handleAddNewItem('chemical')}
                >
                  New Chemical
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Filters for General Tab */}
        {activeTab === 'general' && (
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search item code, name, category, or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-[#1F4E79]/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="all">All Item Types</option>
                <option value="chemical">Chemicals</option>
                <option value="firewood">Boiler Firewood</option>
                <option value="raw_material">Raw Materials</option>
                <option value="packing">Packaging</option>
                <option value="consumable">Consumables</option>
              </select>

              <button
                type="button"
                onClick={() => setLowStockFilter(!lowStockFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  lowStockFilter
                    ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Low Stock Only</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Content Display */}
        <div className="p-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading master directory...</div>
          ) : activeTab === 'general' ? (
            <Table columns={generalColumns} data={filteredGeneralItems} keyExtractor={(row) => row.id} />
          ) : activeTab === 'chemical' ? (
            <ChemicalMasterView
              chemicals={chemicalItems}
              onViewItem={handleViewItem}
              onEditItem={handleEditItem}
              onAddNew={() => handleAddNewItem('chemical')}
              isAdminOrManager={isAdminOrManager}
            />
          ) : activeTab === 'firewood' ? (
            <FirewoodMasterView
              firewoodItems={firewoodItems}
              onViewItem={handleViewItem}
              onEditItem={handleEditItem}
              onAddNew={() => handleAddNewItem('firewood')}
              isAdminOrManager={isAdminOrManager}
            />
          ) : activeTab === 'raw_material' ? (
            <RawMaterialMasterView
              rawMaterialItems={rawMaterialItems}
              onViewItem={handleViewItem}
              onEditItem={handleEditItem}
              onAddNew={() => handleAddNewItem('raw_material')}
              isAdminOrManager={isAdminOrManager}
            />
          ) : activeTab === 'categories' ? (
            <CategoriesView
              categories={categories}
              items={items}
              onAddCategory={() => {
                setSelectedCategoryForEdit(null);
                setIsCategoryModalOpen(true);
              }}
              onEditCategory={(cat) => {
                setSelectedCategoryForEdit(cat);
                setIsCategoryModalOpen(true);
              }}
              onToggleStatus={handleToggleCategory}
              onDeleteCategory={handleDeleteCategory}
              isAdminOrManager={isAdminOrManager}
            />
          ) : activeTab === 'units' ? (
            <UnitsView
              units={units}
              onAddUnit={() => {
                setSelectedUnitForEdit(null);
                setIsUnitModalOpen(true);
              }}
              onEditUnit={(uom) => {
                setSelectedUnitForEdit(uom);
                setIsUnitModalOpen(true);
              }}
              onToggleStatus={handleToggleUnit}
              onDeleteUnit={handleDeleteUnit}
              isAdminOrManager={isAdminOrManager}
            />
          ) : activeTab === 'inactive' ? (
            <Table columns={inactiveColumns} data={inactiveItems} keyExtractor={(row) => row.id} />
          ) : activeTab === 'history' ? (
            <AuditHistoryView />
          ) : null}
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
        vendors={vendors}
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

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSaved={(cat) => {
          setCategories((prev) => {
            const idx = prev.findIndex((c) => c.id === cat.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = cat;
              return copy;
            }
            return [...prev, cat];
          });
          showToast('success', `Category '${cat.categoryName}' saved.`);
        }}
        initialCategory={selectedCategoryForEdit}
        currentUser={currentUser}
      />

      {/* Unit Modal */}
      <UnitModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onSaved={(uom) => {
          setUnits((prev) => {
            const idx = prev.findIndex((u) => u.id === uom.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = uom;
              return copy;
            }
            return [...prev, uom];
          });
          showToast('success', `Unit of Measure '${uom.unitName}' saved.`);
        }}
        initialUnit={selectedUnitForEdit}
        currentUser={currentUser}
      />
    </div>
  );
};
