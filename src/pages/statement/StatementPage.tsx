import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../types/inwardOutward';
import {
  StatementDataResponse,
  InvoiceHistoryItem
} from '../../types/statement';
import { StatementService } from '../../services/statementService';
import { useNavigate } from 'react-router-dom';
import { StatementFilters } from './components/StatementFilters';
import { StatementLedgerTable } from './components/StatementLedgerTable';
import { ColourReconciliationStrip } from './components/ColourReconciliationStrip';
import { InvoiceHistoryTable } from './components/InvoiceHistoryTable';
import { useAuth } from '../../context/AuthContext';
import { Scale, History, Building2, AlertTriangle, ShieldCheck, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface StatementPageProps {
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  approvedPoLineIds?: string[];
  invoicedPoLineIds?: string[];
  onApproveForInvoice?: (poLineId: string) => void;
}

export const StatementPage: React.FC<StatementPageProps> = ({
  pos,
  inwards,
  outwards,
  approvedPoLineIds = [],
  invoicedPoLineIds = [],
  onApproveForInvoice
}) => {
  const { user, isDemoMode, activeRole } = useAuth();
  const navigate = useNavigate();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager';

  // Navigation tab: Active Statement vs Invoice History
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // Filter Selection States
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedStyleNo, setSelectedStyleNo] = useState<string>('all');
  const [selectedItemName, setSelectedItemName] = useState<string>('all');
  const [selectedPoId, setSelectedPoId] = useState<string>('all');

  // Filter Options
  const [companies, setCompanies] = useState<Vendor[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<
    { id: string; poNumber: string; styleNo: string; itemName: string }[]
  >([]);

  // Statement Data States
  const [statementData, setStatementData] = useState<StatementDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Invoice History States
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // 1. Initial Load: Filter Options for Companies
  useEffect(() => {
    StatementService.getFilterOptions(undefined, isDemoMode)
      .then((res) => {
        setCompanies(res.companies);
        // Pre-select first company if available to facilitate immediate inspection
        if (res.companies.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(res.companies[0].id || res.companies[0].vendorId || '');
        }
      })
      .catch((err) => {
        console.error('Failed to load companies:', err);
      });
  }, [isDemoMode]);

  // 2. Cascade load styles, items, and POs when Company changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setStyles([]);
      setItems([]);
      setPurchaseOrders([]);
      setStatementData(null);
      return;
    }

    StatementService.getFilterOptions(selectedCompanyId, isDemoMode)
      .then((res) => {
        setStyles(res.styles);
        setItems(res.items);
        setPurchaseOrders(res.purchaseOrders);
      })
      .catch((err) => {
        console.error('Failed to load company cascade filters:', err);
      });
  }, [selectedCompanyId, isDemoMode, pos]);

  // 3. Load Statement Data when filters or operational records change
  const loadStatement = async () => {
    if (!selectedCompanyId) {
      setStatementData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const selectedPO = purchaseOrders.find((p) => p.id === selectedPoId);
      const data = await StatementService.getStatementData(
        {
          companyId: selectedCompanyId,
          styleNo: selectedStyleNo,
          itemName: selectedItemName,
          poId: selectedPoId === 'all' ? undefined : selectedPoId,
          poNumber: selectedPO?.poNumber
        },
        isDemoMode
      );
      setStatementData(data);
    } catch (err: any) {
      console.error('Failed to generate statement:', err);
      setError(err.message || 'Failed to generate statement.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatement();
  }, [selectedCompanyId, selectedStyleNo, selectedItemName, selectedPoId, isDemoMode, pos, inwards, outwards]);

  // 4. Load Invoice History
  const loadInvoiceHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const history = await StatementService.getInvoiceHistory(
        selectedCompanyId || undefined,
        isDemoMode
      );
      setInvoiceHistory(history);
    } catch (err) {
      console.error('Failed to load invoice history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadInvoiceHistory();
    }
  }, [activeTab, selectedCompanyId, isDemoMode]);

  // Filter Reset Handler
  const handleResetFilters = () => {
    setSelectedStyleNo('all');
    setSelectedItemName('all');
    setSelectedPoId('all');
  };

  // Explicit Invoice Approval Handler
  const handleApproveLine = async (poId: string, poLineId: string) => {
    if (!canManage) {
      alert('Only Admin and Manager roles are authorized to approve colour lines for invoicing.');
      return;
    }

    setIsApproving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'admin-user',
        displayName: user?.displayName || user?.email?.split('@')[0] || 'Authorized User'
      };

      await StatementService.approveStatementLineForInvoice(
        {
          poId,
          poLineId,
          companyId: selectedCompanyId
        },
        activeUser,
        isDemoMode
      );

      // Trigger callback to parent if supplied
      if (onApproveForInvoice) {
        onApproveForInvoice(poLineId);
      }

      // Refresh statement data to update badges and readiness
      await loadStatement();

      setToast({
        type: 'success',
        message: 'Colour line successfully approved and moved to Invoice module!'
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to approve colour line for invoice.'
      });
      throw err;
    } finally {
      setIsApproving(false);
    }
  };

  // Entire PO Invoice Approval Handler (For POs with more than 1 colour)
  const handleApproveEntirePO = async (poId: string) => {
    if (!canManage) {
      alert('Only Admin and Manager roles are authorized to approve for invoicing.');
      return;
    }

    setIsApproving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'admin-user',
        displayName: user?.displayName || user?.email?.split('@')[0] || 'Authorized User'
      };

      const result = await StatementService.approveEntirePOForInvoice(
        {
          poId,
          companyId: selectedCompanyId
        },
        activeUser,
        isDemoMode
      );

      // Refresh statement data to update badges and readiness
      await loadStatement();

      setToast({
        type: 'success',
        message: `Entire PO approved! ${result.approvedRecords.length} colour(s) moved to Invoice module${
          result.skippedLineCount > 0 ? ` (${result.skippedLineCount} previously moved colour(s) skipped)` : ''
        }.`
      });
    } catch (err: any) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to approve entire PO for invoice.'
      });
      throw err;
    } finally {
      setIsApproving(false);
    }
  };

  // Export CSV Handler
  const handleExportCsv = () => {
    if (!statementData) return;
    try {
      const csvContent = StatementService.exportStatementToCsv(statementData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeCompany = statementData.companyName.replace(/[^a-zA-Z0-9]/g, '_');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `Perla_Statement_${safeCompany}_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export statement:', err);
      alert('Failed to generate export file.');
    }
  };

  const selectedCompany = companies.find(
    (c) => c.id === selectedCompanyId || c.vendorId === selectedCompanyId
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#000000] tracking-tight">Statement</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete inward and outward transaction audit ledger for customer styles and purchase orders.
          </p>
        </div>       
      </div>

      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs transition-all shadow-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{toast.message}</span>
          </div>
          <div className="flex items-center gap-3">
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={toast.onAction}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                {toast.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Filter Ribbon (Visible in both views) */}
      <StatementFilters
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        onSelectCompany={(cid) => {
          setSelectedCompanyId(cid);
          setSelectedStyleNo('all');
          setSelectedItemName('all');
          setSelectedPoId('all');
        }}
        styles={styles}
        selectedStyleNo={selectedStyleNo}
        onSelectStyle={setSelectedStyleNo}
        items={items}
        selectedItemName={selectedItemName}
        onSelectItem={setSelectedItemName}
        purchaseOrders={purchaseOrders}
        selectedPoId={selectedPoId}
        onSelectPo={(poId, styleNo) => {
          setSelectedPoId(poId);
          if (styleNo) setSelectedStyleNo(styleNo);
          else if (poId === 'all') setSelectedStyleNo('all');
        }}
        onReset={handleResetFilters}
        onRefresh={() => {
          loadStatement();
          if (selectedCompanyId) {
            StatementService.getFilterOptions(selectedCompanyId, isDemoMode)
              .then((res) => {
                setStyles(res.styles);
                setItems(res.items);
                setPurchaseOrders(res.purchaseOrders);
              })
              .catch(console.error);
          }
        }}
        onExportCsv={handleExportCsv}
        isLoading={isLoading}
        hasData={Boolean(statementData && statementData.hasTransactions)}
      />

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{error}</div>
          <button
            onClick={loadStatement}
            className="text-xs font-bold underline hover:text-rose-950 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* View 1: Active Statement */}
      {activeTab === 'active' && (
        <>
          {!selectedCompanyId ? (
            <div className="p-16 text-center bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs space-y-3">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                Please select a Customer Company above
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Select a customer company from the dropdown to load its styles, purchase orders, and side-by-side reconciliation statement.
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="w-8 h-8 border-3 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-slate-500 font-semibold">
                Loading side-by-side reconciliation statement...
              </p>
            </div>
          ) : statementData ? (
            <div className="space-y-6">
              {/* 1. Colour-Wise Statement & Invoice Readiness Strip */}
              <ColourReconciliationStrip
                colourLines={statementData.colourLines}
                companyName={statementData.companyName}
                onApproveLine={handleApproveLine}
                onApproveEntirePO={handleApproveEntirePO}
                isApproving={isApproving}
              />

              {/* 2. Side-by-Side Inward vs Outward Main Ledger Table (Follows reference drawing) */}
              <StatementLedgerTable
                inwards={statementData.inwards}
                outwards={statementData.outwards}
                unitTotals={statementData.unitTotals}
                companyName={statementData.companyName}
              />
            </div>
          ) : null}
        </>
      )}

      {/* View 2: Invoice History */}
      {activeTab === 'history' && (
        <InvoiceHistoryTable
          historyItems={invoiceHistory}
          companyName={selectedCompany?.companyName}
          onRefresh={loadInvoiceHistory}
          isLoading={isLoadingHistory}
        />
      )}
    </div>
  );
};
