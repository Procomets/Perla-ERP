/**
 * Sample Invoice Types & Interfaces
 * Matches Firestore collection: `sample_invoices`
 * Mirrors the official Perla Textiles Processor Sample Invoice template
 */

export interface SampleInvoiceItem {
  id: string;
  outwardId: string;
  outwardEntryNumber: string;
  inwardId: string;
  inwardEntryNumber: string;
  inwardItemId: string;
  custDcDate: string;
  custDcNo: string;
  styleNo: string;
  itemName: string;
  washType: string;
  inwQty: number;
  unit: string;
  outDcDate: string;
  outDcNo: string;
  qty: number; // Outward / Billed Qty
  rate: number;
  amount: number;
}

export type SampleInvoiceGstMode = 'cgst_sgst' | 'igst' | 'without_gst';

export interface SampleInvoice {
  id: string;
  invoiceNo: string; // e.g. "2025-26/S-1184"
  invoiceDate: string; // YYYY-MM-DD
  hsnSacCode: string; // e.g. "998821"
  vendorId: string;
  vendorName: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorGst?: string;
  items: SampleInvoiceItem[];
  totalInwQty: number;
  totalOutQty: number;
  subtotal: number;
  discount: number;
  gstMode: SampleInvoiceGstMode;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  forwarding: number;
  roundOff: number;
  totalAmount: number;
  amountInWords: string;
  status: 'active' | 'cancelled' | string;
  cancelReason?: string;
  createdAt?: any;
  createdBy?: string;
  createdByName?: string;
  updatedAt?: any;
  updatedBy?: string;
  updatedByName?: string;
}
