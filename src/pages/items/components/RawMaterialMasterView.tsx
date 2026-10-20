import React from 'react';
import { MasterItem } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';
import { Boxes, Eye, Edit2, Plus, Warehouse } from 'lucide-react';

interface RawMaterialMasterViewProps {
  rawMaterialItems: MasterItem[];
  onViewItem: (item: MasterItem) => void;
  onEditItem: (item: MasterItem) => void;
  onAddNew: () => void;
  isAdminOrManager?: boolean;
}

export const RawMaterialMasterView: React.FC<RawMaterialMasterViewProps> = ({
  rawMaterialItems,
  onViewItem,
  onEditItem,
  onAddNew,
  isAdminOrManager
}) => {
  const columns: Column<MasterItem>[] = [
    {
      header: 'Item Code',
      accessor: (row) => (
        <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
      )
    },
    {
      header: 'Material / Item Description',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.itemName}</span>
          <span className="text-[11px] text-slate-400">{row.categoryName}</span>
        </div>
      )
    },
    {
      header: 'HSN / Tax',
      accessor: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-700 block">{row.hsnCode || 'N/A'}</span>
          {row.taxRatePercent !== undefined && (
            <span className="text-[11px] text-slate-400">GST: {row.taxRatePercent}%</span>
          )}
        </div>
      )
    },
    {
      header: 'Base UOM',
      accessor: (row) => (
        <span className="text-xs font-bold text-slate-800">{row.baseUnit}</span>
      )
    },
    {
      header: 'Standard Rate',
      accessor: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.defaultPurchaseRate ? formatCurrency(row.defaultPurchaseRate) : 'N/A'}
        </span>
      )
    },
    {
      header: 'Current Stock',
      accessor: (row) => {
        const isLow = (row.currentStock || 0) <= (row.reorderLevel || 0);
        return (
          <div>
            <span className={`text-xs font-black ${isLow ? 'text-amber-600' : 'text-emerald-700'}`}>
              {row.currentStock || 0} {row.baseUnit}
            </span>
            <span className="text-[11px] text-slate-400 block">Min: {row.minimumStockLevel}</span>
          </div>
        );
      }
    },
    {
      header: 'Storage Location',
      accessor: (row) => (
        <span className="text-xs text-slate-600">
          {row.storageLocation || 'Main Warehouse'}
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
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Edit Material"
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
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Raw Materials & Processing Intermediates</h3>
          <p className="text-xs text-slate-500">
            Dye bases, sodium salts, polybags, packing tapes, and consumable materials
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={onAddNew}
        >
          Add Raw Material
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table columns={columns} data={rawMaterialItems} keyExtractor={(row) => row.id} />
      </div>
    </div>
  );
};
