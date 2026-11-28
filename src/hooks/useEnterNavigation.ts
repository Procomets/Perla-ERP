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
        activeEl.closest('[aria-modal="true"]') ||
        activeEl.closest('.modal-content') ||
        activeEl.closest('form') ||
        activeEl.closest('.fixed.inset-0') ||
        activeEl.closest('main') ||
        document.body;

      if (!container) return;

      const isVisible = (el: HTMLElement) =>
        el.offsetParent !== null &&
        el.tabIndex >= 0 &&
        window.getComputedStyle(el).visibility !== 'hidden' &&
        window.getComputedStyle(el).display !== 'none';

      const isCancelOrUtilityButton = (btn: HTMLElement) => {
        if (btn.tagName.toLowerCase() !== 'button') return false;
        const typeAttr = (btn.getAttribute('type') || '').toLowerCase();
        if (typeAttr === 'reset') return true;
        if (typeAttr === 'submit') return false;
        const text = (btn.textContent || '').trim();
        if (!text) return true;
        if (
          /^(cancel|close|back|clear|reset|dismiss|no|×|✕|delete|remove|edit|preview|refresh|print|download|export)$/i.test(
            text
          )
        ) {
          return true;
        }
        if (/^(\+\s*)?(add\s+(line|colour|color|item|row|dc|more|entry)|remove\s+)/i.test(text)) {
          return true;
        }
        const aria = (btn.getAttribute('aria-label') || '').trim();
        if (/^(close|cancel|delete|remove)/i.test(aria)) return true;
        const title = (btn.getAttribute('title') || '').trim();
        if (/^(delete|remove|close)/i.test(title)) return true;
        return false;
      };

      // Select all interactive focusable elements within the container
      const selector = [
        'input:not([type="hidden"]):not([disabled]):not([readonly])',
        'select:not([disabled]):not([readonly])',
        'textarea:not([disabled]):not([readonly])',
        'button:not([disabled])'
      ].join(', ');

      const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(isVisible);

      const currentIndex = focusableElements.indexOf(activeEl);
      if (currentIndex === -1) return;

      const remainingElements = focusableElements.slice(currentIndex + 1);
      const nextFieldInput = remainingElements.find((el) => {
        const tag = el.tagName.toLowerCase();
        return tag === 'input' || tag === 'select' || tag === 'textarea';
      });

      let nextEl: HTMLElement | undefined;

      if (nextFieldInput) {
        // Move directly to the next input/select/textarea field
        nextEl = nextFieldInput;
      } else {
        // Reached the last input field: land on the primary Submit button, never Cancel
        const remainingButtons = remainingElements.filter(
          (el) => el.tagName.toLowerCase() === 'button' && !isCancelOrUtilityButton(el)
        );
        const submitBtn =
          remainingButtons.find((b) => (b.getAttribute('type') || '').toLowerCase() === 'submit') ||
          remainingButtons.find((b) =>
            /save|submit|approve|create|update|confirm|generate|post|proceed|finish|record|apply|add/i.test(
              (b.textContent || '').trim()
            )
          ) ||
          remainingButtons[remainingButtons.length - 1] ||
          Array.from(container.querySelectorAll<HTMLElement>('button[type="submit"]:not([disabled])')).find(
            isVisible
          );

        nextEl = submitBtn;
      }

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
