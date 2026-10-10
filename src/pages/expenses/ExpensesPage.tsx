import React from 'react';
import { EBEntry, TransportExpense } from '../../types/expenses';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Zap, Truck, Plus } from 'lucide-react';

interface ExpensesPageProps {
  ebEntries: EBEntry[];
  transportExpenses: TransportExpense[];
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ ebEntries, transportExpenses }) => {
  const ebColumns: Column<EBEntry>[] = [
    { header: 'Entry ID', accessor: 'entryId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'Meter ID', accessor: 'meterId' },
    { header: 'kWh Reading', accessor: (row) => `${row.kwhReading.toLocaleString()} kWh` },
    { header: 'kVAh Reading', accessor: (row) => `${row.kvahReading.toLocaleString()} kVAh` },
    { header: 'Unit Rate (₹)', accessor: (row) => formatCurrency(row.unitRate) },
    { header: 'Calculated Cost', accessor: (row) => formatCurrency(row.calculatedAmount), className: 'font-bold text-[#1F4E79]' }
  ];

  const transportColumns: Column<TransportExpense>[] = [
    { header: 'Expense Ref', accessor: 'expenseId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'Freight Category', accessor: 'category' },
    { header: 'Transporter', accessor: 'transporterName' },
    { header: 'Vehicle No', accessor: 'vehicleNo' },
    { header: 'Route / Reference', accessor: 'sourceDestination' },
    { header: 'Amount', accessor: (row) => formatCurrency(row.amount), className: 'font-bold' },
    { header: 'Status', accessor: (row) => <StatusChip status={row.paymentStatus} /> }
  ];

  return (
    <div className="space-y-8">
      {/* EB Electricity Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <h2 className="text-lg font-bold text-[#1F4E79] flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" /> EB / Electricity Meter Entries
            </h2>
            <p className="text-xs text-slate-500">Capture factory electricity consumption, meter parameters, and utility costs</p>
          </div>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            New EB Reading
          </Button>
        </div>
        <Card>
          <Table columns={ebColumns} data={ebEntries} keyExtractor={(row) => row.id} />
        </Card>
      </div>

      {/* Transport Expense Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div>
            <h2 className="text-lg font-bold text-[#1F4E79] flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" /> Transportation & Freight Expenses
            </h2>
            <p className="text-xs text-slate-500">Track transport costs linked to customer delivery challans and raw material deliveries</p>
          </div>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            New Freight Entry
          </Button>
        </div>
        <Card>
          <Table columns={transportColumns} data={transportExpenses} keyExtractor={(row) => row.id} />
        </Card>
      </div>
    </div>
  );
};
