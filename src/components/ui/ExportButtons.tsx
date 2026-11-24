import React from 'react';
import { FileDown, FileSpreadsheet, Printer, Loader2 } from 'lucide-react';

export type ExportButtonVariant =
  | 'pdf'
  | 'excel'
  | 'excel-detailed'
  | 'excel-summary'
  | 'preview';

export interface ExportButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ExportButtonVariant;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  hideIcon?: boolean;
  label?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Universal Reusable Export Button with simple UI & solid, slightly dark tones.
 * Matches Perla ERP design system across all reporting and data modules.
 */
export const ExportButton: React.FC<ExportButtonProps> = ({
  variant = 'pdf',
  loading = false,
  loadingText,
  icon,
  hideIcon = true,
  label,
  children,
  size = 'md',
  disabled,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.99]';

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs gap-1.5',
    md: 'h-9 px-3.5 text-xs gap-2 shadow-2xs',
    lg: 'h-10 px-4 text-sm gap-2 shadow-xs'
  };

  const variantClasses: Record<ExportButtonVariant, string> = {
    // 1. Solid slightly dark Red for PDF
    pdf: 'text-white bg-red-700 hover:bg-red-800 active:bg-red-900 border border-red-800/50 shadow-2xs',

    // 2. Solid slightly dark Emerald Green for detailed Excel with colours
    excel:
      'text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-800/50 shadow-2xs',
    'excel-detailed':
      'text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 border border-emerald-800/50 shadow-2xs',

    // 3. Solid slightly dark Blue for summary Excel (PO info only)
    'excel-summary':
      'text-white bg-blue-800 hover:bg-blue-900 active:bg-blue-950 border border-blue-900/50 shadow-2xs',

    // 4. Clean white / slate border for preview
    preview:
      'text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
  };

  const defaultIcons: Record<ExportButtonVariant, React.ReactNode> = {
    pdf: <FileDown className="w-3.5 h-3.5" />,
    excel: <FileSpreadsheet className="w-3.5 h-3.5" />,
    'excel-detailed': <FileSpreadsheet className="w-3.5 h-3.5" />,
    'excel-summary': <FileSpreadsheet className="w-3.5 h-3.5" />,
    preview: <Printer className="w-3.5 h-3.5 text-slate-600" />
  };

  const defaultLabels: Record<ExportButtonVariant, string> = {
    pdf: 'Download PDF',
    excel: 'Excel (With Colours)',
    'excel-detailed': 'Excel (With Colours)',
    'excel-summary': 'Excel (Summary)',
    preview: 'Preview'
  };

  const currentIcon = loading ? (
    <Loader2 className="w-3.5 h-3.5 animate-spin" />
  ) : hideIcon ? (
    null
  ) : icon !== undefined ? (
    icon
  ) : (
    defaultIcons[variant]
  );

  const displayText = loading
    ? loadingText || 'Exporting...'
    : children || label || defaultLabels[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {currentIcon && <span className="shrink-0">{currentIcon}</span>}
      {displayText && <span>{displayText}</span>}
    </button>
  );
};

// --- Specialized Convenience Export Components ---
export const PdfExportButton: React.FC<Omit<ExportButtonProps, 'variant'>> = (props) => (
  <ExportButton variant="pdf" {...props} />
);

export const ExcelExportButton: React.FC<Omit<ExportButtonProps, 'variant'>> = (props) => (
  <ExportButton variant="excel" {...props} />
);

export const ExcelSummaryExportButton: React.FC<Omit<ExportButtonProps, 'variant'>> = (props) => (
  <ExportButton variant="excel-summary" {...props} />
);

export const PreviewButton: React.FC<Omit<ExportButtonProps, 'variant'>> = (props) => (
  <ExportButton variant="preview" {...props} />
);
