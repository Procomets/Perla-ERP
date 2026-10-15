import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ColourItem } from '../types/colourMaster';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const COLOUR_MASTER_DOC_ID = 'colour_master';

/**
 * Generates an ID matching the format: col_<13-digit-timestamp>_<8-char-hex>
 * Example: col_1791901486147_3e63ea0e
 */
export const generateColourId = (): string => {
  const timestamp = Date.now();
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `col_${timestamp}_${randomHex}`;
};

export class ColourMasterService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, COLOUR_MASTER_DOC_ID);
  }

  /**
   * Fetch all colours from generalSettings -> colour_master
   */
  static async getColours(): Promise<ColourItem[]> {
    try {
      const docSnap = await getDoc(this.getDocRef());
      if (docSnap.exists()) {
        const data = docSnap.data();
        const colours = Array.isArray(data?.colours) ? data.colours : [];
        return colours;
      }
      return [];
    } catch (error) {
      console.error('Error fetching colour master:', error);
      throw error;
    }
  }

  /**
   * Listen to real-time changes to the colour_master document
   */
  static subscribeColours(
    callback: (colours: ColourItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return onSnapshot(
      this.getDocRef(),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const colours = Array.isArray(data?.colours) ? data.colours : [];
          callback(colours);
        } else {
          callback([]);
        }
      },
      (error) => {
        console.error('Colour master subscription error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Add a new colour to colour_master
   */
  static async addColour(name: string, userId: string): Promise<ColourItem> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Colour name cannot be empty.');
    }

    const normalized = trimmed.toLowerCase();
    const existingColours = await this.getColours();

    const isDuplicate = existingColours.some(
      (c) => c.normalizedName === normalized || c.name.toLowerCase() === normalized
    );

    if (isDuplicate) {
      throw new Error(`Colour "${trimmed}" already exists in Colour Master.`);
    }

    const newItem: ColourItem = {
      id: generateColourId(),
      name: trimmed,
      normalizedName: normalized,
      isActive: true,
      createdAt: Timestamp.now(),
      createdBy: userId || 'system'
    };

    const updatedList = [...existingColours, newItem];

    await setDoc(
      this.getDocRef(),
      { colours: updatedList },
      { merge: true }
    );

    return newItem;
  }

  /**
   * Update an existing colour's name or active status
   */
  static async updateColour(
    id: string,
    updates: { name?: string; isActive?: boolean },
    userId: string
  ): Promise<void> {
    const existingColours = await this.getColours();
    const index = existingColours.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Colour with ID "${id}" not found.`);
    }

    let updatedName = existingColours[index].name;
    let updatedNormalized = existingColours[index].normalizedName;

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Colour name cannot be empty.');
      }
      const normalized = trimmed.toLowerCase();

      // Check if duplicate of another item
      const isDuplicate = existingColours.some(
        (c) => c.id !== id && (c.normalizedName === normalized || c.name.toLowerCase() === normalized)
      );
      if (isDuplicate) {
        throw new Error(`Colour "${trimmed}" already exists.`);
      }

      updatedName = trimmed;
      updatedNormalized = normalized;
    }

    const updatedItem: ColourItem = {
      ...existingColours[index],
      name: updatedName,
      normalizedName: updatedNormalized,
      isActive: updates.isActive !== undefined ? updates.isActive : existingColours[index].isActive,
      updatedAt: Timestamp.now(),
      updatedBy: userId || 'system'
    };

    const updatedList = [...existingColours];
    updatedList[index] = updatedItem;

    await setDoc(
      this.getDocRef(),
      { colours: updatedList },
      { merge: true }
    );
  }

  /**
   * Delete a colour from colour_master
   */
  static async deleteColour(id: string): Promise<void> {
    const existingColours = await this.getColours();
    const filtered = existingColours.filter((c) => c.id !== id);

    await setDoc(
      this.getDocRef(),
      { colours: filtered },
      { merge: true }
    );
  }
}
