/**
 * Sample PO Inward Types & Interfaces
 * Matches Firestore collection: `sample_po_inwards`
 */

export interface SamplePoItem {
  id: string; // e.g. "[#2ba25]"
  itemName: string; // e.g. "plain clothes"
  styleNo: string; // e.g. "DRS 02"
  washType: string; // e.g. "Optical White Wash"
  quantity: number; // e.g. 68
  unit: string; // e.g. "PCS"
  customerDcNumber: string; // e.g. "504"
  customerDcDate: string; // e.g. "2026-11-22"
  dispatchedQuantity: number; // e.g. 0
}

export type SamplePoDispatchStatus = 'pending' | 'partial' | 'completed';
export type SamplePoStatus = 'active' | 'cancelled';

export interface SamplePoInward {
  id: string; // Firestore document ID
  entryNumber: string; // e.g. "SMP-INW-2026-0005"
  customerDcNumber: string; // e.g. "504"
  customerDcDate: string; // e.g. "2026-11-22"
  vendorId: string; // e.g. "ivqeteuSprtIiTfU1i6Z"
  vendorName: string; // e.g. "A.I.ENTERPRISES PVT LTD (KATTUPAKKAM)"
  vendorAddress?: string;
  vendorGst?: string;
  isManualVendor: boolean;
  dispatchStatus: SamplePoDispatchStatus | string;
  status: SamplePoStatus | string;
  items: SamplePoItem[];
  totalQuantity: number;
  totalDispatchedQuantity: number;
  remarks?: string;
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export interface SamplePoFilterOptions {
  searchQuery?: string;
  searchColumn?: string;
  vendorId?: string;
  dispatchStatus?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Sample PO Outward Item
 * Represents an individual dispatched item line in a Sample Outward
 */
export interface SamplePoOutwardItem {
  id: string; // e.g. "[#9b233]"
  inwardItemId?: string; // e.g. "[#24baf]"
  itemName: string; // e.g. "Shirt"
  styleNo: string; // e.g. "121"
  washType: string; // e.g. "MID WASH"
  quantity: number; // Dispatched quantity e.g. 22
  unit: string; // e.g. "PCS"
  rate: number; // default 0
  amount: number; // default 0
  customerDcNumber: string; // e.g. "3445"
  customerDcDate: string; // e.g. "2026-11-24"
  outwardDcNumber: string; // e.g. "246"
  outwardDcDate: string; // e.g. "2026-11-25"
}

/**
 * Sample PO Outward Dispatch Document
 * Matches Firestore collection: `sample_po_outwards`
 */
export interface SamplePoOutward {
  id: string; // Firestore document ID e.g. "8c9FbVlEAUCbnidtgWhR"
  entryNumber: string; // e.g. "SMP-DSP-2026-0005"
  inwardId: string; // e.g. "0yQCaOgqeRDQHvrTHxzt"
  inwardEntryNumber: string; // e.g. "SMP-INW-2026-0006"
  vendorId: string; // e.g. "RUurFR28Gf5cMQzF7OLQ"
  vendorName: string; // e.g. "A A GARMENTS"
  vendorAddress?: string;
  vendorGst?: string;
  isManualVendor: boolean;
  customerDcNumber: string; // e.g. "3445"
  customerDcDate: string; // e.g. "2026-11-24"
  outwardDcNumber: string; // e.g. "246"
  outwardDcDate: string; // e.g. "2026-11-25"
  remarks?: string;
  status: 'active' | 'cancelled' | string;
  totalQuantity: number;
  totalAmount: number;
  items: SamplePoOutwardItem[];
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}

export interface CreateSampleOutwardPayload {
  inwardId: string;
  inwardEntryNumber: string;
  vendorId: string;
  vendorName: string;
  vendorAddress?: string;
  vendorGst?: string;
  isManualVendor?: boolean;
  customerDcNumber: string;
  customerDcDate: string;
  outwardDcNumber: string;
  outwardDcDate: string;
  remarks?: string;
  items: {
    inwardItemId?: string;
    itemName: string;
    styleNo: string;
    washType: string;
    quantity: number;
    unit: string;
    rate?: number;
    amount?: number;
    customerDcNumber?: string;
    customerDcDate?: string;
  }[];
}
