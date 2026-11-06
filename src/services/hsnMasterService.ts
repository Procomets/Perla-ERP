import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { HsnItem } from '../types/hsnMaster';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const HSN_MASTER_DOC_ID = 'hsn_master';
const HSN_STORAGE_KEY = 'perla_hsn_master_cache';

const DEFAULT_HSN_SEEDS: HsnItem[] = [
  {
    id: 'hsn_seed_998821',
    hsnNo: '998821',
    description: 'Textiles, apparel and leather goods dyeing and finishing services',
    isActive: true,
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'hsn_seed_6203',
    hsnNo: '6203',
    description: "Men's or boys' suits, ensembles, jackets, blazers, trousers",
    isActive: true,
    createdAt: { seconds: 1700000001, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'hsn_seed_9988',
    hsnNo: '9988',
    description: 'Manufacturing services on physical inputs (goods) owned by others',
    isActive: true,
    createdAt: { seconds: 1700000002, nanoseconds: 0 },
    createdBy: 'system'
  }
];

export const generateHsnId = (): string => {
  const timestamp = Date.now();
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `hsn_${timestamp}_${randomHex}`;
};

function getLocalHsnCache(): HsnItem[] {
  try {
    const raw = localStorage.getItem(HSN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to read HSN local cache:', e);
  }
  return DEFAULT_HSN_SEEDS;
}

function saveLocalHsnCache(items: HsnItem[]): void {
  try {
    localStorage.setItem(HSN_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Failed to save HSN local cache:', e);
  }
}

export class HsnMasterService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, HSN_MASTER_DOC_ID);
  }

  /**
   * Fetch all HSN items from generalSettings -> hsn_master
   */
  static async getHsnItems(): Promise<HsnItem[]> {
    try {
      const docSnap = await getDoc(this.getDocRef());
      if (docSnap.exists()) {
        const data = docSnap.data();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (items.length > 0) {
          saveLocalHsnCache(items);
          return items;
        }
      }
      // If doc does not exist yet, seed with defaults
      const seeded = DEFAULT_HSN_SEEDS;
      try {
        await setDoc(this.getDocRef(), { items: seeded }, { merge: true });
      } catch (err) {
        console.warn('Could not auto-seed HSN master in Firestore:', err);
      }
      saveLocalHsnCache(seeded);
      return seeded;
    } catch (error) {
      console.warn('Error fetching HSN master, falling back to local cache:', error);
      return getLocalHsnCache();
    }
  }

  /**
   * Listen to real-time changes to the hsn_master document
   */
  static subscribeHsnItems(
    callback: (items: HsnItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    // Deliver local cache first for instant UI response
    const cached = getLocalHsnCache();
    if (cached.length > 0) {
      callback(cached);
    }

    return onSnapshot(
      this.getDocRef(),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const items = Array.isArray(data?.items) ? data.items : [];
          if (items.length > 0) {
            saveLocalHsnCache(items);
            callback(items);
            return;
          }
        }
        // If snapshot is empty, seed defaults
        callback(DEFAULT_HSN_SEEDS);
      },
      (error) => {
        console.warn('HSN master subscription error, keeping cached data:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Add a new HSN item to hsn_master
   * Two main fields: description, hsnNo
   */
  static async addHsnItem(
    hsnNo: string,
    description: string,
    userId: string = 'system'
  ): Promise<HsnItem> {
    const trimmedHsn = hsnNo.trim();
    const trimmedDesc = description.trim();

    if (!trimmedHsn) {
      throw new Error('HSN No. cannot be empty.');
    }
    if (!trimmedDesc) {
      throw new Error('Description cannot be empty.');
    }

    const existingItems = await this.getHsnItems();

    // Check duplicate by HSN No.
    const isDuplicate = existingItems.some(
      (h) => h.hsnNo.toLowerCase() === trimmedHsn.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error(`HSN No. "${trimmedHsn}" already exists in HSN Master.`);
    }

    const newItem: HsnItem = {
      id: generateHsnId(),
      hsnNo: trimmedHsn,
      description: trimmedDesc,
      isActive: true,
      createdAt: Timestamp.now(),
      createdBy: userId || 'system'
    };

    const updatedList = [...existingItems, newItem];
    saveLocalHsnCache(updatedList);

    try {
      await setDoc(this.getDocRef(), { items: updatedList }, { merge: true });
    } catch (err) {
      console.warn('Error setting Firestore HSN master, stored locally:', err);
    }

    return newItem;
  }

  /**
   * Update an existing HSN item
   */
  static async updateHsnItem(
    id: string,
    updates: { hsnNo?: string; description?: string; isActive?: boolean },
    userId: string = 'system'
  ): Promise<void> {
    const existingItems = await this.getHsnItems();
    const index = existingItems.findIndex((h) => h.id === id);

    if (index === -1) {
      throw new Error(`HSN item with ID "${id}" not found.`);
    }

    let updatedHsn = existingItems[index].hsnNo;
    let updatedDesc = existingItems[index].description;

    if (updates.hsnNo !== undefined) {
      const trimmed = updates.hsnNo.trim();
      if (!trimmed) throw new Error('HSN No. cannot be empty.');
      const isDuplicate = existingItems.some(
        (h) => h.id !== id && h.hsnNo.toLowerCase() === trimmed.toLowerCase()
      );
      if (isDuplicate) throw new Error(`HSN No. "${trimmed}" already exists.`);
      updatedHsn = trimmed;
    }

    if (updates.description !== undefined) {
      const trimmed = updates.description.trim();
      if (!trimmed) throw new Error('Description cannot be empty.');
      updatedDesc = trimmed;
    }

    const updatedItem: HsnItem = {
      ...existingItems[index],
      hsnNo: updatedHsn,
      description: updatedDesc,
      isActive: updates.isActive !== undefined ? updates.isActive : existingItems[index].isActive,
      updatedAt: Timestamp.now(),
      updatedBy: userId || 'system'
    };

    const updatedList = [...existingItems];
    updatedList[index] = updatedItem;
    saveLocalHsnCache(updatedList);

    try {
      await setDoc(this.getDocRef(), { items: updatedList }, { merge: true });
    } catch (err) {
      console.warn('Error updating Firestore HSN master, saved locally:', err);
    }
  }

  /**
   * Delete an HSN item from hsn_master
   */
  static async deleteHsnItem(id: string): Promise<void> {
    const existingItems = await this.getHsnItems();
    const filtered = existingItems.filter((h) => h.id !== id);
    saveLocalHsnCache(filtered);

    try {
      await setDoc(this.getDocRef(), { items: filtered }, { merge: true });
    } catch (err) {
      console.warn('Error deleting from Firestore HSN master, updated locally:', err);
    }
  }
}

