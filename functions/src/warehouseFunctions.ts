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
      `User role '${role}' is not authorized to perform this warehouse operation.`
    );
  }

  return { uid, role: normalizedRole, name };
}

/**
 * 1. recordStockTransaction
 * Secure atomic stock mutation (Inward / Outward) with idempotency protection
 */
export const recordStockTransaction = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);

  const {
    itemId,
    type, // 'INWARD' | 'OUTWARD'
    quantity,
    source = 'MANUAL_INWARD',
    referenceNumber = 'REF-MANUAL',
    referenceId,
    idempotencyKey,
    purpose,
    issuedTo,
    receivedFrom,
    date = new Date().toISOString().split('T')[0],
    remarks
  } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }
  const numericQty = parseFloat(String(quantity));
  if (isNaN(numericQty) || numericQty <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Quantity must be a positive number greater than zero.');
  }
  if (type !== 'INWARD' && type !== 'OUTWARD') {
    throw new functions.https.HttpsError('invalid-argument', "Transaction type must be 'INWARD' or 'OUTWARD'.");
  }

  // 1. Idempotency Check: Prevent duplicate stock additions if already processed
  if (idempotencyKey) {
    const existingSnap = await db
      .collection('stock_transactions')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingTx = existingSnap.docs[0].data();
      return {
        success: true,
        alreadyProcessed: true,
        transactionId: existingSnap.docs[0].id,
        transaction: existingTx,
        message: 'Transaction already recorded previously (idempotent).'
      };
    }
  }

  // 2. Atomic Transaction Execution
  const now = new Date().toISOString();
  const itemDocRef = db.collection('items').doc(itemId);
  const stockDocRef = db.collection('warehouse_stock').doc(`stock_${itemId}`);
  const counterDocRef = db.collection('stock_counters').doc('transaction_seq');
  const txDocRef = db.collection('stock_transactions').doc();

  const result = await db.runTransaction(async (transaction) => {
    // Read item
    const itemSnap = await transaction.get(itemDocRef);
    if (!itemSnap.exists) {
      throw new functions.https.HttpsError('not-found', `Item with ID '${itemId}' not found in Item Master.`);
    }
    const itemData = itemSnap.data();

    // Read current stock
    const stockSnap = await transaction.get(stockDocRef);
    let previousStock = 0;
    if (stockSnap.exists) {
      previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
    } else {
      previousStock = parseFloat(String(itemData?.currentStock || 0));
    }

    if (isNaN(previousStock)) previousStock = 0;

    let newStock = 0;
    if (type === 'OUTWARD') {
      if (previousStock < numericQty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Insufficient stock available for '${itemData?.itemName}'. Available: ${previousStock} ${itemData?.baseUnit || ''}, Requested: ${numericQty}`
        );
      }
      newStock = Math.round((previousStock - numericQty) * 1000) / 1000;
    } else {
      // INWARD
      newStock = Math.round((previousStock + numericQty) * 1000) / 1000;
    }

    // Generate sequence number
    const counterSnap = await transaction.get(counterDocRef);
    let nextNum = 1;
    if (counterSnap.exists) {
      nextNum = (counterSnap.data()?.currentSeq || 0) + 1;
    }
    transaction.set(counterDocRef, { currentSeq: nextNum, updatedAt: now }, { merge: true });

    const txNumber = `TX-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`;

    // Update warehouse_stock document
    const stockPayload = {
      id: `stock_${itemId}`,
      itemId,
      itemCode: itemData?.itemCode || '',
      itemName: itemData?.itemName || '',
      categoryId: itemData?.categoryId || '',
      categoryName: itemData?.categoryName || 'General',
      baseUnit: itemData?.baseUnit || 'kg',
      availableStock: newStock,
      minimumStockLevel: itemData?.minimumStockLevel || 0,
      reorderLevel: itemData?.reorderLevel || itemData?.minimumStockLevel || 0,
      storageLocation: itemData?.storageLocation || '',
      ...(type === 'INWARD' ? { lastInwardDate: date } : { lastOutwardDate: date }),
      updatedAt: now,
      updatedBy: uid
    };
    transaction.set(stockDocRef, stockPayload, { merge: true });

    // Sync authoritative currentStock on item document
    transaction.update(itemDocRef, {
      currentStock: newStock,
      updatedAt: now,
      updatedBy: uid,
      updatedByName: name
    });

    // Record Stock Transaction
    const txPayload = {
      id: txDocRef.id,
      transactionNumber: txNumber,
      itemId,
      itemCode: itemData?.itemCode || '',
      itemName: itemData?.itemName || '',
      categoryName: itemData?.categoryName || 'General',
      baseUnit: itemData?.baseUnit || 'kg',
      type,
      source,
      quantity: numericQty,
      previousStock,
      newStock,
      referenceNumber: referenceNumber || txNumber,
      referenceId: referenceId || null,
      idempotencyKey: idempotencyKey || null,
      purpose: purpose || null,
      issuedTo: issuedTo || null,
      receivedFrom: receivedFrom || null,
      date,
      remarks: remarks || null,
      createdBy: uid,
      createdByName: name,
      createdAt: now
    };
    transaction.set(txDocRef, txPayload);

    return {
      transactionId: txDocRef.id,
      transactionNumber: txNumber,
      newStock,
      previousStock,
      transaction: txPayload
    };
  });

  return {
    success: true,
    ...result
  };
});

/**
 * 2. getWarehouseDashboardMetrics
 * Aggregates live overview metrics for the warehouse dashboard
 */
export const getWarehouseDashboardMetrics = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);

  const [itemsSnap, stockSnap, recentTxsSnap] = await Promise.all([
    db.collection('items').where('status', '==', 'active').get(),
    db.collection('warehouse_stock').get(),
    db.collection('stock_transactions').orderBy('createdAt', 'desc').limit(20).get()
  ]);

  const stockMap = new Map<string, any>();
  stockSnap.docs.forEach((d) => {
    const s = d.data();
    if (s.itemId) stockMap.set(s.itemId, s);
  });

  let totalItems = 0;
  let lowStockCount = 0;
  let totalStockVolume = 0;

  itemsSnap.docs.forEach((d) => {
    const item = d.data();
    const stockInfo = stockMap.get(item.id) || stockMap.get(item.itemId);
    const available = stockInfo ? stockInfo.availableStock : item.currentStock || 0;
    const minAlert = item.minimumStockLevel !== undefined ? item.minimumStockLevel : 0;

    totalItems++;
    totalStockVolume += available;
    if (available <= minAlert) {
      lowStockCount++;
    }
  });

  const recentInwards: any[] = [];
  const recentOutwards: any[] = [];

  recentTxsSnap.docs.forEach((d) => {
    const tx = d.data();
    if (tx.type === 'INWARD' && recentInwards.length < 5) {
      recentInwards.push(tx);
    } else if (tx.type === 'OUTWARD' && recentOutwards.length < 5) {
      recentOutwards.push(tx);
    }
  });

  return {
    success: true,
    metrics: {
      totalAvailableItems: totalItems,
      lowStockItemsCount: lowStockCount,
      totalStockVolume: Math.round(totalStockVolume * 100) / 100,
      recentInwards,
      recentOutwards
    }
  };
});

