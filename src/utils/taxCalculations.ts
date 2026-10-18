import { RateBasis } from '../types/invoice';

/**
 * Decimal-safe rounding to prevent floating-point artifacts
 */
export function safeRound(num: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Formats a financial year string based on Indian fiscal calendar (April 1 to March 31)
 * Example: Date in October 2026 -> "2026-27"
 * Example: Date in February 2027 -> "2026-27"
 */
export function getFinancialYear(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed

  if (month >= 4) {
    const nextYearShort = (year + 1).toString().slice(-2);
    return `${year}-${nextYearShort}`;
  } else {
    const currentYearShort = year.toString().slice(-2);
    return `${year - 1}-${currentYearShort}`;
  }
}

/**
 * Determines whether a transaction is Intra-State or Inter-State based on GST state codes
 */
export function isIntraStateSupply(
  customerStateCode?: string,
  customerState?: string,
  issuerStateCode: string = '33'
): boolean {
  if (customerStateCode) {
    const cleanCustomerCode = customerStateCode.trim().padStart(2, '0');
    const cleanIssuerCode = issuerStateCode.trim().padStart(2, '0');
    return cleanCustomerCode === cleanIssuerCode;
  }

  if (customerState) {
    const normalized = customerState.trim().toLowerCase();
    return normalized.includes('tamil nadu') || normalized === 'tn';
  }

  // Default to intra-state if both in Tamil Nadu
  return true;
}

/**
 * Calculates line amount based on rate basis
 */
export function calculateLineAmount(
  quantity: number,
  rate: number,
  rateBasis: RateBasis = 'per_piece',
  billableWeightKg?: number
): number {
  if (rateBasis === 'per_kg') {
    const weight = billableWeightKg !== undefined && billableWeightKg > 0 ? billableWeightKg : quantity;
    return safeRound(weight * rate, 2);
  }
  return safeRound(quantity * rate, 2);
}

/**
 * Calculates complete tax breakdown for an invoice
 */
export interface TaxCalculationResult {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  isIntraState: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  otherCharges: number;
  rawTotal: number;
  roundOff: number;
  finalTotal: number;
}

export function calculateInvoiceTaxes(
  taxableSubtotal: number,
  options: {
    isIntraState: boolean;
    cgstRate?: number;
    sgstRate?: number;
    igstRate?: number;
    discountAmount?: number;
    otherCharges?: number;
  }
): TaxCalculationResult {
  const discountAmount = safeRound(options.discountAmount || 0, 2);
  const otherCharges = safeRound(options.otherCharges || 0, 2);
  const taxableAmount = Math.max(0, safeRound(taxableSubtotal - discountAmount, 2));

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (options.isIntraState) {
    cgstRate = options.cgstRate ?? 2.5;
    sgstRate = options.sgstRate ?? 2.5;
    cgstAmount = safeRound(taxableAmount * (cgstRate / 100), 2);
    sgstAmount = safeRound(taxableAmount * (sgstRate / 100), 2);
  } else {
    igstRate = options.igstRate ?? 5.0;
    igstAmount = safeRound(taxableAmount * (igstRate / 100), 2);
  }

  const totalTax = safeRound(cgstAmount + sgstAmount + igstAmount, 2);
  const rawTotal = safeRound(taxableAmount + totalTax + otherCharges, 2);
  const roundedIntegerTotal = Math.round(rawTotal);
  const roundOff = safeRound(roundedIntegerTotal - rawTotal, 2);
  const finalTotal = roundedIntegerTotal;

  return {
    subtotal: taxableSubtotal,
    discountAmount,
    taxableAmount,
    isIntraState: options.isIntraState,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalTax,
    otherCharges,
    rawTotal,
    roundOff,
    finalTotal
  };
}

/**
 * Converts any number to Indian Currency Words, accurately handling paise
 * Example: 57544.50 -> "Rupees Fifty-Seven Thousand Five Hundred Forty-Four and Fifty Paise Only"
 * Example: 15000 -> "Rupees Fifteen Thousand Only"
 */
export function convertNumberToIndianWords(amount: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)).trim() + ' Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)).trim() + ' Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)).trim() + ' Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  };

  if (amount === 0) return 'Rupees Zero Only';

  const roundedAmount = safeRound(amount, 2);
  const rupees = Math.floor(roundedAmount);
  const paise = Math.round((roundedAmount - rupees) * 100);

  let result = 'Rupees ';
  if (rupees > 0) {
    result += inWords(rupees).trim();
  } else {
    result += 'Zero';
  }

  if (paise > 0) {
    result += ` and ${inWords(paise).trim()} Paise`;
  }

  return `${result} Only`;
}
