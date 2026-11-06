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
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
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

  // Navigation Views: 'list' | 'add' | 'edit' | 'details' | 'print'
  const [currentView, setCurrentView] = useState<'list' | 'add' | 'edit' | 'details' | 'print'>('list');
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
    pageSize: 10,
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

  // Load single outward details
  const loadSingleOutward = async (outwardId: string) => {
    setLoading(true);
    try {
      const result = await OutwardService.getOutwardEntryById(outwardId, isDemoMode);
      setSelectedOutwardDetails(result);
      setSelectedOutwardId(outwardId);
    } catch (err) {
      console.error('Failed to load outward dispatch details:', err);
    } finally {
      setLoading(false);
    }
  };

  // View handlers
  const handleViewDetails = async (outwardId: string) => {
    await loadSingleOutward(outwardId);
    setCurrentView('details');
  };

  const handlePrint = async (outwardId: string) => {
    await loadSingleOutward(outwardId);
    setCurrentView('print');
  };

  const handleEdit = async (outwardId: string) => {
    const target = outwards.find((o) => o.outwardId === outwardId || o.id === outwardId);
    const lock = POLockService.isLocked(target, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }
    await loadSingleOutward(outwardId);
    setCurrentView('edit');
  };

  const handleNewOutward = () => {
    setSelectedOutwardDetails({ outward: null, logs: [] });
    setSelectedOutwardId(null);
    setPreselectedPoId(null);
    loadData();
    setCurrentView('add');
  };

  const handleSelectQuickOutwardPo = (po: PurchaseOrder) => {
    setSelectedOutwardDetails({ outward: null, logs: [] });
    setSelectedOutwardId(null);
    setPreselectedPoId(po.id || po.poId);
    loadData();
    setCurrentView('add');
  };

  // Action: Save Draft
  const handleSaveDraft = async (data: any) => {
    setIsSaving(true);
    try {
      const userMeta = {
        uid: user?.uid || 'user-default',
        name: user?.displayName || (user as any)?.name || 'Authorized User'
      };

      if (currentView === 'edit' && selectedOutwardId) {
        await OutwardService.updateDraftOutwardEntry(selectedOutwardId, data, userMeta, isDemoMode);
      } else {
        const newDraft = await OutwardService.createDraftOutwardEntry(data, userMeta, isDemoMode);
        if (onAddOutward) onAddOutward(newDraft);
      }

      await loadData();
      setCurrentView('list');
    } catch (err: any) {
      console.error('Failed to save draft:', err);
      throw err;
    } finally {
      setIsSaving(false);
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

      if (onAddOutward) onAddOutward(postedEntry);

      await loadData();
      await loadSingleOutward(postedEntry.outwardId || postedEntry.id);
      setCurrentView('details');
    } catch (err: any) {
      console.error('Failed to post outward dispatch:', err);
      throw err;
    } finally {
      setIsSaving(false);
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
      const posted = await OutwardService.postExistingDraft(
        out.outwardId || out.id,
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

      if (onUpdateOutward) {
        onUpdateOutward(posted);
      }

      await loadData();
      await loadSingleOutward(posted.outwardId || posted.id);
    } catch (err) {
      console.error('Failed to move draft to posted:', err);
      alert((err as any)?.message || 'Failed to move draft to posted.');
    } finally {
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
