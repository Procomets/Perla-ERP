import {
  calculateLineAmount,
  calculateInvoiceTaxes,
  convertNumberToIndianWords,
  getFinancialYear,
  isIntraStateSupply,
  safeRound
} from '../../utils/taxCalculations';
import { InvoiceService } from '../invoiceService';
import { InvoicePdfService } from '../invoicePdfService';
import { Invoice, InvoiceLine, RateBasis } from '../../types/invoice';

export async function runInvoiceTests() {
  console.log('=====================================================');
  console.log('--- STARTING PERLA ERP INVOICE MODULE TEST SUITE ---');
  console.log('=====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ' - ' + detail : ''}`);
      failed++;
    }
  }

  // --- Test 1: Decimal-safe Rounding ---
  console.log('\n--- 1. Decimal-Safe Rounding & Float Precision ---');
  const rounded1 = safeRound(0.1 + 0.2, 2);
  assert(rounded1 === 0.3, 'safeRound handles 0.1 + 0.2 correctly as 0.3');

  const rounded2 = safeRound(1455.556, 2);
  assert(rounded2 === 1455.56, 'safeRound rounds up 1455.556 to 1455.56');

  // --- Test 2: Line Amount Calculations (Per Piece vs Per Kg) ---
  console.log('\n--- 2. Rate Basis Calculations (Per Piece vs Per Kg) ---');
  const pieceAmount = calculateLineAmount(1500, 25.5, 'per_piece');
  assert(pieceAmount === 38250, 'Per-piece billing (1,500 pcs * 25.50 = 38,250)');

  const kgAmount = calculateLineAmount(100, 180, 'per_kg', 450.5);
  assert(kgAmount === 81090, 'Per-kg billing uses billable weight (450.5 kg * 180 = 81,090)');

  // --- Test 3: Financial Year Resolution ---
  console.log('\n--- 3. Indian Financial Year Calculation ---');
  const fy1 = getFinancialYear(new Date('2026-10-16'));
  assert(fy1 === '2026-27', 'Date 2026-10-16 maps to FY 2026-27');

  const fy2 = getFinancialYear(new Date('2027-02-15'));
  assert(fy2 === '2026-27', 'Date 2027-02-15 (before April) maps to FY 2026-27');

  const fy3 = getFinancialYear(new Date('2027-04-01'));
  assert(fy3 === '2027-28', 'Date 2027-04-01 maps to FY 2027-28');

  // --- Test 4: Intra-State vs Inter-State Supply Detection ---
  console.log('\n--- 4. GST Place of Supply & Tax Mode Selection ---');
  const intraStateByCode = isIntraStateSupply('33', 'Tamil Nadu', '33');
  assert(intraStateByCode === true, 'Matching State Code 33 is identified as Intra-State');

  const intraStateByName = isIntraStateSupply(undefined, 'Tamil Nadu', '33');
  assert(intraStateByName === true, 'State name Tamil Nadu is identified as Intra-State');

  const interStateSupply = isIntraStateSupply('29', 'Karnataka', '33');
  assert(interStateSupply === false, 'State Code 29 (Karnataka) is identified as Inter-State');

  // --- Test 5: Tax Breakdown Calculations (CGST + SGST vs IGST) ---
  console.log('\n--- 5. GST Calculations (CGST + SGST vs IGST) ---');
  const intraTax = calculateInvoiceTaxes(100000, {
    isIntraState: true,
    cgstRate: 2.5,
    sgstRate: 2.5
  });
  assert(intraTax.cgstAmount === 2500, 'Intra-state CGST @ 2.5% on 1,00,000 is 2,500');
  assert(intraTax.sgstAmount === 2500, 'Intra-state SGST @ 2.5% on 1,00,000 is 2,500');
  assert(intraTax.igstAmount === 0, 'Intra-state IGST is 0');
  assert(intraTax.finalTotal === 105000, 'Intra-state Final Total is 1,05,000');

  const interTax = calculateInvoiceTaxes(50000, {
    isIntraState: false,
    igstRate: 5.0
  });
  assert(interTax.igstAmount === 2500, 'Inter-state IGST @ 5.0% on 50,000 is 2,500');
  assert(interTax.cgstAmount === 0 && interTax.sgstAmount === 0, 'Inter-state CGST & SGST are 0');
  assert(interTax.finalTotal === 52500, 'Inter-state Final Total is 52,500');

  // --- Test 6: Dynamic Amount in Words (Indian Currency with Paise) ---
  console.log('\n--- 6. Dynamic Amount in Words Converter ---');
  const words1 = convertNumberToIndianWords(57544);
  assert(
    words1.toLowerCase().includes('fifty-seven thousand five hundred forty-four'),
    '57,544 in words contains "Fifty-Seven Thousand Five Hundred Forty-Four"',
    words1
  );

  const words2 = convertNumberToIndianWords(105250.5);
  assert(
    words2.toLowerCase().includes('fifty paise'),
    '105,250.50 in words includes "Fifty Paise"',
    words2
  );

  // --- Test 7: Atomic Invoice Number Formatting ---
  console.log('\n--- 7. Unique Financial-Year Invoice Numbering ---');
  const invNo = await InvoiceService.getNextInvoiceNumber('2026-27', true);
  assert(invNo.startsWith('PTP/2026-27/'), `Invoice number starts with PTP/2026-27/: ${invNo}`);
  assert(/\d{4}$/.test(invNo), `Invoice number ends in 4-digit sequence: ${invNo}`);

  // --- Test 8: Single Customer Consistency Validation ---
  console.log('\n--- 8. Multi-Customer Invoicing Prevention ---');
  try {
    // Attempt to create draft with empty lines
    await InvoiceService.createInvoiceDraft([], { uid: 'u1' }, true);
    assert(false, 'createInvoiceDraft should throw when no lines selected');
  } catch (e: any) {
    assert(true, 'createInvoiceDraft rejects empty line selection');
  }

  // --- Test 9: Dashboard Metrics Aggregation ---
  console.log('\n--- 9. Invoice Dashboard Metrics Calculation ---');
  const sampleInvoices: Invoice[] = [
    {
      id: 'inv-1',
      invoiceId: 'inv-1',
      invoiceNo: 'PTP/2026-27/0001',
      financialYear: '2026-27',
      invoiceDate: '2026-10-15',
      poNumber: 'PO-101',
      styleNo: 'STYLE-1',
      customerId: 'cust-1',
      customerSnapshot: {
        companyName: 'Apex Garments',
        address: 'Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        gstin: '33AAACA1234A1Z5'
      },
      lines: [],
      currency: 'INR',
      subtotal: 10000,
      totalCgst: 250,
      totalSgst: 250,
      totalIgst: 0,
      roundOff: 0,
      finalTotal: 10500,
      amountInWords: 'Rupees Ten Thousand Five Hundred Only',
      status: 'finalized',
      createdAt: '2026-10-15T10:00:00Z',
      createdBy: 'admin'
    },
    {
      id: 'inv-2',
      invoiceId: 'inv-2',
      invoiceNo: 'DRAFT/2026-27/0002',
      financialYear: '2026-27',
      invoiceDate: '2026-10-16',
      poNumber: 'PO-102',
      styleNo: 'STYLE-2',
      customerId: 'cust-1',
      customerSnapshot: {
        companyName: 'Apex Garments',
        address: 'Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        gstin: '33AAACA1234A1Z5'
      },
      lines: [],
      currency: 'INR',
      subtotal: 5000,
      totalCgst: 125,
      totalSgst: 125,
      totalIgst: 0,
      roundOff: 0,
      finalTotal: 5250,
      amountInWords: 'Rupees Five Thousand Two Hundred Fifty Only',
      status: 'draft',
      createdAt: '2026-10-16T10:00:00Z',
      createdBy: 'admin'
    },
    {
      id: 'inv-3',
      invoiceId: 'inv-3',
      invoiceNo: 'PTP/2026-27/0003',
      financialYear: '2026-27',
      invoiceDate: '2026-10-14',
      poNumber: 'PO-103',
      styleNo: 'STYLE-3',
      customerId: 'cust-1',
      customerSnapshot: {
        companyName: 'Apex Garments',
        address: 'Chennai',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        gstin: '33AAACA1234A1Z5'
      },
      lines: [],
      currency: 'INR',
      subtotal: 8000,
      totalCgst: 200,
      totalSgst: 200,
      totalIgst: 0,
      roundOff: 0,
      finalTotal: 8400,
      amountInWords: 'Rupees Eight Thousand Four Hundred Only',
      status: 'cancelled',
      createdAt: '2026-10-14T10:00:00Z',
      createdBy: 'admin'
    }
  ];

  const metrics = InvoiceService.calculateDashboardMetrics(sampleInvoices);
  assert(metrics.totalInvoices === 3, 'Total invoices counted correctly as 3');
  assert(metrics.finalizedCount === 1, 'Finalized count is 1');
  assert(metrics.draftCount === 1, 'Draft count is 1');
  assert(metrics.cancelledCount === 1, 'Cancelled count is 1');
  assert(metrics.totalInvoiceValue === 10500, 'Total finalized value includes only finalized (10,500)');
  assert(metrics.totalTaxableValue === 10000, 'Total taxable value is 10,000');
  assert(metrics.totalGstCollected === 500, 'Total GST collected is 500');

  // --- Test 10: PDF Document Generation ---
  console.log('\n--- 10. PDF Generation Document Engine ---');
  try {
    const pdfDoc = InvoicePdfService.generateInvoicePdfDoc(sampleInvoices[0]);
    assert(pdfDoc !== null && pdfDoc !== undefined, 'PDF document generated successfully');
    assert(pdfDoc.internal.pages.length >= 1, 'PDF document contains rendered pages');
  } catch (err: any) {
    assert(false, 'PDF document generation threw error', err?.message);
  }

  // --- Test 11: Cancellation Workflow ---
  console.log('\n--- 11. Invoice Cancellation & Audit Trail ---');
  try {
    await InvoiceService.cancelInvoice('inv-1', '', { uid: 'u1' }, true);
    assert(false, 'cancelInvoice must reject empty cancellation reason');
  } catch (e) {
    assert(true, 'cancelInvoice enforces mandatory cancellation reason');
  }

  console.log('\n=====================================================');
  console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Invoice Module test suite.`);
  }
}
