import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SelectOptionGroup {
  title?: string;
  isHighlighted?: boolean;
  options: SelectOption[];
}

export interface SelectOption {
  id: string;
  primaryText: string;
  primaryNode?: React.ReactNode;
  secondaryText?: string;
  badge?: string;
  badgeVariant?: 'slate' | 'blue' | 'amber' | 'emerald';
  meta?: any;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  searchPlaceholder?: string;
  groups: SelectOptionGroup[];
  onSelect: (option: SelectOption) => void;
  onClear?: () => void;
  disabled?: boolean;
  helperText?: string;
  className?: string;
  formatTriggerLabel?: (option: SelectOption) => React.ReactNode;
  dropdownWidth?: 'trigger' | 'wide' | 'auto' | string;
  align?: 'left' | 'right' | 'auto';
  showSearch?: boolean;
  sortOrder?: 'asc' | 'none';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  required,
  value,
  placeholder = '',
  searchPlaceholder = '',
  groups,
  onSelect,
  onClear,
  disabled = false,
  helperText,
  className = '',
  formatTriggerLabel,
  dropdownWidth = 'trigger',
  align = 'auto',
  showSearch = true,
  sortOrder = 'asc'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsListRef = useRef<HTMLDivElement>(null);

  // Check if dropdown should align right to prevent right-edge clipping
  const [shouldAlignRight, setShouldAlignRight] = useState(align === 'right');

  useEffect(() => {
    if (align === 'right') {
      setShouldAlignRight(true);
      return;
    }
    if (align === 'left') {
      setShouldAlignRight(false);
      return;
    }
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const estimatedWidth = dropdownWidth === 'wide' ? 430 : 350;
      if (rect.left + estimatedWidth > viewportWidth || rect.right > viewportWidth - 40) {
        setShouldAlignRight(true);
      } else {
        setShouldAlignRight(false);
      }
    }
  }, [isOpen, align]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Find currently selected option across all groups
  const selectedOption = groups
    .flatMap((g) => g.options)
    .find(
      (o) =>
        o.id === value ||
        (Boolean(value) && Boolean(o.meta) && (
          o.meta.id === value ||
          o.meta.poId === value ||
          o.meta.vendorId === value ||
          (o.meta.poNumber && String(o.meta.poNumber).trim().toLowerCase() === String(value).trim().toLowerCase())
        ))
    );

  // Sort groups' options in ascending order (keeping pinned empty/'direct'/'all' options first)
  // and filter strictly to what the user searches for
  const filteredGroups = useMemo(() => {
    const isPinnedId = (id: string) =>
      id === '' || id === 'direct' || id === 'all' || id === 'ALL';

    const sortOpts = (opts: SelectOption[]) => {
      if (sortOrder === 'none') return opts;
      return [...opts].sort((a, b) => {
        const aPin = isPinnedId(a.id);
        const bPin = isPinnedId(b.id);
        if (aPin && !bPin) return -1;
        if (!aPin && bPin) return 1;
        return a.primaryText.localeCompare(b.primaryText, undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });
    };

    const q = searchQuery.toLowerCase().trim();
    return groups
      .map((group) => {
        const sortedOptions = sortOpts(group.options);
        if (!q) {
          return { ...group, options: sortedOptions };
        }

        const matchedOptions = sortedOptions.filter((opt) => {
          const p = opt.primaryText.toLowerCase();
          const s = (opt.secondaryText || '').toLowerCase();
          const b = (opt.badge || '').toLowerCase();
          return p.includes(q) || s.includes(q) || b.includes(q);
        });

        return {
          ...group,
          options: matchedOptions
        };
      })
      .filter((group) => group.options.length > 0);
  }, [groups, searchQuery, sortOrder]);

  const allFilteredOptions = useMemo(() => {
    return filteredGroups.flatMap((g) => g.options);
  }, [filteredGroups]);

  const totalOptionsCount = allFilteredOptions.length;
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Automatically highlight when exactly one result matches, or keep index in bounds
  useEffect(() => {
    if (allFilteredOptions.length === 1) {
      setHighlightedIndex(0);
    } else if (searchQuery.trim() && allFilteredOptions.length > 0) {
      setHighlightedIndex(0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [allFilteredOptions, searchQuery]);

  // Keep keyboard-highlighted option visible inside scrollable list
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !optionsListRef.current) return;
    const el = optionsListRef.current.querySelector(
      `[data-option-index="${highlightedIndex}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelectOption = (opt: SelectOption) => {
    onSelect(opt);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const handleKeyNavigation = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(allFilteredOptions.length > 0 ? 0 : -1);
        return;
      }
      if (allFilteredOptions.length === 0) return;
      setHighlightedIndex((prev) =>
        prev < allFilteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(allFilteredOptions.length > 0 ? allFilteredOptions.length - 1 : -1);
        return;
      }
      if (allFilteredOptions.length === 0) return;
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : allFilteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      if (!isOpen) return;
      e.preventDefault();
      e.stopPropagation();
      if (highlightedIndex >= 0 && highlightedIndex < allFilteredOptions.length) {
        handleSelectOption(allFilteredOptions[highlightedIndex]);
      } else if (allFilteredOptions.length === 1) {
        handleSelectOption(allFilteredOptions[0]);
      } else if (allFilteredOptions.length > 0 && searchQuery.trim()) {
        handleSelectOption(allFilteredOptions[0]);
      }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  const getDropdownWidthClass = () => {
    if (dropdownWidth === 'wide') {
      return 'min-w-full sm:min-w-[420px] max-w-[90vw]';
    }
    if (dropdownWidth === 'auto') {
      return 'min-w-full w-max max-w-[90vw]';
    }
    if (dropdownWidth && dropdownWidth !== 'trigger') {
      return dropdownWidth;
    }
    return 'w-full min-w-full';
  };

  return (
    <div className={`space-y-1.5 relative w-full ${className} ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyNavigation}
        className={`w-full h-10 bg-white border ${
          isOpen ? 'border-[#1F4E79] ring-2 ring-[#1F4E79]/20' : 'border-slate-300'
        } rounded-lg px-3 py-2 text-left text-sm flex items-center justify-between gap-2 transition hover:border-slate-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
      >
        <span className="truncate flex-1 font-medium text-slate-800">
          {selectedOption ? (
            formatTriggerLabel ? (
              formatTriggerLabel(selectedOption)
            ) : (
              <span className="flex items-center gap-2 truncate">
                <span className="truncate">{selectedOption.primaryText}</span>
                {selectedOption.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 shrink-0">
                    {selectedOption.badge}
                  </span>
                )}
              </span>
            )
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedOption && onClear && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="p-1 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {helperText && <p className="text-[11px] text-slate-500">{helperText}</p>}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          onKeyDown={handleKeyNavigation}
          className={`absolute ${shouldAlignRight ? 'right-0' : 'left-0'} top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${getDropdownWidthClass()}`}
        >
          {/* Search Box Header */}
          {showSearch && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyNavigation}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#1F4E79] focus:ring-1 focus:ring-[#1F4E79]"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div ref={optionsListRef} className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-1">
            {totalOptionsCount === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-400 italic">
                No matching options found for "{searchQuery}".
              </div>
            ) : (
              filteredGroups.map((group, gIdx) => (
                <div key={group.title || gIdx} className="py-1 first:pt-0 last:pb-0">
                  {group.title && (
                    <div
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                        group.isHighlighted
                          ? 'text-amber-800 bg-amber-50/80 rounded-md my-1'
                          : 'text-slate-400'
                      }`}
                    >
                      {group.title}
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {group.options.map((opt) => {
                      const flatIndex = allFilteredOptions.findIndex((o) => o.id === opt.id);
                      const isSelected = opt.id === value;
                      const isHighlighted = highlightedIndex === flatIndex;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          data-option-index={flatIndex}
                          onClick={() => handleSelectOption(opt)}
                          onMouseEnter={() => {
                            if (flatIndex !== -1) setHighlightedIndex(flatIndex);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-3 transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90 text-[#1F4E79] font-bold ring-1 ring-[#1F4E79]/30'
                              : isHighlighted
                              ? 'bg-blue-50/70 text-[#1F4E79] font-semibold ring-1 ring-[#1F4E79]/20'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              {opt.primaryNode ? (
                                <div className="min-w-0">{opt.primaryNode}</div>
                              ) : (
                                <span className="font-semibold text-slate-900 whitespace-nowrap">{opt.primaryText}</span>
                              )}
                              {opt.badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 max-w-[140px] truncate ${
                                    opt.badgeVariant === 'amber'
                                      ? 'bg-amber-100 text-amber-800'
                                      : opt.badgeVariant === 'emerald'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : opt.badgeVariant === 'blue'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                  title={opt.badge}
                                >
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            {opt.secondaryText && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {opt.secondaryText}
                              </p>
                            )}
                          </div>

                          {isSelected && <Check className="w-4 h-4 text-[#1F4E79] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
