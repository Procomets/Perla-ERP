import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Prevent mouse wheel from unintentionally changing number input values
const handleNumberWheel = (e: Event) => {
  const el = (e.target || document.activeElement) as HTMLElement | null;
  if (el && el instanceof HTMLInputElement && (el.type === 'number' || el.getAttribute('type') === 'number')) {
    el.blur();
  }
};
window.addEventListener('wheel', handleNumberWheel, { passive: true });
document.addEventListener('wheel', handleNumberWheel, { passive: true });

// Prevent Up/Down arrow keys from incrementing/decrementing number input values
const handleNumberKeyDown = (e: KeyboardEvent) => {
  if (
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'Up' ||
    e.key === 'Down' ||
    e.keyCode === 38 ||
    e.keyCode === 40 ||
    e.which === 38 ||
    e.which === 40
  ) {
    const el = (e.target || document.activeElement) as HTMLElement | null;
    if (el && el instanceof HTMLInputElement && (el.type === 'number' || el.getAttribute('type') === 'number')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
};
window.addEventListener('keydown', handleNumberKeyDown, { capture: true });
document.addEventListener('keydown', handleNumberKeyDown, { capture: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
