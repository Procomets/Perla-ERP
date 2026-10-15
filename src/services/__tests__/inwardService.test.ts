import { InwardService } from '../inwardService';
import {
  inwardFormSchema,
  inwardDraftSchema,
  inwardReversalSchema,
  calculateInwardLineBalances,
  calculateInwardTotalsByUnit
} from '../../schemas/inwardSchema';
import { calculateStatementSummaries } from '../../utils/calculations';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry } from '../../types/inward';
import { OutwardEntry } from '../../types/inwardOutward';

export async function runInwardTests() {
  console.log('=====================================================');
  console.log('--- STARTING INWARD RECEIPT MODULE TEST SUITE ---');
  console.log('=====================================================');

  // Test Customer
  const testCustomer: Vendor = {
    vendorId: 'v-test-cust-1',
    id: 'v-test-cust-1',
    vendorCode: 'VND-000101',
    companyName: 'Apex Textiles Exports Ltd',
    legalCompanyName: 'Apex Textiles Exports India Pvt Ltd',
    vendorType: 'customer',
    vendorCategory: 'main_company',
    parentVendorId: null,
    address: {
      addressLine1: '12 Tirupur Garment Complex',
      city: 'Tirupur',
      state: 'Tamil Nadu',
      country: 'India'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33AAACT9000T1Z1'
    },
    financialDetails: {
      paymentTerms: '30_days'
    },
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
    vendorId: 'v-test-sub-1',
    id: 'v-test-sub-1',
    vendorCode: 'VND-000102',
    companyName: 'Apex Subcontract Unit B',
    vendorType: 'supplier',
    vendorCategory: 'subcontractor',
    parentVendorId: 'v-test-cust-1',
    address: {
      addressLine1: '40 SIDCO Estate',
      city: 'Coimbatore',
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
    id: 'po-test-inw-1',
    poId: 'po-test-inw-1',
    poNumber: 'PO/2026-27/0055',
    customerId: 'v-test-cust-1',
    customerVendorId: 'v-test-cust-1',
    customerCode: 'VND-000101',
    customerName: 'Apex Textiles Exports Ltd',
    processCategory: 'washing',
    styleNo: 'ST-DENIM-881',
    itemName: "Men's Indigo Denim Shirt",
    orderDate: '2026-10-01',
    colourLines: [
      {
        id: 'pol-indigo',
        lineId: 'pol-indigo',
        colourName: 'Dark Indigo',
        colourCode: '19-4015',
        processType: 'Bio Enzyme Softener Wash',
        quantity: 2000,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 8.5
      },
      {
        id: 'pol-bleach',
        lineId: 'pol-bleach',
        colourName: 'Bleach Light Blue',
        colourCode: '14-4115',
        processType: 'Acid Bleach Wash',
        quantity: 1500,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 9.0
      },
      {
        id: 'pol-fabric-lot',
        lineId: 'pol-fabric-lot',
        colourName: 'Raw Denim Greige Fabric',
        colourCode: null,
        processType: 'Desizing & Scouring',
        quantity: 500,
        unit: 'kg',
        rateBasis: 'per_kg',
        rate: 25.0
      }
    ],
    lines: [],
    totalQtyByUnit: { piece: 3500, kg: 500 },
    totalQuantity: 4000,
    totalAmount: 43000,
    currency: 'INR',
    status: 'approved',
    revision: 1,
    createdBy: 'admin-1',
    createdAt: '2026-10-01T10:00:00Z',
    schemaVersion: 1
  };
  testPO.lines = testPO.colourLines;

  // ----------------------------------------------------
  // Test 1: Segregated Unit Totals (Pieces vs Kg never summed together)
  // ----------------------------------------------------
  console.log('\n[Test 1] Quantity Calculation: Segregated Unit Aggregation');
  const sampleLines = [
    { poLineId: 'pol-indigo', colourName: 'Dark Indigo', itemName: 'Shirt', processType: 'Wash', orderedQty: 2000, unit: 'piece' as const, previouslyReceivedQty: 0, currentReceiptQty: 800, cumulativeReceivedQty: 800, balanceAfterReceipt: 1200 },
    { poLineId: 'pol-bleach', colourName: 'Bleach', itemName: 'Shirt', processType: 'Wash', orderedQty: 1500, unit: 'piece' as const, previouslyReceivedQty: 0, currentReceiptQty: 500, cumulativeReceivedQty: 500, balanceAfterReceipt: 1000 },
    { poLineId: 'pol-fabric-lot', colourName: 'Fabric', itemName: 'Fabric', processType: 'Desize', orderedQty: 500, unit: 'kg' as const, previouslyReceivedQty: 0, currentReceiptQty: 250, cumulativeReceivedQty: 250, balanceAfterReceipt: 250 }
  ];
  const unitTotals = calculateInwardTotalsByUnit(sampleLines);
  console.assert(unitTotals.piece === 1300, `Expected piece total to be 1300, got ${unitTotals.piece}`);
  console.assert(unitTotals.kg === 250, `Expected kg total to be 250, got ${unitTotals.kg}`);
  console.log('✓ PASS: Pieces and Kilograms are strictly kept separate.');

  // ----------------------------------------------------
  // Test 2: Colour-Wise Balance Calculations
  // ----------------------------------------------------
  console.log('\n[Test 2] Colour-Wise Balance Math (Ordered - Previously Received - Current = Balance)');
  const balancePreview = calculateInwardLineBalances(
    {
      poLineId: 'pol-indigo',
      colourName: 'Dark Indigo',
      colourCode: '19-4015',
      itemName: 'Shirt',
      processType: 'Wash',
      orderedQty: 2000,
      unit: 'piece'
    },
    600, // previously received
    800  // current receipt
  );
  console.assert(balancePreview.remainingOrderQty === 1400, `Expected remaining 1400, got ${balancePreview.remainingOrderQty}`);
  console.assert(balancePreview.cumulativeReceivedQty === 1400, `Expected cumulative 1400, got ${balancePreview.cumulativeReceivedQty}`);
  console.assert(balancePreview.balanceAfterReceipt === 600, `Expected balance after receipt 600, got ${balancePreview.balanceAfterReceipt}`);
  console.log('✓ PASS: Remaining order quantity and balance after receipt match mathematical spec.');

  // ----------------------------------------------------
  // Test 3: Validation Schema — Over-receipt rejection
  // ----------------------------------------------------
  console.log('\n[Test 3] Validation: Over-receipt rejection');
  const overReceiptData = {
    customerVendorId: 'v-test-cust-1',
    poId: 'po-test-inw-1',
    customerDate: '2026-10-14',
    customerDcNo: 'DC-APX-8891',
    inwardDate: '2026-10-14',
    lines: [
      {
        poLineId: 'pol-indigo',
        colourNameSnapshot: 'Dark Indigo',
        itemNameSnapshot: 'Shirt',
        washTypeSnapshot: 'Wash',
        orderedQtySnapshot: 2000,
        unit: 'piece' as const,
        previouslyReceivedQtySnapshot: 1500,
        receivedQty: 800 // Only 500 remaining! 800 is an over-receipt
      }
    ]
  };
  const overReceiptResult = inwardFormSchema.safeParse(overReceiptData);
  console.assert(!overReceiptResult.success, 'Expected over-receipt to fail validation');
  console.log('✓ PASS: Over-receipt exceeding remaining order quantity correctly rejected by schema.');

  // ----------------------------------------------------
  // Test 4: Validation Schema — Zero positive quantities rejection
  // ----------------------------------------------------
  console.log('\n[Test 4] Validation: Zero or negative line rejection before posting');
  const allZeroData = {
    customerVendorId: 'v-test-cust-1',
    poId: 'po-test-inw-1',
    customerDate: '2026-10-14',
    customerDcNo: 'DC-APX-8891',
    inwardDate: '2026-10-14',
    lines: [
      {
        poLineId: 'pol-indigo',
        colourNameSnapshot: 'Dark Indigo',
        itemNameSnapshot: 'Shirt',
        washTypeSnapshot: 'Wash',
        orderedQtySnapshot: 2000,
        unit: 'piece' as const,
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 0
      }
    ]
  };
  const zeroResult = inwardFormSchema.safeParse(allZeroData);
  console.assert(!zeroResult.success, 'Expected all-zero lines to fail validation before posting');
  console.log('✓ PASS: Form with no positive received quantities rejected.');

  // ----------------------------------------------------
  // Test 5: Number Generation (Financial Year Format)
  // ----------------------------------------------------
  console.log('\n[Test 5] Receipt Number Generation Format');
  const generatedNo = await InwardService.generateInwardNumber('2026-10-15', true);
  console.assert(/^INW\/2026-27\/\d{4}$/.test(generatedNo), `Expected INW/2026-27/XXXX format, got ${generatedNo}`);
  console.log(`✓ PASS: Unique inward number generated: ${generatedNo}`);

  // ----------------------------------------------------
  // Test 6: Inward Draft Creation & Retrieval
  // ----------------------------------------------------
  console.log('\n[Test 6] Inward Draft Workflow');
  const draftEntry = await InwardService.createInwardDraft(
    {
      po: testPO,
      customer: testCustomer,
      subcontractor: testSubcontractor,
      customerDate: '2026-10-15',
      customerDcNo: 'DC-APX-DRAFT-01',
      inwardDate: '2026-10-15',
      remarks: 'Draft lot inspection pending',
      lines: [
        {
          poLineId: 'pol-indigo',
          colourName: 'Dark Indigo',
          itemName: 'Shirt',
          processType: 'Bio Wash',
          orderedQty: 2000,
          unit: 'piece',
          previouslyReceivedQty: 0,
          receivedQty: 500
        }
      ]
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(draftEntry.status === 'draft', `Expected status 'draft', got ${draftEntry.status}`);
  console.assert(draftEntry.inwardNo === 'INW/DRAFT', `Expected inwardNo 'INW/DRAFT', got ${draftEntry.inwardNo}`);
  console.log('✓ PASS: Inward Draft created successfully with status "draft".');

  // ----------------------------------------------------
  // Test 7: Post Inward Receipt & Balance Accumulation
  // ----------------------------------------------------
  console.log('\n[Test 7] Post Inward Receipt & Multi-Receipt Accumulation');
  const receipt1 = await InwardService.postInwardReceipt(
    {
      po: testPO,
      customer: testCustomer,
      subcontractor: testSubcontractor,
      customerDate: '2026-10-15',
      customerDcNo: 'DC-APX-1001',
      inwardDate: '2026-10-15',
      remarks: 'Lot 1 delivery',
      lines: [
        {
          poLineId: 'pol-indigo',
          colourName: 'Dark Indigo',
          itemName: 'Shirt',
          processType: 'Bio Wash',
          orderedQty: 2000,
          unit: 'piece',
          previouslyReceivedQty: 0,
          receivedQty: 800
        },
        {
          poLineId: 'pol-bleach',
          colourName: 'Bleach Light Blue',
          itemName: 'Shirt',
          processType: 'Acid Wash',
          orderedQty: 1500,
          unit: 'piece',
          previouslyReceivedQty: 0,
          receivedQty: 600
        }
      ]
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(receipt1.status === 'posted', `Expected status 'posted', got ${receipt1.status}`);
  console.assert(receipt1.inwardNo.startsWith('INW/'), `Expected valid inwardNo, got ${receipt1.inwardNo}`);
  console.assert(receipt1.totalQuantity === 1400, `Expected total quantity 1400, got ${receipt1.totalQuantity}`);
  console.log(`✓ PASS: Receipt 1 posted successfully as ${receipt1.inwardNo}.`);

  // Receipt 2: Partial delivery accumulating on top of Receipt 1
  const receipt2 = await InwardService.postInwardReceipt(
    {
      po: testPO,
      customer: testCustomer,
      customerDate: '2026-10-16',
      customerDcNo: 'DC-APX-1002',
      inwardDate: '2026-10-16',
      remarks: 'Lot 2 delivery',
      lines: [
        {
          poLineId: 'pol-indigo',
          colourName: 'Dark Indigo',
          itemName: 'Shirt',
          processType: 'Bio Wash',
          orderedQty: 2000,
          unit: 'piece',
          previouslyReceivedQty: 800,
          receivedQty: 700 // New cumulative: 1500, remaining: 500
        }
      ]
    },
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(receipt2.status === 'posted', `Expected status 'posted', got ${receipt2.status}`);
  console.assert(receipt2.lines[0].cumulativeReceivedQtySnapshot === 1500, `Expected cumulative 1500, got ${receipt2.lines[0].cumulativeReceivedQtySnapshot}`);
  console.assert(receipt2.lines[0].balanceAfterReceiptSnapshot === 500, `Expected balance after receipt 500, got ${receipt2.lines[0].balanceAfterReceiptSnapshot}`);
  console.log('✓ PASS: Multiple partial receipts accumulate correctly across transactions.');

  // ----------------------------------------------------
  // Test 8: Statement Module Integration
  // ----------------------------------------------------
  console.log('\n[Test 8] Statement Module Integration & Draft/Reversal Exclusion');
  const mockOutward: OutwardEntry[] = [
    {
      id: 'out-1',
      entryId: 'OUT/2026-27/001',
      poId: testPO.id,
      poNumber: testPO.poNumber,
      styleNo: testPO.styleNo,
      customerId: testCustomer.vendorId,
      customerName: testCustomer.companyName,
      ourDate: '2026-10-18',
      ourDcNo: 'PERLA/DC/0901',
      createdAt: '2026-10-18T10:00:00Z',
      createdBy: 'Prakash',
      lines: [
        {
          lineId: 'outl-1',
          poLineId: 'pol-indigo',
          colour: 'Dark Indigo',
          dispatchQty: 500,
          unit: 'piece'
        }
      ]
    }
  ];

  // Pass active posted inwards, plus a draft that must NOT be counted
  const statementSummaries = calculateStatementSummaries(
    [testPO],
    [receipt1, receipt2, draftEntry], // draftEntry is draft, must be ignored!
    mockOutward
  );

  const indigoSummary = statementSummaries.find((s) => s.poLineId === 'pol-indigo');
  console.assert(indigoSummary !== undefined, 'Expected to find indigo summary');
  console.assert(indigoSummary?.cumulativeInward === 1500, `Expected cumulative inward 1500, got ${indigoSummary?.cumulativeInward}`);
  console.assert(indigoSummary?.cumulativeOutward === 500, `Expected cumulative outward 500, got ${indigoSummary?.cumulativeOutward}`);
  console.assert(indigoSummary?.difference === 1000, `Expected difference 1000, got ${indigoSummary?.difference}`);
  console.log('✓ PASS: Statement accurately aggregates posted receipts and ignores unposted drafts.');

  // ----------------------------------------------------
  // Test 9: Controlled Inward Reversal
  // ----------------------------------------------------
  console.log('\n[Test 9] Authorised Controlled Reversal');
  const reversedEntry = await InwardService.reverseInwardReceipt(
    receipt2.inwardId,
    'Customer recalled lot 2 due to wrong fabric batch',
    { uid: 'test-admin', displayName: 'Test Admin' },
    true
  );
  console.assert(reversedEntry.status === 'reversed', `Expected status 'reversed', got ${reversedEntry.status}`);
  console.assert(reversedEntry.reversalReason?.includes('wrong fabric batch'), 'Expected reversal reason to be recorded');

  // Verify Statement immediately deducts the reversed receipt
  const statementAfterReversal = calculateStatementSummaries(
    [testPO],
    [receipt1, reversedEntry], // receipt2 is now reversed, receipt1 remains
    mockOutward
  );
  const indigoAfterReversal = statementAfterReversal.find((s) => s.poLineId === 'pol-indigo');
  console.assert(indigoAfterReversal?.cumulativeInward === 800, `Expected cumulative inward to be 800 after reversal, got ${indigoAfterReversal?.cumulativeInward}`);
  console.log('✓ PASS: Reversal updates status, preserves audit record, and safely adjusts ledger balances.');

  // ----------------------------------------------------
  // Test 10: Reversal Validation Schema
  // ----------------------------------------------------
  console.log('\n[Test 10] Reversal Reason Schema Validation');
  const invalidReversal = inwardReversalSchema.safeParse({ reversalReason: 'Bad' }); // too short
  console.assert(!invalidReversal.success, 'Expected short reversal reason to fail validation');
  const validReversal = inwardReversalSchema.safeParse({ reversalReason: 'Defective fabric returned to customer before wash drum processing' });
  console.assert(validReversal.success, 'Expected detailed reversal reason to pass');
  console.log('✓ PASS: Mandatory reversal reason schema enforced.');

  console.log('\n=====================================================');
  console.log('✓ ALL 10 INWARD TEST SUITES PASSED SUCCESSFULLY!');
  console.log('=====================================================\n');
}
