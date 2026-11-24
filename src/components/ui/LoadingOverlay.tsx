import React from 'react';

export interface LoadingOverlayProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  badge?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isOpen,
  title = 'Processing...',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-transparent text-center space-y-3.5 max-w-xs w-full mx-auto p-4 flex flex-col items-center justify-center">
        {/* Gray and White Loading Circle */}
        <div className="w-11 h-11 rounded-full border-[3px] border-neutral-400/30 border-t-white animate-spin" />

        {/* Short Content Related to Loading */}
        <p className="text-sm font-medium text-white tracking-wide text-center">
          {title}
        </p>
      </div>
    </div>
  );
};
