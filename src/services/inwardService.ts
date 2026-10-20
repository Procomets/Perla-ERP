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
  InwardEntry,
  InwardLine,
  InwardAuditLog,
  InwardFilterOptions,
  InwardPagination,
  InwardDashboardMetrics,
  InwardBalancesResponse,
  InwardLineBalance,
  InwardStatus
} from '../types/inward';
import { POLockService } from './poLockService';
import { PurchaseOrder } from '../types/po';
import { Vendor } from '../types/vendor';
import { calculateInwardTotalsByUnit } from '../schemas/inwardSchema';
import { cleanFirestoreData, VendorService } from './vendorService';
import { POService } from './poService';

// Seed initial mock inward entries for demonstration & seeding
// Seed initial mock inward entries for demonstration & seeding
export const initialMockInwardEntries: InwardEntry[] = [];

export const initialMockInwardAuditLogs: Record<string, InwardAuditLog[]> = {};

const LOCAL_STORAGE_KEY = 'perla_erp_inward_entries';
const AUDIT_STORAGE_KEY = 'perla_erp_inward_audit_logs';

export interface InwardOutwardAnalysis {
  deletableInwardMap: Record<string, boolean>; // inwardId -> boolean (false if outward entered against this inward)
  inwardMinAllowedMap: Record<string, Record<string, number>>; // inwardId -> lineKey/poLineId -> minQty
  inwardConsumedByOutwardMap: Record<string, number>; // inwardId -> total consumed qty
  outwardCountByPo: Record<string, number>; // poId -> count of active outwards
}

function getLocalOutwardsForInward(): any[] {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem('perla_erp_outward_entries');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // ignore
      }
    }
  }
  return [];
}

let memoryInwards: InwardEntry[] = [...initialMockInwardEntries];
let memoryAuditLogs: Record<string, InwardAuditLog[]> = { ...initialMockInwardAuditLogs };

function getLocalInwards(): InwardEntry[] {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out legacy default mock inward entries if present
          const cleaned = parsed.filter(
            (e) => !['inw-paramount-0001', 'inw-apex-0002', 'inw-101'].includes(e.id || e.inwardId)
          );
          if (cleaned.length !== parsed.length) {
            saveLocalInwards(cleaned);
          }
          return cleaned;
        }
      } catch (e) {
        // Fallback
      }
    }
  }
  return memoryInwards;
}

function saveLocalInwards(entries: InwardEntry[]) {
  memoryInwards = entries;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // ignore
    }
  }
}

function getLocalAuditLogs(): Record<string, InwardAuditLog[]> {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          delete parsed['inw-paramount-0001'];
          delete parsed['inw-apex-0002'];
          delete parsed['inw-101'];
          return parsed;
        }
      } catch (e) {
        // Fallback
      }
    }
  }
  return memoryAuditLogs;
}

function saveLocalAuditLogs(logs: Record<string, InwardAuditLog[]>) {
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

export class InwardService {
  /**
   * Generates a collision-safe, unique Inward Receipt Number (INW/YYYY-YY/XXXX)
   */
  static async generateInwardNumber(receiptDate?: string, isDemo: boolean = false): Promise<string> {
    const fyString = getFYString(receiptDate);
    const defaultPrefix = `INW/${fyString}`;

    let maxSeq = 0;
    try {
      const local = getLocalInwards();
      const seqRegex = new RegExp(`^INW\\/${fyString}\\/(\\d+)$`);
      for (const entry of local) {
        const m = entry.inwardNo?.match(seqRegex);
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
        const counterRef = doc(db, 'inward_counters', `inward_${fyString}`);
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
              counterKey: `inward_${fyString}`,
              currentValue: nextSeq,
              financialYear: fyString,
              updatedAt: Timestamp.now()
            },
            { merge: true }
          );
        });

        return allocated;
      } catch (err) {
        console.warn('Firestore inward_counters transaction fallback, using direct read/write:', err);
        try {
          const counterRef = doc(db, 'inward_counters', `inward_${fyString}`);
          const snap = await getDoc(counterRef);
          let nextSeq = maxSeq + 1;
          if (snap.exists()) {
            const data = snap.data();
            const last = Number(data?.currentValue ?? data?.lastSequence ?? 0);
            nextSeq = Math.max(last, maxSeq) + 1;
          }
          const allocated = `${defaultPrefix}/${String(nextSeq).padStart(4, '0')}`;
          await setDoc(
            counterRef,
            {
              counterKey: `inward_${fyString}`,
              currentValue: nextSeq,
              financialYear: fyString,
              updatedAt: Timestamp.now()
            },
            { merge: true }
          );
          return allocated;
        } catch (directErr) {
          console.warn('Direct counter failed, generating in-memory sequence:', directErr);
          return `${defaultPrefix}/${String(maxSeq + 1).padStart(4, '0')}`;
        }
      }
    }

    return `${defaultPrefix}/${String(maxSeq + 1).padStart(4, '0')}`;
  }

  /**
   * Retrieves cumulative posted quantities received for each colour line of a PO
   */
  static async getCumulativePostedInwardMap(
    poId: string,
    excludeInwardId?: string,
    isDemo: boolean = false,
    poNumber?: string
  ): Promise<Record<string, number>> {
    const cumulativeMap: Record<string, number> = {};

    let entries: InwardEntry[] = [];
    if (!isDemo) {
      try {
        const q = query(collection(db, 'inward_entries'), where('poId', '==', poId), where('status', '==', 'posted'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          entries = snap.docs.map((d) => d.data() as InwardEntry);
        }
        if (poNumber && !poNumber.includes('PENDING')) {
          const qNum = query(collection(db, 'inward_entries'), where('poNumber', '==', poNumber), where('status', '==', 'posted'));
          const snapNum = await getDocs(qNum);
          if (!snapNum.empty) {
            const numEntries = snapNum.docs.map((d) => d.data() as InwardEntry);
            const existingIds = new Set(entries.map((e) => e.inwardId || e.id));
            for (const ne of numEntries) {
              if (!existingIds.has(ne.inwardId || ne.id)) {
                entries.push(ne);
                existingIds.add(ne.inwardId || ne.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Firestore getCumulativePostedInwardMap failed, falling back to local storage:', err);
      }
    }

    // Always merge or fallback to local storage
    if (entries.length === 0) {
      const local = getLocalInwards();
      entries = local.filter((i) => {
        const isPosted = !i.status || i.status === 'posted';
        if (!isPosted) return false;
        const matchId = i.poId === poId;
        const matchNum =
          poNumber &&
          !poNumber.includes('PENDING') &&
          (i.poNumber === poNumber || i.poNumberSnapshot === poNumber);
        return matchId || matchNum;
      });
    }

    for (const entry of entries) {
      if (excludeInwardId && (entry.inwardId === excludeInwardId || entry.id === excludeInwardId)) {
        continue;
      }
      for (const line of entry.lines || []) {
        const lid = line.poLineId || line.lineId;
        const qty = Number(line.receivedQty) || 0;
        if (lid) {
          cumulativeMap[lid] = (cumulativeMap[lid] || 0) + qty;
        }
        const colourKey = (line.colour || line.colourNameSnapshot || '').trim().toLowerCase();
        if (colourKey) {
          cumulativeMap[`colour_${colourKey}`] = (cumulativeMap[`colour_${colourKey}`] || 0) + qty;
        }
      }
    }

    return cumulativeMap;
  }

  /**
   * Evaluates relationship between Inward and Outward entries for a PO (or all POs)
   * based on exact entry timestamps (creation / dispatch time) and line quantities.
   *
   * 1. If an inward receipt has had any of its quantity consumed by outward entries,
   *    or if deleting it would cause cumulative outward to exceed remaining inward,
   *    it is marked as non-deletable (deletableInwardMap[id] = false).
   * 2. In edit mode, inwardMinAllowedMap[id][poLineId] determines the minimum quantity
   *    that must be retained for each colour line to satisfy present outward dispatches.
   */
  static async getInwardOutwardDependencies(
    poIdFilter?: string,
    isDemo: boolean = false
  ): Promise<InwardOutwardAnalysis> {
    const deletableInwardMap: Record<string, boolean> = {};
    const inwardMinAllowedMap: Record<string, Record<string, number>> = {};
    const inwardConsumedByOutwardMap: Record<string, number> = {};
    const outwardCountByPo: Record<string, number> = {};

    let inwards: InwardEntry[] = [];
    let outwards: any[] = [];

    if (!isDemo) {
      try {
        const inwSnap = await getDocs(collection(db, 'inward_entries'));
        inwSnap.forEach((d) => {
          inwards.push({ id: d.id, ...d.data() } as InwardEntry);
        });
      } catch (e) {
        inwards = [];
      }

      try {
        const outSnap = await getDocs(collection(db, 'outward_entries'));
        outSnap.forEach((d) => {
          outwards.push({ id: d.id, ...d.data() });
        });
      } catch (e) {
        outwards = [];
      }
    }

    // Merge or fallback to local storage
    const localInwards = getLocalInwards();
    const existingInwIds = new Set(inwards.map((i) => i.inwardId || i.id));
    for (const li of localInwards) {
      if (!existingInwIds.has(li.inwardId || li.id)) {
        inwards.push(li);
      }
    }

    const localOutwards = getLocalOutwardsForInward();
    const existingOutIds = new Set(outwards.map((o) => o.outwardId || o.id));
    for (const lo of localOutwards) {
      if (!existingOutIds.has(lo.outwardId || lo.id)) {
        outwards.push(lo);
      }
    }

    // Filter active/valid records: posted outwards and non-reversed inwards
    const activeInwards = inwards.filter((i) => i.status !== 'reversed' && i.status !== 'cancelled');
    const postedOutwards = outwards.filter((o) => o.status === 'posted');

    // Helper: extract timestamp in ms from various possible formats
    const parseTime = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (val.seconds) return val.seconds * 1000;
      if (typeof val.toDate === 'function') {
        try {
          return val.toDate().getTime();
        } catch (e) {
          // ignore
        }
      }
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };

    const getInwardTime = (inw: InwardEntry): number => {
      return parseTime(inw.createdAt) || parseTime(inw.inwardDate) || parseTime(inw.customerDate) || 0;
    };

    const getOutwardTime = (outw: any): number => {
      return parseTime(outw.createdAt) || parseTime(outw.outwardDate) || 0;
    };

    // Build PO groups
    const getCanonicalPoKey = (entry: any): string => {
      return (entry.poId || entry.poNumberSnapshot || entry.poNumber || '').trim();
    };

    const inwardsByPo: Record<string, InwardEntry[]> = {};
    for (const inw of activeInwards) {
      const key = getCanonicalPoKey(inw);
      if (!key) continue;
      inwardsByPo[key] = inwardsByPo[key] || [];
      inwardsByPo[key].push(inw);

      if (inw.poNumberSnapshot && inw.poNumberSnapshot !== key) {
        inwardsByPo[inw.poNumberSnapshot] = inwardsByPo[key];
      }
      if (inw.poId && inw.poId !== key) {
        inwardsByPo[inw.poId] = inwardsByPo[key];
      }
    }

    const outwardsByPo: Record<string, any[]> = {};
    for (const outw of postedOutwards) {
      const key = getCanonicalPoKey(outw);
      if (!key) continue;
      outwardsByPo[key] = outwardsByPo[key] || [];
      outwardsByPo[key].push(outw);

      if (outw.poNumberSnapshot && outw.poNumberSnapshot !== key) {
        outwardsByPo[outw.poNumberSnapshot] = outwardsByPo[key];
      }
      if (outw.poId && outw.poId !== key) {
        outwardsByPo[outw.poId] = outwardsByPo[key];
      }
    }

    const poKeys = new Set([...Object.keys(inwardsByPo), ...Object.keys(outwardsByPo)]);

    for (const poKey of poKeys) {
      if (poIdFilter && poKey !== poIdFilter) continue;

      // Unique inwards for this PO
      const rawInwards = inwardsByPo[poKey] || [];
      const seenInw = new Set<string>();
      const poInwards = rawInwards.filter((i) => {
        const id = i.inwardId || i.id;
        if (!id || seenInw.has(id)) return false;
        seenInw.add(id);
        return true;
      });

      // Unique outwards for this PO
      const rawOutwards = outwardsByPo[poKey] || [];
      const seenOut = new Set<string>();
      const poOutwards = rawOutwards.filter((o) => {
        const id = o.outwardId || o.id;
        if (!id || seenOut.has(id)) return false;
        seenOut.add(id);
        return true;
      });

      outwardCountByPo[poKey] = poOutwards.length;

      // If no posted outwards exist for this PO, every inward can be safely deleted / edited down to 0
      if (poOutwards.length === 0) {
        for (const inw of poInwards) {
          const inwId = inw.inwardId || inw.id;
          deletableInwardMap[inwId] = true;
          inwardConsumedByOutwardMap[inwId] = 0;
          inwardMinAllowedMap[inwId] = {};
        }
        continue;
      }

      // Sort inwards and outwards chronologically ascending
      const sortedInwards = [...poInwards].sort((a, b) => getInwardTime(a) - getInwardTime(b));
      const sortedOutwards = [...poOutwards].sort((a, b) => getOutwardTime(a) - getOutwardTime(b));

      interface InwardSlot {
        inwardId: string;
        poLineId: string;
        colourKey: string;
        originalQty: number;
        remainingQty: number;
        time: number;
      }

      const lineSlots: Record<string, InwardSlot[]> = {};
      const totalInwardPerLine: Record<string, number> = {};
      const totalOutwardPerLine: Record<string, number> = {};

      for (const inw of sortedInwards) {
        const inwId = inw.inwardId || inw.id;
        const inwTime = getInwardTime(inw);
        for (const line of inw.lines || []) {
          const poLineId = line.poLineId || line.lineId || '';
          const colourKey = (line.colourNameSnapshot || line.colour || '').trim().toLowerCase();
          const qty = Math.max(0, Number(line.receivedQty) || 0);

          const slot: InwardSlot = {
            inwardId: inwId,
            poLineId,
            colourKey,
            originalQty: qty,
            remainingQty: qty,
            time: inwTime
          };

          if (poLineId) {
            lineSlots[poLineId] = lineSlots[poLineId] || [];
            lineSlots[poLineId].push(slot);
            totalInwardPerLine[poLineId] = (totalInwardPerLine[poLineId] || 0) + qty;
          }
          if (colourKey) {
            lineSlots[`col_${colourKey}`] = lineSlots[`col_${colourKey}`] || [];
            lineSlots[`col_${colourKey}`].push(slot);
            totalInwardPerLine[`col_${colourKey}`] = (totalInwardPerLine[`col_${colourKey}`] || 0) + qty;
          }
        }
      }

      // Track consumption per inward and per line
      const inwardConsumedQty: Record<string, number> = {};
      const inwardLineConsumedQty: Record<string, Record<string, number>> = {};

      for (const outw of sortedOutwards) {
        for (const outLine of outw.lines || []) {
          const poLineId = outLine.poLineId || outLine.lineId || '';
          const colourKey = (outLine.colourNameSnapshot || outLine.colour || '').trim().toLowerCase();
          let dispatchNeeded = Math.max(0, Number(outLine.dispatchQty) || 0);
          if (dispatchNeeded <= 0) continue;

          if (poLineId) {
            totalOutwardPerLine[poLineId] = (totalOutwardPerLine[poLineId] || 0) + dispatchNeeded;
          }
          if (colourKey) {
            totalOutwardPerLine[`col_${colourKey}`] = (totalOutwardPerLine[`col_${colourKey}`] || 0) + dispatchNeeded;
          }

          // Prioritize exact poLineId match; fallback to colour key
          const slots = (poLineId && lineSlots[poLineId]) || (colourKey && lineSlots[`col_${colourKey}`]) || [];

          for (const slot of slots) {
            if (dispatchNeeded <= 0) break;
            if (slot.remainingQty <= 0) continue;

            const allocated = Math.min(slot.remainingQty, dispatchNeeded);
            slot.remainingQty -= allocated;
            dispatchNeeded -= allocated;

            inwardConsumedQty[slot.inwardId] = (inwardConsumedQty[slot.inwardId] || 0) + allocated;
            inwardLineConsumedQty[slot.inwardId] = inwardLineConsumedQty[slot.inwardId] || {};

            if (slot.poLineId) {
              inwardLineConsumedQty[slot.inwardId][slot.poLineId] =
                (inwardLineConsumedQty[slot.inwardId][slot.poLineId] || 0) + allocated;
            }
            if (slot.colourKey) {
              inwardLineConsumedQty[slot.inwardId][`col_${slot.colourKey}`] =
                (inwardLineConsumedQty[slot.inwardId][`col_${slot.colourKey}`] || 0) + allocated;
            }
          }
        }
      }

      // Check each inward receipt for deletability and edit minimums
      for (const inw of sortedInwards) {
        const inwId = inw.inwardId || inw.id;
        const consumed = inwardConsumedQty[inwId] || 0;
        inwardConsumedByOutwardMap[inwId] = consumed;

        let stockBalanceViolated = false;
        inwardMinAllowedMap[inwId] = inwardMinAllowedMap[inwId] || {};

        for (const line of inw.lines || []) {
          const poLineId = line.poLineId || line.lineId || '';
          const colourKey = (line.colourNameSnapshot || line.colour || '').trim().toLowerCase();
          const inwQty = Math.max(0, Number(line.receivedQty) || 0);

          const totInw = (poLineId && totalInwardPerLine[poLineId]) || (colourKey && totalInwardPerLine[`col_${colourKey}`]) || 0;
          const totOutw = (poLineId && totalOutwardPerLine[poLineId]) || (colourKey && totalOutwardPerLine[`col_${colourKey}`]) || 0;

          const remainingInwWithoutThis = Math.max(0, totInw - inwQty);
          if (totOutw > remainingInwWithoutThis) {
            stockBalanceViolated = true;
          }

          const minRequiredForBalance = Math.max(0, totOutw - remainingInwWithoutThis);
          const consumedForLine = (poLineId && inwardLineConsumedQty[inwId]?.[poLineId]) ||
                                  (colourKey && inwardLineConsumedQty[inwId]?.[`col_${colourKey}`]) || 0;
          const minAllowed = Math.max(consumedForLine, minRequiredForBalance);

          if (poLineId) inwardMinAllowedMap[inwId][poLineId] = minAllowed;
          if (colourKey) {
            inwardMinAllowedMap[inwId][`col_${colourKey}`] = minAllowed;
            inwardMinAllowedMap[inwId][colourKey] = minAllowed;
          }
        }

        // If some outward was entered in the PO and consumed from this inward entry,
        // or if deleting it drops inward stock below outward dispatched:
        // Do NOT show the delete option!
        if (consumed > 0 || stockBalanceViolated) {
          deletableInwardMap[inwId] = false;
        } else {
          deletableInwardMap[inwId] = true;
        }
      }
    }

    return {
      deletableInwardMap,
      inwardMinAllowedMap,
      inwardConsumedByOutwardMap,
      outwardCountByPo
    };
  }

  /**
   * Fetch paginated and filtered Inward Receipts
   */
  static async getInwardEntries(
    filters: InwardFilterOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
    isDemo: boolean = false
  ): Promise<{ inwards: InwardEntry[]; pagination: InwardPagination }> {
    let allEntries: InwardEntry[] = [];

    if (!isDemo) {
      try {
        const q = query(collection(db, 'inward_entries'), orderBy('inwardDate', 'desc'));
        const snap = await getDocs(q);

        // Always trust Firestore result (even empty = all records deleted).
        // Do NOT fall back to localStorage when Firestore succeeds — that would show stale deleted data.
        allEntries = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id;
          return {
            ...data,
            id,
            inwardId: data.inwardId || id,
            entryId: data.entryId || data.inwardNo || id
          } as InwardEntry;
        });
        saveLocalInwards(allEntries); // Sync cache: overwrites with fresh Firestore data (or clears it if empty)
      } catch (err) {
        // Only fall back to localStorage on a genuine network/permission error
        console.warn('Firestore fetch failed for inward_entries, falling back to local cache:', err);
        allEntries = getLocalInwards();
      }
    } else {
      allEntries = getLocalInwards();
    }

    // Apply Client-Side Filter options
    let filtered = [...allEntries];

    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          (i.inwardNo && i.inwardNo.toLowerCase().includes(q)) ||
          (i.customerDcNo && i.customerDcNo.toLowerCase().includes(q)) ||
          (i.poNumberSnapshot && i.poNumberSnapshot.toLowerCase().includes(q)) ||
          (i.customerCompanyNameSnapshot && i.customerCompanyNameSnapshot.toLowerCase().includes(q)) ||
          (i.styleNoSnapshot && i.styleNoSnapshot.toLowerCase().includes(q)) ||
          (i.itemNameSnapshot && i.itemNameSnapshot.toLowerCase().includes(q))
      );
    }

    if (filters.customerId && filters.customerId !== 'all') {
      filtered = filtered.filter((i) => i.customerVendorId === filters.customerId || i.customerId === filters.customerId);
    }

    if (filters.subcontractorId && filters.subcontractorId !== 'all') {
      filtered = filtered.filter((i) => i.subcontractorVendorId === filters.subcontractorId);
    }

    if (filters.poId && filters.poId !== 'all') {
      filtered = filtered.filter((i) => i.poId === filters.poId);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter((i) => i.status === filters.status);
    }

    if (filters.customerDcNo && filters.customerDcNo.trim().length > 0) {
      const dcLower = filters.customerDcNo.trim().toLowerCase();
      filtered = filtered.filter((i) => i.customerDcNo.toLowerCase().includes(dcLower));
    }

    if (filters.startDate) {
      filtered = filtered.filter((i) => (i.inwardDate || i.customerDate) >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter((i) => (i.inwardDate || i.customerDate) <= filters.endDate!);
    }

    // Sort: newest inwardDate first
    filtered.sort((a, b) => {
      const dateA = a.inwardDate || a.customerDate || '';
      const dateB = b.inwardDate || b.customerDate || '';
      return dateB.localeCompare(dateA);
    });

    const totalRecords = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.pageSize));
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const paginatedEntries = filtered.slice(startIndex, startIndex + pagination.pageSize);

    return {
      inwards: paginatedEntries,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalRecords,
        totalPages
      }
    };
  }

  /**
   * Retrieves an inward entry by its ID, with subcollection lines and audit logs
   */
  static async getInwardEntryById(
    inwardId: string,
    isDemo: boolean = false
  ): Promise<{ inward: InwardEntry | null; logs: InwardAuditLog[] }> {
    if (!isDemo) {
      try {
        const docRef = doc(db, 'inward_entries', inwardId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data() as InwardEntry;
          const id = snap.id;

          // Load subcollection lines
          let lines = data.lines || [];
          try {
            const linesSnap = await getDocs(collection(db, 'inward_entries', inwardId, 'lines'));
            if (!linesSnap.empty) {
              lines = linesSnap.docs.map((d) => d.data() as InwardLine);
            }
          } catch (e) {
            // Use header lines if subcollection fetch fails
          }

          // Load audit logs
          let logs: InwardAuditLog[] = [];
          try {
            const auditQ = query(
              collection(db, 'inward_audit_logs'),
              where('inwardId', '==', inwardId),
              orderBy('performedAt', 'desc')
            );
            const auditSnap = await getDocs(auditQ);
            logs = auditSnap.docs.map((d) => d.data() as InwardAuditLog);
          } catch (e) {
            const localLogs = getLocalAuditLogs()[inwardId] || [];
            logs = localLogs;
          }

          return {
            inward: {
              ...data,
              id,
              inwardId: data.inwardId || id,
              lines
            },
            logs
          };
        }
      } catch (err) {
        console.warn('Firestore getInwardEntryById failed:', err);
      }
      return { inward: null, logs: [] };
    }

    const localList = getLocalInwards();
    const match = localList.find((i) => i.inwardId === inwardId || i.id === inwardId) || null;
    const localLogs = getLocalAuditLogs()[inwardId] || [];
    return { inward: match, logs: localLogs };
  }

  /**
   * Calculate Colour-wise Inward balance preview for a PO
   */
  static async getInwardBalancesForPO(po: PurchaseOrder, isDemo: boolean = false): Promise<InwardBalancesResponse> {
    const cumulativeMap = await this.getCumulativePostedInwardMap(po.id, undefined, isDemo, po.poNumber);

    const totalsByUnit: InwardBalancesResponse['totalsByUnit'] = {
      piece: { ordered: 0, previouslyReceived: 0, remaining: 0 },
      kg: { ordered: 0, previouslyReceived: 0, remaining: 0 }
    };

    const colourLines = po.colourLines || po.lines || [];
    const processedLines: InwardLineBalance[] = colourLines.map((line) => {
      const lineId = line.id || line.lineId;
      const colourKey = (line.colourName || '').trim().toLowerCase();
      const ordered = Math.max(0, Number(line.quantity) || 0);
      const prev = Math.max(
        0,
        cumulativeMap[lineId] ?? (colourKey ? cumulativeMap[`colour_${colourKey}`] : 0) ?? 0
      );
      const remaining = Math.max(0, ordered - prev);
      const unit = line.unit === 'kg' ? 'kg' : 'piece';

      if (totalsByUnit[unit]) {
        totalsByUnit[unit]!.ordered += ordered;
        totalsByUnit[unit]!.previouslyReceived += prev;
        totalsByUnit[unit]!.remaining += remaining;
      }

      return {
        poLineId: lineId,
        colourName: line.colourName,
        colourCode: line.colourCode || null,
        itemName: line.itemName || po.itemName,
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
      poId: po.id,
      poNumber: po.poNumber,
      customerVendorId: po.customerId || po.customerVendorId || '',
      customerName: po.customerName || po.customerCompanyNameSnapshot || '',
      styleNo: po.styleNo || po.styleNumber || '',
      itemName: po.itemName,
      processCategory: po.processCategory as 'washing' | 'dyeing',
      lines: processedLines,
      totalsByUnit
    };
  }

  /**
   * Create an Inward Draft
   */
  static async createInwardDraft(
    data: {
      po: PurchaseOrder;
      customer: Vendor;
      subcontractor?: Vendor | null;
      customerDate: string;
      customerDcNo: string;
      inwardDate: string;
      remarks?: string;
      lines: Array<{
        poLineId: string;
        colourName: string;
        colourCode?: string | null;
        itemName: string;
        processType: string;
        orderedQty: number;
        unit: 'piece' | 'kg';
        previouslyReceivedQty: number;
        receivedQty: number;
      }>;
    },
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<InwardEntry> {
    const { po, customer, subcontractor, customerDate, customerDcNo, inwardDate, remarks, lines } = data;

    const inwardId = `inw-draft-${Date.now()}`;
    const now = new Date().toISOString();

    const totals = calculateInwardTotalsByUnit(
      lines.map((l) => ({ ...l, receivedQty: l.receivedQty, currentReceiptQty: l.receivedQty }))
    );

    const processedLines: InwardLine[] = lines.map((l, idx) => {
      const prev = l.previouslyReceivedQty || 0;
      const rec = l.receivedQty || 0;
      const cum = prev + rec;
      const bal = Math.max(0, l.orderedQty - cum);

      return {
        inwardLineId: `inwl_${inwardId}_${idx}`,
        lineId: `inwl_${inwardId}_${idx}`,
        inwardId,
        poId: po.id,
        poLineId: l.poLineId,
        colourNameSnapshot: l.colourName,
        colour: l.colourName,
        colourCodeSnapshot: l.colourCode || null,
        itemNameSnapshot: l.itemName || po.itemName,
        washTypeSnapshot: l.processType,
        processType: l.processType,
        orderedQtySnapshot: l.orderedQty,
        unit: l.unit,
        previouslyReceivedQtySnapshot: prev,
        receivedQty: rec,
        cumulativeReceivedQtySnapshot: cum,
        balanceAfterReceiptSnapshot: bal,
        createdAt: now
      };
    });

    const inwardDoc: InwardEntry = {
      id: inwardId,
      inwardId,
      inwardNo: 'INW/DRAFT',
      entryId: 'INW/DRAFT',
      poId: po.id,
      poNumberSnapshot: po.poNumber,
      poNumber: po.poNumber,
      customerVendorId: customer.vendorId || customer.id || '',
      customerId: customer.vendorId || customer.id || '',
      customerCompanyNameSnapshot: customer.companyName || '',
      customerName: customer.companyName || '',
      subcontractorVendorId: subcontractor ? subcontractor.vendorId || subcontractor.id : null,
      subContractorId: subcontractor ? subcontractor.vendorId || subcontractor.id : undefined,
      subcontractorNameSnapshot: subcontractor ? subcontractor.companyName : null,
      subContractorName: subcontractor ? subcontractor.companyName : undefined,
      styleNoSnapshot: po.styleNo || po.styleNumber || '',
      styleNo: po.styleNo || po.styleNumber || '',
      itemNameSnapshot: po.itemName,
      itemName: po.itemName,
      processCategorySnapshot: (po.processCategory as any) || 'washing',
      processCategory: (po.processCategory as any) || 'washing',
      customerDate,
      customerDcNo,
      inwardDate,
      status: 'draft',
      totalQtyByUnit: { piece: totals.piece, kg: totals.kg },
      totalQuantity: totals.totalQuantity,
      remarks: remarks || '',
      createdBy: user.uid,
      createdByName: user.displayName || 'Authorized User',
      createdAt: now,
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now,
      lines: processedLines,
      schemaVersion: 1
    };

    if (!isDemo) {
      try {
        const docRef = doc(db, 'inward_entries', inwardId);
        await setDoc(docRef, cleanFirestoreData(inwardDoc));
        for (const l of processedLines) {
          const lRef = doc(collection(db, 'inward_entries', inwardId, 'lines'), l.inwardLineId);
          await setDoc(lRef, cleanFirestoreData(l));
        }

        const auditRef = doc(db, 'inward_audit_logs', `audit_${Date.now()}`);
        await setDoc(auditRef, {
          auditId: auditRef.id,
          inwardId,
          inwardNo: 'INW/DRAFT',
          action: 'created',
          performedBy: user.uid,
          performedByName: user.displayName || 'Authorized User',
          performedAt: now,
          summary: `Draft Inward Receipt created for PO ${po.poNumber} with DC No '${customerDcNo}'.`
        });
      } catch (err) {
        console.warn('Firestore createInwardDraft failed, saving locally:', err);
      }
    }

    const currentList = getLocalInwards();
    saveLocalInwards([inwardDoc, ...currentList]);

    return inwardDoc;
  }

  /**
   * Post Inward Receipt (Final Submission with Number Allocation, Atomic Transaction & PO Update)
   */
  static async postInwardReceipt(
    data: {
      draftInwardId?: string;
      po: PurchaseOrder;
      customer: Vendor;
      subcontractor?: Vendor | null;
      customerDate: string;
      customerDcNo: string;
      inwardDate: string;
      remarks?: string;
      lines: Array<{
        poLineId: string;
        colourName: string;
        colourCode?: string | null;
        itemName: string;
        processType: string;
        orderedQty: number;
        unit: 'piece' | 'kg';
        previouslyReceivedQty: number;
        receivedQty: number;
      }>;
    },
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<InwardEntry> {
    const { draftInwardId, po, customer, subcontractor, customerDate, customerDcNo, inwardDate, remarks, lines } = data;

    // Validation: At least one positive received quantity
    const hasPositive = lines.some((l) => (Number(l.receivedQty) || 0) > 0);
    if (!hasPositive) {
      throw new Error('At least one colour line must have a receipt quantity greater than 0 before posting.');
    }

    // Validation: Customer match
    const poCustId = po.customerId || po.customerVendorId;
    const selectedCustId = customer.vendorId || customer.id;
    if (poCustId !== selectedCustId) {
      throw new Error(`Customer mismatch: Selected customer does not match the customer on Purchase Order ${po.poNumber}.`);
    }

    // Generate permanent, collision-safe inward number
    const inwardNo = await this.generateInwardNumber(inwardDate || customerDate, isDemo);
    const inwardId = draftInwardId || `inw_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();

    const totals = calculateInwardTotalsByUnit(
      lines.map((l) => ({ ...l, receivedQty: l.receivedQty, currentReceiptQty: l.receivedQty }))
    );

    // Over-receipt check against authoritative cumulative posted receipts
    const cumulativeMap = await this.getCumulativePostedInwardMap(po.id, draftInwardId, isDemo, po.poNumber);

    const processedLines: InwardLine[] = lines.map((l, idx) => {
      const colourKey = (l.colourName || '').trim().toLowerCase();
      const prev = cumulativeMap[l.poLineId] ?? (colourKey ? cumulativeMap[`colour_${colourKey}`] : 0) ?? 0;
      const rec = Math.max(0, Number(l.receivedQty) || 0);
      const remainingBefore = Math.max(0, Number(l.orderedQty) - prev);

      if (rec > remainingBefore) {
        throw new Error(
          `Over-receipt rejected for colour '${l.colourName}'. Remaining order quantity is ${remainingBefore} ${l.unit}, but attempted receipt is ${rec} ${l.unit}.`
        );
      }

      const cum = prev + rec;
      const bal = Math.max(0, Number(l.orderedQty) - cum);

      return {
        inwardLineId: `inwl_${inwardId}_${idx}`,
        lineId: `inwl_${inwardId}_${idx}`,
        inwardId,
        poId: po.id,
        poLineId: l.poLineId,
        colourNameSnapshot: l.colourName,
        colour: l.colourName,
        colourCodeSnapshot: l.colourCode || null,
        itemNameSnapshot: l.itemName || po.itemName,
        washTypeSnapshot: l.processType,
        processType: l.processType,
        orderedQtySnapshot: l.orderedQty,
        unit: l.unit,
        previouslyReceivedQtySnapshot: prev,
        receivedQty: rec,
        cumulativeReceivedQtySnapshot: cum,
        balanceAfterReceiptSnapshot: bal,
        createdAt: now
      };
    });

    const postedInward: InwardEntry = {
      id: inwardId,
      inwardId,
      inwardNo,
      entryId: inwardNo,
      poId: po.id,
      poNumberSnapshot: po.poNumber,
      poNumber: po.poNumber,
      customerVendorId: customer.vendorId || customer.id || '',
      customerId: customer.vendorId || customer.id || '',
      customerCompanyNameSnapshot: customer.companyName || '',
      customerName: customer.companyName || '',
      subcontractorVendorId: subcontractor ? subcontractor.vendorId || subcontractor.id : null,
      subContractorId: subcontractor ? subcontractor.vendorId || subcontractor.id : undefined,
      subcontractorNameSnapshot: subcontractor ? subcontractor.companyName : null,
      subContractorName: subcontractor ? subcontractor.companyName : undefined,
      styleNoSnapshot: po.styleNo || po.styleNumber || '',
      styleNo: po.styleNo || po.styleNumber || '',
      itemNameSnapshot: po.itemName,
      itemName: po.itemName,
      processCategorySnapshot: (po.processCategory as any) || 'washing',
      processCategory: (po.processCategory as any) || 'washing',
      customerDate,
      customerDcNo,
      inwardDate,
      status: 'posted',
      totalQtyByUnit: { piece: totals.piece, kg: totals.kg },
      totalQuantity: totals.totalQuantity,
      remarks: remarks || '',
      createdBy: user.uid,
      createdByName: user.displayName || 'Authorized User',
      createdAt: now,
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now,
      postedBy: user.uid,
      postedByName: user.displayName || 'Authorized User',
      postedAt: now,
      lines: processedLines,
      schemaVersion: 1
    };

    // Calculate new PO progress status
    const poColourLines = po.colourLines || po.lines || [];
    let isFullyReceived = true;
    for (const pl of poColourLines) {
      const plId = pl.id || pl.lineId;
      const prev = cumulativeMap[plId] || 0;
      const cur = processedLines.find((plSubmitted) => plSubmitted.poLineId === plId)?.receivedQty || 0;
      if (prev + cur < (Number(pl.quantity) || 0)) {
        isFullyReceived = false;
      }
    }
    const updatedPOStatus = isFullyReceived ? 'fully_received' : 'partially_received';

    if (!isDemo) {
      try {
        const inwardRef = doc(db, 'inward_entries', inwardId);
        await setDoc(inwardRef, cleanFirestoreData(postedInward));

        for (const l of processedLines) {
          const lRef = doc(collection(db, 'inward_entries', inwardId, 'lines'), l.inwardLineId);
          await setDoc(lRef, cleanFirestoreData(l));
        }

        // Update PO status
        const poRef = doc(db, 'purchase_orders', po.id);
        await updateDoc(poRef, {
          status: updatedPOStatus,
          updatedAt: Timestamp.now(),
          updatedBy: user.uid
        });

        // Audit log
        const auditRef = doc(db, 'inward_audit_logs', `audit_${Date.now()}`);
        await setDoc(auditRef, {
          auditId: auditRef.id,
          inwardId,
          inwardNo,
          action: 'posted',
          performedBy: user.uid,
          performedByName: user.displayName || 'Authorized User',
          performedAt: now,
          summary: `Inward Receipt ${inwardNo} posted for PO ${po.poNumber} with DC No '${customerDcNo}'. Total Qty: ${totals.totalQuantity} (${totals.piece} pcs, ${totals.kg} kg). PO status updated to ${updatedPOStatus}.`
        });
      } catch (err) {
        console.warn('Firestore postInwardReceipt transaction failed, persisting locally:', err);
      }
    }

    // Persist to local storage
    const currentList = getLocalInwards().filter((i) => i.inwardId !== inwardId && i.id !== inwardId);
    saveLocalInwards([postedInward, ...currentList]);

    // Save audit log locally
    const auditMap = getLocalAuditLogs();
    const entryAudit: InwardAuditLog = {
      auditId: `audit_${Date.now()}`,
      inwardId,
      inwardNo,
      action: 'posted',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Inward Receipt ${inwardNo} posted for PO ${po.poNumber} with DC No '${customerDcNo}'. Total Qty: ${totals.totalQuantity} (${totals.piece} pcs, ${totals.kg} kg).`
    };
    auditMap[inwardId] = [entryAudit, ...(auditMap[inwardId] || [])];
    saveLocalAuditLogs(auditMap);

    return postedInward;
  }

  /**
   * Directly transition an existing draft to posted status
   */
  static async postExistingDraft(
    draftInwardId: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<InwardEntry> {
    const { inward } = await this.getInwardEntryById(draftInwardId, isDemo);
    if (!inward) {
      throw new Error('Draft inward receipt not found.');
    }
    if (inward.status !== 'draft') {
      throw new Error(`Cannot post inward receipt with status '${inward.status}'.`);
    }

    // Load PO
    const { pos } = await POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, isDemo);
    const po = pos.find((p: PurchaseOrder) => p.id === inward.poId || p.poId === inward.poId);
    if (!po) {
      throw new Error(`Purchase Order '${inward.poNumberSnapshot || inward.poNumber}' not found.`);
    }

    // Load Customer
    const { vendors } = await VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemo);
    const customer = vendors.find(
      (v: Vendor) => (v.vendorId || v.id) === inward.customerVendorId || v.companyName === inward.customerCompanyNameSnapshot
    );
    if (!customer) {
      throw new Error('Customer vendor record not found.');
    }

    const subVendor = inward.subcontractorVendorId
      ? vendors.find((v: Vendor) => (v.vendorId || v.id) === inward.subcontractorVendorId)
      : null;

    const lines = (inward.lines || []).map((l) => ({
      poLineId: l.poLineId,
      colourName: l.colourNameSnapshot || l.colour || 'Default',
      colourCode: l.colourCodeSnapshot,
      itemName: l.itemNameSnapshot || po.itemName,
      processType: l.processType || 'Softener Wash',
      orderedQty: Number(l.orderedQtySnapshot) || 0,
      unit: (l.unit === 'kg' ? 'kg' : 'piece') as 'piece' | 'kg',
      previouslyReceivedQty: Number(l.previouslyReceivedQtySnapshot) || 0,
      receivedQty: Number(l.receivedQty) || 0
    }));

    return this.postInwardReceipt(
      {
        draftInwardId: inward.inwardId || inward.id,
        po,
        customer,
        subcontractor: subVendor,
        customerDate: inward.customerDate,
        customerDcNo: inward.customerDcNo,
        inwardDate: inward.inwardDate || new Date().toISOString().split('T')[0],
        remarks: inward.remarks,
        lines
      },
      user,
      isDemo
    );
  }

  /**
   * Reverse a Posted Inward Receipt with Authorised Validation
   */
  static async reverseInwardReceipt(
    inwardId: string,
    reversalReason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<InwardEntry> {
    if (!reversalReason || reversalReason.trim().length < 5) {
      throw new Error('Reversal reason must be at least 5 characters long explaining why this receipt is being reversed.');
    }

    const { inward } = await this.getInwardEntryById(inwardId, isDemo);
    if (!inward) {
      throw new Error(`Inward Receipt ${inwardId} not found.`);
    }

    if (inward.status !== 'posted') {
      throw new Error(`Cannot reverse receipt with status '${inward.status}'. Only posted receipts can be reversed.`);
    }

    const now = new Date().toISOString();
    const reversedInward: InwardEntry = {
      ...inward,
      status: 'reversed',
      reversedBy: user.uid,
      reversedByName: user.displayName || 'Authorized User',
      reversedAt: now,
      reversalReason: reversalReason.trim(),
      updatedBy: user.uid,
      updatedByName: user.displayName || 'Authorized User',
      updatedAt: now
    };

    if (!isDemo) {
      try {
        const inwardRef = doc(db, 'inward_entries', inwardId);
        await updateDoc(inwardRef, {
          status: 'reversed',
          reversedBy: user.uid,
          reversedByName: user.displayName || 'Authorized User',
          reversedAt: Timestamp.now(),
          reversalReason: reversalReason.trim(),
          updatedAt: Timestamp.now(),
          updatedBy: user.uid
        });

        // Audit log
        const auditRef = doc(db, 'inward_audit_logs', `audit_${Date.now()}`);
        await setDoc(auditRef, {
          auditId: auditRef.id,
          inwardId,
          inwardNo: inward.inwardNo,
          action: 'reversed',
          performedBy: user.uid,
          performedByName: user.displayName || 'Authorized User',
          performedAt: now,
          summary: `Inward Receipt ${inward.inwardNo} reversed by ${user.displayName || 'Authorized User'}. Reason: ${reversalReason}.`
        });
      } catch (err) {
        console.warn('Firestore reverseInwardReceipt failed, updating locally:', err);
      }
    }

    // Local storage update
    const currentList = getLocalInwards().map((i) => (i.inwardId === inwardId || i.id === inwardId ? reversedInward : i));
    saveLocalInwards(currentList);

    const auditMap = getLocalAuditLogs();
    const reversalLog: InwardAuditLog = {
      auditId: `audit_${Date.now()}`,
      inwardId,
      inwardNo: inward.inwardNo,
      action: 'reversed',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Inward Receipt ${inward.inwardNo} reversed by ${user.displayName || 'Authorized User'}. Reason: ${reversalReason}.`
    };
    auditMap[inwardId] = [reversalLog, ...(auditMap[inwardId] || [])];
    saveLocalAuditLogs(auditMap);

    return reversedInward;
  }

  /**
   * Retrieves dashboard summary metrics for Inward Receipts
   */
  static async getInwardDashboardMetrics(isDemo: boolean = false): Promise<InwardDashboardMetrics> {
    const { inwards } = await this.getInwardEntries({}, { page: 1, pageSize: 1000 }, isDemo);

    let draftCount = 0;
    let postedCount = 0;
    let reversedCount = 0;
    let totalPiecesReceived = 0;
    let totalKgReceived = 0;

    for (const item of inwards) {
      if (item.status === 'draft') draftCount++;
      else if (item.status === 'posted') {
        postedCount++;
        totalPiecesReceived += item.totalQtyByUnit?.piece || 0;
        totalKgReceived += item.totalQtyByUnit?.kg || 0;
      } else if (item.status === 'reversed') reversedCount++;
    }

    return {
      totalInwardCount: inwards.length,
      draftCount,
      postedCount,
      reversedCount,
      totalPiecesReceived,
      totalKgReceived,
      pendingInwardPieces: 0,
      pendingInwardKg: 0
    };
  }

  /**
   * Delete an Inward Receipt (Admin Only)
   */
  static async deleteInwardReceipt(
    inwardId: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<boolean> {
    const { inward } = await this.getInwardEntryById(inwardId, isDemo);
    if (!inward) {
      throw new Error(`Inward Receipt ${inwardId} not found.`);
    }

    const poId = inward.poId;

    // Safety verification 1: Check if PO is locked due to statement approval / invoice
    const lockMap = await POLockService.getLockedPOMap(isDemo);
    const lockStatus = POLockService.isLocked(inward, lockMap);
    if (lockStatus) {
      throw new Error(`Cannot delete Inward Receipt ${inward.inwardNo || inwardId}: ${lockStatus.reason}`);
    }

    // Safety verification 2: Prevent deleting inward if outward dispatches depend on it
    const analysis = await this.getInwardOutwardDependencies(poId, isDemo);
    const targetKey = inward.inwardId || inward.id || inwardId;
    if (analysis.deletableInwardMap[targetKey] === false || analysis.deletableInwardMap[inwardId] === false) {
      throw new Error(
        `Cannot delete Inward Receipt ${inward.inwardNo || inwardId}: One or more Outward dispatch entries have already been entered against this Purchase Order.`
      );
    }

    if (!isDemo) {
      try {
        const inwardRef = doc(db, 'inward_entries', inwardId);
        // Delete lines subcollection
        try {
          const linesSnap = await getDocs(collection(db, 'inward_entries', inwardId, 'lines'));
          for (const lDoc of linesSnap.docs) {
            await deleteDoc(lDoc.ref);
          }
        } catch (e) {
          // ignore
        }

        // Delete header doc
        await deleteDoc(inwardRef);

        // Re-evaluate PO status
        try {
          const remainingInwards = (await getDocs(
            query(collection(db, 'inward_entries'), where('poId', '==', poId), where('status', '==', 'posted'))
          )).docs.filter((d) => d.id !== inwardId);

          const newPOStatus = remainingInwards.length > 0 ? 'partially_received' : 'approved';
          await updateDoc(doc(db, 'purchase_orders', poId), {
            status: newPOStatus,
            updatedAt: Timestamp.now(),
            updatedBy: user.uid
          });
        } catch (poErr) {
          console.warn('Failed to update PO status during inward deletion:', poErr);
        }

        // Audit log
        const auditRef = doc(db, 'inward_audit_logs', `audit_${Date.now()}`);
        await setDoc(auditRef, {
          auditId: auditRef.id,
          inwardId,
          inwardNo: inward.inwardNo || inwardId,
          action: 'cancelled',
          performedBy: user.uid,
          performedByName: user.displayName || 'Admin',
          performedAt: new Date().toISOString(),
          summary: `Inward Receipt ${inward.inwardNo || inwardId} deleted by Admin ${user.displayName || 'Admin'}.`
        });
      } catch (err) {
        console.warn('Firestore deleteInwardReceipt failed, deleting locally:', err);
      }
    }

    // Local storage delete
    const currentList = getLocalInwards().filter((i) => i.inwardId !== inwardId && i.id !== inwardId);
    saveLocalInwards(currentList);

    return true;
  }
}

