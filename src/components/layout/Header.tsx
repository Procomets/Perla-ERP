import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onToggleMobileMenu }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">{title}</h2>
          {/* {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>} */}
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-5 shrink-0">
        {/* User Info */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
          <div className="hidden sm:block text-right">
            <div className="text-[13px] font-bold text-slate-900 leading-none">{user?.displayName || 'Johan'}</div>
            <div className="text-[11px] text-slate-500 leading-none mt-1">{user?.role || 'Admin'}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs border border-slate-200 shadow-sm shrink-0">
            {user?.displayName ? user.displayName.charAt(0) : 'J'}
          </div>
        </div>
      </div>
    </header>
  );
};
