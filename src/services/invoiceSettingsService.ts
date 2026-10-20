import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CompanyInvoiceSettings } from '../types/invoice';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const TAX_SETTINGS_DOC_ID = 'tax_settings';
export const LEGACY_SETTINGS_COLLECTION = 'invoice_settings';
export const LEGACY_SETTINGS_DOC_ID = 'company_profile';

export const DEFAULT_INVOICE_SETTINGS: CompanyInvoiceSettings = {
  companyName: 'PERLA TEXTILES PROCESSOR',
  tagline: 'Specialized Garment Washing, Dyeing & Finishing Services',
  addressLine1: 'NO.107, INDUSTRIAL ESTATE',
  addressLine2: 'THIRUMUDIVAKKAM, SIDCO',
  city: 'CHENNAI',
  state: 'Tamil Nadu',
  stateCode: '33',
  pincode: '600044',
  tin: '33916280923',
  cst: '1299271/02-01-2015',
  gstin: '33AMMPK2032Q1ZU',
  pan: 'AMMPK2032Q',
  phone: '044-24781234',
  email: 'billing@perlatextiles.com',
  bankName: 'STATE BANK OF INDIA',
  bankBranch: 'SIDCO Thirumudivakkam, Chennai',
  accountName: 'PERLA TEXTILES PROCESSOR',
  accountNumber: '30407742234',
  ifscCode: 'SBIN0012931',
  upiId: 'perlatextiles@sbi',
  defaultCgstRate: 2.5,
  defaultSgstRate: 2.5,
  defaultIgstRate: 5.0,
  defaultHsnSacCode: '998821',
  declaration:
    'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
  termsAndConditions: [
    'Mode/Terms of Payment: 30 Days Credit',
    'Disputes, if any, subject to Chennai jurisdiction only.'
  ],
  signatoryName: 'Authorised Signatory',
  signatoryDesignation: 'Authorised Signatory'
};

const SETTINGS_STORAGE_KEY = 'perla_invoice_settings';

export class InvoiceSettingsService {
  /**
   * Reference to the primary Firestore document under generalSettings collection
   */
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, TAX_SETTINGS_DOC_ID);
  }

  /**
   * Reference to legacy Firestore document (for migration fallback)
   */
  private static getLegacyDocRef() {
    return doc(db, LEGACY_SETTINGS_COLLECTION, LEGACY_SETTINGS_DOC_ID);
  }

  /**
   * Retrieves company invoice & tax settings from Firestore (generalSettings -> tax_settings)
   * or LocalStorage / defaults
   */
  static async getSettings(isDemo: boolean = false): Promise<CompanyInvoiceSettings> {
    if (!isDemo) {
      try {
        // 1. Primary source: generalSettings -> tax_settings
        const docRef = this.getDocRef();
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<CompanyInvoiceSettings>;
          const merged = { ...DEFAULT_INVOICE_SETTINGS, ...data };
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore localStorage quota errors
          }
          return merged;
        }

        // 2. Fallback / Migration: check legacy invoice_settings -> company_profile
        const legacyRef = this.getLegacyDocRef();
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          const legacyData = legacySnap.data() as Partial<CompanyInvoiceSettings>;
          const merged = { ...DEFAULT_INVOICE_SETTINGS, ...legacyData };
          // Migrate into generalSettings -> tax_settings for next time
          setDoc(docRef, merged, { merge: true }).catch((err) =>
            console.warn('Auto-migration to generalSettings failed:', err)
          );
          try {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        }
      } catch (err) {
        console.warn('Failed to fetch tax & invoice settings from Firestore generalSettings, checking local storage:', err);
      }
    }

    try {
      const local = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (local) {
        return { ...DEFAULT_INVOICE_SETTINGS, ...JSON.parse(local) };
      }
    } catch (e) {
      console.warn('Failed to parse local invoice settings:', e);
    }

    return DEFAULT_INVOICE_SETTINGS;
  }

  /**
   * Updates company invoice & tax settings in Firestore (generalSettings -> tax_settings)
   */
  static async updateSettings(
    updatedSettings: Partial<CompanyInvoiceSettings>,
    isDemo: boolean = false
  ): Promise<CompanyInvoiceSettings> {
    const current = await this.getSettings(isDemo);
    const merged: CompanyInvoiceSettings = { ...current, ...updatedSettings };

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }

    if (!isDemo) {
      try {
        // Primary persistence: generalSettings collection -> tax_settings document
        await setDoc(this.getDocRef(), merged, { merge: true });
        
        // Secondary mirror: keep legacy document updated in parallel
        await setDoc(this.getLegacyDocRef(), merged, { merge: true }).catch(() => {});
      } catch (err) {
        console.warn('Failed to persist settings to Firestore generalSettings:', err);
      }
    }

    return merged;
  }

  /**
   * Realtime subscription to generalSettings -> tax_settings document
   */
  static subscribeSettings(
    onUpdate: (settings: CompanyInvoiceSettings) => void,
    onError?: (error: any) => void
  ): () => void {
    const docRef = this.getDocRef();
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<CompanyInvoiceSettings>;
          onUpdate({ ...DEFAULT_INVOICE_SETTINGS, ...data });
        } else {
          onUpdate(DEFAULT_INVOICE_SETTINGS);
        }
      },
      (error) => {
        console.warn('Firestore subscription error on generalSettings tax_settings:', error);
        if (onError) onError(error);
      }
    );
  }
}

