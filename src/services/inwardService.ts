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
import { PurchaseOrder } from '../types/po';
import { Vendor } from '../types/vendor';
import { calculateInwardTotalsByUnit } from '../schemas/inwardSchema';
import { cleanFirestoreData, VendorService } from './vendorService';
import { POService } from './poService';

// Seed initial mock inward entries for demonstration & seeding
export const initialMockInwardEntries: InwardEntry[] = [
  {
    id: 'inw-paramount-0001',
    inwardId: 'inw-paramount-0001',
    inwardNo: 'INW/2026-27/0001',
    entryId: 'INW/2026-27/0001',
    poId: 'po-paramount-2467',
    poNumberSnapshot: 'PO/2026-27/0002',
    poNumber: 'PO/2026-27/0002',
    customerVendorId: 'v-102',
    customerId: 'v-102',
    customerCompanyNameSnapshot: 'Paramount Apparel Processing',
    customerName: 'Paramount Apparel Processing',
    subcontractorVendorId: null,
    subContractorId: undefined,
    subcontractorNameSnapshot: null,
    subContractorName: undefined,
    styleNoSnapshot: '2467',
    styleNo: '2467',
    itemNameSnapshot: 'shoe',
    itemName: 'shoe',
    processCategorySnapshot: 'dyeing',
    processCategory: 'dyeing',
    customerDate: '2026-10-12',
    customerDcNo: 'DC-PAP-9901',
    inwardDate: '2026-10-12',
    status: 'posted',
    totalQtyByUnit: { piece: 2, kg: 0 },
    totalQuantity: 2,
    remarks: 'First batch receipt against sample order. All pieces checked.',
    createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdByName: 'Pranav',
    createdAt: '2026-10-12T10:15:00.000Z',
    updatedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    updatedByName: 'Pranav',
    updatedAt: '2026-10-12T10:15:00.000Z',
    postedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    postedByName: 'Pranav',
    postedAt: '2026-10-12T10:15:00.000Z',
    lines: [
      {
        inwardLineId: 'inwl-paramount-1',
        lineId: 'inwl-paramount-1',
        inwardId: 'inw-paramount-0001',
        poId: 'po-paramount-2467',
        poLineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourNameSnapshot: 'pink',
        colour: 'pink',
        colourCodeSnapshot: null,
        itemNameSnapshot: 'shoe',
        washTypeSnapshot: 'stoneWash',
        processType: 'stoneWash',
        orderedQtySnapshot: 2,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 2,
        cumulativeReceivedQtySnapshot: 2,
        balanceAfterReceiptSnapshot: 0,
        createdAt: '2026-10-12T10:15:00.000Z'
      }
    ],
    schemaVersion: 1
  },
  {
    id: 'inw-apex-0002',
    inwardId: 'inw-apex-0002',
    inwardNo: 'INW/2026-27/0002',
    entryId: 'INW/2026-27/0002',
    poId: 'po-apex-9021',
    poNumberSnapshot: 'PO/2026-27/0001',
    poNumber: 'PO/2026-27/0001',
    customerVendorId: 'v-101',
    customerId: 'v-101',
    customerCompanyNameSnapshot: 'Sree Kumar Texind Corporation',
    customerName: 'Sree Kumar Texind Corporation',
    subcontractorVendorId: 'v-103',
    subContractorId: 'v-103',
    subcontractorNameSnapshot: 'Sree Kumar Subcontractor Unit A',
    subContractorName: 'Sree Kumar Subcontractor Unit A',
    styleNoSnapshot: 'ST-9021',
    styleNo: 'ST-9021',
    itemNameSnapshot: "Men's Casual Shirt",
    itemName: "Men's Casual Shirt",
    processCategorySnapshot: 'washing',
    processCategory: 'washing',
    customerDate: '2026-10-10',
    customerDcNo: 'DC-SKT-4029',
    inwardDate: '2026-10-10',
    status: 'posted',
    totalQtyByUnit: { piece: 4500, kg: 0 },
    totalQuantity: 4500,
    remarks: 'Lot 1 partial receipt. Inward verified by stores supervisor.',
    createdBy: 'admin-uid',
    createdByName: 'Thiru M.',
    createdAt: '2026-10-10T14:30:00.000Z',
    updatedBy: 'admin-uid',
    updatedByName: 'Thiru M.',
    updatedAt: '2026-10-10T14:30:00.000Z',
    postedBy: 'admin-uid',
    postedByName: 'Thiru M.',
    postedAt: '2026-10-10T14:30:00.000Z',
    lines: [
      {
        inwardLineId: 'inwl-apex-1',
        lineId: 'inwl-apex-1',
        inwardId: 'inw-apex-0002',
        poId: 'po-apex-9021',
        poLineId: 'pol-101',
        colourNameSnapshot: 'Pantone Brunnet Shadow',
        colour: 'Pantone Brunnet Shadow',
        colourCodeSnapshot: '19-0912',
        itemNameSnapshot: "Men's Casual Shirt",
        washTypeSnapshot: 'Softener Wash',
        processType: 'Softener Wash',
        orderedQtySnapshot: 3066,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 1800,
        cumulativeReceivedQtySnapshot: 1800,
        balanceAfterReceiptSnapshot: 1266,
        createdAt: '2026-10-10T14:30:00.000Z'
      },
      {
        inwardLineId: 'inwl-apex-2',
        lineId: 'inwl-apex-2',
        inwardId: 'inw-apex-0002',
        poId: 'po-apex-9021',
        poLineId: 'pol-102',
        colourNameSnapshot: 'Pantone Blue Graphite',
        colour: 'Pantone Blue Graphite',
        colourCodeSnapshot: '19-4010',
        itemNameSnapshot: "Men's Casual Shirt",
        washTypeSnapshot: 'Softener Wash',
        processType: 'Softener Wash',
        orderedQtySnapshot: 2859,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 1500,
        cumulativeReceivedQtySnapshot: 1500,
        balanceAfterReceiptSnapshot: 1359,
        createdAt: '2026-10-10T14:30:00.000Z'
      },
      {
        inwardLineId: 'inwl-apex-3',
        lineId: 'inwl-apex-3',
        inwardId: 'inw-apex-0002',
        poId: 'po-apex-9021',
        poLineId: 'pol-103',
        colourNameSnapshot: 'Green Micro',
        colour: 'Green Micro',
        colourCodeSnapshot: '18-5611',
        itemNameSnapshot: "Men's Casual Shirt",
        washTypeSnapshot: 'Softener Wash',
        processType: 'Softener Wash',
        orderedQtySnapshot: 1514,
        unit: 'piece',
        previouslyReceivedQtySnapshot: 0,
        receivedQty: 1200,
        cumulativeReceivedQtySnapshot: 1200,
        balanceAfterReceiptSnapshot: 314,
        createdAt: '2026-10-10T14:30:00.000Z'
      }
    ],
    schemaVersion: 1
  }
];

export const initialMockInwardAuditLogs: Record<string, InwardAuditLog[]> = {
  'inw-paramount-0001': [
    {
      auditId: 'inw_audit_1',
      inwardId: 'inw-paramount-0001',
      inwardNo: 'INW/2026-27/0001',
      action: 'posted',
      performedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
      performedByName: 'Pranav',
      performedAt: '2026-10-12T10:15:00.000Z',
      summary: 'Inward Receipt INW/2026-27/0001 posted for PO PO/2026-27/0002 with DC No DC-PAP-9901.'
    }
  ],
  'inw-apex-0002': [
    {
      auditId: 'inw_audit_2',
      inwardId: 'inw-apex-0002',
      inwardNo: 'INW/2026-27/0002',
      action: 'posted',
      performedBy: 'admin-uid',
      performedByName: 'Thiru M.',
      performedAt: '2026-10-10T14:30:00.000Z',
      summary: 'Inward Receipt INW/2026-27/0002 posted for PO PO/2026-27/0001 with DC No DC-SKT-4029.'
    }
  ]
};

const LOCAL_STORAGE_KEY = 'perla_erp_inward_entries';
const AUDIT_STORAGE_KEY = 'perla_erp_inward_audit_logs';

let memoryInwards: InwardEntry[] = [...initialMockInwardEntries];
let memoryAuditLogs: Record<string, InwardAuditLog[]> = { ...initialMockInwardAuditLogs };

function getLocalInwards(): InwardEntry[] {
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
        if (typeof parsed === 'object') return parsed;
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
  static async getCumulativePostedInwardMap(poId: string, excludeInwardId?: string, isDemo: boolean = false): Promise<Record<string, number>> {
    const cumulativeMap: Record<string, number> = {};

    let entries: InwardEntry[] = [];
    if (!isDemo) {
      try {
        const q = query(collection(db, 'inward_entries'), where('poId', '==', poId), where('status', '==', 'posted'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          entries = snap.docs.map((d) => d.data() as InwardEntry);
        } else {
          entries = getLocalInwards().filter((i) => i.poId === poId && i.status === 'posted');
        }
      } catch (err) {
        console.warn('Firestore getCumulativePostedInwardMap failed, using local storage:', err);
        entries = getLocalInwards().filter((i) => i.poId === poId && i.status === 'posted');
      }
    } else {
      entries = getLocalInwards().filter((i) => i.poId === poId && i.status === 'posted');
    }

    for (const entry of entries) {
      if (excludeInwardId && (entry.inwardId === excludeInwardId || entry.id === excludeInwardId)) {
        continue;
      }
      for (const line of entry.lines || []) {
        const lid = line.poLineId || line.lineId;
        if (lid) {
          cumulativeMap[lid] = (cumulativeMap[lid] || 0) + (Number(line.receivedQty) || 0);
        }
      }
    }

    return cumulativeMap;
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

        if (!snap.empty) {
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
        } else {
          // Auto-seed initial inward entries into live Firestore
          console.log('Seeding initial inward entries into live Firestore...');
          for (const item of initialMockInwardEntries) {
            const docRef = doc(db, 'inward_entries', item.inwardId);
            await setDoc(docRef, cleanFirestoreData(item));
            // Seed subcollection lines
            for (const l of item.lines) {
              const lineRef = doc(collection(db, 'inward_entries', item.inwardId, 'lines'), l.inwardLineId);
              await setDoc(lineRef, cleanFirestoreData(l));
            }
          }
          allEntries = [...initialMockInwardEntries];
        }
      } catch (err) {
        console.warn('Firestore fetch failed for inward_entries, falling back to local demo:', err);
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
        console.warn('Firestore getInwardEntryById failed, using local storage:', err);
      }
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
    const cumulativeMap = await this.getCumulativePostedInwardMap(po.id, undefined, isDemo);

    const totalsByUnit: InwardBalancesResponse['totalsByUnit'] = {
      piece: { ordered: 0, previouslyReceived: 0, remaining: 0 },
      kg: { ordered: 0, previouslyReceived: 0, remaining: 0 }
    };

    const colourLines = po.colourLines || po.lines || [];
    const processedLines: InwardLineBalance[] = colourLines.map((line) => {
      const lineId = line.id || line.lineId;
      const ordered = Math.max(0, Number(line.quantity) || 0);
      const prev = Math.max(0, cumulativeMap[lineId] || 0);
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
    const cumulativeMap = await this.getCumulativePostedInwardMap(po.id, draftInwardId, isDemo);

    const processedLines: InwardLine[] = lines.map((l, idx) => {
      const prev = cumulativeMap[l.poLineId] || 0;
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

