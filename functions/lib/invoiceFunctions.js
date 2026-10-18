"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceHistory = exports.cancelInvoice = exports.finalizeInvoice = exports.createInvoiceDraft = exports.getInvoiceEligibleLines = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
// Helper to verify role from auth token custom claims or Firestore user doc
async function verifyRole(context, allowedRoles) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const uid = context.auth.uid;
    let role = context.auth.token.role || '';
    let name = context.auth.token.name || '';
    if (!role || !name) {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            if (!role)
                role = data?.role || 'Supervisor';
            if (!name)
                name = data?.displayName || data?.name || 'Authorized User';
        }
        else {
            if (!role)
                role = 'Supervisor';
            if (!name)
                name = 'Authorized User';
        }
    }
    const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase());
    if (!normalizedAllowed.includes(normalizedRole)) {
        throw new functions.https.HttpsError('permission-denied', `User role '${role}' is not authorized to access Invoice module operations.`);
    }
    return { uid, role: normalizedRole, name };
}
// Indian Financial Year helper
function getFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (month >= 4) {
        return `${year}-${(year + 1).toString().slice(-2)}`;
    }
    else {
        return `${year - 1}-${year.toString().slice(-2)}`;
    }
}
/**
 * 1. getInvoiceEligibleLines
 * Returns colour lines approved for invoicing from the Statement module
 */
exports.getInvoiceEligibleLines = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { companyId, poNumber, styleNo } = data || {};
    let query = db.collection('invoice_approvals').where('status', '==', 'approved');
    if (companyId) {
        query = query.where('companyId', '==', companyId);
    }
    const snap = await query.get();
    const records = snap.docs.map((d) => ({ approvalId: d.id, ...d.data() }));
    // Filter out any lines that already have invoiceId or consumed
    const eligible = records.filter((r) => !r.invoiceId || r.invoiceId.trim() === '');
    // Filter optional PO and Style
    const filtered = eligible.filter((r) => {
        if (poNumber && r.poNumber?.toLowerCase() !== poNumber.toLowerCase())
            return false;
        if (styleNo && r.styleNo?.toLowerCase() !== styleNo.toLowerCase())
            return false;
        return true;
    });
    return { eligibleLines: filtered };
});
/**
 * 2. createInvoiceDraft
 * Creates an unfinalized invoice draft combining eligible approved lines
 */
exports.createInvoiceDraft = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { approvalIds } = data || {};
    if (!approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Please provide approvalIds to create an invoice draft.');
    }
    // Load approvals
    const approvalDocs = await Promise.all(approvalIds.map((id) => db.collection('invoice_approvals').doc(id).get()));
    const approvals = approvalDocs
        .filter((d) => d.exists)
        .map((d) => ({ approvalId: d.id, ...d.data() }));
    if (approvals.length === 0) {
        throw new functions.https.HttpsError('not-found', 'Selected approval records were not found.');
    }
    // Validate single customer
    const companyId = approvals[0].companyId;
    if (!approvals.every((a) => a.companyId === companyId)) {
        throw new functions.https.HttpsError('failed-precondition', 'All selected approval lines must belong to the same customer.');
    }
    // Validate unbilled
    if (approvals.some((a) => a.status === 'invoiced' || a.invoiceId)) {
        throw new functions.https.HttpsError('failed-precondition', 'One or more selected lines have already been invoiced.');
    }
    // Fetch Vendor/Customer details
    const vendorDoc = await db.collection('vendors').doc(companyId).get();
    const vendorData = vendorDoc.exists ? vendorDoc.data() : null;
    const now = new Date();
    const financialYear = getFinancialYear(now);
    const tempDraftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    return {
        success: true,
        draftId: tempDraftId,
        financialYear,
        companyId,
        customerName: vendorData?.companyName || approvals[0].companyName,
        approvals
    };
});
/**
 * 3. finalizeInvoice
 * Concurrency-safe finalization with atomic FY counter and approval locking
 */
exports.finalizeInvoice = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { invoiceData, approvalIds } = data || {};
    if (!invoiceData || !approvalIds || !Array.isArray(approvalIds) || approvalIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing invoiceData or approvalIds.');
    }
    const now = new Date();
    const financialYear = invoiceData.financialYear || getFinancialYear(now);
    const counterRef = db.collection('invoice_counters').doc(`invoice_${financialYear}`);
    const finalInvoiceId = db.collection('invoices').doc().id;
    return await db.runTransaction(async (txn) => {
        // 1. Re-read all approval records to prevent race condition / duplicate invoicing
        const approvalRefs = approvalIds.map((id) => db.collection('invoice_approvals').doc(id));
        const approvalSnaps = await Promise.all(approvalRefs.map((ref) => txn.get(ref)));
        for (const snap of approvalSnaps) {
            if (!snap.exists) {
                throw new functions.https.HttpsError('not-found', `Approval record not found: ${snap.id}`);
            }
            const appData = snap.data();
            if (appData?.status === 'invoiced' || appData?.invoiceId) {
                throw new functions.https.HttpsError('already-exists', `Colour line item ${appData?.colourName} (${appData?.styleNo}) has already been invoiced under ${appData?.invoiceNo || appData?.invoiceId}.`);
            }
        }
        // 2. Increment atomic FY counter
        const counterSnap = await txn.get(counterRef);
        let currentSeq = 0;
        if (counterSnap.exists) {
            currentSeq = counterSnap.data()?.currentSequence || 0;
        }
        const nextSeq = currentSeq + 1;
        txn.set(counterRef, { currentSequence: nextSeq, financialYear, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
        const invoiceNo = `PTP/${financialYear}/${String(nextSeq).padStart(4, '0')}`;
        // 3. Mark approvals as invoiced
        for (const ref of approvalRefs) {
            txn.update(ref, {
                status: 'invoiced',
                invoiceId: finalInvoiceId,
                invoiceNo,
                invoiceDate: invoiceData.invoiceDate || now.toISOString().split('T')[0],
                updatedAt: admin.firestore.Timestamp.now()
            });
        }
        // 4. Save Finalized Invoice Snapshot
        const invoiceRef = db.collection('invoices').doc(finalInvoiceId);
        const finalizedDoc = {
            ...invoiceData,
            id: finalInvoiceId,
            invoiceId: finalInvoiceId,
            invoiceNo,
            invoiceNumber: invoiceNo,
            financialYear,
            status: 'finalized',
            finalizedBy: uid,
            finalizedByName: name,
            finalizedAt: now.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
        };
        txn.set(invoiceRef, finalizedDoc);
        // 5. Save Lines in subcollection
        if (invoiceData.lines && Array.isArray(invoiceData.lines)) {
            for (const line of invoiceData.lines) {
                const lineId = line.lineId || db.collection('invoices').doc(finalInvoiceId).collection('lines').doc().id;
                const lineRef = db.collection('invoices').doc(finalInvoiceId).collection('lines').doc(lineId);
                txn.set(lineRef, {
                    ...line,
                    invoiceId: finalInvoiceId,
                    createdAt: now.toISOString()
                });
            }
        }
        // 6. Record Audit Log
        const auditRef = db.collection('invoice_audit_logs').doc();
        txn.set(auditRef, {
            auditId: auditRef.id,
            invoiceId: finalInvoiceId,
            invoiceNo,
            action: 'finalized',
            userId: uid,
            userName: name,
            timestamp: now.toISOString(),
            summary: `Invoice ${invoiceNo} finalized for ${finalizedDoc.customerSnapshot?.companyName || 'Customer'}`
        });
        return {
            success: true,
            invoiceId: finalInvoiceId,
            invoiceNo,
            finalizedInvoice: finalizedDoc
        };
    });
});
/**
 * 4. cancelInvoice
 * Controlled cancellation preserving audit history and releasing approvals if requested
 */
exports.cancelInvoice = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { invoiceId, reason } = data || {};
    if (!invoiceId || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'Invoice ID and cancellation reason are required.');
    }
    const invoiceRef = db.collection('invoices').doc(invoiceId);
    const snap = await invoiceRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', `Invoice ${invoiceId} not found.`);
    }
    const invoice = snap.data();
    if (invoice?.status === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Invoice has already been cancelled.');
    }
    const now = new Date().toISOString();
    // Update invoice status
    await invoiceRef.update({
        status: 'cancelled',
        cancelledBy: uid,
        cancelledByName: name,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now
    });
    // Record audit log
    const auditRef = db.collection('invoice_audit_logs').doc();
    await auditRef.set({
        auditId: auditRef.id,
        invoiceId,
        invoiceNo: invoice?.invoiceNo,
        action: 'cancelled',
        userId: uid,
        userName: name,
        timestamp: now,
        summary: `Invoice ${invoice?.invoiceNo} cancelled by ${name}. Reason: ${reason}`
    });
    return { success: true, invoiceId, status: 'cancelled' };
});
/**
 * 5. getInvoiceHistory
 * Returns invoice history for a company, PO, or style
 */
exports.getInvoiceHistory = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { companyId, poNumber, styleNo } = data || {};
    let query = db.collection('invoices').orderBy('createdAt', 'desc');
    if (companyId) {
        query = query.where('customerId', '==', companyId);
    }
    const snap = await query.get();
    let invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (poNumber) {
        invoices = invoices.filter((inv) => inv.poNumber === poNumber || inv.poNumbers?.includes(poNumber));
    }
    if (styleNo) {
        invoices = invoices.filter((inv) => inv.styleNo === styleNo || inv.styleNumbers?.includes(styleNo));
    }
    return { invoices };
});
//# sourceMappingURL=invoiceFunctions.js.map