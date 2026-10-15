import { OutwardService } from '../outwardService';
import {
  outwardFormSchema,
  outwardDraftSchema,
  outwardReversalSchema,
  calculateOutwardLineBalances,
  calculateOutwardTotalsByUnit
} from '../../schemas/outwardSchema';
import { calculateStatementSummaries } from '../../utils/calculations';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry } from '../../types/inward';
import { OutwardEntry } from '../../types/outward';

export async function runOutwardTests() {
  console.log('=====================================================');
  console.log('--- STARTING OUTWARD DISPATCH MODULE TEST SUITE ---');
  console.log('=====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`, errorDetail || '');
      failed++;
    }
  }

  // Test Customer
  const testCustomer: Vendor = {
    vendorId: 'v-test-cust-out',
    id: 'v-test-cust-out',
    vendorCode: 'VND-000201',
    companyName: 'Paramount Garments Corporation',
    legalCompanyName: 'Paramount Garments Corporation India Ltd',
    vendorType: 'customer',
    vendorCategory: 'main_company',
    parentVendorId: null,
    address: {
      addressLine1: 'SIDCO Industrial Estate',
      city: 'Thirumudivakkam',
      state: 'Tamil Nadu',
      country: 'India'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33AAACP9999P1Z1'
    },
    financialDetails: { paymentTerms: '30_days' },
    communication: {},
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'test-admin',
    updatedAt: new Date().toISOString(),
    updatedBy: 'test-admin',
    schemaVersion: 1
  };

  // Test Subcontractor
  const testSubcontractor: Vendor = {
    vendorId: 'v-test-sub-out',
    id: 'v-test-sub-out',
    vendorCode: 'VND-000202',
    companyName: 'Paramount Finishing Works Unit 2',
    vendorType: 'supplier',
    vendorCategory: 'subcontractor',
    parentVendorId: 'v-test-cust-out',
    address: {
      addressLine1: 'Plot 15 Phase II',
      city: 'Thirumudivakkam',
      state: 'Tamil Nadu',
      country: 'India'
    },
    taxDetails: { gstRegistrationStatus: 'unregistered' },
    financialDetails: { paymentTerms: '15_days' },
    communication: {},
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'test-admin',
    updatedAt: new Date().toISOString(),
    updatedBy: 'test-admin',
    schemaVersion: 1
  };

  // Test PO
  const testPO: PurchaseOrder = {
    id: 'po-test-outw-1',
    poId: 'po-test-outw-1',
    poNumber: 'PO/2026-27/0088',
    customerId: 'v-test-cust-out',
    customerVendorId: 'v-test-cust-out',
    customerCode: 'VND-000201',
    customerName: 'Paramount Garments Corporation',
    processCategory: 'washing',
    styleNo: 'ST-CHINO-770',
    itemName: "Men's Cotton Chino Trousers",
    orderDate: '2026-10-05',
    colourLines: [
      {
        id: 'pol-khaki',
        lineId: 'pol-khaki',
        colourName: 'Desert Khaki',
        colourCode: '16-1108',
        processType: 'Softener Silicone Wash',
        quantity: 1500,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 22,
        amount: 33000
      },
      {
        id: 'pol-olive',
        lineId: 'pol-olive',
        colourName: 'Army Olive',
        colourCode: '18-0521',
        processType: 'Enzyme Heavy Wash',
        quantity: 1200,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 24,
        amount: 28800
      },
      {
        id: 'pol-raw-fabric',
        lineId: 'pol-raw-fabric',
        colourName: 'Natural Greige',
        colourCode: '11-0601',
        processType: 'Bleach & Neutralization',
        quantity: 250,
        unit: 'kg',
        rateBasis: 'per_kg',
        rate: 45,
        amount: 11250
      }
    ],
    lines: [],
    totalQtyByUnit: { piece: 2700, kg: 250 },
    totalQuantity: 2950,
    totalAmount: 73050,
    currency: 'INR',
    status: 'approved',
    revision: 1,
    createdAt: new Date().toISOString(),
    createdBy: 'test-admin',
    updatedAt: new Date().toISOString(),
    updatedBy: 'test-admin',
    schemaVersion: 1
  };
  testPO.lines = testPO.colourLines;

  // Mock Inwards:
  // Inward Receipt 1: Khaki: 1000 pcs, Olive: 600 pcs, Fabric: 150 kg
  // Inward Receipt 2: Khaki: 500 pcs, Olive: 400 pcs, Fabric: 100 kg
  // Total Inward: Khaki = 1500 pcs, Olive = 1000 pcs, Fabric = 250 kg
  const mockInward1: InwardEntry = {
    id: 'inw-test-1',
    inwardId: 'inw-test-1',
    inwardNo: 'INW/2026-27/0071',
    entryId: 'INW/2026-27/0071',
    poId: 'po-test-outw-1',
    poNumberSnapshot: 'PO/2026-27/0088',
    customerVendorId: 'v-test-cust-out',
    customerCompanyNameSnapshot: 'Paramount Garments Corporation',
    styleNoSnapshot: 'ST-CHINO-770',
    itemNameSnapshot: "Men's Cotton Chino Trousers",
    processCategorySnapshot: 'washing',
    customerDate: '2026-10-06',
    customerDcNo: 'DC-PARAMOUNT-101',
    inwardDate: '2026-10-06',
    status: 'posted',
    totalQtyByUnit: { piece: 1600, kg: 150 },
    totalQuantity: 1750,
    createdBy: 'test-admin',
    createdAt: '2026-10-06T10:00:00Z',
    updatedBy: 'test-admin',
    updatedAt: '2026-10-06T10:00:00Z',
    lines: [
      {
        inwardLineId: 'inl-1',
        inwardId: 'inw-test-1',
        poId: 'po-test-outw-1',
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Softener Silicone Wash',
        orderedQtySnapshot: 1500,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 1000,
        cumulativeReceivedQtySnapshot: 1000,
        balanceAfterReceiptSnapshot: 500
      },
      {
        inwardLineId: 'inl-2',
        inwardId: 'inw-test-1',
        poId: 'po-test-outw-1',
        poLineId: 'pol-olive',
        colourNameSnapshot: 'Army Olive',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Enzyme Heavy Wash',
        orderedQtySnapshot: 1200,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 600,
        cumulativeReceivedQtySnapshot: 600,
        balanceAfterReceiptSnapshot: 600
      },
      {
        inwardLineId: 'inl-3',
        inwardId: 'inw-test-1',
        poId: 'po-test-outw-1',
        poLineId: 'pol-raw-fabric',
        colourNameSnapshot: 'Natural Greige',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Bleach & Neutralization',
        orderedQtySnapshot: 250,
        unit: 'kg',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 150,
        cumulativeReceivedQtySnapshot: 150,
        balanceAfterReceiptSnapshot: 100
      }
    ],
    schemaVersion: 1
  };

  const mockInward2: InwardEntry = {
    id: 'inw-test-2',
    inwardId: 'inw-test-2',
    inwardNo: 'INW/2026-27/0072',
    entryId: 'INW/2026-27/0072',
    poId: 'po-test-outw-1',
    poNumberSnapshot: 'PO/2026-27/0088',
    customerVendorId: 'v-test-cust-out',
    customerCompanyNameSnapshot: 'Paramount Garments Corporation',
    styleNoSnapshot: 'ST-CHINO-770',
    itemNameSnapshot: "Men's Cotton Chino Trousers",
    processCategorySnapshot: 'washing',
    customerDate: '2026-10-08',
    customerDcNo: 'DC-PARAMOUNT-102',
    inwardDate: '2026-10-08',
    status: 'posted',
    totalQtyByUnit: { piece: 900, kg: 100 },
    totalQuantity: 1000,
    createdBy: 'test-admin',
    createdAt: '2026-10-08T10:00:00Z',
    updatedBy: 'test-admin',
    updatedAt: '2026-10-08T10:00:00Z',
    lines: [
      {
        inwardLineId: 'inl-4',
        inwardId: 'inw-test-2',
        poId: 'po-test-outw-1',
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Softener Silicone Wash',
        orderedQtySnapshot: 1500,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 1000,
        receivedQty: 500,
        cumulativeReceivedQtySnapshot: 1500,
        balanceAfterReceiptSnapshot: 0
      },
      {
        inwardLineId: 'inl-5',
        inwardId: 'inw-test-2',
        poId: 'po-test-outw-1',
        poLineId: 'pol-olive',
        colourNameSnapshot: 'Army Olive',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Enzyme Heavy Wash',
        orderedQtySnapshot: 1200,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 600,
        receivedQty: 400,
        cumulativeReceivedQtySnapshot: 1000,
        balanceAfterReceiptSnapshot: 200
      },
      {
        inwardLineId: 'inl-6',
        inwardId: 'inw-test-2',
        poId: 'po-test-outw-1',
        poLineId: 'pol-raw-fabric',
        colourNameSnapshot: 'Natural Greige',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Bleach & Neutralization',
        orderedQtySnapshot: 250,
        unit: 'kg',
        previouslyReceivedQtySnapshot: 150,
        receivedQty: 100,
        cumulativeReceivedQtySnapshot: 250,
        balanceAfterReceiptSnapshot: 0
      }
    ],
    schemaVersion: 1
  };

  // TEST 1: Balance Calculation from Cumulative Inwards & Previous Outwards
  console.log('\n--- Test 1: Available Balance Calculations ---');
  const lineCalcKhaki = calculateOutwardLineBalances(
    {
      poLineId: 'pol-khaki',
      colourName: 'Desert Khaki',
      itemName: 'Trousers',
      processType: 'Softener',
      orderedQty: 1500,
      unit: 'piece'
    },
    1500, // Cumulative received across 2 receipts
    500,  // Previously dispatched in earlier DC
    800   // Current DC dispatch
  );

  assert(
    lineCalcKhaki.availableQty === 1000,
    'Available quantity = Cumulative Inward (1500) - Prev Outward (500) = 1000 pcs'
  );
  assert(
    lineCalcKhaki.remainingAfterDispatch === 200,
    'Remaining after dispatch = Available (1000) - Current (800) = 200 pcs'
  );

  // TEST 2: Distinct Unit Aggregation (Pieces vs Kg Never Mixed)
  console.log('\n--- Test 2: Unit Segregation (Piece and Kg) ---');
  const testLinesForAggregation = [
    { unit: 'piece' as const, dispatchQty: 800 },
    { unit: 'piece' as const, dispatchQty: 600 },
    { unit: 'kg' as const, dispatchQty: 120.5 }
  ];
  const unitTotals = calculateOutwardTotalsByUnit(testLinesForAggregation);
  assert(
    unitTotals.totalQtyByUnit.piece === 1400,
    'Total pieces accurately aggregated: 1400 pcs'
  );
  assert(
    unitTotals.totalQtyByUnit.kg === 120.5,
    'Total weight accurately aggregated: 120.5 kg'
  );

  // TEST 3: Validation Schema - Over-Dispatch Rejection
  console.log('\n--- Test 3: Validation Schema - Rejection of Over-Dispatch ---');
  const overDispatchData = {
    customerVendorId: 'v-test-cust-out',
    poId: 'po-test-outw-1',
    outwardDate: '2026-10-15',
    ourDcNo: 'DC-PERLA-1045',
    lines: [
      {
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        itemNameSnapshot: 'Chino',
        washTypeSnapshot: 'Softener',
        orderedQtySnapshot: 1500,
        unit: 'piece' as const,
        cumulativeInwardQtySnapshot: 1000,
        previouslyDispatchedQtySnapshot: 400,
        availableForDispatchSnapshot: 600,
        dispatchQty: 750 // 750 > 600 available! Must be rejected
      }
    ]
  };
  const overDispatchResult = outwardFormSchema.safeParse(overDispatchData);
  assert(
    !overDispatchResult.success,
    'Form schema strictly rejects dispatch quantities exceeding available inward balance'
  );

  // TEST 4: Validation Schema - At Least One Positive Dispatch Required
  console.log('\n--- Test 4: Validation Schema - Positive Dispatch Requirement ---');
  const zeroDispatchData = {
    customerVendorId: 'v-test-cust-out',
    poId: 'po-test-outw-1',
    outwardDate: '2026-10-15',
    ourDcNo: 'DC-PERLA-1045',
    lines: [
      {
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        itemNameSnapshot: 'Chino',
        washTypeSnapshot: 'Softener',
        orderedQtySnapshot: 1500,
        unit: 'piece' as const,
        cumulativeInwardQtySnapshot: 1000,
        previouslyDispatchedQtySnapshot: 400,
        availableForDispatchSnapshot: 600,
        dispatchQty: 0
      }
    ]
  };
  const zeroDispatchResult = outwardFormSchema.safeParse(zeroDispatchData);
  assert(
    !zeroDispatchResult.success,
    'Form schema rejects submissions where all dispatch quantities are zero'
  );

  // TEST 5: Negative Quantities Rejected
  console.log('\n--- Test 5: Validation Schema - Negative Quantities Rejection ---');
  const negativeDispatchData = {
    customerVendorId: 'v-test-cust-out',
    poId: 'po-test-outw-1',
    outwardDate: '2026-10-15',
    ourDcNo: 'DC-PERLA-1045',
    lines: [
      {
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        itemNameSnapshot: 'Chino',
        washTypeSnapshot: 'Softener',
        orderedQtySnapshot: 1500,
        unit: 'piece' as const,
        cumulativeInwardQtySnapshot: 1000,
        previouslyDispatchedQtySnapshot: 400,
        availableForDispatchSnapshot: 600,
        dispatchQty: -50
      }
    ]
  };
  const negativeResult = outwardFormSchema.safeParse(negativeDispatchData);
  assert(!negativeResult.success, 'Form schema rejects negative dispatch quantities');

  // TEST 6: Unique Outward Number Generation
  console.log('\n--- Test 6: Unique Outward Numbering ---');
  const outNo = await OutwardService.generateOutwardNumber('2026-10-15', true);
  assert(
    /^OUT\/\d{4}-\d{2}\/\d{4}$/.test(outNo),
    `Outward number format OUT/YYYY-YY/XXXX confirmed: ${outNo}`
  );

  // TEST 7: Reversal Schema Validation
  console.log('\n--- Test 7: Controlled Reversal Validation ---');
  const invalidReversal = outwardReversalSchema.safeParse({ reversalReason: 'Bad' });
  assert(!invalidReversal.success, 'Rejection of too-short reversal reasons (< 5 chars)');

  const validReversal = outwardReversalSchema.safeParse({
    reversalReason: 'Customer quality rejection on lot 1, garments returned for re-washing.'
  });
  assert(validReversal.success, 'Acceptance of valid, detailed reversal reason');

  // TEST 8: Statement Module Reconciliation & Invoice Readiness
  console.log('\n--- Test 8: Statement Reconciliation & Invoice Readiness ---');
  const mockOutwardPosted1: OutwardEntry = {
    id: 'out-test-post-1',
    outwardId: 'out-test-post-1',
    outwardNo: 'OUT/2026-27/0050',
    poId: 'po-test-outw-1',
    poNumber: 'PO/2026-27/0088',
    poNumberSnapshot: 'PO/2026-27/0088',
    customerVendorId: 'v-test-cust-out',
    customerCompanyNameSnapshot: 'Paramount Garments Corporation',
    styleNoSnapshot: 'ST-CHINO-770',
    itemNameSnapshot: "Men's Cotton Chino Trousers",
    processCategorySnapshot: 'washing',
    outwardDate: '2026-10-10',
    ourDcNo: 'DC-PERLA-1041',
    status: 'posted',
    totalQtyByUnit: { piece: 1500, kg: 0 },
    totalQuantity: 1500,
    createdBy: 'test-admin',
    createdAt: '2026-10-10T12:00:00Z',
    updatedBy: 'test-admin',
    updatedAt: '2026-10-10T12:00:00Z',
    schemaVersion: 1,
    lines: [
      {
        outwardLineId: 'outl-k1',
        outwardId: 'out-test-post-1',
        poId: 'po-test-outw-1',
        poLineId: 'pol-khaki',
        colourNameSnapshot: 'Desert Khaki',
        colour: 'Desert Khaki',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Softener Silicone Wash',
        orderedQtySnapshot: 1500,
        unit: 'piece',
        cumulativeInwardQtySnapshot: 1500,
        previouslyDispatchedQtySnapshot: 0,
        availableForDispatchSnapshot: 1500,
        dispatchQty: 1500, // Fully dispatched! (Total Inward = 1500, Total Outward = 1500)
        remainingAfterDispatchSnapshot: 0
      },
      {
        outwardLineId: 'outl-o1',
        outwardId: 'out-test-post-1',
        poId: 'po-test-outw-1',
        poLineId: 'pol-olive',
        colourNameSnapshot: 'Army Olive',
        colour: 'Army Olive',
        itemNameSnapshot: "Men's Cotton Chino Trousers",
        washTypeSnapshot: 'Enzyme Heavy Wash',
        orderedQtySnapshot: 1200,
        unit: 'piece',
        cumulativeInwardQtySnapshot: 1000,
        previouslyDispatchedQtySnapshot: 0,
        availableForDispatchSnapshot: 1000,
        dispatchQty: 400, // Partial dispatch (Inward = 1000, Outward = 400, Difference = 600)
        remainingAfterDispatchSnapshot: 600
      }
    ]
  };

  const statementSummaries = calculateStatementSummaries(
    [testPO],
    [mockInward1, mockInward2],
    [mockOutwardPosted1]
  );

  const khakiSummary = statementSummaries.find((s) => s.poLineId === 'pol-khaki');
  const oliveSummary = statementSummaries.find((s) => s.poLineId === 'pol-olive');

  assert(
    khakiSummary?.cumulativeInward === 1500 &&
      khakiSummary?.cumulativeOutward === 1500 &&
      khakiSummary?.difference === 0,
    'Khaki line reconciled: Inward 1500 == Outward 1500, Difference = 0'
  );

  assert(
    khakiSummary?.isReadyForInvoice === true,
    'Khaki line is marked Ready For Invoice because cumulative inward equals cumulative outward'
  );

  assert(
    oliveSummary?.cumulativeInward === 1000 &&
      oliveSummary?.cumulativeOutward === 400 &&
      oliveSummary?.difference === 600,
    'Olive line shows pending outward balance of 600 pcs'
  );

  assert(
    oliveSummary?.isReadyForInvoice === false,
    'Olive line is NOT ready for invoice approval because dispatches are still pending'
  );

  // TEST 9: Draft Outward Exclusion from Statement Totals
  console.log('\n--- Test 9: Draft Dispatches Excluded from Statement Totals ---');
  const mockDraftOutward: OutwardEntry = {
    ...mockOutwardPosted1,
    id: 'out-draft-99',
    outwardId: 'out-draft-99',
    outwardNo: 'OUT/DRAFT',
    status: 'draft',
    lines: [
      {
        ...mockOutwardPosted1.lines[1],
        outwardLineId: 'outl-draft-o2',
        dispatchQty: 600 // Draft dispatch for remaining olive
      }
    ]
  };

  const statementWithDraft = calculateStatementSummaries(
    [testPO],
    [mockInward1, mockInward2],
    [mockOutwardPosted1, mockDraftOutward]
  );
  const oliveWithDraft = statementWithDraft.find((s) => s.poLineId === 'pol-olive');

  assert(
    oliveWithDraft?.cumulativeOutward === 400,
    'Draft dispatches do NOT count towards cumulative outward in statement totals'
  );

  // SUMMARY
  console.log('\n=====================================================');
  console.log(`OUTWARD MODULE TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log('=====================================================');

  return { passed, failed };
}
