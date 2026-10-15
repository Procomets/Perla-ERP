import { QuantityUnit, UnitType } from './po';

export type InwardStatus =
  | 'draft'
  | 'posted'
  | 'reversed'
  | 'cancelled';

export interface InwardLine {
  inwardLineId: string;
  lineId?: string; // alias for backward compatibility

  inwardId: string;
  poId: string;
  poLineId: string;

  colourNameSnapshot: string;
  colour?: string; // alias for backward compatibility
  colourCodeSnapshot?: string | null;

  itemNameSnapshot: string;
  washTypeSnapshot: string;
  processType?: string; // alias

  orderedQtySnapshot: number;
  unit: QuantityUnit;

  previouslyReceivedQtySnapshot: number;
  receivedQty: number;

  cumulativeReceivedQtySnapshot: number;
  balanceAfterReceiptSnapshot: number;

  createdAt?: string;
}

export interface InwardEntry {
  id: string; // Document ID alias
  inwardId: string;
  inwardNo: string; // INW/2026-27/0001 or INW/PENDING
  entryId?: string; // alias for backward compatibility

  poId: string;
  poNumberSnapshot: string;
  poNumber?: string; // alias

  customerVendorId: string;
  customerId?: string; // alias
  customerCompanyNameSnapshot: string;
  customerName?: string; // alias

  subcontractorVendorId?: string | null;
  subContractorId?: string; // alias
  subcontractorNameSnapshot?: string | null;
  subContractorName?: string; // alias

  styleNoSnapshot: string;
  styleNo?: string; // alias
  itemNameSnapshot: string;
  itemName?: string; // alias
  processCategorySnapshot: 'washing' | 'dyeing';
  processCategory?: 'washing' | 'dyeing'; // alias

  customerDate: string; // YYYY-MM-DD customer delivery date
  customerDcNo: string; // Customer Delivery Challan No

  inwardDate: string; // Actual receipt date
  receivedAt?: string;

  status: InwardStatus;

  totalQtyByUnit: {
    piece?: number;
    kg?: number;
  };
  totalQuantity: number;

  remarks?: string;

  createdBy: string;
  createdByName?: string;
  createdAt: string;

  updatedBy: string;
  updatedByName?: string;
  updatedAt: string;

  postedBy?: string;
  postedByName?: string;
  postedAt?: string;

  reversedBy?: string;
  reversedByName?: string;
  reversedAt?: string;
  reversalReason?: string;

  lines: InwardLine[];

  schemaVersion: number;
}

export interface InwardAuditLog {
  auditId: string;
  inwardId: string;
  inwardNo: string;
  action: 'created' | 'updated' | 'posted' | 'reversed' | 'cancelled';
  performedBy: string;
  performedByName?: string;
  performedAt: string;
  changedFields?: string[];
  summary: string;
  metadata?: Record<string, any>;
}

export interface InwardFilterOptions {
  searchQuery?: string;
  customerId?: string;
  subcontractorId?: string;
  poId?: string;
  poNumber?: string;
  styleNo?: string;
  customerDcNo?: string;
  status?: 'all' | InwardStatus;
  startDate?: string;
  endDate?: string;
}

export interface InwardPagination {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface InwardDashboardMetrics {
  totalInwardCount: number;
  draftCount: number;
  postedCount: number;
  reversedCount: number;
  totalPiecesReceived: number;
  totalKgReceived: number;
  pendingInwardPieces: number;
  pendingInwardKg: number;
}

export interface InwardLineBalance {
  poLineId: string;
  colourName: string;
  colourCode?: string | null;
  itemName: string;
  processType: string;
  orderedQty: number;
  unit: QuantityUnit;
  previouslyReceivedQty: number;
  remainingOrderQty: number;
  currentReceiptQty: number;
  cumulativeReceivedQty: number;
  balanceAfterReceipt: number;
}

export interface InwardBalancesResponse {
  poId: string;
  poNumber: string;
  customerVendorId: string;
  customerName: string;
  styleNo: string;
  itemName: string;
  processCategory: 'washing' | 'dyeing';
  lines: InwardLineBalance[];
  totalsByUnit: {
    piece?: {
      ordered: number;
      previouslyReceived: number;
      remaining: number;
    };
    kg?: {
      ordered: number;
      previouslyReceived: number;
      remaining: number;
    };
  };
}
