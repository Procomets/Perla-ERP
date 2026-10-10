import React from 'react';
import { Shirt, LogIn, Phone, ShieldCheck, MapPin } from 'lucide-react';
import { Button } from '../ui/Button';

interface NavbarProps {
  onOpenLogin: () => void;
  onNavigateErp: () => void;
  isLoggedIn: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenLogin, onNavigateErp, isLoggedIn }) => {
  return (
    <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Company Identity */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#1F4E79] to-[#2B6CB0] flex items-center justify-center text-white shadow-md">
              <Shirt className="w-7 h-7" />
            </div>
            <div>
              <span className="text-xl font-black tracking-wider text-[#1F4E79] uppercase block leading-none">
                Perla Textiles
              </span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mt-0.5">
                Processor • Thirumudivakkam
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-8 font-medium text-sm text-slate-700">
            <a href="#about" className="hover:text-[#1F4E79] transition-colors">About Us</a>
            <a href="#services" className="hover:text-[#1F4E79] transition-colors">Washing & Dyeing</a>
            <a href="#facilities" className="hover:text-[#1F4E79] transition-colors">Infrastructure</a>
            <a href="#quality" className="hover:text-[#1F4E79] transition-colors">Quality Assurance</a>
            <a href="#contact" className="hover:text-[#1F4E79] transition-colors">Contact</a>
          </div>

          {/* Actions & Login to ERP CTA */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center text-xs text-slate-500 bg-[#EEF5FB] px-3 py-1.5 rounded-lg border border-blue-100">
              <MapPin className="w-3.5 h-3.5 text-[#1F4E79] mr-1.5 shrink-0" />
              <span>Thirumudivakkam, TN</span>
            </div>

            {isLoggedIn ? (
              <Button
                variant="primary"
                size="md"
                onClick={onNavigateErp}
                icon={<ShieldCheck className="w-4 h-4" />}
              >
                Go to ERP Dashboard
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={onOpenLogin}
                icon={<LogIn className="w-4 h-4" />}
              >
                Login to ERP
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
