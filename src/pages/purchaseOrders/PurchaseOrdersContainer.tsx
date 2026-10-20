import React, { useState, useEffect } from 'react';
import {
  PurchaseOrder,
  POStatus,
  POFilterOptions,
  POPagination,
  POAuditLog,
  POAmendment
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
import { useAuth } from '../../context/AuthContext';
import { hasInwardForPO } from '../../utils/calculations';
import { POLockService, POLockStatus } from '../../services/poLockService';

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
  const { user, activeRole, isDemoMode } = useAuth();
  const canManage = activeRole === 'Admin' || activeRole === 'Manager';
  const isAdmin =
    activeRole === 'Admin' ||
    (user as any)?.role === 'Admin' ||
    (user as any)?.role === 'admin';

  // Navigation State
  const [currentView, setCurrentView] = useState<
    'list' | 'add' | 'edit' | 'details' | 'print'
  >('list');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Data States
  const [pos, setPos] = useState<PurchaseOrder[]>(initialPOs || []);
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors || []);
  const [inwardsList, setInwardsList] = useState<InwardEntry[]>(inwards);
  const [outwardsList, setOutwardsList] = useState<OutwardEntry[]>(outwards);
  const [pagination, setPagination] = useState<POPagination>({
    page: 1,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 1
  });

  const [filters, setFilters] = useState<POFilterOptions>({
    searchQuery: '',
    processCategory: 'all',
    status: 'all'
  });


  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lockedPOMap, setLockedPOMap] = useState<Record<string, POLockStatus>>({});

  // Selected PO detailed data
  const [selectedPoDetails, setSelectedPoDetails] = useState<{
    po: PurchaseOrder | null;
    logs: POAuditLog[];
    amendments: POAmendment[];
  }>({ po: null, logs: [], amendments: [] });

  // Load PO list and metrics
  const loadData = async () => {
    setLoading(true);
    try {
      // Load POs
      const poResult = await POService.getPurchaseOrders(
        filters,
        { page: pagination.page, pageSize: pagination.pageSize },
        isDemoMode
      );
      setPos(poResult.pos);
      setPagination(poResult.pagination);

      // Load latest live Vendors from Vendor Master
      const vResult = await VendorService.getVendors(
        {},
        { page: 1, pageSize: 500 },
        isDemoMode
      );
      setVendors(vResult.vendors || []);

      // Load latest live Inward receipts
      const inwResult = await InwardService.getInwardEntries(
        {},
        { page: 1, pageSize: 1000 },
        isDemoMode
      );
      setInwardsList(inwResult.inwards || []);

      // Load latest live Outward dispatches
      const outResult = await OutwardService.getOutwardEntries(
        {},
        { page: 1, pageSize: 1000 },
        isDemoMode
      );
      setOutwardsList(outResult.outwards || []);

      // Load PO lock map based on statement approvals & invoices
      try {
        const lockMap = await POLockService.getLockedPOMap(isDemoMode);
        setLockedPOMap(lockMap);
      } catch (lockErr) {
        console.warn('Error loading PO lock map:', lockErr);
      }
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
    }
  }, [initialPOs]);

  // Load single PO for details/edit view
  const loadSinglePO = async (poId: string) => {
    const details = await POService.getPurchaseOrderById(poId, isDemoMode);
    setSelectedPoDetails(details);
    setSelectedPoId(poId);

    // Refresh downstream transactions for this PO view
    try {
      const [inwRes, outRes] = await Promise.all([
        InwardService.getInwardEntries({}, { page: 1, pageSize: 1000 }, isDemoMode),
        OutwardService.getOutwardEntries({}, { page: 1, pageSize: 1000 }, isDemoMode)
      ]);
      if (inwRes.inwards) setInwardsList(inwRes.inwards);
      if (outRes.outwards) setOutwardsList(outRes.outwards);
    } catch (e) {
      console.warn('Failed to refresh downstream records:', e);
    }
  };

  // Handlers for Views
  const handleViewPO = async (poId: string) => {
    await loadSinglePO(poId);
    setCurrentView('details');
  };

  const handleEditPO = async (poId: string) => {
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
    const lock = POLockService.isLocked(targetPo, lockedPOMap);
    if (lock) {
      alert(lock.reason);
      return;
    }
    if (targetPo && hasInwardForPO(targetPo, inwardsList) && !isAdmin) {
      alert('This Purchase Order has inward entries and can only be edited by an Administrator.');
      return;
    }
    await loadSinglePO(poId);
    setCurrentView('edit');
  };

  const handlePrintPO = async (poId: string) => {
    await loadSinglePO(poId);
    setCurrentView('print');
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
        const targetPo = selectedPoDetails.po || pos.find((p) => p.id === selectedPoId || p.poId === selectedPoId);
        if (targetPo && hasInwardForPO(targetPo, inwardsList) && !isAdmin) {
          alert('This Purchase Order has inward entries and can only be edited by an Administrator.');
          return;
        }

        const updated = await POService.updatePurchaseOrder(
          selectedPoId,
          { ...poData, status: resolvedStatus },
          activeUser,
          isDemoMode
        );

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

        if (onAddPo) {
          onAddPo(newPo);
        }
      }

      await loadData();
      setCurrentView('list');
    } catch (err: any) {
      alert(`Error saving Purchase Order: ${err.message || err}`);
    } finally {
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
    if (!isAdmin) {
      alert('Only administrators can delete purchase orders.');
      return;
    }
    const targetPo = pos.find((p) => p.id === poId || p.poId === poId) || selectedPoDetails.po;
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
            canManage={canManage}
            isAdmin={isAdmin}
            lockedPOMap={lockedPOMap}
          />
        </div>
      )}

      {/* View 2 & 3: Add / Edit Form */}
      {(currentView === 'add' || currentView === 'edit') && (
        <POForm
          initialPO={currentView === 'edit' ? selectedPoDetails.po : null}
          vendors={vendors}
          inwards={inwardsList}
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
