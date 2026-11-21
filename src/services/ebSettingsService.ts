import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { EBSettings } from '../types/ebMonitoring';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const EB_SETTINGS_DOC_ID = 'eb_settings';
export const EB_SETTINGS_STORAGE_KEY = 'perla_eb_settings_cache_v1';
export const EB_SETTINGS_EVENT = 'perla_eb_settings_updated';

export const DEFAULT_EB_SETTINGS: EBSettings = {
  unitPrice: 9.5, // Default ₹9.50 per kW
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  updatedByName: 'System Default'
};

function normalizeTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {}
  }
  if (typeof val === 'object' && val !== null) {
    const sec = typeof val.seconds === 'number'
      ? val.seconds
      : (typeof val._seconds === 'number'
        ? val._seconds
        : (val.seconds ? Number(val.seconds) : null));
    if (sec !== null && !isNaN(sec)) {
      return new Date(sec * 1000).toISOString();
    }
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
}

export class EBSettingsService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, EB_SETTINGS_DOC_ID);
  }

  /**
   * Read cache synchronously from localStorage
   */
  static getCache(): EBSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(EB_SETTINGS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.unitPrice === 'number' && !isNaN(parsed.unitPrice)) {
            return {
              unitPrice: Number(parsed.unitPrice),
              updatedAt: normalizeTimestamp(parsed.updatedAt),
              updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : 'admin',
              updatedByName: typeof parsed.updatedByName === 'string' ? parsed.updatedByName : 'Admin'
            };
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read EB settings cache', e);
    }
    return DEFAULT_EB_SETTINGS;
  }

  /**
   * Save cache to localStorage and dispatch local event
   */
  static setCache(settings: EBSettings): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(EB_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        window.dispatchEvent(new CustomEvent(EB_SETTINGS_EVENT, { detail: settings }));
      }
    } catch (e) {
      console.warn('Failed to write EB settings cache', e);
    }
  }

  /**
   * Get settings from Firestore or cache fallback
   */
  static async getSettings(isDemo: boolean = false): Promise<EBSettings> {
    const cached = this.getCache();
    if (isDemo) return cached;

    try {
      const snap = await getDoc(this.getDocRef());
      if (snap.exists()) {
        const data = snap.data();
        const settings: EBSettings = {
          unitPrice: Number(data.unitPrice ?? cached.unitPrice ?? 9.5),
          updatedAt: normalizeTimestamp(data.updatedAt),
          updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'admin',
          updatedByName: typeof data.updatedByName === 'string' ? data.updatedByName : 'Administrator'
        };
        this.setCache(settings);
        return settings;
      } else {
        // Document doesn't exist yet, write default to initialize
        try {
          await setDoc(this.getDocRef(), cached, { merge: true });
        } catch {
          // ignore if offline
        }
        return cached;
      }
    } catch (err) {
      console.warn('Failed to fetch EB settings from Firestore, using cache:', err);
      return cached;
    }
  }

  /**
   * Update electricity unit price in General Settings (Admin Only)
   */
  static async updateSettings(
    unitPrice: number,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<EBSettings> {
    const sanitizedPrice = Math.round(Number(unitPrice) * 100) / 100;
    if (isNaN(sanitizedPrice) || sanitizedPrice < 0) {
      throw new Error('Please enter a valid unit price greater than or equal to 0.');
    }

    const now = new Date().toISOString();
    const updatedSettings: EBSettings = {
      unitPrice: sanitizedPrice,
      updatedAt: now,
      updatedBy: user.uid || 'admin',
      updatedByName: user.displayName || user.email || 'Admin'
    };

    // Update local cache immediately
    this.setCache(updatedSettings);

    // Save to Firestore
    try {
      await setDoc(this.getDocRef(), updatedSettings, { merge: true });
    } catch (err) {
      console.warn('Failed to update EB settings in Firestore, cached locally:', err);
    }

    return updatedSettings;
  }

  /**
   * Real-time subscription to EB settings
   */
  static subscribeSettings(
    callback: (settings: EBSettings) => void,
    onError?: (error: any) => void
  ): () => void {
    // Deliver initial cached value right away
    callback(this.getCache());

    // Listen to local window events
    const handleLocalEvent = (e: any) => {
      if (e?.detail) {
        callback(e.detail as EBSettings);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(EB_SETTINGS_EVENT, handleLocalEvent);
    }

    // Subscribe to Firestore document
    let unsubscribeFirestore = () => {};
    try {
      unsubscribeFirestore = onSnapshot(
        this.getDocRef(),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const settings: EBSettings = {
              unitPrice: Number(data.unitPrice ?? 9.5),
              updatedAt: normalizeTimestamp(data.updatedAt),
              updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'admin',
              updatedByName: typeof data.updatedByName === 'string' ? data.updatedByName : 'Admin'
            };
            this.setCache(settings);
            callback(settings);
          } else {
            // Document doesn't exist yet in Firestore: serve cache/default and initialize
            const fallback = this.getCache();
            callback(fallback);
            setDoc(this.getDocRef(), fallback, { merge: true }).catch(() => {});
          }
        },
        (err) => {
          if (onError) onError(err);
        }
      );
    } catch (e) {
      if (onError) onError(e);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(EB_SETTINGS_EVENT, handleLocalEvent);
      }
      unsubscribeFirestore();
    };
  }
}
