import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, InvoiceEligibleItem, InvoiceFilterOptions, InvoiceMetrics, InvoiceReadinessPOGroup } from '../../types/invoice';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { Button } from '../../components/ui/Button';
import { InvoiceService } from '../../services/invoiceService';
import { InvoicePdfService } from '../../services/invoicePdfService';
import { StatementService } from '../../services/statementService';
import { InvoiceDashboardMetrics } from './components/InvoiceDashboardMetrics';
import { InvoiceEligibleTable } from './components/InvoiceEligibleTable';
import { InvoiceHistoryTable } from './components/InvoiceHistoryTable';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { InvoiceDetailsModal } from './components/InvoiceDetailsModal';
import { InvoiceCancelModal } from './components/InvoiceCancelModal';
import { InvoiceSettingsModal } from './components/InvoiceSettingsModal';
import { InvoiceEditModal } from './components/InvoiceEditModal';
import { InvoiceTaxChoiceModal } from './components/InvoiceTaxChoiceModal';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  RotateCcw,
  Settings,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InvoicesPageProps {
  invoices: Invoice[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  approvedPoLineIds: string[];
  onAddInvoice: (inv: Invoice) => void;
  onUpdateInvoice?: (inv: Invoice) => void;
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  invoices: propInvoices,
  pos,
  vendors,
  approvedPoLineIds,
  onAddInvoice,
  onUpdateInvoice
}) => {
  const { user, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const userRole = (user as any)?.role || 'Admin';
  const isAdmin = userRole === 'Admin' || userRole === 'admin';

  // Navigation tab: 'eligible' (reconciliation & approval), 'generation' (ready for invoice creation), or 'history' (generated invoices)
  const [activeTab, setActiveTab] = useState<'eligible' | 'generation' | 'history'>('eligible');

  // Filter state
  const [filters, setFilters] = useState<InvoiceFilterOptions>({
    status: 'all'
  });

  // Local state for live eligible items and invoices
  const [eligibleItems, setEligibleItems] = useState<InvoiceEligibleItem[]>([]);
  const [readinessGroups, setReadinessGroups] = useState<InvoiceReadinessPOGroup[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>(propInvoices);
  const [loadingEligible, setLoadingEligible] = useState<boolean>(true);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Modals state
  const [draftInvoice, setDraftInvoice] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);

  const [selectedViewInvoice, setSelectedViewInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);

  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);

  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

  // Tax Mode Choice State (Before Generating Invoice)
  const [isTaxChoiceOpen, setIsTaxChoiceOpen] = useState<boolean>(false);
  const [taxChoiceItems, setTaxChoiceItems] = useState<InvoiceEligibleItem[]>([]);
  const [isTaxProcessing, setIsTaxProcessing] = useState<boolean>(false);

  // Toast notification
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  };

  // Sync prop invoices into state if parent updates
  useEffect(() => {
    if (propInvoices) {
      const seen = new Set<string>();
      const deduped: Invoice[] = [];
      for (const inv of propInvoices) {
        const key = inv.id || inv.invoiceNo;
        if (key) {
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(inv);
          }
        } else {
          deduped.push(inv);
        }
      }
      setInvoicesList(deduped);
    }
  }, [propInvoices]);

  // Load eligible items and reconciliation ledger across POs
  const refreshEligibleItems = useCallback(async () => {
    try {
      setLoadingEligible(true);
      const [groups, items] = await Promise.all([
        InvoiceService.getInvoiceReadinessLedger(
          { companyId: filters.companyId, poNumber: filters.poNumber, styleNo: filters.styleNo },
          false
        ),
        InvoiceService.getInvoiceEligibleItems(
          { companyId: filters.companyId, poNumber: filters.poNumber, styleNo: filters.styleNo },
          false
        )
      ]);
      setReadinessGroups(groups || []);
      setEligibleItems(items || []);
    } catch (err) {
      console.warn('Failed to load eligible items:', err);
      setReadinessGroups([]);
      setEligibleItems([]);
    } finally {
      setLoadingEligible(false);
    }
  }, [filters.companyId, filters.poNumber, filters.styleNo]);

  // Handle explicit colour line approval
  const handleApproveLine = async (poId: string, poLineId: string, companyId?: string) => {
    try {
      setIsApproving(true);
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };
      await StatementService.approveStatementLineForInvoice(
        { poId, poLineId, companyId },
        authUser,
        false
      );
      showToast('success', 'Colour line approved for invoicing!');
      await refreshEligibleItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to approve colour line for invoice.');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle entire PO approval
  const handleApproveEntirePO = async (poId: string, companyId?: string) => {
    try {
      setIsApproving(true);
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };
      const result = await StatementService.approveEntirePOForInvoice(
        { poId, companyId },
        authUser,
        false
      );
      showToast(
        'success',
        `Entire PO approved! ${result.approvedRecords.length} colour(s) ready for invoice.`
      );
      await refreshEligibleItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to approve entire PO for invoice.');
    } finally {
      setIsApproving(false);
    }
  };

  // Load invoices history
  const refreshInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const result = await InvoiceService.getInvoices(filters, { page: 1, pageSize: 200 }, false);
      setInvoicesList(result.invoices || []);
    } catch (err) {
      console.warn('Failed to load invoices:', err);
      setInvoicesList([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [filters]);

  useEffect(() => {
    refreshEligibleItems();
    refreshInvoices();
  }, [refreshEligibleItems, refreshInvoices]);

  // Filtered invoices in memory for search & status filters
  const filteredInvoices = useMemo(() => {
    // Deduplicate by id and invoiceNo
    const seen = new Set<string>();
    const uniqueList = invoicesList.filter((inv) => {
      const key = inv.id || inv.invoiceNo;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let list = [...uniqueList];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.customerSnapshot?.companyName?.toLowerCase().includes(q) ||
          (inv as any).customerBillingSnapshot?.companyName?.toLowerCase().includes(q) ||
          (inv as any).customerName?.toLowerCase().includes(q) ||
          (inv as any).customerCompanyNameSnapshot?.toLowerCase().includes(q) ||
          inv.poNumber?.toLowerCase().includes(q) ||
          (inv.poNumbers && inv.poNumbers.some((p) => p.toLowerCase().includes(q))) ||
          inv.styleNo?.toLowerCase().includes(q) ||
          (inv as any).styleNumber?.toLowerCase().includes(q) ||
          (inv as any).itemName?.toLowerCase().includes(q) ||
          (inv as any).dcNo?.toLowerCase().includes(q) ||
          (inv as any).ourDcNo?.toLowerCase().includes(q) ||
          inv.invoiceDate?.toLowerCase().includes(q) ||
          inv.status?.toLowerCase().includes(q) ||
          String(inv.grandTotal || (inv as any).totalAmount || '').includes(q) ||
          (inv.lines && inv.lines.some((l) =>
            l.colour?.toLowerCase().includes(q) ||
            l.process?.toLowerCase().includes(q) ||
            l.hsnSac?.toLowerCase().includes(q) ||
            l.description?.toLowerCase().includes(q) ||
            l.poNumber?.toLowerCase().includes(q) ||
            l.styleNoSnapshot?.toLowerCase().includes(q)
          ))
      );
    }

    if (filters.companyId) {
      list = list.filter((inv) => inv.customerId === filters.companyId || inv.companyId === filters.companyId);
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((inv) => inv.status.toLowerCase() === filters.status?.toLowerCase());
    }

    if (filters.startDate) {
      list = list.filter((inv) => inv.invoiceDate >= filters.startDate!);
    }

    if (filters.endDate) {
      list = list.filter((inv) => inv.invoiceDate <= filters.endDate!);
    }

    return list;
  }, [invoicesList, filters]);

  // Compute live dashboard metrics
  const dashboardMetrics: InvoiceMetrics = useMemo(() => {
    return InvoiceService.calculateDashboardMetrics(invoicesList);
  }, [invoicesList]);

  // Customer companies list for filter dropdown
  const customerCompanies = useMemo(() => {
    return vendors
      .filter((v) => v.vendorType === 'customer' || v.vendorType === 'both' || (v as any).roles?.includes('Customer'))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [vendors]);

  // Aggregate line counts for section tab badges
  const totalPendingLinesCount = useMemo(() => {
    return readinessGroups.reduce(
      (sum, g) => sum + g.lines.filter((l) => !l.isApprovedForInvoice && !l.isInvoiced).length,
      0
    );
  }, [readinessGroups]);

  const totalApprovedLinesCount = useMemo(() => {
    return readinessGroups.reduce((sum, g) => sum + g.approvedLines.length, 0);
  }, [readinessGroups]);

  // Filter change handler
  const handleFilterChange = (updated: Partial<InvoiceFilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ status: 'all' });
    setCurrentPage(1);
  };

  // Triggered when user initiates invoice generation for items (opens With/Without GST choice)
  const handleRequestInvoicing = (
    items: InvoiceEligibleItem[],
    initialAction: 'direct_download' | 'review_draft' = 'direct_download'
  ) => {
    if (!items || items.length === 0) return;
    setTaxChoiceItems(items);
    setIsTaxChoiceOpen(true);
  };

  // Callback when user confirms tax choice in InvoiceTaxChoiceModal
  const handleConfirmTaxChoice = async (
    gstType: 'with_gst' | 'without_gst',
    action: 'direct_download' | 'review_draft'
  ) => {
    if (taxChoiceItems.length === 0) return;
    const isWithoutGst = gstType === 'without_gst';

    try {
      setIsTaxProcessing(true);
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };

      const approvalIds = taxChoiceItems.map((i) => i.approvalId);
      const label =
        taxChoiceItems.length > 1
          ? `${taxChoiceItems.length} colours (${taxChoiceItems[0].poNumber})`
          : `${taxChoiceItems[0].colour} (${taxChoiceItems[0].styleNo})`;

      // Create draft with chosen GST mode
      const draft = await InvoiceService.createInvoiceDraft(
        approvalIds,
        authUser,
        false,
        eligibleItems,
        { isWithoutGst, gstType }
      );

      if (action === 'review_draft') {
        setIsTaxChoiceOpen(false);
        setDraftInvoice(draft);
        setIsPreviewOpen(true);
        return;
      }

      // Direct download & finalize
      setGeneratingLabel(label);
      setIsTaxChoiceOpen(false);
      showToast(
        'info',
        `Generating ${isWithoutGst ? 'Non-GST' : 'Tax'} Invoice for ${label}...`
      );

      const finalized = await InvoiceService.finalizeInvoice(draft, authUser, false);
      onAddInvoice(finalized);
      setInvoicesList((prev) => [finalized, ...prev.filter((i) => i.id !== finalized.id)]);
      setEligibleItems((prev) => prev.filter((item) => !approvalIds.includes(item.approvalId)));

      await InvoicePdfService.downloadInvoicePdf(finalized);
      showToast(
        'success',
        `${isWithoutGst ? 'Non-GST Invoice (stored in Firebase)' : 'Tax Invoice'} ${finalized.invoiceNo} generated & downloaded successfully!`
      );

      refreshEligibleItems();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to generate invoice.');
    } finally {
      setIsTaxProcessing(false);
      setGeneratingLabel(null);
    }
  };

  // 1. Generate Invoice trigger from selected approval items
  const handleInitiateGenerateInvoice = async (selectedApprovalIds: string[]) => {
    const items = eligibleItems.filter((i) => selectedApprovalIds.includes(i.approvalId));
    handleRequestInvoicing(items, 'review_draft');
  };

  // Direct download action from eligible table row (supports single item or multiple colours combined)
  const handleDownloadDirectInvoice = async (items: InvoiceEligibleItem | InvoiceEligibleItem[]) => {
    const itemList = Array.isArray(items) ? items : [items];
    handleRequestInvoicing(itemList, 'direct_download');
  };

  // 2. Finalize Invoice confirmation
  const handleConfirmFinalize = async (customDraft?: Invoice) => {
    const targetDraft = customDraft || draftInvoice;
    if (!targetDraft) return;

    try {
      setIsFinalizing(true);
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };

      const finalized = await InvoiceService.finalizeInvoice(targetDraft, authUser, false);

      // Notify parent handler so state is synced application-wide
      onAddInvoice(finalized);

      // Update local state
      setInvoicesList((prev) => [finalized, ...prev.filter((i) => i.id !== finalized.id)]);
      setIsPreviewOpen(false);
      setDraftInvoice(null);

      // Refresh eligible items to remove consumed lines
      await refreshEligibleItems();

      showToast('success', `Tax Invoice ${finalized.invoiceNo} generated and finalized successfully!`);

      // Switch to history tab to view generated invoice
      setActiveTab('history');
      setSelectedViewInvoice(finalized);
      setIsDetailsOpen(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Invoice finalization failed.');
    } finally {
      setIsFinalizing(false);
    }
  };

  // 3. View Invoice Details
  const handleViewInvoice = (inv: Invoice) => {
    setSelectedViewInvoice(inv);
    setIsDetailsOpen(true);
  };

  // 4. Download PDF
  const handleDownloadPdf = async (inv: Invoice) => {
    try {
      showToast('info', `Downloading PDF for ${inv.invoiceNo}...`);
      await InvoicePdfService.downloadInvoicePdf(inv);
      showToast('success', `PDF for ${inv.invoiceNo} downloaded successfully!`);
    } catch (err) {
      showToast('error', 'Failed to generate PDF document.');
    }
  };

  // 5. Print PDF
  const handlePrintPdf = async (inv: Invoice) => {
    try {
      await InvoicePdfService.printInvoicePdf(inv);
    } catch (err) {
      showToast('error', 'Failed to open printable invoice document.');
    }
  };

  // 6. Cancel Invoice
  const handleConfirmCancel = async (invoiceId: string, reason: string) => {
    const authUser = {
      uid: user?.uid || 'usr-authorized',
      displayName: user?.displayName || 'Admin User'
    };

    const updated = await InvoiceService.cancelInvoice(invoiceId, reason, authUser, false);
    setInvoicesList((prev) => prev.map((inv) => (inv.id === invoiceId ? updated : inv)));
    await refreshEligibleItems();
    showToast('info', `Invoice ${updated.invoiceNo} marked as cancelled.`);
  };

  // 7. Edit Invoice (Admin Only)
  const handleOpenEdit = (inv: Invoice) => {
    setInvoiceToEdit(inv);
    setIsEditOpen(true);
  };

  const handleSavePermanent = async (updatedInvoice: Invoice) => {
    const authUser = {
      uid: user?.uid || 'usr-authorized',
      displayName: user?.displayName || 'Admin'
    };
    const saved = await InvoiceService.updateInvoice(updatedInvoice, authUser, isDemoMode);
    setInvoicesList((prev) => {
      const exists = prev.some((inv) => inv.id === saved.id || inv.invoiceNo === saved.invoiceNo);
      if (exists) {
        return prev.map((inv) =>
          inv.id === saved.id || inv.invoiceNo === saved.invoiceNo ? saved : inv
        );
      }
      return [saved, ...prev];
    });

    if (onUpdateInvoice) {
      onUpdateInvoice(saved);
    } else {
      onAddInvoice(saved);
    }

    showToast('success', `Tax Invoice ${saved.invoiceNo} successfully updated & saved to database!`);
  };

  const handleDownloadTemporary = async (tempInvoice: Invoice) => {
    showToast('info', `Generating temporary PDF for ${tempInvoice.invoiceNo}...`);
    await InvoicePdfService.downloadInvoicePdf(tempInvoice);
    showToast('success', `Temporary PDF for ${tempInvoice.invoiceNo} downloaded successfully.`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Center Screen Modal Overlay: Active Invoice Generation */}
      {generatingLabel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-emerald-500 p-8 max-w-md w-full mx-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-500 flex items-center justify-center mx-auto">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                Generating Tax Invoice
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                Processing Invoice &amp; PDF
              </h3>
              <p className="text-sm text-slate-600 mt-1 font-medium">
                {generatingLabel}
              </p>
            </div>

            <div className="pt-2">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div className="bg-emerald-500 h-2 rounded-full w-2/3 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Calculating GST breakdown and preparing official tax document...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Banner: Bright & Highly Visible */}
      {toast && (
        <div
          className={`fixed top-6 right-6 sm:right-1/2 sm:translate-x-1/2 z-50 px-5 py-3.5 rounded-xl shadow-2xl border-2 flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-200 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-800 shadow-rose-600/30'
              : 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-600/40'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          )}
          <span className="tracking-wide">{toast.message}</span>
        </div>
      )}

      {/* Top Header - Minimal & Airy */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Generation</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Generate and track official GST tax invoices for approved textile processing services
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              refreshEligibleItems();
              refreshInvoices();
              showToast('info', 'Refreshing invoices and statement approvals...');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/erp/settings?tab=tax')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Tax Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/erp/statement')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Go to Statement</span>
          </button>
        </div>
      </div>

      {/* Invoice Dashboard KPI Cards & Filters */}
      <InvoiceDashboardMetrics
        metrics={dashboardMetrics}
        filters={filters}
        companies={customerCompanies}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 gap-4">
        {/* Tab 1: Invoice-Eligible Items (Reconciliation & Approval) */}
        <button
          type="button"
          onClick={() => setActiveTab('eligible')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'eligible'
              ? 'border-black text-black'
              : 'border-transparent text-slate-600 hover:text-black'
          }`}
        >
          <span>Invoice-Eligible Items</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'eligible' ? 'bg-black text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {totalPendingLinesCount}
          </span>
        </button>

        {/* Tab 2: Invoice Generation (Approved POs ready for billing) */}
        <button
          type="button"
          onClick={() => setActiveTab('generation')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'generation'
              ? 'border-black text-black'
              : 'border-transparent text-slate-600 hover:text-black'
          }`}
        >
          <span>Invoice Generation</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'generation' ? 'bg-black text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {totalApprovedLinesCount}
          </span>
        </button>

        {/* Tab 3: Generated Invoices History */}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'border-black text-black'
              : 'border-transparent text-slate-600 hover:text-black'
          }`}
        >
          <span>Generated Invoices History</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'history' ? 'bg-black text-white shadow-2xs' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {filteredInvoices.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Eligible Items (Reconciliation & Line Approval) */}
      {activeTab === 'eligible' && (
        <InvoiceEligibleTable
          mode="eligible"
          readinessGroups={readinessGroups}
          eligibleItems={eligibleItems}
          loading={loadingEligible}
          searchQuery={filters.searchQuery}
          onApproveLine={handleApproveLine}
          onApproveEntirePO={handleApproveEntirePO}
          isApproving={isApproving}
          onRequestInvoicing={handleRequestInvoicing}
          onGenerateInvoice={handleInitiateGenerateInvoice}
          onDownloadInvoice={handleDownloadDirectInvoice}
          onSwitchTab={(t) => setActiveTab(t)}
        />
      )}

      {/* Tab 2: Invoice Generation (Approved POs ready for billing) */}
      {activeTab === 'generation' && (
        <InvoiceEligibleTable
          mode="generation"
          readinessGroups={readinessGroups}
          eligibleItems={eligibleItems}
          loading={loadingEligible}
          searchQuery={filters.searchQuery}
          onApproveLine={handleApproveLine}
          onApproveEntirePO={handleApproveEntirePO}
          isApproving={isApproving}
          onRequestInvoicing={handleRequestInvoicing}
          onGenerateInvoice={handleInitiateGenerateInvoice}
          onDownloadInvoice={handleDownloadDirectInvoice}
          onSwitchTab={(t) => setActiveTab(t)}
        />
      )}

      {/* Tab 3: Invoice History */}
      {activeTab === 'history' && (
        <InvoiceHistoryTable
          invoices={filteredInvoices}
          totalCount={filteredInvoices.length}
          currentPage={currentPage}
          pageSize={pageSize}
          loading={loadingInvoices}
          isAdmin={isAdmin}
          onPageChange={(p) => setCurrentPage(p)}
          onViewInvoice={handleViewInvoice}
          onDownloadPdf={handleDownloadPdf}
          onPrintPdf={handlePrintPdf}
          onOpenCancel={(inv) => {
            setInvoiceToCancel(inv);
            setIsCancelOpen(true);
          }}
          onEditInvoice={handleOpenEdit}
        />
      )}

      {/* Modal 0: Invoice Tax Choice (With GST vs Without GST) */}
      <InvoiceTaxChoiceModal
        isOpen={isTaxChoiceOpen}
        onClose={() => {
          if (!isTaxProcessing) {
            setIsTaxChoiceOpen(false);
            setTaxChoiceItems([]);
          }
        }}
        items={taxChoiceItems}
        isProcessing={isTaxProcessing}
        onConfirm={handleConfirmTaxChoice}
      />

      {/* Modal 1: Invoice Preview & Finalization */}
      <InvoicePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          if (!isFinalizing) {
            setIsPreviewOpen(false);
            setDraftInvoice(null);
          }
        }}
        draftInvoice={draftInvoice}
        isSubmitting={isFinalizing}
        onConfirmFinalize={handleConfirmFinalize}
      />

      {/* Modal 2: Invoice Full Details View */}
      <InvoiceDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedViewInvoice(null);
        }}
        invoice={selectedViewInvoice}
        isAdmin={isAdmin}
        onDownloadPdf={handleDownloadPdf}
        onPrintPdf={handlePrintPdf}
        onEditInvoice={handleOpenEdit}
      />

      {/* Modal 3: Invoice Cancellation Authorization */}
      <InvoiceCancelModal
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
          setInvoiceToCancel(null);
        }}
        invoice={invoiceToCancel}
        onConfirmCancel={handleConfirmCancel}
      />

      {/* Modal 4: Company Invoice & Tax Settings */}
      <InvoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsSaved={() => {
          showToast('success', 'Issuer settings updated. New invoices will use this profile.');
        }}
      />

      {/* Modal 5: Admin Edit Invoice Modal */}
      <InvoiceEditModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setInvoiceToEdit(null);
        }}
        invoice={invoiceToEdit}
        vendors={customerCompanies}
        onSavePermanent={handleSavePermanent}
        onDownloadTemporary={handleDownloadTemporary}
      />
    </div>
  );
};
