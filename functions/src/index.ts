import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Helper to check role from auth token custom claims or Firestore user doc
async function verifyRole(context: functions.https.CallableContext, allowedRoles: string[]): Promise<{ uid: string; role: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = context.auth.uid;
  let role = (context.auth.token.role as string) || '';

  if (!role) {
    // Fallback to checking Firestore users document
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      role = data?.role || 'Supervisor';
    } else {
      role = 'Supervisor';
    }
  }

  // Normalize role casing
  const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const normalizedAllowed = allowedRoles.map(r => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase());

  if (!normalizedAllowed.includes(normalizedRole)) {
    throw new functions.https.HttpsError('permission-denied', `User role '${role}' is not authorized to perform this operation.`);
  }

  return { uid, role: normalizedRole };
}

// Function 1: createVendor
export const createVendor = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);

  const {
    companyName,
    legalCompanyName,
    vendorType,
    vendorCategory,
    parentVendorId,
    businessDescription,
    address,
    taxDetails,
    financialDetails,
    communication,
    notes,
    status = 'active',
    contacts = []
  } = data;

  if (!companyName || !vendorType || !vendorCategory || !address?.addressLine1 || !address?.state) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required vendor fields: companyName, vendorType, vendorCategory, addressLine1, and state are required.');
  }

  const now = admin.firestore.Timestamp.now();

  // Atomic Vendor Code generation via transaction
  const vendorRef = db.collection('vendors').doc();
  const vendorId = vendorRef.id;

  let vendorCode = '';

  await db.runTransaction(async (transaction) => {
    const counterRef = db.collection('vendor_counters').doc('vendor_code');
    const counterDoc = await transaction.get(counterRef);

    let nextVal = 1;
    if (counterDoc.exists) {
      nextVal = (counterDoc.data()?.currentValue || 0) + 1;
    }

    transaction.set(counterRef, {
      counterKey: 'vendor_code',
      currentValue: nextVal,
      updatedAt: now
    }, { merge: true });

    // Format VND-000001
    const padded = String(nextVal).padStart(6, '0');
    vendorCode = `VND-${padded}`;
  });

  // Enforce primary contact rule for initial contacts
  let activePrimaryFound = false;
  const processedContacts = contacts.map((c: any, idx: number) => {
    const contactId = c.contactId || `cnt_${Date.now()}_${idx}`;
    let isPrimary = Boolean(c.isPrimary);
    if (isPrimary && c.status !== 'inactive') {
      if (activePrimaryFound) {
        isPrimary = false; // Only allow one primary contact
      } else {
        activePrimaryFound = true;
      }
    }
    return {
      contactId,
      vendorId,
      personName: c.personName || 'Primary Contact',
      designation: c.designation || '',
      department: c.department || '',
      contactNumber: c.contactNumber || '',
      alternateNumber: c.alternateNumber || '',
      email: c.email || '',
      preferredContactMethod: c.preferredContactMethod || 'phone',
      isPrimary,
      notes: c.notes || '',
      status: c.status || 'active',
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid
    };
  });

  const vendorDoc = {
    vendorId,
    vendorCode,
    companyName,
    legalCompanyName: legalCompanyName || null,
    vendorType,
    vendorCategory,
    parentVendorId: parentVendorId || null,
    businessDescription: businessDescription || null,
    address: {
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city || '',
      district: address.district || '',
      state: address.state,
      pinCode: address.pinCode || '',
      country: address.country || 'India',
      gstStateCode: address.gstStateCode || ''
    },
    taxDetails: {
      gstRegistrationStatus: taxDetails?.gstRegistrationStatus || 'unregistered',
      gstin: taxDetails?.gstin || null,
      pan: taxDetails?.pan || null,
      cin: taxDetails?.cin || null,
      udyamRegistrationNumber: taxDetails?.udyamRegistrationNumber || null,
      otherRegistrationNumber: taxDetails?.otherRegistrationNumber || null
    },
    financialDetails: {
      paymentTerms: financialDetails?.paymentTerms || '30_days',
      customPaymentDays: financialDetails?.customPaymentDays || null,
      creditLimit: financialDetails?.creditLimit || 0,
      openingBalance: financialDetails?.openingBalance || 0,
      openingBalanceType: financialDetails?.openingBalanceType || 'none',
      preferredPaymentMethod: financialDetails?.preferredPaymentMethod || 'bank_transfer',
      bankAccountHolderName: financialDetails?.bankAccountHolderName || null,
      bankName: financialDetails?.bankName || null,
      bankAccountNumber: financialDetails?.bankAccountNumber || null,
      ifscCode: financialDetails?.ifscCode || null,
      branchName: financialDetails?.branchName || null,
      upiId: financialDetails?.upiId || null
    },
    communication: {
      officialEmail: communication?.officialEmail || '',
      officePhone: communication?.officePhone || '',
      mobileNumber: communication?.mobileNumber || '',
      website: communication?.website || '',
      alternateContactNumber: communication?.alternateContactNumber || ''
    },
    notes: notes || '',
    status: status,
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid,
    schemaVersion: 1
  };

  const batch = db.batch();
  batch.set(vendorRef, vendorDoc);

  // Write contacts into subcollection
  for (const contact of processedContacts) {
    const contactRef = vendorRef.collection('contacts').doc(contact.contactId);
    batch.set(contactRef, contact);
  }

  // Audit log entry
  const auditRef = db.collection('vendor_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    vendorId,
    action: 'created',
    performedBy: uid,
    performedAt: now,
    summary: `Vendor '${companyName}' created with code ${vendorCode}.`
  });

  await batch.commit();

  return { vendorId, vendorCode, success: true };
});

// Function 2: updateVendor
export const updateVendor = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);

  const { vendorId, updates } = data;
  if (!vendorId || !updates) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId and updates are required.');
  }

  const vendorRef = db.collection('vendors').doc(vendorId);
  const vendorSnap = await vendorRef.get();
  if (!vendorSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Vendor with ID ${vendorId} does not exist.`);
  }

  const currentVendor = vendorSnap.data();

  // Validate parent company if changed
  if (updates.parentVendorId !== undefined && updates.parentVendorId !== currentVendor?.parentVendorId) {
    if (updates.parentVendorId === vendorId) {
      throw new functions.https.HttpsError('invalid-argument', 'A vendor cannot be its own parent.');
    }
    if (updates.parentVendorId) {
      // Check for circular relationship
      let currentParentId: string | null = updates.parentVendorId;
      const visited = new Set<string>([vendorId]);
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          throw new functions.https.HttpsError('invalid-argument', 'Circular parent-child relationship detected.');
        }
        visited.add(currentParentId);
        const parentSnap = await db.collection('vendors').doc(currentParentId).get();
        currentParentId = parentSnap.exists ? parentSnap.data()?.parentVendorId : null;
      }
    }
  }

  const now = admin.firestore.Timestamp.now();
  const changedFields = Object.keys(updates);

  const mergedDoc = {
    ...updates,
    updatedAt: now,
    updatedBy: uid
  };

  // Do not allow overwriting protected vendorCode or createdAt
  delete mergedDoc.vendorCode;
  delete mergedDoc.createdAt;
  delete mergedDoc.createdBy;

  await vendorRef.update(mergedDoc);

  // Record Audit Log
  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'updated',
    performedBy: uid,
    performedAt: now,
    changedFields,
    summary: `Updated vendor fields: ${changedFields.join(', ')}`
  });

  return { success: true, vendorId };
});

// Function 3: setVendorStatus
export const setVendorStatus = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, status, reason } = data;

  if (!vendorId || !['active', 'inactive'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId and valid status ("active" | "inactive") are required.');
  }

  const now = admin.firestore.Timestamp.now();
  const vendorRef = db.collection('vendors').doc(vendorId);

  await vendorRef.update({
    status,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: status === 'active' ? 'activated' : 'deactivated',
    performedBy: uid,
    performedAt: now,
    summary: `Vendor status set to ${status}${reason ? `. Reason: ${reason}` : ''}`
  });

  return { success: true };
});

// Function 4: addVendorContact
export const addVendorContact = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, contact } = data;

  if (!vendorId || !contact || !contact.personName || !contact.contactNumber) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId, personName, and contactNumber are required.');
  }

  const now = admin.firestore.Timestamp.now();
  const contactsRef = db.collection('vendors').doc(vendorId).collection('contacts');

  if (contact.isPrimary && contact.status !== 'inactive') {
    // Transactionally clear isPrimary on existing active contacts
    const snapshot = await contactsRef.where('status', '==', 'active').where('isPrimary', '==', true).get();
    const batch = db.batch();
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { isPrimary: false, updatedAt: now, updatedBy: uid });
    });
    await batch.commit();
  }

  const newContactRef = contactsRef.doc();
  const contactId = newContactRef.id;

  const contactData = {
    ...contact,
    contactId,
    vendorId,
    isPrimary: Boolean(contact.isPrimary),
    status: contact.status || 'active',
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid
  };

  await newContactRef.set(contactData);

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'contact_added',
    performedBy: uid,
    performedAt: now,
    summary: `Added contact '${contact.personName}' (${contact.designation || 'Contact'})`
  });

  return { success: true, contact: contactData };
});

// Function 5: updateVendorContact
export const updateVendorContact = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, contactId, updates } = data;

  if (!vendorId || !contactId || !updates) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId, contactId, and updates are required.');
  }

  const now = admin.firestore.Timestamp.now();
  const contactsRef = db.collection('vendors').doc(vendorId).collection('contacts');
  const contactRef = contactsRef.doc(contactId);

  if (updates.isPrimary && updates.status !== 'inactive') {
    const snapshot = await contactsRef.where('status', '==', 'active').where('isPrimary', '==', true).get();
    const batch = db.batch();
    snapshot.docs.forEach((d) => {
      if (d.id !== contactId) {
        batch.update(d.ref, { isPrimary: false, updatedAt: now, updatedBy: uid });
      }
    });
    await batch.commit();
  }

  await contactRef.update({
    ...updates,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'contact_updated',
    performedBy: uid,
    performedAt: now,
    summary: `Updated contact ID ${contactId}`
  });

  return { success: true };
});

// Function 6: setVendorContactStatus
export const setVendorContactStatus = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, contactId, status } = data;

  if (!vendorId || !contactId || !['active', 'inactive'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId, contactId, and valid status are required.');
  }

  const now = admin.firestore.Timestamp.now();
  const contactRef = db.collection('vendors').doc(vendorId).collection('contacts').doc(contactId);
  const contactSnap = await contactRef.get();

  if (!contactSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Contact not found.');
  }

  const currentData = contactSnap.data();
  const updates: any = {
    status,
    updatedAt: now,
    updatedBy: uid
  };

  // If primary contact is deactivated, clear primary designation
  if (status === 'inactive' && currentData?.isPrimary) {
    updates.isPrimary = false;
  }

  await contactRef.update(updates);

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'contact_deactivated',
    performedBy: uid,
    performedAt: now,
    summary: `Contact '${currentData?.personName}' status set to ${status}`
  });

  return { success: true };
});

// Function 7: assignVendorParent
export const assignVendorParent = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, parentVendorId } = data;

  if (!vendorId) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId is required.');
  }

  if (parentVendorId === vendorId) {
    throw new functions.https.HttpsError('invalid-argument', 'Self-parenting is not allowed.');
  }

  if (parentVendorId) {
    let currentParent: string | null = parentVendorId;
    const visited = new Set<string>([vendorId]);

    while (currentParent) {
      if (visited.has(currentParent)) {
        throw new functions.https.HttpsError('invalid-argument', 'Circular parent-child relationship detected.');
      }
      visited.add(currentParent);
      const parentSnap = await db.collection('vendors').doc(currentParent).get();
      currentParent = parentSnap.exists ? parentSnap.data()?.parentVendorId : null;
    }
  }

  const now = admin.firestore.Timestamp.now();
  await db.collection('vendors').doc(vendorId).update({
    parentVendorId: parentVendorId || null,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'parent_changed',
    performedBy: uid,
    performedAt: now,
    summary: parentVendorId ? `Assigned parent vendor ID ${parentVendorId}` : 'Removed parent vendor relationship'
  });

  return { success: true };
});

// Function 8: archiveVendorDocument
export const archiveVendorDocument = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { vendorId, documentId } = data;

  if (!vendorId || !documentId) {
    throw new functions.https.HttpsError('invalid-argument', 'vendorId and documentId are required.');
  }

  const now = admin.firestore.Timestamp.now();
  const docRef = db.collection('vendors').doc(vendorId).collection('documents').doc(documentId);

  await docRef.update({
    status: 'archived',
    archivedAt: now,
    archivedBy: uid
  });

  const auditRef = db.collection('vendor_audit_logs').doc();
  await auditRef.set({
    auditId: auditRef.id,
    vendorId,
    action: 'document_archived',
    performedBy: uid,
    performedAt: now,
    summary: `Archived document ID ${documentId}`
  });

  return { success: true };
});

// ==========================================
// PURCHASE ORDER (PO) CLOUD FUNCTIONS
// ==========================================

function calculateServerPOTotals(lines: any[]) {
  const totalQtyByUnit: Record<string, number> = { piece: 0, kg: 0 };
  let totalQuantity = 0;
  let totalAmount = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    const unit = line.unit || 'piece';
    const rateBasis = line.rateBasis || 'per_piece';

    totalQtyByUnit[unit] = (totalQtyByUnit[unit] || 0) + qty;
    totalQuantity += qty;

    const isPerKgRate =
      rateBasis === 'per_kg' || rateBasis === 'perKg' || rateBasis === 'per kg';

    let lineAmount = 0;
    if (isPerKgRate) {
      if (unit === 'piece' && line.billableWeightKg) {
        lineAmount = Math.round(Number(line.billableWeightKg) * rate * 100) / 100;
      } else {
        lineAmount = Math.round(qty * rate * 100) / 100;
      }
    } else {
      if (unit === 'kg' && line.billablePieceQty) {
        lineAmount = Math.round(Number(line.billablePieceQty) * rate * 100) / 100;
      } else {
        lineAmount = Math.round(qty * rate * 100) / 100;
      }
    }

    line.lineAmount = lineAmount;
    line.amount = lineAmount;
    totalAmount += lineAmount;
  }

  return {
    totalQtyByUnit,
    totalQuantity,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
}

// Function 9: createPurchaseOrder
export const createPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);

  const {
    customerId,
    processCategory,
    styleNo,
    styleNumber,
    itemName,
    orderDate,
    deliveryDate,
    expectedCompletionDate,
    colourLines = [],
    customerReferenceNo,
    customerInstructions,
    internalRemarks,
    notes,
    status = 'draft'
  } = data;

  const resolvedStyleNo = styleNo || styleNumber;

  if (!customerId || !processCategory || !resolvedStyleNo || !itemName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required PO fields: customerId, processCategory, styleNo, and itemName are required.'
    );
  }

  if (!Array.isArray(colourLines) || colourLines.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'At least one colour line is required to create a Purchase Order.'
    );
  }

  // Verify customer in Vendor Master
  const customerDoc = await db.collection('vendors').doc(customerId).get();
  if (!customerDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      `Customer vendor ID '${customerId}' was not found in Vendor Master.`
    );
  }

  const customerData = customerDoc.data();
  const customerName = customerData?.companyName || 'Unknown Customer';
  const customerCode = customerData?.vendorCode || '';

  // Fetch creator display name
  let userName = 'Authorized User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Authorized User';
  }

  const now = admin.firestore.Timestamp.now();
  const dateObj = now.toDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  const fyString = `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
  const counterKey = `po_${fyString}`;

  const poRef = db.collection('purchase_orders').doc();
  const poId = poRef.id;
  let poNumber = '';

  // Atomic counter generation
  await db.runTransaction(async (transaction) => {
    const counterRef = db.collection('purchase_order_counters').doc(counterKey);
    const counterDoc = await transaction.get(counterRef);

    let nextVal = 1;
    if (counterDoc.exists) {
      nextVal = (counterDoc.data()?.currentValue || 0) + 1;
    }

    transaction.set(
      counterRef,
      {
        counterKey,
        currentValue: nextVal,
        updatedAt: now
      },
      { merge: true }
    );

    const padded = String(nextVal).padStart(4, '0');
    poNumber = `PO/${fyString}/${padded}`;
  });

  const processedColourLines = colourLines.map((line: any, idx: number) => {
    const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
    return {
      id: lineId,
      lineId,
      colourName: line.colourName || '',
      colourCode: line.colourCode || null,
      processType: line.processType || 'Softener Wash',
      quantity: Number(line.quantity) || 0,
      unit: line.unit || 'piece',
      rateBasis: line.rateBasis || 'per_piece',
      rate: Number(line.rate) || 0,
      billableWeightKg: line.billableWeightKg ? Number(line.billableWeightKg) : null,
      billablePieceQty: line.billablePieceQty ? Number(line.billablePieceQty) : null,
      lineAmount: 0,
      amount: 0,
      notes: line.notes || null,
      remarks: line.remarks || ''
    };
  });

  const totals = calculateServerPOTotals(processedColourLines);

  const poDoc = {
    id: poId,
    poId,
    poNumber,
    customerId,
    customerVendorId: customerId,
    customerCode,
    customerName,
    customerCompanyNameSnapshot: customerName,
    processCategory: String(processCategory).toLowerCase(),
    styleNo: resolvedStyleNo,
    styleNumber: resolvedStyleNo,
    itemName,
    orderDate: orderDate || now.toDate().toISOString().split('T')[0],
    deliveryDate: deliveryDate || null,
    expectedCompletionDate: expectedCompletionDate || deliveryDate || null,
    colourLines: processedColourLines,
    lines: processedColourLines,
    totalQtyByUnit: totals.totalQtyByUnit,
    totalQuantity: totals.totalQuantity,
    totalAmount: totals.totalAmount,
    currency: 'INR',
    customerReferenceNo: customerReferenceNo || null,
    customerInstructions: customerInstructions || null,
    internalRemarks: internalRemarks || null,
    notes: notes || null,
    status: status === 'submitted' ? 'submitted' : 'draft',
    revision: 1,
    createdBy: uid,
    createdById: uid,
    createdByName: userName,
    createdAt: now,
    updatedBy: uid,
    updatedById: uid,
    updatedAt: now,
    schemaVersion: 1
  };

  const batch = db.batch();
  batch.set(poRef, poDoc);

  // Write audit log
  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber,
    action: 'created',
    performedBy: uid,
    performedByName: userName,
    performedAt: now,
    summary: `Purchase Order ${poNumber} created with ${processedColourLines.length} colour line(s). Initial status: ${poDoc.status}.`
  });

  await batch.commit();

  return { poId, poNumber, success: true };
});

// Function 10: updatePurchaseOrder
export const updatePurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId, updates } = data;

  if (!poId || !updates) {
    throw new functions.https.HttpsError('invalid-argument', 'poId and updates are required.');
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} does not exist.`);
  }

  const currentPo = poSnap.data();

  // Only draft POs can be edited directly
  if (currentPo?.status !== 'draft') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Cannot edit PO in '${currentPo?.status}' status. Only draft POs can be edited directly.`
    );
  }

  const now = admin.firestore.Timestamp.now();

  let processedColourLines = currentPo.colourLines;
  if (updates.colourLines) {
    processedColourLines = updates.colourLines.map((line: any, idx: number) => {
      const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
      return {
        id: lineId,
        lineId,
        colourName: line.colourName || '',
        colourCode: line.colourCode || null,
        processType: line.processType || 'Softener Wash',
        quantity: Number(line.quantity) || 0,
        unit: line.unit || 'piece',
        rateBasis: line.rateBasis || 'per_piece',
        rate: Number(line.rate) || 0,
        billableWeightKg: line.billableWeightKg ? Number(line.billableWeightKg) : null,
        billablePieceQty: line.billablePieceQty ? Number(line.billablePieceQty) : null,
        lineAmount: 0,
        amount: 0,
        notes: line.notes || null,
        remarks: line.remarks || ''
      };
    });
  }

  const totals = calculateServerPOTotals(processedColourLines);

  const cleanUpdates = {
    ...updates,
    colourLines: processedColourLines,
    lines: processedColourLines,
    totalQtyByUnit: totals.totalQtyByUnit,
    totalQuantity: totals.totalQuantity,
    totalAmount: totals.totalAmount,
    updatedAt: now,
    updatedBy: uid,
    updatedById: uid
  };

  if (updates.styleNo) {
    cleanUpdates.styleNumber = updates.styleNo;
  }

  // Prevent overriding protected fields
  delete cleanUpdates.poNumber;
  delete cleanUpdates.createdAt;
  delete cleanUpdates.createdBy;
  delete cleanUpdates.createdById;
  delete cleanUpdates.createdByName;
  delete cleanUpdates.approvedAt;
  delete cleanUpdates.approvedBy;
  delete cleanUpdates.approvedById;

  const batch = db.batch();
  batch.update(poRef, cleanUpdates);

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo.poNumber,
    action: 'updated',
    performedBy: uid,
    performedAt: now,
    changedFields: Object.keys(updates),
    summary: `Draft Purchase Order ${currentPo.poNumber} updated.`
  });

  await batch.commit();

  return { success: true, poId };
});

// Function 11: submitPurchaseOrder
export const submitPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId } = data;

  if (!poId) {
    throw new functions.https.HttpsError('invalid-argument', 'poId is required.');
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase Order not found.');
  }

  const currentPo = poSnap.data();
  if (currentPo?.status !== 'draft') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Cannot submit PO with status '${currentPo?.status}'. Only 'draft' POs can be submitted.`
    );
  }

  const now = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.update(poRef, {
    status: 'submitted',
    submittedBy: uid,
    submittedById: uid,
    submittedAt: now,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo.poNumber,
    action: 'submitted',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${currentPo.poNumber} submitted for manager/admin approval.`
  });

  await batch.commit();

  return { success: true, poId };
});

// Function 12: approvePurchaseOrder
export const approvePurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId } = data;

  if (!poId) {
    throw new functions.https.HttpsError('invalid-argument', 'poId is required.');
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase Order not found.');
  }

  const currentPo = poSnap.data();
  if (currentPo?.status !== 'submitted' && currentPo?.status !== 'draft') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Cannot approve PO with status '${currentPo?.status}'.`
    );
  }

  const now = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.update(poRef, {
    status: 'approved',
    approvedBy: uid,
    approvedById: uid,
    approvedAt: now,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo.poNumber,
    action: 'approved',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${currentPo.poNumber} approved by ${uid}. Eligible for Inward receipt workflow.`
  });

  await batch.commit();

  return { success: true, poId };
});

// Function 13: rejectPurchaseOrder
export const rejectPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId, reason } = data;

  if (!poId || !reason) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'poId and rejection reason are required.'
    );
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase Order not found.');
  }

  const currentPo = poSnap.data();
  const now = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.update(poRef, {
    status: 'rejected',
    rejectionReason: reason,
    rejectedBy: uid,
    rejectedById: uid,
    rejectedAt: now,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo?.poNumber || '',
    action: 'rejected',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${currentPo?.poNumber || poId} rejected. Reason: ${reason}`
  });

  await batch.commit();

  return { success: true, poId };
});

// Function 14: cancelPurchaseOrder
export const cancelPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId, reason } = data;

  if (!poId || !reason) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'poId and cancellation reason are required.'
    );
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase Order not found.');
  }

  const currentPo = poSnap.data();

  // Check whether operational transactions reference this PO
  const inwardCheck = await db.collection('inwards').where('poId', '==', poId).limit(1).get();
  if (!inwardCheck.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cannot cancel Purchase Order: Inward receipts already reference this PO. Use operational closure instead.'
    );
  }

  const outwardCheck = await db.collection('outwards').where('poId', '==', poId).limit(1).get();
  if (!outwardCheck.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Cannot cancel Purchase Order: Outward delivery entries already reference this PO.'
    );
  }

  const now = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.update(poRef, {
    status: 'cancelled',
    cancellationReason: reason,
    cancelledBy: uid,
    cancelledById: uid,
    cancelledAt: now,
    updatedAt: now,
    updatedBy: uid
  });

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo?.poNumber || '',
    action: 'cancelled',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${currentPo?.poNumber || poId} cancelled. Reason: ${reason}`
  });

  await batch.commit();

  return { success: true, poId };
});

// Function 15: amendPurchaseOrder
export const amendPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { poId, newValues, reason } = data;

  if (!poId || !newValues || !reason) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'poId, newValues, and amendment reason are required.'
    );
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const poSnap = await poRef.get();
  if (!poSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Purchase Order not found.');
  }

  const currentPo = poSnap.data();
  const currentRevision = currentPo?.revision || 1;
  const nextRevision = currentRevision + 1;
  const now = admin.firestore.Timestamp.now();

  // Create amendment record
  const amendmentRef = db.collection('purchase_order_amendments').doc();
  const amendmentDoc = {
    amendmentId: amendmentRef.id,
    poId,
    poNumber: currentPo?.poNumber,
    amendmentNumber: nextRevision,
    previousSnapshot: currentPo,
    newValues,
    reason,
    requestedBy: uid,
    requestedAt: now,
    approvedBy: uid,
    approvedAt: now,
    status: 'approved'
  };

  const processedColourLines = (newValues.colourLines || currentPo?.colourLines || []).map(
    (line: any, idx: number) => {
      const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
      return {
        id: lineId,
        lineId,
        colourName: line.colourName || '',
        colourCode: line.colourCode || null,
        processType: line.processType || 'Softener Wash',
        quantity: Number(line.quantity) || 0,
        unit: line.unit || 'piece',
        rateBasis: line.rateBasis || 'per_piece',
        rate: Number(line.rate) || 0,
        billableWeightKg: line.billableWeightKg ? Number(line.billableWeightKg) : null,
        billablePieceQty: line.billablePieceQty ? Number(line.billablePieceQty) : null,
        lineAmount: 0,
        amount: 0,
        notes: line.notes || null,
        remarks: line.remarks || ''
      };
    }
  );

  const totals = calculateServerPOTotals(processedColourLines);

  const updatedPo = {
    ...newValues,
    colourLines: processedColourLines,
    lines: processedColourLines,
    totalQtyByUnit: totals.totalQtyByUnit,
    totalQuantity: totals.totalQuantity,
    totalAmount: totals.totalAmount,
    revision: nextRevision,
    updatedAt: now,
    updatedBy: uid,
    updatedById: uid
  };

  // Preserve protected keys
  delete updatedPo.poNumber;
  delete updatedPo.createdAt;
  delete updatedPo.createdBy;
  delete updatedPo.createdById;

  const batch = db.batch();
  batch.set(amendmentRef, amendmentDoc);
  batch.update(poRef, updatedPo);

  const auditRef = db.collection('purchase_order_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    poId,
    poNumber: currentPo?.poNumber,
    action: 'amended',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${currentPo?.poNumber} amended to Revision ${nextRevision}. Reason: ${reason}`
  });

  await batch.commit();

  return { success: true, poId, revision: nextRevision };
});

