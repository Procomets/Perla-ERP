import { StatementService } from './statementService';
import { InvoiceService } from './invoiceService';
import type { PurchaseOrder } from '../types/po';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface POLockStatus {
  isLocked: boolean; // true if the entire PO cannot be edited (i.e. all lines invoiced)
  isFullyLocked: boolean; // true if all colour lines have been invoiced completely
  reason: string;
  status?: 'approved' | 'invoiced';
  invoiceNo?: string;
  approvalDate?: string;
  totalLines: number;
  approvedLinesCount: number;
  invoicedLinesCount: number;
  lockedLineIds: string[]; // invoiced line IDs
  lockedColourNames: string[]; // invoiced colour names
  invoicedLineIds: string[];
  invoicedColourNames: string[];
  approvedLineIds: string[];
  approvedColourNames: string[];
}

export class POLockService {
  private static cachedMap: Record<string, POLockStatus> | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_TTL_MS = 15000; // 15 seconds TTL
  private static listenerInitialized: boolean = false;

  private static initListeners(): void {
    if (this.listenerInitialized || typeof window === 'undefined') return;
    this.listenerInitialized = true;
    window.addEventListener('perla:approvals-updated', () => {
      POLockService.clearCache();
    });
    window.addEventListener('perla:invoices-updated', () => {
      POLockService.clearCache();
    });
  }

  static clearCache(): void {
    this.cachedMap = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Builds an index of all PO IDs and PO numbers with their line-level and
   * whole-PO lock statuses based on Statement approvals and generated Invoices.
   */
  static async getLockedPOMap(
    isDemo: boolean = false,
    forceRefresh: boolean = false,
    preloadedPOs?: PurchaseOrder[]
  ): Promise<Record<string, POLockStatus>> {
    this.initListeners();

    const now = Date.now();
    if (!forceRefresh && this.cachedMap && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.cachedMap;
    }

    const lockMap: Record<string, POLockStatus> = {};

    try {
      // 1. Fetch Statement approvals and Invoices concurrently
      const [approvals, invResult] = await Promise.all([
        StatementService.getInvoiceApprovals(undefined, isDemo).catch((e) => {
          console.warn('Failed to load invoice approvals in POLockService:', e);
          return [];
        }),
        InvoiceService.getInvoices({}, { page: 1, pageSize: 1000 }, isDemo).catch((e) => {
          console.warn('Failed to load invoices in POLockService:', e);
          return { invoices: [], totalCount: 0 };
        })
      ]);

      // 2. Fetch or obtain POs to know total colour lines per PO
      let posToUse: PurchaseOrder[] = preloadedPOs || [];
      if (!posToUse || posToUse.length === 0) {
        if (!isDemo) {
          try {
            const snap = await getDocs(collection(db, 'purchase_orders'));
            posToUse = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
          } catch (e) {
            console.warn('Failed to fetch purchase orders in POLockService:', e);
          }
        }
        if ((!posToUse || posToUse.length === 0) && typeof localStorage !== 'undefined') {
          try {
            const raw = localStorage.getItem('perla_erp_purchase_orders');
            if (raw) posToUse = JSON.parse(raw);
          } catch (e) {
            // ignore
          }
        }
      }

      // Map PO records for fast lookup
      const poLookup: Record<string, PurchaseOrder> = {};
      for (const po of posToUse) {
        if (po.id) poLookup[po.id] = po;
        if (po.poId) poLookup[po.poId] = po;
        if (po.poNumber) {
          poLookup[po.poNumber] = po;
          poLookup[po.poNumber.trim().toLowerCase()] = po;
        }
      }

      // Temporary aggregator per PO
      interface AggregatedPOLock {
        po?: PurchaseOrder;
        poId?: string;
        poNumber?: string;
        lockedLineIds: Set<string>;
        lockedColourNames: Set<string>;
        invoicedLineIds: Set<string>;
        invoicedColourNames: Set<string>;
        approvedLineIds: Set<string>;
        approvedColourNames: Set<string>;
        hasInvoiced: boolean;
        hasFinalizedPO: boolean;
        latestInvoiceNo?: string;
        latestApprovalDate?: string;
      }

      const aggMap: Map<string, AggregatedPOLock> = new Map();

      const getOrCreateAgg = (poId?: string, poNum?: string): AggregatedPOLock => {
        const key = poId || poNum || 'unknown';
        let existing = aggMap.get(key);
        if (!existing && poId && aggMap.has(poId)) existing = aggMap.get(poId);
        if (!existing && poNum && aggMap.has(poNum)) existing = aggMap.get(poNum);
        if (!existing && poNum && aggMap.has(poNum.trim().toLowerCase())) {
          existing = aggMap.get(poNum.trim().toLowerCase());
        }

        if (existing) {
          return existing;
        }

        let po: PurchaseOrder | undefined;
        if (poId && poLookup[poId]) {
          po = poLookup[poId];
        } else if (poNum) {
          po = poLookup[poNum] || poLookup[poNum.trim().toLowerCase()];
        }

        const newAgg: AggregatedPOLock = {
          po,
          poId: po?.id || poId,
          poNumber: po?.poNumber || poNum,
          lockedLineIds: new Set<string>(),
          lockedColourNames: new Set<string>(),
          invoicedLineIds: new Set<string>(),
          invoicedColourNames: new Set<string>,
          approvedLineIds: new Set<string>(),
          approvedColourNames: new Set<string>(),
          hasInvoiced: false,
          hasFinalizedPO: false
        };

        if (poId) aggMap.set(poId, newAgg);
        if (poNum) {
          aggMap.set(poNum, newAgg);
          aggMap.set(poNum.trim().toLowerCase(), newAgg);
        }
        if (po?.id) aggMap.set(po.id, newAgg);
        if (po?.poNumber) {
          aggMap.set(po.poNumber, newAgg);
          aggMap.set(po.poNumber.trim().toLowerCase(), newAgg);
        }

        return newAgg;
      };

      // 3. Process Statement approvals
      for (const app of approvals) {
        if (app.status === 'approved' || app.status === 'invoiced') {
          const agg = getOrCreateAgg(app.purchaseOrderId, app.poNumber);
          if (app.poColourLineId) {
            agg.approvedLineIds.add(app.poColourLineId);
          }
          if (app.colourName) {
            agg.approvedColourNames.add(app.colourName.trim().toLowerCase());
          }
          if (app.status === 'invoiced') {
            agg.hasInvoiced = true;
            if (app.poColourLineId) {
              agg.invoicedLineIds.add(app.poColourLineId);
              agg.lockedLineIds.add(app.poColourLineId);
            }
            if (app.colourName) {
              agg.invoicedColourNames.add(app.colourName.trim().toLowerCase());
              agg.lockedColourNames.add(app.colourName.trim().toLowerCase());
            }
            if (app.invoiceNo) agg.latestInvoiceNo = app.invoiceNo;
          }
          if ((app as any).isFinalizedPO === true) {
            agg.hasFinalizedPO = true;
          }
          if (app.approvedAt) agg.latestApprovalDate = app.approvedAt;
        }
      }

      // 4. Process Invoices
      const invoices = invResult.invoices || [];
      for (const inv of invoices) {
        if (inv.status !== 'cancelled' && (inv as any).status !== 'Cancelled') {
          if (inv.lines && Array.isArray(inv.lines) && inv.lines.length > 0) {
            for (const l of inv.lines) {
              const pid = l.purchaseOrderId || inv.purchaseOrderIds?.[0];
              const pnum = l.poNumber || inv.poNumber || inv.poNumbers?.[0];
              const agg = getOrCreateAgg(pid, pnum);
              if (l.sourcePoLineId) {
                agg.invoicedLineIds.add(l.sourcePoLineId);
                agg.lockedLineIds.add(l.sourcePoLineId);
              }
              if (l.lineId) {
                agg.invoicedLineIds.add(l.lineId);
                agg.lockedLineIds.add(l.lineId);
              }
              const cName = (l.colour || (l as any).colourSnapshot || '').trim().toLowerCase();
              if (cName) {
                agg.invoicedColourNames.add(cName);
                agg.lockedColourNames.add(cName);
              }
              agg.hasInvoiced = true;
              if (inv.invoiceNo) agg.latestInvoiceNo = inv.invoiceNo;
              if (inv.invoiceDate) agg.latestApprovalDate = inv.invoiceDate;
            }
          } else {
            const pids = inv.purchaseOrderIds || ((inv as any).purchaseOrderId ? [(inv as any).purchaseOrderId] : []);
            const pnums = inv.poNumbers || (inv.poNumber ? [inv.poNumber] : []);
            for (const pid of pids) {
              const agg = getOrCreateAgg(pid, undefined);
              agg.hasInvoiced = true;
              if (inv.invoiceNo) agg.latestInvoiceNo = inv.invoiceNo;
              if (inv.invoiceDate) agg.latestApprovalDate = inv.invoiceDate;
            }
            for (const pnum of pnums) {
              const agg = getOrCreateAgg(undefined, pnum);
              agg.hasInvoiced = true;
              if (inv.invoiceNo) agg.latestInvoiceNo = inv.invoiceNo;
              if (inv.invoiceDate) agg.latestApprovalDate = inv.invoiceDate;
            }
          }
        }
      }

      // 5. Finalize status for each unique aggregated PO
      const processedAggs = new Set<AggregatedPOLock>();
      for (const agg of aggMap.values()) {
        if (processedAggs.has(agg)) continue;
        processedAggs.add(agg);

        const po = agg.po;
        const poLines: any[] = po ? po.colourLines || (po as any).lines || [] : [];
        const totalLines = poLines.length;

        // Calculate count of invoiced colour lines
        let invoicedLinesCount = 0;
        let approvedLinesCount = 0;
        if (totalLines > 0) {
          invoicedLinesCount = poLines.filter((l) => {
            const lid = l.id || l.lineId;
            const cName = (l.colourName || l.colour || '').trim().toLowerCase();
            return (
              (lid && agg.invoicedLineIds.has(lid)) ||
              (cName && agg.invoicedColourNames.has(cName))
            );
          }).length;

          approvedLinesCount = poLines.filter((l) => {
            const lid = l.id || l.lineId;
            const cName = (l.colourName || l.colour || '').trim().toLowerCase();
            return (
              (lid && (agg.approvedLineIds.has(lid) || agg.invoicedLineIds.has(lid))) ||
              (cName && (agg.approvedColourNames.has(cName) || agg.invoicedColourNames.has(cName)))
            );
          }).length;
        } else {
          invoicedLinesCount = Math.max(
            agg.invoicedLineIds.size,
            agg.invoicedColourNames.size,
            agg.hasInvoiced ? 1 : 0
          );
          approvedLinesCount = Math.max(
            agg.approvedLineIds.size,
            agg.approvedColourNames.size,
            invoicedLinesCount
          );
        }

        // A PO is locked ONLY when explicitly finalized (mid-PO / partial invoices keep PO editable)
        const isExplicitlyFinalized =
          Boolean((po as any)?.isFinalized === true) ||
          po?.status === 'Completed' ||
          (po?.status as string) === 'completed' ||
          (po?.status as string) === 'closed' ||
          agg.hasFinalizedPO;
        const isFullyLocked = isExplicitlyFinalized;
        const statusType: 'approved' | 'invoiced' = agg.hasInvoiced ? 'invoiced' : 'approved';

        let reason = '';
        if (isFullyLocked) {
          reason = `Purchase Order has been finalized (${agg.latestInvoiceNo || 'Finalized'}). PO entry cannot be edited.`;
        } else if (invoicedLinesCount > 0) {
          reason = `${invoicedLinesCount} of ${totalLines} colour line(s) have mid-PO invoices (${agg.latestInvoiceNo || 'Billed'}). PO remains editable until finalized.`;
        } else if (approvedLinesCount > 0) {
          reason = `${approvedLinesCount} of ${totalLines} colour line(s) moved to invoice generation. PO remains editable until finalized.`;
        }

        const status: POLockStatus = {
          isLocked: isFullyLocked,
          isFullyLocked,
          reason,
          status: statusType,
          invoiceNo: agg.latestInvoiceNo,
          approvalDate: agg.latestApprovalDate,
          totalLines,
          approvedLinesCount,
          invoicedLinesCount,
          lockedLineIds: Array.from(agg.invoicedLineIds),
          lockedColourNames: Array.from(agg.invoicedColourNames),
          invoicedLineIds: Array.from(agg.invoicedLineIds),
          invoicedColourNames: Array.from(agg.invoicedColourNames),
          approvedLineIds: Array.from(agg.approvedLineIds),
          approvedColourNames: Array.from(agg.approvedColourNames)
        };

        if (agg.poId) lockMap[agg.poId] = status;
        if (agg.poNumber) {
          lockMap[agg.poNumber] = status;
          lockMap[agg.poNumber.trim().toLowerCase()] = status;
        }
        if (po?.id) lockMap[po.id] = status;
        if (po?.poNumber) {
          lockMap[po.poNumber] = status;
          lockMap[po.poNumber.trim().toLowerCase()] = status;
        }
      }
    } catch (e) {
      console.warn('Failed to build locked PO map in POLockService:', e);
    }

    this.cachedMap = lockMap;
    this.cacheTimestamp = now;
    return lockMap;
  }

  /**
   * Helper function to check if a PO, Inward, or Outward record is locked.
   * Returns non-null ONLY if the record is fully locked.
   */
  static isLocked(
    target: {
      poId?: string;
      id?: string;
      poNumber?: string;
      poNumberSnapshot?: string;
    } | null | undefined,
    lockedMap?: Record<string, POLockStatus>
  ): POLockStatus | null {
    if (!target || !lockedMap) return null;

    const keys = [
      target.poId,
      target.id,
      target.poNumber,
      target.poNumberSnapshot,
      target.poNumber?.trim().toLowerCase(),
      target.poNumberSnapshot?.trim().toLowerCase()
    ].filter(Boolean) as string[];

    for (const k of keys) {
      const entry = lockedMap[k];
      if (entry && (entry.isFullyLocked || entry.isLocked)) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Returns the POLockStatus entry (whether partially or fully locked)
   */
  static getPOStatus(
    target: {
      poId?: string;
      id?: string;
      poNumber?: string;
      poNumberSnapshot?: string;
    } | null | undefined,
    lockedMap?: Record<string, POLockStatus>
  ): POLockStatus | null {
    if (!target || !lockedMap) return null;

    const keys = [
      target.poId,
      target.id,
      target.poNumber,
      target.poNumberSnapshot,
      target.poNumber?.trim().toLowerCase(),
      target.poNumberSnapshot?.trim().toLowerCase()
    ].filter(Boolean) as string[];

    for (const k of keys) {
      if (lockedMap[k]) {
        return lockedMap[k];
      }
    }
    return null;
  }

  /**
   * Helper to check if a specific colour line in a PO is locked because
   * it has been invoiced completely.
   */
  static isLineLocked(
    po: {
      poId?: string;
      id?: string;
      poNumber?: string;
      poNumberSnapshot?: string;
    } | null | undefined,
    line: {
      id?: string;
      lineId?: string;
      colourName?: string;
      colour?: string;
    } | null | undefined,
    lockedMap?: Record<string, POLockStatus>
  ): boolean {
    if (!po || !line || !lockedMap) return false;
    const poStatus = this.getPOStatus(po, lockedMap);
    if (!poStatus) return false;
    // Only lock lines when the PO itself has been finalized
    return Boolean(poStatus.isFullyLocked);
  }

  /**
   * Helper to check if a specific colour line has been approved / moved to invoice generation.
   */
  static isLineApproved(
    po: {
      poId?: string;
      id?: string;
      poNumber?: string;
      poNumberSnapshot?: string;
    } | null | undefined,
    line: {
      id?: string;
      lineId?: string;
      colourName?: string;
      colour?: string;
    } | null | undefined,
    lockedMap?: Record<string, POLockStatus>
  ): boolean {
    if (!po || !line || !lockedMap) return false;
    const poStatus = this.getPOStatus(po, lockedMap);
    if (!poStatus) return false;

    const lineId = line.id || line.lineId;
    if (lineId && poStatus.approvedLineIds && poStatus.approvedLineIds.includes(lineId)) {
      return true;
    }

    const colourName = (line.colourName || line.colour || '').trim().toLowerCase();
    if (colourName && poStatus.approvedColourNames && poStatus.approvedColourNames.includes(colourName)) {
      return true;
    }

    return false;
  }
}
