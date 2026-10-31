import React, { useState, useEffect, useMemo } from 'react';
import { MasterItem, ItemCategoryRecord, UnitOfMeasure, ItemType } from '../../../types/item';
import { Vendor } from '../../../types/vendor';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ItemService } from '../../../services/itemService';
import {
  FlaskConical,
  Flame,
  AlertCircle,
  CheckCircle2,
  Info,
  Lock
} from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: MasterItem) => void;
  initialItem?: MasterItem | null;
  defaultType?: ItemType;
  categories: ItemCategoryRecord[];
  units: UnitOfMeasure[];
  vendors?: Vendor[];
  currentUser: { uid: string; displayName?: string };
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialItem,
  defaultType = 'chemical',
  categories,
  units,
  currentUser
}) => {
  const isEditing = Boolean(initialItem);

  // Allowed item classification types: Chemical and Raw Wood (Boiler Firewood)
  const effectiveDefaultType = defaultType === 'firewood' ? 'firewood' : 'chemical';
  const [itemType, setItemType] = useState<ItemType>(initialItem?.itemType || effectiveDefaultType);
  const [itemCode, setItemCode] = useState(initialItem?.itemCode || '');
  const [itemName, setItemName] = useState(initialItem?.itemName || '');
  const [categoryId, setCategoryId] = useState(initialItem?.categoryId || '');
  const [baseUnit, setBaseUnit] = useState(initialItem?.baseUnit || (effectiveDefaultType === 'firewood' ? 't' : 'kg'));
  const [minimumStockLevel, setMinimumStockLevel] = useState<number>(initialItem?.minimumStockLevel || 0);
  const [description, setDescription] = useState(initialItem?.description || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initialItem?.status || 'active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeWarning, setCodeWarning] = useState<string | null>(null);

  // Fallback categories and units when Firestore has no configured master records yet
  const fallbackCategories: ItemCategoryRecord[] = [
    {
      id: 'cat_chemicals',
      categoryId: 'cat_chemicals',
      categoryName: 'Textile Processing Chemicals',
      categoryCode: 'CHM',
      status: 'active',
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'cat_firewood',
      categoryId: 'cat_firewood',
      categoryName: 'Raw Wood / Boiler Fuel',
      categoryCode: 'RWD',
      status: 'active',
      itemCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const fallbackUnits: UnitOfMeasure[] = [
    { id: 'uom_kg', unitId: 'uom_kg', unitCode: 'KG', unitName: 'Kilograms', symbol: 'kg', unitType: 'weight', status: 'active', createdAt: '', updatedAt: '' },
    { id: 'uom_t', unitId: 'uom_t', unitCode: 'T', unitName: 'Metric Tonnes', symbol: 't', unitType: 'weight', status: 'active', createdAt: '', updatedAt: '' },
    { id: 'uom_l', unitId: 'uom_l', unitCode: 'L', unitName: 'Litres', symbol: 'L', unitType: 'volume', status: 'active', createdAt: '', updatedAt: '' },
    { id: 'uom_m', unitId: 'uom_m', unitCode: 'M', unitName: 'Metres', symbol: 'm', unitType: 'length', status: 'active', createdAt: '', updatedAt: '' },
    { id: 'uom_pcs', unitId: 'uom_pcs', unitCode: 'PCS', unitName: 'Pieces', symbol: 'pcs', unitType: 'count', status: 'active', createdAt: '', updatedAt: '' }
  ];

  const effectiveUnits = units && units.length > 0 ? units : fallbackUnits;

  // Selectable categories: include all active categories, plus the item's currently assigned category if editing
  const selectableCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? categories : fallbackCategories;
    return list.filter((c: any) => {
      const isCurrentItemCategory =
        initialItem && (initialItem.categoryId === (c.categoryId || c.id) || initialItem.categoryId === c.id);
      if (isCurrentItemCategory) return true;
      return (c as any).isActive !== false && c.status !== 'inactive';
    });
  }, [categories, fallbackCategories, initialItem]);

  // Reset or fill on open
  useEffect(() => {
    if (initialItem) {
      setItemType(initialItem.itemType === 'firewood' ? 'firewood' : 'chemical');
      setItemCode(initialItem.itemCode);
      setItemName(initialItem.itemName);
      setCategoryId(initialItem.categoryId);
      setDescription(initialItem.description || '');
      setBaseUnit(initialItem.baseUnit);
      setMinimumStockLevel(initialItem.minimumStockLevel || 0);
      setStatus(initialItem.status || 'active');
    } else {
      const initType = defaultType === 'firewood' ? 'firewood' : 'chemical';
      setItemType(initType);
      setItemName('');
      setDescription('');
      setMinimumStockLevel(0);
      setStatus('active');

      // Auto-assign category matching type
      const matchedCat = selectableCategories.find((c: any) => {
        const catName = (c.categoryName || (c as any).name || '').toLowerCase();
        if (initType === 'chemical') return catName.includes('chemical');
        if (initType === 'firewood') return catName.includes('wood') || catName.includes('firewood');
        return true;
      });
      const chosenCat = matchedCat || selectableCategories[0];
      const initialCatId = chosenCat?.categoryId || chosenCat?.id || '';
      setCategoryId(initialCatId);
      setBaseUnit(initType === 'firewood' ? 't' : 'kg');

      // Auto-generate next item code using category code or item type
      const prefix = chosenCat?.categoryCode || (initType === 'firewood' ? 'RWD' : 'CHM');
      ItemService.getNextItemCode(prefix).then((suggested) => {
        setItemCode(suggested);
      });
    }
    setError(null);
  }, [initialItem, defaultType, isOpen, selectableCategories]);

  // When classification changes on new item, re-generate code and adjust default unit
  const handleTypeChange = async (newType: ItemType) => {
    if (newType !== 'chemical' && newType !== 'firewood') return;
    setItemType(newType);
    if (!isEditing) {
      if (newType === 'firewood') {
        setBaseUnit('t');
        const woodCat = selectableCategories.find((c: any) => {
          const catName = (c.categoryName || (c as any).name || '').toLowerCase();
          return catName.includes('wood') || catName.includes('firewood');
        });
        const cat = woodCat || selectableCategories[0];
        if (cat) {
          setCategoryId(cat.categoryId || cat.id);
          const nextCode = await ItemService.getNextItemCode(cat.categoryCode || 'RWD');
          setItemCode(nextCode);
        }
      } else {
        setBaseUnit('kg');
        const chemCat = selectableCategories.find((c: any) => {
          const catName = (c.categoryName || (c as any).name || '').toLowerCase();
          return catName.includes('chemical');
        });
        const cat = chemCat || selectableCategories[0];
        if (cat) {
          setCategoryId(cat.categoryId || cat.id);
          const nextCode = await ItemService.getNextItemCode(cat.categoryCode || 'CHM');
          setItemCode(nextCode);
        }
      }
    }
  };

  // When category changes, dynamically update item code prefix if creating new item
  const handleCategoryChange = async (newCatId: string) => {
    setCategoryId(newCatId);
    if (!isEditing) {
      const selectedCat = (categories && categories.length > 0 ? categories : fallbackCategories).find(
        (c: any) => (c.categoryId || c.id) === newCatId
      );
      const prefix = selectedCat?.categoryCode || (itemType === 'firewood' ? 'RWD' : 'CHM');
      const nextCode = await ItemService.getNextItemCode(prefix);
      setItemCode(nextCode);
    }
  };

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
      setError('Base UOM is required.');
      return;
    }

    try {
      const allKnownCats = categories && categories.length > 0 ? categories : fallbackCategories;
      const selectedCat = allKnownCats.find((c) => c.categoryId === categoryId || c.id === categoryId);

      const payload: Partial<MasterItem> = {
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        categoryId,
        categoryName: selectedCat?.categoryName || (selectedCat as any)?.name || (itemType === 'chemical' ? 'Chemicals' : 'Firewood & Boiler Fuel'),
        itemType,
        status,
        description: description.trim() || undefined,
        baseUnitId: `uom_${baseUnit.toLowerCase().trim()}`,
        baseUnit: baseUnit.trim(),
        baseUnitSymbol: baseUnit.trim(),
        minimumStockLevel: Number(minimumStockLevel) || 0,
        reorderLevel: Number(minimumStockLevel) || 0
      };

      if (itemType === 'chemical') {
        payload.chemicalDetails = {
          itemId: initialItem?.chemicalDetails?.itemId || '',
          chemicalCode: itemCode.trim().toUpperCase(),
          chemicalName: itemName.trim(),
          chemicalDisplayName: itemName.trim(),
          chemicalCategory: 'Chemical',
          chemicalType: 'Textile Processing Chemical',
          chemicalGrade: 'Textile Processing Grade',
          purchaseUnit: baseUnit.trim(),
          consumptionUnit: baseUnit.trim(),
          conversionFactor: 1,
          minimumStockLevel: Number(minimumStockLevel) || 0,
          reorderLevel: Number(minimumStockLevel) || 0,
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
      setError(err?.message || 'Failed to save item specification.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Item: ${initialItem?.itemCode}` : 'Create Master Item'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 pt-1">
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* 1. Item Classification Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Item Classification Type
          </label>
          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'chemical', label: 'Chemical', subtitle: 'Processing Chemicals & Auxiliaries', icon: FlaskConical },
              { id: 'firewood', label: 'Raw Wood', subtitle: 'Boiler Firewood & Fuel Timber', icon: Flame }
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = itemType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleTypeChange(t.id as ItemType)}
                  className={`flex items-center gap-3.5 p-3.5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border-[#1F4E79] text-[#1F4E79] shadow-sm ring-2 ring-[#1F4E79]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  } ${isEditing ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-[#1F4E79] text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold leading-tight">{t.label}</div>
                    <div className="text-xs text-slate-500 font-normal mt-0.5">{t.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Item Code & Item Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Item Code (Autogenerated)</span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1 border border-slate-200/80">
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
              className="w-full h-11 bg-slate-100/90 border border-slate-200 text-slate-700 rounded-xl px-3.5 text-sm font-mono font-bold tracking-wider cursor-not-allowed select-all focus:outline-none shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Item Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
              required
            >
              <option value="">-- Select Category --</option>
              {selectableCategories.map((c: any) => {
                const catId = c.categoryId || c.id;
                const catName = c.categoryName || (c as any).name;
                const catCode = c.categoryCode;
                return (
                  <option key={catId} value={catId}>
                    {catName}{catCode ? ` (${catCode})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 3. Full Item / Material Name (Full width for maximum readability!) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Full Item / Material Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={itemType === 'chemical' ? 'e.g. Neutral Bio-Enzyme Powder' : 'e.g. Casuarina Firewood Logs (Standard Grade)'}
            required
            className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
          />
        </div>

        {/* 4. Base UOM & Min Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Min Stock (Alert Level)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={minimumStockLevel}
              onChange={(e) => setMinimumStockLevel(Number(e.target.value))}
              placeholder="0"
              className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
            />
          </div>
        </div>

        {/* 5. Status: Active or Not Active */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Item Status (Active or Not Active) <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`h-11 flex items-center justify-center gap-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                status === 'active'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${status === 'active' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
              <span>Active</span>
            </button>
            <button
              type="button"
              onClick={() => setStatus('inactive')}
              className={`h-11 flex items-center justify-center gap-2.5 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                status === 'inactive'
                  ? 'bg-rose-50 border-rose-600 text-rose-800 shadow-sm ring-2 ring-rose-500/20'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${status === 'inactive' ? 'bg-rose-600' : 'bg-slate-300'}`} />
              <span>Not Active (Inactive)</span>
            </button>
          </div>
        </div>

        {/* 6. General Description & Purpose (Full width comfortable textarea) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            General Description & Purpose
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Factory processing or boiler usage, application notes, handling requirements..."
            className="w-full bg-white border border-slate-300 rounded-xl p-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition resize-none shadow-2xs"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-5 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Autogenerated unique item codes prevent catalogue collisions.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
              className="px-6 py-2.5 text-sm font-semibold shadow-xs"
            >
              {isSubmitting ? 'Saving Item...' : isEditing ? 'Update Master Item' : 'Create Master Item'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
