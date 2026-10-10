import React from 'react';

export type StatusVariant = 'blue' | 'green' | 'amber' | 'rose' | 'slate' | 'indigo' | 'emerald';

interface StatusChipProps {
  status: string;
  variant?: StatusVariant; // If not provided, it will be auto-derived from status string
}

const getVariantForStatus = (status: string): StatusVariant => {
  const s = status.toLowerCase();
  if (s.includes('approve') || s.includes('complete') || s.includes('success') || s.includes('paid')) return 'emerald';
  if (s.includes('progress') || s.includes('partial') || s.includes('active')) return 'blue';
  if (s.includes('draft') || s.includes('pending') || s.includes('wait')) return 'amber';
  if (s.includes('cancel') || s.includes('fail') || s.includes('reject')) return 'rose';
  return 'slate';
};

const variantStyles: Record<StatusVariant, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200/60',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  slate: 'bg-slate-50 text-slate-700 border-slate-200/60',
};

export const StatusChip: React.FC<StatusChipProps> = ({ status, variant }) => {
  const finalVariant = variant || getVariantForStatus(status);
  
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${variantStyles[finalVariant]}`}>
      {status}
    </span>
  );
};
