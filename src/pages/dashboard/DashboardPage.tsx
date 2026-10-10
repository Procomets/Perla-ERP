import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatusChip } from '../../components/ui/StatusChip';
import { Table, Column } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatQuantity } from '../../utils/formatters';
import { PurchaseOrder } from '../../types/po';
import { InventoryItem } from '../../types/stock';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FlaskConical,
  MoreHorizontal,
  ArrowUpRight as ArrowUpRightIcon
} from 'lucide-react';

interface DashboardPageProps {
  pos: PurchaseOrder[];
  inventory: InventoryItem[];
  onNavigate: (tabId: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ pos, inventory, onNavigate }) => {
  const { user } = useAuth();
  const totalOpenPos = pos.filter((p) => p.status !== 'Completed' && p.status !== 'Cancelled').length;
  const totalOrderedQty = pos.reduce((acc, p) => acc + p.totalQuantity, 0);

  const lowStockItems = inventory.filter((item) => item.currentStock <= item.reorderLevel);

  const poColumns: Column<PurchaseOrder>[] = [
    { header: 'PO Number', accessor: 'poNumber', className: 'font-bold text-slate-900' },
    { header: 'Customer', accessor: 'customerName' },
    { header: 'Style No', accessor: 'styleNo' },
    { header: 'Process', accessor: 'processCategory' },
    { header: 'Total Qty', accessor: (row) => formatQuantity(row.totalQuantity, row.lines[0]?.unit || 'pc') },
    { header: 'Value', accessor: (row) => formatCurrency(row.totalAmount), className: 'font-bold' },
    { header: 'Status', accessor: (row) => <StatusChip status={row.status} /> }
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Top Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Good morning, {user?.displayName?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <FileText className="w-4 h-4" />
              <span className="text-sm font-semibold">Active Work Orders</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Total POs still this month</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-slate-900 leading-none">{totalOpenPos}</h3>
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 mb-0.5">
              <ArrowUpRightIcon className="w-3 h-3" /> +12%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Vs Last Period</p>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <ArrowDownLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">Inward Received</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Total quantity still this month</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-slate-900 leading-none">6,300</h3>
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 mb-0.5">
              <ArrowUpRightIcon className="w-3 h-3" /> +8%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Vs Last Period</p>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Receipt className="w-4 h-4" />
              <span className="text-sm font-semibold">Invoice Ready Value</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Total value still this month</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-slate-900 leading-none">₹26.7k</h3>
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 mb-0.5">
              <ArrowUpRightIcon className="w-3 h-3" /> +15%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Vs Last Period</p>
        </Card>

        <Card className="flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <FlaskConical className="w-4 h-4" />
              <span className="text-sm font-semibold">Chemical Usage</span>
            </div>
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Total consumption still this month</p>
          <div className="flex items-end gap-3">
            <h3 className="text-3xl font-bold text-slate-900 leading-none">20.5 <span className="text-xl">kg</span></h3>
            <span className="flex items-center gap-1 bg-rose-50 text-rose-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-100 mb-0.5">
              <ArrowUpRightIcon className="w-3 h-3" /> +3.2%
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Vs Last Period</p>
        </Card>
      </div>

      {/* Main Row: PO Table & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Purchase Orders Table */}
        <div className="lg:col-span-8">
          <Card
            title="Recent Purchase Orders"
            action={
              <Button size="sm" variant="primary" onClick={() => onNavigate('po')}>
                View all
              </Button>
            }
          >
            <Table
              columns={poColumns}
              data={pos}
              keyExtractor={(row) => row.id}
              onRowClick={() => onNavigate('po')}
            />
          </Card>
        </div>

        {/* Low Stock Alerts & Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          <Card title="Quick Operational Actions">
            <div className="flex flex-col gap-2.5">
              <Button variant="secondary" className="w-full justify-start py-2.5" onClick={() => onNavigate('inward')} icon={<ArrowDownLeft className="w-4 h-4 text-slate-400" />}>
                Record Inward Receipt
              </Button>
              <Button variant="secondary" className="w-full justify-start py-2.5" onClick={() => onNavigate('chemical')} icon={<FlaskConical className="w-4 h-4 text-slate-400" />}>
                Log Chemical Entry
              </Button>
              <Button variant="secondary" className="w-full justify-start py-2.5" onClick={() => onNavigate('outward')} icon={<ArrowUpRight className="w-4 h-4 text-slate-400" />}>
                Record Outward Dispatch
              </Button>
              <Button variant="secondary" className="w-full justify-start py-2.5" onClick={() => onNavigate('statement')} icon={<Receipt className="w-4 h-4 text-slate-400" />}>
                Statement Reconciliation
              </Button>
            </div>
          </Card>

          <Card
            title="Inventory Alerts"
            action={<span className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-900 transition-colors">View all</span>}
          >
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">All warehouse stock levels are healthy.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.code}</p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-bold text-slate-900">{item.currentStock} {item.baseUnit}</span>
                      <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold mt-1">Low Stock</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
