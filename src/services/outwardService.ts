import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  OutwardEntry,
  OutwardLine,
  OutwardAuditLog,
  OutwardFilterOptions,
  OutwardPagination,
  OutwardDashboardMetrics,
  OutwardBalancesResponse,
  OutwardLineBalance,
  OutwardStatus
} from '../types/outward';
import { POLockService } from './poLockService';
import { PurchaseOrder } from '../types/po';
import { Vendor } from '../types/vendor';
import { calculateOutwardTotalsByUnit } from '../schemas/outwardSchema';
import { InwardService } from './inwardService';
import { POService } from './poService';
import { VendorService } from './vendorService';

// No dummy entries — all data comes from Firebase
export const initialMockOutwardEntries: OutwardEntry[] = [];

export const initialMockOutwardAuditLogs: Record<string, OutwardAuditLog[]> = {};

const LOCAL_STORAGE_KEY = 'perla_erp_outward_entries';
const AUDIT_STORAGE_KEY = 'perla_erp_outward_audit_logs';

let memoryOutwards: OutwardEntry[] = [];
let memoryAuditLogs: Record<string, OutwardAuditLog[]> = {};


function getLocalOutwards(): OutwardEntry[] {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Fallback
      }
    }
  }
  return memoryOutwards;
}

function saveLocalOutwards(entries: OutwardEntry[]) {
  memoryOutwards = entries;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // ignore
    }
  }
}

function getLocalAuditLogs(): Record<string, OutwardAuditLog[]> {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object') return parsed;
      } catch (e) {
        // Fallback
      }
    }
  }
  return memoryAuditLogs;
}

function saveLocalAuditLogs(logs: Record<string, OutwardAuditLog[]>) {
  memoryAuditLogs = logs;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      // ignore
    }
  }
}

function getFYString(dateInput?: string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const month = validDate.getMonth() + 1;
  const year = validDate.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = (fyStart + 1) % 100;
  return `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
}

export class OutwardService {
  /**
   * Generates a collision-safe, unique Outward Dispatch Number (OUT/YYYY-YY/XXXX)
   */
  static async generateOutwardNumber(dispatchDate?: string, isDemo: boolean = false): Promise<string> {
    const fyString = getFYString(dispatchDate);
    const defaultPrefix = `OUT/${fyString}`;

    let maxSeq = 0;
    try {
      const local = getLocalOutwards();
      const seqRegex = new RegExp(`^OUT\\/${fyString}\\/(\\d+)$`);
      for (const entry of local) {
        const m = entry.outwardNo?.match(seqRegex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    } catch (e) {
      // ignore
    }

    if (!isDemo) {
      try {
        const counterRef = doc(db, 'outward_counters', `outward_${fyString}`);
        let allocated = '';

        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(counterRef);
          let nextSeq = maxSeq + 1;
          if (snap.exists()) {
            const data = snap.data();
            const last = Number(data?.currentValue ?? data?.lastSequence ?? 0);
            nextSeq = Math.max(last, maxSeq) + 1;
          }

          allocated = `${defaultPrefix}/${String(nextSeq).padStart(4, '0')}`;
          transaction.set(
            counterRef,
            {
              counterKey: `outward_${fyString}`,
              currentValue: nextSeq,
              financialYear: fyString,
              updatedAt: Timestamp.now()
            },
            { merge: true }
          );
        });

        return allocated;
      } catch (err) {
        console.warn('Firestore outward_counters transaction fallback, using direct read/write:', err);
        try {
          const counterRef = doc(db, 'outward_counters', `outward_${fyString}`);
          const snap = await getDoc(counterRef);
          let nextVal = maxSeq + 1;
          if (snap.exists()) {
            const data = snap.data();
            const last = Number(data?.currentValue ?? data?.lastSequence ?? 0);
            nextVal = Math.max(last, maxSeq) + 1;
          }
          await setDoc(
            counterRef,
            {
              counterKey: `outward_${fyString}`,
              currentValue: nextVal,
              financialYear: fyString,
              updatedAt: Timestamp.now()
            },
            { merge: true }
          );
          return `${defaultPrefix}/${String(nextVal).padStart(4, '0')}`;
        } catch (e2) {
          console.warn('Direct outward_counters write failed, fallback to local sequence:', e2);
        }
      }
    }

    // Local sequence fallback
    const nextLocalVal = maxSeq + 1;
    return `${defaultPrefix}/${String(nextLocalVal).padStart(4, '0')}`;
  }

  /**
   * Generates a unique Internal Delivery Challan Number (DC-PERLA-XXXX)
   */
  static async generateOurDcNumber(dispatchDate?: string, isDemo: boolean = false): Promise<string> {
    const local = getLocalOutwards();
    let maxDc = 1040;
    for (const o of local) {
      if (o.ourDcNo) {
        const match = o.ourDcNo.match(/DC-PERLA-(\d+)/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxDc) maxDc = val;
        }
      }
    }

    if (!isDemo) {
      try {
        const counterRef = doc(db, 'outward_counters', 'our_dc_number');
        const snap = await getDoc(counterRef);
        let nextVal = maxDc + 1;
        if (snap.exists()) {
          const last = Number(snap.data()?.currentValue || 0);
          nextVal = Math.max(last, maxDc) + 1;
        }
        await setDoc(
          counterRef,
          {
            counterKey: 'our_dc_number',
            currentValue: nextVal,
            updatedAt: Timestamp.now()
          },
          { merge: true }
        );
        return `DC-PERLA-${nextVal}`;
      } catch (err) {
        // ignore fallback
      }
    }

    return `DC-PERLA-${maxDc + 1}`;
  }

  /**
   * Gets cumulative posted inward quantities for a PO by colour line ID
   */
  static async getCumulativePostedInwardMap(poId: string, isDemo: boolean = false): Promise<Record<string, number>> {
    const map: Record<string, number> = {};

    try {
      const inwRes = await InwardService.getInwardEntries({ poId, status: 'posted' }, { page: 1, pageSize: 500 }, isDemo);
      const receipts = inwRes.inwards.filter((i) => i.poId === poId && i.status === 'posted');

      for (const inw of receipts) {
        if (inw.status !== 'posted') continue;
        for (const line of inw.lines || []) {
          const poLineId = line.poLineId;
          const qty = Number(line.receivedQty) || 0;
          map[poLineId] = (map[poLineId] || 0) + qty;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch cumulative inward map:', err);
    }

    return map;
  }

  /**
   * Retrieves all posted outward entries across all POs
   */
  static async getAllPostedOutwards(isDemo: boolean = false): Promise<OutwardEntry[]> {
    let list: OutwardEntry[] = [];
    if (!isDemo) {
      try {
        const q = query(collection(db, 'outward_entries'), where('status', '==', 'posted'));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as OutwardEntry);
        });
        return list;
      } catch (err) {
        console.warn('Firestore getAllPostedOutwards error, falling back to local store:', err);
      }
    }
    return getLocalOutwards().filter((o) => o.status === 'posted');
  }

  /**
   * Gets cumulative posted outward quantities for a PO by colour line ID, optionally excluding one outwardId
   */
  static async getCumulativePostedOutwardMap(
    poId: string,
    excludeOutwardId?: string,
    isDemo: boolean = false
  ): Promise<Record<string, number>> {
    const map: Record<string, number> = {};

    let list: OutwardEntry[] = [];
    if (!isDemo) {
      try {
        const q = query(collection(db, 'outward_entries'), where('poId', '==', poId), where('status', '==', 'posted'));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as OutwardEntry);
        });
      } catch (err) {
        list = [];
      }
    } else {
      list = getLocalOutwards().filter((o) => o.poId === poId && o.status === 'posted');
    }

    for (const outw of list) {
      if (outw.status !== 'posted') continue;
      if (excludeOutwardId && (outw.id === excludeOutwardId || outw.outwardId === excludeOutwardId)) {
        continue;
      }
      for (const line of outw.lines || []) {
        const poLineId = line.poLineId;
        const qty = Number(line.dispatchQty) || 0;
        map[poLineId] = (map[poLineId] || 0) + qty;
      }
    }

    return map;
  }

  /**
   * Calculates comprehensive live dispatch balances for a PO
   */
  static async getOutwardBalances(
    poId: string,
    excludeOutwardId?: string,
    isDemo: boolean = false
  ): Promise<OutwardBalancesResponse> {
    const poResult = await POService.getPurchaseOrderById(poId, isDemo);
    const po = poResult?.po;
    if (!po) {
      throw new Error(`Purchase Order with ID ${poId} was not found.`);
    }

    const inwardMap = await this.getCumulativePostedInwardMap(poId, isDemo);
    const outwardMap = await this.getCumulativePostedOutwardMap(poId, excludeOutwardId, isDemo);

    const lineBalances: Record<string, OutwardLineBalance> = {};
    let totalInwardPieces = 0;
    let totalOutwardPieces = 0;
    let totalAvailablePieces = 0;
    let totalInwardKg = 0;
    let totalOutwardKg = 0;
    let totalAvailableKg = 0;

    for (const poLine of po.lines || []) {
      const lineId = poLine.lineId;
      const orderedQty = Number(poLine.quantity) || 0;
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
        orderedQty,
        cumulativeInwardQty: cumInward,
        cumulativeOutwardQty: cumOutward,
        availableForDispatch: available
      };

      if (poLine.unit === 'kg') {
        totalInwardKg += cumInward;
        totalOutwardKg += cumOutward;
        totalAvailableKg += available;
      } else {
        totalInwardPieces += cumInward;
        totalOutwardPieces += cumOutward;
        totalAvailablePieces += available;
      }
    }

    return {
      poId: po.id,
      poNumber: po.poNumber,
      lines: lineBalances,
      totalInwardPieces,
      totalOutwardPieces,
      totalAvailablePieces,
      totalInwardKg: Math.round(totalInwardKg * 100) / 100,
      totalOutwardKg: Math.round(totalOutwardKg * 100) / 100,
      totalAvailableKg: Math.round(totalAvailableKg * 100) / 100
    };
  }

  /**
   * Post a new Outward Entry with full transaction safety and atomic numbering
   */
  static async postOutwardEntry(
    input: {
      customerVendorId: string;
      subcontractorVendorId?: string | null;
      poId: string;
      outwardDate: string;
      ourDcNo: string;
      vehicleNumber?: string;
      driverName?: string;
      transporterVendorId?: string | null;
      destination?: string;
      remarks?: string;
      lines: {
        poLineId: string;
        colourNameSnapshot: string;
        colourCodeSnapshot?: string | null;
        itemNameSnapshot: string;
        washTypeSnapshot: string;
        orderedQtySnapshot: number;
        unit: 'piece' | 'kg';
        cumulativeInwardQtySnapshot: number;
        previouslyDispatchedQtySnapshot: number;
        dispatchQty: number;
      }[];
    },
    user: { uid: string; name?: string; role?: string },
    isDemo: boolean = false
  ): Promise<OutwardEntry> {
    // 1. Validate PO exists
    const poResult = await POService.getPurchaseOrderById(input.poId, isDemo);
    const po = poResult?.po;
    if (!po) {
      throw new Error(`Invalid Purchase Order selected: ${input.poId}`);
    }

    // 2. Validate Customer match
    if (po.customerId !== input.customerVendorId) {
      throw new Error(
        `Selected Customer does not match the Customer assigned to Purchase Order ${po.poNumber}.`
      );
    }

    // 2b. Validate Mandatory Logistics Fields
    if (!input.outwardDate) {
      throw new Error('Outward dispatch date is required.');
    }
    if (!input.ourDcNo?.trim()) {
      throw new Error('Our DC number is required.');
    }
    if (!input.vehicleNumber?.trim()) {
      throw new Error('Vehicle number is required.');
    }
    if (!input.driverName?.trim()) {
      throw new Error('Driver name is required.');
    }
    if (!input.destination?.trim()) {
      throw new Error('Dispatch destination is required.');
    }

    // 3. Filter lines to dispatch
    const linesToDispatch = input.lines.filter((l) => (Number(l.dispatchQty) || 0) > 0);
    if (linesToDispatch.length === 0) {
      throw new Error('At least one colour line must have a dispatch quantity greater than 0.');
    }

    // 4. Retrieve Authoritative Latest Balances (Prevents stale balance race conditions)
    const inwardMap = await this.getCumulativePostedInwardMap(input.poId, isDemo);
    const outwardMap = await this.getCumulativePostedOutwardMap(input.poId, undefined, isDemo);

    for (const line of linesToDispatch) {
      const lineId = line.poLineId;
      const dispatchQty = Number(line.dispatchQty) || 0;
      if (dispatchQty <= 0) {
        throw new Error(`Dispatch quantity must be greater than zero for colour ${line.colourNameSnapshot}.`);
      }

      const latestInward = inwardMap[lineId] || 0;
      const latestPrevOutward = outwardMap[lineId] || 0;
      const latestAvailable = Math.max(0, latestInward - latestPrevOutward);

      if (dispatchQty > latestAvailable) {
        throw new Error(
          `Cannot dispatch ${dispatchQty} ${line.unit} for "${line.colourNameSnapshot}". Latest available received balance is only ${latestAvailable} ${line.unit}.`
        );
      }
    }

    // 5. Generate unique Outward Number and DC Number
    const outwardNo = await this.generateOutwardNumber(input.outwardDate, isDemo);
    const ourDcNo = input.ourDcNo?.trim() || (await this.generateOurDcNumber(input.outwardDate, isDemo));

    // 6. Resolve Snapshots
    let customerName = po.customerName;
    let subcontractorName: string | null = null;
    let transporterName: string | null = null;

    try {
      const custRes = await VendorService.getVendorById(input.customerVendorId, isDemo);
      if (custRes?.vendor) customerName = custRes.vendor.companyName;

      if (input.subcontractorVendorId) {
        const subRes = await VendorService.getVendorById(input.subcontractorVendorId, isDemo);
        if (subRes?.vendor) subcontractorName = subRes.vendor.companyName;
      }

      if (input.transporterVendorId) {
        const transRes = await VendorService.getVendorById(input.transporterVendorId, isDemo);
        if (transRes?.vendor) transporterName = transRes.vendor.companyName;
      }
    } catch (e) {
      // keep fallback
    }

    const nowIso = new Date().toISOString();
    const totals = calculateOutwardTotalsByUnit(linesToDispatch);

    const docId = `out_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Build finalized lines
    const finalizedLines: OutwardLine[] = linesToDispatch.map((l, idx) => {
      const lineId = l.poLineId;
      const cumInward = inwardMap[lineId] || l.cumulativeInwardQtySnapshot || 0;
      const prevOutward = outwardMap[lineId] || l.previouslyDispatchedQtySnapshot || 0;
      const available = Math.max(0, cumInward - prevOutward);
      const remaining = Math.max(0, available - l.dispatchQty);

      return {
        outwardLineId: `outl_${docId}_${idx + 1}`,
        lineId: `outl_${docId}_${idx + 1}`,
        outwardId: docId,
        poId: input.poId,
        poLineId: l.poLineId,
        colourNameSnapshot: l.colourNameSnapshot,
        colour: l.colourNameSnapshot,
        colourCodeSnapshot: l.colourCodeSnapshot || null,
        itemNameSnapshot: l.itemNameSnapshot || po.itemName || 'Garments',
        washTypeSnapshot: l.washTypeSnapshot || 'Standard Wash',
        processType: l.washTypeSnapshot || 'Standard Wash',
        orderedQtySnapshot: l.orderedQtySnapshot,
        unit: l.unit,
        cumulativeInwardQtySnapshot: cumInward,
        previouslyDispatchedQtySnapshot: prevOutward,
        availableForDispatchSnapshot: available,
        dispatchQty: l.dispatchQty,
        remainingAfterDispatchSnapshot: remaining,
        createdAt: nowIso
      };
    });

    const newEntry: OutwardEntry = {
      id: docId,
      outwardId: docId,
      outwardNo,
      entryId: outwardNo,
      poId: input.poId,
      poNumberSnapshot: po.poNumber,
      poNumber: po.poNumber,
      customerVendorId: input.customerVendorId,
      customerId: input.customerVendorId,
      customerCompanyNameSnapshot: customerName,
      customerName,
      subcontractorVendorId: input.subcontractorVendorId || null,
      subContractorId: input.subcontractorVendorId || undefined,
      subcontractorNameSnapshot: subcontractorName,
      subContractorName: subcontractorName || undefined,
      styleNoSnapshot: po.styleNo,
      styleNo: po.styleNo,
      itemNameSnapshot: po.itemName || 'Garments',
      itemName: po.itemName || 'Garments',
      processCategorySnapshot: (String(po.processCategory || '').toLowerCase() === 'dyeing' ? 'dyeing' : 'washing') as 'washing' | 'dyeing',
      processCategory: (String(po.processCategory || '').toLowerCase() === 'dyeing' ? 'dyeing' : 'washing') as 'washing' | 'dyeing',
      outwardDate: input.outwardDate,
      ourDcNo,
      vehicleNumber: input.vehicleNumber?.trim(),
      vehicleNo: input.vehicleNumber?.trim(),
      driverName: input.driverName?.trim(),
      transporterVendorId: input.transporterVendorId || null,
      transporterNameSnapshot: transporterName,
      destination: input.destination?.trim(),
      remarks: input.remarks?.trim(),
      status: 'posted',
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      createdBy: user.uid,
      createdByName: user.name || 'System User',
      createdAt: nowIso,
      updatedBy: user.uid,
      updatedByName: user.name || 'System User',
      updatedAt: nowIso,
      postedBy: user.uid,
      postedByName: user.name || 'System User',
      postedAt: nowIso,
      lines: finalizedLines,
      schemaVersion: 1
    };

    const auditLog: OutwardAuditLog = {
      auditId: `out_aud_${Date.now()}`,
      outwardId: docId,
      outwardNo,
      action: 'posted',
      performedBy: user.uid,
      performedByName: user.name || 'System User',
      performedAt: nowIso,
      summary: `Outward Dispatch ${outwardNo} posted with Our DC No ${ourDcNo}. Total dispatched: ${totals.totalQtyByUnit.piece} pieces, ${totals.totalQtyByUnit.kg} kg.`
    };

    // 7. Persist to Firestore or local store
    if (!isDemo) {
      try {
        const outRef = doc(db, 'outward_entries', docId);
        const auditRef = doc(db, 'outward_audit_logs', auditLog.auditId);

        await setDoc(outRef, {
          ...newEntry,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          postedAt: Timestamp.now()
        });

        await setDoc(auditRef, {
          ...auditLog,
          performedAt: Timestamp.now()
        });
      } catch (err) {
        console.warn('Firestore outward write failed, writing to local fallback:', err);
      }
    }

    // Always update local storage
    const all = getLocalOutwards();
    saveLocalOutwards([newEntry, ...all]);

    const logsMap = getLocalAuditLogs();
    logsMap[docId] = [auditLog, ...(logsMap[docId] || [])];
    saveLocalAuditLogs(logsMap);

    return newEntry;
  }

  /**
   * Save an Outward Entry as a Draft
   */
  static async createDraftOutwardEntry(
    input: {
      customerVendorId: string;
      subcontractorVendorId?: string | null;
      poId: string;
      outwardDate?: string;
      ourDcNo?: string;
      vehicleNumber?: string;
      driverName?: string;
      transporterVendorId?: string | null;
      destination?: string;
      remarks?: string;
      lines?: any[];
    },
    user: { uid: string; name?: string },
    isDemo: boolean = false
  ): Promise<OutwardEntry> {
    const poResult = await POService.getPurchaseOrderById(input.poId, isDemo);
    const po = poResult?.po;
    if (!po) {
      throw new Error(`Purchase Order with ID ${input.poId} not found.`);
    }

    const docId = `out_draft_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const nowIso = new Date().toISOString();
    const outwardDate = input.outwardDate || nowIso.split('T')[0];
    const ourDcNo = input.ourDcNo?.trim() || 'DRAFT-DC';

    let customerName = po.customerName;
    let subcontractorName: string | null = null;
    try {
      const custRes = await VendorService.getVendorById(input.customerVendorId, isDemo);
      if (custRes?.vendor) customerName = custRes.vendor.companyName;
      if (input.subcontractorVendorId) {
        const subRes = await VendorService.getVendorById(input.subcontractorVendorId, isDemo);
        if (subRes?.vendor) subcontractorName = subRes.vendor.companyName;
      }
    } catch (e) {
      // ignore
    }

    const inwardMap = await this.getCumulativePostedInwardMap(input.poId, isDemo);
    const outwardMap = await this.getCumulativePostedOutwardMap(input.poId, undefined, isDemo);

    const draftLines: OutwardLine[] = (input.lines || []).map((l, idx) => {
      const lineId = l.poLineId;
      const cumInward = inwardMap[lineId] || l.cumulativeInwardQtySnapshot || 0;
      const prevOutward = outwardMap[lineId] || l.previouslyDispatchedQtySnapshot || 0;
      const available = Math.max(0, cumInward - prevOutward);
      const dispatchQty = Number(l.dispatchQty) || 0;
      const remaining = Math.max(0, available - dispatchQty);

      return {
        outwardLineId: `outl_${docId}_${idx + 1}`,
        lineId: `outl_${docId}_${idx + 1}`,
        outwardId: docId,
        poId: input.poId,
        poLineId: lineId,
        colourNameSnapshot: l.colourNameSnapshot || 'Standard',
        colour: l.colourNameSnapshot || 'Standard',
        colourCodeSnapshot: l.colourCodeSnapshot || null,
        itemNameSnapshot: l.itemNameSnapshot || po.itemName || 'Garments',
        washTypeSnapshot: l.washTypeSnapshot || 'Standard Wash',
        processType: l.washTypeSnapshot || 'Standard Wash',
        orderedQtySnapshot: Number(l.orderedQtySnapshot) || 0,
        unit: l.unit || 'piece',
        cumulativeInwardQtySnapshot: cumInward,
        previouslyDispatchedQtySnapshot: prevOutward,
        availableForDispatchSnapshot: available,
        dispatchQty,
        remainingAfterDispatchSnapshot: remaining,
        createdAt: nowIso
      };
    });

    const totals = calculateOutwardTotalsByUnit(draftLines);

    const draftEntry: OutwardEntry = {
      id: docId,
      outwardId: docId,
      outwardNo: 'OUT/DRAFT',
      entryId: 'OUT/DRAFT',
      poId: input.poId,
      poNumberSnapshot: po.poNumber,
      poNumber: po.poNumber,
      customerVendorId: input.customerVendorId,
      customerId: input.customerVendorId,
      customerCompanyNameSnapshot: customerName,
      customerName,
      subcontractorVendorId: input.subcontractorVendorId || null,
      subContractorId: input.subcontractorVendorId || undefined,
      subcontractorNameSnapshot: subcontractorName,
      subContractorName: subcontractorName || undefined,
      styleNoSnapshot: po.styleNo,
      styleNo: po.styleNo,
      itemNameSnapshot: po.itemName || 'Garments',
      itemName: po.itemName || 'Garments',
      processCategorySnapshot: (String(po.processCategory || '').toLowerCase() === 'dyeing' ? 'dyeing' : 'washing') as 'washing' | 'dyeing',
      processCategory: (String(po.processCategory || '').toLowerCase() === 'dyeing' ? 'dyeing' : 'washing') as 'washing' | 'dyeing',
      outwardDate,
      ourDcNo,
      vehicleNumber: input.vehicleNumber?.trim(),
      vehicleNo: input.vehicleNumber?.trim(),
      driverName: input.driverName?.trim(),
      transporterVendorId: input.transporterVendorId || null,
      destination: input.destination?.trim(),
      remarks: input.remarks?.trim(),
      status: 'draft',
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      createdBy: user.uid,
      createdByName: user.name || 'System User',
      createdAt: nowIso,
      updatedBy: user.uid,
      updatedByName: user.name || 'System User',
      updatedAt: nowIso,
      lines: draftLines,
      schemaVersion: 1
    };

    const auditLog: OutwardAuditLog = {
      auditId: `out_aud_${Date.now()}`,
      outwardId: docId,
      outwardNo: 'OUT/DRAFT',
      action: 'created',
      performedBy: user.uid,
      performedByName: user.name || 'System User',
      performedAt: nowIso,
      summary: `Draft outward created for PO ${po.poNumber}.`
    };

    if (!isDemo) {
      try {
        const outRef = doc(db, 'outward_entries', docId);
        await setDoc(outRef, {
          ...draftEntry,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      } catch (e) {
        console.warn('Failed to save draft to Firestore, saving to local fallback:', e);
      }
    }

    const all = getLocalOutwards();
    saveLocalOutwards([draftEntry, ...all]);

    const logsMap = getLocalAuditLogs();
    logsMap[docId] = [auditLog, ...(logsMap[docId] || [])];
    saveLocalAuditLogs(logsMap);

    return draftEntry;
  }

  /**
   * Updates an existing draft Outward Entry
   */
  static async updateDraftOutwardEntry(
    outwardId: string,
    input: any,
    user: { uid: string; name?: string },
    isDemo: boolean = false
  ): Promise<OutwardEntry> {
    const existing = await this.getOutwardEntryById(outwardId, isDemo);
    if (!existing.outward) {
      throw new Error(`Outward Entry ${outwardId} not found.`);
    }

    const nowIso = new Date().toISOString();
    const updatedLines = (input.lines || existing.outward.lines).map((l: any, idx: number) => ({
      ...l,
      outwardLineId: l.outwardLineId || `outl_${outwardId}_${idx + 1}`,
      lineId: l.lineId || `outl_${outwardId}_${idx + 1}`,
      outwardId,
      poId: input.poId || existing.outward!.poId,
      dispatchQty: Number(l.dispatchQty) || 0
    }));

    const totals = calculateOutwardTotalsByUnit(updatedLines);

    const updated: OutwardEntry = {
      ...existing.outward,
      ...input,
      lines: updatedLines,
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      updatedBy: user.uid,
      updatedByName: user.name || 'System User',
      updatedAt: nowIso
    };

    const auditLog: OutwardAuditLog = {
      auditId: `out_aud_${Date.now()}`,
      outwardId,
      outwardNo: existing.outward.outwardNo,
      action: 'updated',
      performedBy: user.uid,
      performedByName: user.name || 'System User',
      performedAt: nowIso,
      summary: `Draft outward ${existing.outward.outwardNo} updated.`
    };

    if (!isDemo) {
      try {
        const outRef = doc(db, 'outward_entries', outwardId);
        await setDoc(outRef, {
          ...updated,
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (e) {
        // ignore
      }
    }

    const all = getLocalOutwards().map((o) => (o.id === outwardId || o.outwardId === outwardId ? updated : o));
    saveLocalOutwards(all);

    const logsMap = getLocalAuditLogs();
    logsMap[outwardId] = [auditLog, ...(logsMap[outwardId] || [])];
    saveLocalAuditLogs(logsMap);

    return updated;
  }

  /**
   * Posts an existing draft outward entry
   */
  static async postExistingDraft(
    outwardId: string,
    input: any,
    user: { uid: string; name?: string },
    isDemo: boolean = false
  ): Promise<OutwardEntry> {
    const existing = await this.getOutwardEntryById(outwardId, isDemo);
    if (!existing.outward) {
      throw new Error(`Outward Entry ${outwardId} not found.`);
    }

    if (existing.outward.status !== 'draft') {
      throw new Error(`Outward entry is already in status: ${existing.outward.status}`);
    }

    // Call postOutwardEntry logic
    const postData = {
      customerVendorId: input.customerVendorId || existing.outward.customerVendorId,
      subcontractorVendorId: input.subcontractorVendorId ?? existing.outward.subcontractorVendorId,
      poId: input.poId || existing.outward.poId,
      outwardDate: input.outwardDate || existing.outward.outwardDate || new Date().toISOString().split('T')[0],
      ourDcNo: input.ourDcNo || existing.outward.ourDcNo,
      vehicleNumber: input.vehicleNumber ?? existing.outward.vehicleNumber,
      driverName: input.driverName ?? existing.outward.driverName,
      transporterVendorId: input.transporterVendorId ?? existing.outward.transporterVendorId,
      destination: input.destination ?? existing.outward.destination,
      remarks: input.remarks ?? existing.outward.remarks,
      lines: input.lines || existing.outward.lines
    };

    // Remove draft from local storage first to replace with posted version
    await this.deleteOutwardEntry(outwardId, user, isDemo);

    return await this.postOutwardEntry(postData, user, isDemo);
  }

  /**
   * Reverses a posted Outward Entry with mandatory reason and immutable audit trail
   */
  static async reverseOutwardEntry(
    outwardId: string,
    reversalReason: string,
    user: { uid: string; name?: string },
    isDemo: boolean = false
  ): Promise<OutwardEntry> {
    if (!reversalReason || reversalReason.trim().length < 5) {
      throw new Error('A reversal reason of at least 5 characters is required.');
    }

    const { outward } = await this.getOutwardEntryById(outwardId, isDemo);
    if (!outward) {
      throw new Error(`Outward Entry with ID ${outwardId} was not found.`);
    }

    if (outward.status === 'reversed') {
      throw new Error(`Outward Entry ${outward.outwardNo} is already reversed.`);
    }

    if (outward.status !== 'posted') {
      throw new Error(`Only posted outward dispatches can be reversed. Current status: ${outward.status}`);
    }

    const nowIso = new Date().toISOString();

    const reversedEntry: OutwardEntry = {
      ...outward,
      status: 'reversed',
      reversedBy: user.uid,
      reversedByName: user.name || 'System User',
      reversedAt: nowIso,
      reversalReason: reversalReason.trim(),
      updatedBy: user.uid,
      updatedByName: user.name || 'System User',
      updatedAt: nowIso
    };

    const auditLog: OutwardAuditLog = {
      auditId: `out_aud_${Date.now()}`,
      outwardId: outward.outwardId,
      outwardNo: outward.outwardNo,
      action: 'reversed',
      performedBy: user.uid,
      performedByName: user.name || 'System User',
      performedAt: nowIso,
      summary: `Outward Dispatch ${outward.outwardNo} reversed by ${user.name || 'User'}. Reason: "${reversalReason.trim()}". Dispatch balances restored.`
    };

    if (!isDemo) {
      try {
        const outRef = doc(db, 'outward_entries', outwardId);
        const auditRef = doc(db, 'outward_audit_logs', auditLog.auditId);

        await updateDoc(outRef, {
          status: 'reversed',
          reversedBy: user.uid,
          reversedByName: user.name || 'System User',
          reversedAt: Timestamp.now(),
          reversalReason: reversalReason.trim(),
          updatedBy: user.uid,
          updatedByName: user.name || 'System User',
          updatedAt: Timestamp.now()
        });

        await setDoc(auditRef, {
          ...auditLog,
          performedAt: Timestamp.now()
        });
      } catch (err) {
        console.warn('Failed to update reversed outward in Firestore, fallback to local store:', err);
      }
    }

    const all = getLocalOutwards().map((o) => (o.id === outwardId || o.outwardId === outwardId ? reversedEntry : o));
    saveLocalOutwards(all);

    const logsMap = getLocalAuditLogs();
    logsMap[outward.outwardId] = [auditLog, ...(logsMap[outward.outwardId] || [])];
    saveLocalAuditLogs(logsMap);

    return reversedEntry;
  }

  /**
   * Retrieves an Outward Entry by ID with its audit history
   */
  static async getOutwardEntryById(
    outwardId: string,
    isDemo: boolean = false
  ): Promise<{ outward: OutwardEntry | null; logs: OutwardAuditLog[] }> {
    let outward: OutwardEntry | null = null;
    let logs: OutwardAuditLog[] = [];

    if (!isDemo) {
      try {
        const snap = await getDoc(doc(db, 'outward_entries', outwardId));
        if (snap.exists()) {
          outward = { id: snap.id, ...snap.data() } as OutwardEntry;
        }

        // Fetch logs
        const q = query(
          collection(db, 'outward_audit_logs'),
          where('outwardId', '==', outwardId),
          orderBy('performedAt', 'desc')
        );
        const logSnap = await getDocs(q);
        logSnap.forEach((d) => {
          logs.push({ auditId: d.id, ...d.data() } as OutwardAuditLog);
        });
      } catch (err) {
        // fallback to local
      }
    }

    if (!outward && isDemo) {
      const all = getLocalOutwards();
      outward = all.find((o) => o.id === outwardId || o.outwardId === outwardId) || null;
    }

    if (logs.length === 0 && outward && isDemo) {
      const logsMap = getLocalAuditLogs();
      logs = logsMap[outward.outwardId] || logsMap[outward.id] || [];
    }

    return { outward, logs };
  }

  /**
   * Retrieves paginated, filtered Outward Entries
   */
  static async getOutwardEntries(
    filters: OutwardFilterOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
    isDemo: boolean = false
  ): Promise<{ outwards: OutwardEntry[]; pagination: OutwardPagination }> {
    let allEntries: OutwardEntry[] = [];

    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'outward_entries'));
        // Always trust Firestore result (even empty = all records deleted).
        // Overwrite local cache so stale deleted data is not shown.
        snap.forEach((d) => {
          allEntries.push({ id: d.id, ...d.data() } as OutwardEntry);
        });
        saveLocalOutwards(allEntries);
      } catch (err) {
        // Only fall back to localStorage on a genuine network/permission error
        console.warn('Firestore getOutwardEntries error, falling back to local cache:', err);
        allEntries = getLocalOutwards();
      }
    } else {
      allEntries = getLocalOutwards();
    }

    // Apply Filters
    let filtered = allEntries.filter((entry) => {
      if (filters.status && filters.status !== 'all') {
        if (entry.status !== filters.status) return false;
      }

      if (filters.customerId && entry.customerVendorId !== filters.customerId && entry.customerId !== filters.customerId) {
        return false;
      }

      if (filters.subcontractorId && entry.subcontractorVendorId !== filters.subcontractorId) {
        return false;
      }

      if (filters.poId && entry.poId !== filters.poId) {
        return false;
      }

      if (filters.poNumber && !entry.poNumberSnapshot?.toLowerCase().includes(filters.poNumber.toLowerCase())) {
        return false;
      }

      if (filters.styleNo && !entry.styleNoSnapshot?.toLowerCase().includes(filters.styleNo.toLowerCase())) {
        return false;
      }

      if (filters.ourDcNo && !entry.ourDcNo?.toLowerCase().includes(filters.ourDcNo.toLowerCase())) {
        return false;
      }

      if (filters.dateFrom && entry.outwardDate < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && entry.outwardDate > filters.dateTo) {
        return false;
      }

      if (filters.transporterVendorId && entry.transporterVendorId !== filters.transporterVendorId) {
        return false;
      }

      if (filters.searchQuery && filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matches =
          entry.outwardNo?.toLowerCase().includes(q) ||
          entry.ourDcNo?.toLowerCase().includes(q) ||
          entry.poNumberSnapshot?.toLowerCase().includes(q) ||
          entry.poNumber?.toLowerCase().includes(q) ||
          entry.customerCompanyNameSnapshot?.toLowerCase().includes(q) ||
          entry.customerName?.toLowerCase().includes(q) ||
          entry.styleNoSnapshot?.toLowerCase().includes(q) ||
          entry.styleNo?.toLowerCase().includes(q) ||
          entry.vehicleNumber?.toLowerCase().includes(q) ||
          entry.driverName?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });

    // Sort by outwardDate desc, createdAt desc
    filtered.sort((a, b) => {
      const dateA = a.outwardDate || a.createdAt || '';
      const dateB = b.outwardDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    const totalCount = filtered.length;
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 10;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIndex = (page - 1) * pageSize;
    const paginatedEntries = filtered.slice(startIndex, startIndex + pageSize);

    return {
      outwards: paginatedEntries,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      }
    };
  }

  /**
   * Retrieves high-level dashboard metrics for Outward Dispatches
   */
  static async getOutwardDashboardMetrics(isDemo: boolean = false): Promise<OutwardDashboardMetrics> {
    const { outwards } = await this.getOutwardEntries({ status: 'all' }, { page: 1, pageSize: 1000 }, isDemo);

    let totalOutwardsCount = outwards.length;
    let postedOutwardsCount = 0;
    let draftOutwardsCount = 0;
    let reversedOutwardsCount = 0;
    let totalPiecesDispatched = 0;
    let totalKgDispatched = 0;

    for (const outw of outwards) {
      if (outw.status === 'posted') {
        postedOutwardsCount++;
        totalPiecesDispatched += outw.totalQtyByUnit?.piece || 0;
        totalKgDispatched += outw.totalQtyByUnit?.kg || 0;
      } else if (outw.status === 'draft') {
        draftOutwardsCount++;
      } else if (outw.status === 'reversed') {
        reversedOutwardsCount++;
      }
    }

    // Calculate total available pieces and kg remaining across active POs with inwards
    let totalPiecesAvailableToDispatch = 0;
    let totalKgAvailableToDispatch = 0;

    try {
      const posRes = await POService.getPurchaseOrders({}, { page: 1, pageSize: 200 }, isDemo);
      for (const po of posRes.pos || []) {
        if (String(po.status || '').toLowerCase() === 'cancelled') continue;
        const bal = await this.getOutwardBalances(po.id, undefined, isDemo);
        totalPiecesAvailableToDispatch += bal.totalAvailablePieces;
        totalKgAvailableToDispatch += bal.totalAvailableKg;
      }
    } catch (e) {
      // ignore
    }

    return {
      totalOutwardsCount,
      postedOutwardsCount,
      draftOutwardsCount,
      reversedOutwardsCount,
      totalPiecesDispatched,
      totalKgDispatched: Math.round(totalKgDispatched * 100) / 100,
      totalPiecesAvailableToDispatch,
      totalKgAvailableToDispatch: Math.round(totalKgAvailableToDispatch * 100) / 100
    };
  }

  /**
   * Deletes an Outward Entry (admin only)
   */
  static async deleteOutwardEntry(
    outwardId: string,
    user: { uid: string; name?: string },
    isDemo: boolean = false
  ): Promise<void> {
    const { outward } = await this.getOutwardEntryById(outwardId, isDemo);
    if (!outward) return;

    const lockMap = await POLockService.getLockedPOMap(isDemo);
    const lockStatus = POLockService.isLocked(outward, lockMap);
    if (lockStatus) {
      throw new Error(`Cannot delete Outward Dispatch ${outward.outwardNo || outwardId}: ${lockStatus.reason}`);
    }

    if (!isDemo) {
      try {
        await deleteDoc(doc(db, 'outward_entries', outwardId));
      } catch (err) {
        // ignore
      }
    }

    const all = getLocalOutwards().filter((o) => o.id !== outwardId && o.outwardId !== outwardId);
    saveLocalOutwards(all);

    const logsMap = getLocalAuditLogs();
    delete logsMap[outwardId];
    delete logsMap[outward.outwardId];
    saveLocalAuditLogs(logsMap);
  }
}
