import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ShoppingBag, Plus, Truck } from 'lucide-react';

export const PurchasesPage: React.FC = () => {
  const samplePurchases = [
    { id: 'pur1', date: '2026-02-02', type: 'Chemical Purchase', vendor: 'Royal Threads & Dyes Ltd', item: 'Bio-Enzyme Powder (Neutral)', qty: '200 kg', invoiceNo: 'INV-RTD-901', amount: 32000, status: 'Posted to Stock' },
    { id: 'pur2', date: '2026-02-04', type: 'Firewood Delivery', vendor: 'Sri Lakshmi Timber Supplies', item: 'Casuarina Firewood Logs', qty: '10.5 Tons', invoiceNo: 'DC-WOOD-44', amount: 47250, status: 'Posted to Stock' }
  ];

  const columns: Column<typeof samplePurchases[0]>[] = [
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'Purchase Category', accessor: 'type', className: 'font-bold text-[#1F4E79]' },
    { header: 'Supplier / Vendor', accessor: 'vendor' },
    { header: 'Item / Material', accessor: 'item' },
    { header: 'Delivered Qty', accessor: 'qty', className: 'font-bold' },
    { header: 'Supplier Invoice / DC', accessor: 'invoiceNo' },
    { header: 'Amount', accessor: (row) => formatCurrency(row.amount), className: 'font-extrabold' },
    { header: 'Inventory Status', accessor: (row) => <StatusChip status={row.status} variant="green" /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Raw Material & Firewood Purchases</h2>
          <p className="text-xs text-slate-500">Record chemical acquisitions, supplier invoices, and firewood weighbridge receipts</p>
        </div>
        <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
          New Purchase Receipt
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={samplePurchases} keyExtractor={(row) => row.id} />
      </Card>
    </div>
  );
};
