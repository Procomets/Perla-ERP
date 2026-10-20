import React from 'react';
import { MasterItem } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../utils/formatters';
import {
  FlaskConical,
  ShieldAlert,
  AlertTriangle,
  Eye,
  Edit2,
  CheckCircle2,
  Clock,
  Warehouse,
  Plus
} from 'lucide-react';

interface ChemicalMasterViewProps {
  chemicals: MasterItem[];
  onViewItem: (item: MasterItem) => void;
  onEditItem: (item: MasterItem) => void;
  onAddNew: () => void;
  isAdminOrManager?: boolean;
}

export const ChemicalMasterView: React.FC<ChemicalMasterViewProps> = ({
  chemicals,
  onViewItem,
  onEditItem,
  onAddNew,
  isAdminOrManager
}) => {
  const totalCount = chemicals.length;
  const activeCount = chemicals.filter((c) => c.status === 'active').length;
  const batchTrackedCount = chemicals.filter(
    (c) => c.chemicalDetails?.batchTrackingRequired || c.batchTrackingEnabled
  ).length;
  const lowStockCount = chemicals.filter((c) => (c.currentStock || 0) <= (c.reorderLevel || 0)).length;

  const columns: Column<MasterItem>[] = [
    {
      header: 'Chemical Code',
      accessor: (row) => (
        <div>
          <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
          <span className="text-[11px] text-slate-400 block">{row.chemicalDetails?.chemicalCategory || row.categoryName}</span>
        </div>
      )
    },
    {
      header: 'Chemical Name & Brand',
      accessor: (row) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs">{row.itemName}</span>
          {row.chemicalDetails?.brand && (
            <span className="text-[11px] text-indigo-700 font-medium">Brand: {row.chemicalDetails.brand}</span>
          )}
          {row.chemicalDetails?.manufacturer && (
            <span className="text-[11px] text-slate-400 block">Mfg: {row.chemicalDetails.manufacturer}</span>
          )}
        </div>
      )
    },
    {
      header: 'Grade & pH',
      accessor: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-700 block">
            {row.chemicalDetails?.chemicalGrade || 'Textile Grade'}
          </span>
          <span className="text-[11px] text-slate-400">pH: {row.chemicalDetails?.phRange || 'Neutral'}</span>
        </div>
      )
    },
    {
      header: 'Compliance & Tracking',
      accessor: (row) => {
        const isBatch = row.chemicalDetails?.batchTrackingRequired || row.batchTrackingEnabled;
        const isExpiry = row.chemicalDetails?.expiryTrackingRequired || row.expiryTrackingEnabled;
        return (
          <div className="flex flex-wrap gap-1">
            {isBatch && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Batch Tracked
              </span>
            )}
            {isExpiry && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Expiry Monitored
              </span>
            )}
            {!isBatch && !isExpiry && <span className="text-xs text-slate-400">Standard</span>}
          </div>
        );
      }
    },
    {
      header: 'Warehouse Stock',
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
          {row.preferredSupplierName || 'Direct Vendor'}
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
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Edit Chemical"
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
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Total Chemicals</span>
            <FlaskConical className="w-4 h-4 text-[#1F4E79]" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{activeCount} currently active for shopfloor</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Batch Controlled</span>
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{batchTrackedCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Strict lot tracking enforced</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">
            <span>Reorder Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{lowStockCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Below threshold stock</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            Quick Actions
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onAddNew}
            className="w-full mt-2"
          >
            New Chemical Master
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table columns={columns} data={chemicals} keyExtractor={(row) => row.id} />
      </div>
    </div>
  );
};
