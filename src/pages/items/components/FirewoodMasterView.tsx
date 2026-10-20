import React from 'react';
import { MasterItem } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';
import { Flame, Eye, Edit2, Plus, Warehouse, Scale } from 'lucide-react';

interface FirewoodMasterViewProps {
  firewoodItems: MasterItem[];
  onViewItem: (item: MasterItem) => void;
  onEditItem: (item: MasterItem) => void;
  onAddNew: () => void;
  isAdminOrManager?: boolean;
}

export const FirewoodMasterView: React.FC<FirewoodMasterViewProps> = ({
  firewoodItems,
  onViewItem,
  onEditItem,
  onAddNew,
  isAdminOrManager
}) => {
  const totalTonnage = firewoodItems.reduce((acc, it) => acc + (it.currentStock || 0), 0);

  const columns: Column<MasterItem>[] = [
    {
      header: 'Firewood Code',
      accessor: (row) => (
        <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
      )
    },
    {
      header: 'Fuel Material / Wood Type',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.itemName}</span>
          <span className="text-[11px] text-slate-400">{row.description || 'Boiler Thermal Fuel'}</span>
        </div>
      )
    },
    {
      header: 'Yard Location',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Warehouse className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.storageLocation || 'Boiler Wood Yard'}</span>
        </div>
      )
    },
    {
      header: 'Standard Purchase Rate',
      accessor: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.defaultPurchaseRate ? `${formatCurrency(row.defaultPurchaseRate)} / ${row.baseUnit}` : 'Variable DC'}
        </span>
      )
    },
    {
      header: 'Current Yard Balance',
      accessor: (row) => {
        const isLow = (row.currentStock || 0) <= (row.reorderLevel || 0);
        return (
          <div>
            <span className={`text-xs font-black ${isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
              {row.currentStock || 0} {row.baseUnit}
            </span>
            <span className="text-[11px] text-slate-400 block">Reorder: {row.reorderLevel} {row.baseUnit}</span>
          </div>
        );
      }
    },
    {
      header: 'Supplier',
      accessor: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {row.preferredSupplierName || 'Timber Suppliers'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (row) => (
        <StatusChip
          status={row.status === 'active' ? 'Active' : 'Inactive'}
          variant={row.status === 'active' ? 'green' : 'slate'}
        />
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onViewItem(row)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition-colors"
            title="View Specifications"
          >
            <Eye className="w-4 h-4" />
          </button>
          {isAdminOrManager && (
            <button
              onClick={() => onEditItem(row)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Edit Firewood Item"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Boiler Fuel Specs</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{firewoodItems.length}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Configured firewood varieties</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Total Fuel On Hand</span>
            <Scale className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{totalTonnage.toFixed(1)} t</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Weighbridge recorded inventory</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs sm:col-span-2 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Firewood Purchasing Rule:</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
              Weighbridge Gross, Tare, Net weights, Vehicle Number, and DC entries are recorded in Firewood Purchase.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onAddNew}
          >
            Add Firewood Master
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table columns={columns} data={firewoodItems} keyExtractor={(row) => row.id} />
      </div>
    </div>
  );
};
