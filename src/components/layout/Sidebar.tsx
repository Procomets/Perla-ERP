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
  UserCheck,
  Settings,
  ShieldCheck,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onGoToLogin: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onGoToLogin,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user, designation, isAdmin, canView, logout } = useAuth();

  const navCategories = [
    [
      { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }
    ],
    [
      { id: 'po', label: 'Purchase Orders', icon: <FileText className="w-4 h-4" /> },
      { id: 'inward', label: 'Inward Receipts', icon: <ArrowDownLeft className="w-4 h-4" /> },
      { id: 'outward', label: 'Outward Dispatches', icon: <ArrowUpRight className="w-4 h-4" /> },
      { id: 'statement', label: 'Statement & Approval', icon: <Scale className="w-4 h-4" /> },
      { id: 'invoices', label: 'Invoice Generation', icon: <Receipt className="w-4 h-4" /> },
    ],
    [
      { id: 'chemical', label: 'Chemical Entry', icon: <FlaskConical className="w-4 h-4" /> },
      { id: 'warehouse', label: 'Warehouse & Stock', icon: <Warehouse className="w-4 h-4" /> },
      { id: 'purchases', label: 'Purchases (Raw/Wood)', icon: <ShoppingBag className="w-4 h-4" /> },
    ],
    [
      { id: 'employees', label: 'Employee Master', icon: <UserCheck className="w-4 h-4" /> },
      { id: 'attendance', label: 'Attendance', icon: <Users className="w-4 h-4" /> },
      { id: 'salary', label: 'Salary', icon: <Banknote className="w-4 h-4" /> },
    ],
    [
      { id: 'eb', label: 'EB / Electricity Entry', icon: <Zap className="w-4 h-4" /> },
      { id: 'transport', label: 'Transport Expenses', icon: <Truck className="w-4 h-4" /> },
    ],
    [
      { id: 'vendors', label: 'Vendor Master', icon: <Building2 className="w-4 h-4" /> },
      { id: 'items', label: 'Item / Chemical Master', icon: <Package className="w-4 h-4" /> },
      { id: 'users', label: 'User Management', icon: <Users className="w-4 h-4" /> },
      { id: 'settings', label: 'General Settings', icon: <Settings className="w-4 h-4" /> },
    ]
  ];

  // Filter items in each category: if Admin show everything, otherwise check canView(id)
  const visibleCategories = navCategories
    .map(category => category.filter(item => isAdmin || canView(item.id)))
    .filter(category => category.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[#F8F9FA] text-slate-800 flex flex-col shrink-0 h-screen border-r border-slate-200/80 transition-transform duration-300 ease-in-out md:static md:w-64 md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-slate-200/80 flex items-center justify-between bg-white h-16 shrink-0">
          <div className="min-w-0">
            <h1 className="font-bold text-base tracking-wide text-slate-900 leading-tight truncate">Perla Textiles Processor</h1>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
                      onClick={() => {
                        onSelectTab(item.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-black text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <span className={`${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
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

        {/* User Info & Footer Controls */}
        <div className="p-3 border-t border-slate-200/80 space-y-2 bg-[#F8F9FA]">
          <div className="px-3 py-2 bg-white rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 shadow-xs">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.displayName || 'User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email}
              </div>
            </div>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-black text-white shrink-0 uppercase tracking-tight">
              {designation}
            </span>
          </div>

          <button
            onClick={async () => {
              onCloseMobile?.();
              await logout();
              onGoToLogin();
            }}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
