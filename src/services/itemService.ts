import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  MasterItem,
  ChemicalDetails,
  ItemCategoryRecord,
  UnitOfMeasure,
  ItemAuditLog,
  ItemFilterOptions,
  ItemPagination
} from '../types/item';

const ITEMS_STORAGE_KEY = 'perla_items_master_data';
const CATEGORIES_STORAGE_KEY = 'perla_item_categories_data';
const UNITS_STORAGE_KEY = 'perla_item_units_data';
const AUDIT_STORAGE_KEY = 'perla_item_audit_logs';

export const DEFAULT_CATEGORIES: ItemCategoryRecord[] = [
  {
    id: 'cat_chemical',
    categoryId: 'cat_chemical',
    categoryName: 'Chemicals',
    categoryCode: 'CHM',
    description: 'Processing chemicals, dyes, auxiliaries, enzymes, and softeners',
    parentCategoryId: null,
    status: 'active',
    itemCount: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat_firewood',
    categoryId: 'cat_firewood',
    categoryName: 'Firewood & Boiler Fuel',
    categoryCode: 'FWD',
    description: 'Casuarina logs, wood briquettes, and boiler thermal fuel',
    parentCategoryId: null,
    status: 'active',
    itemCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat_raw_material',
    categoryId: 'cat_raw_material',
    categoryName: 'Raw Materials',
    categoryCode: 'RAW',
    description: 'Customer base fabrics, processing salts, and chemical intermediates',
    parentCategoryId: null,
    status: 'active',
    itemCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat_packaging',
    categoryId: 'cat_packaging',
    categoryName: 'Packing Materials',
    categoryCode: 'PKG',
    description: 'Polybags, carton boxes, packing tape, and dispatched goods wrapping',
    parentCategoryId: null,
    status: 'active',
    itemCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'cat_consumables',
    categoryId: 'cat_consumables',
    categoryName: 'Consumables & Spares',
    categoryCode: 'CON',
    description: 'Machine filters, grease, lubricants, and daily maintenance consumables',
    parentCategoryId: null,
    status: 'active',
    itemCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

export const DEFAULT_UNITS: UnitOfMeasure[] = [
  {
    id: 'uom_kg',
    unitId: 'uom_kg',
    unitCode: 'KG',
    unitName: 'Kilogram',
    symbol: 'kg',
    unitType: 'weight',
    baseUnit: 'kg',
    conversionFactorToBase: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_g',
    unitId: 'uom_g',
    unitCode: 'G',
    unitName: 'Gram',
    symbol: 'g',
    unitType: 'weight',
    baseUnit: 'kg',
    conversionFactorToBase: 0.001,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_litre',
    unitId: 'uom_litre',
    unitCode: 'L',
    unitName: 'Litre',
    symbol: 'L',
    unitType: 'volume',
    baseUnit: 'L',
    conversionFactorToBase: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_ml',
    unitId: 'uom_ml',
    unitCode: 'ML',
    unitName: 'Millilitre',
    symbol: 'ml',
    unitType: 'volume',
    baseUnit: 'L',
    conversionFactorToBase: 0.001,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_tonne',
    unitId: 'uom_tonne',
    unitCode: 'TONNE',
    unitName: 'Metric Tonne',
    symbol: 't',
    unitType: 'weight',
    baseUnit: 'kg',
    conversionFactorToBase: 1000,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_piece',
    unitId: 'uom_piece',
    unitCode: 'PCS',
    unitName: 'Piece',
    symbol: 'pcs',
    unitType: 'count',
    baseUnit: 'pcs',
    conversionFactorToBase: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_bag',
    unitId: 'uom_bag',
    unitCode: 'BAG',
    unitName: 'Bag (50kg)',
    symbol: 'bag',
    unitType: 'package',
    baseUnit: 'kg',
    conversionFactorToBase: 50,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uom_drum',
    unitId: 'uom_drum',
    unitCode: 'DRUM',
    unitName: 'Drum (200L)',
    symbol: 'drum',
    unitType: 'package',
    baseUnit: 'L',
    conversionFactorToBase: 200,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
];

export const INITIAL_ITEMS: MasterItem[] = [
  {
    id: 'item-chm-01',
    itemId: 'item-chm-01',
    itemCode: 'CHM-ENZ-01',
    itemName: 'Neutral Bio-Enzyme Powder',
    categoryId: 'cat_chemical',
    categoryName: 'Chemicals',
    itemType: 'chemical',
    description: 'High activity neutral cellulase enzyme for biopolishing and denim wash depilling',
    baseUnitId: 'uom_kg',
    baseUnit: 'kg',
    baseUnitSymbol: 'kg',
    conversionFactor: 1,
    defaultPurchaseRate: 160,
    minimumStockLevel: 50,
    reorderLevel: 100,
    preferredSupplierId: 'v-101',
    preferredSupplierName: 'Sree Kumar Texind Corporation',
    storageLocation: 'Chemical Store - Rack A2',
    hsnCode: '35079099',
    taxRatePercent: 18,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: true,
    status: 'active',
    currentStock: 220,
    chemicalDetails: {
      itemId: 'item-chm-01',
      chemicalCode: 'CHM-ENZ-01',
      chemicalName: 'Neutral Bio-Enzyme Powder',
      chemicalDisplayName: 'Bio-Enzyme Powder (Neutral)',
      chemicalCategory: 'Enzyme',
      chemicalType: 'Biopolishing Enzyme',
      chemicalGrade: 'Textile Processing Grade',
      manufacturer: 'Novozymes Bio India',
      brand: 'CelluSmart 400',
      purchaseUnit: 'kg',
      consumptionUnit: 'kg',
      conversionFactor: 1,
      defaultPurchaseRate: 160,
      minimumStockLevel: 50,
      reorderLevel: 100,
      batchTrackingRequired: true,
      expiryTrackingRequired: true,
      shelfLifeMonths: 12,
      shelfLife: '12 Months from Mfg',
      safetyInstructions: 'Avoid inhaling powder dust. Store below 25°C in sealed containers away from sunlight.',
      storageInstructions: 'Dry, cool, moisture-free warehouse area.',
      handlingPrecautions: 'Wear dust mask, safety goggles, and nitrile gloves during batch dispensary.',
      hazardClassification: 'Mild respiratory irritant on airborne dusting',
      phRange: '6.0 - 7.5',
      active: true,
      createdAt: '2026-01-10T10:00:00.000Z',
      updatedAt: '2026-01-10T10:00:00.000Z'
    },
    createdBy: 'admin-uid',
    createdByName: 'Authorized Admin',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedBy: 'admin-uid',
    updatedByName: 'Authorized Admin',
    updatedAt: '2026-01-10T10:00:00.000Z'
  },
  {
    id: 'item-chm-02',
    itemId: 'item-chm-02',
    itemCode: 'CHM-SOF-02',
    itemName: 'Macro-Emulsion Silicone Softener',
    categoryId: 'cat_chemical',
    categoryName: 'Chemicals',
    itemType: 'chemical',
    description: 'Concentrated silicone fluid delivering superior inner softness and surface bounciness',
    baseUnitId: 'uom_kg',
    baseUnit: 'kg',
    baseUnitSymbol: 'kg',
    conversionFactor: 1,
    defaultPurchaseRate: 110,
    minimumStockLevel: 80,
    reorderLevel: 150,
    preferredSupplierId: 'v-102',
    preferredSupplierName: 'Paramount Apparel Processing',
    storageLocation: 'Chemical Store - Tank Bay B',
    hsnCode: '34031100',
    taxRatePercent: 18,
    batchTrackingEnabled: true,
    expiryTrackingEnabled: false,
    status: 'active',
    currentStock: 340,
    chemicalDetails: {
      itemId: 'item-chm-02',
      chemicalCode: 'CHM-SOF-02',
      chemicalName: 'Macro-Emulsion Silicone Softener',
      chemicalDisplayName: 'Silicone Softener Liquid',
      chemicalCategory: 'Softener',
      chemicalType: 'Amino Modified Silicone',
      chemicalGrade: 'Textile Processing Grade',
      manufacturer: 'Rossari Biotech Ltd',
      brand: 'SuperSil Touch',
      purchaseUnit: 'kg',
      consumptionUnit: 'kg',
      conversionFactor: 1,
      defaultPurchaseRate: 110,
      minimumStockLevel: 80,
      reorderLevel: 150,
      batchTrackingRequired: true,
      expiryTrackingRequired: false,
      shelfLifeMonths: 24,
      shelfLife: '24 Months',
      safetyInstructions: 'Avoid eye contact. In case of spill, wash with abundant water.',
      storageInstructions: 'Keep drums sealed tight, room temperature.',
      handlingPrecautions: 'Wear gloves and apron.',
      phRange: '5.5 - 6.5',
      active: true,
      createdAt: '2026-01-11T10:00:00.000Z',
      updatedAt: '2026-01-11T10:00:00.000Z'
    },
    createdBy: 'admin-uid',
    createdByName: 'Authorized Admin',
    createdAt: '2026-01-11T10:00:00.000Z',
    updatedBy: 'admin-uid',
    updatedByName: 'Authorized Admin',
    updatedAt: '2026-01-11T10:00:00.000Z'
  },
  {
    id: 'item-fwd-01',
    itemId: 'item-fwd-01',
    itemCode: 'FWD-CAS-01',
    itemName: 'Casuarina Firewood Logs (Boiler Fuel)',
    categoryId: 'cat_firewood',
    categoryName: 'Firewood & Boiler Fuel',
    itemType: 'firewood',
    description: 'Dry seasoned casuarina wood logs for industrial steam boiler generation',
    baseUnitId: 'uom_tonne',
    baseUnit: 't',
    baseUnitSymbol: 't',
    conversionFactor: 1000,
    defaultPurchaseRate: 4500,
    minimumStockLevel: 5,
    reorderLevel: 10,
    preferredSupplierId: 'v-101',
    preferredSupplierName: 'Sree Kumar Texind Corporation',
    storageLocation: 'Boiler Wood Yard Bay 1',
    hsnCode: '44011100',
    taxRatePercent: 5,
    status: 'active',
    currentStock: 18.5,
    remarks: 'Moisture content should remain below 18% for efficient combustion calorific value',
    createdBy: 'admin-uid',
    createdByName: 'Authorized Admin',
    createdAt: '2026-01-12T10:00:00.000Z',
    updatedBy: 'admin-uid',
    updatedByName: 'Authorized Admin',
    updatedAt: '2026-01-12T10:00:00.000Z'
  },
  {
    id: 'item-raw-01',
    itemId: 'item-raw-01',
    itemCode: 'RAW-SLT-01',
    itemName: 'Industrial Refined Sodium Sulphate Salt',
    categoryId: 'cat_raw_material',
    categoryName: 'Raw Materials',
    itemType: 'raw_material',
    description: 'Electrolyte salt used in reactive dyeing bath exhaustion',
    baseUnitId: 'uom_kg',
    baseUnit: 'kg',
    baseUnitSymbol: 'kg',
    conversionFactor: 1,
    defaultPurchaseRate: 9.5,
    minimumStockLevel: 500,
    reorderLevel: 1200,
    storageLocation: 'Salt Yard Warehouse Bay 3',
    hsnCode: '28331100',
    taxRatePercent: 18,
    status: 'active',
    currentStock: 2400,
    createdBy: 'admin-uid',
    createdByName: 'Authorized Admin',
    createdAt: '2026-01-12T10:00:00.000Z',
    updatedBy: 'admin-uid',
    updatedByName: 'Authorized Admin',
    updatedAt: '2026-01-12T10:00:00.000Z'
  }
];

const memoryStore: Record<string, string> = {};

function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

function safeSetStorage(key: string, value: string): void {
  memoryStore[key] = value;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

export class ItemService {
  /**
   * Retrieves all Master Items with filtering, search, and pagination
   */
  static async getItems(
    filters?: ItemFilterOptions,
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 50 },
    isDemo: boolean = false
  ): Promise<{ items: MasterItem[]; totalCount: number }> {
    let list: MasterItem[] = [];

    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'items'));
        if (!snap.empty) {
          list = snap.docs.map((d) => {
            const data = d.data();
            return {
              ...data,
              id: d.id,
              itemId: data.itemId || d.id
            } as MasterItem;
          });
          safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(list));
        } else {
          // If Firestore collection is empty, seed initial defaults to Firestore
          list = [...INITIAL_ITEMS];
          for (const item of list) {
            await setDoc(doc(db, 'items', item.id), item);
            if (item.chemicalDetails) {
              await setDoc(doc(db, 'chemical_details', item.id), item.chemicalDetails);
            }
          }
          safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(list));
        }
      } catch (err) {
        console.warn('Firestore getItems error, using local cache:', err);
        const cached = safeGetStorage(ITEMS_STORAGE_KEY);
        list = cached ? JSON.parse(cached) : [...INITIAL_ITEMS];
      }
    } else {
      const cached = safeGetStorage(ITEMS_STORAGE_KEY);
      list = cached ? JSON.parse(cached) : [...INITIAL_ITEMS];
    }

    // Apply filtering
    let filtered = [...list];

    if (filters?.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (it) =>
          it.itemName?.toLowerCase().includes(q) ||
          it.itemCode?.toLowerCase().includes(q) ||
          it.categoryName?.toLowerCase().includes(q) ||
          it.preferredSupplierName?.toLowerCase().includes(q) ||
          it.chemicalDetails?.chemicalCategory?.toLowerCase().includes(q)
      );
    }

    if (filters?.category && filters.category !== 'all') {
      filtered = filtered.filter((it) => it.categoryId === filters.category || it.categoryName === filters.category);
    }

    if (filters?.itemType && filters.itemType !== 'all') {
      filtered = filtered.filter((it) => it.itemType === filters.itemType);
    }

    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter((it) => it.status === filters.status);
    }

    if (filters?.supplierId && filters.supplierId !== 'all') {
      filtered = filtered.filter((it) => it.preferredSupplierId === filters.supplierId);
    }

    if (filters?.lowStockOnly) {
      filtered = filtered.filter((it) => (it.currentStock || 0) <= (it.reorderLevel || 0));
    }

    // Sort: active first, then alphabetically by name
    filtered.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return (a.itemName || '').localeCompare(b.itemName || '');
    });

    const totalCount = filtered.length;
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pagination.pageSize);

    return { items: paginated, totalCount };
  }

  /**
   * Retrieves single item by ID with chemical specifications if applicable
   */
  static async getItemById(itemId: string, isDemo: boolean = false): Promise<MasterItem | null> {
    if (!isDemo) {
      try {
        const itemSnap = await getDoc(doc(db, 'items', itemId));
        if (itemSnap.exists()) {
          const item = itemSnap.data() as MasterItem;
          if (item.itemType === 'chemical') {
            const chemSnap = await getDoc(doc(db, 'chemical_details', itemId));
            if (chemSnap.exists()) {
              item.chemicalDetails = chemSnap.data() as ChemicalDetails;
            }
          }
          return item;
        }
      } catch (e) {
        console.warn('Failed to fetch item from Firestore:', e);
      }
    }

    const { items } = await this.getItems({}, { page: 1, pageSize: 500 }, true);
    return items.find((i) => i.id === itemId || i.itemId === itemId) || null;
  }

  /**
   * Checks whether an item code or name is already in use
   */
  static async checkDuplicate(
    itemCode: string,
    itemName: string,
    currentItemId?: string,
    isDemo: boolean = false
  ): Promise<{ duplicateCode: boolean; duplicateName: boolean }> {
    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, isDemo);
    const codeMatch = items.some(
      (it) => it.id !== currentItemId && it.itemCode?.toLowerCase() === itemCode.trim().toLowerCase()
    );
    const nameMatch = items.some(
      (it) => it.id !== currentItemId && it.itemName?.toLowerCase() === itemName.trim().toLowerCase()
    );
    return { duplicateCode: codeMatch, duplicateName: nameMatch };
  }

  /**
   * Generates a recommended human-readable Item Code based on category/type
   */
  static async getNextItemCode(itemType: string, isDemo: boolean = false): Promise<string> {
    const prefixMap: Record<string, string> = {
      chemical: 'CHM',
      firewood: 'FWD',
      raw_material: 'RAW',
      packing: 'PKG',
      consumable: 'CON',
      general: 'ITM'
    };
    const prefix = prefixMap[itemType] || 'ITM';

    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, isDemo);
    const count = items.filter((i) => i.itemCode?.startsWith(prefix)).length + 1;
    return `${prefix}-${String(count).padStart(3, '0')}`;
  }

  /**
   * Creates a new Master Item with validation, chemical linking, and audit logging
   */
  static async createItem(
    itemData: Partial<MasterItem>,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<MasterItem> {
    if (!itemData.itemName?.trim()) {
      throw new Error('Item Name is required.');
    }
    if (!itemData.categoryId) {
      throw new Error('Category is required.');
    }
    if (!itemData.baseUnit?.trim()) {
      throw new Error('Base Unit of measurement is required.');
    }

    const now = new Date().toISOString();
    const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const itemCode = (itemData.itemCode || (await this.getNextItemCode(itemData.itemType || 'general', isDemo))).toUpperCase().trim();

    // Enforce unique item code
    const duplicates = await this.checkDuplicate(itemCode, itemData.itemName, undefined, isDemo);
    if (duplicates.duplicateCode) {
      throw new Error(`Item Code '${itemCode}' already exists. Please choose a unique code.`);
    }

    const newItem: MasterItem = {
      id: itemId,
      itemId,
      itemCode,
      itemName: itemData.itemName.trim(),
      categoryId: itemData.categoryId,
      categoryName: itemData.categoryName || 'General',
      subcategoryId: itemData.subcategoryId || undefined,
      subcategoryName: itemData.subcategoryName || undefined,
      itemType: itemData.itemType || 'general',
      description: itemData.description?.trim() || undefined,
      baseUnitId: itemData.baseUnitId || 'uom_kg',
      baseUnit: itemData.baseUnit.trim(),
      baseUnitSymbol: itemData.baseUnitSymbol || itemData.baseUnit.trim(),
      secondaryUnitId: itemData.secondaryUnitId,
      secondaryUnit: itemData.secondaryUnit,
      conversionFactor: itemData.conversionFactor,
      defaultPurchaseRate: itemData.defaultPurchaseRate,
      minimumStockLevel: itemData.minimumStockLevel || 0,
      reorderLevel: itemData.reorderLevel || 0,
      preferredSupplierId: itemData.preferredSupplierId,
      preferredSupplierName: itemData.preferredSupplierName,
      supplierItemCode: itemData.supplierItemCode,
      storageLocation: itemData.storageLocation,
      hsnCode: itemData.hsnCode,
      taxRatePercent: itemData.taxRatePercent,
      batchTrackingEnabled: Boolean(itemData.batchTrackingEnabled || itemData.chemicalDetails?.batchTrackingRequired),
      expiryTrackingEnabled: Boolean(itemData.expiryTrackingEnabled || itemData.chemicalDetails?.expiryTrackingRequired),
      status: 'active',
      currentStock: itemData.currentStock || 0,
      remarks: itemData.remarks,
      createdBy: user.uid,
      createdByName: user.displayName || 'Authorized User',
      createdAt: now,
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now
    };

    if (itemData.chemicalDetails) {
      newItem.chemicalDetails = {
        ...itemData.chemicalDetails,
        itemId,
        chemicalCode: itemCode,
        chemicalName: newItem.itemName,
        chemicalDisplayName: itemData.chemicalDetails.chemicalDisplayName || newItem.itemName,
        active: true,
        createdAt: now,
        updatedAt: now
      };
    }

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'items', itemId), newItem);
        if (newItem.chemicalDetails) {
          await setDoc(doc(db, 'chemical_details', itemId), newItem.chemicalDetails);
        }
      } catch (err) {
        console.warn('Failed to save item to Firestore:', err);
      }
    }

    // Cache update
    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, true);
    items.unshift(newItem);
    safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(items));

    // Audit log
    await this.recordAuditLog({
      auditId: `audit_${Date.now()}`,
      itemId,
      itemCode,
      itemName: newItem.itemName,
      action: 'created',
      changedBy: user.uid,
      changedByName: user.displayName || 'Authorized User',
      changedAt: now,
      summary: `Created ${newItem.itemType} item '${newItem.itemName}' (${itemCode})`,
      newValues: newItem
    }, isDemo);

    return newItem;
  }

  /**
   * Updates an existing Master Item
   */
  static async updateItem(
    itemId: string,
    updates: Partial<MasterItem>,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<MasterItem> {
    const existing = await this.getItemById(itemId, isDemo);
    if (!existing) {
      throw new Error(`Item with ID ${itemId} not found.`);
    }

    // If itemCode changed, verify uniqueness
    if (updates.itemCode && updates.itemCode.trim().toUpperCase() !== existing.itemCode) {
      const codeClean = updates.itemCode.trim().toUpperCase();
      const dup = await this.checkDuplicate(codeClean, updates.itemName || existing.itemName, itemId, isDemo);
      if (dup.duplicateCode) {
        throw new Error(`Item Code '${codeClean}' is already in use.`);
      }
      updates.itemCode = codeClean;
    }

    const now = new Date().toISOString();
    const updated: MasterItem = {
      ...existing,
      ...updates,
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now
    };

    if (updates.chemicalDetails) {
      updated.chemicalDetails = {
        ...existing.chemicalDetails,
        ...updates.chemicalDetails,
        itemId,
        updatedAt: now
      } as ChemicalDetails;
    }

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'items', itemId), updated, { merge: true });
        if (updated.chemicalDetails) {
          await setDoc(doc(db, 'chemical_details', itemId), updated.chemicalDetails, { merge: true });
        }
      } catch (err) {
        console.warn('Failed to update item in Firestore:', err);
      }
    }

    // Cache update
    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, true);
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx >= 0) {
      items[idx] = updated;
    } else {
      items.unshift(updated);
    }
    safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(items));

    // Audit log
    await this.recordAuditLog({
      auditId: `audit_${Date.now()}`,
      itemId,
      itemCode: updated.itemCode,
      itemName: updated.itemName,
      action: 'updated',
      changedBy: user.uid,
      changedByName: user.displayName || 'Authorized User',
      changedAt: now,
      summary: `Updated master item '${updated.itemName}' (${updated.itemCode})`,
      previousValues: existing,
      newValues: updated
    }, isDemo);

    return updated;
  }

  /**
   * Deactivates an item (safe soft-delete) preserving all transaction references
   */
  static async deactivateItem(
    itemId: string,
    reason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<MasterItem> {
    const existing = await this.getItemById(itemId, isDemo);
    if (!existing) {
      throw new Error(`Item with ID ${itemId} not found.`);
    }

    const now = new Date().toISOString();
    const updated: MasterItem = {
      ...existing,
      status: 'inactive',
      remarks: reason ? `Deactivation note: ${reason}` : existing.remarks,
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now
    };

    if (!isDemo) {
      try {
        await updateDoc(doc(db, 'items', itemId), {
          status: 'inactive',
          updatedBy: user.uid,
          updatedByName: user.displayName || 'Authorized User',
          updatedAt: now
        });
        await setDoc(doc(db, 'chemical_details', itemId), { active: false, updatedAt: now }, { merge: true });
      } catch (e) {
        console.warn('Failed to deactivate item in Firestore:', e);
      }
    }

    // Cache update
    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, true);
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx >= 0) items[idx] = updated;
    safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(items));

    await this.recordAuditLog({
      auditId: `audit_${Date.now()}`,
      itemId,
      itemCode: existing.itemCode,
      itemName: existing.itemName,
      action: 'deactivated',
      changedBy: user.uid,
      changedByName: user.displayName || 'Authorized User',
      changedAt: now,
      summary: `Item '${existing.itemName}' deactivated. Reason: ${reason || 'N/A'}`
    }, isDemo);

    return updated;
  }

  /**
   * Reactivates a deactivated item back into active catalogue
   */
  static async reactivateItem(
    itemId: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<MasterItem> {
    const existing = await this.getItemById(itemId, isDemo);
    if (!existing) {
      throw new Error(`Item with ID ${itemId} not found.`);
    }

    const now = new Date().toISOString();
    const updated: MasterItem = {
      ...existing,
      status: 'active',
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now
    };

    if (!isDemo) {
      try {
        await updateDoc(doc(db, 'items', itemId), {
          status: 'active',
          updatedBy: user.uid,
          updatedByName: user.displayName || 'Authorized User',
          updatedAt: now
        });
        await setDoc(doc(db, 'chemical_details', itemId), { active: true, updatedAt: now }, { merge: true });
      } catch (e) {
        console.warn('Failed to reactivate item in Firestore:', e);
      }
    }

    const { items } = await this.getItems({}, { page: 1, pageSize: 1000 }, true);
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx >= 0) items[idx] = updated;
    safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(items));

    await this.recordAuditLog({
      auditId: `audit_${Date.now()}`,
      itemId,
      itemCode: existing.itemCode,
      itemName: existing.itemName,
      action: 'reactivated',
      changedBy: user.uid,
      changedByName: user.displayName || 'Authorized User',
      changedAt: now,
      summary: `Item '${existing.itemName}' restored to active catalogue`
    }, isDemo);

    return updated;
  }

  /**
   * Categories Management
   */
  static async getCategories(isDemo: boolean = false): Promise<ItemCategoryRecord[]> {
    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'item_categories'));
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as ItemCategoryRecord);
          safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(list));
          return list;
        } else {
          // Seed defaults
          for (const cat of DEFAULT_CATEGORIES) {
            await setDoc(doc(db, 'item_categories', cat.id), cat);
          }
          safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
          return DEFAULT_CATEGORIES;
        }
      } catch (err) {
        console.warn('Firestore getCategories error:', err);
      }
    }
    const stored = safeGetStorage(CATEGORIES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_CATEGORIES;
  }

  static async createCategory(
    data: Partial<ItemCategoryRecord>,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<ItemCategoryRecord> {
    if (!data.categoryName?.trim()) {
      throw new Error('Category Name is required.');
    }
    const catId = `cat_${Date.now()}`;
    const now = new Date().toISOString();
    const newCat: ItemCategoryRecord = {
      id: catId,
      categoryId: catId,
      categoryName: data.categoryName.trim(),
      categoryCode: (data.categoryCode || data.categoryName.slice(0, 3)).toUpperCase().trim(),
      description: data.description?.trim(),
      parentCategoryId: data.parentCategoryId || null,
      status: 'active',
      itemCount: 0,
      createdAt: now,
      updatedAt: now
    };

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'item_categories', catId), newCat);
      } catch (e) {
        console.warn('Failed to save category to Firestore:', e);
      }
    }

    const current = await this.getCategories(true);
    current.push(newCat);
    safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(current));
    return newCat;
  }

  static async updateCategory(
    categoryId: string,
    updates: Partial<ItemCategoryRecord>,
    isDemo: boolean = false
  ): Promise<ItemCategoryRecord> {
    const list = await this.getCategories(isDemo);
    const target = list.find((c) => c.id === categoryId || c.categoryId === categoryId);
    if (!target) throw new Error('Category not found');

    const now = new Date().toISOString();
    const updated = { ...target, ...updates, updatedAt: now };

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'item_categories', categoryId), updated, { merge: true });
      } catch (e) {
        console.warn('Failed to update category in Firestore:', e);
      }
    }

    const idx = list.findIndex((c) => c.id === categoryId || c.categoryId === categoryId);
    if (idx >= 0) list[idx] = updated;
    safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(list));
    return updated;
  }

  /**
   * Units of Measure Management
   */
  static async getUnitsOfMeasure(isDemo: boolean = false): Promise<UnitOfMeasure[]> {
    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'units_of_measure'));
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as UnitOfMeasure);
          safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(list));
          return list;
        } else {
          for (const u of DEFAULT_UNITS) {
            await setDoc(doc(db, 'units_of_measure', u.id), u);
          }
          safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(DEFAULT_UNITS));
          return DEFAULT_UNITS;
        }
      } catch (err) {
        console.warn('Firestore getUnitsOfMeasure error:', err);
      }
    }
    const stored = safeGetStorage(UNITS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_UNITS;
  }

  static async createUnitOfMeasure(
    data: Partial<UnitOfMeasure>,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<UnitOfMeasure> {
    if (!data.unitName?.trim() || !data.symbol?.trim()) {
      throw new Error('Unit Name and Symbol are required.');
    }
    const uomId = `uom_${data.symbol.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const now = new Date().toISOString();
    const newUnit: UnitOfMeasure = {
      id: uomId,
      unitId: uomId,
      unitCode: (data.unitCode || data.symbol).toUpperCase().trim(),
      unitName: data.unitName.trim(),
      symbol: data.symbol.trim(),
      unitType: data.unitType || 'weight',
      baseUnit: data.baseUnit || data.symbol.trim(),
      conversionFactorToBase: data.conversionFactorToBase || 1,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'units_of_measure', uomId), newUnit);
      } catch (e) {
        console.warn('Failed to save UOM in Firestore:', e);
      }
    }

    const current = await this.getUnitsOfMeasure(true);
    current.push(newUnit);
    safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(current));
    return newUnit;
  }

  static async updateUnitOfMeasure(
    unitId: string,
    updates: Partial<UnitOfMeasure>,
    isDemo: boolean = false
  ): Promise<UnitOfMeasure> {
    const list = await this.getUnitsOfMeasure(isDemo);
    const target = list.find((u) => u.id === unitId || u.unitId === unitId);
    if (!target) throw new Error('Unit not found');

    const now = new Date().toISOString();
    const updated = { ...target, ...updates, updatedAt: now };

    if (!isDemo) {
      try {
        await setDoc(doc(db, 'units_of_measure', unitId), updated, { merge: true });
      } catch (e) {
        console.warn('Failed to update UOM in Firestore:', e);
      }
    }

    const idx = list.findIndex((u) => u.id === unitId || u.unitId === unitId);
    if (idx >= 0) list[idx] = updated;
    safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(list));
    return updated;
  }

  /**
   * Audit Logs
   */
  static async recordAuditLog(log: ItemAuditLog, isDemo: boolean = false): Promise<void> {
    if (!isDemo) {
      try {
        await setDoc(doc(db, 'item_audit_logs', log.auditId), log);
      } catch (err) {
        console.warn('Failed to record item audit log:', err);
      }
    }
    const current = await this.getAuditLogs(undefined, true);
    current.unshift(log);
    safeSetStorage(AUDIT_STORAGE_KEY, JSON.stringify(current.slice(0, 200)));
  }

  static async getAuditLogs(itemId?: string, isDemo: boolean = false): Promise<ItemAuditLog[]> {
    if (!isDemo && itemId) {
      try {
        const q = query(
          collection(db, 'item_audit_logs'),
          where('itemId', '==', itemId),
          orderBy('changedAt', 'desc')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs.map((d) => d.data() as ItemAuditLog);
        }
      } catch (e) {
        console.warn('Firestore getAuditLogs error:', e);
      }
    }
    const stored = safeGetStorage(AUDIT_STORAGE_KEY);
    const list: ItemAuditLog[] = stored ? JSON.parse(stored) : [];
    if (itemId) {
      return list.filter((l) => l.itemId === itemId);
    }
    return list;
  }

  /**
   * Domain-specific query helpers
   */
  static async getChemicalItems(isDemo: boolean = false): Promise<MasterItem[]> {
    const { items } = await this.getItems({ itemType: 'chemical', status: 'active' }, { page: 1, pageSize: 500 }, isDemo);
    return items;
  }

  static async getFirewoodItems(isDemo: boolean = false): Promise<MasterItem[]> {
    const { items } = await this.getItems({ itemType: 'firewood', status: 'active' }, { page: 1, pageSize: 500 }, isDemo);
    return items;
  }

  static async getRawMaterialItems(isDemo: boolean = false): Promise<MasterItem[]> {
    const { items } = await this.getItems({ itemType: 'raw_material', status: 'active' }, { page: 1, pageSize: 500 }, isDemo);
    return items;
  }
}
