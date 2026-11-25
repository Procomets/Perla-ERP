import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X, Table as TableIcon } from 'lucide-react';

export { TableTotalsFooter } from './TableTotalsFooter';
export type { TableTotalsCell, TableTotalsFooterProps } from './TableTotalsFooter';

export interface TableMaximizeButtonProps {
  isMaximized: boolean;
  onToggle: () => void;
  title?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Reusable maximize/minimize icon button.
 * Can be placed in table headers, toolbars, or floating sticky corners.
 */
export const TableMaximizeButton: React.FC<TableMaximizeButtonProps> = ({
  isMaximized,
  onToggle,
  title,
  className = '',
  size = 'sm'
}) => {
  const iconSizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4'
  };

  const btnPaddingClasses = {
    xs: 'p-1',
    sm: 'p-1.5',
    md: 'p-2'
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`inline-flex items-center justify-center rounded-lg text-slate-600 hover:text-[#1F4E79] bg-white/95 backdrop-blur-xs border border-slate-300 hover:border-[#1F4E79] hover:bg-blue-50/80 transition-all cursor-pointer shadow-xs ${btnPaddingClasses[size]} ${className}`}
      title={
        title || (isMaximized ? 'Restore table to normal size (Esc)' : 'Maximize table to full screen view')
      }
      aria-label={isMaximized ? 'Restore table' : 'Maximize table'}
    >
      {isMaximized ? (
        <Minimize2 className={iconSizeClasses[size]} />
      ) : (
        <Maximize2 className={iconSizeClasses[size]} />
      )}
    </button>
  );
};

export interface TableMaximizeWrapperProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode | ((isMaximized: boolean) => React.ReactNode);
  isMaximized?: boolean;
  onToggleMaximize?: (maximized: boolean) => void;
  /**
   * If true, renders an integrated floating button stuck to the top-right corner of the table.
   * Remains pinned to the top-right corner regardless of horizontal or vertical scroll.
   * Defaults to true.
   */
  showFloatingButton?: boolean;
  /**
   * If true, renders a clean top bar above the table in normal view with the title and maximize button.
   */
  showTopBar?: boolean;
  extraHeaderActions?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Reusable full-screen / expanded popup wrapper for tables.
 * Features:
 * - High z-index modal (z-[100]) ensuring it always renders above sidebars and headers.
 * - Persistent sticky top-right maximize/minimize button unaffected by horizontal or vertical scroll.
 * - Exact scroll state preservation: keeps the exact row and column visible across maximize/restore transitions.
 * - Full support for sticky footers (tfoot) and sticky headers (thead).
 */
export const TableMaximizeWrapper: React.FC<TableMaximizeWrapperProps> = ({
  title = 'Table View',
  subtitle,
  badge,
  children,
  isMaximized: controlledIsMaximized,
  onToggleMaximize,
  showFloatingButton = true,
  showTopBar = false,
  extraHeaderActions,
  containerClassName = ''
}) => {
  // Support both controlled and uncontrolled state
  const [internalMaximized, setInternalMaximized] = useState(false);
  const isMaximized = controlledIsMaximized !== undefined ? controlledIsMaximized : internalMaximized;

  // Track container references to capture and restore scroll position
  const normalWrapperRef = useRef<HTMLDivElement>(null);
  const modalWrapperRef = useRef<HTMLDivElement>(null);
  const savedScrollPos = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  // Locate scrollable element inside wrapper
  const findScrollElement = (container: HTMLElement | null): HTMLElement | null => {
    if (!container) return null;
    return (
      container.querySelector<HTMLElement>('[data-table-scroll="true"]') ||
      container.querySelector<HTMLElement>('.overflow-auto, .overflow-y-auto') ||
      container
    );
  };

  const handleToggle = (val?: boolean) => {
    const nextVal = val !== undefined ? val : !isMaximized;

    // 1. Capture exact current scroll position before toggling
    const currentContainer = isMaximized ? modalWrapperRef.current : normalWrapperRef.current;
    const scrollEl = findScrollElement(currentContainer);
    if (scrollEl) {
      savedScrollPos.current = {
        top: scrollEl.scrollTop,
        left: scrollEl.scrollLeft
      };
    }

    // 2. Update state
    if (onToggleMaximize) {
      onToggleMaximize(nextVal);
    } else {
      setInternalMaximized(nextVal);
    }
  };

  // Restore exact scroll position after maximize / restore transitions
  useEffect(() => {
    const restore = () => {
      const targetContainer = isMaximized ? modalWrapperRef.current : normalWrapperRef.current;
      const targetScrollEl = findScrollElement(targetContainer);
      if (targetScrollEl && (savedScrollPos.current.top > 0 || savedScrollPos.current.left > 0)) {
        targetScrollEl.scrollTop = savedScrollPos.current.top;
        targetScrollEl.scrollLeft = savedScrollPos.current.left;
      }
    };

    // Use multiple animation frames + timer fallback to ensure layout is completed before scrolling
    const raf1 = requestAnimationFrame(() => {
      restore();
      const raf2 = requestAnimationFrame(restore);
      return () => cancelAnimationFrame(raf2);
    });
    const timeoutId = setTimeout(restore, 60);

    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(timeoutId);
    };
  }, [isMaximized]);

  // Keyboard shortcut (Escape to restore) & body scroll lock
  useEffect(() => {
    if (!isMaximized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleToggle(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMaximized]);

  const content = typeof children === 'function' ? children(isMaximized) : children;

  // In Normal (Non-maximized) View
  if (!isMaximized) {
    return (
      <div ref={normalWrapperRef} className={`relative ${containerClassName}`}>
        {/* Sticky Top-Right Corner Maximize Button */}
        {showFloatingButton && (
          <div className="absolute top-2.5 right-2.5 z-30 pointer-events-auto">
            <TableMaximizeButton
              isMaximized={false}
              onToggle={() => handleToggle(true)}
              title="Maximize table to full screen view"
            />
          </div>
        )}

        {showTopBar && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-b-0 border-slate-300 rounded-t-xl text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{title}</span>
              {badge}
            </div>
            <div className="flex items-center gap-2 pr-9">
              {extraHeaderActions}
            </div>
          </div>
        )}
        {content}
      </div>
    );
  }

  // In Maximized (Popup Modal) View - Uses z-[100] to sit above sidebars and headers
  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={() => handleToggle(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full h-[96vh] max-h-[96vh] border border-slate-300 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="px-5 py-3.5 bg-[#EEF5FB] border-b border-slate-300 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {title}
            </h3>
            {badge}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {extraHeaderActions}

            {/* Restore Down Button */}
            <button
              type="button"
              onClick={() => handleToggle(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
              title="Restore table to normal embedded view (Esc)"
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Restore View</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => handleToggle(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Close expanded view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div ref={modalWrapperRef} className="flex-1 overflow-hidden p-3 sm:p-4 bg-slate-50/50 flex flex-col min-h-0 relative">
          {content}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
