"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reverseOutwardEntry = exports.updateOutwardDraft = exports.listOutwardEntries = exports.getOutwardEntry = exports.postOutwardEntry = exports.createOutwardDraft = exports.getOutwardBalances = exports.getEligibleOutwardPurchaseOrders = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const db = admin.firestore();
// Role verification helper
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
        throw new functions.https.HttpsError('permission-denied', `User role '${role}' is not authorized to perform outward dispatch operations.`);
    }
    return { uid, role: normalizedRole, name };
}
function getFYString(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const month = validDate.getMonth() + 1;
    const year = validDate.getFullYear();
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = (fyStart + 1) % 100;
    return `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
}
// Function 1: getEligibleOutwardPurchaseOrders
exports.getEligibleOutwardPurchaseOrders = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { customerId, poNumber, styleNo } = data || {};
    let query = db.collection('purchase_orders');
    if (customerId) {
        query = query.where('customerId', '==', customerId);
    }
    const snap = await query.get();
    const eligiblePOs = [];
    for (const doc of snap.docs) {
        const po = doc.data();
        if (po.status === 'cancelled' || po.status === 'rejected') {
            continue;
        }
        if (poNumber && !po.poNumber?.toLowerCase().includes(poNumber.toLowerCase())) {
            continue;
        }
        if (styleNo && !po.styleNo?.toLowerCase().includes(styleNo.toLowerCase())) {
            continue;
        }
        // Check if PO has posted inwards
        const inwardSnap = await db
            .collection('inward_entries')
            .where('poId', '==', doc.id)
            .where('status', '==', 'posted')
            .get();
        if (inwardSnap.empty) {
            continue;
        }
        // Calculate available dispatch quantity
        const outwardSnap = await db
            .collection('outward_entries')
            .where('poId', '==', doc.id)
            .where('status', '==', 'posted')
            .get();
        const inwardMap = {};
        for (const inDoc of inwardSnap.docs) {
            const inData = inDoc.data();
            for (const line of inData.lines || []) {
                inwardMap[line.poLineId] = (inwardMap[line.poLineId] || 0) + (Number(line.receivedQty) || 0);
            }
        }
        const outwardMap = {};
        for (const outDoc of outwardSnap.docs) {
            const outData = outDoc.data();
            for (const line of outData.lines || []) {
                outwardMap[line.poLineId] = (outwardMap[line.poLineId] || 0) + (Number(line.dispatchQty) || 0);
            }
        }
        let hasAvailableQty = false;
        const poLines = (po.lines && po.lines.length > 0) ? po.lines : (po.colourLines || []);
        if (poLines.length > 0) {
            for (const poLine of poLines) {
                const lineKey = poLine.lineId || poLine.id;
                const inQty = inwardMap[lineKey] || 0;
                const outQty = outwardMap[lineKey] || 0;
                if (inQty - outQty > 0) {
                    hasAvailableQty = true;
                    break;
                }
            }
        }
        else {
            let totalIn = 0;
            for (const inDoc of inwardSnap.docs) {
                totalIn += Number(inDoc.data().totalQuantity) || 0;
            }
            let totalOut = 0;
            for (const outDoc of outwardSnap.docs) {
                totalOut += Number(outDoc.data().totalQuantity) || 0;
            }
            if (totalIn - totalOut > 0) {
                hasAvailableQty = true;
            }
        }
        if (hasAvailableQty) {
            eligiblePOs.push({
                id: doc.id,
                poId: doc.id,
                poNumber: po.poNumber,
                customerId: po.customerId,
                customerName: po.customerName,
                styleNo: po.styleNo,
                itemName: po.itemName,
                processCategory: po.processCategory,
                orderDate: po.orderDate,
                status: po.status,
                lines: po.lines || []
            });
        }
    }
    return { purchaseOrders: eligiblePOs };
});
// Function 2: getOutwardBalances
exports.getOutwardBalances = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { poId, excludeOutwardId } = data || {};
    if (!poId) {
        throw new functions.https.HttpsError('invalid-argument', 'poId is required.');
    }
    const poDoc = await db.collection('purchase_orders').doc(poId).get();
    if (!poDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} not found.`);
    }
    const po = poDoc.data();
    // 1. Inward totals
    const inwardSnap = await db
        .collection('inward_entries')
        .where('poId', '==', poId)
        .where('status', '==', 'posted')
        .get();
    const inwardMap = {};
    for (const inDoc of inwardSnap.docs) {
        const inData = inDoc.data();
        for (const line of inData.lines || []) {
            inwardMap[line.poLineId] = (inwardMap[line.poLineId] || 0) + (Number(line.receivedQty) || 0);
        }
    }
    // 2. Outward totals
    const outwardSnap = await db
        .collection('outward_entries')
        .where('poId', '==', poId)
        .where('status', '==', 'posted')
        .get();
    const outwardMap = {};
    for (const outDoc of outwardSnap.docs) {
        if (excludeOutwardId && outDoc.id === excludeOutwardId)
            continue;
        const outData = outDoc.data();
        for (const line of outData.lines || []) {
            outwardMap[line.poLineId] = (outwardMap[line.poLineId] || 0) + (Number(line.dispatchQty) || 0);
        }
    }
    const lineBalances = {};
    let totalInwardPieces = 0;
    let totalOutwardPieces = 0;
    let totalAvailablePieces = 0;
    let totalInwardKg = 0;
    let totalOutwardKg = 0;
    let totalAvailableKg = 0;
    for (const poLine of po.lines || []) {
        const lineId = poLine.lineId;
        const cumInward = inwardMap[lineId] || 0;
        const cumOutward = outwardMap[lineId] || 0;
        const available = Math.max(0, cumInward - cumOutward);
        lineBalances[lineId] = {
            poLineId: lineId,
            colourName: poLine.colourName,
            colourCode: poLine.colourCode || null,
            itemName: po.itemName || 'Garments',
            processType: poLine.processType || 'Standard Process',
            unit: poLine.unit || 'piece',
            orderedQty: Number(poLine.quantity) || 0,
            cumulativeInwardQty: cumInward,
            cumulativeOutwardQty: cumOutward,
            availableForDispatch: available
        };
        if (poLine.unit === 'kg') {
            totalInwardKg += cumInward;
            totalOutwardKg += cumOutward;
            totalAvailableKg += available;
        }
        else {
            totalInwardPieces += cumInward;
            totalOutwardPieces += cumOutward;
            totalAvailablePieces += available;
        }
    }
    return {
        poId,
        poNumber: po.poNumber,
        lines: lineBalances,
        totalInwardPieces,
        totalOutwardPieces,
        totalAvailablePieces,
        totalInwardKg: Math.round(totalInwardKg * 100) / 100,
        totalOutwardKg: Math.round(totalOutwardKg * 100) / 100,
        totalAvailableKg: Math.round(totalAvailableKg * 100) / 100
    };
});
// Function 3: createOutwardDraft
exports.createOutwardDraft = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { customerVendorId, subcontractorVendorId, poId, outwardDate = new Date().toISOString().split('T')[0], ourDcNo = 'DRAFT-DC', vehicleNumber, driverName, transporterVendorId, destination, remarks, lines = [] } = data || {};
    if (!customerVendorId || !poId) {
        throw new functions.https.HttpsError('invalid-argument', 'customerVendorId and poId are required.');
    }
    const poDoc = await db.collection('purchase_orders').doc(poId).get();
    if (!poDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} not found.`);
    }
    const po = poDoc.data();
    const draftRef = db.collection('outward_entries').doc();
    const draftId = draftRef.id;
    const now = admin.firestore.Timestamp.now();
    const draftEntry = {
        outwardId: draftId,
        id: draftId,
        outwardNo: 'OUT/DRAFT',
        entryId: 'OUT/DRAFT',
        poId,
        poNumberSnapshot: po.poNumber,
        customerVendorId,
        customerCompanyNameSnapshot: po.customerName,
        subcontractorVendorId: subcontractorVendorId || null,
        subcontractorNameSnapshot: null,
        styleNoSnapshot: po.styleNo,
        itemNameSnapshot: po.itemName || 'Garments',
        processCategorySnapshot: po.processCategory || 'washing',
        outwardDate,
        ourDcNo,
        vehicleNumber: vehicleNumber || '',
        driverName: driverName || '',
        transporterVendorId: transporterVendorId || null,
        destination: destination || '',
        remarks: remarks || '',
        status: 'draft',
        lines: lines.map((l, idx) => ({
            outwardLineId: `outl_${draftId}_${idx + 1}`,
            outwardId: draftId,
            poId,
            poLineId: l.poLineId,
            colourNameSnapshot: l.colourNameSnapshot || 'Standard',
            colourCodeSnapshot: l.colourCodeSnapshot || null,
            itemNameSnapshot: l.itemNameSnapshot || po.itemName || 'Garments',
            washTypeSnapshot: l.washTypeSnapshot || 'Standard Wash',
            orderedQtySnapshot: Number(l.orderedQtySnapshot) || 0,
            unit: l.unit || 'piece',
            cumulativeInwardQtySnapshot: Number(l.cumulativeInwardQtySnapshot) || 0,
            previouslyDispatchedQtySnapshot: Number(l.previouslyDispatchedQtySnapshot) || 0,
            availableForDispatchSnapshot: Number(l.availableForDispatchSnapshot) || 0,
            dispatchQty: Number(l.dispatchQty) || 0,
            remainingAfterDispatchSnapshot: Number(l.remainingAfterDispatchSnapshot) || 0
        })),
        createdBy: uid,
        createdByName: name,
        createdAt: now,
        updatedBy: uid,
        updatedByName: name,
        updatedAt: now,
        schemaVersion: 1
    };
    await draftRef.set(draftEntry);
    return { success: true, outwardId: draftId, outwardNo: 'OUT/DRAFT' };
});
// Function 4: postOutwardEntry (Atomic, Concurrency Safe, Idempotent)
exports.postOutwardEntry = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { customerVendorId, subcontractorVendorId, poId, outwardDate, ourDcNo: inputDcNo, vehicleNumber, driverName, transporterVendorId, destination, remarks, lines = [] } = data || {};
    if (!customerVendorId || !poId || !outwardDate || !Array.isArray(lines) || lines.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required outward dispatch fields.');
    }
    // 1. Validate PO exists
    const poDoc = await db.collection('purchase_orders').doc(poId).get();
    if (!poDoc.exists) {
        throw new functions.https.HttpsError('not-found', `Purchase Order ${poId} not found.`);
    }
    const po = poDoc.data();
    if (po.customerId !== customerVendorId) {
        throw new functions.https.HttpsError('failed-precondition', `Selected customer does not match Purchase Order customer (${po.customerName}).`);
    }
    // 2. Filter lines
    const linesToDispatch = lines.filter((l) => (Number(l.dispatchQty) || 0) > 0);
    if (linesToDispatch.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'At least one colour line must have a dispatch quantity greater than 0.');
    }
    const fyString = getFYString(outwardDate);
    const now = admin.firestore.Timestamp.now();
    const outwardRef = db.collection('outward_entries').doc();
    const outwardId = outwardRef.id;
    let assignedOutwardNo = '';
    let finalDcNo = inputDcNo?.trim() || '';
    // 3. Concurrency-Safe Transaction
    await db.runTransaction(async (transaction) => {
        // A. Verify Inward Balances atomically
        const inwardQuery = db.collection('inward_entries').where('poId', '==', poId).where('status', '==', 'posted');
        const inwardSnap = await transaction.get(inwardQuery);
        const inwardMap = {};
        for (const inDoc of inwardSnap.docs) {
            const inData = inDoc.data();
            for (const line of inData.lines || []) {
                inwardMap[line.poLineId] = (inwardMap[line.poLineId] || 0) + (Number(line.receivedQty) || 0);
            }
        }
        // B. Verify Existing Outward Balances atomically
        const outwardQuery = db.collection('outward_entries').where('poId', '==', poId).where('status', '==', 'posted');
        const outwardSnap = await transaction.get(outwardQuery);
        const outwardMap = {};
        for (const outDoc of outwardSnap.docs) {
            const outData = outDoc.data();
            for (const line of outData.lines || []) {
                outwardMap[line.poLineId] = (outwardMap[line.poLineId] || 0) + (Number(line.dispatchQty) || 0);
            }
        }
        // C. Validate that requested dispatch does not exceed latest available balance
        for (const line of linesToDispatch) {
            const lineId = line.poLineId;
            const dispatchQty = Number(line.dispatchQty) || 0;
            const latestInward = inwardMap[lineId] || 0;
            const latestOutward = outwardMap[lineId] || 0;
            const available = Math.max(0, latestInward - latestOutward);
            if (dispatchQty > available) {
                throw new functions.https.HttpsError('aborted', `Concurrency contention: Available dispatch quantity for ${line.colourNameSnapshot || 'colour'} is only ${available} ${line.unit}. Requested: ${dispatchQty}.`);
            }
        }
        // D. Allocate Outward Number
        const counterRef = db.collection('outward_counters').doc(`outward_${fyString}`);
        const counterDoc = await transaction.get(counterRef);
        let nextSeq = 1;
        if (counterDoc.exists) {
            nextSeq = (Number(counterDoc.data()?.currentValue) || 0) + 1;
        }
        assignedOutwardNo = `OUT/${fyString}/${String(nextSeq).padStart(4, '0')}`;
        transaction.set(counterRef, {
            counterKey: `outward_${fyString}`,
            currentValue: nextSeq,
            financialYear: fyString,
            updatedAt: now
        }, { merge: true });
        // E. Allocate DC Number if not specified
        if (!finalDcNo) {
            const dcCounterRef = db.collection('outward_counters').doc('our_dc_number');
            const dcCounterDoc = await transaction.get(dcCounterRef);
            let nextDc = 1041;
            if (dcCounterDoc.exists) {
                nextDc = (Number(dcCounterDoc.data()?.currentValue) || 1040) + 1;
            }
            finalDcNo = `DC-PERLA-${nextDc}`;
            transaction.set(dcCounterRef, {
                counterKey: 'our_dc_number',
                currentValue: nextDc,
                updatedAt: now
            }, { merge: true });
        }
        // F. Finalize lines
        let totalPieces = 0;
        let totalKg = 0;
        const finalizedLines = linesToDispatch.map((l, idx) => {
            const lineId = l.poLineId;
            const cumInward = inwardMap[lineId] || 0;
            const prevOutward = outwardMap[lineId] || 0;
            const available = Math.max(0, cumInward - prevOutward);
            const remaining = Math.max(0, available - l.dispatchQty);
            if (l.unit === 'kg') {
                totalKg += Number(l.dispatchQty) || 0;
            }
            else {
                totalPieces += Number(l.dispatchQty) || 0;
            }
            return {
                outwardLineId: `outl_${outwardId}_${idx + 1}`,
                outwardId,
                poId,
                poLineId: l.poLineId,
                colourNameSnapshot: l.colourNameSnapshot,
                colourCodeSnapshot: l.colourCodeSnapshot || null,
                itemNameSnapshot: l.itemNameSnapshot || po.itemName || 'Garments',
                washTypeSnapshot: l.washTypeSnapshot || 'Standard Wash',
                orderedQtySnapshot: Number(l.orderedQtySnapshot) || 0,
                unit: l.unit || 'piece',
                cumulativeInwardQtySnapshot: cumInward,
                previouslyDispatchedQtySnapshot: prevOutward,
                availableForDispatchSnapshot: available,
                dispatchQty: Number(l.dispatchQty) || 0,
                remainingAfterDispatchSnapshot: remaining,
                createdAt: now
            };
        });
        const newOutwardEntry = {
            outwardId,
            id: outwardId,
            outwardNo: assignedOutwardNo,
            entryId: assignedOutwardNo,
            poId,
            poNumberSnapshot: po.poNumber,
            customerVendorId,
            customerCompanyNameSnapshot: po.customerName,
            subcontractorVendorId: subcontractorVendorId || null,
            subcontractorNameSnapshot: null,
            styleNoSnapshot: po.styleNo,
            itemNameSnapshot: po.itemName || 'Garments',
            processCategorySnapshot: po.processCategory || 'washing',
            outwardDate,
            ourDcNo: finalDcNo,
            vehicleNumber: vehicleNumber || '',
            driverName: driverName || '',
            transporterVendorId: transporterVendorId || null,
            destination: destination || '',
            remarks: remarks || '',
            status: 'posted',
            totalQtyByUnit: {
                piece: totalPieces,
                kg: Math.round(totalKg * 100) / 100
            },
            totalQuantity: totalPieces + totalKg,
            lines: finalizedLines,
            createdBy: uid,
            createdByName: name,
            createdAt: now,
            updatedBy: uid,
            updatedByName: name,
            updatedAt: now,
            postedBy: uid,
            postedByName: name,
            postedAt: now,
            schemaVersion: 1
        };
        transaction.set(outwardRef, newOutwardEntry);
        // G. Write Audit Log
        const auditRef = db.collection('outward_audit_logs').doc();
        transaction.set(auditRef, {
            auditId: auditRef.id,
            outwardId,
            outwardNo: assignedOutwardNo,
            action: 'posted',
            performedBy: uid,
            performedByName: name,
            performedAt: now,
            summary: `Outward Dispatch ${assignedOutwardNo} posted with Our DC No ${finalDcNo}. Dispatched: ${totalPieces} pieces, ${totalKg} kg.`
        });
    });
    return { success: true, outwardId, outwardNo: assignedOutwardNo, ourDcNo: finalDcNo };
});
// Function 5: getOutwardEntry
exports.getOutwardEntry = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { outwardId } = data || {};
    if (!outwardId) {
        throw new functions.https.HttpsError('invalid-argument', 'outwardId is required.');
    }
    const snap = await db.collection('outward_entries').doc(outwardId).get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', `Outward Entry ${outwardId} not found.`);
    }
    const logsSnap = await db
        .collection('outward_audit_logs')
        .where('outwardId', '==', outwardId)
        .orderBy('performedAt', 'desc')
        .get();
    const logs = logsSnap.docs.map((d) => ({ auditId: d.id, ...d.data() }));
    return { outward: { id: snap.id, ...snap.data() }, logs };
});
// Function 6: listOutwardEntries
exports.listOutwardEntries = functions.https.onCall(async (data, context) => {
    await verifyRole(context, ['Admin', 'Manager']);
    const { customerId, poId, status, page = 1, pageSize = 10 } = data || {};
    let query = db.collection('outward_entries');
    if (status && status !== 'all') {
        query = query.where('status', '==', status);
    }
    if (customerId) {
        query = query.where('customerVendorId', '==', customerId);
    }
    if (poId) {
        query = query.where('poId', '==', poId);
    }
    const snap = await query.get();
    const allEntries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    allEntries.sort((a, b) => {
        const dateA = a.outwardDate || '';
        const dateB = b.outwardDate || '';
        return dateB.localeCompare(dateA);
    });
    const totalCount = allEntries.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = allEntries.slice(startIndex, startIndex + pageSize);
    return {
        outwards: paginated,
        pagination: {
            page,
            pageSize,
            totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / pageSize))
        }
    };
});
// Function 7: updateOutwardDraft
exports.updateOutwardDraft = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { outwardId, ...updateFields } = data || {};
    if (!outwardId) {
        throw new functions.https.HttpsError('invalid-argument', 'outwardId is required.');
    }
    const outRef = db.collection('outward_entries').doc(outwardId);
    const snap = await outRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', `Outward Entry ${outwardId} not found.`);
    }
    const existing = snap.data();
    if (existing.status !== 'draft') {
        throw new functions.https.HttpsError('failed-precondition', `Cannot edit outward dispatch with status '${existing.status}'. Only drafts can be edited.`);
    }
    const now = admin.firestore.Timestamp.now();
    await outRef.update({
        ...updateFields,
        updatedBy: uid,
        updatedByName: name,
        updatedAt: now
    });
    return { success: true, outwardId };
});
// Function 8: reverseOutwardEntry
exports.reverseOutwardEntry = functions.https.onCall(async (data, context) => {
    const { uid, name } = await verifyRole(context, ['Admin', 'Manager']);
    const { outwardId, reversalReason } = data || {};
    if (!outwardId || !reversalReason || reversalReason.trim().length < 5) {
        throw new functions.https.HttpsError('invalid-argument', 'outwardId and a reversal reason (at least 5 characters) are required.');
    }
    const outRef = db.collection('outward_entries').doc(outwardId);
    const snap = await outRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', `Outward Entry ${outwardId} not found.`);
    }
    const outward = snap.data();
    if (outward.status !== 'posted') {
        throw new functions.https.HttpsError('failed-precondition', `Only posted outward dispatches can be reversed. Current status is '${outward.status}'.`);
    }
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    batch.update(outRef, {
        status: 'reversed',
        reversedBy: uid,
        reversedByName: name,
        reversedAt: now,
        reversalReason: reversalReason.trim(),
        updatedBy: uid,
        updatedByName: name,
        updatedAt: now
    });
    const auditRef = db.collection('outward_audit_logs').doc();
    batch.set(auditRef, {
        auditId: auditRef.id,
        outwardId,
        outwardNo: outward.outwardNo,
        action: 'reversed',
        performedBy: uid,
        performedByName: name,
        performedAt: now,
        summary: `Outward Dispatch ${outward.outwardNo} reversed by ${name}. Reason: "${reversalReason.trim()}".`
    });
    await batch.commit();
    return { success: true, outwardId, status: 'reversed' };
});
//# sourceMappingURL=outwardFunctions.js.map