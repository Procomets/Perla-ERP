import { UnitType } from './po';

export interface InvoiceLine {
  lineId: string;
  sourcePoLineId: string;
  description: string; // e.g. Washing Charges for Men's Shirt
  hsnSac: string;
  colour: string;
  process: string;
  qty: number;
  unit: UnitType;
  rate: number;
  amount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
}

export interface Invoice {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  poNumber: string;
  styleNo: string;
  customerId: string;
  customerSnapshot: {
    companyName: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    gstin: string;
    pan: string;
  };
  lines: InvoiceLine[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  finalTotal: number;
  amountInWords: string;
  status: 'Draft' | 'Finalized' | 'Cancelled';
  pdfPath?: string;
  createdAt: string;
  createdBy: string;
}
