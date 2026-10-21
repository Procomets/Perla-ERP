import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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

export const DEFAULT_CATEGORIES: ItemCategoryRecord[] = [];
export const DEFAULT_UNITS: UnitOfMeasure[] = [];
export const INITIAL_ITEMS: MasterItem[] = [];

export const LEGACY_DUMMY_CATEGORY_IDS = [
  'cat_chemical',
  'cat_firewood',
  'cat_raw_material',
  'cat_packaging',
  'cat_consumables'
];

export const LEGACY_DUMMY_UNIT_IDS = [
  'uom_kg',
  'uom_g',
  'uom_litre',
  'uom_ml',
  'uom_tonne',
  'uom_piece',
  'uom_bag',
  'uom_drum'
];

export const LEGACY_DUMMY_ITEM_IDS = [
  'item-chm-01',
  'item-chm-02',
  'item-fwd-01',
  'item-raw-01'
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
          // Purge any legacy dummy items if present in Firestore
          const legacyDummies = list.filter((it) => LEGACY_DUMMY_ITEM_IDS.includes(it.id));
          if (legacyDummies.length > 0) {
            for (const d of legacyDummies) {
              deleteDoc(doc(db, 'items', d.id)).catch(() => {});
              deleteDoc(doc(db, 'chemical_details', d.id)).catch(() => {});
            }
            list = list.filter((it) => !LEGACY_DUMMY_ITEM_IDS.includes(it.id));
          }
          safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(list));
        } else {
          list = [];
          safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify([]));
        }
      } catch (err) {
        console.warn('Firestore getItems error, using local cache:', err);
        const cached = safeGetStorage(ITEMS_STORAGE_KEY);
        list = cached ? JSON.parse(cached) : [];
        list = list.filter((it) => !LEGACY_DUMMY_ITEM_IDS.includes(it.id));
      }
    } else {
      const cached = safeGetStorage(ITEMS_STORAGE_KEY);
      list = cached ? JSON.parse(cached) : [];
      list = list.filter((it) => !LEGACY_DUMMY_ITEM_IDS.includes(it.id));
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
          let list = snap.docs.map((d) => d.data() as ItemCategoryRecord);
          // Purge legacy dummy categories if present
          const dummies = list.filter((c) => LEGACY_DUMMY_CATEGORY_IDS.includes(c.id) || LEGACY_DUMMY_CATEGORY_IDS.includes(c.categoryId));
          if (dummies.length > 0) {
            for (const d of dummies) {
              deleteDoc(doc(db, 'item_categories', d.id || d.categoryId)).catch(() => {});
            }
            list = list.filter((c) => !LEGACY_DUMMY_CATEGORY_IDS.includes(c.id) && !LEGACY_DUMMY_CATEGORY_IDS.includes(c.categoryId));
          }
          safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(list));
          return list;
        } else {
          safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify([]));
          return [];
        }
      } catch (err) {
        console.warn('Firestore getCategories error:', err);
      }
    }
    const stored = safeGetStorage(CATEGORIES_STORAGE_KEY);
    const list: ItemCategoryRecord[] = stored ? JSON.parse(stored) : [];
    const filtered = list.filter((c) => !LEGACY_DUMMY_CATEGORY_IDS.includes(c.id) && !LEGACY_DUMMY_CATEGORY_IDS.includes(c.categoryId));
    if (filtered.length !== list.length) {
      safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
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

  static async deleteCategory(
    categoryId: string,
    isDemo: boolean = false
  ): Promise<void> {
    if (!isDemo) {
      try {
        await deleteDoc(doc(db, 'item_categories', categoryId));
      } catch (e) {
        console.warn('Failed to delete category in Firestore:', e);
      }
    }
    const current = await this.getCategories(true);
    const updated = current.filter((c) => c.id !== categoryId && c.categoryId !== categoryId);
    safeSetStorage(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  }

  /**
   * Units of Measure Management
   */
  static async getUnitsOfMeasure(isDemo: boolean = false): Promise<UnitOfMeasure[]> {
    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'units_of_measure'));
        if (!snap.empty) {
          let list = snap.docs.map((d) => d.data() as UnitOfMeasure);
          // Purge legacy dummy units if present
          const dummies = list.filter((u) => LEGACY_DUMMY_UNIT_IDS.includes(u.id) || LEGACY_DUMMY_UNIT_IDS.includes(u.unitId));
          if (dummies.length > 0) {
            for (const d of dummies) {
              deleteDoc(doc(db, 'units_of_measure', d.id || d.unitId)).catch(() => {});
            }
            list = list.filter((u) => !LEGACY_DUMMY_UNIT_IDS.includes(u.id) && !LEGACY_DUMMY_UNIT_IDS.includes(u.unitId));
          }
          safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(list));
          return list;
        } else {
          safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify([]));
          return [];
        }
      } catch (err) {
        console.warn('Firestore getUnitsOfMeasure error:', err);
      }
    }
    const stored = safeGetStorage(UNITS_STORAGE_KEY);
    const list: UnitOfMeasure[] = stored ? JSON.parse(stored) : [];
    const filtered = list.filter((u) => !LEGACY_DUMMY_UNIT_IDS.includes(u.id) && !LEGACY_DUMMY_UNIT_IDS.includes(u.unitId));
    if (filtered.length !== list.length) {
      safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
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

  static async deleteUnitOfMeasure(
    unitId: string,
    isDemo: boolean = false
  ): Promise<void> {
    if (!isDemo) {
      try {
        await deleteDoc(doc(db, 'units_of_measure', unitId));
      } catch (e) {
        console.warn('Failed to delete UOM from Firestore:', e);
      }
    }
    const current = await this.getUnitsOfMeasure(true);
    const updated = current.filter((u) => u.id !== unitId && u.unitId !== unitId);
    safeSetStorage(UNITS_STORAGE_KEY, JSON.stringify(updated));
  }

  static async deleteItem(
    itemId: string,
    isDemo: boolean = false
  ): Promise<void> {
    if (!isDemo) {
      try {
        await deleteDoc(doc(db, 'items', itemId));
        await deleteDoc(doc(db, 'chemical_details', itemId));
      } catch (e) {
        console.warn('Failed to delete item from Firestore:', e);
      }
    }
    const cached = safeGetStorage(ITEMS_STORAGE_KEY);
    const list: MasterItem[] = cached ? JSON.parse(cached) : [];
    const updated = list.filter((i) => i.id !== itemId && i.itemId !== itemId);
    safeSetStorage(ITEMS_STORAGE_KEY, JSON.stringify(updated));
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
