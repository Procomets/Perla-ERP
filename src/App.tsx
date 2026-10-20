import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { PageContainer } from './components/layout/PageContainer';
import { Modal } from './components/ui/Modal';

// Pages
import { LandingPage } from './pages/landing/LandingPage';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PurchaseOrdersPage } from './pages/purchaseOrders/PurchaseOrdersPage';
import { InwardPage } from './pages/inward/InwardPage';
import { OutwardPage } from './pages/outward/OutwardPage';
import { StatementPage } from './pages/statement/StatementPage';
import { InvoicesPage } from './pages/invoices/InvoicesPage';
import { ChemicalEntryPage } from './pages/chemicalEntry/ChemicalEntryPage';
import { WarehousePage } from './pages/warehouse/WarehousePage';
import { PurchasesPage } from './pages/purchases/PurchasesPage';
import { AttendancePage } from './pages/attendance/AttendancePage';
import { ExpensesPage } from './pages/expenses/ExpensesPage';
import { VendorMasterPage } from './pages/masters/VendorMasterPage';
import { ItemMasterPage } from './pages/masters/ItemMasterPage';
import { UsersPage } from './pages/users/UsersPage';
import { EmployeeMasterPage } from './pages/employees/EmployeeMasterPage';
import { SalarySheetPage } from './pages/salary/SalarySheetPage';
import { GeneralSettingsPage } from './pages/settings/GeneralSettingsPage';

// Initial Mock Data
import {
  INITIAL_POS,
  INITIAL_VENDORS,
  INITIAL_INWARDS,
  INITIAL_OUTWARDS,
  INITIAL_INVENTORY,
  INITIAL_CHEMICAL_ENTRIES,
  INITIAL_EMPLOYEES,
  INITIAL_EB_ENTRIES,
  INITIAL_TRANSPORT
} from './services/mockData';

import { PurchaseOrder } from './types/po';
import { InwardEntry, OutwardEntry } from './types/inwardOutward';
import { Invoice } from './types/invoice';
import { InventoryItem, ChemicalEntry } from './types/stock';
import { Vendor } from './types/vendor';
import { StatementService } from './services/statementService';
import { POService } from './services/poService';
import { VendorService } from './services/vendorService';
import { InwardService } from './services/inwardService';
import { OutwardService } from './services/outwardService';
import { InvoiceService } from './services/invoiceService';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Executive Dashboard', subtitle: 'Overview of operational trends, PO balances, and quick actions' },
  po: { title: 'Purchase Orders (PO)', subtitle: 'Customer work order creation & style/colour line specifications' },
  inward: { title: 'Inward Receipt Entry', subtitle: 'Record incoming customer fabric batches against POs' },
  outward: { title: 'Outward Dispatch Entry', subtitle: 'Record finished processed goods dispatched to customers' },
  statement: { title: 'Inward vs Outward Reconciliation Statement', subtitle: 'Colour-wise balance ledger & invoice approval' },
  invoices: { title: 'Tax Invoices', subtitle: 'GST invoice generation, billing, and PDF printouts' },
  chemical: { title: 'Chemical Entry & Processing', subtitle: 'Shopfloor chemical batch consumption & machine logs' },
  warehouse: { title: 'Warehouse Stock Ledger', subtitle: 'Real-time inventory levels for chemicals and firewood fuel' },
  purchases: { title: 'Raw Material & Firewood Purchases', subtitle: 'Supplier receipts, deliveries, and weighbridge records' },
  attendance: { title: 'Employee Attendance', subtitle: 'Shift attendance and overtime hours' },
  salary: { title: 'Employee Salary', subtitle: 'Salary calculation and payment status' },
  employees: { title: 'Employee Master', subtitle: 'Manage employee directory, wages, documents, and roles' },
  eb: { title: 'EB Electricity Expenses', subtitle: 'Utility meter readings and monthly cost breakdown' },
  transport: { title: 'Transport Freight Expenses', subtitle: 'Logistics costs linked to customer delivery challans' },
  vendors: { title: 'Vendor Directory Master', subtitle: 'Directory of customers, suppliers, and subcontractors' },
  items: { title: 'Item & Chemical Master', subtitle: 'Catalog of chemicals, firewood, and packaging materials' },
  users: { title: 'User Management', subtitle: 'Manage system access, roles, and profiles' },
  settings: { title: 'General Settings', subtitle: 'Global configurations, colour master catalogue, and operational rules' }
};

interface ErpLayoutProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  inwards: InwardEntry[];
  outwards: OutwardEntry[];
  invoices: Invoice[];
  inventory: InventoryItem[];
  chemicalEntries: ChemicalEntry[];
  employees: any[];
  ebEntries: any[];
  transportExpenses: any[];
  approvedPoLineIds: string[];
  invoicedPoLineIds: string[];
  onAddPo: (po: PurchaseOrder) => void;
  onUpdatePo?: (po: PurchaseOrder) => void;
  onAddInward: (inward: InwardEntry) => void;
  onUpdateInward?: (inward: InwardEntry) => void;
  onAddOutward: (outward: OutwardEntry) => void;
  onUpdateOutward?: (outward: OutwardEntry) => void;
  onApproveForInvoice: (id: string) => void;
  onAddInvoice: (inv: Invoice) => void;
  onAddChemicalEntry: (entry: ChemicalEntry) => void;
  onAddVendor: (v: Vendor) => void;
  onAddItem: (item: InventoryItem) => void;
}

const ErpLayout: React.FC<ErpLayoutProps> = (props) => {
  const { moduleId = 'dashboard' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // If not logged in and trying to access ERP, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeTitle = pageTitles[moduleId] || { title: 'Perla ERP', subtitle: 'Textiles Processing Platform' };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar
        activeTab={moduleId}
        onSelectTab={(tabId) => navigate(`/erp/${tabId}`)}
        onGoToLogin={() => navigate('/login')}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Header title={activeTitle.title} subtitle={activeTitle.subtitle} />
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto p-6 md:p-8">
            {moduleId === 'dashboard' && <DashboardPage pos={props.pos} inventory={props.inventory} onNavigate={(tabId) => navigate(`/erp/${tabId}`)} />}
            {moduleId === 'po' && <PurchaseOrdersPage pos={props.pos} vendors={props.vendors} inwards={props.inwards} outwards={props.outwards} onAddPo={props.onAddPo} onUpdatePo={props.onUpdatePo} />}
            {moduleId === 'inward' && <InwardPage pos={props.pos} inwards={props.inwards} vendors={props.vendors} onAddInward={props.onAddInward} onUpdateInward={props.onUpdateInward} />}
            {moduleId === 'outward' && <OutwardPage pos={props.pos} inwards={props.inwards} outwards={props.outwards} vendors={props.vendors} onAddOutward={props.onAddOutward} onUpdateOutward={props.onUpdateOutward} />}
            {moduleId === 'statement' && (
              <StatementPage
                pos={props.pos}
                inwards={props.inwards}
                outwards={props.outwards}
                approvedPoLineIds={props.approvedPoLineIds}
                invoicedPoLineIds={props.invoicedPoLineIds}
                onApproveForInvoice={props.onApproveForInvoice}
              />
            )}
            {moduleId === 'invoices' && (
              <InvoicesPage
                invoices={props.invoices}
                pos={props.pos}
                vendors={props.vendors}
                approvedPoLineIds={props.approvedPoLineIds}
                onAddInvoice={props.onAddInvoice}
              />
            )}
            {moduleId === 'chemical' && <ChemicalEntryPage entries={props.chemicalEntries} pos={props.pos} onAddEntry={props.onAddChemicalEntry} />}
            {moduleId === 'warehouse' && <WarehousePage inventory={props.inventory} />}
            {moduleId === 'purchases' && <PurchasesPage />}
            {moduleId === 'employees' && <EmployeeMasterPage />}
            {moduleId === 'attendance' && <AttendancePage employees={props.employees} />}
            {moduleId === 'salary' && <SalarySheetPage />}
            {moduleId === 'eb' && <ExpensesPage ebEntries={props.ebEntries} transportExpenses={props.transportExpenses} />}
            {moduleId === 'transport' && <ExpensesPage ebEntries={props.ebEntries} transportExpenses={props.transportExpenses} />}
            {moduleId === 'vendors' && <VendorMasterPage />}
            {moduleId === 'items' && <ItemMasterPage items={props.inventory} onAddItem={props.onAddItem} />}
            {moduleId === 'users' && <UsersPage />}
            {moduleId === 'settings' && <GeneralSettingsPage />}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, isDemoMode } = useAuth();
  const navigate = useNavigate();
  
  // Application Operational Data State - Starts empty in live mode
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [inwards, setInwards] = useState<InwardEntry[]>([]);
  const [outwards, setOutwards] = useState<OutwardEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [chemicalEntries, setChemicalEntries] = useState<ChemicalEntry[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [ebEntries, setEbEntries] = useState<any[]>([]);
  const [transportExpenses, setTransportExpenses] = useState<any[]>([]);

  // Reconciliation approvals & invoice state tracker
  const [approvedPoLineIds, setApprovedPoLineIds] = useState<string[]>([]);
  const [invoicedPoLineIds, setInvoicedPoLineIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;

    if (isDemoMode) {
      setPos(INITIAL_POS);
      setVendors(INITIAL_VENDORS);
      setInwards(INITIAL_INWARDS);
      setOutwards(INITIAL_OUTWARDS);
      setInventory(INITIAL_INVENTORY);
      setChemicalEntries(INITIAL_CHEMICAL_ENTRIES);
      setEmployees(INITIAL_EMPLOYEES);
      setEbEntries(INITIAL_EB_ENTRIES);
      setTransportExpenses(INITIAL_TRANSPORT);
      setApprovedPoLineIds(['pol-1']);
      return;
    }

    // Live mode: fetch directly from Firestore via services
    POService.getPurchaseOrders({}, { page: 1, pageSize: 500 }, false)
      .then((res) => setPos(res.pos || []))
      .catch((err) => console.error('Failed to sync POs:', err));

    VendorService.getVendors({}, { page: 1, pageSize: 500 }, false)
      .then((res) => setVendors(res.vendors || []))
      .catch((err) => console.error('Failed to sync Vendors:', err));

    InwardService.getInwardEntries({}, { page: 1, pageSize: 500 }, false)
      .then((res) => setInwards(res.inwards || []))
      .catch((err) => console.error('Failed to sync Inwards:', err));

    OutwardService.getOutwardEntries({}, { page: 1, pageSize: 500 }, false)
      .then((res) => setOutwards(res.outwards || []))
      .catch((err) => console.error('Failed to sync Outwards:', err));

    InvoiceService.getInvoices({}, { page: 1, pageSize: 500 }, false)
      .then((res) => setInvoices(res.invoices || []))
      .catch((err) => console.error('Failed to sync Invoices:', err));

    StatementService.getApprovedPoLineIds(false)
      .then((ids) => {
        setApprovedPoLineIds(ids || []);
      })
      .catch((err) => console.error('Failed to sync approved lines:', err));
  }, [user, isDemoMode]);

  // Callbacks for operational data
  const handleAddPo = (newPo: PurchaseOrder) => setPos((prev) => [newPo, ...prev]);
  const handleUpdatePo = (updatedPo: PurchaseOrder) => {
    setPos((prev) => {
      const idx = prev.findIndex(
        (p) =>
          p.id === updatedPo.id ||
          p.poId === updatedPo.id ||
          (updatedPo.poNumber && p.poNumber === updatedPo.poNumber)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedPo;
        return copy;
      }
      return [updatedPo, ...prev];
    });
  };

  const handleAddInward = (newInward: InwardEntry) => setInwards((prev) => [newInward, ...prev]);
  const handleUpdateInward = (updatedInward: InwardEntry) => {
    setInwards((prev) => {
      const idx = prev.findIndex(
        (i) =>
          i.id === updatedInward.id ||
          i.inwardId === updatedInward.id ||
          (updatedInward.inwardNo && i.inwardNo === updatedInward.inwardNo)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedInward;
        return copy;
      }
      return [updatedInward, ...prev];
    });
  };

  const handleAddOutward = (newOutward: OutwardEntry) => setOutwards((prev) => [newOutward, ...prev]);
  const handleUpdateOutward = (updatedOutward: OutwardEntry) => {
    setOutwards((prev) => {
      const idx = prev.findIndex(
        (o) =>
          o.id === updatedOutward.id ||
          o.outwardId === updatedOutward.id ||
          (updatedOutward.outwardNo && o.outwardNo === updatedOutward.outwardNo)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedOutward;
        return copy;
      }
      return [updatedOutward, ...prev];
    });
  };

  const handleApproveForInvoice = (poLineId: string) => {
    if (!approvedPoLineIds.includes(poLineId)) {
      setApprovedPoLineIds((prev) => [...prev, poLineId]);
    }
  };
  const handleAddInvoice = (newInvoice: Invoice) => {
    setInvoices((prev) => [newInvoice, ...prev]);
    newInvoice.lines.forEach((l) => {
      if (!invoicedPoLineIds.includes(l.sourcePoLineId)) {
        setInvoicedPoLineIds((prev) => [...prev, l.sourcePoLineId]);
      }
      StatementService.markApprovalAsInvoiced(
        l.sourcePoLineId,
        newInvoice.id,
        newInvoice.invoiceNo,
        newInvoice.invoiceDate,
        isDemoMode
      ).catch((err) => console.error('Failed to mark approval as invoiced:', err));
    });
  };
  const handleAddChemicalEntry = (entry: ChemicalEntry) => setChemicalEntries((prev) => [entry, ...prev]);
  const handleAddVendor = (v: Vendor) => setVendors((prev) => [v, ...prev]);
  const handleAddItem = (item: InventoryItem) => setInventory((prev) => [item, ...prev]);

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <LandingPage 
            isLoggedIn={!!user} 
            onNavigateErp={() => navigate('/erp/dashboard')} 
            onOpenLogin={() => navigate('/login')} 
          />
        } 
      />
      
      <Route 
        path="/login" 
        element={<LoginPage />} 
      />
      
      <Route path="/erp" element={<Navigate to="/erp/dashboard" replace />} />
      
      <Route 
        path="/erp/:moduleId" 
        element={
          <ErpLayout 
            pos={pos}
            vendors={vendors}
            inwards={inwards}
            outwards={outwards}
            invoices={invoices}
            inventory={inventory}
            chemicalEntries={chemicalEntries}
            employees={employees}
            ebEntries={ebEntries}
            transportExpenses={transportExpenses}
            approvedPoLineIds={approvedPoLineIds}
            invoicedPoLineIds={invoicedPoLineIds}
            onAddPo={handleAddPo}
            onUpdatePo={handleUpdatePo}
            onAddInward={handleAddInward}
            onUpdateInward={handleUpdateInward}
            onAddOutward={handleAddOutward}
            onUpdateOutward={handleUpdateOutward}
            onApproveForInvoice={handleApproveForInvoice}
            onAddInvoice={handleAddInvoice}
            onAddChemicalEntry={handleAddChemicalEntry}
            onAddVendor={handleAddVendor}
            onAddItem={handleAddItem}
          />
        } 
      />
      
      {/* Fallback to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
