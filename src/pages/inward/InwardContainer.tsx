import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import {
  InwardEntry,
  InwardFilterOptions,
  InwardPagination,
  InwardDashboardMetrics,
  InwardAuditLog
} from '../../types/inward';
import { InwardService } from '../../services/inwardService';
import { POService } from '../../services/poService';
import { VendorService } from '../../services/vendorService';
import { useAuth } from '../../context/AuthContext';
import { InwardDashboard } from './components/InwardDashboard';
import { InwardList } from './components/InwardList';
import { InwardForm } from './components/InwardForm';
import { InwardDetails } from './components/InwardDetails';
import { InwardPrintView } from './components/InwardPrintView';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface InwardContainerProps {
  initialPOs?: PurchaseOrder[];
  initialInwards?: InwardEntry[];
  initialVendors?: Vendor[];
  onAddInward?: (newInward: InwardEntry) => void;
}

export const InwardContainer: React.FC<InwardContainerProps> = ({
  initialPOs,
  initialInwards,
  initialVendors,
  onAddInward
}) => {
  const { user, activeRole, isDemoMode } = useAuth();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager';
  const isAdmin = activeRole === 'Admin' || (user as any)?.role === 'Admin' || (user as any)?.role === 'admin';

  // Navigation Views
  const [currentView, setCurrentView] = useState<'list' | 'add' | 'edit' | 'details' | 'print'>('list');
  const [selectedInwardId, setSelectedInwardId] = useState<string | null>(null);

  // Data States
  const [inwards, setInwards] = useState<InwardEntry[]>(initialInwards || []);
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs || []);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors || []);
  const [pagination, setPagination] = useState<InwardPagination>({
    page: 1,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState<InwardFilterOptions>({
    searchQuery: '',
    status: 'all'
  });

  const [metrics, setMetrics] = useState<InwardDashboardMetrics>({
    totalInwardCount: 0,
    draftCount: 0,
    postedCount: 0,
    reversedCount: 0,
    totalPiecesReceived: 0,
    totalKgReceived: 0,
    pendingInwardPieces: 0,
    pendingInwardKg: 0
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Selected Inward Details & Logs
  const [selectedInwardDetails, setSelectedInwardDetails] = useState<{
    inward: InwardEntry | null;
    logs: InwardAuditLog[];
  }>({ inward: null, logs: [] });

  // Reversal Modal State from List
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null);
  const [reverseModalReason, setReverseModalReason] = useState('');
  const [reverseModalError, setReverseModalError] = useState<string | null>(null);

  // Load Inward data, POs, and Vendors
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Inward entries
      const inwResult = await InwardService.getInwardEntries(
        filters,
        { page: pagination.page, pageSize: pagination.pageSize },
        isDemoMode
      );
      setInwards(inwResult.inwards);
      setPagination(inwResult.pagination);

      // 2. Fetch metrics
      const metricResult = await InwardService.getInwardDashboardMetrics(isDemoMode);
      setMetrics(metricResult);

      // 3. Fetch latest POs
      const poResult = await POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, isDemoMode);
      if (poResult.pos && poResult.pos.length > 0) {
        setPos(poResult.pos);
      }

      // 4. Fetch latest Vendors
      const vResult = await VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemoMode);
      if (vResult.vendors && vResult.vendors.length > 0) {
        setVendors(vResult.vendors);
      }
    } catch (err) {
      console.error('Failed to load inward data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, pagination.page, isDemoMode]);

  // Load single inward details
  const loadSingleInward = async (inwardId: string) => {
    setLoading(true);
    try {
      const result = await InwardService.getInwardEntryById(inwardId, isDemoMode);
      setSelectedInwardDetails(result);
      setSelectedInwardId(inwardId);
    } catch (err) {
      console.error('Failed to load inward receipt details:', err);
    } finally {
      setLoading(false);
    }
  };

  // View handlers
  const handleViewDetails = async (inwardId: string) => {
    await loadSingleInward(inwardId);
    setCurrentView('details');
  };

  const handlePrint = async (inwardId: string) => {
    await loadSingleInward(inwardId);
    setCurrentView('print');
  };

  const handleEditDraft = async (inwardId: string) => {
    await loadSingleInward(inwardId);
    setCurrentView('edit');
  };

  const handleDeleteInward = async (inwardId: string) => {
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Admin User'
      };
      await InwardService.deleteInwardReceipt(inwardId, activeUser, isDemoMode);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting inward receipt: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewInward = () => {
    setSelectedInwardId(null);
    setSelectedInwardDetails({ inward: null, logs: [] });
    setCurrentView('add');
  };

  // Form Submission: Save Draft
  const handleSaveDraft = async (data: any) => {
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User'
      };

      const savedDraft = await InwardService.createInwardDraft(data, activeUser, isDemoMode);

      if (onAddInward) {
        onAddInward(savedDraft);
      }

      await loadData();
      await handleViewDetails(savedDraft.inwardId);
    } catch (err: any) {
      alert(`Error saving draft: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Form Submission: Post Inward Receipt
  const handlePostReceipt = async (data: any) => {
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User'
      };

      const posted = await InwardService.postInwardReceipt(data, activeUser, isDemoMode);

      if (onAddInward) {
        onAddInward(posted);
      }

      await loadData();
      await handleViewDetails(posted.inwardId);
    } catch (err: any) {
      alert(`Error posting inward receipt: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reversal handler from Details view
  const handleReverseReceipt = async (reason: string) => {
    if (!selectedInwardId) return;
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User'
      };

      const reversed = await InwardService.reverseInwardReceipt(selectedInwardId, reason, activeUser, isDemoMode);

      if (onAddInward) {
        onAddInward(reversed);
      }

      await loadData();
      await loadSingleInward(selectedInwardId);
    } catch (err: any) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Direct post handler from Details view
  const handleDirectPostDraft = async () => {
    const targetId = selectedInwardId || selectedInwardDetails.inward?.inwardId;
    if (!targetId) return;
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User'
      };

      const posted = await InwardService.postExistingDraft(targetId, activeUser, isDemoMode);

      if (onAddInward) {
        onAddInward(posted);
      }

      await loadData();
      await loadSingleInward(posted.inwardId);
    } catch (err: any) {
      alert(`Error posting draft inward receipt: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick reversal from list view
  const handleConfirmListReverse = async () => {
    if (!reverseTargetId) return;
    if (!reverseModalReason || reverseModalReason.trim().length < 5) {
      setReverseModalError('Please enter a detailed reversal reason of at least 5 characters.');
      return;
    }

    setIsSaving(true);
    try {
      setReverseModalError(null);
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User'
      };

      const reversed = await InwardService.reverseInwardReceipt(
        reverseTargetId,
        reverseModalReason.trim(),
        activeUser,
        isDemoMode
      );

      if (onAddInward) {
        onAddInward(reversed);
      }

      setReverseTargetId(null);
      setReverseModalReason('');
      await loadData();
    } catch (err: any) {
      setReverseModalError(err?.message || 'Failed to reverse receipt.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Inward Dashboard Metrics (always visible on list view) */}
      {currentView === 'list' && (
        <InwardDashboard
          metrics={metrics}
          onFilterStatus={(status) => setFilters((prev) => ({ ...prev, status: status as any }))}
        />
      )}

      {/* 2. Main Inward List View */}
      {currentView === 'list' && (
        <InwardList
          inwards={inwards}
          vendors={vendors}
          pos={pos}
          pagination={pagination}
          filters={filters}
          onFilterChange={(newFilters) => setFilters(newFilters)}
          onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
          onNewInward={handleNewInward}
          onViewDetails={handleViewDetails}
          onPrint={handlePrint}
          onEdit={handleEditDraft}
          onDelete={handleDeleteInward}
          canManage={canManage}
          isAdmin={isAdmin}
          isLoading={loading}
        />
      )}

      {/* 3. New Inward / Edit Draft Form */}
      {(currentView === 'add' || currentView === 'edit') && (
        <InwardForm
          pos={pos}
          vendors={vendors}
          initialInward={currentView === 'edit' ? selectedInwardDetails.inward : null}
          onSaveDraft={handleSaveDraft}
          onPostReceipt={handlePostReceipt}
          onCancel={() => setCurrentView('list')}
          isSaving={isSaving}
        />
      )}

      {/* 4. Inward Details View */}
      {currentView === 'details' && selectedInwardDetails.inward && (
        <InwardDetails
          inward={selectedInwardDetails.inward}
          auditLogs={selectedInwardDetails.logs}
          onBack={() => setCurrentView('list')}
          onPrint={() => setCurrentView('print')}
          onEditDraft={() => setCurrentView('edit')}
          onPostDraft={handleDirectPostDraft}
          onReverse={handleReverseReceipt}
          canManage={canManage}
          isProcessing={isSaving}
        />
      )}

      {/* 5. Inward Delivery Note Print View */}
      {currentView === 'print' && selectedInwardDetails.inward && (
        <InwardPrintView
          inward={selectedInwardDetails.inward}
          onBack={() => setCurrentView('details')}
        />
      )}

      {/* Quick Reversal Modal for List View */}
      <Modal
        isOpen={!!reverseTargetId}
        onClose={() => setReverseTargetId(null)}
        title="Authorised Inward Reversal"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <span className="font-bold block mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Warning: Authorised Inward Reversal
            </span>
            This action will mark the receipt as reversed, adjust cumulative balances, and recalculate PO completion.
            Reversal will be prevented if any quantities have already been dispatched in Outward.
          </div>

          {reverseModalError && (
            <div className="p-2.5 bg-rose-100 text-rose-800 rounded font-medium">
              {reverseModalError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reversal Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Returned to customer / Duplicate DC entry error."
              value={reverseModalReason}
              onChange={(e) => setReverseModalReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setReverseTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleConfirmListReverse}
              disabled={isSaving}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              {isSaving ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
