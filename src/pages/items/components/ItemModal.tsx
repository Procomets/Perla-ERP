import React, { useState, useEffect } from 'react';
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
  Info
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeWarning, setCodeWarning] = useState<string | null>(null);

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
    } else {
      const initType = defaultType === 'firewood' ? 'firewood' : 'chemical';
      setItemType(initType);
      setItemName('');
      setDescription('');
      setMinimumStockLevel(0);

      // Auto-assign category matching type
      const matchedCat = categories.find((c) => {
        if (initType === 'chemical') return c.categoryName.toLowerCase().includes('chemical');
        if (initType === 'firewood') return c.categoryName.toLowerCase().includes('wood') || c.categoryName.toLowerCase().includes('firewood');
        return true;
      });
      setCategoryId(matchedCat?.categoryId || categories[0]?.categoryId || '');
      setBaseUnit(initType === 'firewood' ? 't' : 'kg');

      // Auto-generate next item code
      ItemService.getNextItemCode(initType).then((suggested) => {
        setItemCode(suggested);
      });
    }
    setError(null);
    setCodeWarning(null);
  }, [initialItem, defaultType, isOpen, categories]);

  // When classification changes on new item, re-generate code and adjust default unit
  const handleTypeChange = async (newType: ItemType) => {
    if (newType !== 'chemical' && newType !== 'firewood') return;
    setItemType(newType);
    if (!isEditing) {
      const code = await ItemService.getNextItemCode(newType);
      setItemCode(code);
      if (newType === 'firewood') {
        setBaseUnit('t');
        const woodCat = categories.find((c) => c.categoryName.toLowerCase().includes('wood') || c.categoryName.toLowerCase().includes('firewood'));
        if (woodCat) setCategoryId(woodCat.categoryId);
      } else {
        setBaseUnit('kg');
        const chemCat = categories.find((c) => c.categoryName.toLowerCase().includes('chemical'));
        if (chemCat) setCategoryId(chemCat.categoryId);
      }
    }
  };

  // Duplicate code check on blur
  const handleCodeBlur = async () => {
    if (!itemCode.trim()) return;
    const dup = await ItemService.checkDuplicate(itemCode, itemName, initialItem?.id);
    if (dup.duplicateCode) {
      setCodeWarning(`Warning: Item Code '${itemCode}' is already registered.`);
    } else {
      setCodeWarning(null);
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
      setIsSubmitting(true);
      setError(null);

      const selectedCat = categories.find((c) => c.categoryId === categoryId);

      const payload: Partial<MasterItem> = {
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        categoryId,
        categoryName: selectedCat?.categoryName || (itemType === 'chemical' ? 'Chemicals' : 'Firewood & Boiler Fuel'),
        itemType,
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
          active: true,
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
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Item Classification Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Item Classification Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'chemical', label: 'Chemical', icon: FlaskConical },
              { id: 'firewood', label: 'Raw Wood', icon: Flame }
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = itemType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isEditing}
                  onClick={() => handleTypeChange(t.id as ItemType)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#EEF5FB] border-[#1F4E79] text-[#1F4E79] shadow-2xs font-bold ring-2 ring-[#1F4E79]/20'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  } ${isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Item Code (Autogenerated) & Full Item / Material Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Input
              label="Item Code (Autogenerated)"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value.toUpperCase())}
              onBlur={handleCodeBlur}
              placeholder="e.g. CHM-001"
              required
            />
            {codeWarning && <p className="text-[11px] text-amber-600 mt-1">{codeWarning}</p>}
          </div>

          <div className="sm:col-span-2">
            <Input
              label="Full Item / Material Name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder={itemType === 'chemical' ? 'e.g. Neutral Bio-Enzyme Powder' : 'e.g. Casuarina Firewood Logs'}
              required
            />
          </div>
        </div>

        {/* 3. Item Category *, Base UOM *, Min Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Item Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
              required
            >
              {categories.length === 0 ? (
                <option value="">-- No Categories Created Yet --</option>
              ) : (
                <>
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.categoryName} ({c.categoryCode})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Base UOM <span className="text-red-500">*</span>
            </label>
            {units.length > 0 ? (
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-[#1F4E79]"
                required
              >
                <option value="">-- Select UOM --</option>
                {units.map((u) => (
                  <option key={u.symbol} value={u.symbol}>
                    {u.unitName} ({u.symbol})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                placeholder="e.g. kg, tonne"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-[#1F4E79]"
                required
              />
            )}
          </div>

          <div>
            <Input
              label="Min Stock"
              type="number"
              value={minimumStockLevel}
              onChange={(e) => setMinimumStockLevel(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        {/* 4. General Description & Purpose */}
        <div>
          <Input
            label="General Description & Purpose"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief summary of where and how this item is utilized in the factory"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Autogenerated unique item codes prevent catalogue collisions.</span>
          </div>

          <div className="flex gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting ? 'Saving Item...' : isEditing ? 'Update Master Item' : 'Create Master Item'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
