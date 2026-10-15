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

  if (status === 'approved') {
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
  } else {
    poNumber = 'PO/PENDING';
  }

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
  const { uid } = await verifyRole(context, ['Admin']);
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

  let poNumber = currentPo?.poNumber;
  if (!poNumber || poNumber === 'PO/PENDING' || String(poNumber).includes('PENDING')) {
    const orderDateVal = currentPo?.orderDate;
    const d = orderDateVal ? new Date(orderDateVal) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const month = validDate.getMonth() + 1;
    const year = validDate.getFullYear();
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = (fyStart + 1) % 100;
    const fyString = `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
    const counterKey = `po_${fyString}`;

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
  }

  const batch = db.batch();
  batch.update(poRef, {
    poNumber,
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
    poNumber,
    action: 'approved',
    performedBy: uid,
    performedAt: now,
    summary: `Purchase Order ${poNumber} approved by ${uid}. Eligible for Inward receipt workflow.`
  });

  await batch.commit();

  return { success: true, poId, poNumber };
});

// Function 13: rejectPurchaseOrder
export const rejectPurchaseOrder = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin']);
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
    status: 'cancelled',
    rejectionReason: reason,
    rejectedBy: uid,
    rejectedById: uid,
    rejectedAt: now,
    cancelledBy: uid,
    cancelledById: uid,
    cancelledAt: now,
    cancellationReason: `Rejected by Admin: ${reason}`,
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

// ==========================================
// INWARD RECEIPT CLOUD FUNCTIONS
// ==========================================

function getInwardFYString(dateInput?: string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const month = validDate.getMonth() + 1;
  const year = validDate.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  return `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
}

// Function 16: generateInwardNumber
export const generateInwardNumber = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager']);
  const { receiptDate } = data || {};
  const fyString = getInwardFYString(receiptDate);
  const counterKey = `inward_${fyString}`;
  const now = admin.firestore.Timestamp.now();

  let inwardNo = '';
  await db.runTransaction(async (transaction) => {
    const counterRef = db.collection('inward_counters').doc(counterKey);
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
        financialYear: fyString,
        updatedAt: now
      },
      { merge: true }
    );

    const padded = String(nextVal).padStart(4, '0');
    inwardNo = `INW/${fyString}/${padded}`;
  });

  return { inwardNo, financialYear: fyString };
});

// Helper: Get cumulative posted inward quantities for a PO
async function getPOCumulativePostedInward(poId: string, excludeInwardId?: string) {
  const querySnap = await db
    .collection('inward_entries')
    .where('poId', '==', poId)
    .where('status', '==', 'posted')
    .get();

  const cumulativeMap: Record<string, number> = {};

  for (const docSnap of querySnap.docs) {
    if (excludeInwardId && docSnap.id === excludeInwardId) continue;
    const entryData = docSnap.data();
    const lines = entryData.lines || [];
    for (const line of lines) {
      const lineId = line.poLineId || line.lineId;
      if (lineId) {
        cumulativeMap[lineId] = (cumulativeMap[lineId] || 0) + (Number(line.receivedQty) || 0);
      }
    }
  }

  return cumulativeMap;
}

// Function 17: getEligiblePurchaseOrders
export const getEligiblePurchaseOrders = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { customerId, status } = data || {};

  let poQuery: FirebaseFirestore.Query = db.collection('purchase_orders');

  if (customerId) {
    poQuery = poQuery.where('customerId', '==', customerId);
  }

  const snap = await poQuery.get();
  const eligiblePOs: any[] = [];

  for (const docSnap of snap.docs) {
    const po = docSnap.data();
    const poStatus = String(po.status || '').toLowerCase();

    // Ineligible statuses: cancelled, rejected
    if (poStatus === 'cancelled' || poStatus === 'rejected') {
      continue;
    }

    // Must be approved, in_progress, partially_received, or submitted/draft if specifically queried
    if (status) {
      if (poStatus !== String(status).toLowerCase()) continue;
    } else {
      if (poStatus !== 'approved' && poStatus !== 'in_progress' && poStatus !== 'partially_received') {
        continue;
      }
    }

    // Calculate current cumulative inward for this PO
    const cumulativeMap = await getPOCumulativePostedInward(docSnap.id);
    const colourLines = po.colourLines || po.lines || [];

    let totalOrdered = 0;
    let totalReceived = 0;

    const processedLines = colourLines.map((line: any) => {
      const lineId = line.id || line.lineId;
      const ordered = Number(line.quantity) || 0;
      const prevReceived = cumulativeMap[lineId] || 0;
      const remaining = Math.max(0, ordered - prevReceived);

      totalOrdered += ordered;
      totalReceived += prevReceived;

      return {
        ...line,
        lineId,
        orderedQty: ordered,
        previouslyReceivedQty: prevReceived,
        remainingOrderQty: remaining,
        status: prevReceived === 0 ? 'Not Started' : remaining === 0 ? 'Fully Received' : 'Partially Received'
      };
    });

    const poProgress =
      totalReceived === 0 ? 'Not Started' : totalReceived >= totalOrdered ? 'Fully Received' : 'Partially Received';

    eligiblePOs.push({
      ...po,
      id: docSnap.id,
      poId: docSnap.id,
      colourLines: processedLines,
      lines: processedLines,
      totalOrderedQuantity: totalOrdered,
      totalReceivedQuantity: totalReceived,
      inwardProgress: poProgress
    });
  }

  return { purchaseOrders: eligiblePOs };
});

// Function 18: getInwardBalances
export const getInwardBalances = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { poId } = data || {};

  if (!poId) {
    throw new functions.https.HttpsError('invalid-argument', 'poId is required.');
  }

  const poDoc = await db.collection('purchase_orders').doc(poId).get();
  if (!poDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Purchase Order '${poId}' not found.`);
  }

  const poData = poDoc.data()!;
  const cumulativeMap = await getPOCumulativePostedInward(poId);
  const colourLines = poData.colourLines || poData.lines || [];

  const totalsByUnit: Record<string, { ordered: number; previouslyReceived: number; remaining: number }> = {
    piece: { ordered: 0, previouslyReceived: 0, remaining: 0 },
    kg: { ordered: 0, previouslyReceived: 0, remaining: 0 }
  };

  const processedLines = colourLines.map((line: any) => {
    const lineId = line.id || line.lineId;
    const ordered = Number(line.quantity) || 0;
    const prev = cumulativeMap[lineId] || 0;
    const remaining = Math.max(0, ordered - prev);
    const unit = line.unit === 'kg' ? 'kg' : 'piece';

    if (totalsByUnit[unit]) {
      totalsByUnit[unit].ordered += ordered;
      totalsByUnit[unit].previouslyReceived += prev;
      totalsByUnit[unit].remaining += remaining;
    }

    return {
      poLineId: lineId,
      colourName: line.colourName || '',
      colourCode: line.colourCode || null,
      itemName: line.itemName || poData.itemName || '',
      processType: line.processType || 'Softener Wash',
      orderedQty: ordered,
      unit,
      previouslyReceivedQty: prev,
      remainingOrderQty: remaining,
      currentReceiptQty: 0,
      cumulativeReceivedQty: prev,
      balanceAfterReceipt: remaining
    };
  });

  return {
    poId,
    poNumber: poData.poNumber,
    customerVendorId: poData.customerId || poData.customerVendorId,
    customerName: poData.customerName,
    styleNo: poData.styleNo || poData.styleNumber,
    itemName: poData.itemName,
    processCategory: poData.processCategory,
    lines: processedLines,
    totalsByUnit
  };
});

// Function 19: createInwardDraft
export const createInwardDraft = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const {
    poId,
    customerVendorId,
    subcontractorVendorId,
    customerDate,
    customerDcNo,
    inwardDate,
    remarks,
    lines = []
  } = data || {};

  if (!poId || !customerVendorId) {
    throw new functions.https.HttpsError('invalid-argument', 'poId and customerVendorId are required.');
  }

  // Verify PO
  const poDoc = await db.collection('purchase_orders').doc(poId).get();
  if (!poDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} not found.`);
  }

  const poData = poDoc.data()!;
  const poCustId = poData.customerId || poData.customerVendorId;
  if (poCustId !== customerVendorId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Customer mismatch: Selected customer does not match the customer on Purchase Order ${poData.poNumber}.`
    );
  }

  // Get user details
  let userName = 'Authorized User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Authorized User';
  }

  // Load subcontractor snapshot if provided
  let subcontractorNameSnapshot: string | null = null;
  if (subcontractorVendorId) {
    const subDoc = await db.collection('vendors').doc(subcontractorVendorId).get();
    if (subDoc.exists) {
      subcontractorNameSnapshot = subDoc.data()?.companyName || null;
    }
  }

  const now = admin.firestore.Timestamp.now();
  const inwardRef = db.collection('inward_entries').doc();
  const inwardId = inwardRef.id;

  const totalQtyByUnit: Record<string, number> = { piece: 0, kg: 0 };
  let totalQuantity = 0;

  const processedLines = (lines || []).map((l: any, idx: number) => {
    const qty = Number(l.receivedQty) || 0;
    const unit = l.unit === 'kg' ? 'kg' : 'piece';
    totalQtyByUnit[unit] = (totalQtyByUnit[unit] || 0) + qty;
    totalQuantity += qty;

    return {
      inwardLineId: l.inwardLineId || `inwl_${inwardId}_${idx}`,
      lineId: l.inwardLineId || `inwl_${inwardId}_${idx}`,
      inwardId,
      poId,
      poLineId: l.poLineId,
      colourNameSnapshot: l.colourNameSnapshot || l.colour || '',
      colour: l.colourNameSnapshot || l.colour || '',
      colourCodeSnapshot: l.colourCodeSnapshot || null,
      itemNameSnapshot: l.itemNameSnapshot || poData.itemName || '',
      washTypeSnapshot: l.washTypeSnapshot || l.processType || 'Softener Wash',
      processType: l.washTypeSnapshot || l.processType || 'Softener Wash',
      orderedQtySnapshot: Number(l.orderedQtySnapshot) || 0,
      unit,
      previouslyReceivedQtySnapshot: Number(l.previouslyReceivedQtySnapshot) || 0,
      receivedQty: qty,
      cumulativeReceivedQtySnapshot: (Number(l.previouslyReceivedQtySnapshot) || 0) + qty,
      balanceAfterReceiptSnapshot: Math.max(0, (Number(l.orderedQtySnapshot) || 0) - ((Number(l.previouslyReceivedQtySnapshot) || 0) + qty)),
      createdAt: now
    };
  });

  const inwardDoc = {
    id: inwardId,
    inwardId,
    inwardNo: 'INW/DRAFT',
    entryId: 'INW/DRAFT',
    poId,
    poNumberSnapshot: poData.poNumber || '',
    poNumber: poData.poNumber || '',
    customerVendorId,
    customerId: customerVendorId,
    customerCompanyNameSnapshot: poData.customerName || '',
    customerName: poData.customerName || '',
    subcontractorVendorId: subcontractorVendorId || null,
    subContractorId: subcontractorVendorId || null,
    subcontractorNameSnapshot,
    subContractorName: subcontractorNameSnapshot,
    styleNoSnapshot: poData.styleNo || poData.styleNumber || '',
    styleNo: poData.styleNo || poData.styleNumber || '',
    itemNameSnapshot: poData.itemName || '',
    itemName: poData.itemName || '',
    processCategorySnapshot: poData.processCategory || 'washing',
    processCategory: poData.processCategory || 'washing',
    customerDate: customerDate || now.toDate().toISOString().split('T')[0],
    customerDcNo: customerDcNo || 'DRAFT-DC',
    inwardDate: inwardDate || now.toDate().toISOString().split('T')[0],
    status: 'draft',
    totalQtyByUnit,
    totalQuantity,
    remarks: remarks || '',
    createdBy: uid,
    createdByName: userName,
    createdAt: now,
    updatedBy: uid,
    updatedByName: userName,
    updatedAt: now,
    lines: processedLines,
    schemaVersion: 1
  };

  const batch = db.batch();
  batch.set(inwardRef, inwardDoc);

  // Save each line to subcollection
  for (const line of processedLines) {
    const lineRef = inwardRef.collection('lines').doc(line.inwardLineId);
    batch.set(lineRef, line);
  }

  // Audit log
  const auditRef = db.collection('inward_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    inwardId,
    inwardNo: 'INW/DRAFT',
    action: 'created',
    performedBy: uid,
    performedByName: userName,
    performedAt: now,
    summary: `Inward Receipt draft created for PO ${poData.poNumber} (DC: ${inwardDoc.customerDcNo}).`
  });

  await batch.commit();

  return { inwardId, inwardNo: 'INW/DRAFT', success: true };
});

// Function 20: postInwardReceipt (Concurrency-Safe Transaction)
export const postInwardReceipt = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const {
    draftInwardId,
    poId,
    customerVendorId,
    subcontractorVendorId,
    customerDate,
    customerDcNo,
    inwardDate,
    remarks,
    lines = []
  } = data || {};

  if (!poId || !customerVendorId || !customerDcNo) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'poId, customerVendorId, and customerDcNo are required to post an inward receipt.'
    );
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'At least one colour line is required to post an inward receipt.'
    );
  }

  // Get user details
  let userName = 'Authorized User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Authorized User';
  }

  // Subcontractor name lookup
  let subcontractorNameSnapshot: string | null = null;
  if (subcontractorVendorId) {
    const subDoc = await db.collection('vendors').doc(subcontractorVendorId).get();
    if (subDoc.exists) {
      subcontractorNameSnapshot = subDoc.data()?.companyName || null;
    }
  }

  const now = admin.firestore.Timestamp.now();
  const fyString = getInwardFYString(inwardDate || customerDate);
  const counterKey = `inward_${fyString}`;

  const inwardRef = draftInwardId
    ? db.collection('inward_entries').doc(draftInwardId)
    : db.collection('inward_entries').doc();
  const inwardId = inwardRef.id;

  let assignedInwardNo = '';
  let updatedPOStatus = 'approved';

  // RUN CONCURRENCY-SAFE FIRESTORE TRANSACTION
  await db.runTransaction(async (transaction) => {
    // 1. Authoritative PO check
    const poRef = db.collection('purchase_orders').doc(poId);
    const poDoc = await transaction.get(poRef);
    if (!poDoc.exists) {
      throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} does not exist.`);
    }

    const poData = poDoc.data()!;
    const poCustId = poData.customerId || poData.customerVendorId;
    if (poCustId !== customerVendorId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Customer mismatch: Selected customer does not match the customer on Purchase Order ${poData.poNumber}.`
      );
    }

    const poColourLines = poData.colourLines || poData.lines || [];
    const poLinesMap = new Map<string, any>();
    for (const pl of poColourLines) {
      const plId = pl.id || pl.lineId;
      poLinesMap.set(plId, pl);
    }

    // 2. Validate all submitted lines belong to this PO
    for (const submittedLine of lines) {
      if (!poLinesMap.has(submittedLine.poLineId)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Submitted line ID '${submittedLine.poLineId}' does not belong to Purchase Order ${poData.poNumber}.`
        );
      }
    }

    // 3. Read all posted receipts for this PO to check remaining balance
    // Query posted inward receipts
    const postedReceiptsSnap = await db
      .collection('inward_entries')
      .where('poId', '==', poId)
      .where('status', '==', 'posted')
      .get();

    const cumulativeMap: Record<string, number> = {};
    for (const doc of postedReceiptsSnap.docs) {
      if (doc.id === inwardId) continue; // Skip self if re-posting draft
      const entryData = doc.data();
      const existingLines = entryData.lines || [];
      for (const el of existingLines) {
        const lid = el.poLineId || el.lineId;
        cumulativeMap[lid] = (cumulativeMap[lid] || 0) + (Number(el.receivedQty) || 0);
      }
    }

    // 4. Over-receipt validation and balance calculations
    let hasPositiveReceipt = false;
    const totalQtyByUnit: Record<string, number> = { piece: 0, kg: 0 };
    let totalQuantity = 0;

    const processedLines = lines.map((l: any, idx: number) => {
      const poLine = poLinesMap.get(l.poLineId);
      const orderedQty = Number(poLine.quantity) || 0;
      const prevQty = cumulativeMap[l.poLineId] || 0;
      const remainingBeforeThis = Math.max(0, orderedQty - prevQty);
      const received = Number(l.receivedQty) || 0;

      if (received < 0) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Negative quantity received on colour '${poLine.colourName}'. Received quantity must be >= 0.`
        );
      }

      if (received > remainingBeforeThis) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Over-receipt rejected for colour '${poLine.colourName}'. Maximum remaining quantity is ${remainingBeforeThis} ${poLine.unit}, but attempted receipt is ${received} ${poLine.unit}.`
        );
      }

      if (received > 0) {
        hasPositiveReceipt = true;
      }

      const unit = (poLine.unit === 'kg' ? 'kg' : 'piece') as 'piece' | 'kg';
      totalQtyByUnit[unit] = (totalQtyByUnit[unit] || 0) + received;
      totalQuantity += received;

      const newCumulative = prevQty + received;
      const balanceAfter = Math.max(0, orderedQty - newCumulative);

      return {
        inwardLineId: l.inwardLineId || `inwl_${inwardId}_${idx}`,
        lineId: l.inwardLineId || `inwl_${inwardId}_${idx}`,
        inwardId,
        poId,
        poLineId: l.poLineId,
        colourNameSnapshot: poLine.colourName,
        colour: poLine.colourName,
        colourCodeSnapshot: poLine.colourCode || null,
        itemNameSnapshot: poLine.itemName || poData.itemName,
        washTypeSnapshot: poLine.processType || 'Softener Wash',
        processType: poLine.processType || 'Softener Wash',
        orderedQtySnapshot: orderedQty,
        unit,
        previouslyReceivedQtySnapshot: prevQty,
        receivedQty: received,
        cumulativeReceivedQtySnapshot: newCumulative,
        balanceAfterReceiptSnapshot: balanceAfter,
        createdAt: now
      };
    });

    if (!hasPositiveReceipt) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'At least one colour line must have a receipt quantity greater than 0 before posting.'
      );
    }

    // 5. Generate collision-safe inward number
    const counterRef = db.collection('inward_counters').doc(counterKey);
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
        financialYear: fyString,
        updatedAt: now
      },
      { merge: true }
    );

    const padded = String(nextVal).padStart(4, '0');
    assignedInwardNo = `INW/${fyString}/${padded}`;

    // 6. Check PO new progress status
    let allLinesFullyReceived = true;
    for (const pl of poColourLines) {
      const plId = pl.id || pl.lineId;
      const linePrev = cumulativeMap[plId] || 0;
      const submittedMatch = processedLines.find((plSubmitted: any) => plSubmitted.poLineId === plId);
      const submittedQty = submittedMatch ? submittedMatch.receivedQty : 0;
      const totalLineReceived = linePrev + submittedQty;
      if (totalLineReceived < (Number(pl.quantity) || 0)) {
        allLinesFullyReceived = false;
      }
    }

    updatedPOStatus = allLinesFullyReceived ? 'fully_received' : 'partially_received';

    // 7. Write Inward Header
    const inwardDoc = {
      id: inwardId,
      inwardId,
      inwardNo: assignedInwardNo,
      entryId: assignedInwardNo,
      poId,
      poNumberSnapshot: poData.poNumber,
      poNumber: poData.poNumber,
      customerVendorId,
      customerId: customerVendorId,
      customerCompanyNameSnapshot: poData.customerName,
      customerName: poData.customerName,
      subcontractorVendorId: subcontractorVendorId || null,
      subContractorId: subcontractorVendorId || null,
      subcontractorNameSnapshot,
      subContractorName: subcontractorNameSnapshot,
      styleNoSnapshot: poData.styleNo || poData.styleNumber,
      styleNo: poData.styleNo || poData.styleNumber,
      itemNameSnapshot: poData.itemName,
      itemName: poData.itemName,
      processCategorySnapshot: poData.processCategory || 'washing',
      processCategory: poData.processCategory || 'washing',
      customerDate: customerDate || now.toDate().toISOString().split('T')[0],
      customerDcNo,
      inwardDate: inwardDate || now.toDate().toISOString().split('T')[0],
      status: 'posted',
      totalQtyByUnit,
      totalQuantity,
      remarks: remarks || '',
      createdBy: uid,
      createdByName: userName,
      createdAt: now,
      updatedBy: uid,
      updatedByName: userName,
      updatedAt: now,
      postedBy: uid,
      postedByName: userName,
      postedAt: now,
      lines: processedLines,
      schemaVersion: 1
    };

    transaction.set(inwardRef, inwardDoc);

    // Write subcollection lines
    for (const pline of processedLines) {
      const subLineRef = inwardRef.collection('lines').doc(pline.inwardLineId);
      transaction.set(subLineRef, pline);
    }

    // Update PO progress status
    transaction.update(poRef, {
      status: updatedPOStatus,
      updatedAt: now,
      updatedBy: uid
    });

    // Write Audit Log
    const auditRef = db.collection('inward_audit_logs').doc();
    transaction.set(auditRef, {
      auditId: auditRef.id,
      inwardId,
      inwardNo: assignedInwardNo,
      action: 'posted',
      performedBy: uid,
      performedByName: userName,
      performedAt: now,
      summary: `Inward Receipt ${assignedInwardNo} posted for PO ${poData.poNumber} with DC No '${customerDcNo}'. Total Qty: ${totalQuantity} (${totalQtyByUnit.piece || 0} pcs, ${totalQtyByUnit.kg || 0} kg).`
    });
  });

  return {
    inwardId,
    inwardNo: assignedInwardNo,
    poStatus: updatedPOStatus,
    success: true
  };
});

// Function 21: getInwardReceipt
export const getInwardReceipt = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const { inwardId } = data || {};

  if (!inwardId) {
    throw new functions.https.HttpsError('invalid-argument', 'inwardId is required.');
  }

  const inwardDoc = await db.collection('inward_entries').doc(inwardId).get();
  if (!inwardDoc.exists) {
    throw new functions.https.HttpsError('not-found', `Inward Receipt ${inwardId} not found.`);
  }

  const inwardData = inwardDoc.data()!;

  // Read subcollection lines
  const linesSnap = await db.collection('inward_entries').doc(inwardId).collection('lines').get();
  let lines: any[] = [];
  if (!linesSnap.empty) {
    lines = linesSnap.docs.map((d) => d.data());
  } else {
    lines = inwardData.lines || [];
  }

  // Read audit logs for this receipt
  const auditSnap = await db
    .collection('inward_audit_logs')
    .where('inwardId', '==', inwardId)
    .orderBy('performedAt', 'desc')
    .get();
  const auditLogs = auditSnap.docs.map((d) => d.data());

  return {
    inward: {
      ...inwardData,
      lines
    },
    auditLogs
  };
});

// Function 22: listInwardReceipts
export const listInwardReceipts = functions.https.onCall(async (data, context) => {
  await verifyRole(context, ['Admin', 'Manager', 'Supervisor']);
  const {
    customerId,
    subcontractorId,
    poId,
    status,
    customerDcNo,
    startDate,
    endDate,
    pageSize = 50
  } = data || {};

  let q: FirebaseFirestore.Query = db.collection('inward_entries');

  if (customerId) {
    q = q.where('customerVendorId', '==', customerId);
  }
  if (subcontractorId) {
    q = q.where('subcontractorVendorId', '==', subcontractorId);
  }
  if (poId) {
    q = q.where('poId', '==', poId);
  }
  if (status && status !== 'all') {
    q = q.where('status', '==', status);
  }

  const snap = await q.get();
  let results = snap.docs.map((d) => {
    const dData = d.data();
    return {
      ...dData,
      id: d.id,
      inwardId: dData.inwardId || d.id
    };
  });

  // Client-side date and DC filters if not indexed together
  if (customerDcNo) {
    const dcLower = String(customerDcNo).toLowerCase();
    results = results.filter((r: any) => String(r.customerDcNo || '').toLowerCase().includes(dcLower));
  }
  if (startDate) {
    results = results.filter((r: any) => (r.inwardDate || r.customerDate) >= startDate);
  }
  if (endDate) {
    results = results.filter((r: any) => (r.inwardDate || r.customerDate) <= endDate);
  }

  // Sort descending by inwardDate / createdAt
  results.sort((a: any, b: any) => {
    const dateA = a.inwardDate || a.customerDate || '';
    const dateB = b.inwardDate || b.customerDate || '';
    return dateB.localeCompare(dateA);
  });

  return {
    inwards: results.slice(0, pageSize),
    totalCount: results.length
  };
});

// Function 23: updateInwardDraft
export const updateInwardDraft = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { inwardId, updates } = data || {};

  if (!inwardId || !updates) {
    throw new functions.https.HttpsError('invalid-argument', 'inwardId and updates are required.');
  }

  const inwardRef = db.collection('inward_entries').doc(inwardId);
  const inwardSnap = await inwardRef.get();
  if (!inwardSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Inward Receipt ${inwardId} not found.`);
  }

  const current = inwardSnap.data()!;
  if (current.status !== 'draft') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Cannot edit inward receipt with status '${current.status}'. Only drafts can be modified.`
    );
  }

  let userName = 'Authorized User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Authorized User';
  }

  const now = admin.firestore.Timestamp.now();

  const cleanUpdates = {
    ...updates,
    updatedAt: now,
    updatedBy: uid,
    updatedByName: userName
  };

  delete cleanUpdates.inwardNo;
  delete cleanUpdates.status;
  delete cleanUpdates.createdAt;
  delete cleanUpdates.createdBy;

  const batch = db.batch();
  batch.update(inwardRef, cleanUpdates);

  if (updates.lines) {
    for (const line of updates.lines) {
      const lineRef = inwardRef.collection('lines').doc(line.inwardLineId || line.lineId);
      batch.set(lineRef, { ...line, updatedAt: now }, { merge: true });
    }
  }

  const auditRef = db.collection('inward_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    inwardId,
    inwardNo: current.inwardNo,
    action: 'updated',
    performedBy: uid,
    performedByName: userName,
    performedAt: now,
    changedFields: Object.keys(updates),
    summary: `Inward draft ${current.inwardNo} updated.`
  });

  await batch.commit();

  return { success: true, inwardId };
});

// Function 24: reverseInwardReceipt (Controlled Authorised Reversal)
export const reverseInwardReceipt = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin', 'Manager']);
  const { inwardId, reversalReason } = data || {};

  if (!inwardId || !reversalReason || String(reversalReason).trim().length < 5) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'inwardId and a detailed reversalReason (at least 5 characters) are required.'
    );
  }

  const inwardRef = db.collection('inward_entries').doc(inwardId);
  const inwardSnap = await inwardRef.get();
  if (!inwardSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Inward Receipt ${inwardId} not found.`);
  }

  const inwardData = inwardSnap.data()!;
  if (inwardData.status !== 'posted') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Cannot reverse receipt with status '${inwardData.status}'. Only posted receipts can be reversed.`
    );
  }

  const poId = inwardData.poId;

  // OUTWARD DEPENDENCY SAFETY CHECK:
  // Check if goods received in this inward have already been dispatched in Outward!
  // Remaining Posted Inward after reversing this receipt must be >= Total Outward Dispatched!
  const allPostedInwardsSnap = await db
    .collection('inward_entries')
    .where('poId', '==', poId)
    .where('status', '==', 'posted')
    .get();

  const cumulativePostedMinusThis: Record<string, number> = {};
  for (const doc of allPostedInwardsSnap.docs) {
    if (doc.id === inwardId) continue;
    const lines = doc.data().lines || [];
    for (const l of lines) {
      const lid = l.poLineId || l.lineId;
      cumulativePostedMinusThis[lid] = (cumulativePostedMinusThis[lid] || 0) + (Number(l.receivedQty) || 0);
    }
  }

  const outwardSnap = await db.collection('outwards').where('poId', '==', poId).get();
  const cumulativeOutwardMap: Record<string, number> = {};
  for (const doc of outwardSnap.docs) {
    const lines = doc.data().lines || [];
    for (const l of lines) {
      const lid = l.poLineId || l.lineId;
      cumulativeOutwardMap[lid] = (cumulativeOutwardMap[lid] || 0) + (Number(l.dispatchQty) || 0);
    }
  }

  for (const thisLine of inwardData.lines || []) {
    const lid = thisLine.poLineId || thisLine.lineId;
    const remainingInward = cumulativePostedMinusThis[lid] || 0;
    const dispatched = cumulativeOutwardMap[lid] || 0;
    if (remainingInward < dispatched) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `Cannot reverse Inward Receipt ${inwardData.inwardNo}: ${dispatched} units of '${thisLine.colourNameSnapshot || thisLine.colour}' have already been dispatched in Outward. Reversing this receipt would reduce available stock below dispatched quantity.`
      );
    }
  }

  let userName = 'Authorized User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Authorized User';
  }

  const now = admin.firestore.Timestamp.now();

  const batch = db.batch();
  batch.update(inwardRef, {
    status: 'reversed',
    reversedBy: uid,
    reversedByName: userName,
    reversedAt: now,
    reversalReason: String(reversalReason).trim(),
    updatedAt: now,
    updatedBy: uid
  });

  // Re-evaluate PO status
  const poRef = db.collection('purchase_orders').doc(poId);
  const totalRemainingInward = Object.values(cumulativePostedMinusThis).reduce((acc, v) => acc + v, 0);
  const newPOStatus = totalRemainingInward > 0 ? 'partially_received' : 'approved';
  batch.update(poRef, {
    status: newPOStatus,
    updatedAt: now,
    updatedBy: uid
  });

  // Audit log
  const auditRef = db.collection('inward_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    inwardId,
    inwardNo: inwardData.inwardNo,
    action: 'reversed',
    performedBy: uid,
    performedByName: userName,
    performedAt: now,
    summary: `Inward Receipt ${inwardData.inwardNo} reversed by ${userName}. Reason: ${reversalReason}. PO status reset to ${newPOStatus}.`
  });

  await batch.commit();

  return { success: true, inwardId, status: 'reversed' };
});

// Function 25: deleteInwardReceipt (Admin Only)
export const deleteInwardReceipt = functions.https.onCall(async (data, context) => {
  const { uid } = await verifyRole(context, ['Admin']);
  const { inwardId } = data || {};

  if (!inwardId) {
    throw new functions.https.HttpsError('invalid-argument', 'inwardId is required.');
  }

  const inwardRef = db.collection('inward_entries').doc(inwardId);
  const inwardSnap = await inwardRef.get();
  if (!inwardSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Inward Receipt ${inwardId} not found.`);
  }

  const inwardData = inwardSnap.data()!;
  const poId = inwardData.poId;

  // Delete subcollection lines
  const linesSnap = await inwardRef.collection('lines').get();
  const batch = db.batch();
  for (const lineDoc of linesSnap.docs) {
    batch.delete(lineDoc.ref);
  }

  // Delete inward header document
  batch.delete(inwardRef);

  // Recalculate remaining posted inward quantities for this PO to update PO status
  const remainingInwardsSnap = await db
    .collection('inward_entries')
    .where('poId', '==', poId)
    .where('status', '==', 'posted')
    .get();

  let hasRemainingPostedInward = false;
  for (const doc of remainingInwardsSnap.docs) {
    if (doc.id !== inwardId) {
      hasRemainingPostedInward = true;
      break;
    }
  }

  const poRef = db.collection('purchase_orders').doc(poId);
  const newStatus = hasRemainingPostedInward ? 'partially_received' : 'approved';
  batch.update(poRef, {
    status: newStatus,
    updatedAt: admin.firestore.Timestamp.now(),
    updatedBy: uid
  });

  // Record audit log
  let userName = 'Admin User';
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists) {
    userName = userDoc.data()?.displayName || userDoc.data()?.name || 'Admin User';
  }

  const auditRef = db.collection('inward_audit_logs').doc();
  batch.set(auditRef, {
    auditId: auditRef.id,
    inwardId,
    inwardNo: inwardData.inwardNo || inwardId,
    action: 'cancelled',
    performedBy: uid,
    performedByName: userName,
    performedAt: admin.firestore.Timestamp.now(),
    summary: `Inward Receipt ${inwardData.inwardNo || inwardId} deleted by Admin ${userName}.`
  });

  await batch.commit();

  return { success: true, inwardId };
});


