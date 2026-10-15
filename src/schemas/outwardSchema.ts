import { z } from 'zod';
import { OutwardLine, OutwardLineBalance } from '../types/outward';

export const quantityUnitSchema = z.enum(['piece', 'kg']);

export const outwardLineInputSchema = z.object({
  outwardLineId: z.string().optional(),
  poLineId: z.string().min(1, 'PO Line ID is required'),
  colourNameSnapshot: z.string().trim().min(1, 'Colour name is required'),
  colourCodeSnapshot: z.string().trim().nullable().optional(),
  itemNameSnapshot: z.string().trim().min(1, 'Item name is required'),
  washTypeSnapshot: z.string().trim().min(1, 'Wash/Process type is required'),
  orderedQtySnapshot: z.number().min(0, 'Ordered quantity must be non-negative'),
  unit: quantityUnitSchema,
  cumulativeInwardQtySnapshot: z.number().min(0, 'Inward quantity must be non-negative'),
  previouslyDispatchedQtySnapshot: z.number().min(0, 'Previous dispatched quantity must be non-negative'),
  availableForDispatchSnapshot: z.number().min(0, 'Available quantity must be non-negative'),
  dispatchQty: z.number().min(0, 'Dispatch quantity cannot be negative'),
  remainingAfterDispatchSnapshot: z.number().optional()
});

export const outwardFormSchema = z
  .object({
    customerVendorId: z.string().min(1, 'Customer / Company is required'),
    subcontractorVendorId: z.string().nullable().optional(),
    poId: z.string().min(1, 'Purchase Order selection is required'),
    outwardDate: z
      .string()
      .min(1, 'Outward Dispatch Date is required')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    ourDcNo: z
      .string()
      .trim()
      .min(1, 'Delivery Challan Number is required')
      .max(60, 'DC Number cannot exceed 60 characters'),
    vehicleNumber: z.string().trim().max(30, 'Vehicle number cannot exceed 30 characters').optional(),
    driverName: z.string().trim().max(80, 'Driver name cannot exceed 80 characters').optional(),
    transporterVendorId: z.string().nullable().optional(),
    destination: z.string().trim().max(120, 'Destination cannot exceed 120 characters').optional(),
    remarks: z.string().trim().max(500, 'Remarks cannot exceed 500 characters').optional(),
    lines: z.array(outwardLineInputSchema).min(1, 'At least one colour line is required')
  })
  .refine(
    (data) => {
      // Rule 1: At least one colour line must have a positive dispatch quantity
      return data.lines.some((l) => (Number(l.dispatchQty) || 0) > 0);
    },
    {
      message: 'At least one colour line must have a dispatch quantity greater than 0 before posting.',
      path: ['lines']
    }
  )
  .refine(
    (data) => {
      // Rule 2: Cannot dispatch more than the available inward balance for any line
      for (const line of data.lines) {
        const dispatch = Number(line.dispatchQty) || 0;
        const available = Math.max(
          0,
          (Number(line.cumulativeInwardQtySnapshot) || 0) - (Number(line.previouslyDispatchedQtySnapshot) || 0)
        );
        if (dispatch > available) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Dispatch quantity cannot exceed the available received balance for any colour line.',
      path: ['lines']
    }
  );

export const outwardDraftSchema = z.object({
  customerVendorId: z.string().min(1, 'Customer / Company is required'),
  subcontractorVendorId: z.string().nullable().optional(),
  poId: z.string().min(1, 'Purchase Order is required'),
  outwardDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  ourDcNo: z.string().trim().optional().default('DRAFT-DC'),
  vehicleNumber: z.string().trim().optional(),
  driverName: z.string().trim().optional(),
  transporterVendorId: z.string().nullable().optional(),
  destination: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  lines: z.array(outwardLineInputSchema).optional().default([])
});

export const outwardReversalSchema = z.object({
  reversalReason: z
    .string()
    .trim()
    .min(5, 'Reversal reason must be at least 5 characters long explaining why this dispatch is being reversed')
    .max(300, 'Reversal reason cannot exceed 300 characters')
});

/**
 * Calculate totals and line balance summaries for outward lines
 */
export function calculateOutwardLineBalances(
  line: {
    poLineId: string;
    colourName: string;
    colourCode?: string | null;
    itemName: string;
    processType: string;
    orderedQty: number;
    unit: 'piece' | 'kg';
  },
  cumulativeInwardQty: number,
  previouslyDispatchedQty: number,
  currentDispatchQty: number = 0
): {
  availableQty: number;
  remainingAfterDispatch: number;
} {
  const availableQty = Math.max(0, cumulativeInwardQty - previouslyDispatchedQty);
  const remainingAfterDispatch = Math.max(0, availableQty - currentDispatchQty);
  return { availableQty, remainingAfterDispatch };
}

/**
 * Aggregates outward totals strictly grouped by Unit (piece and kg never summed together)
 */
export function calculateOutwardTotalsByUnit(lines: OutwardLine[] | { unit: 'piece' | 'kg'; dispatchQty: number }[]): {
  totalQtyByUnit: {
    piece: number;
    kg: number;
  };
  totalQuantity: number;
} {
  let pieceTotal = 0;
  let kgTotal = 0;

  for (const l of lines) {
    const qty = Number(l.dispatchQty) || 0;
    if (l.unit === 'kg') {
      kgTotal += qty;
    } else {
      pieceTotal += qty;
    }
  }

  // Round kg to 2 decimals
  kgTotal = Math.round(kgTotal * 100) / 100;

  return {
    totalQtyByUnit: {
      piece: pieceTotal,
      kg: kgTotal
    },
    totalQuantity: pieceTotal + kgTotal
  };
}
