import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { CompanyInvoiceSettings } from '../types/invoice';

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
   * Retrieves company invoice settings from Firestore or LocalStorage
   */
  static async getSettings(isDemo: boolean = false): Promise<CompanyInvoiceSettings> {
    if (!isDemo) {
      try {
        const docRef = doc(db, 'invoice_settings', 'company_profile');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { ...DEFAULT_INVOICE_SETTINGS, ...(snap.data() as Partial<CompanyInvoiceSettings>) };
        }
      } catch (err) {
        console.warn('Failed to fetch invoice settings from Firestore, checking local storage:', err);
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
   * Updates company invoice settings
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
        const docRef = doc(db, 'invoice_settings', 'company_profile');
        await setDoc(docRef, merged, { merge: true });
      } catch (err) {
        console.warn('Failed to persist settings to Firestore:', err);
      }
    }

    return merged;
  }
}
