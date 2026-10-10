import React, { useState, useEffect } from 'react';
import {
  Vendor,
  VendorFilterOptions,
  VendorPagination,
  VendorContact
} from '../../types/vendor';
import { VendorService } from '../../services/vendorService';
import { VendorList } from './components/VendorList';
import { VendorForm } from './components/VendorForm';
import { VendorDetails } from './components/VendorDetails';
import { useAuth } from '../../context/AuthContext';

export const VendorMasterContainer: React.FC = () => {
  const { activeRole, isDemoMode } = useAuth();

  // Navigation State - Default to Vendor List directly
  const [currentView, setCurrentView] = useState<'list' | 'add' | 'edit' | 'details'>('list');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Data & Pagination State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pagination, setPagination] = useState<VendorPagination>({
    page: 1,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 1
  });

  // Filter State
  const [filters, setFilters] = useState<VendorFilterOptions>({
    searchQuery: '',
    vendorType: 'all',
    status: 'all',
    state: '',
    gstStatus: 'all',
    hasSubcompany: 'all'
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Load vendors list
  const loadData = async () => {
    setLoading(true);
    try {
      const vendorsResult = await VendorService.getVendors(
        filters,
        { page: pagination.page, pageSize: pagination.pageSize },
        isDemoMode
      );
      setVendors(vendorsResult.vendors);
      setPagination(vendorsResult.pagination);
    } catch (err) {
      console.error('Error loading vendor master data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, pagination.page, isDemoMode]);

  // Vendor Form Save handler
  const handleSaveVendor = async (
    vendorData: Partial<Vendor>,
    contacts: Partial<VendorContact>[],
    isAddAnother?: boolean
  ) => {
    if (currentView === 'edit' && selectedVendorId) {
      await VendorService.updateVendor(selectedVendorId, vendorData, activeRole);
    } else {
      await VendorService.createVendor(vendorData, contacts, activeRole, isDemoMode);
    }

    await loadData();

    if (isAddAnother) {
      setCurrentView('add');
    } else {
      setCurrentView('list');
    }
  };

  const handleToggleStatus = async (vendorId: string, currentStatus: 'active' | 'inactive') => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await VendorService.setVendorStatus(vendorId, nextStatus, activeRole);
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Main View Router */}
      {currentView === 'list' && (
        <VendorList
          vendors={vendors}
          pagination={pagination}
          filters={filters}
          onFilterChange={(newFilters) => {
            setFilters(newFilters);
            setPagination({ ...pagination, page: 1 });
          }}
          onPageChange={(newPage) => setPagination({ ...pagination, page: newPage })}
          onViewVendor={(id) => {
            setSelectedVendorId(id);
            setCurrentView('details');
          }}
          onEditVendor={(id) => {
            setSelectedVendorId(id);
            setCurrentView('edit');
          }}
          onAddContact={(id) => {
            setSelectedVendorId(id);
            setCurrentView('details');
          }}
          onViewSubcompanies={(id) => {
            setSelectedVendorId(id);
            setCurrentView('details');
          }}
          onToggleStatus={handleToggleStatus}
          onViewHistory={(id) => {
            setSelectedVendorId(id);
            setCurrentView('details');
          }}
          onAddNewVendor={() => {
            setSelectedVendorId(null);
            setCurrentView('add');
          }}
        />
      )}

      {currentView === 'add' && (
        <VendorForm
          existingVendors={vendors}
          userRole={activeRole}
          onSave={handleSaveVendor}
          onCancel={() => setCurrentView('list')}
        />
      )}

      {currentView === 'edit' && selectedVendorId && (
        <VendorForm
          initialVendor={vendors.find((v) => v.vendorId === selectedVendorId)}
          existingVendors={vendors}
          userRole={activeRole}
          onSave={handleSaveVendor}
          onCancel={() => setCurrentView('list')}
        />
      )}

      {currentView === 'details' && selectedVendorId && (
        <VendorDetails
          vendorId={selectedVendorId}
          userRole={activeRole}
          onBack={() => setCurrentView('list')}
          onEdit={(id) => {
            setSelectedVendorId(id);
            setCurrentView('edit');
          }}
          onNavigateToVendor={(id) => {
            setSelectedVendorId(id);
            setCurrentView('details');
          }}
        />
      )}
    </div>
  );
};
