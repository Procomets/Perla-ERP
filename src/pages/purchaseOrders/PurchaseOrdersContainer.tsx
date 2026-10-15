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
import { POList } from './components/POList';
import { POForm } from './components/POForm';
import { PODetails } from './components/PODetails';
import { POPrintView } from './components/POPrintView';
import { useAuth } from '../../context/AuthContext';

interface PurchaseOrdersContainerProps {
  initialPOs?: PurchaseOrder[];
  initialVendors?: Vendor[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  onAddPo?: (newPo: PurchaseOrder) => void;
}

export const PurchaseOrdersContainer: React.FC<PurchaseOrdersContainerProps> = ({
  initialPOs,
  initialVendors,
  inwards = [],
  outwards = [],
  onAddPo
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
      if (vResult.vendors && vResult.vendors.length > 0) {
        setVendors(vResult.vendors);
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

  // Load single PO for details/edit view
  const loadSinglePO = async (poId: string) => {
    const details = await POService.getPurchaseOrderById(poId, isDemoMode);
    setSelectedPoDetails(details);
    setSelectedPoId(poId);
  };

  // Handlers for Views
  const handleViewPO = async (poId: string) => {
    await loadSinglePO(poId);
    setCurrentView('details');
  };

  const handleEditPO = async (poId: string) => {
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
        displayName: user?.displayName || 'Authorized User'
      };

      const resolvedStatus = targetStatus as POStatus;

      if (currentView === 'edit' && selectedPoId) {
        await POService.updatePurchaseOrder(
          selectedPoId,
          { ...poData, status: resolvedStatus },
          activeUser,
          isDemoMode
        );
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
    const activeUser = {
      uid: user?.uid || 'user-101',
      displayName: user?.displayName || 'Admin User'
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
          />
        </div>
      )}

      {/* View 2 & 3: Add / Edit Form */}
      {(currentView === 'add' || currentView === 'edit') && (
        <POForm
          initialPO={currentView === 'edit' ? selectedPoDetails.po : null}
          vendors={vendors}
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
          inwards={inwards}
          outwards={outwards}
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
