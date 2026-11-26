import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Vendor } from '../../types/vendor';
import { SamplePoInward, SamplePoOutward } from '../../types/samplePo';
import { SamplePoService } from '../../services/samplePoService';
import { SampleOutwardTab } from './components/SampleOutwardTab';
import { SampleOutwardReport } from './components/SampleOutwardReport';

interface SampleOutwardPageProps {
  vendors?: Vendor[];
}

export const SampleOutwardPage: React.FC<SampleOutwardPageProps> = ({ vendors = [] }) => {
  const { user, isDemoMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [samplePos, setSamplePos] = useState<SamplePoInward[]>(() => SamplePoService.getCache());
  const [sampleOutwards, setSampleOutwards] = useState<SamplePoOutward[]>(() =>
    SamplePoService.getOutwardCache()
  );
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showReport, setShowReport] = useState<boolean>(false);
  const [preSelectedInward, setPreSelectedInward] = useState<SamplePoInward | null>(
    () => (location.state as any)?.preSelectedInward || null
  );

  // Sync preSelectedInward if navigated with state
  useEffect(() => {
    const incoming = (location.state as any)?.preSelectedInward as SamplePoInward | undefined;
    if (incoming) {
      setPreSelectedInward(incoming);
      // Clear router state so refresh doesn't re-open unexpectedly
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Subscribe to Sample PO Inwards
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = SamplePoService.subscribeSamplePos(
      (data) => {
        if (isMounted) setSamplePos(data);
      },
      () => {
        SamplePoService.getSamplePos(isDemoMode).then((data) => {
          if (isMounted) setSamplePos(data);
        });
      }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemoMode]);

  // Subscribe to Sample Outwards
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = SamplePoService.subscribeSampleOutwards(
      (data) => {
        if (isMounted) setSampleOutwards(data);
      },
      () => {
        SamplePoService.getSampleOutwards(isDemoMode).then((data) => {
          if (isMounted) setSampleOutwards(data);
        });
      }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemoMode]);

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs (matching Sample PO / Inward & Purchase Orders) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sample Outward</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage sample outward dispatches, challan deliveries, and generate consolidated reports
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setShowReport(false)}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              !showReport
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Dispatches</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
              {sampleOutwards.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              showReport
                ? 'bg-white text-[#1F4E79] shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Report Generation</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs border ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showReport ? (
        <SampleOutwardReport
          sampleOutwards={sampleOutwards}
          vendors={vendors}
          onBack={() => setShowReport(false)}
        />
      ) : (
        <SampleOutwardTab
          sampleOutwards={sampleOutwards}
          samplePos={samplePos}
          vendors={vendors}
          user={user}
          isDemoMode={isDemoMode}
          onRefresh={() => {
            SamplePoService.getSampleOutwards(isDemoMode).then(setSampleOutwards);
            SamplePoService.getSamplePos(isDemoMode).then(setSamplePos);
          }}
          onNotice={(n) => setNotice(n)}
          preSelectedInward={preSelectedInward}
          onClearPreSelectedInward={() => setPreSelectedInward(null)}
        />
      )}
    </div>
  );
};
