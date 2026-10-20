import React from 'react';
import { PurchaseOrder } from '../../types/po';
import { InwardEntry } from '../../types/inward';
import { Vendor } from '../../types/vendor';
import { InwardContainer } from './InwardContainer';

interface InwardPageProps {
  pos?: PurchaseOrder[];
  inwards?: InwardEntry[];
  vendors?: Vendor[];
  onAddInward?: (entry: InwardEntry) => void;
  onUpdateInward?: (inward: InwardEntry) => void;
}

export const InwardPage: React.FC<InwardPageProps> = ({
  pos,
  inwards,
  vendors,
  onAddInward,
  onUpdateInward
}) => {
  return (
    <InwardContainer
      initialPOs={pos}
      initialInwards={inwards}
      initialVendors={vendors}
      onAddInward={onAddInward}
      onUpdateInward={onUpdateInward}
    />
  );
};
