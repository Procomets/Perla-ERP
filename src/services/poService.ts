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
  PurchaseOrder,
  POColourLine,
  POAuditLog,
  POAmendment,
  POFilterOptions,
  POPagination,
  PODashboardMetrics,
  QuantityUnit,
  POStatus
} from '../types/po';
import { calculateLineAmount, calculatePOTotals } from '../schemas/poSchema';
import { Vendor } from '../types/vendor';
import { cleanFirestoreData } from './vendorService';

// Initial sample POs for Perla Textiles Processor (including the exact live sample provided by user)
export const initialMockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'po-paramount-2467',
    poId: 'po-paramount-2467',
    poNumber: 'PO/2026-27/0002',
    customerId: 'v-102',
    customerVendorId: 'v-102',
    customerCode: 'VND-000002',
    customerName: 'Paramount Apparel Processing',
    customerCompanyNameSnapshot: 'Paramount Apparel Processing',
    processCategory: 'dyeing',
    styleNo: '2467',
    styleNumber: '2467',
    itemName: 'shoe',
    orderDate: '2026-10-11',
    deliveryDate: null,
    expectedCompletionDate: null,
    colourLines: [
      {
        id: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        lineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourName: 'pink',
        colourCode: null,
        processType: 'stoneWash',
        quantity: 2,
        unit: 'piece',
        rateBasis: 'perPiece',
        rate: 15,
        lineAmount: 30,
        amount: 30,
        notes: null
      }
    ],
    lines: [
      {
        id: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        lineId: '755fdd37-83ea-45d6-a69a-83a76eb26cf5',
        colourName: 'pink',
        colourCode: null,
        processType: 'stoneWash',
        quantity: 2,
        unit: 'piece',
        rateBasis: 'perPiece',
        rate: 15,
        lineAmount: 30,
        amount: 30,
        notes: null
      }
    ],
    totalQtyByUnit: { piece: 2, kg: 0 },
    totalQuantity: 2,
    totalAmount: 30,
    currency: 'INR',
    customerReferenceNo: 'PAP/REF/2026/89',
    customerInstructions: 'Maintain uniform pink shade across pieces',
    internalRemarks: 'Standard stone wash processing drum 2',
    notes: null,
    status: 'approved',
    revision: 1,
    createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    createdByName: 'Pranav',
    createdAt: '2026-10-11T12:38:11.000Z',
    submittedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    submittedById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    submittedAt: '2026-10-11T12:38:21.000Z',
    approvedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    approvedById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    approvedAt: '2026-10-11T12:38:25.000Z',
    updatedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    updatedById: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
    updatedAt: '2026-10-11T12:38:25.000Z',
    schemaVersion: 1
  },
  {
    id: 'po-apex-9021',
    poId: 'po-apex-9021',
    poNumber: 'PO/2026-27/0001',
    customerId: 'v-101',
    customerVendorId: 'v-101',
    customerCode: 'VND-000001',
    customerName: 'Sree Kumar Texind Corporation',
    customerCompanyNameSnapshot: 'Sree Kumar Texind Corporation',
    processCategory: 'washing',
    styleNo: 'SKT-DENIM-9021',
    styleNumber: 'SKT-DENIM-9021',
    itemName: "Men's Denim Shirt",
    orderDate: '2026-10-08',
    deliveryDate: '2026-10-25',
    expectedCompletionDate: '2026-10-25',
    colourLines: [
      {
        id: 'pol-101',
        lineId: 'pol-101',
        colourName: 'Pantone Brunnet Shadow',
        colourCode: '19-0912',
        processType: 'Softener Wash',
        quantity: 3066,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 18396,
        amount: 18396,
        notes: 'First batch delivery priority'
      },
      {
        id: 'pol-102',
        lineId: 'pol-102',
        colourName: 'Pantone Blue Graphite',
        colourCode: '19-4010',
        processType: 'Softener Wash',
        quantity: 2859,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 17154,
        amount: 17154,
        notes: null
      },
      {
        id: 'pol-103',
        lineId: 'pol-103',
        colourName: 'Green Micro',
        colourCode: '18-5611',
        processType: 'Softener Wash',
        quantity: 1514,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 9084,
        amount: 9084,
        notes: null
      },
      {
        id: 'pol-104',
        lineId: 'pol-104',
        colourName: 'Micro Houndstooth',
        colourCode: '19-3908',
        processType: 'Softener Wash',
        quantity: 1695,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 10170,
        amount: 10170,
        notes: null
      }
    ],
    lines: [
      {
        id: 'pol-101',
        lineId: 'pol-101',
        colourName: 'Pantone Brunnet Shadow',
        colourCode: '19-0912',
        processType: 'Softener Wash',
        quantity: 3066,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 18396,
        amount: 18396,
        notes: 'First batch delivery priority'
      },
      {
        id: 'pol-102',
        lineId: 'pol-102',
        colourName: 'Pantone Blue Graphite',
        colourCode: '19-4010',
        processType: 'Softener Wash',
        quantity: 2859,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 17154,
        amount: 17154,
        notes: null
      },
      {
        id: 'pol-103',
        lineId: 'pol-103',
        colourName: 'Green Micro',
        colourCode: '18-5611',
        processType: 'Softener Wash',
        quantity: 1514,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 9084,
        amount: 9084,
        notes: null
      },
      {
        id: 'pol-104',
        lineId: 'pol-104',
        colourName: 'Micro Houndstooth',
        colourCode: '19-3908',
        processType: 'Softener Wash',
        quantity: 1695,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 6,
        lineAmount: 10170,
        amount: 10170,
        notes: null
      }
    ],
    totalQtyByUnit: { piece: 9134, kg: 0 },
    totalQuantity: 9134,
    totalAmount: 54804,
    currency: 'INR',
    customerReferenceNo: 'SKT/PO/2026/101',
    customerInstructions: 'Extra silicone softening for autumn-winter delivery',
    internalRemarks: 'Checked with washing supervisor Ramanathan',
    notes: 'Premium export finish required',
    status: 'in_progress',
    revision: 1,
    createdBy: 'admin-uid',
    createdById: 'admin-uid',
    createdByName: 'Thiru M.',
    createdAt: '2026-10-08T09:30:00.000Z',
    submittedBy: 'admin-uid',
    submittedById: 'admin-uid',
    submittedAt: '2026-10-08T10:00:00.000Z',
    approvedBy: 'admin-uid',
    approvedById: 'admin-uid',
    approvedAt: '2026-10-08T10:15:00.000Z',
    updatedBy: 'admin-uid',
    updatedById: 'admin-uid',
    updatedAt: '2026-10-08T10:15:00.000Z',
    schemaVersion: 1
  }
];

// Initial mock audit logs
export const initialMockPOAuditLogs: Record<string, POAuditLog[]> = {
  'po-paramount-2467': [
    {
      auditId: 'log_po_paramount_1',
      poId: 'po-paramount-2467',
      poNumber: 'PO/2026-27/0002',
      action: 'created',
      performedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
      performedByName: 'Pranav',
      performedAt: '2026-10-11T12:38:11.000Z',
      summary: "Purchase Order PO/2026-27/0002 created for customer 'Paramount Apparel Processing'."
    },
    {
      auditId: 'log_po_paramount_2',
      poId: 'po-paramount-2467',
      poNumber: 'PO/2026-27/0002',
      action: 'submitted',
      performedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
      performedByName: 'Pranav',
      performedAt: '2026-10-11T12:38:21.000Z',
      summary: 'Purchase Order PO/2026-27/0002 submitted for manager review.'
    },
    {
      auditId: 'log_po_paramount_3',
      poId: 'po-paramount-2467',
      poNumber: 'PO/2026-27/0002',
      action: 'approved',
      performedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
      performedByName: 'Pranav',
      performedAt: '2026-10-11T12:38:25.000Z',
      summary: 'Purchase Order PO/2026-27/0002 approved. Order is active for Inward receipt.'
    }
  ],
  'po-apex-9021': [
    {
      auditId: 'log_po_apex_1',
      poId: 'po-apex-9021',
      poNumber: 'PO/2026-27/0001',
      action: 'created',
      performedBy: 'admin-uid',
      performedByName: 'Thiru M.',
      performedAt: '2026-10-08T09:30:00.000Z',
      summary: "Purchase Order PO/2026-27/0001 created for customer 'Sree Kumar Texind Corporation'."
    },
    {
      auditId: 'log_po_apex_2',
      poId: 'po-apex-9021',
      poNumber: 'PO/2026-27/0001',
      action: 'approved',
      performedBy: 'admin-uid',
      performedByName: 'Thiru M.',
      performedAt: '2026-10-08T10:15:00.000Z',
      summary: 'Purchase Order PO/2026-27/0001 approved and moved to In Progress.'
    }
  ]
};

// Local in-memory store for fallback & demo mode
let localDemoPOs: PurchaseOrder[] = [...initialMockPurchaseOrders];
let localDemoAuditLogs: Record<string, POAuditLog[]> = { ...initialMockPOAuditLogs };
let localDemoAmendments: Record<string, POAmendment[]> = {};

function getLocalDemoPOs(): PurchaseOrder[] {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('perla_erp_purchase_orders');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // Fallback
      }
    }
  }
  return localDemoPOs;
}

function saveLocalDemoPOs(pos: PurchaseOrder[]) {
  localDemoPOs = pos;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('perla_erp_purchase_orders', JSON.stringify(pos));
    } catch (e) {
      // Ignore
    }
  }
}

export function timestampToString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000).toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
}

export function timestampToDateString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') {
    if (val.includes('T')) return val.split('T')[0];
    return val;
  }
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString().split('T')[0];
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString().split('T')[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val);
}

export function normalizePODocument(docId: string, data: any): PurchaseOrder {
  const orderDate = timestampToDateString(data.orderDate) || new Date().toISOString().split('T')[0];
  const deliveryDate = data.deliveryDate ? timestampToDateString(data.deliveryDate) : null;
  const expectedCompletionDate = data.expectedCompletionDate ? timestampToDateString(data.expectedCompletionDate) : deliveryDate;
  const createdAt = timestampToString(data.createdAt) || new Date().toISOString();
  const updatedAt = timestampToString(data.updatedAt) || createdAt;
  const submittedAt = data.submittedAt ? timestampToString(data.submittedAt) : undefined;
  const approvedAt = data.approvedAt ? timestampToString(data.approvedAt) : undefined;
  const rejectedAt = data.rejectedAt ? timestampToString(data.rejectedAt) : undefined;
  const cancelledAt = data.cancelledAt ? timestampToString(data.cancelledAt) : undefined;

  const rawLines = data.colourLines || data.lines || [];
  const colourLines: POColourLine[] = rawLines.map((line: any, idx: number) => {
    const id = line.id || line.lineId || `pol_${idx}`;
    const amount = typeof line.lineAmount === 'number' ? line.lineAmount : calculateLineAmount(line);
    return {
      ...line,
      id,
      lineId: id,
      colourName: line.colourName || '',
      colourCode: line.colourCode || null,
      processType: line.processType || 'Softener Wash',
      quantity: Number(line.quantity) || 0,
      unit: line.unit || 'piece',
      rateBasis: line.rateBasis || 'per_piece',
      rate: Number(line.rate) || 0,
      billableWeightKg: line.billableWeightKg ? Number(line.billableWeightKg) : null,
      billablePieceQty: line.billablePieceQty ? Number(line.billablePieceQty) : null,
      lineAmount: amount,
      amount
    };
  });

  const totals = calculatePOTotals(colourLines);
  const styleNo = data.styleNo || data.styleNumber || '';

  // For draft status, if it was never approved, ensure poNumber is 'PO/PENDING'
  const isDraftStatus = !data.status || data.status === 'draft' || data.status === 'submitted';
  let resolvedPoNumber = data.poNumber || 'PO/PENDING';
  if (isDraftStatus && !data.approvedAt) {
    resolvedPoNumber = 'PO/PENDING';
  }

  return {
    ...data,
    id: docId,
    poId: docId,
    poNumber: resolvedPoNumber,
    customerId: data.customerId || data.customerVendorId || '',
    customerVendorId: data.customerVendorId || data.customerId || '',
    customerCode: data.customerCode || '',
    customerName: data.customerName || data.customerCompanyNameSnapshot || 'Customer',
    customerCompanyNameSnapshot: data.customerCompanyNameSnapshot || data.customerName || 'Customer',
    processCategory: data.processCategory || 'washing',
    styleNo,
    styleNumber: data.styleNumber || styleNo,
    itemName: data.itemName || '',
    orderDate,
    deliveryDate,
    expectedCompletionDate,
    colourLines,
    lines: colourLines,
    totalQtyByUnit: data.totalQtyByUnit || totals.totalQtyByUnit,
    totalQuantity: typeof data.totalQuantity === 'number' ? data.totalQuantity : totals.totalQuantity,
    totalAmount: typeof data.totalAmount === 'number' ? data.totalAmount : totals.totalAmount,
    currency: 'INR',
    status: data.status || 'draft',
    revision: data.revision || 1,
    createdBy: data.createdBy || data.createdById || 'user',
    createdById: data.createdById || data.createdBy || 'user',
    createdByName: data.createdByName || 'Authorized User',
    createdAt,
    updatedBy: data.updatedBy || data.updatedById,
    updatedById: data.updatedById || data.updatedBy,
    updatedAt,
    submittedBy: data.submittedBy || data.submittedById,
    submittedById: data.submittedById || data.submittedBy,
    submittedAt,
    approvedBy: data.approvedBy || data.approvedById,
    approvedById: data.approvedById || data.approvedBy,
    approvedAt,
    rejectedBy: data.rejectedBy || data.rejectedById,
    rejectedById: data.rejectedById || data.rejectedBy,
    rejectedAt,
    rejectionReason: data.rejectionReason,
    cancelledBy: data.cancelledBy || data.cancelledById,
    cancelledById: data.cancelledById || data.cancelledBy,
    cancelledAt,
    cancellationReason: data.cancellationReason,
    schemaVersion: data.schemaVersion || 1
  };
}

export class POService {
  /**
   * Generates atomic PO number from `po_counters` collection: PO/YYYY-YY/NNNN
   * Matches Firestore schema:
   * collection: 'po_counters'
   * doc: '2026-27' (financial year)
   * fields: { financialYear: '2026-27', prefix: 'PO/2026-27', lastSequence: number, updatedAt: timestamp }
   */
  static async generatePONumber(orderDate?: string): Promise<string> {
    const d = orderDate ? new Date(orderDate) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;
    const month = validDate.getMonth() + 1; // 1 to 12
    const year = validDate.getFullYear();
    const fyStart = month >= 4 ? year : year - 1;
    const fyEnd = (fyStart + 1) % 100;
    const fyString = `${fyStart}-${String(fyEnd).padStart(2, '0')}`;
    const defaultPrefix = `PO/${fyString}`;

    // Inspect existing local/cached POs to discover the current max sequence
    let maxExistingSeq = 0;
    try {
      const existingLocal = getLocalDemoPOs();
      const seqRegex = new RegExp(`^PO\\/${fyString}\\/(\\d+)$`);
      for (const p of existingLocal) {
        const m = p.poNumber?.match(seqRegex);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxExistingSeq) maxExistingSeq = num;
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      let allocatedNumber = '';
      const counterRef = doc(db, 'po_counters', fyString);

      await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextSeq = maxExistingSeq + 1;
        let prefix = defaultPrefix;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data?.prefix) {
            prefix = data.prefix;
          }
          const lastSeq = Number(data?.lastSequence ?? data?.currentValue ?? 0);
          nextSeq = Math.max(lastSeq, maxExistingSeq) + 1;
        }

        const padded = String(nextSeq).padStart(4, '0');
        allocatedNumber = `${prefix}/${padded}`;

        transaction.set(
          counterRef,
          {
            financialYear: fyString,
            prefix: prefix,
            lastSequence: nextSeq,
            updatedAt: Timestamp.now()
          },
          { merge: true }
        );
      });

      return allocatedNumber;
    } catch (err) {
      console.warn('Firestore po_counters transaction fallback, attempting direct read/write:', err);
      try {
        const counterRef = doc(db, 'po_counters', fyString);
        const counterSnap = await getDoc(counterRef);
        let prefix = defaultPrefix;
        let nextSeq = maxExistingSeq + 1;

        if (counterSnap.exists()) {
          const data = counterSnap.data();
          if (data?.prefix) prefix = data.prefix;
          const lastSeq = Number(data?.lastSequence ?? data?.currentValue ?? 0);
          nextSeq = Math.max(lastSeq, maxExistingSeq) + 1;
        }

        const padded = String(nextSeq).padStart(4, '0');
        const allocatedNumber = `${prefix}/${padded}`;

        await setDoc(
          counterRef,
          {
            financialYear: fyString,
            prefix: prefix,
            lastSequence: nextSeq,
            updatedAt: Timestamp.now()
          },
          { merge: true }
        );

        return allocatedNumber;
      } catch (directErr) {
        console.warn('Direct counter update failed, generating fallback sequence:', directErr);
        const count = maxExistingSeq + 1;
        return `${defaultPrefix}/${String(count).padStart(4, '0')}`;
      }
    }
  }

  /**
   * Fetch paginated and filtered Purchase Orders
   */
  static async getPurchaseOrders(
    filters: POFilterOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
    isDemo: boolean = false
  ): Promise<{ pos: PurchaseOrder[]; pagination: POPagination }> {
    let allPos: PurchaseOrder[] = [];

    if (!isDemo) {
      try {
        const poQuery = query(
          collection(db, 'purchase_orders'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(poQuery);
        if (!snap.empty) {
          allPos = snap.docs.map((d) => normalizePODocument(d.id, d.data()));
          saveLocalDemoPOs(allPos);
        }
      } catch (err) {
        console.warn('Firestore getPurchaseOrders fallback to local store:', err);
      }
    }

    if (allPos.length === 0) {
      allPos = getLocalDemoPOs();
    }

    // Apply filtering
    let filtered = [...allPos];

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(q) ||
          po.customerName.toLowerCase().includes(q) ||
          (po.styleNo && po.styleNo.toLowerCase().includes(q)) ||
          (po.styleNumber && po.styleNumber.toLowerCase().includes(q)) ||
          (po.itemName && po.itemName.toLowerCase().includes(q))
      );
    }

    if (filters.customerId) {
      filtered = filtered.filter(
        (po) =>
          po.customerId === filters.customerId ||
          po.customerVendorId === filters.customerId
      );
    }

    if (filters.processCategory && filters.processCategory !== 'all') {
      filtered = filtered.filter(
        (po) =>
          po.processCategory.toLowerCase() ===
          filters.processCategory!.toLowerCase()
      );
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(
        (po) =>
          po.status.toLowerCase() === String(filters.status).toLowerCase()
      );
    }

    if (filters.startDate) {
      filtered = filtered.filter((po) => po.orderDate >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter((po) => po.orderDate <= filters.endDate!);
    }

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / pagination.pageSize) || 1;
    const currentPage = Math.min(Math.max(1, pagination.page), totalPages);
    const startIndex = (currentPage - 1) * pagination.pageSize;
    const paginatedPOs = filtered.slice(
      startIndex,
      startIndex + pagination.pageSize
    );

    return {
      pos: paginatedPOs,
      pagination: {
        page: currentPage,
        pageSize: pagination.pageSize,
        totalRecords,
        totalPages
      }
    };
  }

  /**
   * Fetch single Purchase Order with audit logs and amendments
   */
  static async getPurchaseOrderById(
    poId: string,
    isDemo: boolean = false
  ): Promise<{
    po: PurchaseOrder | null;
    logs: POAuditLog[];
    amendments: POAmendment[];
  }> {
    let po: PurchaseOrder | null = null;
    let logs: POAuditLog[] = [];
    let amendments: POAmendment[] = [];

    if (!isDemo) {
      try {
        const poSnap = await getDoc(doc(db, 'purchase_orders', poId));
        if (poSnap.exists()) {
          po = normalizePODocument(poSnap.id, poSnap.data());

          // Fetch audit logs
          const logSnap = await getDocs(
            query(
              collection(db, 'purchase_order_audit_logs'),
              where('poId', '==', poId)
            )
          );
          if (!logSnap.empty) {
            logs = logSnap.docs.map((d) => {
              const lData = d.data();
              return {
                auditId: d.id,
                ...lData,
                performedAt: timestampToString(lData.performedAt)
              } as POAuditLog;
            });
          }

          // Fetch amendments
          const amendSnap = await getDocs(
            query(
              collection(db, 'purchase_order_amendments'),
              where('poId', '==', poId)
            )
          );
          if (!amendSnap.empty) {
            amendments = amendSnap.docs.map((d) => {
              const aData = d.data();
              return {
                amendmentId: d.id,
                ...aData,
                requestedAt: timestampToString(aData.requestedAt),
                approvedAt: aData.approvedAt ? timestampToString(aData.approvedAt) : undefined
              } as POAmendment;
            });
          }
        }
      } catch (err) {
        console.warn('Firestore getPurchaseOrderById error:', err);
      }
    }

    if (!po) {
      const all = getLocalDemoPOs();
      po = all.find((p) => p.id === poId || p.poId === poId) || null;
      logs = localDemoAuditLogs[poId] || [];
      amendments = localDemoAmendments[poId] || [];
    }

    return { po, logs, amendments };
  }

  /**
   * Create Purchase Order with atomic PO Number and Audit Log
   */
  static async createPurchaseOrder(
    poData: Partial<PurchaseOrder>,
    customer: Vendor,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const now = new Date().toISOString();
    const poRef = doc(collection(db, 'purchase_orders'));
    const poId = poRef.id;

    const poStatus = poData.status || 'draft';
    let poNumber = 'PO/PENDING';
    if (poStatus === 'approved') {
      poNumber = (poData.poNumber && poData.poNumber !== 'PO/PENDING' && !poData.poNumber.includes('PENDING'))
        ? poData.poNumber
        : await this.generatePONumber(poData.orderDate);
    } else {
      poNumber = 'PO/PENDING';
    }

    // Process colour lines with line amounts
    const processedColourLines: POColourLine[] = (
      poData.colourLines ||
      poData.lines ||
      []
    ).map((line, idx) => {
      const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
      const amount = calculateLineAmount(line);
      return {
        ...line,
        id: lineId,
        lineId,
        colourName: line.colourName || '',
        processType: line.processType || 'Softener Wash',
        quantity: Number(line.quantity) || 0,
        unit: line.unit || 'piece',
        rateBasis: line.rateBasis || 'per_piece',
        rate: Number(line.rate) || 0,
        lineAmount: amount,
        amount
      } as POColourLine;
    });

    const totals = calculatePOTotals(processedColourLines);
    const styleNo = poData.styleNo || poData.styleNumber || 'STYLE-001';

    const newPO: PurchaseOrder = {
      id: poId,
      poId,
      poNumber,
      customerId: customer.vendorId || customer.id || '',
      customerVendorId: customer.vendorId || customer.id || '',
      customerCode: customer.vendorCode || '',
      customerName: customer.companyName,
      customerCompanyNameSnapshot: customer.companyName,
      subcontractorType: poData.subcontractorType || null,
      subcontractorId: poData.subcontractorId || null,
      subcontractorCode: poData.subcontractorCode || null,
      subcontractorName: poData.subcontractorName || null,
      subcompanyId: poData.subcompanyId || null,
      subcompanyCode: poData.subcompanyCode || null,
      subcompanyName: poData.subcompanyName || null,
      processCategory: poData.processCategory || 'washing',
      styleNo,
      styleNumber: styleNo,
      itemName: poData.itemName || "Men's Apparel",
      orderDate: poData.orderDate || now.split('T')[0],
      deliveryDate: poData.deliveryDate || null,
      expectedCompletionDate:
        poData.expectedCompletionDate || poData.deliveryDate || null,
      colourLines: processedColourLines,
      lines: processedColourLines,
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      currency: 'INR',
      customerReferenceNo: poData.customerReferenceNo || '',
      customerInstructions: poData.customerInstructions || '',
      internalRemarks: poData.internalRemarks || '',
      notes: poData.notes || null,
      status: poData.status || 'draft',
      revision: 1,
      createdBy: user.uid,
      createdById: user.uid,
      createdByName: user.displayName || 'Authorized User',
      createdAt: now,
      updatedBy: user.uid,
      updatedById: user.uid,
      updatedAt: now,
      schemaVersion: 1
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber,
      action: 'created',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${poNumber} created for customer '${customer.companyName}'. Initial status: ${newPO.status}.`
    };

    // Save to Firestore if connected
    try {
      await setDoc(poRef, cleanFirestoreData(newPO));
      console.log(`Successfully saved PO ${poNumber} to Firestore.`);
      try {
        const auditRef = doc(collection(db, 'purchase_order_audit_logs'));
        await setDoc(auditRef, cleanFirestoreData(auditEntry));
      } catch (auditErr) {
        console.warn('Could not write PO audit log:', auditErr);
      }
    } catch (err) {
      console.warn('Firestore PO create fallback to local demo store:', err);
    }

    // Save to local store
    const local = getLocalDemoPOs();
    saveLocalDemoPOs([newPO, ...local]);

    localDemoAuditLogs[poId] = [auditEntry];

    return newPO;
  }

  /**
   * Check whether any inward entries exist for a given PO
   */
  static async checkHasInward(
    poId: string,
    poNumber?: string,
    isDemo: boolean = false
  ): Promise<boolean> {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('perla_erp_inward_entries');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const found = list.some((inw: any) => {
              if (inw.status === 'reversed' || inw.status === 'cancelled') return false;
              const matchesId = inw.poId === poId;
              const matchesNum =
                poNumber &&
                (inw.poNumber === poNumber || inw.poNumberSnapshot === poNumber) &&
                !poNumber.includes('PENDING');
              return matchesId || matchesNum;
            });
            if (found) return true;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!isDemo) {
      try {
        const qId = query(collection(db, 'inward_entries'), where('poId', '==', poId));
        const snapId = await getDocs(qId);
        const hasActiveId = snapId.docs.some((d) => {
          const st = d.data().status;
          return st !== 'reversed' && st !== 'cancelled';
        });
        if (hasActiveId) return true;

        if (poNumber && !poNumber.includes('PENDING')) {
          const qNum = query(
            collection(db, 'inward_entries'),
            where('poNumber', '==', poNumber)
          );
          const snapNum = await getDocs(qNum);
          const hasActiveNum = snapNum.docs.some((d) => {
            const st = d.data().status;
            return st !== 'reversed' && st !== 'cancelled';
          });
          if (hasActiveNum) return true;
        }
      } catch (err) {
        console.warn('checkHasInward Firestore query fallback:', err);
      }
    }

    return false;
  }

  /**
   * Update draft Purchase Order (or approved/in-progress PO by Admin)
   */
  static async updatePurchaseOrder(
    poId: string,
    updates: Partial<PurchaseOrder>,
    user: { uid: string; displayName?: string; role?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) {
      throw new Error(`Purchase Order ${poId} not found.`);
    }

    const userRole = (user as any)?.role?.toLowerCase() || '';
    const isUserAdmin = userRole === 'admin' || (user as any)?.isAdmin === true;

    const hasInwardStatus =
      existing.po.status === 'partially_received' ||
      existing.po.status === 'fully_received' ||
      existing.po.status === 'in_progress' ||
      existing.po.status === 'completed';

    const hasInwardEntries = await this.checkHasInward(
      poId,
      existing.po.poNumber,
      isDemo
    );
    const hasInward = hasInwardStatus || hasInwardEntries;

    if (hasInward) {
      if (!isUserAdmin) {
        throw new Error(
          'This Purchase Order has inward entries and can only be edited by an Administrator.'
        );
      }
    } else {
      if (!isUserAdmin && existing.po.status !== 'draft' && existing.po.status !== 'Draft') {
        throw new Error(
          `Cannot edit Purchase Order in '${existing.po.status}' status. Only draft POs can be edited directly.`
        );
      }
    }

    const now = new Date().toISOString();

    let processedColourLines = existing.po.colourLines;
    if (updates.colourLines || updates.lines) {
      const rawLines = updates.colourLines || updates.lines || [];
      processedColourLines = rawLines.map((line, idx) => {
        const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
        const amount = calculateLineAmount(line);
        return {
          ...line,
          id: lineId,
          lineId,
          colourName: line.colourName || '',
          colourCode: line.colourCode || null,
          colourId: line.colourId || null,
          processType: line.processType || 'Softener Wash',
          quantity: Number(line.quantity) || 0,
          unit: line.unit || 'piece',
          rateBasis: line.rateBasis || 'per_piece',
          rate: Number(line.rate) || 0,
          lineAmount: amount,
          amount
        } as POColourLine;
      });
    }

    const totals = calculatePOTotals(processedColourLines);
    const styleNo =
      updates.styleNo ||
      updates.styleNumber ||
      existing.po.styleNo ||
      existing.po.styleNumber ||
      '';

    const merged: PurchaseOrder = {
      ...existing.po,
      ...updates,
      styleNo,
      styleNumber: styleNo,
      colourLines: processedColourLines,
      lines: processedColourLines,
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    if (hasInward) {
      if (!updates.status || updates.status === 'draft') {
        merged.status = existing.po.status;
      }
    }

    // Protect immutable fields or upgrade pending PO number when status is approved
    let poNumber = existing.po.poNumber;
    if (merged.status === 'draft') {
      if (!existing.po.approvedAt || !poNumber || poNumber.includes('PENDING')) {
        poNumber = 'PO/PENDING';
      }
    } else if (merged.status === 'approved') {
      if (!poNumber || poNumber === 'PO/PENDING' || poNumber.includes('PENDING')) {
        poNumber = await this.generatePONumber(merged.orderDate);
      }
    }
    merged.poNumber = poNumber;
    merged.createdAt = existing.po.createdAt;
    merged.createdBy = existing.po.createdBy;

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: merged.poNumber,
      action: 'updated',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Draft Purchase Order ${merged.poNumber} updated.`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), cleanFirestoreData(merged) as any);
      try {
        const auditRef = doc(collection(db, 'purchase_order_audit_logs'));
        await setDoc(auditRef, cleanFirestoreData(auditEntry));
      } catch (auditErr) {
        console.warn('Could not write PO update audit log:', auditErr);
      }
    } catch (err) {
      console.warn('Firestore updatePurchaseOrder fallback:', err);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? merged : p
    );
    saveLocalDemoPOs(local);

    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return merged;
  }

  /**
   * Submit Purchase Order for approval (draft -> submitted)
   */
  static async submitPurchaseOrder(
    poId: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...existing.po,
      status: 'submitted',
      submittedBy: user.uid,
      submittedById: user.uid,
      submittedAt: now,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: updated.poNumber,
      action: 'submitted',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${updated.poNumber} submitted for authorization.`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: 'submitted',
        submittedBy: user.uid,
        submittedById: user.uid,
        submittedAt: now,
        updatedAt: now,
        updatedBy: user.uid,
        updatedById: user.uid
      });
      await setDoc(
        doc(collection(db, 'purchase_order_audit_logs')),
        auditEntry
      );
    } catch (e) {
      console.warn('Firestore submit PO fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? updated : p
    );
    saveLocalDemoPOs(local);
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return updated;
  }

  /**
   * Approve Purchase Order (submitted/draft -> approved)
   * If the PO currently has 'PO/PENDING' (or no sequential number), generates an official sequence number.
   */
  static async approvePurchaseOrder(
    poId: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    const now = new Date().toISOString();

    // If PO currently has 'PO/PENDING' (or no sequence number), generate official sequential PO number
    let allocatedPONumber = existing.po.poNumber;
    if (!allocatedPONumber || allocatedPONumber === 'PO/PENDING' || allocatedPONumber.includes('PENDING')) {
      allocatedPONumber = await this.generatePONumber(existing.po.orderDate);
    }

    const updated: PurchaseOrder = {
      ...existing.po,
      poNumber: allocatedPONumber,
      status: 'approved',
      approvedBy: user.uid,
      approvedById: user.uid,
      approvedAt: now,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: allocatedPONumber,
      action: 'approved',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${allocatedPONumber} approved. Order is open for Inward receipts.`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        poNumber: allocatedPONumber,
        status: 'approved',
        approvedBy: user.uid,
        approvedById: user.uid,
        approvedAt: now,
        updatedAt: now,
        updatedBy: user.uid,
        updatedById: user.uid
      });
      try {
        const auditRef = doc(collection(db, 'purchase_order_audit_logs'));
        await setDoc(auditRef, cleanFirestoreData(auditEntry));
      } catch (auditErr) {
        console.warn('Could not write PO approve audit log:', auditErr);
      }
    } catch (e) {
      console.warn('Firestore approve PO fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? updated : p
    );
    saveLocalDemoPOs(local);
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return updated;
  }

  /**
   * Revoke/Cancel Approval of Purchase Order (approved -> draft, Admin only)
   */
  static async revokeApprovalPurchaseOrder(
    poId: string,
    reason: string = 'Approval cancelled by Admin',
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...existing.po,
      status: 'draft',
      approvedBy: undefined,
      approvedById: undefined,
      approvedAt: undefined,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: updated.poNumber,
      action: 'approval_revoked',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Approval cancelled for Purchase Order ${updated.poNumber}. Reason: ${reason || 'Cancelled by Admin'}. Status returned to draft.`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: 'draft',
        approvedBy: null,
        approvedById: null,
        approvedAt: null,
        updatedAt: now,
        updatedBy: user.uid,
        updatedById: user.uid
      });
      try {
        const auditRef = doc(collection(db, 'purchase_order_audit_logs'));
        await setDoc(auditRef, cleanFirestoreData(auditEntry));
      } catch (auditErr) {
        console.warn('Could not write PO revoke approval audit log:', auditErr);
      }
    } catch (e) {
      console.warn('Firestore revoke approval fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? updated : p
    );
    saveLocalDemoPOs(local);
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return updated;
  }

  /**
   * Reject Purchase Order with reason (moves to cancelled, Admin only)
   */
  static async rejectPurchaseOrder(
    poId: string,
    reason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...existing.po,
      status: 'cancelled',
      rejectedBy: user.uid,
      rejectedById: user.uid,
      rejectedAt: now,
      rejectionReason: reason,
      cancelledBy: user.uid,
      cancelledById: user.uid,
      cancelledAt: now,
      cancellationReason: `Rejected by Admin: ${reason}`,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: updated.poNumber,
      action: 'rejected',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${updated.poNumber} rejected by Admin. Reason: ${reason}`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: 'cancelled',
        rejectedBy: user.uid,
        rejectedById: user.uid,
        rejectedAt: now,
        rejectionReason: reason,
        cancelledBy: user.uid,
        cancelledById: user.uid,
        cancelledAt: now,
        cancellationReason: `Rejected by Admin: ${reason}`,
        updatedAt: now,
        updatedBy: user.uid,
        updatedById: user.uid
      });
      await setDoc(
        doc(collection(db, 'purchase_order_audit_logs')),
        auditEntry
      );
    } catch (e) {
      console.warn('Firestore reject PO fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? updated : p
    );
    saveLocalDemoPOs(local);
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return updated;
  }

  /**
   * Cancel Purchase Order with reason and validation check
   */
  static async cancelPurchaseOrder(
    poId: string,
    reason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    // Operational transactions check
    const hasInwardStatus =
      existing.po.status === 'partially_received' ||
      existing.po.status === 'fully_received' ||
      existing.po.status === 'in_progress' ||
      existing.po.status === 'completed';

    const hasInward = hasInwardStatus || (await this.checkHasInward(poId, existing.po.poNumber, isDemo));
    if (hasInward) {
      throw new Error(
        'Cannot cancel Purchase Order: Inward receipts already exist for this PO. Use operational closure instead.'
      );
    }

    const now = new Date().toISOString();
    const updated: PurchaseOrder = {
      ...existing.po,
      status: 'cancelled',
      cancelledBy: user.uid,
      cancelledById: user.uid,
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: updated.poNumber,
      action: 'cancelled',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${updated.poNumber} cancelled. Reason: ${reason}`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), {
        status: 'cancelled',
        cancelledBy: user.uid,
        cancelledById: user.uid,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now,
        updatedBy: user.uid,
        updatedById: user.uid
      });
      await setDoc(
        doc(collection(db, 'purchase_order_audit_logs')),
        auditEntry
      );
    } catch (e) {
      console.warn('Firestore cancel PO fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? updated : p
    );
    saveLocalDemoPOs(local);
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return updated;
  }

  /**
   * Delete Purchase Order permanently (Admin only)
   */
  static async deletePurchaseOrder(
    poId: string,
    user: { uid: string; displayName?: string; role?: string },
    isDemo: boolean = false
  ): Promise<void> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    const po = existing?.po;
    const poNumber = po?.poNumber || poId;

    // RULE: If inward has been entered for this PO, it CANNOT be deleted
    const hasInwardStatus =
      po?.status === 'partially_received' ||
      po?.status === 'fully_received' ||
      po?.status === 'in_progress' ||
      po?.status === 'completed';

    const hasInwardEntries = await this.checkHasInward(poId, po?.poNumber, isDemo);

    if (hasInwardStatus || hasInwardEntries) {
      throw new Error(
        `Cannot delete Purchase Order ${poNumber}: Inward receipts have already been entered for this PO.`
      );
    }

    try {
      await deleteDoc(doc(db, 'purchase_orders', poId));
      try {
        const auditEntry: POAuditLog = {
          auditId: `audit_${Date.now()}`,
          poId,
          poNumber,
          action: 'cancelled',
          performedBy: user.uid,
          performedByName: user.displayName || 'Admin',
          performedAt: new Date().toISOString(),
          summary: `Purchase Order ${poNumber} was permanently deleted by Admin.`
        };
        await setDoc(
          doc(collection(db, 'purchase_order_audit_logs')),
          cleanFirestoreData(auditEntry)
        );
      } catch (auditErr) {
        console.warn('Could not write PO delete audit log:', auditErr);
      }
    } catch (e) {
      console.warn('Firestore delete PO fallback:', e);
    }

    const local = getLocalDemoPOs().filter((p) => p.id !== poId && p.poId !== poId);
    saveLocalDemoPOs(local);
  }

  /**
   * Amend an approved Purchase Order (creates versioned snapshot)
   */
  static async amendPurchaseOrder(
    poId: string,
    newValues: Partial<PurchaseOrder>,
    reason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<PurchaseOrder> {
    const existing = await this.getPurchaseOrderById(poId, isDemo);
    if (!existing.po) throw new Error('PO not found');

    const now = new Date().toISOString();
    const nextRevision = (existing.po.revision || 1) + 1;

    let processedColourLines = existing.po.colourLines;
    if (newValues.colourLines || newValues.lines) {
      const rawLines = newValues.colourLines || newValues.lines || [];
      processedColourLines = rawLines.map((line, idx) => {
        const lineId = line.id || line.lineId || `pol_${Date.now()}_${idx}`;
        const amount = calculateLineAmount(line);
        return {
          ...line,
          id: lineId,
          lineId,
          colourName: line.colourName || '',
          processType: line.processType || 'Softener Wash',
          quantity: Number(line.quantity) || 0,
          unit: line.unit || 'piece',
          rateBasis: line.rateBasis || 'per_piece',
          rate: Number(line.rate) || 0,
          lineAmount: amount,
          amount
        } as POColourLine;
      });
    }

    const totals = calculatePOTotals(processedColourLines);

    const amendedPO: PurchaseOrder = {
      ...existing.po,
      ...newValues,
      colourLines: processedColourLines,
      lines: processedColourLines,
      totalQtyByUnit: totals.totalQtyByUnit,
      totalQuantity: totals.totalQuantity,
      totalAmount: totals.totalAmount,
      revision: nextRevision,
      updatedAt: now,
      updatedBy: user.uid,
      updatedById: user.uid
    };

    const amendmentRecord: POAmendment = {
      amendmentId: `amend_${Date.now()}`,
      poId,
      poNumber: existing.po.poNumber,
      amendmentNumber: nextRevision,
      previousSnapshot: existing.po,
      newValues,
      reason,
      requestedBy: user.uid,
      requestedByName: user.displayName || 'Authorized User',
      requestedAt: now,
      approvedBy: user.uid,
      approvedAt: now,
      status: 'approved'
    };

    const auditEntry: POAuditLog = {
      auditId: `audit_${Date.now()}`,
      poId,
      poNumber: existing.po.poNumber,
      action: 'amended',
      performedBy: user.uid,
      performedByName: user.displayName || 'Authorized User',
      performedAt: now,
      summary: `Purchase Order ${existing.po.poNumber} amended to Revision ${nextRevision}. Reason: ${reason}`
    };

    try {
      await updateDoc(doc(db, 'purchase_orders', poId), amendedPO as any);
      await setDoc(
        doc(collection(db, 'purchase_order_amendments')),
        amendmentRecord
      );
      await setDoc(
        doc(collection(db, 'purchase_order_audit_logs')),
        auditEntry
      );
    } catch (e) {
      console.warn('Firestore amend PO fallback:', e);
    }

    const local = getLocalDemoPOs().map((p) =>
      p.id === poId || p.poId === poId ? amendedPO : p
    );
    saveLocalDemoPOs(local);

    localDemoAmendments[poId] = [
      ...(localDemoAmendments[poId] || []),
      amendmentRecord
    ];
    localDemoAuditLogs[poId] = [
      ...(localDemoAuditLogs[poId] || []),
      auditEntry
    ];

    return amendedPO;
  }

  /**
   * Calculate dashboard metrics
   */
  static async getDashboardMetrics(
    isDemo: boolean = false
  ): Promise<PODashboardMetrics> {
    const { pos } = await this.getPurchaseOrders(
      {},
      { page: 1, pageSize: 1000 },
      isDemo
    );

    let draftPOs = 0;
    let approvedPOs = 0;
    let cancelledPOs = 0;
    let totalPieces = 0;
    let totalKg = 0;
    let totalOrderValue = 0;

    for (const po of pos) {
      const statusLower = po.status.toLowerCase();
      if (statusLower === 'approved') approvedPOs++;
      else if (statusLower === 'cancelled' || statusLower === 'rejected') cancelledPOs++;
      else draftPOs++; // draft, submitted, and any other states categorized as Draft

      const pcs = po.totalQtyByUnit?.piece || 0;
      const kgs = po.totalQtyByUnit?.kg || 0;
      totalPieces += pcs;
      totalKg += kgs;
      totalOrderValue += po.totalAmount || 0;
    }

    return {
      totalPOs: pos.length,
      draftPOs,
      approvedPOs,
      cancelledPOs,
      totalPieces,
      totalKg,
      totalOrderValue: Math.round(totalOrderValue * 100) / 100
    };
  }
}
