"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportStatement = exports.getStatementInvoiceHistory = exports.approveStatementLineForInvoice = exports.getStatementColourSummary = exports.getStatementData = exports.getStatementFilters = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
// Helper to verify roles (Admin and Manager)
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
        throw new functions.https.HttpsError('permission-denied', `User role '${role}' is not authorized to access Statement module operations.`);
    }
    return { uid, role: normalizedRole, name };
}
// Function 1: getStatementFilters
exports.getStatementFilters = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { companyId } = data || {};
    // 1. Fetch eligible customer companies
    const vendorsSnap = await db.collection('vendors').where('status', '==', 'active').get();
    const companies = vendorsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((v) => v.vendorType === 'customer' || v.vendorType === 'both' || v.roles?.includes('Customer'))
        .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
    if (!companyId) {
        return { companies, styles: [], items: [], purchaseOrders: [] };
    }
    // 2. Fetch purchase orders for company
    const poSnap = await db.collection('purchase_orders').where('customerId', '==', companyId).get();
    const purchaseOrders = poSnap.docs.map((d) => {
        const p = d.data();
        return {
            id: d.id,
            poNumber: p.poNumber,
            styleNo: p.styleNo || p.styleNumber || '',
            itemName: p.itemName || 'Garments'
        };
    });
    const styleSet = new Set();
    const itemSet = new Set();
    purchaseOrders.forEach((po) => {
        if (po.styleNo)
            styleSet.add(po.styleNo);
        if (po.itemName)
            itemSet.add(po.itemName);
    });
    return {
        companies,
        styles: Array.from(styleSet).sort(),
        items: Array.from(itemSet).sort(),
        purchaseOrders
    };
});
// Function 2: getStatementData
exports.getStatementData = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { companyId, styleNo, itemName, poId } = data || {};
    if (!companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'Company ID is required to generate statement.');
    }
    // 1. Resolve Company
    const companyDoc = await db.collection('vendors').doc(companyId).get();
    const companyName = companyDoc.exists ? companyDoc.data()?.companyName : 'Selected Customer';
    // 2. Fetch matching POs
    let poQuery = db.collection('purchase_orders').where('customerId', '==', companyId);
    const poSnap = await poQuery.get();
    let matchedPOs = poSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (styleNo && styleNo !== 'all') {
        matchedPOs = matchedPOs.filter((p) => (p.styleNo || p.styleNumber || '').toLowerCase() === styleNo.toLowerCase());
    }
    if (itemName && itemName !== 'all') {
        matchedPOs = matchedPOs.filter((p) => (p.itemName || '').toLowerCase() === itemName.toLowerCase());
    }
    if (poId && poId !== 'all') {
        matchedPOs = matchedPOs.filter((p) => p.id === poId || p.poId === poId);
    }
    const poIds = new Set(matchedPOs.map((p) => p.id).concat(matchedPOs.map((p) => p.poId || '')));
    // 3. Load Inward entries
    const inwSnap = await db.collection('inward_entries').where('status', '==', 'posted').get();
    const matchedInwards = inwSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((i) => poIds.has(i.poId));
    // 4. Load Outward entries
    const outSnap = await db.collection('outward_entries').where('status', '==', 'posted').get();
    const matchedOutwards = outSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => poIds.has(o.poId));
    // 5. Load invoice approvals
    const apprSnap = await db.collection('invoice_approvals').where('companyId', '==', companyId).get();
    const approvals = apprSnap.docs.map((d) => d.data());
    const approvalMap = new Map();
    approvals.forEach((a) => approvalMap.set(a.poColourLineId, a));
    // 6. Build Inward Rows
    const inwards = [];
    matchedInwards.forEach((inEntry) => {
        const inwDate = inEntry.customerDate || inEntry.inwardDate || '';
        const dcNo = inEntry.customerDcNo || inEntry.inwardNo;
        if (inEntry.lines && inEntry.lines.length > 0) {
            inEntry.lines.forEach((l) => {
                inwards.push({
                    id: `${inEntry.id}_${l.inwardLineId || l.poLineId}`,
                    inwardId: inEntry.id,
                    inwardNo: inEntry.inwardNo,
                    date: inwDate,
                    dcNo,
                    poId: inEntry.poId,
                    poLineId: l.poLineId,
                    colour: l.colourNameSnapshot || l.colour || 'Standard',
                    qtyReceived: Number(l.receivedQty) || 0,
                    unit: l.unit || 'piece'
                });
            });
        }
    });
    inwards.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // 7. Build Outward Rows
    const outwards = [];
    matchedOutwards.forEach((outEntry) => {
        const outDate = outEntry.outwardDate || outEntry.ourDate || '';
        const dcNo = outEntry.ourDcNo || outEntry.outwardNo;
        if (outEntry.lines && outEntry.lines.length > 0) {
            outEntry.lines.forEach((l) => {
                outwards.push({
                    id: `${outEntry.id}_${l.outwardLineId || l.poLineId}`,
                    outwardId: outEntry.id,
                    outwardNo: outEntry.outwardNo,
                    date: outDate,
                    dcNo,
                    poId: outEntry.poId,
                    poLineId: l.poLineId,
                    colour: l.colourNameSnapshot || l.colour || 'Standard',
                    qtyDispatched: Number(l.dispatchQty) || 0,
                    unit: l.unit || 'piece'
                });
            });
        }
    });
    outwards.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // 8. Build Colour Lines Reconciliation
    const colourLines = [];
    matchedPOs.forEach((po) => {
        const rawLines = po.colourLines || po.lines || [];
        rawLines.forEach((line) => {
            const lineId = line.id || line.lineId;
            const colourName = line.colourName || line.colour || 'Standard';
            let cumulativeInward = 0;
            inwards.forEach((inRow) => {
                if (inRow.poLineId === lineId || (inRow.poId === po.id && inRow.colour.toLowerCase() === colourName.toLowerCase())) {
                    cumulativeInward += inRow.qtyReceived;
                }
            });
            let cumulativeOutward = 0;
            outwards.forEach((outRow) => {
                if (outRow.poLineId === lineId || (outRow.poId === po.id && outRow.colour.toLowerCase() === colourName.toLowerCase())) {
                    cumulativeOutward += outRow.qtyDispatched;
                }
            });
            const balanceQty = cumulativeInward - cumulativeOutward;
            const approval = approvalMap.get(lineId);
            const isApprovedForInvoice = Boolean(approval && approval.status === 'approved');
            const isInvoiced = Boolean(approval && approval.status === 'invoiced');
            const isReadyForInvoice = cumulativeInward > 0 && cumulativeInward === cumulativeOutward && !isApprovedForInvoice && !isInvoiced;
            colourLines.push({
                poId: po.id,
                poNumber: po.poNumber,
                styleNo: po.styleNo || po.styleNumber || 'N/A',
                itemName: po.itemName || 'Garments',
                poLineId: lineId,
                colour: colourName,
                processType: line.processType || 'Standard',
                unit: line.unit || 'piece',
                orderedQty: Number(line.quantity) || 0,
                rate: Number(line.rate) || 0,
                cumulativeInward,
                orderedVsInwardDiff: (Number(line.quantity) || 0) - cumulativeInward,
                cumulativeOutward,
                balanceQty,
                isReadyForInvoice,
                isApprovedForInvoice,
                isInvoiced,
                invoiceId: approval?.invoiceId,
                invoiceNo: approval?.invoiceNo
            });
        });
    });
    return {
        companyId,
        companyName,
        inwards,
        outwards,
        colourLines
    };
});
// Function 3: getStatementColourSummary
exports.getStatementColourSummary = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const result = await exports.getStatementData.run(data, context);
    return result.colourLines;
});
// Function 4: approveStatementLineForInvoice
exports.approveStatementLineForInvoice = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { poId, poLineId, companyId } = data || {};
    if (!poId || !poLineId || !companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'poId, poLineId, and companyId are required.');
    }
    // Idempotent Firestore transaction to validate and approve
    return await db.runTransaction(async (transaction) => {
        // Check if already approved
        const existingSnap = await transaction.get(db.collection('invoice_approvals').where('poColourLineId', '==', poLineId).limit(1));
        if (!existingSnap.empty) {
            const existing = existingSnap.docs[0].data();
            if (existing.status === 'invoiced') {
                throw new functions.https.HttpsError('failed-precondition', 'This colour line has already been invoiced.');
            }
            return { success: true, approvalId: existingSnap.docs[0].id, alreadyApproved: true };
        }
        // Load PO
        const poDoc = await transaction.get(db.collection('purchase_orders').doc(poId));
        if (!poDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Purchase Order was not found.');
        }
        const poData = poDoc.data();
        const line = (poData.colourLines || poData.lines || []).find((l) => (l.id || l.lineId) === poLineId);
        if (!line) {
            throw new functions.https.HttpsError('not-found', 'Colour line was not found on Purchase Order.');
        }
        // Load posted Inwards
        const inwQuery = await db.collection('inward_entries').where('poId', '==', poId).where('status', '==', 'posted').get();
        let totalInward = 0;
        inwQuery.docs.forEach((doc) => {
            const inw = doc.data();
            (inw.lines || []).forEach((l) => {
                if (l.poLineId === poLineId)
                    totalInward += Number(l.receivedQty) || 0;
            });
        });
        // Load posted Outwards
        const outwQuery = await db.collection('outward_entries').where('poId', '==', poId).where('status', '==', 'posted').get();
        let totalOutward = 0;
        outwQuery.docs.forEach((doc) => {
            const outw = doc.data();
            (outw.lines || []).forEach((l) => {
                if (l.poLineId === poLineId)
                    totalOutward += Number(l.dispatchQty) || 0;
            });
        });
        if (totalInward <= 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Total inward quantity must be greater than zero.');
        }
        if (totalInward !== totalOutward) {
            throw new functions.https.HttpsError('failed-precondition', `Quantities do not match! Received: ${totalInward}, Dispatched: ${totalOutward}.`);
        }
        const approvalRef = db.collection('invoice_approvals').doc();
        const now = admin.firestore.Timestamp.now();
        const approvalData = {
            approvalId: approvalRef.id,
            companyId,
            companyName: poData.customerName || poData.customerCompanyNameSnapshot || 'Customer Company',
            purchaseOrderId: poId,
            poNumber: poData.poNumber,
            styleNo: poData.styleNo || poData.styleNumber || 'N/A',
            itemName: poData.itemName || 'Garments',
            poColourLineId: poLineId,
            colourName: line.colourName || line.colour || 'Standard',
            unit: line.unit || 'piece',
            rate: Number(line.rate) || 0,
            approvedQuantity: totalOutward,
            totalInwardAtApproval: totalInward,
            totalOutwardAtApproval: totalOutward,
            status: 'approved',
            approvedBy: uid,
            approvedByName: name,
            approvedAt: now.toDate().toISOString(),
            createdAt: now.toDate().toISOString(),
            updatedAt: now.toDate().toISOString()
        };
        transaction.set(approvalRef, approvalData);
        return { success: true, approvalId: approvalRef.id, data: approvalData };
    });
});
// Function 5: getStatementInvoiceHistory
exports.getStatementInvoiceHistory = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { companyId } = data || {};
    let query = db.collection('invoice_approvals').where('status', '==', 'invoiced');
    if (companyId) {
        query = query.where('companyId', '==', companyId);
    }
    const snap = await query.get();
    return snap.docs.map((d) => d.data());
});
// Function 6: exportStatement
exports.exportStatement = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const statement = await exports.getStatementData.run(data, context);
    return { success: true, data: statement };
});
//# sourceMappingURL=statementFunctions.js.map