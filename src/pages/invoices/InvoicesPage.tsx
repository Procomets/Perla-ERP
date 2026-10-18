import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Invoice, InvoiceEligibleItem, InvoiceFilterOptions, InvoiceMetrics } from '../../types/invoice';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { Button } from '../../components/ui/Button';
import { InvoiceService } from '../../services/invoiceService';
import { InvoicePdfService } from '../../services/invoicePdfService';
import { InvoiceDashboardMetrics } from './components/InvoiceDashboardMetrics';
import { InvoiceEligibleTable } from './components/InvoiceEligibleTable';
import { InvoiceHistoryTable } from './components/InvoiceHistoryTable';
import { InvoicePreviewModal } from './components/InvoicePreviewModal';
import { InvoiceDetailsModal } from './components/InvoiceDetailsModal';
import { InvoiceCancelModal } from './components/InvoiceCancelModal';
import { InvoiceSettingsModal } from './components/InvoiceSettingsModal';
import { useAuth } from '../../context/AuthContext';
import {
  FileCheck2,
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
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  invoices: propInvoices,
  pos,
  vendors,
  approvedPoLineIds,
  onAddInvoice
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const userRole = (user as any)?.role || 'Admin';
  const isAdmin = userRole === 'Admin' || userRole === 'admin';

  // Navigation tab: 'eligible' (waiting for invoicing) or 'history' (generated invoices)
  const [activeTab, setActiveTab] = useState<'eligible' | 'history'>('eligible');

  // Filter state
  const [filters, setFilters] = useState<InvoiceFilterOptions>({
    status: 'all'
  });

  // Local state for live eligible items and invoices
  const [eligibleItems, setEligibleItems] = useState<InvoiceEligibleItem[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>(propInvoices);
  const [loadingEligible, setLoadingEligible] = useState<boolean>(true);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
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

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

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
    if (propInvoices && propInvoices.length > 0) {
      setInvoicesList((prev) => {
        const mergedMap = new Map<string, Invoice>();
        propInvoices.forEach((inv) => mergedMap.set(inv.id, inv));
        prev.forEach((inv) => mergedMap.set(inv.id, inv));
        return Array.from(mergedMap.values());
      });
    }
  }, [propInvoices]);

  // Load eligible items from Statement approvals
  const refreshEligibleItems = useCallback(async () => {
    try {
      setLoadingEligible(true);
      const items = await InvoiceService.getInvoiceEligibleItems(
        { companyId: filters.companyId, poNumber: filters.poNumber, styleNo: filters.styleNo },
        false
      );
      setEligibleItems(items);
    } catch (err) {
      console.warn('Failed to load eligible items:', err);
    } finally {
      setLoadingEligible(false);
    }
  }, [filters.companyId, filters.poNumber, filters.styleNo]);

  // Load invoices history
  const refreshInvoices = useCallback(async () => {
    try {
      setLoadingInvoices(true);
      const result = await InvoiceService.getInvoices(filters, { page: 1, pageSize: 200 }, false);
      if (result.invoices && result.invoices.length > 0) {
        setInvoicesList((prev) => {
          const mergedMap = new Map<string, Invoice>();
          result.invoices.forEach((inv) => mergedMap.set(inv.id, inv));
          prev.forEach((inv) => mergedMap.set(inv.id, inv));
          return Array.from(mergedMap.values());
        });
      }
    } catch (err) {
      console.warn('Failed to load invoices:', err);
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
    let list = [...invoicesList];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          inv.invoiceNo?.toLowerCase().includes(q) ||
          inv.customerSnapshot?.companyName?.toLowerCase().includes(q) ||
          inv.poNumber?.toLowerCase().includes(q) ||
          inv.styleNo?.toLowerCase().includes(q)
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

  // Filter change handler
  const handleFilterChange = (updated: Partial<InvoiceFilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...updated }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ status: 'all' });
    setCurrentPage(1);
  };

  // 1. Generate Invoice trigger from selected approval items
  const handleInitiateGenerateInvoice = async (selectedApprovalIds: string[]) => {
    try {
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };

      const draft = await InvoiceService.createInvoiceDraft(selectedApprovalIds, authUser, false);
      setDraftInvoice(draft);
      setIsPreviewOpen(true);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to prepare invoice draft.');
    }
  };

  // Direct download action from eligible table row
  const handleDownloadDirectInvoice = async (item: InvoiceEligibleItem) => {
    try {
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };

      showToast('info', `Generating Tax Invoice for ${item.colour} (${item.styleNo})...`);

      const draft = await InvoiceService.createInvoiceDraft([item.approvalId], authUser, false);
      const finalized = await InvoiceService.finalizeInvoice(draft, authUser, false);

      onAddInvoice(finalized);
      setInvoicesList((prev) => [finalized, ...prev.filter((i) => i.id !== finalized.id)]);
      await refreshEligibleItems();

      InvoicePdfService.downloadInvoicePdf(finalized);
      showToast('success', `Tax Invoice ${finalized.invoiceNo} generated & downloaded successfully!`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to download invoice.');
    }
  };

  // 2. Finalize Invoice confirmation
  const handleConfirmFinalize = async () => {
    if (!draftInvoice) return;

    try {
      setIsFinalizing(true);
      const authUser = {
        uid: user?.uid || 'usr-authorized',
        displayName: user?.displayName || 'Authorized User'
      };

      const finalized = await InvoiceService.finalizeInvoice(draftInvoice, authUser, false);

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
  const handleDownloadPdf = (inv: Invoice) => {
    try {
      InvoicePdfService.downloadInvoicePdf(inv);
      showToast('info', `Downloading PDF for ${inv.invoiceNo}...`);
    } catch (err) {
      showToast('error', 'Failed to generate PDF document.');
    }
  };

  // 5. Print PDF
  const handlePrintPdf = (inv: Invoice) => {
    try {
      InvoicePdfService.printInvoicePdf(inv);
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

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Invoice Generation & Billing Module</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-[#1F4E79]">
              Perla ERP
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate and track official GST tax invoices for approved textile processing services.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refreshEligibleItems();
              refreshInvoices();
              showToast('info', 'Refreshing invoices and statement approvals...');
            }}
            icon={<RotateCcw className="w-4 h-4" />}
          >
            Refresh
          </Button>

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              icon={<Settings className="w-4 h-4" />}
            >
              Tax & Issuer Settings
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/erp/statement')}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            Statement Module
          </Button>
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
        <button
          type="button"
          onClick={() => setActiveTab('eligible')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'eligible'
              ? 'border-[#1F4E79] text-[#1F4E79]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Invoice-Eligible Items
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'eligible' ? 'bg-[#1F4E79] text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {eligibleItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-[#1F4E79] text-[#1F4E79]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Generated Invoices History
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'history' ? 'bg-[#1F4E79] text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {filteredInvoices.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Eligible Items */}
      {activeTab === 'eligible' && (
        <InvoiceEligibleTable
          eligibleItems={eligibleItems}
          loading={loadingEligible}
          onGenerateInvoice={handleInitiateGenerateInvoice}
          onDownloadInvoice={handleDownloadDirectInvoice}
          onNavigateStatement={() => navigate('/erp/statement')}
        />
      )}

      {/* Tab 2: Invoice History */}
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
        />
      )}

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
        onDownloadPdf={handleDownloadPdf}
        onPrintPdf={handlePrintPdf}
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
    </div>
  );
};
