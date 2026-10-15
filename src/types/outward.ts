import { QuantityUnit } from './po';

export type OutwardStatus =
  | 'draft'
  | 'posted'
  | 'reversed'
  | 'cancelled';

export interface OutwardLine {
  outwardLineId: string;
  lineId?: string; // alias for backward compatibility

  outwardId: string;
  poId: string;
  poLineId: string;

  colourNameSnapshot: string;
  colour?: string; // alias
  colourCodeSnapshot?: string | null;

  itemNameSnapshot: string;
  washTypeSnapshot: string;
  processType?: string; // alias

  orderedQtySnapshot: number;
  unit: QuantityUnit;

  cumulativeInwardQtySnapshot: number;
  previouslyDispatchedQtySnapshot: number;
  availableForDispatchSnapshot: number;

  dispatchQty: number;
  remainingAfterDispatchSnapshot: number;

  createdAt?: string;
}

export interface OutwardEntry {
  id: string; // Document ID alias
  outwardId: string;
  outwardNo: string; // OUT/2026-27/0001 or OUT/PENDING
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

  outwardDate: string; // YYYY-MM-DD actual dispatch date
  ourDate?: string; // alias for backward compatibility
  ourDcNo: string; // Company Internal Delivery Challan No

  vehicleNumber?: string;
  vehicleNo?: string; // alias
  driverName?: string;
  transporterVendorId?: string | null;
  transporterNameSnapshot?: string | null;
  destination?: string;
  remarks?: string;

  status: OutwardStatus;

  totalQtyByUnit: {
    piece?: number;
    kg?: number;
  };
  totalQuantity: number;

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

  lines: OutwardLine[];

  schemaVersion: number;
}

export interface OutwardAuditLog {
  auditId: string;
  outwardId: string;
  outwardNo: string;
  action: 'created' | 'updated' | 'posted' | 'reversed' | 'cancelled';
  performedBy: string;
  performedByName?: string;
  performedAt: string;
  changedFields?: string[];
  summary: string;
  metadata?: Record<string, any>;
}

export interface OutwardFilterOptions {
  searchQuery?: string;
  customerId?: string;
  subcontractorId?: string;
  poId?: string;
  poNumber?: string;
  styleNo?: string;
  ourDcNo?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: OutwardStatus | 'all';
  transporterVendorId?: string;
}

export interface OutwardPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface OutwardDashboardMetrics {
  totalOutwardsCount: number;
  postedOutwardsCount: number;
  postedCount?: number; // alias
  draftOutwardsCount: number;
  draftCount?: number; // alias
  reversedOutwardsCount: number;
  reversedCount?: number; // alias
  totalPiecesDispatched: number;
  totalKgDispatched: number;
  totalPiecesAvailableToDispatch: number;
  totalKgAvailableToDispatch: number;
}

export interface OutwardLineBalance {
  poLineId: string;
  colourName: string;
  colourCode?: string | null;
  itemName: string;
  processType: string;
  unit: QuantityUnit;
  orderedQty: number;
  cumulativeInwardQty: number;
  cumulativeOutwardQty: number;
  availableForDispatch: number;
}

export interface OutwardBalancesResponse {
  poId: string;
  poNumber: string;
  lines: Record<string, OutwardLineBalance>;
  totalInwardPieces: number;
  totalOutwardPieces: number;
  totalAvailablePieces: number;
  totalInwardKg: number;
  totalOutwardKg: number;
  totalAvailableKg: number;
}
