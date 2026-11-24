import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../types/inwardOutward';
import { StatementDataResponse } from '../../types/statement';
import { StatementService } from '../../services/statementService';
import { StatementPdfService } from '../../services/statementPdfService';
import { useNavigate } from 'react-router-dom';
import { StatementFilters } from './components/StatementFilters';
import { StatementLedgerTable } from './components/StatementLedgerTable';
import { StatementReport } from './components/StatementReport';
import { useAuth } from '../../context/AuthContext';
import { Building2, AlertTriangle, CheckCircle2, ArrowRight, X } from 'lucide-react';

interface StatementPageProps {
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  vendors?: Vendor[];
  approvedPoLineIds?: string[];
  invoicedPoLineIds?: string[];
  onApproveForInvoice?: (poLineId: string) => void;
}

export const StatementPage: React.FC<StatementPageProps> = ({
  pos,
  inwards,
  outwards,
  vendors,
  approvedPoLineIds = [],
  invoicedPoLineIds = [],
  onApproveForInvoice
}) => {
  const { user, isDemoMode, activeRole } = useAuth();
  const navigate = useNavigate();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager';

  // Navigation tab: Active Statement vs Report Generation
  const [activeTab, setActiveTab] = useState<'active' | 'report'>('active');

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
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // 1. Initial Load: Filter Options for Companies
  useEffect(() => {
    StatementService.getFilterOptions(undefined, isDemoMode)
      .then((res) => {
        setCompanies(res.companies);
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

  // Filter Reset Handler
  const handleResetFilters = () => {
    setSelectedStyleNo('all');
    setSelectedItemName('all');
    setSelectedPoId('all');
  };

  // Download PDF Handler (matching delivery statement format from photo)
  const handleDownloadPdf = () => {
    if (!statementData) return;
    try {
      const selectedPO = purchaseOrders.find((p) => p.id === selectedPoId);
      StatementPdfService.downloadStatementPdf({
        companyName: statementData.companyName,
        styleNo: selectedStyleNo !== 'all' ? selectedStyleNo : statementData.styleNo,
        poNumber: selectedPoId !== 'all' ? (selectedPO?.poNumber || statementData.poNumber) : statementData.poNumber,
        itemName: selectedItemName !== 'all' ? selectedItemName : statementData.itemName,
        inwards: statementData.inwards,
        outwards: statementData.outwards
      });
    } catch (err) {
      console.error('Failed to download statement PDF:', err);
      alert('Failed to generate statement PDF.');
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
      {/* Top Header - Minimal & Airy with Navigation Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Statement</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete inward and outward transaction audit ledger for customer styles and purchase orders
          </p>
        </div>

        {/* Section Navigation Tabs (Text only, no icons) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reconciliation Ledger
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'report'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Report Generation
          </button>
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

      {/* View 1: Active Statement */}
      {activeTab === 'active' && (
        <>
          {/* Top Filter Ribbon */}
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
            onDownloadPdf={handleDownloadPdf}
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
              {/* Side-by-Side Inward vs Outward Main Ledger Table (Follows reference drawing) */}
              <StatementLedgerTable
                inwards={statementData.inwards}
                outwards={statementData.outwards}
                unitTotals={statementData.unitTotals}
                companyName={statementData.companyName}
                styleNo={selectedStyleNo !== 'all' ? selectedStyleNo : statementData.styleNo}
                poNumber={selectedPoId !== 'all' ? (purchaseOrders.find((p) => p.id === selectedPoId)?.poNumber || statementData.poNumber) : statementData.poNumber}
                itemName={selectedItemName !== 'all' ? selectedItemName : statementData.itemName}
                onExportCsv={handleExportCsv}
              />
            </div>
          ) : null}
        </>
      )}

      {/* View 2: Report Generation (Comprehensive Report with Subrows, Filters & PDF/Excel Exports) */}
      {activeTab === 'report' && (
        <StatementReport
          pos={pos}
          inwards={inwards}
          outwards={outwards}
          vendors={vendors}
          onBack={() => setActiveTab('active')}
        />
      )}
    </div>
  );
};
