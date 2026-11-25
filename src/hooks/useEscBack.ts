import { useEffect } from 'react';

/**
 * Checks if an HTML element is visible on the screen.
 */
function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.offsetParent === null && el.style.position !== 'fixed') return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Searches the DOM for the active / visible "Back" button.
 */
export function findActiveBackButton(): HTMLElement | null {
  // If a table is currently maximized via TableMaximizeWrapper, let TableMaximizeWrapper handle Esc
  const isMaximizedModal = document.querySelector('.fixed.inset-0.z-\\[100\\]');
  if (isMaximizedModal) {
    return null;
  }

  // If an open modal or dialog exists, prioritize back buttons inside that modal
  const openModal = document.querySelector<HTMLElement>(
    '[role="dialog"], .modal-container, [data-modal="true"], .fixed.inset-0.z-\\[120\\], .fixed.inset-0.z-\\[200\\]'
  );

  const searchRoot = openModal || document;

  // 1. High priority: Elements explicitly tagged with data-back-button="true"
  const taggedButtons = Array.from(
    searchRoot.querySelectorAll<HTMLElement>('[data-back-button="true"]')
  );
  for (const btn of taggedButtons) {
    if (isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
      return btn;
    }
  }

  // 2. Buttons / links with title or aria-label containing "back"
  const titledButtons = Array.from(
    searchRoot.querySelectorAll<HTMLElement>(
      'button[title*="back" i], button[aria-label*="back" i], a[title*="back" i], a[aria-label*="back" i]'
    )
  );
  for (const btn of titledButtons) {
    if (isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
      return btn;
    }
  }

  // 3. Buttons containing ArrowLeft icon (lucide-arrow-left)
  const arrowButtons = Array.from(
    searchRoot.querySelectorAll<HTMLElement>('button, a')
  ).filter((el) => {
    return Boolean(
      el.querySelector('.lucide-arrow-left') ||
      el.querySelector('svg[class*="arrow-left"]') ||
      el.querySelector('svg[data-lucide="arrow-left"]')
    );
  });
  for (const btn of arrowButtons) {
    if (isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
      return btn;
    }
  }

  // 4. Buttons whose text content matches or begins with "back"
  const allButtons = Array.from(searchRoot.querySelectorAll<HTMLElement>('button, a'));
  for (const btn of allButtons) {
    const text = (btn.textContent || '').trim().toLowerCase();
    if (text === 'back' || text.startsWith('back to') || text.includes('back')) {
      if (isElementVisible(btn) && !(btn as HTMLButtonElement).disabled) {
        return btn;
      }
    }
  }

  return null;
}

/**
 * Component-level hook:
 * Can be used inside a specific component to directly attach an onBack / onCancel handler
 * to the Escape key.
 */
export function useEscBack(onBack?: () => void) {
  useEffect(() => {
    if (!onBack) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        // If a modal or maximized table is open, let it handle Esc
        const modalOpen = document.querySelector(
          '[role="dialog"], .fixed.inset-0.z-\\[100\\], .fixed.inset-0.z-\\[120\\], .fixed.inset-0.z-\\[200\\]'
        );
        if (modalOpen) return;

        e.preventDefault();
        e.stopPropagation();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);
}

/**
 * Global application-level hook:
 * Listens on window for the Escape key and automatically triggers any visible back button
 * anywhere across the ERP.
 */
export function useGlobalEscBack() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle plain Escape key
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return;
      }

      // Find the active visible back button
      const backButton = findActiveBackButton();
      if (backButton) {
        e.preventDefault();
        e.stopPropagation();

        // If an input or select is focused, blur it first
        if (document.activeElement && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }

        // Trigger the back button click
        backButton.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
