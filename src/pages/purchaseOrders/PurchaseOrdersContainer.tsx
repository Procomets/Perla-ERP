import React, { useState, useEffect, useMemo } from 'react';
import {
  PurchaseOrder,
  POStatus,
  POFilterOptions,
  POPagination,
  POAuditLog,
  POAmendment,
  PODashboardMetrics
} from '../../types/po';
import { Vendor } from '../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../types/inwardOutward';
import { POService } from '../../services/poService';
import { VendorService } from '../../services/vendorService';
import { InwardService } from '../../services/inwardService';
import { OutwardService } from '../../services/outwardService';
import { POList } from './components/POList';
import { POForm } from './components/POForm';
import { PODetails } from './components/PODetails';
import { POPrintView } from './components/POPrintView';
import { POReport } from './components/POReport';
import { PODashboard } from './components/PODashboard';
import { useAuth } from '../../context/AuthContext';
import { hasInwardForPO } from '../../utils/calculations';
import { POLockService, POLockStatus } from '../../services/poLockService';
import { Plus } from 'lucide-react';

interface PurchaseOrdersContainerProps {
  initialPOs?: PurchaseOrder[];
  initialVendors?: Vendor[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  onAddPo?: (newPo: PurchaseOrder) => void;
  onUpdatePo?: (updatedPo: PurchaseOrder) => void;
}

export const PurchaseOrdersContainer: React.FC<PurchaseOrdersContainerProps> = ({
  initialPOs,
  initialVendors,
  inwards = [],
  outwards = [],
  onAddPo,
  onUpdatePo
}) => {
  const { user, activeRole, isDemoMode, canEdit, canDelete } = useAuth();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager' || canEdit('po');
  const isAdmin =
    activeRole === 'Admin' ||
    (user as any)?.role === 'Admin' ||
    (user as any)?.role === 'admin' ||
    (user as any)?.designation?.toLowerCase() === 'admin';
  const canDeletePO = isAdmin || canDelete('po');

  // Navigation State
  const [currentView, setCurrentView] = useState<
    'list' | 'add' | 'edit' | 'details' | 'print' | 'report'
  >('list');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Data States
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs || []);
  const [allPOs, setAllPOs] = useState<PurchaseOrder[]>(initialPOs || []);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors || []);
  const [inwardsList, setInwardsList] = useState<InwardEntry[]>(inwards);
  const [outwardsList, setOutwardsList] = useState<OutwardEntry[]>(outwards);
  const [pagination, setPagination] = useState<POPagination>({
    page: 1,
    pageSize: 1000,
    totalRecords: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState<POFilterOptions>({
    searchQuery: '',
    processCategory: 'all',
    status: 'all'
  });


  const [loading, setLoading] = useState<boolean>(!initialPOs || initialPOs.length === 0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lockedPOMap, setLockedPOMap] = useState<Record<string, POLockStatus>>({});

  // Selected PO detailed data
  const [selectedPoDetails, setSelectedPoDetails] = useState<{
    po: PurchaseOrder | null;
    logs: POAuditLog[];
    amendments: POAmendment[];
  }>({ po: null, logs: [], amendments: [] });

  // Load PO list and metrics in parallel
  const loadData = async () => {
    // Only show full loading spinner if we don't have any data yet
    if (pos.length === 0 && (!initialPOs || initialPOs.length === 0)) {
      setLoading(true);
    }
    try {
      // Execute all independent network queries concurrently via Promise.all
      const [poResult, vResult, inwResult, outResult] = await Promise.all([
        POService.getPurchaseOrders(
          filters,
          { page: pagination.page, pageSize: pagination.pageSize },
          isDemoMode
        ),
        VendorService.getVendors(
          {},
          { page: 1, pageSize: 500 },
          isDemoMode
        ),
        InwardService.getInwardEntries(
          {},
          { page: 1, pageSize: 1000 },
          isDemoMode
        ),
        OutwardService.getOutwardEntries(
          {},
          { page: 1, pageSize: 1000 },
          isDemoMode
        )
      ]);

      const currentPos = poResult.pos || [];
      const lockMap = await POLockService.getLockedPOMap(isDemoMode, false, currentPos).catch((lockErr) => {
        console.warn('Error loading PO lock map:', lockErr);
        return {};
      });

      setPos(poResult.pos);
      if (!filters.status || filters.status === 'all') {
        if (!filters.searchQuery && (!filters.processCategory || filters.processCategory === 'all')) {
          setAllPOs(poResult.pos);
        }
      }
      setPagination(poResult.pagination);
      setVendors(vResult.vendors || []);
      setInwardsList(inwResult.inwards || []);
      setOutwardsList(outResult.outwards || []);
      setLockedPOMap(lockMap || {});
    } catch (err) {
      console.error('Error loading PO data:', err);
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
      setAllPOs(initialPOs);
      setLoading(false);
    }
  }, [initialPOs]);

  // Compute Dashboard Metrics for KPI Strip
  const poMetrics = useMemo<PODashboardMetrics>(() => {
    const sourceList = allPOs.length > 0 ? allPOs : pos;
    let draftCount = 0;
    let approvedCount = 0;
    let cancelledCount = 0;
    let totalPieces = 0;
    let totalKg = 0;
    let totalOrderValue = 0;

    sourceList.forEach((po) => {
      const st = (po.status || '').toLowerCase();
      if (st === 'draft' || st === 'submitted') {
        draftCount++;
      } else if (
        st === 'approved' ||
        st === 'in_progress' ||
        st === 'partially_received' ||
        st === 'fully_received' ||
        st === 'completed'
      ) {
        approvedCount++;
      } else if (st === 'cancelled' || st === 'rejected') {
        cancelledCount++;
      }

      const pieceQty = po.totalQtyByUnit?.piece ?? 0;
      const kgQty = po.totalQtyByUnit?.kg ?? 0;

      if (pieceQty > 0 || kgQty > 0) {
        totalPieces += pieceQty;
        totalKg += kgQty;
      } else {
        const lines = po.colourLines || po.lines || [];
        if (lines.length > 0) {
          lines.forEach((l) => {
            const unit = (l.unit || 'piece').toLowerCase();
            const q = Number(l.quantity) || 0;
            if (unit === 'kg') {
              totalKg += q;
            } else {
              totalPieces += q;
            }
          });
        } else {
          totalPieces += Number(po.totalQuantity) || 0;
        }
      }

      totalOrderValue += Number(po.totalAmount) || 0;
    });

    return {
      totalPOs: sourceList.length,
      draftPOs: draftCount,
      approvedPOs: approvedCount,
      cancelledPOs: cancelledCount,
      totalPieces,
      totalKg,
      totalOrderValue
    };
  }, [allPOs, pos]);

  // Load single PO for details/edit view in the background without blocking the UI
  const loadSinglePO = async (poId: string) => {
    try {
      const details = await POService.getPurchaseOrderById(poId, isDemoMode);
      setSelectedPoDetails((prev) => ({
        ...details,
        po: details.po || prev.po
      }));
      setSelectedPoId(poId);
    } catch (e) {
      console.warn('Failed to load single PO details in background:', e);
    }
  };

  // Handlers for Views - Instant transitions (0ms delay)
  const handleViewPO = (poId: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || allPOs.find((p) => p.id === poId || p.poId === poId);
    setSelectedPoId(poId);
    if (targetPo) {
      setSelectedPoDetails({
        po: targetPo,
        logs: [],
        amendments: []
      });
    }
    setCurrentView('details');
    loadSinglePO(poId);
  };

  const handleEditPO = (poId: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || allPOs.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
    const lock = POLockService.isLocked(targetPo, lockedPOMap);
    if (lock?.isFullyLocked) {
      alert(lock.reason || 'Cannot edit Purchase Order: All colour lines have been invoiced completely.');
      return;
    }
    setSelectedPoId(poId);
    if (targetPo) {
      setSelectedPoDetails({
        po: targetPo,
        logs: [],
        amendments: []
      });
    }
    setCurrentView('edit');
    loadSinglePO(poId);
  };

  const handlePrintPO = (poId: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || allPOs.find((p) => p.id === poId || p.poId === poId);
    setSelectedPoId(poId);
    if (targetPo) {
      setSelectedPoDetails({
        po: targetPo,
        logs: [],
        amendments: []
      });
    }
    setCurrentView('print');
    loadSinglePO(poId);
  };

  // Form Save
  const handleSavePO = async (
    poData: Partial<PurchaseOrder>,
    targetStatus: POStatus | string
  ) => {
    setIsSaving(true);
    try {
      const activeUser = {
        uid: user?.uid || 'user-101',
        displayName: user?.displayName || 'Authorized User',
        role: activeRole || (user as any)?.role || (isAdmin ? 'Admin' : 'User')
      };

      const resolvedStatus = targetStatus as POStatus;

      if (currentView === 'edit' && selectedPoId) {
        const updated = await POService.updatePurchaseOrder(
          selectedPoId,
          { ...poData, status: resolvedStatus },
          activeUser,
          isDemoMode
        );

        // Instantly update in-memory lists for 0ms transition
        setPos((prev) => prev.map((p) => (p.id === selectedPoId || p.poId === selectedPoId ? updated : p)));
        setAllPOs((prev) => prev.map((p) => (p.id === selectedPoId || p.poId === selectedPoId ? updated : p)));

        if (onUpdatePo) {
          onUpdatePo(updated);
        }
      } else {
        const customer = vendors.find(
          (v) => (v.vendorId || v.id) === poData.customerId
        );
        if (!customer) {
          throw new Error('Please select a valid customer.');
        }

        const newPo = await POService.createPurchaseOrder(
          {
            ...poData,
            status: resolvedStatus,
            poNumber: targetStatus === 'approved' ? undefined : 'PO/PENDING'
          },
          customer,
          activeUser,
          isDemoMode
        );

        // Instantly add to in-memory lists
        setPos((prev) => [newPo, ...prev]);
        setAllPOs((prev) => [newPo, ...prev]);

        if (onAddPo) {
          onAddPo(newPo);
        }
      }

      // Close modal and transition view immediately without waiting for heavy network reloads!
      setIsSaving(false);
      setCurrentView('list');

      // Refresh full metrics and locks in background non-blocking
      loadData().catch(console.warn);
    } catch (err: any) {
      alert(`Error saving Purchase Order: ${err.message || err}`);
      setIsSaving(false);
    }
  };

  // Status Actions
  const handleSubmitPO = async (poId: string) => {
    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Authorized User'
    };
    await POService.submitPurchaseOrder(poId, activeUser, isDemoMode);
    await loadData();
    if (currentView === 'details') {
      await loadSinglePO(poId);
    }
  };

  const handleApprovePO = async (poId: string) => {
    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Authorized User'
    };
    await POService.approvePurchaseOrder(poId, activeUser, isDemoMode);
    await loadData();
    if (currentView === 'details') {
      await loadSinglePO(poId);
    }
  };

  const handleRejectPO = async (poId: string, reason: string) => {
    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Authorized User'
    };
    await POService.rejectPurchaseOrder(poId, reason, activeUser, isDemoMode);
    await loadData();
    if (currentView === 'details') {
      await loadSinglePO(poId);
    }
  };

  const handleCancelPO = async (poId: string, reason: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
    const poStatus = POLockService.getPOStatus(targetPo, lockedPOMap);
    if (poStatus && (poStatus.isFullyLocked || poStatus.approvedLinesCount > 0)) {
      alert(`Cannot cancel Purchase Order ${targetPo?.poNumber || ''}: Colour lines have been moved to invoice generation.`);
      return;
    }
    const lock = POLockService.isLocked(targetPo, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }

    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Authorized User'
    };
    try {
      await POService.cancelPurchaseOrder(poId, reason, activeUser, isDemoMode);
      await loadData();
      if (currentView === 'details') {
        await loadSinglePO(poId);
      }
    } catch (err: any) {
      alert(err.message || 'Error cancelling Purchase Order');
    }
  };

  const handleRevokeApprovalPO = async (poId: string, reason?: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
    const poStatus = POLockService.getPOStatus(targetPo, lockedPOMap);
    if (poStatus && (poStatus.isFullyLocked || poStatus.approvedLinesCount > 0)) {
      alert(`Cannot revoke approval for Purchase Order ${targetPo?.poNumber || ''}: Colour lines have been moved to invoice generation.`);
      return;
    }
    const lock = POLockService.isLocked(targetPo, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }

    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Authorized User'
    };
    try {
      await POService.revokeApprovalPurchaseOrder(
        poId,
        reason || 'Approval revoked by authorized manager',
        activeUser,
        isDemoMode
      );
      await loadData();
      if (currentView === 'details') {
        await loadSinglePO(poId);
      }
    } catch (err: any) {
      alert(err.message || 'Error revoking PO approval');
    }
  };

  const handleDeletePO = async (poId: string) => {
    if (!canDeletePO) {
      alert('You do not have permission to delete purchase orders.');
      return;
    }
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
    const poStatus = POLockService.getPOStatus(targetPo, lockedPOMap);
    if (poStatus && (poStatus.isFullyLocked || poStatus.approvedLinesCount > 0)) {
      alert(`Cannot delete Purchase Order ${targetPo?.poNumber || ''}: Colour lines have been moved to invoice generation.`);
      return;
    }
    const lock = POLockService.isLocked(targetPo, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }
    if (targetPo && hasInwardForPO(targetPo, inwardsList)) {
      alert(`Cannot delete Purchase Order ${targetPo.poNumber || ''}: Inward entries have already been entered for this PO.`);
      return;
    }
    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Admin User',
      role: activeRole || (user as any)?.role || 'Admin'
    };
    try {
      await POService.deletePurchaseOrder(poId, activeUser, isDemoMode);
      await loadData();
      if (currentView === 'details') {
        setCurrentView('list');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting Purchase Order');
    }
  };



  const selectedCustomer = vendors.find(
    (v) =>
      (v.vendorId || v.id) === selectedPoDetails.po?.customerId ||
      (v.vendorId || v.id) === selectedPoDetails.po?.customerVendorId
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      {(currentView === 'list' || currentView === 'report') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Orders</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage customer purchase orders, style specifications, and generate consolidated reports
            </p>
          </div>

          {/* Section Tabs */}
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
              <span>All Orders</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
                {pos.length}
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

      {/* 1. PO Dashboard Metrics (always visible on list view) */}
      {currentView === 'list' && (
        <PODashboard
          metrics={poMetrics}
          onFilterStatus={(status) => setFilters((prev) => ({ ...prev, status: status as any }))}
          activeStatusFilter={filters.status || 'all'}
        />
      )}

      {/* View 1: List View */}
      {currentView === 'list' && (
        <div className="space-y-6">
          {/* PO List Table */}
          <POList
            pos={pos}
            vendors={vendors}
            inwards={inwardsList}
            pagination={pagination}
            filters={filters}
            onFilterChange={(newFilters) => setFilters(newFilters)}
            onPageChange={(newPage) =>
              setPagination({ ...pagination, page: newPage })
            }
            onViewPO={handleViewPO}
            onEditPO={handleEditPO}
            onSubmitPO={handleSubmitPO}
            onApprovePO={handleApprovePO}
            onRevokeApprovalPO={handleRevokeApprovalPO}
            onRejectPO={(poId) => handleRejectPO(poId, 'Rejected by manager')}
            onCancelPO={(poId) => handleCancelPO(poId, 'Cancelled by user')}
            onDeletePO={handleDeletePO}
            onPrintPO={handlePrintPO}
            onAddNewPO={() => setCurrentView('add')}
            onOpenReport={() => setCurrentView('report')}
            canManage={canManage}
            isAdmin={isAdmin}
            lockedPOMap={lockedPOMap}
          />
        </div>
      )}

      {/* View 2: Report Generation View */}
      {currentView === 'report' && (
        <POReport
          pos={pos}
          vendors={vendors}
          onBack={() => setCurrentView('list')}
          onViewPO={handleViewPO}
        />
      )}

      {/* View 2 & 3: Add / Edit Form */}
      {(currentView === 'add' || currentView === 'edit') && (
        <POForm
          initialPO={currentView === 'edit' ? selectedPoDetails.po : null}
          vendors={vendors}
          inwards={inwardsList}
          lockedPOMap={lockedPOMap}
          onSave={handleSavePO}
          onCancel={() => setCurrentView('list')}
          isSaving={isSaving}
          isAdmin={isAdmin}
        />
      )}

      {/* View 4: Details View */}
      {currentView === 'details' && selectedPoDetails.po && (
        <PODetails
          po={selectedPoDetails.po}
          customer={selectedCustomer}
          logs={selectedPoDetails.logs}
          amendments={selectedPoDetails.amendments}
          inwards={inwardsList}
          outwards={outwardsList}
          onBack={() => setCurrentView('list')}
          onEdit={() => setCurrentView('edit')}
          onSubmit={() => handleSubmitPO(selectedPoDetails.po!.id)}
          onApprove={() => handleApprovePO(selectedPoDetails.po!.id)}
          onRevokeApproval={() => handleRevokeApprovalPO(selectedPoDetails.po!.id)}
          onReject={(reason) => handleRejectPO(selectedPoDetails.po!.id, reason)}
          onCancelPO={(reason) =>
            handleCancelPO(selectedPoDetails.po!.id, reason)
          }
          onDeletePO={() => handleDeletePO(selectedPoDetails.po!.id)}
          onPrint={() => setCurrentView('print')}
          canManage={canManage}
          isAdmin={isAdmin}
          lockedPOMap={lockedPOMap}
        />
      )}

      {/* View 5: Print View */}
      {currentView === 'print' && selectedPoDetails.po && (
        <POPrintView
          po={selectedPoDetails.po}
          customer={selectedCustomer}
          onBack={() => setCurrentView('details')}
        />
      )}
    </div>
  );
};
