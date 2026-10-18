import { UnitType } from './po';
import { InwardEntry } from './inward';
import { OutwardEntry } from './outward';

export interface StatementFilterParams {
  companyId?: string;
  styleNo?: string;
  itemName?: string;
  poId?: string;
  poNumber?: string;
}

export interface StatementInwardRow {
  id: string;
  inwardId: string;
  inwardNo: string;
  date: string;
  dcNo: string;
  poId: string;
  poLineId: string;
  colour: string;
  qtyReceived: number;
  unit: UnitType;
  status: string;
}

export interface StatementOutwardRow {
  id: string;
  outwardId: string;
  outwardNo: string;
  date: string;
  dcNo: string;
  poId: string;
  poLineId: string;
  colour: string;
  qtyDispatched: number;
  unit: UnitType;
  status: string;
}

export interface StatementColourLineDetail {
  poId: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  poLineId: string;
  colour: string;
  colourCode?: string | null;
  processType: string;
  unit: UnitType;
  orderedQty: number;
  rate: number;
  cumulativeInward: number;
  orderedVsInwardDiff: number;
  cumulativeOutward: number;
  balanceQty: number;
  isReadyForInvoice: boolean;
  isApprovedForInvoice: boolean;
  isInvoiced: boolean;
  approvalId?: string;
  approvedAt?: string;
  invoiceId?: string;
  invoiceNo?: string;
}

export interface StatementUnitTotal {
  unit: UnitType;
  totalOrdered: number;
  totalInward: number;
  orderVsInwardDiff: number;
  totalOutward: number;
  balance: number;
}

export interface StatementDataResponse {
  companyId: string;
  companyName: string;
  styleNo?: string;
  itemName?: string;
  poId?: string;
  poNumber?: string;
  inwards: StatementInwardRow[];
  outwards: StatementOutwardRow[];
  colourLines: StatementColourLineDetail[];
  unitTotals: StatementUnitTotal[];
  hasTransactions: boolean;
}

export interface InvoiceApprovalRecord {
  approvalId: string;
  companyId: string;
  companyName: string;
  purchaseOrderId: string;
  poNumber: string;
  styleNo: string;
  itemId?: string;
  itemName: string;
  poColourLineId: string;
  colourName: string;
  unit: UnitType;
  rate: number;
  approvedQuantity: number;
  totalInwardAtApproval: number;
  totalOutwardAtApproval: number;
  status: 'approved' | 'invoiced' | 'cancelled';
  approvedBy: string;
  approvedByName: string;
  approvedAt: string;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceHistoryItem {
  approvalId: string;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  companyId: string;
  companyName: string;
  poId: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  colour: string;
  quantity: number;
  unit: UnitType;
  rate: number;
  amount: number;
  status: 'Invoiced' | 'Approved' | 'Cancelled';
  approvedAt: string;
  approvedByName: string;
}
