import { useEffect } from 'react';

/**
 * Global ERP keyboard navigation hook:
 * When the user fills out a field and presses 'Enter', focus automatically advances
 * to the next form field, preventing premature form submissions and speeding up data entry.
 */
export function useEnterNavigation() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle plain Enter key (without Shift, Ctrl, Alt, Meta)
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const activeEl = document.activeElement as HTMLElement | null;
      if (!activeEl) return;

      const tagName = activeEl.tagName.toLowerCase();

      // Allow natural behavior for buttons, submit triggers, and links
      if (tagName === 'button' || tagName === 'a' || (tagName === 'input' && (activeEl as HTMLInputElement).type === 'submit')) {
        return;
      }

      // Allow Enter inside multiline textareas to produce a new line
      if (tagName === 'textarea') {
        return;
      }

      // Only handle inputs and dropdown selects
      if (tagName !== 'input' && tagName !== 'select') {
        return;
      }

      // Skip file upload inputs
      if (tagName === 'input' && (activeEl as HTMLInputElement).type === 'file') {
        return;
      }

      // Find the most appropriate container: closest modal dialog, form, or main content container
      const container =
        activeEl.closest('[role="dialog"]') ||
        activeEl.closest('.modal-content') ||
        activeEl.closest('form') ||
        activeEl.closest('main') ||
        document.body;

      if (!container) return;

      // Select all interactive focusable elements within the container
      const selector = [
        'input:not([type="hidden"]):not([disabled]):not([readonly])',
        'select:not([disabled]):not([readonly])',
        'textarea:not([disabled]):not([readonly])',
        'button:not([disabled])'
      ].join(', ');

      const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
        // Element must be visible, not display:none or visibility:hidden
        return (
          el.offsetParent !== null &&
          el.tabIndex >= 0 &&
          window.getComputedStyle(el).visibility !== 'hidden' &&
          window.getComputedStyle(el).display !== 'none'
        );
      });

      const currentIndex = focusableElements.indexOf(activeEl);
      if (currentIndex === -1) return;

      const nextEl = focusableElements[currentIndex + 1];

      if (nextEl) {
        e.preventDefault();
        e.stopPropagation();
        nextEl.focus();

        // If next element is an editable text or number input, auto-select its content for quick overwrite
        if (nextEl instanceof HTMLInputElement && typeof nextEl.select === 'function') {
          if (!['checkbox', 'radio', 'button', 'submit', 'color', 'file'].includes(nextEl.type)) {
            nextEl.select();
          }
        }
      }
    };

    // Attach in capture phase to intercept Enter before browser form submissions
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
}
