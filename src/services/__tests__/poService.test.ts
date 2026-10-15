import { POService } from '../poService';
import {
  calculateLineAmount,
  calculatePOTotals,
  purchaseOrderFormSchema,
  poColourLineSchema
} from '../../schemas/poSchema';
import { Vendor } from '../../types/vendor';
import { POColourLine, PurchaseOrder } from '../../types/po';

export async function runPurchaseOrderTests() {
  console.log('--- Starting Purchase Order (PO) Test Suite ---');

  // Test Customer
  const testCustomer: Vendor = {
    vendorId: 'v-test-101',
    vendorCode: 'VND-000101',
    companyName: 'Test Apparel Processing Ltd',
    vendorType: 'customer',
    vendorCategory: 'main_company',
    address: {
      addressLine1: '100 Industrial Estate',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33AAACT1234T1Z8'
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

  const testUser = {
    uid: 'test-user-id',
    displayName: 'Thiru M. (Manager)'
  };

  // 1. Line Amount Calculation Tests
  console.log('Test 1: Rate & Amount Calculations');
  const perPieceLine: POColourLine = {
    lineId: 'line-1',
    colourName: 'Indigo Blue',
    processType: 'Softener Wash',
    quantity: 1500,
    unit: 'piece',
    rateBasis: 'per_piece',
    rate: 6.0
  };
  const amountPiece = calculateLineAmount(perPieceLine);
  console.assert(amountPiece === 9000, `Expected 9000, got ${amountPiece}`);

  const perKgLine: POColourLine = {
    lineId: 'line-2',
    colourName: 'Navy Blue',
    processType: 'Reactive Dyeing',
    quantity: 500,
    unit: 'kg',
    rateBasis: 'per_kg',
    rate: 45.0
  };
  const amountKg = calculateLineAmount(perKgLine);
  console.assert(amountKg === 22500, `Expected 22500, got ${amountKg}`);

  // Piece with per_kg rate basis and billable weight
  const pieceWithKgRateLine: POColourLine = {
    lineId: 'line-3',
    colourName: 'Vintage Charcoal',
    processType: 'Acid Wash',
    quantity: 1000,
    unit: 'piece',
    rateBasis: 'per_kg',
    rate: 18.0,
    billableWeightKg: 420.5
  };
  const amountPieceWithKg = calculateLineAmount(pieceWithKgRateLine);
  console.assert(
    amountPieceWithKg === Math.round(420.5 * 18.0 * 100) / 100,
    `Expected ${420.5 * 18.0}, got ${amountPieceWithKg}`
  );

  // 2. Total Calculation & Grouping by Unit
  console.log('Test 2: Total Quantities Grouped by Unit');
  const testLines: POColourLine[] = [
    {
      lineId: 'l1',
      colourName: 'Pantone Brunnet',
      processType: 'Softener Wash',
      quantity: 3066,
      unit: 'piece',
      rateBasis: 'per_piece',
      rate: 6
    },
    {
      lineId: 'l2',
      colourName: 'Pantone Blue Graphite',
      processType: 'Softener Wash',
      quantity: 2859,
      unit: 'piece',
      rateBasis: 'per_piece',
      rate: 6
    },
    {
      lineId: 'l3',
      colourName: 'Raw Fabric Dye',
      processType: 'Dyeing',
      quantity: 500,
      unit: 'kg',
      rateBasis: 'per_kg',
      rate: 30
    }
  ];
  const totals = calculatePOTotals(testLines);
  console.assert(
    totals.totalQtyByUnit.piece === 5925,
    `Expected 5925 pieces, got ${totals.totalQtyByUnit.piece}`
  );
  console.assert(
    totals.totalQtyByUnit.kg === 500,
    `Expected 500 kg, got ${totals.totalQtyByUnit.kg}`
  );
  console.assert(
    totals.totalQuantity === 6425,
    `Expected 6425 total qty, got ${totals.totalQuantity}`
  );

  // 3. Validation Schemas Tests
  console.log('Test 3: Schema Validations');
  // Incompatible unit/rateBasis without billable weight must fail
  const invalidIncompatible = poColourLineSchema.safeParse({
    colourName: 'Pink',
    processType: 'Softener Wash',
    quantity: 100,
    unit: 'piece',
    rateBasis: 'per_kg',
    rate: 10
    // Missing billableWeightKg!
  });
  console.assert(
    !invalidIncompatible.success,
    'Expected validation failure for Piece unit with per_kg rateBasis without billableWeightKg'
  );

  // Zero quantity must fail
  const invalidZeroQty = poColourLineSchema.safeParse({
    colourName: 'Pink',
    processType: 'Softener Wash',
    quantity: 0,
    unit: 'piece',
    rateBasis: 'per_piece',
    rate: 10
  });
  console.assert(
    !invalidZeroQty.success,
    'Expected validation failure for 0 quantity'
  );

  // Empty colour name must fail
  const invalidEmptyColour = poColourLineSchema.safeParse({
    colourName: '   ',
    processType: 'Softener Wash',
    quantity: 100,
    unit: 'piece',
    rateBasis: 'per_piece',
    rate: 10
  });
  console.assert(
    !invalidEmptyColour.success,
    'Expected validation failure for empty colour name'
  );

  // Duplicate colour + process check in PO
  const duplicateLines = purchaseOrderFormSchema.safeParse({
    customerId: 'v-1',
    processCategory: 'washing',
    styleNo: 'STYLE-DUP',
    itemName: 'Shirt',
    orderDate: '2026-10-12',
    colourLines: [
      {
        colourName: 'Black',
        processType: 'Enzyme Wash',
        quantity: 100,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 5
      },
      {
        colourName: 'Black',
        processType: 'Enzyme Wash',
        quantity: 200,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 5
      }
    ]
  });
  console.assert(
    !duplicateLines.success,
    'Expected validation failure for duplicate colour & process configuration'
  );

  // 4. Create Purchase Order with unique PO Number
  console.log('Test 4: PO Creation & Atomic Number Generation');
  const createdPO = await POService.createPurchaseOrder(
    {
      customerId: testCustomer.vendorId,
      processCategory: 'washing',
      styleNo: 'TEST-STYLE-2026',
      itemName: "Men's Cargo Pant",
      orderDate: '2026-10-12',
      colourLines: [
        {
          lineId: 'pol-c1',
          colourName: 'Olive Green',
          processType: 'Bio-Silicon Wash',
          quantity: 2500,
          unit: 'piece',
          rateBasis: 'per_piece',
          rate: 8.5
        }
      ],
      status: 'draft'
    },
    testCustomer,
    testUser,
    true
  );

  console.assert(
    createdPO.poNumber === 'PO/PENDING',
    `Expected draft PO number to be PO/PENDING, got ${createdPO.poNumber}`
  );
  console.assert(
    createdPO.status === 'draft',
    `Expected draft status, got ${createdPO.status}`
  );
  console.assert(
    createdPO.totalQuantity === 2500,
    `Expected totalQuantity 2500, got ${createdPO.totalQuantity}`
  );
  console.assert(
    createdPO.totalAmount === 21250,
    `Expected totalAmount 21250, got ${createdPO.totalAmount}`
  );

  // 5. Draft Reopen & Ordinary Edit
  console.log('Test 5: Editing Draft PO');
  const updatedPO = await POService.updatePurchaseOrder(
    createdPO.id,
    {
      itemName: "Men's Cargo Pant Updated",
      colourLines: [
        {
          lineId: 'pol-c1',
          colourName: 'Olive Green',
          processType: 'Bio-Silicon Wash',
          quantity: 3000,
          unit: 'piece',
          rateBasis: 'per_piece',
          rate: 8.5
        }
      ]
    },
    testUser,
    true
  );
  console.assert(
    updatedPO.totalQuantity === 3000,
    `Expected updated totalQuantity 3000, got ${updatedPO.totalQuantity}`
  );
  console.assert(
    updatedPO.itemName === "Men's Cargo Pant Updated",
    'Item name update check'
  );

  // 6. Workflow Transitions: Draft -> Submitted -> Approved
  console.log('Test 6: Status Transitions & Approvals');
  const submittedPO = await POService.submitPurchaseOrder(
    createdPO.id,
    testUser,
    true
  );
  console.assert(
    submittedPO.status === 'submitted',
    `Expected submitted status, got ${submittedPO.status}`
  );

  // Trying to edit submitted PO directly must be rejected
  let editSubmittedFailed = false;
  try {
    await POService.updatePurchaseOrder(
      createdPO.id,
      { itemName: 'Unauthorized change' },
      testUser,
      true
    );
  } catch (e) {
    editSubmittedFailed = true;
  }
  console.assert(
    editSubmittedFailed,
    'Editing a non-draft PO must throw an error'
  );

  // Approve PO
  const approvedPO = await POService.approvePurchaseOrder(
    createdPO.id,
    testUser,
    true
  );
  console.assert(
    approvedPO.status === 'approved',
    `Expected approved status, got ${approvedPO.status}`
  );
  console.assert(
    approvedPO.poNumber !== 'PO/PENDING' && /^PO\/\d{4}-\d{2}\/\d{4}$/.test(approvedPO.poNumber),
    `Expected approved PO to have generated sequential PO number (e.g. PO/YYYY-YY/XXXX), got ${approvedPO.poNumber}`
  );

  // 7. PO Amendment Process for Approved PO
  console.log('Test 7: PO Amendments & Snapshot Versioning');
  const amendedPO = await POService.amendPurchaseOrder(
    createdPO.id,
    {
      colourLines: [
        {
          lineId: 'pol-c1',
          colourName: 'Olive Green',
          processType: 'Bio-Silicon Wash',
          quantity: 3500,
          unit: 'piece',
          rateBasis: 'per_piece',
          rate: 8.5
        }
      ]
    },
    'Customer increased quantity by 500 units',
    testUser,
    true
  );
  console.assert(
    amendedPO.revision === 2,
    `Expected revision 2, got ${amendedPO.revision}`
  );
  console.assert(
    amendedPO.totalQuantity === 3500,
    `Expected totalQuantity 3500 in Rev 2, got ${amendedPO.totalQuantity}`
  );

  // 8. Rejection Workflow
  console.log('Test 8: Rejection Workflow');
  const draftPO2 = await POService.createPurchaseOrder(
    {
      customerId: testCustomer.vendorId,
      processCategory: 'dyeing',
      styleNo: 'REJECT-STYLE',
      itemName: 'Dyeing Lot',
      orderDate: '2026-10-12',
      colourLines: [
        {
          lineId: 'pol-r1',
          colourName: 'Black',
          processType: 'Reactive Dyeing',
          quantity: 100,
          unit: 'kg',
          rateBasis: 'per_kg',
          rate: 50
        }
      ],
      status: 'submitted'
    },
    testCustomer,
    testUser,
    true
  );

  const rejectedPO = await POService.rejectPurchaseOrder(
    draftPO2.id,
    'Process capacity not available for this week',
    testUser,
    true
  );
  console.assert(
    rejectedPO.status === 'cancelled',
    `Expected cancelled status, got ${rejectedPO.status}`
  );
  console.assert(
    rejectedPO.rejectionReason ===
      'Process capacity not available for this week',
    'Rejection reason check'
  );

  // 9. Cancellation Workflow
  console.log('Test 9: Cancellation Workflow');
  const cancelledPO = await POService.cancelPurchaseOrder(
    draftPO2.id,
    'Client cancelled season order',
    testUser,
    true
  );
  console.assert(
    cancelledPO.status === 'cancelled',
    `Expected cancelled status, got ${cancelledPO.status}`
  );

  // 10. Audit History & Metrics
  console.log('Test 10: Audit Log & Metrics Verification');
  const fetched = await POService.getPurchaseOrderById(createdPO.id, true);
  console.assert(fetched.po !== null, 'PO should be retrievable by ID');
  console.assert(
    fetched.logs.length >= 3,
    `Expected at least 3 audit log entries, got ${fetched.logs.length}`
  );

  const metrics = await POService.getDashboardMetrics(true);
  console.assert(
    metrics.totalPOs > 0,
    `Expected totalPOs > 0, got ${metrics.totalPOs}`
  );
  console.assert(
    metrics.totalPieces > 0,
    `Expected totalPieces > 0, got ${metrics.totalPieces}`
  );

  console.log('--- All Purchase Order (PO) Tests Passed Successfully! ---');
  return true;
}
