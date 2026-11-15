import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Helper to verify caller permissions
async function verifyRole(
  context: functions.https.CallableContext,
  allowedRoles: string[]
): Promise<{ uid: string; role: string; name: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = context.auth.uid;
  let role = (context.auth.token.role as string) || '';
  let name = (context.auth.token.name as string) || '';

  if (!role || !name) {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      if (!role) role = data?.role || 'Supervisor';
      if (!name) name = data?.displayName || data?.name || 'Authorized User';
    } else {
      if (!role) role = 'Supervisor';
      if (!name) name = 'Authorized User';
    }
  }

  const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase());

  if (!normalizedAllowed.includes(normalizedRole)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      `User role '${role}' is not authorized to perform this purchase operation.`
    );
  }

  return { uid, role: normalizedRole, name };
}

/**
 * 1. createRawMaterialPurchase
 * Creates a new purchase entry with atomic sequence numbering and multiple material lines
 */
export const createRawMaterialPurchase = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);

  const {
    purchaseDate = new Date().toISOString().split('T')[0],
    purchaseType = 'Raw Material',
    vendorId,
    vendorName,
    vendorCode,
    supplierInvoiceNo = '',
    supplierInvoiceDate,
    vehicleNo,
    driverName,
    driverPhone,
    lines = [],
    status = 'Draft',
    remarks
  } = data;

  if (!vendorId) {
    throw new functions.https.HttpsError('invalid-argument', 'Supplier / Vendor is required.');
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'At least one material line item is required.');
  }

  // Validate line items
  let totalQuantity = 0;
  let grandTotal = 0;

  const processedLines = lines.map((l: any, idx: number) => {
    const qty = parseFloat(String(l.quantity || 0));
    const rate = parseFloat(String(l.rate || 0));
    if (isNaN(qty) || qty <= 0) {
      throw new functions.https.HttpsError('invalid-argument', `Line ${idx + 1}: Quantity must be greater than zero.`);
    }
    if (isNaN(rate) || rate < 0) {
      throw new functions.https.HttpsError('invalid-argument', `Line ${idx + 1}: Rate must be zero or positive.`);
    }
    const amount = Math.round(qty * rate * 100) / 100;
    totalQuantity += qty;
    grandTotal += amount;

    return {
      lineId: l.lineId || `line_${Date.now()}_${idx}`,
      itemId: l.itemId,
      itemCode: l.itemCode || '',
      itemName: l.itemName || '',
      categoryName: l.categoryName || 'General',
      quantity: qty,
      unit: l.unit || 'kg',
      rate: rate,
      amount: amount,
      remarks: l.remarks || ''
    };
  });

  const now = new Date().toISOString();
  const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const counterDocRef = db.collection('purchase_counters').doc('raw_material_seq');
  const purchaseDocRef = db.collection('raw_material_purchases').doc(purchaseId);

  const purchaseRecord = await db.runTransaction(async (transaction) => {
    // Generate Purchase Sequence (e.g. PUR-2026-0001)
    const counterSnap = await transaction.get(counterDocRef);
    let nextNum = 1;
    if (counterSnap.exists) {
      nextNum = (counterSnap.data()?.currentSeq || 0) + 1;
    }
    transaction.set(counterDocRef, { currentSeq: nextNum, updatedAt: now }, { merge: true });

    const purchaseNumber = `PUR-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

    const newPurchase = {
      id: purchaseId,
      purchaseNumber,
      purchaseDate,
      purchaseType,
      vendorId,
      vendorName: vendorName || 'Supplier',
      vendorCode: vendorCode || '',
      supplierInvoiceNo,
      supplierInvoiceDate: supplierInvoiceDate || purchaseDate,
      vehicleNo: vehicleNo || '',
      driverName: driverName || '',
      driverPhone: driverPhone || '',
      lines: processedLines,
      totalQuantity: Math.round(totalQuantity * 1000) / 1000,
      grandTotal: Math.round(grandTotal * 100) / 100,
      status: status === 'Confirmed' ? 'Confirmed' : 'Draft',
      stockInwardCompleted: false,
      inwardTransactionIds: [],
      remarks: remarks || '',
      createdBy: uid,
      createdByName: name,
      createdAt: now,
      updatedBy: uid,
      updatedByName: name,
      updatedAt: now
    };

    transaction.set(purchaseDocRef, newPurchase);
    return newPurchase;
  });

  return {
    success: true,
    purchase: purchaseRecord
  };
});

/**
 * 2. receiveRawMaterialPurchase
 * Transitions purchase to 'Received' and performs atomic, idempotent warehouse inward updates
 */
export const receiveRawMaterialPurchase = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);

  const { purchaseId, receivedDate = new Date().toISOString().split('T')[0], remarks } = data;

  if (!purchaseId) {
    throw new functions.https.HttpsError('invalid-argument', 'purchaseId is required.');
  }

  const purchaseDocRef = db.collection('raw_material_purchases').doc(purchaseId);
  const now = new Date().toISOString();

  const result = await db.runTransaction(async (transaction) => {
    const purchaseSnap = await transaction.get(purchaseDocRef);
    if (!purchaseSnap.exists) {
      throw new functions.https.HttpsError('not-found', `Purchase record '${purchaseId}' not found.`);
    }

    const purchase = purchaseSnap.data()!;

    if (purchase.status === 'Cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot receive a cancelled purchase order.');
    }
    if (purchase.status === 'Received' && purchase.stockInwardCompleted) {
      return {
        alreadyReceived: true,
        purchase,
        message: 'Purchase was already marked Received and added to stock.'
      };
    }

    // Process each line item into warehouse stock
    const createdTxIds: string[] = [];

    for (const line of purchase.lines || []) {
      const itemId = line.itemId;
      const qty = parseFloat(String(line.quantity || 0));
      if (!itemId || isNaN(qty) || qty <= 0) continue;

      const itemDocRef = db.collection('items').doc(itemId);
      const stockDocRef = db.collection('warehouse_stock').doc(`stock_${itemId}`);
      const txDocRef = db.collection('stock_transactions').doc();

      const itemSnap = await transaction.get(itemDocRef);
      const stockSnap = await transaction.get(stockDocRef);

      const itemData = itemSnap.exists ? itemSnap.data() : null;
      let previousStock = 0;
      if (stockSnap.exists) {
        previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
      } else if (itemData) {
        previousStock = parseFloat(String(itemData.currentStock || 0));
      }
      if (isNaN(previousStock)) previousStock = 0;

      const newStock = Math.round((previousStock + qty) * 1000) / 1000;

      // Update warehouse_stock
      const stockPayload = {
        id: `stock_${itemId}`,
        itemId,
        itemCode: line.itemCode || itemData?.itemCode || '',
        itemName: line.itemName || itemData?.itemName || '',
        categoryId: itemData?.categoryId || '',
        categoryName: line.categoryName || itemData?.categoryName || 'General',
        baseUnit: line.unit || itemData?.baseUnit || 'kg',
        availableStock: newStock,
        minimumStockLevel: itemData?.minimumStockLevel || 0,
        reorderLevel: itemData?.reorderLevel || itemData?.minimumStockLevel || 0,
        lastInwardDate: receivedDate,
        updatedAt: now,
        updatedBy: uid
      };
      transaction.set(stockDocRef, stockPayload, { merge: true });

      // Update items doc
      if (itemSnap.exists) {
        transaction.update(itemDocRef, {
          currentStock: newStock,
          updatedAt: now,
          updatedBy: uid,
          updatedByName: name
        });
      }

      // Record inward transaction
      const txPayload = {
        id: txDocRef.id,
        transactionNumber: `TX-${purchase.purchaseNumber}-${line.lineId.slice(-4)}`,
        itemId,
        itemCode: line.itemCode || '',
        itemName: line.itemName || '',
        categoryName: line.categoryName || 'General',
        baseUnit: line.unit || 'kg',
        type: 'INWARD',
        source: 'PURCHASE_RECEIPT',
        quantity: qty,
        previousStock,
        newStock,
        referenceNumber: purchase.purchaseNumber,
        referenceId: purchaseId,
        idempotencyKey: `pur_${purchaseId}_line_${line.lineId}`,
        receivedFrom: purchase.vendorName,
        date: receivedDate,
        remarks: remarks || `Receipt against ${purchase.purchaseNumber}`,
        createdBy: uid,
        createdByName: name,
        createdAt: now
      };
      transaction.set(txDocRef, txPayload);
      createdTxIds.push(txDocRef.id);
    }

    // Update purchase record to 'Received'
    const updatedPurchase = {
      status: 'Received',
      stockInwardCompleted: true,
      inwardTransactionIds: createdTxIds,
      receivedDate,
      receivedBy: uid,
      receivedByName: name,
      updatedBy: uid,
      updatedByName: name,
      updatedAt: now
    };
    transaction.update(purchaseDocRef, updatedPurchase);

    return {
      alreadyReceived: false,
      purchase: { ...purchase, ...updatedPurchase },
      inwardTransactionIds: createdTxIds
    };
  });

  return {
    success: true,
    ...result
  };
});

