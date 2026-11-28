import React, { useState, useEffect } from 'react';
import { PurchaseOrder } from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry } from '../../types/inward';
import {
  OutwardEntry,
  OutwardFilterOptions,
  OutwardPagination,
  OutwardDashboardMetrics,
  OutwardAuditLog
} from '../../types/outward';
import { OutwardService } from '../../services/outwardService';
import { InwardService } from '../../services/inwardService';
import { POService } from '../../services/poService';
import { VendorService } from '../../services/vendorService';
import { useAuth } from '../../context/AuthContext';
import { OutwardDashboard } from './components/OutwardDashboard';
import { OutwardList } from './components/OutwardList';
import { OutwardForm } from './components/OutwardForm';
import { OutwardDetails } from './components/OutwardDetails';
import { OutwardPrintView } from './components/OutwardPrintView';
import { OutwardReport } from './components/OutwardReport';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Plus } from 'lucide-react';
import { POLockService, POLockStatus } from '../../services/poLockService';

interface OutwardContainerProps {
  initialPOs?: PurchaseOrder[];
  initialInwards?: InwardEntry[];
  initialOutwards?: OutwardEntry[];
  initialVendors?: Vendor[];
  onAddOutward?: (newOutward: OutwardEntry) => void;
  onUpdateOutward?: (outward: OutwardEntry) => void;
}

export const OutwardContainer: React.FC<OutwardContainerProps> = ({
  initialPOs,
  initialInwards,
  initialOutwards,
  initialVendors,
  onAddOutward,
  onUpdateOutward
}) => {
  const { user, activeRole, isDemoMode, canEdit, canDelete } = useAuth();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager' || canEdit('outward');
  const isAdmin =
    activeRole === 'Admin' ||
    (user as any)?.role === 'Admin' ||
    (user as any)?.role === 'admin' ||
    (user as any)?.designation?.toLowerCase() === 'admin' ||
    canDelete('outward');

  // Navigation Views: 'list' | 'report' | 'add' | 'edit' | 'details' | 'print'
  const [currentView, setCurrentView] = useState<'list' | 'report' | 'add' | 'edit' | 'details' | 'print'>('list');
  const [selectedOutwardId, setSelectedOutwardId] = useState<string | null>(null);
  const [preselectedPoId, setPreselectedPoId] = useState<string | null>(null);

  // Data States
  const [outwards, setOutwards] = useState<OutwardEntry[]>(initialOutwards || []);
  const [allPostedOutwards, setAllPostedOutwards] = useState<OutwardEntry[]>([]);
  const [inwards, setInwards] = useState<InwardEntry[]>(initialInwards || []);
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs || []);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors || []);
  const [pagination, setPagination] = useState<OutwardPagination>({
    page: 1,
    pageSize: 1000,
    totalCount: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState<OutwardFilterOptions>({
    searchQuery: '',
    status: 'all'
  });

  const [metrics, setMetrics] = useState<OutwardDashboardMetrics>({
    totalOutwardsCount: 0,
    postedOutwardsCount: 0,
    draftOutwardsCount: 0,
    reversedOutwardsCount: 0,
    totalPiecesDispatched: 0,
    totalKgDispatched: 0,
    totalPiecesAvailableToDispatch: 0,
    totalKgAvailableToDispatch: 0
  });

  const [loading, setLoading] = useState(!initialOutwards || initialOutwards.length === 0);
  const [isSaving, setIsSaving] = useState(false);
  const [lockedPOMap, setLockedPOMap] = useState<Record<string, POLockStatus>>({});

  // Selected Outward Details & Logs
  const [selectedOutwardDetails, setSelectedOutwardDetails] = useState<{
    outward: OutwardEntry | null;
    logs: OutwardAuditLog[];
  }>({ outward: null, logs: [] });

  // Reversal Modal State from List
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null);
  const [reverseModalReason, setReverseModalReason] = useState('');
  const [reverseModalError, setReverseModalError] = useState<string | null>(null);

  // Load outward dispatches, POs, and Vendors in parallel
  const loadData = async () => {
    if (outwards.length === 0 && (!initialOutwards || initialOutwards.length === 0)) {
      setLoading(true);
    }
    try {
      // Execute all independent network queries concurrently via Promise.all
      const [outwResult, poResult, vResult, inwResult, postedOutwards, lockMap] = await Promise.all([
        OutwardService.getOutwardEntries(
          filters,
          { page: pagination.page, pageSize: pagination.pageSize },
          isDemoMode
        ),
        POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, isDemoMode),
        VendorService.getVendors({}, { page: 1, pageSize: 500 }, isDemoMode),
        InwardService.getInwardEntries({}, { page: 1, pageSize: 1000 }, isDemoMode),
        OutwardService.getAllPostedOutwards(isDemoMode).catch((outwErr) => {
          console.warn('Failed to load all posted outwards:', outwErr);
          return [];
        }),
        POLockService.getLockedPOMap(isDemoMode).catch((lockErr) => {
          console.warn('Failed to load PO lock map:', lockErr);
          return {};
        })
      ]);

      setOutwards(outwResult.outwards);
      setPagination(outwResult.pagination);
      setPos(poResult.pos || []);
      setVendors(vResult.vendors || []);
      setInwards(inwResult.inwards && inwResult.inwards.length > 0 ? inwResult.inwards : []);
      setAllPostedOutwards(postedOutwards || []);
      setLockedPOMap(lockMap || {});

      // Compute metrics directly in memory (eliminates redundant full database re-fetch)
      const entries = outwResult.outwards || [];
      let draftCount = 0;
      let postedCount = 0;
      let reversedCount = 0;
      let totalPiecesDispatched = 0;
      let totalKgDispatched = 0;

      for (const item of entries) {
        if (item.status === 'draft') draftCount++;
        else if (item.status === 'posted') {
          postedCount++;
          totalPiecesDispatched += item.totalQtyByUnit?.piece || 0;
          totalKgDispatched += item.totalQtyByUnit?.kg || 0;
        } else if (item.status === 'reversed') reversedCount++;
      }

      setMetrics({
        totalOutwardsCount: outwResult.pagination?.totalCount || entries.length,
        postedOutwardsCount: postedCount,
        postedCount,
        draftOutwardsCount: draftCount,
        draftCount,
        reversedOutwardsCount: reversedCount,
        reversedCount,
        totalPiecesDispatched,
        totalKgDispatched,
        totalPiecesAvailableToDispatch: 0,
        totalKgAvailableToDispatch: 0
      });
    } catch (err) {
      console.error('Failed to load outward data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, pagination.page, isDemoMode]);

  useEffect(() => {
    if (initialPOs && initialPOs.length > 0) {
      setPos(initialPOs);
    }
  }, [initialPOs]);

  useEffect(() => {
    if (initialInwards && initialInwards.length > 0) {
      setInwards(initialInwards);
    }
  }, [initialInwards]);

  useEffect(() => {
    if (initialOutwards && initialOutwards.length > 0) {
      setOutwards(initialOutwards);
      setLoading(false);
    }
  }, [initialOutwards]);

  // Load single outward details (instant from in-memory list when available, hydrate logs in background)
  const loadSingleOutward = async (outwardId: string, background: boolean = false) => {
    const cached = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId) || null;
    if (cached) {
      setSelectedOutwardDetails((prev) => ({
        outward: cached,
        logs: prev.outward?.outwardId === outwardId || prev.outward?.id === outwardId ? prev.logs : []
      }));
      setSelectedOutwardId(outwardId);
    } else if (!background) {
      setLoading(true);
    }

    try {
      const result = await OutwardService.getOutwardEntryById(outwardId, isDemoMode);
      if (result.outward) {
        setSelectedOutwardDetails(result);
        setSelectedOutwardId(outwardId);
      }
    } catch (err) {
      console.error('Failed to load outward dispatch details:', err);
    } finally {
      if (!cached && !background) {
        setLoading(false);
      }
    }
  };

  // View handlers (instant navigation using cached record; audit logs hydrate in background)
  const handleViewDetails = (outwardId: string) => {
    const cached = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId);
    if (cached) {
      setSelectedOutwardDetails({ outward: cached, logs: [] });
      setSelectedOutwardId(outwardId);
      setCurrentView('details');
      loadSingleOutward(outwardId, true).catch(console.warn);
      return;
    }
    loadSingleOutward(outwardId).then(() => setCurrentView('details'));
  };

  const handlePrint = (outwardId: string) => {
    const cached = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId);
    if (cached) {
      setSelectedOutwardDetails({ outward: cached, logs: [] });
      setSelectedOutwardId(outwardId);
      setCurrentView('print');
      loadSingleOutward(outwardId, true).catch(console.warn);
      return;
    }
    loadSingleOutward(outwardId).then(() => setCurrentView('print'));
  };

  const handleEdit = (outwardId: string) => {
    const target = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId);
    const lock = POLockService.isLocked(target, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }
    if (target) {
      setSelectedOutwardDetails({ outward: target, logs: [] });
      setSelectedOutwardId(outwardId);
      setCurrentView('edit');
      loadSingleOutward(outwardId, true).catch(console.warn);
      return;
    }
    loadSingleOutward(outwardId).then(() => setCurrentView('edit'));
  };

  const handleNewOutward = () => {
    setSelectedOutwardDetails({ outward: null, logs: [] });
    setSelectedOutwardId(null);
    setPreselectedPoId(null);
    setCurrentView('add');
    if (pos.length === 0 || inwards.length === 0) {
      loadData().catch(console.warn);
    }
  };

  const handleSelectQuickOutwardPo = (po: PurchaseOrder) => {
    setSelectedOutwardDetails({ outward: null, logs: [] });
    setSelectedOutwardId(null);
    setPreselectedPoId(po.id || po.poId);
    setCurrentView('add');
    if (pos.length === 0 || inwards.length === 0) {
      loadData().catch(console.warn);
    }
  };

  // Action: Save Draft
  const handleSaveDraft = async (data: any) => {
    setIsSaving(true);
    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Authorized User'
      };

      let draftEntry: OutwardEntry;
      if (currentView === 'edit' && selectedOutwardId) {
        draftEntry = await OutwardService.updateDraftOutwardEntry(selectedOutwardId, data, userMeta, isDemoMode);
        setOutwards((prev) =>
          prev.map((o) => (o.outwardId === selectedOutwardId || o.id === selectedOutwardId ? draftEntry : o))
        );
      } else {
        draftEntry = await OutwardService.createDraftOutwardEntry(data, userMeta, isDemoMode);
        setOutwards((prev) => [draftEntry, ...prev]);
        if (onAddOutward) onAddOutward(draftEntry);
      }

      setIsSaving(false);
      setPreselectedPoId(null);
      setCurrentView('list');
      loadData().catch(console.warn);
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      setIsSaving(false);
      throw err;
    }
  };

  // Action: Post Outward Dispatch
  const handlePostOutward = async (data: any) => {
    setIsSaving(true);
    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Authorized User',
        role: activeRole || 'Manager'
      };

      let postedEntry: OutwardEntry;
      if (currentView === 'edit' && selectedOutwardId) {
        if (selectedOutwardDetails.outward?.status === 'draft') {
          postedEntry = await OutwardService.postExistingDraft(selectedOutwardId, data, userMeta, isDemoMode);
        } else {
          postedEntry = await OutwardService.updateDraftOutwardEntry(selectedOutwardId, data, userMeta, isDemoMode);
        }
      } else {
        postedEntry = await OutwardService.postOutwardEntry(data, userMeta, isDemoMode);
      }

      // Immediately update in-memory list (0ms delay)
      setOutwards((prev) => [
        postedEntry,
        ...prev.filter(
          (o) => (o.outwardId || o.id) !== (postedEntry.outwardId || postedEntry.id)
        )
      ]);

      if (onAddOutward) onAddOutward(postedEntry);

      // Immediately dismiss saving overlay and navigate to details
      setIsSaving(false);
      setSelectedOutwardId(postedEntry.outwardId || postedEntry.id);
      setSelectedOutwardDetails({ outward: postedEntry, logs: [] });
      setPreselectedPoId(null);
      setCurrentView('details');

      // Refresh data in background non-blocking
      loadData().catch(console.warn);
      loadSingleOutward(postedEntry.outwardId || postedEntry.id, true).catch(console.warn);
    } catch (err: any) {
      console.error('Failed to post outward dispatch:', err);
      setIsSaving(false);
      throw err;
    }
  };

  // Action: Move Draft to Posted from Details view
  const handlePostExistingDraft = async () => {
    if (!selectedOutwardDetails.outward) return;
    setIsSaving(true);
    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Authorized User',
        role: activeRole || 'Manager'
      };

      const out = selectedOutwardDetails.outward;
      const targetId = out.outwardId || out.id;
      const posted = await OutwardService.postExistingDraft(
        targetId,
        {
          customerVendorId: out.customerVendorId,
          subcontractorVendorId: out.subcontractorVendorId,
          poId: out.poId,
          outwardDate: out.outwardDate,
          ourDcNo: out.ourDcNo,
          vehicleNumber: out.vehicleNumber,
          driverName: out.driverName,
          transporterVendorId: out.transporterVendorId,
          destination: out.destination,
          remarks: out.remarks,
          lines: out.lines
        },
        userMeta,
        isDemoMode
      );

      setOutwards((prev) =>
        prev.map((o) => (o.outwardId === targetId || o.id === targetId ? posted : o))
      );
      setSelectedOutwardDetails((prev) => ({ ...prev, outward: posted }));

      if (onUpdateOutward) {
        onUpdateOutward(posted);
      }

      setIsSaving(false);
      loadData().catch(console.warn);
      loadSingleOutward(targetId).catch(console.warn);
    } catch (err) {
      console.error('Failed to move draft to posted:', err);
      alert((err as any)?.message || 'Failed to move draft to posted.');
      setIsSaving(false);
    }
  };

  // Action: Reverse Outward
  const handleReverseOutward = async (reason: string) => {
    const targetId = selectedOutwardId || reverseTargetId;
    if (!targetId) return;

    const target = outwards.find((o) => o.outwardId === targetId || o.id === targetId) || selectedOutwardDetails.outward;
    const lock = POLockService.isLocked(target, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }

    setIsSaving(true);
    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Authorized User'
      };

      const reversed = await OutwardService.reverseOutwardEntry(targetId, reason, userMeta, isDemoMode);
      if (onUpdateOutward) {
        onUpdateOutward(reversed);
      }
      await loadData();

      if (currentView === 'details') {
        await loadSingleOutward(targetId);
      } else {
        setReverseTargetId(null);
        setReverseModalReason('');
      }
    } catch (err: any) {
      console.error('Failed to reverse outward dispatch:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Action: Delete Draft
  const handleDeleteDraft = async (outwardId: string) => {
    const target = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId) || selectedOutwardDetails.outward;
    const lock = POLockService.isLocked(target, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }

    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Admin User'
      };
      await OutwardService.deleteOutwardEntry(outwardId, userMeta, isDemoMode);
      await loadData();
    } catch (err) {
      console.error('Failed to delete draft:', err);
      alert((err as any)?.message || 'Failed to delete draft.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Section Tabs (Top Right aligned, matching Inward) */}
      {(currentView === 'list' || currentView === 'report') && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Outward Dispatches</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate delivery challans, track completed processing batches, and dispatch goods
            </p>
          </div>

          {/* Section Tabs on Top Right */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrentView('list')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                currentView === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Outwards</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
                {outwards.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('report')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                currentView === 'report'
                  ? 'bg-white text-[#1F4E79] shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Report Generation</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Dashboard Metrics (Visible on List view) */}
      {currentView === 'list' && (
        <OutwardDashboard
          metrics={metrics}
          onFilterStatus={(st) => setFilters((prev) => ({ ...prev, status: st as any }))}
        />
      )}

      {/* 2. List View */}
      {currentView === 'list' && (
        <OutwardList
          outwards={outwards}
          vendors={vendors}
          pos={pos}
          inwards={inwards}
          pagination={pagination}
          filters={filters}
          onFilterChange={setFilters}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
          onNewOutward={handleNewOutward}
          onSelectPoForOutward={handleSelectQuickOutwardPo}
          onViewDetails={handleViewDetails}
          onPrint={handlePrint}
          onEdit={handleEdit}
          onDelete={handleDeleteDraft}
          onReverse={(id) => {
            setReverseTargetId(id);
            setReverseModalReason('');
            setReverseModalError(null);
          }}
          canManage={canManage}
          isAdmin={isAdmin}
          isLoading={loading}
          lockedPOMap={lockedPOMap}
        />
      )}

      {/* 2.2 Outward Report Generation View */}
      {currentView === 'report' && (
        <OutwardReport
          outwards={outwards}
          vendors={vendors}
          pos={pos}
          onBack={() => setCurrentView('list')}
          onViewOutward={handleViewDetails}
        />
      )}

      {/* 3. Add / Edit Form View */}
      {(currentView === 'add' || currentView === 'edit') && (
        <OutwardForm
          pos={pos}
          vendors={vendors}
          inwards={inwards}
          outwards={allPostedOutwards}
          initialOutward={currentView === 'edit' ? selectedOutwardDetails.outward : null}
          initialPoId={currentView === 'add' ? preselectedPoId : null}
          onSaveDraft={handleSaveDraft}
          onPostOutward={handlePostOutward}
          onCancel={() => {
            setPreselectedPoId(null);
            setCurrentView('list');
          }}
          isSaving={isSaving}
        />
      )}

      {/* 4. Details View */}
      {currentView === 'details' && selectedOutwardDetails.outward && (
        <OutwardDetails
          outward={selectedOutwardDetails.outward}
          auditLogs={selectedOutwardDetails.logs}
          inwards={inwards}
          vendors={vendors}
          lockedPOMap={lockedPOMap}
          onBack={() => setCurrentView('list')}
          onPrint={() => setCurrentView('print')}
          onEditDraft={() => setCurrentView('edit')}
          onPostDraft={handlePostExistingDraft}
          onReverse={handleReverseOutward}
          canManage={canManage}
          isProcessing={isSaving}
        />
      )}

      {/* 5. Print DC View */}
      {currentView === 'print' && selectedOutwardDetails.outward && (
        <OutwardPrintView
          outward={selectedOutwardDetails.outward}
          inwards={inwards}
          vendors={vendors}
          onBack={() => setCurrentView('details')}
        />
      )}

      {/* Modal for Reversing Outward from List View */}
      {reverseTargetId && (
        <Modal
          isOpen={true}
          onClose={() => setReverseTargetId(null)}
          title="Reverse Outward Dispatch"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Are you sure you want to reverse this outward dispatch? Restores available dispatch
              balance back to the linked Purchase Order.
            </p>

            {reverseModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {reverseModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Reversal Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this dispatch is being reversed (e.g. wrong batch delivered, customer return, clerical correction)..."
                value={reverseModalReason}
                onChange={(e) => setReverseModalReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReverseTargetId(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                disabled={isSaving}
                onClick={async () => {
                  if (!reverseModalReason || reverseModalReason.trim().length < 5) {
                    setReverseModalError('Reversal reason must be at least 5 characters long.');
                    return;
                  }
                  try {
                    await handleReverseOutward(reverseModalReason.trim());
                  } catch (e: any) {
                    setReverseModalError(e?.message || 'Failed to reverse dispatch.');
                  }
                }}
              >
                {isSaving ? 'Reversing...' : 'Confirm Reversal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
