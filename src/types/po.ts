export type ProcessCategory = 'washing' | 'dyeing' | 'Washing' | 'Dyeing';
export type POProcessCategory = 'washing' | 'dyeing';

export type POStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'in_progress'
  | 'partially_received'
  | 'fully_received'
  | 'completed'
  | 'cancelled'
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'In Progress'
  | 'Completed'
  | 'Cancelled';

export type QuantityUnit = 'piece' | 'kg';
export type UnitType = 'piece' | 'kg';

export type RateBasis =
  | 'per_piece'
  | 'per_kg'
  | 'perPiece'
  | 'perKg'
  | 'per piece'
  | 'per kg';

export interface POColourLine {
  id?: string;
  lineId: string;
  colourName: string;
  colourCode?: string | null;
  colourId?: string | null;
  itemName?: string;
  processType: string;
  quantity: number;
  unit: QuantityUnit;
  rateBasis: RateBasis;
  rate: number;
  billableWeightKg?: number;
  billablePieceQty?: number;
  lineAmount?: number;
  amount?: number;
  notes?: string | null;
  remarks?: string;
}

// POLine alias for existing code
export type POLine = POColourLine;

export interface PurchaseOrder {
  id: string;
  poId: string;
  poNumber: string;

  // Customer identification
  customerId: string;
  customerVendorId?: string;
  customerCode?: string;
  customerName: string;
  customerCompanyNameSnapshot?: string;

  // Subcontractor / Subcompany fulfillment unit
  subcontractorType?: 'subcontractor' | 'subcompany' | null;
  subcontractorId?: string | null;
  subcontractorCode?: string | null;
  subcontractorName?: string | null;
  subcompanyId?: string | null;
  subcompanyCode?: string | null;
  subcompanyName?: string | null;

  processCategory: ProcessCategory;

  styleNo: string;
  styleNumber?: string;
  itemName: string;

  orderDate: string;
  deliveryDate?: string | null;
  expectedCompletionDate?: string | null;

  colourLines: POColourLine[];
  lines: POColourLine[]; // alias for compatibility with downstream modules

  totalQtyByUnit: Partial<Record<QuantityUnit, number>>;
  totalQuantity: number;
  totalAmount: number;
  currency: 'INR';

  customerReferenceNo?: string;
  customerInstructions?: string;
  internalRemarks?: string;
  notes?: string | null;

  status: POStatus;
  revision: number;

  createdBy: string;
  createdById?: string;
  createdByName?: string;
  createdAt: string;

  updatedBy?: string;
  updatedById?: string;
  updatedAt?: string;

  submittedBy?: string;
  submittedById?: string;
  submittedAt?: string;

  approvedBy?: string;
  approvedById?: string;
  approvedAt?: string;

  rejectedBy?: string;
  rejectedById?: string;
  rejectedAt?: string;
  rejectionReason?: string;

  cancelledBy?: string;
  cancelledById?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  schemaVersion: number;
}

export interface POAuditLog {
  auditId: string;
  poId: string;
  poNumber: string;
  action:
    | 'created'
    | 'updated'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'amended'
    | 'approval_revoked';
  performedBy: string;
  performedByName?: string;
  performedAt: string;
  changedFields?: string[];
  summary: string;
  metadata?: Record<string, any>;
}

export interface POAmendment {
  amendmentId: string;
  poId: string;
  poNumber: string;
  amendmentNumber: number;
  previousSnapshot: Partial<PurchaseOrder>;
  newValues: Partial<PurchaseOrder>;
  reason: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  status: 'draft' | 'approved' | 'rejected';
}

export interface POFilterOptions {
  searchQuery?: string;
  customerId?: string;
  processCategory?: 'all' | 'washing' | 'dyeing';
  status?: 'all' | POStatus;
  startDate?: string;
  endDate?: string;
}

export interface POPagination {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export interface PODashboardMetrics {
  totalPOs: number;
  draftPOs: number;
  approvedPOs: number;
  cancelledPOs: number;
  totalPieces: number;
  totalKg: number;
  totalOrderValue: number;
}
