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
