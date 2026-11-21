/**
 * Unit Conversion Utilities for Perla ERP
 * Supports bidirectional conversions between weight (t, kg, qtl, g) and volume (l, ml) units
 * with precise stock adjustments and rate transformations.
 */

export interface UnitOption {
  value: string;
  label: string;
  symbol: string;
}

export function normalizeUnit(unitStr: string): string {
  const u = (unitStr || '').trim().toLowerCase();
  if (['t', 'ton', 'tonne', 'tonnes', 'tons', 'mt'].includes(u)) return 't';
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return 'kg';
  if (['g', 'gms', 'gram', 'grams'].includes(u)) return 'g';
  if (['qtl', 'quintal', 'quintals'].includes(u)) return 'qtl';
  if (['l', 'ltr', 'litre', 'litres', 'liter', 'liters'].includes(u)) return 'l';
  if (['ml', 'millilitre', 'millilitres'].includes(u)) return 'ml';
  return u;
}

// Factor relative to 1 KG for weight units
const WEIGHT_TO_KG: Record<string, number> = {
  t: 1000,
  qtl: 100,
  kg: 1,
  g: 0.001
};

// Factor relative to 1 L for volume units
const VOLUME_TO_L: Record<string, number> = {
  l: 1,
  ml: 0.001
};

/**
 * Returns conversion multiplier: quantityInToUnit = quantityInFromUnit * factor
 * If units cannot be converted, returns 1
 */
export function getUnitConversionFactor(fromUnit: string, toUnit: string): number {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  if (fromNorm === toNorm) return 1;

  if (WEIGHT_TO_KG[fromNorm] !== undefined && WEIGHT_TO_KG[toNorm] !== undefined) {
    return WEIGHT_TO_KG[fromNorm] / WEIGHT_TO_KG[toNorm];
  }

  if (VOLUME_TO_L[fromNorm] !== undefined && VOLUME_TO_L[toNorm] !== undefined) {
    return VOLUME_TO_L[fromNorm] / VOLUME_TO_L[toNorm];
  }

  return 1;
}

/**
 * Convert quantity from one unit to another
 */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  if (!quantity || isNaN(quantity)) return 0;
  const factor = getUnitConversionFactor(fromUnit, toUnit);
  return Math.round(quantity * factor * 1000000) / 1000000;
}

/**
 * Convert rate (cost per unit) from one unit to another
 * If 1 t = 1000 kg, rate per kg = rate per t / 1000
 */
export function convertRate(rate: number, fromUnit: string, toUnit: string): number {
  if (!rate || isNaN(rate)) return 0;
  const factor = getUnitConversionFactor(fromUnit, toUnit);
  if (factor === 0) return 0;
  return Math.round((rate / factor) * 1000000) / 1000000;
}

/**
 * Returns compatible selectable unit options for a given base unit.
 */
export function getCompatibleUnits(baseUnit: string): UnitOption[] {
  const norm = normalizeUnit(baseUnit);

  if (WEIGHT_TO_KG[norm] !== undefined) {
    return [
      { value: 't', label: 't (Tonnes)', symbol: 't' },
      { value: 'kg', label: 'kg (Kilograms)', symbol: 'kg' },
      { value: 'qtl', label: 'qtl (Quintals)', symbol: 'qtl' }
    ];
  }

  if (VOLUME_TO_L[norm] !== undefined) {
    return [
      { value: 'l', label: 'L (Litres)', symbol: 'L' },
      { value: 'ml', label: 'ml (Millilitres)', symbol: 'ml' }
    ];
  }

  const defaultUnit = baseUnit || 'unit';
  return [
    { value: defaultUnit, label: defaultUnit, symbol: defaultUnit }
  ];
}
