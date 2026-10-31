import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ItemCategoryMasterItem } from '../types/categoryMaster';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const ITEM_CATEGORY_MASTER_DOC_ID = 'item_category_master';
const STORAGE_KEY = 'perla_item_category_master';

/**
 * Generates an ID matching the format: cat_<13-digit-timestamp>_<8-char-hex>
 * Example: cat_1791901486147_3e63ea0e
 */
export const generateCategoryId = (): string => {
  const timestamp = Date.now();
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `cat_${timestamp}_${randomHex}`;
};

export const DEFAULT_INITIAL_ITEM_CATEGORIES = [
  {
    name: 'Textile Processing Chemicals',
    code: 'CHM',
    description: 'Processing chemicals, scouring agents, softeners, enzymes & auxiliaries'
  },
  {
    name: 'Raw Wood / Boiler Fuel',
    code: 'RWD',
    description: 'Casuarina, eucalyptus & boiler firewood fuel'
  },
  {
    name: 'Packaging Materials',
    code: 'PKG',
    description: 'Polybags, cartons, tapes & packaging supplies'
  },
  {
    name: 'Maintenance & Machine Spares',
    code: 'MNT',
    description: 'Machine spare parts, lubricants, belts & maintenance components'
  },
  {
    name: 'General Consumables',
    code: 'GEN',
    description: 'General factory and operational consumables'
  }
];

export class ItemCategoryMasterService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, ITEM_CATEGORY_MASTER_DOC_ID);
  }

  private static buildDefaultCategories(): ItemCategoryMasterItem[] {
    return DEFAULT_INITIAL_ITEM_CATEGORIES.map((cat) => {
      const id = generateCategoryId();
      return {
        id,
        categoryId: id,
        name: cat.name,
        categoryName: cat.name,
        categoryCode: cat.code,
        normalizedName: cat.name.trim().toLowerCase(),
        description: cat.description,
        isActive: true,
        status: 'active',
        createdAt: Timestamp.now(),
        createdBy: 'system'
      };
    });
  }

  /**
   * Fetch all item categories from generalSettings -> item_category_master
   */
  static async getCategories(): Promise<ItemCategoryMasterItem[]> {
    try {
      const docSnap = await getDoc(this.getDocRef());
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawCategories = Array.isArray(data?.categories) ? data.categories : [];
        if (rawCategories.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rawCategories));
          } catch {}
          return rawCategories;
        }
      }

      // Initialize with industry defaults if document doesn't exist or is empty
      const defaultItems = this.buildDefaultCategories();

      try {
        await setDoc(this.getDocRef(), { categories: defaultItems }, { merge: true });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems));
      } catch (writeErr) {
        console.warn('Could not auto-seed item_category_master, using localStorage or memory:', writeErr);
      }

      return defaultItems;
    } catch (error) {
      console.warn('Error fetching item category master from Firestore, falling back to cache:', error);
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) return JSON.parse(cached);
      } catch {}
      return this.buildDefaultCategories();
    }
  }

  /**
   * Listen to real-time changes to the item_category_master document
   */
  static subscribeCategories(
    callback: (categories: ItemCategoryMasterItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return onSnapshot(
      this.getDocRef(),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const categories = Array.isArray(data?.categories) ? data.categories : [];
          if (categories.length > 0) {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
            } catch {}
            callback(categories);
            return;
          }
        }

        // Auto-seed defaults if not present
        const defaultItems = this.buildDefaultCategories();
        setDoc(this.getDocRef(), { categories: defaultItems }, { merge: true }).catch(() => {});
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems));
        } catch {}
        callback(defaultItems);
      },
      (error) => {
        console.error('Item category master subscription error:', error);
        if (onError) onError(error);
        // Fallback to cache on error
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) callback(JSON.parse(cached));
        } catch {}
      }
    );
  }

  /**
   * Add a new category to item_category_master
   */
  static async addCategory(
    categoryName: string,
    categoryCode: string,
    description: string | undefined,
    userId: string
  ): Promise<ItemCategoryMasterItem> {
    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      throw new Error('Category name cannot be empty.');
    }

    const trimmedCode = (categoryCode || trimmedName.slice(0, 3)).trim().toUpperCase();
    const normalized = trimmedName.toLowerCase();
    const existing = await this.getCategories();

    const isDuplicate = existing.some(
      (c) =>
        c.normalizedName === normalized ||
        c.categoryName?.toLowerCase() === normalized ||
        c.name?.toLowerCase() === normalized
    );

    if (isDuplicate) {
      throw new Error(`Category "${trimmedName}" already exists in Category Master.`);
    }

    const catId = generateCategoryId();
    const newItem: ItemCategoryMasterItem = {
      id: catId,
      categoryId: catId,
      name: trimmedName,
      categoryName: trimmedName,
      categoryCode: trimmedCode,
      normalizedName: normalized,
      description: description?.trim() || undefined,
      isActive: true,
      status: 'active',
      createdAt: Timestamp.now(),
      createdBy: userId || 'system'
    };

    const updatedList = [...existing, newItem];

    await setDoc(
      this.getDocRef(),
      { categories: updatedList },
      { merge: true }
    );

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}

    return newItem;
  }

  /**
   * Update an existing category
   */
  static async updateCategory(
    id: string,
    updates: {
      categoryName?: string;
      categoryCode?: string;
      description?: string;
      isActive?: boolean;
    },
    userId: string
  ): Promise<void> {
    const existing = await this.getCategories();
    const index = existing.findIndex((c) => c.id === id || c.categoryId === id);

    if (index === -1) {
      throw new Error(`Category with ID "${id}" not found.`);
    }

    let updatedName = existing[index].categoryName || existing[index].name;
    let updatedCode = existing[index].categoryCode;
    let updatedNormalized = existing[index].normalizedName;

    if (updates.categoryName !== undefined) {
      const trimmedName = updates.categoryName.trim();
      if (!trimmedName) {
        throw new Error('Category name cannot be empty.');
      }
      const normalized = trimmedName.toLowerCase();

      // Check duplicate
      const isDuplicate = existing.some(
        (c) =>
          (c.id !== id && c.categoryId !== id) &&
          (c.normalizedName === normalized ||
            c.categoryName?.toLowerCase() === normalized ||
            c.name?.toLowerCase() === normalized)
      );
      if (isDuplicate) {
        throw new Error(`Category "${trimmedName}" already exists.`);
      }

      updatedName = trimmedName;
      updatedNormalized = normalized;
    }

    if (updates.categoryCode !== undefined) {
      updatedCode = updates.categoryCode.trim().toUpperCase() || updatedName.slice(0, 3).toUpperCase();
    }

    const nextIsActive = updates.isActive !== undefined ? updates.isActive : existing[index].isActive;

    const updatedItem: ItemCategoryMasterItem = {
      ...existing[index],
      name: updatedName,
      categoryName: updatedName,
      categoryCode: updatedCode,
      normalizedName: updatedNormalized,
      description: updates.description !== undefined ? updates.description.trim() || undefined : existing[index].description,
      isActive: nextIsActive,
      status: nextIsActive ? 'active' : 'inactive',
      updatedAt: Timestamp.now(),
      updatedBy: userId || 'system'
    };

    const updatedList = [...existing];
    updatedList[index] = updatedItem;

    await setDoc(
      this.getDocRef(),
      { categories: updatedList },
      { merge: true }
    );

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch {}
  }

  /**
   * Delete a category from item_category_master
   */
  static async deleteCategory(id: string): Promise<void> {
    const existing = await this.getCategories();
    const filtered = existing.filter((c) => c.id !== id && c.categoryId !== id);

    await setDoc(
      this.getDocRef(),
      { categories: filtered },
      { merge: true }
    );

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch {}
  }
}
