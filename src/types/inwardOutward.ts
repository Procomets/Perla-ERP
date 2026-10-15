import { UnitType } from './po';
export * from './inward';

export interface OutwardLine {
  lineId: string;
  poLineId: string;
  colour: string;
  dispatchQty: number;
  unit: UnitType;
}

export interface OutwardEntry {
  id: string;
  entryId: string;
  poId: string;
  poNumber: string;
  styleNo: string;
  customerId: string;
  customerName: string;
  subContractorId?: string;
  subContractorName?: string;
  ourDate: string;
  ourDcNo: string;
  vehicleNo?: string;
  createdAt: string;
  createdBy: string;
  lines: OutwardLine[];
}

export interface StatementColourSummary {
  poId: string;
  poNumber: string;
  styleNo: string;
  itemName: string;
  poLineId: string;
  colour: string;
  processType: string;
  unit: UnitType;
  orderedQty: number;
  rate: number;
  cumulativeInward: number;
  cumulativeOutward: number;
  difference: number;
  isReadyForInvoice: boolean;
  isApprovedForInvoice: boolean;
  isInvoiced: boolean;
  invoiceId?: string;
  invoiceNo?: string;
}
