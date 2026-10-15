import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  Ban,
  Boxes,
  Weight,
  IndianRupee
} from 'lucide-react';
import { PODashboardMetrics } from '../../../types/po';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';

interface PODashboardProps {
  metrics: PODashboardMetrics;
  onFilterByStatus?: (status: string) => void;
}

export const PODashboard: React.FC<PODashboardProps> = ({
  metrics,
  onFilterByStatus
}) => {
  const cards = [
    {
      label: 'Total POs',
      value: metrics.totalPOs,
      icon: FileText,
      color: 'text-[#1F4E79]',
      bgColor: 'bg-[#EEF5FB]',
      borderColor: 'border-[#BDD7EE]',
      status: 'all'
    },
    {
      label: 'Draft POs',
      value: metrics.draftPOs,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      status: 'draft'
    },
    {
      label: 'Approved POs',
      value: metrics.approvedPOs,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      status: 'approved'
    },
    {
      label: 'Cancelled POs',
      value: metrics.cancelledPOs,
      icon: Ban,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      status: 'cancelled'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Primary Status Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={() => onFilterByStatus && onFilterByStatus(c.status)}
              className={`p-3 rounded-xl border ${c.borderColor} ${c.bgColor} text-left transition-all hover:shadow-xs hover:-translate-y-0.5 cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  {c.label}
                </span>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
              <div className={`text-xl font-black ${c.color}`}>{c.value}</div>
            </button>
          );
        })}
      </div>

      {/* Volume & Value Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Ordered Pieces
            </div>
            <div className="text-lg font-black text-slate-900">
              {formatQuantity(metrics.totalPieces, 'piece')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600">
            <Weight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Ordered Weight
            </div>
            <div className="text-lg font-black text-slate-900">
              {formatQuantity(metrics.totalKg, 'kg')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Order Value
            </div>
            <div className="text-lg font-black text-emerald-700">
              {formatCurrency(metrics.totalOrderValue)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
