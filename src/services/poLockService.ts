import { StatementService } from './statementService';
import { InvoiceService } from './invoiceService';

export interface POLockStatus {
  isLocked: boolean;
  reason: string;
  status?: 'approved' | 'invoiced';
  invoiceNo?: string;
  approvalDate?: string;
}

export class POLockService {
  /**
   * Builds an index of all PO IDs and PO numbers that are locked because their
   * statement has been approved or moved to invoice.
   */
  static async getLockedPOMap(isDemo: boolean = false): Promise<Record<string, POLockStatus>> {
    const lockMap: Record<string, POLockStatus> = {};

    try {
      // 1. Approvals from Statement module
      const approvals = await StatementService.getInvoiceApprovals(undefined, isDemo);
      for (const app of approvals) {
        if (app.status === 'approved' || app.status === 'invoiced') {
          const reason =
            app.status === 'invoiced'
              ? `Statement has been invoiced (${app.invoiceNo || 'Billed'}). Editing and deleting are disabled.`
              : 'Statement has been approved for invoicing. Editing and deleting are disabled.';

          const status: POLockStatus = {
            isLocked: true,
            reason,
            status: app.status,
            invoiceNo: app.invoiceNo,
            approvalDate: app.approvedAt
          };

          if (app.purchaseOrderId) {
            lockMap[app.purchaseOrderId] = status;
          }
          if (app.poNumber) {
            lockMap[app.poNumber] = status;
            lockMap[app.poNumber.trim().toLowerCase()] = status;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load invoice approvals in POLockService:', e);
    }

    try {
      // 2. Invoices from Invoice module
      const invResult = await InvoiceService.getInvoices({}, { page: 1, pageSize: 1000 }, isDemo);
      const invoices = invResult.invoices || [];
      for (const inv of invoices) {
        if (inv.status !== 'cancelled' && (inv as any).status !== 'Cancelled') {
          const reason = `Invoice ${inv.invoiceNo} has been generated. Editing and deleting are disabled.`;
          const status: POLockStatus = {
            isLocked: true,
            reason,
            status: 'invoiced',
            invoiceNo: inv.invoiceNo,
            approvalDate: inv.invoiceDate
          };

          if (inv.poNumber) {
            lockMap[inv.poNumber] = status;
            lockMap[inv.poNumber.trim().toLowerCase()] = status;
          }
          if (inv.poNumbers && Array.isArray(inv.poNumbers)) {
            for (const pn of inv.poNumbers) {
              if (pn) {
                lockMap[pn] = status;
                lockMap[pn.trim().toLowerCase()] = status;
              }
            }
          }
          if (inv.purchaseOrderIds && Array.isArray(inv.purchaseOrderIds)) {
            for (const pid of inv.purchaseOrderIds) {
              if (pid) lockMap[pid] = status;
            }
          }
          if (inv.lines && Array.isArray(inv.lines)) {
            for (const l of inv.lines) {
              if (l.purchaseOrderId) lockMap[l.purchaseOrderId] = status;
              if (l.poNumber) {
                lockMap[l.poNumber] = status;
                lockMap[l.poNumber.trim().toLowerCase()] = status;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load invoices in POLockService:', e);
    }

    return lockMap;
  }

  /**
   * Helper function to check if a PO, Inward, or Outward record is locked
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
      if (lockedMap[k]?.isLocked) {
        return lockedMap[k];
      }
    }
    return null;
  }
}
