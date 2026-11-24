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
