import React from 'react';
import {
  LayoutDashboard,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  Receipt,
  FlaskConical,
  Warehouse,
  ShoppingBag,
  Users,
  Banknote,
  Zap,
  Truck,
  Building2,
  Package,
  Home,
  LogOut,
  Shirt,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  rolesAllowed: ('Admin' | 'Manager' | 'Supervisor')[];
}

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onGoToLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onGoToLogin }) => {
  const { activeRole, logout } = useAuth();

  const navCategories = [
    [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, rolesAllowed: ['Admin'] }
    ],
    [
      { id: 'po', label: 'Purchase Orders', icon: <FileText className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'inward', label: 'Inward Receipts', icon: <ArrowDownLeft className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'outward', label: 'Outward Dispatches', icon: <ArrowUpRight className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'statement', label: 'Statement & Approval', icon: <Scale className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'invoices', label: 'Invoice Generation', icon: <Receipt className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
    ],
    [
      { id: 'chemical', label: 'Chemical Entry', icon: <FlaskConical className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager', 'Supervisor'] },
      { id: 'warehouse', label: 'Warehouse & Stock', icon: <Warehouse className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'purchases', label: 'Purchases (Raw/Wood)', icon: <ShoppingBag className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
    ],
    [
      { id: 'employees', label: 'Employee Master', icon: <UserCheck className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'attendance', label: 'Attendance', icon: <Users className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'salary', label: 'Salary', icon: <Banknote className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
    ],
    [
      { id: 'eb', label: 'EB / Electricity Entry', icon: <Zap className="w-4 h-4" />, rolesAllowed: ['Admin', 'Supervisor'] },
      { id: 'transport', label: 'Transport Expenses', icon: <Truck className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
    ],
    [
      { id: 'vendors', label: 'Vendor Master', icon: <Building2 className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'items', label: 'Item / Chemical Master', icon: <Package className="w-4 h-4" />, rolesAllowed: ['Admin', 'Manager'] },
      { id: 'users', label: 'User Management', icon: <Users className="w-4 h-4" />, rolesAllowed: ['Admin'] },
    ]
  ];

  // Filter items in each category based on role and remove empty categories
  const visibleCategories = navCategories
    .map(category => category.filter(item => item.rolesAllowed.includes(activeRole)))
    .filter(category => category.length > 0);

  return (
    <aside className="w-64 bg-[#F8F9FA] text-slate-800 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-200/80">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-slate-200/80 flex items-center bg-white h-16 shrink-0">
        <div>
          <h1 className="font-bold text-base tracking-wide text-slate-900 leading-tight">Perla Textiles Processor</h1>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-3">
        {visibleCategories.map((category, catIndex) => (
          <React.Fragment key={catIndex}>
            <div className="space-y-1">
              {category.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                    }`}
                  >
                    <span className={`${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Divider between categories (skip after last category) */}
            {catIndex < visibleCategories.length - 1 && (
              <div className="border-b border-slate-300/80 mx-2" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Footer Controls */}
      <div className="p-3 border-t border-slate-200/80 space-y-1 bg-[#F8F9FA]">
        <button
          onClick={async () => {
            await logout();
            onGoToLogin();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
