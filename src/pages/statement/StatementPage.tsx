import React from 'react';
import { PurchaseOrder } from '../../types/po';
import { InwardEntry, OutwardEntry, StatementColourSummary } from '../../types/inwardOutward';
import { calculateStatementSummaries } from '../../utils/calculations';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency, formatQuantity } from '../../utils/formatters';
import { Scale, CheckCircle2, ShieldCheck } from 'lucide-react';

interface StatementPageProps {
  pos: PurchaseOrder[];
  inwards: InwardEntry[];
  outwards: OutwardEntry[];
  approvedPoLineIds: string[];
  invoicedPoLineIds: string[];
  onApproveForInvoice: (poLineId: string) => void;
}

export const StatementPage: React.FC<StatementPageProps> = ({
  pos,
  inwards,
  outwards,
  approvedPoLineIds,
  invoicedPoLineIds,
  onApproveForInvoice
}) => {
  const summaries = calculateStatementSummaries(pos, inwards, outwards, approvedPoLineIds, invoicedPoLineIds);

  const columns: Column<StatementColourSummary>[] = [
    { header: 'PO Number', accessor: 'poNumber', className: 'font-bold text-[#1F4E79]' },
    { header: 'Style Number', accessor: 'styleNo' },
    { header: 'Colour Line', accessor: 'colour', className: 'font-bold' },
    { header: 'Process', accessor: 'processType' },
    { header: 'Total Inward', accessor: (row) => formatQuantity(row.cumulativeInward, row.unit) },
    { header: 'Total Outward', accessor: (row) => formatQuantity(row.cumulativeOutward, row.unit) },
    {
      header: 'Difference',
      accessor: (row) => (
        <span className={`font-bold ${row.difference === 0 && row.cumulativeInward > 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
          {formatQuantity(row.difference, row.unit)}
        </span>
      )
    },
    {
      header: 'Reconciliation Status',
      accessor: (row) => {
        if (row.isInvoiced) return <StatusChip status="Invoiced" variant="slate" />;
        if (row.isApprovedForInvoice) return <StatusChip status="Approved for Invoice" variant="green" />;
        if (row.isReadyForInvoice) return <StatusChip status="Ready for Invoice" variant="green" />;
        return <StatusChip status="In Progress" variant="amber" />;
      }
    },
    {
      header: 'Action',
      accessor: (row) => {
        if (row.isInvoiced) {
          return <span className="text-[10px] text-slate-400 font-semibold uppercase">Billed</span>;
        }
        if (row.isApprovedForInvoice) {
          return <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Approved</span>;
        }
        if (row.isReadyForInvoice) {
          return (
            <Button
              size="sm"
              variant="success"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => onApproveForInvoice(row.poLineId)}
            >
              Approve to Invoice
            </Button>
          );
        }
        return <span className="text-xs text-slate-400 font-medium">Awaiting Dispatch</span>;
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
        <h2 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
          <Scale className="w-5 h-5" /> Inward vs Outward Reconciliation Statement
        </h2>
        <p className="text-xs text-slate-500">
          Colour-wise audit ledger. A colour line becomes eligible for invoice approval when total inward quantity equals total outward dispatch quantity.
        </p>
      </div>

      <Card>
        <Table columns={columns} data={summaries} keyExtractor={(row) => `${row.poId}-${row.poLineId}`} />
      </Card>
    </div>
  );
};
