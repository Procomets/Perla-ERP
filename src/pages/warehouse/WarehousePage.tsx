import React from 'react';
import { InventoryItem } from '../../types/stock';
import { Card } from '../../components/ui/Card';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { Warehouse, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface WarehousePageProps {
  inventory: InventoryItem[];
}

export const WarehousePage: React.FC<WarehousePageProps> = ({ inventory }) => {
  const columns: Column<InventoryItem>[] = [
    { header: 'Item Code', accessor: 'code', className: 'font-bold text-[#1F4E79]' },
    { header: 'Item Name', accessor: 'name', className: 'font-bold' },
    { header: 'Category', accessor: 'category' },
    {
      header: 'Current Stock',
      accessor: (row) => (
        <span className={`font-black text-sm ${row.currentStock <= row.reorderLevel ? 'text-amber-600' : 'text-emerald-700'}`}>
          {row.currentStock} {row.baseUnit}
        </span>
      )
    },
    { header: 'Reorder Threshold', accessor: (row) => `${row.reorderLevel} ${row.baseUnit}` },
    { header: 'Supplier', accessor: (row) => row.preferredSupplierName || 'Direct Purchase' },
    {
      header: 'Stock Condition',
      accessor: (row) => {
        if (row.currentStock <= row.reorderLevel) {
          return <StatusChip status="Low Stock Alert" variant="rose" />;
        }
        return <StatusChip status="Optimal" variant="green" />;
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
        <h2 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
          <Warehouse className="w-5 h-5" /> Warehouse & Stock Ledger
        </h2>
        <p className="text-xs text-slate-500">Live balances of processing chemicals, firewood fuel, and raw material inventory</p>
      </div>

      <Card>
        <Table columns={columns} data={inventory} keyExtractor={(row) => row.id} />
      </Card>
    </div>
  );
};
