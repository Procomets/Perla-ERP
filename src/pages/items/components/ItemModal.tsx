import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MasterItem, ItemCategoryRecord, UnitOfMeasure, ItemType } from '../../../types/item';
import { Vendor } from '../../../types/vendor';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ItemService } from '../../../services/itemService';
import {
  ItemCategoryMasterService,
  DEFAULT_INITIAL_ITEM_CATEGORIES
} from '../../../services/itemCategoryMasterService';
import { ItemCategoryMasterItem } from '../../../types/categoryMaster';
import {
  FlaskConical,
  Flame,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock,
  Package,
  Layers,
  Box,
  Wrench,
  Sparkles,
  Settings
} from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: MasterItem) => void;
  initialItem?: MasterItem | null;
  defaultType?: ItemType;
  defaultCategoryId?: string;
  categories: ItemCategoryRecord[];
  units: UnitOfMeasure[];
  vendors?: Vendor[];
  currentUser: { uid: string; displayName?: string };
}

// Helper to determine icon by category code / name
const getCategoryIcon = (codeOrName: string) => {
  const str = (codeOrName || '').toLowerCase();
  if (str.includes('chm') || str.includes('chemical') || str.includes('dye') || str.includes('auxiliary')) return FlaskConical;
  if (str.includes('rwd') || str.includes('wood') || str.includes('fuel') || str.includes('boiler')) return Flame;
  if (str.includes('pkg') || str.includes('pack')) return Box;
  if (str.includes('mnt') || str.includes('spare') || str.includes('maint')) return Wrench;
  return Package;
};

// Helper to infer itemType from category
const inferItemType = (catName: string, catCode: string): ItemType => {
  const str = `${catName} ${catCode}`.toLowerCase();
  if (str.includes('wood') || str.includes('fuel') || str.includes('boiler') || catCode.toUpperCase() === 'RWD') return 'firewood';
  if (str.includes('chem') || str.includes('dye') || str.includes('auxiliary') || catCode.toUpperCase() === 'CHM') return 'chemical';
  if (str.includes('pack') || catCode.toUpperCase() === 'PKG') return 'packing';
  if (str.includes('maint') || str.includes('spare') || catCode.toUpperCase() === 'MNT') return 'maintenance';
  if (str.includes('consum') || catCode.toUpperCase() === 'GEN' || catCode.toUpperCase() === 'CON') return 'consumable';
  if (str.includes('raw') || catCode.toUpperCase() === 'RAW') return 'raw_material';
  return 'general';
};

// Helper to suggest default UOM by category
const inferDefaultUom = (catName: string, catCode: string): string => {
  const str = `${catName} ${catCode}`.toLowerCase();
  if (str.includes('wood') || str.includes('boiler') || str.includes('fuel') || catCode.toUpperCase() === 'RWD') return 't';
  if (str.includes('chemical') || str.includes('dye') || catCode.toUpperCase() === 'CHM') return 'kg';
  if (str.includes('pack') || catCode.toUpperCase() === 'PKG') return 'pcs';
  if (str.includes('maint') || str.includes('spare') || catCode.toUpperCase() === 'MNT') return 'pcs';
  if (str.includes('oil') || str.includes('liquid')) return 'L';
  return 'kg';
};

// Helper to generate dynamic placeholder
const getPlaceholderForCategory = (catName: string, catCode: string): string => {
  const str = `${catName} ${catCode}`.toLowerCase();
  if (str.includes('chem') || str.includes('dye')) return 'e.g. Sodium Hydrosulphite or Reactive Blue Dye';
  if (str.includes('wood') || str.includes('fuel')) return 'e.g. Casuarina Firewood Logs (Standard Grade)';
  if (str.includes('pack')) return 'e.g. Heavy-Duty Polyethylene Rolls 50-Micron';
  if (str.includes('maint') || str.includes('spare')) return 'e.g. High Pressure Steam Valve 2-inch';
  return 'e.g. Master catalogue item / material name...';
};

// Standard fallback units if Firestore UOM collection is empty
const fallbackUnits: UnitOfMeasure[] = [
  { id: 'uom_kg', unitId: 'uom_kg', unitCode: 'KG', unitName: 'Kilograms', symbol: 'kg', unitType: 'weight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_t', unitId: 'uom_t', unitCode: 'T', unitName: 'Metric Tonnes', symbol: 't', unitType: 'weight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_l', unitId: 'uom_l', unitCode: 'L', unitName: 'Litres', symbol: 'L', unitType: 'volume', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_m', unitId: 'uom_m', unitCode: 'M', unitName: 'Metres', symbol: 'm', unitType: 'length', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_pcs', unitId: 'uom_pcs', unitCode: 'PCS', unitName: 'Pieces', symbol: 'pcs', unitType: 'count', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_box', unitId: 'uom_box', unitCode: 'BOX', unitName: 'Boxes / Cartons', symbol: 'box', unitType: 'package', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'uom_roll', unitId: 'uom_roll', unitCode: 'ROLL', unitName: 'Rolls', symbol: 'roll', unitType: 'package', status: 'active', createdAt: '', updatedAt: '' }
];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialItem,
  defaultType = 'chemical',
  defaultCategoryId,
  categories: propCategories,
  units: propUnits,
  currentUser
}) => {
  const isEditing = Boolean(initialItem);

  // Dynamic categories state loaded directly from General Settings
  const [generalCategories, setGeneralCategories] = useState<ItemCategoryMasterItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Form States
  const [categoryId, setCategoryId] = useState<string>('');
  const [itemCode, setItemCode] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [baseUnit, setBaseUnit] = useState<string>('kg');
  // Number field rule: no default 0 in place, keep it empty!
  const [minimumStockLevel, setMinimumStockLevel] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [description, setDescription] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch categories directly from General Settings on open
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setLoadingCategories(true);
      ItemCategoryMasterService.getCategories()
        .then((cats) => {
          if (isMounted && cats && cats.length > 0) {
            setGeneralCategories(cats);
          }
        })
        .catch((err) => {
          console.warn('ItemModal could not fetch categories from ItemCategoryMasterService:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingCategories(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Combined selectable categories
  const selectableCategories = useMemo(() => {
    // Priority: generalCategories > propCategories > DEFAULT_INITIAL_ITEM_CATEGORIES
    let list: Array<{ id: string; categoryId: string; categoryName: string; categoryCode: string; description?: string; isActive?: boolean }> = [];

    if (generalCategories.length > 0) {
      list = generalCategories.map((c) => ({
        id: c.id,
        categoryId: c.categoryId || c.id,
        categoryName: c.categoryName || c.name,
        categoryCode: c.categoryCode,
        description: c.description,
        isActive: c.isActive
      }));
    } else if (propCategories && propCategories.length > 0) {
      list = propCategories.map((c) => ({
        id: c.id,
        categoryId: c.categoryId || c.id,
        categoryName: c.categoryName,
        categoryCode: c.categoryCode,
        description: c.description,
        isActive: c.status === 'active'
      }));
    } else {
      list = DEFAULT_INITIAL_ITEM_CATEGORIES.map((c, idx) => ({
        id: `default_cat_${idx}`,
        categoryId: `default_cat_${idx}`,
        categoryName: c.name,
        categoryCode: c.code,
        description: c.description,
        isActive: true
      }));
    }

    // Include current category if editing an existing item
    return list.filter((c) => {
      if (initialItem && (initialItem.categoryId === c.categoryId || initialItem.categoryId === c.id)) {
        return true;
      }
      return c.isActive !== false;
    });
  }, [generalCategories, propCategories, initialItem]);

  const effectiveUnits = propUnits && propUnits.length > 0 ? propUnits : fallbackUnits;

  // Selected Category Object
  const selectedCategory = useMemo(() => {
    return selectableCategories.find((c) => c.categoryId === categoryId || c.id === categoryId) || selectableCategories[0];
  }, [selectableCategories, categoryId]);

  // 2. Initialize or reset form state
  useEffect(() => {
    if (!isOpen) return;

    if (initialItem) {
      // Edit Mode
      setCategoryId(initialItem.categoryId || '');
      setItemCode(initialItem.itemCode || '');
      setItemName(initialItem.itemName || '');
      setBaseUnit(initialItem.baseUnit || 'kg');
      setMinimumStockLevel(initialItem.minimumStockLevel !== undefined ? String(initialItem.minimumStockLevel) : '');
      setStatus(initialItem.status || 'active');
      setDescription(initialItem.description || '');
      setError(null);
    } else {
      // Create Mode
      setItemName('');
      setDescription('');
      setMinimumStockLevel(''); // Keep empty, no default 0!
      setStatus('active');
      setError(null);

      // Determine initial category
      let chosenCat = selectableCategories[0];

      if (defaultCategoryId) {
        const found = selectableCategories.find((c) => c.categoryId === defaultCategoryId || c.id === defaultCategoryId);
        if (found) chosenCat = found;
      } else if (defaultType === 'firewood') {
        const woodCat = selectableCategories.find((c) => {
          const n = c.categoryName.toLowerCase();
          return n.includes('wood') || n.includes('fuel') || c.categoryCode === 'RWD';
        });
        if (woodCat) chosenCat = woodCat;
      }

      if (chosenCat) {
        const catId = chosenCat.categoryId || chosenCat.id;
        setCategoryId(catId);
        setBaseUnit(inferDefaultUom(chosenCat.categoryName, chosenCat.categoryCode));

        // Generate next item code based on category code
        ItemService.getNextItemCode(chosenCat.categoryCode || 'ITM').then((code) => {
          setItemCode(code);
        });
      }
    }
  }, [isOpen, initialItem, defaultCategoryId, defaultType, selectableCategories]);

  // 3. Handle Category Change
  const handleCategorySelect = async (newCatId: string) => {
    setCategoryId(newCatId);
    const cat = selectableCategories.find((c) => c.categoryId === newCatId || c.id === newCatId);
    if (!cat) return;

    if (!isEditing) {
      // Suggest default UOM
      setBaseUnit(inferDefaultUom(cat.categoryName, cat.categoryCode));

      // Auto-generate code using category code prefix
      try {
        const nextCode = await ItemService.getNextItemCode(cat.categoryCode || 'ITM');
        setItemCode(nextCode);
      } catch (e) {
        console.warn('Failed to generate item code:', e);
      }
    }
  };

  // 4. Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError('Full Item / Material Name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select an Item Category.');
      return;
    }
    if (!baseUnit.trim()) {
      setError('Base Unit of Measure (UOM) is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const targetCat = selectedCategory || selectableCategories[0];
      const derivedType = inferItemType(targetCat?.categoryName || '', targetCat?.categoryCode || '');
      const parsedMinStock = minimumStockLevel.trim() === '' ? 0 : Number(minimumStockLevel);

      const payload: Partial<MasterItem> = {
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        categoryId: targetCat ? (targetCat.categoryId || targetCat.id) : categoryId,
        categoryName: targetCat ? targetCat.categoryName : 'General',
        itemType: derivedType,
        status,
        description: description.trim() || undefined,
        baseUnitId: `uom_${baseUnit.toLowerCase().trim()}`,
        baseUnit: baseUnit.trim(),
        baseUnitSymbol: baseUnit.trim(),
        minimumStockLevel: isNaN(parsedMinStock) ? 0 : parsedMinStock,
        reorderLevel: isNaN(parsedMinStock) ? 0 : parsedMinStock
      };

      if (derivedType === 'chemical') {
        payload.chemicalDetails = {
          itemId: initialItem?.chemicalDetails?.itemId || '',
          chemicalCode: itemCode.trim().toUpperCase(),
          chemicalName: itemName.trim(),
          chemicalDisplayName: itemName.trim(),
          chemicalCategory: 'Chemical',
          chemicalType: targetCat?.categoryName || 'Textile Processing Chemical',
          chemicalGrade: 'Textile Processing Grade',
          purchaseUnit: baseUnit.trim(),
          consumptionUnit: baseUnit.trim(),
          conversionFactor: 1,
          minimumStockLevel: isNaN(parsedMinStock) ? 0 : parsedMinStock,
          reorderLevel: isNaN(parsedMinStock) ? 0 : parsedMinStock,
          batchTrackingRequired: true,
          expiryTrackingRequired: false,
          active: status === 'active',
          createdAt: initialItem?.chemicalDetails?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      let saved: MasterItem;
      if (isEditing && initialItem) {
        saved = await ItemService.updateItem(initialItem.id, payload, currentUser);
      } else {
        saved = await ItemService.createItem(payload, currentUser);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save master item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Master Item: ${initialItem?.itemCode}` : 'Create Master Item'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-1">
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 shadow-2xs">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* 1. Item Category (Fetched from General Settings) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#1F4E79]" />
              <span>Item Category <span className="text-red-500">*</span></span>
            </label>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              General Settings
            </span>
          </div>

          {/* Quick-Select Pills from General Settings */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {selectableCategories.map((c) => {
              const catId = c.categoryId || c.id;
              const isSelected = (categoryId === catId) || (selectedCategory && (selectedCategory.categoryId === catId || selectedCategory.id === catId));
              const Icon = getCategoryIcon(c.categoryCode || c.categoryName);

              return (
                <button
                  key={catId}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleCategorySelect(catId)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all text-xs font-medium ${
                    isSelected
                      ? 'bg-blue-50/90 border-[#1F4E79] text-[#1F4E79] shadow-2xs ring-2 ring-[#1F4E79]/20 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  } ${isEditing ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#1F4E79] text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{c.categoryName}</div>
                    <div className="font-mono text-[10px] text-slate-400 mt-0.5">{c.categoryCode}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fallback Dropdown if list is long or user prefers dropdown */}
          <div className="pt-1">
            <select
              value={categoryId}
              disabled={isEditing}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
              required
            >
              <option value="">-- Or Choose from All Categories --</option>
              {selectableCategories.map((c) => {
                const catId = c.categoryId || c.id;
                return (
                  <option key={catId} value={catId}>
                    {c.categoryName} ({c.categoryCode})
                  </option>
                );
              })}
            </select>
          </div>

          {selectedCategory?.description && (
            <div className="text-[11px] text-slate-500 italic pl-1">
              {selectedCategory.description}
            </div>
          )}
        </div>

        {/* 2. Item Code & Base UOM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Item Code (Autogenerated)</span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-200">
                <Lock className="w-3 h-3 text-slate-400" />
                Read Only
              </span>
            </label>
            <input
              type="text"
              value={itemCode}
              readOnly
              tabIndex={-1}
              placeholder="e.g. CHM-001"
              required
              className="w-full h-11 bg-slate-100/90 border border-slate-200 text-[#1F4E79] rounded-xl px-3.5 text-sm font-mono font-black tracking-wider cursor-not-allowed select-all focus:outline-none shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Base UOM <span className="text-red-500">*</span>
            </label>
            <select
              value={baseUnit}
              onChange={(e) => setBaseUnit(e.target.value)}
              className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm font-bold text-[#1F4E79] focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
              required
            >
              <option value="">-- Select UOM --</option>
              {effectiveUnits.map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.unitName} ({u.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Full Item / Material Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Full Item / Material Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={getPlaceholderForCategory(selectedCategory?.categoryName || '', selectedCategory?.categoryCode || '')}
            required
            className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
          />
        </div>

        {/* 4. Min Stock (Alert Level) & Item Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Min Stock (Alert Level)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={minimumStockLevel}
              onChange={(e) => setMinimumStockLevel(e.target.value)}
              placeholder="0"
              className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
            />
            <div className="text-[10px] text-slate-400">Trigger alert when stock drops below this level.</div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Item Status (Active or Not Active) <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 h-11">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex items-center justify-center gap-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                  status === 'active'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-2xs ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                <span>Active</span>
              </button>
              <button
                type="button"
                onClick={() => setStatus('inactive')}
                className={`flex items-center justify-center gap-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${
                  status === 'inactive'
                    ? 'bg-rose-50 border-rose-600 text-rose-800 shadow-2xs ring-2 ring-rose-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${status === 'inactive' ? 'bg-rose-600' : 'bg-slate-300'}`} />
                <span>Not Active</span>
              </button>
            </div>
          </div>
        </div>

        {/* 5. General Description & Purpose */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            General Description & Purpose
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Factory processing notes, boiler feed requirements, packaging specifications..."
            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition resize-none shadow-2xs"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Category prefix dynamically determines item code.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-semibold bg-white hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
              className="px-6 py-2.5 text-xs font-semibold shadow-xs"
            >
              {isSubmitting ? 'Saving Item...' : isEditing ? 'Update Master Item' : 'Create Master Item'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
