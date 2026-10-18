import { UnitType } from './po';

export type InvoiceStatus = 'draft' | 'finalized' | 'cancelled' | 'Draft' | 'Finalized' | 'Cancelled';
export type RateBasis = 'per_piece' | 'per_kg';

export interface CustomerBillingSnapshot {
  companyName: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  gstin: string;
  pan?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

export interface BankDetailsSnapshot {
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branch: string;
  upiId?: string;
}

export interface CompanyIssuerSnapshot {
  companyName: string;
  tagline?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  tin?: string;
  cst?: string;
  gstin: string;
  pan?: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export interface InvoiceLine {
  lineId: string;
  invoiceLineId?: string;
  sourcePoLineId: string;
  purchaseOrderId?: string;
  poNumber?: string;
  statementApprovalId?: string;
  styleNoSnapshot?: string;
  itemNameSnapshot?: string;
  colourSnapshot?: string;
  processCategorySnapshot?: string;
  washTypeSnapshot?: string;
  description: string; // e.g. Textile processing – Softener Wash – Style OB2375221 – Colour Blue
  hsnSac: string;
  colour: string;
  process: string;
  qty: number;
  quantity?: number;
  unit: UnitType | string;
  rateBasis: RateBasis;
  rate: number;
  billableWeightKg?: number;
  amount: number; // taxable amount
  taxableAmount?: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  lineTotal?: number;
}

export interface Invoice {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  invoiceNumber?: string;
  financialYear: string; // e.g. "2026-27"
  invoiceDate: string;
  poNumber: string;
  poNumbers?: string[];
  purchaseOrderIds?: string[];
  styleNo: string;
  styleNumbers?: string[];
  customerId: string;
  companyId?: string;
  customerSnapshot: CustomerBillingSnapshot;
  issuerSnapshot?: CompanyIssuerSnapshot;
  lines: InvoiceLine[];
  currency: 'INR' | string;
  subtotal: number;
  taxableAmount?: number;
  discountAmount?: number;
  cgstRate?: number;
  totalCgst: number;
  sgstRate?: number;
  totalSgst: number;
  igstRate?: number;
  totalIgst: number;
  otherCharges?: number;
  roundOff: number;
  finalTotal: number;
  grandTotal?: number;
  amountInWords: string;
  bankDetailsSnapshot?: BankDetailsSnapshot;
  declarationSnapshot?: string;
  termsAndConditions?: string[];
  status: InvoiceStatus;
  pdfPath?: string;
  pdfStoragePath?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  updatedAt?: string;
  finalizedBy?: string;
  finalizedByName?: string;
  finalizedAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface InvoiceEligibleItem {
  approvalId: string;
  poLineId: string;
  companyId: string;
  companyName: string;
  poId: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  colour: string;
  processCategory: string;
  washType: string;
  approvedQuantity: number;
  previouslyInvoicedQty: number;
  remainingApprovedQty: number;
  unit: string;
  rate: number;
  rateBasis: RateBasis;
  billableWeightKg?: number;
  estimatedTaxableAmount: number;
  approvedAt: string;
  approvedByName?: string;
  approvalStatus: string;
}

export interface InvoiceFilterOptions {
  searchQuery?: string;
  invoiceNo?: string;
  companyId?: string;
  poNumber?: string;
  styleNo?: string;
  status?: 'all' | 'draft' | 'finalized' | 'cancelled';
  startDate?: string;
  endDate?: string;
}

export interface InvoiceMetrics {
  totalInvoices: number;
  totalInvoiceValue: number;
  totalTaxableValue: number;
  totalGstCollected: number;
  draftCount: number;
  finalizedCount: number;
  cancelledCount: number;
}

export interface CompanyInvoiceSettings {
  companyName: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  tin?: string;
  cst?: string;
  gstin: string;
  pan?: string;
  phone: string;
  email: string;
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  defaultCgstRate: number;
  defaultSgstRate: number;
  defaultIgstRate: number;
  defaultHsnSacCode: string;
  declaration: string;
  termsAndConditions: string[];
  signatoryName: string;
  signatoryDesignation: string;
}

export interface InvoiceAuditLog {
  auditId: string;
  invoiceId: string;
  invoiceNo?: string;
  action: 'draft_created' | 'draft_updated' | 'finalized' | 'cancelled' | 'pdf_generated';
  userId: string;
  userName: string;
  timestamp: string;
  summary: string;
  details?: Record<string, any>;
}
