import { z } from 'zod';
import { InwardLine, InwardLineBalance } from '../types/inward';

export const quantityUnitSchema = z.enum(['piece', 'kg']);

export const inwardLineInputSchema = z.object({
  inwardLineId: z.string().optional(),
  poLineId: z.string().min(1, 'PO Line ID is required'),
  colourNameSnapshot: z.string().trim().min(1, 'Colour name is required'),
  colourCodeSnapshot: z.string().trim().nullable().optional(),
  itemNameSnapshot: z.string().trim().min(1, 'Item name is required'),
  washTypeSnapshot: z.string().trim().min(1, 'Wash/Process type is required'),
  orderedQtySnapshot: z.number().min(0, 'Ordered quantity must be non-negative'),
  unit: quantityUnitSchema,
  previouslyReceivedQtySnapshot: z.number().min(0, 'Previous received quantity must be non-negative'),
  receivedQty: z.number().min(0, 'Received quantity cannot be negative'),
  cumulativeReceivedQtySnapshot: z.number().optional(),
  balanceAfterReceiptSnapshot: z.number().optional()
});

export const inwardFormSchema = z
  .object({
    customerVendorId: z.string().min(1, 'Customer / Company is required'),
    subcontractorVendorId: z.string().nullable().optional(),
    poId: z.string().min(1, 'Purchase Order selection is required'),
    customerDate: z
      .string()
      .min(1, 'Customer Delivery Challan Date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    customerDcNo: z
      .string()
      .trim()
      .min(1, 'Customer DC Number is required')
      .max(60, 'DC Number cannot exceed 60 characters'),
    inwardDate: z
      .string()
      .min(1, 'Inward Receipt Date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    remarks: z.string().trim().max(500, 'Remarks cannot exceed 500 characters').optional(),
    lines: z.array(inwardLineInputSchema).min(1, 'At least one colour line is required')
  })
  .refine(
    (data) => {
      // Rule 1: At least one colour line must have a positive receipt quantity
      return data.lines.some((l) => (Number(l.receivedQty) || 0) > 0);
    },
    {
      message: 'At least one colour line must have a receipt quantity greater than 0 before posting.',
      path: ['lines']
    }
  )
  .refine(
    (data) => {
      // Rule 2: Cannot receive more than the remaining balance for any line
      for (const line of data.lines) {
        const received = Number(line.receivedQty) || 0;
        const remaining = Math.max(0, (Number(line.orderedQtySnapshot) || 0) - (Number(line.previouslyReceivedQtySnapshot) || 0));
        if (received > remaining) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Received quantity cannot exceed the remaining balance quantity for any colour line.',
      path: ['lines']
    }
  );

export const inwardDraftSchema = z.object({
  customerVendorId: z.string().min(1, 'Customer / Company is required'),
  subcontractorVendorId: z.string().nullable().optional(),
  poId: z.string().min(1, 'Purchase Order is required'),
  customerDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  customerDcNo: z.string().trim().optional().default('DRAFT-DC'),
  inwardDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  remarks: z.string().trim().optional(),
  lines: z.array(inwardLineInputSchema).optional().default([])
});

export const inwardReversalSchema = z.object({
  reversalReason: z
    .string()
    .trim()
    .min(5, 'Reversal reason must be at least 5 characters long explaining why this receipt is being reversed')
    .max(300, 'Reversal reason cannot exceed 300 characters')
});

/**
 * Calculate totals and line balance summaries for inward lines
 */
export function calculateInwardLineBalances(
  line: {
    poLineId: string;
    colourName: string;
    colourCode?: string | null;
    itemName: string;
    processType: string;
    orderedQty: number;
    unit: 'piece' | 'kg';
  },
  previouslyReceivedQty: number,
  currentReceiptQty: number
): InwardLineBalance {
  const ordered = Math.max(0, Number(line.orderedQty) || 0);
  const prev = Math.max(0, Number(previouslyReceivedQty) || 0);
  const current = Math.max(0, Number(currentReceiptQty) || 0);
  const remaining = Math.max(0, ordered - prev);
  const cumulative = prev + current;
  const balanceAfter = Math.max(0, ordered - cumulative);

  return {
    poLineId: line.poLineId,
    colourName: line.colourName,
    colourCode: line.colourCode || null,
    itemName: line.itemName,
    processType: line.processType,
    orderedQty: ordered,
    unit: line.unit,
    previouslyReceivedQty: prev,
    remainingOrderQty: remaining,
    currentReceiptQty: current,
    cumulativeReceivedQty: cumulative,
    balanceAfterReceipt: balanceAfter
  };
}

/**
 * Aggregate quantities by unit ('piece' vs 'kg') - NEVER add pieces and kg together!
 */
export function calculateInwardTotalsByUnit(
  lines: Array<{ unit: 'piece' | 'kg'; receivedQty?: number; currentReceiptQty?: number }>
): {
  piece: number;
  kg: number;
  totalQuantity: number;
} {
  let piece = 0;
  let kg = 0;

  for (const l of lines) {
    const qty = 'receivedQty' in l ? Number(l.receivedQty) || 0 : Number(l.currentReceiptQty) || 0;
    if (l.unit === 'kg') {
      kg += qty;
    } else {
      piece += qty;
    }
  }

  return {
    piece,
    kg,
    totalQuantity: piece + kg
  };
}
