import React from 'react';
import { UnitOfMeasure } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { Scale, Plus, Edit2, CheckCircle2, XCircle } from 'lucide-react';

interface UnitsViewProps {
  units: UnitOfMeasure[];
  onAddUnit: () => void;
  onEditUnit: (unit: UnitOfMeasure) => void;
  onToggleStatus: (unit: UnitOfMeasure) => void;
  isAdminOrManager?: boolean;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  onAddUnit,
  onEditUnit,
  onToggleStatus,
  isAdminOrManager
}) => {
  const columns: Column<UnitOfMeasure>[] = [
    {
      header: 'Symbol / Code',
      accessor: (row) => (
        <span className="font-black text-[#1F4E79] font-mono text-xs">{row.symbol}</span>
      )
    },
    {
      header: 'Canonical Unit Name',
      accessor: (row) => (
        <span className="font-bold text-slate-900 text-xs">{row.unitName}</span>
      )
    },
    {
      header: 'Measurement Type',
      accessor: (row) => (
        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
          {row.unitType}
        </span>
      )
    },
    {
      header: 'Conversion Factor',
      accessor: (row) => (
        <div className="text-xs text-slate-700 font-mono">
          {row.conversionFactorToBase && row.baseUnit
            ? `1 ${row.symbol} = ${row.conversionFactorToBase} ${row.baseUnit}`
            : 'Base Reference Unit'}
        </div>
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
          {isAdminOrManager && (
            <>
              <button
                onClick={() => onEditUnit(row)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-[#1F4E79] hover:bg-slate-100 transition-colors"
                title="Edit Unit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onToggleStatus(row)}
                className={`p-1.5 rounded-lg transition-colors ${
                  row.status === 'active'
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
                title={row.status === 'active' ? 'Deactivate Unit' : 'Activate Unit'}
              >
                {row.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Units of Measurement (UOM) Directory</h3>
          <p className="text-xs text-slate-500">
            Canonical weights, volumes, metric packages, and conversion ratios across Purchasing and Shopfloor
          </p>
        </div>
        {isAdminOrManager && (
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={onAddUnit}
          >
            New Unit of Measure
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <Table columns={columns} data={units} keyExtractor={(row) => row.id} />
      </div>
    </div>
  );
};
