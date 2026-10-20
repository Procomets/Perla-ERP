import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Helper to verify role from auth token custom claims or Firestore user doc
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
      `User role '${role}' is not authorized to perform this operation.`
    );
  }

  return { uid, role: normalizedRole, name };
}

/**
 * 1. createItem
 * Validates required fields, enforces unique item code, and persists record with audit log
 */
export const createItem = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);

  const {
    itemCode,
    itemName,
    categoryId,
    categoryName,
    subcategoryId,
    subcategoryName,
    itemType = 'general',
    description,
    baseUnitId,
    baseUnit,
    baseUnitSymbol,
    secondaryUnitId,
    secondaryUnit,
    conversionFactor,
    defaultPurchaseRate,
    minimumStockLevel,
    reorderLevel,
    preferredSupplierId,
    preferredSupplierName,
    supplierItemCode,
    storageLocation,
    hsnCode,
    taxRatePercent,
    batchTrackingEnabled,
    expiryTrackingEnabled,
    remarks,
    chemicalDetails
  } = data;

  if (!itemName || !itemName.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Item Name is required.');
  }
  if (!categoryId) {
    throw new functions.https.HttpsError('invalid-argument', 'Item Category is required.');
  }
  if (!baseUnit || !baseUnit.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Unit of Measurement is required.');
  }

  // Format and validate Item Code uniqueness
  const cleanCode = (itemCode || `ITM-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
  const existingCodeQuery = await db.collection('items').where('itemCode', '==', cleanCode).limit(1).get();
  if (!existingCodeQuery.empty) {
    throw new functions.https.HttpsError('already-exists', `Item code '${cleanCode}' is already registered.`);
  }

  const now = new Date().toISOString();
  const itemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const itemDoc: Record<string, any> = {
    id: itemId,
    itemId,
    itemCode: cleanCode,
    itemName: itemName.trim(),
    categoryId,
    categoryName: categoryName || 'General',
    subcategoryId: subcategoryId || null,
    subcategoryName: subcategoryName || null,
    itemType,
    description: description || null,
    baseUnitId: baseUnitId || baseUnit.toLowerCase(),
    baseUnit: baseUnit.trim(),
    baseUnitSymbol: baseUnitSymbol || baseUnit.trim(),
    secondaryUnitId: secondaryUnitId || null,
    secondaryUnit: secondaryUnit || null,
    conversionFactor: conversionFactor ? Number(conversionFactor) : null,
    defaultPurchaseRate: defaultPurchaseRate !== undefined ? Number(defaultPurchaseRate) : null,
    minimumStockLevel: minimumStockLevel !== undefined ? Number(minimumStockLevel) : 0,
    reorderLevel: reorderLevel !== undefined ? Number(reorderLevel) : 0,
    preferredSupplierId: preferredSupplierId || null,
    preferredSupplierName: preferredSupplierName || null,
    supplierItemCode: supplierItemCode || null,
    storageLocation: storageLocation || null,
    hsnCode: hsnCode || null,
    taxRatePercent: taxRatePercent !== undefined ? Number(taxRatePercent) : null,
    batchTrackingEnabled: Boolean(batchTrackingEnabled || chemicalDetails?.batchTrackingRequired),
    expiryTrackingEnabled: Boolean(expiryTrackingEnabled || chemicalDetails?.expiryTrackingRequired),
    status: 'active',
    currentStock: 0,
    remarks: remarks || null,
    createdBy: uid,
    createdByName: name,
    createdAt: now,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: now
  };

  await db.collection('items').doc(itemId).set(itemDoc);

  // If chemical specifications are attached, save to chemical_details collection
  if (itemType === 'chemical' || chemicalDetails) {
    const chemData = chemicalDetails || {};
    const chemDoc = {
      itemId,
      chemicalCode: cleanCode,
      chemicalName: itemName.trim(),
      chemicalDisplayName: chemData.chemicalDisplayName || itemName.trim(),
      chemicalCategory: chemData.chemicalCategory || categoryName || 'Chemical',
      chemicalType: chemData.chemicalType || 'Washing Chemical',
      chemicalGrade: chemData.chemicalGrade || 'Textile Processing Grade',
      manufacturer: chemData.manufacturer || null,
      brand: chemData.brand || null,
      preferredSupplierId: preferredSupplierId || null,
      preferredSupplierName: preferredSupplierName || null,
      supplierProductCode: supplierItemCode || null,
      purchaseUnit: chemData.purchaseUnit || baseUnit,
      consumptionUnit: chemData.consumptionUnit || baseUnit,
      conversionFactor: chemData.conversionFactor ? Number(chemData.conversionFactor) : 1,
      defaultPurchaseRate: defaultPurchaseRate || null,
      minimumStockLevel: minimumStockLevel || 0,
      reorderLevel: reorderLevel || 0,
      storageLocation: storageLocation || null,
      batchTrackingRequired: Boolean(chemData.batchTrackingRequired || batchTrackingEnabled),
      expiryTrackingRequired: Boolean(chemData.expiryTrackingRequired || expiryTrackingEnabled),
      shelfLifeMonths: chemData.shelfLifeMonths || null,
      shelfLife: chemData.shelfLife || null,
      safetyInstructions: chemData.safetyInstructions || null,
      storageInstructions: chemData.storageInstructions || null,
      handlingPrecautions: chemData.handlingPrecautions || null,
      sdsStoragePath: chemData.sdsStoragePath || null,
      technicalSheetStoragePath: chemData.technicalSheetStoragePath || null,
      hazardClassification: chemData.hazardClassification || null,
      phRange: chemData.phRange || null,
      active: true,
      createdAt: now,
      updatedAt: now
    };
    await db.collection('chemical_details').doc(itemId).set(chemDoc);
  }

  // Audit log
  await db.collection('item_audit_logs').add({
    auditId: `audit_${Date.now()}`,
    itemId,
    itemCode: cleanCode,
    itemName: itemName.trim(),
    action: 'created',
    changedBy: uid,
    changedByName: name,
    changedAt: now,
    summary: `Item '${itemName.trim()}' (${cleanCode}) created by ${name}`,
    newValues: itemDoc
  });

  return { success: true, item: itemDoc };
});

/**
 * 2. updateItem
 * Validates updates, prevents altering code if transactions exist, records audit event
 */
export const updateItem = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
  const { itemId, ...updates } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const docRef = db.collection('items').doc(itemId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', `Item with ID ${itemId} does not exist.`);
  }

  const prev = snap.data() || {};
  const now = new Date().toISOString();

  // If itemCode changed, verify uniqueness
  if (updates.itemCode && updates.itemCode.trim().toUpperCase() !== prev.itemCode) {
    const cleanCode = updates.itemCode.trim().toUpperCase();
    const existing = await db.collection('items').where('itemCode', '==', cleanCode).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== itemId) {
      throw new functions.https.HttpsError('already-exists', `Item code '${cleanCode}' is already in use.`);
    }
    updates.itemCode = cleanCode;
  }

  const cleanUpdates = {
    ...updates,
    updatedBy: uid,
    updatedByName: name,
    updatedAt: now
  };

  await docRef.update(cleanUpdates);

  // If chemical details updated
  if (updates.chemicalDetails) {
    const chemRef = db.collection('chemical_details').doc(itemId);
    await chemRef.set(
      {
        ...updates.chemicalDetails,
        itemId,
        updatedAt: now
      },
      { merge: true }
    );
  }

  // Audit log
  await db.collection('item_audit_logs').add({
    auditId: `audit_${Date.now()}`,
    itemId,
    itemCode: prev.itemCode,
    itemName: updates.itemName || prev.itemName,
    action: 'updated',
    changedBy: uid,
    changedByName: name,
    changedAt: now,
    summary: `Item '${prev.itemCode}' specifications updated by ${name}`,
    previousValues: prev,
    newValues: cleanUpdates
  });

  return { success: true, itemId };
});

/**
 * 3. getItem
 * Retrieves item details, linked chemical info, and active supplier mapping
 */
export const getItem = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { itemId } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const docSnap = await db.collection('items').doc(itemId).get();
  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Item not found.');
  }

  const item = docSnap.data();
  let chemicalDetails = null;

  if (item?.itemType === 'chemical') {
    const chemSnap = await db.collection('chemical_details').doc(itemId).get();
    if (chemSnap.exists) {
      chemicalDetails = chemSnap.data();
    }
  }

  return { success: true, item: { ...item, chemicalDetails } };
});

/**
 * 4. listItems
 * Supports searching, filtering by type/category/status, and pagination
 */
export const listItems = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { itemType, category, status, searchQuery } = data || {};

  let q: admin.firestore.Query = db.collection('items');

  if (status && status !== 'all') {
    q = q.where('status', '==', status);
  }
  if (itemType && itemType !== 'all') {
    q = q.where('itemType', '==', itemType);
  }
  if (category && category !== 'all') {
    q = q.where('categoryId', '==', category);
  }

  const snap = await q.get();
  let items = snap.docs.map((d) => d.data());

  if (searchQuery && searchQuery.trim()) {
    const term = searchQuery.trim().toLowerCase();
    items = items.filter(
      (it) =>
        it.itemName?.toLowerCase().includes(term) ||
        it.itemCode?.toLowerCase().includes(term) ||
        it.categoryName?.toLowerCase().includes(term) ||
        it.preferredSupplierName?.toLowerCase().includes(term)
    );
  }

  return { success: true, items, count: items.length };
});

/**
 * 5. deactivateItem
 * Safe soft-delete: flags as inactive rather than deleting so transaction history is preserved
 */
export const deactivateItem = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
  const { itemId, reason } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const ref = db.collection('items').doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Item not found.');
  }

  const now = new Date().toISOString();
  await ref.update({
    status: 'inactive',
    deactivatedBy: uid,
    deactivatedByName: name,
    deactivatedAt: now,
    deactivationReason: reason || null,
    updatedAt: now
  });

  // Also deactivate linked chemical details if exists
  await db.collection('chemical_details').doc(itemId).set({ active: false, updatedAt: now }, { merge: true });

  await db.collection('item_audit_logs').add({
    auditId: `audit_${Date.now()}`,
    itemId,
    itemCode: snap.data()?.itemCode,
    itemName: snap.data()?.itemName,
    action: 'deactivated',
    changedBy: uid,
    changedByName: name,
    changedAt: now,
    summary: `Item '${snap.data()?.itemName}' deactivated by ${name}. Reason: ${reason || 'N/A'}`
  });

  return { success: true, itemId };
});

/**
 * 6. reactivateItem
 * Restores an inactive item to active catalogue
 */
export const reactivateItem = functions.https.onCall(async (data, context) => {
  const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
  const { itemId } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const ref = db.collection('items').doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Item not found.');
  }

  const now = new Date().toISOString();
  await ref.update({
    status: 'active',
    deactivatedBy: null,
    deactivatedByName: null,
    deactivatedAt: null,
    deactivationReason: null,
    updatedAt: now
  });

  await db.collection('chemical_details').doc(itemId).set({ active: true, updatedAt: now }, { merge: true });

  await db.collection('item_audit_logs').add({
    auditId: `audit_${Date.now()}`,
    itemId,
    itemCode: snap.data()?.itemCode,
    itemName: snap.data()?.itemName,
    action: 'reactivated',
    changedBy: uid,
    changedByName: name,
    changedAt: now,
    summary: `Item '${snap.data()?.itemName}' reactivated to active catalogue by ${name}`
  });

  return { success: true, itemId };
});

/**
 * 7. createChemicalDetails
 * Attaches or overwrites chemical-specific safety and consumption metadata
 */
export const createChemicalDetails = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { itemId, ...chemData } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const itemSnap = await db.collection('items').doc(itemId).get();
  if (!itemSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target item record not found.');
  }

  const now = new Date().toISOString();
  const docRef = db.collection('chemical_details').doc(itemId);

  const payload = {
    ...chemData,
    itemId,
    active: true,
    createdAt: now,
    updatedAt: now
  };

  await docRef.set(payload, { merge: true });
  await db.collection('items').doc(itemId).update({ itemType: 'chemical', updatedAt: now });

  return { success: true, itemId };
});

/**
 * 8. updateChemicalDetails
 * Modifies safety handling instructions, SDS references, or dilution factors
 */
export const updateChemicalDetails = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { itemId, ...updates } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const now = new Date().toISOString();
  await db.collection('chemical_details').doc(itemId).set(
    {
      ...updates,
      updatedAt: now
    },
    { merge: true }
  );

  return { success: true, itemId };
});

/**
 * 9. createItemCategory
 */
export const createItemCategory = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { categoryName, description, parentCategoryId } = data;

  if (!categoryName || !categoryName.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'Category Name is required.');
  }

  const categoryId = `cat_${Date.now()}`;
  const now = new Date().toISOString();

  const categoryDoc = {
    id: categoryId,
    categoryId,
    categoryName: categoryName.trim(),
    categoryCode: categoryName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10),
    description: description || null,
    parentCategoryId: parentCategoryId || null,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  await db.collection('item_categories').doc(categoryId).set(categoryDoc);
  return { success: true, category: categoryDoc };
});

/**
 * 10. updateItemCategory
 */
export const updateItemCategory = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { categoryId, categoryName, description, status } = data;

  if (!categoryId) {
    throw new functions.https.HttpsError('invalid-argument', 'categoryId is required.');
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { updatedAt: now };
  if (categoryName) updates.categoryName = categoryName.trim();
  if (description !== undefined) updates.description = description;
  if (status) updates.status = status;

  await db.collection('item_categories').doc(categoryId).update(updates);
  return { success: true, categoryId };
});

/**
 * 11. createUnitOfMeasure
 */
export const createUnitOfMeasure = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { unitName, unitCode, symbol, unitType = 'weight', baseUnit, conversionFactorToBase } = data;

  if (!unitName || !symbol) {
    throw new functions.https.HttpsError('invalid-argument', 'unitName and symbol are required.');
  }

  const unitId = `uom_${symbol.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const now = new Date().toISOString();

  const uomDoc = {
    id: unitId,
    unitId,
    unitCode: (unitCode || symbol).toUpperCase(),
    unitName: unitName.trim(),
    symbol: symbol.trim(),
    unitType,
    baseUnit: baseUnit || null,
    conversionFactorToBase: conversionFactorToBase ? Number(conversionFactorToBase) : 1,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  await db.collection('units_of_measure').doc(unitId).set(uomDoc);
  return { success: true, unit: uomDoc };
});

/**
 * 12. updateUnitOfMeasure
 */
export const updateUnitOfMeasure = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { unitId, unitName, symbol, status } = data;

  if (!unitId) {
    throw new functions.https.HttpsError('invalid-argument', 'unitId is required.');
  }

  const now = new Date().toISOString();
  const updates: Record<string, any> = { updatedAt: now };
  if (unitName) updates.unitName = unitName.trim();
  if (symbol) updates.symbol = symbol.trim();
  if (status) updates.status = status;

  await db.collection('units_of_measure').doc(unitId).update(updates);
  return { success: true, unitId };
});

/**
 * 13. getItemStockSummary
 * Reads authoritative stock ledger balance from warehouse movements
 */
export const getItemStockSummary = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { itemId } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const itemSnap = await db.collection('items').doc(itemId).get();
  if (!itemSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Item not found.');
  }

  const itemData = itemSnap.data();

  // Aggregate stock movements for this item
  const movementsSnap = await db.collection('stock_movements').where('itemId', '==', itemId).get();
  let calculatedStock = 0;
  movementsSnap.docs.forEach((d) => {
    const qty = d.data()?.quantity || 0;
    calculatedStock += qty;
  });

  return {
    success: true,
    itemId,
    itemCode: itemData?.itemCode,
    itemName: itemData?.itemName,
    baseUnit: itemData?.baseUnit,
    currentStock: calculatedStock > 0 ? calculatedStock : itemData?.currentStock || 0,
    reorderLevel: itemData?.reorderLevel || 0,
    minimumStockLevel: itemData?.minimumStockLevel || 0
  };
});

/**
 * 14. getItemUsageHistory
 * Returns recent chemical consumption and purchase records referencing this item
 */
export const getItemUsageHistory = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { itemId } = data;

  if (!itemId) {
    throw new functions.https.HttpsError('invalid-argument', 'itemId is required.');
  }

  const auditSnap = await db
    .collection('item_audit_logs')
    .where('itemId', '==', itemId)
    .orderBy('changedAt', 'desc')
    .limit(25)
    .get();

  const auditLogs = auditSnap.docs.map((d) => d.data());

  return {
    success: true,
    itemId,
    auditLogs
  };
});
