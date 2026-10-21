import React, { useState, useEffect } from 'react';
import { MasterItem, ItemCategoryRecord, UnitOfMeasure, ItemType, ChemicalGrade, ChemicalCategoryType } from '../../../types/item';
import { Vendor } from '../../../types/vendor';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { ItemService } from '../../../services/itemService';
import {
  Package,
  FlaskConical,
  Flame,
  Boxes,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Warehouse
} from 'lucide-react';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: MasterItem) => void;
  initialItem?: MasterItem | null;
  defaultType?: ItemType;
  categories: ItemCategoryRecord[];
  units: UnitOfMeasure[];
  vendors: Vendor[];
  currentUser: { uid: string; displayName?: string };
}

const CHEMICAL_CATEGORIES: ChemicalCategoryType[] = [
  'Detergent',
  'Softener',
  'Enzyme',
  'Bleaching Agent',
  'Dye',
  'Fixing Agent',
  'Neutralizer',
  'Finishing Chemical',
  'Wetting Agent',
  'Desizing Agent',
  'Other'
];

const CHEMICAL_GRADES: ChemicalGrade[] = [
  'Textile Processing Grade',
  'Industrial Grade',
  'Technical Grade',
  'Analytical Grade',
  'Commercial Grade'
];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialItem,
  defaultType = 'general',
  categories,
  units,
  vendors,
  currentUser
}) => {
  const isEditing = Boolean(initialItem);

  // Form State - General Item
  const [itemType, setItemType] = useState<ItemType>(initialItem?.itemType || defaultType);
  const [itemCode, setItemCode] = useState(initialItem?.itemCode || '');
  const [itemName, setItemName] = useState(initialItem?.itemName || '');
  const [categoryId, setCategoryId] = useState(initialItem?.categoryId || categories[0]?.categoryId || '');
  const [description, setDescription] = useState(initialItem?.description || '');
  const [baseUnit, setBaseUnit] = useState(initialItem?.baseUnit || 'kg');
  const [secondaryUnit, setSecondaryUnit] = useState(initialItem?.secondaryUnit || '');
  const [conversionFactor, setConversionFactor] = useState<number | undefined>(initialItem?.conversionFactor);
  const [defaultPurchaseRate, setDefaultPurchaseRate] = useState<number | undefined>(initialItem?.defaultPurchaseRate);
  const [minimumStockLevel, setMinimumStockLevel] = useState<number>(initialItem?.minimumStockLevel || 0);
  const [reorderLevel, setReorderLevel] = useState<number>(initialItem?.reorderLevel || 10);
  const [preferredSupplierId, setPreferredSupplierId] = useState(initialItem?.preferredSupplierId || '');
  const [supplierItemCode, setSupplierItemCode] = useState(initialItem?.supplierItemCode || '');
  const [storageLocation, setStorageLocation] = useState(initialItem?.storageLocation || '');
  const [hsnCode, setHsnCode] = useState(initialItem?.hsnCode || '');
  const [taxRatePercent, setTaxRatePercent] = useState<number | undefined>(initialItem?.taxRatePercent || 18);
  const [remarks, setRemarks] = useState(initialItem?.remarks || '');

  // Form State - Chemical Specific
  const [chemicalCategory, setChemicalCategory] = useState<string>(
    initialItem?.chemicalDetails?.chemicalCategory || 'Enzyme'
  );
  const [chemicalDisplayName, setChemicalDisplayName] = useState(
    initialItem?.chemicalDetails?.chemicalDisplayName || ''
  );
  const [chemicalGrade, setChemicalGrade] = useState<string>(
    initialItem?.chemicalDetails?.chemicalGrade || 'Textile Processing Grade'
  );
  const [manufacturer, setManufacturer] = useState(initialItem?.chemicalDetails?.manufacturer || '');
  const [brand, setBrand] = useState(initialItem?.chemicalDetails?.brand || '');
  const [consumptionUnit, setConsumptionUnit] = useState(initialItem?.chemicalDetails?.consumptionUnit || 'kg');
  const [batchTrackingRequired, setBatchTrackingRequired] = useState(
    initialItem?.chemicalDetails?.batchTrackingRequired ?? true
  );
  const [expiryTrackingRequired, setExpiryTrackingRequired] = useState(
    initialItem?.chemicalDetails?.expiryTrackingRequired ?? true
  );
  const [shelfLife, setShelfLife] = useState(initialItem?.chemicalDetails?.shelfLife || '12 Months');
  const [hazardClassification, setHazardClassification] = useState(
    initialItem?.chemicalDetails?.hazardClassification || ''
  );
  const [phRange, setPhRange] = useState(initialItem?.chemicalDetails?.phRange || '6.0 - 7.5');
  const [safetyInstructions, setSafetyInstructions] = useState(
    initialItem?.chemicalDetails?.safetyInstructions || ''
  );
  const [storageInstructions, setStorageInstructions] = useState(
    initialItem?.chemicalDetails?.storageInstructions || ''
  );
  const [handlingPrecautions, setHandlingPrecautions] = useState(
    initialItem?.chemicalDetails?.handlingPrecautions || ''
  );

  // Tab inside modal: 'general' | 'chemical'
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'chemical'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeWarning, setCodeWarning] = useState<string | null>(null);

  // Reset or fill on open
  useEffect(() => {
    if (initialItem) {
      setItemType(initialItem.itemType);
      setItemCode(initialItem.itemCode);
      setItemName(initialItem.itemName);
      setCategoryId(initialItem.categoryId);
      setDescription(initialItem.description || '');
      setBaseUnit(initialItem.baseUnit);
      setSecondaryUnit(initialItem.secondaryUnit || '');
      setConversionFactor(initialItem.conversionFactor);
      setDefaultPurchaseRate(initialItem.defaultPurchaseRate);
      setMinimumStockLevel(initialItem.minimumStockLevel || 0);
      setReorderLevel(initialItem.reorderLevel || 0);
      setPreferredSupplierId(initialItem.preferredSupplierId || '');
      setSupplierItemCode(initialItem.supplierItemCode || '');
      setStorageLocation(initialItem.storageLocation || '');
      setHsnCode(initialItem.hsnCode || '');
      setTaxRatePercent(initialItem.taxRatePercent);
      setRemarks(initialItem.remarks || '');

      if (initialItem.chemicalDetails) {
        setChemicalCategory(initialItem.chemicalDetails.chemicalCategory || 'Enzyme');
        setChemicalDisplayName(initialItem.chemicalDetails.chemicalDisplayName || initialItem.itemName);
        setChemicalGrade(initialItem.chemicalDetails.chemicalGrade || 'Textile Processing Grade');
        setManufacturer(initialItem.chemicalDetails.manufacturer || '');
        setBrand(initialItem.chemicalDetails.brand || '');
        setConsumptionUnit(initialItem.chemicalDetails.consumptionUnit || initialItem.baseUnit);
        setBatchTrackingRequired(initialItem.chemicalDetails.batchTrackingRequired ?? true);
        setExpiryTrackingRequired(initialItem.chemicalDetails.expiryTrackingRequired ?? true);
        setShelfLife(initialItem.chemicalDetails.shelfLife || '12 Months');
        setHazardClassification(initialItem.chemicalDetails.hazardClassification || '');
        setPhRange(initialItem.chemicalDetails.phRange || '6.0 - 7.5');
        setSafetyInstructions(initialItem.chemicalDetails.safetyInstructions || '');
        setStorageInstructions(initialItem.chemicalDetails.storageInstructions || '');
        setHandlingPrecautions(initialItem.chemicalDetails.handlingPrecautions || '');
      }
    } else {
      setItemType(defaultType);
      setItemCode('');
      setItemName('');
      setDescription('');
      setRemarks('');
      // Auto-assign category matching default type
      const matchedCat = categories.find((c) => {
        if (defaultType === 'chemical') return c.categoryName.toLowerCase().includes('chemical');
        if (defaultType === 'firewood') return c.categoryName.toLowerCase().includes('firewood');
        if (defaultType === 'raw_material') return c.categoryName.toLowerCase().includes('raw');
        return true;
      });
      if (matchedCat) setCategoryId(matchedCat.categoryId);
      setBaseUnit(defaultType === 'firewood' ? 't' : 'kg');

      // Generate proposed code
      ItemService.getNextItemCode(defaultType).then((suggested) => {
        setItemCode(suggested);
      });
    }
    setError(null);
    setCodeWarning(null);
  }, [initialItem, defaultType, isOpen, categories]);

  // When type changes on new item, re-suggest code
  const handleTypeChange = async (newType: ItemType) => {
    setItemType(newType);
    if (!isEditing) {
      const code = await ItemService.getNextItemCode(newType);
      setItemCode(code);
      if (newType === 'firewood') {
        setBaseUnit('t');
        setTaxRatePercent(5);
        const woodCat = categories.find((c) => c.categoryName.toLowerCase().includes('firewood'));
        if (woodCat) setCategoryId(woodCat.categoryId);
      } else if (newType === 'chemical') {
        setBaseUnit('kg');
        setTaxRatePercent(18);
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
      setError('Item Name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select an Item Category.');
      return;
    }
    if (!baseUnit.trim()) {
      setError('Base Unit of measure is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const selectedCat = categories.find((c) => c.categoryId === categoryId);
      const selectedVendor = vendors.find((v) => v.id === preferredSupplierId || v.vendorId === preferredSupplierId);

      const payload: Partial<MasterItem> = {
        itemCode: itemCode.trim().toUpperCase(),
        itemName: itemName.trim(),
        categoryId,
        categoryName: selectedCat?.categoryName || 'General',
        itemType,
        description: description.trim() || undefined,
        baseUnitId: `uom_${baseUnit.toLowerCase()}`,
        baseUnit: baseUnit.trim(),
        baseUnitSymbol: baseUnit.trim(),
        secondaryUnit: secondaryUnit.trim() || undefined,
        conversionFactor: conversionFactor ? Number(conversionFactor) : undefined,
        defaultPurchaseRate: defaultPurchaseRate !== undefined ? Number(defaultPurchaseRate) : undefined,
        minimumStockLevel: Number(minimumStockLevel) || 0,
        reorderLevel: Number(reorderLevel) || 0,
        preferredSupplierId: preferredSupplierId || undefined,
        preferredSupplierName: selectedVendor?.companyName || undefined,
        supplierItemCode: supplierItemCode.trim() || undefined,
        storageLocation: storageLocation.trim() || undefined,
        hsnCode: hsnCode.trim() || undefined,
        taxRatePercent: taxRatePercent !== undefined ? Number(taxRatePercent) : undefined,
        remarks: remarks.trim() || undefined,
        batchTrackingEnabled: itemType === 'chemical' ? batchTrackingRequired : false,
        expiryTrackingEnabled: itemType === 'chemical' ? expiryTrackingRequired : false
      };

      if (itemType === 'chemical') {
        payload.chemicalDetails = {
          itemId: initialItem?.id || '',
          chemicalCode: itemCode.trim().toUpperCase(),
          chemicalName: itemName.trim(),
          chemicalDisplayName: chemicalDisplayName.trim() || itemName.trim(),
          chemicalCategory,
          chemicalType: 'Textile Processing Chemical',
          chemicalGrade,
          manufacturer: manufacturer.trim() || undefined,
          brand: brand.trim() || undefined,
          preferredSupplierId: preferredSupplierId || undefined,
          preferredSupplierName: selectedVendor?.companyName || undefined,
          supplierProductCode: supplierItemCode.trim() || undefined,
          purchaseUnit: baseUnit.trim(),
          consumptionUnit: consumptionUnit.trim() || baseUnit.trim(),
          conversionFactor: 1,
          defaultPurchaseRate: defaultPurchaseRate !== undefined ? Number(defaultPurchaseRate) : undefined,
          minimumStockLevel: Number(minimumStockLevel) || 0,
          reorderLevel: Number(reorderLevel) || 0,
          storageLocation: storageLocation.trim() || undefined,
          batchTrackingRequired,
          expiryTrackingRequired,
          shelfLife: shelfLife.trim() || undefined,
          safetyInstructions: safetyInstructions.trim() || undefined,
          storageInstructions: storageInstructions.trim() || undefined,
          handlingPrecautions: handlingPrecautions.trim() || undefined,
          hazardClassification: hazardClassification.trim() || undefined,
          phRange: phRange.trim() || undefined,
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
      setError(err?.message || 'Failed to save item specifications.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Master Item: ${initialItem?.itemCode}` : 'Create Master Item Specification'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher for Chemical vs General */}
        {itemType === 'chemical' && (
          <div className="flex border-b border-slate-200 pb-1 gap-4">
            <button
              type="button"
              onClick={() => setActiveModalTab('general')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeModalTab === 'general'
                  ? 'border-[#1F4E79] text-[#1F4E79]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              1. General & Commercial Info
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('chemical')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeModalTab === 'chemical'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              2. Chemical Specs & Safety Handling
            </button>
          </div>
        )}

        {/* TAB 1: GENERAL SPECIFICATIONS */}
        {activeModalTab === 'general' && (
          <div className="space-y-4">
            {/* Item Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Item Classification Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'general', label: 'General Item', icon: Package },
                  { id: 'chemical', label: 'Chemical', icon: FlaskConical },
                  { id: 'firewood', label: 'Boiler Firewood', icon: Flame },
                  { id: 'raw_material', label: 'Raw Material', icon: Boxes }
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = itemType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={isEditing}
                      onClick={() => handleTypeChange(t.id as ItemType)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#EEF5FB] border-[#1F4E79] text-[#1F4E79] shadow-2xs font-bold'
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

            {/* Item Code & Item Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Item Code (Unique)"
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
                  placeholder="e.g. Neutral Bio-Enzyme Powder (Novozymes)"
                  required
                />
              </div>
            </div>

            {/* Category & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  Preferred Supplier (Vendor Master)
                </label>
                <select
                  value={preferredSupplierId}
                  onChange={(e) => setPreferredSupplierId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
                >
                  <option value="">-- No Direct Preferred Supplier --</option>
                  {vendors.map((v) => (
                    <option key={v.id || v.vendorId} value={v.id || v.vendorId}>
                      {v.companyName} ({v.vendorCode || 'VND'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Units & Pricing */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Base UOM <span className="text-red-500">*</span>
                </label>
                {units.length > 0 ? (
                  <select
                    value={baseUnit}
                    onChange={(e) => setBaseUnit(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-[#1F4E79]"
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
                    placeholder="e.g. kg, pcs"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-[#1F4E79]"
                    required
                  />
                )}
              </div>

              <div>
                <Input
                  label="Standard Rate (₹)"
                  type="number"
                  step="0.01"
                  value={defaultPurchaseRate !== undefined ? defaultPurchaseRate : ''}
                  onChange={(e) => setDefaultPurchaseRate(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="0.00"
                />
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

              <div>
                <Input
                  label="Reorder Alert"
                  type="number"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(Number(e.target.value))}
                  placeholder="10"
                />
              </div>
            </div>

            {/* Storage Location & HSN */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Storage Rack / Yard Bay"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g. Chem Store Rack B1"
                />
              </div>

              <div>
                <Input
                  label="HSN / Tax Code"
                  value={hsnCode}
                  onChange={(e) => setHsnCode(e.target.value)}
                  placeholder="e.g. 35079099"
                />
              </div>

              <div>
                <Input
                  label="GST Tax Rate (%)"
                  type="number"
                  value={taxRatePercent !== undefined ? taxRatePercent : ''}
                  onChange={(e) => setTaxRatePercent(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="18"
                />
              </div>
            </div>

            {/* Description & Internal Remarks */}
            <div>
              <Input
                label="General Description & Purpose"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of where and how this item is utilized in the factory"
              />
            </div>
          </div>
        )}

        {/* TAB 2: CHEMICAL SPECIFICATIONS & SAFETY */}
        {activeModalTab === 'chemical' && itemType === 'chemical' && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Textile Chemical Safety Compliance:</span> Chemical safety and handling
                specifications entered here are directly displayed to shopfloor operators during Chemical Entry and batch mixing.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Chemical Category
                </label>
                <select
                  value={chemicalCategory}
                  onChange={(e) => setChemicalCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                >
                  {CHEMICAL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Chemical Grade
                </label>
                <select
                  value={chemicalGrade}
                  onChange={(e) => setChemicalGrade(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium"
                >
                  {CHEMICAL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Input
                  label="Display Name (Shopfloor)"
                  value={chemicalDisplayName}
                  onChange={(e) => setChemicalDisplayName(e.target.value)}
                  placeholder="e.g. Bio-Enzyme Neutral"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  label="Manufacturer"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="e.g. Novozymes Bio"
                />
              </div>

              <div>
                <Input
                  label="Brand / Commercial Name"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. CelluSmart 400"
                />
              </div>

              <div>
                <Input
                  label="pH Working Range"
                  value={phRange}
                  onChange={(e) => setPhRange(e.target.value)}
                  placeholder="e.g. 6.0 - 7.5"
                />
              </div>
            </div>

            {/* Tracking Switches */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={batchTrackingRequired}
                  onChange={(e) => setBatchTrackingRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1F4E79] focus:ring-[#1F4E79]"
                />
                <span>Batch / Lot Tracking Required</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={expiryTrackingRequired}
                  onChange={(e) => setExpiryTrackingRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1F4E79] focus:ring-[#1F4E79]"
                />
                <span>Expiry Tracking Enforced</span>
              </label>

              <div>
                <Input
                  label="Shelf Life"
                  value={shelfLife}
                  onChange={(e) => setShelfLife(e.target.value)}
                  placeholder="e.g. 12 Months"
                />
              </div>
            </div>

            {/* Safety & Precautions */}
            <div>
              <Input
                label="Safety & First Aid Instructions"
                value={safetyInstructions}
                onChange={(e) => setSafetyInstructions(e.target.value)}
                placeholder="In case of eye contact, flush with water immediately for 15 mins."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Input
                  label="Storage Temperature & Conditions"
                  value={storageInstructions}
                  onChange={(e) => setStorageInstructions(e.target.value)}
                  placeholder="Store tightly sealed below 25°C in cool shaded place."
                />
              </div>

              <div>
                <Input
                  label="PPE & Handling Precautions"
                  value={handlingPrecautions}
                  onChange={(e) => setHandlingPrecautions(e.target.value)}
                  placeholder="Wear nitrile gloves, apron, and dust mask."
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Master items are immutably archived rather than deleted.</span>
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
