import React from 'react';
import {
  Building2,
  CheckCircle,
  XCircle,
  Users,
  Truck,
  AlertTriangle,
  GitFork,
  ArrowRight,
  TrendingUp,
  Briefcase
} from 'lucide-react';
import { Card } from '../../../components/ui/Card';

interface DashboardMetrics {
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
  customers: number;
  suppliers: number;
  bothCount: number;
  subcompanyCount: number;
  missingDetailsCount: number;
}

interface VendorDashboardProps {
  metrics: DashboardMetrics;
  onFilterClick: (filterType: string, filterValue?: any) => void;
  onAddNewClick: () => void;
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  metrics,
  onFilterClick,
  onAddNewClick
}) => {
  const cards = [
    {
      id: 'total',
      title: 'Total Vendors & Clients',
      value: metrics.totalVendors,
      icon: <Building2 className="w-6 h-6 text-blue-600" />,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-800',
      description: 'All registered enterprise entities',
      actionFilter: { type: 'status', value: 'all' }
    },
    {
      id: 'active',
      title: 'Active Vendors',
      value: metrics.activeVendors,
      icon: <CheckCircle className="w-6 h-6 text-emerald-600" />,
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      description: 'Operational and eligible for PO / Invoices',
      actionFilter: { type: 'status', value: 'active' }
    },
    {
      id: 'inactive',
      title: 'Inactive Vendors',
      value: metrics.inactiveVendors,
      icon: <XCircle className="w-6 h-6 text-slate-500" />,
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      badgeColor: 'bg-slate-200 text-slate-700',
      description: 'Deactivated or suspended records',
      actionFilter: { type: 'status', value: 'inactive' }
    },
    {
      id: 'customers',
      title: 'Customers Only',
      value: metrics.customers,
      icon: <Users className="w-6 h-6 text-purple-600" />,
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      badgeColor: 'bg-purple-100 text-purple-800',
      description: 'Fabric & Garment washing buyers',
      actionFilter: { type: 'vendorType', value: 'customer' }
    },
    {
      id: 'suppliers',
      title: 'Suppliers Only',
      value: metrics.suppliers,
      icon: <Truck className="w-6 h-6 text-amber-600" />,
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-800',
      description: 'Raw material & chemical suppliers',
      actionFilter: { type: 'vendorType', value: 'supplier' }
    },
    {
      id: 'both',
      title: 'Customer & Supplier (Both)',
      value: metrics.bothCount,
      icon: <TrendingUp className="w-6 h-6 text-indigo-600" />,
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      description: 'Dual-role commercial entities',
      actionFilter: { type: 'vendorType', value: 'both' }
    },
    {
      id: 'subcompany',
      title: 'Subcontractors / Subcompanies',
      value: metrics.subcompanyCount,
      icon: <GitFork className="w-6 h-6 text-teal-600" />,
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      badgeColor: 'bg-teal-100 text-teal-800',
      description: 'Linked sub-units & subcontract facilities',
      actionFilter: { type: 'hasSubcompany', value: true }
    },
    {
      id: 'missingDetails',
      title: 'Missing Important Details',
      value: metrics.missingDetailsCount,
      icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      badgeColor: 'bg-rose-100 text-rose-800',
      description: 'Missing GSTIN, primary contact, or phone',
      actionFilter: { type: 'missingDetails', value: true }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1F4E79] to-[#2A629A] rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-6 h-6 text-amber-300" />
            <h1 className="text-2xl font-bold tracking-tight">Vendor & Customer Master Dashboard</h1>
          </div>
          <p className="text-slate-200 text-sm max-w-2xl">
            Single source of truth for Perla Textiles Processor customers, chemical suppliers, subcontractors, transporters, and associated subcompanies.
          </p>
        </div>
        <button
          onClick={onAddNewClick}
          className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-sm transition-all duration-200 hover:scale-102 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>+ Add New Vendor Record</span>
        </button>
      </div>

      {/* Grid of Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => onFilterClick(card.actionFilter.type, card.actionFilter.value)}
            className={`p-5 rounded-2xl border ${card.borderColor} ${card.bgColor} cursor-pointer hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 flex flex-col justify-between group`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 bg-white rounded-xl shadow-2xs group-hover:scale-110 transition-transform">
                  {card.icon}
                </div>
                <span className={`text-2xl font-black ${card.badgeColor} px-3 py-1 rounded-xl`}>
                  {card.value}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-sm mb-1">{card.title}</h3>
              <p className="text-xs text-slate-600 line-clamp-2">{card.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-[#1F4E79] group-hover:text-blue-700">
              <span>View Filtered List</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
