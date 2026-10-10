import React from 'react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-8 flex-1">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
          {/* {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>} */}
        </div>
      </div>

      <div className="flex items-center space-x-5">
        {/* User Info */}
        <div className="flex items-center space-x-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-colors">
          <div className="hidden sm:block text-right">
            <div className="text-[13px] font-bold text-slate-900 leading-none">{user?.displayName || 'Johan'}</div>
            <div className="text-[11px] text-slate-500 leading-none mt-1">{user?.role || 'Admin'}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs border border-slate-200 shadow-sm">
            {user?.displayName ? user.displayName.charAt(0) : 'J'}
          </div>
        </div>
      </div>
    </header>
  );
};
