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
      `User role '${role}' is not authorized to perform this chemical operation.`
    );
  }

  return { uid, role: normalizedRole, name };
}

/**
 * 1. recordChemicalEntry
 * Records a chemical purchase or consumption entry, automatically mutating
 * warehouse stock and stock transactions in an atomic Firestore transaction.
 */
export const recordChemicalEntry = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, [
    'Admin',
    'Managing Director',
    'General Manager',
    'Production Manager',
    'Shift Supervisor',
    'Manager',
    'Supervisor',
    'Store Keeper',
    'Accountant',
    'Operator'
  ]);

  const {
    entryType, // 'Purchase' | 'Consumption'
    materialType, // 'chemical' | 'wood'
    itemId,
    date = new Date().toISOString().split('T')[0],
    quantity,
    rate = 0,
    unit,
    supplierId,
    supplierName,
    supplierInvoiceNo,
    isReceived = true, // for purchases: default true or false
    poId,
    poNumber,
    styleNo,
    batchNo,
    processType,
    machineNo,
    boilerNo,
    startTime,
    endTime,
    operatorName,
    remarks,
    idempotencyKey
  } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'Chemical item selection (itemId) is required.');
  }

  if (entryType !== 'Purchase' && entryType !== 'Consumption') {
    throw new functions.https.HttpsError('invalid-argument', "Entry type must be either 'Purchase' or 'Consumption'.");
  }

  const numericQty = parseFloat(String(quantity));
  if (isNaN(numericQty) || numericQty <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Quantity must be a positive number greater than zero.');
  }

  const numericRate = parseFloat(String(rate)) || 0;
  if (numericRate < 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Rate per unit cannot be negative.');
  }

  // 1. Idempotency Check: Prevent duplicate entries
  if (idempotencyKey) {
    const existingSnap = await db
      .collection('chemical_entries')
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      return {
        success: true,
        alreadyProcessed: true,
        entryId: existingDoc.id,
        entry: existingDoc.data(),
        message: 'Chemical entry already recorded previously (idempotent).'
      };
    }
  }

  const now = new Date().toISOString();
  const year = new Date(date).getFullYear() || new Date().getFullYear();
  const isWood = materialType === 'wood';

  const itemDocRef = db.collection('items').doc(itemId);
  const stockDocRef = db.collection('warehouse_stock').doc(`stock_${itemId}`);
  const counterDocRef = isWood
    ? db.collection('wood_counters').doc(`entry_seq_${year}`)
    : db.collection('chemical_counters').doc(`entry_seq_${year}`);
  const stockCounterDocRef = db.collection('stock_counters').doc('transaction_seq');
  const entryDocRef = db.collection('chemical_entries').doc();
  const txDocRef = db.collection('stock_transactions').doc();

  const shouldUpdateStock = entryType === 'Consumption' || (entryType === 'Purchase' && Boolean(isReceived));

  const result = await db.runTransaction(async (transaction) => {
    // 1. ALL READS FIRST (Firestore requires all reads before any writes)
    const [itemSnap, stockSnap, counterSnap, stockCounterSnap] = await Promise.all([
      transaction.get(itemDocRef),
      transaction.get(stockDocRef),
      transaction.get(counterDocRef),
      transaction.get(stockCounterDocRef)
    ]);

    if (!itemSnap.exists) {
      throw new functions.https.HttpsError('not-found', `${isWood ? 'Raw wood' : 'Chemical'} item '${itemId}' not found in Item Master.`);
    }
    const itemData = itemSnap.data() || {};

    const chemicalName =
      itemData.chemicalDetails?.chemicalDisplayName ||
      itemData.itemName ||
      (isWood ? 'Raw Wood / Firewood' : 'Chemical Item');
    const itemCode = itemData.itemCode || '';
    const categoryName = itemData.categoryName || (isWood ? 'Firewood & Boiler Fuel' : 'Textile Processing Chemicals');
    const effectiveUnit = unit || itemData.baseUnit || (isWood ? 't' : 'kg');

    // Stock balance
    let previousStock = 0;
    if (stockSnap.exists) {
      previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
    } else {
      previousStock = parseFloat(String(itemData.currentStock || 0));
    }
    if (isNaN(previousStock)) previousStock = 0;

    let newStock = previousStock;
    let txNumber = '';
    let nextTxSeq = 1;

    if (shouldUpdateStock) {
      if (entryType === 'Consumption') {
        if (previousStock < numericQty) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Insufficient stock for '${chemicalName}'. Available: ${previousStock} ${effectiveUnit}, Requested: ${numericQty} ${effectiveUnit}`
          );
        }
        newStock = Math.round((previousStock - numericQty) * 1000) / 1000;
      } else {
        // Purchase received -> Increase stock
        newStock = Math.round((previousStock + numericQty) * 1000) / 1000;
      }

      if (stockCounterSnap.exists) {
        nextTxSeq = (stockCounterSnap.data()?.currentSeq || 0) + 1;
      }
      txNumber = `TX-${year}-${String(nextTxSeq).padStart(4, '0')}`;
    }

    // Generate unique Entry Number: WD-YYYY-XXXX for wood, CHM-YYYY-XXXX for chemical
    let nextEntrySeq = 1;
    if (counterSnap.exists) {
      nextEntrySeq = (counterSnap.data()?.currentSeq || 0) + 1;
    }
    const entryPrefix = isWood ? 'WD' : 'CHM';
    const entryNumber = `${entryPrefix}-${year}-${String(nextEntrySeq).padStart(4, '0')}`;

    // Determine effective rate, total amount and warehouse average rate
    const stockAvgRate = Number(stockSnap.data()?.averageRate || itemData.defaultPurchaseRate || itemData.lastPurchaseRate || 0);
    const effectiveRate = numericRate > 0 ? numericRate : stockAvgRate;
    const effectiveTotalAmount = Math.round(numericQty * effectiveRate * 100) / 100;

    let warehouseAvgRate = stockAvgRate || effectiveRate;
    let warehouseTotalVal = Math.round(newStock * warehouseAvgRate * 100) / 100;

    if (entryType === 'Purchase') {
      const previousCost = stockAvgRate;
      const recentCost = effectiveRate;
      if (recentCost > 0) {
        if (previousCost > 0) {
          warehouseAvgRate = Math.round(((previousCost + recentCost) / 2) * 100) / 100;
        } else {
          warehouseAvgRate = recentCost;
        }
      }
      warehouseTotalVal = Math.round(newStock * warehouseAvgRate * 100) / 100;
    }

    // 2. ALL WRITES AFTER ALL READS
    if (shouldUpdateStock) {
      transaction.set(stockCounterDocRef, { currentSeq: nextTxSeq, updatedAt: now }, { merge: true });
    }
    transaction.set(counterDocRef, { currentSeq: nextEntrySeq, updatedAt: now }, { merge: true });

    // Update warehouse_stock and items docs if stock mutated
    if (shouldUpdateStock) {
      const stockPayload = {
        id: `stock_${itemId}`,
        itemId,
        itemCode,
        itemName: itemData.itemName || chemicalName,
        categoryId: itemData.categoryId || '',
        categoryName,
        baseUnit: effectiveUnit,
        availableStock: newStock,
        averageRate: warehouseAvgRate,
        totalValue: warehouseTotalVal,
        minimumStockLevel: itemData.minimumStockLevel || 0,
        reorderLevel: itemData.reorderLevel || itemData.minimumStockLevel || 0,
        storageLocation: itemData.storageLocation || '',
        ...(entryType === 'Purchase' ? { lastInwardDate: date } : { lastOutwardDate: date }),
        updatedAt: now,
        updatedBy: uid
      };
      transaction.set(stockDocRef, stockPayload, { merge: true });

      transaction.update(itemDocRef, {
        currentStock: newStock,
        ...(warehouseAvgRate > 0 ? { defaultPurchaseRate: warehouseAvgRate } : {}),
        updatedAt: now,
        updatedBy: uid,
        updatedByName: name
      });

      // Record Stock Transaction
      const isPurchase = entryType === 'Purchase';
      const txPayload = {
        id: txDocRef.id,
        transactionNumber: txNumber,
        itemId,
        itemCode,
        itemName: chemicalName,
        categoryName,
        baseUnit: effectiveUnit,
        type: isPurchase ? 'INWARD' : 'OUTWARD',
        source: isPurchase ? 'PURCHASE_RECEIPT' : 'PRODUCTION_CONSUMPTION',
        quantity: numericQty,
        previousStock,
        newStock,
        referenceNumber: entryNumber,
        referenceId: entryDocRef.id,
        idempotencyKey: idempotencyKey || null,
        purpose: isPurchase
          ? `${isWood ? 'Raw Wood' : 'Chemical'} Purchase Inward - ${supplierName || 'Supplier'}`
          : isWood
          ? `Boiler Fuel / Raw Wood Consumption - ${machineNo || boilerNo || 'Boiler'} (${processType || 'Steam Generation'})`
          : `Processing Consumption - ${processType || 'Shopfloor'} (Batch: ${batchNo || 'N/A'})`,
        issuedTo: isPurchase ? null : operatorName || name,
        receivedFrom: isPurchase ? supplierName || null : null,
        date,
        remarks: remarks || null,
        createdBy: uid,
        createdByName: name,
        createdAt: now
      };
      transaction.set(txDocRef, txPayload);
    }

    // Save Chemical Entry Document
    const entryPayload = {
      id: entryDocRef.id,
      entryNumber,
      entryType,
      materialType: isWood ? 'wood' : 'chemical',
      date,
      itemId,
      itemCode,
      chemicalName,
      unit: effectiveUnit,
      quantity: numericQty,
      rate: effectiveRate,
      totalAmount: effectiveTotalAmount,
      supplierId: supplierId || null,
      supplierName: supplierName || null,
      supplierInvoiceNo: supplierInvoiceNo || null,
      isReceived: entryType === 'Purchase' ? Boolean(isReceived) : true,
      receivedDate: entryType === 'Purchase' && isReceived ? date : null,
      poId: poId || null,
      poNumber: poNumber || null,
      styleNo: styleNo || null,
      batchNo: batchNo || null,
      processType: processType || null,
      machineNo: machineNo || null,
      boilerNo: boilerNo || (isWood ? machineNo : null) || null,
      startTime: startTime || null,
      endTime: endTime || null,
      operatorName: operatorName || null,
      remarks: remarks || null,
      stockTransactionId: shouldUpdateStock ? txDocRef.id : null,
      stockTransactionNumber: shouldUpdateStock ? txNumber : null,
      stockUpdated: shouldUpdateStock,
      idempotencyKey: idempotencyKey || null,
      createdBy: uid,
      createdByName: name,
      createdAt: now,
      updatedAt: now
    };

    transaction.set(entryDocRef, entryPayload);

    return {
      entry: entryPayload,
      stockUpdated: shouldUpdateStock,
      previousStock,
      newStock
    };
  });

  return {
    success: true,
    message: `Chemical ${entryType.toLowerCase()} entry recorded successfully.`,
    ...result
  };
});

/**
 * 2. receiveChemicalPurchase
 * Confirms receipt of a chemical purchase that was previously saved as 'Pending Receipt'.
 * Atomically updates warehouse stock (+quantity) and records INWARD stock transaction.
 */
export const receiveChemicalPurchase = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, [
    'Admin',
    'Managing Director',
    'General Manager',
    'Production Manager',
    'Shift Supervisor',
    'Manager',
    'Supervisor',
    'Store Keeper',
    'Accountant'
  ]);

  const { entryId, receivedDate = new Date().toISOString().split('T')[0] } = data;

  if (!entryId) {
    throw new functions.https.HttpsError('invalid-argument', 'entryId is required.');
  }

  const now = new Date().toISOString();
  const year = new Date(receivedDate).getFullYear() || new Date().getFullYear();

  const entryDocRef = db.collection('chemical_entries').doc(entryId);
  const stockCounterDocRef = db.collection('stock_counters').doc('transaction_seq');
  const txDocRef = db.collection('stock_transactions').doc();

  const result = await db.runTransaction(async (transaction) => {
    const entrySnap = await transaction.get(entryDocRef);
    if (!entrySnap.exists) {
      throw new functions.https.HttpsError('not-found', `Chemical entry '${entryId}' not found.`);
    }

    const entryData = entrySnap.data() || {};
    if (entryData.entryType !== 'Purchase') {
      throw new functions.https.HttpsError('failed-precondition', 'Only purchase entries can be marked as received.');
    }

    if (entryData.isReceived && entryData.stockUpdated) {
      return {
        alreadyReceived: true,
        entry: entryData,
        message: 'This chemical purchase has already been received and inwarded to stock.'
      };
    }

    const itemId = entryData.itemId;
    const numericQty = parseFloat(String(entryData.quantity || 0));
    const itemDocRef = db.collection('items').doc(itemId);
    const stockDocRef = db.collection('warehouse_stock').doc(`stock_${itemId}`);

    const itemSnap = await transaction.get(itemDocRef);
    if (!itemSnap.exists) {
      throw new functions.https.HttpsError('not-found', `Chemical item '${itemId}' not found in Item Master.`);
    }
    const itemData = itemSnap.data() || {};

    const stockSnap = await transaction.get(stockDocRef);
    let previousStock = 0;
    if (stockSnap.exists) {
      previousStock = parseFloat(String(stockSnap.data()?.availableStock || 0));
    } else {
      previousStock = parseFloat(String(itemData.currentStock || 0));
    }
    if (isNaN(previousStock)) previousStock = 0;

    const newStock = Math.round((previousStock + numericQty) * 1000) / 1000;

    // Generate stock transaction number
    const stockCounterSnap = await transaction.get(stockCounterDocRef);
    let nextTxSeq = 1;
    if (stockCounterSnap.exists) {
      nextTxSeq = (stockCounterSnap.data()?.currentSeq || 0) + 1;
    }
    transaction.set(stockCounterDocRef, { currentSeq: nextTxSeq, updatedAt: now }, { merge: true });
    const txNumber = `TX-${year}-${String(nextTxSeq).padStart(4, '0')}`;

    // Update warehouse_stock and items
    const stockPayload = {
      id: `stock_${itemId}`,
      itemId,
      itemCode: entryData.itemCode || itemData.itemCode || '',
      itemName: entryData.chemicalName || itemData.itemName || '',
      categoryId: itemData.categoryId || '',
      categoryName: itemData.categoryName || 'Textile Processing Chemicals',
      baseUnit: entryData.unit || itemData.baseUnit || 'kg',
      availableStock: newStock,
      minimumStockLevel: itemData.minimumStockLevel || 0,
      reorderLevel: itemData.reorderLevel || itemData.minimumStockLevel || 0,
      lastInwardDate: receivedDate,
      updatedAt: now,
      updatedBy: uid
    };
    transaction.set(stockDocRef, stockPayload, { merge: true });

    transaction.update(itemDocRef, {
      currentStock: newStock,
      updatedAt: now,
      updatedBy: uid,
      updatedByName: name
    });

    // Stock transaction record
    const txPayload = {
      id: txDocRef.id,
      transactionNumber: txNumber,
      itemId,
      itemCode: entryData.itemCode || itemData.itemCode || '',
      itemName: entryData.chemicalName || itemData.itemName || '',
      categoryName: itemData.categoryName || 'Textile Processing Chemicals',
      baseUnit: entryData.unit || itemData.baseUnit || 'kg',
      type: 'INWARD',
      source: 'PURCHASE_RECEIPT',
      quantity: numericQty,
      previousStock,
      newStock,
      referenceNumber: entryData.entryNumber,
      referenceId: entryId,
      idempotencyKey: `rec_purch_${entryId}`,
      purpose: `Chemical Purchase Inward - ${entryData.supplierName || 'Supplier'}`,
      receivedFrom: entryData.supplierName || null,
      date: receivedDate,
      remarks: entryData.remarks || 'Stock received and inwarded from purchase entry',
      createdBy: uid,
      createdByName: name,
      createdAt: now
    };
    transaction.set(txDocRef, txPayload);

    // Update chemical_entries document
    const updatedEntry = {
      ...entryData,
      isReceived: true,
      receivedDate,
      stockTransactionId: txDocRef.id,
      stockTransactionNumber: txNumber,
      stockUpdated: true,
      updatedAt: now,
      updatedBy: uid
    };
    transaction.set(entryDocRef, updatedEntry);

    return {
      entry: updatedEntry,
      previousStock,
      newStock
    };
  });

  return {
    success: true,
    message: 'Chemical purchase confirmed and stock successfully inwarded to warehouse.',
    ...result
  };
});

/**
 * 3. deleteChemicalEntry
 * Reverses any stock changes if already inwarded or consumed, then removes the chemical entry.
 */
export const deleteChemicalEntry = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, [
    'Admin',
    'Managing Director',
    'General Manager',
    'Production Manager',
    'Manager'
  ]);

  const { entryId } = data;
  if (!entryId) {
    throw new functions.https.HttpsError('invalid-argument', 'entryId is required.');
  }

  const now = new Date().toISOString();
  const entryDocRef = db.collection('chemical_entries').doc(entryId);

  await db.runTransaction(async (transaction) => {
    const entrySnap = await transaction.get(entryDocRef);
    if (!entrySnap.exists) {
      throw new functions.https.HttpsError('not-found', `Chemical entry '${entryId}' not found.`);
    }

    const entryData = entrySnap.data() || {};
    const { itemId, quantity = 0, entryType, stockUpdated } = entryData;
    const numericQty = parseFloat(String(quantity));

    if (stockUpdated && itemId && numericQty > 0) {
      const itemDocRef = db.collection('items').doc(itemId);
      const stockDocRef = db.collection('warehouse_stock').doc(`stock_${itemId}`);

      const stockSnap = await transaction.get(stockDocRef);
      const itemSnap = await transaction.get(itemDocRef);

      let currentStock = 0;
      let currentAvgRate = 0;
      if (stockSnap.exists) {
        const sData = stockSnap.data() || {};
        currentStock = parseFloat(String(sData.availableStock || 0));
        currentAvgRate = parseFloat(String(sData.averageRate || 0));
      }
      if (itemSnap.exists) {
        const iData = itemSnap.data() || {};
        if (!stockSnap.exists) {
          currentStock = parseFloat(String(iData.currentStock || 0));
        }
        if (currentAvgRate <= 0) {
          currentAvgRate = parseFloat(String(iData.defaultPurchaseRate || iData.lastPurchaseRate || 0));
        }
      }
      if (isNaN(currentStock)) currentStock = 0;
      if (isNaN(currentAvgRate)) currentAvgRate = 0;

      let restoredStock = currentStock;
      let finalAvgRate = currentAvgRate;
      let finalTotalAmount = Math.round(currentStock * currentAvgRate * 100) / 100;

      if (entryType === 'Consumption') {
        // Revert consumption: ADD consumed quantity back to warehouse
        restoredStock = Math.round((currentStock + numericQty) * 1000) / 1000;

        const entryRate = parseFloat(String(entryData.rate || 0)) || currentAvgRate;
        const restoredAmount = (Number(entryData.totalAmount) > 0)
          ? Number(entryData.totalAmount)
          : Math.round(numericQty * entryRate * 100) / 100;

        finalTotalAmount = Math.round((currentStock * currentAvgRate + restoredAmount) * 100) / 100;
        finalAvgRate = restoredStock > 0
          ? Math.round((finalTotalAmount / restoredStock) * 100) / 100
          : currentAvgRate;
      } else if (entryType === 'Purchase') {
        // Revert purchase: deduct quantity
        restoredStock = Math.max(0, Math.round((currentStock - numericQty) * 1000) / 1000);

        const purchaseAmount = (Number(entryData.totalAmount) > 0)
          ? Number(entryData.totalAmount)
          : Math.round(numericQty * (parseFloat(String(entryData.rate || 0)) || currentAvgRate) * 100) / 100;

        finalTotalAmount = Math.max(0, Math.round((currentStock * currentAvgRate - purchaseAmount) * 100) / 100);
        finalAvgRate = restoredStock > 0
          ? Math.round((finalTotalAmount / restoredStock) * 100) / 100
          : 0;
      }

      transaction.set(
        stockDocRef,
        {
          availableStock: restoredStock,
          averageRate: finalAvgRate,
          totalValue: finalTotalAmount,
          updatedAt: now,
          updatedBy: uid
        },
        { merge: true }
      );

      if (itemSnap.exists) {
        transaction.update(itemDocRef, {
          currentStock: restoredStock,
          defaultPurchaseRate: finalAvgRate > 0 ? finalAvgRate : (itemSnap.data()?.defaultPurchaseRate || 0),
          lastPurchaseRate: finalAvgRate > 0 ? finalAvgRate : (itemSnap.data()?.lastPurchaseRate || 0),
          updatedAt: now,
          updatedBy: uid,
          updatedByName: name
        });
      }

      // Add reversal stock transaction
      const txDocRef = db.collection('stock_transactions').doc();
      const isConsumption = entryType === 'Consumption';
      transaction.set(txDocRef, {
        id: txDocRef.id,
        transactionNumber: `TX-REV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        itemId,
        itemCode: itemSnap.exists ? itemSnap.data()?.itemCode : (entryData.itemCode || ''),
        itemName: itemSnap.exists ? itemSnap.data()?.itemName : (entryData.chemicalName || ''),
        categoryName: itemSnap.exists ? itemSnap.data()?.categoryName : (entryData.categoryName || ''),
        baseUnit: entryData.unit || (itemSnap.exists ? itemSnap.data()?.baseUnit : 'kg'),
        type: isConsumption ? 'INWARD' : 'OUTWARD',
        source: 'ADJUSTMENT',
        quantity: numericQty,
        previousStock: currentStock,
        newStock: restoredStock,
        referenceNumber: entryData.entryNumber || entryId,
        referenceId: entryId,
        purpose: `Reversal of deleted chemical ${isConsumption ? 'consumption' : 'purchase'} ${entryData.entryNumber || ''}`,
        date: now.split('T')[0],
        remarks: `Stock restored upon deletion of ${entryData.entryNumber || 'entry'}. New Avg Cost: ₹${finalAvgRate}, New Total Amount: ₹${finalTotalAmount}`,
        createdBy: uid,
        createdByName: name,
        createdAt: now
      });
    }

    transaction.delete(entryDocRef);
  });

  return {
    success: true,
    message: 'Chemical entry and linked stock movements reverted successfully.'
  };
});
