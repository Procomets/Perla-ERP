import { z } from 'zod';
import { POColourLine, QuantityUnit, RateBasis } from '../types/po';

export const quantityUnitSchema = z.enum(['piece', 'kg']);

export const rateBasisSchema = z.enum([
  'per_piece',
  'per_kg',
  'perPiece',
  'perKg',
  'per piece',
  'per kg'
]);

export const processCategorySchema = z.enum([
  'washing',
  'dyeing',
  'Washing',
  'Dyeing'
]);

export const poColourLineSchema = z
  .object({
    id: z.string().optional(),
    lineId: z.string().optional(),
    colourName: z.string().trim().min(1, 'Colour name is required'),
    colourCode: z.string().trim().nullable().optional(),
    itemName: z.string().trim().optional(),
    processType: z.string().trim().min(1, 'Wash/Process type is required'),
    quantity: z.number().gt(0, 'Quantity must be greater than 0'),
    unit: quantityUnitSchema,
    rateBasis: rateBasisSchema,
    rate: z.number().min(0, 'Rate must be a non-negative number'),
    billableWeightKg: z.number().optional().nullable(),
    billablePieceQty: z.number().optional().nullable(),
    lineAmount: z.number().optional(),
    amount: z.number().optional(),
    notes: z.string().trim().nullable().optional(),
    remarks: z.string().trim().optional()
  })
  .refine(
    (line) => {
      const isPerKg =
        line.rateBasis === 'per_kg' ||
        line.rateBasis === 'perKg' ||
        line.rateBasis === 'per kg';
      if (line.unit === 'piece' && isPerKg) {
        return (
          line.billableWeightKg !== undefined &&
          line.billableWeightKg !== null &&
          line.billableWeightKg > 0
        );
      }
      return true;
    },
    {
      message:
        'When unit is Piece and rate basis is Per Kilogram, billable weight (kg) must be specified.',
      path: ['billableWeightKg']
    }
  );

export const purchaseOrderFormSchema = z
  .object({
    customerId: z.string().min(1, 'Customer / Company is required'),
    processCategory: processCategorySchema,
    styleNo: z.string().trim().min(1, 'Style Number is required'),
    itemName: z.string().trim().min(1, 'Item Description is required'),
    orderDate: z.string().min(1, 'Order date is required'),
    deliveryDate: z.string().nullable().optional(),
    expectedCompletionDate: z.string().nullable().optional(),
    customerReferenceNo: z.string().trim().optional(),
    customerInstructions: z.string().trim().optional(),
    internalRemarks: z.string().trim().optional(),
    notes: z.string().trim().nullable().optional(),
    colourLines: z
      .array(poColourLineSchema)
      .min(1, 'At least one colour line is required')
  })
  .refine(
    (data) => {
      // Check for duplicate colour and wash process combinations
      const seen = new Set<string>();
      for (const line of data.colourLines) {
        const key = `${line.colourName.toLowerCase()}_${line.processType.toLowerCase()}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
      }
      return true;
    },
    {
      message:
        'Duplicate colour and process combination detected. Each colour line should represent a unique colour/process configuration.',
      path: ['colourLines']
    }
  );

/**
 * Calculates line amount according to rate basis
 */
export function calculateLineAmount(line: Partial<POColourLine>): number {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const rateBasis = line.rateBasis || 'per_piece';

  const isPerKg =
    rateBasis === 'per_kg' ||
    rateBasis === 'perKg' ||
    rateBasis === 'per kg';

  if (isPerKg) {
    if (line.unit === 'piece' && line.billableWeightKg) {
      return Math.round(Number(line.billableWeightKg) * rate * 100) / 100;
    }
    return Math.round(qty * rate * 100) / 100;
  }

  // Per piece basis
  if (line.unit === 'kg' && line.billablePieceQty) {
    return Math.round(Number(line.billablePieceQty) * rate * 100) / 100;
  }
  return Math.round(qty * rate * 100) / 100;
}

/**
 * Calculates total quantities grouped by unit, total quantity count, and total order value
 */
export function calculatePOTotals(lines: Partial<POColourLine>[]): {
  totalQtyByUnit: Partial<Record<QuantityUnit, number>>;
  totalQuantity: number;
  totalAmount: number;
} {
  const totalQtyByUnit: Partial<Record<QuantityUnit, number>> = {
    piece: 0,
    kg: 0
  };
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const unit = (line.unit || 'piece') as QuantityUnit;

    totalQtyByUnit[unit] = (totalQtyByUnit[unit] || 0) + qty;
    totalQuantity += qty;

    const amount =
      typeof line.lineAmount === 'number'
        ? line.lineAmount
        : calculateLineAmount(line);
    totalAmount += amount;
  }

  return {
    totalQtyByUnit,
    totalQuantity,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
}
