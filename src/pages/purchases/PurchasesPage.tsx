import React from 'react';
import { WarehousePage } from '../warehouse/WarehousePage';

/**
 * PurchasesPage
 * Redirects / forwards to the unified WarehousePage with 'purchases' (Raw Material Purchase) tab active.
 */
export const PurchasesPage: React.FC = () => {
  return <WarehousePage initialTab="purchases" />;
};

export default PurchasesPage;
