import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  StatementFilterParams,
  StatementInwardRow,
  StatementOutwardRow,
  StatementColourLineDetail,
  StatementUnitTotal,
  StatementDataResponse,
  InvoiceApprovalRecord,
  InvoiceHistoryItem
} from '../types/statement';
import { PurchaseOrder } from '../types/po';
import { Vendor } from '../types/vendor';
import { InwardEntry } from '../types/inward';
import { OutwardEntry } from '../types/outward';
import { Invoice } from '../types/invoice';
import { VendorService } from './vendorService';
import { POService } from './poService';
import { InwardService } from './inwardService';
import { OutwardService } from './outwardService';

const APPROVALS_STORAGE_KEY = 'perla_invoice_approvals';

function getLocalApprovals(): InvoiceApprovalRecord[] {
  try {
    const raw = localStorage.getItem(APPROVALS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local approvals:', e);
  }
  return [];
}

function saveLocalApprovals(approvals: InvoiceApprovalRecord[]): void {
  try {
    localStorage.setItem(APPROVALS_STORAGE_KEY, JSON.stringify(approvals));
  } catch (e) {
    console.warn('Failed to save local approvals:', e);
  }
}

export class StatementService {
  /**
   * Fetches filter options: companies, and if company selected, its styles, items, and POs
   */
  static async getFilterOptions(companyId?: string, isDemo: boolean = false): Promise<{
    companies: Vendor[];
    styles: string[];
    items: string[];
    purchaseOrders: { id: string; poNumber: string; styleNo: string; itemName: string }[];
  }> {
    // 1. Load companies that are customer or both
    const vendorResult = await VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemo);
    const companies = (vendorResult.vendors || []).filter(
      (v) => v.vendorType === 'customer' || v.vendorType === 'both' || (v as any).roles?.includes('Customer')
    ).sort((a, b) => a.companyName.localeCompare(b.companyName));

    if (!companyId) {
      return { companies, styles: [], items: [], purchaseOrders: [] };
    }

    // 2. Load POs for this company
    const poResult = await POService.getPurchaseOrders(
      {},
      { page: 1, pageSize: 1000 },
      isDemo
    );
    const targetComp = companies.find((c) => c.id === companyId || c.vendorId === companyId);
    const targetName = (targetComp?.companyName || '').toLowerCase();
    const companyPos = (poResult.pos || []).filter(
      (p) =>
        p.customerId === companyId ||
        p.customerVendorId === companyId ||
        (targetComp?.vendorId && (p.customerId === targetComp.vendorId || p.customerVendorId === targetComp.vendorId)) ||
        (targetComp?.id && (p.customerId === targetComp.id || p.customerVendorId === targetComp.id)) ||
        (targetName && (p.customerName || p.customerCompanyNameSnapshot || '').toLowerCase() === targetName)
    );

    const styleSet = new Set<string>();
    const itemSet = new Set<string>();
    const purchaseOrders: { id: string; poNumber: string; styleNo: string; itemName: string }[] = [];

    companyPos.forEach((po) => {
      if (po.styleNo || po.styleNumber) styleSet.add(po.styleNo || po.styleNumber || '');
      if (po.itemName) itemSet.add(po.itemName);
      purchaseOrders.push({
        id: po.id,
        poNumber: po.poNumber,
        styleNo: po.styleNo || po.styleNumber || '',
        itemName: po.itemName || 'Garments'
      });
    });

    return {
      companies,
      styles: Array.from(styleSet).filter(Boolean).sort(),
      items: Array.from(itemSet).filter(Boolean).sort(),
      purchaseOrders
    };
  }

  /**
   * Queries authoritative live Inward and Outward entries to build dual-section Statement data
   */
  static async getStatementData(
    filters: StatementFilterParams,
    isDemo: boolean = false
  ): Promise<StatementDataResponse> {
    if (!filters.companyId) {
      throw new Error('Please select a Customer Company to generate statement.');
    }

    // 1. Resolve Company Details
    const companyRes = await VendorService.getVendorById(filters.companyId, isDemo);
    const companyName = companyRes?.vendor?.companyName || 'Selected Customer';

    // 2. Load all eligible Purchase Orders for this company & filters
    const poRes = await POService.getPurchaseOrders({}, { page: 1, pageSize: 1000 }, isDemo);
    let matchedPOs = (poRes.pos || []).filter((p) => {
      const matchComp =
        p.customerId === filters.companyId ||
        p.customerVendorId === filters.companyId ||
        (companyRes?.vendor?.vendorId && (p.customerId === companyRes.vendor.vendorId || p.customerVendorId === companyRes.vendor.vendorId)) ||
        (companyRes?.vendor?.id && (p.customerId === companyRes.vendor.id || p.customerVendorId === companyRes.vendor.id)) ||
        (p.customerName && p.customerName.toLowerCase() === companyName.toLowerCase()) ||
        (p.customerCompanyNameSnapshot && p.customerCompanyNameSnapshot.toLowerCase() === companyName.toLowerCase());
      if (!matchComp) return false;

      if (filters.styleNo && filters.styleNo !== 'all') {
        const poStyle = (p.styleNo || p.styleNumber || '').trim().toLowerCase();
        if (poStyle !== filters.styleNo.trim().toLowerCase()) return false;
      }

      if (filters.itemName && filters.itemName !== 'all') {
        const poItem = (p.itemName || '').trim().toLowerCase();
        if (poItem !== filters.itemName.trim().toLowerCase()) return false;
      }

      if (filters.poId && filters.poId !== 'all') {
        if (p.id !== filters.poId && p.poId !== filters.poId && p.poNumber !== filters.poNumber) return false;
      }

      return true;
    });

    const poIds = new Set(matchedPOs.map((p) => p.id).concat(matchedPOs.map((p) => p.poId || '')));
    const poNumbers = new Set(matchedPOs.map((p) => p.poNumber?.trim().toLowerCase()).filter(Boolean));

    // 3. Load all posted Inward Entries
    const inwRes = await InwardService.getInwardEntries({ status: 'posted' }, { page: 1, pageSize: 1000 }, isDemo);
    const postedInwards = (inwRes.inwards || []).filter((inw) => {
      if (inw.status !== 'posted') return false;
      const inwPoId = inw.poId;
      const inwPoNum = (inw.poNumberSnapshot || inw.poNumber || '').trim().toLowerCase();
      return (inwPoId && poIds.has(inwPoId)) || (inwPoNum && poNumbers.has(inwPoNum));
    });

    // 4. Load all posted Outward Entries
    const outRes = await OutwardService.getOutwardEntries({ status: 'posted' }, { page: 1, pageSize: 1000 }, isDemo);
    const postedOutwards = (outRes.outwards || []).filter((outw) => {
      if (outw.status !== 'posted') return false;
      const outPoId = outw.poId;
      const outPoNum = (outw.poNumberSnapshot || outw.poNumber || '').trim().toLowerCase();
      return (outPoId && poIds.has(outPoId)) || (outPoNum && poNumbers.has(outPoNum));
    });

    // 5. Load Existing Invoice Approvals
    const approvals = await this.getInvoiceApprovals(filters.companyId, isDemo);
    const approvalMap = new Map<string, InvoiceApprovalRecord>();
    approvals.forEach((app) => {
      if (app.poColourLineId) {
        approvalMap.set(app.poColourLineId, app);
      }
      if (app.purchaseOrderId && app.colourName) {
        approvalMap.set(`${app.purchaseOrderId}:::${app.colourName.trim().toLowerCase()}`, app);
      }
      if (app.poNumber && app.colourName) {
        approvalMap.set(`${app.poNumber.trim().toLowerCase()}:::${app.colourName.trim().toLowerCase()}`, app);
      }
    });

    // 6. Build Left Side (INWARD Rows)
    const inwardRows: StatementInwardRow[] = [];
    postedInwards.forEach((inEntry) => {
      const inwDate = inEntry.customerDate || inEntry.inwardDate || '';
      const dcNo = inEntry.customerDcNo || inEntry.inwardNo;

      if (inEntry.lines && inEntry.lines.length > 0) {
        inEntry.lines.forEach((l) => {
          inwardRows.push({
            id: `${inEntry.id}_${l.inwardLineId || l.poLineId}`,
            inwardId: inEntry.inwardId || inEntry.id,
            inwardNo: inEntry.inwardNo,
            date: inwDate,
            dcNo,
            poId: inEntry.poId,
            poLineId: l.poLineId,
            colour: l.colourNameSnapshot || l.colour || 'Standard',
            qtyReceived: Number(l.receivedQty) || 0,
            unit: l.unit || 'piece',
            status: inEntry.status
          });
        });
      } else {
        // Fallback for single document entry
        inwardRows.push({
          id: inEntry.id,
          inwardId: inEntry.inwardId || inEntry.id,
          inwardNo: inEntry.inwardNo,
          date: inwDate,
          dcNo,
          poId: inEntry.poId,
          poLineId: 'default',
          colour: 'All Colours',
          qtyReceived: Number(inEntry.totalQuantity) || inEntry.totalQtyByUnit?.piece || 0,
          unit: inEntry.totalQtyByUnit?.kg ? 'kg' : 'piece',
          status: inEntry.status
        });
      }
    });

    // Sort Inward chronologically (oldest first)
    inwardRows.sort((a, b) => a.date.localeCompare(b.date));

    // 7. Build Right Side (OUTWARD Rows)
    const outwardRows: StatementOutwardRow[] = [];
    postedOutwards.forEach((outEntry) => {
      const outDate = outEntry.outwardDate || (outEntry as any).ourDate || outEntry.createdAt || '';
      const dcNo = outEntry.ourDcNo || outEntry.outwardNo;

      if (outEntry.lines && outEntry.lines.length > 0) {
        outEntry.lines.forEach((l) => {
          outwardRows.push({
            id: `${outEntry.id}_${l.outwardLineId || l.poLineId}`,
            outwardId: outEntry.outwardId || outEntry.id,
            outwardNo: outEntry.outwardNo,
            date: outDate,
            dcNo,
            poId: outEntry.poId,
            poLineId: l.poLineId,
            colour: l.colourNameSnapshot || l.colour || 'Standard',
            qtyDispatched: Number(l.dispatchQty) || 0,
            unit: l.unit || 'piece',
            status: outEntry.status
          });
        });
      } else {
        outwardRows.push({
          id: outEntry.id,
          outwardId: outEntry.outwardId || outEntry.id,
          outwardNo: outEntry.outwardNo,
          date: outDate,
          dcNo,
          poId: outEntry.poId,
          poLineId: 'default',
          colour: 'All Colours',
          qtyDispatched: Number(outEntry.totalQuantity) || outEntry.totalQtyByUnit?.piece || 0,
          unit: outEntry.totalQtyByUnit?.kg ? 'kg' : 'piece',
          status: outEntry.status
        });
      }
    });

    // Sort Outward chronologically (oldest first)
    outwardRows.sort((a, b) => a.date.localeCompare(b.date));

    // 8. Build Colour-Wise Reconciliation Ledger
    const colourLines: StatementColourLineDetail[] = [];

    matchedPOs.forEach((po) => {
      const rawLines = po.colourLines || po.lines || [];
      rawLines.forEach((line) => {
        const lineId = line.id || line.lineId;
        const lineColourName = line.colourName || (line as any).colour || 'Standard';

        // Calculate cumulative inward for this colour line
        let cumulativeInward = 0;
        inwardRows.forEach((inRow) => {
          if (
            inRow.poLineId === lineId ||
            (inRow.poId === po.id && inRow.colour.toLowerCase() === lineColourName.toLowerCase())
          ) {
            cumulativeInward += inRow.qtyReceived;
          }
        });

        // Calculate cumulative outward for this colour line
        let cumulativeOutward = 0;
        outwardRows.forEach((outRow) => {
          if (
            outRow.poLineId === lineId ||
            (outRow.poId === po.id && outRow.colour.toLowerCase() === lineColourName.toLowerCase())
          ) {
            cumulativeOutward += outRow.qtyDispatched;
          }
        });

        const balanceQty = cumulativeInward - cumulativeOutward;
        const approvalRecord =
          approvalMap.get(lineId) ||
          approvalMap.get(`${po.id}:::${lineColourName.trim().toLowerCase()}`) ||
          approvalMap.get(`${(po.poNumber || '').trim().toLowerCase()}:::${lineColourName.trim().toLowerCase()}`);
        const isApprovedForInvoice = Boolean(approvalRecord && approvalRecord.status === 'approved');
        const isInvoiced = Boolean(approvalRecord && approvalRecord.status === 'invoiced');

        // Invoice Eligibility Rule:
        // cumulativeInward > 0 AND cumulativeInward === cumulativeOutward AND not already approved or invoiced
        const isReadyForInvoice =
          cumulativeInward > 0 &&
          cumulativeInward === cumulativeOutward &&
          !isApprovedForInvoice &&
          !isInvoiced;

        colourLines.push({
          poId: po.id,
          poNumber: po.poNumber,
          styleNo: po.styleNo || po.styleNumber || 'N/A',
          itemName: po.itemName || 'Garments',
          poLineId: lineId,
          colour: lineColourName,
          colourCode: line.colourCode || null,
          processType: line.processType || 'Standard Process',
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
          approvalId: approvalRecord?.approvalId,
          approvedAt: approvalRecord?.approvedAt,
          invoiceId: approvalRecord?.invoiceId,
          invoiceNo: approvalRecord?.invoiceNo
        });
      });
    });

    // 9. Calculate Unit-Wise Bottom Summaries (Strict separation of piece and kg)
    let pieceOrdered = 0;
    let kgOrdered = 0;
    matchedPOs.forEach((po) => {
      const rawLines = po.colourLines || po.lines || [];
      rawLines.forEach((l) => {
        const u = l.unit || 'piece';
        const q = Number(l.quantity) || 0;
        if (u === 'kg') kgOrdered += q;
        else pieceOrdered += q;
      });
    });

    let pieceInward = 0;
    let pieceOutward = 0;
    let kgInward = 0;
    let kgOutward = 0;

    inwardRows.forEach((r) => {
      if (r.unit === 'kg') kgInward += r.qtyReceived;
      else pieceInward += r.qtyReceived;
    });

    outwardRows.forEach((r) => {
      if (r.unit === 'kg') kgOutward += r.qtyDispatched;
      else pieceOutward += r.qtyDispatched;
    });

    const unitTotals: StatementUnitTotal[] = [];
    if (pieceOrdered > 0 || pieceInward > 0 || pieceOutward > 0 || colourLines.some((c) => c.unit === 'piece')) {
      unitTotals.push({
        unit: 'piece',
        totalOrdered: pieceOrdered,
        totalInward: pieceInward,
        orderVsInwardDiff: pieceOrdered - pieceInward,
        totalOutward: pieceOutward,
        balance: pieceInward - pieceOutward
      });
    }

    if (kgOrdered > 0 || kgInward > 0 || kgOutward > 0 || colourLines.some((c) => c.unit === 'kg')) {
      unitTotals.push({
        unit: 'kg',
        totalOrdered: Math.round(kgOrdered * 100) / 100,
        totalInward: Math.round(kgInward * 100) / 100,
        orderVsInwardDiff: Math.round((kgOrdered - kgInward) * 100) / 100,
        totalOutward: Math.round(kgOutward * 100) / 100,
        balance: Math.round((kgInward - kgOutward) * 100) / 100
      });
    }

    // Default to piece summary if everything is empty
    if (unitTotals.length === 0) {
      unitTotals.push({
        unit: 'piece',
        totalOrdered: 0,
        totalInward: 0,
        orderVsInwardDiff: 0,
        totalOutward: 0,
        balance: 0
      });
    }

    return {
      companyId: filters.companyId,
      companyName,
      styleNo: filters.styleNo,
      itemName: filters.itemName,
      poId: filters.poId,
      poNumber: filters.poNumber,
      inwards: inwardRows,
      outwards: outwardRows,
      colourLines,
      unitTotals,
      hasTransactions: inwardRows.length > 0 || outwardRows.length > 0
    };
  }

  /**
   * Approves an eligible colour line for invoicing (Explicit action with re-validation)
   */
  static async approveStatementLineForInvoice(
    params: {
      poId: string;
      poLineId: string;
      companyId: string;
    },
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<InvoiceApprovalRecord> {
    // 1. Fetch current authoritative Statement data to re-validate eligibility
    const statement = await this.getStatementData({ companyId: params.companyId, poId: params.poId }, isDemo);
    const line = statement.colourLines.find((l) => l.poLineId === params.poLineId);

    if (!line) {
      throw new Error(`Colour line with ID ${params.poLineId} was not found on Purchase Order.`);
    }

    if (line.isInvoiced) {
      throw new Error(`This colour line is already invoiced (Invoice: ${line.invoiceNo || 'Billed'}).`);
    }

    if (line.isApprovedForInvoice) {
      throw new Error('This colour line has already been approved for invoice.');
    }

    // Direct check against existing approvals to guard against concurrent clicks
    const existingApprovals = await this.getInvoiceApprovals(params.companyId, isDemo);
    const alreadyApproved = existingApprovals.find(
      (a) =>
        a.poColourLineId === params.poLineId ||
        (a.purchaseOrderId === line.poId && a.colourName?.toLowerCase() === line.colour?.toLowerCase()) ||
        (a.poNumber === line.poNumber && a.colourName?.toLowerCase() === line.colour?.toLowerCase())
    );
    if (alreadyApproved) {
      if (alreadyApproved.status === 'invoiced') {
        throw new Error(`This colour line is already invoiced (Invoice: ${alreadyApproved.invoiceNo || 'Billed'}).`);
      }
      throw new Error('This colour line has already been approved for invoice.');
    }

    if (line.cumulativeInward <= 0) {
      throw new Error('Cannot approve for invoice: No inward receipts recorded.');
    }

    if (line.cumulativeInward !== line.cumulativeOutward) {
      throw new Error(
        `Cannot approve for invoice: Quantities do not match! Received: ${line.cumulativeInward} ${line.unit}, Dispatched: ${line.cumulativeOutward} ${line.unit}.`
      );
    }

    const now = new Date().toISOString();
    // Deterministic approval ID based on PO and colour line to prevent duplicate document creation
    const approvalId = `appr_${line.poId}_${params.poLineId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    const approvalRecord: InvoiceApprovalRecord = {
      approvalId,
      companyId: params.companyId,
      companyName: statement.companyName,
      purchaseOrderId: line.poId,
      poNumber: line.poNumber,
      styleNo: line.styleNo,
      itemName: line.itemName,
      poColourLineId: line.poLineId,
      colourName: line.colour,
      unit: line.unit,
      rate: line.rate,
      approvedQuantity: line.cumulativeOutward,
      totalInwardAtApproval: line.cumulativeInward,
      totalOutwardAtApproval: line.cumulativeOutward,
      status: 'approved',
      approvedBy: user.uid,
      approvedByName: user.displayName || 'Authorized User',
      approvedAt: now,
      createdAt: now,
      updatedAt: now
    };

    if (!isDemo) {
      try {
        const docRef = doc(db, 'invoice_approvals', approvalId);
        await setDoc(docRef, approvalRecord, { merge: true });
      } catch (err) {
        console.warn('Firestore write to invoice_approvals failed, storing locally:', err);
      }
    }

    // Persist locally, removing any stale record for this line
    const current = getLocalApprovals().filter(
      (a) =>
        a.approvalId !== approvalId &&
        a.poColourLineId !== params.poLineId &&
        !(a.purchaseOrderId === line.poId && a.colourName?.toLowerCase() === line.colour?.toLowerCase())
    );
    current.push(approvalRecord);
    saveLocalApprovals(current);

    return approvalRecord;
  }

  /**
   * Approves all eligible colour lines for an entire Purchase Order.
   * Note: Any colour lines that have ALREADY been moved to invoice generation
   * (or already invoiced) are skipped and NOT re-stored or duplicated.
   */
  static async approveEntirePOForInvoice(
    params: {
      poId: string;
      companyId: string;
    },
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<{ approvedRecords: InvoiceApprovalRecord[]; skippedLineCount: number }> {
    const statement = await this.getStatementData({ companyId: params.companyId, poId: params.poId }, isDemo);
    const poLines = statement.colourLines.filter(
      (l) => l.poId === params.poId || l.poNumber === params.poId
    );

    if (poLines.length === 0) {
      throw new Error('No colour lines found for this Purchase Order.');
    }

    // Filter to only lines that are strictly ready for invoice and not already approved or invoiced
    const eligibleLines = poLines.filter(
      (l) => l.isReadyForInvoice && !l.isApprovedForInvoice && !l.isInvoiced
    );

    if (eligibleLines.length === 0) {
      const alreadyMoved = poLines.filter((l) => l.isApprovedForInvoice || l.isInvoiced);
      if (alreadyMoved.length > 0) {
        throw new Error('All eligible colour lines for this PO have already been approved and moved to Invoice module.');
      }
      throw new Error(
        'No colour lines in this PO meet invoice eligibility criteria (inward received must strictly match outward dispatched).'
      );
    }

    const approvedRecords: InvoiceApprovalRecord[] = [];
    for (const line of eligibleLines) {
      const rec = await this.approveStatementLineForInvoice(
        {
          poId: line.poId,
          poLineId: line.poLineId,
          companyId: params.companyId
        },
        user,
        isDemo
      );
      approvedRecords.push(rec);
    }

    const skippedLineCount = poLines.length - eligibleLines.length;
    return { approvedRecords, skippedLineCount };
  }

  /**
   * Retrieves all Invoice Approvals from Firestore / LocalStorage
   */
  static async getInvoiceApprovals(companyId?: string, isDemo: boolean = false): Promise<InvoiceApprovalRecord[]> {
    let list: InvoiceApprovalRecord[] = [];

    if (!isDemo) {
      try {
        // Query without composite orderBy to eliminate index requirement failures in Firestore
        const q = companyId
          ? query(collection(db, 'invoice_approvals'), where('companyId', '==', companyId))
          : collection(db, 'invoice_approvals');
        const snap = await getDocs(q);
        // Always trust Firestore (even if empty = all records deleted).
        // Overwrite local storage cache so stale deleted approvals are removed.
        list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as InvoiceApprovalRecord));
        saveLocalApprovals(list);
      } catch (e) {
        console.warn('Firestore getInvoiceApprovals error:', e);
        list = getLocalApprovals();
      }
    } else {
      list = getLocalApprovals();
    }

    // Sort chronologically descending in memory
    list.sort((a, b) => (b.approvedAt || b.createdAt || '').localeCompare(a.approvedAt || a.createdAt || ''));

    // Deduplicate approvals by PO Colour Line to guarantee no duplicate entries
    const dedupedMap = new Map<string, InvoiceApprovalRecord>();
    for (const app of list) {
      const lineKey =
        app.poColourLineId ||
        (app.purchaseOrderId && app.colourName
          ? `${app.purchaseOrderId}:::${app.colourName.trim().toLowerCase()}`
          : app.approvalId);

      const existing = dedupedMap.get(lineKey);
      if (!existing) {
        dedupedMap.set(lineKey, app);
      } else {
        // If an approval is already 'invoiced', that takes precedence over 'approved'
        if (app.status === 'invoiced' && existing.status !== 'invoiced') {
          dedupedMap.set(lineKey, app);
        }
      }
    }

    const uniqueList = Array.from(dedupedMap.values());

    if (companyId) {
      return uniqueList.filter((a) => a.companyId === companyId);
    }
    return uniqueList;
  }

  /**
   * Returns list of approved PO Line IDs for checking in Invoice module
   */
  static async getApprovedPoLineIds(isDemo: boolean = false): Promise<string[]> {
    const approvals = await this.getInvoiceApprovals(undefined, isDemo);
    return approvals
      .filter((a) => a.status === 'approved' || a.status === 'invoiced')
      .map((a) => a.poColourLineId);
  }

  /**
   * Batch marks multiple approval records as invoiced in a single atomic batch
   */
  static async markApprovalsBatch(
    items: { poLineId?: string; approvalId?: string }[],
    invoiceId: string,
    invoiceNo: string,
    invoiceDate: string,
    isDemo: boolean = false
  ): Promise<void> {
    const list = getLocalApprovals();
    const poLineIds = new Set(items.map((i) => i.poLineId).filter(Boolean));
    const approvalIds = new Set(items.map((i) => i.approvalId).filter(Boolean));

    const updated = list.map((app) => {
      if (
        (app.poColourLineId && poLineIds.has(app.poColourLineId)) ||
        (app.approvalId && approvalIds.has(app.approvalId)) ||
        (app.approvalId && items.some((i) => i.poLineId && app.approvalId.includes(i.poLineId)))
      ) {
        return {
          ...app,
          status: 'invoiced' as const,
          invoiceId,
          invoiceNo,
          invoiceDate,
          updatedAt: new Date().toISOString()
        };
      }
      return app;
    });
    saveLocalApprovals(updated);

    if (!isDemo) {
      try {
        const batch = writeBatch(db);
        const docIdsToUpdate = new Set<string>();

        // Include any directly known approval IDs
        for (const id of approvalIds) {
          if (id) docIdsToUpdate.add(id);
        }

        // Query by poColourLineId in parallel for any missing doc IDs
        const missingLineIds = Array.from(poLineIds);
        if (missingLineIds.length > 0) {
          await Promise.all(
            missingLineIds.map(async (lineId) => {
              try {
                const q = query(collection(db, 'invoice_approvals'), where('poColourLineId', '==', lineId));
                const snap = await getDocs(q);
                snap.docs.forEach((d) => docIdsToUpdate.add(d.id));
              } catch (e) {
                console.warn('Error querying approvals for lineId:', lineId, e);
              }
            })
          );
        }

        for (const docId of docIdsToUpdate) {
          const docRef = doc(db, 'invoice_approvals', docId);
          batch.update(docRef, {
            status: 'invoiced',
            invoiceId,
            invoiceNo,
            invoiceDate,
            updatedAt: Timestamp.now()
          });
        }

        await batch.commit();
      } catch (err) {
        console.warn('Firestore batch markApprovalsBatch error:', err);
      }
    }
  }

  /**
   * Marks an approval record as invoiced when an invoice is created in Invoice Module
   */
  static async markApprovalAsInvoiced(
    poLineId: string,
    invoiceId: string,
    invoiceNo: string,
    invoiceDate: string,
    isDemo: boolean = false
  ): Promise<void> {
    return this.markApprovalsBatch([{ poLineId }], invoiceId, invoiceNo, invoiceDate, isDemo);
  }

  /**
   * Retrieves Invoice History (Grouped previously invoiced colour lines)
   */
  static async getInvoiceHistory(companyId?: string, isDemo: boolean = false): Promise<InvoiceHistoryItem[]> {
    const approvals = await this.getInvoiceApprovals(companyId, isDemo);
    const invoicedRecords = approvals.filter((a) => a.status === 'invoiced' || a.invoiceId);

    return invoicedRecords.map((rec) => ({
      approvalId: rec.approvalId,
      invoiceId: rec.invoiceId,
      invoiceNo: rec.invoiceNo || 'INV-FINALIZED',
      invoiceDate: rec.invoiceDate || rec.updatedAt.split('T')[0],
      companyId: rec.companyId,
      companyName: rec.companyName,
      poId: rec.purchaseOrderId,
      poNumber: rec.poNumber,
      styleNo: rec.styleNo,
      itemName: rec.itemName,
      colour: rec.colourName,
      quantity: rec.approvedQuantity,
      unit: rec.unit,
      rate: rec.rate || 0,
      amount: (rec.approvedQuantity || 0) * (rec.rate || 0),
      status: 'Invoiced',
      approvedAt: rec.approvedAt,
      approvedByName: rec.approvedByName
    }));
  }

  /**
   * Generates CSV string for Export Statement
   */
  static exportStatementToCsv(data: StatementDataResponse): string {
    const lines: string[] = [];

    // Header block
    lines.push(`PERLA TEXTILES PROCESSOR — RECONCILIATION STATEMENT`);
    lines.push(`Company Name:,"${data.companyName}"`);
    lines.push(`Style No:,"${data.styleNo || 'All Styles'}"`);
    lines.push(`Item Name:,"${data.itemName || 'All Items'}"`);
    lines.push(`PO Number:,"${data.poNumber || 'All POs'}"`);
    lines.push(`Generated On:,"${new Date().toLocaleString()}"`);
    lines.push('');

    // Colour-wise Summary Table
    lines.push('--- COLOUR-WISE RECONCILIATION SUMMARY ---');
    lines.push('PO Number,Style No,Item Name,Colour,Process,Ordered Qty,Unit,Rate (INR),Total Inward,Total Outward,Balance Qty,Invoice Status');
    data.colourLines.forEach((c) => {
      const statusStr = c.isInvoiced ? 'Invoiced' : c.isApprovedForInvoice ? 'Approved for Invoice' : c.isReadyForInvoice ? 'Ready for Invoice' : 'In Progress';
      lines.push(
        `"${c.poNumber}","${c.styleNo}","${c.itemName}","${c.colour}","${c.processType}",${c.orderedQty},"${c.unit}",${c.rate},${c.cumulativeInward},${c.cumulativeOutward},${c.balanceQty},"${statusStr}"`
      );
    });
    lines.push('');

    // Bottom Unit Totals
    lines.push('--- UNIT-WISE TOTALS ---');
    lines.push('Unit,Total Received (Inward),Total Dispatched (Outward),Remaining Balance');
    data.unitTotals.forEach((u) => {
      lines.push(`"${u.unit.toUpperCase()}",${u.totalInward},${u.totalOutward},${u.balance}`);
    });
    lines.push('');

    // Detailed Side-by-Side Transactions Table
    lines.push('--- TRANSACTION DETAILS (INWARD vs OUTWARD) ---');
    lines.push('INWARD Date,INWARD DC No,INWARD Colour,INWARD Qty,INWARD Unit, ,OUTWARD Date,OUTWARD DC No,OUTWARD Colour,OUTWARD Qty,OUTWARD Unit');

    const maxRows = Math.max(data.inwards.length, data.outwards.length);
    for (let i = 0; i < maxRows; i++) {
      const inRow = data.inwards[i];
      const outRow = data.outwards[i];

      const inDate = inRow ? inRow.date : '';
      const inDc = inRow ? inRow.dcNo : '';
      const inCol = inRow ? inRow.colour : '';
      const inQty = inRow ? inRow.qtyReceived : '';
      const inUnit = inRow ? inRow.unit : '';

      const outDate = outRow ? outRow.date : '';
      const outDc = outRow ? outRow.dcNo : '';
      const outCol = outRow ? outRow.colour : '';
      const outQty = outRow ? outRow.qtyDispatched : '';
      const outUnit = outRow ? outRow.unit : '';

      lines.push(`"${inDate}","${inDc}","${inCol}",${inQty},"${inUnit}",|,"${outDate}","${outDc}","${outCol}",${outQty},"${outUnit}"`);
    }

    return lines.join('\n');
  }
}
