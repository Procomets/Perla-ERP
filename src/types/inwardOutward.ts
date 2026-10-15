import { UnitType } from './po';
export * from './inward';
export * from './outward';

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
