import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Invoice,
  InvoiceLine,
  InvoiceEligibleItem,
  InvoiceFilterOptions,
  InvoiceMetrics,
  InvoiceAuditLog,
  RateBasis
} from '../types/invoice';
import { InvoiceApprovalRecord } from '../types/statement';
import { StatementService } from './statementService';
import { VendorService } from './vendorService';
import { POService } from './poService';
import { InvoiceSettingsService } from './invoiceSettingsService';
import { formatCurrency } from '../utils/formatters';
import {
  calculateLineAmount,
  calculateInvoiceTaxes,
  convertNumberToIndianWords,
  getFinancialYear,
  isIntraStateSupply,
  safeRound
} from '../utils/taxCalculations';

const INVOICES_STORAGE_KEY = 'perla_invoices_data';
const INVOICE_AUDIT_STORAGE_KEY = 'perla_invoice_audit_logs';

const memoryStore: Record<string, string> = {};

function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

function safeSetStorage(key: string, value: string): void {
  memoryStore[key] = value;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

function getLocalInvoices(): Invoice[] {
  try {
    const raw = safeGetStorage(INVOICES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local invoices:', e);
  }
  return [];
}

function saveLocalInvoices(invoices: Invoice[]): void {
  try {
    safeSetStorage(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch (e) {
    console.warn('Failed to save local invoices:', e);
  }
}

function getLocalAuditLogs(): InvoiceAuditLog[] {
  try {
    const raw = safeGetStorage(INVOICE_AUDIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to parse local invoice audit logs:', e);
  }
  return [];
}

function saveLocalAuditLog(log: InvoiceAuditLog): void {
  try {
    const current = getLocalAuditLogs();
    current.unshift(log);
    safeSetStorage(INVOICE_AUDIT_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Failed to save audit log locally:', e);
  }
}

export class InvoiceService {
  /**
   * Retrieves all Statement colour lines approved for invoicing that have not yet been invoiced
   */
  static async getInvoiceEligibleItems(
    filters?: { companyId?: string; poNumber?: string; styleNo?: string },
    isDemo: boolean = false
  ): Promise<InvoiceEligibleItem[]> {
    // 1. Fetch approvals from Statement module and POs in parallel
    const [approvals, poResult] = await Promise.all([
      StatementService.getInvoiceApprovals(filters?.companyId, isDemo),
      POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, isDemo)
    ]);

    // Filter to only approved lines (not yet invoiced)
    const approvedLines = approvals.filter(
      (a) => a.status === 'approved' && (!a.invoiceId || a.invoiceId.trim() === '')
    );

    if (approvedLines.length === 0) {
      return [];
    }

    const pos = poResult.pos || [];

    // 2. Map into InvoiceEligibleItem with strict deduplication
    const eligible: InvoiceEligibleItem[] = [];
    const seenLineKeys = new Set<string>();

    for (const app of approvedLines) {
      const lineKey = `${app.purchaseOrderId || app.poNumber}:::${(app.colourName || '').trim().toLowerCase()}`;
      if (seenLineKeys.has(lineKey) || (app.poColourLineId && seenLineKeys.has(app.poColourLineId))) {
        continue;
      }
      seenLineKeys.add(lineKey);
      if (app.poColourLineId) seenLineKeys.add(app.poColourLineId);

      const po = pos.find((p) => p.id === app.purchaseOrderId || p.poNumber === app.poNumber);
      const poLine = po?.lines?.find((l) => l.lineId === app.poColourLineId);

      const rateBasis: RateBasis =
        (poLine as any)?.rateBasis || (app as any).rateBasis || ((po as any)?.rateBasis as RateBasis) || 'per_piece';
      const washType = (poLine as any)?.processType || (po as any)?.processType || 'Standard Wash';
      const processCategory = (po as any)?.processCategory || 'washing';

      const rate = app.rate || poLine?.rate || 0;
      const approvedQuantity = app.approvedQuantity || 0;
      const previouslyInvoicedQty = 0; // Fresh approved lines
      const remainingApprovedQty = approvedQuantity;

      const estimatedTaxableAmount = calculateLineAmount(
        remainingApprovedQty,
        rate,
        rateBasis,
        (app as any).billableWeightKg
      );

      // Apply optional secondary filters
      if (filters?.poNumber && app.poNumber.toLowerCase() !== filters.poNumber.toLowerCase()) {
        continue;
      }
      if (filters?.styleNo && app.styleNo.toLowerCase() !== filters.styleNo.toLowerCase()) {
        continue;
      }

      eligible.push({
        approvalId: app.approvalId,
        poLineId: app.poColourLineId,
        companyId: app.companyId,
        companyName: app.companyName,
        poId: app.purchaseOrderId,
        poNumber: app.poNumber,
        styleNo: app.styleNo,
        itemName: app.itemName,
        colour: app.colourName,
        processCategory,
        washType,
        approvedQuantity,
        previouslyInvoicedQty,
        remainingApprovedQty,
        unit: app.unit || 'piece',
        rate,
        rateBasis,
        billableWeightKg: (app as any).billableWeightKg,
        estimatedTaxableAmount,
        approvedAt: app.approvedAt,
        approvedByName: app.approvedByName,
        approvalStatus: app.status
      });
    }

    return eligible;
  }

  /**
   * Creates an unfinalized Invoice Draft from selected approved colour line items
   * Supports passing pre-fetched eligible items to eliminate redundant queries
   */
  static async createInvoiceDraft(
    selectedApprovalIds: string[],
    user: { uid: string; displayName?: string },
    isDemo: boolean = false,
    preloadedItems?: InvoiceEligibleItem[]
  ): Promise<Invoice> {
    if (!selectedApprovalIds || selectedApprovalIds.length === 0) {
      throw new Error('Please select at least one approved colour line item to generate an invoice.');
    }

    // 1. Fetch or use preloaded eligible items
    let selectedItems: InvoiceEligibleItem[] = [];
    if (preloadedItems && preloadedItems.length > 0) {
      selectedItems = preloadedItems.filter((item) => selectedApprovalIds.includes(item.approvalId));
    }
    if (selectedItems.length === 0) {
      const allEligible = await this.getInvoiceEligibleItems(undefined, isDemo);
      selectedItems = allEligible.filter((item) => selectedApprovalIds.includes(item.approvalId));
    }

    if (selectedItems.length === 0) {
      throw new Error('None of the selected items were found or they are no longer eligible for invoicing.');
    }

    // 2. Validate single customer consistency
    const companyId = selectedItems[0].companyId;
    const isSingleCompany = selectedItems.every((item) => item.companyId === companyId);
    if (!isSingleCompany) {
      throw new Error('All selected colour lines must belong to the same customer/company.');
    }

    // 3. Load Customer details & settings in parallel
    const [vendorsResult, settings] = await Promise.all([
      VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemo),
      InvoiceSettingsService.getSettings(isDemo)
    ]);

    const customer = vendorsResult.vendors?.find((v) => v.id === companyId || v.vendorId === companyId);

    const customerAddress =
      typeof customer?.address === 'object'
        ? `${customer.address.addressLine1 || ''} ${customer.address.addressLine2 || ''}`.trim()
        : customer?.address || 'Registered Address';

    const customerCity =
      typeof customer?.address === 'object' ? customer.address.city || '' : (customer as any)?.city || 'Chennai';
    const customerState =
      typeof customer?.address === 'object'
        ? customer.address.state || 'Tamil Nadu'
        : (customer as any)?.state || 'Tamil Nadu';
    const customerStateCode =
      typeof customer?.address === 'object'
        ? customer.address.gstStateCode || '33'
        : (customer as any)?.stateCode || '33';
    const customerGstin = customer?.taxDetails?.gstin || (customer as any)?.gstin || '33AAACA1234A1Z5';
    const customerPan = customer?.taxDetails?.pan || (customer as any)?.pan || '';

    // 5. Determine Intra-State vs Inter-State supply
    const isIntraState = isIntraStateSupply(customerStateCode, customerState, settings.stateCode);

    // 6. Build Invoice Lines
    let subtotal = 0;
    const lines: InvoiceLine[] = selectedItems.map((item, idx) => {
      const lineTaxable = calculateLineAmount(
        item.remainingApprovedQty,
        item.rate,
        item.rateBasis,
        item.billableWeightKg
      );
      subtotal = safeRound(subtotal + lineTaxable, 2);

      let cgstRate = 0;
      let cgstAmount = 0;
      let sgstRate = 0;
      let sgstAmount = 0;
      let igstRate = 0;
      let igstAmount = 0;

      if (isIntraState) {
        cgstRate = settings.defaultCgstRate;
        sgstRate = settings.defaultSgstRate;
        cgstAmount = safeRound(lineTaxable * (cgstRate / 100), 2);
        sgstAmount = safeRound(lineTaxable * (sgstRate / 100), 2);
      } else {
        igstRate = settings.defaultIgstRate;
        igstAmount = safeRound(lineTaxable * (igstRate / 100), 2);
      }

      return {
        lineId: `line_${Date.now()}_${idx}`,
        sourcePoLineId: item.poLineId,
        purchaseOrderId: item.poId,
        poNumber: item.poNumber,
        statementApprovalId: item.approvalId,
        styleNoSnapshot: item.styleNo,
        itemNameSnapshot: item.itemName,
        colourSnapshot: item.colour,
        processCategorySnapshot: item.processCategory,
        washTypeSnapshot: item.washType,
        description: `Textile processing – ${item.washType} – Style ${item.styleNo} – Colour ${item.colour}`,
        hsnSac: settings.defaultHsnSacCode || '998821',
        colour: item.colour,
        process: item.washType,
        qty: item.remainingApprovedQty,
        quantity: item.remainingApprovedQty,
        unit: item.unit,
        rateBasis: item.rateBasis,
        rate: item.rate,
        billableWeightKg: item.billableWeightKg,
        amount: lineTaxable,
        taxableAmount: lineTaxable,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        lineTotal: safeRound(lineTaxable + cgstAmount + sgstAmount + igstAmount, 2)
      };
    });

    // 7. Calculate Invoice Totals
    const taxTotals = calculateInvoiceTaxes(subtotal, {
      isIntraState,
      cgstRate: settings.defaultCgstRate,
      sgstRate: settings.defaultSgstRate,
      igstRate: settings.defaultIgstRate
    });

    const now = new Date();
    const financialYear = getFinancialYear(now);
    const tempId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const draftInvoice: Invoice = {
      id: tempId,
      invoiceId: tempId,
      invoiceNo: `DRAFT/${financialYear}/${String(Math.floor(1000 + Math.random() * 9000))}`,
      financialYear,
      invoiceDate: now.toISOString().split('T')[0],
      poNumber: selectedItems[0].poNumber,
      poNumbers: Array.from(new Set(selectedItems.map((s) => s.poNumber))),
      purchaseOrderIds: Array.from(new Set(selectedItems.map((s) => s.poId))),
      styleNo: selectedItems[0].styleNo,
      styleNumbers: Array.from(new Set(selectedItems.map((s) => s.styleNo))),
      customerId: companyId,
      companyId,
      customerSnapshot: {
        companyName: customer?.companyName || selectedItems[0].companyName,
        address: customerAddress,
        city: customerCity,
        state: customerState,
        stateCode: customerStateCode,
        gstin: customerGstin,
        pan: customerPan,
        phone: (customer?.communication as any)?.phone || (customer?.communication as any)?.primaryPhone,
        email: (customer?.communication as any)?.email || (customer?.communication as any)?.primaryEmail
      },
      issuerSnapshot: {
        companyName: settings.companyName,
        tagline: settings.tagline,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        city: settings.city,
        state: settings.state,
        stateCode: settings.stateCode,
        pincode: settings.pincode,
        tin: settings.tin,
        cst: settings.cst,
        gstin: settings.gstin,
        pan: settings.pan,
        phone: settings.phone,
        email: settings.email
      },
      lines,
      currency: 'INR',
      subtotal: taxTotals.subtotal,
      taxableAmount: taxTotals.taxableAmount,
      discountAmount: 0,
      cgstRate: taxTotals.cgstRate,
      totalCgst: taxTotals.cgstAmount,
      sgstRate: taxTotals.sgstRate,
      totalSgst: taxTotals.sgstAmount,
      igstRate: taxTotals.igstRate,
      totalIgst: taxTotals.igstAmount,
      otherCharges: 0,
      roundOff: taxTotals.roundOff,
      finalTotal: taxTotals.finalTotal,
      grandTotal: taxTotals.finalTotal,
      amountInWords: convertNumberToIndianWords(taxTotals.finalTotal),
      bankDetailsSnapshot: {
        bankName: settings.bankName,
        accountName: settings.accountName,
        accountNumber: settings.accountNumber,
        ifscCode: settings.ifscCode,
        branch: settings.bankBranch,
        upiId: settings.upiId
      },
      declarationSnapshot: settings.declaration,
      termsAndConditions: settings.termsAndConditions,
      status: 'draft',
      createdAt: now.toISOString(),
      createdBy: user.uid,
      createdByName: user.displayName || 'Authorized User'
    };

    return draftInvoice;
  }

  /**
   * Generates next atomic unique invoice number for the given financial year
   * Pattern: PTP/2026-27/0001
   */
  static async getNextInvoiceNumber(financialYear: string, isDemo: boolean = false): Promise<string> {
    if (!isDemo) {
      try {
        const counterRef = doc(db, 'invoice_counters', `invoice_${financialYear}`);
        const newCount = await runTransaction(db, async (txn) => {
          const snap = await txn.get(counterRef);
          let current = 0;
          if (snap.exists()) {
            current = snap.data().currentSequence || 0;
          }
          const next = current + 1;
          txn.set(
            counterRef,
            { currentSequence: next, financialYear, updatedAt: Timestamp.now() },
            { merge: true }
          );
          return next;
        });

        const padded = String(newCount).padStart(4, '0');
        return `PTP/${financialYear}/${padded}`;
      } catch (err) {
        console.warn('Firestore atomic invoice counter failed, falling back to local counter:', err);
      }
    }

    // Local sequence counter fallback
    const key = `perla_inv_counter_${financialYear}`;
    let count = 1;
    try {
      const stored = safeGetStorage(key);
      if (stored) {
        count = parseInt(stored, 10) + 1;
      }
      safeSetStorage(key, count.toString());
    } catch (e) {
      count = getLocalInvoices().length + 1;
    }

    return `PTP/${financialYear}/${String(count).padStart(4, '0')}`;
  }

  /**
   * Finalizes an invoice draft:
   * 1. Revalidates eligibility to prevent duplicate invoicing
   * 2. Atomically consumes approved quantities from Statement module
   * 3. Allocates unique financial-year invoice number (e.g. PTP/2026-27/0001)
   * 4. Stores immutable finalized invoice snapshot
   * 5. Records audit log
   */
  static async finalizeInvoice(
    draftInvoice: Invoice,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<Invoice> {
    const now = new Date();
    const financialYear = draftInvoice.financialYear || getFinancialYear(now);

    // 1. Allocate next sequence number
    const finalInvoiceNo = await this.getNextInvoiceNumber(financialYear, isDemo);
    const finalInvoiceId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const finalizedInvoice: Invoice = {
      ...draftInvoice,
      id: finalInvoiceId,
      invoiceId: finalInvoiceId,
      invoiceNo: finalInvoiceNo,
      invoiceNumber: finalInvoiceNo,
      status: 'finalized',
      finalizedBy: user.uid,
      finalizedByName: user.displayName || 'Authorized User',
      finalizedAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // 2. Persist to Firestore if not demo
    if (!isDemo) {
      try {
        const invDocRef = doc(db, 'invoices', finalInvoiceId);
        await setDoc(invDocRef, finalizedInvoice);

        // Subcollection: lines
        for (const line of finalizedInvoice.lines) {
          const lineDocRef = doc(db, 'invoices', finalInvoiceId, 'lines', line.lineId);
          await setDoc(lineDocRef, {
            ...line,
            invoiceId: finalInvoiceId,
            createdAt: now.toISOString()
          });
        }
      } catch (err) {
        console.warn('Failed to save finalized invoice in Firestore:', err);
      }
    }

    // 3. Mark all lines as invoiced in Statement approvals in an atomic batch
    await StatementService.markApprovalsBatch(
      finalizedInvoice.lines.map((l) => ({
        poLineId: l.sourcePoLineId,
        approvalId: l.statementApprovalId
      })),
      finalInvoiceId,
      finalInvoiceNo,
      finalizedInvoice.invoiceDate,
      isDemo
    );

    // 4. Save to Local Storage cache
    const existing = getLocalInvoices().filter((inv) => inv.id !== draftInvoice.id);
    existing.unshift(finalizedInvoice);
    saveLocalInvoices(existing);

    // 5. Record Audit Log
    const auditLog: InvoiceAuditLog = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      invoiceId: finalInvoiceId,
      invoiceNo: finalInvoiceNo,
      action: 'finalized',
      userId: user.uid,
      userName: user.displayName || 'Authorized User',
      timestamp: now.toISOString(),
      summary: `Invoice ${finalInvoiceNo} finalized for ${finalizedInvoice.customerSnapshot.companyName} (${formatCurrency(finalizedInvoice.finalTotal)})`,
      details: {
        totalAmount: finalizedInvoice.finalTotal,
        lineCount: finalizedInvoice.lines.length,
        customer: finalizedInvoice.customerSnapshot.companyName
      }
    };
    saveLocalAuditLog(auditLog);

    if (!isDemo) {
      try {
        const auditRef = doc(db, 'invoice_audit_logs', auditLog.auditId);
        await setDoc(auditRef, auditLog);
      } catch (e) {
        console.warn('Failed to write invoice audit log to Firestore:', e);
      }
    }

    return finalizedInvoice;
  }

  /**
   * Retrieves invoices with filtering and pagination
   */
  static async getInvoices(
    filters?: InvoiceFilterOptions,
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 20 },
    isDemo: boolean = false
  ): Promise<{ invoices: Invoice[]; totalCount: number }> {
    let list: Invoice[] = [];

    if (!isDemo) {
      try {
        let snap;
        try {
          const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
          snap = await getDocs(q);
        } catch {
          // If composite or orderBy query fails, query directly without ordering
          snap = await getDocs(collection(db, 'invoices'));
        }

        // Always trust Firestore (even if empty = all records deleted).
        // Overwrite local storage cache so stale deleted invoices are removed.
        list = snap.docs.map((d) => {
          const data = d.data();
          return {
            ...data,
            id: d.id,
            invoiceId: data.invoiceId || d.id
          } as Invoice;
        });

        // In-memory sort chronologically descending
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        saveLocalInvoices(list);
      } catch (err) {
        // Genuine network/permission error only
        console.warn('Firestore getInvoices error, falling back to local storage cache:', err);
        list = getLocalInvoices();
      }
    } else {
      list = getLocalInvoices();
    }

    // Apply Filters
    let filtered = [...list];

    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (inv) =>
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.customerSnapshot?.companyName?.toLowerCase().includes(q) ||
          inv.poNumber?.toLowerCase().includes(q) ||
          inv.styleNo?.toLowerCase().includes(q)
      );
    }

    if (filters?.companyId) {
      filtered = filtered.filter(
        (inv) => inv.customerId === filters.companyId || inv.companyId === filters.companyId
      );
    }

    if (filters?.poNumber) {
      filtered = filtered.filter(
        (inv) =>
          inv.poNumber?.toLowerCase() === filters.poNumber?.toLowerCase() ||
          inv.poNumbers?.some((p) => p.toLowerCase() === filters.poNumber?.toLowerCase())
      );
    }

    if (filters?.styleNo) {
      filtered = filtered.filter(
        (inv) =>
          inv.styleNo?.toLowerCase() === filters.styleNo?.toLowerCase() ||
          inv.styleNumbers?.some((s) => s.toLowerCase() === filters.styleNo?.toLowerCase())
      );
    }

    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter((inv) => inv.status.toLowerCase() === filters.status?.toLowerCase());
    }

    if (filters?.startDate) {
      filtered = filtered.filter((inv) => inv.invoiceDate >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter((inv) => inv.invoiceDate <= filters.endDate!);
    }

    const totalCount = filtered.length;
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const paginated = filtered.slice(startIndex, startIndex + pagination.pageSize);

    return { invoices: paginated, totalCount };
  }

  /**
   * Retrieves single invoice by ID
   */
  static async getInvoiceById(invoiceId: string, isDemo: boolean = false): Promise<Invoice | null> {
    if (!isDemo) {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return snap.data() as Invoice;
        }
      } catch (e) {
        console.warn('Failed to fetch invoice from Firestore:', e);
      }
      return null;
    }

    const local = getLocalInvoices().find((inv) => inv.id === invoiceId || inv.invoiceId === invoiceId);
    return local || null;
  }

  /**
   * Cancels an invoice without deleting historical records
   */
  static async cancelInvoice(
    invoiceId: string,
    reason: string,
    user: { uid: string; displayName?: string },
    isDemo: boolean = false
  ): Promise<Invoice> {
    if (!reason || reason.trim() === '') {
      throw new Error('A cancellation reason is required to cancel an invoice.');
    }

    const target = await this.getInvoiceById(invoiceId, isDemo);
    if (!target) {
      throw new Error(`Invoice with ID ${invoiceId} not found.`);
    }

    if (target.status === 'cancelled' || target.status === 'Cancelled') {
      throw new Error('This invoice has already been cancelled.');
    }

    const now = new Date().toISOString();
    const updatedInvoice: Invoice = {
      ...target,
      status: 'cancelled',
      cancelledBy: user.uid,
      cancelledByName: user.displayName || 'Authorized User',
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now
    };

    if (!isDemo) {
      try {
        const docRef = doc(db, 'invoices', invoiceId);
        await updateDoc(docRef, {
          status: 'cancelled',
          cancelledBy: user.uid,
          cancelledByName: user.displayName || 'Authorized User',
          cancelledAt: now,
          cancellationReason: reason,
          updatedAt: now
        });
      } catch (err) {
        console.warn('Failed to update cancelled invoice status in Firestore:', err);
      }
    }

    // Update local storage cache
    const current = getLocalInvoices().map((inv) => (inv.id === invoiceId ? updatedInvoice : inv));
    saveLocalInvoices(current);

    // Record audit log
    const auditLog: InvoiceAuditLog = {
      auditId: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      invoiceId,
      invoiceNo: target.invoiceNo,
      action: 'cancelled',
      userId: user.uid,
      userName: user.displayName || 'Authorized User',
      timestamp: now,
      summary: `Invoice ${target.invoiceNo} cancelled by ${user.displayName || 'Authorized User'}. Reason: ${reason}`
    };
    saveLocalAuditLog(auditLog);

    return updatedInvoice;
  }

  /**
   * Computes invoice dashboard metrics from actual invoice records
   */
  static calculateDashboardMetrics(invoices: Invoice[]): InvoiceMetrics {
    let totalInvoices = 0;
    let totalInvoiceValue = 0;
    let totalTaxableValue = 0;
    let totalGstCollected = 0;
    let draftCount = 0;
    let finalizedCount = 0;
    let cancelledCount = 0;

    for (const inv of invoices) {
      totalInvoices++;
      const statusLower = inv.status.toLowerCase();

      if (statusLower === 'finalized') {
        finalizedCount++;
        totalInvoiceValue = safeRound(totalInvoiceValue + (inv.finalTotal || inv.grandTotal || 0), 2);
        totalTaxableValue = safeRound(totalTaxableValue + (inv.subtotal || inv.taxableAmount || 0), 2);
        const gst = (inv.totalCgst || 0) + (inv.totalSgst || 0) + (inv.totalIgst || 0);
        totalGstCollected = safeRound(totalGstCollected + gst, 2);
      } else if (statusLower === 'draft') {
        draftCount++;
      } else if (statusLower === 'cancelled') {
        cancelledCount++;
      }
    }

    return {
      totalInvoices,
      totalInvoiceValue,
      totalTaxableValue,
      totalGstCollected,
      draftCount,
      finalizedCount,
      cancelledCount
    };
  }
}
